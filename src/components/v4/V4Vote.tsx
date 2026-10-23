'use client';

import { useMemo, useState } from 'react';
import { V4WalletGate } from '@/components/v4/V4WalletGate';
import { V4Banner } from '@/components/v4/V4Banner';
import { useV4Actor } from '@/providers/V4ActorProvider';
import { useV4Query } from '@/hooks/v4/useV4Query';
import { useNow } from '@/hooks/v4/useNow';
import { internalTokenSymbol } from '@/lib/v4/config';
import { balanceViews, veViews } from '@/lib/v4/ve/views';
import { loadGauges, loadLocks, type GaugeRow, type VeRow } from '@/lib/v4/ve/loaders';
import { veCalls } from '@/lib/v4/ve/calls';
import { ownerViews } from '@/lib/v4/owner-views';
import { formatCountdown, formatTokenAmount, parseTokenAmount } from '@/lib/v4/format';

const DECIMALS = 18;

/** Vote page: gauges, veNFT votes, fee and bribe claims, and bribes. */
export function V4Vote() {
  return (
    <V4WalletGate>
      <V4VoteInner />
    </V4WalletGate>
  );
}

function V4VoteInner() {
  const { owner } = useV4Actor();
  const now = useNow();
  const gauges = useV4Query('gauges', loadGauges, 30_000);
  const locks = useV4Query(owner ? `locks:${owner}` : null, () => loadLocks(owner!), 30_000);
  const epoch = useV4Query('epoch', veViews.getEpoch, 60_000);
  const bribeTokens = useV4Query('bribe-tokens', ownerViews.getBribeTokens, 300_000);

  const gaugeList = gauges.data ?? [];
  const bribeList = bribeTokens.data ?? [];

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
        <div className="swap-card">
          <div className="text-[11px] text-gray-400">Next epoch</div>
          <div className="text-xl font-semibold font-mono">
            {epoch.data ? formatCountdown(epoch.data.next_epoch_start - now) : '...'}
          </div>
          <p className="text-xs text-gray-500 mt-1">Votes are once per epoch. Weekly emissions follow the votes.</p>
        </div>
        <div className="swap-card">
          <h2 className="text-lg font-semibold mb-2">Gauges</h2>
          {gauges.error && <V4Banner tone="error">{gauges.error}</V4Banner>}
          {gauges.data && gaugeList.length === 0 && <p className="text-sm text-gray-400">No gauges yet.</p>}
          <div className="space-y-1.5">
            {gaugeList.map((g) => (
              <div key={g.poolId} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
                <span>
                  <span className="font-semibold">{g.pair}</span>
                  <span className="text-[11px] text-gray-500 ml-2">pool {g.poolId} · gauge {g.gauge.gauge_id}</span>
                </span>
                <span className="font-mono text-xs text-gray-300">
                  {g.gauge.alive ? `weight ${formatTokenAmount(BigInt(g.gauge.weight), DECIMALS, 2)}` : 'killed'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {locks.error && <V4Banner tone="error">{locks.error}</V4Banner>}
      {locks.data && locks.data.length === 0 && (
        <div className="swap-card text-sm text-gray-400">Create a lock on the Lock page first. Votes use veNFT voting power.</div>
      )}
      {locks.data?.map((row) => (
        <VoteCard key={row.lock.token_id} row={row} gauges={gaugeList} bribeTokens={bribeList} onDone={() => locks.refresh()} />
      ))}

      <BribeCard gauges={gaugeList} bribeTokens={bribeList} bribeTokensError={bribeTokens.error} />
    </div>
  );
}

function VoteCard({ row, gauges, bribeTokens, onDone }: { row: VeRow; gauges: GaugeRow[]; bribeTokens: string[]; onDone: () => void }) {
  const { run, pending } = useV4Actor();
  const id = row.lock.token_id;
  const byPool = useMemo(() => new Map(gauges.map((g) => [g.poolId, g])), [gauges]);

  // Gauge ids for the pools this veNFT currently votes for. Claims take gauge ids.
  const votedGaugeIds = row.votes.map(([pool]) => byPool.get(pool)?.gauge.gauge_id).filter((g): g is number => g !== undefined);
  const gaugeKey = votedGaugeIds.join(',');
  const fees = useV4Query(gaugeKey ? `fees:${id}:${gaugeKey}` : null, () => veViews.claimableFees(id, votedGaugeIds), 60_000);
  // Bribes are claimed for every bribe token the DEX accepts (`get_bribe_tokens`).
  const tokensKey = bribeTokens.join(',');
  const bribes = useV4Query(
    gaugeKey && tokensKey ? `bribes:${id}:${gaugeKey}:${tokensKey}` : null,
    () => veViews.claimableBribes(id, votedGaugeIds, bribeTokens),
    60_000,
  );

  // Vote allocation: percent per gauge, total must be 100.
  const [alloc, setAlloc] = useState<Record<number, string>>({});
  const selected = gauges.filter((g) => Number(alloc[g.poolId] ?? 0) > 0);
  const total = selected.reduce((sum, g) => sum + Number(alloc[g.poolId] ?? 0), 0);
  const voteOk = selected.length > 0 && total === 100;

  async function onVote() {
    const outcome = await run(
      veCalls.vote(id, selected.map((g) => g.poolId), selected.map((g) => BigInt(alloc[g.poolId]))),
      `Voted with #${id}`,
    );
    if (outcome) onDone();
  }

  async function onClaimFees() {
    const outcome = await run(veCalls.claimFees(id, votedGaugeIds), `Claimed fees for #${id}`);
    if (outcome) fees.refresh();
  }

  async function onClaimBribes() {
    const outcome = await run(veCalls.claimBribes(id, votedGaugeIds, bribeTokens), `Claimed bribes for #${id}`);
    if (outcome) bribes.refresh();
  }

  const feeTotal = (fees.data ?? []).some(([, amt]) => BigInt(amt) > 0n);
  const bribeTotal = (bribes.data ?? []).some(([, amt]) => BigInt(amt) > 0n);

  return (
    <div className="swap-card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-semibold">veNFT #{id}</div>
          <div className="text-xs text-gray-400">Voting power {formatTokenAmount(BigInt(row.power), DECIMALS, 2)} WIND</div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void run(veCalls.poke(id), `Poked #${id}`).then((o) => o && onDone())} disabled={pending} className="btn-secondary px-3 py-2 text-xs disabled:opacity-50">Poke</button>
          <button onClick={() => void run(veCalls.reset(id), `Reset votes for #${id}`).then((o) => o && onDone())} disabled={pending || row.votes.length === 0} className="btn-secondary px-3 py-2 text-xs disabled:opacity-50">Reset votes</button>
        </div>
      </div>

      {/* Current votes */}
      <div className="text-sm">
        <div className="text-[11px] text-gray-400 mb-1">Current votes</div>
        {row.votes.length === 0 ? (
          <div className="text-gray-500 text-xs">No votes this epoch.</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {row.votes.map(([pool, weight]) => (
              <span key={pool} className="rounded-full bg-white/5 border border-white/10 px-2.5 py-1 text-xs">
                {byPool.get(pool)?.pair ?? `pool ${pool}`}: <span className="font-mono">{formatTokenAmount(BigInt(weight), DECIMALS, 2)}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Vote allocation */}
      <div className="space-y-2">
        <div className="text-[11px] text-gray-400">Allocate (percent, must total 100)</div>
        {gauges.map((g) => (
          <div key={g.poolId} className="flex items-center gap-2 text-sm">
            <span className="flex-1 min-w-0 truncate">{g.pair}</span>
            <input
              type="number"
              min={0}
              max={100}
              value={alloc[g.poolId] ?? ''}
              placeholder="0"
              onChange={(e) => setAlloc((prev) => ({ ...prev, [g.poolId]: e.target.value }))}
              className="input-field !text-sm !py-1.5 w-24"
              aria-label={`Percent for ${g.pair} on veNFT ${id}`}
            />
          </div>
        ))}
        <div className="flex items-center justify-between">
          <span className={`text-xs ${total === 100 || selected.length === 0 ? 'text-gray-400' : 'text-amber-300'}`}>Total {total}%</span>
          <button onClick={() => void onVote()} disabled={pending || !voteOk} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">Vote</button>
        </div>
      </div>

      {/* Claims */}
      <div className="rounded-lg bg-white/5 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Rewards</span>
          <span className="text-[11px] text-gray-500">{votedGaugeIds.length} voted gauge(s)</span>
        </div>
        <div className="text-xs text-gray-300 space-y-1">
          <div>Fees: {votedGaugeIds.length === 0 ? '--' : (fees.data ?? []).map(([t, a]) => `${formatTokenAmount(BigInt(a), DECIMALS)} ${internalTokenSymbol(t)}`).join(' · ') || '...'}</div>
          <div>Bribes: {votedGaugeIds.length === 0 ? '--' : (bribes.data ?? []).map(([t, a]) => `${formatTokenAmount(BigInt(a), DECIMALS)} ${internalTokenSymbol(t)}`).join(' · ') || '...'}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-gray-500 flex-1 min-w-[12rem]">Bribe tokens: {bribeTokens.length ? bribeTokens.map(internalTokenSymbol).join(', ') : 'none whitelisted'}</span>
          <button onClick={() => void onClaimFees()} disabled={pending || votedGaugeIds.length === 0 || !feeTotal} className="btn-secondary px-3 py-2 text-xs disabled:opacity-50">Claim fees</button>
          <button onClick={() => void onClaimBribes()} disabled={pending || votedGaugeIds.length === 0 || !bribeTotal} className="btn-secondary px-3 py-2 text-xs disabled:opacity-50">Claim bribes</button>
        </div>
      </div>
    </div>
  );
}

function BribeCard({
  gauges,
  bribeTokens,
  bribeTokensError,
}: {
  gauges: GaugeRow[];
  bribeTokens: string[];
  bribeTokensError: string | null;
}) {
  const { run, pending, owner } = useV4Actor();
  const [poolId, setPoolId] = useState<number | null>(null);
  const [tokenPick, setTokenPick] = useState<string | null>(null);
  const [amountInput, setAmountInput] = useState('');
  const amount = parseTokenAmount(amountInput, DECIMALS);
  const token = tokenPick && bribeTokens.includes(tokenPick) ? tokenPick : (bribeTokens[0] ?? null);
  const balance = useV4Query(owner && token ? `bal:${owner}:${token}` : null, () => balanceViews.balanceOfOwner(owner!, token!), 20_000);
  const selectedPool = poolId ?? gauges[0]?.poolId ?? null;

  async function onBribe() {
    if (selectedPool === null || amount === null || token === null) return;
    const outcome = await run(veCalls.bribe(selectedPool, token, amount), 'Bribe added');
    if (outcome) setAmountInput('');
  }

  return (
    <div className="swap-card space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Bribe a gauge</h2>
        <p className="text-xs text-gray-400 mt-1">Adds a reward for voters of a pool. The amount is paid from your DEX balance of that token. Only bribe tokens the DEX accepts are listed.</p>
      </div>
      {bribeTokensError && <V4Banner tone="error">{bribeTokensError}</V4Banner>}
      {token && (
        <div className="text-[11px] text-gray-400">
          DEX balance of {internalTokenSymbol(token)}: <span className="font-mono">{balance.data !== undefined ? formatTokenAmount(BigInt(balance.data), DECIMALS) : '...'}</span>
        </div>
      )}
      {!bribeTokensError && bribeTokens.length === 0 && <p className="text-sm text-gray-500">No bribe tokens are whitelisted on the DEX yet.</p>}
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <select className="input-field !text-sm !py-2" value={selectedPool ?? ''} onChange={(e) => setPoolId(Number(e.target.value))} aria-label="Pool to bribe">
          {gauges.map((g) => (
            <option key={g.poolId} value={g.poolId}>{g.pair} (pool {g.poolId})</option>
          ))}
        </select>
        <select className="input-field !text-sm !py-2" value={token ?? ''} onChange={(e) => setTokenPick(e.target.value)} disabled={bribeTokens.length === 0} aria-label="Bribe token">
          {bribeTokens.map((t) => (
            <option key={t} value={t}>{internalTokenSymbol(t)}</option>
          ))}
        </select>
        <input className="input-field !text-sm !py-2" inputMode="decimal" placeholder="Amount" value={amountInput} onChange={(e) => setAmountInput(e.target.value)} aria-label="Bribe amount" />
        <button onClick={() => void onBribe()} disabled={pending || amount === null || selectedPool === null || token === null} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">Bribe</button>
      </div>
    </div>
  );
}
