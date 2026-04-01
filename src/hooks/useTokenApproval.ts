'use client';

import { useCallback } from 'react';
import { useAccount } from 'wagmi';
import { maxUint256, type Address } from 'viem';
import { useWriteContract } from '@/hooks/useWriteContract';
import { ERC20_ABI } from '@/config/abis';
import type { Token } from '@/config/tokens';

/**
 * Shared token approval hook.
 * Consolidates the approve pattern used in useSwap, useLiquidity,
 * useBatchTransactions, useBTBContracts, useLOREBondingCurve, useWindCurve.
 */
export function useTokenApproval() {
    const { address } = useAccount();
    const { writeContractAsync } = useWriteContract();

    const approveMax = useCallback(async (
        token: Token | Address,
        spender: Address,
    ): Promise<boolean> => {
        if (!address) return false;

        const tokenAddress = typeof token === 'string'
            ? token
            : (token.address as Address);

        try {
            const hash = await writeContractAsync({
                address: tokenAddress,
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [spender, maxUint256],
            });
            return !!hash;
        } catch (err) {
            console.error('Approve error:', err);
            return false;
        }
    }, [address, writeContractAsync]);

    const approveAmount = useCallback(async (
        token: Token | Address,
        spender: Address,
        amount: bigint,
    ): Promise<boolean> => {
        if (!address) return false;

        const tokenAddress = typeof token === 'string'
            ? token
            : (token.address as Address);

        try {
            const hash = await writeContractAsync({
                address: tokenAddress,
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [spender, amount],
            });
            return !!hash;
        } catch (err) {
            console.error('Approve error:', err);
            return false;
        }
    }, [address, writeContractAsync]);

    return { approveMax, approveAmount };
}
