'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useTokenPage, TokenPool } from '@/hooks/useTokenPage';
import { Token, ETH } from '@/config/tokens';
import { getTokenByAddress } from '@/utils/tokens';
import { formatTVL } from '@/utils/format';
import { SwapIcon, VoteIcon, LinkIcon, CheckIcon, SparklesIcon } from '@/components/common/Icons';

const AddLiquidityModal = dynamic(
    () => import('@/components/pools/AddLiquidityModal').then(mod => mod.AddLiquidityModal),
    { ssr: false }
);

interface PoolConfig {
    token0?: Token;
    token1?: Token;
    poolType: 'v2' | 'cl';
    tickSpacing?: number;
    stable?: boolean;
}

const findTokenForUI = (addr: string): Token | undefined => {
    const token = getTokenByAddress(addr);
    if (token?.symbol === 'WETH') return ETH;
    return token || undefined;
};

const FEE_TIERS: Record<number, string> = {
    1: '0.005%',
    2: '1%',
    3: '0.03%',
    4: '0.05%',
    5: '0.26%',
};

export function TokenPageContent() {
    const params = useParams();
    const router = useRouter();
    const address = params.address as string;

    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => {
        setIsMounted(true);
    }, []);

    const { token, isKnownToken, isLoading, error, pools, isValidAddress } = useTokenPage(isMounted ? address : undefined);

    const [modalOpen, setModalOpen] = useState(false);
    const [selectedPool, setSelectedPool] = useState<PoolConfig | undefined>(undefined);

    const [copied, setCopied] = useState(false);
    const copyAddress = () => {
        if (token?.address) {
            navigator.clipboard.writeText(token.address);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const [linkCopied, setLinkCopied] = useState(false);
    const shareToken = () => {
        const url = `${window.location.origin}/tokens/${token?.address}`;
        navigator.clipboard.writeText(url);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
    };

    const handleTrade = () => {
        if (token) {
            router.push(`/swap?tokenOut=${token.address}`);
        }
    };

    const handleVote = () => {
        router.push('/vote');
    };

    const openAddLiquidity = (pool: TokenPool) => {
        const t0 = findTokenForUI(pool.token0.address);
        const t1 = findTokenForUI(pool.token1.address);
        setSelectedPool({
            token0: t0,
            token1: t1,
            poolType: pool.poolType === 'CL' ? 'cl' : 'v2',
            tickSpacing: pool.tickSpacing,
        });
        setModalOpen(true);
    };

    const openAddLiquidityGeneral = () => {
        if (token) {
            setSelectedPool({
                token0: token,
                token1: undefined,
                poolType: 'cl',
            });
            setModalOpen(true);
        }
    };

    if (!isMounted || isLoading) {
        return (
            <div className="container mx-auto px-3 sm:px-6 py-8">
                <div className="glass-card p-8 text-center max-w-lg mx-auto">
                    <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-400">Loading token info...</p>
                </div>
            </div>
        );
    }

    if (error || !token) {
        return (
            <div className="container mx-auto px-3 sm:px-6 py-8">
                <div className="glass-card p-8 text-center max-w-lg mx-auto">
                    <h2 className="text-xl font-bold mb-2">Token Not Found</h2>
                    <p className="text-gray-400 mb-4 text-sm">
                        {!isValidAddress ? 'Invalid token address format' : error || 'Could not load token information'}
                    </p>
                    <code className="text-xs text-gray-500 break-all block mb-4">{address}</code>
                    <Link href="/swap" className="btn-primary px-4 py-2 text-sm">
                        Go to Swap
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-3 sm:px-6 py-4">
            {/* Token Header */}
            <div className="glass-card p-4 sm:p-6 mb-4 animate-fade-up">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        {token.logoURI ? (
                            <img src={token.logoURI} alt={token.symbol} className="w-12 h-12 sm:w-16 sm:h-16 rounded-full" />
                        ) : (
                            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xl sm:text-2xl font-bold">
                                {token.symbol[0]}
                            </div>
                        )}
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold">{token.name}</h1>
                            <p className="text-gray-400 text-sm">{token.symbol}</p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <a
                            href={`https://basescan.org/token/${token.address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-lg bg-white/5 text-xs text-gray-300 hover:bg-white/10 transition"
                        >
                            Basescan
                        </a>
                    </div>
                </div>

                <div className="mt-4 flex items-center gap-2">
                    <code className="flex-1 text-xs text-gray-400 bg-white/5 px-3 py-2 rounded-lg truncate">
                        {token.address}
                    </code>
                    <button
                        onClick={copyAddress}
                        className="px-3 py-2 rounded-lg bg-white/5 text-xs hover:bg-white/10 transition flex-shrink-0"
                    >
                        {copied ? 'Copied' : 'Copy'}
                    </button>
                </div>

                {isKnownToken && (
                    <div className="mt-3">
                        <span className="text-[10px] px-2 py-1 rounded bg-green-500/20 text-green-400">
                            Verified Token
                        </span>
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-4 gap-2 sm:gap-4 mb-4 animate-fade-up" style={{ animationDelay: '0.1s' }}>
                <button
                    onClick={handleTrade}
                    className="glass-card p-3 sm:p-6 text-center hover:bg-white/10 transition group"
                >
                    <div className="flex justify-center mb-1 sm:mb-2 group-hover:scale-110 transition">
                        <SwapIcon className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                    </div>
                    <div className="font-semibold text-xs sm:text-base">Trade</div>
                    <div className="text-[10px] text-gray-400 hidden sm:block">Swap tokens</div>
                </button>

                <button
                    onClick={openAddLiquidityGeneral}
                    className="glass-card p-3 sm:p-6 text-center hover:bg-white/10 transition group"
                >
                    <div className="flex justify-center mb-1 sm:mb-2 group-hover:scale-110 transition">
                        <svg className="w-6 h-6 sm:w-8 sm:h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                    </div>
                    <div className="font-semibold text-xs sm:text-base">Add LP</div>
                    <div className="text-[10px] text-gray-400 hidden sm:block">Provide liquidity</div>
                </button>

                <button
                    onClick={handleVote}
                    className="glass-card p-3 sm:p-6 text-center hover:bg-white/10 transition group"
                >
                    <div className="flex justify-center mb-1 sm:mb-2 group-hover:scale-110 transition">
                        <VoteIcon className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                    </div>
                    <div className="font-semibold text-xs sm:text-base">Vote</div>
                    <div className="text-[10px] text-gray-400 hidden sm:block">Vote on pools</div>
                </button>

                <button
                    onClick={shareToken}
                    className={`glass-card p-3 sm:p-6 text-center transition group ${linkCopied ? 'bg-green-500/20 border-green-500/30' : 'hover:bg-white/10'}`}
                >
                    <div className="flex justify-center mb-1 sm:mb-2 group-hover:scale-110 transition">
                        {linkCopied ? <CheckIcon className="w-6 h-6 sm:w-8 sm:h-8 text-green-400" /> : <LinkIcon className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />}
                    </div>
                    <div className="font-semibold text-xs sm:text-base">
                        {linkCopied ? 'Copied!' : 'Share'}
                    </div>
                    <div className="text-[10px] text-gray-400 hidden sm:block">
                        {linkCopied ? 'Link copied' : 'Copy link'}
                    </div>
                </button>
            </div>

            {/* Pools List */}
            <div className="glass-card overflow-hidden animate-fade-up" style={{ animationDelay: '0.2s' }}>
                <div className="p-4 border-b border-white/5">
                    <h2 className="font-semibold">
                        Pools with {token.symbol} ({pools.length})
                    </h2>
                </div>

                {pools.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                        <p className="text-sm">No pools found for this token</p>
                        <button
                            onClick={openAddLiquidityGeneral}
                            className="mt-4 btn-primary px-4 py-2 text-sm"
                        >
                            Create New Pool
                        </button>
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {pools.map((pool) => (
                            <div key={pool.address} className="p-3 sm:p-4 flex items-center justify-between gap-3 hover:bg-white/5 transition">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="relative w-12 h-7 flex-shrink-0">
                                        {pool.token0.logoURI ? (
                                            <img src={pool.token0.logoURI} alt={pool.token0.symbol} className="absolute left-0 w-7 h-7 rounded-full border-2 border-[var(--bg-primary)]" />
                                        ) : (
                                            <div className="absolute left-0 w-7 h-7 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-bold border-2 border-[var(--bg-primary)]">
                                                {pool.token0.symbol[0]}
                                            </div>
                                        )}
                                        {pool.token1.logoURI ? (
                                            <img src={pool.token1.logoURI} alt={pool.token1.symbol} className="absolute left-4 w-7 h-7 rounded-full border-2 border-[var(--bg-primary)]" />
                                        ) : (
                                            <div className="absolute left-4 w-7 h-7 rounded-full bg-gradient-to-br from-secondary to-accent flex items-center justify-center text-xs font-bold border-2 border-[var(--bg-primary)]">
                                                {pool.token1.symbol[0]}
                                            </div>
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-semibold text-sm truncate">
                                            {pool.token0.symbol}/{pool.token1.symbol}
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px]">
                                            <span className={`px-1 py-0.5 rounded ${pool.poolType === 'CL' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-primary/20 text-primary'}`}>
                                                {pool.poolType}
                                            </span>
                                            {pool.poolType === 'CL' && pool.tickSpacing && (
                                                <span className="text-gray-400">
                                                    {FEE_TIERS[pool.tickSpacing] || `${pool.tickSpacing}ts`}
                                                </span>
                                            )}
                                            {pool.hasGauge && (
                                                <span className="px-1 py-0.5 rounded bg-yellow-500/20 text-yellow-400 flex items-center gap-0.5">
                                                    <SparklesIcon className="w-3 h-3" /> Rewards
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 flex-shrink-0">
                                    <div className="text-right hidden sm:block">
                                        <div className="text-xs text-gray-400">TVL</div>
                                        <div className="text-sm font-medium">{formatTVL(pool.tvl)}</div>
                                    </div>
                                    <button
                                        onClick={() => openAddLiquidity(pool)}
                                        className="px-3 py-2 rounded-lg bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 hover:from-cyan-500/30 hover:to-blue-500/30 text-xs font-medium transition"
                                    >
                                        + LP
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="mt-6 text-center animate-fade-in" style={{ animationDelay: '0.3s' }}>
                <Link href="/swap" className="text-sm text-gray-400 hover:text-white transition">
                    Back to Swap
                </Link>
            </div>

            <AddLiquidityModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                initialPool={selectedPool}
            />
        </div>
    );
}
