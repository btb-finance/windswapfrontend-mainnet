/**
 * Uniswap V3 Concentrated Liquidity Math
 * 
 * Simplified implementation using floating-point math for UI calculations.
 * 
 * IMPORTANT: Prices in this module are in "UI order" (tokenB per tokenA as shown in UI).
 * The formulas internally convert to pool order (token1/token0) when needed.
 */

// Tick bounds from TickMath.sol
export const MIN_TICK = -887272;
export const MAX_TICK = 887272;

/**
 * Convert a human-readable price to a tick, aligned to tick spacing
 * 
 * @param price - Human readable price (tokenB per tokenA in UI terms)
 * @param token0Decimals - Decimals of token0 (lower address)
 * @param token1Decimals - Decimals of token1 (higher address)
 * @param tickSpacing - The tick spacing of the pool
 * @param isToken0Base - Whether token0 is the base token in the UI price
 * @returns Tick aligned to tick spacing
 */
export function priceToTick(
    price: number,
    token0Decimals: number,
    token1Decimals: number,
    tickSpacing: number,
    isToken0Base: boolean = true
): number {
    if (price <= 0) return 0;

    // If token0 is base, price is token1/token0 which is what the pool uses
    // If token1 is base, price is token0/token1, so we need to invert
    const poolPrice = isToken0Base ? price : 1 / price;

    // Adjust for decimal difference to get the raw price used in tick calculation
    // Pool price = (amount1 in wei) / (amount0 in wei)
    // raw_price = UI_price * 10^(token1Decimals) / 10^(token0Decimals)
    const adjustedPrice = poolPrice * Math.pow(10, token1Decimals - token0Decimals);

    // Calculate tick: tick = log(price) / log(1.0001)
    const rawTick = Math.log(adjustedPrice) / Math.log(1.0001);

    // Round to nearest tick spacing
    return Math.round(rawTick / tickSpacing) * tickSpacing;
}

/**
 * Convert a tick to a human-readable price
 * 
 * @param tick - The tick value
 * @param token0Decimals - Decimals of token0 (lower address)
 * @param token1Decimals - Decimals of token1 (higher address)
 * @param isToken0Base - Whether token0 is the base token in the UI price
 * @returns Human readable price
 */
export function tickToPrice(
    tick: number,
    token0Decimals: number,
    token1Decimals: number,
    isToken0Base: boolean = true
): number {
    // raw_price = 1.0001^tick
    const rawPrice = Math.pow(1.0001, tick);

    // Convert back to UI price by adjusting for decimals
    const adjustedPrice = rawPrice * Math.pow(10, token0Decimals - token1Decimals);

    // Invert if token1 is base
    return isToken0Base ? adjustedPrice : 1 / adjustedPrice;
}

// ============================================================================
// LIQUIDITY AMOUNT CALCULATIONS FOR UI
// ============================================================================

export interface RangePosition {
    currentPrice: number;   // Price in UI terms (tokenB per tokenA as displayed)
    priceLower: number;     // Lower price bound in UI terms
    priceUpper: number;     // Upper price bound in UI terms
    token0Decimals: number;
    token1Decimals: number;
    tickSpacing: number;
    isToken0Base: boolean;  // Whether tokenA (UI first token) is token0 (lower address)
}

/**
 * Determine which tokens are required for a position given the price range
 * Works with UI prices (tokenB per tokenA)
 */
export function getRequiredTokens(
    currentPrice: number,
    priceLower: number,
    priceUpper: number
): { needsToken0: boolean; needsToken1: boolean; isSingleSided: boolean } {
    // Ensure lower < upper
    const [lower, upper] = priceLower < priceUpper
        ? [priceLower, priceUpper]
        : [priceUpper, priceLower];

    if (currentPrice <= lower) {
        // Price below range - only token0 needed (waiting for price to rise)
        return { needsToken0: true, needsToken1: false, isSingleSided: true };
    } else if (currentPrice >= upper) {
        // Price above range - only token1 needed (waiting for price to fall)
        return { needsToken0: false, needsToken1: true, isSingleSided: true };
    } else {
        // Price within range - both tokens needed
        return { needsToken0: true, needsToken1: true, isSingleSided: false };
    }
}

/**
 * Calculate the amount of the OTHER token needed given one token amount
 * Uses Uniswap V3 concentrated liquidity formulas
 * 
 * The formulas (in pool terms where P = token1/token0):
 * - Given amount0: L = amount0 * sqrt(P) * sqrt(Pb) / (sqrt(Pb) - sqrt(P))
 *                  amount1 = L * (sqrt(P) - sqrt(Pa))
 * 
 * - Given amount1: L = amount1 / (sqrt(P) - sqrt(Pa))
 *                  amount0 = L * (sqrt(Pb) - sqrt(P)) / (sqrt(P) * sqrt(Pb))
 * 
 * @param inputAmount - The amount user entered (human readable)
 * @param inputIsToken0 - Whether the input is token0 (in pool terms)
 * @param position - Position details including prices
 * @returns The required amount of the other token (human readable)
 */
export function calculateOtherAmount(
    inputAmount: number,
    inputIsToken0: boolean,
    position: RangePosition
): number {
    if (inputAmount <= 0) return 0;

    const { currentPrice, priceLower, priceUpper, isToken0Base } = position;

    // Convert UI prices to pool prices (token1/token0)
    // If isToken0Base: UI price is already token1/token0 ✓
    // If !isToken0Base: UI price is token0/token1, need to invert
    let poolPriceCurrent: number;
    let poolPriceLower: number;
    let poolPriceUpper: number;

    if (isToken0Base) {
        // UI shows tokenA=token0, tokenB=token1
        // UI price = tokenB/tokenA = token1/token0 = pool price ✓
        poolPriceCurrent = currentPrice;
        poolPriceLower = priceLower;
        poolPriceUpper = priceUpper;
    } else {
        // UI shows tokenA=token1, tokenB=token0
        // UI price = tokenB/tokenA = token0/token1 = 1/pool_price
        // Need to invert to get pool price
        poolPriceCurrent = 1 / currentPrice;
        poolPriceLower = 1 / priceUpper;  // Note: inverts the bounds too!
        poolPriceUpper = 1 / priceLower;
    }

    // Ensure lower < upper in pool terms
    const [lower, upper] = poolPriceLower < poolPriceUpper
        ? [poolPriceLower, poolPriceUpper]
        : [poolPriceUpper, poolPriceLower];

    // Check single-sided cases
    if (poolPriceCurrent <= lower) {
        // Only token0 needed
        return inputIsToken0 ? 0 : 0; // If providing token1 when only token0 needed, return 0
    }
    if (poolPriceCurrent >= upper) {
        // Only token1 needed
        return inputIsToken0 ? 0 : 0; // If providing token0 when only token1 needed, return 0
    }

    // Both tokens needed - current price is within range
    const sqrtP = Math.sqrt(poolPriceCurrent);
    const sqrtPa = Math.sqrt(lower);
    const sqrtPb = Math.sqrt(upper);

    if (inputIsToken0) {
        // User provides token0, calculate required token1
        // L = amount0 * sqrt(P) * sqrt(Pb) / (sqrt(Pb) - sqrt(P))
        const liquidity = inputAmount * (sqrtP * sqrtPb) / (sqrtPb - sqrtP);
        // amount1 = L * (sqrt(P) - sqrt(Pa))
        const amount1 = liquidity * (sqrtP - sqrtPa);
        return amount1;
    } else {
        // User provides token1, calculate required token0
        // L = amount1 / (sqrt(P) - sqrt(Pa))
        const liquidity = inputAmount / (sqrtP - sqrtPa);
        // amount0 = L * (sqrt(Pb) - sqrt(P)) / (sqrt(P) * sqrt(Pb))
        const amount0 = liquidity * (sqrtPb - sqrtP) / (sqrtP * sqrtPb);
        return amount0;
    }
}

export interface PositionAmounts {
    amount0: number;
    amount1: number;
}

/**
 * Calculate the optimal amounts for a position given one input amount
 * This is the main function to use from the UI
 * 
 * @param inputAmount - The amount user entered (human readable)
 * @param inputIsToken0 - Whether the input is token0 or token1 IN POOL TERMS
 * @param position - Position details
 * @returns Calculated amounts for both tokens (human readable)
 */
export function calculateOptimalAmounts(
    inputAmount: number,
    inputIsToken0: boolean,
    position: RangePosition
): PositionAmounts {
    const { currentPrice, priceLower, priceUpper, isToken0Base } = position;

    // Convert prices to pool order for range checking
    let poolPriceCurrent: number;
    let poolPriceLower: number;
    let poolPriceUpper: number;

    if (isToken0Base) {
        poolPriceCurrent = currentPrice;
        poolPriceLower = priceLower;
        poolPriceUpper = priceUpper;
    } else {
        poolPriceCurrent = 1 / currentPrice;
        poolPriceLower = 1 / priceUpper;
        poolPriceUpper = 1 / priceLower;
    }

    // Ensure lower < upper
    const [lower, upper] = poolPriceLower < poolPriceUpper
        ? [poolPriceLower, poolPriceUpper]
        : [poolPriceUpper, poolPriceLower];

    // Check single-sided cases in pool terms
    const priceBelow = poolPriceCurrent <= lower;
    const priceAbove = poolPriceCurrent >= upper;

    if (inputIsToken0) {
        if (priceAbove) {
            // Only token1 needed, but user is providing token0
            return { amount0: 0, amount1: 0 };
        }

        if (priceBelow) {
            // Only token0 needed
            return { amount0: inputAmount, amount1: 0 };
        }

        // Both tokens needed
        const amount1 = calculateOtherAmount(inputAmount, true, position);
        return { amount0: inputAmount, amount1 };
    } else {
        if (priceBelow) {
            // Only token0 needed, but user is providing token1
            return { amount0: 0, amount1: 0 };
        }

        if (priceAbove) {
            // Only token1 needed
            return { amount0: 0, amount1: inputAmount };
        }

        // Both tokens needed
        const amount0 = calculateOtherAmount(inputAmount, false, position);
        return { amount0, amount1: inputAmount };
    }
}

/**
 * Format a number to a specified number of decimal places
 * Removes trailing zeros
 */
export function formatAmount(value: number, displayDecimals: number = 6): string {
    if (!isFinite(value) || isNaN(value)) return '0';

    const fixed = value.toFixed(displayDecimals);
    const trimmed = fixed.replace(/\.?0+$/, '');

    return trimmed || '0';
}

// ============================================================================
// LEGACY EXPORTS FOR COMPATIBILITY
// ============================================================================

export function parseToWei(amount: string | number, decimals: number): bigint {
    const amountStr = typeof amount === 'number' ? amount.toString() : amount;

    if (!amountStr || amountStr === '') return BigInt(0);

    const numValue = parseFloat(amountStr);
    if (!isFinite(numValue) || isNaN(numValue)) return BigInt(0);

    const fixedStr = numValue.toFixed(decimals);
    const [integerPart = '0', fractionalPart = ''] = fixedStr.split('.');
    const paddedFractional = (fractionalPart + '0'.repeat(decimals)).slice(0, decimals);
    const cleanInteger = integerPart === '-0' ? '0' : integerPart;

    try {
        return BigInt(cleanInteger + paddedFractional);
    } catch {
        return BigInt(0);
    }
}

export function formatFromWei(wei: bigint, decimals: number, displayDecimals: number = 6): string {
    if (wei === BigInt(0)) return '0';

    const divisor = BigInt(10) ** BigInt(decimals);
    const integerPart = wei / divisor;
    const fractionalPart = wei % divisor;

    const isNegative = wei < BigInt(0);
    const absIntegerPart = isNegative ? -integerPart : integerPart;
    const absFractionalPart = isNegative ? -fractionalPart : fractionalPart;

    let fractionalStr = absFractionalPart.toString().padStart(decimals, '0');
    fractionalStr = fractionalStr.slice(0, displayDecimals);
    fractionalStr = fractionalStr.replace(/0+$/, '');

    const sign = isNegative ? '-' : '';

    if (fractionalStr.length === 0) {
        return sign + absIntegerPart.toString();
    }

    return `${sign}${absIntegerPart}.${fractionalStr}`;
}

// ============================================================================
// ADVANCED TICK MATH (Q96 Fixed Point) - For reference
// ============================================================================

const Q96 = BigInt(2) ** BigInt(96);

export const MIN_SQRT_RATIO = BigInt('4295128739');
export const MAX_SQRT_RATIO = BigInt('1461446703485210103287273052203988822378723970342');

export function getSqrtRatioAtTick(tick: number): bigint {
    const absTick = Math.abs(tick);
    if (absTick > MAX_TICK) {
        throw new Error(`Tick ${tick} out of bounds`);
    }

    let ratio = (absTick & 0x1) !== 0
        ? BigInt('0xfffcb933bd6fad37aa2d162d1a594001')
        : BigInt('0x100000000000000000000000000000000');

    if ((absTick & 0x2) !== 0) ratio = (ratio * BigInt('0xfff97272373d413259a46990580e213a')) >> BigInt(128);
    if ((absTick & 0x4) !== 0) ratio = (ratio * BigInt('0xfff2e50f5f656932ef12357cf3c7fdcc')) >> BigInt(128);
    if ((absTick & 0x8) !== 0) ratio = (ratio * BigInt('0xffe5caca7e10e4e61c3624eaa0941cd0')) >> BigInt(128);
    if ((absTick & 0x10) !== 0) ratio = (ratio * BigInt('0xffcb9843d60f6159c9db58835c926644')) >> BigInt(128);
    if ((absTick & 0x20) !== 0) ratio = (ratio * BigInt('0xff973b41fa98c081472e6896dfb254c0')) >> BigInt(128);
    if ((absTick & 0x40) !== 0) ratio = (ratio * BigInt('0xff2ea16466c96a3843ec78b326b52861')) >> BigInt(128);
    if ((absTick & 0x80) !== 0) ratio = (ratio * BigInt('0xfe5dee046a99a2a811c461f1969c3053')) >> BigInt(128);
    if ((absTick & 0x100) !== 0) ratio = (ratio * BigInt('0xfcbe86c7900a88aedcffc83b479aa3a4')) >> BigInt(128);
    if ((absTick & 0x200) !== 0) ratio = (ratio * BigInt('0xf987a7253ac413176f2b074cf7815e54')) >> BigInt(128);
    if ((absTick & 0x400) !== 0) ratio = (ratio * BigInt('0xf3392b0822b70005940c7a398e4b70f3')) >> BigInt(128);
    if ((absTick & 0x800) !== 0) ratio = (ratio * BigInt('0xe7159475a2c29b7443b29c7fa6e889d9')) >> BigInt(128);
    if ((absTick & 0x1000) !== 0) ratio = (ratio * BigInt('0xd097f3bdfd2022b8845ad8f792aa5825')) >> BigInt(128);
    if ((absTick & 0x2000) !== 0) ratio = (ratio * BigInt('0xa9f746462d870fdf8a65dc1f90e061e5')) >> BigInt(128);
    if ((absTick & 0x4000) !== 0) ratio = (ratio * BigInt('0x70d869a156d2a1b890bb3df62baf32f7')) >> BigInt(128);
    if ((absTick & 0x8000) !== 0) ratio = (ratio * BigInt('0x31be135f97d08fd981231505542fcfa6')) >> BigInt(128);
    if ((absTick & 0x10000) !== 0) ratio = (ratio * BigInt('0x9aa508b5b7a84e1c677de54f3e99bc9')) >> BigInt(128);
    if ((absTick & 0x20000) !== 0) ratio = (ratio * BigInt('0x5d6af8dedb81196699c329225ee604')) >> BigInt(128);
    if ((absTick & 0x40000) !== 0) ratio = (ratio * BigInt('0x2216e584f5fa1ea926041bedfe98')) >> BigInt(128);
    if ((absTick & 0x80000) !== 0) ratio = (ratio * BigInt('0x48a170391f7dc42444e8fa2')) >> BigInt(128);

    if (tick > 0) {
        const maxUint256 = (BigInt(1) << BigInt(256)) - BigInt(1);
        ratio = maxUint256 / ratio;
    }

    const remainder = ratio % (BigInt(1) << BigInt(32));
    const sqrtPriceX96 = (ratio >> BigInt(32)) + (remainder === BigInt(0) ? BigInt(0) : BigInt(1));

    return sqrtPriceX96;
}
