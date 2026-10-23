'use client';

import { useCallback, useState } from 'react';
import type { FunctionCallAction } from '@/lib/windswap-v4';
import { useNearWallet } from '@/providers/NearWalletProvider';
import { useToast } from '@/providers/ToastProvider';
import { readableNearError } from '@/lib/v4/near';

export interface V4Send {
  /** Sends one action through the connected wallet. Resolves to true on success. */
  send: (action: FunctionCallAction, successMessage: string) => Promise<boolean>;
  pending: boolean;
  /** Readable error from the last failed send, or null. */
  error: string | null;
  clearError: () => void;
}

/** Wraps `signAndSend` with pending state, readable errors and toasts. */
export function useV4Send(): V4Send {
  const { signAndSend } = useNearWallet();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (action: FunctionCallAction, successMessage: string) => {
      setPending(true);
      setError(null);
      try {
        await signAndSend(action);
        toast.success(successMessage);
        return true;
      } catch (err) {
        const message = readableNearError(err);
        setError(message);
        toast.error(message);
        return false;
      } finally {
        setPending(false);
      }
    },
    [signAndSend, toast],
  );

  const clearError = useCallback(() => setError(null), []);

  return { send, pending, error, clearError };
}
