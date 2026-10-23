'use client';

import { useState } from 'react';
import { V4TokenField } from '@/components/v4/V4TokenField';
import { V4Banner } from '@/components/v4/V4Banner';
import { V4IntentTracker } from '@/components/v4/V4IntentTracker';
import { useV4Actor } from '@/providers/V4ActorProvider';
import { useV4Send } from '@/hooks/v4/useV4Send';
import { useBaseBalance, useV4Intents } from '@/hooks/v4/useV4Intents';
import type { V4Pool } from '@/hooks/v4/useV4Market';
import { V4_CONTRACT_ID, V4_NEAR_FT_CALL_GAS } from '@/lib/v4/config';
import { readableNearError } from '@/lib/v4/near';
import { addLiquidityIntent, nearFtTransferCall, nearZapMsg } from '@/lib/v4/intents';
import { zapMinLiquidity, type RangeTicks } from '@/lib/v4/liquidity';
import { formatTokenAmount, parseTokenAmount } from '@/lib/v4/format';

/** Slippage on the minimum liquidity of a zap (1%). The zap swaps part of the input, so the minimum has some room. */
const ZAP_SLIPPAGE_BPS = 100;

interface Props {
  pool: V4Pool;
  ticks: RangeTicks | null;
  rangeError: string | null;
  /** NEAR wallet balances per token (base units). Used in NEAR mode. */
  walletBalances: Record<string, bigint>;
  /** Called after a NEAR zap succeeds, so balances and the position refresh. */
  onAdded: () => void;
}

/**
 * One-token liquidity: pick a side of the pool and an amount. The DEX swaps part of it and mints a
 * position for the range. NEAR: one `ft_transfer_call` with the `add_liquidity` zap message. EVM: an
 * AddLiquidity intent, then the deposit on Base Sepolia.
 */
export function V4ZapAdd({ pool, ticks, rangeError, walletBalances, onAdded }: Props) {
  const { mode, connected, connect } = useV4Actor();
  const nearSend = useV4Send({ nearOnly: true });
  const intents = useV4Intents();

  const [side, setSide] = useState<0 | 1>(0);
  const [amount, setAmount] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const token = side === 0 ? pool.token0 : pool.token1;
  const parsed = parseTokenAmount(amount, token.decimals);
  const nearBal = walletBalances[token.accountId];
  const baseBal = useBaseBalance(token.accountId);
  const walletBal = mode === 'near' ? nearBal : baseBal;
  const enough = parsed !== null && walletBal !== undefined && parsed <= walletBal;

  const minLiquidity = ticks && parsed ? zapMinLiquidity(pool, ticks, side, parsed, ZAP_SLIPPAGE_BPS) : 0n;

  const onNear = async () => {
    if (!ticks || parsed === null) return;
    const call = nearFtTransferCall({
      token: token.accountId,
      dex: V4_CONTRACT_ID,
      amount: parsed.toString(),
      msg: nearZapMsg({ poolId: pool.poolId, tickLower: ticks.tickLower, tickUpper: ticks.tickUpper, minLiquidity: minLiquidity.toString() }),
      gas: V4_NEAR_FT_CALL_GAS,
    });
    const ok = await nearSend.send(call, `Added ${amount} ${token.symbol} to pool ${pool.poolId}`);
    if (ok) {
      setAmount('');
      onAdded();
    }
  };

  const onEvm = async () => {
    if (!ticks || parsed === null) return;
    setLocalError(null);
    let intent;
    try {
      intent = addLiquidityIntent({
        tokenIn: token.accountId,
        amountIn: parsed.toString(),
        poolId: pool.poolId,
        tickLower: ticks.tickLower,
        tickUpper: ticks.tickUpper,
        minLiquidity: minLiquidity.toString(),
      });
    } catch (err) {
      setLocalError(readableNearError(err));
      return;
    }
    const ok = await intents.start({
      kind: 'add',
      label: `Add ${amount} ${token.symbol} to pool ${pool.poolId}`,
      intent,
      tokenIn: token.accountId,
      amountIn: parsed,
    });
    if (ok) setAmount('');
  };

  let action: { label: string; onClick?: () => void; disabled: boolean };
  if (!connected) action = { label: mode === 'near' ? 'Connect NEAR wallet' : 'Connect EVM wallet', onClick: connect, disabled: false };
  else if (rangeError || !ticks) action = { label: 'Fix price range', disabled: true };
  else if (parsed === null) action = { label: 'Enter an amount', disabled: true };
  else if (!enough) action = { label: mode === 'near' ? `Not enough ${token.symbol} in your wallet` : `Not enough ${token.symbol} on Base Sepolia`, disabled: true };
  else if (minLiquidity === 0n) action = { label: 'This token adds no liquidity in this range', disabled: true };
  else if (nearSend.pending || intents.busy) action = { label: 'Confirm in wallet...', disabled: true };
  else if (mode === 'near') action = { label: 'Add liquidity', onClick: () => void onNear(), disabled: false };
  else action = { label: 'Sign and send', onClick: () => void onEvm(), disabled: false };

  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs text-gray-400 mb-1.5">Token</div>
        <div className="flex gap-2" role="group" aria-label="Token to add">
          {([pool.token0, pool.token1] as const).map((t, i) => (
            <button
              key={t.accountId}
              type="button"
              onClick={() => setSide(i as 0 | 1)}
              aria-pressed={side === i}
              className={`flex-1 py-2 rounded-lg text-sm border transition ${
                side === i ? 'border-primary bg-primary/10 text-white' : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              {t.symbol}
            </button>
          ))}
        </div>
      </div>

      <V4TokenField
        label="Amount"
        token={token}
        value={amount}
        onChange={setAmount}
        balance={connected ? (walletBal !== undefined ? formatTokenAmount(walletBal, token.decimals) : '...') : '--'}
        hint={connected ? (mode === 'near' ? 'From your NEAR wallet' : 'From your Base Sepolia wallet') : undefined}
      />

      {ticks && parsed !== null && minLiquidity > 0n && (
        <div className="text-[11px] text-gray-500">
          Minimum liquidity: <span className="font-mono">{minLiquidity.toString()}</span> ({ZAP_SLIPPAGE_BPS / 100}% slippage on an estimate)
        </div>
      )}

      {mode === 'near' ? (
        <V4Banner tone="info">
          One step from your wallet. Your tokens are refunded automatically if the price moves too much. Leftover dust stays in your Wind Swap balance.
        </V4Banner>
      ) : (
        <V4Banner tone="info">
          One signature, then a deposit on Base Sepolia. If the position can&apos;t be added, your deposit stays in your Wind Swap balance — withdraw anytime.
        </V4Banner>
      )}

      {localError && <V4Banner tone="error">{localError}</V4Banner>}

      {connected && parsed !== null && walletBal !== undefined && !enough && (
        <V4Banner tone="warning">
          {mode === 'near' ? `Not enough ${token.symbol} in your NEAR wallet.` : `Not enough ${token.symbol} on Base Sepolia in your EVM wallet.`}
        </V4Banner>
      )}

      <button onClick={action.onClick} disabled={action.disabled} className="w-full btn-primary py-4 text-base disabled:opacity-50" aria-label={action.label}>
        {action.label}
      </button>

      <V4IntentTracker
        runs={intents.runs}
        onRetryDeposit={(key) => void intents.retryDeposit(key)}
        onCancel={(key) => void intents.cancel(key)}
        onDismiss={intents.dismiss}
      />
    </div>
  );
}
