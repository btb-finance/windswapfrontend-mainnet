import { callView, WindSwapError, type FunctionCallAction } from '@/lib/windswap-v4';
import { V4_RPC_URL, V4_STORAGE_DEPOSIT_YOCTO } from './config';

/** Calls a NEAR view method (any contract) through the SDK's JSON-RPC helper. */
export function nearView<T>(contractId: string, method: string, args: Record<string, unknown>): Promise<T> {
  return callView<T>(V4_RPC_URL, contractId, method, args, (...a) => globalThis.fetch(...a));
}

/** Shape wallet-selector's `signAndSendTransaction` expects. */
export interface WalletTransaction {
  receiverId: string;
  actions: Array<{
    type: 'FunctionCall';
    params: { methodName: string; args: Record<string, unknown>; gas: string; deposit: string };
  }>;
}

/** Converts an SDK action (`buildActions`) into a wallet-selector transaction with one FunctionCall. */
export function toWalletTransaction(action: FunctionCallAction): WalletTransaction {
  return {
    receiverId: action.receiverId,
    actions: [
      {
        type: 'FunctionCall',
        params: {
          methodName: action.methodName,
          args: action.args,
          gas: action.gas,
          deposit: action.deposit,
        },
      },
    ],
  };
}

/**
 * NEP-145 `storage_deposit` on a token contract, to register `accountId` (registration only,
 * 0.00125 NEAR). The SDK does not build this, so it is built here with the same shape.
 */
export function storageDepositAction(tokenAccountId: string, accountId: string): FunctionCallAction {
  return {
    receiverId: tokenAccountId,
    methodName: 'storage_deposit',
    args: { account_id: accountId, registration_only: true },
    gas: '30000000000000',
    deposit: V4_STORAGE_DEPOSIT_YOCTO,
  };
}

const PANIC_MESSAGES: Record<string, string> = {
  TooLittleReceived: 'Output is below your minimum received. Increase slippage or retry with a fresh quote.',
  TooMuchRequested: 'Required input is above your maximum. Increase slippage or retry.',
  ZeroAmount: 'Amount must be greater than zero.',
  InvalidPriceLimit: 'Invalid price limit for this swap.',
  InvalidTickRange: 'Invalid price range. The lower price must be below the upper price, and both must be on the tick spacing.',
  NoPositionLiquidity: 'This position has no liquidity to update.',
  PoolNotInitialized: 'This pool is not initialized yet.',
  Overflow: 'Amount is too large.',
  DivisionByZero: 'Cannot compute this amount. Check the price range.',
};

/**
 * Turns a contract panic, RPC error or wallet error into a sentence for the user.
 * Contract panics arrive as `Smart contract panicked: <message>`, and engine errors use their
 * variant name (e.g. `TooLittleReceived`).
 */
export function readableNearError(err: unknown): string {
  const raw = err instanceof WindSwapError || err instanceof Error ? err.message : String(err ?? 'Unknown error');

  const insufficient = /insufficient (\S+) balance: have (\d+), need (\d+)/.exec(raw);
  if (insufficient) {
    const [, token, have, need] = insufficient;
    return `Not enough ${shortToken(token)} in your DEX balance (have ${have}, need ${need} base units). Deposit more in Portfolio.`;
  }

  const panic = /panicked: ([^\n"]+)/.exec(raw);
  const message = panic ? panic[1].trim() : raw;

  for (const [key, text] of Object.entries(PANIC_MESSAGES)) {
    if (message.includes(key)) return text;
  }
  if (/only owner/i.test(message)) return 'Only the contract owner can do this.';
  if (/does not exist/i.test(message)) return `${message.replace(/^pool /, 'Pool ')}.`;
  if (/Exceeded the prepaid gas|GasExceeded/i.test(raw)) return 'Transaction ran out of gas.';
  if (/User (rejected|cancel)|rejected|cancell?ed/i.test(raw)) return 'Transaction was cancelled in the wallet.';
  if (/no account|account .* does not exist/i.test(raw)) return 'Account not found on NEAR testnet.';
  return message;
}

function shortToken(accountId: string): string {
  return accountId.replace(/^windswapv4-/, '').replace(/\.testnet$/, '');
}

export function shortAccount(accountId: string | null | undefined): string {
  if (!accountId) return '';
  return accountId.length > 18 ? `${accountId.slice(0, 8)}…${accountId.slice(-8)}` : accountId;
}
