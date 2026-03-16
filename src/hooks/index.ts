// Wallet Provider Hooks - Direct SDK Integrations
// NOTE: These hooks use dynamic imports to avoid SSR/HMR issues
export { 
    useWalletConnectProvider,
    useCoinbaseWallet,
    useMetaMaskSDK,
    useSafeAppsSDK,
    useUnifiedWallet,
} from './useWalletProviders';

// EIP-5792 Batch Transactions
export { useEIP5792 } from './useEIP5792';

// Existing hooks
export { useBatchTransactions } from './useBatchTransactions';
export { useSafeAutoConnect } from './useSafeAutoConnect';
export { useWriteContract } from './useWriteContract';
