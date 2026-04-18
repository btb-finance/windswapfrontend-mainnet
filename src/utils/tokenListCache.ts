// Shared token-list cache for all consumers (TokenSelector, UserBalanceProvider, etc.)
//
// - Persists merged Base token list in localStorage for 7 days
// - Stale-while-revalidate: serves cache instantly if <1 day old; 1-7 days old serves cache
//   AND refreshes in background; >7 days fetches fresh
// - Dedupes concurrent fetches via a module-level in-flight promise, so that two consumers
//   mounting within the same tick only hit each upstream URL once per visit

import { getAddress } from 'viem';
import { DEFAULT_TOKEN_LIST, Token } from '@/config/tokens';

const CACHE_KEY = 'wind_token_list_v3';
export const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
export const SWR_THRESHOLD = 24 * 60 * 60 * 1000; // refresh in background after 1 day

interface CacheEntry {
    ts: number;
    tokens: Token[];
}

// In-flight network fetch — shared across all callers for the duration of a single refresh
let inFlight: Promise<Token[]> | null = null;
// In-memory mirror of the cache so repeated reads within a session are free
let memoryCache: CacheEntry | null = null;

export function readCachedTokens(): { tokens: Token[]; ageMs: number } | null {
    if (memoryCache) {
        return { tokens: memoryCache.tokens, ageMs: Date.now() - memoryCache.ts };
    }
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as CacheEntry;
        if (!parsed || !Array.isArray(parsed.tokens) || typeof parsed.ts !== 'number') return null;
        memoryCache = parsed;
        return { tokens: parsed.tokens, ageMs: Date.now() - parsed.ts };
    } catch {
        return null;
    }
}

function writeCache(tokens: Token[]) {
    memoryCache = { ts: Date.now(), tokens };
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(memoryCache));
    } catch {}
}

// Source list definitions — ordered fastest-first for the progressive variant
interface Source {
    url: string;
    parse: (d: unknown) => Array<{ address: string; name: string; symbol: string; decimals: number; logoURI?: string; chainId?: number }>;
    chainId?: number;
}

const SOURCES: Source[] = [
    {
        url: 'https://tokens.pancakeswap.finance/pancakeswap-base-default.json',
        parse: (d) => (d as { tokens?: [] })?.tokens ?? [],
        chainId: 8453,
    },
    {
        url: 'https://raw.githubusercontent.com/hydrexfi/hydrex-lists/main/tokens/8453.json',
        parse: (d) => Array.isArray(d) ? d : [],
    },
    {
        url: 'https://tokens.uniswap.org',
        parse: (d) => (d as { tokens?: [] })?.tokens ?? [],
        chainId: 8453,
    },
    {
        url: 'https://static.optimism.io/optimism.tokenlist.json',
        parse: (d) => (d as { tokens?: [] })?.tokens ?? [],
        chainId: 8453,
    },
    {
        // WowMax is slow — fetch last, don't block others
        url: 'https://api-gateway.wowmax.exchange/chains/8453/tokens',
        parse: (d) => Array.isArray(d) ? d : [],
    },
];

async function fetchAllAndMerge(): Promise<Token[]> {
    const seen = new Set<string>(DEFAULT_TOKEN_LIST.map(t => t.address.toLowerCase()));
    const tokens: Token[] = [];

    const results = await Promise.allSettled(
        SOURCES.map(s => fetch(s.url).then(r => r.json()))
    );

    results.forEach((r, i) => {
        if (r.status !== 'fulfilled') return;
        const src = SOURCES[i];
        for (const t of src.parse(r.value)) {
            if (src.chainId && t.chainId !== src.chainId) continue;
            const key = t.address.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            let addr = t.address;
            try { addr = getAddress(addr); } catch {}
            tokens.push({
                address: addr,
                name: t.name,
                symbol: t.symbol,
                decimals: t.decimals,
                logoURI: t.logoURI || undefined,
            });
        }
    });

    return tokens;
}

/**
 * Ensure a token list is loaded — returns cached value instantly when fresh,
 * otherwise fetches (deduped across concurrent callers) and caches the result.
 */
export function loadExtendedTokenList(): Promise<Token[]> {
    const cached = readCachedTokens();
    const age = cached?.ageMs ?? Infinity;

    // Fully fresh: skip network entirely.
    if (cached && age < SWR_THRESHOLD) {
        return Promise.resolve(cached.tokens);
    }

    // Stale but usable: kick off a background refresh, return cached.
    if (cached && age < CACHE_TTL) {
        if (!inFlight) {
            inFlight = fetchAllAndMerge()
                .then(fresh => { writeCache(fresh); return fresh; })
                .catch(() => cached.tokens)
                .finally(() => { inFlight = null; });
        }
        return Promise.resolve(cached.tokens);
    }

    // Cold miss or expired: dedupe concurrent callers onto one network fetch.
    if (!inFlight) {
        inFlight = fetchAllAndMerge()
            .then(fresh => { writeCache(fresh); return fresh; })
            .finally(() => { inFlight = null; });
    }
    return inFlight;
}
