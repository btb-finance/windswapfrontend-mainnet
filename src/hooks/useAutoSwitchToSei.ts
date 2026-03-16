'use client';

import { useEffect } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { usePathname } from 'next/navigation';
import { sei } from 'viem/chains';

/**
 * Hook to auto-switch back to Sei network when leaving special pages.
 * /bridge uses Base network, /btb uses Ethereum - all other pages require Sei.
 */
export function useAutoSwitchToSei() {
    const { chainId, isConnected } = useAccount();
    const { switchChain } = useSwitchChain();
    const pathname = usePathname();

    useEffect(() => {
        // Pages that use non-Sei networks
        const isBridgePage = pathname === '/bridge';
        const isBTBPage = pathname === '/btb';
        const isSpecialPage = isBridgePage || isBTBPage;

        const isOnSei = chainId === sei.id;

        // Only auto-switch if:
        // 1. User is connected
        // 2. Not on a special page (bridge/btb)
        // 3. Currently on a non-Sei chain
        if (isConnected && !isSpecialPage && !isOnSei && chainId !== undefined) {
            console.log('[useAutoSwitchToSei] Switching back to Sei from chain', chainId);
            try {
                switchChain({ chainId: sei.id });
            } catch (err) {
                console.warn('[useAutoSwitchToSei] Failed to auto-switch:', err);
            }
        }
    }, [pathname, chainId, isConnected, switchChain]);
}
