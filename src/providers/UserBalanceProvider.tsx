'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { formatUnits, Address, encodeFunctionData, decodeFunctionResult, getAddress } from 'viem';
import { useAccount } from 'wagmi';
import { DEFAULT_TOKEN_LIST, Token, WSEI } from '@/config/tokens';
import { CL_CONTRACTS } from '@/config/contracts';
import { getRpcForUserData, rpcCall } from '@/utils/rpc';
import { fetchSubgraph } from '@/config/subgraph';

// ============================================
// CLInterfaceMulticall ABI (minimal)
// ============================================
const MULTICALL_ABI = [
    {
        inputs: [
            {
                components: [
                    { name: 'target', type: 'address' },
                    { name: 'gasLimit', type: 'uint256' },
                    { name: 'callData', type: 'bytes' },
                ],
                name: 'calls',
                type: 'tuple[]',
            },
        ],
        name: 'multicall',
        outputs: [
            { name: 'blockNumber', type: 'uint256' },
            {
                components: [
                    { name: 'success', type: 'bool' },
                    { name: 'gasUsed', type: 'uint256' },
                    { name: 'returnData', type: 'bytes' },
                ],
                name: 'returnData',
                type: 'tuple[]',
            },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
    },
] as const;

const BALANCE_OF_SELECTOR = '0x70a08231';
const GAS_PER_CALL = 50000n;
const CHUNK_SIZE = 200; // tokens per multicall batch

// ============================================
// Fetch all ERC20 balances via CLInterfaceMulticall
// ============================================
async function fetchBalancesMulticall(
    tokens: Token[],
    userAddress: string,
    rpc: string
): Promise<Map<string, bigint>> {
    const result = new Map<string, bigint>();
    if (tokens.length === 0) return result;

    const addrPadded = userAddress.slice(2).toLowerCase().padStart(64, '0');
    const callData = `0x${BALANCE_OF_SELECTOR.slice(2)}${addrPadded}` as `0x${string}`;

    // Chunk into batches to avoid hitting RPC gas limits
    for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
        const chunk = tokens.slice(i, i + CHUNK_SIZE);
        try {
            const encoded = encodeFunctionData({
                abi: MULTICALL_ABI,
                functionName: 'multicall',
                args: [chunk.map(t => ({
                    target: t.address as Address,
                    gasLimit: GAS_PER_CALL,
                    callData,
                }))],
            });

            const raw = await rpcCall<string>(
                'eth_call',
                [{ to: CL_CONTRACTS.CLInterfaceMulticall, data: encoded }, 'latest'],
                rpc
            );

            if (!raw || raw === '0x') continue;

            const decoded = decodeFunctionResult({
                abi: MULTICALL_ABI,
                functionName: 'multicall',
                data: raw as `0x${string}`,
            }) as [bigint, { success: boolean; gasUsed: bigint; returnData: `0x${string}` }[]];

            const returnData = decoded[1];
            chunk.forEach((token, j) => {
                const r = returnData[j];
                if (r?.success && r.returnData && r.returnData.length > 2) {
                    try {
                        result.set(token.address.toLowerCase(), BigInt(r.returnData));
                    } catch {
                        result.set(token.address.toLowerCase(), 0n);
                    }
                } else {
                    result.set(token.address.toLowerCase(), 0n);
                }
            });
        } catch {
            // Fallback: zero balances for this chunk
            chunk.forEach(t => result.set(t.address.toLowerCase(), 0n));
        }
    }

    return result;
}

// ============================================
// Fetch token prices from subgraph
// ============================================
async function fetchTokenPricesUsd(tokenAddresses: string[]): Promise<Map<string, number>> {
    const priceMap = new Map<string, number>();
    if (tokenAddresses.length === 0) return priceMap;
    try {
        const query = `query Prices($ids: [String!]) {
            tokens(where: { id_in: $ids }) { id priceUSD }
        }`;
        const data = await fetchSubgraph<{ tokens: Array<{ id: string; priceUSD: string }> }>(
            query,
            { ids: tokenAddresses.map(a => a.toLowerCase()) }
        );
        for (const r of data?.tokens || []) {
            const p = r?.priceUSD ? parseFloat(r.priceUSD) : 0;
            if (r?.id && isFinite(p) && p > 0) priceMap.set(String(r.id).toLowerCase(), p);
        }
    } catch { /* ignore */ }
    return priceMap;
}

// ============================================
// Fetch extended token list (WowMax + Uniswap + Superchain)
// ============================================
async function fetchExtendedTokenList(): Promise<Token[]> {
    const seen = new Set<string>(DEFAULT_TOKEN_LIST.map(t => t.address.toLowerCase()));
    const tokens: Token[] = [];

    const TOKEN_LISTS = [
        'https://tokens.uniswap.org',
        'https://static.optimism.io/optimism.tokenlist.json',
    ];
    const WOWMAX_URL = 'https://api-gateway.wowmax.exchange/chains/8453/tokens';

    const results = await Promise.allSettled([
        ...TOKEN_LISTS.map(url => fetch(url).then(r => r.json())),
        fetch(WOWMAX_URL).then(r => r.json()),
    ]);

    // Build logo map from Uniswap + Superchain
    const logoMap = new Map<string, string>();
    for (let i = 0; i < 2; i++) {
        const r = results[i];
        if (r.status !== 'fulfilled') continue;
        for (const t of r.value?.tokens || []) {
            if (t.chainId !== 8453 || !t.logoURI) continue;
            logoMap.set(t.address.toLowerCase(), t.logoURI);
        }
    }

    // Add Uniswap + Superchain tokens (chainId=8453, have logos)
    for (let i = 0; i < 2; i++) {
        const r = results[i];
        if (r.status !== 'fulfilled') continue;
        for (const t of r.value?.tokens || []) {
            if (t.chainId !== 8453) continue;
            const key = t.address.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            let addr = t.address;
            try { addr = getAddress(addr); } catch {}
            tokens.push({ address: addr, name: t.name, symbol: t.symbol, decimals: t.decimals, logoURI: t.logoURI || undefined });
        }
    }

    // Add WowMax-only tokens (already Base, no chainId filter needed)
    const wmResult = results[2];
    if (wmResult.status === 'fulfilled' && Array.isArray(wmResult.value)) {
        for (const t of wmResult.value) {
            const key = t.address.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            let addr = t.address;
            try { addr = getAddress(addr); } catch {}
            tokens.push({ address: addr, name: t.name, symbol: t.symbol, decimals: t.decimals, logoURI: logoMap.get(key) });
        }
    }

    return tokens;
}

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
    sortedTokens: Token[];
    allTokens: Token[];        // Full list including extended tokens
    isLoading: boolean;
    refetch: () => void;
}

const UserBalanceContext = createContext<UserBalanceContextType | undefined>(undefined);

// ============================================
// Provider Component
// ============================================
export function UserBalanceProvider({ children }: { children: ReactNode }) {
    const { address, isConnected } = useAccount();
    const [balances, setBalances] = useState<Map<string, TokenBalance>>(new Map());
    const [sortedTokens, setSortedTokens] = useState<Token[]>(DEFAULT_TOKEN_LIST);
    const [allTokens, setAllTokens] = useState<Token[]>(DEFAULT_TOKEN_LIST);
    const [isLoading, setIsLoading] = useState(false);

    // Fetch extended token list once on mount
    useEffect(() => {
        fetchExtendedTokenList().then(extended => {
            setAllTokens([...DEFAULT_TOKEN_LIST, ...extended]);
        }).catch(() => {});
    }, []);

    const fetchBalances = useCallback(async () => {
        if (!address || !isConnected) {
            setBalances(new Map());
            setSortedTokens(allTokens);
            return;
        }

        setIsLoading(true);
        try {
            const rpc = getRpcForUserData();
            const erc20Tokens = allTokens.filter(t => !t.isNative);

            // Run native balance + multicall ERC20 balances + prices in parallel
            const [nativeHex, erc20Balances, priceUsdMap] = await Promise.all([
                rpcCall<string>('eth_getBalance', [address, 'latest'], rpc),
                fetchBalancesMulticall(erc20Tokens, address, rpc),
                fetchTokenPricesUsd([
                    ...DEFAULT_TOKEN_LIST.filter(t => !t.isNative).map(t => t.address),
                    WSEI.address,
                ]),
            ]);

            const nativeBalance = nativeHex ? BigInt(nativeHex) : 0n;
            const wseiUsd = priceUsdMap.get(WSEI.address.toLowerCase()) || 0;
            const newBalances = new Map<string, TokenBalance>();

            // Native ETH
            const nativeToken = allTokens.find(t => t.isNative);
            if (nativeToken) {
                const formatted = formatUnits(nativeBalance, nativeToken.decimals);
                const amount = parseFloat(formatted);
                newBalances.set(nativeToken.address.toLowerCase(), {
                    token: nativeToken,
                    balance: nativeBalance,
                    formatted,
                    usdValue: wseiUsd > 0 && isFinite(amount) ? amount * wseiUsd : undefined,
                });
            }

            // ERC20 tokens
            for (const token of erc20Tokens) {
                const key = token.address.toLowerCase();
                const balance = erc20Balances.get(key) ?? 0n;
                const formatted = formatUnits(balance, token.decimals);
                const amount = parseFloat(formatted);
                const priceUsd = priceUsdMap.get(key) || 0;
                newBalances.set(key, {
                    token,
                    balance,
                    formatted,
                    usdValue: priceUsd > 0 && isFinite(amount) ? amount * priceUsd : undefined,
                });
            }

            setBalances(newBalances);

            // Sort: tokens with balance first (by USD value desc), then zero-balance tokens
            const sorted = [...allTokens].sort((a, b) => {
                const aRow = newBalances.get(a.address.toLowerCase());
                const bRow = newBalances.get(b.address.toLowerCase());
                const aUsd = aRow?.usdValue;
                const bUsd = bRow?.usdValue;
                if (aUsd !== undefined && bUsd !== undefined && aUsd !== bUsd) return bUsd - aUsd;
                if (aUsd !== undefined && bUsd === undefined) return -1;
                if (bUsd !== undefined && aUsd === undefined) return 1;
                const balA = aRow?.balance ?? 0n;
                const balB = bRow?.balance ?? 0n;
                if (balA > 0n && balB === 0n) return -1;
                if (balB > 0n && balA === 0n) return 1;
                if (balA > 0n && balB > 0n) return balB > balA ? 1 : -1;
                return 0;
            });

            setSortedTokens(sorted);
        } catch (err) {
            console.error('[UserBalanceProvider] Error fetching balances:', err);
        }
        setIsLoading(false);
    }, [address, isConnected, allTokens]);

    useEffect(() => { fetchBalances(); }, [fetchBalances]);

    useEffect(() => {
        if (!isConnected) return;
        const interval = setInterval(fetchBalances, 15000);
        return () => clearInterval(interval);
    }, [isConnected, fetchBalances]);

    const getBalance = useCallback((tokenAddress: string) => {
        return balances.get(tokenAddress.toLowerCase());
    }, [balances]);

    return (
        <UserBalanceContext.Provider value={{ balances, getBalance, sortedTokens, allTokens, isLoading, refetch: fetchBalances }}>
            {children}
        </UserBalanceContext.Provider>
    );
}

// ============================================
// Hook
// ============================================
export function useUserBalances() {
    const context = useContext(UserBalanceContext);
    if (!context) throw new Error('useUserBalances must be used within UserBalanceProvider');
    return context;
}
