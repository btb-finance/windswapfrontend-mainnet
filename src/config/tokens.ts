// Token List for Wind Swap DEX on Ethereum Mainnet

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
    logoURI: '/logo/eth.png',
    isNative: true,
};

export const ETH = SEI;

// Wrapped ETH
export const WSEI: Token = {
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    logoURI: '/logo/eth.png',
};

export const WETH = WSEI;

// WIND Protocol Token
export const WIND: Token = {
    address: '0x888809BfEF45Df38007b3DFfd24E1f5343EcDc7b',
    symbol: 'WIND',
    name: 'Wind Swap',
    decimals: 18,
    logoURI: '/logo.png',
};

export const YAKA = WIND;

// Stablecoins
export const USDC: Token = {
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    logoURI: '/logo/USDCoin.svg',
};

export const USDT: Token = {
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    logoURI: '/logo/usdt0.png',
};

export const DAI: Token = {
    address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    logoURI: '/logo/dai.png',
};

export const WBTC: Token = {
    address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    symbol: 'WBTC',
    name: 'Wrapped BTC',
    decimals: 8,
    logoURI: '/logo/wbtc.jpg',
};

export const LINK: Token = {
    address: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
    symbol: 'LINK',
    name: 'ChainLink Token',
    decimals: 18,
    logoURI: '/logo/chainlink_ofc_32.svg',
};

// Aliases for code compatibility
export const USDT0 = USDT;
export const USDCN = USDC;
export const cbBTC = WBTC;
export const cbADA: Token = { address: '0x0000000000000000000000000000000000000000', symbol: 'cbADA', name: 'cbADA', decimals: 6 };
export const SOL: Token = { address: '0x0000000000000000000000000000000000000000', symbol: 'SOL', name: 'SOL', decimals: 9 };
export const cbXRP: Token = { address: '0x0000000000000000000000000000000000000000', symbol: 'cbXRP', name: 'cbXRP', decimals: 6 };
export const uSUI: Token = { address: '0x0000000000000000000000000000000000000000', symbol: 'uSUI', name: 'uSUI', decimals: 18 };
export const DRG: Token = { address: '0x0000000000000000000000000000000000000000', symbol: 'DRG', name: 'DRG', decimals: 18 };
export const MILLI: Token = { address: '0x0000000000000000000000000000000000000000', symbol: 'MILLI', name: 'MILLI', decimals: 6 };
export const GGC: Token = { address: '0x0000000000000000000000000000000000000000', symbol: 'GGC', name: 'GGC', decimals: 18 };
export const POPO: Token = { address: '0x0000000000000000000000000000000000000000', symbol: 'POPO', name: 'POPO', decimals: 18 };
export const FROG: Token = { address: '0x0000000000000000000000000000000000000000', symbol: 'Frog', name: 'Frog', decimals: 18 };
export const SEIYAN: Token = { address: '0x0000000000000000000000000000000000000000', symbol: 'SEIYAN', name: 'SEIYAN', decimals: 6 };
export const S8N: Token = { address: '0x0000000000000000000000000000000000000000', symbol: 'S8N', name: 'S8N', decimals: 18 };
export const SUPERSEIZ: Token = { address: '0x0000000000000000000000000000000000000000', symbol: 'SUPERSEIZ', name: 'SUPERSEIZ', decimals: 18 };
export const BAT: Token = { address: '0x0000000000000000000000000000000000000000', symbol: 'BAT', name: 'BAT', decimals: 18 };
export const YKP: Token = { address: '0x0000000000000000000000000000000000000000', symbol: 'YKP', name: 'YKP', decimals: 18 };
export const LARRY: Token = { address: '0x0000000000000000000000000000000000000000', symbol: 'LARRY', name: 'LARRY', decimals: 18 };
export const WILSON: Token = { address: '0x0000000000000000000000000000000000000000', symbol: 'WILSON', name: 'WILSON', decimals: 6 };
export const LORE: Token = { address: '0x0000000000000000000000000000000000000000', symbol: 'LORE', name: 'LORE', decimals: 18 };

// Default token list
export const DEFAULT_TOKEN_LIST: Token[] = [
    SEI,
    WSEI,
    WIND,
    USDC,
    USDT,
    DAI,
    WBTC,
    LINK,
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
    cbADA: cbADA.address,
    SOL: SOL.address,
    cbXRP: cbXRP.address,
    uSUI: uSUI.address,
    DRG: DRG.address,
    MILLI: MILLI.address,
    GGC: GGC.address,
    POPO: POPO.address,
    FROG: FROG.address,
    SEIYAN: SEIYAN.address,
    S8N: S8N.address,
    SUPERSEIZ: SUPERSEIZ.address,
    BAT: BAT.address,
    YKP: YKP.address,
    LARRY: LARRY.address,
    WILSON: WILSON.address,
} as const;
