// WowMax DEX Aggregator API integration
// Used as fallback when WindSwap has no liquidity for a pair

const WOWMAX_BASE_URL = 'https://api-gateway.wowmax.exchange';
const BASE_CHAIN_ID = 8453;

export interface WowMaxToken {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
}

export interface WowMaxQuote {
    requestId: string;
    amountIn: string;
    amountOut: string;
    gasUnitsConsumed: number;
    gasPrice: number;
    from: WowMaxToken;
    to: WowMaxToken;
    price: number;
    priceImpact: number;
}

export interface WowMaxSwapData {
    requestId: string;
    contract: string;
    from: string;
    to: string[];
    amountIn: string;
    value: string;
    amountOut: string[];
    price: number;
    priceImpact: number;
    data: string; // tx calldata
    gasUnitsConsumed: number;
    gasPrice: number;
}

/**
 * Get a quote from WowMax aggregator
 */
export async function getWowMaxQuote(
    fromAddress: string,
    toAddress: string,
    amount: string,
): Promise<WowMaxQuote | null> {
    try {
        const params = new URLSearchParams({
            from: fromAddress,
            to: toAddress,
            amount,
        });
        const res = await fetch(`${WOWMAX_BASE_URL}/chains/${BASE_CHAIN_ID}/quote?${params}`);
        if (!res.ok) return null;
        const data = await res.json();
        if (!data || !data.amountOut) return null;
        return data as WowMaxQuote;
    } catch (err) {
        console.error('[WowMax] Quote error:', err);
        return null;
    }
}

/**
 * Get swap transaction data from WowMax aggregator
 */
export async function getWowMaxSwapData(
    fromAddress: string,
    toAddress: string,
    amount: string,
    slippage: number,
    trader: string,
): Promise<WowMaxSwapData | null> {
    try {
        const params = new URLSearchParams({
            from: fromAddress,
            to: toAddress,
            amount,
            slippage: slippage.toString(),
            trader,
        });
        const res = await fetch(`${WOWMAX_BASE_URL}/chains/${BASE_CHAIN_ID}/swap?${params}`);
        if (!res.ok) return null;
        const data = await res.json();
        if (!data || !data.data) return null;
        return data as WowMaxSwapData;
    } catch (err) {
        console.error('[WowMax] Swap data error:', err);
        return null;
    }
}

/**
 * Fetch all tokens available on Base from WowMax
 */
export async function getWowMaxTokens(): Promise<WowMaxToken[]> {
    try {
        const res = await fetch(`${WOWMAX_BASE_URL}/chains/${BASE_CHAIN_ID}/tokens`);
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : [];
    } catch (err) {
        console.error('[WowMax] Tokens fetch error:', err);
        return [];
    }
}
