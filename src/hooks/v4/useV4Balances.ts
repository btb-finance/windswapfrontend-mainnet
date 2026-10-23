'use client';

import { useCallback, useEffect, useState } from 'react';
import type { V4Token } from '@/lib/v4/config';
import { nearView, readableNearError } from '@/lib/v4/near';
import { balanceViews } from '@/lib/v4/ve/views';

export interface V4Balances {
  /** Internal DEX balance per token account id (base units). Keyed by owner, so it works for NEAR and EVM wallets. */
  dex: Record<string, bigint>;
  /** Token balance in the user's NEAR wallet per token account id (base units). NEAR accounts only. */
  wallet: Record<string, bigint>;
  /** Whether the user has a storage registration on each token (NEP-145). NEAR accounts only. */
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
 * DEX balances of `owner` (64 hex digits) and, for a NEAR account, its wallet balances and storage.
 * Empty when `owner` is null.
 */
export function useV4Balances(
  owner: string | null,
  nearAccountId: string | null,
  tokens: readonly V4Token[],
  pollMs = 20_000,
): V4Balances {
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
    if (!owner) {
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
            const dexBal = BigInt(await balanceViews.balanceOfOwner(owner!, tokenId));
            if (!nearAccountId) return { tokenId, dexBal, walletBal: null, registered: null };
            const [walletBal, storage] = await Promise.all([
              nearView<string>(tokenId, 'ft_balance_of', { account_id: nearAccountId }).then(BigInt),
              nearView<StorageBalance | null>(tokenId, 'storage_balance_of', { account_id: nearAccountId }),
            ]);
            return { tokenId, dexBal, walletBal, registered: storage !== null };
          }),
        );
        if (cancelled) return;
        setDex(Object.fromEntries(entries.map((e) => [e.tokenId, e.dexBal])));
        if (nearAccountId) {
          setWallet(Object.fromEntries(entries.map((e) => [e.tokenId, e.walletBal ?? 0n])));
          setRegistered(Object.fromEntries(entries.map((e) => [e.tokenId, e.registered ?? false])));
        } else {
          setWallet({});
          setRegistered({});
        }
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
  }, [owner, nearAccountId, tokenKey, pollMs, tick]);

  return { dex, wallet, registered, loading, error, refresh };
}

