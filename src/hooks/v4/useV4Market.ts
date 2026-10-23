'use client';

import { useCallback, useEffect, useState } from 'react';
import { sqrtPriceX96ToPrice, type PoolView } from '@/lib/windswap-v4';
import { V4_EVM_TOKENS, V4_TOKENS, getV4Token, type V4Token } from '@/lib/v4/config';
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
 * Pools come from one `get_pools` call (saved per-pool summaries, contract v9).
 */

/** Row of the contract's `get_pools` view. */
interface PoolSummary {
  pool_id: number;
  token0: string;
  token1: string;
  tick_spacing: number;
  fee: number;
  sqrt_price_x96: string;
  tick: number;
  liquidity: string;
}
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
        // One view call returns every pool's saved summary (contract v9 `get_pools`), instead of
        // probing pool ids one by one.
        const summaries: PoolSummary[] = [];
        for (let from = 0; ; from += 100) {
          const page = await v4Client.view<PoolSummary[]>('get_pools', { from_index: from, limit: 100 });
          summaries.push(...page);
          if (page.length < 100) break;
        }
        const usable = summaries.filter(
          (p) =>
            p.sqrt_price_x96 !== '0' &&
            known.some((t) => t.accountId === p.token0) &&
            known.some((t) => t.accountId === p.token1),
        );
        const built = usable.map((p) => {
          const token0 = getV4Token(p.token0)!;
          const token1 = getV4Token(p.token1)!;
          const sqrtPriceX96 = BigInt(p.sqrt_price_x96);
          return {
            poolId: p.pool_id,
            token0,
            token1,
            tickSpacing: p.tick_spacing,
            tick: p.tick,
            sqrtPriceX96,
            price: sqrtPriceX96ToPrice(sqrtPriceX96, token0.decimals, token1.decimals),
            liquidity: BigInt(p.liquidity),
            fee: p.fee,
          } satisfies V4Pool;
        });

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
