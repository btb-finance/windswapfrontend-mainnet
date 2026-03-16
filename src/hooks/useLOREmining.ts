'use client';

import { useReadContract, useAccount } from 'wagmi';
import { parseEther } from 'viem';
import { LORE_MINING_CONTRACTS } from '@/config/contracts';
import { LORE_MINING_ABI } from '@/config/abis';
import { sei } from '@/config/chains';
import { useWriteContract } from '@/hooks/useWriteContract';

const CONTRACT = LORE_MINING_CONTRACTS.LOREmining as `0x${string}`;

// ============================================
// Read Hooks
// ============================================

export function useCurrentRound() {
    return useReadContract({
        address: CONTRACT,
        abi: LORE_MINING_ABI,
        functionName: 'getCurrentRound',
        chainId: sei.id,
        query: {
            refetchInterval: 5000,
        },
    });
}

export function useCurrentRoundId() {
    return useReadContract({
        address: CONTRACT,
        abi: LORE_MINING_ABI,
        functionName: 'currentRoundId',
        chainId: sei.id,
        query: {
            refetchInterval: 5000,
        },
    });
}

export function useTimeRemaining() {
    return useReadContract({
        address: CONTRACT,
        abi: LORE_MINING_ABI,
        functionName: 'getCurrentRoundTimeRemaining',
        chainId: sei.id,
        query: {
            refetchInterval: 3000,
        },
    });
}

export function useMinerStats(address: `0x${string}` | undefined) {
    return useReadContract({
        address: CONTRACT,
        abi: LORE_MINING_ABI,
        functionName: 'minerStats',
        args: address ? [address] : undefined,
        chainId: sei.id,
        query: {
            enabled: !!address,
            refetchInterval: 5000,
        },
    });
}

export function useTotalClaimableBalance(address: `0x${string}` | undefined) {
    return useReadContract({
        address: CONTRACT,
        abi: LORE_MINING_ABI,
        functionName: 'getTotalClaimableBalance',
        args: address ? [address] : undefined,
        chainId: sei.id,
        query: {
            enabled: !!address,
            refetchInterval: 5000,
        },
    });
}

export function useMinerRoundData(roundId: bigint | undefined, address: `0x${string}` | undefined) {
    return useReadContract({
        address: CONTRACT,
        abi: LORE_MINING_ABI,
        functionName: 'getMinerRoundData',
        args: roundId !== undefined && address ? [roundId, address] : undefined,
        chainId: sei.id,
        query: {
            enabled: !!address && roundId !== undefined,
            refetchInterval: 5000,
        },
    });
}

export function useMotherloadePots() {
    return useReadContract({
        address: CONTRACT,
        abi: LORE_MINING_ABI,
        functionName: 'getAllMotherloadePots',
        chainId: sei.id,
        query: {
            refetchInterval: 15000,
        },
    });
}

export function useMiningEndTime() {
    return useReadContract({
        address: CONTRACT,
        abi: LORE_MINING_ABI,
        functionName: 'endTime',
        chainId: sei.id,
    });
}

export function useGetRound(roundId: bigint | undefined) {
    return useReadContract({
        address: CONTRACT,
        abi: LORE_MINING_ABI,
        functionName: 'getRound',
        args: roundId !== undefined ? [roundId] : undefined,
        chainId: sei.id,
        query: {
            enabled: roundId !== undefined && roundId > BigInt(0),
        },
    });
}

export function useMiningLoreBalance() {
    return useReadContract({
        address: LORE_MINING_CONTRACTS.LoreToken as `0x${string}`,
        abi: [
            {
                type: 'function',
                name: 'balanceOf',
                inputs: [{ name: 'account', type: 'address' }],
                outputs: [{ name: '', type: 'uint256' }],
                stateMutability: 'view',
            },
        ] as const,
        functionName: 'balanceOf',
        args: [CONTRACT],
        chainId: sei.id,
        query: {
            refetchInterval: 15000,
        },
    });
}

export function useMinerLoreBreakdown(address: `0x${string}` | undefined) {
    return useReadContract({
        address: CONTRACT,
        abi: LORE_MINING_ABI,
        functionName: 'getMinerLoreBreakdown',
        args: address ? [address] : undefined,
        chainId: sei.id,
        query: {
            enabled: !!address,
            refetchInterval: 5000,
        },
    });
}

// ============================================
// Write Hooks
// ============================================

export function useDeployToSquares() {
    const { writeContractAsync, isPending, isSuccess, isError, error, data: hash } = useWriteContract();

    const deploy = async (
        squares: number[],
        amountPerSquare: bigint,
        partner: `0x${string}` = '0x0000000000000000000000000000000000000000'
    ) => {
        // Generate user random entropy from browser
        const randomBytes = crypto.getRandomValues(new Uint8Array(32));
        const userRandom = `0x${Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;

        const totalValue = amountPerSquare * BigInt(squares.length);

        return writeContractAsync({
            address: CONTRACT,
            abi: LORE_MINING_ABI,
            functionName: 'deploy',
            args: [squares.map(s => Number(s)) as readonly number[], amountPerSquare, partner, userRandom as `0x${string}`],
            value: totalValue,
            chainId: sei.id,
        });
    };

    return { deploy, isPending, isSuccess, isError, error, hash };
}

export function useFinalizeRound() {
    const { writeContractAsync, isPending, isSuccess, isError, error, data: hash } = useWriteContract();

    const finalize = async () => {
        const randomBytes = crypto.getRandomValues(new Uint8Array(32));
        const userRandom = `0x${Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;

        return writeContractAsync({
            address: CONTRACT,
            abi: LORE_MINING_ABI,
            functionName: 'finalizeRound',
            args: [userRandom],
            chainId: sei.id,
        });
    };

    return { finalize, isPending, isSuccess, isError, error, hash };
}

export function useClaimAll() {
    const { writeContractAsync, isPending, isSuccess, isError, error, data: hash } = useWriteContract();

    const claim = async () => {
        return writeContractAsync({
            address: CONTRACT,
            abi: LORE_MINING_ABI,
            functionName: 'claimAll',
            args: [],
            chainId: sei.id,
        });
    };

    return { claim, isPending, isSuccess, isError, error, hash };
}

export function useClaimSei() {
    const { writeContractAsync, isPending, isSuccess, isError, error, data: hash } = useWriteContract();

    const claim = async () => {
        return writeContractAsync({
            address: CONTRACT,
            abi: LORE_MINING_ABI,
            functionName: 'claimSei',
            args: [],
            chainId: sei.id,
        });
    };

    return { claim, isPending, isSuccess, isError, error, hash };
}

export function useClaimLore() {
    const { writeContractAsync, isPending, isSuccess, isError, error, data: hash } = useWriteContract();

    const claim = async () => {
        return writeContractAsync({
            address: CONTRACT,
            abi: LORE_MINING_ABI,
            functionName: 'claimLore',
            args: [],
            chainId: sei.id,
        });
    };

    return { claim, isPending, isSuccess, isError, error, hash };
}
