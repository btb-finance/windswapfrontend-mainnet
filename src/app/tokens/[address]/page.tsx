'use client';

import dynamic from 'next/dynamic';

const TokenPageContent = dynamic(
    () => import('./TokenPageContent').then(mod => mod.TokenPageContent),
    {
        ssr: false,
        loading: () => (
            <div className="container mx-auto px-3 sm:px-6 py-8">
                <div className="glass-card p-8 text-center max-w-lg mx-auto">
                    <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-400">Loading token info...</p>
                </div>
            </div>
        ),
    }
);

export default function TokenPage() {
    return <TokenPageContent />;
}
