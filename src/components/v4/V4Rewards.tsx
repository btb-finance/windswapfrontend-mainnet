'use client';

import { useEffect, useState } from 'react';
import { V4WalletGate } from '@/components/v4/V4WalletGate';
import { V4Banner } from '@/components/v4/V4Banner';
import { useV4Actor } from '@/providers/V4ActorProvider';
import { useNearWallet } from '@/providers/NearWalletProvider';
import { useToast } from '@/providers/ToastProvider';
import { useV4Query } from '@/hooks/v4/useV4Query';
import { useNow } from '@/hooks/v4/useNow';
import { readableNearError } from '@/lib/v4/near';
import { veViews } from '@/lib/v4/ve/views';
import { loadLocks, type VeRow } from '@/lib/v4/ve/loaders';
import { veCalls } from '@/lib/v4/ve/calls';
import { formatCountdown, formatTokenAmount, formatUnixDate } from '@/lib/v4/format';

const DECIMALS = 18;
const POSITIONS_KEY = 'windswap.v4.positions';

interface TrackedPosition {
  poolId: number;
  tickLower: number;
  tickUpper: number;
}

/** Rewards page: epoch and distribute, rebase, and staked LP positions with gauge rewards. */
export function V4Rewards() {
  return (
    <V4WalletGate>
      <V4RewardsInner />
    </V4WalletGate>
  );
}

function V4RewardsInner() {
  const { owner } = useV4Actor();
  const now = useNow(1_000);
  const epoch = useV4Query('epoch', veViews.getEpoch, 30_000);
  const locks = useV4Query(owner ? `locks:${owner}` : null, () => loadLocks(owner!), 30_000);

  return (
    <div className="max-w-5xl mx-auto grid gap-4 lg:grid-cols-[1fr_1.2fr] items-start">
      <div className="space-y-4">
        <EpochCard now={now} epoch={epoch.data} error={epoch.error} onDone={epoch.refresh} />

        <div className="swap-card space-y-3">
          <h2 className="text-lg font-semibold">Rebase</h2>
          <p className="text-xs text-gray-400">Rebase is paid to veNFTs. Claim it per veNFT.</p>
          {locks.data && locks.data.length === 0 && <p className="text-sm text-gray-400">No veNFTs for this wallet.</p>}
          {locks.data?.map((row) => (
            <RebaseRow key={row.lock.token_id} row={row} />
          ))}
        </div>
      </div>

      <PositionsCard owner={owner} />
    </div>
  );
}

function EpochCard({
  now,
  epoch,
  error,
  onDone,
}: {
  now: number;
  epoch: { active_period: number; epoch_count: number; weekly: string; next_epoch_start: number; wind_minted: string; distribution_pending: boolean } | undefined;
  error: string | null;
  onDone: () => void;
}) {
  const near = useNearWallet();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const remaining = epoch ? epoch.next_epoch_start - now : null;
  const ready = epoch !== undefined && now >= epoch.next_epoch_start && !epoch.distribution_pending;

  async function onDistribute() {
    if (!near.accountId) {
      near.connect();
      return;
    }
    setBusy(true);
    try {
      // `distribute` is permissionless, so any NEAR account can run it. It is not a SignedAction.
      await near.signAndSend(veCalls.distribute());
      toast.success('Epoch distributed');
      onDone();
    } catch (err) {
      toast.error(readableNearError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="swap-card space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Epoch</h2>
          <p className="text-xs text-gray-400">Weekly WIND emissions go to gauges by vote weight.</p>
        </div>
        {epoch && <span className="text-[11px] text-gray-500">#{epoch.epoch_count}</span>}
      </div>
      {error && <V4Banner tone="error">{error}</V4Banner>}
      {epoch && (
        <>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg bg-white/5 px-3 py-2">
              <div className="text-[11px] text-gray-400">Next epoch</div>
              <div className="font-mono">{remaining !== null ? formatCountdown(remaining) : '...'}</div>
              <div className="text-[11px] text-gray-500">{formatUnixDate(epoch.next_epoch_start)}</div>
            </div>
            <div className="rounded-lg bg-white/5 px-3 py-2">
              <div className="text-[11px] text-gray-400">Weekly emission</div>
              <div className="font-mono">{formatTokenAmount(BigInt(epoch.weekly), DECIMALS, 2)} WIND</div>
              <div className="text-[11px] text-gray-500">minted so far {formatTokenAmount(BigInt(epoch.wind_minted), DECIMALS, 2)}</div>
            </div>
          </div>
          <button
            onClick={() => void onDistribute()}
            disabled={busy || (near.accountId !== null && !ready)}
            className="w-full btn-primary py-3 disabled:opacity-50"
          >
            {!near.accountId
              ? 'Connect NEAR wallet to distribute'
              : epoch.distribution_pending
                ? 'Distribution in progress'
                : ready
                  ? busy ? 'Confirm in wallet...' : 'Distribute epoch'
                  : 'Epoch not finished yet'}
          </button>
          <V4Banner tone="info">
            Distribute mints the week&apos;s WIND and sends it to gauges. Anyone can call it, so it runs from a NEAR account even in EVM mode.
          </V4Banner>
        </>
      )}
    </div>
  );
}

function RebaseRow({ row }: { row: VeRow }) {
  const { run, pending } = useV4Actor();
  const id = row.lock.token_id;
  const claimable = useV4Query(`rebase:${id}`, () => veViews.claimableRebase(id), 60_000);
  const amount = claimable.data ? BigInt(claimable.data) : 0n;

  async function onClaim() {
    const outcome = await run(veCalls.claimRebase(id), `Rebase claimed for #${id}`);
    if (outcome) claimable.refresh();
  }

  return (
    <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
      <span>veNFT #{id}</span>
      <div className="flex items-center gap-3">
        <span className="font-mono text-xs">{claimable.data !== undefined ? `${formatTokenAmount(amount, DECIMALS, 4)} WIND` : '...'}</span>
        <button onClick={() => void onClaim()} disabled={pending || amount === 0n} className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50">Claim</button>
      </div>
    </div>
  );
}

function PositionsCard({ owner }: { owner: string | null }) {
  const { run, pending } = useV4Actor();
  const [positions, setPositions] = useState<TrackedPosition[]>([]);
  const [poolInput, setPoolInput] = useState('');
  const [lowerInput, setLowerInput] = useState('');
  const [upperInput, setUpperInput] = useState('');

  // Positions are tracked in this browser only: the contract has no list view of stakes.
  useEffect(() => {
    if (!owner) return;
    try {
      const raw = localStorage.getItem(`${POSITIONS_KEY}.${owner}`);
      setPositions(raw ? (JSON.parse(raw) as TrackedPosition[]) : []);
    } catch {
      setPositions([]);
    }
  }, [owner]);

  function save(next: TrackedPosition[]) {
    setPositions(next);
    if (!owner) return;
    try {
      localStorage.setItem(`${POSITIONS_KEY}.${owner}`, JSON.stringify(next));
    } catch {
      // Storage blocked: the list lasts for this page load.
    }
  }

  const form = parseForm(poolInput, lowerInput, upperInput);

  function track() {
    if (!form) return;
    if (positions.some((p) => same(p, form))) return;
    save([...positions, form]);
  }

  async function stake() {
    if (!form) return;
    const outcome = await run(veCalls.stakePosition(form.poolId, form.tickLower, form.tickUpper), `Staked pool ${form.poolId}`);
    if (outcome) track();
  }

  return (
    <div className="swap-card space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Staked LP positions</h2>
        <p className="text-xs text-gray-400 mt-1">
          Stake a concentrated-liquidity position into its pool&apos;s gauge to earn WIND emissions. The position must already exist, with
          ticks on the pool&apos;s spacing. Positions are listed from what you track here.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <input className="input-field !text-sm !py-2" inputMode="numeric" placeholder="Pool id" value={poolInput} onChange={(e) => setPoolInput(e.target.value)} aria-label="Pool id" />
        <input className="input-field !text-sm !py-2" inputMode="numeric" placeholder="Tick lower" value={lowerInput} onChange={(e) => setLowerInput(e.target.value)} aria-label="Tick lower" />
        <input className="input-field !text-sm !py-2" inputMode="numeric" placeholder="Tick upper" value={upperInput} onChange={(e) => setUpperInput(e.target.value)} aria-label="Tick upper" />
      </div>
      <div className="flex gap-2">
        <button onClick={() => void stake()} disabled={pending || !form} className="btn-primary px-4 py-2 text-sm disabled:opacity-50 flex-1">Stake</button>
        <button onClick={track} disabled={!form} className="btn-secondary px-4 py-2 text-sm disabled:opacity-50">Track only</button>
      </div>

      {positions.length === 0 && <p className="text-sm text-gray-500">No positions tracked in this browser.</p>}
      {owner && positions.map((p) => (
        <PositionRow
          key={`${p.poolId}:${p.tickLower}:${p.tickUpper}`}
          owner={owner}
          position={p}
          onRemove={() => save(positions.filter((x) => !same(x, p)))}
        />
      ))}
      {!owner && <p className="text-sm text-gray-500">Loading wallet...</p>}
      {pending && <p className="text-[11px] text-gray-500">Wallet prompt open...</p>}
    </div>
  );
}

function PositionRow({ owner, position, onRemove }: { owner: string; position: TrackedPosition; onRemove: () => void }) {
  const { run, pending } = useV4Actor();
  const { poolId, tickLower, tickUpper } = position;
  const rewards = useV4Query(
    `gauge:${owner}:${poolId}:${tickLower}:${tickUpper}`,
    () => veViews.claimableGaugeRewards(owner, poolId, tickLower, tickUpper),
    60_000,
  );
  const amount = rewards.data ? BigInt(rewards.data) : 0n;

  async function claim() {
    const outcome = await run(veCalls.claimGaugeRewards(poolId, tickLower, tickUpper), `Claimed gauge rewards (pool ${poolId})`);
    if (outcome) rewards.refresh();
  }

  async function unstake() {
    const outcome = await run(veCalls.unstakePosition(poolId, tickLower, tickUpper), `Unstaked pool ${poolId}`);
    if (outcome) onRemove();
  }

  return (
    <div className="rounded-lg bg-white/5 p-3 space-y-2 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-semibold">Pool {poolId}</span>
        <span className="text-[11px] text-gray-400 font-mono">ticks {tickLower} … {tickUpper}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">Claimable WIND</span>
        <span className="font-mono text-xs">{rewards.data !== undefined ? formatTokenAmount(amount, DECIMALS, 4) : '...'}</span>
      </div>
      <div className="flex gap-2">
        <button onClick={() => void claim()} disabled={pending || amount === 0n} className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50 flex-1">Claim</button>
        <button onClick={() => void unstake()} disabled={pending} className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50 flex-1">Unstake</button>
        <button onClick={onRemove} className="text-xs text-gray-400 hover:text-white px-2">Forget</button>
      </div>
    </div>
  );
}

function parseForm(pool: string, lower: string, upper: string): TrackedPosition | null {
  const isInt = (s: string) => /^-?\d+$/.test(s.trim());
  if (!isInt(pool) || !isInt(lower) || !isInt(upper)) return null;
  const poolId = Number(pool);
  const tickLower = Number(lower);
  const tickUpper = Number(upper);
  if (poolId < 0 || tickLower >= tickUpper) return null;
  return { poolId, tickLower, tickUpper };
}

function same(a: TrackedPosition, b: TrackedPosition): boolean {
  return a.poolId === b.poolId && a.tickLower === b.tickLower && a.tickUpper === b.tickUpper;
}
