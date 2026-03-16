'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { formatUnits, Address } from 'viem';
import { useAccount } from 'wagmi';
import { DEFAULT_TOKEN_LIST, Token, WSEI } from '@/config/tokens';
import { getRpcForUserData, batchRpcCall as batchEthCall, rpcCall } from '@/utils/rpc';
import { fetchSubgraph } from '@/config/subgraph';

// ============================================
// Types
// ============================================
interface TokenBalance {
    token: Token;
    balance: bigint;
    formatted: string;
    usdValue?: number;
}

interface UserBalanceContextType {
    balances: Map<string, TokenBalance>;
    getBalance: (address: string) => TokenBalance | undefined;
    sortedTokens: Token[]; // Tokens sorted by balance (highest first)
    isLoading: boolean;
    refetch: () => void;
}

async function fetchTokenPricesUsd(tokenAddresses: string[]): Promise<Map<string, number>> {
    const priceMap = new Map<string, number>();
    if (tokenAddresses.length === 0) return priceMap;

    try {
        const query = `query Prices($ids: [String!]) {
            tokens(where: { id_in: $ids }) {
                id
                priceUSD
            }
        }`;

        const data = await fetchSubgraph<{ tokens: Array<{ id: string; priceUSD: string }> }>(query, { ids: tokenAddresses.map(a => a.toLowerCase()) });
        const rows = data?.tokens || [];
        for (const r of rows) {
            const p = r?.priceUSD ? parseFloat(r.priceUSD) : 0;
            if (r?.id && isFinite(p) && p > 0) {
                priceMap.set(String(r.id).toLowerCase(), p);
            }
        }
    } catch {
        // ignore
    }

    return priceMap;
}

const UserBalanceContext = createContext<UserBalanceContextType | undefined>(undefined);


// ============================================
// Provider Component
// ============================================
export function UserBalanceProvider({ children }: { children: ReactNode }) {
    const { address, isConnected } = useAccount();
    const [balances, setBalances] = useState<Map<string, TokenBalance>>(new Map());
    const [sortedTokens, setSortedTokens] = useState<Token[]>(DEFAULT_TOKEN_LIST);
    const [isLoading, setIsLoading] = useState(false);

    const fetchBalances = useCallback(async () => {
        if (!address || !isConnected) {
            setBalances(new Map());
            setSortedTokens(DEFAULT_TOKEN_LIST);
            return;
        }

        setIsLoading(true);
        try {
            const addressPadded = address.slice(2).toLowerCase().padStart(64, '0');

            // Fetch prices (subgraph) once per refresh
            const tokensForPrice = DEFAULT_TOKEN_LIST
                .filter(t => !t.isNative)
                .map(t => t.address);
            // Add WSEI so native SEI can be valued
            tokensForPrice.push(WSEI.address);
            const priceUsdMap = await fetchTokenPricesUsd(tokensForPrice);
            const wseiUsd = priceUsdMap.get(WSEI.address.toLowerCase()) || 0;

            // Get native SEI balance
            const nativeHex = await rpcCall<string>('eth_getBalance', [address, 'latest'], getRpcForUserData());
            const nativeBalance = nativeHex ? BigInt(nativeHex) : BigInt(0);

            // Fetch balances for all ERC20 tokens
            const erc20Tokens = DEFAULT_TOKEN_LIST.filter(t => !t.isNative);
            const balanceResults = await batchEthCall(
                erc20Tokens.map(token => ({
                    method: 'eth_call',
                    params: [{ to: token.address, data: `0x70a08231${addressPadded}` }, 'latest'],
                })),
                getRpcForUserData()
            );

            // Build balance map
            const newBalances = new Map<string, TokenBalance>();

            // Add native SEI balance
            const seiToken = DEFAULT_TOKEN_LIST.find(t => t.isNative);
            if (seiToken) {
                const seiFormatted = formatUnits(nativeBalance, seiToken.decimals);
                const seiAmount = parseFloat(seiFormatted);
                const seiUsdValue = wseiUsd > 0 && isFinite(seiAmount) ? seiAmount * wseiUsd : undefined;
                newBalances.set(seiToken.address.toLowerCase(), {
                    token: seiToken,
                    balance: nativeBalance,
                    formatted: seiFormatted,
                    usdValue: seiUsdValue,
                });
            }

            // Add ERC20 balances
            erc20Tokens.forEach((token, i) => {
                const raw = balanceResults[i] as string;
                const balance = raw !== '0x' && raw.length > 2
                    ? BigInt(raw)
                    : BigInt(0);

                const formatted = formatUnits(balance, token.decimals);
                const amount = parseFloat(formatted);
                const priceUsd = priceUsdMap.get(token.address.toLowerCase()) || 0;
                const usdValue = priceUsd > 0 && isFinite(amount) ? amount * priceUsd : undefined;
                newBalances.set(token.address.toLowerCase(), {
                    token,
                    balance,
                    formatted,
                    usdValue,
                });
            });

            setBalances(newBalances);

            // Sort tokens by USD value (desc). Fall back to raw balance.
            const sorted = [...DEFAULT_TOKEN_LIST].sort((a, b) => {
                const aRow = newBalances.get(a.address.toLowerCase());
                const bRow = newBalances.get(b.address.toLowerCase());

                const aUsd = aRow?.usdValue;
                const bUsd = bRow?.usdValue;

                if (aUsd !== undefined && bUsd !== undefined && aUsd !== bUsd) return bUsd - aUsd;
                if (aUsd !== undefined && (bUsd === undefined)) return -1;
                if (bUsd !== undefined && (aUsd === undefined)) return 1;

                const balA = aRow?.balance || BigInt(0);
                const balB = bRow?.balance || BigInt(0);
                if (balA > BigInt(0) && balB === BigInt(0)) return -1;
                if (balB > BigInt(0) && balA === BigInt(0)) return 1;
                if (balA > BigInt(0) && balB > BigInt(0)) return balB > balA ? 1 : -1;
                return 0;
            });

            setSortedTokens(sorted);
        } catch (err) {
            console.error('[UserBalanceProvider] Error fetching balances:', err);
        }
        setIsLoading(false);
    }, [address, isConnected]);

    // Fetch on wallet connect/change
    useEffect(() => {
        fetchBalances();
    }, [fetchBalances]);

    // Auto-refresh every 15s when connected
    useEffect(() => {
        if (!isConnected) return;
        const interval = setInterval(fetchBalances, 15000);
        return () => clearInterval(interval);
    }, [isConnected, fetchBalances]);

    const getBalance = useCallback((tokenAddress: string) => {
        return balances.get(tokenAddress.toLowerCase());
    }, [balances]);

    const value: UserBalanceContextType = {
        balances,
        getBalance,
        sortedTokens,
        isLoading,
        refetch: fetchBalances,
    };

    return (
        <UserBalanceContext.Provider value={value}>
            {children}
        </UserBalanceContext.Provider>
    );
}

// ============================================
// Hook
// ============================================
export function useUserBalances() {
    const context = useContext(UserBalanceContext);
    if (!context) {
        throw new Error('useUserBalances must be used within UserBalanceProvider');
    }
    return context;
}
