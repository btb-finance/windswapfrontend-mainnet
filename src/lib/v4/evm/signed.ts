/**
 * Signed actions for EVM wallets (`execute` on the v4 contract).
 *
 * The wallet signs `Wind Swap v4 action on <contract> by <wallet> nonce <n> expires <t>: <json>`
 * with EIP-191 personal_sign. `<json>` must equal serde_json::to_string of the contract's
 * `SignedAction`: externally tagged, fields in declaration order, no spaces. Every entry below
 * lists the fields in that order, so `JSON.stringify` of the object gives the same bytes.
 * Source: crates/near-contract/src/lib.rs (`SignedAction`, `execute`).
 */

import type { FunctionCallAction } from '@/lib/windswap-v4';

/**
 * Externally tagged, like serde. Struct variants are `{ "Variant": { ...fields } }`. `Distribute` is a
 * unit variant, so its JSON is the bare string `"Distribute"`.
 */
export type SignedAction = { [variant: string]: Record<string, unknown> } | 'Distribute';

export interface SignedPayload {
  /** `evm:0x…` (lower case), the wallet the contract resolves to an owner. */
  wallet: string;
  action: SignedAction;
  nonce: number;
  /** Unix seconds. */
  expires: number;
  /** 0x-prefixed 65-byte EIP-191 signature. */
  signature: string;
  /** The exact string the wallet signed. */
  message: string;
  /** Short description for the UI. */
  label: string;
}

/** Fields that are U128/U256 on the contract. They serialize as decimal strings. */
const STRING_FIELDS = new Set(['amount', 'amount_in', 'min_amount_out', 'liquidity', 'weights']);
/** Fields that are String on the contract (token ids, addresses, token lists). */
const TEXT_FIELDS = new Set(['token', 'tokens', 'to_address']);
/** Fields that are bool on the contract. */
const BOOL_FIELDS = new Set(['permanent']);
/** Fields with `skip_serializing_if`: left out of the JSON when false (`CreateLock.permanent`). */
const OMIT_WHEN_FALSE = new Set(['permanent']);
/** Fields that are integers on the contract (u64 / i32 / vectors of u64). */
const NUMBER_FIELDS = new Set(['token_id', 'pool_id', 'tick_lower', 'tick_upper', 'duration', 'from', 'to', 'delegator', 'delegatee', 'pools', 'gauges']);

interface SignedMapping {
  variant: string;
  /** Field order of the Rust variant. */
  fields: readonly string[];
  /** Fields that may be missing from the call's args (defaulted on the contract). */
  optional?: readonly string[];
}

/** NEAR method name -> SignedAction variant. The names match the SDK builders' argument names. */
const SIGNED_METHODS: Record<string, SignedMapping> = {
  swap_exact_input: { variant: 'SwapExactInput', fields: ['path', 'amount_in', 'min_amount_out'] },
  mint_position: { variant: 'MintPosition', fields: ['pool_id', 'tick_lower', 'tick_upper', 'liquidity'] },
  burn_position: { variant: 'BurnPosition', fields: ['pool_id', 'tick_lower', 'tick_upper', 'liquidity'] },
  collect: { variant: 'Collect', fields: ['pool_id', 'tick_lower', 'tick_upper'] },
  create_lock: { variant: 'CreateLock', fields: ['amount', 'duration', 'permanent'], optional: ['permanent'] },
  increase_amount: { variant: 'IncreaseAmount', fields: ['token_id', 'amount'] },
  increase_unlock_time: { variant: 'IncreaseUnlockTime', fields: ['token_id', 'duration'] },
  withdraw_lock: { variant: 'WithdrawLock', fields: ['token_id'] },
  merge: { variant: 'Merge', fields: ['from', 'to'] },
  split: { variant: 'Split', fields: ['token_id', 'amount'] },
  lock_permanent: { variant: 'LockPermanent', fields: ['token_id'] },
  unlock_permanent: { variant: 'UnlockPermanent', fields: ['token_id'] },
  delegate: { variant: 'Delegate', fields: ['delegator', 'delegatee'] },
  vote: { variant: 'Vote', fields: ['token_id', 'pools', 'weights'] },
  reset: { variant: 'Reset', fields: ['token_id'] },
  poke: { variant: 'Poke', fields: ['token_id'] },
  stake_position: { variant: 'StakePosition', fields: ['pool_id', 'tick_lower', 'tick_upper'] },
  unstake_position: { variant: 'UnstakePosition', fields: ['pool_id', 'tick_lower', 'tick_upper'] },
  claim_gauge_rewards: { variant: 'ClaimGaugeRewards', fields: ['pool_id', 'tick_lower', 'tick_upper'] },
  claim_fees: { variant: 'ClaimFees', fields: ['token_id', 'gauges'] },
  claim_bribes: { variant: 'ClaimBribes', fields: ['token_id', 'gauges', 'tokens'] },
  bribe: { variant: 'Bribe', fields: ['pool_id', 'token', 'amount'] },
  claim_rebase: { variant: 'ClaimRebase', fields: ['token_id'] },
};

/** NEAR method name -> unit variants (no fields). */
const UNIT_METHODS: Record<string, 'Distribute'> = {
  distribute: 'Distribute',
};

/** Methods that have a signed form. Others (token deposits, storage) need a NEAR account. */
export function hasSignedForm(methodName: string): boolean {
  return methodName in SIGNED_METHODS || methodName in UNIT_METHODS;
}

/** Hops in the contract's order: `{pool_id, token_in}`. */
function normalizePath(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((hop) => {
    const h = hop as { pool_id: number | string; token_in: string };
    return { pool_id: Number(h.pool_id), token_in: String(h.token_in) };
  });
}

function normalizeValue(field: string, value: unknown): unknown {
  if (field === 'path') return normalizePath(value);
  if (BOOL_FIELDS.has(field)) return Boolean(value);
  if (STRING_FIELDS.has(field)) {
    return Array.isArray(value) ? value.map((v) => String(v)) : String(value);
  }
  if (TEXT_FIELDS.has(field)) {
    return Array.isArray(value) ? value.map((v) => String(v)) : String(value);
  }
  if (NUMBER_FIELDS.has(field)) {
    return Array.isArray(value) ? value.map((v) => Number(v)) : Number(value);
  }
  return value;
}

/** Builds the SignedAction for a NEAR call that has a signed form. Throws for other methods. */
export function toSignedAction(call: FunctionCallAction): SignedAction {
  const unit = UNIT_METHODS[call.methodName];
  if (unit) return unit;

  const mapping = SIGNED_METHODS[call.methodName];
  if (!mapping) {
    throw new Error(`"${call.methodName}" is not available in EVM mode. Use a NEAR account for it.`);
  }
  const body: Record<string, unknown> = {};
  for (const field of mapping.fields) {
    const missingOk = mapping.optional?.includes(field) ?? false;
    if (!(field in call.args) || call.args[field] === undefined) {
      if (missingOk) continue;
      throw new Error(`Missing ${field} for ${call.methodName}`);
    }
    const value = normalizeValue(field, call.args[field]);
    // skip_serializing_if = "is_false": the field is left out, not written as false.
    if (OMIT_WHEN_FALSE.has(field) && value === false) continue;
    body[field] = value;
  }
  return { [mapping.variant]: body };
}

/** The exact string the wallet signs. The action is embedded as `JSON.stringify(action)`. */
export function actionMessage(contract: string, wallet: string, nonce: number, expires: number, action: SignedAction): string {
  return `Wind Swap v4 action on ${contract} by ${wallet} nonce ${nonce} expires ${expires}: ${JSON.stringify(action)}`;
}

/** Unused nonce. Millisecond time times 1000 plus a random part, so it stays a safe integer. */
export function makeNonce(): number {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

/** Ten minutes from now, in unix seconds. */
export function expiresAt(seconds = 600): number {
  return Math.floor(Date.now() / 1000) + seconds;
}
