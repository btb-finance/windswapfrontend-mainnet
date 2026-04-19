'use client';

import { useState } from 'react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { formatUnits } from 'viem';

import {
    useStakingStats,
    useUserStakedCount,
    usePendingRewardsDetailed,
    useBTBBalance,
    useBTBBBalance,
    useBearNFTBalance,
    useTotalRewardsDistributed,
} from '@/hooks/useBTBContracts';
import { ethereum } from '@/config/chains';
import { BTBWrapper } from './BTBWrapper';
import { BearNFTMint } from './BearNFTMint';
import { BearStaking } from './BearStaking';

export function BTBDashboard() {
    const { address, isConnected } = useAccount();
    const chainId = useChainId();
    const { switchChain } = useSwitchChain();
    const isOnEthereum = chainId === ethereum.id;

    const [activeTab, setActiveTab] = useState<'info' | 'wrap' | 'mint' | 'stake'>('info');

    // Global stats
    const { data: stakingStats, isLoading: statsLoading } = useStakingStats();

    // User stats
    const { data: btbBalance } = useBTBBalance(address);
    const { data: btbbBalance } = useBTBBBalance(address);
    const { data: nftBalance } = useBearNFTBalance(address);
    const { data: stakedCount } = useUserStakedCount(address);
    const { data: pendingRewards } = usePendingRewardsDetailed(address);

    const formatNumber = (value: bigint | undefined, decimals = 18) => {
        if (!value) return '0';
        const formatted = formatUnits(value, decimals);
        return Number(formatted).toLocaleString(undefined, { maximumFractionDigits: 4 });
    };

    const formatAPR = (value: bigint | undefined) => {
        if (!value) return '0';
        // APR is in basis points * 100 (e.g., 500000 = 50%)
        const percentage = Number(value) / 100;

        if (percentage > 1_000_000_000) return '>1B';
        if (percentage > 1_000_000) return (percentage / 1_000_000).toFixed(1) + 'M';
        if (percentage > 1_000) return (percentage / 1_000).toFixed(1) + 'k';

        return percentage.toFixed(2);
    };

    const tabConfig = [
        { key: 'info' as const, label: 'Info' },
        { key: 'wrap' as const, label: 'Wrap' },
        { key: 'mint' as const, label: 'Mint' },
        { key: 'stake' as const, label: 'Stake' },
    ];

    if (!isConnected) {
        return (
            <div
                className="glass-card p-6 rounded-2xl"
            >
                <h2 className="text-xl font-bold mb-4 gradient-text">BTB Finance Dashboard</h2>
                <p className="text-white/60">Connect your wallet to view your BTB Finance portfolio</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Compact Inline Header (Matches Portfolio) */}
            <div
                className="flex items-center justify-between gap-3"
            >
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold">
                        <span className="gradient-text">BTB</span> Finance
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-400">
                        Bear Time Bear Ecosystem
                    </p>
                </div>
                {pendingRewards && pendingRewards[1] > BigInt(0) && (
                    <div className="text-right">
                        <div className="text-xs text-gray-400">Claimable</div>
                        <div className="text-sm sm:text-base font-bold text-emerald-400">
                            {formatNumber(pendingRewards[1])} BTBB
                        </div>
                    </div>
                )}
            </div>

            {/* Network Banner - Only show if on wrong network */}
            {!isOnEthereum && (
                <div
                    className="p-3 rounded-xl border bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border-blue-500/20"
                >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="text-xl">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-500">
                                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                                    <path d="M12 9v4" />
                                    <path d="M12 17h.01" />
                                </svg>
                            </div>
                            <div>
                                <div className="text-xs text-gray-400">Network Status</div>
                                <div className="font-bold text-blue-400">
                                    Incorrect Network
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => switchChain({ chainId: ethereum.id })}
                            className="px-4 py-2 rounded-lg bg-blue-500/20 text-blue-400 text-xs font-bold hover:bg-blue-500/30 transition flex items-center gap-2"
                        >
                            Switch to Ethereum
                        </button>
                    </div>
                </div>
            )}

            {/* Compact Stats Row (Matches Portfolio Overview) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="glass-card p-3">
                    <div className="text-[10px] text-gray-400">APR</div>
                    <div className="text-sm sm:text-lg font-bold text-purple-400">
                        {statsLoading ? '...' : formatAPR(stakingStats?.[4])}%
                    </div>
                </div>
                <div className="glass-card p-3">
                    <div className="text-[10px] text-gray-400">Total Staked</div>
                    <div className="text-sm sm:text-lg font-bold">
                        {statsLoading ? '...' : formatNumber(stakingStats?.[0], 0)}
                    </div>
                </div>
                <div className="glass-card p-3 bg-emerald-500/10">
                    <div className="text-[10px] text-gray-400">Distributed</div>
                    <div className="text-sm sm:text-lg font-bold text-emerald-400">
                        {formatNumber(stakingStats?.[1])}
                    </div>
                </div>
            </div>

            {/* Tabs (Matches Portfolio styles: Pills) */}
            <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
                {tabConfig.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition whitespace-nowrap ${activeTab === tab.key
                            ? 'bg-primary text-white'
                            : 'text-gray-400 hover:text-white bg-white/5'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            
                <div
                    key={activeTab}
                >
                    {activeTab === 'info' && (
                        <div className="space-y-4">
                            {/* User Portfolio */}
                            <div className="glass-card p-4 rounded-2xl">
                                <h3 className="text-lg font-bold mb-4 text-white">Your Portfolio</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-xl p-3 border border-white/10">
                                        <p className="text-white/50 text-xs mb-1">BTB Balance</p>
                                        <p className="text-lg font-bold text-white">
                                            {formatNumber(btbBalance)}
                                        </p>
                                    </div>
                                    <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-xl p-3 border border-white/10">
                                        <p className="text-white/50 text-xs mb-1">BTBB Balance</p>
                                        <p className="text-lg font-bold text-emerald-400">
                                            {formatNumber(btbbBalance)}
                                        </p>
                                    </div>
                                    <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-xl p-3 border border-white/10">
                                        <p className="text-white/50 text-xs mb-1">Bear NFTs</p>
                                        <p className="text-lg font-bold text-amber-400">
                                            {nftBalance?.toString() || '0'}
                                        </p>
                                    </div>
                                    <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-xl p-3 border border-white/10">
                                        <p className="text-white/50 text-xs mb-1">Staked NFTs</p>
                                        <p className="text-lg font-bold text-purple-400">
                                            {stakedCount?.toString() || '0'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Pending Rewards */}
                            {pendingRewards && (pendingRewards[0] > BigInt(0)) && (
                                <div className="glass-card p-4 rounded-2xl bg-gradient-to-r from-emerald-500/5 to-teal-500/5">
                                    <h3 className="text-lg font-bold mb-4 text-white">Pending Rewards</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div>
                                            <p className="text-white/50 text-xs mb-1">Gross</p>
                                            <p className="text-lg font-bold text-white">
                                                {formatNumber(pendingRewards[0])}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-white/50 text-xs mb-1">Tax</p>
                                            <p className="text-lg font-bold text-red-400">
                                                -{formatNumber(pendingRewards[2])}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-white/50 text-xs mb-1">Net</p>
                                            <p className="text-lg font-bold text-emerald-400">
                                                {formatNumber(pendingRewards[1])}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Quick Actions Guide */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center text-xs text-white/40">
                                <div className="p-2 bg-white/5 rounded-lg">
                                    Step 1: Get BTB & Wrap
                                </div>
                                <div className="p-2 bg-white/5 rounded-lg">
                                    Step 2: Mint Bear NFT
                                </div>
                                <div className="p-2 bg-white/5 rounded-lg">
                                    Step 3: Stake & Earn
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'wrap' && (
                        <BTBWrapper />
                    )}

                    {activeTab === 'mint' && (
                        <BearNFTMint />
                    )}

                    {activeTab === 'stake' && (
                        <BearStaking />
                    )}
                </div>
            
        </div>
    );
}
