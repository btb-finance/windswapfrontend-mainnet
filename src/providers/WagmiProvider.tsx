'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { http, fallback } from 'viem';
import { Attribution } from 'ox/erc8021';
import {
    RainbowKitProvider,
    darkTheme,
    getDefaultConfig,
} from '@rainbow-me/rainbowkit';
import {
    baseAccount,
    walletConnectWallet,
    safeWallet,
    metaMaskWallet,
    coinbaseWallet,
    trustWallet,
    safepalWallet,
    rabbyWallet,
    phantomWallet,
    okxWallet,
    bitgetWallet,
    imTokenWallet,
    tokenPocketWallet,
    ledgerWallet,
    uniswapWallet,
    zerionWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { sei, ethereum } from '@/config/chains';
import { PoolDataProvider } from '@/providers/PoolDataProvider';
import { UserBalanceProvider } from '@/providers/UserBalanceProvider';
import { SafeAutoConnect } from '@/components/SafeAutoConnect';
import '@rainbow-me/rainbowkit/styles.css';

const projectId = 'ecd20f8c23408a4397afc0f5466eb6b6';

// Base Builder Code — attributes onchain activity to Wind Swap (ERC-8021)
const DATA_SUFFIX = Attribution.toDataSuffix({ codes: ['bc_rco9r2hr'] });

const config = getDefaultConfig({
    appName: 'Wind Swap',
    projectId,
    chains: [sei, ethereum],
    transports: {
        [sei.id]: fallback([
            http('https://base-rpc.publicnode.com'),
            http('https://base.meowrpc.com'),
            http('https://rpc.ankr.com/base'),
        ]),
        [ethereum.id]: fallback([
            http('https://eth.llamarpc.com'),
            http('https://rpc.ankr.com/eth'),
        ]),
    },
    ssr: false,
    dataSuffix: DATA_SUFFIX,
    // Wallet entries are ~3–7 KB metadata each (deeplinks + icons). Heavy SDKs
    // (@coinbase/wallet-sdk, @walletconnect/ethereum-provider) are dynamic-
    // imported by wagmi only when the user actually picks that wallet.
    // Desktop browser-extension wallets are also auto-discovered via EIP-6963.
    wallets: [
        {
            groupName: 'Popular',
            wallets: [
                baseAccount,
                metaMaskWallet,
                coinbaseWallet,
                walletConnectWallet,
                trustWallet,
                safepalWallet,
                rabbyWallet,
                phantomWallet,
                okxWallet,
                bitgetWallet,
                imTokenWallet,
                tokenPocketWallet,
                ledgerWallet,
                uniswapWallet,
                zerionWallet,
                safeWallet,
            ],
        },
    ],
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider
                    theme={darkTheme({
                        accentColor: '#f59e0b',
                        accentColorForeground: 'black',
                        borderRadius: 'medium',
                        fontStack: 'system',
                        overlayBlur: 'small',
                    })}
                    modalSize="compact"
                >
                    <PoolDataProvider>
                        <UserBalanceProvider>
                            <SafeAutoConnect>
                                {children}
                            </SafeAutoConnect>
                        </UserBalanceProvider>
                    </PoolDataProvider>
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
}
