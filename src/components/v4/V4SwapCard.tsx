'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { formatUnits } from 'viem';
import { minAmountOut } from '@/lib/windswap-v4';
import { SwapSettings } from '@/components/swap/SwapSettings';
import { V4TokenField } from '@/components/v4/V4TokenField';
import { V4Banner } from '@/components/v4/V4Banner';
import { useNearWallet } from '@/providers/NearWalletProvider';
import { useV4Market } from '@/hooks/v4/useV4Market';
import { useV4Balances } from '@/hooks/v4/useV4Balances';
import { useV4Send } from '@/hooks/v4/useV4Send';
import { v4Client } from '@/lib/v4/client';
import { readableNearError } from '@/lib/v4/near';
import { formatFeeBps, formatTokenAmount, parseTokenAmount } from '@/lib/v4/format';
import { buildRoutes, toHopInputs, type V4Route } from '@/lib/v4/routes';

type RouteChoice = 'best' | string;
type QuoteState = { out: bigint } | { error: string };

export function V4SwapCard() {
  const { accountId, connect } = useNearWallet();
  const market = useV4Market(accountId);
  const balances = useV4Balances(accountId, market.tokens);
  const { send, pending } = useV4Send();

  const [inId, setInId] = useState<string | null>(null);
  const [outId, setOutId] = useState<string | null>(null);
  const [amountIn, setAmountIn] = useState('');
  const [routeChoice, setRouteChoice] = useState<RouteChoice>('best');
  const [slippage, setSlippage] = useState(0.5);
  const [quotes, setQuotes] = useState<Record<string, QuoteState>>({});
  const [quoting, setQuoting] = useState(false);

  const tokenIn = market.tokens.find((t) => t.accountId === (inId ?? market.tokens[0]?.accountId));
  const tokenOut = market.tokens.find((t) => t.accountId === (outId ?? market.tokens[1]?.accountId));
  const parsedIn = tokenIn ? parseTokenAmount(amountIn, tokenIn.decimals) : null;
  const parsedKey = parsedIn?.toString() ?? '';

  const routes = useMemo<V4Route[]>(
    () => (tokenIn && tokenOut ? buildRoutes(market.pools, tokenIn.accountId, tokenOut.accountId) : []),
    [market.pools, tokenIn, tokenOut],
  );

  // Live quotes for every candidate route, debounced.
  useEffect(() => {
    if (!parsedKey || routes.length === 0) {
      setQuotes({});
      setQuoting(false);
      return;
    }
    const amount = BigInt(parsedKey);
    let cancelled = false;
    setQuoting(true);
    const timer = setTimeout(async () => {
      const entries = await Promise.all(
        routes.map(async (route): Promise<[string, QuoteState]> => {
          try {
            const out = await v4Client.quoteExactInput(toHopInputs(route), amount);
            return [route.id, { out: BigInt(out) }];
          } catch (err) {
            return [route.id, { error: readableNearError(err) }];
          }
        }),
      );
      if (!cancelled) {
        setQuotes(Object.fromEntries(entries));
        setQuoting(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [parsedKey, routes]);

  // Best route = highest output among the routes that quoted successfully.
  const bestId = useMemo(() => {
    let best: { id: string; out: bigint } | null = null;
    for (const route of routes) {
      const q = quotes[route.id];
      if (q && 'out' in q && (!best || q.out > best.out)) best = { id: route.id, out: q.out };
    }
    return best?.id ?? null;
  }, [routes, quotes]);

  const bestQuote = bestId ? quotes[bestId] : undefined;
  const bestOut = bestQuote && 'out' in bestQuote ? bestQuote.out : null;

  const chosenId = routeChoice === 'best' ? bestId : routeChoice;
  const chosenRoute = routes.find((r) => r.id === chosenId) ?? null;
  const chosenQuote = chosenId ? quotes[chosenId] : undefined;
  const amountOut = chosenQuote && 'out' in chosenQuote ? chosenQuote.out : null;
  const minOut = amountOut !== null ? minAmountOut(amountOut, Math.round(slippage * 100)) : null;

  const dexIn = tokenIn ? (balances.dex[tokenIn.accountId] ?? 0n) : 0n;
  const dexEnough = parsedIn !== null && dexIn >= parsedIn;

  const flip = () => {
    setInId(tokenOut?.accountId ?? null);
    setOutId(tokenIn?.accountId ?? null);
    setRouteChoice('best');
  };

  const onSwap = async () => {
    if (!chosenRoute || parsedIn === null || minOut === null || !tokenIn || !tokenOut) return;
    const ok = await send(
      v4Client.actions.swapExactInput({ path: chosenRoute.hops, amountIn: parsedIn, minAmountOut: minOut }),
      `Swapped ${amountIn} ${tokenIn.symbol} for ${tokenOut.symbol}`,
    );
    if (ok) {
      setAmountIn('');
      balances.refresh();
      market.refresh();
    }
  };

  let action: { label: string; onClick?: () => void; disabled: boolean };
  if (!accountId) action = { label: 'Connect NEAR wallet', onClick: connect, disabled: false };
  else if (market.loading && market.pools.length === 0) action = { label: 'Loading pools...', disabled: true };
  else if (routes.length === 0) action = { label: 'No pool for this pair', disabled: true };
  else if (parsedIn === null) action = { label: 'Enter an amount', disabled: true };
  else if (!dexEnough) action = { label: 'Insufficient DEX balance', disabled: true };
  else if (!chosenRoute || amountOut === null) action = { label: quoting ? 'Fetching quote...' : 'No quote for this route', disabled: true };
  else if (pending) action = { label: 'Swapping...', disabled: true };
  else action = { label: 'Swap', onClick: () => void onSwap(), disabled: false };

  return (
    <div className="swap-card max-w-md mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Swap</h2>
        <SwapSettings
          slippage={slippage}
          isAutoSlippage={false}
          deadline={30}
          onSlippageChange={(v) => { if (v > 0) setSlippage(v); }}
          showAuto={false}
          showDeadline={false}
        />
      </div>

      {tokenIn && (
        <V4TokenField
          label="You pay"
          token={tokenIn}
          value={amountIn}
          onChange={setAmountIn}
          balance={accountId ? formatTokenAmount(dexIn, tokenIn.decimals) : '--'}
          onMax={accountId && dexIn > 0n ? () => setAmountIn(formatUnits(dexIn, tokenIn.decimals)) : undefined}
          hint={accountId ? `Trades use your DEX balance. Wallet: ${formatTokenAmount(balances.wallet[tokenIn.accountId] ?? 0n, tokenIn.decimals)} ${tokenIn.symbol}` : undefined}
        />
      )}

      <div className="relative h-0 flex items-center justify-center z-10">
        <button onClick={flip} className="swap-arrow-btn transition-transform hover:scale-110 active:scale-90" aria-label="Swap tokens direction">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </button>
      </div>

      {tokenOut && (
        <V4TokenField
          label="You receive"
          token={tokenOut}
          value={amountOut !== null ? formatUnits(amountOut, tokenOut.decimals) : ''}
          readOnly
          placeholder={quoting ? '...' : '0.0'}
        />
      )}

      {/* Route options */}
      {routes.length > 0 && (
        <div className="mt-3 space-y-2">
          <div className="text-xs text-gray-400">Route</div>
          <div className="grid gap-2">
            <RouteOption
              selected={routeChoice === 'best'}
              onSelect={() => setRouteChoice('best')}
              title="Best route"
              subtitle={bestId ? routes.find((r) => r.id === bestId)?.label ?? '' : 'Enter an amount'}
              right={bestOut !== null && tokenOut ? `${formatTokenAmount(bestOut, tokenOut.decimals)} ${tokenOut.symbol}` : ''}
            />
            {routes.map((route) => {
              const q = quotes[route.id];
              const feeText = route.fees.map(formatFeeBps).join(' + ');
              return (
                <RouteOption
                  key={route.id}
                  selected={routeChoice === route.id}
                  onSelect={() => setRouteChoice(route.id)}
                  title={route.label}
                  subtitle={`Fee ${feeText}`}
                  right={
                    q && 'out' in q && tokenOut
                      ? `${formatTokenAmount(q.out, tokenOut.decimals)} ${tokenOut.symbol}`
                      : q && 'error' in q
                        ? 'unavailable'
                        : quoting ? '...' : ''
                  }
                  badge={route.id === bestId ? 'best' : undefined}
                  error={q && 'error' in q ? q.error : undefined}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Summary */}
      {chosenRoute && amountOut !== null && minOut !== null && tokenIn && tokenOut && (
        <div className="mt-3 p-2 rounded-lg bg-white/5 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-400">Rate</span>
            <span>1 {tokenIn.symbol} = {parsedIn ? formatRate(amountOut, parsedIn, tokenOut.decimals, tokenIn.decimals) : '-'} {tokenOut.symbol}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Min. received</span>
            <span>{formatTokenAmount(minOut, tokenOut.decimals)} {tokenOut.symbol}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Slippage</span>
            <span>{slippage}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Swap fee</span>
            <span>{chosenRoute.fees.map(formatFeeBps).join(' + ')}</span>
          </div>
        </div>
      )}

      {accountId && parsedIn !== null && !dexEnough && (
        <V4Banner tone="warning">
          Swaps spend your internal DEX balance, not your wallet. You have {formatTokenAmount(dexIn, tokenIn?.decimals ?? 18)} {tokenIn?.symbol} in the DEX.{' '}
          <Link href="/v4/portfolio" className="underline font-medium">Deposit in Portfolio</Link>.
        </V4Banner>
      )}

      {market.error && <V4Banner tone="error">{market.error}</V4Banner>}

      <button
        onClick={action.onClick}
        disabled={action.disabled}
        className="w-full btn-primary py-4 text-base mt-4 disabled:opacity-50"
        aria-label={action.label}
      >
        {action.label}
      </button>

      {!accountId && (
        <p className="mt-3 text-center text-xs text-gray-500">
          Testnet only. Tokens are test tokens with no value.
        </p>
      )}
    </div>
  );
}

function RouteOption({
  selected,
  onSelect,
  title,
  subtitle,
  right,
  badge,
  error,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  subtitle: string;
  right: string;
  badge?: string;
  error?: string;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-lg border px-3 py-2 transition ${
        selected ? 'border-primary bg-primary/10' : 'border-white/10 bg-white/5 hover:bg-white/10'
      }`}
      aria-pressed={selected}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium flex items-center gap-2">
          {title}
          {badge && <span className="text-[10px] uppercase tracking-wide text-primary">{badge}</span>}
        </span>
        <span className="text-sm font-mono">{right}</span>
      </div>
      <div className="text-[11px] text-gray-500">{error ?? subtitle}</div>
    </button>
  );
}

function formatRate(out: bigint, input: bigint, outDecimals: number, inDecimals: number): string {
  // out / input, scaled to the token decimals, as a display string with 4 significant places.
  const scale = 10n ** 18n;
  const ratio = (out * scale * 10n ** BigInt(inDecimals)) / (input * 10n ** BigInt(outDecimals));
  return formatTokenAmount(ratio, 18, 4);
}
