'use client';

import { useState } from 'react';
import type { FunctionCallAction } from '@/lib/windswap-v4';
import { V4WalletGate } from '@/components/v4/V4WalletGate';
import { V4Banner } from '@/components/v4/V4Banner';
import { useV4Actor } from '@/providers/V4ActorProvider';
import { useV4Query } from '@/hooks/v4/useV4Query';
import { useNow } from '@/hooks/v4/useNow';
import { V4_WIND_TOKEN } from '@/lib/v4/config';
import { balanceViews } from '@/lib/v4/ve/views';
import { loadLocks, type VeRow } from '@/lib/v4/ve/loaders';
import { MAXTIME, WEEK, roundToWeek, veCalls } from '@/lib/v4/ve/calls';
import { formatCountdown, formatTokenAmount, formatUnixDate, parseTokenAmount } from '@/lib/v4/format';

const WIND_DECIMALS = 18;
const MAX_WEEKS = Math.floor(MAXTIME / WEEK);

/** veNFT page: create a WIND lock, then manage each veNFT. */
export function V4Lock() {
  return (
    <V4WalletGate>
      <V4LockInner />
    </V4WalletGate>
  );
}

function V4LockInner() {
  const { owner, run, pending } = useV4Actor();
  const now = useNow();
  const wind = useV4Query(owner ? `wind:${owner}` : null, () => balanceViews.balanceOfOwner(owner!, V4_WIND_TOKEN), 15_000);
  const locks = useV4Query(owner ? `locks:${owner}` : null, () => loadLocks(owner!), 15_000);

  const [amountInput, setAmountInput] = useState('');
  const [weeks, setWeeks] = useState(52);
  const [permanent, setPermanent] = useState(false);

  const windBal = wind.data ? BigInt(wind.data) : 0n;
  const amount = parseTokenAmount(amountInput, WIND_DECIMALS);
  const durationSec = weeks * WEEK;
  const unlock = roundToWeek(now, durationSec);
  const powerEstimate = amount !== null ? (amount * BigInt(durationSec)) / BigInt(MAXTIME) : null;

  let createError: string | null = null;
  if (amountInput && amount === null) createError = 'Enter a positive amount.';
  else if (amount !== null && amount > windBal) createError = 'Not enough WIND in your DEX balance.';

  async function onCreate() {
    if (amount === null) return;
    // One step: a permanent lock is created with `permanent` set, not created and then locked.
    const outcome = await run(veCalls.createLock(amount, durationSec, permanent), permanent ? 'Permanent lock created' : 'Lock created');
    if (outcome) {
      setAmountInput('');
      locks.refresh();
      wind.refresh();
    }
  }

  return (
    <div className="max-w-5xl mx-auto grid gap-4 lg:grid-cols-[0.9fr_1.1fr] items-start">
      {/* Create */}
      <div className="swap-card space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Create lock</h2>
          <p className="text-xs text-gray-400 mt-1">Locks WIND from your DEX balance for up to 4 years. Voting power grows with the lock length.</p>
        </div>

        <div>
          <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
            <span>WIND to lock</span>
            <span>DEX balance: {wind.data !== undefined ? formatTokenAmount(windBal, WIND_DECIMALS) : '...'}</span>
          </div>
          <input
            className="input-field"
            inputMode="decimal"
            placeholder="0.0"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            aria-label="WIND amount to lock"
          />
        </div>

        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-400">Lock length</span>
            <span className="font-mono">{weeks} weeks (~{(weeks / 52).toFixed(2)} years)</span>
          </div>
          <input
            type="range"
            min={1}
            max={MAX_WEEKS}
            step={1}
            value={weeks}
            onChange={(e) => setWeeks(Number(e.target.value))}
            className="w-full accent-amber-400"
            aria-label="Lock length in weeks"
          />
          <div className="flex justify-between text-[11px] text-gray-500 mt-1">
            <span>1 week</span>
            <span>
              <button type="button" onClick={() => setWeeks(MAX_WEEKS)} className="underline">4 years (max)</button>
            </span>
          </div>
        </div>

        <div className="rounded-lg bg-white/5 px-3 py-3 text-sm space-y-1">
          <div className="flex justify-between"><span className="text-gray-400">Unlocks</span><span>{permanent ? 'Never (permanent)' : formatUnixDate(unlock)}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Voting power (estimate)</span><span className="font-mono">{powerEstimate !== null ? formatTokenAmount(powerEstimate, WIND_DECIMALS) : '--'}</span></div>
        </div>

        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={permanent}
            onChange={(e) => setPermanent(e.target.checked)}
            className="mt-1 accent-amber-400"
          />
          <span>
            Permanent lock
            <span className="block text-[11px] text-gray-500">Does not unlock. You can unlock it later with Unlock permanent below.</span>
          </span>
        </label>

        {createError && <V4Banner tone="error">{createError}</V4Banner>}

        <button
          onClick={() => void onCreate()}
          disabled={pending || amount === null || createError !== null}
          className="w-full btn-primary py-3 disabled:opacity-50"
        >
          {pending ? 'Confirm in wallet...' : permanent ? 'Create permanent lock' : 'Create lock'}
        </button>

        <V4Banner tone="info">
          WIND is credited to DEX balances by the team. An EVM wallet has no WIND deposit yet, so this needs a balance on the
          contract. A NEAR account can deposit WIND with <span className="font-mono">ft_transfer_call</span> and a lock message.
        </V4Banner>
      </div>

      {/* Existing locks */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Your veNFTs</h2>
          {locks.loading && <span className="text-[11px] text-gray-500">refreshing...</span>}
        </div>
        {locks.error && <V4Banner tone="error">{locks.error}</V4Banner>}
        {locks.data && locks.data.length === 0 && (
          <div className="swap-card text-sm text-gray-400">No veNFTs for this wallet yet.</div>
        )}
        {locks.data?.map((row) => (
          <LockCard key={row.lock.token_id} row={row} others={locks.data!.filter((r) => r.lock.token_id !== row.lock.token_id)} now={now} onDone={() => { locks.refresh(); wind.refresh(); }} />
        ))}
      </div>
    </div>
  );
}

function LockCard({ row, others, now, onDone }: { row: VeRow; others: VeRow[]; now: number; onDone: () => void }) {
  const { run, pending } = useV4Actor();
  const { lock, power } = row;
  const id = lock.token_id;
  const expired = !lock.permanent && lock.end <= now;

  const [addInput, setAddInput] = useState('');
  const [extendWeeks, setExtendWeeks] = useState(52);
  const [splitInput, setSplitInput] = useState('');
  const [mergeTo, setMergeTo] = useState<number | null>(null);

  const addAmount = parseTokenAmount(addInput, WIND_DECIMALS);
  const splitAmount = parseTokenAmount(splitInput, WIND_DECIMALS);
  const lockedAmount = BigInt(lock.amount);
  const extendUnlock = roundToWeek(now, extendWeeks * WEEK);
  const extendOk = !lock.permanent && extendUnlock > lock.end;

  async function act(call: FunctionCallAction, label: string) {
    const outcome = await run(call, label);
    if (outcome) onDone();
    return outcome;
  }

  return (
    <div className="swap-card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-semibold">veNFT #{id}</div>
          <div className="text-xs text-gray-400">
            {lock.permanent ? 'Permanent lock' : `Unlocks ${formatUnixDate(lock.end)}${expired ? ' (expired)' : ` (${formatCountdown(lock.end - now)})`}`}
          </div>
        </div>
        <div className="flex gap-1 flex-wrap justify-end">
          {lock.voted && <span className="text-[10px] rounded-full bg-amber-500/15 text-amber-300 px-2 py-0.5">voted</span>}
          {lock.permanent && <span className="text-[10px] rounded-full bg-emerald-500/15 text-emerald-300 px-2 py-0.5">permanent</span>}
          {expired && <span className="text-[10px] rounded-full bg-red-500/15 text-red-300 px-2 py-0.5">expired</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-white/5 px-3 py-2">
          <div className="text-[11px] text-gray-400">Locked WIND</div>
          <div className="font-mono">{formatTokenAmount(lockedAmount, WIND_DECIMALS)}</div>
        </div>
        <div className="rounded-lg bg-white/5 px-3 py-2">
          <div className="text-[11px] text-gray-400">Voting power</div>
          <div className="font-mono">{formatTokenAmount(BigInt(power), WIND_DECIMALS)}</div>
        </div>
      </div>

      {/* Add WIND */}
      <div className="flex gap-2">
        <input className="input-field !text-sm !py-2" inputMode="decimal" placeholder="Add WIND" value={addInput} onChange={(e) => setAddInput(e.target.value)} aria-label={`Add WIND to veNFT ${id}`} />
        <button
          onClick={() => addAmount !== null && void act(veCalls.increaseAmount(id, addAmount), `Added WIND to #${id}`).then((o) => o && setAddInput(''))}
          disabled={pending || addAmount === null}
          className="btn-secondary px-3 text-xs disabled:opacity-50 shrink-0"
        >
          Add
        </button>
      </div>

      {/* Extend */}
      {!lock.permanent && (
        <div className="space-y-1">
          <div className="flex gap-2 items-center">
            <input
              type="number"
              min={1}
              max={MAX_WEEKS}
              value={extendWeeks}
              onChange={(e) => setExtendWeeks(Math.min(MAX_WEEKS, Math.max(1, Number(e.target.value) || 1)))}
              className="input-field !text-sm !py-2 w-24"
              aria-label={`Extend veNFT ${id} to weeks from now`}
            />
            <span className="text-xs text-gray-400">weeks from now</span>
            <button
              onClick={() => void act(veCalls.increaseUnlockTime(id, extendWeeks * WEEK), `Extended #${id}`)}
              disabled={pending || !extendOk}
              className="btn-secondary px-3 py-2 text-xs disabled:opacity-50 ml-auto"
            >
              Extend
            </button>
          </div>
          {!extendOk && <div className="text-[11px] text-gray-500">The new unlock must be after the current one ({formatUnixDate(lock.end)}).</div>}
        </div>
      )}

      {/* Split / merge */}
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex gap-2">
          <input className="input-field !text-sm !py-2" inputMode="decimal" placeholder="Split WIND" value={splitInput} onChange={(e) => setSplitInput(e.target.value)} aria-label={`Split amount from veNFT ${id}`} />
          <button
            onClick={() => splitAmount !== null && void act(veCalls.split(id, splitAmount), `Split #${id}`).then((o) => o && setSplitInput(''))}
            disabled={pending || splitAmount === null || lock.permanent}
            className="btn-secondary px-3 text-xs disabled:opacity-50 shrink-0"
          >
            Split
          </button>
        </div>
        <div className="flex gap-2">
          <select
            className="input-field !text-sm !py-2"
            value={mergeTo ?? ''}
            onChange={(e) => setMergeTo(e.target.value ? Number(e.target.value) : null)}
            aria-label={`Merge veNFT ${id} into`}
          >
            <option value="">Merge into...</option>
            {others.map((o) => (
              <option key={o.lock.token_id} value={o.lock.token_id}>#{o.lock.token_id}</option>
            ))}
          </select>
          <button
            onClick={() => mergeTo !== null && void act(veCalls.merge(id, mergeTo), `Merged #${id} into #${mergeTo}`)}
            disabled={pending || mergeTo === null}
            className="btn-secondary px-3 text-xs disabled:opacity-50 shrink-0"
          >
            Merge
          </button>
        </div>
      </div>

      {/* Permanent / withdraw */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => void act(lock.permanent ? veCalls.unlockPermanent(id) : veCalls.lockPermanent(id), lock.permanent ? `Unlocked #${id} from permanent` : `#${id} is permanent`)}
          disabled={pending || expired}
          className="btn-secondary px-3 py-2 text-xs disabled:opacity-50"
        >
          {lock.permanent ? 'Unlock permanent' : 'Make permanent'}
        </button>
        {expired && (
          <button onClick={() => void act(veCalls.withdrawLock(id), `Withdrew #${id}`)} disabled={pending} className="btn-primary px-3 py-2 text-xs disabled:opacity-50">
            Withdraw expired lock
          </button>
        )}
      </div>
    </div>
  );
}
