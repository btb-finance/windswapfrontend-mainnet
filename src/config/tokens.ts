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
export const ETH: Token = {
    address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    logoURI: '/logo/eth.svg',
    isNative: true,
};

// Wrapped ETH (Base canonical WETH)
export const WETH: Token = {
    address: '0x4200000000000000000000000000000000000006',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    logoURI: '/logo/eth.svg',
};

// WIND Protocol Token
export const WIND: Token = {
    address: '0x888a4F89aF7dD0Be836cA367C9FF5490c0F6e888',
    symbol: 'WIND',
    name: 'Wind Swap',
    decimals: 18,
    logoURI: '/logo.png',
};

// Stablecoins
export const USDC: Token = {
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    logoURI: '/logo/USDCoin.svg',
};

// Keep exports for code compatibility (referenced elsewhere)
export const USDT: Token = { address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', symbol: 'USDT', name: 'Tether USD', decimals: 6, logoURI: '/logo/usdt0.webp' };
export const DAI: Token = { address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 };
export const WBTC: Token = { address: '0x0555E30da8f98308EdB960aa94C0Db47230d2B9c', symbol: 'cbBTC', name: 'Coinbase Wrapped BTC', decimals: 8 };
export const LINK: Token = { address: '0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196', symbol: 'LINK', name: 'ChainLink Token', decimals: 18 };
export const LORE: Token = { address: '0x888886c43b4B4A15833Be49e7F08242e26e9A6f0', symbol: 'LORE', name: 'LORE', decimals: 18, logoURI: '/logo/LORE.svg' };
export const SKI: Token = { address: '0x768BE13e1680b5ebE0024C42c896E3dB59ec0149', symbol: 'SKI', name: 'SKI', decimals: 18, logoURI: '/logo/ski.webp' };
export const VIRTUAL: Token = { address: '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b', symbol: 'VIRTUAL', name: 'VIRTUAL', decimals: 18, logoURI: '/logo/Virtuals.webp' };
export const BRETT: Token = { address: '0x532f27101965dd16442E59d40670FaF5eBB142E4', symbol: 'BRETT', name: 'BRETT', decimals: 18, logoURI: '/logo/brett.webp' };
export const BOOMER: Token = { address: '0xcdE172dc5ffC46D228838446c57C1227e0B82049', symbol: 'BOOMER', name: 'BOOMER', decimals: 18, logoURI: '/logo/boomer.webp' };
export const VVV: Token = { address: '0xacfE6019Ed1A7Dc6f7B508C02d1b04ec88cC21bf', symbol: 'VVV', name: 'VVV', decimals: 18, logoURI: '/logo/vvv.webp' };

// MILK — USDC-backed bonding curve token
export const MILK: Token = {
    address: '0x6E0090dBecF3b4F0F9429637756CaDD8Fc468C54',
    symbol: 'MILK',
    name: 'Milk',
    decimals: 18,
    logoURI: '/logo/milk.jpg',
};

// Default token list - only core tokens
export const DEFAULT_TOKEN_LIST: Token[] = [
    ETH,
    WETH,
    WIND,
    USDC,
    LORE,
    MILK,
    SKI,
    VIRTUAL,
    BRETT,
    BOOMER,
    VVV,
];

// Token addresses for quick lookup
export const TOKEN_ADDRESSES = {
    ETH: ETH.address,
    WETH: WETH.address,
    WIND: WIND.address,
    USDC: USDC.address,
    USDT: USDT.address,
    DAI: DAI.address,
    WBTC: WBTC.address,
    LINK: LINK.address,
    LORE: LORE.address,
    SKI: SKI.address,
    VIRTUAL: VIRTUAL.address,
    BRETT: BRETT.address,
    BOOMER: BOOMER.address,
    VVV: VVV.address,
} as const;
