// KyberSwap DEX Aggregator API integration
// https://docs.kyberswap.com/kyberswap-solutions/kyberswap-aggregator/aggregator-api-specification

const KYBER_BASE_URL = 'https://aggregator-api.kyberswap.com/base/api/v1';

export interface KyberQuote {
    routeSummary: object;
    amountOut: string;
    amountOutUsd: number;
    gas: string;
}

export interface KyberSwapData {
    routerAddress: string;
    data: string;
    amountOut: string;
}

/**
 * Get a quote from KyberSwap aggregator
 */
export async function getKyberQuote(
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
): Promise<KyberQuote | null> {
    try {
        const params = new URLSearchParams({ tokenIn, tokenOut, amountIn, gasInclude: 'true' });
        const res = await fetch(`${KYBER_BASE_URL}/routes?${params}`);
        if (!res.ok) return null;
        const data = await res.json();
        const routeSummary = data?.data?.routeSummary;
        if (!routeSummary?.amountOut) return null;
        return {
            routeSummary,
            amountOut: routeSummary.amountOut,
            amountOutUsd: routeSummary.amountOutUsd ?? 0,
            gas: routeSummary.gas ?? '0',
        };
    } catch (err) {
        console.warn('[KyberSwap] Quote error:', err);
        return null;
    }
}

/**
 * Build swap transaction data from KyberSwap
 * slippageTolerance is in bps (50 = 0.5%)
 */
export async function getKyberSwapData(
    routeSummary: object,
    sender: string,
    recipient: string,
    slippageTolerance: number,
): Promise<KyberSwapData | null> {
    try {
        const res = await fetch(`${KYBER_BASE_URL}/route/build`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ routeSummary, slippageTolerance, sender, recipient }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        const d = data?.data;
        if (!d?.routerAddress || !d?.data) return null;
        return {
            routerAddress: d.routerAddress,
            data: d.data,
            amountOut: d.amountOut ?? '0',
        };
    } catch (err) {
        console.warn('[KyberSwap] Swap data error:', err);
        return null;
    }
}
