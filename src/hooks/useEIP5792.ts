'use client';

import { useCallback } from 'react';
import { Address } from 'viem';
import { useUnifiedWallet } from '@/hooks/useWalletProviders';
import { useBatchTransactions } from '@/hooks/useBatchTransactions';

// ==========================================
// EIP-5792: Wallet Send Calls
// Support for Coinbase Smart Wallet and other EIP-5792 wallets
// ==========================================
export function useEIP5792() {
    const unified = useUnifiedWallet();
    const batch = useBatchTransactions();

    const sendCalls = useCallback(async (
        calls: Array<{
            to: Address;
            data?: `0x${string}`;
            value?: bigint;
        }>
    ) => {
        return batch.executeBatch(calls);
    }, [batch]);

    const isEIP5792Supported = useCallback(() => {
        // Check if wallet supports EIP-5792
        // This is typically supported by:
        // - Coinbase Smart Wallet
        // - MetaMask with Smart Accounts
        // - Other modern smart contract wallets
        return typeof window !== 'undefined' && 
               (window as any).ethereum?.isCoinbaseWallet || 
               (window as any).ethereum?.isMetaMask;
    }, []);

    return {
        sendCalls,
        isEIP5792Supported,
        batch,
        unified,
    };
}
