'use client';

import { useConnect, useAccount } from 'wagmi';
import { useEffect } from 'react';

/**
 * Hook to automatically connect to Safe wallet when app is loaded inside Safe iframe.
 * Safe Apps are expected to auto-connect when loaded in the Safe Wallet context.
 */
export function useSafeAutoConnect() {
    const { connect, connectors } = useConnect();
    const { isConnected } = useAccount();

    useEffect(() => {
        // Only attempt autoconnect if not already connected
        if (isConnected) return;

        // Check if we're inside a Safe iframe context
        const isInSafeContext = typeof window !== 'undefined' && window.parent !== window;

        if (isInSafeContext) {
            // Find the Safe connector
            const safeConnector = connectors.find(
                (connector) => connector.id === 'safe' && connector.ready
            );

            if (safeConnector) {
                // Auto-connect to Safe
                connect({ connector: safeConnector });
            }
        }
    }, [connect, connectors, isConnected]);
}
