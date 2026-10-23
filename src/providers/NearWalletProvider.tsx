'use client';

/**
 * NEAR testnet wallet for the Wind Swap v4 routes (`/v4/*`). Mounted by `src/app/v4/layout.tsx`
 * only, so the EVM pages (wagmi/RainbowKit) are unaffected and do not load wallet-selector.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { setupWalletSelector, type Action, type WalletSelector } from '@near-wallet-selector/core';
import { setupModal, type WalletSelectorModal } from '@near-wallet-selector/modal-ui';
import { setupMyNearWallet } from '@near-wallet-selector/my-near-wallet';
import { setupMeteorWallet } from '@near-wallet-selector/meteor-wallet';
import { setupHereWallet } from '@near-wallet-selector/here-wallet';
import '@near-wallet-selector/modal-ui/styles.css';
import type { FunctionCallAction } from '@/lib/windswap-v4';
import { V4_CONTRACT_ID, V4_NETWORK } from '@/lib/v4/config';
import { toWalletTransaction } from '@/lib/v4/near';

interface Session {
  selector: WalletSelector;
  modal: WalletSelectorModal;
}

// One selector per page load, shared by every mount of the provider.
let sessionPromise: Promise<Session> | null = null;

function getSession(): Promise<Session> {
  if (!sessionPromise) {
    sessionPromise = setupWalletSelector({
      // Explicit network so wallet RPC traffic avoids the rate-limited public endpoint.
      network: {
        networkId: V4_NETWORK,
        nodeUrl: 'https://rpc.testnet.fastnear.com',
        helperUrl: 'https://helper.testnet.near.org',
        explorerUrl: 'https://testnet.nearblocks.io',
        indexerUrl: 'https://testnet-api.kitwallet.app',
      },
      modules: [setupMyNearWallet(), setupMeteorWallet(), setupHereWallet()],
    }).then((selector) => ({
      selector,
      modal: setupModal(selector, {
        contractId: V4_CONTRACT_ID,
        theme: 'dark',
        description: 'Connect a NEAR testnet wallet to use Wind Swap v4.',
      }),
    }));
  }
  return sessionPromise;
}

export interface NearWalletContextValue {
  /** False until wallet-selector has loaded. */
  ready: boolean;
  /** Active NEAR account on testnet, or null when disconnected. */
  accountId: string | null;
  /** Opens the wallet picker. */
  connect: () => void;
  disconnect: () => Promise<void>;
  /**
   * Signs and sends one FunctionCall (an SDK action from `buildActions` or `storageDepositAction`).
   * Some web wallets redirect the page, in which case the promise does not resolve in this page.
   */
  signAndSend: (action: FunctionCallAction) => Promise<unknown>;
}

const NearWalletContext = createContext<NearWalletContextValue | null>(null);

export function NearWalletProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const accountRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let subscription: { unsubscribe: () => void } | undefined;

    getSession()
      .then((session) => {
        if (cancelled) return;
        sessionRef.current = session;
        const sync = (state: ReturnType<WalletSelector['store']['getState']>) => {
          const active = state.accounts.find((a) => a.active)?.accountId ?? null;
          accountRef.current = active;
          setAccountId(active);
        };
        sync(session.selector.store.getState());
        subscription = session.selector.store.observable.subscribe(sync);
        setReady(true);
      })
      .catch(() => {
        // Wallet selector failed to load. The v4 pages still render, with the connect button disabled.
        if (!cancelled) setReady(false);
      });

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, []);

  const connect = useCallback(() => {
    void getSession().then(({ modal }) => modal.show());
  }, []);

  const disconnect = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;
    const wallet = await session.selector.wallet();
    await wallet.signOut();
  }, []);

  const signAndSend = useCallback(async (action: FunctionCallAction) => {
    const session = sessionRef.current;
    if (!session || !accountRef.current) throw new Error('Connect a NEAR wallet first.');
    const tx = toWalletTransaction(action);
    const wallet = await session.selector.wallet();
    return wallet.signAndSendTransaction({
      receiverId: tx.receiverId,
      signerId: accountRef.current,
      // wallet-selector accepts the plain `{ type, params }` form at runtime. Its public type is the
      // class-based NEAR `Action`, so the cast is needed.
      actions: tx.actions as unknown as Action[],
    });
  }, []);

  const value = useMemo<NearWalletContextValue>(
    () => ({ ready, accountId, connect, disconnect, signAndSend }),
    [ready, accountId, connect, disconnect, signAndSend],
  );

  return <NearWalletContext.Provider value={value}>{children}</NearWalletContext.Provider>;
}

export function useNearWallet(): NearWalletContextValue {
  const ctx = useContext(NearWalletContext);
  if (!ctx) throw new Error('useNearWallet must be used inside NearWalletProvider');
  return ctx;
}
