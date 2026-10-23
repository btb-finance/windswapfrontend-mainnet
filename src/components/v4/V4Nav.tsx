'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NearConnectButton } from '@/components/v4/NearConnectButton';

const tabs = [
  { href: '/v4', label: 'Swap' },
  { href: '/v4/pools', label: 'Pools' },
  { href: '/v4/liquidity', label: 'Liquidity' },
  { href: '/v4/portfolio', label: 'Portfolio' },
];

/** Header for the v4 routes: title, testnet badge, NEAR wallet, and section tabs. */
export function V4Nav() {
  const pathname = usePathname();

  return (
    <div className="mb-4 sm:mb-6 animate-fade-up">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-xl sm:text-3xl font-bold truncate">
            <span className="gradient-text">Wind Swap v4</span>
          </h1>
          <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-amber-300">
            testnet
          </span>
        </div>
        <NearConnectButton />
      </div>

      <nav className="flex gap-1 overflow-x-auto scrollbar-none rounded-xl bg-white/5 border border-white/10 p-1" aria-label="Wind Swap v4 sections">
        {tabs.map((tab) => {
          const active = tab.href === '/v4' ? pathname === '/v4' : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 text-center whitespace-nowrap py-2 px-3 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                active ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      <p className="mt-2 text-[11px] sm:text-xs text-gray-500">
        NEAR testnet · contract <span className="font-mono">windswapv4-btb.testnet</span> · test tokens have no value.
      </p>
    </div>
  );
}
