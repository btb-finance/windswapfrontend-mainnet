'use client';

import { useState, useEffect } from 'react';
import { WIND, WSEI } from '@/config/tokens';
import { fetchSubgraph } from '@/config/subgraph';

/**
 * Hook to get WIND and SEI prices in USD from DEX pools
 */
export function useWindPrice() {
    const [windPrice, setWindPrice] = useState<number>(0.005); // Default fallback
    const [seiPrice, setSeiPrice] = useState<number>(0.35); // Default fallback
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchPricesFromSubgraph = async (): Promise<{ windPrice?: number; seiPrice?: number } | null> => {
            try {
                const query = `query Prices($ids: [String!]) {
                    tokens(where: { id_in: $ids }) {
                        id
                        symbol
                        priceUSD
                    }
                }`;

                const variables = {
                    ids: [WIND.address.toLowerCase(), WSEI.address.toLowerCase()],
                };

                const data = await fetchSubgraph<{ tokens: Array<{ id: string; symbol: string; priceUSD: string }> }>(query, variables);
                const tokens = data?.tokens || [];
                const byId = new Map(tokens.map(t => [String(t.id).toLowerCase(), t]));

                const wind = byId.get(WIND.address.toLowerCase());
                const wsei = byId.get(WSEI.address.toLowerCase());

                const windUsd = wind ? parseFloat(wind.priceUSD || '0') : 0;
                const seiUsd = wsei ? parseFloat(wsei.priceUSD || '0') : 0;

                return {
                    windPrice: windUsd > 0 ? windUsd : undefined,
                    seiPrice: seiUsd > 0 ? seiUsd : undefined,
                };
            } catch {
                return null;
            }
        };

        const fetchPrices = async () => {
            try {
                const subgraph = await fetchPricesFromSubgraph();
                if (subgraph?.windPrice) setWindPrice(subgraph.windPrice);
                if (subgraph?.seiPrice) setSeiPrice(subgraph.seiPrice);
            } catch (err) {
                console.error('[useWindPrice] Error fetching prices:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPrices();

        // Refresh prices every 5 minutes
        const interval = setInterval(fetchPrices, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    return { windPrice, seiPrice, isLoading };
}

// APR calculation functions have been moved to src/utils/aprCalculator.ts
// Use the centralized calculator for all APR calculations:
// - calculatePoolAPR(rewardRate, windPrice, tvl, tickSpacing?)
// - calculateBaseAPR(rewardRate, windPrice, tvl)
// - calculateRangeAdjustedAPR(baseAPR, tickLower, tickUpper, currentTick)
// - formatAPR(apr)

