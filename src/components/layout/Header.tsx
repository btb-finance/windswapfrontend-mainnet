'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { WindLogo } from '@/components/common/WindLogo';

const navLinks = [
    { href: '/swap', label: 'Swap' },
    { href: '/pools', label: 'Pools' },
    { href: '/portfolio', label: 'Portfolio' },
    { href: '/vote', label: 'Vote' },
    { href: '/milk', label: '🥛 MILK' },
];

export function Header() {
    const pathname = usePathname();

    // Auto-switch back to Sei when leaving the bridge page
    // Chain auto-switch not needed on single-chain ETH deployment

    return (
        <header className="fixed top-0 left-0 right-0 z-50">
            {/* Legacy Sei Project Banner */}
            <div className="bg-[#0052FF] text-white text-xs sm:text-sm py-1.5 px-4 text-center font-medium">
                <a href="https://sei.windswap.org/" target="_blank" rel="noopener noreferrer" className="underline font-bold hover:text-white/80 transition-colors inline-flex items-center gap-1">
                    Explore legacy Sei project <span aria-hidden="true">&rarr;</span>
                </a>
            </div>
            <div className="glass-header">
                <div className="container mx-auto px-3 md:px-6 py-2 md:py-4">
                    <div className="flex items-center justify-between">
                        {/* Logo - text hidden on mobile */}
                        <Link href="/" className="flex items-center gap-2 md:gap-3 hover:scale-105 active:scale-95 transition-transform duration-75">
                            <WindLogo size={36} className="md:hidden" />
                            <WindLogo size={42} className="hidden md:block" />
                            <span className="hidden sm:inline text-lg md:text-xl font-bold gradient-text">Wind Swap</span>
                        </Link>

                        {/* Desktop Navigation */}
                        <nav className="hidden md:flex items-center gap-2">
                            {navLinks.map((link) => {
                                const isActive = pathname === link.href;
                                return (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        className={`nav-link ${isActive ? 'nav-link-active' : ''}`}
                                        onClick={() => { if (!isActive) window.__navProgressStart?.(); }}
                                    >
                                        {link.label}
                                        {isActive && (
                                            <div className="absolute inset-0 bg-primary/10 rounded-lg -z-10" />
                                        )}
                                    </Link>
                                );
                            })}
                        </nav>

                        {/* Wallet Connect */}
                        <ConnectButton chainStatus="icon" showBalance={false} accountStatus={{ smallScreen: "avatar", largeScreen: "address" }} />
                    </div>
                </div>
            </div>
        </header>
    );
}
