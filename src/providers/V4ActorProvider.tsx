'use client';

/**
 * The wallet the v4 pages act for. NEAR mode uses the NEAR testnet wallet (direct calls). EVM mode
 * uses the wagmi/RainbowKit wallet (MetaMask etc.): each action is turned into a SignedAction,
 * signed with personal_sign, then relayed (or kept as a payload when no relayer is configured).
 * Mounted by `src/app/v4/layout.tsx` only, inside NearWalletProvider.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import type { FunctionCallAction } from '@/lib/windswap-v4';
import { useNearWallet } from '@/providers/NearWalletProvider';
import { useToast } from '@/providers/ToastProvider';
import { V4_CONTRACT_ID } from '@/lib/v4/config';
import { readableNearError } from '@/lib/v4/near';
import {
  actionMessage,
  expiresAt,
  makeNonce,
  toSignedAction,
  type SignedAction,
  type SignedPayload,
} from '@/lib/v4/evm/signed';
import { relayAction, relayConfigured, type RelayResult } from '@/lib/v4/relay';
import { ownerOfNearAccount } from '@/lib/v4/owner';
import { balanceViews } from '@/lib/v4/ve/views';

export type V4Mode = 'near' | 'evm';

export type V4RunOutcome =
  | { kind: 'near' }
  | { kind: 'relayed'; result: RelayResult }
  | { kind: 'signed'; payload: SignedPayload };

export interface V4Actor {
  mode: V4Mode;
  setMode: (mode: V4Mode) => void;
  /** Connected NEAR testnet account, or null. */
  nearAccountId: string | null;
  /** Connected EVM address in lower case, or null. */
  evmAddress: string | null;
  /** Whether the active mode has a connected wallet. */
  connected: boolean;
  /** The active wallet as shown in the UI: NEAR account or EVM address. */
  label: string | null;
  /** Owner id (64 hex digits) of the active wallet. Null while loading or when disconnected. */
  owner: string | null;
  /** Owner id of the connected NEAR account, whatever the mode. Used by NEAR-only pages. */
  nearOwner: string | null;
  /** Readable error of the last failed action, or null. */
  error: string | null;
  clearError: () => void;
  /** Opens the connect UI of the active mode. */
  connect: () => void;
  /** True while a wallet prompt or relay call is in flight. */
  pending: boolean;
  /**
   * Runs a NEAR call. NEAR mode sends it with the NEAR wallet. EVM mode maps it to a SignedAction
   * (throws for calls without a signed form), signs it, and relays it or keeps the payload.
   */
  run: (call: FunctionCallAction, label: string) => Promise<V4RunOutcome | null>;
  /** Always sends a NEAR transaction, whatever the mode. For NEAR-only pages (portfolio, liquidity). */
  runNear: (call: FunctionCallAction, label: string) => Promise<V4RunOutcome | null>;
  /** EVM mode only: signs and relays an explicit SignedAction (e.g. `WithdrawEvm`). */
  runSigned: (signed: SignedAction, label: string) => Promise<V4RunOutcome | null>;
  /** The last payload signed in this page session. Shown with a copy button when no relayer is set. */
  lastSigned: SignedPayload | null;
  clearSigned: () => void;
}

const MODE_KEY = 'windswap.v4.mode';

const V4ActorContext = createContext<V4Actor | null>(null);

/** Owner id for a wallet key (`near:<account>` or `evm:0x…`). Null until resolved. */
function useOwnerOf(key: string | null): string | null {
  const [state, setState] = useState<{ key: string; value: string } | null>(null);
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const load = key.startsWith('near:') ? ownerOfNearAccount(key.slice('near:'.length)) : balanceViews.resolveWallet(key);
    load
      .then((value) => {
        if (!cancelled) setState({ key, value });
      })
      .catch(() => {
        if (!cancelled) setState(null);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);
  return key && state?.key === key ? state.value : null;
}

export function V4ActorProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const near = useNearWallet();
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { openConnectModal } = useConnectModal();

  const [mode, setModeState] = useState<V4Mode>('near');
  const [pending, setPending] = useState(false);
  const [lastSigned, setLastSigned] = useState<SignedPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Restore the last chosen mode (a per-viewer preference only).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(MODE_KEY);
      if (saved === 'near' || saved === 'evm') setModeState(saved);
    } catch {
      // Storage blocked: keep the default.
    }
  }, []);

  const setMode = useCallback((next: V4Mode) => {
    setModeState(next);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      // Storage blocked: the mode only lasts for this page load.
    }
  }, []);

  const nearAccountId = near.accountId;
  const evmAddress = isConnected && address ? address.toLowerCase() : null;
  const connected = mode === 'near' ? nearAccountId !== null : evmAddress !== null;
  const label = mode === 'near' ? nearAccountId : evmAddress;

  // The owner id is what the contract keys balances and veNFTs by.
  const nearOwner = useOwnerOf(nearAccountId ? `near:${nearAccountId}` : null);
  const evmOwner = useOwnerOf(evmAddress ? `evm:${evmAddress}` : null);
  const owner = mode === 'near' ? nearOwner : evmOwner;

  const connect = useCallback(() => {
    if (mode === 'near') near.connect();
    else openConnectModal?.();
  }, [mode, near, openConnectModal]);

  const signAndRelay = useCallback(
    async (signed: SignedAction, label: string): Promise<V4RunOutcome> => {
      if (!evmAddress) throw new Error('Connect an EVM wallet first.');
      const wallet = `evm:${evmAddress}`;
      const nonce = makeNonce();
      const expires = expiresAt();
      const message = actionMessage(V4_CONTRACT_ID, wallet, nonce, expires, signed);
      const signature = await signMessageAsync({ message });
      const payload: SignedPayload = { wallet, action: signed, nonce, expires, signature, message, label };
      setLastSigned(payload);
      if (!relayConfigured()) return { kind: 'signed', payload };
      const result = await relayAction(payload);
      return { kind: 'relayed', result };
    },
    [evmAddress, signMessageAsync],
  );

  const finish = useCallback(
    async (work: () => Promise<V4RunOutcome>, label: string): Promise<V4RunOutcome | null> => {
      setPending(true);
      setError(null);
      try {
        const outcome = await work();
        if (outcome.kind === 'near') toast.success(label);
        else if (outcome.kind === 'relayed') toast.success(`${label}: relayed`);
        else toast.info(`${label}: signed. No relayer is set, so copy the payload below.`);
        return outcome;
      } catch (err) {
        const message = readableNearError(err);
        setError(message);
        toast.error(message);
        return null;
      } finally {
        setPending(false);
      }
    },
    [toast],
  );

  const run = useCallback(
    (call: FunctionCallAction, label: string) =>
      finish(async () => {
        if (mode === 'near') {
          await near.signAndSend(call);
          return { kind: 'near' } as const;
        }
        return signAndRelay(toSignedAction(call), label);
      }, label),
    [finish, mode, near, signAndRelay],
  );

  const runNear = useCallback(
    (call: FunctionCallAction, label: string) =>
      finish(async () => {
        await near.signAndSend(call);
        return { kind: 'near' } as const;
      }, label),
    [finish, near],
  );

  const runSigned = useCallback(
    (signed: SignedAction, label: string) =>
      finish(async () => {
        if (mode !== 'evm') throw new Error('Switch to EVM mode for this action.');
        return signAndRelay(signed, label);
      }, label),
    [finish, mode, signAndRelay],
  );

  const clearSigned = useCallback(() => setLastSigned(null), []);
  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<V4Actor>(
    () => ({
      mode,
      setMode,
      nearAccountId,
      evmAddress,
      connected,
      label,
      owner,
      nearOwner,
      error,
      clearError,
      connect,
      pending,
      run,
      runNear,
      runSigned,
      lastSigned,
      clearSigned,
    }),
    [mode, setMode, nearAccountId, evmAddress, connected, label, owner, nearOwner, error, clearError, connect, pending, run, runNear, runSigned, lastSigned, clearSigned],
  );

  return <V4ActorContext.Provider value={value}>{children}</V4ActorContext.Provider>;
}

export function useV4Actor(): V4Actor {
  const ctx = useContext(V4ActorContext);
  if (!ctx) throw new Error('useV4Actor must be used inside V4ActorProvider');
  return ctx;
}
