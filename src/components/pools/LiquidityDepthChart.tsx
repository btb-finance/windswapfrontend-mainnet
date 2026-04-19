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

const BAR_COUNT = 30;

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

        // Find the range where liquidity exists to determine zoom level
        const activeBars = bars.filter(b => b.liquidity > BigInt(0));
        let halfRange: number;

        if (activeBars.length > 0) {
            const minTick = Math.min(...activeBars.map(b => b.tick));
            const maxTick = Math.max(...activeBars.map(b => b.tickUpper));
            // Half range = max distance from current tick to any liquidity, with padding
            const distLow = Math.abs(currentTick - minTick);
            const distHigh = Math.abs(maxTick - currentTick);
            halfRange = Math.max(distLow, distHigh, tickSpacing * 10) * 1.5;
        } else {
            halfRange = BAR_COUNT / 2 * tickSpacing;
        }

        // Always center on current tick
        const viewMin = currentTick - halfRange;
        const viewMax = currentTick + halfRange;

        const totalRange = viewMax - viewMin;
        const bucketSize = Math.max(tickSpacing, Math.floor(totalRange / BAR_COUNT / tickSpacing) * tickSpacing || tickSpacing);
        const buckets: { tick: number; liquidity: bigint }[] = [];

        for (let t = viewMin; t < viewMax; t += bucketSize) {
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

        let maxLiq = BigInt(0);
        for (const b of buckets) {
            if (b.liquidity > maxLiq) maxLiq = b.liquidity;
        }
        if (maxLiq === BigInt(0)) return null;

        return { buckets, maxLiq, viewMin, viewMax };
    }, [bars, currentTick, tickSpacing]);

    if (loading) {
        return (
            <div className="h-10 mb-2 flex items-center justify-center">
                <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!chartData || currentTick === null) return null;

    const { buckets, maxLiq, viewMin, viewMax } = chartData;

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

    let rangeLow = lowerTick;
    let rangeHigh = upperTick;
    if (rangeLow !== null && rangeHigh !== null && rangeLow > rangeHigh) {
        [rangeLow, rangeHigh] = [rangeHigh, rangeLow];
    }

    return (
        <div className="mb-2">
            <div className="flex items-end gap-px h-10 relative px-1 rounded overflow-hidden">
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
                        barColor = 'bg-primary/70';
                    } else {
                        barColor = 'bg-white/15';
                    }

                    return (
                        <div key={i} className="flex-1 flex items-end" title={`Tick ${b.tick}`}>
                            <div
                                className={`w-full rounded-sm ${barColor} transition-colors`}
                                style={{ height: `${Math.max(height, 3)}%`, minHeight: height > 0 ? '3px' : '1px' }}
                            />
                        </div>
                    );
                })}
                {/* Current price line */}
                {(() => {
                    const pct = ((currentTick - viewMin) / (viewMax - viewMin)) * 100;
                    if (pct < 0 || pct > 100) return null;
                    return <div className="absolute top-0 bottom-0 w-px bg-white/50" style={{ left: `${pct}%` }} />;
                })()}
            </div>
        </div>
    );
}
