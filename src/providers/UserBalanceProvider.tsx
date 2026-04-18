'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { formatUnits, Address, encodeFunctionData, decodeFunctionResult, getAddress } from 'viem';
import { useAccount } from 'wagmi';
import { DEFAULT_TOKEN_LIST, Token, WETH } from '@/config/tokens';
import { CL_CONTRACTS } from '@/config/contracts';
import { getRpcForUserData, rpcCall, FALLBACK_RPCS } from '@/utils/rpc';

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
const GAS_PER_CALL = 35000n; // real worst-case (USDC proxy) = ~31k, +10% buffer
const CHUNK_SIZE = 400; // 400 × 35k = 14M gas per batch, well within RPC limits


// ============================================
// Fetch token prices from DexScreener (only for tokens user holds)
// Batches up to 30 addresses per request
// ============================================
// Stablecoins always $1
const STABLECOIN_ADDRESSES = new Set([
    '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // USDC
    '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca', // USDbC
    '0x50c5725949a6f0c72e6c4a641f24049a917db0cb', // DAI
    '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2', // USDT
]);

async function fetchTokenPricesUsd(tokenAddresses: string[]): Promise<Map<string, number>> {
    const priceMap = new Map<string, number>();
    if (tokenAddresses.length === 0) return priceMap;

    // Hardcode stablecoins
    for (const addr of tokenAddresses) {
        if (STABLECOIN_ADDRESSES.has(addr.toLowerCase())) {
            priceMap.set(addr.toLowerCase(), 1);
        }
    }

    // Fetch remaining from DexScreener in batches of 5 (30 pairs / 5 tokens = ~6 pairs per token)
    const remaining = tokenAddresses.filter(a => !priceMap.has(a.toLowerCase()));
    const BATCH_SIZE = 5;
    const batches: string[][] = [];
    for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
        batches.push(remaining.slice(i, i + BATCH_SIZE));
    }
    await Promise.allSettled(batches.map(async batch => {
        try {
            const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${batch.join(',')}`);
            if (!res.ok) return;
            const data = await res.json();
            // Pick highest-liquidity Base pair per token
            const liquidityByToken = new Map<string, { price: number; liquidity: number }>();
            for (const pair of data?.pairs || []) {
                if (pair?.chainId !== 'base') continue;
                if (!pair?.baseToken?.address || !pair?.priceUsd) continue;
                const key = pair.baseToken.address.toLowerCase();
                const price = parseFloat(pair.priceUsd);
                const liquidity = pair?.liquidity?.usd ?? 0;
                if (!isFinite(price) || price <= 0) continue;
                const existing = liquidityByToken.get(key);
                if (!existing || liquidity > existing.liquidity) {
                    liquidityByToken.set(key, { price, liquidity });
                }
            }
            for (const [key, { price }] of liquidityByToken) {
                if (!priceMap.has(key)) priceMap.set(key, price);
            }
        } catch { /* ignore */ }
    }));
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
    const HYDREX_URL = 'https://raw.githubusercontent.com/hydrexfi/hydrex-lists/main/tokens/8453.json';
    const PANCAKE_URL = 'https://tokens.pancakeswap.finance/pancakeswap-base-default.json';

    const results = await Promise.allSettled([
        ...TOKEN_LISTS.map(url => fetch(url).then(r => r.json())),
        fetch(WOWMAX_URL).then(r => r.json()),
        fetch(HYDREX_URL).then(r => r.json()),
        fetch(PANCAKE_URL).then(r => r.json()),
    ]);

    // results indices: 0=uniswap, 1=superchain, 2=wowmax, 3=hydrex, 4=pancake

    // Build logo map from all lists with chainId-filtered logos
    const logoMap = new Map<string, string>();
    for (let i = 0; i < 2; i++) {
        const r = results[i];
        if (r.status !== 'fulfilled') continue;
        for (const t of r.value?.tokens || []) {
            if (t.chainId !== 8453 || !t.logoURI) continue;
            logoMap.set(t.address.toLowerCase(), t.logoURI);
        }
    }
    // Hydrex logos
    const hydrexResult = results[3];
    if (hydrexResult.status === 'fulfilled' && Array.isArray(hydrexResult.value)) {
        for (const t of hydrexResult.value) {
            if (t.logoURI) logoMap.set(t.address.toLowerCase(), t.logoURI);
        }
    }
    // PancakeSwap logos (chainId=8453)
    const pancakeResult = results[4];
    if (pancakeResult.status === 'fulfilled') {
        for (const t of pancakeResult.value?.tokens || []) {
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

    // Add WowMax-only tokens
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

    // Add Hydrex-only tokens
    if (hydrexResult.status === 'fulfilled' && Array.isArray(hydrexResult.value)) {
        for (const t of hydrexResult.value) {
            const key = t.address.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            let addr = t.address;
            try { addr = getAddress(addr); } catch {}
            tokens.push({ address: addr, name: t.name, symbol: t.symbol, decimals: t.decimals, logoURI: t.logoURI || undefined });
        }
    }

    // Add PancakeSwap-only tokens (chainId=8453)
    if (pancakeResult.status === 'fulfilled') {
        for (const t of pancakeResult.value?.tokens || []) {
            if (t.chainId !== 8453) continue;
            const key = t.address.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            let addr = t.address;
            try { addr = getAddress(addr); } catch {}
            tokens.push({ address: addr, name: t.name, symbol: t.symbol, decimals: t.decimals, logoURI: t.logoURI || undefined });
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

    const allTokensRef = useRef<Token[]>(DEFAULT_TOKEN_LIST);

    // Defer extended token list — fetch after 3s idle so it doesn't block initial load on 3G.
    // Cached in localStorage for 7 days (SWR: refresh in background after 1 day).
    const extendedFetched = useRef(false);
    useEffect(() => {
        const CACHE_KEY = 'wind_extended_token_list_v1';
        const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
        const SWR_THRESHOLD = 24 * 60 * 60 * 1000; // refresh in background if older than 1 day

        const applyExtended = (extended: Token[]) => {
            const full = [...DEFAULT_TOKEN_LIST, ...extended];
            allTokensRef.current = full;
            setAllTokens(full);
        };

        const refresh = () => {
            if (extendedFetched.current) return;
            extendedFetched.current = true;
            fetchExtendedTokenList().then(extended => {
                applyExtended(extended);
                try {
                    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), tokens: extended }));
                } catch {}
            }).catch(() => {});
        };

        // Instant path: serve from cache if fresh, skip network entirely.
        let cacheAge = Infinity;
        try {
            const raw = localStorage.getItem(CACHE_KEY);
            if (raw) {
                const { ts, tokens } = JSON.parse(raw) as { ts: number; tokens: Token[] };
                cacheAge = Date.now() - ts;
                if (cacheAge < CACHE_TTL && Array.isArray(tokens)) {
                    applyExtended(tokens);
                    if (cacheAge < SWR_THRESHOLD) {
                        extendedFetched.current = true; // fully fresh — no background refresh
                        return;
                    }
                }
            }
        } catch {}

        const timer = setTimeout(refresh, 3000);
        return () => clearTimeout(timer);
    }, []);

    const fetchBalances = useCallback(async (tokenOverride?: Token[]) => {
        if (!address || !isConnected) {
            setBalances(new Map());
            setSortedTokens(allTokensRef.current);
            return;
        }

        // Skip fetch if tab is hidden — resume when user comes back
        if (document.visibilityState === 'hidden') return;

        setIsLoading(true);
        try {
            const rpc = getRpcForUserData();
            const currentTokens = tokenOverride ?? allTokensRef.current;
            const erc20Tokens = currentTokens.filter(t => !t.isNative);
            const nativeToken = currentTokens.find(t => t.isNative);

            // Shared mutable state — updated as chunks and prices arrive
            const liveBalances = new Map<string, TokenBalance>();
            const livePrices = new Map<string, number>();

            const applyAndFlush = (tokens: Token[]) => {
                for (const token of tokens) {
                    const key = token.address.toLowerCase();
                    const entry = liveBalances.get(key);
                    if (!entry) continue;
                    const priceUsd = livePrices.get(key) || 0;
                    const amount = parseFloat(entry.formatted);
                    liveBalances.set(key, {
                        ...entry,
                        usdValue: priceUsd > 0 && isFinite(amount) ? amount * priceUsd : entry.usdValue,
                    });
                }
                const snapshot = new Map(liveBalances);
                setBalances(snapshot);
                const sorted = [...currentTokens].sort((a, b) => {
                    const aRow = snapshot.get(a.address.toLowerCase());
                    const bRow = snapshot.get(b.address.toLowerCase());
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
            };

            // Native balance — show immediately when it arrives
            rpcCall<string>('eth_getBalance', [address, 'latest'], rpc).then(nativeHex => {
                if (!nativeToken) return;
                const balance = nativeHex ? BigInt(nativeHex) : 0n;
                const formatted = formatUnits(balance, nativeToken.decimals);
                liveBalances.set(nativeToken.address.toLowerCase(), { token: nativeToken, balance, formatted });
                applyAndFlush([nativeToken]);

                // Fetch native price independently
                if (balance > 0n) {
                    fetchTokenPricesUsd([WETH.address]).then(prices => {
                        for (const [k, v] of prices) livePrices.set(k, v);
                        applyAndFlush([nativeToken]);
                    }).catch(() => {});
                }
            }).catch(() => {});

            // Multicall chunks — update UI as each chunk resolves
            const addrPadded = address.slice(2).toLowerCase().padStart(64, '0');
            const callData = `0x${BALANCE_OF_SELECTOR.slice(2)}${addrPadded}` as `0x${string}`;
            const chunks: Token[][] = [];
            for (let i = 0; i < erc20Tokens.length; i += CHUNK_SIZE) {
                chunks.push(erc20Tokens.slice(i, i + CHUNK_SIZE));
            }
            const allRpcs = [rpc, ...FALLBACK_RPCS.filter(r => r !== rpc)];

            await Promise.all(chunks.map(async (chunk, i) => {
                let chunkResult: Map<string, bigint> | null = null;

                for (let attempt = 0; attempt < allRpcs.length && !chunkResult; attempt++) {
                    const tryRpc = allRpcs[(i + attempt) % allRpcs.length];
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
                            tryRpc
                        );
                        if (!raw || raw === '0x') { chunkResult = new Map(); continue; }
                        const decoded = decodeFunctionResult({
                            abi: MULTICALL_ABI,
                            functionName: 'multicall',
                            data: raw as `0x${string}`,
                        }) as [bigint, { success: boolean; gasUsed: bigint; returnData: `0x${string}` }[]];

                        chunkResult = new Map();
                        decoded[1].forEach((r, j) => {
                            const token = chunk[j];
                            const key = token.address.toLowerCase();
                            if (r?.success && r.returnData && r.returnData.length > 2) {
                                try { chunkResult!.set(key, BigInt(r.returnData)); }
                                catch { chunkResult!.set(key, 0n); }
                            } else {
                                chunkResult!.set(key, 0n);
                            }
                        });
                    } catch { /* try next RPC */ }
                }

                if (!chunkResult) {
                    chunk.forEach(t => liveBalances.set(t.address.toLowerCase(), {
                        token: t, balance: 0n, formatted: '0',
                    }));
                } else {
                    // Write balances for this chunk
                    for (const token of chunk) {
                        const key = token.address.toLowerCase();
                        const balance = chunkResult.get(key) ?? 0n;
                        const formatted = formatUnits(balance, token.decimals);
                        liveBalances.set(key, { token, balance, formatted });
                    }
                    // Show this chunk immediately, then fetch prices for non-zero tokens
                    applyAndFlush(chunk);

                    const nonZero = chunk.filter(t => (chunkResult!.get(t.address.toLowerCase()) ?? 0n) > 0n);
                    if (nonZero.length > 0) {
                        fetchTokenPricesUsd(nonZero.map(t => t.address)).then(prices => {
                            for (const [k, v] of prices) livePrices.set(k, v);
                            applyAndFlush(nonZero);
                        }).catch(() => {});
                    }
                }
            }));

        } catch (err) {
            console.error('[UserBalanceProvider] Error fetching balances:', err);
        }
        setIsLoading(false);
    // allTokens removed from deps — accessed via ref to avoid callback churn
    }, [address, isConnected]);

    // Pass 1: fetch core token balances immediately on connect (fast — ~30 tokens)
    useEffect(() => { fetchBalances(DEFAULT_TOKEN_LIST); }, [fetchBalances]);

    // Pass 2: re-fetch once the extended list is ready (runs after allTokens updates)
    useEffect(() => {
        if (allTokens.length > DEFAULT_TOKEN_LIST.length) {
            fetchBalances(allTokens);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allTokens]);

    useEffect(() => {
        if (!isConnected) return;

        // Poll every 60s — balances don't change that fast when idle
        const interval = setInterval(() => fetchBalances(), 60_000);

        // Pause polling when tab is hidden, resume and fetch immediately when visible again
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') fetchBalances();
        };
        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [isConnected, fetchBalances]);

    const getBalance = useCallback((tokenAddress: string) => {
        return balances.get(tokenAddress.toLowerCase());
    }, [balances]);

    return (
        <UserBalanceContext.Provider value={{ balances, getBalance, sortedTokens, allTokens, isLoading, refetch: () => fetchBalances() }}>
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
