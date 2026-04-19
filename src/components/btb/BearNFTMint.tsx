'use client';

import { useState, useEffect } from 'react';
import { useAccount, useChainId, useSwitchChain, useBalance } from 'wagmi';
import { formatEther } from 'viem';

import {
    useBearNFTPrice,
    useBearNFTTotalMinted,
    useBearNFTMaxSupply,
    useBearNFTRemainingSupply,
    useBearNFTMint,
    useBearNFTBalance,
} from '@/hooks/useBTBContracts';
import { ethereum } from '@/config/chains';

export function BearNFTMint() {
    const { address, isConnected } = useAccount();
    const chainId = useChainId();
    const { switchChain } = useSwitchChain();
    const isOnEthereum = chainId === ethereum.id;

    const [quantity, setQuantity] = useState(1);

    // NFT Contract Data
    const { data: pricePerNFT } = useBearNFTPrice();
    const { data: totalMinted } = useBearNFTTotalMinted();
    const { data: maxSupply } = useBearNFTMaxSupply();
    const { data: remainingSupply } = useBearNFTRemainingSupply();
    const { data: userNFTBalance, refetch: refetchBalance } = useBearNFTBalance(address);

    // ETH Balance
    const { data: ethBalance } = useBalance({
        address,
        chainId: ethereum.id,
    });

    // Mint Transaction
    const { buyNFT, isPending, isSuccess } = useBearNFTMint();

    // Calculate total price
    const totalPrice = pricePerNFT ? pricePerNFT * BigInt(quantity) : BigInt(0);
    const hasEnoughETH = ethBalance && ethBalance.value >= totalPrice;
    const maxBuy = remainingSupply ? Math.min(Number(remainingSupply), 10) : 10;

    // Refetch on success
    useEffect(() => {
        if (isSuccess) {
            refetchBalance();
            setQuantity(1);
        }
    }, [isSuccess]);

    const handleMint = () => {
        if (pricePerNFT) {
            buyNFT(quantity, pricePerNFT);
        }
    };

    if (!isConnected) {
        return (
            <div className="swap-card max-w-md mx-auto">
                <h2 className="text-base sm:text-lg font-bold mb-3">Bear NFT Mint</h2>
                <p className="text-white/60 text-sm">Connect wallet to mint Bear NFTs</p>
            </div>
        );
    }

    if (!isOnEthereum) {
        return (
            <div className="swap-card max-w-md mx-auto">
                <h2 className="text-base sm:text-lg font-bold mb-3">Bear NFT Mint</h2>
                <p className="text-white/60 mb-3 text-sm">Switch to Ethereum to mint Bear NFTs</p>
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
                <h2 className="text-base sm:text-lg font-bold">Bear NFT Mint</h2>
                <span className="px-1.5 py-0.5 text-[10px] rounded bg-amber-500/20 text-amber-400">
                    {pricePerNFT ? formatEther(pricePerNFT) : '0.01'} ETH each
                </span>
            </div>

            {/* Compact Stats Row */}
            <div className="grid grid-cols-4 gap-2 mb-3">
                <div className="text-center p-2 bg-white/5 rounded-lg">
                    <p className="text-[10px] text-gray-400">Minted</p>
                    <p className="text-sm font-bold">{totalMinted?.toString() || '0'}</p>
                </div>
                <div className="text-center p-2 bg-white/5 rounded-lg">
                    <p className="text-[10px] text-gray-400">Supply</p>
                    <p className="text-sm font-bold">{maxSupply?.toString() || '100k'}</p>
                </div>
                <div className="text-center p-2 bg-amber-500/10 rounded-lg">
                    <p className="text-[10px] text-gray-400">Left</p>
                    <p className="text-sm font-bold text-amber-400">{remainingSupply?.toLocaleString() || '...'}</p>
                </div>
                <div className="text-center p-2 bg-purple-500/10 rounded-lg">
                    <p className="text-[10px] text-gray-400">Owned</p>
                    <p className="text-sm font-bold text-purple-400">{userNFTBalance?.toString() || '0'}</p>
                </div>
            </div>

            {/* Quantity Selector - Compact */}
            <div className="token-input-row">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">Quantity</span>
                    <span className="text-sm text-gray-400">Max: {maxBuy}</span>
                </div>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setQuantity(q => Math.max(1, q - 1))}
                            disabled={quantity <= 1}
                            className="w-10 h-10 rounded-lg bg-white/10 text-white text-xl font-bold hover:bg-white/20 disabled:opacity-50"
                        >
                            −
                        </button>
                        <span className="text-2xl font-bold w-12 text-center">{quantity}</span>
                        <button
                            onClick={() => setQuantity(q => Math.min(maxBuy, q + 1))}
                            disabled={quantity >= maxBuy}
                            className="w-10 h-10 rounded-lg bg-white/10 text-white text-xl font-bold hover:bg-white/20 disabled:opacity-50"
                        >
                            +
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500/30 to-orange-500/30 flex items-center justify-center">
                            <span className="text-lg">🐻</span>
                        </div>
                        <span className="font-medium">Bear NFT</span>
                    </div>
                </div>
            </div>

            {/* Total Price - Compact */}
            <div className="mt-3 p-2 rounded-lg bg-white/5 text-xs space-y-1">
                <div className="flex justify-between">
                    <span className="text-gray-400">Total Price</span>
                    <span className="font-bold">{totalPrice ? formatEther(totalPrice) : '0'} ETH</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-400">Your ETH</span>
                    <span className={hasEnoughETH ? 'text-green-400' : 'text-red-400'}>
                        {ethBalance ? Number(formatEther(ethBalance.value)).toFixed(4) : '0'} ETH
                    </span>
                </div>
            </div>

            {/* Mint Button */}
            <button
                onClick={handleMint}
                disabled={isPending || !hasEnoughETH || !pricePerNFT}
                className={`w-full py-4 text-base mt-4 rounded-xl font-bold transition-all ${isPending || !hasEnoughETH || !pricePerNFT
                    ? 'bg-white/10 text-white/40 cursor-not-allowed'
                    : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:scale-[1.02] hover:shadow-lg hover:shadow-amber-500/20'
                    }`}
            >
                {isPending ? (
                    <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Minting...
                    </span>
                ) : !hasEnoughETH ? (
                    'Insufficient ETH'
                ) : (
                    `Mint ${quantity} Bear NFT${quantity > 1 ? 's' : ''}`
                )}
            </button>

            <div className="mt-3 text-center text-[10px] text-gray-500">
                Stake NFTs to earn BTBB rewards
            </div>
        </div>
    );
}
