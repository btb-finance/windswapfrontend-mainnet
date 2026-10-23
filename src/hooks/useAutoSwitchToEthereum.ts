'use client';

import { useEffect } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { usePathname } from 'next/navigation';
import { base, ethereum } from '@/config/chains';

/**
 * Global chain guard:
 * - /btb  → Ethereum (contracts live on mainnet)
 * - everywhere else → Base
 * - /v4 routes → not guarded (the v4 bridge uses Base Sepolia)
 */
export function useAutoSwitchToEthereum() {
    const { chainId, isConnected } = useAccount();
    const { switchChain } = useSwitchChain();
    const pathname = usePathname();

    useEffect(() => {
        // The v4 pages use Base Sepolia (EVM bridge) and must not be switched back to Base.
        if (pathname.startsWith('/v4')) return;
        if (!isConnected || chainId === undefined) return;

        const isBTBPage = pathname === '/btb';
        const targetChainId = isBTBPage ? ethereum.id : base.id;

        if (chainId !== targetChainId) {
            switchChain({ chainId: targetChainId });
        }
    }, [pathname, chainId, isConnected, switchChain]);
}
