/**
 * Lightweight SWR-style caching for RPC calls
 * Optimized for quote fetching - caches for short duration to prevent redundant calls
 */

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    key: string;
}

const cache = new Map<string, CacheEntry<unknown>>();

// Default cache TTL: 3 seconds for quotes (fast enough for UX, prevents redundant calls)
const DEFAULT_TTL = 3000;

// Longer cache for static data like token metadata
const STATIC_TTL = 1000 * 60 * 60; // 1 hour

/**
 * Get cached data or fetch fresh
 */
export async function swrCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = DEFAULT_TTL
): Promise<T> {
    const now = Date.now();
    const cached = cache.get(key);

    // Return cached data if still fresh
    if (cached && now - cached.timestamp < ttl) {
        return cached.data as T;
    }

    // Fetch fresh data
    const data = await fetcher();
    
    // Store in cache
    cache.set(key, {
        data,
        timestamp: now,
        key,
    });

    return data;
}

/**
 * Get cached data synchronously (returns null if not cached or stale)
 */
export function getCached<T>(key: string, ttl: number = DEFAULT_TTL): T | null {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < ttl) {
        return cached.data as T;
    }
    return null;
}

/**
 * Set cache entry directly
 */
export function setCache<T>(key: string, data: T): void {
    cache.set(key, {
        data,
        timestamp: Date.now(),
        key,
    });
}

/**
 * Invalidate specific cache entry
 */
export function invalidateCache(key: string): void {
    cache.delete(key);
}

/**
 * Invalidate all cache entries matching a pattern
 */
export function invalidateCachePattern(pattern: string): void {
    for (const key of cache.keys()) {
        if (key.includes(pattern)) {
            cache.delete(key);
        }
    }
}

/**
 * Clear entire cache
 */
export function clearCache(): void {
    cache.clear();
}

/**
 * Generate cache key for quote requests
 */
export function getQuoteCacheKey(
    type: 'v2' | 'v2-out' | 'v3' | 'v3-out',
    tokenIn: string,
    tokenOut: string,
    amount: string,
    stable?: boolean,
    tickSpacing?: number
): string {
    const parts = [`quote:${type}`, tokenIn.toLowerCase(), tokenOut.toLowerCase(), amount];
    if (stable !== undefined) parts.push(`s:${stable}`);
    if (tickSpacing !== undefined) parts.push(`t:${tickSpacing}`);
    return parts.join(':');
}

// LocalStorage cache for static token metadata
const TOKEN_METADATA_KEY = 'windswap_token_metadata';

interface TokenMetadata {
    symbol: string;
    name: string;
    decimals: number;
    timestamp: number;
}

/**
 * Get token metadata from localStorage cache
 */
export function getTokenMetadataFromCache(address: string): TokenMetadata | null {
    try {
        const cached = localStorage.getItem(`${TOKEN_METADATA_KEY}_${address.toLowerCase()}`);
        if (cached) {
            const data = JSON.parse(cached) as TokenMetadata;
            // Check if cache is still valid (1 hour)
            if (Date.now() - data.timestamp < STATIC_TTL) {
                return data;
            }
        }
    } catch {
        // localStorage not available or parse error
    }
    return null;
}

/**
 * Save token metadata to localStorage cache
 */
export function setTokenMetadataCache(address: string, metadata: Omit<TokenMetadata, 'timestamp'>): void {
    try {
        const data: TokenMetadata = {
            ...metadata,
            timestamp: Date.now(),
        };
        localStorage.setItem(`${TOKEN_METADATA_KEY}_${address.toLowerCase()}`, JSON.stringify(data));
    } catch {
        // localStorage not available
    }
}

/**
 * Request deduplication - prevents multiple in-flight requests for same key
 */
const inFlightRequests = new Map<string, Promise<unknown>>();

export async function dedupeRequest<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const existing = inFlightRequests.get(key);
    if (existing) {
        return existing as Promise<T>;
    }

    const promise = fetcher().finally(() => {
        inFlightRequests.delete(key);
    });

    inFlightRequests.set(key, promise);
    return promise;
}
