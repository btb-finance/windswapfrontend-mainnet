import type { HopArg, HopInput } from '@/lib/windswap-v4';
import type { V4Pool } from '@/hooks/v4/useV4Market';

/** One candidate way to swap `tokenIn` for `tokenOut`. */
export interface V4Route {
  /** Stable id: `pool-<id>` or `pool-<a>-pool-<b>`. */
  id: string;
  label: string;
  /** Pools used, in order. */
  poolIds: number[];
  /** Fee of each hop, in hundredths of a bip. */
  fees: number[];
  hops: HopArg[];
}

const other = (pool: V4Pool, token: string): string | null =>
  pool.token0.accountId === token ? pool.token1.accountId : pool.token1.accountId === token ? pool.token0.accountId : null;

/**
 * Candidate routes from `tokenIn` to `tokenOut`: every direct pool, plus two-hop routes
 * `pool A -> pool B` whose middle token is not an endpoint. With only tUSDC and tWETH there are
 * no two-hop routes, because a two-hop route through the same pair returns the input token.
 */
export function buildRoutes(pools: V4Pool[], tokenIn: string, tokenOut: string): V4Route[] {
  const routes: V4Route[] = [];

  for (const pool of pools) {
    if (other(pool, tokenIn) === tokenOut) {
      routes.push({
        id: `pool-${pool.poolId}`,
        label: `Pool ${pool.poolId}`,
        poolIds: [pool.poolId],
        fees: [pool.fee],
        hops: [{ poolId: pool.poolId, tokenIn }],
      });
    }
  }

  for (const first of pools) {
    const mid = other(first, tokenIn);
    if (!mid || mid === tokenOut) continue;
    for (const second of pools) {
      if (second.poolId === first.poolId) continue;
      if (other(second, mid) !== tokenOut) continue;
      routes.push({
        id: `pool-${first.poolId}-pool-${second.poolId}`,
        label: `Pool ${first.poolId} → Pool ${second.poolId}`,
        poolIds: [first.poolId, second.poolId],
        fees: [first.fee, second.fee],
        hops: [
          { poolId: first.poolId, tokenIn },
          { poolId: second.poolId, tokenIn: mid },
        ],
      });
    }
  }

  return routes;
}

export function toHopInputs(route: V4Route): HopInput[] {
  return route.hops.map((h) => ({ pool_id: h.poolId, token_in: h.tokenIn }));
}
