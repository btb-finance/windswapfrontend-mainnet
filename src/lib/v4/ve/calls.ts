/**
 * ve(3,3) and EVM bridge calls as `FunctionCallAction`s. NEAR mode sends them directly. EVM mode
 * maps them to a SignedAction (`toSignedAction` in `lib/v4/evm/signed.ts`) by method name, so the
 * method names here must stay in sync with that table. Argument names match the contract.
 */

import type { FunctionCallAction } from '@/lib/windswap-v4';
import { V4_CONTRACT_ID } from '@/lib/v4/config';

/** Epoch length (7 days) and maximum lock (4 years), from `crates/engine/src/ve.rs`. */
export const WEEK = 7 * 24 * 60 * 60;
export const MAXTIME = 4 * 365 * 24 * 60 * 60;

/** Default gas for a change call: 100 Tgas. Unused gas is refunded. */
const GAS = '100000000000000';
/** `distribute` needs at least 230 Tgas (mint, then a callback per gauge). */
const GAS_DISTRIBUTE = '300000000000000';

function call(methodName: string, args: Record<string, unknown>, gas = GAS): FunctionCallAction {
  return { receiverId: V4_CONTRACT_ID, methodName, args, gas, deposit: '0' };
}

/** Rounds `now + duration` down to a week boundary, as the contract does for lock ends. */
export function roundToWeek(nowSec: number, durationSec: number): number {
  return Math.floor((nowSec + durationSec) / WEEK) * WEEK;
}

export const veCalls = {
  /**
   * `permanent` makes the lock permanent in the same step (contract v7). NEAR sends it as an
   * argument. EVM mode writes it into the signed CreateLock only when true.
   */
  createLock: (amount: bigint, duration: number, permanent = false) =>
    call('create_lock', { amount: amount.toString(), duration, permanent }),
  increaseAmount: (tokenId: number, amount: bigint) => call('increase_amount', { token_id: tokenId, amount: amount.toString() }),
  increaseUnlockTime: (tokenId: number, duration: number) => call('increase_unlock_time', { token_id: tokenId, duration }),
  withdrawLock: (tokenId: number) => call('withdraw_lock', { token_id: tokenId }),
  merge: (from: number, to: number) => call('merge', { from, to }),
  split: (tokenId: number, amount: bigint) => call('split', { token_id: tokenId, amount: amount.toString() }),
  lockPermanent: (tokenId: number) => call('lock_permanent', { token_id: tokenId }),
  unlockPermanent: (tokenId: number) => call('unlock_permanent', { token_id: tokenId }),
  /** `weights` are relative. The contract allocates the veNFT's power by their ratio. */
  vote: (tokenId: number, pools: number[], weights: bigint[]) =>
    call('vote', { token_id: tokenId, pools, weights: weights.map((w) => w.toString()) }),
  reset: (tokenId: number) => call('reset', { token_id: tokenId }),
  poke: (tokenId: number) => call('poke', { token_id: tokenId }),
  stakePosition: (poolId: number, tickLower: number, tickUpper: number) =>
    call('stake_position', { pool_id: poolId, tick_lower: tickLower, tick_upper: tickUpper }),
  unstakePosition: (poolId: number, tickLower: number, tickUpper: number) =>
    call('unstake_position', { pool_id: poolId, tick_lower: tickLower, tick_upper: tickUpper }),
  claimGaugeRewards: (poolId: number, tickLower: number, tickUpper: number) =>
    call('claim_gauge_rewards', { pool_id: poolId, tick_lower: tickLower, tick_upper: tickUpper }),
  /** `gauges` are gauge ids (not pool ids). */
  claimFees: (tokenId: number, gauges: number[]) => call('claim_fees', { token_id: tokenId, gauges }),
  claimBribes: (tokenId: number, gauges: number[], tokens: string[]) =>
    call('claim_bribes', { token_id: tokenId, gauges, tokens }),
  /** `poolId` is a pool id. The bribe goes to that pool's gauge. */
  bribe: (poolId: number, token: string, amount: bigint) => call('bribe', { pool_id: poolId, token, amount: amount.toString() }),
  claimRebase: (tokenId: number) => call('claim_rebase', { token_id: tokenId }),
  /** Permissionless epoch flip. Also a SignedAction (`"Distribute"`), so EVM wallets can run it. */
  distribute: () => call('distribute', {}, GAS_DISTRIBUTE),
};
