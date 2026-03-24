'use client';

import { useState, useEffect, useCallback } from 'react';
import { OLD_SUBGRAPH_URL, OLD_V2_CONTRACTS } from '@/config/oldContracts';
import { getRpcForPoolData } from '@/utils/rpc';

// ============================================
// Types
// ============================================

export interface OldPosition {
    tokenId: string;
    poolId: string;
    token0: { id: string; symbol: string; decimals: number; priceUSD: string };
    token1: { id: string; symbol: string; decimals: number; priceUSD: string };
    tickSpacing: number;
    currentTick: number;
    tickLower: number;
    tickUpper: number;
    liquidity: string;
    amount0: string;
    amount1: string;
    amountUSD: string;
    tokensOwed0: string;
    tokensOwed1: string;
    staked: boolean;
}

export interface OldVeNFT {
    tokenId: string;
    lockedAmount: string;
    lockEnd: string;
    votingPower: string;
    isPermanent: boolean;
}

export interface OldStakedPosition {
    tokenId: string;
    gaugeAddress: string;
    poolId: string;
    token0: { id: string; symbol: string; decimals: number; priceUSD: string };
    token1: { id: string; symbol: string; decimals: number; priceUSD: string };
    tickSpacing: number;
    currentTick: number;
    amount: string;
    earned: string;
    isActive: boolean;
    liquidity: string;
    amount0: string;
    amount1: string;
    amountUSD: string;
}

// ============================================
// GraphQL Query
// ============================================

const OLD_USER_DATA_QUERY = `
    query GetOldUserData($userId: ID!) {
        user(id: $userId) {
            id
            positions(first: 1000) {
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
            }
            veNFTs(first: 50) {
                id
                tokenId
                lockedAmount
                lockEnd
                votingPower
                isPermanent
            }
        }
        gaugeStakedPositions(where: { userId: $userId }, first: 1000) {
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
                tickLower
                tickUpper
                liquidity
                amount0
                amount1
                amountUSD
            }
            tokenId
            amount
            earned
            isActive
        }
    }
`;

// ============================================
// Helper: fetch from old subgraph
// ============================================

async function fetchOldSubgraph<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const response = await fetch(OLD_SUBGRAPH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
        throw new Error(`Old subgraph request failed (status=${response.status})`);
    }

    const json = await response.json();
    if (json.errors) {
        throw new Error(json.errors[0]?.message || 'Old subgraph query error');
    }

    return json.data as T;
}

// ============================================
// Helper: fetch WIND balance via RPC
// ============================================

async function fetchOldWindBalance(userAddress: string): Promise<string> {
    // balanceOf(address) selector = 0x70a08231
    const paddedAddress = userAddress.toLowerCase().replace('0x', '').padStart(64, '0');
    const data = `0x70a08231${paddedAddress}`;

    const rpc = getRpcForPoolData();
    const response = await fetch(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_call',
            params: [{ to: OLD_V2_CONTRACTS.WIND, data }, 'latest'],
            id: 1,
        }),
    });

    const json = await response.json();
    if (json.error) {
        throw new Error(json.error.message || 'RPC error fetching WIND balance');
    }

    // Result is hex-encoded uint256
    const hex = json.result as string;
    if (!hex || hex === '0x' || hex === '0x0') return '0';
    return BigInt(hex).toString();
}

// ============================================
// Hook
// ============================================

export function useOldPositions(userAddress: string | undefined) {
    const [oldPositions, setOldPositions] = useState<OldPosition[]>([]);
    const [oldVeNFTs, setOldVeNFTs] = useState<OldVeNFT[]>([]);
    const [oldStakedPositions, setOldStakedPositions] = useState<OldStakedPosition[]>([]);
    const [oldWindBalance, setOldWindBalance] = useState<string>('0');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        if (!userAddress) {
            setOldPositions([]);
            setOldVeNFTs([]);
            setOldStakedPositions([]);
            setOldWindBalance('0');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const userId = userAddress.toLowerCase();

            // Fetch subgraph data and WIND balance in parallel
            const [subgraphData, windBalance] = await Promise.all([
                fetchOldSubgraph<{
                    user: {
                        positions: Array<{
                            id: string;
                            tokenId: string;
                            pool: {
                                id: string;
                                token0: { id: string; symbol: string; decimals: number; priceUSD: string };
                                token1: { id: string; symbol: string; decimals: number; priceUSD: string };
                                tickSpacing: number;
                                tick: number;
                            };
                            tickLower: number;
                            tickUpper: number;
                            liquidity: string;
                            amount0: string;
                            amount1: string;
                            amountUSD: string;
                            tokensOwed0: string;
                            tokensOwed1: string;
                            staked: boolean;
                        }>;
                        veNFTs: Array<{
                            id: string;
                            tokenId: string;
                            lockedAmount: string;
                            lockEnd: string;
                            votingPower: string;
                            isPermanent: boolean;
                        }>;
                    } | null;
                    gaugeStakedPositions: Array<{
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
                            tickLower: number;
                            tickUpper: number;
                            liquidity: string;
                            amount0: string;
                            amount1: string;
                            amountUSD: string;
                        };
                        tokenId: string;
                        amount: string;
                        earned: string;
                        isActive: boolean;
                    }>;
                }>(OLD_USER_DATA_QUERY, { userId }),
                fetchOldWindBalance(userAddress),
            ]);

            // Map positions
            const positions: OldPosition[] = (subgraphData.user?.positions || []).map((p) => ({
                tokenId: p.tokenId,
                poolId: p.pool.id,
                token0: p.pool.token0,
                token1: p.pool.token1,
                tickSpacing: p.pool.tickSpacing,
                currentTick: p.pool.tick,
                tickLower: p.tickLower,
                tickUpper: p.tickUpper,
                liquidity: p.liquidity,
                amount0: p.amount0,
                amount1: p.amount1,
                amountUSD: p.amountUSD,
                tokensOwed0: p.tokensOwed0,
                tokensOwed1: p.tokensOwed1,
                staked: p.staked,
            }));

            // Map veNFTs
            const veNFTs: OldVeNFT[] = (subgraphData.user?.veNFTs || []).map((v) => ({
                tokenId: v.tokenId,
                lockedAmount: v.lockedAmount,
                lockEnd: v.lockEnd,
                votingPower: v.votingPower,
                isPermanent: v.isPermanent,
            }));

            // Map staked positions
            const staked: OldStakedPosition[] = (subgraphData.gaugeStakedPositions || []).map((s) => ({
                tokenId: s.tokenId,
                gaugeAddress: s.gauge.id,
                poolId: s.gauge.pool.id,
                token0: s.gauge.pool.token0,
                token1: s.gauge.pool.token1,
                tickSpacing: s.gauge.pool.tickSpacing,
                currentTick: s.gauge.pool.tick,
                amount: s.amount,
                earned: s.earned,
                isActive: s.isActive,
                liquidity: s.position.liquidity,
                amount0: s.position.amount0,
                amount1: s.position.amount1,
                amountUSD: s.position.amountUSD,
            }));

            setOldPositions(positions);
            setOldVeNFTs(veNFTs);
            setOldStakedPositions(staked);
            setOldWindBalance(windBalance);

            console.log(
                `[useOldPositions] Fetched ${positions.length} positions, ${veNFTs.length} veNFTs, ${staked.length} staked, WIND balance: ${windBalance}`
            );
        } catch (err) {
            console.error('[useOldPositions] Error:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch old position data');
            setOldPositions([]);
            setOldVeNFTs([]);
            setOldStakedPositions([]);
            setOldWindBalance('0');
        } finally {
            setIsLoading(false);
        }
    }, [userAddress]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const hasOldData =
        oldPositions.length > 0 ||
        oldVeNFTs.length > 0 ||
        oldStakedPositions.length > 0 ||
        BigInt(oldWindBalance) > BigInt(0);

    return {
        oldPositions,
        oldVeNFTs,
        oldStakedPositions,
        oldWindBalance,
        isLoading,
        error,
        refetch: fetchData,
        hasOldData,
    };
}
