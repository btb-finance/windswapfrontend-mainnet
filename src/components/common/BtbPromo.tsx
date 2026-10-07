'use client';

import { useEffect, useState } from 'react';

const DISMISS_KEY = 'windswap_btb_promo_dismissed';

/**
 * "Did you know" card at the top of every page: Wind Swap is part of BTB Finance, and on BTB a user earns trading
 * fees and XP that turns into BTB every Friday. Dismissible; the choice is remembered in this browser.
 */
export function BtbPromo() {
    // Hidden until mounted, so a visitor who closed it never sees it flash in.
    const [show, setShow] = useState(false);
    useEffect(() => {
        try { setShow(localStorage.getItem(DISMISS_KEY) !== '1'); } catch { setShow(true); }
    }, []);

    if (!show) return null;

    const dismiss = () => {
        setShow(false);
        try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* private mode: hidden for this visit only */ }
    };

    return (
        <div className="container mx-auto px-4 md:px-6 mb-4 md:mb-6">
            <div className="relative rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 pr-10 md:px-5 md:py-4">
                <button
                    type="button"
                    onClick={dismiss}
                    aria-label="Close"
                    className="absolute right-3 top-3 text-gray-400 hover:text-white transition-colors"
                >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
                <p className="text-sm md:text-base font-semibold text-emerald-300">
                    Did you know Wind Swap is part of BTB Finance?
                </p>
                <p className="mt-1 text-xs md:text-sm leading-relaxed text-gray-300">
                    On BTB Finance you can provide liquidity that rebalances itself, earn trading fees, and collect XP
                    that turns into BTB every Friday.
                </p>
                <a
                    href="https://btb.finance"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-block rounded-xl bg-emerald-400 px-3 py-1.5 text-xs md:text-sm font-semibold text-black hover:bg-emerald-300 transition-colors"
                >
                    Earn on BTB Finance
                </a>
            </div>
        </div>
    );
}
