/**
 * One-step builders for Wind Swap v4 (windswapv4-btb.testnet). Pure: no runtime imports, so
 * `scripts/check-v4-intents.mts` can load this file under node.
 *
 * - NEAR wallets: one `ft_transfer_call` on the input token. Its `msg` is a JSON string for either
 *   a swap (`{swap:{path,min_amount_out,to}}`) or a single-token zap (`{add_liquidity:{...,zap:true}}`).
 * - EVM wallets: an `Intent` JSON, signed with personal_sign, sent to the relayer (`/v1/intent`), then
 *   the input is deposited on Base Sepolia. Key order is part of the signed bytes, so every builder
 *   below writes its keys in the order given by the spec. Do not reorder them.
 */

import type { FunctionCallAction } from '@/lib/windswap-v4';

/** Amounts are base-unit decimal strings. */
export type DecimalString = string;

export interface IntentHop {
  pool_id: number;
  token_in: string;
}

export interface SwapIntentBody {
  token_in: string;
  amount_in: DecimalString;
  path: IntentHop[];
  min_amount_out: DecimalString;
  /** `evm:0x…` (lower case) of the wallet that receives the payout. */
  to: string;
}

export interface AddLiquidityIntentBody {
  token_in: string;
  amount_in: DecimalString;
  pool_id: number;
  tick_lower: number;
  tick_upper: number;
  min_liquidity: DecimalString;
}

/** Externally tagged, like the contract's `Intent` enum. */
export type Intent = { Swap: SwapIntentBody } | { AddLiquidity: AddLiquidityIntentBody };

const DECIMAL = /^\d+$/;
const EVM_WALLET = /^evm:0x[0-9a-f]{40}$/;

function assertDecimal(value: string, name: string): string {
  if (!DECIMAL.test(value)) throw new RangeError(`${name} must be a decimal string, got "${value}"`);
  return value;
}

function assertInt(value: number, name: string): number {
  if (!Number.isSafeInteger(value)) throw new RangeError(`${name} must be an integer, got ${value}`);
  return value;
}

/**
 * `{"Swap":{"token_in","amount_in","path","min_amount_out","to"}}`. Hops are written as
 * `{"pool_id","token_in"}`.
 */
export function swapIntent(p: {
  tokenIn: string;
  amountIn: DecimalString;
  path: IntentHop[];
  minAmountOut: DecimalString;
  to: string;
}): Intent {
  if (p.path.length === 0) throw new RangeError('path must not be empty');
  if (!EVM_WALLET.test(p.to)) throw new RangeError(`to must be evm:0x… in lower case, got "${p.to}"`);
  return {
    Swap: {
      token_in: p.tokenIn,
      amount_in: assertDecimal(p.amountIn, 'amount_in'),
      path: p.path.map((hop) => ({ pool_id: assertInt(hop.pool_id, 'pool_id'), token_in: hop.token_in })),
      min_amount_out: assertDecimal(p.minAmountOut, 'min_amount_out'),
      to: p.to,
    },
  };
}

/** `{"AddLiquidity":{"token_in","amount_in","pool_id","tick_lower","tick_upper","min_liquidity"}}`. */
export function addLiquidityIntent(p: {
  tokenIn: string;
  amountIn: DecimalString;
  poolId: number;
  tickLower: number;
  tickUpper: number;
  minLiquidity: DecimalString;
}): Intent {
  return {
    AddLiquidity: {
      token_in: p.tokenIn,
      amount_in: assertDecimal(p.amountIn, 'amount_in'),
      pool_id: assertInt(p.poolId, 'pool_id'),
      tick_lower: assertInt(p.tickLower, 'tick_lower'),
      tick_upper: assertInt(p.tickUpper, 'tick_upper'),
      min_liquidity: assertDecimal(p.minLiquidity, 'min_liquidity'),
    },
  };
}

/** The exact string the wallet signs for an intent. The intent is embedded as `JSON.stringify(intent)`. */
export function intentMessage(contractId: string, wallet: string, nonce: number, expires: number, intent: Intent): string {
  return `Wind Swap v4 intent on ${contractId} by ${wallet} nonce ${nonce} expires ${expires}: ${JSON.stringify(intent)}`;
}

/** The exact string the wallet signs to cancel an open intent. */
export function cancelIntentMessage(contractId: string, id: string, wallet: string, nonce: number, expires: number): string {
  return `Wind Swap v4 cancel intent ${id} on ${contractId} by ${wallet} nonce ${nonce} expires ${expires}`;
}

/** `ft_msg` for a NEAR swap: `{"swap":{"path":[{pool_id,token_in}],"min_amount_out","to"}}`. */
export function nearSwapMsg(p: { path: IntentHop[]; minAmountOut: DecimalString; to: string }): string {
  if (p.path.length === 0) throw new RangeError('path must not be empty');
  if (!p.to.startsWith('near:')) throw new RangeError(`to must be near:<account>, got "${p.to}"`);
  return JSON.stringify({
    swap: {
      path: p.path.map((hop) => ({ pool_id: assertInt(hop.pool_id, 'pool_id'), token_in: hop.token_in })),
      min_amount_out: assertDecimal(p.minAmountOut, 'min_amount_out'),
      to: p.to,
    },
  });
}

/** `ft_msg` for a NEAR single-token zap: `{"add_liquidity":{"pool_id","tick_lower","tick_upper","zap":true,"min_liquidity"}}`. */
export function nearZapMsg(p: { poolId: number; tickLower: number; tickUpper: number; minLiquidity: DecimalString }): string {
  return JSON.stringify({
    add_liquidity: {
      pool_id: assertInt(p.poolId, 'pool_id'),
      tick_lower: assertInt(p.tickLower, 'tick_lower'),
      tick_upper: assertInt(p.tickUpper, 'tick_upper'),
      zap: true,
      min_liquidity: assertDecimal(p.minLiquidity, 'min_liquidity'),
    },
  });
}

/**
 * NEAR `ft_transfer_call(receiver_id = DEX, amount, msg)` on the input token, with 1 yoctoNEAR.
 * `gas` is in gas units (decimal string). The default is 200 TGas.
 */
export function nearFtTransferCall(p: {
  token: string;
  dex: string;
  amount: DecimalString;
  msg: string;
  gas: string;
}): FunctionCallAction {
  return {
    receiverId: p.token,
    methodName: 'ft_transfer_call',
    args: { receiver_id: p.dex, amount: assertDecimal(p.amount, 'amount'), msg: p.msg },
    gas: p.gas,
    deposit: '1',
  };
}

/** Body of `POST /v1/intent`. `intent` is the object itself, not a string. */
export interface IntentSubmitBody {
  wallet: string;
  intent: Intent;
  nonce: number;
  expires: number;
  signature: string;
}

/** Body of `POST /v1/intent/cancel`. */
export interface IntentCancelBody {
  wallet: string;
  id: string;
  nonce: number;
  expires: number;
  signature: string;
}

/**
 * Status of an intent from `get_intent({id})`: Open, Executed{result}, or Failed{reason}. The view's
 * exact JSON is not in the spec, so this accepts the bare status or `{ status }`, a string or a
 * one-key object for the variant. Anything else is `unknown`.
 */
export type IntentState =
  | { kind: 'open' }
  | { kind: 'executed'; result: unknown }
  | { kind: 'failed'; reason: string }
  | { kind: 'unknown'; raw: unknown };

export function parseIntentState(raw: unknown): IntentState {
  const status = raw !== null && typeof raw === 'object' && 'status' in raw ? (raw as { status: unknown }).status : raw;
  if (typeof status === 'string') {
    if (status === 'Open') return { kind: 'open' };
    if (status === 'Executed') return { kind: 'executed', result: null };
    if (status === 'Failed') return { kind: 'failed', reason: 'Failed' };
    return { kind: 'unknown', raw };
  }
  if (status !== null && typeof status === 'object' && !Array.isArray(status)) {
    const obj = status as Record<string, unknown>;
    if ('Open' in obj) return { kind: 'open' };
    if ('Executed' in obj) return { kind: 'executed', result: obj.Executed };
    if ('Failed' in obj) {
      const failed = obj.Failed;
      const reason = typeof failed === 'string' ? failed : failed && typeof failed === 'object' && 'reason' in failed ? String((failed as { reason: unknown }).reason) : 'Failed';
      return { kind: 'failed', reason };
    }
  }
  return { kind: 'unknown', raw };
}

/**
 * Withdrawal id from an `Executed` result, if the contract reports one. Returns null when the result
 * does not name it (the caller then matches the payout by token and destination).
 */
export function withdrawalIdFromResult(result: unknown): number | null {
  if (result === null || typeof result !== 'object') return null;
  const obj = result as Record<string, unknown>;
  const id = obj.withdrawal_id ?? obj.withdrawal;
  if (typeof id === 'number' && Number.isSafeInteger(id)) return id;
  if (typeof id === 'string' && /^\d+$/.test(id)) return Number(id);
  return null;
}
