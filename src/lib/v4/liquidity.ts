import {
  MAX_TICK,
  MIN_TICK,
  getAmountsForLiquidity,
  getLiquidityForAmount0,
  getLiquidityForAmount1,
  getSqrtRatioAtTick,
  nearestUsableTick,
  priceToTick,
} from '@/lib/windswap-v4';
import type { V4Pool } from '@/hooks/v4/useV4Market';

export interface RangeTicks {
  tickLower: number;
  tickUpper: number;
}

/**
 * Ticks for a human price range (token1 per token0), each rounded to the pool's tick spacing.
 * Returns an error message instead of throwing.
 */
export function rangeTicksFromPrices(
  pool: V4Pool,
  minPrice: string,
  maxPrice: string,
): { ok: true; ticks: RangeTicks } | { ok: false; error: string } {
  const lo = Number(minPrice);
  const hi = Number(maxPrice);
  if (!minPrice.trim() || !maxPrice.trim() || !Number.isFinite(lo) || !Number.isFinite(hi) || lo <= 0 || hi <= 0) {
    return { ok: false, error: 'Enter a min and max price greater than zero.' };
  }
  if (lo >= hi) return { ok: false, error: 'The max price must be above the min price.' };
  try {
    const tickLower = nearestUsableTick(priceToTick(minPrice, pool.token0.decimals, pool.token1.decimals), pool.tickSpacing);
    const tickUpper = nearestUsableTick(priceToTick(maxPrice, pool.token0.decimals, pool.token1.decimals), pool.tickSpacing);
    if (tickLower >= tickUpper) {
      return { ok: false, error: 'Price range is too narrow for this pool’s tick spacing. Widen it.' };
    }
    return { ok: true, ticks: { tickLower, tickUpper } };
  } catch {
    return { ok: false, error: 'Price is outside the range this pool supports.' };
  }
}

/** Widest ticks that are multiples of the pool's tick spacing. */
export function fullRangeTicks(tickSpacing: number): RangeTicks {
  return {
    tickLower: Math.ceil(MIN_TICK / tickSpacing) * tickSpacing,
    tickUpper: Math.floor(MAX_TICK / tickSpacing) * tickSpacing,
  };
}

/**
 * Liquidity that `amount0` buys in `[tickLower, tickUpper)` at the current price. Zero when the
 * range is entirely below the price (only token1 is used there).
 */
export function liquidityFromAmount0(pool: V4Pool, ticks: RangeTicks, amount0: bigint): bigint {
  const sA = getSqrtRatioAtTick(ticks.tickLower);
  const sB = getSqrtRatioAtTick(ticks.tickUpper);
  const sP = pool.sqrtPriceX96;
  if (sP >= sB) return 0n;
  return getLiquidityForAmount0(sP <= sA ? sA : sP, sB, amount0);
}

/** Liquidity that `amount1` buys in the range. Zero when the range is entirely above the price. */
export function liquidityFromAmount1(pool: V4Pool, ticks: RangeTicks, amount1: bigint): bigint {
  const sA = getSqrtRatioAtTick(ticks.tickLower);
  const sB = getSqrtRatioAtTick(ticks.tickUpper);
  const sP = pool.sqrtPriceX96;
  if (sP <= sA) return 0n;
  return getLiquidityForAmount1(sA, sP >= sB ? sB : sP, amount1);
}

/** Token amounts that `liquidity` needs in the range at the current price (rounded down). */
export function amountsForLiquidity(pool: V4Pool, ticks: RangeTicks, liquidity: bigint): { amount0: bigint; amount1: bigint } {
  return getAmountsForLiquidity(
    pool.sqrtPriceX96,
    getSqrtRatioAtTick(ticks.tickLower),
    getSqrtRatioAtTick(ticks.tickUpper),
    liquidity,
  );
}

export function isInRange(pool: V4Pool, ticks: RangeTicks): boolean {
  return ticks.tickLower <= pool.tick && pool.tick < ticks.tickUpper;
}

/**
 * Lowest liquidity a single-token zap may mint, for `min_liquidity`: the liquidity that `amount`
 * of `side` (0 = token0, 1 = token1) buys, less `slippageBps`. A zap in range swaps about half of
 * the input into the other token first, so the estimate uses half the amount. Out of range only
 * one token is used, so the whole amount counts. This is an estimate: confirm it on testnet.
 */
export function zapMinLiquidity(pool: V4Pool, ticks: RangeTicks, side: 0 | 1, amount: bigint, slippageBps: number): bigint {
  const effective = isInRange(pool, ticks) ? amount / 2n : amount;
  const liquidity = side === 0 ? liquidityFromAmount0(pool, ticks, effective) : liquidityFromAmount1(pool, ticks, effective);
  return (liquidity * BigInt(10_000 - Math.round(slippageBps))) / 10_000n;
}
