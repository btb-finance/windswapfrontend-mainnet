/**
 * Shared contract interaction utilities.
 * Eliminates duplicated patterns across hooks.
 */

import { type Address } from 'viem';
import { type Token, WETH } from '@/config/tokens';

// CL tick spacings — single source of truth (was duplicated in useSwapV3 + useMixedRouteQuoter)
export const TICK_SPACINGS = [1, 2, 3, 4, 5] as const;

/**
 * Resolve native ETH to WETH for contract calls.
 * Used 20+ times across swap hooks.
 */
export function resolveToken(token: Token): Token {
    return token.isNative ? WETH : token;
}

/**
 * Resolve token address, returning zero address for native ETH.
 * Used in bulk swap/sell hooks.
 */
export function resolveTokenAddress(token: Token): Address {
    return token.isNative
        ? '0x0000000000000000000000000000000000000000'
        : (token.address as Address);
}

/**
 * Encode tick spacing as a 3-byte hex string for V3 path encoding.
 * Was duplicated in useSwapV3 and useMixedRouteQuoter.
 */
export function encodeTickSpacing(ts: number): string {
    return ts >= 0
        ? ts.toString(16).padStart(6, '0')
        : ((1 << 24) + ts).toString(16);
}

/**
 * Encode a V3 path: token(20 bytes) + tickSpacing(3 bytes) + token(20 bytes) [+ ...]
 * Was duplicated in useSwapV3 and useMixedRouteQuoter.
 */
export function encodeV3Path(tokens: string[], tickSpacings: number[]): `0x${string}` {
    let path = tokens[0].slice(2).toLowerCase();
    for (let i = 0; i < tickSpacings.length; i++) {
        path += encodeTickSpacing(tickSpacings[i]) + tokens[i + 1].slice(2).toLowerCase();
    }
    return `0x${path}` as `0x${string}`;
}
