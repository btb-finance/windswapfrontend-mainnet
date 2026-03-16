'use client';

import { useCallback, useState } from 'react';
import { useAccount, useReadContract, useWaitForTransactionReceipt } from 'wagmi';
import { useWriteContract } from '@/hooks/useWriteContract';
import { parseUnits, formatUnits, Address, maxUint256, encodeFunctionData, decodeFunctionResult } from 'viem';
import { V2_CONTRACTS, CL_CONTRACTS, COMMON } from '@/config/contracts';
import { ROUTER_ABI, ERC20_ABI } from '@/config/abis';
import { Token, WSEI } from '@/config/tokens';
import { getRpcForQuotes } from '@/utils/rpc';
import { swrCache, dedupeRequest, getQuoteCacheKey } from '@/utils/cache';

interface Route {
    from: Address;
    to: Address;
    stable: boolean;
    factory: Address;
}

export function useSwap() {
    const { address, isConnected } = useAccount();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { writeContractAsync } = useWriteContract();

    // Get quote for swap (Exact Input) - with caching
    const getQuote = useCallback(
        async (
            tokenIn: Token,
            tokenOut: Token,
            amountIn: string,
            stable: boolean = false
        ): Promise<{ amountOut: string; route: Route[] } | null> => {
            try {
                if (!amountIn || parseFloat(amountIn) === 0) return null;

                const actualTokenIn = tokenIn.isNative ? WSEI : tokenIn;
                const actualTokenOut = tokenOut.isNative ? WSEI : tokenOut;
                
                // Generate cache key for this quote
                const cacheKey = getQuoteCacheKey(
                    'v2',
                    actualTokenIn.address,
                    actualTokenOut.address,
                    amountIn,
                    stable
                );

                // Use cached result or fetch fresh (3 second TTL)
                return await swrCache(
                    cacheKey,
                    async () => {
                        const amountInWei = parseUnits(amountIn, tokenIn.decimals);

                        const route: Route[] = [
                            {
                                from: actualTokenIn.address as Address,
                                to: actualTokenOut.address as Address,
                                stable,
                                factory: V2_CONTRACTS.PoolFactory as Address,
                            },
                        ];

                        const data = encodeFunctionData({
                            abi: ROUTER_ABI,
                            functionName: 'getAmountsOut',
                            args: [amountInWei, route],
                        });

                        const response = await fetch(getRpcForQuotes(), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                jsonrpc: '2.0',
                                method: 'eth_call',
                                params: [{ to: V2_CONTRACTS.Router, data }, 'latest'],
                                id: 1
                            })
                        });

                        const result = await response.json();

                        if (result.result && result.result !== '0x') {
                            const decoded = decodeFunctionResult({
                                abi: ROUTER_ABI,
                                functionName: 'getAmountsOut',
                                data: result.result,
                            }) as bigint[];

                            const amountOutWei = decoded[decoded.length - 1];

                            return {
                                amountOut: formatUnits(amountOutWei, tokenOut.decimals),
                                route,
                            };
                        }
                        return null;
                    },
                    3000 // 3 second cache TTL
                );
            } catch (err) {
                console.error('Quote error:', err);
                return null;
            }
        },
        []
    );

    // Get quote for swap (Exact Output) - with caching
    const getQuoteExactOutput = useCallback(
        async (
            tokenIn: Token,
            tokenOut: Token,
            amountOut: string,
            stable: boolean = false
        ): Promise<{ amountIn: string; route: Route[] } | null> => {
            try {
                if (!amountOut || parseFloat(amountOut) === 0) return null;

                const actualTokenIn = tokenIn.isNative ? WSEI : tokenIn;
                const actualTokenOut = tokenOut.isNative ? WSEI : tokenOut;

                // Generate cache key for this quote
                const cacheKey = getQuoteCacheKey(
                    'v2-out',
                    actualTokenIn.address,
                    actualTokenOut.address,
                    amountOut,
                    stable
                );

                // Use cached result or fetch fresh (3 second TTL)
                return await swrCache(
                    cacheKey,
                    async () => {
                        const amountOutWei = parseUnits(amountOut, tokenOut.decimals);

                        const route: Route[] = [
                            {
                                from: actualTokenIn.address as Address,
                                to: actualTokenOut.address as Address,
                                stable,
                                factory: V2_CONTRACTS.PoolFactory as Address,
                            },
                        ];

                        const data = encodeFunctionData({
                            abi: ROUTER_ABI,
                            functionName: 'getAmountsIn',
                            args: [amountOutWei, route],
                        });

                        const response = await fetch(getRpcForQuotes(), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                jsonrpc: '2.0',
                                method: 'eth_call',
                                params: [{ to: V2_CONTRACTS.Router, data }, 'latest'],
                                id: 1
                            })
                        });

                        const result = await response.json();

                        if (result.result && result.result !== '0x') {
                            const decoded = decodeFunctionResult({
                                abi: ROUTER_ABI,
                                functionName: 'getAmountsIn',
                                data: result.result,
                            }) as bigint[];

                            const amountInWei = decoded[0];

                            return {
                                amountIn: formatUnits(amountInWei, tokenIn.decimals),
                                route,
                            };
                        }
                        return null;
                    },
                    3000 // 3 second cache TTL
                );
            } catch (err) {
                console.error('Quote exact output error:', err);
                return null;
            }
        },
        []
    );

    // Check and approve token
    const approveToken = useCallback(
        async (token: Token, amount: bigint, spender: Address): Promise<boolean> => {
            if (!address) return false;

            try {
                const hash = await writeContractAsync({
                    address: token.address as Address,
                    abi: ERC20_ABI,
                    functionName: 'approve',
                    args: [spender, maxUint256],
                });

                return !!hash;
            } catch (err) {
                console.error('Approve error:', err);
                return false;
            }
        },
        [address, writeContractAsync]
    );

    // Execute swap
    const executeSwap = useCallback(
        async (
            tokenIn: Token,
            tokenOut: Token,
            amountIn: string,
            amountOutMin: string,
            stable: boolean = false,
            deadline: number = 30, // minutes
            tradeType: 'exactIn' | 'exactOut' = 'exactIn'
        ): Promise<{ hash: string } | null> => {
            if (!address || !isConnected) {
                setError('Wallet not connected');
                return null;
            }

            setIsLoading(true);
            setError(null);

            try {
                const amountInWei = parseUnits(amountIn, tokenIn.decimals);
                const amountOutWei = parseUnits(amountOutMin, tokenOut.decimals);
                // For exactOut, amountOutMin param is actually amountOut (exact)
                // For exactIn, amountOutMin param is amountOutMinimum

                const deadlineTimestamp = BigInt(Math.floor(Date.now() / 1000) + deadline * 60);

                const route: Route[] = [
                    {
                        from: tokenIn.address as Address,
                        to: tokenOut.address as Address,
                        stable,
                        factory: V2_CONTRACTS.PoolFactory as Address,
                    },
                ];

                // Check if tokenIn is native SEI
                const isNativeIn = tokenIn.isNative;
                const isNativeOut = tokenOut.isNative;

                let hash: `0x${string}`;

                if (isNativeIn) {
                    // Swap SEI for Token
                    const wethRoute: Route[] = [
                        {
                            from: COMMON.WSEI as Address,
                            to: tokenOut.address as Address,
                            stable,
                            factory: V2_CONTRACTS.PoolFactory as Address,
                        },
                    ];

                    if (tradeType === 'exactOut') {
                        hash = await writeContractAsync({
                            address: V2_CONTRACTS.Router as Address,
                            abi: ROUTER_ABI,
                            functionName: 'swapETHForExactTokens',
                            args: [amountOutWei, wethRoute as readonly { from: Address; to: Address; stable: boolean; factory: Address; }[], address, deadlineTimestamp],
                            value: amountInWei,
                        });
                    } else {
                        hash = await writeContractAsync({
                            address: V2_CONTRACTS.Router as Address,
                            abi: ROUTER_ABI,
                            functionName: 'swapExactETHForTokens',
                            args: [amountOutWei, wethRoute as readonly { from: Address; to: Address; stable: boolean; factory: Address; }[], address, deadlineTimestamp],
                            value: amountInWei,
                        });
                    }
                } else if (isNativeOut) {
                    // Swap Token for SEI
                    const wethRoute: Route[] = [
                        {
                            from: tokenIn.address as Address,
                            to: COMMON.WSEI as Address,
                            stable,
                            factory: V2_CONTRACTS.PoolFactory as Address,
                        },
                    ];
                    // NOTE: Approval is handled by SwapInterface before calling this function

                    // NOTE: Approval is handled by SwapInterface before calling this function

                    if (tradeType === 'exactOut') {
                        hash = await writeContractAsync({
                            address: V2_CONTRACTS.Router as Address,
                            abi: ROUTER_ABI,
                            functionName: 'swapTokensForExactETH',
                            args: [amountOutWei, amountInWei, wethRoute as readonly { from: Address; to: Address; stable: boolean; factory: Address; }[], address, deadlineTimestamp],
                        });
                    } else {
                        hash = await writeContractAsync({
                            address: V2_CONTRACTS.Router as Address,
                            abi: ROUTER_ABI,
                            functionName: 'swapExactTokensForETH',
                            args: [amountInWei, amountOutWei, wethRoute as readonly { from: Address; to: Address; stable: boolean; factory: Address; }[], address, deadlineTimestamp],
                        });
                    }
                } else {
                    // NOTE: Approval is handled by SwapInterface before calling this function

                    // NOTE: Approval is handled by SwapInterface before calling this function

                    if (tradeType === 'exactOut') {
                        hash = await writeContractAsync({
                            address: V2_CONTRACTS.Router as Address,
                            abi: ROUTER_ABI,
                            functionName: 'swapTokensForExactTokens',
                            args: [amountOutWei, amountInWei, route as readonly { from: Address; to: Address; stable: boolean; factory: Address; }[], address, deadlineTimestamp],
                        });
                    } else {
                        hash = await writeContractAsync({
                            address: V2_CONTRACTS.Router as Address,
                            abi: ROUTER_ABI,
                            functionName: 'swapExactTokensForTokens',
                            args: [amountInWei, amountOutWei, route as readonly { from: Address; to: Address; stable: boolean; factory: Address; }[], address, deadlineTimestamp],
                        });
                    }
                }

                return { hash };
            } catch (err: unknown) {
                console.error('Swap error:', err);
                setError((err instanceof Error ? err.message : undefined) || 'Swap failed');
                return null;
            } finally {
                setIsLoading(false);
            }
        },
        [address, isConnected, writeContractAsync, approveToken]
    );

    return {
        getQuote,
        getQuoteExactOutput,
        executeSwap,
        approveToken,
        isLoading,
        error,
    };
}
