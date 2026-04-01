'use client';

import { useCallback, useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { useWriteContract } from '@/hooks/useWriteContract';
import { parseUnits, formatUnits, Address, maxUint256 } from 'viem';
import { V2_CONTRACTS } from '@/config/contracts';
import { ERC20_ABI, AGGREGATOR_PROXY_ABI } from '@/config/abis';
import { Token, WETH } from '@/config/tokens';
import { getKyberQuote, getKyberSwapData } from '@/utils/kyberswap';

export interface BulkSellLeg {
    token: Token;
    /** Amount of this token to sell (human-readable) */
    amountIn: string;
    /** Estimated output amount in tokenOut (human-readable) */
    estimatedOut?: string;
    /** KyberSwap route summary (needed to build calldata) */
    routeSummary?: object;
    /** Status of this leg */
    status: 'idle' | 'quoting' | 'quoted' | 'failed';
}

export function useBulkSell() {
    const { address } = useAccount();
    const { writeContractAsync } = useWriteContract();
    const [isQuoting, setIsQuoting] = useState(false);
    const [isExecuting, setIsExecuting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * Get quotes for selling all legs into `tokenOut` in parallel via KyberSwap
     */
    const quoteAll = useCallback(
        async (
            legs: BulkSellLeg[],
            tokenOut: Token,
        ): Promise<BulkSellLeg[]> => {
            if (legs.length === 0) return legs;

            setIsQuoting(true);
            setError(null);

            const actualTokenOut = tokenOut.isNative ? WETH : tokenOut;

            const results = await Promise.all(
                legs.map(async (leg): Promise<BulkSellLeg> => {
                    try {
                        if (!leg.amountIn || parseFloat(leg.amountIn) <= 0) {
                            return { ...leg, status: 'idle', estimatedOut: undefined, routeSummary: undefined };
                        }

                        const actualTokenIn = leg.token.isNative ? WETH : leg.token;
                        const legAmountWei = parseUnits(leg.amountIn, leg.token.decimals);

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
                            estimatedOut: formatUnits(BigInt(quote.amountOut), tokenOut.decimals),
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

    const publicClient = usePublicClient();

    /**
     * Approves all ERC20 tokens in the basket that need approval
     */
    const approveAll = useCallback(
        async (legs: BulkSellLeg[]): Promise<boolean> => {
            if (!address || !publicClient) return false;
            setIsExecuting(true);
            setError(null);
            
            try {
                const proxyAddress = V2_CONTRACTS.AggregatorProxy as Address;
                for (const leg of legs) {
                    if (leg.token.isNative) continue;
                    if (!leg.amountIn || parseFloat(leg.amountIn) <= 0) continue;

                    const legAmountWei = parseUnits(leg.amountIn, leg.token.decimals);

                    // Check current allowance first
                    const allowance = await publicClient.readContract({
                        address: leg.token.address as Address,
                        abi: ERC20_ABI,
                        functionName: 'allowance',
                        args: [address, proxyAddress],
                    });

                    if ((allowance as bigint) < legAmountWei) {
                        const hash = await writeContractAsync({
                            address: leg.token.address as Address,
                            abi: ERC20_ABI,
                            functionName: 'approve',
                            args: [proxyAddress, legAmountWei],
                        });
                        
                        if (hash) {
                            // Wait for the Tx to be visible to the RPC or just let wallet queue it
                            await new Promise((r) => setTimeout(r, 1000));
                        }
                    }
                }
                return true;
            } catch (err: unknown) {
                console.error('ApproveAll error:', err);
                setError(err instanceof Error ? err.message : 'Approval failed');
                return false;
            } finally {
                setIsExecuting(false);
            }
        },
        [address, writeContractAsync, publicClient]
    );

    /**
     * Execute bulkSell on the AggregatorProxy contract
     */
    const executeBulkSell = useCallback(
        async (
            legs: BulkSellLeg[],
            tokenOut: Token,
            slippageBps: number = 100, // 1%
        ): Promise<{ hash: string } | null> => {
            if (!address) {
                setError('Wallet not connected');
                return null;
            }

            // Only legs with input amount need to be quoted
            const activeLegs = legs.filter(l => l.amountIn && parseFloat(l.amountIn) > 0);
            const quotedLegs = activeLegs.filter((l) => l.status === 'quoted' && l.routeSummary);
            
            if (activeLegs.length === 0) {
                setError('No amounts entered');
                return null;
            }
            if (quotedLegs.length !== activeLegs.length) {
                setError('All active legs must have valid quotes to execute.');
                return null;
            }

            setIsExecuting(true);
            setError(null);

            try {
                const proxyAddress = V2_CONTRACTS.AggregatorProxy as Address;
                let totalNativeValueWei = BigInt(0);

                // Build swap calldata for each leg via KyberSwap
                const orders = await Promise.all(
                    quotedLegs.map(async (leg) => {
                        const legAmountWei = parseUnits(leg.amountIn, leg.token.decimals);

                        // Build calldata — sender & recipient = proxy contract
                        const swapData = await getKyberSwapData(
                            leg.routeSummary!,
                            proxyAddress,     // sender
                            proxyAddress,     // recipient
                            slippageBps,
                        );

                        if (!swapData) throw new Error(`Failed to build swap data for ${leg.token.symbol}`);

                        // track native value if the user is selling ETH
                        if (leg.token.isNative) {
                            totalNativeValueWei += legAmountWei;
                        }

                        // minAmountOut with proxy fee (100 bps) + slippage
                        const estimatedOutWei = parseUnits(leg.estimatedOut || '0', tokenOut.decimals);
                        const minOut = (estimatedOutWei * BigInt(10000 - slippageBps - 100)) / BigInt(10000);

                        return {
                            tokenIn: (leg.token.isNative ? '0x0000000000000000000000000000000000000000' : leg.token.address) as Address,
                            amountIn: legAmountWei,
                            minAmountOut: minOut,
                            router: swapData.routerAddress as Address,
                            callData: swapData.data as `0x${string}`,
                        };
                    })
                );

                const actualTokenOutAddress = tokenOut.isNative
                    ? '0x0000000000000000000000000000000000000000'
                    : (tokenOut.address as Address);

                const hash = await writeContractAsync({
                    address: proxyAddress,
                    abi: AGGREGATOR_PROXY_ABI,
                    functionName: 'bulkSell',
                    args: [orders, actualTokenOutAddress, address],
                    value: totalNativeValueWei > BigInt(0) ? totalNativeValueWei : undefined,
                });

                return { hash };
            } catch (err: unknown) {
                console.error('BulkSell error:', err);
                setError(err instanceof Error ? err.message : 'Bulk sell failed');
                return null;
            } finally {
                setIsExecuting(false);
            }
        },
        [address, writeContractAsync],
    );

    return {
        quoteAll,
        approveAll,
        executeBulkSell,
        isQuoting,
        isExecuting,
        error,
    };
}
