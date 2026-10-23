/** Loaders that combine several views into the rows the v4 ve pages show. */

import { V4_POOL_PROBE_MAX, internalTokenSymbol } from '@/lib/v4/config';
import { v4Client } from '@/lib/v4/client';
import { veViews, type GaugeView, type LockView } from './views';

export interface VeRow {
  lock: LockView;
  /** Current voting power, base units. */
  power: string;
  /** Pools this veNFT voted for in the current epoch: `[pool_id, weight]`. */
  votes: Array<[number, string]>;
}

/** All veNFTs of an owner with their power and votes, sorted by id. */
export async function loadLocks(owner: string): Promise<VeRow[]> {
  const ids = await veViews.getLocksOf(owner);
  const rows = await Promise.all(
    ids.map(async (id) => {
      const [lock, power] = await Promise.all([veViews.getLock(id), veViews.balanceOfNft(id)]);
      if (!lock) return null;
      const votes = lock.voted ? await veViews.getVotes(id) : [];
      return { lock, power, votes } satisfies VeRow;
    }),
  );
  return rows.filter((r): r is VeRow => r !== null).sort((a, b) => a.lock.token_id - b.lock.token_id);
}

export interface GaugeRow {
  poolId: number;
  gauge: GaugeView;
  /** Pool tokens as display symbols, e.g. `ETH / test1`. */
  pair: string;
  token0: string;
  token1: string;
}

/** Gauges of the probed pools (`V4_POOL_PROBE_MAX`). The contract has no gauge list view. */
export async function loadGauges(): Promise<GaugeRow[]> {
  const ids = Array.from({ length: V4_POOL_PROBE_MAX }, (_, i) => i + 1);
  const found = await Promise.all(
    ids.map(async (poolId) => {
      const gauge = await veViews.getGauge(poolId);
      if (!gauge) return null;
      const pool = await v4Client.getPool(poolId);
      return {
        poolId,
        gauge,
        token0: pool.token0,
        token1: pool.token1,
        pair: `${internalTokenSymbol(pool.token0)} / ${internalTokenSymbol(pool.token1)}`,
      } satisfies GaugeRow;
    }),
  );
  return found.filter((g): g is GaugeRow => g !== null);
}

