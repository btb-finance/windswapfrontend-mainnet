'use client';

import { useCallback, useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { useWriteContract } from '@/hooks/useWriteContract';
import { parseUnits, formatUnits, Address } from 'viem';
import { V2_CONTRACTS, COMMON } from '@/config/contracts';
import { ERC20_ABI, AGGREGATOR_PROXY_ABI } from '@/config/abis';
import { Token, WSEI } from '@/config/tokens';
import { getKyberQuote, getKyberSwapData } from '@/utils/kyberswap';

export interface BulkSwapLeg {
    token: Token;
    /** Fraction of total input allocated to this leg (0–1) */
    allocation: number;
    /** Estimated output amount (human-readable) */
    estimatedOut?: string;
    /** KyberSwap route summary (needed to build calldata) */
    routeSummary?: object;
    /** Status of this leg */
    status: 'idle' | 'quoting' | 'quoted' | 'failed';
}

export function useBulkSwap() {
    const { address } = useAccount();
    const publicClient = usePublicClient();
    const { writeContractAsync } = useWriteContract();
    const [isQuoting, setIsQuoting] = useState(false);
    const [isExecuting, setIsExecuting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * Get quotes for all legs in parallel via KyberSwap
     */
    const quoteAll = useCallback(
        async (
            tokenIn: Token,
            amountIn: string,
            legs: BulkSwapLeg[],
        ): Promise<BulkSwapLeg[]> => {
            if (!amountIn || parseFloat(amountIn) <= 0 || legs.length === 0) return legs;

            setIsQuoting(true);
            setError(null);

            const actualTokenIn = tokenIn.isNative ? WSEI : tokenIn;
            const totalWei = parseUnits(amountIn, tokenIn.decimals);

            // Calculate exact wei per leg to avoid rounding dust missing/exceeding totalWei
            const legAmountsWei = legs.map((leg, index) => {
                if (index === legs.length - 1) return BigInt(0); // calculated after
                return (totalWei * BigInt(Math.round(leg.allocation * 10000))) / BigInt(10000);
            });
            const sumSoFar = legAmountsWei.reduce((a, b) => a + b, BigInt(0));
            if (legs.length > 0) {
                legAmountsWei[legs.length - 1] = totalWei - sumSoFar;
            }

            const results = await Promise.all(
                legs.map(async (leg, index): Promise<BulkSwapLeg> => {
                    try {
                        const legAmountWei = legAmountsWei[index];
                        if (legAmountWei === BigInt(0)) {
                            return { ...leg, status: 'failed', estimatedOut: '0' };
                        }

                        const actualTokenOut = leg.token.isNative ? WSEI : leg.token;
                        const quote = await getKyberQuote(
                            actualTokenIn.address,
                            actualTokenOut.address,
                            legAmountWei.toString(),
                        );

                        if (!quote || parseFloat(quote.amountOut) <= 0) {
                            return { ...leg, status: 'failed', estimatedOut: '0' };
                        }

                        return {
                            ...leg,
                            status: 'quoted',
                            estimatedOut: formatUnits(BigInt(quote.amountOut), leg.token.decimals),
                            routeSummary: quote.routeSummary,
                        };
                    } catch {
                        return { ...leg, status: 'failed', estimatedOut: '0' };
                    }
                }),
            );

            setIsQuoting(false);
            return results;
        },
        [],
    );

    /**
     * Execute bulkSwap on the AggregatorProxy contract
     */
    const executeBulkSwap = useCallback(
        async (
            tokenIn: Token,
            amountIn: string,
            legs: BulkSwapLeg[],
            slippageBps: number = 100, // 1%
        ): Promise<{ hash: string } | null> => {
            if (!address) {
                setError('Wallet not connected');
                return null;
            }

            const quotedLegs = legs.filter((l) => l.status === 'quoted' && l.routeSummary);
            if (quotedLegs.length === 0 || quotedLegs.length !== legs.length) {
                setError('All legs must have valid quotes to execute.');
                return null;
            }

            setIsExecuting(true);
            setError(null);

            try {
                const actualTokenIn = tokenIn.isNative ? WSEI : tokenIn;
                const totalWei = parseUnits(amountIn, tokenIn.decimals);
                const proxyAddress = V2_CONTRACTS.AggregatorProxy as Address;

                // Calculate exact wei per leg to match totalWei (and the previous quoting step)
                const legAmountsWei = legs.map((leg, index) => {
                    if (index === legs.length - 1) return BigInt(0);
                    return (totalWei * BigInt(Math.round(leg.allocation * 10000))) / BigInt(10000);
                });
                const sumSoFar = legAmountsWei.reduce((a, b) => a + b, BigInt(0));
                if (legs.length > 0) {
                    legAmountsWei[legs.length - 1] = totalWei - sumSoFar;
                }

                // Build swap calldata for each leg via KyberSwap
                const orders = await Promise.all(
                    legs.map(async (leg, index) => {
                        const legAmountWei = legAmountsWei[index];
                        const actualTokenOut = leg.token.isNative ? WSEI : leg.token;

                        // Build calldata — sender & recipient = proxy contract
                        const swapData = await getKyberSwapData(
                            leg.routeSummary!,
                            proxyAddress,     // sender = proxy (it holds the tokens)
                            proxyAddress,     // recipient = proxy (it distributes after fee)
                            slippageBps,
                        );

                        if (!swapData) throw new Error(`Failed to build swap data for ${leg.token.symbol}`);

                        // minAmountOut with slippage (account for 1% proxy fee + user slippage tolerance)
                        const estimatedOutWei = parseUnits(leg.estimatedOut || '0', leg.token.decimals);
                        // Deduct user slippage + 1% protocol fee (100 bps)
                        const minOut = (estimatedOutWei * BigInt(10000 - slippageBps - 100)) / BigInt(10000);

                        return {
                            tokenOut: actualTokenOut.address as Address,
                            amountIn: legAmountWei,
                            minAmountOut: minOut,
                            router: swapData.routerAddress as Address,
                            callData: swapData.data as `0x${string}`,
                        };
                    }),
                );

                // If tokenIn is native ETH, send value; contract wraps to WETH
                const isNativeIn = tokenIn.isNative;
                const tokenInAddress = isNativeIn
                    ? '0x0000000000000000000000000000000000000000'
                    : (actualTokenIn.address as Address);

                // Approve if ERC20
                if (!isNativeIn) {
                    // Check current allowance
                    const allowance = await publicClient!.readContract({
                        address: actualTokenIn.address as Address,
                        abi: ERC20_ABI,
                        functionName: 'allowance',
                        args: [address, proxyAddress],
                    }) as bigint;

                    // Only approve if current allowance is less than needed amount
                    if (allowance < totalWei) {
                        const approveHash = await writeContractAsync({
                            address: actualTokenIn.address as Address,
                            abi: ERC20_ABI,
                            functionName: 'approve',
                            args: [proxyAddress, totalWei],
                        });
                        // Wait a moment for approval to propagate
                        if (approveHash) {
                            await new Promise((r) => setTimeout(r, 2000));
                        }
                    }
                }

                const hash = await writeContractAsync({
                    address: proxyAddress,
                    abi: AGGREGATOR_PROXY_ABI,
                    functionName: 'bulkSwap',
                    args: [tokenInAddress, orders, address],
                    value: isNativeIn ? totalWei : undefined,
                });

                return { hash };
            } catch (err: unknown) {
                console.error('BulkSwap error:', err);
                setError(err instanceof Error ? err.message : 'Bulk swap failed');
                return null;
            } finally {
                setIsExecuting(false);
            }
        },
        [address, writeContractAsync],
    );

    return {
        quoteAll,
        executeBulkSwap,
        isQuoting,
        isExecuting,
        error,
    };
}
