'use client';

import { useState } from 'react';
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

const MoreIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
);

const mainNavItems = [
    { href: '/swap',      label: 'Swap',      Icon: SwapIcon },
    { href: '/pools',     label: 'Pools',      Icon: PoolsIcon },
    { href: '/portfolio', label: 'Portfolio',  Icon: PortfolioIcon, isMain: true },
    { href: '/vote',      label: 'Vote',       Icon: VoteIcon },
];

const moreItems = [
    { href: '/milk',    label: 'MILK',   sub: 'USDC-backed token' },
    { href: '/wind',    label: 'WINDC',  sub: 'Wind bonding curve' },
    { href: '/btb',     label: 'BTB',    sub: 'Bear the bull' },
    { href: '/mining',  label: 'LORE',   sub: 'Mining & bonding curve' },
    { href: '/lottery', label: 'Lottery', sub: 'Daily USDC jackpot' },
    { href: 'https://discord.gg/q5nENswbg5', label: 'Discord', sub: 'Join the community', isExternal: true },
];

export function MobileBottomNav() {
    const pathname = usePathname();
    const router = useRouter();
    const { isWalletModalOpen } = useWalletModal();
    const [moreOpen, setMoreOpen] = useState(false);

    const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

    const moreActive = moreItems.some(i => !i.isExternal && pathname === i.href);

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

    const handleMoreItemClick = (href: string, isExternal?: boolean) => {
        setMoreOpen(false);
        haptic('light');
        if (isExternal) {
            window.open(href, '_blank', 'noopener,noreferrer');
        } else {
            window.__navProgressStart?.();
            router.push(href);
        }
    };

    return (
        <>
            {/* More sheet overlay */}
            {moreOpen && (
                <div
                    className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                    onClick={() => setMoreOpen(false)}
                />
            )}

            {/* More sheet */}
            <div className={`md:hidden fixed bottom-0 left-0 right-0 z-40 pb-[60px] pointer-events-none transition-transform duration-300 ${moreOpen ? 'translate-y-0' : 'translate-y-full'}`}>
                <div className="mx-3 mb-2 rounded-2xl overflow-y-auto overscroll-contain bg-[var(--bg-primary)] border border-white/10 shadow-2xl max-h-[calc(100vh-80px)] pointer-events-auto">
                    <div className="px-4 py-3 border-b border-white/5">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Products</p>
                    </div>
                    {moreItems.map((item) => {
                        const isActive = !item.isExternal && pathname === item.href;
                        return (
                            <button
                                key={item.href}
                                onClick={() => handleMoreItemClick(item.href, item.isExternal)}
                                className={`w-full flex items-center justify-between px-4 py-3.5 border-b border-white/5 last:border-0 transition-colors active:bg-white/5 ${isActive ? 'bg-primary/10' : ''}`}
                            >
                                <div className="text-left">
                                    <p className={`text-sm font-semibold ${isActive ? 'text-primary' : 'text-white'}`}>{item.label}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">{item.sub}</p>
                                </div>
                                {item.isExternal ? (
                                    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                ) : (
                                    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Bottom nav bar */}
            <nav
                className={`mobile-bottom-nav md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[var(--bg-primary)]/95 safe-area-bottom transition-opacity duration-200 ${isWalletModalOpen ? 'pointer-events-none opacity-50' : ''}`}
                style={{ borderTop: '1px solid transparent', backgroundImage: 'linear-gradient(var(--bg-primary), var(--bg-primary)), linear-gradient(90deg, #6366f1, #8b5cf6, #06b6d4)', backgroundOrigin: 'border-box', backgroundClip: 'padding-box, border-box' }}
                aria-hidden={isWalletModalOpen}
            >
                <div className="flex items-end justify-around px-2 py-2.5">
                    {mainNavItems.map((item) => {
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
                                    <div className={`mobile-nav-main-circle w-14 h-14 rounded-full flex items-center justify-center shadow-lg mb-1 bg-gradient-to-r from-primary to-secondary transition-transform duration-75 ${isActive ? 'scale-110' : ''}`}>
                                        <Icon className="w-6 h-6 text-white" />
                                    </div>
                                    <span className={`text-[10px] font-medium ${isActive ? 'text-primary' : 'text-gray-400'}`}>{item.label}</span>
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
                                <div className={`mobile-nav-bg absolute inset-x-2 top-1 bottom-1 rounded-lg bg-gradient-to-r from-primary/10 to-secondary/10 transition-opacity duration-75 ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                                <Icon className={`mobile-nav-icon w-6 h-6 mb-1 transition-all duration-75 ${isActive ? 'text-primary scale-110' : 'text-gray-500'}`} />
                                <span className={`mobile-nav-label text-[10px] font-medium transition-colors duration-75 ${isActive ? 'text-primary' : 'text-gray-500'}`}>{item.label}</span>
                            </a>
                        );
                    })}

                    {/* More button */}
                    <button
                        onClick={() => { haptic('light'); setMoreOpen(o => !o); }}
                        className="mobile-nav-item relative flex flex-col items-center justify-center flex-1 py-2"
                    >
                        <div className={`mobile-nav-bg absolute inset-x-2 top-1 bottom-1 rounded-lg bg-gradient-to-r from-primary/10 to-secondary/10 transition-opacity duration-75 ${moreOpen || moreActive ? 'opacity-100' : 'opacity-0'}`} />
                        <MoreIcon className={`mobile-nav-icon w-6 h-6 mb-1 transition-all duration-75 ${moreOpen || moreActive ? 'text-primary scale-110' : 'text-gray-500'}`} />
                        <span className={`mobile-nav-label text-[10px] font-medium transition-colors duration-75 ${moreOpen || moreActive ? 'text-primary' : 'text-gray-500'}`}>More</span>
                    </button>
                </div>
            </nav>
        </>
    );
}
