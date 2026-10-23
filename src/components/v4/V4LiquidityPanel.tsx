'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { formatUnits } from 'viem';
import { v4Client } from '@/lib/v4/client';
import { readableNearError } from '@/lib/v4/near';
import { formatFeeBps, formatPrice, formatTokenAmount, parseTokenAmount } from '@/lib/v4/format';
import {
  amountsForLiquidity,
  fullRangeTicks,
  isInRange,
  liquidityFromAmount0,
  liquidityFromAmount1,
  rangeTicksFromPrices,
  type RangeTicks,
} from '@/lib/v4/liquidity';
import { useNearWallet } from '@/providers/NearWalletProvider';
import { useV4Market, type V4Pool } from '@/hooks/v4/useV4Market';
import { useV4Balances } from '@/hooks/v4/useV4Balances';
import { useV4Send } from '@/hooks/v4/useV4Send';
import { V4TokenField } from '@/components/v4/V4TokenField';
import { V4Banner } from '@/components/v4/V4Banner';
import type { PositionView } from '@/lib/windswap-v4';

/** Form state for one pool. Reset when the selected pool changes. */
interface Draft {
  poolId: number | null;
  fullRange: boolean;
  minPrice: string;
  maxPrice: string;
  amount0: string;
  amount1: string;
  /** Which amount the user typed last. The other one is derived from the liquidity. */
  last: 0 | 1;
}

const EMPTY_DRAFT: Draft = { poolId: null, fullRange: false, minPrice: '', maxPrice: '', amount0: '', amount1: '', last: 0 };

function defaultPrices(pool: V4Pool): { minPrice: string; maxPrice: string } {
  return {
    minPrice: formatPlain(pool.price * 0.9),
    maxPrice: formatPlain(pool.price * 1.1),
  };
}

/** Decimal string for a number without exponent notation where possible (price inputs). */
function formatPlain(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  return Number(value.toPrecision(6)).toString();
}

export function V4LiquidityPanel() {
  const { accountId, connect } = useNearWallet();
  const market = useV4Market(accountId);
  const searchParams = useSearchParams();
  const requestedParam = searchParams.get('pool');
  const requestedPool = requestedParam !== null ? Number(requestedParam) : null;

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const wantedId = selectedId ?? requestedPool;
  const pool: V4Pool | undefined = market.pools.find((p) => p.poolId === wantedId) ?? market.pools[0];

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const d: Draft = pool && draft.poolId === pool.poolId ? draft : EMPTY_DRAFT;

  const balances = useV4Balances(accountId, market.tokens);
  const { send, pending } = useV4Send();

  const patch = (p: Partial<Draft>) => {
    if (!pool) return;
    setDraft((prev) => {
      const base = prev.poolId === pool.poolId ? prev : { ...EMPTY_DRAFT, poolId: pool.poolId, ...defaultPrices(pool) };
      return { ...base, ...p };
    });
  };

  // Effective range: the draft, or the default ±10% around the current price.
  const defaults = pool ? defaultPrices(pool) : { minPrice: '', maxPrice: '' };
  const minPrice = d.poolId === null ? defaults.minPrice : d.minPrice || defaults.minPrice;
  const maxPrice = d.poolId === null ? defaults.maxPrice : d.maxPrice || defaults.maxPrice;

  const rangeResult = useMemo(() => {
    if (!pool) return null;
    if (d.fullRange) return { ok: true as const, ticks: fullRangeTicks(pool.tickSpacing) };
    return rangeTicksFromPrices(pool, minPrice, maxPrice);
  }, [pool, d.fullRange, minPrice, maxPrice]);
  const ticks: RangeTicks | null = rangeResult && rangeResult.ok ? rangeResult.ticks : null;
  const rangeError = rangeResult && !rangeResult.ok ? rangeResult.error : null;

  // Amounts: the typed side is parsed; the other side is derived from liquidity.
  const typed0 = d.amount0 ? parseTokenAmount(d.amount0, pool?.token0.decimals ?? 18) : null;
  const typed1 = d.amount1 ? parseTokenAmount(d.amount1, pool?.token1.decimals ?? 18) : null;

  const liquidity = useMemo<bigint>(() => {
    if (!pool || !ticks) return 0n;
    if (d.last === 0) return typed0 ? liquidityFromAmount0(pool, ticks, typed0) : 0n;
    return typed1 ? liquidityFromAmount1(pool, ticks, typed1) : 0n;
  }, [pool, ticks, d.last, typed0, typed1]);

  const needed = useMemo(() => {
    if (!pool || !ticks || liquidity === 0n) return null;
    return amountsForLiquidity(pool, ticks, liquidity);
  }, [pool, ticks, liquidity]);

  const shown0 = d.last === 0 ? d.amount0 : needed ? formatUnits(needed.amount0, pool?.token0.decimals ?? 18) : '';
  const shown1 = d.last === 1 ? d.amount1 : needed ? formatUnits(needed.amount1, pool?.token1.decimals ?? 18) : '';

  const dex0 = pool ? (balances.dex[pool.token0.accountId] ?? 0n) : 0n;
  const dex1 = pool ? (balances.dex[pool.token1.accountId] ?? 0n) : 0n;
  const enoughDex = !!needed && dex0 >= needed.amount0 && dex1 >= needed.amount1;

  // Position for the chosen range.
  const [position, setPosition] = useState<PositionView | null>(null);
  const [positionError, setPositionError] = useState<string | null>(null);
  const [burnInput, setBurnInput] = useState('');
  const [positionTick, setPositionTick] = useState(0);

  useEffect(() => {
    if (!pool || !ticks || !accountId) {
      setPosition(null);
      return;
    }
    let cancelled = false;
    v4Client
      .getPosition(pool.poolId, accountId, ticks.tickLower, ticks.tickUpper)
      .then((p) => {
        if (!cancelled) {
          setPosition(p);
          setPositionError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPosition(null);
          setPositionError(readableNearError(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pool, ticks, accountId, positionTick]);

  const positionLiquidity = position ? BigInt(position.liquidity) : 0n;
  const burnAmount = parseBigInt(burnInput);

  const onMint = async () => {
    if (!pool || !ticks || liquidity === 0n) return;
    const ok = await send(
      v4Client.actions.mintPosition({ poolId: pool.poolId, tickLower: ticks.tickLower, tickUpper: ticks.tickUpper, liquidity }),
      `Added liquidity to pool ${pool.poolId}`,
    );
    if (ok) {
      setDraft((prev) => ({ ...prev, amount0: '', amount1: '' }));
      balances.refresh();
      market.refresh();
      setPositionTick((t) => t + 1);
    }
  };

  const onBurn = async () => {
    if (!pool || !ticks || burnAmount === null) return;
    const ok = await send(
      v4Client.actions.burnPosition({ poolId: pool.poolId, tickLower: ticks.tickLower, tickUpper: ticks.tickUpper, liquidity: burnAmount }),
      'Removed liquidity. Collect to move tokens to your DEX balance.',
    );
    if (ok) {
      setBurnInput('');
      market.refresh();
      setPositionTick((t) => t + 1);
    }
  };

  const onCollect = async () => {
    if (!pool || !ticks) return;
    const ok = await send(
      v4Client.actions.collect({ poolId: pool.poolId, tickLower: ticks.tickLower, tickUpper: ticks.tickUpper }),
      'Collected tokens to your DEX balance',
    );
    if (ok) {
      balances.refresh();
      setPositionTick((t) => t + 1);
    }
  };

  if (market.loading && market.pools.length === 0) {
    return <div className="swap-card max-w-md mx-auto text-center text-sm text-gray-400 py-10">Loading pools...</div>;
  }
  if (!pool) {
    return (
      <div className="swap-card max-w-md mx-auto text-center text-sm text-gray-400 py-10">
        {market.error ?? 'No pools with whitelisted tokens yet.'}
      </div>
    );
  }

  const inRange = ticks ? isInRange(pool, ticks) : false;
  let action: { label: string; onClick?: () => void; disabled: boolean };
  if (!accountId) action = { label: 'Connect NEAR wallet', onClick: connect, disabled: false };
  else if (rangeError) action = { label: 'Fix price range', disabled: true };
  else if (liquidity === 0n) action = { label: 'Enter an amount', disabled: true };
  else if (!enoughDex) action = { label: 'Insufficient DEX balance', disabled: true };
  else if (pending) action = { label: 'Confirm in wallet...', disabled: true };
  else action = { label: 'Add liquidity', onClick: () => void onMint(), disabled: false };

  return (
    <div className="grid gap-4 lg:grid-cols-2 max-w-5xl mx-auto">
      {/* Add liquidity */}
      <div className="swap-card">
        <h2 className="text-lg font-semibold mb-3">Add liquidity</h2>

        <div className="flex flex-wrap gap-2 mb-4">
          {market.pools.map((p) => (
            <button
              key={p.poolId}
              onClick={() => setSelectedId(p.poolId)}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm border transition ${
                p.poolId === pool.poolId ? 'border-primary bg-primary/10 text-white' : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              {p.token0.symbol}/{p.token1.symbol} · {formatFeeBps(p.fee)}
            </button>
          ))}
        </div>

        <div className="text-xs text-gray-400 mb-4">
          Current price: <span className="font-mono text-white">{formatPrice(pool.price)}</span> {pool.token1.symbol} per {pool.token0.symbol}
          {' · '}tick {pool.tick} · spacing {pool.tickSpacing}
        </div>

        {/* Range */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">Price range</span>
          <button
            onClick={() => patch({ fullRange: !d.fullRange })}
            className={`text-xs px-2 py-1 rounded-md border ${d.fullRange ? 'border-primary text-primary' : 'border-white/10 text-gray-400 hover:text-white'}`}
          >
            Full range
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <PriceInput
            label={`Min (${pool.token1.symbol} per ${pool.token0.symbol})`}
            value={minPrice}
            disabled={d.fullRange}
            onChange={(v) => patch({ minPrice: v })}
          />
          <PriceInput
            label={`Max (${pool.token1.symbol} per ${pool.token0.symbol})`}
            value={maxPrice}
            disabled={d.fullRange}
            onChange={(v) => patch({ maxPrice: v })}
          />
        </div>
        <div className="text-[11px] text-gray-500 mb-4">
          {ticks ? (
            <>
              Ticks {ticks.tickLower} to {ticks.tickUpper} ·{' '}
              {inRange ? <span className="text-green-400">in range</span> : <span className="text-amber-300">out of range: only one token will be used</span>}
            </>
          ) : (
            'Choose a price range'
          )}
        </div>
        {rangeError && <V4Banner tone="warning">{rangeError}</V4Banner>}

        {/* Amounts */}
        <div className="space-y-3 mt-4">
          <V4TokenField
            label="Amount"
            token={pool.token0}
            value={shown0}
            onChange={(v) => patch({ amount0: v, last: 0 })}
            balance={accountId ? formatTokenAmount(dex0, pool.token0.decimals) : '--'}
            hint={accountId ? 'Amounts come from your DEX balance' : undefined}
          />
          <V4TokenField
            label="Amount"
            token={pool.token1}
            value={shown1}
            onChange={(v) => patch({ amount1: v, last: 1 })}
            balance={accountId ? formatTokenAmount(dex1, pool.token1.decimals) : '--'}
          />
        </div>

        {needed && liquidity > 0n && !enoughDex && accountId && (
          <V4Banner tone="warning">
            This position needs more DEX balance than you have. <Link href="/v4/portfolio" className="underline font-medium">Deposit in Portfolio</Link>.
          </V4Banner>
        )}

        <button
          onClick={action.onClick}
          disabled={action.disabled}
          className="w-full btn-primary py-4 text-base mt-4 disabled:opacity-50"
          aria-label={action.label}
        >
          {action.label}
        </button>
      </div>

      {/* Position */}
      <div className="swap-card">
        <h2 className="text-lg font-semibold mb-1">Your position</h2>
        <p className="text-xs text-gray-400 mb-4">
          {ticks ? `Ticks ${ticks.tickLower} to ${ticks.tickUpper}` : 'Select a price range to see your position.'}
        </p>

        {!accountId ? (
          <p className="text-sm text-gray-400">Connect a NEAR wallet to see your position.</p>
        ) : positionError ? (
          <V4Banner tone="error">{positionError}</V4Banner>
        ) : (
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <Stat label="Liquidity" value={positionLiquidity.toString()} />
            <Stat label="Owed (not collected)" value={position ? `${formatTokenAmount(BigInt(position.tokens_owed0), pool.token0.decimals)} ${pool.token0.symbol} · ${formatTokenAmount(BigInt(position.tokens_owed1), pool.token1.decimals)} ${pool.token1.symbol}` : '-'} />
          </dl>
        )}

        {accountId && positionLiquidity > 0n && (
          <div className="mt-4 space-y-2">
            <label className="text-sm text-gray-400 block">Remove liquidity (raw units)</label>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={burnInput}
                onChange={(e) => setBurnInput(e.target.value.replace(/[^\d]/g, ''))}
                placeholder="0"
                className="flex-1 min-w-0 input"
              />
              <button onClick={() => setBurnInput(positionLiquidity.toString())} className="btn-secondary px-3 text-xs">Max</button>
            </div>
            <button
              onClick={() => void onBurn()}
              disabled={pending || burnAmount === null || burnAmount > positionLiquidity}
              className="w-full btn-secondary py-3 text-sm disabled:opacity-50"
            >
              Remove liquidity
            </button>
          </div>
        )}

        {accountId && position && (BigInt(position.tokens_owed0) > 0n || BigInt(position.tokens_owed1) > 0n) && (
          <button onClick={() => void onCollect()} disabled={pending} className="w-full btn-primary py-3 text-sm mt-3 disabled:opacity-50">
            Collect to DEX balance
          </button>
        )}

        <V4Banner tone="info">
          Removing liquidity moves tokens into the position as owed amounts. Collect moves them to your DEX balance, and
          then you can withdraw them in Portfolio. Pools and ranges are testnet only.
        </V4Banner>
      </div>
    </div>
  );
}

function PriceInput({ label, value, disabled, onChange }: { label: string; value: string; disabled?: boolean; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-[11px] text-gray-400 block mb-1">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value;
          if (v === '' || /^\d*\.?\d*(e[+-]?\d*)?$/i.test(v)) onChange(v);
        }}
        className="w-full input font-mono disabled:opacity-50"
      />
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/5 px-3 py-2">
      <dt className="text-[11px] text-gray-400">{label}</dt>
      <dd className="font-mono text-xs sm:text-sm mt-0.5 break-all">{value}</dd>
    </div>
  );
}

function parseBigInt(s: string): bigint | null {
  if (!/^\d+$/.test(s)) return null;
  const v = BigInt(s);
  return v > 0n ? v : null;
}
