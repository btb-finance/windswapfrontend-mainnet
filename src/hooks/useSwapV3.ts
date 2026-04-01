'use client';
import { ethCall } from '@/utils/rpc';

import { useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useWriteContract } from '@/hooks/useWriteContract';
import { parseUnits, formatUnits, Address, encodeFunctionData, decodeFunctionResult } from 'viem';
import { Token, WETH } from '@/config/tokens';
import { CL_CONTRACTS } from '@/config/contracts';
import { SWAP_ROUTER_ABI, ERC20_ABI, QUOTER_V2_ABI } from '@/config/abis';
import { swrCache, getQuoteCacheKey } from '@/utils/cache';
import { getDeadline } from '@/utils/format';
import { extractErrorMessage } from '@/utils/errors';

// CL tick spacings from CLFactory contract
const TICK_SPACINGS = [1, 2, 3, 4, 5] as const;

interface SwapQuoteV3 {
    amountOut: string;
    amountIn?: string; // For exact output
    gasEstimate: bigint;
    sqrtPriceX96After: bigint;
    tickSpacing: number;
    poolExists: boolean;
}

interface BestQuote extends SwapQuoteV3 {
    allQuotes: SwapQuoteV3[];
}

export function useSwapV3() {
    const { address } = useAccount();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<`0x${string}` | null>(null);

    const { writeContractAsync } = useWriteContract();

    // Check if a pool exists for given token pair and tick spacing
    const checkPoolExists = useCallback(async (
        tokenIn: string,
        tokenOut: string,
        tickSpacing: number
    ): Promise<boolean> => {
        try {
            // Sort tokens
            const [token0, token1] = tokenIn.toLowerCase() < tokenOut.toLowerCase()
                ? [tokenIn, tokenOut]
                : [tokenOut, tokenIn];

            // Call CLFactory.getPool
            const poolAddress = await ethCall(CL_CONTRACTS.CLFactory, encodeGetPoolCall(token0, token1, tickSpacing));

            // If pool address is not zero, pool exists
            return !!poolAddress && poolAddress !== '0x' + '0'.repeat(64);
        } catch {
            return false;
        }
    }, []);

    // Get quote for specific tick spacing (Exact Input) - with caching
    const getQuoteForTickSpacing = useCallback(async (
        tokenIn: Token,
        tokenOut: Token,
        amountIn: string,
        tickSpacing: number
    ): Promise<SwapQuoteV3 | null> => {
        if (!amountIn || parseFloat(amountIn) <= 0) return null;

        const actualTokenIn = tokenIn.isNative ? WETH : tokenIn;
        const actualTokenOut = tokenOut.isNative ? WETH : tokenOut;

        // Generate cache key
        const cacheKey = getQuoteCacheKey(
            'v3',
            actualTokenIn.address,
            actualTokenOut.address,
            amountIn,
            undefined,
            tickSpacing
        );

        // Use cached result or fetch fresh (3 second TTL)
        return await swrCache(
            cacheKey,
            async () => {
                try {
                    const amountInWei = parseUnits(amountIn, actualTokenIn.decimals);

                    const data = encodeFunctionData({
                        abi: QUOTER_V2_ABI,
                        functionName: 'quoteExactInputSingle',
                        args: [{
                            tokenIn: actualTokenIn.address as Address,
                            tokenOut: actualTokenOut.address as Address,
                            amountIn: amountInWei,
                            tickSpacing,
                            sqrtPriceLimitX96: BigInt(0),
                        }],
                    });

                    const callResult = await ethCall(CL_CONTRACTS.QuoterV2, data);

                    if (callResult && callResult !== '0x') {
                        const decoded = decodeFunctionResult({
                            abi: QUOTER_V2_ABI,
                            functionName: 'quoteExactInputSingle',
                            data: callResult as `0x${string}`,
                        }) as [bigint, bigint, number, bigint];

                        const amountOutWei = decoded[0];
                        const gasEstimate = decoded[3];

                        if (amountOutWei > BigInt(0)) {
                            return {
                                amountOut: formatUnits(amountOutWei, actualTokenOut.decimals),
                                gasEstimate: gasEstimate,
                                sqrtPriceX96After: decoded[1],
                                tickSpacing,
                                poolExists: true,
                            };
                        }
                    }
                    return null;
                } catch {
                    return null;
                }
            },
            3000 // 3 second cache TTL
        );
    }, []);

    // Get quote for specific tick spacing (Exact Output) - with caching
    const getQuoteExactOutputForTickSpacing = useCallback(async (
        tokenIn: Token,
        tokenOut: Token,
        amountOut: string,
        tickSpacing: number
    ): Promise<SwapQuoteV3 | null> => {
        if (!amountOut || parseFloat(amountOut) <= 0) return null;

        const actualTokenIn = tokenIn.isNative ? WETH : tokenIn;
        const actualTokenOut = tokenOut.isNative ? WETH : tokenOut;

        // Generate cache key
        const cacheKey = getQuoteCacheKey(
            'v3-out',
            actualTokenIn.address,
            actualTokenOut.address,
            amountOut,
            undefined,
            tickSpacing
        );

        // Use cached result or fetch fresh (3 second TTL)
        return await swrCache(
            cacheKey,
            async () => {
                try {
                    const amountOutWei = parseUnits(amountOut, actualTokenOut.decimals);

                    const data = encodeFunctionData({
                        abi: QUOTER_V2_ABI,
                        functionName: 'quoteExactOutputSingle',
                        args: [{
                            tokenIn: actualTokenIn.address as Address,
                            tokenOut: actualTokenOut.address as Address,
                            amount: amountOutWei,
                            tickSpacing,
                            sqrtPriceLimitX96: BigInt(0),
                        }],
                    });

                    const callResult = await ethCall(CL_CONTRACTS.QuoterV2, data);

                    if (callResult && callResult !== '0x') {
                        const decoded = decodeFunctionResult({
                            abi: QUOTER_V2_ABI,
                            functionName: 'quoteExactOutputSingle',
                            data: callResult as `0x${string}`,
                        }) as [bigint, bigint, number, bigint];

                        const amountInWei = decoded[0];
                        const gasEstimate = decoded[3];

                        if (amountInWei > BigInt(0)) {
                            return {
                                amountOut,
                                amountIn: formatUnits(amountInWei, actualTokenIn.decimals),
                                gasEstimate: gasEstimate,
                                sqrtPriceX96After: decoded[1],
                                tickSpacing,
                                poolExists: true,
                            };
                        }
                    }
                    return null;
                } catch {
                    return null;
                }
            },
            3000 // 3 second cache TTL
        );
    }, []);

    // Get best quote across all tick spacings (AUTO mode)
    const getQuoteV3 = useCallback(async (
        tokenIn: Token,
        tokenOut: Token,
        amountIn: string,
        tickSpacing?: number // Optional - if not provided, finds best
    ): Promise<BestQuote | null> => {
        if (!amountIn || parseFloat(amountIn) <= 0) return null;

        try {
            // If specific tick spacing provided, only check that one
            if (tickSpacing !== undefined) {
                const quote = await getQuoteForTickSpacing(tokenIn, tokenOut, amountIn, tickSpacing);
                if (quote && quote.poolExists && parseFloat(quote.amountOut) > 0) {
                    return { ...quote, allQuotes: [quote] };
                }
                return null;
            }

            // Try all tick spacings in parallel
            const quotePromises = TICK_SPACINGS.map(ts =>
                getQuoteForTickSpacing(tokenIn, tokenOut, amountIn, ts)
            );

            const allQuotes = (await Promise.all(quotePromises)).filter(
                (q): q is SwapQuoteV3 => q !== null && q.poolExists && parseFloat(q.amountOut) > 0
            );

            if (allQuotes.length === 0) {
                return null;
            }

            // Find the best quote (highest amountOut)
            const bestQuote = allQuotes.reduce((best, current) =>
                parseFloat(current.amountOut) > parseFloat(best.amountOut) ? current : best
            );

            return { ...bestQuote, allQuotes };
        } catch (err) {
            console.error('V3 quote error:', err);
            return null;
        }
    }, [getQuoteForTickSpacing]);

    // Get best quote across all tick spacings (Exact Output)
    const getQuoteExactOutputV3 = useCallback(async (
        tokenIn: Token,
        tokenOut: Token,
        amountOut: string,
        tickSpacing?: number
    ): Promise<BestQuote | null> => {
        if (!amountOut || parseFloat(amountOut) <= 0) return null;

        try {
            if (tickSpacing !== undefined) {
                const quote = await getQuoteExactOutputForTickSpacing(tokenIn, tokenOut, amountOut, tickSpacing);
                if (quote && quote.poolExists && quote.amountIn) {
                    return { ...quote, allQuotes: [quote] };
                }
                return null;
            }

            const quotePromises = TICK_SPACINGS.map(ts =>
                getQuoteExactOutputForTickSpacing(tokenIn, tokenOut, amountOut, ts)
            );

            const allQuotes = (await Promise.all(quotePromises)).filter(
                (q): q is SwapQuoteV3 => q !== null && q.poolExists && !!q.amountIn
            );

            if (allQuotes.length === 0) {
                return null;
            }

            // Find best quote (lowest amountIn)
            const bestQuote = allQuotes.reduce((best, current) =>
                parseFloat(current.amountIn!) < parseFloat(best.amountIn!) ? current : best
            );

            return { ...bestQuote, allQuotes };
        } catch (err) {
            console.error('V3 exact output quote error:', err);
            return null;
        }
    }, [getQuoteExactOutputForTickSpacing]);

    // Execute V3 swap
    const executeSwapV3 = useCallback(async (
        tokenIn: Token,
        tokenOut: Token,
        amountIn: string,
        amountOutMin: string,
        tickSpacing: number, // Required - from quote
        tradeType: 'exactIn' | 'exactOut' = 'exactIn'
    ) => {
        if (!address) {
            setError('Wallet not connected');
            return null;
        }

        setIsLoading(true);
        setError(null);

        try {
            const actualTokenIn = tokenIn.isNative ? WETH : tokenIn;
            const actualTokenOut = tokenOut.isNative ? WETH : tokenOut;

            // For exactIn: amountIn is exact, amountOutMin is minimum output
            // For exactOut: amountOutMin param is exact output, amountIn param is maximum input

            const amountInWei = parseUnits(amountIn, actualTokenIn.decimals);
            const amountOutWei = parseUnits(amountOutMin, actualTokenOut.decimals);

            const deadline = getDeadline();

            // NOTE: Approval is handled by SwapInterface before calling this function

            let hash: `0x${string}`;

            if (tokenOut.isNative) {
                // Swapping to native SEI - need to unwrap WETH
                // Use multicall: swap to router, then unwrap and send to user
                let swapData;

                if (tradeType === 'exactOut') {
                    swapData = encodeFunctionData({
                        abi: SWAP_ROUTER_ABI,
                        functionName: 'exactOutputSingle',
                        args: [{
                            tokenIn: actualTokenIn.address as Address,
                            tokenOut: actualTokenOut.address as Address,
                            tickSpacing,
                            recipient: CL_CONTRACTS.SwapRouter as Address, // Send WETH to router first
                            deadline,
                            amountOut: amountOutWei,
                            amountInMaximum: amountInWei,
                            sqrtPriceLimitX96: BigInt(0),
                        }],
                    });
                } else {
                    swapData = encodeFunctionData({
                        abi: SWAP_ROUTER_ABI,
                        functionName: 'exactInputSingle',
                        args: [{
                            tokenIn: actualTokenIn.address as Address,
                            tokenOut: actualTokenOut.address as Address,
                            tickSpacing,
                            recipient: CL_CONTRACTS.SwapRouter as Address, // Send WETH to router first
                            deadline,
                            amountIn: amountInWei,
                            amountOutMinimum: amountOutWei,
                            sqrtPriceLimitX96: BigInt(0),
                        }],
                    });
                }

                const unwrapData = encodeFunctionData({
                    abi: SWAP_ROUTER_ABI,
                    functionName: 'unwrapWETH9',
                    args: [amountOutWei, address],
                });

                hash = await writeContractAsync({
                    address: CL_CONTRACTS.SwapRouter as Address,
                    abi: SWAP_ROUTER_ABI,
                    functionName: 'multicall',
                    args: [[swapData, unwrapData]],
                    value: tokenIn.isNative ? amountInWei : undefined,
                });
            } else {
                // Normal swap - recipient is the user
                if (tradeType === 'exactOut') {
                    hash = await writeContractAsync({
                        address: CL_CONTRACTS.SwapRouter as Address,
                        abi: SWAP_ROUTER_ABI,
                        functionName: 'exactOutputSingle',
                        args: [{
                            tokenIn: actualTokenIn.address as Address,
                            tokenOut: actualTokenOut.address as Address,
                            tickSpacing,
                            recipient: address,
                            deadline,
                            amountOut: amountOutWei,
                            amountInMaximum: amountInWei,
                            sqrtPriceLimitX96: BigInt(0),
                        }],
                        value: tokenIn.isNative ? amountInWei : undefined,
                    });
                } else {
                    hash = await writeContractAsync({
                        address: CL_CONTRACTS.SwapRouter as Address,
                        abi: SWAP_ROUTER_ABI,
                        functionName: 'exactInputSingle',
                        args: [{
                            tokenIn: actualTokenIn.address as Address,
                            tokenOut: actualTokenOut.address as Address,
                            tickSpacing,
                            recipient: address,
                            deadline,
                            amountIn: amountInWei,
                            amountOutMinimum: amountOutWei,
                            sqrtPriceLimitX96: BigInt(0),
                        }],
                        value: tokenIn.isNative ? amountInWei : undefined,
                    });
                }
            }

            setTxHash(hash);
            setIsLoading(false);
            return { hash };
        } catch (err: unknown) {
            console.error('V3 swap error:', err);
            setError(extractErrorMessage(err, 'Swap failed'));
            setIsLoading(false);
            return null;
        }
    }, [address, writeContractAsync]);

    // Execute multi-hop V3 swap via intermediate token
    const executeMultiHopSwapV3 = useCallback(async (
        tokenIn: Token,
        intermediate: Token,
        tokenOut: Token,
        amountIn: string,
        amountOutMin: string,
        tickSpacing1Override?: number,
        tickSpacing2Override?: number
    ) => {
        if (!address) {
            setError('Wallet not connected');
            return null;
        }

        setIsLoading(true);
        setError(null);

        try {
            const actualTokenIn = tokenIn.isNative ? WETH : tokenIn;
            const actualIntermediate = intermediate.isNative ? WETH : intermediate;
            const actualTokenOut = tokenOut.isNative ? WETH : tokenOut;

            const amountInWei = parseUnits(amountIn, actualTokenIn.decimals);

            // amountOutMin is already slippage-adjusted from SwapInterface, but for multi-hop
            // we add a small additional buffer (0.5%) since prices can move between the two swaps
            const minOut = parseUnits(amountOutMin, actualTokenOut.decimals);
            // Apply a small additional buffer for multi-hop (0.5% more tolerance)
            const multiHopBuffer = (minOut * BigInt(50)) / BigInt(10000); // 0.5%
            const amountOutMinimum = minOut - multiHopBuffer;

            const deadline = getDeadline();

            // Find tick spacings for both legs
            let tickSpacing1 = tickSpacing1Override || 0;
            let tickSpacing2 = tickSpacing2Override || 0;

            // If caller didn't provide tick spacings (or provided 0), fall back to discovery.
            if (!tickSpacing1) {
                // Check first leg pools
                for (const ts of TICK_SPACINGS) {
                    if (await checkPoolExists(actualTokenIn.address, actualIntermediate.address, ts)) {
                        tickSpacing1 = ts;
                        break;
                    }
                }
            }

            if (!tickSpacing2) {
                // Check second leg pools
                for (const ts of TICK_SPACINGS) {
                    if (await checkPoolExists(actualIntermediate.address, actualTokenOut.address, ts)) {
                        tickSpacing2 = ts;
                        break;
                    }
                }
            }

            if (!tickSpacing1 || !tickSpacing2) {
                setError('No multi-hop route available');
                setIsLoading(false);
                return null;
            }

            // Encode path: tokenIn(20) + tickSpacing1(3) + intermediate(20) + tickSpacing2(3) + tokenOut(20)
            const encodeTickSpacing = (ts: number): string => {
                // Convert to signed int24 hex (3 bytes)
                const hex = ts >= 0
                    ? ts.toString(16).padStart(6, '0')
                    : ((1 << 24) + ts).toString(16);
                return hex;
            };

            const path = '0x' +
                actualTokenIn.address.slice(2).toLowerCase() +
                encodeTickSpacing(tickSpacing1) +
                actualIntermediate.address.slice(2).toLowerCase() +
                encodeTickSpacing(tickSpacing2) +
                actualTokenOut.address.slice(2).toLowerCase();

            // NOTE: Approval is handled by SwapInterface before calling this function

            let hash: `0x${string}`;

            if (tokenOut.isNative) {
                // Swapping to native SEI - need to unwrap WETH
                // Use multicall: swap to router, then unwrap and send to user
                const swapData = encodeFunctionData({
                    abi: SWAP_ROUTER_ABI,
                    functionName: 'exactInput',
                    args: [{
                        path: path as `0x${string}`,
                        recipient: CL_CONTRACTS.SwapRouter as Address, // Send WETH to router first
                        deadline,
                        amountIn: amountInWei,
                        amountOutMinimum,
                    }],
                });

                const unwrapData = encodeFunctionData({
                    abi: SWAP_ROUTER_ABI,
                    functionName: 'unwrapWETH9',
                    args: [amountOutMinimum, address],
                });

                hash = await writeContractAsync({
                    address: CL_CONTRACTS.SwapRouter as Address,
                    abi: SWAP_ROUTER_ABI,
                    functionName: 'multicall',
                    args: [[swapData, unwrapData]],
                    value: tokenIn.isNative ? amountInWei : undefined,
                });
            } else {
                // Normal swap - recipient is the user
                hash = await writeContractAsync({
                    address: CL_CONTRACTS.SwapRouter as Address,
                    abi: SWAP_ROUTER_ABI,
                    functionName: 'exactInput',
                    args: [{
                        path: path as `0x${string}`,
                        recipient: address,
                        deadline,
                        amountIn: amountInWei,
                        amountOutMinimum,
                    }],
                    value: tokenIn.isNative ? amountInWei : undefined,
                });
            }

            setTxHash(hash);
            setIsLoading(false);
            return { hash };
        } catch (err: unknown) {
            console.error('Multi-hop V3 swap error:', err);
            setError(extractErrorMessage(err, 'Multi-hop swap failed'));
            setIsLoading(false);
            return null;
        }
    }, [address, writeContractAsync, checkPoolExists]);

    // Execute split swap: two legs via multicall in one tx
    const executeSplitSwapV3 = useCallback(async (
        tokenIn: Token,
        tokenOut: Token,
        legs: {
            amountIn: string;
            amountOutMin: string;
            routeType: 'direct' | 'multi-hop';
            tickSpacing1: number;
            tickSpacing2?: number;
            intermediate?: Token;
        }[],
    ) => {
        if (!address || legs.length === 0) return null;

        setIsLoading(true);
        setError(null);

        try {
            const actualTokenIn = tokenIn.isNative ? WETH : tokenIn;
            const actualTokenOut = tokenOut.isNative ? WETH : tokenOut;
            const deadline = getDeadline();

            const swapCalls: `0x${string}`[] = [];
            let totalValueWei = BigInt(0);
            let totalMinOut = BigInt(0);

            for (const leg of legs) {
                const amountInWei = parseUnits(leg.amountIn, actualTokenIn.decimals);
                const amountOutMinWei = parseUnits(leg.amountOutMin, actualTokenOut.decimals);
                totalMinOut += amountOutMinWei;

                if (tokenIn.isNative) totalValueWei += amountInWei;

                if (leg.routeType === 'direct') {
                    swapCalls.push(encodeFunctionData({
                        abi: SWAP_ROUTER_ABI,
                        functionName: 'exactInputSingle',
                        args: [{
                            tokenIn: actualTokenIn.address as Address,
                            tokenOut: actualTokenOut.address as Address,
                            tickSpacing: leg.tickSpacing1,
                            recipient: tokenOut.isNative ? CL_CONTRACTS.SwapRouter as Address : address,
                            deadline,
                            amountIn: amountInWei,
                            amountOutMinimum: amountOutMinWei,
                            sqrtPriceLimitX96: BigInt(0),
                        }],
                    }));
                } else if (leg.routeType === 'multi-hop' && leg.intermediate) {
                    const actualIntermediate = leg.intermediate.isNative ? WETH : leg.intermediate;
                    const encodeTS = (ts: number) => {
                        return ts >= 0 ? ts.toString(16).padStart(6, '0') : ((1 << 24) + ts).toString(16);
                    };
                    const path = ('0x' +
                        actualTokenIn.address.slice(2).toLowerCase() +
                        encodeTS(leg.tickSpacing1) +
                        actualIntermediate.address.slice(2).toLowerCase() +
                        encodeTS(leg.tickSpacing2 || leg.tickSpacing1) +
                        actualTokenOut.address.slice(2).toLowerCase()) as `0x${string}`;

                    swapCalls.push(encodeFunctionData({
                        abi: SWAP_ROUTER_ABI,
                        functionName: 'exactInput',
                        args: [{
                            path,
                            recipient: tokenOut.isNative ? CL_CONTRACTS.SwapRouter as Address : address,
                            deadline,
                            amountIn: amountInWei,
                            amountOutMinimum: amountOutMinWei,
                        }],
                    }));
                }
            }

            // If output is native, add unwrap call
            if (tokenOut.isNative) {
                swapCalls.push(encodeFunctionData({
                    abi: SWAP_ROUTER_ABI,
                    functionName: 'unwrapWETH9',
                    args: [totalMinOut, address],
                }));
            }

            const hash = await writeContractAsync({
                address: CL_CONTRACTS.SwapRouter as Address,
                abi: SWAP_ROUTER_ABI,
                functionName: 'multicall',
                args: [swapCalls],
                value: tokenIn.isNative ? totalValueWei : undefined,
            });

            setTxHash(hash);
            setIsLoading(false);
            return { hash };
        } catch (err: unknown) {
            console.error('Split swap error:', err);
            setError(extractErrorMessage(err, 'Split swap failed'));
            setIsLoading(false);
            return null;
        }
    }, [address, writeContractAsync]);

    return {
        getQuoteV3,
        getQuoteExactOutputV3,
        executeSwapV3,
        executeMultiHopSwapV3,
        executeSplitSwapV3,
        checkPoolExists,
        isLoading,
        error,
        txHash,
        TICK_SPACINGS,
    };
}

// Helper: Encode CLFactory.getPool(token0, token1, tickSpacing) call
function encodeGetPoolCall(token0: string, token1: string, tickSpacing: number): string {
    // Function selector for getPool(address,address,int24) - verified via cast sig
    const selector = '28af8d0b';

    const token0Padded = token0.slice(2).toLowerCase().padStart(64, '0');
    const token1Padded = token1.slice(2).toLowerCase().padStart(64, '0');

    // Handle signed int24
    let tickHex: string;
    if (tickSpacing >= 0) {
        tickHex = tickSpacing.toString(16).padStart(64, '0');
    } else {
        const uint256Value = BigInt(2) ** BigInt(256) + BigInt(tickSpacing);
        tickHex = uint256Value.toString(16);
    }

    return `0x${selector}${token0Padded}${token1Padded}${tickHex}`;
}

