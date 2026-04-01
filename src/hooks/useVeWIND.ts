'use client';

import { useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useWriteContract } from '@/hooks/useWriteContract';
import { useBatchTransactions } from '@/hooks/useBatchTransactions';
import { parseUnits, Address } from 'viem';
import { V2_CONTRACTS } from '@/config/contracts';
import { VOTING_ESCROW_ABI, REWARDS_DISTRIBUTOR_ABI, ERC20_ABI } from '@/config/abis';
import { usePoolData } from '@/providers/PoolDataProvider';
import { extractErrorMessage } from '@/utils/errors';

// Lock duration presets in seconds
export const LOCK_DURATIONS = {
    '1W': 7 * 24 * 60 * 60,
    '1M': 30 * 24 * 60 * 60,
    '3M': 90 * 24 * 60 * 60,
    '6M': 180 * 24 * 60 * 60,
    '1Y': 365 * 24 * 60 * 60,
    '2Y': 730 * 24 * 60 * 60,
    '4Y': 1460 * 24 * 60 * 60, // Max lock
} as const;

export interface VeWINDPosition {
    tokenId: bigint;
    amount: bigint;
    end: bigint;
    isPermanent: boolean;
    votingPower: bigint;
    claimable: bigint;
    hasVoted: boolean;
}

export function useVeWIND() {
    const { address } = useAccount();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Use prefetched veNFT data from global provider instead of fetching locally
    const { veNFTs, veNFTsLoading, refetchVeNFTs } = usePoolData();

    // Map provider VeNFT data to VeWINDPosition format
    const positions: VeWINDPosition[] = veNFTs.map(nft => ({
        tokenId: nft.tokenId,
        amount: nft.amount,
        end: nft.end,
        isPermanent: nft.isPermanent,
        votingPower: nft.votingPower,
        claimable: nft.claimable,
        hasVoted: nft.hasVoted,
    }));

    const { writeContractAsync } = useWriteContract();
    const { batchOrSequential, encodeContractCall } = useBatchTransactions();

    // Create new lock
    const createLock = useCallback(async (amount: string, durationSeconds: number) => {
        if (!address) {
            setError('Wallet not connected');
            return null;
        }

        setIsLoading(true);
        setError(null);

        try {
            const amountWei = parseUnits(amount, 18);

            // Try batch: approve + createLock in 1 tx
            const approveCall = encodeContractCall(
                V2_CONTRACTS.WIND as Address,
                ERC20_ABI as any,
                'approve',
                [V2_CONTRACTS.VotingEscrow as Address, amountWei]
            );
            const lockCall = encodeContractCall(
                V2_CONTRACTS.VotingEscrow as Address,
                VOTING_ESCROW_ABI as any,
                'createLock',
                [amountWei, BigInt(durationSeconds)]
            );
            const hash = await batchOrSequential([approveCall, lockCall]);
            setIsLoading(false);
            refetchVeNFTs();
            return { hash };
        } catch (err: unknown) {
            console.error('Create lock error:', err);
            setError(extractErrorMessage(err, 'Failed to create lock'));
            setIsLoading(false);
            return null;
        }
    }, [address, batchOrSequential, encodeContractCall, refetchVeNFTs]);

    // Increase lock amount
    const increaseAmount = useCallback(async (tokenId: bigint, amount: string) => {
        if (!address) {
            setError('Wallet not connected');
            return null;
        }

        setIsLoading(true);
        setError(null);

        try {
            const amountWei = parseUnits(amount, 18);

            // Try batch: approve + increaseAmount in 1 tx
            const approveCall = encodeContractCall(
                V2_CONTRACTS.WIND as Address,
                ERC20_ABI as any,
                'approve',
                [V2_CONTRACTS.VotingEscrow as Address, amountWei]
            );
            const increaseCall = encodeContractCall(
                V2_CONTRACTS.VotingEscrow as Address,
                VOTING_ESCROW_ABI as any,
                'increaseAmount',
                [tokenId, amountWei]
            );
            const hash = await batchOrSequential([approveCall, increaseCall]);
            setIsLoading(false);
            refetchVeNFTs();
            return { hash };
        } catch (err: unknown) {
            console.error('Increase amount error:', err);
            setError(extractErrorMessage(err, 'Failed to increase amount'));
            setIsLoading(false);
            return null;
        }
    }, [address, batchOrSequential, encodeContractCall, refetchVeNFTs]);

    // Extend lock duration
    const extendLock = useCallback(async (tokenId: bigint, durationSeconds: number) => {
        if (!address) {
            setError('Wallet not connected');
            return null;
        }

        setIsLoading(true);
        setError(null);

        try {
            const hash = await writeContractAsync({
                address: V2_CONTRACTS.VotingEscrow as Address,
                abi: VOTING_ESCROW_ABI,
                functionName: 'increaseUnlockTime',
                args: [tokenId, BigInt(durationSeconds)],
            });

            setIsLoading(false);
            refetchVeNFTs();
            return { hash };
        } catch (err: unknown) {
            console.error('Extend lock error:', err);
            setError(extractErrorMessage(err, 'Failed to extend lock'));
            setIsLoading(false);
            return null;
        }
    }, [address, writeContractAsync, refetchVeNFTs]);

    // Withdraw expired lock
    const withdraw = useCallback(async (tokenId: bigint) => {
        if (!address) {
            setError('Wallet not connected');
            return null;
        }

        setIsLoading(true);
        setError(null);

        try {
            const hash = await writeContractAsync({
                address: V2_CONTRACTS.VotingEscrow as Address,
                abi: VOTING_ESCROW_ABI,
                functionName: 'withdraw',
                args: [tokenId],
            });

            setIsLoading(false);
            refetchVeNFTs();
            return { hash };
        } catch (err: unknown) {
            console.error('Withdraw error:', err);
            setError(extractErrorMessage(err, 'Failed to withdraw'));
            setIsLoading(false);
            return null;
        }
    }, [address, writeContractAsync, refetchVeNFTs]);

    // Claim rebases
    const claimRebases = useCallback(async (tokenId: bigint) => {
        if (!address) {
            setError('Wallet not connected');
            return null;
        }

        setIsLoading(true);
        setError(null);

        try {
            const hash = await writeContractAsync({
                address: V2_CONTRACTS.RewardsDistributor as Address,
                abi: REWARDS_DISTRIBUTOR_ABI,
                functionName: 'claim',
                args: [tokenId],
            });

            setIsLoading(false);
            refetchVeNFTs();
            return { hash };
        } catch (err: unknown) {
            console.error('Claim rebases error:', err);
            setError(extractErrorMessage(err, 'Failed to claim rebases'));
            setIsLoading(false);
            return null;
        }
    }, [address, writeContractAsync, refetchVeNFTs]);

    // Merge two veNFTs (from -> to)
    const merge = useCallback(async (fromTokenId: bigint, toTokenId: bigint) => {
        if (!address) {
            setError('Wallet not connected');
            return null;
        }

        setIsLoading(true);
        setError(null);

        try {
            const hash = await writeContractAsync({
                address: V2_CONTRACTS.VotingEscrow as Address,
                abi: VOTING_ESCROW_ABI,
                functionName: 'merge',
                args: [fromTokenId, toTokenId],
            });

            setIsLoading(false);
            refetchVeNFTs();
            return { hash };
        } catch (err: unknown) {
            console.error('Merge error:', err);
            setError(extractErrorMessage(err, 'Failed to merge veNFTs'));
            setIsLoading(false);
            return null;
        }
    }, [address, writeContractAsync, refetchVeNFTs]);

    // Lock permanently for maximum voting power
    const lockPermanent = useCallback(async (tokenId: bigint) => {
        if (!address) {
            setError('Wallet not connected');
            return null;
        }

        setIsLoading(true);
        setError(null);

        try {
            const hash = await writeContractAsync({
                address: V2_CONTRACTS.VotingEscrow as Address,
                abi: VOTING_ESCROW_ABI,
                functionName: 'lockPermanent',
                args: [tokenId],
            });

            setIsLoading(false);
            refetchVeNFTs();
            return { hash };
        } catch (err: unknown) {
            console.error('Lock permanent error:', err);
            setError(extractErrorMessage(err, 'Failed to lock permanently'));
            setIsLoading(false);
            return null;
        }
    }, [address, writeContractAsync, refetchVeNFTs]);

    // Unlock permanent lock (converts back to 4 year time-lock)
    const unlockPermanent = useCallback(async (tokenId: bigint) => {
        if (!address) {
            setError('Wallet not connected');
            return null;
        }

        setIsLoading(true);
        setError(null);

        try {
            const hash = await writeContractAsync({
                address: V2_CONTRACTS.VotingEscrow as Address,
                abi: VOTING_ESCROW_ABI,
                functionName: 'unlockPermanent',
                args: [tokenId],
            });

            setIsLoading(false);
            refetchVeNFTs();
            return { hash };
        } catch (err: unknown) {
            console.error('Unlock permanent error:', err);
            setError(extractErrorMessage(err, 'Failed to unlock permanent lock'));
            setIsLoading(false);
            return null;
        }
    }, [address, writeContractAsync, refetchVeNFTs]);

    return {
        positions,
        veNFTCount: veNFTs.length,
        createLock,
        increaseAmount,
        extendLock,
        withdraw,
        claimRebases,
        merge,
        lockPermanent,
        unlockPermanent,
        isLoading: isLoading || veNFTsLoading,
        error,
        refetch: refetchVeNFTs,
    };
}
