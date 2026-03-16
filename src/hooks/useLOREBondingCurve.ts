'use client';

import { useReadContract } from 'wagmi';
import { parseEther } from 'viem';
import { LORE_MINING_CONTRACTS } from '@/config/contracts';
import { LORE_BONDING_CURVE_ABI, ERC20_ABI } from '@/config/abis';
import { sei } from '@/config/chains';
import { useWriteContract } from '@/hooks/useWriteContract';

const BC_ADDRESS = LORE_MINING_CONTRACTS.BondingCurve as `0x${string}`;
const LORE_ADDRESS = LORE_MINING_CONTRACTS.LoreToken as `0x${string}`;

export function useBondingCurveMarketInfo() {
    return useReadContract({
        address: BC_ADDRESS,
        abi: LORE_BONDING_CURVE_ABI,
        functionName: 'getMarketInfo',
        chainId: sei.id,
        query: {
            refetchInterval: 10000,
        },
    });
}

export function useBondingCurveCurrentPrice() {
    return useReadContract({
        address: BC_ADDRESS,
        abi: LORE_BONDING_CURVE_ABI,
        functionName: 'getCurrentPrice',
        chainId: sei.id,
        query: {
            refetchInterval: 10000,
        },
    });
}

export function usePreviewBuy(seiAmountWei: bigint | undefined) {
    return useReadContract({
        address: BC_ADDRESS,
        abi: LORE_BONDING_CURVE_ABI,
        functionName: 'previewBuy',
        args: seiAmountWei && seiAmountWei > BigInt(0) ? [seiAmountWei] : undefined,
        chainId: sei.id,
        query: {
            enabled: !!seiAmountWei && seiAmountWei > BigInt(0),
            refetchInterval: 5000,
        },
    });
}

export function usePreviewSell(loreAmountWei: bigint | undefined) {
    return useReadContract({
        address: BC_ADDRESS,
        abi: LORE_BONDING_CURVE_ABI,
        functionName: 'previewSell',
        args: loreAmountWei && loreAmountWei > BigInt(0) ? [loreAmountWei] : undefined,
        chainId: sei.id,
        query: {
            enabled: !!loreAmountWei && loreAmountWei > BigInt(0),
            refetchInterval: 5000,
        },
    });
}

export function useLoreAllowanceForBondingCurve(owner: `0x${string}` | undefined) {
    return useReadContract({
        address: LORE_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: owner ? [owner, BC_ADDRESS] : undefined,
        chainId: sei.id,
        query: {
            enabled: !!owner,
        },
    });
}

export function useBuyLore() {
    const { writeContractAsync, isPending, isSuccess, isError, error } = useWriteContract();

    const buy = async (seiAmountWei: bigint) => {
        return writeContractAsync({
            address: BC_ADDRESS,
            abi: LORE_BONDING_CURVE_ABI,
            functionName: 'buy',
            args: [],
            value: seiAmountWei,
            chainId: sei.id,
        });
    };

    return { buy, isPending, isSuccess, isError, error };
}

export function useSellLore() {
    const { writeContractAsync, isPending, isSuccess, isError, error } = useWriteContract();

    const sell = async (loreAmountWei: bigint) => {
        return writeContractAsync({
            address: BC_ADDRESS,
            abi: LORE_BONDING_CURVE_ABI,
            functionName: 'sell',
            args: [loreAmountWei],
            chainId: sei.id,
        });
    };

    return { sell, isPending, isSuccess, isError, error };
}

export function useApproveLoreForBondingCurve() {
    const { writeContractAsync, isPending, isSuccess, isError, error } = useWriteContract();

    const approve = async (amountWei: bigint) => {
        return writeContractAsync({
            address: LORE_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [BC_ADDRESS, amountWei],
            chainId: sei.id,
        });
    };

    return { approve, isPending, isSuccess, isError, error };
}
