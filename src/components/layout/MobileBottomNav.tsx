'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useRef } from 'react';
import { haptic } from '@/hooks/useHaptic';
import { useWalletModal } from '@/providers/WalletModalContext';

const SwapIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
    </svg>
);

const PoolsIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
);

const PortfolioIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
);

const VoteIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const MilkIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 3h6l1 4H8L9 3zm-1 4v13a1 1 0 001 1h6a1 1 0 001-1V7H8zm3 3v7m2-7v7" />
    </svg>
);

const DiscordIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
);

const navItems = [
    { href: '/swap', label: 'Swap', Icon: SwapIcon },
    { href: '/pools', label: 'Pools', Icon: PoolsIcon },
    { href: '/portfolio', label: 'Portfolio', Icon: PortfolioIcon, isMain: true },
    { href: '/vote', label: 'Vote', Icon: VoteIcon },
    { href: '/milk', label: 'MILK', Icon: MilkIcon },
    { href: 'https://discord.gg/q5nENswbg5', label: 'Discord', Icon: DiscordIcon, isExternal: true },
];

export function MobileBottomNav() {
    const pathname = usePathname();
    const router = useRouter();
    const { isWalletModalOpen } = useWalletModal();

    const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
        if (isWalletModalOpen) return;
        const touch = e.touches[0];
        touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    };

    const handleTouchEnd = (e: React.TouchEvent, href: string, isMain?: boolean) => {
        if (isWalletModalOpen) return;
        const touch = e.changedTouches[0];
        const start = touchStartRef.current;
        if (!start) return;

        const deltaX = Math.abs(touch.clientX - start.x);
        const deltaY = Math.abs(touch.clientY - start.y);
        const deltaTime = Date.now() - start.time;

        if (deltaX < 15 && deltaY < 15 && deltaTime < 300 && pathname !== href) {
            e.preventDefault();
            haptic(isMain ? 'medium' : 'light');
            window.__navProgressStart?.();
            router.push(href);
        }

        touchStartRef.current = null;
    };

    const handleClick = (e: React.MouseEvent, href: string, isMain?: boolean) => {
        if (isWalletModalOpen) { e.preventDefault(); return; }
        if ('ontouchstart' in window) { e.preventDefault(); return; }
        e.preventDefault();
        haptic(isMain ? 'medium' : 'light');
        window.__navProgressStart?.();
        router.push(href);
    };

    return (
        <nav
            className={`md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[var(--bg-primary)]/95 safe-area-bottom transition-opacity duration-200 ${isWalletModalOpen ? 'pointer-events-none opacity-50' : ''}`}
            style={{ borderTop: '1px solid transparent', backgroundImage: 'linear-gradient(var(--bg-primary), var(--bg-primary)), linear-gradient(90deg, #6366f1, #8b5cf6, #06b6d4)', backgroundOrigin: 'border-box', backgroundClip: 'padding-box, border-box' }}
            aria-hidden={isWalletModalOpen}
        >
            <div className="flex items-end justify-around px-2 py-2.5">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.Icon;

                    if (item.isMain) {
                        return (
                            <a
                                key={item.href}
                                href={item.href}
                                onClick={(e) => handleClick(e, item.href, true)}
                                onTouchStart={handleTouchStart}
                                onTouchEnd={(e) => handleTouchEnd(e, item.href, true)}
                                className="mobile-nav-item mobile-nav-main relative flex flex-col items-center justify-end flex-1 -mt-6 touch-none"
                            >
                                <div
                                    className={`mobile-nav-main-circle w-14 h-14 rounded-full flex items-center justify-center shadow-lg mb-1 bg-gradient-to-r from-primary to-secondary transition-transform duration-75 ${isActive ? 'scale-110' : ''}`}
                                >
                                    <Icon className="w-6 h-6 text-white" />
                                </div>
                                <span className={`text-[10px] font-medium ${isActive ? 'text-primary' : 'text-gray-400'}`}>
                                    {item.label}
                                </span>
                            </a>
                        );
                    }

                    if ('isExternal' in item && item.isExternal) {
                        return (
                            <a
                                key={item.href}
                                href={item.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mobile-nav-item relative flex flex-col items-center justify-center flex-1 py-2"
                            >
                                <Icon className="mobile-nav-icon w-6 h-6 mb-1 text-gray-500 transition-all duration-75" />
                                <span className="mobile-nav-label text-[10px] font-medium text-gray-500">{item.label}</span>
                            </a>
                        );
                    }

                    return (
                        <a
                            key={item.href}
                            href={item.href}
                            onClick={(e) => handleClick(e, item.href)}
                            onTouchStart={handleTouchStart}
                            onTouchEnd={(e) => handleTouchEnd(e, item.href)}
                            className="mobile-nav-item relative flex flex-col items-center justify-center flex-1 py-2 touch-none"
                        >
                            {/* Active background */}
                            <div className={`mobile-nav-bg absolute inset-x-2 top-1 bottom-1 rounded-lg bg-gradient-to-r from-primary/10 to-secondary/10 transition-opacity duration-75 ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                            <Icon className={`mobile-nav-icon w-6 h-6 mb-1 transition-all duration-75 ${isActive ? 'text-primary scale-110' : 'text-gray-500'}`} />
                            <span className={`mobile-nav-label text-[10px] font-medium transition-colors duration-75 ${isActive ? 'text-primary' : 'text-gray-500'}`}>
                                {item.label}
                            </span>
                        </a>
                    );
                })}
            </div>
        </nav>
    );
}
