'use client';

import { useMemo } from 'react';
import { LiquidityBar } from '@/hooks/useTickLensData';
import { tickToPrice } from '@/utils/liquidityMath';

interface Props {
    bars: LiquidityBar[];
    loading: boolean;
    currentTick: number | null;
    tickSpacing: number;
    token0Decimals: number;
    token1Decimals: number;
    isToken0Base: boolean;
    priceLower?: number;
    priceUpper?: number;
}

const BAR_COUNT = 60;

export function LiquidityDepthChart({
    bars,
    loading,
    currentTick,
    tickSpacing,
    token0Decimals,
    token1Decimals,
    isToken0Base,
    priceLower,
    priceUpper,
}: Props) {
    const chartData = useMemo(() => {
        if (!bars.length || currentTick === null) return null;

        // Determine visible range: ±30 tick spacings * tickSpacing around current tick,
        // or wider if there's data beyond
        const halfRange = BAR_COUNT / 2 * tickSpacing;
        const viewMin = currentTick - halfRange;
        const viewMax = currentTick + halfRange;

        // Bucket bars into uniform chart bars
        const bucketSize = tickSpacing;
        const buckets: { tick: number; liquidity: bigint }[] = [];

        for (let t = viewMin; t < viewMax; t += bucketSize) {
            // Find the liquidity active at tick t
            // This is the last bar where bar.tick <= t
            let liq = BigInt(0);
            for (let i = bars.length - 1; i >= 0; i--) {
                if (bars[i].tick <= t) {
                    liq = bars[i].liquidity;
                    break;
                }
            }
            buckets.push({ tick: t, liquidity: liq });
        }

        if (buckets.length === 0) return null;

        // Find max liquidity for normalization
        let maxLiq = BigInt(0);
        for (const b of buckets) {
            if (b.liquidity > maxLiq) maxLiq = b.liquidity;
        }
        if (maxLiq === BigInt(0)) return null;

        return { buckets, maxLiq, viewMin, viewMax };
    }, [bars, currentTick, tickSpacing]);

    if (loading) {
        return (
            <div className="h-24 mb-3 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!chartData || currentTick === null) return null;

    const { buckets, maxLiq, viewMin, viewMax } = chartData;

    // Convert range prices to ticks for highlighting
    const lowerTick = priceLower && priceLower > 0
        ? Math.log(
            (isToken0Base ? priceLower : 1 / priceLower) *
            Math.pow(10, token1Decimals - token0Decimals)
        ) / Math.log(1.0001)
        : null;
    const upperTick = priceUpper && priceUpper > 0
        ? Math.log(
            (isToken0Base ? priceUpper : 1 / priceUpper) *
            Math.pow(10, token1Decimals - token0Decimals)
        ) / Math.log(1.0001)
        : null;

    // Ensure lower < upper
    let rangeLow = lowerTick;
    let rangeHigh = upperTick;
    if (rangeLow !== null && rangeHigh !== null && rangeLow > rangeHigh) {
        [rangeLow, rangeHigh] = [rangeHigh, rangeLow];
    }

    return (
        <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-gray-500">Liquidity Distribution</span>
                <span className="text-[10px] text-gray-500">
                    {tickToPrice(currentTick, token0Decimals, token1Decimals, isToken0Base).toPrecision(5)} current
                </span>
            </div>
            <div className="flex items-end gap-px h-20 relative">
                {buckets.map((b, i) => {
                    const height = maxLiq > BigInt(0)
                        ? Number((b.liquidity * BigInt(100)) / maxLiq)
                        : 0;

                    const isCurrentTick = b.tick <= currentTick && currentTick < b.tick + tickSpacing;
                    const inRange = rangeLow !== null && rangeHigh !== null &&
                        b.tick + tickSpacing > rangeLow && b.tick < rangeHigh;

                    let barColor: string;
                    if (isCurrentTick) {
                        barColor = 'bg-white';
                    } else if (inRange) {
                        barColor = 'bg-primary';
                    } else {
                        barColor = 'bg-white/20';
                    }

                    return (
                        <div
                            key={i}
                            className="flex-1 flex items-end"
                            title={`Tick ${b.tick}`}
                        >
                            <div
                                className={`w-full rounded-t-sm ${barColor} transition-colors`}
                                style={{
                                    height: `${Math.max(height, 1)}%`,
                                    minHeight: height > 0 ? '2px' : '1px',
                                }}
                            />
                        </div>
                    );
                })}
                {/* Current price line */}
                {(() => {
                    const pct = ((currentTick - viewMin) / (viewMax - viewMin)) * 100;
                    if (pct < 0 || pct > 100) return null;
                    return (
                        <div
                            className="absolute top-0 bottom-0 w-px bg-white/60"
                            style={{ left: `${pct}%` }}
                        />
                    );
                })()}
            </div>
        </div>
    );
}
