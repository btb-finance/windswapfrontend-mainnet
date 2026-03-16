'use client';

import { useSafeAutoConnect } from '@/hooks/useSafeAutoConnect';

/**
 * Wrapper component that handles Safe App auto-connection.
 * Place this inside RainbowKitProvider to enable auto-connect when
 * the app is loaded inside the Safe wallet iframe.
 */
export function SafeAutoConnect({ children }: { children: React.ReactNode }) {
    useSafeAutoConnect();
    return <>{children}</>;
}
