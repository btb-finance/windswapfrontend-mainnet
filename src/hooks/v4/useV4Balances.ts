'use client';

import { useCallback, useEffect, useState } from 'react';
import type { V4Token } from '@/lib/v4/config';
import { v4Client } from '@/lib/v4/client';
import { nearView, readableNearError } from '@/lib/v4/near';

export interface V4Balances {
  /** Internal DEX balance per token account id (base units). */
  dex: Record<string, bigint>;
  /** Token balance in the user's NEAR wallet per token account id (base units). */
  wallet: Record<string, bigint>;
  /** Whether the user has a storage registration on each token (NEP-145). */
  registered: Record<string, boolean>;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

interface StorageBalance {
  total: string;
  available: string;
}

/**
 * DEX and wallet balances of `accountId` for each token. Empty when `accountId` is null.
 */
export function useV4Balances(accountId: string | null, tokens: readonly V4Token[], pollMs = 20_000): V4Balances {
  const [dex, setDex] = useState<Record<string, bigint>>({});
  const [wallet, setWallet] = useState<Record<string, bigint>>({});
  const [registered, setRegistered] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  // Stable key so the effect does not re-run when the caller passes a new array with the same tokens.
  const tokenKey = tokens.map((t) => t.accountId).join(',');

  useEffect(() => {
    if (!accountId) {
      setDex({});
      setWallet({});
      setRegistered({});
      return;
    }
    let cancelled = false;
    const ids = tokenKey ? tokenKey.split(',') : [];

    async function load() {
      setLoading(true);
      try {
        const entries = await Promise.all(
          ids.map(async (tokenId) => {
            const [dexBal, walletBal, storage] = await Promise.all([
              v4Client.getBalance(accountId!, tokenId).then(BigInt),
              nearView<string>(tokenId, 'ft_balance_of', { account_id: accountId }).then(BigInt),
              nearView<StorageBalance | null>(tokenId, 'storage_balance_of', { account_id: accountId }),
            ]);
            return { tokenId, dexBal, walletBal, registered: storage !== null };
          }),
        );
        if (cancelled) return;
        setDex(Object.fromEntries(entries.map((e) => [e.tokenId, e.dexBal])));
        setWallet(Object.fromEntries(entries.map((e) => [e.tokenId, e.walletBal])));
        setRegistered(Object.fromEntries(entries.map((e) => [e.tokenId, e.registered])));
        setError(null);
      } catch (err) {
        if (!cancelled) setError(readableNearError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    const timer = pollMs > 0 ? setInterval(() => void load(), pollMs) : undefined;
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [accountId, tokenKey, pollMs, tick]);

  return { dex, wallet, registered, loading, error, refresh };
}
