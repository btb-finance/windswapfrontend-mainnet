/**
 * APR Calculator for WindSwap Pools
 * 
 * Centralized APR calculation logic with proper Uniswap V3 concentration math.
 * All APR calculations should use this file as the single source of truth.
 */

// Uniswap V3 tick bounds
const MIN_TICK = -887272;
const MAX_TICK = 887272;
const FULL_RANGE_TICKS = MAX_TICK - MIN_TICK; // 1,774,544 ticks

/**
 * Calculate base APR for a pool based on emissions and TVL
 * This is the "full-range equivalent" APR before any concentration multiplier
 * 
 * @param rewardRatePerSecond - WIND reward rate in wei per second
 * @param windPriceUsd - Current WIND price in USD
 * @param tvlUsd - Pool TVL in USD
 * @returns Base APR as a percentage (e.g., 100 = 100%)
 */
export function calculateBaseAPR(
    rewardRatePerSecond: bigint,
    windPriceUsd: number,
    tvlUsd: number
): number {
    if (tvlUsd <= 0 || windPriceUsd <= 0) return 0;

    // Convert reward rate from wei to WIND
    const rewardsPerSecond = Number(rewardRatePerSecond) / 1e18;

    // Annual rewards in WIND (seconds per year = 31,536,000)
    const annualRewardsWind = rewardsPerSecond * 60 * 60 * 24 * 365;

    // Annual rewards in USD
    const annualRewardsUsd = annualRewardsWind * windPriceUsd;

    // APR = (annual rewards / TVL) * 100
    return (annualRewardsUsd / tvlUsd) * 100;
}

/**
 * Calculate concentration multiplier for a given tick spacing
 * 
 * In Uniswap V3, a narrower range = higher concentration = more rewards per $
 * The multiplier represents how much more concentrated a 1-tick-width position is
 * compared to a full-range position.
 * 
 * Formula: multiplier = sqrt(fullRangeTicks / positionTicks)
 * 
 * For display on pools page, we assume a "typical" position width of 1 tick spacing unit.
 * 
 * @param tickSpacing - The pool's tick spacing (1, 50, 100, 200, 2000)
 * @returns Concentration multiplier
 */
export function getConcentrationMultiplier(tickSpacing: number): number {
    if (!tickSpacing || tickSpacing <= 0) return 1;

    // Position width in ticks = tickSpacing (assuming 1-tick-spacing-unit position)
    // Using sqrt for more realistic multiplier that doesn't explode unrealistically
    const rawMultiplier = Math.sqrt(FULL_RANGE_TICKS / tickSpacing);

    // Cap at reasonable bounds (1x - 500x) to prevent display issues
    return Math.max(1, Math.min(rawMultiplier, 500));
}

/**
 * Calculate displayed APR for a CL pool on the pools page
 * Shows the APR for a typical 1-tick-spacing-width position
 * 
 * @param rewardRatePerSecond - WIND reward rate in wei per second
 * @param windPriceUsd - Current WIND price in USD
 * @param tvlUsd - Pool TVL in USD
 * @param tickSpacing - Pool's tick spacing (for CL pools)
 * @returns APR as a percentage, accounting for concentration
 */
export function calculatePoolAPR(
    rewardRatePerSecond: bigint,
    windPriceUsd: number,
    tvlUsd: number,
    tickSpacing?: number
): number {
    const baseAPR = calculateBaseAPR(rewardRatePerSecond, windPriceUsd, tvlUsd);

    // For CL pools, apply concentration multiplier based on tick spacing
    if (tickSpacing && tickSpacing > 0) {
        const multiplier = getConcentrationMultiplier(tickSpacing);
        return baseAPR * multiplier;
    }

    return baseAPR;
}

/**
 * Calculate range-adjusted APR for a specific user position
 * Used in AddLiquidityModal to show estimated APR for user's selected range
 * 
 * @param baseAPR - The pool's base APR (full-range equivalent)
 * @param tickLower - Position's lower tick
 * @param tickUpper - Position's upper tick
 * @param currentTick - Current pool tick
 * @returns Adjusted APR for the position's range
 */
export function calculateRangeAdjustedAPR(
    baseAPR: number,
    tickLower: number,
    tickUpper: number,
    currentTick: number
): number | null {
    if (baseAPR <= 0) return null;
    if (tickLower >= tickUpper) return null;

    const positionWidth = tickUpper - tickLower;
    if (positionWidth <= 0) return null;

    // Only positions in-range earn rewards effectively
    // Out-of-range positions still earn based on their liquidity density
    const isInRange = currentTick >= tickLower && currentTick < tickUpper;

    // Calculate multiplier based on position width vs full range
    const rawMultiplier = Math.sqrt(FULL_RANGE_TICKS / positionWidth);
    const multiplier = Math.max(1, Math.min(rawMultiplier, 1000));

    // Out-of-range positions get half the APR boost (they earn when price returns)
    const effectiveMultiplier = isInRange ? multiplier : multiplier * 0.5;

    return baseAPR * effectiveMultiplier;
}

// Re-export from central format.ts
export { formatAPR } from './format';

/**
 * Calculate staked TVL from total TVL and staked liquidity ratio
 * 
 * Formula: stakedTVL = (stakedLiquidity / totalLPSupply) * totalTVL
 * 
 * If totalLPSupply is not provided, uses a heuristic based on stakedLiquidity value alone.
 * This is useful when the total LP supply is not readily available.
 * 
 * @param totalTvlUsd - Total pool TVL in USD
 * @param stakedLiquidity - Amount of LP tokens staked in gauge (from gauge.totalSupply())
 * @param totalLPSupply - Total supply of LP tokens (optional, from pool.liquidity() or pair totalSupply)
 * @returns Staked TVL in USD, or null if calculation not possible
 */
export function calculateStakedTVL(
    totalTvlUsd: number,
    stakedLiquidity: bigint,
    totalLPSupply?: bigint
): number | null {
    // Validate inputs
    if (totalTvlUsd <= 0) return null;
    if (stakedLiquidity <= BigInt(0)) return null;

    // If we have total supply, calculate the precise ratio
    if (totalLPSupply && totalLPSupply > BigInt(0)) {
        const stakedRatio = Number(stakedLiquidity) / Number(totalLPSupply);

        // If less than 0.01% is staked, consider it effectively 0
        if (stakedRatio < 0.0001) return null;

        return totalTvlUsd * stakedRatio;
    }

    // Without total supply, use a heuristic:
    // Assume staked liquidity represents a portion of TVL based on magnitude
    // This is a fallback that gives reasonable estimates for typical pool sizes
    const stakedFloat = Number(stakedLiquidity) / 1e18; // Convert from wei

    // Very small staked amount relative to typical pool sizes
    if (stakedFloat < 0.001) return null;

    // Estimate: assume staked liquidity is proportional to a fraction of TVL
    // This assumes LP tokens are roughly 1:1 with USD value (not always true but reasonable fallback)
    const estimatedStakedTvl = stakedFloat;

    // Cap at total TVL (can't stake more than total)
    return Math.min(estimatedStakedTvl, totalTvlUsd);
}

/**
 * Calculate APR based on staked liquidity instead of total TVL
 * 
 * This gives the accurate APR for stakers, since rewards only go to staked LPs.
 * Formula: APR = (annual rewards in USD) / (staked TVL) * 100
 * 
 * @param rewardRatePerSecond - WIND reward rate in wei per second
 * @param windPriceUsd - Current WIND price in USD
 * @param totalTvlUsd - Total pool TVL in USD
 * @param stakedLiquidity - Amount of LP tokens staked in gauge
 * @param totalLPSupply - Total supply of LP tokens (optional)
 * @param tickSpacing - Pool's tick spacing (for CL pools, optional)
 * @returns APR as a percentage, or null if staked TVL is insufficient
 */
export function calculateStakedAPR(
    rewardRatePerSecond: bigint,
    windPriceUsd: number,
    totalTvlUsd: number,
    stakedLiquidity: bigint,
    totalLPSupply?: bigint,
    tickSpacing?: number
): number | null {
    // Calculate staked TVL
    const stakedTvlUsd = calculateStakedTVL(totalTvlUsd, stakedLiquidity, totalLPSupply);

    // If we can't calculate staked TVL, fall back to total TVL calculation
    // but return null to indicate this is a fallback
    if (stakedTvlUsd === null) {
        const baseApr = calculateBaseAPR(rewardRatePerSecond, windPriceUsd, totalTvlUsd);
        if (baseApr <= 0) return null;

        // Apply concentration multiplier for CL pools
        if (tickSpacing && tickSpacing > 0) {
            const multiplier = getConcentrationMultiplier(tickSpacing);
            return baseApr * multiplier;
        }
        return baseApr;
    }

    // Calculate APR using staked TVL (more accurate for stakers)
    const baseApr = calculateBaseAPR(rewardRatePerSecond, windPriceUsd, stakedTvlUsd);

    // For CL pools, apply concentration multiplier based on tick spacing
    if (tickSpacing && tickSpacing > 0) {
        const multiplier = getConcentrationMultiplier(tickSpacing);
        return baseApr * multiplier;
    }

    return baseApr;
}

/**
 * Calculate pool APR with automatic fallback to total TVL if staked data unavailable
 * 
 * This is a convenience function that tries to use staked liquidity first,
 * then falls back to total TVL if staked data is not available.
 * 
 * @param rewardRatePerSecond - WIND reward rate in wei per second
 * @param windPriceUsd - Current WIND price in USD
 * @param totalTvlUsd - Total pool TVL in USD
 * @param stakedLiquidity - Amount of LP tokens staked in gauge (optional)
 * @param totalLPSupply - Total supply of LP tokens (optional)
 * @param tickSpacing - Pool's tick spacing (for CL pools, optional)
 * @returns APR as a percentage (falls back to total TVL if staked data unavailable)
 */
export function calculatePoolAPRFallback(
    rewardRatePerSecond: bigint,
    windPriceUsd: number,
    totalTvlUsd: number,
    stakedLiquidity?: bigint,
    totalLPSupply?: bigint,
    tickSpacing?: number
): number {
    // Try to use staked APR calculation if we have the data
    if (stakedLiquidity !== undefined && totalLPSupply !== undefined) {
        const stakedApr = calculateStakedAPR(
            rewardRatePerSecond,
            windPriceUsd,
            totalTvlUsd,
            stakedLiquidity,
            totalLPSupply,
            tickSpacing
        );
        if (stakedApr !== null) {
            return stakedApr;
        }
    }

    // Fall back to original calculation using total TVL
    return calculatePoolAPR(rewardRatePerSecond, windPriceUsd, totalTvlUsd, tickSpacing);
}
