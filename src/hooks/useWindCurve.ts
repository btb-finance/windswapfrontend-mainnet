'use client';

import { useReadContract } from 'wagmi';
import { WIND_CURVE_CONTRACTS } from '@/config/contracts';
import { WIND_BONDING_CURVE_ABI, WIND_STAKING_ABI, ERC20_ABI } from '@/config/abis';
import { sei } from '@/config/chains';
import { useWriteContract } from '@/hooks/useWriteContract';

const BC = WIND_CURVE_CONTRACTS.BondingCurve as `0x${string}`;
const STAKING = WIND_CURVE_CONTRACTS.Staking as `0x${string}`;
const BTB = WIND_CURVE_CONTRACTS.BTBToken as `0x${string}`;

// ── Bonding Curve reads ────────────────────────────────────────────────────

export function useWindMarketInfo() {
    return useReadContract({
        address: BC,
        abi: WIND_BONDING_CURVE_ABI,
        functionName: 'getMarketInfo',
        chainId: sei.id,
        query: { refetchInterval: 10000 },
    });
}

export function useWindCurrentPrice() {
    return useReadContract({
        address: BC,
        abi: WIND_BONDING_CURVE_ABI,
        functionName: 'getCurrentPrice',
        chainId: sei.id,
        query: { refetchInterval: 10000 },
    });
}

export function useWindBuyInfo(amount: bigint | undefined) {
    return useReadContract({
        address: BC,
        abi: WIND_BONDING_CURVE_ABI,
        functionName: 'getBuyInfo',
        args: amount && amount > 0n ? [amount] : undefined,
        chainId: sei.id,
        query: { enabled: !!amount && amount > 0n, refetchInterval: 5000 },
    });
}

export function useWindSellInfo(amount: bigint | undefined) {
    return useReadContract({
        address: BC,
        abi: WIND_BONDING_CURVE_ABI,
        functionName: 'getSellInfo',
        args: amount && amount > 0n ? [amount] : undefined,
        chainId: sei.id,
        query: { enabled: !!amount && amount > 0n, refetchInterval: 5000 },
    });
}

export function useWindReserveHealth() {
    return useReadContract({
        address: BC,
        abi: WIND_BONDING_CURVE_ABI,
        functionName: 'getReserveHealth',
        chainId: sei.id,
        query: { refetchInterval: 15000 },
    });
}

export function useWindUserInfo(user: `0x${string}` | undefined) {
    return useReadContract({
        address: BC,
        abi: WIND_BONDING_CURVE_ABI,
        functionName: 'getUserInfo',
        args: user ? [user] : undefined,
        chainId: sei.id,
        query: { enabled: !!user, refetchInterval: 10000 },
    });
}

export function useWindcBalance(user: `0x${string}` | undefined) {
    return useReadContract({
        address: BC,
        abi: WIND_BONDING_CURVE_ABI,
        functionName: 'balanceOf',
        args: user ? [user] : undefined,
        chainId: sei.id,
        query: { enabled: !!user, refetchInterval: 10000 },
    });
}

export function useBTBBalance(user: `0x${string}` | undefined) {
    return useReadContract({
        address: BTB,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: user ? [user] : undefined,
        chainId: sei.id,
        query: { enabled: !!user, refetchInterval: 10000 },
    });
}

export function useBTBAllowanceForCurve(user: `0x${string}` | undefined) {
    return useReadContract({
        address: BTB,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: user ? [user, BC] : undefined,
        chainId: sei.id,
        query: { enabled: !!user },
    });
}

export function useWindcAllowanceForStaking(user: `0x${string}` | undefined) {
    return useReadContract({
        address: BC,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: user ? [user, STAKING] : undefined,
        chainId: sei.id,
        query: { enabled: !!user },
    });
}

// ── Bonding Curve writes ───────────────────────────────────────────────────

export function useApproveBTBForCurve() {
    const { writeContractAsync, isPending, isSuccess, isError, error } = useWriteContract();
    const approve = (amount: bigint) => writeContractAsync({
        address: BTB, abi: ERC20_ABI, functionName: 'approve',
        args: [BC, amount], chainId: sei.id,
    });
    return { approve, isPending, isSuccess, isError, error };
}

export function useWindBuy() {
    const { writeContractAsync, isPending, isSuccess, isError, error } = useWriteContract();
    const buy = (amount: bigint) => writeContractAsync({
        address: BC, abi: WIND_BONDING_CURVE_ABI, functionName: 'buy',
        args: [amount], chainId: sei.id,
    });
    return { buy, isPending, isSuccess, isError, error };
}

export function useWindSell() {
    const { writeContractAsync, isPending, isSuccess, isError, error } = useWriteContract();
    const sell = (amount: bigint) => writeContractAsync({
        address: BC, abi: WIND_BONDING_CURVE_ABI, functionName: 'sell',
        args: [amount], chainId: sei.id,
    });
    return { sell, isPending, isSuccess, isError, error };
}

// ── Staking reads ──────────────────────────────────────────────────────────

export function useStakingGlobalInfo() {
    return useReadContract({
        address: STAKING,
        abi: WIND_STAKING_ABI,
        functionName: 'getGlobalInfo',
        chainId: sei.id,
        query: { refetchInterval: 10000 },
    });
}

export function useEmergencyUnstakeEnabled() {
    return useReadContract({
        address: STAKING,
        abi: WIND_STAKING_ABI,
        functionName: 'emergencyUnstakeEnabled',
        chainId: sei.id,
        query: { refetchInterval: 30000 },
    });
}

export function useStakingAPR() {
    return useReadContract({
        address: STAKING,
        abi: WIND_STAKING_ABI,
        functionName: 'getAPR',
        chainId: sei.id,
        query: { refetchInterval: 15000 },
    });
}

export function useStakingUserInfo(user: `0x${string}` | undefined) {
    return useReadContract({
        address: STAKING,
        abi: WIND_STAKING_ABI,
        functionName: 'getUserInfo',
        args: user ? [user] : undefined,
        chainId: sei.id,
        query: { enabled: !!user, refetchInterval: 10000 },
    });
}

// ── Staking writes ─────────────────────────────────────────────────────────

export function useApproveWindcForStaking() {
    const { writeContractAsync, isPending, isSuccess, isError, error } = useWriteContract();
    const approve = (amount: bigint) => writeContractAsync({
        address: BC, abi: ERC20_ABI, functionName: 'approve',
        args: [STAKING, amount], chainId: sei.id,
    });
    return { approve, isPending, isSuccess, isError, error };
}

export function useStake() {
    const { writeContractAsync, isPending, isSuccess, isError, error } = useWriteContract();
    const stake = (amount: bigint) => writeContractAsync({
        address: STAKING, abi: WIND_STAKING_ABI, functionName: 'stake',
        args: [amount], chainId: sei.id,
    });
    return { stake, isPending, isSuccess, isError, error };
}

export function useUnstake() {
    const { writeContractAsync, isPending, isSuccess, isError, error } = useWriteContract();
    const unstake = (amount: bigint) => writeContractAsync({
        address: STAKING, abi: WIND_STAKING_ABI, functionName: 'unstake',
        args: [amount], chainId: sei.id,
    });
    return { unstake, isPending, isSuccess, isError, error };
}

export function useClaimRewards() {
    const { writeContractAsync, isPending, isSuccess, isError, error } = useWriteContract();
    const claim = () => writeContractAsync({
        address: STAKING, abi: WIND_STAKING_ABI, functionName: 'claimRewards',
        args: [], chainId: sei.id,
    });
    return { claim, isPending, isSuccess, isError, error };
}

export function useEmergencyUnstake() {
    const { writeContractAsync, isPending, isSuccess, isError, error } = useWriteContract();
    const emergencyUnstake = () => writeContractAsync({
        address: STAKING, abi: WIND_STAKING_ABI, functionName: 'emergencyUnstake',
        args: [], chainId: sei.id,
    });
    return { emergencyUnstake, isPending, isSuccess, isError, error };
}
