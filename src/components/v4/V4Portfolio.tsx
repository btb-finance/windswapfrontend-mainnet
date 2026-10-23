'use client';

import { useState } from 'react';
import { formatUnits } from 'viem';
import { useNearWallet } from '@/providers/NearWalletProvider';
import { useV4Market } from '@/hooks/v4/useV4Market';
import { useV4Balances } from '@/hooks/v4/useV4Balances';
import { useV4Send } from '@/hooks/v4/useV4Send';
import { V4TokenField } from '@/components/v4/V4TokenField';
import { V4Banner } from '@/components/v4/V4Banner';
import { v4Client } from '@/lib/v4/client';
import { storageDepositAction } from '@/lib/v4/near';
import { formatTokenAmount, parseTokenAmount } from '@/lib/v4/format';
import { explorerAccountUrl, V4_CONTRACT_ID, type V4Token } from '@/lib/v4/config';

type Mode = 'deposit' | 'withdraw';

export function V4Portfolio() {
  const { accountId, connect } = useNearWallet();
  const market = useV4Market(accountId);
  const balances = useV4Balances(accountId, market.tokens);
  const { send, pending, error } = useV4Send();

  const [mode, setMode] = useState<Mode>('deposit');
  const [tokenId, setTokenId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');

  const token: V4Token | undefined = market.tokens.find((t) => t.accountId === (tokenId ?? market.tokens[0]?.accountId));

  if (!accountId) {
    return (
      <div className="max-w-xl mx-auto swap-card text-center space-y-4">
        <p className="text-sm text-gray-300">Connect a NEAR testnet wallet to see your balances and move tokens in and out of the DEX.</p>
        <button onClick={connect} className="btn-primary px-6 py-3">Connect NEAR wallet</button>
      </div>
    );
  }

  const parsed = token ? parseTokenAmount(amount, token.decimals) : null;
  const dexBal = token ? (balances.dex[token.accountId] ?? 0n) : 0n;
  const walletBal = token ? (balances.wallet[token.accountId] ?? 0n) : 0n;
  const registered = token ? balances.registered[token.accountId] : undefined;
  const maxAmount = mode === 'deposit' ? walletBal : dexBal;

  let action: { label: string; disabled: boolean; run?: () => void };
  if (!token) action = { label: 'No tokens', disabled: true };
  else if (registered === undefined) action = { label: 'Loading...', disabled: true };
  else if (!registered) action = { label: `Register ${token.symbol} storage (0.00125 NEAR)`, disabled: pending, run: () => void onRegister(token) };
  else if (parsed === null) action = { label: 'Enter an amount', disabled: true };
  else if (mode === 'deposit' && parsed > walletBal) action = { label: 'Insufficient wallet balance', disabled: true };
  else if (mode === 'withdraw' && parsed > dexBal) action = { label: 'Insufficient DEX balance', disabled: true };
  else action = { label: pending ? 'Confirm in wallet...' : mode === 'deposit' ? 'Deposit' : 'Withdraw', disabled: pending, run: () => void onMove(token, parsed) };

  async function onRegister(t: V4Token) {
    const ok = await send(storageDepositAction(t.accountId, accountId!), `${t.symbol} storage registered`);
    if (ok) balances.refresh();
  }

  async function onMove(t: V4Token, value: bigint) {
    const action =
      mode === 'deposit'
        ? v4Client.actions.deposit({ token: t.accountId, amount: value })
        : v4Client.actions.withdraw({ token: t.accountId, amount: value });
    const ok = await send(
      action,
      mode === 'deposit' ? `Deposited ${amount} ${t.symbol} to the DEX` : `Withdrew ${amount} ${t.symbol} to your wallet`,
    );
    if (ok) {
      setAmount('');
      balances.refresh();
    }
  }

  return (
    <div className="max-w-5xl mx-auto grid gap-4 lg:grid-cols-[1fr_1.1fr]">
      {/* Balances */}
      <div className="swap-card">
        <h2 className="text-lg font-semibold mb-3">Balances</h2>
        <div className="space-y-2">
          {market.tokens.map((t) => {
            const reg = balances.registered[t.accountId];
            return (
              <div key={t.accountId} className="rounded-lg bg-white/5 px-3 py-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{t.symbol}</span>
                  {reg === undefined ? (
                    <span className="text-[11px] text-gray-500">checking...</span>
                  ) : reg === false ? (
                    <button onClick={() => void onRegister(t)} disabled={pending} className="text-xs btn-secondary px-2 py-1 disabled:opacity-50">
                      Register storage
                    </button>
                  ) : (
                    <span className="text-[11px] text-gray-500">storage ok</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                  <div>
                    <div className="text-[11px] text-gray-400">In DEX</div>
                    <div className="font-mono">{formatTokenAmount(balances.dex[t.accountId] ?? 0n, t.decimals)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-400">In wallet</div>
                    <div className="font-mono">{formatTokenAmount(balances.wallet[t.accountId] ?? 0n, t.decimals)}</div>
                  </div>
                </div>
              </div>
            );
          })}
          {balances.loading && market.tokens.length === 0 && <div className="text-sm text-gray-400">Loading...</div>}
        </div>
        <p className="mt-3 text-[11px] text-gray-500 leading-relaxed">
          Swaps and liquidity use the DEX balance. Deposit tokens from your wallet first. The DEX contract is{' '}
          <a href={explorerAccountUrl(V4_CONTRACT_ID)} target="_blank" rel="noopener noreferrer" className="underline">{V4_CONTRACT_ID}</a>.
        </p>
      </div>

      {/* Deposit / withdraw */}
      <div className="swap-card">
        <div className="flex rounded-xl bg-white/5 border border-white/10 p-1 gap-1 mb-4">
          {(['deposit', 'withdraw'] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setAmount(''); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${mode === m ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              {m === 'deposit' ? 'Deposit' : 'Withdraw'}
            </button>
          ))}
        </div>

        <div className="flex gap-2 mb-3">
          {market.tokens.map((t) => (
            <button
              key={t.accountId}
              onClick={() => { setTokenId(t.accountId); setAmount(''); }}
              className={`flex-1 py-2 rounded-lg text-sm border transition ${
                token?.accountId === t.accountId ? 'border-primary bg-primary/10' : 'border-white/10 bg-white/5 hover:bg-white/10'
              }`}
            >
              {t.symbol}
            </button>
          ))}
        </div>

        {token && (
          <V4TokenField
            label={mode === 'deposit' ? 'Deposit amount' : 'Withdraw amount'}
            token={token}
            value={amount}
            onChange={setAmount}
            balance={formatTokenAmount(maxAmount, token.decimals)}
            onMax={maxAmount > 0n ? () => setAmount(formatUnits(maxAmount, token.decimals)) : undefined}
            hint={mode === 'deposit' ? 'From your wallet to the DEX (ft_transfer_call, 1 yoctoNEAR)' : 'From the DEX to your wallet (1 yoctoNEAR)'}
          />
        )}

        {error && <V4Banner tone="error">{error}</V4Banner>}

        <button
          onClick={action.run}
          disabled={action.disabled}
          className="w-full btn-primary py-4 text-base mt-4 disabled:opacity-50"
        >
          {action.label}
        </button>

        <V4Banner tone="info">
          Only whitelisted tokens can be deposited. Your wallet must be registered on the token contract (storage deposit) before
          deposits and withdrawals. The buttons above do this for you.
        </V4Banner>
      </div>
    </div>
  );
}
