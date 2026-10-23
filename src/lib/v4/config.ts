/**
 * Wind Swap v4 on NEAR testnet: deployment config.
 * Contract docs: github.com/btb-finance/WindSwapV4 docs/testnet.md.
 */

export const V4_NETWORK = 'testnet' as const;
export const V4_CONTRACT_ID = 'windswapv4-btb.testnet';
export const V4_RPC_URL = 'https://rpc.testnet.near.org';
export const V4_EXPLORER_URL = 'https://testnet.nearblocks.io';

/** Pool ids probed on load. The contract has no pool count view. Pools that do not exist are skipped. */
export const V4_POOL_PROBE_MAX = 10;

/** Storage deposit a NEP-141 account must hold before receiving tokens (0.00125 NEAR). */
export const V4_STORAGE_DEPOSIT_YOCTO = '1250000000000000000000';

/** Tokens that the UI knows about. Only those whitelisted by the DEX (`get_tokens`) are used. */
export interface V4Token {
  accountId: string;
  symbol: string;
  name: string;
  decimals: number;
}

export const V4_TOKENS: readonly V4Token[] = [
  {
    accountId: 'windswapv4-tusdc.testnet',
    symbol: 'tUSDC',
    name: 'Test USDC',
    decimals: 18,
  },
  {
    accountId: 'windswapv4-tweth.testnet',
    symbol: 'tWETH',
    name: 'Test WETH',
    decimals: 18,
  },
];

export function getV4Token(accountId: string): V4Token | undefined {
  return V4_TOKENS.find((t) => t.accountId === accountId);
}

export function explorerAccountUrl(accountId: string): string {
  return `${V4_EXPLORER_URL}/address/${accountId}`;
}
