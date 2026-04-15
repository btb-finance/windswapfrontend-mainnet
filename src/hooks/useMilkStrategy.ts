'use client';

import { useState, useEffect, useCallback } from 'react';
import { useReadContracts } from 'wagmi';
import { useMixedRouteQuoter } from '@/hooks/useMixedRouteQuoter';
import { MILK, USDC } from '@/config/tokens';
import { MILK_CONTRACTS } from '@/config/contracts';
import { MILK_ABI } from '@/config/abis';

const MILK_ADDRESS = MILK_CONTRACTS.MILK as `0x${string}`;

// FEE_BASE_1000 = 1000 (from contract)
const FEE_BASE = 1000;

export type AlertLevel = 'none' | 'active';

export interface MilkStrategyData {
    // Contract data
    fairValue: number | null;           // USD per MILK  (lastPrice / 1e6)
    contractRedeemPrice: number | null; // fairValue * sell_fee / 1000
    contractMintPrice: number | null;   // fairValue / (buy_fee / 1000)
    sellFee: number;                    // e.g. 0.975
    buyFee: number;                     // e.g. 0.975
    backing: bigint | null;             // raw USDC (6 dec)
    contractLoading: boolean;

    // DEX data
    dexPrice: number | null;            // USD per MILK on WindSwap
    dexPriceLoading: boolean;

    // Derived
    discount: number | null;            // positive = DEX below fair value
    discountPct: number | null;         // as percentage
    premiumPct: number | null;          // positive = DEX above mint price (mint arb)
    alertLevel: AlertLevel;
    instantArb: boolean;                // DEX price below redeem floor

    // Gain if DEX recovers to fair value
    expectedGainOnRecovery: number | null;

    lastUpdated: number | null;
    refresh: () => void;
}

export function useMilkStrategy(): MilkStrategyData {
    const { getSpotRate } = useMixedRouteQuoter();

    // ── Contract reads (all in one multicall) ────────────────────────────────
    const { data: contractData, isLoading: contractLoading } = useReadContracts({
        contracts: [
            { address: MILK_ADDRESS, abi: MILK_ABI, functionName: 'lastPrice' },
            { address: MILK_ADDRESS, abi: MILK_ABI, functionName: 'sell_fee' },
            { address: MILK_ADDRESS, abi: MILK_ABI, functionName: 'getBuyFee' },
            { address: MILK_ADDRESS, abi: MILK_ABI, functionName: 'getBacking' },
        ],
        query: { refetchInterval: 15000 },
    });

    // Parse contract values
    const rawLastPrice = contractData?.[0]?.result as bigint | undefined;
    const rawSellFee   = contractData?.[1]?.result as number | undefined;
    const rawBuyFee    = contractData?.[2]?.result as bigint | undefined;
    const rawBacking   = contractData?.[3]?.result as bigint | undefined;

    // fairValue in USD: lastPrice = getBacking() * 1e18 / totalSupply()
    // when price = $1, lastPrice = 1e6 (because USDC is 6 dec, MILK is 18 dec)
    // so USD price = lastPrice / 1e6
    const fairValue = rawLastPrice !== undefined
        ? Number(rawLastPrice) / 1e6
        : null;

    const sellFee = rawSellFee !== undefined ? rawSellFee / FEE_BASE : 0.975;
    const buyFee  = rawBuyFee  !== undefined ? Number(rawBuyFee) / FEE_BASE : 0.975;

    const contractRedeemPrice = fairValue !== null ? fairValue * sellFee : null;
    const contractMintPrice   = fairValue !== null ? fairValue / buyFee  : null;

    // ── DEX price (MILK → USDC on WindSwap) ──────────────────────────────────
    const [dexPrice, setDexPrice] = useState<number | null>(null);
    const [dexPriceLoading, setDexPriceLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<number | null>(null);

    const fetchDexPrice = useCallback(async () => {
        setDexPriceLoading(true);
        try {
            // getSpotRate(MILK, USDC) → USDC per 1 MILK on the DEX
            const rate = await getSpotRate(MILK, USDC);
            if (rate !== null && rate > 0) {
                setDexPrice(rate);
                setLastUpdated(Date.now());
            }
        } catch {
            // silently fail — show stale data
        } finally {
            setDexPriceLoading(false);
        }
    }, [getSpotRate]);

    useEffect(() => {
        fetchDexPrice();
        const interval = setInterval(fetchDexPrice, 15000);
        return () => clearInterval(interval);
    }, [fetchDexPrice]);

    // ── Derived values ────────────────────────────────────────────────────────
    const discount = (fairValue !== null && dexPrice !== null)
        ? fairValue - dexPrice
        : null;

    const discountPct = (fairValue !== null && discount !== null)
        ? (discount / fairValue) * 100
        : null;

    // Mint arb: how far above contract mint price is the DEX
    const premiumPct = (dexPrice !== null && contractMintPrice !== null && dexPrice > contractMintPrice)
        ? ((dexPrice - contractMintPrice) / contractMintPrice) * 100
        : null;

    // Any DEX price below fair value = buy zone
    const alertLevel: AlertLevel = (discountPct !== null && discountPct > 0) ? 'active' : 'none';

    // Instant arb: DEX price is below the contract redeem floor
    const instantArb = dexPrice !== null && contractRedeemPrice !== null && dexPrice < contractRedeemPrice;

    const expectedGainOnRecovery = (dexPrice !== null && fairValue !== null && dexPrice > 0)
        ? ((fairValue - dexPrice) / dexPrice) * 100
        : null;

    return {
        fairValue,
        contractRedeemPrice,
        contractMintPrice,
        sellFee,
        buyFee,
        backing: rawBacking ?? null,
        contractLoading,
        dexPrice,
        dexPriceLoading,
        discount,
        discountPct,
        premiumPct,
        alertLevel,
        instantArb,
        expectedGainOnRecovery,
        lastUpdated,
        refresh: fetchDexPrice,
    };
}
