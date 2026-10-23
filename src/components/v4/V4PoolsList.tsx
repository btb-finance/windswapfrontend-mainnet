'use client';

import Link from 'next/link';
import { useNearWallet } from '@/providers/NearWalletProvider';
import { useV4Market, type V4Pool } from '@/hooks/v4/useV4Market';
import { V4Banner } from '@/components/v4/V4Banner';
import { formatFeeBps, formatPrice } from '@/lib/v4/format';

/** Pools of the v4 DEX whose tokens are whitelisted. Each card links to the liquidity page. */
export function V4PoolsList() {
  const { accountId } = useNearWallet();
  const market = useV4Market(accountId);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base sm:text-lg font-semibold">
          Pools <span className="text-gray-400 font-normal text-sm">({market.pools.length})</span>
        </h2>
        <button onClick={market.refresh} className="btn-secondary px-3 py-1.5 text-xs" aria-label="Refresh pools">
          Refresh
        </button>
      </div>

      {market.error && <V4Banner tone="error">{market.error}</V4Banner>}

      {market.loading && market.pools.length === 0 && (
        <div className="swap-card text-center text-sm text-gray-400 py-10">Loading pools from NEAR testnet...</div>
      )}

      {!market.loading && !market.error && market.pools.length === 0 && (
        <div className="swap-card text-center text-sm text-gray-400 py-10">
          No pools with whitelisted tokens yet.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {market.pools.map((pool) => (
          <PoolCard key={pool.poolId} pool={pool} />
        ))}
      </div>
    </div>
  );
}

function PoolCard({ pool }: { pool: V4Pool }) {
  const [t0, t1] = [pool.token0.symbol, pool.token1.symbol];
  return (
    <div className="glass-card p-4 sm:p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-lg font-bold">
            {t0} <span className="text-gray-500">/</span> {t1}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Pool {pool.poolId} · tick spacing {pool.tickSpacing}</div>
        </div>
        <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">{formatFeeBps(pool.fee)} fee</span>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <Stat label={`Price (${t1} per ${t0})`} value={formatPrice(pool.price)} />
        <Stat label="Current tick" value={pool.tick.toString()} />
        <Stat label="Liquidity" value={formatLiquidity(pool.liquidity)} />
        <Stat label="Tick spacing" value={pool.tickSpacing.toString()} />
      </dl>

      <Link
        href={`/v4/liquidity?pool=${pool.poolId}`}
        className="btn-secondary text-center py-2 text-sm"
      >
        Add liquidity
      </Link>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/5 px-3 py-2">
      <dt className="text-[11px] text-gray-400">{label}</dt>
      <dd className="font-mono text-sm mt-0.5 break-all">{value}</dd>
    </div>
  );
}

function formatLiquidity(liquidity: bigint): string {
  if (liquidity === 0n) return '0';
  return Number(liquidity).toExponential(2);
}
