'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatTokenAmount, shortHex } from '@/lib/v4/format';
import { internalTokenSymbol, V4_CONTRACT_ID, V4_EVM_EXPLORER_URL } from '@/lib/v4/config';
import { intentRelayJson, relayConfigured } from '@/lib/v4/relay';
import type { IntentRun } from '@/hooks/v4/useV4Intents';
import { V4Banner } from '@/components/v4/V4Banner';

interface Props {
  runs: IntentRun[];
  onRetryDeposit: (key: string) => void;
  onCancel: (key: string) => void;
  onDismiss: (key: string) => void;
}

type Step = 'done' | 'active' | 'failed' | 'todo';

/** Progress of one intent: Signed, Deposit sent, Credited, Swapped / Position minted, Payout broadcast. */
function stepsOf(run: IntentRun): Array<{ label: string; step: Step }> {
  const s = run.state;
  const executed = s?.kind === 'executed';
  const failed = s?.kind === 'failed';
  const credited = executed || failed;
  const signed: Step = 'done';
  const deposit: Step = run.depositHash ? 'done' : run.relayed ? 'active' : 'todo';
  const creditedStep: Step = credited ? 'done' : run.depositHash ? 'active' : 'todo';

  if (run.kind === 'add') {
    return [
      { label: 'Signed', step: signed },
      { label: 'Deposit sent', step: deposit },
      { label: 'Credited', step: creditedStep },
      { label: failed ? 'Failed' : 'Position minted', step: failed ? 'failed' : executed ? 'done' : 'todo' },
    ];
  }

  const payoutStatus = run.payout?.status;
  let payout: Step = 'todo';
  if (payoutStatus === 'Broadcast') payout = 'done';
  else if (payoutStatus === 'Failed') payout = 'failed';
  else if (executed) payout = 'active';
  if (failed) payout = 'failed';

  return [
    { label: 'Signed', step: signed },
    { label: 'Deposit sent', step: deposit },
    { label: 'Credited', step: creditedStep },
    { label: failed ? 'Failed' : 'Swapped', step: failed ? 'failed' : executed ? 'done' : 'todo' },
    { label: 'Payout broadcast', step: payout },
  ];
}

function statusText(run: IntentRun): string {
  const s = run.state;
  if (run.error) return 'Failed to submit';
  if (!run.relayed && run.body && !relayConfigured()) return 'Signed, not submitted';
  if (s?.kind === 'failed') return 'Failed';
  if (s?.kind === 'executed') {
    if (run.kind === 'add') return 'Done';
    if (run.payout?.status === 'Broadcast') return 'Paid out';
    if (run.payout?.status === 'Failed') return 'Payout failed';
    return 'Paying out';
  }
  if (s?.kind === 'open') return run.cancelRequested ? 'Cancelling' : 'Open';
  if (run.depositError) return 'Deposit not sent';
  if (run.depositHash) return 'Waiting for the relayer';
  return 'Waiting for deposit';
}

export function V4IntentTracker({ runs, onRetryDeposit, onCancel, onDismiss }: Props) {
  if (runs.length === 0) return null;
  return (
    <div className="space-y-3 mt-4">
      {runs.map((run) => (
        <RunCard key={run.key} run={run} onRetryDeposit={onRetryDeposit} onCancel={onCancel} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function RunCard({
  run,
  onRetryDeposit,
  onCancel,
  onDismiss,
}: {
  run: IntentRun;
  onRetryDeposit: (key: string) => void;
  onCancel: (key: string) => void;
  onDismiss: (key: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const steps = stepsOf(run);
  const open = run.state?.kind === 'open';
  const depositHref = run.depositHash ? `${V4_EVM_EXPLORER_URL}/tx/${run.depositHash}` : null;
  const payoutHash = run.payout?.tx_hash ? (run.payout.tx_hash.startsWith('0x') ? run.payout.tx_hash : `0x${run.payout.tx_hash}`) : null;
  const tokenInSymbol = internalTokenSymbol(run.tokenIn);
  const failedReason = run.state?.kind === 'failed' ? run.state.reason : null;
  const needsRelayer = !relayConfigured() && !run.relayed;

  async function copyPayload() {
    try {
      await navigator.clipboard.writeText(intentRelayJson(run.body));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate">{run.label}</div>
          <div className="text-[11px] text-gray-500 font-mono">
            {formatTokenAmount(run.amountIn, 18)} {tokenInSymbol}
            {run.intentId ? ` · intent #${run.intentId}` : ''}
          </div>
        </div>
        <span className="text-xs font-semibold text-primary whitespace-nowrap">{statusText(run)}</span>
      </div>

      <ol className="grid gap-1.5 text-xs">
        {steps.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span
              className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                s.step === 'done'
                  ? 'bg-emerald-500/30 text-emerald-200'
                  : s.step === 'active'
                    ? 'bg-amber-500/30 text-amber-200 animate-pulse'
                    : s.step === 'failed'
                      ? 'bg-red-500/30 text-red-200'
                      : 'bg-white/10 text-gray-500'
              }`}
              aria-hidden
            >
              {s.step === 'done' ? '✓' : s.step === 'failed' ? '!' : ''}
            </span>
            <span className={s.step === 'todo' ? 'text-gray-500' : 'text-gray-200'}>{s.label}</span>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-3 text-xs">
        {depositHref && (
          <a href={depositHref} target="_blank" rel="noopener noreferrer" className="underline">
            Deposit on Basescan
          </a>
        )}
        {payoutHash && (
          <a href={`${V4_EVM_EXPLORER_URL}/tx/${payoutHash}`} target="_blank" rel="noopener noreferrer" className="underline">
            Payout on Basescan
          </a>
        )}
      </div>

      {run.error && <V4Banner tone="error">{run.error}</V4Banner>}

      {run.depositError && !run.depositHash && (
        <V4Banner tone="warning">
          {run.depositError}
          {run.intentId && (
            <>
              {' '}
              <button onClick={() => onRetryDeposit(run.key)} className="underline font-semibold">Send deposit</button>
            </>
          )}
        </V4Banner>
      )}

      {needsRelayer && (
        <V4Banner tone="info">
          No relayer is set. Give this JSON to an operator who posts it to <span className="font-mono">/v1/intent</span> (contract {V4_CONTRACT_ID}).
          <div className="mt-2 flex items-center gap-2">
            <button onClick={() => void copyPayload()} className="btn-primary px-3 py-1.5 text-xs">{copied ? 'Copied' : 'Copy relay JSON'}</button>
            <span className="font-mono text-[10px] text-gray-500">{shortHex(run.wallet, 10, 6)}</span>
          </div>
        </V4Banner>
      )}

      {failedReason && (
        <V4Banner tone="warning">
          {run.kind === 'swap' ? 'The swap did not execute' : 'The liquidity was not added'}: {failedReason}. Your deposit stays in your Wind Swap balance.{' '}
          <Link href="/v4/bridge" className="underline font-medium">Withdraw anytime on the Bridge</Link>.
        </V4Banner>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        {open && run.intentId && !run.cancelRequested ? (
          <button onClick={() => onCancel(run.key)} className="btn-secondary px-3 py-1.5 text-xs">Cancel intent</button>
        ) : (
          <span />
        )}
        {!open && (
          <button onClick={() => onDismiss(run.key)} className="text-xs text-gray-400 hover:text-white">Dismiss</button>
        )}
      </div>
    </div>
  );
}
