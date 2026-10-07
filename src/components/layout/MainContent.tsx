'use client';

import { BtbPromo } from '@/components/common/BtbPromo';

/**
 * Main content wrapper with proper padding for header and bottom nav
 */
export function MainContent({ children }: { children: React.ReactNode }) {
    return (
        <main className="flex-1 pt-14 md:pt-24 pb-28 md:pb-16">
            <BtbPromo />
            {children}
        </main>
    );
}
