/**
 * Owner-keyed views added in contract v7. `owner` is the 64-hex owner id from `resolve_wallet`, so
 * NEAR accounts and EVM wallets read the same way. List views are paged (`limit` <= 100).
 * Shapes follow crates/near-contract/src/views.rs, accounting.rs and lib.rs.
 */

import { V4_CONTRACT_ID } from '@/lib/v4/config';
import { nearView } from '@/lib/v4/near';
import type { GaugeView, WithdrawalView } from '@/lib/v4/ve/views';

const PAGE = 100;
/** Upper bound on pages per list (100 items each), so a bad count cannot loop forever. */
const MAX_PAGES = 50;

export interface OwnerPositionView {
  pool_id: number;
  tick_lower: number;
  tick_upper: number;
  liquidity: string;
  tokens_owed0: string;
  tokens_owed1: string;
  /** True when the position is staked into its pool's gauge. */
  staked: boolean;
}

/** `get_position_of_owner`: one range, same fields as `get_position`. */
export interface OwnerPositionDetail {
  liquidity: string;
  tokens_owed0: string;
  tokens_owed1: string;
  fee_growth_inside0_last_x128: string;
  fee_growth_inside1_last_x128: string;
}

export interface StakeOfOwner {
  pool_id: number;
  tick_lower: number;
  tick_upper: number;
  /** NFT id of the staked position in the NFT manager. */
  token_id: string;
  liquidity: string;
}

export interface TokenAccounting {
  token: string;
  liabilities: string;
  pool_reserves: string;
  locked: string;
  pending_withdrawals: string;
  total_owed: string;
  unbacked: string;
  /** True until the owner has seeded pool reserves on a migrated contract. Totals are then incomplete. */
  migrated: boolean;
}

function view<T>(method: string, args: Record<string, unknown> = {}): Promise<T> {
  return nearView<T>(V4_CONTRACT_ID, method, args);
}

/** Reads every page of a list view, `PAGE` items at a time, until a short page comes back. */
async function allPages<T>(method: string, owner: string): Promise<T[]> {
  const out: T[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const chunk = await view<T[]>(method, { owner, from_index: page * PAGE, limit: PAGE });
    out.push(...chunk);
    if (chunk.length < PAGE) break;
  }
  return out;
}

export const ownerViews = {
  getPositionOfOwner: (owner: string, poolId: number, tickLower: number, tickUpper: number) =>
    view<OwnerPositionDetail>('get_position_of_owner', { owner, pool_id: poolId, tick_lower: tickLower, tick_upper: tickUpper }),

  /** Every position the owner has liquidity, owed fees or a stake in. */
  positionsOfOwner: (owner: string) => allPages<OwnerPositionView>('get_positions_of_owner', owner),

  stakesOfOwner: (owner: string) => allPages<StakeOfOwner>('get_stakes_of_owner', owner),

  withdrawalsOfOwner: (owner: string) => allPages<WithdrawalView>('get_withdrawals_of_owner', owner),

  /** Every token the owner holds a nonzero DEX balance of, as `[token, amount]`. */
  balancesOfOwner: (owner: string) => view<Array<[string, string]>>('get_balances_of_owner', { owner }),

  /** One intent by id: Open, Executed{result} or Failed{reason}. Parse with `parseIntentState`. */
  getIntent: (id: string) => view<unknown>('get_intent', { id: /^\d+$/.test(id) ? Number(id) : id }),

  /** Tokens the DEX accepts for bribes. */
  getBribeTokens: () => view<string[]>('get_bribe_tokens'),

  /** Every gauge, in the voter's pool order. */
  getGauges: () => view<GaugeView[]>('get_gauges'),

  /** Per-token liabilities, reserves and locks. Used by the solvency panel. */
  getAllTokensAccounting: () => view<TokenAccounting[]>('get_all_tokens_accounting'),
};
