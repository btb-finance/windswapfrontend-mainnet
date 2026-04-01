'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Address, encodeFunctionData, decodeFunctionResult } from 'viem';
import { useAccount } from 'wagmi';
import { DEFAULT_TOKEN_LIST, WETH } from '@/config/tokens';
import { useWindPrice as useWindPriceHook } from '@/hooks/useWindPrice';
import { useUserPositions } from '@/hooks/useSubgraph';
import { getRpcForUserData, rpcCall } from '@/utils/rpc';
import { V2_CONTRACTS, NOTABLE_POOLS, NOTABLE_GAUGES } from '@/config/contracts';
import { SUBGRAPH_URL, SUBGRAPH_HEADERS } from '@/config/subgraph';

interface SubgraphGauge {
    id: string;
    pool?: {
        id?: string;
        token0?: { id?: string; symbol?: string; decimals?: number };
        token1?: { id?: string; symbol?: string; decimals?: number };
        stable?: boolean;
        isV3?: boolean;
        tickSpacing?: number;
    };
    weight?: string;
    rewardRate?: string;
    totalStakedLiquidity?: string;
    bribeReward?: string;
    gaugeType?: string;
    isActive?: boolean;
    feeVotingReward?: string;
    bribeVotingReward?: string;
    epochData?: Array<{ epoch?: string; feeRewardToken0?: string; feeRewardToken1?: string; totalBribes?: string; emissions?: string }>;
    epochBribes?: Array<{ token?: { id?: string; symbol?: string; decimals?: number }; totalAmount?: string; totalAmountUSD?: string }>;
    rewardTokens?: Array<{ token?: { id?: string; symbol?: string; decimals?: string }; rewardRate?: string }>;
    claimableRewards?: string;
    externalBribes?: string;
    internalBribes?: string;
}

// Fetch pools from subgraph
async function fetchPoolsFromSubgraph(): Promise<{
    pools: Array<{
        id: string;
        token0: { id: string; symbol: string; decimals: number };
        token1: { id: string; symbol: string; decimals: number };
        tickSpacing: number;
        totalValueLockedUSD: string;
        totalValueLockedToken0: string;
        totalValueLockedToken1: string;
        liquidity: string;
        volumeUSD: string;
        poolDayData: Array<{
            date: number;
            volumeUSD: string;
        }>;
    }>;
    ethPrice: number;
} | null> {
    try {
        const response = await fetch(SUBGRAPH_URL, {
            method: 'POST',
            headers: SUBGRAPH_HEADERS,
            body: JSON.stringify({
                query: `{
                    bundles(first: 1) { ethPrice }
                    pools(first: 100, orderBy: liquidity, orderDirection: desc, where: { tickSpacing_in: [1, 2, 3, 4, 5] }) {
                        id
                        token0 { id symbol decimals }
                        token1 { id symbol decimals }
                        tickSpacing
                        totalValueLockedUSD
                        totalValueLockedToken0
                        totalValueLockedToken1
                        liquidity
                        volumeUSD
                        poolDayData(first: 1, orderBy: date, orderDirection: desc) {
                            date
                            volumeUSD
                        }
                    }
                }`
            }),
        });
        const json = await response.json();
        if (json.errors) {
            console.warn('[Subgraph] Query errors:', json.errors);
            return null;
        }
        const ethPrice = parseFloat(json.data?.bundles?.[0]?.ethPrice || '0');
        return { pools: json.data?.pools || [], ethPrice };
    } catch (err) {
        console.warn('[Subgraph] Fetch error:', err);
        return null;
    }
}

const PRIORITY_POOL = ((NOTABLE_POOLS as Record<string, string>).WIND_WSEI || '').toLowerCase();
const PRIORITY_GAUGE = ((NOTABLE_GAUGES as Record<string, string>).WIND_WSEI || '').toLowerCase();

// ============================================
// Types
// ============================================
interface TokenInfo {
    address: Address;
    symbol: string;
    decimals: number;
    logoURI?: string;
}

interface PoolData {
    address: Address;
    token0: TokenInfo;
    token1: TokenInfo;
    poolType: 'V2' | 'CL';
    stable?: boolean;
    tickSpacing?: number;
    reserve0: string;
    reserve1: string;
    tvl: string;
    volume24h?: string;
    liquidity?: string;
    rewardRate?: bigint;
}

// Gauge/Voting Types
export interface RewardToken {
    address: Address;
    symbol: string;
    amount: bigint;
    decimals: number;
}

export interface IncentiveToken {
    address: Address;
    symbol: string;
    decimals: number;
    amount: number;       // token amount
    amountUSD: number;    // USD value
}

export interface GaugeInfo {
    pool: Address;
    gauge: Address;
    token0: Address;
    token1: Address;
    symbol0: string;
    symbol1: string;
    poolType: 'V2' | 'CL';
    isStable: boolean;
    weight: bigint;
    weightPercent: number;
    isAlive: boolean;
    feeReward: Address;
    bribeReward: Address;
    rewardTokens: RewardToken[];
    incentives: IncentiveToken[];
    totalBribesUSD: number;
}

export interface StakedPosition {
    tokenId: bigint;
    gaugeAddress: string;
    poolAddress: string;
    token0: string;
    token1: string;
    token0Symbol: string;
    token1Symbol: string;
    token0Decimals: number;
    token1Decimals: number;
    tickSpacing: number;
    tickLower: number;
    tickUpper: number;
    currentTick: number;
    liquidity: bigint;
    pendingRewards: bigint;
    rewardRate: bigint;
    token0PriceUSD: number;
    token1PriceUSD: number;
    amountUSD: number;
    depositedUSD: number;
    withdrawnUSD: number;
    collectedUSD: number;
    totalWindEarned: number;
}

export interface VeNFT {
    tokenId: bigint;
    amount: bigint;          // locked amount (renamed from lockedAmount for consistency)
    end: bigint;             // lock end timestamp
    isPermanent: boolean;    // permanent lock flag
    votingPower: bigint;
    claimable: bigint;       // claimable rebases
    hasVoted: boolean;       // whether veNFT has voted this epoch (blocks unlock/merge)
    lastVotedEpoch: bigint;  // epoch count when last voted (compare with protocol.epochCount)
}

export interface UserProfileAnalytics {
    id: string;
    totalPositionsValueUSD: number;
    totalStakedValueUSD: number;
    totalVeNFTValueUSD: number;
    totalRewardsClaimedUSD: number;
    totalFeesEarnedUSD: number;
    totalSwaps: number;
    totalProvides: number;
    totalWithdraws: number;
    firstActivityTimestamp: bigint;
    lastActivityTimestamp: bigint;
}

interface PoolDataContextType {
    v2Pools: PoolData[];
    clPools: PoolData[];
    allPools: PoolData[];
    tokenInfoMap: Map<string, TokenInfo>;
    poolRewards: Map<string, bigint>;
    // Staked liquidity for accurate APR calculation
    stakedLiquidity: Map<string, bigint>;
    // Prices for APR calculation (loaded with priority pool)
    windPrice: number;
    seiPrice: number;
    // Gauge/Voting data
    gauges: GaugeInfo[];
    totalVoteWeight: bigint;
    epochCount: bigint;
    activePeriod: bigint;
    gaugesLoading: boolean;
    // Staked positions (prefetched for portfolio)
    stakedPositions: StakedPosition[];
    stakedLoading: boolean;
    refetchStaked: () => void;
    removeStakedPosition: (tokenId: bigint, gaugeAddress: string) => void;
    // VeNFT data (prefetched for portfolio and vote)
    veNFTs: VeNFT[];
    veNFTsLoading: boolean;
    refetchVeNFTs: () => void;
    userProfile: UserProfileAnalytics | null;
    isLoading: boolean;
    refetch: () => void;
    getTokenInfo: (address: string) => TokenInfo | undefined;
}

const PoolDataContext = createContext<PoolDataContextType | undefined>(undefined);

// Build KNOWN_TOKENS from the global DEFAULT_TOKEN_LIST - single source of truth!
const KNOWN_TOKENS: Record<string, { symbol: string; decimals: number; logoURI?: string }> = {};
for (const token of DEFAULT_TOKEN_LIST) {
    // Use lowercase address as key for easy lookup
    KNOWN_TOKENS[token.address.toLowerCase()] = {
        symbol: token.symbol,
        decimals: token.decimals,
        logoURI: token.logoURI,
    };
}
// Also add WETH explicitly (some pools use WETH address directly)
KNOWN_TOKENS[WETH.address.toLowerCase()] = {
    symbol: WETH.symbol,
    decimals: WETH.decimals,
    logoURI: WETH.logoURI,
};

// ============================================
// Provider Component
// ============================================
const CACHE_KEY = 'windswap_pool_cache';
const CACHE_EXPIRY = 60 * 60 * 1000; // 1 hour

// Helper to load from localStorage
function loadCachedPools(): { clPools: PoolData[]; v2Pools: PoolData[]; timestamp: number } | null {
    if (typeof window === 'undefined') return null;
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const data = JSON.parse(cached);
            // Check if cache is still valid (less than 1 hour old)
            if (Date.now() - data.timestamp < CACHE_EXPIRY) {
                // Loading from cache
                return data;
            }
        }
    } catch (e) {
        console.warn('[PoolDataProvider] Cache read error');
    }
    return null;
}

// Helper to save to localStorage
function saveCachePools(clPools: PoolData[], v2Pools: PoolData[]) {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            clPools,
            v2Pools,
            timestamp: Date.now()
        }));
        // Saved to cache
    } catch (e) {
        console.warn('[PoolDataProvider] Cache write error');
    }
}

export function PoolDataProvider({ children }: { children: ReactNode }) {
    const { address } = useAccount();
    const [v2Pools, setV2Pools] = useState<PoolData[]>([]);
    const [clPools, setClPools] = useState<PoolData[]>([]);
    const [tokenInfoMap, setTokenInfoMap] = useState<Map<string, TokenInfo>>(new Map());
    const [poolRewards, setPoolRewards] = useState<Map<string, bigint>>(new Map());
    const [stakedLiquidity, setStakedLiquidity] = useState<Map<string, bigint>>(new Map());
    const [isLoading, setIsLoading] = useState(true);

    // Prices from subgraph hook
    const { windPrice, seiPrice } = useWindPriceHook();

    // Gauge/Voting state
    const [gauges, setGauges] = useState<GaugeInfo[]>([]);
    const [totalVoteWeight, setTotalVoteWeight] = useState<bigint>(BigInt(0));
    const [epochCount, setEpochCount] = useState<bigint>(BigInt(0));
    const [activePeriod, setActivePeriod] = useState<bigint>(BigInt(0));
    const [gaugesLoading, setGaugesLoading] = useState(true);

    // ============================================
    // SUBGRAPH-BASED USER DATA (replaces RPC fetching)
    // ============================================
    const {
        positions: subgraphPositions,
        veNFTs: subgraphVeNFTs,
        stakedPositions: subgraphStaked,
        profile: subgraphProfile,
        isLoading: userDataLoading,
        refetch: refetchUserData
    } = useUserPositions(address);

    // Do NOT intersect staked positions with `positions(first: 50)`.
    // Many wallets have far more than 50 positions; intersecting causes almost all staked NFTs to disappear.
    // Instead, rely on the staked flag carried on the staked position's linked `position`.
    const filteredSubgraphStaked = (subgraphStaked || []).filter(sp => {
        // Most reliable: linked position.staked
        if (sp?.position && typeof (sp.position as any).staked === 'boolean') return (sp.position as any).staked;
        // Fallback: keep active rows if position link missing
        return !!sp?.isActive;
    });

    // RPC earned() calls for live pending rewards
    // Subgraph earned is only a snapshot at last event; on-chain earned() accrues in real-time
    const rpcEarnedKey = filteredSubgraphStaked
        .map(sp => `${String(sp.gauge?.id || '').toLowerCase()}-${String(sp.tokenId || '')}`)
        .sort()
        .join('|');

    const [rpcEarnedMap, setRpcEarnedMap] = useState<Map<string, bigint>>(new Map());

    useEffect(() => {
        let cancelled = false;
        const FIVE_MINUTES = 5 * 60 * 1000;

        const fetchEarnedFromRpc = async () => {
            if (!address || !filteredSubgraphStaked || filteredSubgraphStaked.length === 0) {
                setRpcEarnedMap(new Map());
                return;
            }

            const rpc = getRpcForUserData();
            const earnedAbi = [
                {
                    inputs: [
                        { name: 'account', type: 'address' },
                        { name: 'tokenId', type: 'uint256' },
                    ],
                    name: 'earned',
                    outputs: [{ name: '', type: 'uint256' }],
                    stateMutability: 'view',
                    type: 'function',
                },
            ] as const;

            const calls = filteredSubgraphStaked
                .map(sp => ({
                    gauge: String(sp.gauge?.id || ''),
                    tokenId: sp.tokenId ? BigInt(sp.tokenId) : BigInt(0),
                }))
                .filter(x => x.gauge && x.tokenId > BigInt(0));

            try {
                const results = await Promise.all(calls.map(async (c, i) => {
                    const data = encodeFunctionData({
                        abi: earnedAbi,
                        functionName: 'earned',
                        args: [address as Address, c.tokenId],
                    });

                    const res = await fetch(rpc, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            jsonrpc: '2.0',
                            id: i + 1,
                            method: 'eth_call',
                            params: [{ to: c.gauge, data }, 'latest'],
                        }),
                    });

                    const json = await res.json();
                    if (json?.error) {
                        return { key: `${c.gauge.toLowerCase()}-${c.tokenId.toString()}`, earned: BigInt(0) };
                    }

                    const decoded = decodeFunctionResult({
                        abi: earnedAbi,
                        functionName: 'earned',
                        data: json.result,
                    });

                    return { key: `${c.gauge.toLowerCase()}-${c.tokenId.toString()}`, earned: decoded as bigint };
                }));

                if (cancelled) return;
                const next = new Map<string, bigint>();
                results.forEach(r => next.set(r.key, r.earned));
                setRpcEarnedMap(next);
            } catch (err) {
                console.warn('[PoolDataProvider] RPC earned() fetch error:', err);
                if (!cancelled) setRpcEarnedMap(new Map());
            }
        };

        fetchEarnedFromRpc();
        const interval = setInterval(() => {
            if (document.visibilityState !== 'hidden') fetchEarnedFromRpc();
        }, FIVE_MINUTES);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [address, rpcEarnedKey]);

    const userProfile: UserProfileAnalytics | null = subgraphProfile ? {
        id: String(subgraphProfile.id),
        totalPositionsValueUSD: parseFloat(subgraphProfile.totalPositionsValueUSD || '0') || 0,
        totalStakedValueUSD: parseFloat(subgraphProfile.totalStakedValueUSD || '0') || 0,
        totalVeNFTValueUSD: parseFloat(subgraphProfile.totalVeNFTValueUSD || '0') || 0,
        totalRewardsClaimedUSD: parseFloat(subgraphProfile.totalRewardsClaimedUSD || '0') || 0,
        totalFeesEarnedUSD: parseFloat(subgraphProfile.totalFeesEarnedUSD || '0') || 0,
        totalSwaps: Number(subgraphProfile.totalSwaps || 0),
        totalProvides: Number(subgraphProfile.totalProvides || 0),
        totalWithdraws: Number(subgraphProfile.totalWithdraws || 0),
        firstActivityTimestamp: BigInt(subgraphProfile.firstActivityTimestamp || '0'),
        lastActivityTimestamp: BigInt(subgraphProfile.lastActivityTimestamp || '0'),
    } : null;

    // Helper to convert decimal string to wei (BigInt)
    const toWei = (value: string | undefined): bigint => {
        if (!value) return BigInt(0);
        const num = parseFloat(value);
        if (isNaN(num)) return BigInt(0);
        // Convert to wei (18 decimals)
        return BigInt(Math.floor(num * 1e18));
    };

    const permanentVeNftTokenIdsNeedingRpc = (subgraphVeNFTs || [])
        .filter(nft => {
            if (!nft?.isPermanent) return false;
            const vp = parseFloat(String(nft.votingPower || '0'));
            return !Number.isFinite(vp) || vp <= 0;
        })
        .map(nft => BigInt(nft.tokenId))
        .filter(id => id > BigInt(0))
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

    const permanentVeNftRpcKey = permanentVeNftTokenIdsNeedingRpc.map(x => x.toString()).join('|');
    const [permanentVeNftVotingPowerMap, setPermanentVeNftVotingPowerMap] = useState<Map<string, bigint>>(new Map());

    useEffect(() => {
        let cancelled = false;
        const FIVE_MINUTES = 5 * 60 * 1000;

        const fetchPermanentVotingPowerFromRpc = async () => {
            if (!address || permanentVeNftTokenIdsNeedingRpc.length === 0) {
                setPermanentVeNftVotingPowerMap(new Map());
                return;
            }

            const rpc = getRpcForUserData();
            const balanceOfNftAbi = [
                {
                    inputs: [{ name: 'tokenId', type: 'uint256' }],
                    name: 'balanceOfNFT',
                    outputs: [{ name: '', type: 'uint256' }],
                    stateMutability: 'view',
                    type: 'function',
                },
            ] as const;

            try {
                const results = await Promise.all(permanentVeNftTokenIdsNeedingRpc.map(async (tokenId, i) => {
                    const data = encodeFunctionData({
                        abi: balanceOfNftAbi,
                        functionName: 'balanceOfNFT',
                        args: [tokenId],
                    });

                    const res = await fetch(rpc, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            jsonrpc: '2.0',
                            id: i + 1,
                            method: 'eth_call',
                            params: [{ to: V2_CONTRACTS.VotingEscrow as Address, data }, 'latest'],
                        }),
                    });

                    const json = await res.json();
                    if (json?.error || !json?.result) {
                        return { tokenId, votingPower: BigInt(0) };
                    }

                    const decoded = decodeFunctionResult({
                        abi: balanceOfNftAbi,
                        functionName: 'balanceOfNFT',
                        data: json.result,
                    });

                    return { tokenId, votingPower: decoded as bigint };
                }));

                if (cancelled) return;
                const next = new Map<string, bigint>();
                results.forEach(r => next.set(r.tokenId.toString(), r.votingPower));
                setPermanentVeNftVotingPowerMap(next);
            } catch (err) {
                console.warn('[PoolDataProvider] RPC balanceOfNFT fetch error:', err);
                if (!cancelled) setPermanentVeNftVotingPowerMap(new Map());
            }
        };

        fetchPermanentVotingPowerFromRpc();
        const interval = setInterval(() => {
            if (document.visibilityState !== 'hidden') fetchPermanentVotingPowerFromRpc();
        }, FIVE_MINUTES);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [address, permanentVeNftRpcKey]);

    const toBigIntSafe = (value: string | undefined): bigint => {
        if (!value) return BigInt(0);
        // Subgraph sometimes returns BigDecimal strings; BigInt("0.1") throws.
        return value.includes('.') ? toWei(value) : BigInt(value);
    };

    // Transform subgraph veNFT data to provider format
    const veNFTs: VeNFT[] = subgraphVeNFTs.map(nft => ({
        tokenId: BigInt(nft.tokenId),
        amount: toWei(nft.lockedAmount),
        end: BigInt(nft.lockEnd || '0'),
        isPermanent: nft.isPermanent,
        votingPower: (nft.isPermanent && toWei(nft.votingPower) === BigInt(0))
            ? (permanentVeNftVotingPowerMap.get(String(nft.tokenId)) ?? BigInt(0))
            : toWei(nft.votingPower),
        claimable: toWei(nft.claimableRewards),
        hasVoted: nft.hasVoted,
        lastVotedEpoch: BigInt(nft.lastVotedEpoch || '0'),
    }));

    // Transform subgraph staked position data to provider format
    // Uses RPC earned() for live pending rewards, subgraph for position data
    const stakedPositions: StakedPosition[] = filteredSubgraphStaked.map(sp => {
        const gauge = sp.gauge;
        const pool = gauge?.pool;
        const known0 = pool?.token0 ? KNOWN_TOKENS[pool.token0.id.toLowerCase()] : null;
        const known1 = pool?.token1 ? KNOWN_TOKENS[pool.token1.id.toLowerCase()] : null;

        const tokenId = BigInt(sp.tokenId || '0');
        const gaugeId = String(gauge?.id || '').toLowerCase();
        const earnedKey = `${gaugeId}-${tokenId.toString()}`;
        const earnedFromRpc = rpcEarnedMap.get(earnedKey) ?? BigInt(0);

        return {
            tokenId,
            gaugeAddress: gauge?.id as Address || '' as Address,
            poolAddress: pool?.id as Address || '' as Address,
            token0: pool?.token0?.id as Address || '' as Address,
            token1: pool?.token1?.id as Address || '' as Address,
            token0Symbol: known0?.symbol || pool?.token0?.symbol || 'UNK',
            token1Symbol: known1?.symbol || pool?.token1?.symbol || 'UNK',
            token0Decimals: pool?.token0?.decimals || known0?.decimals || 18,
            token1Decimals: pool?.token1?.decimals || known1?.decimals || 18,
            tickSpacing: pool?.tickSpacing || 0,
            tickLower: sp.tickLower ?? sp.position?.tickLower ?? 0,
            tickUpper: sp.tickUpper ?? sp.position?.tickUpper ?? 0,
            currentTick: pool?.tick || 0,
            liquidity: toBigIntSafe(sp.position?.liquidity || sp.amount || '0'),
            pendingRewards: earnedFromRpc,
            rewardRate: BigInt(0),
            token0PriceUSD: pool?.token0?.priceUSD ? parseFloat(pool.token0.priceUSD) : 0,
            token1PriceUSD: pool?.token1?.priceUSD ? parseFloat(pool.token1.priceUSD) : 0,
            amountUSD: sp.position?.amountUSD ? parseFloat(sp.position.amountUSD) : 0,
            depositedUSD: sp.position?.depositedUSD ? parseFloat(sp.position.depositedUSD) : 0,
            withdrawnUSD: sp.position?.withdrawnUSD ? parseFloat(sp.position.withdrawnUSD) : 0,
            collectedUSD: sp.position?.collectedUSD ? parseFloat(sp.position.collectedUSD) : 0,
            totalWindEarned: sp.position?.totalWindEarned ? parseFloat(sp.position.totalWindEarned) : 0,
        };
    });

    // Sync loading states
    const stakedLoading = userDataLoading;
    const veNFTsLoading = userDataLoading;

    const fetchAllData = useCallback(async () => {
        setIsLoading(true);
        setGaugesLoading(true);
        try {
            // Step 0: Try loading from localStorage cache FIRST (instant!)
            const cached = loadCachedPools();
            if (cached && cached.clPools.length > 0) {
                setClPools(cached.clPools);
                setV2Pools(cached.v2Pools);
                setIsLoading(false); // Show cached data immediately!
                // Loaded pools from cache
            }

            // Step 1: Try fetching from SUBGRAPH (primary source - all pools!)
            // Fetching from subgraph
            const subgraphData = await fetchPoolsFromSubgraph();

            if (subgraphData && subgraphData.pools.length > 0) {
                // Got pools from subgraph

                // Convert subgraph pools to PoolData format
                const subgraphPools: PoolData[] = subgraphData.pools.map(p => {
                    const known0 = KNOWN_TOKENS[p.token0.id.toLowerCase()];
                    const known1 = KNOWN_TOKENS[p.token1.id.toLowerCase()];

                    // Parse TVL - subgraph only tracks USD for tokens with known prices.
                    // For pairs like USDC/WIND, it only values the USDC side.
                    // We estimate full TVL by doubling the known-price side (balanced pool assumption).
                    const WETH_ADDRESS = '0x4200000000000000000000000000000000000006';
                    const STABLECOIN_ADDRESSES = ['0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2']; // USDC, USDT
                    const t0Addr = p.token0.id.toLowerCase();
                    const t1Addr = p.token1.id.toLowerCase();
                    const token0IsETH = t0Addr === WETH_ADDRESS.toLowerCase();
                    const token1IsETH = t1Addr === WETH_ADDRESS.toLowerCase();
                    const token0IsStable = STABLECOIN_ADDRESSES.includes(t0Addr);
                    const token1IsStable = STABLECOIN_ADDRESSES.includes(t1Addr);
                    const t0Locked = parseFloat(p.totalValueLockedToken0 || '0');
                    const t1Locked = parseFloat(p.totalValueLockedToken1 || '0');

                    let tvl = parseFloat(p.totalValueLockedUSD || '0');

                    if (token0IsETH || token1IsETH) {
                        // ETH pair: value ETH side * ethPrice * 2
                        const ethLocked = token0IsETH ? t0Locked : t1Locked;
                        if (ethLocked > 0 && subgraphData.ethPrice > 0) {
                            tvl = ethLocked * subgraphData.ethPrice * 2;
                        }
                    } else if ((token0IsStable || token1IsStable) && !(token0IsStable && token1IsStable)) {
                        // One-sided stablecoin pair (e.g. USDC/WIND): double the stablecoin side
                        const stableLocked = token0IsStable ? t0Locked : t1Locked;
                        if (stableLocked > 0) {
                            tvl = stableLocked * 2;
                        }
                    }

                    // Approx. 24h volume from latest PoolDayData (UTC day bucket)
                    const latestDay = p.poolDayData && p.poolDayData.length > 0 ? p.poolDayData[0] : undefined;
                    const rawVolume24h = latestDay ? parseFloat(latestDay.volumeUSD || '0') : 0;
                    // Guardrail: some pools can have corrupted/overflowed subgraph volumeUSD.
                    // If volume is non-finite or absurdly large, treat as unknown.
                    const volume24h = (!isFinite(rawVolume24h) || rawVolume24h < 0 || rawVolume24h > 1e12)
                        ? 0
                        : rawVolume24h;

                    const sym0 = (known0?.symbol || p.token0.symbol).toUpperCase();
                    const sym1 = (known1?.symbol || p.token1.symbol).toUpperCase();
                    const STABLES = ['USDC', 'USDT', 'USDT0', 'USDC.N', 'DAI', 'FRAX', 'BUSD', 'LUSD', 'TUSD', 'CUSD', 'IUSDC'];
                    const isStable = STABLES.includes(sym0) && STABLES.includes(sym1);

                    return {
                        address: p.id as Address,
                        token0: {
                            address: p.token0.id as Address,
                            symbol: known0?.symbol || p.token0.symbol,
                            decimals: known0?.decimals || p.token0.decimals,
                            logoURI: known0?.logoURI,
                        },
                        token1: {
                            address: p.token1.id as Address,
                            symbol: known1?.symbol || p.token1.symbol,
                            decimals: known1?.decimals || p.token1.decimals,
                            logoURI: known1?.logoURI,
                        },
                        poolType: 'CL' as const,
                        stable: isStable,
                        tickSpacing: typeof p.tickSpacing === 'number' ? p.tickSpacing : parseInt(String(p.tickSpacing)) || 0,
                        reserve0: '0', // Subgraph doesn't give individual reserves
                        reserve1: '0',
                        tvl: tvl > 0 ? tvl.toFixed(2) : '0',
                        liquidity: p.liquidity || '0',
                        volume24h: volume24h > 0 ? volume24h.toFixed(2) : undefined,
                    };
                });

                // Set pools from subgraph (for immediate display - priority pool first!)
                setClPools(subgraphPools);
                setIsLoading(false);
                // Showing pools from subgraph

                // Build token map from subgraph data
                const newTokenMap = new Map<string, TokenInfo>();
                subgraphPools.forEach(p => {
                    newTokenMap.set(p.token0.address.toLowerCase(), p.token0);
                    newTokenMap.set(p.token1.address.toLowerCase(), p.token1);
                });
                setTokenInfoMap(newTokenMap);

                // Fetch gauge data for voting (in parallel with priority fetch)
                await fetchGaugeData(newTokenMap);

                // Save subgraph pools to cache
                saveCachePools(subgraphPools, []);

                return; // Done!
            }

            // No subgraph data
            setClPools([]);
            setV2Pools([]);
            setTokenInfoMap(new Map());
            setIsLoading(false);
            setGaugesLoading(false);
        } catch (err) {
            console.error('[PoolDataProvider] Fetch error:', err);
            setIsLoading(false);
            setGaugesLoading(false);
        }
    }, []);

    // Fetch gauge/voting data from Goldsky subgraph (read-only)
    const fetchGaugeData = useCallback(async (_tokenMap: Map<string, TokenInfo>) => {
        try {
            const query = `query VoteData {
                protocol(id: "windswap") {
                    totalVotingWeight
                    epochCount
                    activePeriod
                }
                gauges(first: 1000, where: { isActive: true, pool_: { tickSpacing_in: [1, 2, 3, 4, 5] } }) {
                    id
                    pool { id token0 { id symbol decimals } token1 { id symbol decimals } tickSpacing }
                    gaugeType
                    weight
                    rewardRate
                    totalStakedLiquidity
                    isActive
                    feeVotingReward
                    bribeVotingReward
                    epochData(first: 1, orderBy: epoch, orderDirection: desc) {
                        epoch
                        feeRewardToken0
                        feeRewardToken1
                        totalBribes
                        emissions
                    }
                }
                gaugeEpochBribes(first: 100, orderBy: totalAmountUSD, orderDirection: desc) {
                    gauge { id }
                    epoch
                    token { id symbol decimals }
                    totalAmount
                    totalAmountUSD
                }
            }`;

            const response = await fetch(SUBGRAPH_URL, {
                method: 'POST',
                headers: SUBGRAPH_HEADERS,
                body: JSON.stringify({ query }),
            });
            const json = await response.json();
            if (json.errors) {
                throw new Error(json.errors[0]?.message || 'Subgraph error');
            }

            const protocol = json.data?.protocol;
            if (protocol) {
                const total = protocol.totalVotingWeight ? BigInt(protocol.totalVotingWeight) : BigInt(0);
                setTotalVoteWeight(total);
                setEpochCount(protocol.epochCount ? BigInt(protocol.epochCount) : BigInt(0));

                // Fetch activePeriod directly from Minter on-chain to avoid subgraph lag/inaccuracy
                try {
                    const onChainResult = await rpcCall<string>(
                        'eth_call',
                        [{ to: V2_CONTRACTS.Minter, data: '0x0a441f7b' }, 'latest'],
                    );
                    if (onChainResult && onChainResult !== '0x') {
                        setActivePeriod(BigInt(onChainResult));
                    } else {
                        setActivePeriod(protocol.activePeriod ? BigInt(protocol.activePeriod) : BigInt(0));
                    }
                } catch {
                    setActivePeriod(protocol.activePeriod ? BigInt(protocol.activePeriod) : BigInt(0));
                }
            }

            const decimalToBigInt = (value: string | null | undefined, decimals: number): bigint => {
                if (!value) return BigInt(0);
                const num = parseFloat(value);
                if (!isFinite(num) || num <= 0) return BigInt(0);
                return BigInt(Math.floor(num * Math.pow(10, decimals)));
            };

            const gaugeRows: SubgraphGauge[] = json.data?.gauges || [];
            const totalWeight = protocol?.totalVotingWeight ? BigInt(protocol.totalVotingWeight) : BigInt(0);

            // Build incentive map: gaugeId -> IncentiveToken[]
            const bribeRows = json.data?.gaugeEpochBribes || [];
            const incentiveMap = new Map<string, IncentiveToken[]>();
            const totalBribesMap = new Map<string, number>();
            for (const b of bribeRows) {
                const gaugeId = String(b.gauge?.id || '').toLowerCase();
                if (!gaugeId || !b.token) continue;
                const incentive: IncentiveToken = {
                    address: String(b.token.id) as Address,
                    symbol: String(b.token.symbol || 'UNK'),
                    decimals: Number(b.token.decimals ?? 18),
                    amount: parseFloat(b.totalAmount || '0'),
                    amountUSD: parseFloat(b.totalAmountUSD || '0'),
                };
                const existing = incentiveMap.get(gaugeId) || [];
                existing.push(incentive);
                incentiveMap.set(gaugeId, existing);
                totalBribesMap.set(gaugeId, (totalBribesMap.get(gaugeId) || 0) + incentive.amountUSD);
            }

            const newRewards = new Map<string, bigint>();
            const newStakedLiquidity = new Map<string, bigint>();

            const gaugeList: GaugeInfo[] = gaugeRows.map((g) => {
                const poolId = String(g.pool?.id || '').toLowerCase();
                const token0 = String(g.pool?.token0?.id || '0x0000000000000000000000000000000000000000');
                const token1 = String(g.pool?.token1?.id || '0x0000000000000000000000000000000000000000');
                const symbol0 = String(g.pool?.token0?.symbol || 'UNK');
                const symbol1 = String(g.pool?.token1?.symbol || 'UNK');
                const decimals0 = Number(g.pool?.token0?.decimals ?? 18);
                const decimals1 = Number(g.pool?.token1?.decimals ?? 18);

                const weight = g.weight ? BigInt(g.weight) : BigInt(0);
                const rewardRate = g.rewardRate ? BigInt(g.rewardRate) : BigInt(0);
                const totalStaked = g.totalStakedLiquidity ? BigInt(g.totalStakedLiquidity) : BigInt(0);

                if (poolId && rewardRate > BigInt(0)) {
                    newRewards.set(poolId, rewardRate);
                }
                if (poolId && totalStaked > BigInt(0)) {
                    newStakedLiquidity.set(poolId, totalStaked);
                }
                const weightPercent = totalWeight > BigInt(0)
                    ? Number((weight * BigInt(10000)) / totalWeight) / 100
                    : 0;

                const epochData = Array.isArray(g.epochData) && g.epochData.length > 0 ? g.epochData[0] : null;
                const fee0 = decimalToBigInt(epochData?.feeRewardToken0, decimals0);
                const fee1 = decimalToBigInt(epochData?.feeRewardToken1, decimals1);
                const rewardTokens: RewardToken[] = [];
                if (fee0 > BigInt(0)) {
                    rewardTokens.push({ address: token0 as Address, symbol: symbol0, amount: fee0, decimals: decimals0 });
                }
                if (fee1 > BigInt(0)) {
                    rewardTokens.push({ address: token1 as Address, symbol: symbol1, amount: fee1, decimals: decimals1 });
                }

                return {
                    pool: poolId as Address,
                    gauge: String(g.id) as Address,
                    token0: token0 as Address,
                    token1: token1 as Address,
                    symbol0,
                    symbol1,
                    poolType: (String(g.gaugeType || 'CL') === 'V2' ? 'V2' : 'CL') as 'V2' | 'CL',
                    isStable: false,
                    weight,
                    weightPercent,
                    isAlive: !!g.isActive,
                    feeReward: (String(g.feeVotingReward || '0x0000000000000000000000000000000000000000')) as Address,
                    bribeReward: (String(g.bribeVotingReward || '0x0000000000000000000000000000000000000000')) as Address,
                    rewardTokens,
                    incentives: incentiveMap.get(String(g.id).toLowerCase()) || [],
                    totalBribesUSD: totalBribesMap.get(String(g.id).toLowerCase()) || 0,
                };
            });

            setGauges(gaugeList);
            setPoolRewards(newRewards);
            setStakedLiquidity(newStakedLiquidity);
        } catch (err) {
            console.error('[PoolDataProvider] Gauge fetch error:', err);
        }
        setGaugesLoading(false);
    }, []);

    // Initial fetch
    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    // Auto-refresh every 10 minutes, paused when tab is hidden
    useEffect(() => {
        const TEN_MINUTES = 10 * 60 * 1000;
        const interval = setInterval(() => {
            if (document.visibilityState !== 'hidden') fetchAllData();
        }, TEN_MINUTES);
        // Refetch when tab becomes visible again after being hidden
        const onVisible = () => { if (document.visibilityState === 'visible') fetchAllData(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [fetchAllData]);

    const getTokenInfo = useCallback((address: string) => {
        return tokenInfoMap.get(address.toLowerCase());
    }, [tokenInfoMap]);


    // Refetch functions for staked positions and veNFTs (triggers subgraph refetch)
    const refetchStaked = useCallback(() => {
        refetchUserData();
    }, [refetchUserData]);

    const refetchVeNFTs = useCallback(() => {
        refetchUserData();
    }, [refetchUserData]);

    // Optimistic removal of staked position (won't persist after refetch)
    // This is a no-op now since data comes from subgraph - just trigger refetch
    const removeStakedPosition = useCallback((_tokenId: bigint, _gaugeAddress: string) => {
        // Trigger a refetch to get fresh data from subgraph
        refetchUserData();
    }, [refetchUserData]);

    const value: PoolDataContextType = {
        v2Pools,
        clPools,
        allPools: [...v2Pools, ...clPools],
        tokenInfoMap,
        poolRewards,
        stakedLiquidity,
        windPrice,
        seiPrice,
        gauges,
        totalVoteWeight,
        epochCount,
        activePeriod,
        gaugesLoading,
        stakedPositions,
        stakedLoading,
        refetchStaked,
        removeStakedPosition,
        veNFTs,
        veNFTsLoading,
        refetchVeNFTs,
        userProfile,
        isLoading,
        refetch: fetchAllData,
        getTokenInfo,
    };

    return (
        <PoolDataContext.Provider value={value}>
            {children}
        </PoolDataContext.Provider>
    );
}

// ============================================
// Hook
// ============================================
export function usePoolData() {
    const context = useContext(PoolDataContext);
    if (!context) {
        throw new Error('usePoolData must be used within PoolDataProvider');
    }
    return context;
}
