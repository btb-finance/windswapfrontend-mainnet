'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { WindLogo } from '@/components/common/WindLogo';

const mainLinks = [
    { href: '/swap', label: 'Swap' },
    { href: '/pools', label: 'Pools' },
    { href: '/portfolio', label: 'Portfolio' },
    { href: '/vote', label: 'Vote' },
];

const moreLinks = [
    { href: '/milk',    label: 'MILK',   sub: 'USDC-backed token' },
    { href: '/wind',    label: 'WINDC',  sub: 'Wind bonding curve' },
    { href: '/btb',     label: 'BTB',    sub: 'Bear the bull' },
    { href: '/mining',  label: 'LORE',   sub: 'Mining & bonding curve' },
];

export function Header() {
    const pathname = usePathname();
    const [moreOpen, setMoreOpen] = useState(false);
    const moreRef = useRef<HTMLDivElement>(null);

    const moreActive = moreLinks.some(l => pathname === l.href);

    // Close dropdown on outside click
    useEffect(() => {
        function handle(e: MouseEvent) {
            if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
                setMoreOpen(false);
            }
        }
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, []);

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
                        {/* Logo */}
                        <Link href="/" className="flex items-center gap-2 md:gap-3 hover:scale-105 active:scale-95 transition-transform duration-75">
                            <WindLogo size={36} className="md:hidden" />
                            <WindLogo size={42} className="hidden md:block" />
                            <span className="hidden sm:inline text-lg md:text-xl font-bold gradient-text">Wind Swap</span>
                        </Link>

                        {/* Desktop Navigation */}
                        <nav className="hidden md:flex items-center gap-2">
                            {mainLinks.map((link) => {
                                const isActive = pathname === link.href;
                                return (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        className={`nav-link ${isActive ? 'nav-link-active' : ''}`}
                                        onClick={() => { if (!isActive) window.__navProgressStart?.(); }}
                                    >
                                        {link.label}
                                        {isActive && <div className="absolute inset-0 bg-primary/10 rounded-lg -z-10" />}
                                    </Link>
                                );
                            })}

                            {/* More dropdown */}
                            <div ref={moreRef} className="relative">
                                <button
                                    onClick={() => setMoreOpen(o => !o)}
                                    className={`nav-link flex items-center gap-1 ${moreActive ? 'nav-link-active' : ''}`}
                                >
                                    Products
                                    <svg className={`w-3 h-3 transition-transform ${moreOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                    </svg>
                                    {moreActive && <div className="absolute inset-0 bg-primary/10 rounded-lg -z-10" />}
                                </button>

                                {moreOpen && (
                                    <div className="absolute top-full right-0 mt-2 w-52 rounded-xl bg-[var(--bg-primary)] border border-white/10 shadow-xl overflow-hidden z-50">
                                        {moreLinks.map((link) => {
                                            const isActive = pathname === link.href;
                                            return (
                                                <Link
                                                    key={link.href}
                                                    href={link.href}
                                                    onClick={() => {
                                                        setMoreOpen(false);
                                                        if (!isActive) window.__navProgressStart?.();
                                                    }}
                                                    className={`flex flex-col px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 ${isActive ? 'bg-primary/10' : ''}`}
                                                >
                                                    <span className={`text-sm font-medium ${isActive ? 'text-primary' : 'text-white'}`}>{link.label}</span>
                                                    <span className="text-[11px] text-gray-500 mt-0.5">{link.sub}</span>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </nav>

                        {/* Wallet Connect */}
                        <ConnectButton chainStatus="icon" showBalance={false} accountStatus={{ smallScreen: "avatar", largeScreen: "address" }} />
                    </div>
                </div>
            </div>
        </header>
    );
}
