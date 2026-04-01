'use client';

import { useState, useCallback } from 'react';
import { parseUnits, formatUnits } from 'viem';
import { Token, WETH, USDC, WIND } from '@/config/tokens';
import { CL_CONTRACTS } from '@/config/contracts';
import { batchRpcCall } from '@/utils/rpc';
import { TICK_SPACINGS, resolveToken, encodeV3Path } from '@/utils/contracts';

// Common intermediate tokens for routing
const INTERMEDIATE_TOKENS = [WETH, USDC, WIND];

export interface RouteQuote {
    amountOut: string;
    path: string[];
    routeType: 'direct' | 'multi-hop';
    via?: string;
    intermediate?: Token;
    gasEstimate?: bigint;
    tickSpacing1?: number;
    tickSpacing2?: number;
}

export interface SplitRouteResult {
    totalAmountOut: string;
    legs: {
        route: RouteQuote;
        amountIn: string;
        amountOut: string;
        percent: number;
    }[];
}

export interface OptimalRouteResult {
    bestSingle: RouteQuote | null;
    bestSplit: SplitRouteResult | null;
    // The winner — whichever gives more output
    winner: 'single' | 'split' | null;
    amountOut: string;
}

interface BatchQuoteRequest {
    path: `0x${string}`;
    amountIn: bigint;
    outputDecimals: number;
    routeType: 'direct' | 'multi-hop';
    tokenIn: Token;
    tokenOut: Token;
    intermediate?: Token;
    tickSpacing1: number;
    tickSpacing2?: number;
}

export function useMixedRouteQuoter() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Encode quoteExactInput call data
    const encodeQuoteData = (path: `0x${string}`, amountIn: bigint): string => {
        const selector = 'cdca1753'; // quoteExactInput(bytes,uint256)
        const pathHex = path.slice(2);
        const pathOffset = '0000000000000000000000000000000000000000000000000000000000000040';
        const amountInHex = amountIn.toString(16).padStart(64, '0');
        const pathLength = (pathHex.length / 2).toString(16).padStart(64, '0');
        const pathPadded = pathHex.padEnd(Math.ceil(pathHex.length / 64) * 64, '0');
        return `0x${selector}${pathOffset}${amountInHex}${pathLength}${pathPadded}`;
    };

    // BATCH all quotes in a SINGLE HTTP request
    const batchQuote = useCallback(async (requests: BatchQuoteRequest[]): Promise<(RouteQuote | null)[]> => {
        if (requests.length === 0) return [];

        const batchCalls = requests.map((req) => ({
            method: 'eth_call',
            params: [{ to: CL_CONTRACTS.MixedRouteQuoterV1, data: encodeQuoteData(req.path, req.amountIn) }, 'latest'],
        }));

        try {
            const results = await batchRpcCall(batchCalls);

            return requests.map((req, i) => {
                const rawResult = results[i] as string | null | undefined;

                if (!rawResult || rawResult === '0x' || rawResult.length < 66) {
                    return null;
                }

                try {
                    const hex = rawResult.slice(2);
                    const amountOut = BigInt('0x' + hex.slice(0, 64));

                    if (amountOut <= BigInt(0)) return null;

                    return {
                        amountOut: formatUnits(amountOut, req.outputDecimals),
                        path: req.routeType === 'direct'
                            ? [req.tokenIn.symbol, req.tokenOut.symbol]
                            : [req.tokenIn.symbol, req.intermediate!.symbol, req.tokenOut.symbol],
                        routeType: req.routeType,
                        via: req.intermediate?.symbol,
                        intermediate: req.intermediate,
                        tickSpacing1: req.tickSpacing1,
                        tickSpacing2: req.tickSpacing2,
                    };
                } catch {
                    return null;
                }
            });
        } catch {
            return requests.map(() => null);
        }
    }, []);

    // Build route request templates for a token pair
    const buildRouteRequests = useCallback((
        tokenIn: Token,
        tokenOut: Token,
        amountInWei: bigint,
    ): BatchQuoteRequest[] => {
        const actualTokenIn = resolveToken(tokenIn);
        const actualTokenOut = resolveToken(tokenOut);
        const requests: BatchQuoteRequest[] = [];

        // Direct routes
        for (const ts of TICK_SPACINGS) {
            requests.push({
                path: encodeV3Path([actualTokenIn.address, actualTokenOut.address], [ts]),
                amountIn: amountInWei,
                outputDecimals: actualTokenOut.decimals,
                routeType: 'direct',
                tokenIn, tokenOut,
                tickSpacing1: ts,
            });
        }

        // Multi-hop routes
        for (const intermediate of INTERMEDIATE_TOKENS) {
            const actualIntermediate = resolveToken(intermediate);
            if (actualIntermediate.address.toLowerCase() === actualTokenIn.address.toLowerCase() ||
                actualIntermediate.address.toLowerCase() === actualTokenOut.address.toLowerCase()) continue;

            for (const ts1 of TICK_SPACINGS) {
                for (const ts2 of TICK_SPACINGS) {
                    requests.push({
                        path: encodeV3Path(
                            [actualTokenIn.address, actualIntermediate.address, actualTokenOut.address],
                            [ts1, ts2]
                        ),
                        amountIn: amountInWei,
                        outputDecimals: actualTokenOut.decimals,
                        routeType: 'multi-hop',
                        tokenIn, tokenOut,
                        intermediate,
                        tickSpacing1: ts1,
                        tickSpacing2: ts2,
                    });
                }
            }
        }

        return requests;
    }, [encodeV3Path]);

    /**
     * Unified route finder: finds best single route AND best split in minimal RPC calls.
     * - 1st batch: all routes at full amount (direct + multi-hop × all tick spacings)
     * - 2nd batch: split quotes across top 2 distinct routes at various ratios
     * Returns whichever gives the most output.
     */
    const findOptimalRoute = useCallback(async (
        tokenIn: Token,
        tokenOut: Token,
        amountIn: string
    ): Promise<OptimalRouteResult | null> => {
        if (!tokenIn || !tokenOut || !amountIn || parseFloat(amountIn) <= 0) {
            return null;
        }

        setIsLoading(true);
        setError(null);

        try {
            const actualTokenIn = resolveToken(tokenIn);
            const fullAmountWei = parseUnits(amountIn, actualTokenIn.decimals);

            // === BATCH 1: All routes at full amount ===
            const requests = buildRouteRequests(tokenIn, tokenOut, fullAmountWei);
            const fullResults = await batchQuote(requests);

            const validQuotes = fullResults
                .filter((r): r is RouteQuote => r !== null && parseFloat(r.amountOut) > 0)
                .sort((a, b) => parseFloat(b.amountOut) - parseFloat(a.amountOut));

            if (validQuotes.length === 0) {
                setIsLoading(false);
                return { bestSingle: null, bestSplit: null, winner: null, amountOut: '0' };
            }

            const bestSingle = validQuotes[0];

            // === BATCH 2: Try split across ALL pairs of distinct routes ===
            // Collect all distinct routes (different path structure)
            const distinctRoutes: RouteQuote[] = [validQuotes[0]];
            for (let i = 1; i < validQuotes.length; i++) {
                const r = validQuotes[i];
                const isDuplicate = distinctRoutes.some(d =>
                    d.routeType === r.routeType &&
                    d.tickSpacing1 === r.tickSpacing1 &&
                    d.via === r.via
                );
                if (!isDuplicate) {
                    distinctRoutes.push(r);
                    if (distinctRoutes.length >= 5) break; // Cap at top 5 distinct routes
                }
            }

            if (distinctRoutes.length < 2) {
                setIsLoading(false);
                return { bestSingle, bestSplit: null, winner: 'single', amountOut: bestSingle.amountOut };
            }

            // Build split quote requests for ALL pairs of distinct routes
            const splits = [95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35, 30, 25, 20, 15, 10, 5];
            const splitRequests: BatchQuoteRequest[] = [];
            const splitMeta: { pct1: number; idx1: number; idx2: number; r1: RouteQuote; r2: RouteQuote }[] = [];

            // Helper to find request template for a route
            const findTemplate = (route: RouteQuote) => requests.find(r =>
                r.routeType === route.routeType &&
                r.tickSpacing1 === route.tickSpacing1 &&
                (r.tickSpacing2 || 0) === (route.tickSpacing2 || 0) &&
                (r.intermediate?.symbol || '') === (route.via || '')
            );

            // Try all pairs
            for (let a = 0; a < distinctRoutes.length; a++) {
                for (let b = a + 1; b < distinctRoutes.length; b++) {
                    const rA = distinctRoutes[a];
                    const rB = distinctRoutes[b];
                    const tA = findTemplate(rA);
                    const tB = findTemplate(rB);
                    if (!tA || !tB) continue;

                    for (const pct1 of splits) {
                        const amount1 = (fullAmountWei * BigInt(pct1)) / BigInt(100);
                        const amount2 = fullAmountWei - amount1;

                        const idx1 = splitRequests.length;
                        splitRequests.push({ ...tA, amountIn: amount1 });
                        const idx2 = splitRequests.length;
                        splitRequests.push({ ...tB, amountIn: amount2 });
                        splitMeta.push({ pct1, idx1, idx2, r1: rA, r2: rB });
                    }
                }
            }

            let bestSplit: SplitRouteResult | null = null;
            let bestSplitOut = parseFloat(bestSingle.amountOut);

            // === 2-way splits ===
            if (splitRequests.length > 0) {
                const splitResults = await batchQuote(splitRequests);

                for (const { pct1, idx1, idx2, r1, r2 } of splitMeta) {
                    const res1 = splitResults[idx1];
                    const res2 = splitResults[idx2];
                    if (!res1 || !res2) continue;

                    const totalOut = parseFloat(res1.amountOut) + parseFloat(res2.amountOut);

                    if (totalOut > bestSplitOut) {
                        const pct2 = 100 - pct1;
                        const amount1Str = formatUnits((fullAmountWei * BigInt(pct1)) / BigInt(100), actualTokenIn.decimals);
                        const amount2Str = formatUnits(fullAmountWei - (fullAmountWei * BigInt(pct1)) / BigInt(100), actualTokenIn.decimals);

                        bestSplitOut = totalOut;
                        bestSplit = {
                            totalAmountOut: totalOut.toString(),
                            legs: [
                                { route: r1, amountIn: amount1Str, amountOut: res1.amountOut, percent: pct1 },
                                { route: r2, amountIn: amount2Str, amountOut: res2.amountOut, percent: pct2 },
                            ],
                        };
                    }
                }
            }

            // === 3-way splits (top 3 distinct routes, coarser granularity) ===
            if (distinctRoutes.length >= 3) {
                const triRequests: BatchQuoteRequest[] = [];
                const triMeta: { pcts: number[]; idxs: number[]; routes: RouteQuote[] }[] = [];

                // Generate 3-way splits: step by 10%, all combos that sum to 100
                const triSplits: number[][] = [];
                for (let a = 10; a <= 80; a += 10) {
                    for (let b = 10; b <= 90 - a; b += 10) {
                        const c = 100 - a - b;
                        if (c >= 5) triSplits.push([a, b, c]);
                    }
                }

                // Try top 3 routes in all triple combos
                const top3 = distinctRoutes.slice(0, 3);
                const templates = top3.map(r => findTemplate(r));
                if (templates.every(t => t !== undefined)) {
                    for (const pcts of triSplits) {
                        const idxs: number[] = [];
                        for (let i = 0; i < 3; i++) {
                            const amt = (fullAmountWei * BigInt(pcts[i])) / BigInt(100);
                            idxs.push(triRequests.length);
                            triRequests.push({ ...templates[i]!, amountIn: amt });
                        }
                        triMeta.push({ pcts, idxs, routes: top3 });
                    }
                }

                if (triRequests.length > 0) {
                    const triResults = await batchQuote(triRequests);

                    for (const { pcts, idxs, routes: triRoutes } of triMeta) {
                        const results3 = idxs.map(i => triResults[i]);
                        if (results3.some(r => !r)) continue;

                        const totalOut = results3.reduce((sum, r) => sum + parseFloat(r!.amountOut), 0);

                        if (totalOut > bestSplitOut) {
                            bestSplitOut = totalOut;
                            bestSplit = {
                                totalAmountOut: totalOut.toString(),
                                legs: pcts.map((pct, i) => ({
                                    route: triRoutes[i],
                                    amountIn: formatUnits((fullAmountWei * BigInt(pct)) / BigInt(100), actualTokenIn.decimals),
                                    amountOut: results3[i]!.amountOut,
                                    percent: pct,
                                })),
                            };
                        }
                    }
                }
            }

            const winner = bestSplit ? 'split' : 'single';
            const amountOut = bestSplit ? bestSplit.totalAmountOut : bestSingle.amountOut;

            setIsLoading(false);
            return { bestSingle, bestSplit, winner, amountOut } as OptimalRouteResult;
        } catch (err: unknown) {
            setError((err instanceof Error ? err.message : undefined) || 'Quote failed');
            setIsLoading(false);
            return null;
        }
    }, [batchQuote, buildRouteRequests]);

    // Spot rate: quote a tiny USDC amount to get prices of both tokens, then derive rate
    // 0.000001 USDC (1 wei) → tokenIn and 0.000001 USDC → tokenOut
    // Rate = (USDC per tokenOut) / (USDC per tokenIn) = tokenIn amount / tokenOut amount
    const getSpotRate = useCallback(async (
        tokenIn: Token,
        tokenOut: Token,
    ): Promise<number | null> => {
        try {
            const actualTokenIn = resolveToken(tokenIn);
            const actualTokenOut = resolveToken(tokenOut);

            // If one side IS USDC, we only need one quote
            const isTokenInUSDC = actualTokenIn.address.toLowerCase() === USDC.address.toLowerCase();
            const isTokenOutUSDC = actualTokenOut.address.toLowerCase() === USDC.address.toLowerCase();

            // Use 100 wei (0.0001 USDC) — smallest amount that quoter handles, zero price impact
            const usdcAmount = BigInt(100);

            const allRequests: BatchQuoteRequest[] = [];
            let inStart = 0, inCount = 0, outStart = 0, outCount = 0;

            if (!isTokenInUSDC) {
                // Quote: 1 USDC → tokenIn (how much tokenIn per $1)
                const reqs = buildRouteRequests(
                    USDC, // tokenIn for this quote
                    { ...actualTokenIn, isNative: false } as Token, // tokenOut
                    usdcAmount
                );
                inStart = allRequests.length;
                inCount = reqs.length;
                allRequests.push(...reqs);
            }

            if (!isTokenOutUSDC) {
                // Quote: 1 USDC → tokenOut (how much tokenOut per $1)
                const reqs = buildRouteRequests(
                    USDC,
                    { ...actualTokenOut, isNative: false } as Token,
                    usdcAmount
                );
                outStart = allRequests.length;
                outCount = reqs.length;
                allRequests.push(...reqs);
            }

            if (allRequests.length === 0) {
                // Both are USDC — rate is 1
                return 1;
            }

            const results = await batchQuote(allRequests);

            // Both values are "per 1 wei USDC" — the ratio cancels the unit
            const usdcRefValue = 0.0001; // 100 wei in USDC terms
            let tokenInPerUSDC = usdcRefValue; // default if tokenIn IS USDC (1 wei USDC = 0.000001 USDC)
            if (!isTokenInUSDC) {
                const inResults = results.slice(inStart, inStart + inCount);
                const valid = inResults.filter((r): r is RouteQuote => r !== null && parseFloat(r.amountOut) > 0);
                if (valid.length === 0) return null;
                const best = valid.reduce((a, b) => parseFloat(a.amountOut) > parseFloat(b.amountOut) ? a : b);
                tokenInPerUSDC = parseFloat(best.amountOut);
            }

            let tokenOutPerUSDC = usdcRefValue; // default if tokenOut IS USDC
            if (!isTokenOutUSDC) {
                const outResults = results.slice(outStart, outStart + outCount);
                const valid = outResults.filter((r): r is RouteQuote => r !== null && parseFloat(r.amountOut) > 0);
                if (valid.length === 0) return null;
                const best = valid.reduce((a, b) => parseFloat(a.amountOut) > parseFloat(b.amountOut) ? a : b);
                tokenOutPerUSDC = parseFloat(best.amountOut);
            }

            // Rate: 1 tokenIn = ? tokenOut
            // tokenInPerUSDC = how many tokenIn you get for $1
            // tokenOutPerUSDC = how many tokenOut you get for $1
            // So 1 tokenIn = (tokenOutPerUSDC / tokenInPerUSDC) tokenOut
            return tokenOutPerUSDC / tokenInPerUSDC;
        } catch {
            return null;
        }
    }, [batchQuote, buildRouteRequests]);

    const getIntermediateToken = useCallback((symbol: string): Token | undefined => {
        return INTERMEDIATE_TOKENS.find(t => t.symbol === symbol);
    }, []);

    return {
        findOptimalRoute,
        getSpotRate,
        getIntermediateToken,
        INTERMEDIATE_TOKENS,
        isLoading,
        error,
    };
}
