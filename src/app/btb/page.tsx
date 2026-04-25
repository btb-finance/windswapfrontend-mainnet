'use client';

import { useState } from 'react';

import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { formatUnits } from 'viem';
import { BTBWrapper, BearNFTMint, BearStaking } from '@/components/btb';
import { BTB_CONTRACTS } from '@/config/contracts';
import { ethereum } from '@/config/chains';
import {
    useStakingStats,
    useUserStakedCount,
    usePendingRewardsDetailed,
    useBTBBalance,
    useBTBBBalance,
    useBearNFTBalance,
} from '@/hooks/useBTBContracts';

export default function BTBPage() {
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
        const percentage = Number(value) / 100;
        if (percentage > 1_000_000_000) return '>1B';
        if (percentage > 1_000_000) return (percentage / 1_000_000).toFixed(1) + 'M';
        if (percentage > 1_000) return (percentage / 1_000).toFixed(1) + 'k';
        return percentage.toFixed(2);
    };

    const tabConfig = [
        { key: 'info' as const, label: 'Dashboard', shortLabel: 'Info' },
        { key: 'wrap' as const, label: 'Wrap/Unwrap', shortLabel: 'Wrap' },
        { key: 'mint' as const, label: 'Mint NFT', shortLabel: 'Mint' },
        { key: 'stake' as const, label: 'Stake NFT', shortLabel: 'Stake' },
    ];

    return (
        <div className="container mx-auto px-3 sm:px-6 py-4">
            {/* Header - Matching Vote/Governance pages */}
            <div
                className="mb-4"
            >
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold">
                            <span className="gradient-text">BTB</span> Finance
                        </h1>
                        <p className="text-xs sm:text-sm text-gray-400">
                            Wrap, Mint NFTs, Stake & Earn BTBB
                        </p>
                    </div>
                    {/* Network Badge */}
                    <div className="flex items-center gap-2 bg-white/5 rounded-full px-3 py-1.5">
                        <span className={`w-2 h-2 rounded-full ${isOnEthereum ? 'bg-emerald-400 animate-pulse' : 'bg-yellow-400'}`} />
                        <span className="text-white/60 text-xs hidden sm:inline">
                            {isOnEthereum ? 'Ethereum' : 'Wrong Network'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Network Banner - Only show if on wrong network */}
            {!isOnEthereum && (
                <div
                    className="mb-4 p-3 rounded-xl border bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-yellow-500/20"
                >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-500">
                                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                                <path d="M12 9v4" />
                                <path d="M12 17h.01" />
                            </svg>
                            <div>
                                <div className="text-xs text-gray-400">Network Required</div>
                                <div className="font-bold text-yellow-400">Switch to Ethereum</div>
                            </div>
                        </div>
                        <button
                            onClick={() => switchChain({ chainId: ethereum.id })}
                            className="px-4 py-2 rounded-lg bg-yellow-500/20 text-yellow-400 text-xs font-bold hover:bg-yellow-500/30 transition flex items-center gap-2"
                        >
                            Switch Network
                        </button>
                    </div>
                </div>
            )}

            {/* Stats Row - Matching Vote/Governance pages */}
            <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="glass-card p-2 sm:p-3 text-center">
                    <div className="text-[10px] text-gray-400">APR</div>
                    <div className="text-sm sm:text-lg font-bold text-purple-400">
                        {statsLoading ? '...' : formatAPR(stakingStats?.[4])}%
                    </div>
                </div>
                <div className="glass-card p-2 sm:p-3 text-center">
                    <div className="text-[10px] text-gray-400">Total Staked</div>
                    <div className="text-sm sm:text-lg font-bold">
                        {statsLoading ? '...' : stakingStats?.[0]?.toString() || '0'}
                    </div>
                </div>
                <div className="glass-card p-2 sm:p-3 text-center bg-emerald-500/10">
                    <div className="text-[10px] text-gray-400">Distributed</div>
                    <div className="text-sm sm:text-lg font-bold text-emerald-400">
                        {formatNumber(stakingStats?.[1])}
                    </div>
                </div>
            </div>

            {/* Tabs - Matching Vote page style */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                {tabConfig.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex-1 min-w-0 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 border-2 flex items-center justify-center ${activeTab === tab.key
                            ? 'bg-gradient-to-r from-primary to-secondary text-white border-primary shadow-lg shadow-primary/30'
                            : 'bg-white/5 text-gray-300 border-white/10 hover:border-primary/50 hover:bg-white/10 hover:text-white'
                            }`}
                    >
                        <span className="hidden sm:inline">{tab.label}</span>
                        <span className="sm:hidden">{tab.shortLabel}</span>
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
                            {isConnected ? (
                                <div className="glass-card p-4 rounded-2xl">
                                    <h3 className="text-lg font-bold mb-4 text-white">Your Portfolio</h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                            ) : (
                                <div className="glass-card p-6 rounded-2xl text-center">
                                    <div className="text-4xl mb-3">🐻</div>
                                    <h3 className="text-lg font-semibold mb-2">Connect Wallet</h3>
                                    <p className="text-gray-400 text-sm">
                                        Connect your wallet to view your BTB Finance portfolio
                                    </p>
                                </div>
                            )}


                            {/* How It Works */}
                            <div className="glass-card p-4 rounded-2xl">
                                <h3 className="text-lg font-bold mb-4 text-white">How It Works</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 text-center">
                                        <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold mx-auto mb-2">1</div>
                                        <p className="text-xs text-white/70">Wrap BTB → BTBB</p>
                                    </div>
                                    <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 text-center">
                                        <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold mx-auto mb-2">2</div>
                                        <p className="text-xs text-white/70">Mint Bear NFTs</p>
                                    </div>
                                    <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20 text-center">
                                        <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold mx-auto mb-2">3</div>
                                        <p className="text-xs text-white/70">Stake NFTs</p>
                                    </div>
                                    <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-center">
                                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold mx-auto mb-2">4</div>
                                        <p className="text-xs text-white/70">Earn BTBB</p>
                                    </div>
                                </div>
                            </div>

                            {/* Contract Links */}
                            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                                <h4 className="font-semibold text-blue-400 mb-3 text-sm">Contract Links</h4>
                                <div className="flex flex-wrap gap-2">
                                    <a
                                        href={`https://etherscan.io/token/${BTB_CONTRACTS.BTB}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-gray-300 hover:text-primary transition bg-white/5 px-3 py-1.5 rounded-lg"
                                    >
                                        BTB Token ↗
                                    </a>
                                    <a
                                        href={`https://etherscan.io/token/${BTB_CONTRACTS.BTBB}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-gray-300 hover:text-primary transition bg-white/5 px-3 py-1.5 rounded-lg"
                                    >
                                        BTBB Token ↗
                                    </a>
                                    <a
                                        href={`https://etherscan.io/token/${BTB_CONTRACTS.BearNFT}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-gray-300 hover:text-primary transition bg-white/5 px-3 py-1.5 rounded-lg"
                                    >
                                        Bear NFT ↗
                                    </a>
                                    <a
                                        href={`https://etherscan.io/address/${BTB_CONTRACTS.BearStaking}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-gray-300 hover:text-primary transition bg-white/5 px-3 py-1.5 rounded-lg"
                                    >
                                        Staking ↗
                                    </a>
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
