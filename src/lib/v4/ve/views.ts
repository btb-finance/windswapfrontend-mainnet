/**
 * Read views for ve(3,3), balances and bridge status. JSON shapes follow the contract's structs
 * (`tokenomics.rs`: LockView, GaugeView, EpochView; `lib.rs`: WithdrawalView). U128 values are
 * decimal strings. Token ids and owners are the contract's own.
 */

import { V4_CONTRACT_ID } from '@/lib/v4/config';
import { nearView } from '@/lib/v4/near';

export interface LockView {
  token_id: number;
  /** Owner id, 64 hex digits. */
  owner: string;
  /** WIND locked, base units. */
  amount: string;
  /** Unix seconds when the lock ends. */
  end: number;
  permanent: boolean;
  voted: boolean;
}

export interface GaugeView {
  pool_id: number;
  gauge_id: number;
  alive: boolean;
  weight: string;
  gauge_account: string;
  reward_balance: string;
}

export interface EpochView {
  active_period: number;
  epoch_count: number;
  weekly: string;
  /** Unix seconds. A new epoch can be distributed once this has passed. */
  next_epoch_start: number;
  wind_minted: string;
  distribution_pending: boolean;
}

export interface WithdrawalView {
  id: number;
  owner_hex: string;
  token_id: string;
  amount: string;
  to_chain_id: number;
  to_address: string;
  /** `Pending`, `Signed`, `Broadcast` or `Failed`. */
  status: string;
  nonce: number | null;
  raw_tx: string | null;
  tx_hash: string | null;
}

type Pairs = Array<[string, string]>;

function view<T>(method: string, args: Record<string, unknown> = {}): Promise<T> {
  return nearView<T>(V4_CONTRACT_ID, method, args);
}

export const veViews = {
  getLock: (tokenId: number) => view<LockView | null>('get_lock', { token_id: tokenId }),
  getLocksOf: (owner: string) => view<number[]>('get_locks_of', { owner }),
  balanceOfNft: (tokenId: number) => view<string>('balance_of_nft', { token_id: tokenId }),
  totalVotingPower: () => view<string>('total_voting_power'),
  /** `[pool_id, weight]` pairs the veNFT voted for in this epoch. */
  getVotes: (tokenId: number) => view<Array<[number, string]>>('get_votes', { token_id: tokenId }),
  getGauge: (poolId: number) => view<GaugeView | null>('get_gauge', { pool_id: poolId }),
  getEpoch: () => view<EpochView>('get_epoch'),
  claimableFees: (tokenId: number, gauges: number[]) =>
    view<Pairs>('claimable_fees', { token_id: tokenId, gauges }),
  claimableBribes: (tokenId: number, gauges: number[], tokens: string[]) =>
    view<Pairs>('claimable_bribes', { token_id: tokenId, gauges, tokens }),
  claimableRebase: (tokenId: number) => view<string>('claimable_rebase', { token_id: tokenId }),
  claimableGaugeRewards: (owner: string, poolId: number, tickLower: number, tickUpper: number) =>
    view<string>('claimable_gauge_rewards', { owner, pool_id: poolId, tick_lower: tickLower, tick_upper: tickUpper }),
};

export const balanceViews = {
  /** Owner id for a wallet string (`evm:0x…` or `near:<account>`). Linked wallets resolve to their account's owner. */
  resolveWallet: (wallet: string) => view<string>('resolve_wallet', { wallet }),
  /** DEX balance of an owner for a token id, base units. */
  balanceOfOwner: (owner: string, token: string) => view<string>('get_balance_of_owner', { owner, token }),
  getWithdrawal: (id: number) => view<WithdrawalView | null>('get_withdrawal', { id }),
};
