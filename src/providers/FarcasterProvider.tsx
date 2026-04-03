'use client';

import { useEffect } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';

// Signals to the Farcaster client that the app is ready to display.
// Without this call, users see an infinite loading screen inside Farcaster.
export function FarcasterProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        sdk.actions.ready().catch(() => {});
    }, []);

    return <>{children}</>;
}
