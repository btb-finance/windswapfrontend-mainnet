'use client';

import { useEffect } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { usePathname } from 'next/navigation';
import { ethereum } from '@/config/chains';

/**
 * Hook to auto-switch to Ethereum network when on the BTB page.
 * BTB Finance contracts are deployed on Ethereum Mainnet.
 */
export function useAutoSwitchToEthereum() {
    const { chainId, isConnected } = useAccount();
    const { switchChain } = useSwitchChain();
    const pathname = usePathname();

    useEffect(() => {
        const isBTBPage = pathname === '/btb';
        const isOnEthereum = chainId === ethereum.id;

        // Only auto-switch if:
        // 1. User is connected
        // 2. On the BTB page
        // 3. Not already on Ethereum
        if (isConnected && isBTBPage && !isOnEthereum && chainId !== undefined) {
            console.log('[useAutoSwitchToEthereum] Switching to Ethereum from chain', chainId);
            try {
                switchChain({ chainId: ethereum.id });
            } catch (err) {
                console.warn('[useAutoSwitchToEthereum] Failed to auto-switch:', err);
            }
        }
    }, [pathname, chainId, isConnected, switchChain]);
}
