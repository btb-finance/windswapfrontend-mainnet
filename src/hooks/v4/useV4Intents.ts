'use client';

/**
 * EVM "intent" flow for one-click swaps and zaps:
 *   1. sign the intent (personal_sign)  2. POST it to the relayer  3. deposit the input on Base Sepolia
 *   4. poll `get_intent`, and for a swap the payout withdrawal, until it is final.
 * With no relayer configured, step 2 and 3 are skipped and the signed body is kept for copying.
 * Runs live in component state only: a page reload drops the tracker (the intent stays on chain).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { erc20Abi } from 'viem';
import { useAccount, useBalance, useReadContract, useSendTransaction, useSignMessage, useSwitchChain } from 'wagmi';
import { useWriteContract } from '@/hooks/useWriteContract';
import { useV4Actor } from '@/providers/V4ActorProvider';
import { useToast } from '@/providers/ToastProvider';
import { V4_ASSET_ETH, V4_ASSET_TEST1, V4_CONTRACT_ID, V4_EVM_CHAIN_ID, V4_TEST1_ADDRESS, V4_VAULT_ADDRESS } from '@/lib/v4/config';
import { readableNearError } from '@/lib/v4/near';
import { ownerViews } from '@/lib/v4/owner-views';
import { expiresAt, makeNonce } from '@/lib/v4/evm/signed';
import {
  cancelIntentMessage,
  intentMessage,
  parseIntentState,
  withdrawalIdFromResult,
  type Intent,
  type IntentState,
  type IntentSubmitBody,
} from '@/lib/v4/intents';
import { postIntent, postIntentCancel, relayConfigured } from '@/lib/v4/relay';
import type { WithdrawalView } from '@/lib/v4/ve/views';

const POLL_MS = 4_000;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

export type IntentKind = 'swap' | 'add';

export interface IntentRequest {
  kind: IntentKind;
  label: string;
  intent: Intent;
  /** Input asset, `base-sepolia:eth` or `base-sepolia:test1`. Deposited on Base Sepolia. */
  tokenIn: string;
  /** Input amount, base units. Must equal the intent's `amount_in`. */
  amountIn: bigint;
  /** Swap only: the output asset, paid out to the wallet on Base Sepolia. */
  tokenOut?: string;
}

export interface IntentRun {
  key: string;
  kind: IntentKind;
  label: string;
  /** `evm:0x…` of the signer. */
  wallet: string;
  /** Owner id (64 hex) of the signer, for the withdrawal views. */
  owner: string;
  tokenIn: string;
  amountIn: bigint;
  tokenOut?: string;
  /** The signed body. With no relayer this is what the operator copies. */
  body: IntentSubmitBody;
  /** True once the relayer accepted the intent. */
  relayed: boolean;
  intentId?: string;
  relayTxHash?: string;
  depositHash?: `0x${string}`;
  depositError?: string;
  /** Highest withdrawal id before this intent. The payout is a newer one. */
  withdrawalFloor: number;
  state: IntentState | null;
  /** Swap only: the payout withdrawal once the contract created it. */
  payout?: WithdrawalView | null;
  cancelRequested?: boolean;
  error?: string;
}

/** Final when the contract has decided and, for a swap, the payout has reached Broadcast or Failed. */
export function isFinalRun(run: IntentRun): boolean {
  const s = run.state;
  if (!s) return false;
  if (s.kind === 'failed') return true;
  if (s.kind !== 'executed') return false;
  if (run.kind === 'add') return true;
  return run.payout?.status === 'Broadcast' || run.payout?.status === 'Failed';
}

/** The payout of a swap: the hinted withdrawal id if the result names one, else the newest matching one. */
function findPayout(list: WithdrawalView[], run: IntentRun, hinted: number | null): WithdrawalView | null {
  if (hinted !== null) return list.find((w) => w.id === hinted) ?? null;
  const to = run.wallet.slice('evm:'.length).toLowerCase();
  const matches = list
    .filter((w) => w.id > run.withdrawalFloor && w.token_id === run.tokenOut && w.to_address.toLowerCase() === to)
    .sort((a, b) => b.id - a.id);
  return matches[0] ?? null;
}

export function useV4Intents() {
  const { evmAddress, owner } = useV4Actor();
  const toast = useToast();
  const { chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();
  const { signMessageAsync } = useSignMessage();

  const [runs, setRuns] = useState<IntentRun[]>([]);
  const [busy, setBusy] = useState(false);
  const runsRef = useRef(runs);
  useEffect(() => {
    runsRef.current = runs;
  }, [runs]);

  const patch = useCallback((key: string, p: Partial<IntentRun>) => {
    setRuns((prev) => prev.map((r) => (r.key === key ? { ...r, ...p } : r)));
  }, []);

  /** Sends the input to the vault on Base Sepolia. Native ETH by sendTransaction, test1 by transfer. */
  const sendDeposit = useCallback(
    async (key: string, asset: string, amount: bigint): Promise<boolean> => {
      try {
        if (chainId !== V4_EVM_CHAIN_ID) await switchChainAsync({ chainId: V4_EVM_CHAIN_ID });
        const hash =
          asset === V4_ASSET_ETH
            ? await sendTransactionAsync({ chainId: V4_EVM_CHAIN_ID, to: V4_VAULT_ADDRESS, value: amount })
            : await writeContractAsync({
                chainId: V4_EVM_CHAIN_ID,
                address: V4_TEST1_ADDRESS,
                abi: erc20Abi,
                functionName: 'transfer',
                args: [V4_VAULT_ADDRESS, amount],
              });
        patch(key, { depositHash: hash, depositError: undefined });
        return true;
      } catch (err) {
        patch(key, { depositError: readableNearError(err) });
        return false;
      }
    },
    [chainId, switchChainAsync, sendTransactionAsync, writeContractAsync, patch],
  );

  /** Signs the intent, submits it, then sends the deposit. Resolves to false when nothing was signed. */
  const start = useCallback(
    async (req: IntentRequest): Promise<boolean> => {
      if (!evmAddress || !owner) {
        toast.error('Connect an EVM wallet first.');
        return false;
      }
      setBusy(true);
      try {
        const wallet = `evm:${evmAddress}`;
        // Only a swap pays out, so only a swap needs the withdrawal baseline.
        const withdrawalFloor =
          req.kind === 'swap' ? Math.max(0, ...(await ownerViews.withdrawalsOfOwner(owner)).map((w) => w.id)) : 0;
        const nonce = makeNonce();
        const expires = expiresAt();
        const message = intentMessage(V4_CONTRACT_ID, wallet, nonce, expires, req.intent);
        const signature = await signMessageAsync({ message });
        const body: IntentSubmitBody = { wallet, intent: req.intent, nonce, expires, signature };

        const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const run: IntentRun = {
          key,
          kind: req.kind,
          label: req.label,
          wallet,
          owner,
          tokenIn: req.tokenIn,
          amountIn: req.amountIn,
          tokenOut: req.tokenOut,
          body,
          relayed: false,
          withdrawalFloor,
          state: null,
        };
        setRuns((prev) => [run, ...prev]);

        if (!relayConfigured()) {
          toast.info(`${req.label}: signed. No relayer is set, so copy the payload below.`);
          return true;
        }

        try {
          const submitted = await postIntent(body);
          patch(key, { relayed: true, intentId: submitted.intentId, relayTxHash: submitted.txHash });
        } catch (err) {
          patch(key, { error: readableNearError(err) });
          toast.error(readableNearError(err));
          return false;
        }

        const sent = await sendDeposit(key, req.tokenIn, req.amountIn);
        if (sent) toast.success(`${req.label}: deposit sent. The relayer picks it up from Base Sepolia.`);
        else toast.error('Deposit not sent. The intent stays open, so send the deposit or cancel it.');
        return true;
      } catch (err) {
        toast.error(readableNearError(err));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [evmAddress, owner, toast, signMessageAsync, patch, sendDeposit],
  );

  /** Re-sends the deposit of a submitted intent whose Base transaction was rejected or never sent. */
  const retryDeposit = useCallback(
    async (key: string) => {
      const run = runsRef.current.find((r) => r.key === key);
      if (!run?.intentId || run.depositHash) return;
      await sendDeposit(key, run.tokenIn, run.amountIn);
    },
    [sendDeposit],
  );

  /** Signs a cancel for an open intent and posts it. The status follows by polling. */
  const cancel = useCallback(
    async (key: string) => {
      const run = runsRef.current.find((r) => r.key === key);
      if (!run?.intentId) return;
      try {
        const nonce = makeNonce();
        const expires = expiresAt();
        const message = cancelIntentMessage(V4_CONTRACT_ID, run.intentId, run.wallet, nonce, expires);
        const signature = await signMessageAsync({ message });
        await postIntentCancel({ wallet: run.wallet, id: run.intentId, nonce, expires, signature });
        patch(key, { cancelRequested: true });
        toast.success('Cancel sent. The status updates when the relayer processes it.');
      } catch (err) {
        toast.error(readableNearError(err));
      }
    },
    [signMessageAsync, patch, toast],
  );

  const dismiss = useCallback((key: string) => {
    setRuns((prev) => prev.filter((r) => r.key !== key));
  }, []);

  // Poll every open run: the intent state, and for a swap the payout withdrawal.
  useEffect(() => {
    const tick = async () => {
      const active = runsRef.current.filter((r) => r.intentId && !isFinalRun(r));
      for (const run of active) {
        try {
          const state = parseIntentState(await ownerViews.getIntent(run.intentId!));
          let payout: WithdrawalView | null | undefined = run.payout;
          if (state.kind === 'executed' && run.kind === 'swap') {
            const list = await ownerViews.withdrawalsOfOwner(run.owner);
            payout = findPayout(list, run, withdrawalIdFromResult(state.result));
          }
          patch(run.key, { state, payout });
        } catch {
          // Keep the last known state. The next tick tries again.
        }
      }
    };
    const timer = setInterval(() => void tick(), POLL_MS);
    return () => clearInterval(timer);
  }, [patch]);

  return { runs, busy, start, retryDeposit, cancel, dismiss };
}

/**
 * Base Sepolia balance of the connected EVM wallet for a Base asset, base units. Undefined while
 * loading, and for any other asset (a NEAR token id).
 */
export function useBaseBalance(asset: string): bigint | undefined {
  const { address } = useAccount();
  const isEth = asset === V4_ASSET_ETH;
  const isTest1 = asset === V4_ASSET_TEST1;
  const eth = useBalance({ address, chainId: V4_EVM_CHAIN_ID, query: { enabled: !!address && isEth } });
  const test1 = useReadContract({
    chainId: V4_EVM_CHAIN_ID,
    address: V4_TEST1_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address ?? ZERO_ADDRESS],
    query: { enabled: !!address && isTest1 },
  });
  if (isEth) return eth.data?.value;
  if (isTest1) return test1.data;
  return undefined;
}
