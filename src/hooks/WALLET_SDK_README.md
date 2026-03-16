# Wallet SDK Integrations

This directory contains direct SDK integrations for various wallet providers, in addition to the standard RainbowKit + Wagmi setup.

## Available Hooks

### useWalletProviders.ts
Contains hooks for direct SDK access:

- **useWalletConnectProvider()** - Direct WalletConnect 2.0 integration with QR modal
- **useCoinbaseWallet()** - Coinbase Smart Wallet with gasless transaction support
- **useMetaMaskSDK()** - MetaMask SDK for mobile and extension
- **useSafeAppsSDK()** - Safe App detection and integration
- **useUnifiedWallet()** - Combines all SDKs with fallback to Wagmi connectors

### useEIP5792.ts
EIP-5792 batch transaction support for smart wallets (Coinbase Smart Wallet, etc.)

### useBatchTransactions.ts
Existing hook for batch transactions using wagmi's useSendCalls

## Usage Example

```typescript
import { useCoinbaseWallet, useSafeAppsSDK } from '@/hooks';

function MyComponent() {
  // Coinbase Smart Wallet
  const { connectCoinbase, switchChainCoinbase } = useCoinbaseWallet();
  
  // Safe App integration
  const { isSafeApp, safeInfo, submitSafeTransaction } = useSafeAppsSDK();
  
  return (
    <div>
      {isSafeApp && <div>Running inside Safe!</div>}
    </div>
  );
}
```

## Components

### SafeIntegration.tsx
UI component that auto-detects Safe context and displays Safe-specific info.

### StandaloneWalletConnectors.tsx
Advanced wallet connection buttons using direct SDK integrations.

## Important Notes

1. All SDK hooks use dynamic imports (`await import()`) to avoid SSR issues
2. These are OPTIONAL - the app works fine with just RainbowKit + Wagmi
3. Use these when you need advanced features like:
   - Gasless transactions (Coinbase Smart Wallet)
   - Mobile wallet connection (MetaMask SDK)
   - Safe App batch transactions
   - WalletConnect standalone

## Dependencies

All these libraries are already installed in package.json:
- @walletconnect/ethereum-provider
- @coinbase/wallet-sdk
- @metamask/sdk
- @safe-global/safe-apps-sdk
