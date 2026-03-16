'use client';

import { useState, useEffect, useRef } from 'react';
import { encodeFunctionData, decodeFunctionResult } from 'viem';
import { TICK_LENS_ABI } from '@/config/abis';
import { CL_CONTRACTS } from '@/config/contracts';
import { getRpcForPoolData } from '@/utils/rpc';

export interface TickDataPoint {
    tick: number;
    liquidityNet: bigint;
    liquidityGross: bigint;
}

export interface LiquidityBar {
    tick: number;
    tickUpper: number;
    liquidity: bigint; // cumulative active liquidity at this tick
}

/**
 * Fetches populated ticks from the TickLens contract for a given pool
 * and computes cumulative liquidity bars for chart rendering.
 */
export function useTickLensData(
    poolAddress: string | null,
    tickSpacing: number,
    currentTick: number | null,
    numWords: number = 10 // how many bitmap words to scan around current tick
) {
    const [bars, setBars] = useState<LiquidityBar[]>([]);
    const [loading, setLoading] = useState(false);
    const abortRef = useRef(0);

    useEffect(() => {
        if (!poolAddress || !currentTick || !tickSpacing) {
            setBars([]);
            return;
        }

        const requestId = ++abortRef.current;
        setLoading(true);

        (async () => {
            try {
                // Calculate the bitmap index for the current tick
                // tickBitmapIndex = floor(tick / tickSpacing / 256)
                const compressed = Math.floor(currentTick / tickSpacing);
                const centerWord = compressed >> 8; // equivalent to floor(compressed / 256)

                // Scan words around the center
                const wordIndices: number[] = [];
                for (let i = -numWords; i <= numWords; i++) {
                    const idx = centerWord + i;
                    if (idx >= -32768 && idx <= 32767) { // int16 range
                        wordIndices.push(idx);
                    }
                }

                // Batch RPC calls for all words
                const calls = wordIndices.map((idx) => {
                    const calldata = encodeFunctionData({
                        abi: TICK_LENS_ABI,
                        functionName: 'getPopulatedTicksInWord',
                        args: [poolAddress as `0x${string}`, idx],
                    });
                    return {
                        jsonrpc: '2.0' as const,
                        method: 'eth_call',
                        params: [{ to: CL_CONTRACTS.TickLens, data: calldata }, 'latest'],
                        id: idx,
                    };
                });

                const res = await fetch(getRpcForPoolData(), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(calls),
                });

                if (requestId !== abortRef.current) return;

                const results = await res.json();
                if (requestId !== abortRef.current) return;

                // Parse all results
                const allTicks: TickDataPoint[] = [];
                const resultsArr = Array.isArray(results) ? results : [results];

                for (const r of resultsArr) {
                    if (!r.result || r.result === '0x' || r.result.length <= 2) continue;
                    try {
                        const decoded = decodeFunctionResult({
                            abi: TICK_LENS_ABI,
                            functionName: 'getPopulatedTicksInWord',
                            data: r.result,
                        });
                        for (const t of decoded) {
                            allTicks.push({
                                tick: Number(t.tick),
                                liquidityNet: t.liquidityNet,
                                liquidityGross: t.liquidityGross,
                            });
                        }
                    } catch {
                        // skip malformed responses
                    }
                }

                if (requestId !== abortRef.current) return;
                if (allTicks.length === 0) {
                    setBars([]);
                    setLoading(false);
                    return;
                }

                // Sort ticks ascending
                allTicks.sort((a, b) => a.tick - b.tick);

                // Compute cumulative liquidity by walking ticks left to right
                // Start from the lowest tick and accumulate liquidityNet
                const liquidityBars: LiquidityBar[] = [];
                let cumulativeLiquidity = BigInt(0);

                for (let i = 0; i < allTicks.length; i++) {
                    cumulativeLiquidity += allTicks[i].liquidityNet;
                    const nextTick = i < allTicks.length - 1 ? allTicks[i + 1].tick : allTicks[i].tick + tickSpacing;
                    liquidityBars.push({
                        tick: allTicks[i].tick,
                        tickUpper: nextTick,
                        liquidity: cumulativeLiquidity < BigInt(0) ? BigInt(0) : cumulativeLiquidity,
                    });
                }

                setBars(liquidityBars);
            } catch (err) {
                console.error('TickLens fetch error:', err);
                if (requestId === abortRef.current) setBars([]);
            } finally {
                if (requestId === abortRef.current) setLoading(false);
            }
        })();
    }, [poolAddress, tickSpacing, currentTick, numWords]);

    return { bars, loading };
}
