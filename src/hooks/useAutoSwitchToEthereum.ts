'use client';

import { useEffect } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { usePathname } from 'next/navigation';
import { base, ethereum } from '@/config/chains';

/**
 * Global chain guard:
 * - /btb  → Ethereum (contracts live on mainnet)
 * - everywhere else → Base
 */
export function useAutoSwitchToEthereum() {
    const { chainId, isConnected } = useAccount();
    const { switchChain } = useSwitchChain();
    const pathname = usePathname();

    useEffect(() => {
        if (!isConnected || chainId === undefined) return;

        const isBTBPage = pathname === '/btb';
        const targetChainId = isBTBPage ? ethereum.id : base.id;

        if (chainId !== targetChainId) {
            switchChain({ chainId: targetChainId });
        }
    }, [pathname, chainId, isConnected, switchChain]);
}
