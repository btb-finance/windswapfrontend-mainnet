'use client';

import { useCallback, useEffect, useState } from 'react';
import { sqrtPriceX96ToPrice, type PoolView } from '@/lib/windswap-v4';
import { V4_EVM_TOKENS, V4_POOL_PROBE_MAX, V4_TOKENS, getV4Token, type V4Token } from '@/lib/v4/config';
import { v4Client } from '@/lib/v4/client';
import { readableNearError } from '@/lib/v4/near';

export interface V4Pool {
  poolId: number;
  token0: V4Token;
  token1: V4Token;
  tickSpacing: number;
  /** Current tick from slot0. */
  tick: number;
  sqrtPriceX96: bigint;
  /** Human price: token1 per token0. */
  price: number;
  liquidity: bigint;
  /** Swap fee in hundredths of a bip, for the connected account (or the default when disconnected). */
  fee: number;
}

export interface V4Market {
  /** Whitelisted NEAR tokens that the UI knows about. Deposits and wallet balances use these. */
  tokens: V4Token[];
  /** `tokens` plus the Base Sepolia assets that pools may hold (EVM mode). */
  allTokens: V4Token[];
  /** Pools whose two tokens are both whitelisted and known. Pools with other tokens are hidden. */
  pools: V4Pool[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Loads the whitelisted tokens and every pool whose tokens are both whitelisted.
 * The contract has no pool-count view, so pool ids 0..V4_POOL_PROBE_MAX-1 are probed.
 */
export function useV4Market(accountId: string | null, pollMs = 20_000): V4Market {
  const [tokens, setTokens] = useState<V4Token[]>([]);
  const [allTokens, setAllTokens] = useState<V4Token[]>([]);
  const [pools, setPools] = useState<V4Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const whitelisted = await v4Client.getTokens();
        // Base Sepolia assets are always known: they are not NEAR tokens, so `get_tokens` does not list them.
        const nearTokens = V4_TOKENS.filter((t) => whitelisted.includes(t.accountId));
        const known = [...nearTokens, ...V4_EVM_TOKENS];
        const ids = Array.from({ length: V4_POOL_PROBE_MAX }, (_, i) => i);
        const results = await Promise.allSettled(ids.map((id) => v4Client.getPool(id)));
        const feeAccount = accountId ?? v4Client.contractId;

        const views = results.flatMap((r, id) => (r.status === 'fulfilled' ? [{ id, view: r.value }] : []));
        const usable = views.filter(
          ({ view }: { view: PoolView }) =>
            view.initialized &&
            view.slot0.sqrt_price_x96 !== '0' &&
            known.some((t) => t.accountId === view.token0) &&
            known.some((t) => t.accountId === view.token1),
        );

        const built = await Promise.all(
          usable.map(async ({ id, view }) => {
            const token0 = getV4Token(view.token0)!;
            const token1 = getV4Token(view.token1)!;
            const sqrtPriceX96 = BigInt(view.slot0.sqrt_price_x96);
            const fee = await v4Client.getFee(id, feeAccount).catch(() => 0);
            return {
              poolId: id,
              token0,
              token1,
              tickSpacing: view.tick_spacing,
              tick: view.slot0.tick,
              sqrtPriceX96,
              price: sqrtPriceX96ToPrice(sqrtPriceX96, token0.decimals, token1.decimals),
              liquidity: BigInt(view.liquidity),
              fee,
            } satisfies V4Pool;
          }),
        );

        if (cancelled) return;
        setTokens(nearTokens);
        setAllTokens(known);
        setPools(built.sort((a, b) => a.poolId - b.poolId));
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
  }, [accountId, pollMs, tick]);

  return { tokens, allTokens, pools, loading, error, refresh };
}
