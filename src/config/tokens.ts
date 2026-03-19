// Token List for Wind Swap DEX on Base

export interface Token {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    logoURI?: string;
    isNative?: boolean;
}

// Native ETH
export const SEI: Token = {
    address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    logoURI: '/logo/eth.svg',
    isNative: true,
};

export const ETH = SEI;

// Wrapped ETH (Base canonical WETH)
export const WSEI: Token = {
    address: '0x4200000000000000000000000000000000000006',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    logoURI: '/logo/eth.svg',
};

export const WETH = WSEI;

// WIND Protocol Token
export const WIND: Token = {
    address: '0x888859FEaAb4922DFBB9Add836172ec6f38caBb2',
    symbol: 'WIND',
    name: 'Wind Swap',
    decimals: 18,
    logoURI: '/logo.png',
};

export const YAKA = WIND;

// Stablecoins
export const USDC: Token = {
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    logoURI: '/logo/USDCoin.svg',
};

// Keep exports for code compatibility (referenced elsewhere)
export const USDT: Token = { address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', symbol: 'USDT', name: 'Tether USD', decimals: 6, logoURI: '/logo/usdt0.png' };
export const DAI: Token = { address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 };
export const WBTC: Token = { address: '0x0555E30da8f98308EdB960aa94C0Db47230d2B9c', symbol: 'cbBTC', name: 'Coinbase Wrapped BTC', decimals: 8 };
export const LINK: Token = { address: '0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196', symbol: 'LINK', name: 'ChainLink Token', decimals: 18 };
export const USDT0 = USDT;
export const USDCN = USDC;
export const cbBTC = WBTC;
export const LORE: Token = { address: '0x0000000000000000000000000000000000000000', symbol: 'LORE', name: 'LORE', decimals: 18 };
export const USDVE: Token = { address: '0xbFCD661Be34C99920036F176876746b9f5B68c26', symbol: 'USDVE', name: 'USDVE', decimals: 18, logoURI: '/logo/USDVE.png' };

// Default token list - only core tokens
export const DEFAULT_TOKEN_LIST: Token[] = [
    SEI,
    WSEI,
    WIND,
    USDC,
    USDVE,
];

// Token addresses for quick lookup
export const TOKEN_ADDRESSES = {
    SEI: SEI.address,
    ETH: SEI.address,
    WSEI: WSEI.address,
    WETH: WSEI.address,
    WIND: WIND.address,
    YAKA: WIND.address,
    USDC: USDC.address,
    USDT: USDT.address,
    USDT0: USDT.address,
    USDCN: USDC.address,
    DAI: DAI.address,
    WBTC: WBTC.address,
    LINK: LINK.address,
    LORE: LORE.address,
    cbBTC: cbBTC.address,
    USDVE: USDVE.address,
} as const;
