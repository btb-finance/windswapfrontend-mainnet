'use client';

import { useState, useEffect } from 'react';
import { useReadContract, useAccount, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther, formatUnits } from 'viem';
import { BTB_CONTRACTS } from '@/config/contracts';
import { ERC20_ABI, BTBB_TOKEN_ABI, BEAR_NFT_ABI, BEAR_STAKING_ABI } from '@/config/abis';
import { ethereum } from '@/config/chains';
import { useWriteContract } from '@/hooks/useWriteContract';

// ============================================
// BTB Token Hooks
// ============================================

export function useBTBBalance(address: `0x${string}` | undefined) {
    return useReadContract({
        address: BTB_CONTRACTS.BTB as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        chainId: ethereum.id,
        query: {
            enabled: !!address,
        },
    });
}

export function useBTBAllowance(owner: `0x${string}` | undefined, spender: `0x${string}`) {
    return useReadContract({
        address: BTB_CONTRACTS.BTB as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: owner ? [owner, spender] : undefined,
        chainId: ethereum.id,
        query: {
            enabled: !!owner,
        },
    });
}

// ============================================
// BTBB Token Hooks
// ============================================

export function useBTBBBalance(address: `0x${string}` | undefined) {
    return useReadContract({
        address: BTB_CONTRACTS.BTBB as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        chainId: ethereum.id,
        query: {
            enabled: !!address,
        },
    });
}

export function useBTBBStats() {
    return useReadContract({
        address: BTB_CONTRACTS.BTBB as `0x${string}`,
        abi: BTBB_TOKEN_ABI,
        functionName: 'getStats',
        chainId: ethereum.id,
    });
}

export function useBTBBPendingFees() {
    return useReadContract({
        address: BTB_CONTRACTS.BTBB as `0x${string}`,
        abi: BTBB_TOKEN_ABI,
        functionName: 'pendingFees',
        chainId: ethereum.id,
    });
}

// ============================================
// Bear NFT Hooks
// ============================================

export function useBearNFTBalance(address: `0x${string}` | undefined) {
    return useReadContract({
        address: BTB_CONTRACTS.BearNFT as `0x${string}`,
        abi: BEAR_NFT_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        chainId: ethereum.id,
        query: {
            enabled: !!address,
        },
    });
}

export function useBearNFTPrice() {
    return useReadContract({
        address: BTB_CONTRACTS.BearNFT as `0x${string}`,
        abi: BEAR_NFT_ABI,
        functionName: 'pricePerNFT',
        chainId: ethereum.id,
    });
}

export function useBearNFTTotalMinted() {
    return useReadContract({
        address: BTB_CONTRACTS.BearNFT as `0x${string}`,
        abi: BEAR_NFT_ABI,
        functionName: 'totalMinted',
        chainId: ethereum.id,
    });
}

export function useBearNFTMaxSupply() {
    return useReadContract({
        address: BTB_CONTRACTS.BearNFT as `0x${string}`,
        abi: BEAR_NFT_ABI,
        functionName: 'MAX_SUPPLY',
        chainId: ethereum.id,
    });
}

export function useBearNFTRemainingSupply() {
    return useReadContract({
        address: BTB_CONTRACTS.BearNFT as `0x${string}`,
        abi: BEAR_NFT_ABI,
        functionName: 'remainingSupply',
        chainId: ethereum.id,
    });
}

export function useUserNFTTokenIds(address: `0x${string}` | undefined) {
    const { data: balance, refetch: refetchBalance } = useBearNFTBalance(address);
    const [tokenIds, setTokenIds] = useState<bigint[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const fetchTokenIds = async () => {
            if (!address || !balance || balance === BigInt(0)) {
                setTokenIds([]);
                return;
            }

            setIsLoading(true);
            try {
                const count = Number(balance);
                // Build batch RPC calls for tokenOfOwnerByIndex
                const selector = '0x2f745c59'; // tokenOfOwnerByIndex(address,uint256)
                const paddedAddress = address.slice(2).toLowerCase().padStart(64, '0');

                const rpcCalls = Array.from({ length: count }, (_, i) => ({
                    jsonrpc: '2.0',
                    method: 'eth_call',
                    params: [{
                        to: BTB_CONTRACTS.BearNFT,
                        data: selector + paddedAddress + BigInt(i).toString(16).padStart(64, '0')
                    }, 'latest'],
                    id: i + 1,
                }));

                const response = await fetch('https://eth.llamarpc.com', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(rpcCalls),
                });

                const results = await response.json();
                const ids = (Array.isArray(results) ? results : [results])
                    .filter(r => r.result && r.result !== '0x')
                    .map(r => BigInt(r.result))
                    .sort((a, b) => Number(a - b));

                setTokenIds(ids);
            } catch (err) {
                console.error('Error fetching NFT token IDs:', err);
                setTokenIds([]);
            }
            setIsLoading(false);
        };

        fetchTokenIds();
    }, [address, balance]);

    const refetch = () => {
        refetchBalance();
    };

    return {
        data: tokenIds,
        balance,
        isLoading,
        refetch,
    };
}

// ============================================
// Bear Staking Hooks
// ============================================

export function useStakingStats() {
    return useReadContract({
        address: BTB_CONTRACTS.BearStaking as `0x${string}`,
        abi: BEAR_STAKING_ABI,
        functionName: 'getStats',
        chainId: ethereum.id,
    });
}

export function useUserStakingInfo(address: `0x${string}` | undefined) {
    return useReadContract({
        address: BTB_CONTRACTS.BearStaking as `0x${string}`,
        abi: BEAR_STAKING_ABI,
        functionName: 'getUserInfo',
        args: address ? [address] : undefined,
        chainId: ethereum.id,
        query: {
            enabled: !!address,
        },
    });
}

export function useUserStakedCount(address: `0x${string}` | undefined) {
    return useReadContract({
        address: BTB_CONTRACTS.BearStaking as `0x${string}`,
        abi: BEAR_STAKING_ABI,
        functionName: 'stakedCountOf',
        args: address ? [address] : undefined,
        chainId: ethereum.id,
        query: {
            enabled: !!address,
        },
    });
}

export function usePendingRewards(address: `0x${string}` | undefined) {
    return useReadContract({
        address: BTB_CONTRACTS.BearStaking as `0x${string}`,
        abi: BEAR_STAKING_ABI,
        functionName: 'pendingRewards',
        args: address ? [address] : undefined,
        chainId: ethereum.id,
        query: {
            enabled: !!address,
        },
    });
}

export function usePendingRewardsDetailed(address: `0x${string}` | undefined) {
    return useReadContract({
        address: BTB_CONTRACTS.BearStaking as `0x${string}`,
        abi: BEAR_STAKING_ABI,
        functionName: 'pendingRewardsDetailed',
        args: address ? [address] : undefined,
        chainId: ethereum.id,
        query: {
            enabled: !!address,
        },
    });
}

export function useStakingAPR() {
    return useReadContract({
        address: BTB_CONTRACTS.BearStaking as `0x${string}`,
        abi: BEAR_STAKING_ABI,
        functionName: 'estimatedAPR',
        chainId: ethereum.id,
    });
}

export function useTotalStaked() {
    return useReadContract({
        address: BTB_CONTRACTS.BearStaking as `0x${string}`,
        abi: BEAR_STAKING_ABI,
        functionName: 'totalStaked',
        chainId: ethereum.id,
    });
}

export function useTotalRewardsDistributed() {
    return useReadContract({
        address: BTB_CONTRACTS.BearStaking as `0x${string}`,
        abi: BEAR_STAKING_ABI,
        functionName: 'totalRewardsDistributed',
        chainId: ethereum.id,
    });
}

// ============================================
// Write Hooks
// ============================================

export function useBTBApprove() {
    const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

    const approve = (spender: `0x${string}`, amount: bigint) => {
        void writeContractAsync({
            address: BTB_CONTRACTS.BTB as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [spender, amount],
            chainId: ethereum.id,
        });
    };

    return { approve, isPending, isConfirming, isSuccess, error, hash };
}

export function useBTBBMint() {
    const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

    const mint = (amount: bigint) => {
        void writeContractAsync({
            address: BTB_CONTRACTS.BTBB as `0x${string}`,
            abi: BTBB_TOKEN_ABI,
            functionName: 'mint',
            args: [amount],
            chainId: ethereum.id,
        });
    };

    return { mint, isPending, isConfirming, isSuccess, error, hash };
}

export function useBTBBRedeem() {
    const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

    const redeem = (amount: bigint) => {
        void writeContractAsync({
            address: BTB_CONTRACTS.BTBB as `0x${string}`,
            abi: BTBB_TOKEN_ABI,
            functionName: 'redeem',
            args: [amount],
            chainId: ethereum.id,
        });
    };

    return { redeem, isPending, isConfirming, isSuccess, error, hash };
}

export function useBearNFTMint() {
    const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

    const buyNFT = (amount: number, pricePerNFT: bigint) => {
        const totalPrice = pricePerNFT * BigInt(amount);
        void writeContractAsync({
            address: BTB_CONTRACTS.BearNFT as `0x${string}`,
            abi: BEAR_NFT_ABI,
            functionName: 'buyNFT',
            args: [BigInt(amount)],
            value: totalPrice,
            chainId: ethereum.id,
        });
    };

    return { buyNFT, isPending, isConfirming, isSuccess, error, hash };
}

export function useNFTApproveForStaking() {
    const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

    const approveAll = () => {
        void writeContractAsync({
            address: BTB_CONTRACTS.BearNFT as `0x${string}`,
            abi: BEAR_NFT_ABI,
            functionName: 'setApprovalForAll',
            args: [BTB_CONTRACTS.BearStaking as `0x${string}`, true],
            chainId: ethereum.id,
        });
    };

    return { approveAll, isPending, isConfirming, isSuccess, error, hash };
}

export function useIsApprovedForStaking(address: `0x${string}` | undefined) {
    return useReadContract({
        address: BTB_CONTRACTS.BearNFT as `0x${string}`,
        abi: BEAR_NFT_ABI,
        functionName: 'isApprovedForAll',
        args: address ? [address, BTB_CONTRACTS.BearStaking as `0x${string}`] : undefined,
        chainId: ethereum.id,
        query: {
            enabled: !!address,
        },
    });
}

export function useStakeNFTs() {
    const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

    const stake = (tokenIds: bigint[]) => {
        void writeContractAsync({
            address: BTB_CONTRACTS.BearStaking as `0x${string}`,
            abi: BEAR_STAKING_ABI,
            functionName: 'stake',
            args: [tokenIds],
            chainId: ethereum.id,
        });
    };

    return { stake, isPending, isConfirming, isSuccess, error, hash };
}

export function useUnstakeNFTs() {
    const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

    const unstake = (count: number) => {
        void writeContractAsync({
            address: BTB_CONTRACTS.BearStaking as `0x${string}`,
            abi: BEAR_STAKING_ABI,
            functionName: 'unstake',
            args: [BigInt(count)],
            chainId: ethereum.id,
        });
    };

    return { unstake, isPending, isConfirming, isSuccess, error, hash };
}

export function useClaimRewards() {
    const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

    const claim = () => {
        void writeContractAsync({
            address: BTB_CONTRACTS.BearStaking as `0x${string}`,
            abi: BEAR_STAKING_ABI,
            functionName: 'claim',
            chainId: ethereum.id,
        });
    };

    return { claim, isPending, isConfirming, isSuccess, error, hash };
}

export function useCollectFees() {
    const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

    const collectFees = () => {
        void writeContractAsync({
            address: BTB_CONTRACTS.BearStaking as `0x${string}`,
            abi: BEAR_STAKING_ABI,
            functionName: 'collectFees',
            chainId: ethereum.id,
        });
    };

    return { collectFees, isPending, isConfirming, isSuccess, error, hash };
}
