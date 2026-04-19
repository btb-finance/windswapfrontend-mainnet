'use client';

import { useState, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { usePoolData } from '@/providers/PoolDataProvider';
import { NOTABLE_POOLS } from '@/config/contracts';
import { EmptyState } from '@/components/common/InfoCard';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

// Lazy load AddLiquidityModal - only loads when user opens it
const AddLiquidityModal = dynamic(
    () => import('@/components/pools/AddLiquidityModal').then(mod => mod.AddLiquidityModal),
    { ssr: false }
);
import { Token, ETH } from '@/config/tokens';
import { getTokenByAddress } from '@/utils/tokens';
import { calculatePoolAPR, formatAPR } from '@/utils/aprCalculator';

type PoolType = 'all' | 'v2' | 'cl';
type Category = 'all' | 'stable' | 'wind' | 'btc' | 'eth' | 'other';
type SortBy = 'default' | 'tvl' | 'apr';

// Fee tier mapping for CL pools (from CLFactory contract)
const FEE_TIERS: Record<number, string> = {
    1: '0.005%',     // Stables
    2: '1%',         // Exotic
    3: '0.03%',      // Standard pairs
    4: '0.05%',      // Medium volatility
    5: '0.26%',      // Volatile
};

// Pool config for modal
interface PoolConfig {
    token0?: Token;
    token1?: Token;
    poolType: 'v2' | 'cl';
    tickSpacing?: number;
    stable?: boolean;
}

const TOP_POOL_ADDRESSES: Record<string, boolean> = Object.fromEntries(
    (Object.values(NOTABLE_POOLS) as string[]).map(addr => [addr.toLowerCase(), true])
);

const TOP_POOL_PRIORITY: Record<string, number> = {};

// Helper to find token by address - use ETH for WETH in UI
// Falls back to building a Token from pool data for unlisted tokens
const findTokenForUI = (addr: string, poolToken?: { address: string; symbol: string; decimals: number; logoURI?: string }): Token | undefined => {
    const token = getTokenByAddress(addr);
    // Show ETH for WETH in UI for better UX
    if (token?.symbol === 'WETH' || token?.symbol === 'WSEI') return ETH;
    if (token) return token;
    // For unlisted tokens, build a Token from pool subgraph data
    if (poolToken) {
        return {
            address: poolToken.address,
            symbol: poolToken.symbol,
            name: poolToken.symbol,
            decimals: poolToken.decimals,
            logoURI: poolToken.logoURI,
        };
    }
    return undefined;
};

// Format compact number (e.g. $245K, $1.2M)
const formatCompact = (value: number): string => {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    if (value > 0) return `$${value.toFixed(0)}`;
    return '';
};

export default function PoolsPage() {
    const [poolType, setPoolType] = useState<PoolType>('all');
    const [category, setCategory] = useState<Category>('all');
    const [sortBy, setSortBy] = useState<SortBy>('default');
    const [search, setSearch] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedPool, setSelectedPool] = useState<PoolConfig | undefined>(undefined);

    // Use globally prefetched pool data - instant load!
    const { v2Pools, clPools, allPools, poolRewards, stakedLiquidity, windPrice, seiPrice, isLoading, refetch } = usePoolData();

    // Pull-to-refresh for mobile
    const [isRefreshing, setIsRefreshing] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await refetch();
        } finally {
            setIsRefreshing(false);
        }
    };

    const { handlers, pullProgress, isPulling } = usePullToRefresh({
        onRefresh: handleRefresh,
        threshold: 80,
    });

    // Pre-compute APR for all pools with useMemo
    const poolAPRs = useMemo(() => {
        const aprMap = new Map<string, number | null>();
        for (const pool of allPools) {
            const rewardRate = poolRewards.get(pool.address.toLowerCase());
            if (!rewardRate || rewardRate === BigInt(0)) {
                aprMap.set(pool.address, null);
                continue;
            }

            const totalTvl = parseFloat(pool.tvl) || 0;
            if (totalTvl <= 0) {
                aprMap.set(pool.address, null);
                continue;
            }

            // APR = annual rewards / staked TVL (only stakers earn rewards)
            const stakedLiq = stakedLiquidity.get(pool.address.toLowerCase());
            const poolLiq = pool.liquidity ? BigInt(pool.liquidity) : BigInt(0);

            let stakedTvl: number;
            if (stakedLiq && stakedLiq > BigInt(0) && poolLiq > BigInt(0)) {
                // stakedTVL = (stakedLiquidity / totalPoolLiquidity) * totalTVL
                stakedTvl = (Number(stakedLiq) / Number(poolLiq)) * totalTvl;
            } else {
                // No one staked yet — assume $1000 staked to show attractive APR
                // Rewards are high when few/no stakers, so reflect that
                stakedTvl = 1000;
            }
            if (stakedTvl <= 0) {
                aprMap.set(pool.address, null);
                continue;
            }

            const apr = calculatePoolAPR(rewardRate, windPrice, stakedTvl, pool.tickSpacing);
            aprMap.set(pool.address, apr);
        }
        return aprMap;
    }, [allPools, poolRewards, stakedLiquidity, windPrice, seiPrice]);

    // Open modal for a specific pool
    const openAddLiquidityModal = (pool: typeof allPools[0]) => {
        const token0 = findTokenForUI(pool.token0.address, pool.token0);
        const token1 = findTokenForUI(pool.token1.address, pool.token1);
        setSelectedPool({
            token0,
            token1,
            poolType: pool.poolType === 'CL' ? 'cl' : 'v2',
            tickSpacing: pool.tickSpacing,
            stable: pool.stable,
        });
        setModalOpen(true);
    };

    // Open modal for new pool creation
    const openCreatePoolModal = () => {
        setSelectedPool(undefined);
        setModalOpen(true);
    };

    // Helper to check if pool is in a category
    const STABLECOINS = ['USDC', 'USDT', 'USDC.N', 'DAI', 'FRAX', 'BUSD', 'LUSD', 'TUSD', 'UST', 'CUSD', 'IUSDC'];
    const isStablePool = (pool: typeof allPools[0]) => {
        if (pool.stable) return true;
        const symbols = [pool.token0.symbol, pool.token1.symbol].map(s => s.toUpperCase());
        return symbols.every(s => STABLECOINS.includes(s));
    };
    const isWindPool = (pool: typeof allPools[0]) => {
        return pool.token0.symbol.toUpperCase() === 'WIND' || pool.token1.symbol.toUpperCase() === 'WIND';
    };
    const isBtcPool = (pool: typeof allPools[0]) => {
        return pool.token0.symbol.toUpperCase().includes('BTC') || pool.token1.symbol.toUpperCase().includes('BTC');
    };
    const isEthPool = (pool: typeof allPools[0]) => {
        return pool.token0.symbol.toUpperCase().includes('ETH') || pool.token1.symbol.toUpperCase().includes('ETH');
    };

    // Filter pools
    const filteredPools = allPools.filter((pool) => {
        if (poolType === 'v2' && pool.poolType !== 'V2') return false;
        if (poolType === 'cl' && pool.poolType !== 'CL') return false;

        if (category === 'stable' && !isStablePool(pool)) return false;
        if (category === 'wind' && !isWindPool(pool)) return false;
        if (category === 'btc' && !isBtcPool(pool)) return false;
        if (category === 'eth' && !isEthPool(pool)) return false;
        if (category === 'other' && (isStablePool(pool) || isWindPool(pool) || isBtcPool(pool) || isEthPool(pool))) return false;

        if (search) {
            const searchLower = search.toLowerCase();
            const matchesToken = pool.token0.symbol.toLowerCase().includes(searchLower) ||
                pool.token1.symbol.toLowerCase().includes(searchLower);
            const matchesType = ('stable'.includes(searchLower) && pool.stable) ||
                ('volatile'.includes(searchLower) && pool.poolType === 'V2' && !pool.stable) ||
                (pool.poolType.toLowerCase().includes(searchLower));
            const matchesAddress = pool.address.toLowerCase().includes(searchLower);
            return matchesToken || matchesType || matchesAddress;
        }
        return true;
    });

    // Sort pools - Top pools first, then by volume by default
    const sortedPools = [...filteredPools].sort((a, b) => {
        const priorityA = TOP_POOL_PRIORITY[a.address.toLowerCase()] ?? 999;
        const priorityB = TOP_POOL_PRIORITY[b.address.toLowerCase()] ?? 999;

        if (priorityA !== priorityB) return priorityA - priorityB;

        if (sortBy === 'tvl') return parseFloat(b.tvl) - parseFloat(a.tvl);

        const volA = parseFloat(a.volume24h || '0');
        const volB = parseFloat(b.volume24h || '0');
        return volB - volA;
    });

    // Get fee tier string for CL pools
    const getFeeTier = (tickSpacing?: number) => {
        if (!tickSpacing) return '';
        return FEE_TIERS[tickSpacing] || `${tickSpacing}ts`;
    };

    const totalPoolCount = v2Pools.length + clPools.length;

    return (
        <div className="container mx-auto px-3 sm:px-6">
            {/* Row 1: Title + New Pool button */}
            <div className="flex items-center justify-between mb-3 sm:mb-4 animate-fade-up">
                <h1 className="text-xl sm:text-3xl font-bold">
                    <span className="gradient-text">Pools</span>
                    <span className="text-sm sm:text-base font-normal text-gray-400 ml-2">
                        {totalPoolCount > 0 && `(${totalPoolCount})`}
                    </span>
                </h1>
                <button
                    onClick={openCreatePoolModal}
                    className="btn-primary px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium"
                >
                    + New Pool
                </button>
            </div>

            {/* Row 2: Filters + Search */}
            <div className="flex items-center justify-between gap-2 mb-4 sm:mb-6">
                <div className="flex gap-2 items-center">
                    {/* Pool Type Toggle */}
                    <div className="glass p-0.5 rounded-lg inline-flex">
                        {[
                            { key: 'all' as PoolType, label: 'All' },
                            { key: 'v2' as PoolType, label: 'V2' },
                            { key: 'cl' as PoolType, label: 'V3' },
                        ].map((type) => (
                            <button
                                key={type.key}
                                onClick={() => setPoolType(type.key)}
                                className={`px-3 py-1.5 rounded-md font-medium transition text-xs sm:text-sm ${poolType === type.key
                                    ? type.key === 'cl'
                                        ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white'
                                        : 'bg-primary text-white'
                                    : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                {type.label}
                            </button>
                        ))}
                    </div>

                    {/* Sort & Category Dropdown */}
                    <select
                        value={category === 'all' ? sortBy : `cat_${category}`}
                        onChange={(e) => {
                            const val = e.target.value;
                            if (val.startsWith('cat_')) {
                                setCategory(val.replace('cat_', '') as Category);
                                setSortBy('default');
                            } else {
                                setCategory('all');
                                setSortBy(val as SortBy);
                            }
                        }}
                        className="px-2 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-white/5 border border-white/10 text-xs sm:text-sm outline-none focus:border-primary cursor-pointer text-white [&_option]:text-black [&_option]:bg-white [&_optgroup]:text-gray-600 [&_optgroup]:font-semibold"
                    >
                        <optgroup label="Sort">
                            <option value="default">Default</option>
                            <option value="tvl">By TVL</option>
                        </optgroup>
                        <optgroup label="Category">
                            <option value="cat_stable">Stable</option>
                            <option value="cat_wind">WIND</option>
                            <option value="cat_btc">BTC</option>
                            <option value="cat_eth">ETH</option>
                            <option value="cat_other">Other</option>
                        </optgroup>
                    </select>
                </div>

                {/* Search: icon on mobile, expands on tap */}
                <div className="flex items-center">
                    {searchOpen ? (
                        <div className="relative">
                            <svg className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onBlur={() => { if (!search) setSearchOpen(false); }}
                                placeholder="Search..."
                                autoFocus
                                className="w-36 sm:w-48 pl-8 pr-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm outline-none focus:border-primary"
                            />
                        </div>
                    ) : (
                        <button
                            onClick={() => setSearchOpen(true)}
                            className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white transition"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Pull to Refresh Indicator */}
            <div className="md:hidden flex justify-center items-center h-0 overflow-visible relative z-10">
                <div
                    className="absolute -top-8"
                    style={{
                        opacity: isPulling ? Math.min(pullProgress * 2, 1) : 0,
                        transform: `translateY(${Math.min(pullProgress * 40, 40)}px)`,
                    }}
                >
                    <div className={`w-8 h-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center ${isRefreshing ? 'animate-spin' : ''}`}>
                        <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </div>
                </div>
            </div>

            {/* Pool List */}
            <div
                ref={scrollContainerRef}
                {...handlers}
                style={{
                    transform: isPulling ? `translateY(${pullProgress * 40}px)` : undefined,
                    transition: isPulling ? 'none' : 'transform 0.3s ease-out',
                }}
            >
                {/* Desktop Table Header */}
                <div className="hidden md:block glass-card overflow-hidden">
                    <div className="grid grid-cols-12 gap-4 p-5 border-b border-white/5 text-sm text-gray-400 font-medium">
                        <div className="col-span-4">Pool</div>
                        <div className="col-span-2 text-center">APR</div>
                        <div className="col-span-2 text-center">24h Vol</div>
                        <div className="col-span-2 text-right">TVL</div>
                        <div className="col-span-2 text-center">Action</div>
                    </div>

                    {/* Desktop Table Body */}
                    {sortedPools.length === 0 ? (
                        <div className="p-12">
                            {isLoading ? (
                                <div className="text-center">
                                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                                    <p className="text-gray-400">Loading pools...</p>
                                </div>
                            ) : (
                                <EmptyState
                                    icon="🔍"
                                    title="No pools found"
                                    description="Try a different search term or clear filters"
                                />
                            )}
                        </div>
                    ) : (
                        sortedPools.map((pool) => {
                            const isTopPool = TOP_POOL_ADDRESSES[pool.address.toLowerCase()] ?? false;
                            const apr = poolAPRs.get(pool.address) ?? null;

                            return (
                                <div
                                    key={pool.address}
                                    className={`grid grid-cols-12 gap-4 p-5 border-b transition ${isTopPool
                                        ? 'border-l-4 border-l-green-500/60 border-b-white/5 bg-green-500/5'
                                        : 'border-white/5 hover:bg-white/5'
                                        }`}
                                >
                                    {/* Pool Info */}
                                    <div className="col-span-4 flex items-center gap-2">
                                        <div className="relative flex-shrink-0">
                                            {pool.token0.logoURI ? (
                                                <img src={pool.token0.logoURI} alt={pool.token0.symbol} className="w-10 h-10 rounded-full" />
                                            ) : (
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${pool.poolType === 'CL'
                                                    ? 'bg-gradient-to-br from-cyan-500 to-blue-500'
                                                    : 'bg-gradient-to-br from-primary to-secondary'
                                                    }`}>
                                                    {pool.token0.symbol[0]}
                                                </div>
                                            )}
                                            {pool.token1.logoURI ? (
                                                <img src={pool.token1.logoURI} alt={pool.token1.symbol} className="w-10 h-10 rounded-full absolute left-6 top-0 border-2 border-[var(--bg-primary)]" />
                                            ) : (
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold absolute left-6 top-0 border-2 border-[var(--bg-primary)] ${pool.poolType === 'CL'
                                                    ? 'bg-gradient-to-br from-blue-500 to-purple-500'
                                                    : 'bg-gradient-to-br from-secondary to-accent'
                                                    }`}>
                                                    {pool.token1.symbol[0]}
                                                </div>
                                            )}
                                        </div>
                                        <div className="ml-4 flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-lg truncate">
                                                    {pool.token0.symbol}/{pool.token1.symbol}
                                                </span>
                                                {isTopPool && (
                                                    <span className="text-yellow-400 text-sm">&#11088;</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1 text-xs">
                                                {pool.poolType === 'CL' && pool.tickSpacing && (
                                                    <span className="text-cyan-400">{getFeeTier(pool.tickSpacing)}</span>
                                                )}
                                                {pool.poolType === 'V2' && (
                                                    <span className="text-gray-500">{pool.stable ? 'Stable' : 'Volatile'}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* APR */}
                                    <div className="col-span-2 flex flex-col items-center justify-center gap-1">
                                        {apr !== null && apr > 0 ? (
                                            <div className="flex flex-col items-center">
                                                <span className="text-[10px] text-gray-500 leading-none mb-0.5">Staked</span>
                                                <span className="text-sm font-bold text-green-400">{formatAPR(apr)}</span>
                                            </div>
                                        ) : null}
                                        {pool.feeAPR !== undefined && pool.feeAPR > 0 ? (
                                            <div className="flex flex-col items-center">
                                                <span className="text-[10px] text-gray-500 leading-none mb-0.5">Unstaked</span>
                                                <span className="text-xs font-semibold text-blue-400">{pool.feeAPR < 0.01 ? '<0.01' : pool.feeAPR.toFixed(2)}%</span>
                                            </div>
                                        ) : null}
                                        {(apr === null || apr === 0) && (!pool.feeAPR || pool.feeAPR === 0) && (
                                            <span className="text-sm font-medium text-gray-500">&mdash;</span>
                                        )}
                                    </div>

                                    {/* 24h Volume */}
                                    <div className="col-span-2 flex items-center justify-center">
                                        {pool.volume24h && parseFloat(pool.volume24h) > 0.01 ? (
                                            <span className="text-sm font-medium">
                                                ${parseFloat(pool.volume24h).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </span>
                                        ) : (
                                            <span className="text-sm font-medium text-gray-500">&mdash;</span>
                                        )}
                                    </div>

                                    {/* TVL */}
                                    <div className="col-span-2 flex items-center justify-end">
                                        {parseFloat(pool.tvl) > 0 ? (
                                            <span className="text-sm font-semibold">
                                                ${parseFloat(pool.tvl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </span>
                                        ) : (
                                            <span className="text-sm text-gray-500">New Pool</span>
                                        )}
                                    </div>

                                    {/* Action */}
                                    <div className="col-span-2 flex items-center justify-center">
                                        <button
                                            onClick={() => openAddLiquidityModal(pool)}
                                            className={`px-4 py-2 rounded-xl font-medium text-sm transition-all hover:scale-[1.02] active:scale-[0.98] ${pool.poolType === 'CL'
                                                ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 hover:from-cyan-500/30 hover:to-blue-500/30'
                                                : 'bg-gradient-to-r from-primary/20 to-secondary/20 text-primary hover:from-primary/30 hover:to-secondary/30'
                                                }`}
                                        >
                                            + Add LP
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden flex flex-col gap-2">
                    {sortedPools.length === 0 ? (
                        <div className="glass-card p-10">
                            {isLoading ? (
                                <div className="text-center">
                                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                                    <p className="text-gray-400">Loading pools...</p>
                                </div>
                            ) : (
                                <EmptyState
                                    icon="🔍"
                                    title="No pools found"
                                    description="Try a different search term or clear filters"
                                />
                            )}
                        </div>
                    ) : (
                        sortedPools.map((pool) => {
                            const isTopPool = TOP_POOL_ADDRESSES[pool.address.toLowerCase()] ?? false;
                            const apr = poolAPRs.get(pool.address) ?? null;
                            const tvl = parseFloat(pool.tvl);
                            const vol = parseFloat(pool.volume24h || '0');

                            return (
                                <div
                                    key={pool.address}
                                    onClick={() => openAddLiquidityModal(pool)}
                                    className={`rounded-xl border bg-white/[0.03] p-3.5 active:bg-white/[0.06] transition-colors cursor-pointer ${isTopPool
                                        ? 'border-l-4 border-l-green-500/60 border-t-white/10 border-r-white/10 border-b-white/10'
                                        : 'border-white/10'
                                        }`}
                                >
                                    {/* Top row: logos, pair, fee, badge */}
                                    <div className="flex items-center gap-2.5 mb-2">
                                        {/* Overlapping token logos */}
                                        <div className="relative flex-shrink-0 w-[38px] h-[26px]">
                                            {pool.token0.logoURI ? (
                                                <img src={pool.token0.logoURI} alt={pool.token0.symbol} className="w-[26px] h-[26px] rounded-full absolute left-0 top-0" />
                                            ) : (
                                                <div className={`w-[26px] h-[26px] rounded-full flex items-center justify-center text-[10px] font-bold absolute left-0 top-0 ${pool.poolType === 'CL'
                                                    ? 'bg-gradient-to-br from-cyan-500 to-blue-500'
                                                    : 'bg-gradient-to-br from-primary to-secondary'
                                                    }`}>
                                                    {pool.token0.symbol[0]}
                                                </div>
                                            )}
                                            {pool.token1.logoURI ? (
                                                <img src={pool.token1.logoURI} alt={pool.token1.symbol} className="w-[26px] h-[26px] rounded-full absolute left-[14px] top-0 border-2 border-[var(--bg-primary)]" />
                                            ) : (
                                                <div className={`w-[26px] h-[26px] rounded-full flex items-center justify-center text-[10px] font-bold absolute left-[14px] top-0 border-2 border-[var(--bg-primary)] ${pool.poolType === 'CL'
                                                    ? 'bg-gradient-to-br from-blue-500 to-purple-500'
                                                    : 'bg-gradient-to-br from-secondary to-accent'
                                                    }`}>
                                                    {pool.token1.symbol[0]}
                                                </div>
                                            )}
                                        </div>

                                        <span className="font-bold text-sm truncate">
                                            {pool.token0.symbol}/{pool.token1.symbol}
                                        </span>

                                        {/* Fee tier pill */}
                                        {pool.poolType === 'CL' && pool.tickSpacing ? (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400">
                                                {getFeeTier(pool.tickSpacing)}
                                            </span>
                                        ) : pool.poolType === 'V2' ? (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-gray-500">
                                                {pool.stable ? 'Stable' : 'V2'}
                                            </span>
                                        ) : null}

                                        {isTopPool && (
                                            <span className="text-yellow-400 text-xs ml-auto">&#11088;</span>
                                        )}
                                    </div>

                                    {/* Stats row: TVL + Volume inline */}
                                    <div className="text-xs text-gray-400 mb-2.5 pl-0.5">
                                        {tvl > 0 && <span>TVL {formatCompact(tvl)}</span>}
                                        {tvl > 0 && vol > 0.01 && <span className="mx-1.5">&middot;</span>}
                                        {vol > 0.01 && <span>Vol {formatCompact(vol)}</span>}
                                        {tvl <= 0 && vol <= 0.01 && <span className="text-gray-500">New Pool</span>}
                                    </div>

                                    {/* Bottom row: APR + Add LP button */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {apr !== null && apr > 0 ? (
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-gray-500">Staked</span>
                                                    <span className="text-sm font-bold text-green-400">{formatAPR(apr)}</span>
                                                </div>
                                            ) : null}
                                            {apr !== null && apr > 0 && pool.feeAPR !== undefined && pool.feeAPR > 0 && (
                                                <span className="text-gray-600 text-xs">|</span>
                                            )}
                                            {pool.feeAPR !== undefined && pool.feeAPR > 0 ? (
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-gray-500">Unstaked</span>
                                                    <span className="text-sm font-semibold text-blue-400">{pool.feeAPR < 0.01 ? '<0.01' : pool.feeAPR.toFixed(2)}%</span>
                                                </div>
                                            ) : null}
                                            {(apr === null || apr === 0) && (!pool.feeAPR || pool.feeAPR === 0) && (
                                                <span className="text-sm text-gray-500">&mdash;</span>
                                            )}
                                        </div>

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openAddLiquidityModal(pool);
                                            }}
                                            className="px-3.5 py-1.5 rounded-lg font-semibold text-xs bg-gradient-to-r from-cyan-500 to-blue-500 text-white"
                                        >
                                            Add LP
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Add Liquidity Modal */}
            <AddLiquidityModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                initialPool={selectedPool}
            />
        </div>
    );
}
