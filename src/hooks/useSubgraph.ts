'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchSubgraph, SUBGRAPH_URL } from '@/config/subgraph';

// Types matching subgraph schema
export interface SubgraphToken {
    id: string;
    symbol: string;
    name: string;
    decimals: number;
}

export interface SubgraphPool {
    id: string;
    token0: SubgraphToken;
    token1: SubgraphToken;
    tickSpacing: number;
    tick: number;  // Current pool tick from subgraph
    liquidity: string;
    sqrtPriceX96?: string;
    totalValueLockedToken0: string;
    totalValueLockedToken1: string;
    totalValueLockedUSD: string;
    volumeToken0: string;
    volumeToken1: string;
    volumeUSD: string;
    feesUSD: string;
    txCount: string;
    createdAtTimestamp: string;
}

export interface SubgraphSwap {
    id: string;
    pool: { id: string };
    sender: string;
    recipient: string;
    amount0: string;
    amount1: string;
    amountUSD: string;
    timestamp: string;
}

export interface SubgraphProtocol {
    totalVolumeUSD: string;
    totalTVLUSD: string;
    totalPools: string;
    totalSwaps: string;
    epochCount: string;
    activePeriod: string;
    epochEnd: string;
    weeklyEmissions: string;
    totalEmissions: string;
    tailEmissionRate: string;
    totalVotingWeight: string;
    proposalThreshold: string;
    votingDelay: string;
    votingPeriod: string;
}

export interface SubgraphPoolDayData {
    id: string;
    pool: { id: string };
    date: number;
    volumeUSD: string;
    tvlUSD: string;
    txCount: string;
}

interface UseSubgraphResult {
    pools: SubgraphPool[];
    protocol: SubgraphProtocol | null;
    recentSwaps: SubgraphSwap[];
    isLoading: boolean;
    error: string | null;
    refetch: () => void;
}

// GraphQL query for pools
const POOLS_QUERY = `
    query GetPools($first: Int!, $skip: Int!, $orderBy: String!, $orderDirection: String!) {
        pools(first: $first, skip: $skip, orderBy: $orderBy, orderDirection: $orderDirection) {
            id
            token0 {
                id
                symbol
                name
                decimals
            }
            token1 {
                id
                symbol
                name
                decimals
            }
            tickSpacing
            tick
            liquidity
            totalValueLockedToken0
            totalValueLockedToken1
            totalValueLockedUSD
            volumeToken0
            volumeToken1
            volumeUSD
            feesUSD
            txCount
            createdAtTimestamp
        }
        protocol(id: "windswap") {
            totalVolumeUSD
            totalTVLUSD
            totalPools
            totalSwaps
            epochCount
            activePeriod
            epochEnd
            weeklyEmissions
            totalEmissions
            tailEmissionRate
            totalVotingWeight
            proposalThreshold
            votingDelay
            votingPeriod
        }
    }
`;

const RECENT_SWAPS_QUERY = `
    query GetRecentSwaps($first: Int!) {
        swaps(first: $first, orderBy: timestamp, orderDirection: desc) {
            id
            pool { id }
            sender
            recipient
            amount0
            amount1
            amountUSD
            timestamp
        }
    }
`;


/**
 * Hook to fetch all pools from the WindSwap subgraph
 */
export function useSubgraph(): UseSubgraphResult {
    const [pools, setPools] = useState<SubgraphPool[]>([]);
    const [protocol, setProtocol] = useState<SubgraphProtocol | null>(null);
    const [recentSwaps, setRecentSwaps] = useState<SubgraphSwap[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            // Fetch pools
            const poolsData = await fetchSubgraph<{
                pools: SubgraphPool[];
                protocol: SubgraphProtocol | null;
            }>(POOLS_QUERY, {
                first: 100,
                skip: 0,
                orderBy: 'totalValueLockedUSD',
                orderDirection: 'desc',
            });

            setPools(poolsData.pools || []);
            setProtocol(poolsData.protocol);

            // Fetch recent swaps
            const swapsData = await fetchSubgraph<{ swaps: SubgraphSwap[] }>(RECENT_SWAPS_QUERY, {
                first: 20,
            });

            setRecentSwaps(swapsData.swaps || []);
        } catch (err) {
            console.error('[useSubgraph] Fetch error:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch subgraph data');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();

        // Refresh every 5 minutes
        const interval = setInterval(fetchData, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [fetchData]);

    return {
        pools,
        protocol,
        recentSwaps,
        isLoading,
        error,
        refetch: fetchData,
    };
}

/**
 * Hook to fetch pool day data for charts
 */
export function usePoolDayData(poolId: string) {
    const [dayData, setDayData] = useState<SubgraphPoolDayData[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!poolId) return;

        const fetchDayData = async () => {
            try {
                const data = await fetchSubgraph<{ poolDayDatas: SubgraphPoolDayData[] }>(
                    `query GetPoolDayData($poolId: String!) {
                        poolDayDatas(first: 30, where: { pool: $poolId }, orderBy: date, orderDirection: desc) {
                            id
                            pool { id }
                            date
                            volumeUSD
                            tvlUSD
                            txCount
                        }
                    }`,
                    { poolId }
                );
                setDayData(data.poolDayDatas || []);
            } catch (err) {
                console.error('[usePoolDayData] Error:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDayData();
    }, [poolId]);

    return { dayData, isLoading };
}

// ============================================
// USER DATA TYPES (from subgraph schema v3.0.6)
// ============================================

export interface SubgraphPosition {
    id: string;
    tokenId: string;
    pool: {
        id: string;
        token0: { id: string; symbol: string; decimals: number; priceUSD: string };
        token1: { id: string; symbol: string; decimals: number; priceUSD: string };
        tickSpacing: number;
        tick: number;  // Current pool tick
    };
    tickLower: number;
    tickUpper: number;
    liquidity: string;
    amount0: string;  // Token0 balance in position
    amount1: string;  // Token1 balance in position
    amountUSD: string;  // Total USD value of position
    tokensOwed0: string;  // Uncollected fees in token0
    tokensOwed1: string;  // Uncollected fees in token1
    staked: boolean;

    depositedToken0?: string;
    depositedToken1?: string;
    withdrawnToken0?: string;
    withdrawnToken1?: string;
    collectedToken0?: string;
    collectedToken1?: string;
}

export interface SubgraphVeNFT {
    id: string;
    tokenId: string;
    lockedAmount: string;
    lockEnd: string;
    votingPower: string;
    isPermanent: boolean;
    claimableRewards: string;
    hasVoted: boolean;
    lastVoted: string;
    lastVotedEpoch: string;
    totalClaimed: string;
}

export interface SubgraphStakedPosition {
    id: string;
    gauge: {
        id: string;
        pool: {
            id: string;
            token0: { id: string; symbol: string; decimals: number; priceUSD: string };
            token1: { id: string; symbol: string; decimals: number; priceUSD: string };
            tickSpacing: number;
            tick: number;
        };
    };
    position: {
        tokenId: string;
        staked: boolean;
        tickLower: number;
        tickUpper: number;
        liquidity: string;
        amount0: string;
        amount1: string;
        amountUSD: string;
    };
    tokenId: string;
    amount: string;
    tickLower: number;
    tickUpper: number;
    earned: string;
    totalClaimed: string;
    isActive: boolean;
}

export interface SubgraphUser {
    id: string;
    positions: SubgraphPosition[];
    veNFTs: SubgraphVeNFT[];
    profile?: {
        id: string;
        totalPositionsValueUSD: string;
        totalStakedValueUSD: string;
        totalVeNFTValueUSD: string;
        totalRewardsClaimedUSD: string;
        totalFeesEarnedUSD: string;
        totalSwaps: number;
        totalProvides: number;
        totalWithdraws: number;
        firstActivityTimestamp: string;
        lastActivityTimestamp: string;
    } | null;
}

// Comprehensive user data query - replaces all RPC calls for user data
const USER_DATA_QUERY = `
    query GetUserData($userId: ID!, $positionsSkip: Int!, $stakedSkip: Int!) {
        user(id: $userId) {
            id
            profile {
                id
                totalPositionsValueUSD
                totalStakedValueUSD
                totalVeNFTValueUSD
                totalRewardsClaimedUSD
                totalFeesEarnedUSD
                totalSwaps
                totalProvides
                totalWithdraws
                firstActivityTimestamp
                lastActivityTimestamp
            }
            positions(first: 1000, skip: $positionsSkip) {
                id
                tokenId
                pool {
                    id
                    token0 { id symbol decimals priceUSD }
                    token1 { id symbol decimals priceUSD }
                    tickSpacing
                    tick
                }
                tickLower
                tickUpper
                liquidity
                amount0
                amount1
                amountUSD
                tokensOwed0
                tokensOwed1
                staked
                depositedToken0
                depositedToken1
                withdrawnToken0
                withdrawnToken1
                collectedToken0
                collectedToken1
            }
            veNFTs(first: 50) {
                id
                tokenId
                lockedAmount
                lockEnd
                votingPower
                isPermanent
                claimableRewards
                hasVoted
                lastVoted
                lastVotedEpoch
                totalClaimed
            }
        }
        gaugeStakedPositions(where: { userId: $userId }, first: 1000, skip: $stakedSkip) {
            id
            gauge {
                id
                pool {
                    id
                    token0 { id symbol decimals priceUSD }
                    token1 { id symbol decimals priceUSD }
                    tickSpacing
                    tick
                }
            }
            position {
                tokenId
                staked
                tickLower
                tickUpper
                liquidity
                amount0
                amount1
                amountUSD
            }
            tokenId
            amount
            tickLower
            tickUpper
            earned
            totalClaimed
            isActive
        }
    }
`;

// Legacy query for backwards compatibility
const USER_POSITIONS_QUERY = USER_DATA_QUERY;

/**
 * Hook to fetch all user data from subgraph
 * Replaces multiple RPC calls with a single GraphQL query
 * Returns: positions, veNFTs, stakedPositions
 */
export function useUserPositions(userAddress: string | undefined) {
    const [positions, setPositions] = useState<SubgraphPosition[]>([]);
    const [veNFTs, setVeNFTs] = useState<SubgraphVeNFT[]>([]);
    const [stakedPositions, setStakedPositions] = useState<SubgraphStakedPosition[]>([]);
    const [profile, setProfile] = useState<SubgraphUser['profile']>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchUserData = useCallback(async () => {
        if (!userAddress) {
            setPositions([]);
            setVeNFTs([]);
            setStakedPositions([]);
            setProfile(null);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // Fetch ALL positions AND staked positions with pagination (no limit!)
            let allPositions: SubgraphPosition[] = [];
            let allStakedPositions: SubgraphStakedPosition[] = [];
            const batchSize = 1000;

            // Fetch positions with pagination
            let positionsSkip = 0;
            let hasMorePositions = true;

            while (hasMorePositions) {
                const data = await fetchSubgraph<{
                    user: SubgraphUser | null;
                    gaugeStakedPositions: SubgraphStakedPosition[];
                }>(
                    USER_DATA_QUERY,
                    { userId: userAddress.toLowerCase(), positionsSkip, stakedSkip: 0 }
                );

                if (data.user) {
                    const positions = data.user.positions || [];
                    allPositions = [...allPositions, ...positions];

                    // Store profile and veNFTs from first batch only
                    if (positionsSkip === 0) {
                        setVeNFTs(data.user.veNFTs || []);
                        setProfile(data.user.profile || null);
                    }

                    // If we got less than batchSize, we've reached the end
                    hasMorePositions = positions.length === batchSize;
                    positionsSkip += batchSize;
                } else {
                    hasMorePositions = false;
                }
            }

            // Fetch staked positions with pagination
            let stakedSkip = 0;
            let hasMoreStaked = true;

            while (hasMoreStaked) {
                const data = await fetchSubgraph<{
                    user: SubgraphUser | null;
                    gaugeStakedPositions: SubgraphStakedPosition[];
                }>(
                    USER_DATA_QUERY,
                    { userId: userAddress.toLowerCase(), positionsSkip: 0, stakedSkip }
                );

                const staked = data.gaugeStakedPositions || [];
                allStakedPositions = [...allStakedPositions, ...staked];

                // If we got less than batchSize, we've reached the end
                hasMoreStaked = staked.length === batchSize;
                stakedSkip += batchSize;
            }

            setPositions(allPositions);
            setStakedPositions(allStakedPositions);
            console.log(`[useUserPositions] Fetched ALL ${allPositions.length} positions, ${allStakedPositions.length} staked (no limits!)`);
        } catch (err) {
            console.error('[useUserPositions] Error:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch user data');
            setPositions([]);
            setVeNFTs([]);
            setProfile(null);
        } finally {
            setIsLoading(false);
        }
    }, [userAddress]);

    useEffect(() => {
        fetchUserData();
    }, [fetchUserData]);

    return {
        positions,
        veNFTs,
        stakedPositions,
        profile,
        isLoading,
        error,
        refetch: fetchUserData,
    };
}

// Export the subgraph URL for direct use
export { SUBGRAPH_URL };

