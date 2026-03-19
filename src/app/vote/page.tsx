'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAccount, useReadContract } from 'wagmi';
import { useWriteContract } from '@/hooks/useWriteContract';
import { formatUnits, Address, encodeFunctionData, decodeFunctionResult } from 'viem';
import { formatBalance } from '@/utils/format';
import { useVeWIND, LOCK_DURATIONS } from '@/hooks/useVeWIND';
import { useTokenBalance } from '@/hooks/useToken';
import { useVoter } from '@/hooks/useVoter';
import { WIND, DEFAULT_TOKEN_LIST } from '@/config/tokens';
import { getTokenLogo } from '@/utils/tokens';
import { V2_CONTRACTS } from '@/config/contracts';
import { getRpcForVoting, rpcCall } from '@/utils/rpc';
import { EmptyState } from '@/components/common/InfoCard';
import { LockVoteEarnSteps } from '@/components/common/StepIndicator';
import { SUBGRAPH_URL, readSubgraphJson } from '@/config/subgraph';
import { usePoolData } from '@/providers/PoolDataProvider';
import { VOTER_DISTRIBUTE_ABI, FEE_REWARD_ABI } from '@/config/abis';
import { TIME } from '@/config/constants';

export default function VotePage() {

    const { isConnected, address } = useAccount();
    const [activeTab, setActiveTab] = useState<'lock' | 'vote' | 'rewards'>('vote');

    // Lock state
    const [lockAmount, setLockAmount] = useState('');
    const [lockDuration, setLockDuration] = useState<keyof typeof LOCK_DURATIONS>('4Y');
    const [txHash, setTxHash] = useState<string | null>(null);

    // Vote state
    const [selectedVeNFT, setSelectedVeNFT] = useState<bigint | null>(null);
    const [voteWeights, setVoteWeights] = useState<Record<string, number>>({});
    const [isVoting, setIsVoting] = useState(false);

    // Search and sort state for gauges
    const [gaugeSearchQuery, setGaugeSearchQuery] = useState('');
    const [gaugeSortBy, setGaugeSortBy] = useState<'rewards' | 'votes'>('rewards');

    // Lock management state
    const [managingNFT, setManagingNFT] = useState<bigint | null>(null);
    const [increaseAmountValue, setIncreaseAmountValue] = useState('');
    const [isMaxAmount, setIsMaxAmount] = useState(false); // Track if MAX was clicked
    const [extendDuration, setExtendDuration] = useState<keyof typeof LOCK_DURATIONS>('4Y');
    const [mergeTarget, setMergeTarget] = useState<bigint | null>(null);
    const [activeAction, setActiveAction] = useState<'add' | 'extend' | 'merge' | 'permanent' | null>(null);

    // Incentive modal state
    const [incentivePool, setIncentivePool] = useState<{ pool: string; symbol0: string; symbol1: string } | null>(null);
    const [incentiveToken, setIncentiveToken] = useState<typeof DEFAULT_TOKEN_LIST[0] | null>(null);
    const [incentiveAmount, setIncentiveAmount] = useState('');
    const [isAddingIncentive, setIsAddingIncentive] = useState(false);
    const [incentiveTokenSearch, setIncentiveTokenSearch] = useState('');

    // Hooks
    const {
        positions,
        veNFTCount,
        createLock,
        increaseAmount,
        extendLock,
        withdraw,
        claimRebases,
        merge,
        lockPermanent,
        unlockPermanent,
        isLoading,
        error,
        refetch,
    } = useVeWIND();


    const {
        gauges,
        totalWeight,
        poolCount,
        isLoading: isLoadingGauges,
        error: voterError,
        vote: castVote,
        resetVotes,
        refetch: refetchGauges,
        existingVotes,
        fetchExistingVotes,
        addIncentive,
    } = useVoter();

    const { activePeriod, epochCount } = usePoolData();

    const { balance: windBalance, raw: rawWindBalance, formatted: formattedWindBalance } = useTokenBalance(WIND);
    const { balance: incentiveTokenBalance, formatted: incentiveTokenBalanceFormatted } = useTokenBalance(incentiveToken ?? undefined);

    // Calculate epoch times
    const epochStartDate = activePeriod ? new Date(Number(activePeriod) * 1000) : null;
    const epochEndDate = activePeriod ? new Date((Number(activePeriod) + TIME.SECONDS_PER_WEEK) * 1000) : null;
    const timeUntilNextEpoch = activePeriod ? Math.max(0, Number(activePeriod) + TIME.SECONDS_PER_WEEK - Math.floor(Date.now() / 1000)) : 0;
    const daysRemaining = Math.floor(timeUntilNextEpoch / TIME.SECONDS_PER_DAY);
    const hoursRemaining = Math.floor((timeUntilNextEpoch % TIME.SECONDS_PER_DAY) / TIME.SECONDS_PER_HOUR);
    const epochHasEnded = timeUntilNextEpoch === 0;

    // Read voter pool count for distribute
    const { data: voterPoolCount } = useReadContract({
        address: V2_CONTRACTS.Voter as Address,
        abi: VOTER_DISTRIBUTE_ABI,
        functionName: 'length',
    });

    // Distribute state
    const [isDistributing, setIsDistributing] = useState(false);
    const { writeContractAsync } = useWriteContract();


    // Claimable voting rewards state: { tokenId: { gaugePool: { token: amount } } }
    const [votingRewards, setVotingRewards] = useState<Record<string, Record<string, Record<string, bigint>>>>({});
    const [isLoadingVotingRewards, setIsLoadingVotingRewards] = useState(false);

    // Epoch bribes: { gaugeId: bribe[] }
    type EpochBribe = { gauge: { id: string }; token: { id: string; symbol: string; decimals: number }; totalAmount: string; totalAmountUSD: string };
    const [epochBribes, setEpochBribes] = useState<Record<string, EpochBribe[]>>({});

    // Vote status from subgraph veVotes (more reliable than hasVoted)
    const [veNftHasVotes, setVeNftHasVotes] = useState<Record<string, boolean>>({});

    const positionsTokenIdsKey = useMemo(() => {
        if (!positions || positions.length === 0) return '';
        return positions
            .map(p => p.tokenId.toString())
            .sort()
            .join('|');
    }, [positions]);

    const rewardsFetchRef = useRef<{ lastKey: string; lastTs: number; inFlight: boolean }>({
        lastKey: '',
        lastTs: 0,
        inFlight: false,
    });

    const voteStatusFetchRef = useRef<{ lastKey: string; lastTs: number; inFlight: boolean }>({
        lastKey: '',
        lastTs: 0,
        inFlight: false,
    });

    // Fetch claimable voting rewards for all veNFTs using on-chain earned() calls
    // Note: VotingRewardBalance in subgraph tracks CLAIMED rewards, not pending ones
    // We must call earned(token, tokenId) on fee/bribe reward contracts to get pending
    const fetchVotingRewards = useCallback(async () => {
        if (positions.length === 0) return;
        if (!address) return;
        if (gauges.length === 0) return;

        const FIVE_MINUTES = 5 * 60 * 1000;
        const key = `${address.toLowerCase()}|${positionsTokenIdsKey}|${gauges.length}`;
        const now = Date.now();

        if (rewardsFetchRef.current.inFlight) return;
        if (rewardsFetchRef.current.lastKey === key && now - rewardsFetchRef.current.lastTs < FIVE_MINUTES) return;

        setIsLoadingVotingRewards(true);
        rewardsFetchRef.current.inFlight = true;
        try {
            // Step 1: Get active votes for each veNFT to know which pools they voted for
            const tokenIds = positions.map(p => p.tokenId.toString());
            const votesQuery = `query VeVotesForRewards($tokenIds: [ID!]) {
                veVotes(where: { veNFT_in: $tokenIds, isActive: true }, first: 1000) {
                    veNFT { id }
                    pool { id token0 { id decimals } token1 { id decimals } }
                }
            }`;

            const votesRes = await fetch(SUBGRAPH_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: votesQuery, variables: { tokenIds } }),
            });
            const votesJson = await readSubgraphJson(votesRes, 'veVotes(for rewards)') as any;
            if (votesJson.errors) throw new Error(votesJson.errors[0]?.message || 'Subgraph error');

            const veVotes: Array<{
                veNFT: { id: string };
                pool: { id: string; token0: { id: string; decimals: number }; token1: { id: string; decimals: number } };
            }> = votesJson.data?.veVotes || [];

            if (veVotes.length === 0) {
                setVotingRewards({});
                rewardsFetchRef.current.lastKey = key;
                rewardsFetchRef.current.lastTs = now;
                return;
            }

            // Step 2: Build list of (tokenId, feeRewardContract, token, decimals) to call earned()
            type EarnedCall = {
                veNFTId: string;
                poolId: string;
                feeReward: string;
                token: string;
                decimals: number;
            };
            const calls: EarnedCall[] = [];

            for (const vote of veVotes) {
                const poolId = vote.pool?.id?.toLowerCase();
                if (!poolId) continue;

                // Find gauge for this pool to get feeReward address
                const gauge = gauges.find(g => g.pool.toLowerCase() === poolId);
                if (!gauge || !gauge.feeReward || gauge.feeReward === '0x0000000000000000000000000000000000000000') continue;

                const veNFTId = vote.veNFT?.id;
                if (!veNFTId) continue;

                // Add calls for token0 and token1
                if (vote.pool.token0?.id) {
                    calls.push({
                        veNFTId,
                        poolId,
                        feeReward: gauge.feeReward,
                        token: vote.pool.token0.id,
                        decimals: vote.pool.token0.decimals || 18,
                    });
                }
                if (vote.pool.token1?.id) {
                    calls.push({
                        veNFTId,
                        poolId,
                        feeReward: gauge.feeReward,
                        token: vote.pool.token1.id,
                        decimals: vote.pool.token1.decimals || 18,
                    });
                }
            }

            if (calls.length === 0) {
                setVotingRewards({});
                rewardsFetchRef.current.lastKey = key;
                rewardsFetchRef.current.lastTs = now;
                return;
            }

            // Step 3: Call earned() on-chain for each (token, tokenId)
            const rpc = getRpcForVoting();
            const results = await Promise.all(calls.map(async (c, i) => {
                try {
                    const data = encodeFunctionData({
                        abi: FEE_REWARD_ABI,
                        functionName: 'earned',
                        args: [c.token as Address, BigInt(c.veNFTId)],
                    });

                    const result = await rpcCall<string>(
                        'eth_call',
                        [{ to: c.feeReward, data }, 'latest'],
                        rpc
                    );

                    if (!result || result === '0x') return { ...c, earned: BigInt(0) };

                    const resultHex = result as `0x${string}`;

                    const decoded = decodeFunctionResult({
                        abi: FEE_REWARD_ABI,
                        functionName: 'earned',
                        data: resultHex,
                    });

                    return { ...c, earned: decoded as bigint };
                } catch {
                    return { ...c, earned: BigInt(0) };
                }
            }));

            // Step 4: Aggregate results into votingRewards structure
            const newRewards: Record<string, Record<string, Record<string, bigint>>> = {};

            for (const r of results) {
                if (r.earned <= BigInt(0)) continue;

                const tokenId = r.veNFTId;
                const poolId = r.poolId.toLowerCase();
                const tokenAddr = r.token.toLowerCase();

                if (!newRewards[tokenId]) newRewards[tokenId] = {};
                if (!newRewards[tokenId][poolId]) newRewards[tokenId][poolId] = {};
                newRewards[tokenId][poolId][tokenAddr] = r.earned;
            }

            setVotingRewards(newRewards);

            rewardsFetchRef.current.lastKey = key;
            rewardsFetchRef.current.lastTs = now;
        } catch (err) {
            console.error('Error fetching voting rewards (on-chain earned):', err);
        } finally {
            rewardsFetchRef.current.inFlight = false;
            setIsLoadingVotingRewards(false);
        }
    }, [positions, address, positionsTokenIdsKey, gauges]);


    const fetchVeNftVoteStatus = useCallback(async () => {
        if (positions.length === 0) {
            setVeNftHasVotes({});
            return;
        }

        const FIVE_MINUTES = 5 * 60 * 1000;
        const key = positionsTokenIdsKey;
        const now = Date.now();

        if (voteStatusFetchRef.current.inFlight) return;
        if (voteStatusFetchRef.current.lastKey === key && now - voteStatusFetchRef.current.lastTs < FIVE_MINUTES) return;

        voteStatusFetchRef.current.inFlight = true;

        try {
            const tokenIds = positions.map(p => p.tokenId.toString());
            const query = `query VeVoteStatus($tokenIds: [ID!]) {
                veVotes(where: { veNFT_in: $tokenIds, isActive: true }, orderBy: epoch, orderDirection: desc, first: 1000) {
                    epoch
                    veNFT { id }
                }
            }`;

            const response = await fetch(SUBGRAPH_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, variables: { tokenIds } }),
            });
            const json = await readSubgraphJson(response, 'veVotes(vote status)') as any;
            if (json.errors) throw new Error(json.errors[0]?.message || 'Subgraph error');

            const rows: Array<any> = json.data?.veVotes || [];
            const next: Record<string, boolean> = {};
            for (const p of positions) next[p.tokenId.toString()] = false;

            // Mark true if there is at least one active vote row for the veNFT.
            for (const r of rows) {
                const tid = String(r.veNFT?.id || '');
                if (!tid) continue;
                next[tid] = true;
            }

            setVeNftHasVotes(next);

            voteStatusFetchRef.current.lastKey = key;
            voteStatusFetchRef.current.lastTs = now;
        } catch (err) {
            console.error('Error fetching veNFT vote status (subgraph):', err);
        } finally {
            voteStatusFetchRef.current.inFlight = false;
        }
    }, [positions, positionsTokenIdsKey]);

    // Fetch voting rewards when positions or gauges change
    useEffect(() => {
        fetchVotingRewards();
    }, [fetchVotingRewards]);

    useEffect(() => {
        fetchVeNftVoteStatus();
    }, [fetchVeNftVoteStatus]);

    // Fetch epoch bribes from subgraph for current epoch
    useEffect(() => {
        if (!activePeriod) return;
        const epoch = activePeriod.toString();
        const query = `{
            gaugeEpochBribes(where: { epoch: "${epoch}" }, first: 100) {
                gauge { id }
                epoch
                token { id symbol decimals }
                totalAmount
                totalAmountUSD
            }
        }`;
        fetch(SUBGRAPH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query }),
        })
            .then(r => r.json())
            .then(result => {
                const bribes: EpochBribe[] = result?.data?.gaugeEpochBribes || [];
                const byGauge: Record<string, EpochBribe[]> = {};
                for (const b of bribes) {
                    const gId = b.gauge.id.toLowerCase();
                    if (!byGauge[gId]) byGauge[gId] = [];
                    byGauge[gId].push(b);
                }
                setEpochBribes(byGauge);
            })
            .catch(() => {/* silent */});
    }, [activePeriod]);

    // Claim voting rewards for a specific veNFT and gauge
    const [isClaimingVotingRewards, setIsClaimingVotingRewards] = useState<string | null>(null);
    const handleClaimVotingRewards = async (tokenId: bigint, feeRewardAddress: Address, tokens: Address[]) => {
        const claimKey = `${tokenId}-${feeRewardAddress}`;
        setIsClaimingVotingRewards(claimKey);
        try {
            const hash = await writeContractAsync({
                address: feeRewardAddress,
                abi: FEE_REWARD_ABI,
                functionName: 'getReward',
                args: [tokenId, tokens],
            });
            setTxHash(hash);
            // Refetch voting rewards after claiming
            setTimeout(() => fetchVotingRewards(), 3000);
        } catch (err: unknown) {
            console.error('Claim voting rewards failed:', err);
        }
        setIsClaimingVotingRewards(null);
    };

    // Handle distribute rewards (anyone can call this!) - batch in groups of 10 to avoid gas limits
    const handleDistributeRewards = async () => {
        if (!voterPoolCount || Number(voterPoolCount) === 0) return;
        setIsDistributing(true);

        const totalPools = Number(voterPoolCount);
        const batchSize = 2;

        try {
            for (let start = 0; start < totalPools; start += batchSize) {
                const end = Math.min(start + batchSize, totalPools);
                console.log(`Distributing pools ${start} to ${end - 1}...`);

                const hash = await writeContractAsync({
                    address: V2_CONTRACTS.Voter as Address,
                    abi: VOTER_DISTRIBUTE_ABI,
                    functionName: 'distribute',
                    args: [BigInt(start), BigInt(end)],
                });
                setTxHash(hash);

                // Brief pause between batches
                if (end < totalPools) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        } catch (err: unknown) {
            console.error('Distribute failed:', err);
        }
        setIsDistributing(false);
    };

    // Auto-select first veNFT when positions load
    useEffect(() => {
        if (positions.length > 0 && selectedVeNFT === null) {
            setSelectedVeNFT(positions[0].tokenId);
        }
    }, [positions, selectedVeNFT]);

    // Fetch existing votes when veNFT is selected
    useEffect(() => {
        if (selectedVeNFT && gauges.length > 0) {
            fetchExistingVotes(selectedVeNFT);
        }
    }, [selectedVeNFT, gauges.length, fetchExistingVotes]);

    // Calculate estimated voting power
    const estimatedVotingPower = lockAmount && parseFloat(lockAmount) > 0
        ? (parseFloat(lockAmount) * LOCK_DURATIONS[lockDuration] / LOCK_DURATIONS['4Y']).toFixed(4)
        : '0';

    // Calculate unlock date
    const unlockDate = new Date(Date.now() + LOCK_DURATIONS[lockDuration] * 1000);

    // Calculate total claimable
    const totalClaimable = positions.reduce((acc, p) => acc + p.claimable, BigInt(0));

    // Calculate total vote weight (relative)
    const totalVoteWeight = Object.values(voteWeights).reduce((acc, w) => acc + w, 0);

    // Get selected veNFT's voting power
    const selectedPosition = positions.find(p => p.tokenId === selectedVeNFT);
    const selectedVotingPower = selectedPosition ? parseFloat(formatUnits(selectedPosition.votingPower, 18)) : 0;

    // Calculate actual voting power per pool based on weights
    const getActualVotePower = (poolWeight: number) => {
        if (totalVoteWeight === 0 || poolWeight === 0) return 0;
        return (selectedVotingPower * poolWeight / totalVoteWeight);
    };

    // Determine current step for step indicator
    const getCurrentStep = () => {
        if (positions.length === 0) return 0; // Lock step
        if (gauges.length > 0) return 1; // Vote step
        return 2; // Earn step
    };

    const handleCreateLock = async () => {
        if (!lockAmount || parseFloat(lockAmount) <= 0) return;
        const result = await createLock(lockAmount, LOCK_DURATIONS[lockDuration]);
        if (result) {
            setTxHash(result.hash);
            setLockAmount('');
        }
    };

    const handleWithdraw = async (tokenId: bigint) => {
        const result = await withdraw(tokenId);
        if (result) setTxHash(result.hash);
    };

    const handleClaimRebases = async (tokenId: bigint) => {
        const result = await claimRebases(tokenId);
        if (result) setTxHash(result.hash);
    };

    const handleIncreaseAmount = async (tokenId: bigint) => {
        if (!increaseAmountValue || parseFloat(increaseAmountValue) <= 0) return;
        // Use raw balance for full precision when MAX was clicked
        const amountToAdd = isMaxAmount ? (rawWindBalance || increaseAmountValue) : increaseAmountValue;
        const result = await increaseAmount(tokenId, amountToAdd);
        if (result) {
            setTxHash(result.hash);
            setIncreaseAmountValue('');
            setIsMaxAmount(false);
            setManagingNFT(null);
        }
    };

    const handleExtendLock = async (tokenId: bigint) => {
        const result = await extendLock(tokenId, LOCK_DURATIONS[extendDuration]);
        if (result) {
            setTxHash(result.hash);
            setManagingNFT(null);
        }
    };

    const handleMaxLock = async (tokenId: bigint) => {
        // Max lock is 4 years
        const result = await extendLock(tokenId, LOCK_DURATIONS['4Y']);
        if (result) {
            setTxHash(result.hash);
        }
    };

    const handleMerge = async (fromTokenId: bigint, toTokenId: bigint) => {
        const result = await merge(fromTokenId, toTokenId);
        if (result) {
            setTxHash(result.hash);
            setMergeTarget(null);
            setManagingNFT(null);
        }
    };

    const handleLockPermanent = async (tokenId: bigint) => {
        const result = await lockPermanent(tokenId);
        if (result) {
            setTxHash(result.hash);
            setManagingNFT(null);
        }
    };

    const handleUnlockPermanent = async (tokenId: bigint) => {
        const result = await unlockPermanent(tokenId);
        if (result) {
            setTxHash(result.hash);
            setManagingNFT(null);
        }
    };

    const handleVote = async () => {
        if (!selectedVeNFT || totalVoteWeight === 0) return;
        setIsVoting(true);
        const poolVotes = Object.entries(voteWeights)
            .filter(([_, weight]) => weight > 0)
            .map(([pool, weight]) => ({ pool: pool as Address, weight }));

        const result = await castVote(selectedVeNFT, poolVotes);
        if (result) {
            setTxHash(result.hash);
            setVoteWeights({});
        }
        setIsVoting(false);
    };

    const handleResetVotes = async (tokenId?: bigint) => {
        const targetTokenId = tokenId || selectedVeNFT;
        if (!targetTokenId) return;
        setIsVoting(true);
        const result = await resetVotes(targetTokenId);
        if (result) {
            setTxHash(result.hash);
            // Refetch veNFT data to update hasVoted status
            refetch();
        }
        setIsVoting(false);
    };

    const updateVoteWeight = (pool: string, weight: number) => {
        setVoteWeights(prev => ({
            ...prev,
            [pool]: Math.max(0, weight),
        }));
    };

    // Vote for all pools evenly - uses equal weights (contract normalizes them)
    const handleVoteForAll = () => {
        const activeGauges = gauges.filter(g => g.gauge && g.isAlive);
        if (activeGauges.length === 0) return;

        // Use equal weight (1) for each pool - contract will normalize to equal percentage
        const newWeights: Record<string, number> = {};
        activeGauges.forEach((gauge) => {
            newWeights[gauge.pool] = 1; // Equal weight = equal share
        });

        console.log('Vote All - distributing to', activeGauges.length, 'pools with equal weight');
        setVoteWeights(newWeights);
    };

    const handleAddIncentive = async () => {
        if (!incentivePool || !incentiveToken || !incentiveAmount || parseFloat(incentiveAmount) <= 0) return;
        setIsAddingIncentive(true);
        try {
            const result = await addIncentive(
                incentivePool.pool,
                incentiveToken.address,
                incentiveAmount,
                incentiveToken.decimals
            );
            if (result) {
                setTxHash(result.hash);
                setIncentivePool(null);
                setIncentiveToken(null);
                setIncentiveAmount('');
            }
        } catch (err: unknown) {
            console.error('Add incentive failed:', err);
        }
        setIsAddingIncentive(false);
    };

    const tabConfig = [
        { key: 'lock' as const, label: 'Lock WIND', icon: '', description: 'Get voting power' },
        { key: 'vote' as const, label: 'Vote', icon: '', description: 'Choose pools' },
        { key: 'rewards' as const, label: 'Rewards', icon: '', description: 'Claim earnings' },
    ];

    // Filter and sort gauges
    const sortedGauges = [...gauges]
        .filter(gauge => {
            if (!gaugeSearchQuery) return true;
            const query = gaugeSearchQuery.toLowerCase();
            return (
                gauge.symbol0.toLowerCase().includes(query) ||
                gauge.symbol1.toLowerCase().includes(query) ||
                gauge.pool.toLowerCase().includes(query)
            );
        })
        .sort((a, b) => {
            // 1. Pools user voted on come first
            const aVoted = existingVotes[a.pool.toLowerCase()] && existingVotes[a.pool.toLowerCase()] > BigInt(0) ? 1 : 0;
            const bVoted = existingVotes[b.pool.toLowerCase()] && existingVotes[b.pool.toLowerCase()] > BigInt(0) ? 1 : 0;
            if (bVoted !== aVoted) return bVoted - aVoted;

            // 2. Sort by user preference
            if (gaugeSortBy === 'rewards') {
                const aRewards = a.rewardTokens?.reduce((sum, r) => sum + Number(formatUnits(r.amount, r.decimals)), 0) || 0;
                const bRewards = b.rewardTokens?.reduce((sum, r) => sum + Number(formatUnits(r.amount, r.decimals)), 0) || 0;
                if (bRewards !== aRewards) return bRewards - aRewards;
            } else if (gaugeSortBy === 'votes') {
                const aWeight = Number(a.weight || 0);
                const bWeight = Number(b.weight || 0);
                if (bWeight !== aWeight) return bWeight - aWeight;
            }

            // 3. Active gauges first, then alive gauges
            if (a.gauge && !b.gauge) return -1;
            if (!a.gauge && b.gauge) return 1;
            if (a.isAlive && !b.isAlive) return -1;
            if (!a.isAlive && b.isAlive) return 1;

            // 4. Lower fee pools first (V2 Stable < V2 Volatile < CL)
            const feeRank = (g: typeof a) => {
                if (g.poolType === 'V2' && g.isStable) return 0;
                if (g.poolType === 'V2') return 1;
                return 2; // CL
            };
            return feeRank(a) - feeRank(b);
        });

    return (
        <div className="container mx-auto px-3 sm:px-6 py-4">
            {/* Page Header - Compact */}
            <motion.div
                className="mb-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <h1 className="text-xl sm:text-2xl font-bold">
                    <span className="gradient-text">Vote</span> & Earn
                </h1>
                <p className="text-xs sm:text-sm text-gray-400">
                    Lock WIND → Vote → Earn rewards
                </p>
            </motion.div>

            {/* Visual Step Flow - hidden on mobile */}
            <div className="hidden md:block mb-8">
                <div className="glass-card p-6">
                    <LockVoteEarnSteps currentStep={getCurrentStep()} />
                </div>
            </div>

            {/* Epoch Info Banner */}
            <div
                className={`mb-3 p-2.5 sm:p-3 rounded-xl border ${epochHasEnded
                    ? 'bg-green-500/5 border-green-500/20'
                    : 'bg-blue-500/5 border-blue-500/20'}`}
            >
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className={`text-xs font-bold ${epochHasEnded ? 'text-green-400' : 'text-blue-400'}`}>
                            Epoch {epochCount !== undefined ? epochCount.toString() : '...'}
                        </div>
                        <span className="text-gray-600">&middot;</span>
                        <div className="hidden sm:flex items-center gap-2 text-[10px] text-gray-400">
                            <span>{epochStartDate ? epochStartDate.toLocaleDateString() : '...'}</span>
                            <span>-</span>
                            <span>{epochEndDate ? epochEndDate.toLocaleDateString() : '...'}</span>
                        </div>
                    </div>
                    {epochHasEnded ? (
                        <button
                            onClick={handleDistributeRewards}
                            disabled={isDistributing || !voterPoolCount || Number(voterPoolCount) === 0}
                            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 text-white text-[10px] sm:text-xs font-bold hover:opacity-90 transition disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0"
                        >
                            {isDistributing ? (
                                <>
                                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span className="hidden sm:inline">Distributing...</span>
                                    <span className="sm:hidden">...</span>
                                </>
                            ) : (
                                'Distribute'
                            )}
                        </button>
                    ) : (
                        <div className="text-xs font-bold text-blue-400 flex-shrink-0">
                            {daysRemaining}d {hoursRemaining}h left
                        </div>
                    )}
                </div>
                {epochHasEnded && (
                    <div className="mt-1.5 pt-1.5 border-t border-white/10 text-[10px] text-gray-500">
                        Epoch ended - anyone can trigger reward distribution.
                    </div>
                )}
            </div>


            {/* Stats Row - Compact */}

            <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="glass-card p-2 sm:p-3 text-center">
                    <div className="text-[10px] text-gray-400">WIND Balance</div>
                    <div className="text-sm sm:text-lg font-bold">{formattedWindBalance || '0'}</div>
                </div>
                <div className="glass-card p-2 sm:p-3 text-center">
                    <div className="text-[10px] text-gray-400">veNFTs</div>
                    <div className="text-sm sm:text-lg font-bold">{veNFTCount}</div>
                </div>
                <div className="glass-card p-2 sm:p-3 text-center bg-green-500/10">
                    <div className="text-[10px] text-gray-400">Claimable</div>
                    <div className="text-sm sm:text-lg font-bold text-green-400">
                        {parseFloat(formatUnits(totalClaimable, 18)).toFixed(2)}
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1.5 mb-3">
                {tabConfig.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex-1 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition border ${activeTab === tab.key
                            ? 'bg-gradient-to-r from-primary to-secondary text-white border-primary/50'
                            : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
                            }`}
                    >
                        {tab.key === 'lock' ? 'Lock' : tab.key === 'vote' ? 'Vote' : 'Rewards'}
                    </button>
                ))}
            </div>


            {/* Error Display */}
            {error && (
                <div className="mb-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs text-center flex items-center gap-2 justify-center">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {error}
                </div>
            )}

            {/* Success Display */}
            {txHash && (
                <div className="mb-4 p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm max-w-md mx-auto text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Transaction submitted!
                    </div>
                    <a href={`https://basescan.org/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="underline text-xs">
                        View on Etherscan
                    </a>
                </div>
            )}

            {/* Lock Tab */}
            {activeTab === 'lock' && (
                <div>
                    <div className="glass-card p-3 sm:p-4">
                        {/* Amount Input */}
                        <div className="mb-3">
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-xs text-gray-400">Amount</label>
                                <span className="text-[10px] text-gray-400">Bal: {formattedWindBalance || '0'}</span>
                            </div>
                            <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={lockAmount}
                                        onChange={(e) => setLockAmount(e.target.value)}
                                        placeholder="0.0"
                                        className="flex-1 min-w-0 bg-transparent text-xl font-bold outline-none placeholder-gray-600"
                                    />
                                    <button
                                        onClick={() => setLockAmount(rawWindBalance || '0')}
                                        className="px-2 py-1 text-[10px] font-medium rounded bg-white/10 hover:bg-white/20 text-primary"
                                    >
                                        MAX
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Duration Selection */}
                        <div className="mb-3">
                            <label className="text-xs text-gray-400 mb-2 block">Lock Duration</label>
                            <div className="grid grid-cols-4 gap-2">
                                {(['1M', '6M', '1Y', '4Y'] as const).map((duration) => (
                                    <button
                                        key={duration}
                                        onClick={() => setLockDuration(duration)}
                                        className={`py-3 px-2 rounded-xl text-sm font-bold transition-all duration-200 border-2 ${lockDuration === duration
                                            ? 'bg-gradient-to-r from-primary to-secondary text-white border-primary shadow-lg shadow-primary/30 scale-105'
                                            : 'bg-white/5 hover:bg-white/10 text-gray-300 border-white/10 hover:border-primary/50 hover:text-white'
                                            }`}
                                    >
                                        {duration}
                                    </button>
                                ))}
                            </div>
                        </div>



                        {/* Preview - Inline */}
                        <div className="flex items-center justify-between text-xs mb-3 p-2 rounded-lg bg-gradient-to-r from-primary/10 to-secondary/10">
                            <div>
                                <span className="text-gray-400">You get: </span>
                                <span className="font-bold text-primary">{estimatedVotingPower} veWIND</span>
                            </div>
                            <div className="text-gray-400">
                                Unlocks {unlockDate.toLocaleDateString()}
                            </div>
                        </div>

                        {/* Lock Button */}
                        <button
                            onClick={handleCreateLock}
                            disabled={!isConnected || isLoading || !lockAmount || parseFloat(lockAmount) <= 0}
                            className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-primary to-secondary text-white disabled:opacity-50"
                        >
                            {isLoading ? 'Locking...' : !isConnected ? 'Connect Wallet' : 'Lock WIND'}
                        </button>
                    </div>

                    {/* Existing Positions - Redesigned */}
                    {positions.length > 0 && (
                        <div className="glass-card p-3 sm:p-4 mt-3">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-semibold">Your veNFTs</h3>
                                <span className="text-xs text-gray-400 bg-white/5 px-2 py-1 rounded-full">{positions.length} position{positions.length > 1 ? 's' : ''}</span>
                            </div>
                            <div className="space-y-4">
                                {positions.map((position) => {
                                    const isExpired = position.end < BigInt(Math.floor(Date.now() / 1000)) && !position.isPermanent;
                                    const endDate = new Date(Number(position.end) * 1000);
                                    const isManaging = managingNFT === position.tokenId;

                                    return (
                                        <div key={position.tokenId.toString()} className={`rounded-xl border transition-all ${isManaging ? 'bg-white/5 border-primary/50' : 'bg-white/3 border-white/10'}`}>
                                            {/* Main Card Header */}
                                            <div
                                                className="p-4 cursor-pointer"
                                                onClick={() => {
                                                    if (isManaging) {
                                                        setManagingNFT(null);
                                                        setActiveAction(null);
                                                    } else {
                                                        setManagingNFT(position.tokenId);
                                                        setActiveAction(null);
                                                    }
                                                }}
                                            >
                                                <div className="flex items-center justify-between">
                                                    {/* Left: NFT Info */}
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-sm">
                                                            #{position.tokenId.toString()}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold">{parseFloat(formatUnits(position.amount, 18)).toLocaleString()} WIND</div>
                                                            <div className="text-xs text-gray-400">
                                                                {position.isPermanent ? (
                                                                    <span className="text-amber-400">Permanent Lock</span>
                                                                ) : isExpired ? (
                                                                    <span className="text-yellow-400">Unlocked - Ready to withdraw</span>
                                                                ) : (
                                                                    <span>Unlocks {endDate.toLocaleDateString()}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Right: Voting Power & Toggle */}
                                                    <div className="flex items-center gap-3">
                                                        <div className="text-right">
                                                            <div className="font-bold text-primary">{parseFloat(formatUnits(position.votingPower, 18)).toLocaleString()}</div>
                                                            <div className="text-[10px] text-gray-400">veWIND</div>
                                                        </div>
                                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${isManaging ? 'bg-primary text-white rotate-180' : 'bg-white/10 text-gray-400'}`}>
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                            </svg>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Expanded Management Panel */}
                                            {isManaging && (
                                                <div className="border-t border-white/10">
                                                    {/* Quick Actions for Expired */}
                                                    {isExpired ? (
                                                        <div className="p-4">
                                                            <button
                                                                onClick={() => handleWithdraw(position.tokenId)}
                                                                className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-yellow-500 to-orange-500 text-white hover:opacity-90 transition"
                                                            >
                                                                Withdraw {parseFloat(formatUnits(position.amount, 18)).toLocaleString()} WIND
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            {/* Action Tabs */}
                                                            <div className="flex border-b border-white/10">
                                                                <button
                                                                    onClick={() => setActiveAction(activeAction === 'add' ? null : 'add')}
                                                                    className={`flex-1 py-2.5 text-xs font-medium transition-all ${activeAction === 'add' ? 'bg-green-500/20 text-green-400 border-b-2 border-green-400' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                                                >
                                                                    + Add WIND
                                                                </button>
                                                                {!position.isPermanent && (
                                                                    <button
                                                                        onClick={() => setActiveAction(activeAction === 'extend' ? null : 'extend')}
                                                                        className={`flex-1 py-2.5 text-xs font-medium transition-all ${activeAction === 'extend' ? 'bg-blue-500/20 text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                                                    >
                                                                        ⏰ Extend
                                                                    </button>
                                                                )}
                                                                {positions.length > 1 && (
                                                                    <button
                                                                        onClick={() => setActiveAction(activeAction === 'merge' ? null : 'merge')}
                                                                        className={`flex-1 py-2.5 text-xs font-medium transition-all ${activeAction === 'merge' ? 'bg-purple-500/20 text-purple-400 border-b-2 border-purple-400' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                                                    >
                                                                        Merge
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => setActiveAction(activeAction === 'permanent' ? null : 'permanent')}
                                                                    className={`flex-1 py-2.5 text-xs font-medium transition-all ${activeAction === 'permanent' ? 'bg-amber-500/20 text-amber-400 border-b-2 border-amber-400' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                                                >
                                                                    {position.isPermanent ? 'Unlock' : 'Permanent'}
                                                                </button>
                                                            </div>

                                                            {/* Action Content */}
                                                            <div className="p-4">
                                                                {/* Add WIND */}
                                                                {activeAction === 'add' && (
                                                                    <div className="space-y-3">
                                                                        <div className="text-xs text-gray-400">Add more WIND to increase your voting power</div>
                                                                        <div className="flex gap-2">
                                                                            <div className="flex-1 flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10">
                                                                                <input
                                                                                    type="text"
                                                                                    value={increaseAmountValue}
                                                                                    onChange={(e) => {
                                                                                        // Allow numeric input with decimals
                                                                                        const val = e.target.value;
                                                                                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                                                            setIncreaseAmountValue(val);
                                                                                            setIsMaxAmount(false); // Reset when user types manually
                                                                                        }
                                                                                    }}
                                                                                    placeholder="0.0"
                                                                                    className="flex-1 min-w-0 bg-transparent text-lg font-bold outline-none placeholder-gray-600"
                                                                                />
                                                                                <button
                                                                                    onClick={() => {
                                                                                        setIncreaseAmountValue(formattedWindBalance || '0');
                                                                                        setIsMaxAmount(true); // Track that MAX was clicked
                                                                                    }}
                                                                                    className="px-3 py-1 text-xs font-medium rounded-lg bg-primary/20 text-primary hover:bg-primary/30"
                                                                                >
                                                                                    MAX
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                        <div className="text-xs text-gray-500">Balance: {formattedWindBalance} WIND</div>
                                                                        <button
                                                                            onClick={() => handleIncreaseAmount(position.tokenId)}
                                                                            disabled={isLoading || !increaseAmountValue || parseFloat(increaseAmountValue) <= 0}
                                                                            className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-green-500 to-emerald-500 text-white disabled:opacity-50"
                                                                        >
                                                                            {isLoading ? 'Processing...' : `Add ${parseFloat(increaseAmountValue || '0').toLocaleString(undefined, { maximumFractionDigits: 4 })} WIND`}
                                                                        </button>
                                                                    </div>
                                                                )}

                                                                {/* Extend Lock */}
                                                                {activeAction === 'extend' && !position.isPermanent && (
                                                                    <div className="space-y-3">
                                                                        <div className="text-xs text-gray-400">Extend your lock duration to increase voting power</div>
                                                                        <div className="grid grid-cols-4 gap-2">
                                                                            {(['1M', '3M', '1Y', '4Y'] as const).map((duration) => (
                                                                                <button
                                                                                    key={duration}
                                                                                    onClick={() => setExtendDuration(duration)}
                                                                                    className={`py-3 rounded-xl text-sm font-bold transition-all ${extendDuration === duration
                                                                                        ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                                                                                        : 'bg-white/5 hover:bg-white/10 text-gray-400'
                                                                                        }`}
                                                                                >
                                                                                    {duration}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                        <button
                                                                            onClick={() => handleExtendLock(position.tokenId)}
                                                                            disabled={isLoading}
                                                                            className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-blue-500 to-cyan-500 text-white disabled:opacity-50"
                                                                        >
                                                                            {isLoading ? 'Processing...' : `Extend to ${extendDuration}`}
                                                                        </button>
                                                                    </div>
                                                                )}

                                                                {/* Merge */}
                                                                {activeAction === 'merge' && positions.length > 1 && (
                                                                    <div className="space-y-3">
                                                                        <div className="text-xs text-gray-400">
                                                                            Combine another veNFT into this one. The merged NFT will be burned.
                                                                        </div>
                                                                        <div className="text-xs font-medium text-white mb-2">Select veNFT to merge:</div>
                                                                        <div className="space-y-2">
                                                                            {positions
                                                                                .filter(p => p.tokenId !== position.tokenId)
                                                                                .map(p => (
                                                                                    <div key={p.tokenId.toString()} className="relative">
                                                                                        <button
                                                                                            onClick={() => !p.hasVoted && setMergeTarget(mergeTarget === p.tokenId ? null : p.tokenId)}
                                                                                            disabled={p.hasVoted}
                                                                                            className={`w-full p-3 rounded-xl flex items-center justify-between transition-all ${mergeTarget === p.tokenId
                                                                                                ? 'bg-purple-500/20 border-2 border-purple-500'
                                                                                                : p.hasVoted
                                                                                                    ? 'bg-red-500/5 border-2 border-red-500/20 opacity-70'
                                                                                                    : 'bg-white/5 border-2 border-transparent hover:bg-white/10'
                                                                                                }`}
                                                                                        >
                                                                                            <div className="flex items-center gap-2">
                                                                                                <div className={`w-8 h-8 rounded-full ${p.hasVoted ? 'bg-red-500/30' : 'bg-purple-500/30'} flex items-center justify-center text-xs font-bold`}>
                                                                                                    #{p.tokenId.toString()}
                                                                                                </div>
                                                                                                <div className="text-left">
                                                                                                    <div className="font-bold text-sm">{parseFloat(formatUnits(p.amount, 18)).toLocaleString()} WIND</div>
                                                                                                    <div className="text-xs text-gray-400">
                                                                                                        {p.isPermanent ? 'Permanent' : new Date(Number(p.end) * 1000).toLocaleDateString()}
                                                                                                    </div>
                                                                                                </div>
                                                                                            </div>
                                                                                            {(veNftHasVotes[p.tokenId.toString()] ?? p.hasVoted) ? (
                                                                                                <div className="text-xs text-red-400">Voted</div>
                                                                                            ) : mergeTarget === p.tokenId ? (
                                                                                                <div className="text-purple-400 text-sm font-bold">Selected</div>
                                                                                            ) : null}
                                                                                        </button>
                                                                                        {(veNftHasVotes[p.tokenId.toString()] ?? p.hasVoted) && (
                                                                                            <button
                                                                                                onClick={(e) => {
                                                                                                    e.stopPropagation();
                                                                                                    handleResetVotes(p.tokenId);
                                                                                                }}
                                                                                                disabled={isVoting}
                                                                                                className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition disabled:opacity-50"
                                                                                            >
                                                                                                {isVoting ? '...' : 'Reset'}
                                                                                            </button>
                                                                                        )}
                                                                                    </div>
                                                                                ))}
                                                                            {positions.filter(p => p.tokenId !== position.tokenId).length === 0 && (
                                                                                <div className="text-xs text-gray-500 text-center py-3">
                                                                                    No other veNFTs to merge with.
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        {mergeTarget && (
                                                                            <button
                                                                                onClick={() => handleMerge(mergeTarget, position.tokenId)}
                                                                                disabled={isLoading}
                                                                                className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-purple-500 to-pink-500 text-white disabled:opacity-50"
                                                                            >
                                                                                {isLoading ? 'Processing...' : `Merge #${mergeTarget.toString()} into #${position.tokenId.toString()}`}
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {/* Permanent Lock / Unlock */}
                                                                {activeAction === 'permanent' && (
                                                                    <div className="space-y-3">
                                                                        {position.hasVoted && (
                                                                            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                                                                                <div className="flex items-center justify-between gap-2">
                                                                                    <div className="text-xs text-red-400">
                                                                                        This veNFT has voted this epoch. Reset votes first to unlock.
                                                                                    </div>
                                                                                    <button
                                                                                        onClick={() => handleResetVotes(position.tokenId)}
                                                                                        disabled={isVoting}
                                                                                        className="px-3 py-1.5 text-xs rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition disabled:opacity-50 whitespace-nowrap"
                                                                                    >
                                                                                        {isVoting ? '...' : 'Reset Votes'}
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                        {position.isPermanent ? (
                                                                            <>
                                                                                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                                                                    <div className="text-xs text-amber-400">
                                                                                        This is a permanent lock with maximum voting power. You can unlock it to a 4-year time lock if you want to eventually withdraw.
                                                                                    </div>
                                                                                </div>
                                                                                <button
                                                                                    onClick={() => handleUnlockPermanent(position.tokenId)}
                                                                                    disabled={isLoading || position.hasVoted}
                                                                                    className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-orange-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                                                                >
                                                                                    {isLoading ? 'Processing...' : position.hasVoted ? 'Reset Votes First' : 'Unlock to 4-Year Lock'}
                                                                                </button>
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                                                                                    <div className="text-xs text-purple-300">
                                                                                        Permanent lock gives you maximum voting power forever. Your tokens will be locked until you unlock (which converts to a 4-year lock).
                                                                                    </div>
                                                                                </div>
                                                                                <button
                                                                                    onClick={() => handleLockPermanent(position.tokenId)}
                                                                                    disabled={isLoading}
                                                                                    className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-purple-500 to-violet-500 text-white disabled:opacity-50"
                                                                                >
                                                                                    {isLoading ? 'Processing...' : 'Lock Permanently'}
                                                                                </button>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {/* No action selected */}
                                                                {!activeAction && (
                                                                    <div className="text-center py-4 text-gray-500 text-sm">
                                                                        Select an action above to manage your veNFT
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                </div>
            )}

            {/* Vote Tab */}
            {
                activeTab === 'vote' && (
                    <div>
                        {!isConnected ? (
                            <EmptyState
                                icon="🔗"
                                title="Connect Your Wallet"
                                description="Connect your wallet to vote on pool rewards"
                            />
                        ) : isLoadingGauges && gauges.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 text-sm">
                                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                                Loading pools...
                            </div>
                        ) : gauges.length === 0 ? (
                            <EmptyState
                                icon=""
                                title="No Pools Available"
                                description="No pools with reward distribution found yet. Check back soon!"
                            />
                        ) : (
                            <>
                                {/* Banner for users without veNFT */}
                                {positions.length === 0 && (
                                    <div className="mb-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-xs text-gray-300">Lock WIND to vote on pools</p>
                                            <button
                                                onClick={() => setActiveTab('lock')}
                                                className="px-3 py-1 text-[10px] rounded bg-primary text-white font-medium"
                                            >
                                                Lock
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* NFT Selector - only show if user has positions */}
                                {positions.length > 0 && (
                                    <div className="glass-card p-3 mb-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-xs text-gray-400">Voting with:</label>
                                        </div>
                                        <div className="flex gap-2 flex-wrap">
                                            {positions.map((pos) => (
                                                <button
                                                    key={pos.tokenId.toString()}
                                                    onClick={() => setSelectedVeNFT(pos.tokenId)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs transition ${selectedVeNFT === pos.tokenId
                                                        ? 'bg-primary text-white'
                                                        : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                                        }`}
                                                >
                                                    #{pos.tokenId.toString()} ({parseFloat(formatUnits(pos.votingPower, 18)).toFixed(0)} veWIND)
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Pools List */}
                                <div className="glass-card overflow-hidden">
                                    <div className="p-3 border-b border-white/5">
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                            <span className="font-semibold text-sm">Pools ({sortedGauges.length}/{gauges.length})</span>

                                            {/* Search and Sort Controls */}
                                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                                <input
                                                    type="text"
                                                    placeholder="Search pools..."
                                                    value={gaugeSearchQuery}
                                                    onChange={(e) => setGaugeSearchQuery(e.target.value)}
                                                    className="flex-1 sm:w-40 px-3 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 focus:border-primary/50 focus:outline-none"
                                                />
                                                <div className="relative">
                                                    <select
                                                        value={gaugeSortBy}
                                                        onChange={(e) => setGaugeSortBy(e.target.value as 'rewards' | 'votes')}
                                                        className="pl-3 pr-7 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 focus:border-primary/50 focus:outline-none cursor-pointer appearance-none"
                                                    >
                                                        <option value="rewards">Rewards</option>
                                                        <option value="votes">Votes</option>
                                                    </select>
                                                    <svg className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </div>
                                                <span className="hidden sm:block text-xs text-gray-400 whitespace-nowrap">
                                                    {parseFloat(formatUnits(totalWeight, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 })} votes
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Loading State */}
                                    {isLoadingGauges && (
                                        <div className="p-6 text-center text-gray-400 text-sm">
                                            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                            Loading...
                                        </div>
                                    )}

                                    {/* Pool Gauge Rows */}
                                    <div className="divide-y divide-white/5">
                                        {sortedGauges.length === 0 ? (
                                            <div className="p-6 text-center">
                                                <p className="text-gray-400 text-sm mb-2">No pools found{gaugeSearchQuery && ` matching "${gaugeSearchQuery}"`}</p>
                                                {gaugeSearchQuery && (
                                                    <button
                                                        onClick={() => setGaugeSearchQuery('')}
                                                        className="text-xs text-primary hover:underline"
                                                    >
                                                        Clear search
                                                    </button>
                                                )}
                                            </div>
                                        ) : sortedGauges.map((gauge) => (
                                            <div key={gauge.pool} className="p-2.5 sm:p-3">
                                                {/* Row 1: Pool info + vote share */}
                                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <div className="relative w-[34px] h-[22px] flex-shrink-0">
                                                            {getTokenLogo(gauge.token0) ? (
                                                                <img src={getTokenLogo(gauge.token0)} alt={gauge.symbol0} className="absolute left-0 w-[22px] h-[22px] rounded-full border border-[var(--bg-primary)]" />
                                                            ) : (
                                                                <div className="absolute left-0 w-[22px] h-[22px] rounded-full bg-primary/30 flex items-center justify-center text-[9px] font-bold border border-[var(--bg-primary)]">
                                                                    {gauge.symbol0.slice(0, 2)}
                                                                </div>
                                                            )}
                                                            {getTokenLogo(gauge.token1) ? (
                                                                <img src={getTokenLogo(gauge.token1)} alt={gauge.symbol1} className="absolute left-[12px] w-[22px] h-[22px] rounded-full border border-[var(--bg-primary)]" />
                                                            ) : (
                                                                <div className="absolute left-[12px] w-[22px] h-[22px] rounded-full bg-secondary/30 flex items-center justify-center text-[9px] font-bold border border-[var(--bg-primary)]">
                                                                    {gauge.symbol1.slice(0, 2)}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="font-bold text-xs sm:text-sm truncate">{gauge.symbol0}/{gauge.symbol1}</span>
                                                                <span className={`text-[9px] px-1 py-0.5 rounded-full ${gauge.poolType === 'CL' ? 'bg-cyan-500/15 text-cyan-400' : 'bg-white/5 text-gray-500'}`}>
                                                                    {gauge.poolType}
                                                                </span>
                                                                {!gauge.isAlive && (
                                                                    <span className="text-[9px] px-1 py-0.5 rounded bg-red-500/20 text-red-400">Off</span>
                                                                )}
                                                            </div>
                                                            {/* Fees + bribes inline */}
                                                            <div className="text-[10px] text-gray-400 mt-0.5 truncate">
                                                                {(() => {
                                                                    const fees = gauge.rewardTokens ?? [];
                                                                    const bribes = epochBribes[gauge.gauge?.toLowerCase() ?? ''] ?? [];
                                                                    const hasFees = fees.length > 0;
                                                                    const hasBribes = bribes.length > 0;
                                                                    if (!hasFees && !hasBribes) return <span className="text-gray-600">No fees yet</span>;
                                                                    return (
                                                                        <span className="text-green-400/80">
                                                                            {fees.map((reward, idx) => (
                                                                                <span key={reward.address}>
                                                                                    {formatBalance(parseFloat(formatUnits(reward.amount, reward.decimals)))} {reward.symbol}
                                                                                    {(idx < fees.length - 1 || hasBribes) && ' + '}
                                                                                </span>
                                                                            ))}
                                                                            {bribes.map((b, i) => (
                                                                                <span key={b.token.id}>
                                                                                    {formatBalance(parseFloat(b.totalAmount))} {b.token.symbol}
                                                                                    {i < bribes.length - 1 && ' + '}
                                                                                </span>
                                                                            ))}
                                                                        </span>
                                                                    );
                                                                })()}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right flex-shrink-0">
                                                        <div className="text-xs font-bold text-primary">{gauge.weightPercent.toFixed(1)}%</div>
                                                    </div>
                                                </div>

                                                {/* Row 2: Vote controls */}
                                                <div className="flex items-center flex-wrap gap-1.5">
                                                    {existingVotes[gauge.pool.toLowerCase()] && existingVotes[gauge.pool.toLowerCase()] > BigInt(0) && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
                                                            Voted
                                                        </span>
                                                    )}

                                                    {!gauge.gauge ? (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                                                            Coming Soon
                                                        </span>
                                                    ) : positions.length > 0 ? (
                                                        <>
                                                            <div className="flex gap-1">
                                                                {[100, 50, 25].map((pct) => (
                                                                    <button
                                                                        key={pct}
                                                                        onClick={() => updateVoteWeight(gauge.pool, pct)}
                                                                        disabled={!selectedVeNFT || !gauge.isAlive}
                                                                        className={`px-2 py-1 text-[10px] rounded transition ${voteWeights[gauge.pool] === pct
                                                                            ? 'bg-primary text-white'
                                                                            : 'bg-white/5 hover:bg-white/10 text-gray-400'
                                                                            } disabled:opacity-40`}
                                                                    >
                                                                        {pct}%
                                                                    </button>
                                                                ))}
                                                            </div>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                placeholder="0"
                                                                value={voteWeights[gauge.pool] || ''}
                                                                onChange={(e) => updateVoteWeight(gauge.pool, parseInt(e.target.value) || 0)}
                                                                disabled={!selectedVeNFT || !gauge.isAlive}
                                                                className="w-10 px-1 py-1 rounded bg-white/5 text-center text-[10px] outline-none disabled:opacity-40 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                                                            />
                                                            {voteWeights[gauge.pool] > 0 && (
                                                                <span className="text-[10px] text-cyan-400">
                                                                    ={getActualVotePower(voteWeights[gauge.pool]).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                                </span>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${gauge.isAlive ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                                            {gauge.isAlive ? 'Active' : 'Inactive'}
                                                        </span>
                                                    )}

                                                    {gauge.gauge && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                setIncentivePool({ pool: gauge.pool, symbol0: gauge.symbol0, symbol1: gauge.symbol1 });
                                                            }}
                                                            className="px-1.5 py-0.5 text-[10px] rounded bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition ml-auto"
                                                        >
                                                            + Incentive
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Vote Summary + Submit */}
                                {positions.length > 0 && (
                                    <div className="sticky bottom-0 p-2.5 sm:p-3 bg-[var(--bg-primary)]/95 backdrop-blur border-t border-primary/20">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="text-[10px] sm:text-xs min-w-0">
                                                <span className="font-bold text-white">{Object.values(voteWeights).filter(w => w > 0).length}</span>
                                                <span className="text-gray-500"> pools</span>
                                                <span className="text-gray-600 mx-1">&middot;</span>
                                                <span className="font-bold text-primary">{selectedVotingPower.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                                <span className="text-gray-500"> veWIND</span>
                                            </div>
                                            <div className="flex gap-1.5 flex-shrink-0">
                                                <button
                                                    onClick={handleVoteForAll}
                                                    disabled={!selectedVeNFT}
                                                    className="px-2.5 py-1.5 text-[10px] rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition disabled:opacity-50"
                                                >
                                                    All
                                                </button>
                                                {selectedVeNFT && (
                                                    <button
                                                        onClick={() => handleResetVotes()}
                                                        disabled={isVoting}
                                                        className="px-2.5 py-1.5 text-[10px] rounded-lg bg-white/10 hover:bg-white/20 transition disabled:opacity-50"
                                                    >
                                                        Reset
                                                    </button>
                                                )}
                                                <button
                                                    onClick={handleVote}
                                                    disabled={!selectedVeNFT || totalVoteWeight === 0 || isVoting}
                                                    className="px-4 py-1.5 text-xs font-bold rounded-lg bg-gradient-to-r from-primary to-secondary text-white disabled:opacity-50"
                                                >
                                                    {isVoting ? '...' : 'Vote'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )
            }

            {/* Rewards Tab */}
            {
                activeTab === 'rewards' && (
                    <div>
                        {!isConnected ? (
                            <div className="glass-card p-4 text-center">
                                <p className="text-sm text-gray-400">Connect wallet to view rewards</p>
                            </div>
                        ) : positions.length === 0 ? (
                            <div className="glass-card p-4 text-center">
                                <p className="text-gray-400 text-sm mb-3">No veNFTs - Lock WIND to earn rewards</p>
                                <button onClick={() => setActiveTab('lock')} className="btn-primary px-4 py-2 text-xs rounded-lg">Lock WIND</button>
                            </div>
                        ) : (
                            <>
                                <div className="glass-card p-3 sm:p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-sm font-semibold">Rebase Rewards</h3>
                                        <span className="text-xs text-gray-400">Protects voting power</span>
                                    </div>
                                    <div className="space-y-2">
                                        {positions.map((position) => (
                                            <div key={position.tokenId.toString()} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10">
                                                <div className="min-w-0">
                                                    <div className="text-xs text-gray-400">#{position.tokenId.toString()}</div>
                                                    <div className="font-bold text-sm text-green-400">
                                                        {parseFloat(formatUnits(position.claimable, 18)).toFixed(4)} WIND
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleClaimRebases(position.tokenId)}
                                                    disabled={isLoading || position.claimable === BigInt(0)}
                                                    className="px-3 py-1.5 text-[10px] font-medium rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition disabled:opacity-40"
                                                >
                                                    Claim
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Voting Fee Rewards - Personal Claimable */}
                                <div className="glass-card p-3 sm:p-4 mt-3">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-sm font-semibold">Voting Rewards</h3>
                                        <span className="text-xs text-gray-400">
                                            {isLoadingVotingRewards ? 'Loading...' : 'Your claimable fees'}
                                        </span>
                                    </div>
                                    {positions.map((position) => {
                                        const tokenIdStr = position.tokenId.toString();
                                        const positionRewards = votingRewards[tokenIdStr] || {};
                                        const hasRewards = Object.keys(positionRewards).some(pool =>
                                            Object.keys(positionRewards[pool] || {}).length > 0
                                        );

                                        if (!hasRewards) return null;

                                        return (
                                            <div key={tokenIdStr} className="mb-3">
                                                <div className="text-xs text-gray-400 mb-2">veNFT #{tokenIdStr}</div>
                                                <div className="space-y-2">
                                                    {Object.entries(positionRewards).map(([poolAddress, tokens]) => {
                                                        if (Object.keys(tokens).length === 0) return null;
                                                        const gauge = gauges.find(g => g.pool === poolAddress);
                                                        if (!gauge) return null;

                                                        return (
                                                            <div key={poolAddress} className="p-2 rounded-lg bg-white/5 border border-white/10">
                                                                <div className="flex items-center justify-between mb-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs font-medium">{gauge.symbol0}/{gauge.symbol1}</span>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => handleClaimVotingRewards(
                                                                            position.tokenId,
                                                                            gauge.feeReward as Address,
                                                                            Object.keys(tokens) as Address[]
                                                                        )}
                                                                        disabled={isClaimingVotingRewards === `${position.tokenId}-${gauge.feeReward}`}
                                                                        className="px-2 py-1 text-[10px] font-medium rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition disabled:opacity-50"
                                                                    >
                                                                        {isClaimingVotingRewards === `${position.tokenId}-${gauge.feeReward}` ? '...' : 'Claim'}
                                                                    </button>
                                                                </div>
                                                                <div className="text-xs text-green-400">
                                                                    {Object.entries(tokens).map(([tokenAddr, amount], idx) => {
                                                                        const token = DEFAULT_TOKEN_LIST.find(t => t.address.toLowerCase() === tokenAddr.toLowerCase());
                                                                        const decimals = token?.decimals || 18;
                                                                        const symbol = token?.symbol || tokenAddr.slice(0, 6);
                                                                        return (
                                                                            <span key={tokenAddr}>
                                                                                {formatBalance(parseFloat(formatUnits(amount, decimals)))} {symbol}
                                                                                {idx < Object.keys(tokens).length - 1 && ' + '}
                                                                            </span>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {!isLoadingVotingRewards && Object.keys(votingRewards).every(tid =>
                                        Object.keys(votingRewards[tid] || {}).every(pool =>
                                            Object.keys(votingRewards[tid][pool] || {}).length === 0
                                        )
                                    ) && (
                                            <div className="text-center text-gray-500 text-xs py-4">
                                                <div className="text-2xl mb-2">📊</div>
                                                <div>No voting rewards to claim yet</div>
                                                <div className="text-[10px] mt-1">Vote for pools to earn trading fees</div>
                                            </div>
                                        )}
                                </div>
                            </>
                        )}
                    </div>
                )
            }

            {/* Incentive Modal */}
            {
                incentivePool && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="glass-card p-4 sm:p-6 max-w-md w-full">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold">Add Incentive</h3>
                                <button
                                    onClick={() => {
                                        setIncentivePool(null);
                                        setIncentiveToken(null);
                                        setIncentiveAmount('');
                                        setIncentiveTokenSearch('');
                                    }}
                                    className="text-gray-400 hover:text-white"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="mb-4 p-3 rounded-lg bg-white/5 border border-white/10">
                                <div className="text-xs text-gray-400 mb-1">Pool</div>
                                <div className="font-semibold">{incentivePool.symbol0}/{incentivePool.symbol1}</div>
                            </div>

                            <div className="mb-4">
                                <label className="text-xs text-gray-400 mb-2 block">Select Token</label>
                                <input
                                    type="text"
                                    placeholder="Search token..."
                                    onChange={(e) => {
                                        const q = e.target.value.toLowerCase();
                                        setIncentiveTokenSearch(q);
                                    }}
                                    className="w-full mb-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs outline-none focus:border-purple-500/50 placeholder-gray-600"
                                />
                                <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                                    {DEFAULT_TOKEN_LIST.filter(t =>
                                        !incentiveTokenSearch ||
                                        t.symbol.toLowerCase().includes(incentiveTokenSearch) ||
                                        t.name.toLowerCase().includes(incentiveTokenSearch)
                                    ).map((token) => (
                                        <button
                                            key={token.address}
                                            onClick={() => setIncentiveToken(token)}
                                            className={`p-2 rounded-lg flex flex-col items-center gap-1 transition ${incentiveToken?.address === token.address
                                                ? 'bg-purple-500/30 border-purple-500 border'
                                                : 'bg-white/5 hover:bg-white/10 border border-transparent'
                                                }`}
                                        >
                                            {token.logoURI ? (
                                                <img src={token.logoURI} alt={token.symbol} className="w-6 h-6 rounded-full" />
                                            ) : (
                                                <div className="w-6 h-6 rounded-full bg-primary/30 flex items-center justify-center text-[10px] font-bold">
                                                    {token.symbol.slice(0, 2)}
                                                </div>
                                            )}
                                            <span className="text-[10px] font-medium">{token.symbol}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {incentiveToken && (
                                <div className="mb-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-xs text-gray-400">Amount</label>
                                        <span className="text-xs text-gray-400">
                                            Balance: <span className="text-white font-medium">{incentiveTokenBalanceFormatted ?? '0'} {incentiveToken.symbol}</span>
                                        </span>
                                    </div>
                                    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={incentiveAmount}
                                                onChange={(e) => setIncentiveAmount(e.target.value)}
                                                placeholder="0.0"
                                                className="flex-1 min-w-0 bg-transparent text-xl font-bold outline-none placeholder-gray-600"
                                            />
                                            <button
                                                onClick={() => incentiveTokenBalance && setIncentiveAmount(incentiveTokenBalance)}
                                                className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition"
                                            >
                                                MAX
                                            </button>
                                            <span className="text-sm text-gray-400">{incentiveToken.symbol}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="mb-4 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                                <div className="text-xs text-purple-300">
                                    💡 Incentives reward voters who vote for this pool. They are distributed proportionally based on vote weight.
                                </div>
                            </div>

                            <button
                                onClick={handleAddIncentive}
                                disabled={!incentiveToken || !incentiveAmount || parseFloat(incentiveAmount) <= 0 || isAddingIncentive}
                                className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-purple-500 to-pink-500 text-white disabled:opacity-50"
                            >
                                {isAddingIncentive ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Adding Incentive...
                                    </span>
                                ) : (
                                    '🎁 Add Incentive'
                                )}
                            </button>
                        </div>
                    </div>
                )
            }
        </div>
    );
}
