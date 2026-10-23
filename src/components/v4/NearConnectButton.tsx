'use client';

import { useNearWallet } from '@/providers/NearWalletProvider';
import { shortAccount } from '@/lib/v4/near';

/** Connect / disconnect button for the NEAR testnet wallet. Shows the account when connected. */
export function NearConnectButton() {
  const { ready, accountId, connect, disconnect } = useNearWallet();

  if (!accountId) {
    return (
      <button
        onClick={connect}
        disabled={!ready}
        className="btn-primary px-3 py-2 text-xs sm:text-sm disabled:opacity-50"
        aria-label="Connect NEAR wallet"
      >
        {ready ? 'Connect NEAR' : 'Loading...'}
      </button>
    );
  }

  return (
    <button
      onClick={() => void disconnect()}
      className="btn-secondary px-3 py-2 text-xs sm:text-sm font-mono"
      title={`${accountId} (click to disconnect)`}
    >
      {shortAccount(accountId)}
    </button>
  );
}
