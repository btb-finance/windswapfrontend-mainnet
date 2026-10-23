/** Loaders that combine several views into the rows the v4 ve pages show. */

import { internalTokenSymbol } from '@/lib/v4/config';
import { v4Client } from '@/lib/v4/client';
import { ownerViews } from '@/lib/v4/owner-views';
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

/** Every gauge (`get_gauges`), with its pool's pair. Pools whose details fail to load are skipped. */
export async function loadGauges(): Promise<GaugeRow[]> {
  const gauges = await ownerViews.getGauges();
  const rows = await Promise.all(
    gauges.map(async (gauge) => {
      try {
        const pool = await v4Client.getPool(gauge.pool_id);
        return {
          poolId: gauge.pool_id,
          gauge,
          token0: pool.token0,
          token1: pool.token1,
          pair: `${internalTokenSymbol(pool.token0)} / ${internalTokenSymbol(pool.token1)}`,
        } satisfies GaugeRow;
      } catch {
        return null;
      }
    }),
  );
  return rows.filter((g): g is GaugeRow => g !== null);
}

