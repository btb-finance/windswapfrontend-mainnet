'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAccount, useConnect, useDisconnect, useChainId } from 'wagmi';

// ==========================================
// 1. WalletConnect Ethereum Provider
// ==========================================
export function useWalletConnectProvider() {
    const [provider, setProvider] = useState<any>(null);
    const [isAvailable, setIsAvailable] = useState(false);

    const initializeWalletConnect = useCallback(async () => {
        try {
            const { default: EthereumProvider } = await import('@walletconnect/ethereum-provider');
            
            const ethereumProvider = await EthereumProvider.init({
                projectId: 'ecd20f8c23408a4397afc0f5466eb6b6',
                chains: [1, 1329, 8453], // Ethereum, Sei, Base
                showQrModal: true,
                methods: [
                    'eth_sendTransaction',
                    'eth_sign',
                    'eth_signTypedData',
                    'wallet_switchEthereumChain',
                    'wallet_addEthereumChain',
                ],
                events: ['chainChanged', 'accountsChanged'],
            });

            setProvider(ethereumProvider);
            setIsAvailable(true);
            return ethereumProvider;
        } catch (error) {
            console.error('Failed to initialize WalletConnect:', error);
            return null;
        }
    }, []);

    const connectWalletConnect = useCallback(async () => {
        if (!provider) {
            const newProvider = await initializeWalletConnect();
            if (newProvider) {
                await newProvider.enable();
            }
        } else {
            await provider.enable();
        }
    }, [provider, initializeWalletConnect]);

    const disconnectWalletConnect = useCallback(async () => {
        if (provider) {
            await provider.disconnect();
            setProvider(null);
        }
    }, [provider]);

    return {
        provider,
        isAvailable,
        initializeWalletConnect,
        connectWalletConnect,
        disconnectWalletConnect,
    };
}

// ==========================================
// 2. Coinbase Wallet SDK
// ==========================================
export function useCoinbaseWallet() {
    const [coinbaseProvider, setCoinbaseProvider] = useState<any>(null);

    const initializeCoinbase = useCallback(async () => {
        try {
            const mod = await import('@coinbase/wallet-sdk');
            const CoinbaseWalletSDK = mod.default || mod;
            if (!CoinbaseWalletSDK) {
                throw new Error('CoinbaseWalletSDK not available');
            }
            
            const sdk = new CoinbaseWalletSDK({
                appName: 'Wind Swap',
                appChainIds: [1329, 1, 8453], // Sei, Ethereum, Base
            });

            const provider = sdk.makeWeb3Provider({
                options: 'smartWalletOnly', // Use Smart Wallet for gasless transactions
            });

            setCoinbaseProvider(provider);
            return provider;
        } catch (error) {
            console.error('Failed to initialize Coinbase Wallet:', error);
            return null;
        }
    }, []);

    const connectCoinbase = useCallback(async () => {
        let provider = coinbaseProvider;
        if (!provider) {
            provider = await initializeCoinbase();
        }
        
        if (provider) {
            try {
                const accounts = await provider.request({
                    method: 'eth_requestAccounts',
                });
                return accounts;
            } catch (error) {
                console.error('Coinbase connection failed:', error);
            }
        }
    }, [coinbaseProvider, initializeCoinbase]);

    const switchChainCoinbase = useCallback(async (chainId: number) => {
        if (coinbaseProvider) {
            try {
                await coinbaseProvider.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: `0x${chainId.toString(16)}` }],
                });
            } catch (error) {
                console.error('Chain switch failed:', error);
            }
        }
    }, [coinbaseProvider]);

    return {
        coinbaseProvider,
        initializeCoinbase,
        connectCoinbase,
        switchChainCoinbase,
    };
}

// ==========================================
// 3. MetaMask SDK
// ==========================================
export function useMetaMaskSDK() {
    const [metaMaskSDK, setMetaMaskSDK] = useState<any>(null);
    const [metaMaskProvider, setMetaMaskProvider] = useState<any>(null);

    const initializeMetaMask = useCallback(async () => {
        try {
            const { MetaMaskSDK: MetaMaskSDKInit } = await import('@metamask/sdk');
            
            const sdk = new MetaMaskSDKInit({
                dappMetadata: {
                    name: 'Wind Swap',
                    url: typeof window !== 'undefined' ? window.location.origin : '',
                },
                infuraAPIKey: 'your-infura-key', // Optional
                preferDesktop: true,
                extensionOnly: false,
                checkInstallationImmediately: false,
            });

            await sdk.init();
            setMetaMaskSDK(sdk);
            
            const provider = sdk.getProvider();
            setMetaMaskProvider(provider);
            
            return { sdk, provider };
        } catch (error) {
            console.error('Failed to initialize MetaMask SDK:', error);
            return null;
        }
    }, []);

    const connectMetaMask = useCallback(async () => {
        if (!metaMaskSDK) {
            const initialized = await initializeMetaMask();
            if (!initialized) return null;
        }

        try {
            const accounts = await metaMaskProvider?.request({
                method: 'eth_requestAccounts',
            });
            return accounts;
        } catch (error) {
            console.error('MetaMask connection failed:', error);
            return null;
        }
    }, [metaMaskSDK, metaMaskProvider, initializeMetaMask]);

    const disconnectMetaMask = useCallback(() => {
        if (metaMaskSDK) {
            metaMaskSDK.terminate();
            setMetaMaskProvider(null);
        }
    }, [metaMaskSDK]);

    return {
        metaMaskSDK,
        metaMaskProvider,
        initializeMetaMask,
        connectMetaMask,
        disconnectMetaMask,
    };
}

// ==========================================
// 4. Safe Apps SDK
// ==========================================
export function useSafeAppsSDK() {
    const [safeSDK, setSafeSDK] = useState<any>(null);
    const [safeInfo, setSafeInfo] = useState<any>(null);
    const [isSafeApp, setIsSafeApp] = useState(false);

    const initializeSafe = useCallback(async () => {
        try {
            const { default: SafeAppsSDK } = await import('@safe-global/safe-apps-sdk');
            
            const sdk = new SafeAppsSDK({
                allowedDomains: [/app.safe.global$/],
                debug: process.env.NODE_ENV === 'development',
            });

            setSafeSDK(sdk);
            
            // Check if running inside Safe
            try {
                const info = await sdk.safe.getInfo();
                setSafeInfo(info);
                setIsSafeApp(true);
                return { sdk, info };
            } catch {
                setIsSafeApp(false);
                return { sdk, info: null };
            }
        } catch (error) {
            console.error('Failed to initialize Safe SDK:', error);
            return null;
        }
    }, []);

    const getSafeBalances = useCallback(async () => {
        if (safeSDK && isSafeApp) {
            try {
                const balances = await safeSDK.safe.experimental_getBalances();
                return balances;
            } catch (error) {
                console.error('Failed to get Safe balances:', error);
                return null;
            }
        }
        return null;
    }, [safeSDK, isSafeApp]);

    const submitSafeTransaction = useCallback(async (txs: any[]) => {
        if (safeSDK && isSafeApp) {
            try {
                const { safeTxHash } = await safeSDK.txs.send({
                    txs: txs.map(tx => ({
                        to: tx.to,
                        value: tx.value || '0',
                        data: tx.data || '0x',
                    })),
                });
                return safeTxHash;
            } catch (error) {
                console.error('Failed to submit Safe transaction:', error);
                return null;
            }
        }
        return null;
    }, [safeSDK, isSafeApp]);

    useEffect(() => {
        initializeSafe();
    }, [initializeSafe]);

    return {
        safeSDK,
        safeInfo,
        isSafeApp,
        initializeSafe,
        getSafeBalances,
        submitSafeTransaction,
    };
}

// ==========================================
// 5. Unified Wallet Connector
// ==========================================
export function useUnifiedWallet() {
    const { connect: wagmiConnect, connectors } = useConnect();
    const { disconnect: wagmiDisconnect } = useDisconnect();
    const { address, isConnected } = useAccount();
    const chainId = useChainId();

    const walletConnect = useWalletConnectProvider();
    const coinbase = useCoinbaseWallet();
    const metaMask = useMetaMaskSDK();
    const safe = useSafeAppsSDK();

    const connectWithFallback = useCallback(async (walletType: 'metamask' | 'coinbase' | 'walletconnect' | 'safe') => {
        switch (walletType) {
            case 'metamask':
                // Try MetaMask SDK first, then fall back to wagmi connector
                const mmAccounts = await metaMask.connectMetaMask();
                if (!mmAccounts) {
                    const metaMaskConnector = connectors.find(c => c.id === 'metaMask');
                    if (metaMaskConnector) {
                        await wagmiConnect({ connector: metaMaskConnector });
                    }
                }
                break;
                
            case 'coinbase':
                // Try Coinbase SDK first, then fall back to wagmi connector
                const cbAccounts = await coinbase.connectCoinbase();
                if (!cbAccounts) {
                    const coinbaseConnector = connectors.find(c => c.id === 'coinbaseWallet');
                    if (coinbaseConnector) {
                        await wagmiConnect({ connector: coinbaseConnector });
                    }
                }
                break;
                
            case 'walletconnect':
                await walletConnect.connectWalletConnect();
                break;
                
            case 'safe':
                if (safe.isSafeApp) {
                    const safeConnector = connectors.find(c => c.id === 'safe');
                    if (safeConnector) {
                        await wagmiConnect({ connector: safeConnector });
                    }
                }
                break;
        }
    }, [metaMask, coinbase, walletConnect, safe, connectors, wagmiConnect]);

    const disconnectAll = useCallback(async () => {
        await wagmiDisconnect();
        await walletConnect.disconnectWalletConnect();
        metaMask.disconnectMetaMask();
    }, [wagmiDisconnect, walletConnect, metaMask]);

    return {
        // Connection state
        address,
        isConnected,
        chainId,
        
        // Individual wallet hooks
        walletConnect,
        coinbase,
        metaMask,
        safe,
        
        // Unified methods
        connectWithFallback,
        disconnectAll,
        
        // Wagmi connectors for advanced use
        wagmiConnect,
        wagmiDisconnect,
        connectors,
    };
}
