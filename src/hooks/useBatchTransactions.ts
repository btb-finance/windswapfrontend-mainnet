'use client';

import { useState, useCallback } from 'react';
import { useSendCalls, useWalletClient, usePublicClient, useAccount } from 'wagmi';
import { encodeFunctionData, Address, Abi } from 'viem';
import { ERC20_ABI } from '@/config/abis';

interface Call {
    to: Address;
    data?: `0x${string}`;
    value?: bigint;
}

interface BatchResult {
    success: boolean;
    hash?: string;
    error?: string;
    usedBatching?: boolean;
}

/**
 * Hook for executing batch transactions using EIP-5792 (wallet_sendCalls)
 * Falls back to sequential transactions if wallet doesn't support batching
 *
 * Works with MetaMask Smart Accounts, Coinbase Wallet, and other EIP-5792 wallets
 */
export function useBatchTransactions() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { sendCallsAsync } = useSendCalls();
    const { data: walletClient } = useWalletClient();
    const publicClient = usePublicClient();
    const { address } = useAccount();

    /**
     * Execute a batch of calls - tries EIP-5792 first
     * Returns { success: false, usedBatching: false } if wallet doesn't support it
     */
    const executeBatch = useCallback(async (
        calls: Call[],
    ): Promise<BatchResult> => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await sendCallsAsync({
                calls: calls.map(call => ({
                    to: call.to,
                    data: call.data,
                    value: call.value,
                })),
            });

            setIsLoading(false);
            return {
                success: true,
                hash: typeof result === 'string' ? result : result?.id,
                usedBatching: true,
            };

        } catch (batchError: unknown) {
            console.log('EIP-5792 batch not available:', batchError instanceof Error ? batchError.message : batchError);
            setIsLoading(false);
            return {
                success: false,
                error: 'Wallet does not support batch transactions',
                usedBatching: false,
            };
        }

    }, [sendCallsAsync]);

    /**
     * Try EIP-5792 batch first; if not supported, execute calls sequentially.
     * Returns the hash of the last transaction (or the batch ID). Throws on failure.
     */
    const batchOrSequential = useCallback(async (calls: Call[]): Promise<string> => {
        const batchResult = await executeBatch(calls);

        if (batchResult.usedBatching && batchResult.success) {
            return batchResult.hash!;
        }

        if (!walletClient) throw new Error('Wallet not connected');
        if (!publicClient) throw new Error('Public client not available');

        let lastHash = '';
        for (const call of calls) {
            const hash = await walletClient.sendTransaction({
                to: call.to,
                data: call.data,
                value: call.value,
            });
            // Wait for mining before sending the next tx — otherwise the wallet
            // may reuse the same nonce or the next tx may revert because state
            // (e.g. allowance) hasn't been committed on-chain yet.
            // Base blocks land in ~2s (or 200ms with flashblocks); poll fast.
            await publicClient.waitForTransactionReceipt({ hash, pollingInterval: 500 });
            lastHash = hash;
        }
        return lastHash;
    }, [executeBatch, walletClient, publicClient]);

    /**
     * Check allowance and approve if insufficient. No-op if allowance is already enough.
     */
    const approveIfNeeded = useCallback(async (
        tokenAddress: Address,
        spender: Address,
        amount: bigint,
    ): Promise<void> => {
        if (!walletClient || !publicClient || !address) throw new Error('Wallet not connected');

        const allowance = await publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: 'allowance',
            args: [address, spender],
        }) as bigint;

        if (allowance >= amount) return;

        const hash = await walletClient.writeContract({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [spender, amount],
        });
        // Wait for the approve to mine before returning — callers immediately
        // submit the next tx (e.g. swap) and will hit a nonce/allowance race
        // on non-EIP-5792 wallets without this wait.
        await publicClient.waitForTransactionReceipt({ hash, pollingInterval: 500 });
    }, [walletClient, publicClient, address]);

    /**
     * Check allowance and return an approve Call if insufficient, or null if already approved.
     * Use this to conditionally include an approve in a batchOrSequential call.
     */
    const buildApproveCallIfNeeded = useCallback(async (
        tokenAddress: Address,
        spender: Address,
        amount: bigint,
    ): Promise<Call | null> => {
        if (!publicClient || !address) return null;

        const allowance = await publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: 'allowance',
            args: [address, spender],
        }) as bigint;

        if (allowance >= amount) return null;

        return encodeApproveCall(tokenAddress, spender, amount);
    }, [publicClient, address]);

    /**
     * Helper: Encode an approve call
     */
    const encodeApproveCall = useCallback((
        tokenAddress: Address,
        spenderAddress: Address,
        amount: bigint
    ): Call => {
        return {
            to: tokenAddress,
            data: encodeFunctionData({
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [spenderAddress, amount],
            }),
        };
    }, []);

    /**
     * Helper: Encode any contract call
     */
    const encodeContractCall = useCallback((
        contractAddress: Address,
        abi: Abi,
        functionName: string,
        args: readonly unknown[],
        value?: bigint
    ): Call => {
        return {
            to: contractAddress,
            data: encodeFunctionData({
                abi,
                functionName,
                args,
            }),
            value,
        };
    }, []);

    return {
        executeBatch,
        batchOrSequential,
        approveIfNeeded,
        buildApproveCallIfNeeded,
        encodeApproveCall,
        encodeContractCall,
        isLoading,
        error,
    };
}
