'use client';

import { useEffect } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { usePathname } from 'next/navigation';
import { sei } from '@/config/chains';

/**
 * Hook to auto-switch to Base network when on non-special pages.
 */
export function useAutoSwitchToSei() {
    const { chainId, isConnected } = useAccount();
    const { switchChain } = useSwitchChain();
    const pathname = usePathname();

    useEffect(() => {
        const isBridgePage = pathname === '/bridge';
        const isBTBPage = pathname === '/btb';
        const isSpecialPage = isBridgePage || isBTBPage;

        const isOnBase = chainId === sei.id;

        if (isConnected && !isSpecialPage && !isOnBase && chainId !== undefined) {
            console.log('[useAutoSwitchToBase] Switching to Base from chain', chainId);
            try {
                switchChain({ chainId: sei.id });
            } catch (err) {
                console.warn('[useAutoSwitchToBase] Failed to auto-switch:', err);
            }
        }
    }, [pathname, chainId, isConnected, switchChain]);
}
