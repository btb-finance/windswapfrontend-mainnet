'use client';

import { useCallback } from 'react';
import type { FunctionCallAction } from '@/lib/windswap-v4';
import { useV4Actor } from '@/providers/V4ActorProvider';

export interface V4Send {
  /**
   * Sends one call through the active wallet: a NEAR transaction in NEAR mode, or a signed action
   * in EVM mode. Resolves to true on success. Errors are readable and toasted by the actor.
   */
  send: (action: FunctionCallAction, successMessage: string) => Promise<boolean>;
  pending: boolean;
  /** Readable error from the last failed send, or null. */
  error: string | null;
  clearError: () => void;
}

export function useV4Send(options: { nearOnly?: boolean } = {}): V4Send {
  const { run, runNear, pending, error, clearError } = useV4Actor();
  const nearOnly = options.nearOnly ?? false;

  const send = useCallback(
    async (action: FunctionCallAction, successMessage: string) =>
      (await (nearOnly ? runNear(action, successMessage) : run(action, successMessage))) !== null,
    [run, runNear, nearOnly],
  );

  return { send, pending, error, clearError };
}
