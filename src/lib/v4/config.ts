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
  return V4_TOKENS.find((t) => t.accountId === accountId) ?? V4_EVM_TOKENS.find((t) => t.accountId === accountId);
}

export function explorerAccountUrl(accountId: string): string {
  return `${V4_EXPLORER_URL}/address/${accountId}`;
}

/* ---- EVM wallet (MetaMask) side: Base Sepolia vault and test tokens ---- */

/** Base Sepolia. The v4 EVM bridge (deposits, withdrawals) only runs here. */
export const V4_EVM_CHAIN_ID = 84532;
export const V4_EVM_EXPLORER_URL = 'https://sepolia.basescan.org';
/** The contract's MPC-derived address on Base Sepolia. Deposits are sent here. */
export const V4_VAULT_ADDRESS = '0xaa817ca355475d22d5a410f401dc877ec401259e' as const;
/** Test ERC-20 (`Usdctest`, symbol test1, 18 decimals). Registered as `base-sepolia:test1`. */
export const V4_TEST1_ADDRESS = '0x2d330FEe66912f3eB54086357c2eAB46b998bd4f' as const;

/** Internal token ids (DEX balances). NEAR token ids are account ids; EVM assets use `base-sepolia:*`. */
export const V4_WIND_TOKEN = 'windswapv4-wind.testnet';
export const V4_ASSET_ETH = 'base-sepolia:eth';
export const V4_ASSET_TEST1 = 'base-sepolia:test1';

export interface V4InternalToken {
  id: string;
  symbol: string;
  decimals: number;
}

/** Every token id that can have a DEX balance. Decimals are 18 for all of them. */
export const V4_INTERNAL_TOKENS: readonly V4InternalToken[] = [
  { id: V4_ASSET_ETH, symbol: 'ETH', decimals: 18 },
  { id: V4_ASSET_TEST1, symbol: 'test1', decimals: 18 },
  { id: 'windswapv4-tusdc.testnet', symbol: 'tUSDC', decimals: 18 },
  { id: 'windswapv4-tweth.testnet', symbol: 'tWETH', decimals: 18 },
  { id: V4_WIND_TOKEN, symbol: 'WIND', decimals: 18 },
];

/** Base Sepolia assets (`base-sepolia:*`) as pool tokens. Their `accountId` is the internal id, not a NEAR account. */
export const V4_EVM_TOKENS: readonly V4Token[] = V4_INTERNAL_TOKENS.filter((t) => isEvmAssetId(t.id)).map((t) => ({
  accountId: t.id,
  symbol: t.symbol,
  name: t.symbol,
  decimals: t.decimals,
}));

/** True for a Base Sepolia asset id (`base-sepolia:eth`), false for a NEAR account id. */
export function isEvmAssetId(id: string): boolean {
  return id.includes(':');
}

export function internalTokenSymbol(id: string): string {
  return V4_INTERNAL_TOKENS.find((t) => t.id === id)?.symbol ?? id;
}

/**
 * Gas for a NEAR `ft_transfer_call` that swaps or adds liquidity (the token contract then calls the
 * DEX's `ft_on_transfer`). 200 TGas. The spec minimum is 150 TGas.
 */
export const V4_NEAR_FT_CALL_GAS = '200000000000000';

/**
 * Relayer endpoint that submits `execute` to NEAR and pays the gas. Unset means "not built yet":
 * signed payloads are shown with a copy button for an operator to relay. Never put a key here.
 */
export const V4_RELAY_URL: string = process.env.NEXT_PUBLIC_V4_RELAY_URL ?? '';
