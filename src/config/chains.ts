// Base Chain Configuration
import { defineChain } from 'viem';

export const sei = defineChain({ // exported as "sei" for legacy code compatibility
    id: 8453,
    name: 'Base',
    nativeCurrency: {
        decimals: 18,
        name: 'Ether',
        symbol: 'ETH',
    },
    rpcUrls: {
        default: {
            http: [
                'https://base-rpc.publicnode.com',
                'https://base.meowrpc.com',
                'https://rpc.ankr.com/base',
                'https://1rpc.io/base',
            ],
        },
    },
    blockExplorers: {
        default: { name: 'BaseScan', url: 'https://basescan.org' },
    },
    contracts: {
        multicall3: {
            address: '0xcA11bde05977b3631167028862bE2a173976CA11',
            blockCreated: 5022,
        },
    },
});

export const base = sei;

export const ethereum = defineChain({
    id: 1,
    name: 'Ethereum',
    nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
    rpcUrls: {
        default: {
            http: ['https://eth.llamarpc.com', 'https://rpc.ankr.com/eth'],
        },
    },
    blockExplorers: {
        default: { name: 'Etherscan', url: 'https://etherscan.io' },
    },
    contracts: {
        multicall3: {
            address: '0xcA11bde05977b3631167028862bE2a173976CA11',
            blockCreated: 14353601,
        },
    },
});

export const WETH_ADDRESS = '0x4200000000000000000000000000000000000006';
export const WSEI_ADDRESS = WETH_ADDRESS; // legacy alias
