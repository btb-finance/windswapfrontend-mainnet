'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { getAddress } from 'viem';
import { Token, DEFAULT_TOKEN_LIST } from '@/config/tokens';
import { useUserBalances } from '@/providers/UserBalanceProvider';
import { getRpcForPoolData } from '@/utils/rpc';
import { getTokenMetadataFromCache, setTokenMetadataCache } from '@/utils/cache';
import { useSwipeToDismiss } from '@/hooks/useSwipeToDismiss';

interface TokenSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (token: Token) => void;
    selectedToken?: Token;
    excludeToken?: Token;
    multiSelect?: boolean;
    onMultiSelect?: (tokens: Token[]) => void;
    excludeTokens?: Token[];
}

// Helper to check if string is a valid Ethereum address
const isValidAddress = (value: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(value);
};

// Decode string results from hex (skip first 64 chars for offset, next 64 for length, rest is data)
const decodeString = (hex: string): string => {
    if (!hex || hex === '0x' || hex.length < 130) return '';
    try {
        const lengthHex = hex.slice(66, 130);
        const length = parseInt(lengthHex, 16);
        const dataHex = hex.slice(130, 130 + length * 2);
        return Buffer.from(dataHex, 'hex').toString('utf8').replace(/\0/g, '').trim();
    } catch {
        return '';
    }
};

// Fetch token info from chain with localStorage caching
async function fetchTokenInfo(address: string): Promise<Token | null> {
    try {
        // Check localStorage cache first (1 hour TTL)
        const cached = getTokenMetadataFromCache(address);
        if (cached) {
            return {
                address: address as `0x${string}`,
                symbol: cached.symbol,
                name: cached.name,
                decimals: cached.decimals,
            };
        }

        // Prepare calldata for symbol(), name(), decimals()
        const symbolSelector = '0x95d89b41';
        const nameSelector = '0x06fdde03';
        const decimalsSelector = '0x313ce567';

        const [symbolResult, nameResult, decimalsResult] = await Promise.all([
            fetch(getRpcForPoolData(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'eth_call',
                    params: [{ to: address, data: symbolSelector }, 'latest'],
                    id: 1,
                }),
            }).then(r => r.json()),
            fetch(getRpcForPoolData(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'eth_call',
                    params: [{ to: address, data: nameSelector }, 'latest'],
                    id: 2,
                }),
            }).then(r => r.json()),
            fetch(getRpcForPoolData(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'eth_call',
                    params: [{ to: address, data: decimalsSelector }, 'latest'],
                    id: 3,
                }),
            }).then(r => r.json()),
        ]);

        const symbol = decodeString(symbolResult.result);
        const name = decodeString(nameResult.result);
        const decimals = decimalsResult.result ? parseInt(decimalsResult.result, 16) : 18;

        if (!symbol) return null;

        // Cache the result
        setTokenMetadataCache(address, { symbol, name: name || symbol, decimals });

        return {
            address: address as `0x${string}`,
            symbol,
            name: name || symbol,
            decimals,
        };
    } catch (error) {
        console.error('Error fetching token info:', error);
        return null;
    }
}

export function TokenSelector({
    isOpen,
    onClose,
    onSelect,
    selectedToken,
    excludeToken,
    multiSelect = false,
    onMultiSelect,
    excludeTokens,
}: TokenSelectorProps) {
    const [multiSelected, setMultiSelected] = useState<Token[]>([]);
    const router = useRouter();
    const [search, setSearch] = useState('');
    const [filteredTokens, setFilteredTokens] = useState(DEFAULT_TOKEN_LIST);
    const [customToken, setCustomToken] = useState<Token | null>(null);
    const [loadingCustom, setLoadingCustom] = useState(false);
    const [customError, setCustomError] = useState<string | null>(null);

    type TabType = 'All' | 'Trending' | 'Top Liquidity';
    const [activeTab, setActiveTab] = useState<TabType>('All');
    const [trendingTokens, setTrendingTokens] = useState<Token[]>([]);
    const [liquidityTokens, setLiquidityTokens] = useState<Token[]>([]);
    const [loadingTabs, setLoadingTabs] = useState(false);
    const [cgTokens, setCgTokens] = useState<Token[]>([]);

    // Get global balances (sorted by balance)
    const { sortedTokens, getBalance } = useUserBalances();

    // Fetch Base tokens from multiple lists — progressive: each list shows tokens as it arrives.
    // localStorage cache (7-day TTL) means repeat visits are instant and avoid re-downloading lists.
    useEffect(() => {
        let cancelled = false;
        const CACHE_KEY = 'wind_token_list_v2';
        const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
        const SWR_THRESHOLD = 24 * 60 * 60 * 1000; // refresh in background if older than 1 day

        // Shared dedup set (starts with default list addresses)
        const seen = new Set<string>(DEFAULT_TOKEN_LIST.map(t => t.address.toLowerCase()));
        // Accumulated token array — mutated as lists arrive, flushed to state progressively
        let accumulated: Token[] = [];

        const flush = () => {
            if (!cancelled) setCgTokens([...accumulated]);
        };

        const addTokens = (raw: { address: string; name: string; symbol: string; decimals: number; logoURI?: string; chainId?: number }[], chainId?: number) => {
            let added = false;
            for (const t of raw) {
                if (chainId && t.chainId !== chainId) continue;
                const key = t.address.toLowerCase();
                if (seen.has(key)) continue;
                seen.add(key);
                let addr = t.address;
                try { addr = getAddress(addr); } catch {}
                accumulated.push({ address: addr, name: t.name, symbol: t.symbol, decimals: t.decimals, logoURI: t.logoURI || undefined });
                added = true;
            }
            return added;
        };

        // Load from localStorage cache immediately (instant display)
        let cacheAge = Infinity;
        try {
            const raw = localStorage.getItem(CACHE_KEY);
            if (raw) {
                const { ts, tokens } = JSON.parse(raw) as { ts: number; tokens: Token[] };
                cacheAge = Date.now() - ts;
                if (cacheAge < CACHE_TTL) {
                    accumulated = tokens.filter(t => !seen.has(t.address.toLowerCase()));
                    accumulated.forEach(t => seen.add(t.address.toLowerCase()));
                    flush();
                    // Fresh (<1 day): skip network entirely. Stale (1–7 days): continue to refresh in background.
                    if (cacheAge < SWR_THRESHOLD) {
                        return () => { cancelled = true; };
                    }
                }
            }
        } catch {}

        // Ordered by expected speed: PancakeSwap & Hydrex CDN are fast, Uniswap moderate, WowMax slow
        const sources: Array<{ url: string; parse: (d: unknown) => { address: string; name: string; symbol: string; decimals: number; logoURI?: string; chainId?: number }[]; chainId?: number }> = [
            {
                url: 'https://tokens.pancakeswap.finance/pancakeswap-base-default.json',
                parse: (d: unknown) => (d as { tokens?: [] })?.tokens ?? [],
                chainId: 8453,
            },
            {
                url: 'https://raw.githubusercontent.com/hydrexfi/hydrex-lists/main/tokens/8453.json',
                parse: (d: unknown) => Array.isArray(d) ? d : [],
            },
            {
                url: 'https://tokens.uniswap.org',
                parse: (d: unknown) => (d as { tokens?: [] })?.tokens ?? [],
                chainId: 8453,
            },
            {
                url: 'https://static.optimism.io/optimism.tokenlist.json',
                parse: (d: unknown) => (d as { tokens?: [] })?.tokens ?? [],
                chainId: 8453,
            },
            {
                // WowMax is slow — fetch last, don't block others
                url: 'https://api-gateway.wowmax.exchange/chains/8453/tokens',
                parse: (d: unknown) => Array.isArray(d) ? d : [],
            },
        ];

        // Fire all fetches simultaneously — reuse same promises for both progressive UI + cache save
        const fetchPromises = sources.map(({ url, parse, chainId }) =>
            fetch(url)
                .then(r => r.json())
                .then(data => {
                    if (cancelled) return;
                    const added = addTokens(parse(data), chainId);
                    if (added) flush();
                })
                .catch(() => {}) // silent — one list failing never blocks others
        );

        // After all settle, save the fully merged list to localStorage once
        Promise.allSettled(fetchPromises).then(() => {
            if (cancelled) return;
            try {
                localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), tokens: accumulated }));
            } catch {}
        });

        return () => { cancelled = true; };
    }, []);

    // Open token page in new context
    const openTokenPage = (e: React.MouseEvent, token: Token) => {
        e.stopPropagation(); // Don't trigger token selection
        onClose();
        router.push(`/tokens/${token.address}`);
    };

    // Fetch custom token when valid address is entered
    const fetchCustomToken = useCallback(async (addr: string) => {
        if (!isValidAddress(addr)) {
            setCustomToken(null);
            setCustomError(null);
            return;
        }

        // Check if it's already in the list (including CG-fetched tokens)
        const allKnown = [...DEFAULT_TOKEN_LIST, ...cgTokens];
        const existing = allKnown.find(t => t.address.toLowerCase() === addr.toLowerCase());
        if (existing) {
            setCustomToken(null);
            setCustomError(null);
            return;
        }

        setLoadingCustom(true);
        setCustomError(null);
        try {
            const token = await fetchTokenInfo(addr);
            if (token) {
                setCustomToken(token);
            } else {
                setCustomError('Could not fetch token info');
            }
        } catch {
            setCustomError('Failed to load token');
        }
        setLoadingCustom(false);
    }, [cgTokens]);

    // Fetch external tokens for tabs
    useEffect(() => {
        if (activeTab === 'Trending' && trendingTokens.length === 0) {
            setLoadingTabs(true);
            fetch('https://api.geckoterminal.com/api/v2/networks/base/trending_pools?include=base_token')
                .then(r => r.json())
                .then(data => {
                    if (data?.included) {
                        const seen = new Set<string>();
                        const tokens = data.included
                            .filter((item: any) => item.type === 'token')
                            .map((token: any) => {
                                let validAddress = token.attributes.address;
                                try { validAddress = getAddress(validAddress); } catch (e) {}
                                return {
                                    address: validAddress,
                                    name: token.attributes.name,
                                    symbol: token.attributes.symbol,
                                    decimals: token.attributes.decimals || 18,
                                    logoURI: token.attributes.image_url?.replace('thumb', 'large') || undefined,
                                };
                            })
                            .filter((t: any) => {
                                const key = t.address.toLowerCase();
                                if (seen.has(key)) return false;
                                seen.add(key);
                                return true;
                            });
                        setTrendingTokens(tokens);
                    }
                })
                .catch(console.error)
                .finally(() => setLoadingTabs(false));
        }
        if (activeTab === 'Top Liquidity' && liquidityTokens.length === 0) {
            setLoadingTabs(true);
            fetch('https://api.geckoterminal.com/api/v2/networks/base/pools?include=base_token')
                .then(r => r.json())
                .then(data => {
                    if (data?.included) {
                        const seen = new Set<string>();
                        const tokens = data.included
                            .filter((item: any) => item.type === 'token')
                            .map((token: any) => {
                                let validAddress = token.attributes.address;
                                try { validAddress = getAddress(validAddress); } catch (e) {}
                                return {
                                    address: validAddress,
                                    name: token.attributes.name,
                                    symbol: token.attributes.symbol,
                                    decimals: token.attributes.decimals || 18,
                                    logoURI: token.attributes.image_url?.replace('thumb', 'large') || undefined,
                                };
                            })
                            .filter((t: any) => {
                                const key = t.address.toLowerCase();
                                if (seen.has(key)) return false;
                                seen.add(key);
                                return true;
                            });
                        setLiquidityTokens(tokens);
                    }
                })
                .catch(() => {})
                .finally(() => setLoadingTabs(false));
        }
    }, [activeTab]);

    useEffect(() => {
        let baseList: Token[] = activeTab === 'All'
            ? [...sortedTokens, ...cgTokens.filter(t => !sortedTokens.some(s => s.address.toLowerCase() === t.address.toLowerCase()))]
            : activeTab === 'Trending' ? trendingTokens : liquidityTokens;

        // Use baseList (tokens with balance first or from external APIs)
        const filtered = baseList.filter((token) => {
            // Exclude the already selected token in the other input
            if (excludeToken && token.address.toLowerCase() === excludeToken.address.toLowerCase()) return false;
            if (excludeTokens?.some(e => e.address.toLowerCase() === token.address.toLowerCase())) return false;

            // Filter by search
            if (search) {
                const searchLower = search.toLowerCase();
                return (
                    token.symbol.toLowerCase().includes(searchLower) ||
                    token.name.toLowerCase().includes(searchLower) ||
                    token.address.toLowerCase().includes(searchLower)
                );
            }
            return true;
        });
        setFilteredTokens(filtered);

        // Try to fetch custom token if search looks like an address
        if (isValidAddress(search)) {
            fetchCustomToken(search);
        } else {
            setCustomToken(null);
            setCustomError(null);
        }
    }, [search, excludeToken, fetchCustomToken, sortedTokens, activeTab, trendingTokens, liquidityTokens, cgTokens]);

    const handleSelect = (token: Token) => {
        if (multiSelect) {
            setMultiSelected(prev =>
                prev.some(t => t.address === token.address)
                    ? prev.filter(t => t.address !== token.address)
                    : [...prev, token]
            );
            return;
        }
        onSelect(token);
        onClose();
        setSearch('');
        setCustomToken(null);
    };

    const handleConfirmMulti = () => {
        if (onMultiSelect && multiSelected.length > 0) {
            onMultiSelect(multiSelected);
        }
        setMultiSelected([]);
        setSearch('');
        setCustomToken(null);
        onClose();
    };

    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);

    // Reset multi-selection when modal opens
    useEffect(() => {
        if (isOpen && multiSelect) {
            setMultiSelected([]);
        }
    }, [isOpen, multiSelect]);

    // Swipe to dismiss for mobile
    const { handlers: swipeHandlers, style: swipeStyle } = useSwipeToDismiss({
        onDismiss: onClose,
        threshold: 120,
        direction: 'down',
    });

    if (!mounted) return null;

    return createPortal(
        <>
            {isOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center animate-fade-in">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    {/* Modal with Swipe to Dismiss */}
                    <div
                        className="relative w-full max-w-md mx-4 touch-auto flex flex-col max-h-[90vh] animate-scale-in"
                        {...swipeHandlers}
                        style={swipeStyle}
                    >
                        {/* Drag Handle for Mobile */}
                        <div className="md:hidden w-full flex justify-center pt-2 pb-1 shrink-0">
                            <div className="w-12 h-1 rounded-full bg-white/20" />
                        </div>
                        <div className="glass-card p-6 pt-4 flex flex-col flex-1 min-h-0">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-4 shrink-0">
                                <h2 className="text-xl font-semibold">
                                    {multiSelect ? `Select Tokens${multiSelected.length > 0 ? ` (${multiSelected.length})` : ''}` : 'Select Token'}
                                </h2>
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-lg hover:bg-white/5 transition"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Search */}
                            <div className="mb-4 shrink-0">
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search by name or paste address"
                                    className="input-field text-base w-full p-3 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-primary/50"
                                />
                            </div>

                            {/* Tabs */}
                            <div className="flex gap-2 mb-4 shrink-0 overflow-x-auto no-scrollbar scroll-smooth">
                                {(['All', 'Trending', 'Top Liquidity'] as TabType[]).map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                                            activeTab === tab
                                                ? 'bg-primary text-white'
                                                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                                        }`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>

                            {/* Custom Token Import */}
                            {loadingCustom && (
                                <div className="mb-4 p-4 rounded-xl bg-primary/10 border border-primary/20 shrink-0">
                                    <div className="flex items-center gap-3">
                                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                        <span className="text-sm">Loading token info...</span>
                                    </div>
                                </div>
                            )}

                            {customError && (
                                <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 shrink-0">
                                    <p className="text-sm text-red-400">{customError}</p>
                                </div>
                            )}

                            {customToken && (
                                <div className="mb-4 p-1 rounded-xl bg-gradient-to-r from-primary/20 to-secondary/20 border border-primary/30 shrink-0">
                                    <button
                                        onClick={() => handleSelect(customToken)}
                                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-500/30 to-orange-500/30 flex items-center justify-center">
                                            <span className="text-lg font-bold text-yellow-400">{customToken.symbol[0]}</span>
                                        </div>
                                        <div className="flex-1 text-left">
                                            <div className="flex items-center gap-2">
                                                <p className="font-semibold">{customToken.symbol}</p>
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">Import</span>
                                            </div>
                                            <p className="text-sm text-gray-400">{customToken.name}</p>
                                            <p className="text-xs text-gray-500 font-mono">{customToken.address.slice(0, 10)}...{customToken.address.slice(-8)}</p>
                                        </div>
                                        {/* View Token / Share button */}
                                        <button
                                            onClick={(e) => openTokenPage(e, customToken)}
                                            className="p-2 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary transition"
                                            title={`View ${customToken.symbol} info & share`}
                                        >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                            </svg>
                                        </button>
                                    </button>
                                </div>
                            )}

                            {/* Token List */}
                            <div
                                className="flex-1 overflow-y-auto overscroll-y-auto space-y-2 pb-4 min-h-[0px]"
                                onWheel={(e) => e.stopPropagation()}
                                style={{
                                    WebkitOverflowScrolling: 'touch',
                                    overscrollBehavior: 'contain'
                                }}
                            >
                                {loadingTabs ? (
                                    <div className="flex items-center justify-center py-8">
                                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                    </div>
                                ) : filteredTokens.length === 0 && !customToken ? (
                                    <div className="text-center py-8 text-gray-400">
                                        {isValidAddress(search) ? 'Checking address...' : 'No tokens found'}
                                    </div>
                                ) : (
                                    filteredTokens.map((token) => {
                                        const isChecked = multiSelect && multiSelected.some(t => t.address === token.address);
                                        return (
                                        <button
                                            key={token.address}
                                            onClick={() => handleSelect(token)}
                                            className={`w-full flex items-center gap-3 p-3 rounded-xl transition hover:bg-white/5 ${
                                                isChecked
                                                    ? 'bg-indigo-500/10 border border-indigo-500/30'
                                                    : selectedToken?.address === token.address
                                                        ? 'bg-primary/10 border border-primary/30'
                                                        : ''
                                            }`}
                                        >
                                            {/* Token Icon */}
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                                                {token.logoURI ? (
                                                    <img
                                                        src={token.logoURI}
                                                        alt={token.symbol}
                                                        className="w-8 h-8 rounded-full"
                                                        loading="lazy"
                                                        onError={(e) => {
                                                            const img = e.target as HTMLImageElement;
                                                            img.style.display = 'none';
                                                            const fallback = img.nextSibling as HTMLElement | null;
                                                            if (fallback) fallback.style.display = '';
                                                        }}
                                                    />
                                                ) : null}
                                                <span className="text-lg font-bold" style={token.logoURI ? { display: 'none' } : {}}>{token.symbol[0]}</span>
                                            </div>

                                            {/* Token Info */}
                                            <div className="flex-1 text-left">
                                                <p className="font-semibold">{token.symbol}</p>
                                                <p className="text-sm text-gray-400">{token.name}</p>
                                            </div>

                                            {/* Balance + USD value */}
                                            {(() => {
                                                const balanceInfo = getBalance(token.address);
                                                const numBal = parseFloat(balanceInfo?.formatted || '0');
                                                const usdValue = balanceInfo?.usdValue;
                                                return numBal > 0 ? (
                                                    <div className="text-right">
                                                        <p className="text-sm text-white font-medium">
                                                            {numBal > 1000 ? numBal.toLocaleString(undefined, { maximumFractionDigits: 2 }) : numBal.toFixed(4)}
                                                        </p>
                                                        {usdValue !== undefined && usdValue > 0 && (
                                                            <p className="text-xs text-gray-400">
                                                                ${usdValue >= 1000
                                                                    ? usdValue.toLocaleString(undefined, { maximumFractionDigits: 0 })
                                                                    : usdValue.toFixed(2)}
                                                            </p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-gray-500">0</p>
                                                );
                                            })()}

                                            {/* Multi-select checkbox OR Share/Info Icon */}
                                            {multiSelect ? (
                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${isChecked ? 'bg-indigo-500 border-indigo-500' : 'border-white/30'}`}>
                                                    {isChecked && (
                                                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    )}
                                                </div>
                                            ) : !token.isNative && (
                                                <div
                                                    onClick={(e) => openTokenPage(e, token)}
                                                    className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-primary transition cursor-pointer"
                                                    title={`View ${token.symbol} info & share`}
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                                    </svg>
                                                </div>
                                            )}
                                        </button>
                                        );
                                    })
                                )}
                            </div>

                            {/* Confirm button (multi-select) or Help Text */}
                            <div className="mt-4 pt-4 border-t border-white/5 shrink-0">
                                {multiSelect ? (
                                    <button
                                        onClick={handleConfirmMulti}
                                        disabled={multiSelected.length === 0}
                                        className={`w-full py-3 rounded-xl font-semibold transition-all ${
                                            multiSelected.length > 0
                                                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 hover:scale-[1.01] active:scale-[0.99]'
                                                : 'bg-white/5 text-gray-500 cursor-not-allowed'
                                        }`}
                                    >
                                        {multiSelected.length === 0
                                            ? 'Select tokens above'
                                            : `Add ${multiSelected.length} Token${multiSelected.length > 1 ? 's' : ''}`}
                                    </button>
                                ) : (
                                    <p className="text-sm text-gray-400 text-center">
                                        Paste a token contract address to import any ERC-20 token
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>,
        document.body
    );
}

