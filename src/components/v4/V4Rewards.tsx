'use client';

import { V4WalletGate } from '@/components/v4/V4WalletGate';
import { V4Banner } from '@/components/v4/V4Banner';
import { useV4Actor } from '@/providers/V4ActorProvider';
import { useV4Query } from '@/hooks/v4/useV4Query';
import { useNow } from '@/hooks/v4/useNow';
import { veViews } from '@/lib/v4/ve/views';
import { loadLocks, type VeRow } from '@/lib/v4/ve/loaders';
import { veCalls } from '@/lib/v4/ve/calls';
import { ownerViews, type OwnerPositionView, type StakeOfOwner } from '@/lib/v4/owner-views';
import { formatCountdown, formatTokenAmount, formatUnixDate } from '@/lib/v4/format';

const DECIMALS = 18;

/** Rewards page: epoch and distribute, rebase, and liquidity positions with their gauge stake and rewards. */
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
          {locks.error && <V4Banner tone="error">{locks.error}</V4Banner>}
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
  const { run, pending, connected, connect, mode } = useV4Actor();

  const remaining = epoch ? epoch.next_epoch_start - now : null;
  const ready = epoch !== undefined && now >= epoch.next_epoch_start && !epoch.distribution_pending;

  async function onDistribute() {
    // `distribute` is permissionless. NEAR mode sends it from the account; EVM mode signs `"Distribute"`.
    const outcome = await run(veCalls.distribute(), 'Epoch distributed');
    if (outcome) onDone();
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
            onClick={() => (connected ? void onDistribute() : connect())}
            disabled={pending || (connected && !ready)}
            className="w-full btn-primary py-3 disabled:opacity-50"
          >
            {!connected
              ? mode === 'near' ? 'Connect NEAR wallet to distribute' : 'Connect EVM wallet to distribute'
              : epoch.distribution_pending
                ? 'Distribution in progress'
                : ready
                  ? pending ? 'Confirm in wallet...' : 'Distribute epoch'
                  : 'Epoch not finished yet'}
          </button>
          <V4Banner tone="info">
            Distribute mints the week&apos;s WIND and sends it to gauges. Anyone can call it. In EVM mode it is signed as a
            Distribute action and relayed.
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

/** Liquidity positions of the owner from the contract, with stake state. Stake, claim and unstake per range. */
function PositionsCard({ owner }: { owner: string | null }) {
  const { pending } = useV4Actor();
  const positions = useV4Query(owner ? `positions:${owner}` : null, () => ownerViews.positionsOfOwner(owner!), 20_000);
  const stakes = useV4Query(owner ? `stakes:${owner}` : null, () => ownerViews.stakesOfOwner(owner!), 20_000);

  const stakeByRange = new Map<string, StakeOfOwner>(
    (stakes.data ?? []).map((s) => [rangeKey(s.pool_id, s.tick_lower, s.tick_upper), s]),
  );
  const refreshAll = () => {
    positions.refresh();
    stakes.refresh();
  };

  return (
    <div className="swap-card space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Liquidity positions</h2>
        <p className="text-xs text-gray-400 mt-1">
          Stake a position into its pool&apos;s gauge to earn WIND emissions. Positions are read from the contract for this wallet.
          Create or change them on the Liquidity page.
        </p>
      </div>

      {positions.error && <V4Banner tone="error">{positions.error}</V4Banner>}
      {owner && positions.data && positions.data.length === 0 && <p className="text-sm text-gray-500">No positions for this wallet yet.</p>}
      {!owner && <p className="text-sm text-gray-500">Loading wallet...</p>}
      {positions.data?.map((p) => (
        <PositionRow
          key={rangeKey(p.pool_id, p.tick_lower, p.tick_upper)}
          owner={owner!}
          position={p}
          stakeTokenId={stakeByRange.get(rangeKey(p.pool_id, p.tick_lower, p.tick_upper))?.token_id ?? null}
          onChanged={refreshAll}
        />
      ))}
      {pending && <p className="text-[11px] text-gray-500">Wallet prompt open...</p>}
    </div>
  );
}

function PositionRow({
  owner,
  position,
  stakeTokenId,
  onChanged,
}: {
  owner: string;
  position: OwnerPositionView;
  stakeTokenId: string | null;
  onChanged: () => void;
}) {
  const { run, pending, connected } = useV4Actor();
  const { pool_id: poolId, tick_lower: tickLower, tick_upper: tickUpper, staked } = position;
  const rewards = useV4Query(
    staked ? `gauge:${owner}:${poolId}:${tickLower}:${tickUpper}` : null,
    () => veViews.claimableGaugeRewards(owner, poolId, tickLower, tickUpper),
    60_000,
  );
  const amount = rewards.data ? BigInt(rewards.data) : 0n;

  async function stake() {
    const outcome = await run(veCalls.stakePosition(poolId, tickLower, tickUpper), `Staked pool ${poolId}`);
    if (outcome) onChanged();
  }

  async function claim() {
    const outcome = await run(veCalls.claimGaugeRewards(poolId, tickLower, tickUpper), `Claimed gauge rewards (pool ${poolId})`);
    if (outcome) rewards.refresh();
  }

  async function unstake() {
    const outcome = await run(veCalls.unstakePosition(poolId, tickLower, tickUpper), `Unstaked pool ${poolId}`);
    if (outcome) onChanged();
  }

  return (
    <div className="rounded-lg bg-white/5 p-3 space-y-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">Pool {poolId}</span>
        <div className="flex items-center gap-2">
          {staked ? (
            <span className="text-[10px] rounded-full bg-emerald-500/15 text-emerald-300 px-2 py-0.5">staked{stakeTokenId ? ` · NFT ${stakeTokenId}` : ''}</span>
          ) : (
            <span className="text-[10px] rounded-full bg-white/10 text-gray-300 px-2 py-0.5">not staked</span>
          )}
          <span className="text-[11px] text-gray-400 font-mono">ticks {tickLower} … {tickUpper}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-[11px] text-gray-400">Liquidity</div>
          <div className="font-mono break-all">{position.liquidity}</div>
        </div>
        <div>
          <div className="text-[11px] text-gray-400">Owed fees (not collected)</div>
          <div className="font-mono break-all">{position.tokens_owed0} · {position.tokens_owed1}</div>
        </div>
      </div>
      {staked && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Claimable WIND</span>
          <span className="font-mono text-xs">{rewards.data !== undefined ? formatTokenAmount(amount, DECIMALS, 4) : '...'}</span>
        </div>
      )}
      <div className="flex gap-2">
        {staked ? (
          <>
            <button onClick={() => void claim()} disabled={pending || !connected || amount === 0n} className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50 flex-1">Claim</button>
            <button onClick={() => void unstake()} disabled={pending || !connected} className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50 flex-1">Unstake</button>
          </>
        ) : (
          <button onClick={() => void stake()} disabled={pending || !connected || BigInt(position.liquidity) === 0n} className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50 flex-1">
            Stake
          </button>
        )}
      </div>
    </div>
  );
}

function rangeKey(poolId: number, tickLower: number, tickUpper: number): string {
  return `${poolId}:${tickLower}:${tickUpper}`;
}
