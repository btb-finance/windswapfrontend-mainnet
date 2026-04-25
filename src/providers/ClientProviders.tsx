'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { ToastProvider } from '@/providers/ToastProvider';
import { WalletModalProvider } from '@/providers/WalletModalContext';
import { ReferralProvider } from '@/providers/ReferralProvider';
import { ChainGuard } from '@/components/ChainGuard';
import { FarcasterProvider } from '@/providers/FarcasterProvider';
import { TelegramProvider } from '@/providers/TelegramProvider';

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Dynamic import with SSR disabled to prevent WalletConnect's idb-keyval
// from accessing indexedDB during server-side rendering in serverless environments
const Providers = dynamic(
    () => import('@/providers/WagmiProvider').then(mod => mod.Providers),
    {
        ssr: false,
        loading: () => (
            <div className="min-h-screen bg-[#0a0b0d] flex items-center justify-center">
                <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
        ),
    }
);

export function ClientProviders({ children }: { children: React.ReactNode }) {
    return (
        <ConvexProvider client={convex}>
        <Providers>
            <ChainGuard />
            <FarcasterProvider>
            <TelegramProvider>
                <WalletModalProvider>
                    <ToastProvider>
                        <Suspense>
                            <ReferralProvider>
                                {children}
                            </ReferralProvider>
                        </Suspense>
                    </ToastProvider>
                </WalletModalProvider>
            </TelegramProvider>
            </FarcasterProvider>
        </Providers>
        </ConvexProvider>
    );
}

