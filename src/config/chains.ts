// Ethereum Mainnet Chain Configuration
import { defineChain } from 'viem';

// Keep "sei" export name for code compatibility with Sei frontend
export const sei = defineChain({
    id: 1,
    name: 'Ethereum',
    nativeCurrency: {
        decimals: 18,
        name: 'Ether',
        symbol: 'ETH',
    },
    rpcUrls: {
        default: {
            http: [
                'https://ethereum-rpc.publicnode.com',
                'https://rpc.ankr.com/eth',
                'https://eth.llamarpc.com',
                'https://1rpc.io/eth',
            ],
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

export const ethereum = sei;

export const WSEI_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
export const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
