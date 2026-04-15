'use client';

import { useMilkStrategy, AlertLevel } from '@/hooks/useMilkStrategy';
import { MILK, USDC } from '@/config/tokens';

function fmt(n: number, decimals = 4): string {
    return n.toFixed(decimals);
}

function fmtPct(n: number): string {
    return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function AlertBadge({ level, discountPct, premiumPct }: {
    level: AlertLevel;
    discountPct: number | null;
    premiumPct: number | null;
}) {
    if (premiumPct !== null && premiumPct > 0) return (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-400/20 text-orange-300 border border-orange-400/30 animate-pulse">
            Sell Now
        </span>
    );
    if (level === 'active' && discountPct !== null && discountPct > 0) return (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-400/20 text-green-300 border border-green-400/30 animate-pulse">
            Buy Zone −{fmt(discountPct, 2)}%
        </span>
    );
    return (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-white/5 text-gray-400 border border-white/10">
            Neutral
        </span>
    );
}

function PriceRow({ label, value, sub, highlight }: {
    label: string;
    value: string;
    sub?: string;
    highlight?: 'green' | 'yellow' | 'red' | 'none';
}) {
    const color =
        highlight === 'green'  ? 'text-green-400' :
        highlight === 'yellow' ? 'text-yellow-300' :
        highlight === 'red'    ? 'text-red-400' :
        'text-white';

    return (
        <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
            <span className="text-xs text-gray-400">{label}</span>
            <div className="text-right">
                <span className={`text-sm font-semibold ${color}`}>{value}</span>
                {sub && <p className="text-[10px] text-gray-500">{sub}</p>}
            </div>
        </div>
    );
}

function ZoneBar({ discountPct }: { discountPct: number | null }) {
    const pct = discountPct ?? 0;
    // full bar = 0 (fair value) to 2.5% (contract redeem floor)
    const position = Math.min(Math.max((pct / 2.5) * 100, 0), 100);
    const inBuyZone = pct > 0;

    return (
        <div className="mt-4 mb-1">
            <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                <span>Contract fair value</span>
                <span>Redeem floor (−2.5%)</span>
            </div>
            <div className="relative h-3 rounded-full overflow-hidden bg-white/5 border border-white/10">
                {/* Buy zone fill — everything left of the dot is buy zone */}
                {inBuyZone && (
                    <div
                        className="absolute top-0 bottom-0 left-0 bg-green-400/20 transition-all duration-500"
                        style={{ width: `${position}%` }}
                    />
                )}
                {/* Current price dot */}
                {discountPct !== null && (
                    <div
                        className="absolute top-0.5 bottom-0.5 w-2 rounded-full bg-white shadow-lg transition-all duration-500"
                        style={{ left: `calc(${position}% - 4px)` }}
                    />
                )}
            </div>
            <p className="text-[10px] text-gray-500 mt-1">
                {inBuyZone
                    ? `DEX is ${fmt(pct, 2)}% below fair value — likely profitable buy`
                    : discountPct !== null && discountPct < 0
                        ? `DEX is ${fmt(Math.abs(pct), 2)}% above fair value — sell now, wait for price to come back`
                        : 'Neutral — no day trade opportunity right now'}
            </p>
        </div>
    );
}

function LiveBuyZone({ data }: { data: ReturnType<typeof useMilkStrategy> }) {
    const { dexPrice, fairValue, discountPct, expectedGainOnRecovery, contractRedeemPrice, contractMintPrice } = data;
    if (dexPrice === null || fairValue === null || discountPct === null || discountPct <= 0) return null;

    const instantArb = contractRedeemPrice !== null && dexPrice < contractRedeemPrice;

    // $100 example
    const milkFor100 = 100 / dexPrice;
    const sellProceeds = contractMintPrice !== null ? milkFor100 * contractMintPrice : null;
    const profitOn100 = sellProceeds !== null ? sellProceeds - 100 : null;

    return (
        <div className="mt-4 rounded-xl p-4 border bg-green-500/10 border-green-500/30">
            <p className="font-semibold text-sm text-green-300 mb-1">
                Buy Zone — Most Likely Profitable
            </p>
            <p className="text-xs text-gray-300 mb-3">
                DEX price is <strong className="text-white">{fmt(discountPct, 2)}% below fair value</strong>.
                Buy on DEX now and sell when price reaches the mint ceiling — that is where arbers push it back down, making it the realistic top.
                {instantArb && ' Price is also below the contract redeem floor — instant profit by buying here and redeeming on contract right now.'}
            </p>

            {/* $100 example */}
            {profitOn100 !== null && contractMintPrice !== null && (
                <div className="rounded-lg bg-white/5 p-3 mb-3">
                    <p className="text-[10px] text-gray-500 mb-2 uppercase tracking-wider">If you buy $100 now</p>
                    <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                            <span className="text-gray-400">You get</span>
                            <span className="text-white font-medium">{fmt(milkFor100, 2)} MILK</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Sell target (mint ceiling)</span>
                            <span className="text-white font-medium">${fmt(contractMintPrice)} USDC</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Sell proceeds</span>
                            <span className="text-white font-medium">${fmt(sellProceeds!, 2)} USDC</span>
                        </div>
                        <div className="flex justify-between border-t border-white/10 pt-1.5">
                            <span className="text-gray-300 font-medium">Profit</span>
                            <span className="text-green-400 font-bold">
                                +${fmt(profitOn100, 2)} ({expectedGainOnRecovery !== null ? fmtPct(expectedGainOnRecovery) : '—'})
                            </span>
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-1.5 text-xs mb-3">
                <div className="flex justify-between">
                    <span className="text-gray-400">Buy at (DEX now)</span>
                    <span className="text-white font-medium">${fmt(dexPrice)} USDC</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-400">Sell target (mint ceiling)</span>
                    <span className="text-white font-medium">{contractMintPrice !== null ? `$${fmt(contractMintPrice)} USDC` : '—'}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-400">Exit anytime</span>
                    <span className="text-gray-300">Contract always redeems</span>
                </div>
            </div>
            <a
                href={`/swap?tokenIn=${USDC.address}&tokenOut=${MILK.address}`}
                className="block w-full text-center py-2.5 rounded-lg text-sm font-semibold transition-all bg-gradient-to-r from-primary to-secondary hover:opacity-90 active:scale-95 text-white"
            >
                Buy MILK on DEX
            </a>
            <p className="text-[10px] text-gray-500 mt-3 leading-relaxed">
                Price is sourced across all available liquidity pairs to find the best route.
                Slippage can be significant depending on pool depth — avoid buying large amounts in a single transaction.
                Split into smaller trades to reduce price impact.
            </p>
        </div>
    );
}

function MintArbitrage({ data }: { data: ReturnType<typeof useMilkStrategy> }) {
    const { dexPrice, contractMintPrice, fairValue } = data;
    if (dexPrice === null || contractMintPrice === null || fairValue === null) return null;
    if (dexPrice <= contractMintPrice) return null;

    const premiumPct = ((dexPrice - contractMintPrice) / contractMintPrice) * 100;

    return (
        <div className="mt-4 rounded-xl p-4 border bg-orange-500/10 border-orange-500/30">
            <p className="font-semibold text-sm text-orange-300 mb-1">
                Price High — Sell Now, Wait for It to Come Back
            </p>
            <p className="text-xs text-gray-300 mb-3">
                DEX price is <strong className="text-white">{fmt(premiumPct, 2)}% above</strong> the contract fair value.
                If you are holding MILK, this is the time to sell on DEX at the premium.
                Price will come back down — wait and buy again at fair value or below for the next cycle.
            </p>
            <div className="space-y-1.5 text-xs mb-3">
                <div className="flex justify-between">
                    <span className="text-gray-400">Effective mint cost</span>
                    <span className="text-white font-medium">${fmt(contractMintPrice)} USDC</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-400">DEX sell price</span>
                    <span className="text-white font-medium">${fmt(dexPrice)} USDC</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-400">Profit per MILK</span>
                    <span className="text-green-400 font-medium">{fmtPct(premiumPct)}</span>
                </div>
            </div>
            <a
                href={`/swap?tokenIn=${MILK.address}&tokenOut=${USDC.address}`}
                className="block w-full text-center py-2.5 rounded-lg text-sm font-semibold bg-orange-500/20 border border-orange-500/40 text-orange-300 hover:bg-orange-500/30 transition-all"
            >
                Sell MILK on DEX
            </a>
        </div>
    );
}

function NeutralPanel({ data }: { data: ReturnType<typeof useMilkStrategy> }) {
    const { dexPrice, fairValue, discountPct, premiumPct } = data;
    // Only show when price data is loaded and neither buy zone nor sell zone is active
    if (dexPrice === null || fairValue === null) return null;
    if ((discountPct !== null && discountPct > 0) || (premiumPct !== null && premiumPct > 0)) return null;

    return (
        <div className="mt-4 rounded-xl p-4 border border-white/10 bg-white/5">
            <p className="font-semibold text-sm text-gray-300 mb-1">Neutral — No Day Trade Right Now</p>
            <p className="text-xs text-gray-400">
                DEX price is at contract fair value. There is no discount to buy or premium to sell.
                Wait for the DEX price to drop below fair value before entering a day trade position.
                The LP strategy below still earns fees passively while you wait.
            </p>
        </div>
    );
}

function StrategyBuyZone() {
    return (
        <div className="mt-4 rounded-xl p-4 border border-white/10 bg-white/5">
            <p className="font-semibold text-sm text-white mb-1">Strategy 1 — Buy Below Fair Value</p>
            <p className="text-xs text-gray-400 mb-3">
                Any time the DEX price is below the contract fair value it is a buy zone.
                The contract fair value only ever goes up — every buy mints fewer tokens than the
                USDC deposited, so backing grows faster than supply. Buy the DEX discount,
                hold while the floor rises under you, exit on the DEX or redeem at the contract anytime.
            </p>
            <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="rounded-lg bg-white/5 p-2 text-center">
                    <p className="text-[10px] text-gray-500 mb-0.5">Entry</p>
                    <p className="text-xs font-semibold text-green-400">Any DEX discount</p>
                    <p className="text-[10px] text-gray-500">below fair value</p>
                </div>
                <div className="rounded-lg bg-white/5 p-2 text-center">
                    <p className="text-[10px] text-gray-500 mb-0.5">Floor</p>
                    <p className="text-xs font-semibold text-white">Always rising</p>
                    <p className="text-[10px] text-gray-500">with every buy</p>
                </div>
            </div>
            <a
                href={`/swap?tokenIn=${USDC.address}&tokenOut=${MILK.address}`}
                className="block w-full text-center py-2.5 rounded-lg text-sm font-semibold border border-white/20 text-white hover:bg-white/5 transition-all"
            >
                Buy MILK on DEX
            </a>
        </div>
    );
}

function StrategyLP({ data }: { data: ReturnType<typeof useMilkStrategy> }) {
    const { contractRedeemPrice, contractMintPrice } = data;

    return (
        <div className="mt-4 rounded-xl p-4 border border-white/10 bg-white/5">
            <p className="font-semibold text-sm text-white mb-1">Strategy 2 — 1-Tick LP</p>
            <p className="text-xs text-gray-400 mb-3">
                MILK price is bounded between the redeem and mint prices. Bots arb that range
                constantly — every arb trade pays fees to liquidity providers.
                WindSwap supports 1-tick liquidity, meaning your entire position earns fees
                at the current price. No other DEX offers this. The bounded price range means
                impermanent loss is near zero.
            </p>
            <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="rounded-lg bg-white/5 p-2 text-center">
                    <p className="text-[10px] text-gray-500 mb-0.5">Impermanent loss</p>
                    <p className="text-xs font-semibold text-green-400">Near zero</p>
                    <p className="text-[10px] text-gray-500">price is bounded</p>
                </div>
                <div className="rounded-lg bg-white/5 p-2 text-center">
                    <p className="text-[10px] text-gray-500 mb-0.5">Capital at work</p>
                    <p className="text-xs font-semibold text-white">100%</p>
                    <p className="text-[10px] text-gray-500">1-tick, all active</p>
                </div>
            </div>
            {contractRedeemPrice !== null && contractMintPrice !== null && (
                <p className="text-xs text-gray-400 mb-3">
                    Suggested range:{' '}
                    <span className="text-white font-medium">${fmt(contractRedeemPrice - 0.005)}</span>
                    {' — '}
                    <span className="text-white font-medium">${fmt(contractMintPrice + 0.005)}</span>
                    {' USDC'}
                </p>
            )}
            <a
                href="/pools"
                className="block w-full text-center py-2.5 rounded-lg text-sm font-semibold border border-white/20 text-white hover:bg-white/5 transition-all"
            >
                Add Liquidity on WindSwap
            </a>
        </div>
    );
}

export function MilkStrategyCard() {
    const data = useMilkStrategy();
    const {
        fairValue,
        dexPrice,
        dexPriceLoading,
        discountPct,
        premiumPct,
        alertLevel,
        contractRedeemPrice,
        contractMintPrice,
        contractLoading,
        lastUpdated,
        refresh,
    } = data;

    const loading = contractLoading && fairValue === null;

    return (
        <div className="swap-card max-w-lg mx-auto">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h2 className="text-lg font-bold">MILK Strategies</h2>
                    <p className="text-xs text-gray-400 mt-0.5 max-w-xs">
                        MILK is backed by USDC. The contract always lets you mint or redeem —
                        giving every trade a known floor. Use that edge.
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                    {!loading && (
                        <AlertBadge
                            level={alertLevel}
                            discountPct={discountPct}
                            premiumPct={premiumPct}
                        />
                    )}
                    <button
                        onClick={refresh}
                        disabled={dexPriceLoading}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all disabled:opacity-40"
                        title="Refresh"
                    >
                        <svg className={`w-3.5 h-3.5 text-gray-400 ${dexPriceLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Price grid */}
            <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-1">
                <PriceRow
                    label="Contract fair value"
                    value={loading ? 'Loading…' : fairValue !== null ? `$${fmt(fairValue)}` : '—'}
                    sub="rises with every buy — never goes down"
                />
                <PriceRow
                    label="DEX price"
                    value={dexPrice !== null ? `$${fmt(dexPrice)}` : dexPriceLoading ? 'Loading…' : '—'}
                    sub={discountPct !== null
                        ? discountPct > 0
                            ? `${fmt(discountPct, 2)}% below fair value — buy zone`
                            : `${fmt(Math.abs(discountPct), 2)}% above fair value`
                        : undefined}
                    highlight={discountPct !== null && discountPct > 0 ? 'green' : 'none'}
                />
                <PriceRow
                    label="Redeem floor"
                    value={contractRedeemPrice !== null ? `$${fmt(contractRedeemPrice)}` : '—'}
                    sub="guaranteed exit via contract"
                />
                <PriceRow
                    label="Mint ceiling"
                    value={contractMintPrice !== null ? `$${fmt(contractMintPrice)}` : '—'}
                    sub="mint arb triggers above this"
                />
            </div>

            <ZoneBar discountPct={discountPct} />

            {/* Live opportunity panels */}
            <LiveBuyZone data={data} />
            <MintArbitrage data={data} />
            <NeutralPanel data={data} />

            {/* Strategy explainers */}
            <StrategyBuyZone />
            <StrategyLP data={data} />

            {lastUpdated && (
                <p className="text-center text-[10px] text-gray-600 mt-3">
                    Updated {new Date(lastUpdated).toLocaleTimeString()} · refreshes every 15s
                </p>
            )}
        </div>
    );
}
