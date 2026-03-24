'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePublicClient } from 'wagmi';
import { useWriteContract } from '@/hooks/useWriteContract';
import { Address, encodeFunctionData, keccak256, toBytes, parseUnits } from 'viem';
import { V2_CONTRACTS, CL_CONTRACTS } from '@/config/contracts';
import { SUBGRAPH_URL, SUBGRAPH_HEADERS } from '@/hooks/useSubgraph';
import { GOVERNOR_ABI, VOTER_ABI } from '@/config/abis';

// Subgraph proposal shape
interface SubgraphProposal {
    id: string;
    proposalId: string;
    proposer: string;
    targets: string[];
    values: string[];
    calldatas: string[];
    description: string;
    voteStart: string;
    voteEnd: string;
    forVotes: string;
    againstVotes: string;
    abstainVotes: string;
    state: number;
    executed: boolean;
    canceled: boolean;
    createdAtTimestamp: string;
}

// Governor states
export enum ProposalState {
    Pending = 0,
    Active = 1,
    Canceled = 2,
    Defeated = 3,
    Succeeded = 4,
    Queued = 5,
    Expired = 6,
    Executed = 7,
}

export const PROPOSAL_STATE_LABELS: Record<ProposalState, string> = {
    [ProposalState.Pending]: 'Pending',
    [ProposalState.Active]: 'Active',
    [ProposalState.Canceled]: 'Canceled',
    [ProposalState.Defeated]: 'Defeated',
    [ProposalState.Succeeded]: 'Succeeded',
    [ProposalState.Queued]: 'Queued',
    [ProposalState.Expired]: 'Expired',
    [ProposalState.Executed]: 'Executed',
};

export interface Proposal {
    id: bigint;
    proposer: Address;
    description: string;
    state: ProposalState;
    forVotes: bigint;
    againstVotes: bigint;
    abstainVotes: bigint;
    startBlock: bigint;
    endBlock: bigint;
    targets: Address[];
    values: bigint[];
    calldatas: `0x${string}`[];
}

export function useGovernance() {
    const publicClient = usePublicClient();
    const { writeContractAsync, isPending } = useWriteContract();

    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Governance params from subgraph (no RPC calls)
    const [proposalThreshold, setProposalThreshold] = useState<bigint | undefined>();
    const [votingDelay, setVotingDelay] = useState<bigint | undefined>();
    const [votingPeriod, setVotingPeriod] = useState<bigint | undefined>();

    // Fetch governance params from subgraph Protocol entity
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(SUBGRAPH_URL, {
                    method: 'POST',
                    headers: SUBGRAPH_HEADERS,
                    body: JSON.stringify({
                        query: `{ protocol(id: "windswap") { proposalThreshold votingDelay votingPeriod } }`
                    }),
                });
                const json = await res.json();
                const p = json.data?.protocol;
                if (p) {
                    if (p.proposalThreshold) setProposalThreshold(BigInt(p.proposalThreshold));
                    if (p.votingDelay) setVotingDelay(BigInt(p.votingDelay));
                    if (p.votingPeriod) setVotingPeriod(BigInt(p.votingPeriod));
                }
            } catch (err) {
                console.warn('[Governance] Failed to fetch params from subgraph:', err);
            }
        })();
    }, []);

    // Fetch proposals from subgraph (fast!) then enrich with live RPC state
    const fetchProposals = useCallback(async () => {
        setIsLoading(true);
        try {
            // Query subgraph for proposals
            const query = `{
                proposals(orderBy: createdAtTimestamp, orderDirection: desc, first: 50) {
                    id
                    proposalId
                    proposer
                    targets
                    values
                    calldatas
                    description
                    voteStart
                    voteEnd
                    forVotes
                    againstVotes
                    abstainVotes
                    state
                    executed
                    canceled
                    createdAtTimestamp
                }
            }`;

            const response = await fetch(SUBGRAPH_URL, {
                method: 'POST',
                headers: SUBGRAPH_HEADERS,
                body: JSON.stringify({ query }),
            });

            const result = await response.json();
            console.log('[Governance] Subgraph response:', result);

            if (result.errors) {
                console.error('[Governance] Subgraph errors:', result.errors);
                throw new Error(result.errors[0]?.message || 'Subgraph query failed');
            }

            const subgraphProposals: SubgraphProposal[] = result.data?.proposals || [];
            const parsedProposals: Proposal[] = subgraphProposals.map((p) => ({
                id: BigInt(p.proposalId),
                proposer: p.proposer as Address,
                description: p.description,
                state: p.state as ProposalState,
                forVotes: BigInt(p.forVotes || '0'),
                againstVotes: BigInt(p.againstVotes || '0'),
                abstainVotes: BigInt(p.abstainVotes || '0'),
                startBlock: BigInt(p.voteStart),
                endBlock: BigInt(p.voteEnd),
                targets: p.targets as Address[],
                values: (p.values || []).map((v: string) => BigInt(v)),
                calldatas: p.calldatas.map((c: string) => (c.startsWith('0x') ? c : `0x${c}`) as `0x${string}`),
            }));

            console.log(`[Governance] Loaded ${parsedProposals.length} proposals from subgraph`);
            setProposals(parsedProposals);

            // Enrich with live on-chain state to fix stale subgraph state (e.g. stuck Pending)
            if (publicClient && parsedProposals.length > 0) {
                const liveStates = await Promise.all(
                    parsedProposals.map(async (p) => {
                        try {
                            const s = await publicClient.readContract({
                                address: V2_CONTRACTS.ProtocolGovernor as Address,
                                abi: GOVERNOR_ABI,
                                functionName: 'state',
                                args: [p.id],
                            });
                            return s as ProposalState;
                        } catch {
                            return p.state; // fallback to subgraph state on error
                        }
                    })
                );
                const enriched = parsedProposals.map((p, i) => ({ ...p, state: liveStates[i] }));
                console.log('[Governance] Enriched proposals with live state:', enriched.map(p => ({ id: p.id.toString(), state: p.state })));
                setProposals(enriched);
            }
        } catch (err: unknown) {
            console.error('[Governance] Error fetching proposals:', err);
            setError('Failed to fetch proposals');
        } finally {
            setIsLoading(false);
        }
    }, [publicClient]);

    // Fetch proposals on mount
    useEffect(() => {
        fetchProposals();
    }, [fetchProposals]);

    // Create proposal to whitelist a token
    const proposeWhitelistToken = useCallback(async (
        tokenId: bigint,
        tokenAddress: Address,
        description: string
    ) => {
        setError(null);
        try {
            const calldata = encodeFunctionData({
                abi: VOTER_ABI,
                functionName: 'whitelistToken',
                args: [tokenAddress, true],
            });

            const hash = await writeContractAsync({
                address: V2_CONTRACTS.ProtocolGovernor as Address,
                abi: GOVERNOR_ABI,
                functionName: 'propose',
                args: [
                    tokenId,
                    [V2_CONTRACTS.Voter as Address],
                    [BigInt(0)],
                    [calldata],
                    description,
                ],
            });

            return { hash };
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to create proposal');
            return null;
        }
    }, [writeContractAsync]);

    // Create proposal to create a gauge
    const proposeCreateGauge = useCallback(async (
        tokenId: bigint,
        poolFactory: Address,
        poolAddress: Address,
        description: string
    ) => {
        setError(null);
        try {
            const calldata = encodeFunctionData({
                abi: VOTER_ABI,
                functionName: 'createGauge',
                args: [poolFactory, poolAddress],
            });

            const hash = await writeContractAsync({
                address: V2_CONTRACTS.ProtocolGovernor as Address,
                abi: GOVERNOR_ABI,
                functionName: 'propose',
                args: [
                    tokenId,
                    [V2_CONTRACTS.Voter as Address],
                    [BigInt(0)],
                    [calldata],
                    description,
                ],
            });

            return { hash };
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to create proposal');
            return null;
        }
    }, [writeContractAsync]);

    // Create proposal to set new governor (transfer control back to your wallet)
    const proposeSetGovernor = useCallback(async (
        tokenId: bigint,
        newGovernor: Address,
        description: string
    ) => {
        setError(null);
        try {
            const calldata = encodeFunctionData({
                abi: VOTER_ABI,
                functionName: 'setGovernor',
                args: [newGovernor],
            });

            const hash = await writeContractAsync({
                address: V2_CONTRACTS.ProtocolGovernor as Address,
                abi: GOVERNOR_ABI,
                functionName: 'propose',
                args: [
                    tokenId,
                    [V2_CONTRACTS.Voter as Address],
                    [BigInt(0)],
                    [calldata],
                    description,
                ],
            });

            return { hash };
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to create proposal');
            return null;
        }
    }, [writeContractAsync]);

    // Cast vote on a proposal
    const castVote = useCallback(async (proposalId: bigint, tokenId: bigint, support: 0 | 1 | 2) => {
        // 0 = Against, 1 = For, 2 = Abstain
        setError(null);
        try {
            const hash = await writeContractAsync({
                address: V2_CONTRACTS.ProtocolGovernor as Address,
                abi: GOVERNOR_ABI,
                functionName: 'castVote',
                args: [proposalId, tokenId, support],
            });

            return { hash };
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to cast vote');
            return null;
        }
    }, [writeContractAsync]);

    // Execute a passed proposal
    const executeProposal = useCallback(async (
        targets: Address[],
        values: bigint[],
        calldatas: `0x${string}`[],
        description: string,
        proposer: Address
    ) => {
        setError(null);
        try {
            const descriptionHash = keccak256(toBytes(description));

            const hash = await writeContractAsync({
                address: V2_CONTRACTS.ProtocolGovernor as Address,
                abi: GOVERNOR_ABI,
                functionName: 'execute',
                args: [targets, values, calldatas, descriptionHash, proposer],
            });

            return { hash };
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to execute proposal');
            return null;
        }
    }, [writeContractAsync]);

    // Check if user has voted on a proposal (tokenId-based)
    const checkHasVoted = useCallback(async (proposalId: bigint, tokenId: bigint): Promise<boolean> => {
        if (!publicClient) return false;

        try {
            const hasVoted = await publicClient.readContract({
                address: V2_CONTRACTS.ProtocolGovernor as Address,
                abi: GOVERNOR_ABI,
                functionName: 'hasVoted',
                args: [proposalId, tokenId],
            });
            return hasVoted;
        } catch {
            return false;
        }
    }, [publicClient]);

    // Get proposal state
    const getProposalState = useCallback(async (proposalId: bigint): Promise<ProposalState | null> => {
        if (!publicClient) return null;

        try {
            const state = await publicClient.readContract({
                address: V2_CONTRACTS.ProtocolGovernor as Address,
                abi: GOVERNOR_ABI,
                functionName: 'state',
                args: [proposalId],
            });
            return state as ProposalState;
        } catch {
            return null;
        }
    }, [publicClient]);

    // Get proposal votes
    const getProposalVotes = useCallback(async (proposalId: bigint) => {
        if (!publicClient) return null;

        try {
            const [againstVotes, forVotes, abstainVotes] = await publicClient.readContract({
                address: V2_CONTRACTS.ProtocolGovernor as Address,
                abi: GOVERNOR_ABI,
                functionName: 'proposalVotes',
                args: [proposalId],
            });
            return { againstVotes, forVotes, abstainVotes };
        } catch {
            return null;
        }
    }, [publicClient]);

    return {
        proposals,
        isLoading: isLoading || isPending,
        error,
        proposalThreshold,
        votingDelay,
        votingPeriod,
        proposeWhitelistToken,
        proposeCreateGauge,
        proposeSetGovernor,
        castVote,
        executeProposal,
        checkHasVoted,
        getProposalState,
        getProposalVotes,
        refetchProposals: fetchProposals,
    };
}
