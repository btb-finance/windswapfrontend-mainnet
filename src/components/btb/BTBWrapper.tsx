'use client';

import { useState, useEffect } from 'react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';

import {
    useBTBBalance,
    useBTBBBalance,
    useBTBAllowance,
    useBTBApprove,
    useBTBBMint,
    useBTBBRedeem,
} from '@/hooks/useBTBContracts';
import { BTB_CONTRACTS } from '@/config/contracts';
import { ethereum } from '@/config/chains';

export function BTBWrapper() {
    const { address, isConnected } = useAccount();
    const chainId = useChainId();
    const { switchChain } = useSwitchChain();
    const isOnEthereum = chainId === ethereum.id;

    const [mode, setMode] = useState<'wrap' | 'unwrap'>('wrap');
    const [amount, setAmount] = useState('');

    // Balances
    const { data: btbBalance, refetch: refetchBTB } = useBTBBalance(address);
    const { data: btbbBalance, refetch: refetchBTBB } = useBTBBBalance(address);
    const { data: allowance, refetch: refetchAllowance } = useBTBAllowance(
        address,
        BTB_CONTRACTS.BTBB as `0x${string}`
    );

    // Transactions
    const { approve, isPending: isApproving, isSuccess: approveSuccess } = useBTBApprove();
    const { mint, isPending: isMinting, isSuccess: mintSuccess } = useBTBBMint();
    const { redeem, isPending: isRedeeming, isSuccess: redeemSuccess } = useBTBBRedeem();

    const balance = mode === 'wrap' ? btbBalance : btbbBalance;
    const outputBalance = mode === 'wrap' ? btbbBalance : btbBalance;
    const parsedAmount = amount ? parseUnits(amount, 18) : BigInt(0);
    const needsApproval = mode === 'wrap' && allowance !== undefined && parsedAmount > allowance;

    // Refetch on success
    useEffect(() => {
        if (approveSuccess || mintSuccess || redeemSuccess) {
            refetchBTB();
            refetchBTBB();
            refetchAllowance();
            setAmount('');
        }
    }, [approveSuccess, mintSuccess, redeemSuccess]);

    const handleMax = () => {
        if (balance) {
            setAmount(formatUnits(balance, 18));
        }
    };

    const handleAction = () => {
        if (!parsedAmount) return;

        if (mode === 'wrap') {
            if (needsApproval) {
                approve(BTB_CONTRACTS.BTBB as `0x${string}`, parsedAmount);
            } else {
                mint(parsedAmount);
            }
        } else {
            redeem(parsedAmount);
        }
    };

    const handleSwapMode = () => {
        setMode(mode === 'wrap' ? 'unwrap' : 'wrap');
        setAmount('');
    };

    const isPending = isApproving || isMinting || isRedeeming;

    const formatBalance = (val: bigint | undefined) => {
        if (!val) return '0';
        return Number(formatUnits(val, 18)).toLocaleString(undefined, { maximumFractionDigits: 4 });
    };

    if (!isConnected) {
        return (
            <div className="swap-card max-w-md mx-auto">
                <h2 className="text-base sm:text-lg font-bold mb-3">Token Wrapper</h2>
                <p className="text-white/60 text-sm">Connect wallet to wrap/unwrap tokens</p>
            </div>
        );
    }

    if (!isOnEthereum) {
        return (
            <div className="swap-card max-w-md mx-auto">
                <h2 className="text-base sm:text-lg font-bold mb-3">Token Wrapper</h2>
                <p className="text-white/60 mb-3 text-sm">Switch to Ethereum to wrap/unwrap tokens</p>
                <button
                    onClick={() => switchChain({ chainId: ethereum.id })}
                    className="w-full btn-primary py-3 text-sm"
                >
                    Switch to Ethereum
                </button>
            </div>
        );
    }

    return (
        <div className="swap-card max-w-md mx-auto">
            {/* Header - Matching Swap style */}
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-base sm:text-lg font-bold">
                    {mode === 'wrap' ? 'Wrap BTB' : 'Unwrap BTBB'}
                </h2>
                <span className="px-1.5 py-0.5 text-[10px] rounded bg-blue-500/20 text-blue-400">
                    1:1 Rate
                </span>
            </div>

            {/* Input Token */}
            <div className="token-input-row">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">You pay</span>
                    <span className="text-sm text-gray-400">
                        Balance: {formatBalance(balance)}
                        <button
                            onClick={handleMax}
                            className="ml-2 text-primary hover:text-primary/80 font-medium"
                        >
                            MAX
                        </button>
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        inputMode="decimal"
                        value={amount}
                        onChange={(e) => {
                            const value = e.target.value;
                            if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                setAmount(value);
                            }
                        }}
                        placeholder="0.0"
                        className="flex-1 min-w-0 bg-transparent text-xl md:text-2xl font-medium outline-none placeholder-gray-600"
                    />
                    <div className="token-select pointer-events-none">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center">
                            <span className="text-xs font-bold">{mode === 'wrap' ? 'B' : 'BB'}</span>
                        </div>
                        <span>{mode === 'wrap' ? 'BTB' : 'BTBB'}</span>
                    </div>
                </div>
            </div>

            {/* Swap Direction Button */}
            <div className="relative h-0 flex items-center justify-center z-10">
                <button
                    onClick={handleSwapMode}
                    className="swap-arrow-btn"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                </button>
            </div>

            {/* Output Token */}
            <div className="token-input-row">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">You receive</span>
                    <span className="text-sm text-gray-400">
                        Balance: {formatBalance(outputBalance)}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={amount || '0.0'}
                        disabled
                        className="flex-1 min-w-0 bg-transparent text-xl md:text-2xl font-medium outline-none text-gray-400"
                    />
                    <div className="token-select pointer-events-none">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500/30 to-teal-500/30 flex items-center justify-center">
                            <span className="text-xs font-bold">{mode === 'wrap' ? 'BB' : 'B'}</span>
                        </div>
                        <span>{mode === 'wrap' ? 'BTBB' : 'BTB'}</span>
                    </div>
                </div>
            </div>

            {/* Info Box - Compact */}
            <div className="mt-3 p-2 rounded-lg bg-white/5 text-xs space-y-1">
                <div className="flex justify-between">
                    <span className="text-gray-400">Rate</span>
                    <span>1 {mode === 'wrap' ? 'BTB' : 'BTBB'} = 1 {mode === 'wrap' ? 'BTBB' : 'BTB'}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-400">Tax</span>
                    <span className={mode === 'wrap' ? 'text-yellow-400' : 'text-green-400'}>
                        {mode === 'wrap' ? 'BTBB has 1% transfer tax' : 'No tax on unwrap'}
                    </span>
                </div>
            </div>

            {/* Action Button */}
            <button
                onClick={handleAction}
                disabled={!parsedAmount || isPending}
                className="w-full btn-primary py-4 text-base mt-4 disabled:opacity-50"
            >
                {isPending ? (
                    <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Processing...
                    </span>
                ) : needsApproval ? (
                    'Approve BTB'
                ) : mode === 'wrap' ? (
                    'Wrap to BTBB'
                ) : (
                    'Unwrap to BTB'
                )}
            </button>
        </div>
    );
}
