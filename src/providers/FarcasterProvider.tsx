'use client';

import { useEffect } from 'react';

// Signals to the Farcaster client that the app is ready to display.
// Lazy-loads the SDK only inside Farcaster frames to avoid 12MB bundle hit on normal loads.
export function FarcasterProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        // Only load SDK if we're inside a Farcaster frame
        if (typeof window !== 'undefined' && (window.parent !== window || navigator.userAgent.includes('Farcaster'))) {
            import('@farcaster/miniapp-sdk').then(({ sdk }) => {
                sdk.actions.ready().catch(() => {});
            }).catch(() => {});
        }
    }, []);

    return <>{children}</>;
}
