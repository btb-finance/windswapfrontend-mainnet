'use client';

import { useState } from 'react';
import { erc20Abi } from 'viem';
import { useAccount, useBalance, useReadContract, useSendTransaction, useSwitchChain } from 'wagmi';
import { V4WalletGate } from '@/components/v4/V4WalletGate';
import { V4Banner } from '@/components/v4/V4Banner';
import { useWriteContract } from '@/hooks/useWriteContract';
import { useV4Actor } from '@/providers/V4ActorProvider';
import { useToast } from '@/providers/ToastProvider';
import { useV4Query } from '@/hooks/v4/useV4Query';
import { readableNearError } from '@/lib/v4/near';
import {
  V4_ASSET_ETH,
  V4_ASSET_TEST1,
  V4_EVM_CHAIN_ID,
  V4_EVM_EXPLORER_URL,
  V4_TEST1_ADDRESS,
  V4_VAULT_ADDRESS,
} from '@/lib/v4/config';
import { ownerViews } from '@/lib/v4/owner-views';
import type { WithdrawalView } from '@/lib/v4/ve/views';
import { formatTokenAmount, parseTokenAmount, shortHex } from '@/lib/v4/format';

const DECIMALS = 18;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

type Asset = 'ETH' | 'test1';
const ASSET_ID: Record<Asset, string> = { ETH: V4_ASSET_ETH, test1: V4_ASSET_TEST1 };

interface Balances {
  eth: bigint;
  test1: bigint;
}

interface PendingDeposit {
  hash: `0x${string}`;
  asset: Asset;
  amount: bigint;
  /** DEX balance of the asset when the deposit was sent. A higher balance means it was credited. */
  baseline: bigint;
}

/** Bridge page: deposit ETH or test1 on Base Sepolia, withdraw back with a signed WithdrawEvm. */
export function V4Bridge() {
  return (
    <V4WalletGate evmOnly>
      <V4BridgeInner />
    </V4WalletGate>
  );
}

function V4BridgeInner() {
  const { owner, evmAddress, runSigned, pending } = useV4Actor();
  const toast = useToast();
  const { address, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();
  const wrongChain = chainId !== V4_EVM_CHAIN_ID;

  // DEX balances of this EVM owner (credited by the relayer after each deposit), from the owner's balance list.
  const dex = useV4Query<Balances>(
    owner ? `bridge-bal:${owner}` : null,
    async () => {
      const held = new Map(await ownerViews.balancesOfOwner(owner!));
      return { eth: BigInt(held.get(V4_ASSET_ETH) ?? '0'), test1: BigInt(held.get(V4_ASSET_TEST1) ?? '0') };
    },
    10_000,
  );
  const dexOf = (asset: Asset) => (dex.data ? (asset === 'ETH' ? dex.data.eth : dex.data.test1) : undefined);

  // Wallet balances on Base Sepolia.
  const walletEth = useBalance({ address, chainId: V4_EVM_CHAIN_ID, query: { enabled: !!address } });
  const walletTest1 = useReadContract({
    chainId: V4_EVM_CHAIN_ID,
    address: V4_TEST1_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address ?? ZERO_ADDRESS],
    query: { enabled: !!address },
  });
  const walletOf = (asset: Asset): bigint | undefined => (asset === 'ETH' ? walletEth.data?.value : walletTest1.data);

  // Deposit
  const [asset, setAsset] = useState<Asset>('ETH');
  const [depositInput, setDepositInput] = useState('');
  const [deposits, setDeposits] = useState<PendingDeposit[]>([]);
  const [depositBusy, setDepositBusy] = useState(false);
  const depositAmount = parseTokenAmount(depositInput, DECIMALS);
  const depositWalletBal = walletOf(asset);
  let depositError: string | null = null;
  if (depositInput && depositAmount === null) depositError = 'Enter a positive amount.';
  else if (depositAmount !== null && depositWalletBal !== undefined && depositAmount > depositWalletBal) depositError = `Not enough ${asset} in your wallet on Base Sepolia.`;

  async function onDeposit() {
    if (depositAmount === null || !address) return;
    setDepositBusy(true);
    try {
      if (wrongChain) await switchChainAsync({ chainId: V4_EVM_CHAIN_ID });
      const hash =
        asset === 'ETH'
          ? await sendTransactionAsync({ chainId: V4_EVM_CHAIN_ID, to: V4_VAULT_ADDRESS, value: depositAmount })
          : await writeContractAsync({
              chainId: V4_EVM_CHAIN_ID,
              address: V4_TEST1_ADDRESS,
              abi: erc20Abi,
              functionName: 'transfer',
              args: [V4_VAULT_ADDRESS, depositAmount],
            });
      setDeposits((prev) => [{ hash, asset, amount: depositAmount, baseline: dexOf(asset) ?? 0n }, ...prev]);
      setDepositInput('');
      toast.success('Deposit sent. It shows here once the relayer credits it.');
    } catch (err) {
      toast.error(readableNearError(err));
    } finally {
      setDepositBusy(false);
    }
  }

  // Withdraw
  const [wAsset, setWAsset] = useState<Asset>('ETH');
  const [wInput, setWInput] = useState('');
  const [wTo, setWTo] = useState('');
  const toAddress = (wTo.trim() || evmAddress || '').trim();
  const toValid = /^0x[0-9a-fA-F]{40}$/.test(toAddress);
  const wAmount = parseTokenAmount(wInput, DECIMALS);
  const wAvailable = dexOf(wAsset);
  let wError: string | null = null;
  if (wInput && wAmount === null) wError = 'Enter a positive amount.';
  else if (wAmount !== null && wAvailable !== undefined && wAmount > wAvailable) wError = `More than your DEX balance of ${wAsset}.`;
  else if (toAddress && !toValid) wError = 'Enter a 0x address with 40 hex digits.';

  // Every withdrawal of this owner, from the contract (get_withdrawals_of_owner). Polled while open.
  const withdrawals = useV4Query(owner ? `wd:${owner}` : null, () => ownerViews.withdrawalsOfOwner(owner!), 15_000);

  async function onWithdraw() {
    if (wAmount === null || !toValid) return;
    const outcome = await runSigned(
      {
        WithdrawEvm: {
          token: ASSET_ID[wAsset],
          amount: wAmount.toString(),
          to_chain_id: V4_EVM_CHAIN_ID,
          to_address: toAddress,
        },
      },
      `Withdrawal of ${wInput} ${wAsset} signed`,
    );
    if (!outcome) return;
    setWInput('');
    dex.refresh();
    withdrawals.refresh();
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Balances */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="swap-card space-y-3">
          <h2 className="text-lg font-semibold">Base Sepolia wallet</h2>
          <div className="text-xs text-gray-400 font-mono">{address ? shortHex(address, 8, 6) : ''}</div>
          <BalanceRow label="ETH" value={walletEth.data?.value} />
          <BalanceRow label="test1" value={walletTest1.data} />
          {wrongChain && (
            <V4Banner tone="warning">
              Your wallet is on another network. Deposits switch it to Base Sepolia.{' '}
              <button onClick={() => void switchChainAsync({ chainId: V4_EVM_CHAIN_ID })} className="underline font-semibold">Switch now</button>
            </V4Banner>
          )}
        </div>
        <div className="swap-card space-y-3">
          <h2 className="text-lg font-semibold">DEX balance</h2>
          <div className="text-xs text-gray-400 font-mono">{owner ? shortHex(owner, 8, 6) : ''}</div>
          <BalanceRow label="ETH" value={dex.data?.eth} />
          <BalanceRow label="test1" value={dex.data?.test1} />
          {dex.error && <V4Banner tone="error">{dex.error}</V4Banner>}
        </div>
      </div>

      {/* Deposit and withdraw */}
      <div className="grid gap-4 md:grid-cols-2 items-start">
        <div className="swap-card space-y-3">
          <h2 className="text-lg font-semibold">Deposit</h2>
          <p className="text-xs text-gray-400">Send ETH or test1 to the vault on Base Sepolia. The relayer then credits your DEX balance.</p>
          <AssetPicker value={asset} onChange={setAsset} />
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Amount</span>
              <span>Wallet: {depositWalletBal !== undefined ? formatTokenAmount(depositWalletBal, DECIMALS) : '...'}</span>
            </div>
            <input className="input-field !text-base" inputMode="decimal" placeholder="0.0" value={depositInput} onChange={(e) => setDepositInput(e.target.value)} aria-label={`${asset} deposit amount`} />
          </div>
          {depositError && <V4Banner tone="error">{depositError}</V4Banner>}
          <button
            onClick={() => void onDeposit()}
            disabled={depositBusy || pending || depositAmount === null || depositError !== null || !address}
            className="w-full btn-primary py-3 disabled:opacity-50"
          >
            {depositBusy ? 'Confirm in wallet...' : wrongChain ? 'Switch to Base Sepolia and deposit' : `Deposit ${asset}`}
          </button>
          <div className="text-[11px] text-gray-500 break-all">
            Vault <a href={`${V4_EVM_EXPLORER_URL}/address/${V4_VAULT_ADDRESS}`} target="_blank" rel="noopener noreferrer" className="underline font-mono">{V4_VAULT_ADDRESS}</a>
          </div>
          {deposits.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-white/10">
              {deposits.map((d) => {
                const bal = dexOf(d.asset);
                const credited = bal !== undefined && bal > d.baseline;
                return (
                  <div key={d.hash} className="flex items-center justify-between text-xs rounded-lg bg-white/5 px-3 py-2">
                    <a href={`${V4_EVM_EXPLORER_URL}/tx/${d.hash}`} target="_blank" rel="noopener noreferrer" className="underline font-mono">
                      {formatTokenAmount(d.amount, DECIMALS)} {d.asset} · {shortHex(d.hash, 6, 4)}
                    </a>
                    <span className={credited ? 'text-emerald-300' : 'text-amber-300'}>{credited ? 'Credited' : 'Waiting for relayer'}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="swap-card space-y-3">
          <h2 className="text-lg font-semibold">Withdraw</h2>
          <p className="text-xs text-gray-400">Signs a WithdrawEvm with your wallet. The contract debits your DEX balance now, and the relayer then pays out on Base Sepolia.</p>
          <AssetPicker value={wAsset} onChange={setWAsset} />
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Amount</span>
              <span>DEX: {wAvailable !== undefined ? formatTokenAmount(wAvailable, DECIMALS) : '...'}</span>
            </div>
            <input className="input-field !text-base" inputMode="decimal" placeholder="0.0" value={wInput} onChange={(e) => setWInput(e.target.value)} aria-label={`${wAsset} withdraw amount`} />
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">Send to (Base Sepolia)</div>
            <input className="input-field !text-sm !py-2 font-mono" placeholder={evmAddress ?? '0x…'} value={wTo} onChange={(e) => setWTo(e.target.value)} aria-label="Withdrawal address" />
          </div>
          {wError && <V4Banner tone="error">{wError}</V4Banner>}
          <button
            onClick={() => void onWithdraw()}
            disabled={pending || wAmount === null || wError !== null || !toValid}
            className="w-full btn-primary py-3 disabled:opacity-50"
          >
            {pending ? 'Working...' : `Sign withdrawal of ${wAsset}`}
          </button>
          <V4Banner tone="info">
            ETH withdrawals are capped per transaction and per day by the contract. A rejected withdrawal leaves your balance unchanged.
          </V4Banner>
        </div>
      </div>

      {/* Withdrawal status */}
      <div className="swap-card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Withdrawals</h2>
          {withdrawals.loading && <span className="text-[11px] text-gray-500">refreshing...</span>}
        </div>
        {withdrawals.error && <V4Banner tone="error">{withdrawals.error}</V4Banner>}
        {withdrawals.data && withdrawals.data.length === 0 && <p className="text-sm text-gray-500">No withdrawals yet. Sign one above.</p>}
        {(withdrawals.data ?? []).map((w) => (
          <WithdrawalRow key={w.id} view={w} />
        ))}
        <p className="text-[11px] text-gray-500">
          Status: Pending (waiting for the relayer), Signed (MPC signature ready), Broadcast (transaction sent on Base Sepolia), Failed.
        </p>
      </div>
    </div>
  );
}

function WithdrawalRow({ view }: { view: WithdrawalView }) {
  const id = view.id;
  const tone =
    view.status === 'Broadcast' ? 'text-emerald-300' : view.status === 'Failed' ? 'text-red-300' : view.status === 'Signed' ? 'text-sky-300' : 'text-amber-300';
  const hash = view.tx_hash ? (view.tx_hash.startsWith('0x') ? view.tx_hash : `0x${view.tx_hash}`) : null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm">
      <div>
        <div className="font-semibold">#{id} · {formatTokenAmount(BigInt(view.amount), DECIMALS)} {view.token_id === V4_ASSET_TEST1 ? 'test1' : 'ETH'}</div>
        <div className="text-[11px] text-gray-500 font-mono">to {shortHex(view.to_address, 8, 6)}</div>
      </div>
      <div className="flex items-center gap-3 text-xs">
        {hash && (
          <a href={`${V4_EVM_EXPLORER_URL}/tx/${hash}`} target="_blank" rel="noopener noreferrer" className="underline">
            Basescan
          </a>
        )}
        <span className={`font-semibold ${tone}`}>{view.status}</span>
      </div>
    </div>
  );
}

function BalanceRow({ label, value }: { label: string; value: bigint | undefined }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
      <span className="text-gray-400">{label}</span>
      <span className="font-mono">{value !== undefined ? formatTokenAmount(value, DECIMALS) : '...'}</span>
    </div>
  );
}

function AssetPicker({ value, onChange }: { value: Asset; onChange: (a: Asset) => void }) {
  return (
    <div className="flex gap-2" role="group" aria-label="Asset">
      {(['ETH', 'test1'] as const).map((a) => (
        <button
          key={a}
          type="button"
          onClick={() => onChange(a)}
          aria-pressed={value === a}
          className={`flex-1 py-2 rounded-lg text-sm border transition ${value === a ? 'border-primary bg-primary/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
        >
          {a}
        </button>
      ))}
    </div>
  );
}
