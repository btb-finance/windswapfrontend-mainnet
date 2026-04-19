'use client';

import { useState, useEffect } from 'react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { formatUnits } from 'viem';

import {
    useUserNFTTokenIds,
    useUserStakedCount,
    usePendingRewardsDetailed,
    useIsApprovedForStaking,
    useNFTApproveForStaking,
    useStakeNFTs,
    useUnstakeNFTs,
    useClaimRewards,
    useStakingAPR,
} from '@/hooks/useBTBContracts';
import { ethereum } from '@/config/chains';

export function BearStaking() {
    const { address, isConnected } = useAccount();
    const chainId = useChainId();
    const { switchChain } = useSwitchChain();
    const isOnEthereum = chainId === ethereum.id;

    const [unstakeCount, setUnstakeCount] = useState(1);
    const [selectedTokenIds, setSelectedTokenIds] = useState<bigint[]>([]);

    // Data - use useUserNFTTokenIds to get actual token IDs
    const { data: nftTokenIds, balance: nftBalance, refetch: refetchNFTTokenIds, isLoading: isLoadingTokenIds } = useUserNFTTokenIds(address);
    const { data: stakedCount, refetch: refetchStakedCount } = useUserStakedCount(address);
    const { data: pendingRewards, refetch: refetchPendingRewards } = usePendingRewardsDetailed(address);
    const { data: isApproved, refetch: refetchApproval } = useIsApprovedForStaking(address);
    const { data: apr } = useStakingAPR();

    // Transactions
    const { approveAll, isPending: isApproving, isSuccess: approveSuccess } = useNFTApproveForStaking();
    const { stake, isPending: isStaking, isSuccess: stakeSuccess } = useStakeNFTs();
    const { unstake, isPending: isUnstaking, isSuccess: unstakeSuccess } = useUnstakeNFTs();
    const { claim, isPending: isClaiming, isSuccess: claimSuccess } = useClaimRewards();

    const hasNFTs = nftBalance && nftBalance > BigInt(0);
    const hasStaked = stakedCount && stakedCount > BigInt(0);
    const hasPendingRewards = pendingRewards && pendingRewards[0] > BigInt(0);

    // Refetch on success
    useEffect(() => {
        if (approveSuccess || stakeSuccess || unstakeSuccess || claimSuccess) {
            refetchNFTTokenIds();
            refetchStakedCount();
            refetchPendingRewards();
            refetchApproval();
            setUnstakeCount(1);
            setSelectedTokenIds([]);
        }
    }, [approveSuccess, stakeSuccess, unstakeSuccess, claimSuccess]);

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

    const handleStake = () => {
        if (!isApproved) {
            approveAll();
        } else if (nftTokenIds && nftTokenIds.length > 0) {
            // Use actual token IDs fetched from the contract
            stake(nftTokenIds);
        }
    };

    if (!isConnected) {
        return (
            <div className="swap-card max-w-md mx-auto">
                <h2 className="text-base sm:text-lg font-bold mb-3">Bear Staking</h2>
                <p className="text-white/60 text-sm">Connect wallet to stake Bear NFTs</p>
            </div>
        );
    }

    if (!isOnEthereum) {
        return (
            <div className="swap-card max-w-md mx-auto">
                <h2 className="text-base sm:text-lg font-bold mb-3">Bear Staking</h2>
                <p className="text-white/60 mb-3 text-sm">Switch to Ethereum to stake Bear NFTs</p>
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
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-base sm:text-lg font-bold">Bear Staking</h2>
                {apr && (
                    <span className="px-1.5 py-0.5 text-[10px] rounded bg-emerald-500/20 text-emerald-400">
                        APR: {formatAPR(apr)}%
                    </span>
                )}
            </div>

            {/* Stats Row - Compact */}
            <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="token-input-row !p-3">
                    <p className="text-[10px] text-gray-400 mb-1">Available</p>
                    <p className="text-lg font-bold">{nftBalance?.toString() || '0'} NFTs</p>
                </div>
                <div className="token-input-row !p-3 !bg-purple-500/5">
                    <p className="text-[10px] text-gray-400 mb-1">Staked</p>
                    <p className="text-lg font-bold text-purple-400">{stakedCount?.toString() || '0'} NFTs</p>
                </div>
            </div>

            {/* Pending Rewards - Compact */}
            {hasPendingRewards && (
                <div className="token-input-row !bg-gradient-to-r !from-emerald-500/10 !to-teal-500/10 mb-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-400">Pending Rewards</span>
                        <span className="text-sm font-bold text-emerald-400">
                            {formatNumber(pendingRewards?.[1])} BTBB
                        </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
                        <div>
                            <p className="text-gray-500">Gross</p>
                            <p className="font-medium">{formatNumber(pendingRewards?.[0])}</p>
                        </div>
                        <div>
                            <p className="text-gray-500">Tax</p>
                            <p className="font-medium text-red-400">-{formatNumber(pendingRewards?.[2])}</p>
                        </div>
                        <div>
                            <p className="text-gray-500">Net</p>
                            <p className="font-medium text-emerald-400">{formatNumber(pendingRewards?.[1])}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => claim()}
                        disabled={isClaiming}
                        className="w-full py-2.5 rounded-lg font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:opacity-90 transition disabled:opacity-50"
                    >
                        {isClaiming ? 'Claiming...' : 'Claim Rewards'}
                    </button>
                </div>
            )}

            {/* Stake Section */}
            {hasNFTs && (
                <button
                    onClick={handleStake}
                    disabled={isApproving || isStaking || isLoadingTokenIds}
                    className="w-full btn-primary py-3 text-sm mb-3 disabled:opacity-50"
                >
                    {isApproving ? 'Approving...' : isStaking ? 'Staking...' : isLoadingTokenIds ? 'Loading NFTs...' : !isApproved ? 'Approve NFTs' : `Stake ${nftTokenIds?.length || 0} NFTs`}
                </button>
            )}

            {/* Unstake Section - Compact */}
            {hasStaked && (
                <div className="token-input-row">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-400">Unstake</span>
                        <span className="text-sm text-gray-400">Staked: {stakedCount?.toString()}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setUnstakeCount(c => Math.max(1, c - 1))}
                            disabled={unstakeCount <= 1}
                            className="w-10 h-10 rounded-lg bg-white/10 text-white text-xl font-bold hover:bg-white/20 disabled:opacity-50"
                        >
                            −
                        </button>
                        <span className="text-xl font-bold flex-1 text-center">{unstakeCount}</span>
                        <button
                            onClick={() => setUnstakeCount(c => Math.min(Number(stakedCount), c + 1))}
                            disabled={unstakeCount >= Number(stakedCount)}
                            className="w-10 h-10 rounded-lg bg-white/10 text-white text-xl font-bold hover:bg-white/20 disabled:opacity-50"
                        >
                            +
                        </button>
                        <button
                            onClick={() => unstake(unstakeCount)}
                            disabled={isUnstaking}
                            className="px-4 py-2.5 rounded-lg font-bold text-sm bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition disabled:opacity-50"
                        >
                            {isUnstaking ? '...' : 'Unstake'}
                        </button>
                    </div>
                </div>
            )}

            {/* No NFTs State */}
            {!hasNFTs && !hasStaked && (
                <div className="text-center py-6 text-white/50">
                    <p className="text-3xl mb-2">🐻</p>
                    <p className="text-sm">No Bear NFTs</p>
                    <p className="text-xs">Mint some to start earning!</p>
                </div>
            )}
        </div>
    );
}
