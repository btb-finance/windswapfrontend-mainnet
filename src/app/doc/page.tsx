'use client';

import React from 'react';
import Link from 'next/link';

export default function DocPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
            Wind Swap Protocol Documentation
          </h1>
          <p className="text-xl text-gray-400">
            Complete guide to V2 (Stable/Volatile AMM) and V3 (Concentrated Liquidity) protocols on Base
          </p>
        </div>

        {/* Quick Navigation */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          <QuickNavCard
            title="Getting Started"
            description="New to Wind Swap? Start here"
            items={[
              { label: 'How It Works', href: '#how-it-works' },
              { label: 'Lock WIND', href: '#how-to-lock' },
              { label: 'Vote', href: '#how-to-vote' },
              { label: 'Add Liquidity', href: '#how-to-add-liquidity' },
            ]}
          />
          <QuickNavCard
            title="V2 Protocol"
            description="Stable & Volatile AMM pools"
            items={[
              { label: 'V2 AMM', href: '#v2-amm' },
              { label: 'Liquidity Provision', href: '#v2-lp' },
              { label: 'Gauges & Rewards', href: '#v2-gauges' },
            ]}
          />
          <QuickNavCard
            title="V3 Protocol"
            description="Concentrated liquidity pools"
            items={[
              { label: 'V3 Overview', href: '#v3-overview' },
              { label: 'Position Management', href: '#v3-positions' },
              { label: 'V3 Gauges', href: '#v3-gauges' },
            ]}
          />
        </div>

        {/* Main Documentation */}
        <div className="space-y-16">
          {/* Protocol Overview */}
          <Section id="overview" title="Protocol Overview">
            <ContentBlock>
              <p className="text-gray-300 mb-4">
                Wind Swap is a decentralized exchange (DEX) protocol on Base, featuring two distinct AMM implementations:
              </p>
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <FeatureCard
                  title="Wind V2"
                  description="Stable and volatile AMM pools with vote-escrowed tokenomics"
                  features={[
                    'Stable pools with low slippage for pegged assets',
                    'Volatile pools for general token pairs',
                    'veNFT locking mechanism',
                    'Gauge-based emissions',
                  ]}
                />
                <FeatureCard
                  title="Wind V3 (Slipstream)"
                  description="Concentrated liquidity with capital efficiency"
                  features={[
                    'Concentrated liquidity ranges',
                    'Multiple fee tiers',
                    'Tick-based reward distribution',
                    'NFT position management',
                  ]}
                />
              </div>
              <KeyConcept
                title="Unified Tokenomics"
                description="Both V2 and V3 share the same WIND token, veNFT system, and governance structure"
              />
            </ContentBlock>
          </Section>

          {/* WIND Token */}
          <Section id="wind-token" title="WIND Token & veNFT System">
            <ContentBlock>
              <h3 className="text-2xl font-bold mb-4 text-blue-400">WIND Token</h3>
              <p className="text-gray-300 mb-4">
                WIND is the native governance and utility token of the Wind Swap protocol. It's emitted through weekly 
                emissions that decay over time, with distribution controlled by veNFT holders.
              </p>

              <h3 className="text-2xl font-bold mb-4 mt-8 text-purple-400">veNFT (Vote-Escrowed NFT)</h3>
              <p className="text-gray-300 mb-4">
                Lock WIND tokens in a VotingEscrow NFT to receive veWIND, which decays linearly over time. The longer 
                you lock, the more voting power you receive.
              </p>

              <div className="bg-gray-800 rounded-lg p-6 mb-6">
                <h4 className="text-xl font-bold mb-3 text-yellow-400">Lock Mechanics</h4>
                <ul className="space-y-2 text-gray-300">
                  <li>• <strong>Maximum Lock:</strong> 4 years</li>
                  <li>• <strong>Voting Power:</strong> Amount × Lock Time (up to 4 years)</li>
                  <li>• <strong>Decay:</strong> Voting power decays linearly as lock time approaches</li>
                  <li>• <strong>Early Withdrawal:</strong> Possible but you lose all remaining voting power</li>
                </ul>
              </div>

              <h4 className="text-xl font-bold mb-3 text-green-400">veNFT States & Operations</h4>
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <StateCard
                  title="Normal State"
                  description="Standard veNFT with time-decaying voting power"
                  operations={[
                    'Create new locks',
                    'Add more WIND to existing lock',
                    'Extend lock time',
                    'Split/merge NFTs',
                    'Vote for pools',
                    'Withdraw after lock expires',
                  ]}
                />
                <StateCard
                  title="Permanent Lock"
                  description="Maximum voting power that doesn't decay"
                  operations={[
                    'Permanent lock existing NFT',
                    'Delegate voting power',
                    'Can be unlocked (if not voted)',
                    'Managed NFT compatible',
                  ]}
                />
              </div>

              <h4 className="text-xl font-bold mb-3 text-pink-400">Managed NFTs (mveNFT)</h4>
              <p className="text-gray-300 mb-4">
                Managed NFTs allow users to deposit their veNFTs into a permanent lock managed by a protocol or service. 
                The manager can compound rewards and optimize voting on behalf of depositors.
              </p>
              <div className="bg-pink-900/20 border border-pink-500/30 rounded-lg p-4">
                <p className="text-pink-300">
                  <strong>Note:</strong> When you deposit into a managed NFT, your NFT enters a "locked" state and 
                  cannot be used for voting. The managed NFT aggregates all voting power and distributes rewards proportionally.
                </p>
              </div>
            </ContentBlock>
          </Section>

          {/* Voting & Governance */}
          <Section id="voting" title="Voting, Emissions & Rewards">
            <ContentBlock>
              <h3 className="text-2xl font-bold mb-4 text-blue-400">veNFT as Long-Term Passive Income</h3>
              <p className="text-gray-300 mb-4">
                Think of veNFT as a pension fund or long-term investment vehicle. By locking your WIND tokens 
                for 4-5 years, you create a sustainable passive income stream that pays out weekly rewards indefinitely.
              </p>

              <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-lg p-6 mb-6">
                <h4 className="text-xl font-bold mb-3">How Passive Income Works</h4>
                <p className="text-gray-300 mb-3">
                  Once you lock WIND in a veNFT, you earn weekly income from two sources without active trading:
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <RewardType
                    title="Protocol Emissions (Rebases)"
                    description="Weekly WIND token distribution proportional to your locked amount. Longer locks = larger share of the emission pool"
                    color="green"
                  />
                  <RewardType
                    title="Voter Rewards"
                    description="Trading fees + external bribes from pools you vote for. Vote weekly to maximize earnings"
                    color="yellow"
                  />
                </div>
              </div>

              <div className="bg-gray-700 rounded-lg p-6 mb-6">
                <h4 className="text-xl font-bold mb-3 text-purple-400">Long-Term Strategy Example</h4>
                <div className="space-y-3 text-gray-300">
                  <p><strong>Initial Lock:</strong> Lock 10,000 WIND for 4 years</p>
                  <p><strong>Voting Power:</strong> Maximum boost (40,000 veWIND)</p>
                  <p><strong>Weekly Action:</strong> Vote for pools with highest bribes</p>
                  <p><strong>Weekly Income:</strong> Rebases + Bribes + Fees</p>
                  <p><strong>Flexibility:</strong> Sell veNFT anytime on secondary market (NFT marketplace)</p>
                  <p className="text-green-400 font-semibold"><strong>Result:</strong> Passive income that compounds over 4-5 years</p>
                </div>
              </div>

              <h3 className="text-2xl font-bold mb-4 mt-8 text-purple-400">Voting Rights & Emissions Control</h3>
              <p className="text-gray-300 mb-4">
                Your veNFT gives you governance rights to direct protocol emissions. Each week (Thursday to Thursday 
                epoch), you vote for which pools receive WIND emissions.
              </p>

              <h3 className="text-2xl font-bold mb-4 mt-8 text-blue-400">Emission Schedule</h3>
              <p className="text-gray-300 mb-4">
                WIND emissions follow a decaying schedule with two phases:
              </p>
              <div className="space-y-4">
                <EmissionPhase
                  title="Initial Phase"
                  description="Fixed emissions starting at 15M WIND per week"
                  details="Decays by 1% per week until reaching ~6M WIND/week (~92 weeks)"
                  color="blue"
                />
                <EmissionPhase
                  title="Tail Emission Phase"
                  description="Dynamic emissions based on circulating supply"
                  details="Starting at 0.3% of supply, adjustable by governance weekly via EpochGovernor votes"
                  color="purple"
                />
              </div>

              <h3 className="text-2xl font-bold mb-4 mt-8 text-green-400">Rebase Mechanics</h3>
              <p className="text-gray-300 mb-4">
                veNFT holders earn rebases - additional WIND tokens distributed weekly. The rebase amount is 
                calculated based on:
              </p>
              <ul className="space-y-2 text-gray-300">
                <li>• Your locked WIND amount relative to total locked WIND</li>
                <li>• Your lock time (longer locks earn proportionally more)</li>
                <li>• Total weekly emission amount (decays over time)</li>
              </ul>
              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 mt-4">
                <p className="text-green-200">
                  <strong>Key Benefit:</strong> Rebases are automatic - you don't need to vote or claim. They 
                  accumulate in your veNFT and can be claimed when you withdraw or merge.
                </p>
              </div>
            </ContentBlock>
          </Section>

          {/* V2 AMM */}
          <Section id="v2-amm" title="V2 Protocol - Stable & Volatile AMM">
            <ContentBlock>
              <h3 className="text-2xl font-bold mb-4 text-blue-400">Pool Types</h3>
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <PoolTypeCard
                  title="Stable Pools"
                  description="Optimized for pegged assets (stablecoins, wrapped tokens)"
                  formula="x³y + y³x = k"
                  features={[
                    'Very low slippage on similar-valued assets',
                    'Ideal for stable-to-stable swaps',
                    'Customizable fee rates (up to 3%)',
                  ]}
                  color="green"
                />
                <PoolTypeCard
                  title="Volatile Pools"
                  description="Standard AMM for general token pairs"
                  formula="x × y = k"
                  features={[
                    'Uniswap V2-style constant product',
                    'Works for any token pair',
                    'Higher fees for volatile pairs',
                  ]}
                  color="purple"
                />
              </div>

              <h3 className="text-2xl font-bold mb-4 mt-8 text-yellow-400">Router Features</h3>
              <p className="text-gray-300 mb-4">
                The V2 router supports advanced trading and liquidity management:
              </p>
              <ul className="space-y-2 text-gray-300">
                <li>• <strong>Multi-hop Swaps:</strong> Route through multiple pools for best prices</li>
                <li>• <strong>Zapping:</strong> Add/remove liquidity with single token (auto-converts 50/50)</li>
                <li>• <strong>Fee-on-Transfer Support:</strong> Compatible with tokens that have transfer fees</li>
                <li>• <strong>Zap & Stake:</strong> Add liquidity and automatically stake in gauge</li>
              </ul>
            </ContentBlock>
          </Section>

          {/* V2 LP */}
          <Section id="v2-lp" title="V2 Liquidity Provision">
            <ContentBlock>
              <h3 className="text-2xl font-bold mb-4 text-green-400">Adding Liquidity</h3>
              <p className="text-gray-300 mb-4">
                Provide liquidity to V2 pools by depositing both tokens in a 50/50 ratio based on current value. 
                You'll receive LP tokens representing your share of the pool.
              </p>

              <div className="bg-gray-800 rounded-lg p-6 mb-6">
                <h4 className="text-xl font-bold mb-3">Liquidity Provider Options</h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <OptionCard
                    title="Unstaked LP"
                    description="Hold LP tokens in your wallet"
                    benefits="Collect trading fees directly"
                    tradeoffs="No WIND emissions"
                  />
                  <OptionCard
                    title="Staked LP (Gauge)"
                    description="Deposit LP tokens into gauge"
                    benefits="Earn WIND emissions + voting power"
                    tradeoffs="Fees go to voters instead"
                  />
                </div>
              </div>

              <h3 className="text-2xl font-bold mb-4 mt-8 text-blue-400">Risks & Considerations</h3>
              <ul className="space-y-2 text-gray-300">
                <li>• <strong>Impermanent Loss:</strong> Value divergence vs holding tokens</li>
                <li>• <strong>Pool Selection:</strong> Choose pools with voting for emissions</li>
                <li>• <strong>Fee Structure:</strong> Stable pools may have lower fee revenue</li>
              </ul>
            </ContentBlock>
          </Section>

          {/* V2 Gauges */}
          <Section id="v2-gauges" title="V2 Gauges, Emissions & Fee Structure">
            <ContentBlock>
              <h3 className="text-2xl font-bold mb-4 text-purple-400">What are Gauges?</h3>
              <p className="text-gray-300 mb-4">
                Gauges are reward contracts that distribute WIND emissions to liquidity providers. The amount of 
                emissions a gauge receives is proportional to the voting weight it attracts from veNFT holders.
              </p>

              <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-lg p-6 mb-6">
                <h4 className="text-xl font-bold mb-3">How Gauges Work</h4>
                <ol className="space-y-3 text-gray-300">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center font-bold">1</span>
                    <span>veNFT holders vote for their preferred pools</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center font-bold">2</span>
                    <span>Voting weights determine emission distribution</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center font-bold">3</span>
                    <span>Staked LPs earn WIND proportional to their share</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center font-bold">4</span>
                    <span>Voters earn bribes + fees from voted pools</span>
                  </li>
                </ol>
              </div>

              <h3 className="text-2xl font-bold mb-4 mt-8 text-yellow-400">LP Fee Structure: Staked vs Unstaked</h3>
              <p className="text-gray-300 mb-4">
                Liquidity providers have two options with different fee structures:
              </p>

              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <FeeOptionCard
                  title="Unstaked LP"
                  description="Hold LP tokens in your wallet"
                  feeType="Standard Trading Fees"
                  feeAmount="100% of trading fees from your liquidity"
                  emission="None"
                  bestFor="Traders who want fee income without emissions"
                />
                <FeeOptionCard
                  title="Staked LP (in Gauge)"
                  description="Deposit LP tokens into gauge"
                  feeType="Reduced Trading Fees + WIND Emissions"
                  feeAmount="Portion of fees goes to voters, you earn WIND emissions"
                  emission="Weekly WIND emissions proportional to your stake"
                  bestFor="Long-term liquidity providers maximizing yield"
                />
              </div>

              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-6">
                <h4 className="font-bold mb-2 text-blue-300">Why Staked LPs Give Up Some Fees</h4>
                <p className="text-gray-300">
                  When you stake in a gauge, you forfeit a portion of trading fees to veNFT voters who directed 
                  emissions to your pool. In exchange, you receive valuable WIND emissions. This creates a 
                  symbiotic relationship: voters direct emissions to pools with high fee potential, and LPs 
                  share their fee revenue to attract those emissions.
                </p>
              </div>

              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 mb-6">
                <h4 className="font-bold mb-2 text-green-300">Higher Yields for Staked LPs</h4>
                <p className="text-gray-300">
                  Despite giving up some trading fees, staked LPs typically earn HIGHER overall returns because:
                  <br />• WIND emissions have significant value (especially early in protocol)
                  <br />• Voted pools attract more liquidity and volume
                  <br />• Emissions compound when restaked
                  <br />• You can still claim your portion of fees via bribes if you vote
                </p>
              </div>

              <h3 className="text-2xl font-bold mb-4 mt-8 text-blue-400">Reward Contracts</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <RewardContractCard
                  title="BribeVotingReward"
                  description="External incentives for voters"
                  examples="Protocols bribe to attract emissions to their pools"
                />
                <RewardContractCard
                  title="FeesVotingReward"
                  description="Trading fees from staked LPs"
                  examples="Fees that LPs forego when staking in gauges go to voters"
                />
                <RewardContractCard
                  title="ManagedReward"
                  description="Rewards for managed NFT depositors"
                  examples="Compound returns from managed services that optimize voting"
                />
                <RewardContractCard
                  title="RewardsDistributor"
                  description="Rebase distribution for veNFTs"
                  examples="Weekly rebase to locked WIND holders proportional to lock amount and time"
                />
              </div>
            </ContentBlock>
          </Section>

          {/* V3 Overview */}
          <Section id="v3-overview" title="V3 Protocol - Concentrated Liquidity">
            <ContentBlock>
              <h3 className="text-2xl font-bold mb-4 text-blue-400">What is Concentrated Liquidity?</h3>
              <p className="text-gray-300 mb-4">
                Unlike V2 where liquidity is distributed across all prices, V3 allows liquidity providers to 
                concentrate their capital in specific price ranges. This provides:
              </p>
              <div className="grid md:grid-cols-3 gap-4 mb-6">
                <BenefitCard
                  title="Capital Efficiency"
                  description="Earn more fees with less capital"
                  icon="💰"
                />
                <BenefitCard
                  title="Flexible Ranges"
                  description="Choose your price range"
                  icon="📊"
                />
                <BenefitCard
                  title="Multiple Positions"
                  description="Create many positions per pool"
                  icon="🎯"
                />
              </div>

              <h3 className="text-2xl font-bold mb-4 mt-8 text-purple-400">Fee Tiers</h3>
              <p className="text-gray-300 mb-4">
                Each V3 pool has a specific fee tier that determines the trading fee. The fee tier is assigned 
                when the pool is created and cannot be changed:
              </p>
              <div className="bg-gray-800 rounded-lg p-6 mb-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-gray-300">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="py-2 text-left">Fee Tier</th>
                        <th className="py-2 text-left">Use Case</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-700/50">
                        <td className="py-2">0.005%</td>
                        <td className="py-2">Stable pairs (pegged assets like stablecoins)</td>
                      </tr>
                      <tr className="border-b border-gray-700/50">
                        <td className="py-2">0.03%</td>
                        <td className="py-2">Standard pairs</td>
                      </tr>
                      <tr className="border-b border-gray-700/50">
                        <td className="py-2">0.05%</td>
                        <td className="py-2">Medium volatility pairs</td>
                      </tr>
                      <tr className="border-b border-gray-700/50">
                        <td className="py-2">0.26%</td>
                        <td className="py-2">Volatile pairs</td>
                      </tr>
                      <tr>
                        <td className="py-2">1%</td>
                        <td className="py-2">Exotic pairs</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <h3 className="text-2xl font-bold mb-4 mt-8 text-green-400">Active Tick Rewards</h3>
              <p className="text-gray-300 mb-4">
                V3 gauges only distribute emissions to liquidity in the active tick (current price). This maximizes 
                capital efficiency by rewarding useful liquidity that's actually facilitating trades.
              </p>
              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                <p className="text-green-300">
                  <strong>Key Difference from V2:</strong> In V2, all LPs earn emissions proportionally. 
                  In V3, only LPs whose ranges include the current price earn emissions.
                </p>
              </div>
            </ContentBlock>
          </Section>

          {/* User Guides */}
          <Section id="how-it-works" title="How to Use Wind Swap">
            <ContentBlock>
              <h3 className="text-2xl font-bold mb-4 text-blue-400">The ve(3,3) System: Lock, Vote, Earn</h3>
              <p className="text-gray-300 mb-6">
                Wind Swap uses a vote-escrow system that aligns incentives between liquidity providers, voters, 
                and the protocol. Here's how it works:
              </p>

              <div className="grid md:grid-cols-3 gap-6 mb-8">
                <FlowCard
                  step={1}
                  title="Lock WIND"
                  description="Create a veNFT by locking WIND tokens"
                  details="Lock WIND for up to 4 years. Longer locks = more voting power. Your veNFT represents your locked position."
                  color="purple"
                />
                <FlowCard
                  step={2}
                  title="Vote for Pools"
                  description="Direct emissions to your favorite pools"
                  details="Use your veNFT's voting power to vote for pools. Weekly voting determines which pools receive WIND emissions."
                  color="green"
                />
                <FlowCard
                  step={3}
                  title="Earn Rewards"
                  description="Get paid for your participation"
                  details="Earn trading fees + bribes from pools you voted for. Your veNFT also earns rebases (extra WIND emissions)."
                  color="yellow"
                />
              </div>

              <div className="bg-gradient-to-r from-purple-900/30 to-green-900/30 rounded-lg p-6 border border-purple-500/30">
                <h4 className="text-xl font-bold mb-3">The Flywheel Effect</h4>
                <p className="text-gray-300">
                  Good pools earn more votes → more emissions → attract more liquidity → better trading → more fees → 
                  more voters → cycle repeats. This creates a self-reinforcing cycle that rewards the best pools.
                </p>
              </div>
            </ContentBlock>
          </Section>

          <Section id="how-to-lock" title="How to Lock WIND">
            <ContentBlock>
              <h3 className="text-2xl font-bold mb-4 text-purple-400">Creating Your veNFT</h3>
              <p className="text-gray-300 mb-4">
                Navigate to the Vote page and follow these steps:
              </p>

              <div className="space-y-4">
                <StepCard
                  step={1}
                  title="Select Lock Amount"
                  description="Choose how many WIND tokens to lock"
                  details="You can lock any amount of WIND. More tokens = more voting power."
                />
                <StepCard
                  step={2}
                  title="Choose Lock Duration"
                  description="Select how long to lock (1 week to 4 years)"
                  details="Longer locks multiply your voting power. A 4-year lock gives you 4x the voting power of a 1-year lock for the same amount."
                />
                <StepCard
                  step={3}
                  title="Confirm Transaction"
                  description="Approve and lock your WIND"
                  details="Your WIND is transferred to the VotingEscrow contract and you receive a veNFT representing your locked position."
                />
                <StepCard
                  step={4}
                  title="Receive veNFT"
                  description="Your veNFT appears in your portfolio"
                  details="The veNFT shows your voting power, lock end time, and can be managed (merge, split, extend, increase amount)."
                />
              </div>

              <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4 mt-6">
                <h4 className="font-bold mb-2 text-purple-300">Lock Management Options</h4>
                <ul className="space-y-1 text-gray-300 text-sm">
                  <li>• <strong>Increase Amount:</strong> Add more WIND to your existing lock</li>
                  <li>• <strong>Extend Lock:</strong> Increase your lock time (up to 4 years total)</li>
                  <li>• <strong>Permanent Lock:</strong> Lock permanently to maintain maximum voting power without decay</li>
                  <li>• <strong>Merge:</strong> Combine multiple veNFTs into one</li>
                  <li>• <strong>Split:</strong> Divide one veNFT into two (for different voting strategies)</li>
                </ul>
              </div>
            </ContentBlock>
          </Section>

          <Section id="how-to-vote" title="How to Vote">
            <ContentBlock>
              <h3 className="text-2xl font-bold mb-4 text-green-400">Voting with Your veNFT</h3>
              <p className="text-gray-300 mb-4">
                Go to the Vote page and use your veNFT to direct emissions:
              </p>

              <div className="space-y-4">
                <StepCard
                  step={1}
                  title="Select Your veNFT"
                  description="Choose which veNFT to vote with"
                  details="If you have multiple veNFTs, select the one you want to use for voting."
                />
                <StepCard
                  step={2}
                  title="Choose Pools to Vote For"
                  description="Browse available pools and their rewards"
                  details="See current bribes, trading fees, and vote weight for each pool. You can vote for up to 30 pools."
                />
                <StepCard
                  step={3}
                  title="Allocate Your Voting Power"
                  description="Distribute your votes across pools"
                  details="Use sliders or percentages to allocate your voting power. You can vote all power to one pool or spread it across multiple pools."
                />
                <StepCard
                  step={4}
                  title="Confirm Your Vote"
                  description="Submit your vote transaction"
                  details="Your vote is recorded on-chain and will influence the next epoch's emission distribution."
                />
              </div>

              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 mt-6">
                <h4 className="font-bold mb-2 text-green-300">Voting Mechanics</h4>
                <ul className="space-y-1 text-gray-300 text-sm">
                  <li>• <strong>Weekly Epochs:</strong> Voting runs from Thursday to Thursday UTC</li>
                  <li>• <strong>Voting Window:</strong> Cannot vote in first or last hour of epoch</li>
                  <li>• <strong>Vote Weight:</strong> Your veNFT's voting power = Amount × Lock Time</li>
                  <li>• <strong>Pending Rewards:</strong> See bribes and fees you'll earn if you vote for each pool</li>
                  <li>• <strong>Reset Votes:</strong> You can reset your votes anytime after voting</li>
                </ul>
              </div>

              <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 mt-4">
                <h4 className="font-bold mb-2 text-yellow-300">Earning from Voting</h4>
                <p className="text-gray-300 text-sm">
                  When you vote for a pool, you earn:
                  <br />• <strong>Trading Fees:</strong> Portion of fees from staked LPs in that pool
                  <br />• <strong>Bribes:</strong> External incentives deposited by protocols
                  <br />• Claim rewards weekly from the Vote page
                </p>
              </div>
            </ContentBlock>
          </Section>

          <Section id="how-to-add-liquidity" title="How to Add Liquidity">
            <ContentBlock>
              <h3 className="text-2xl font-bold mb-4 text-blue-400">Providing Liquidity to Pools</h3>
              <p className="text-gray-300 mb-4">
                Go to the Pools page to add liquidity and earn rewards:
              </p>

              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="bg-gray-700 rounded-lg p-5">
                  <h4 className="font-bold text-lg mb-3 text-purple-400">V2 Classic Pools</h4>
                  <p className="text-sm text-gray-400 mb-3">Simple, set-and-forget liquidity</p>
                  <ul className="space-y-2 text-sm text-gray-300">
                    <li>1. Select V2 pool type</li>
                    <li>2. Choose two tokens</li>
                    <li>3. Select Stable or Volatile</li>
                    <li>4. Enter amounts (50/50 value ratio)</li>
                    <li>5. Add liquidity</li>
                    <li>6. Stake LP tokens in gauge to earn emissions</li>
                  </ul>
                </div>
                <div className="bg-green-900/20 rounded-lg p-5 border border-green-500/30">
                  <h4 className="font-bold text-lg mb-3 text-green-400">V3 Concentrated Pools</h4>
                  <p className="text-sm text-gray-400 mb-3">Capital-efficient, requires management</p>
                  <ul className="space-y-2 text-sm text-gray-300">
                    <li>1. Select V3 pool type</li>
                    <li>2. Choose two tokens</li>
                    <li>3. Select fee tier</li>
                    <li>4. Set your price range</li>
                    <li>5. Enter amounts</li>
                    <li>6. Create NFT position</li>
                    <li>7. Stake NFT in gauge to earn emissions</li>
                  </ul>
                </div>
              </div>

              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mt-6">
                <h4 className="font-bold mb-2 text-blue-300">After Adding Liquidity</h4>
                <ul className="space-y-1 text-gray-300 text-sm">
                  <li>• <strong>Stake in Gauge:</strong> Deposit LP tokens/NFT into gauge to earn WIND emissions</li>
                  <li>• <strong>Higher Yields:</strong> Staked LPs earn emissions (typically higher than unstaked fees)</li>
                  <li>• <strong>Vote for Your Pool:</strong> Use your veNFT to vote for the pool you provided liquidity to</li>
                  <li>• <strong>Attract More Liquidity:</strong> More votes = more emissions = more LPs join = flywheel effect</li>
                </ul>
              </div>

              <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4 mt-4">
                <h4 className="font-bold mb-2 text-purple-300">Understanding V3 Price Ranges</h4>
                <p className="text-gray-300 text-sm">
                  When creating a V3 position, you choose a price range where your liquidity will be active:
                  <br />• <strong>Narrow Range:</strong> Higher capital efficiency but inactive if price moves out
                  <br />• <strong>Wide Range:</strong> Lower efficiency but more tolerant to price movements
                  <br />• <strong>Active Tick:</strong> You only earn fees and emissions when current price is in your range
                  <br />• <strong>Management Required:</strong> Monitor and adjust your position as price moves
                </p>
              </div>
            </ContentBlock>
          </Section>

          {/* V3 Positions */}
          <Section id="v3-positions" title="V3 Position Management">
            <ContentBlock>
              <h3 className="text-2xl font-bold mb-4 text-blue-400">NFT Positions</h3>
              <p className="text-gray-300 mb-4">
                V3 liquidity positions are represented as NFTs, containing all position information. This allows for 
                advanced position management and transfers.
              </p>

              <div className="bg-gray-800 rounded-lg p-6 mb-6">
                <h4 className="text-xl font-bold mb-3">Position Data</h4>
                <ul className="space-y-2 text-gray-300">
                  <li>• <strong>Token Pair:</strong> Which pool the position is in</li>
                  <li>• <strong>Tick Range:</strong> Lower and upper price bounds</li>
                  <li>• <strong>Liquidity:</strong> Amount of liquidity provided</li>
                  <li>• <strong>Fees Earned:</strong> Unclaimed trading fees</li>
                  <li>• <strong>Rewards Earned:</strong> Unclaimed WIND emissions (if staked)</li>
                </ul>
              </div>

              <h3 className="text-2xl font-bold mb-4 mt-8 text-purple-400">Position Operations</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <OperationCard
                  title="Create Position"
                  description="Add liquidity to a price range"
                  steps={['Select pool', 'Set range', 'Add liquidity', 'Receive NFT']}
                />
                <OperationCard
                  title="Increase Liquidity"
                  description="Add more to existing position"
                  steps={['Select NFT', 'Add tokens', 'Liquidity increased']}
                />
                <OperationCard
                  title="Decrease Liquidity"
                  description="Remove liquidity from position"
                  steps={['Select NFT', 'Specify amount', 'Receive tokens']}
                />
                <OperationCard
                  title="Collect Fees/Rewards"
                  description="Claim accrued earnings"
                  steps={['Select NFTs', 'Claim earnings', 'Tokens received']}
                />
              </div>

              <h3 className="text-2xl font-bold mb-4 mt-8 text-yellow-400">Staking in V3 Gauges</h3>
              <p className="text-gray-300 mb-4">
                To earn WIND emissions on your V3 position, stake the NFT in the corresponding gauge:
              </p>
              <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                <ul className="space-y-2 text-yellow-100">
                  <li>• <strong>Deposit:</strong> Transfer NFT to gauge (stop earning fees, start earning emissions)</li>
                  <li>• <strong>Withdraw:</strong> Remove NFT from gauge (collect rewards, resume fee earning)</li>
                  <li>• <strong>Note:</strong> All rewards are collected when withdrawing from gauge</li>
                </ul>
              </div>
            </ContentBlock>
          </Section>

          {/* V3 Gauges */}
          <Section id="v3-gauges" title="V3 Gauges & Active Tick Rewards">
            <ContentBlock>
              <h3 className="text-2xl font-bold mb-4 text-green-400">How V3 Gauges Differ</h3>
              <p className="text-gray-300 mb-4">
                V3 gauges implement a sophisticated reward system that only incentivizes liquidity in the active tick:
              </p>

              <div className="bg-gradient-to-r from-green-900/30 to-blue-900/30 rounded-lg p-6 mb-6">
                <h4 className="text-xl font-bold mb-3">Active Tick Mechanics</h4>
                <ol className="space-y-3 text-gray-300">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-green-600 flex items-center justify-center font-bold">1</span>
                    <span>
                      <strong>Track Active Tick:</strong> Gauge monitors which tick has current price
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-green-600 flex items-center justify-center font-bold">2</span>
                    <span>
                      <strong>Accrue Rewards:</strong> Emissions accumulate for active tick liquidity
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-green-600 flex items-center justify-center font-bold">3</span>
                    <span>
                      <strong>Distribute:</strong> When price moves, rewards distribute to affected positions
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-green-600 flex items-center justify-center font-bold">4</span>
                    <span>
                      <strong>Collect Fees:</strong> Weekly fee collection to FeeVotingReward contracts
                    </span>
                  </li>
                </ol>
              </div>

              <h3 className="text-2xl font-bold mb-4 mt-8 text-purple-400">Reward Rolling</h3>
              <p className="text-gray-300 mb-4">
                If the active tick moves to a range with no staked liquidity, rewards don't disappear - they roll 
                forward to be distributed when liquidity returns:
              </p>
              <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
                <p className="text-purple-200">
                  <strong>Reward Rolling Rules:</strong> Rewards roll based on seconds spent in empty tick ranges. 
                  Rolling occurs on next notification. If not called within an epoch, rewards remain stuck until next notification.
                </p>
              </div>

              <h3 className="text-2xl font-bold mb-4 mt-8 text-blue-400">Advanced Operations</h3>
              <p className="text-gray-300 mb-4">
                V3 gauges support advanced liquidity management for staked positions:
              </p>
              <ul className="space-y-2 text-gray-300">
                <li>• <strong>Increase Staked Liquidity:</strong> Add to staked position without withdrawing</li>
                <li>• <strong>Decrease Staked Liquidity:</strong> Remove from staked position and collect tokens</li>
                <li>• <strong>Notify Rewards:</strong> Add external rewards (admin only)</li>
              </ul>

              <div className="mt-6 bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                <p className="text-blue-200">
                  <strong>Important:</strong> Unlike V2, V3 rewards must be claimed before withdrawing a position. 
                  There's no "getReward" after unstaking - all rewards are distributed on withdrawal.
                </p>
              </div>
            </ContentBlock>
          </Section>

          {/* Contract Addresses */}
          <Section id="contracts" title="Contract Addresses">
            <ContentBlock>
              <h3 className="text-2xl font-bold mb-4 text-blue-400">Base Mainnet Deployments</h3>

              <div className="mb-8">
                <h4 className="text-xl font-bold mb-3 text-purple-400">V2 Core Contracts</h4>
                <ContractTable contracts={[
                  { name: 'WIND', address: '0x888a4F89aF7dD0Be836cA367C9FF5490c0F6e888', link: 'https://basescan.org/address/0x888a4F89aF7dD0Be836cA367C9FF5490c0F6e888' },
                  { name: 'VotingEscrow', address: '0x88889C4Be508cA88eba6ad802340C0563891D426', link: 'https://basescan.org/address/0x88889C4Be508cA88eba6ad802340C0563891D426' },
                  { name: 'Voter', address: '0x88881EB4b5dD3461fC0CFBc44606E3b401197E38', link: 'https://basescan.org/address/0x88881EB4b5dD3461fC0CFBc44606E3b401197E38' },
                  { name: 'Minter', address: '0x8888a8585d2Ab886800409fF97Ce84564CbFeF47', link: 'https://basescan.org/address/0x8888a8585d2Ab886800409fF97Ce84564CbFeF47' },
                  { name: 'Router', address: '0x88883154C9F8eb3bd34fb760bda1EB7556a20e14', link: 'https://basescan.org/address/0x88883154C9F8eb3bd34fb760bda1EB7556a20e14' },
                  { name: 'PoolFactory', address: '0x88880e3dA8676C879c3D019EDE0b5a74586813be', link: 'https://basescan.org/address/0x88880e3dA8676C879c3D019EDE0b5a74586813be' },
                  { name: 'RewardsDistributor', address: '0x8888f1e8908F7B268439289091b3Fd1dE2B4c124', link: 'https://basescan.org/address/0x8888f1e8908F7B268439289091b3Fd1dE2B4c124' },
                  { name: 'GaugeFactory', address: '0x88886e546d9024C53Cfb0FbD87DE83FA9BF9e857', link: 'https://basescan.org/address/0x88886e546d9024C53Cfb0FbD87DE83FA9BF9e857' },
                  { name: 'AggregatorProxy', address: '0x88882237C70b9C96a7749cA309187Eb9c9462094', link: 'https://basescan.org/address/0x88882237C70b9C96a7749cA309187Eb9c9462094' },
                ]} />
              </div>

              <div className="mb-8">
                <h4 className="text-xl font-bold mb-3 text-green-400">V3 Core Contracts</h4>
                <ContractTable contracts={[
                  { name: 'CLFactory', address: '0x8888A3D87EF6aBC5F50572661E4729A45b255cF6', link: 'https://basescan.org/address/0x8888A3D87EF6aBC5F50572661E4729A45b255cF6' },
                  { name: 'CLGaugeFactory', address: '0x8888B7b5731EBB4E7962cC20b186C92C94bCAFbd', link: 'https://basescan.org/address/0x8888B7b5731EBB4E7962cC20b186C92C94bCAFbd' },
                  { name: 'SwapRouter', address: '0x8888EEA5C97AF36f764259557d2D4CA23e6b19Ff', link: 'https://basescan.org/address/0x8888EEA5C97AF36f764259557d2D4CA23e6b19Ff' },
                  { name: 'NonfungiblePositionManager', address: '0x8888bB79b80e6B48014493819656Ffc1444d7687', link: 'https://basescan.org/address/0x8888bB79b80e6B48014493819656Ffc1444d7687' },
                  { name: 'QuoterV2', address: '0x888831E6a70C71009765bAa1C3d86031539d6B15', link: 'https://basescan.org/address/0x888831E6a70C71009765bAa1C3d86031539d6B15' },
                  { name: 'MixedRouteQuoterV1', address: '0x88884631783f44261ba37da9a37ffa65dcB1A676', link: 'https://basescan.org/address/0x88884631783f44261ba37da9a37ffa65dcB1A676' },
                ]} />
              </div>

              <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                <p className="text-yellow-200">
                  <strong>Verify on BaseScan:</strong> All contracts are verified. Click addresses to view source code and transaction history.
                </p>
              </div>
            </ContentBlock>
          </Section>

          {/* Governance */}
          <Section id="governance" title="Governance">
            <ContentBlock>
              <h3 className="text-2xl font-bold mb-4 text-blue-400">Dual Governance System</h3>
              <p className="text-gray-300 mb-4">
                Wind Swap implements two governance mechanisms for different purposes:
              </p>

              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <GovernanceCard
                  title="Protocol Governor"
                  description="Standard governance protocol"
                  features={[
                    'Propose protocol changes',
                    'Vote with veNFT voting power',
                    'Veto mechanism for protection',
                    'Timestamp-based voting',
                  ]}
                />
                <GovernanceCard
                  title="Epoch Governor"
                  description="Weekly emission adjustments"
                  features={[
                    'Adjust tail emission rate',
                    'Vote each epoch (week)',
                    'Simple majority wins',
                    'Three options: Increase/Hold/Decrease',
                  ]}
                />
              </div>

              <h3 className="text-2xl font-bold mb-4 mt-8 text-purple-400">Voting Power</h3>
              <p className="text-gray-300 mb-4">
                Governance voting power is derived from your veNFT balance at the time of vote. The longer your lock 
                and more WIND you have locked, the more influence you have over protocol decisions.
              </p>

              <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
                <p className="text-purple-200">
                  <strong>Delegation:</strong> Permanent locks can delegate voting power to other addresses. 
                  This allows for sophisticated voting strategies while maintaining lock benefits.
                </p>
              </div>
            </ContentBlock>
          </Section>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-gray-700 text-center text-gray-400">
          <p>Wind Swap Protocol - Built on Base</p>
          <p className="mt-2">Documentation updated as of protocol deployment</p>
        </div>
      </div>
    </div>
  );
}

// Helper Components
function QuickNavCard({ title, description, items }: { title: string; description: string; items: Array<{ label: string; href: string }> }) {
  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h3 className="text-lg font-bold mb-2 text-blue-400">{title}</h3>
      <p className="text-sm text-gray-400 mb-4">{description}</p>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i}>
            <a href={item.href} className="text-gray-300 hover:text-blue-400 transition text-sm">
              → {item.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-3xl font-bold mb-6 text-white">{title}</h2>
      {children}
    </section>
  );
}

function ContentBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-8 border border-gray-700">
      {children}
    </div>
  );
}

function FeatureCard({ title, description, features }: { title: string; description: string; features: string[] }) {
  return (
    <div className="bg-gray-700 rounded-lg p-6">
      <h3 className="text-xl font-bold mb-2 text-blue-400">{title}</h3>
      <p className="text-gray-400 mb-4">{description}</p>
      <ul className="space-y-1">
        {features.map((f, i) => (
          <li key={i} className="text-sm text-gray-300">• {f}</li>
        ))}
      </ul>
    </div>
  );
}

function KeyConcept({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 rounded-lg p-6 border border-blue-500/30">
      <h3 className="text-lg font-bold mb-2 text-yellow-400">{title}</h3>
      <p className="text-gray-200">{description}</p>
    </div>
  );
}

function StateCard({ title, description, operations }: { title: string; description: string; operations: string[] }) {
  return (
    <div className="bg-gray-700 rounded-lg p-5">
      <h4 className="text-lg font-bold mb-2">{title}</h4>
      <p className="text-sm text-gray-400 mb-3">{description}</p>
      <ul className="space-y-1">
        {operations.map((op, i) => (
          <li key={i} className="text-xs text-gray-300">✓ {op}</li>
        ))}
      </ul>
    </div>
  );
}

function RewardType({ title, description, color }: { title: string; description: string; color: string }) {
  const colorClasses = {
    green: 'border-green-500/30 bg-green-900/20',
    yellow: 'border-yellow-500/30 bg-yellow-900/20',
  };
  return (
    <div className={`rounded-lg p-4 border ${colorClasses[color as keyof typeof colorClasses]}`}>
      <h5 className="font-bold mb-1">{title}</h5>
      <p className="text-sm text-gray-300">{description}</p>
    </div>
  );
}

function EmissionPhase({ title, description, details, color }: { title: string; description: string; details: string; color: string }) {
  const colorClasses = {
    blue: 'border-blue-500/30 bg-blue-900/20',
    purple: 'border-purple-500/30 bg-purple-900/20',
  };
  return (
    <div className={`rounded-lg p-5 border ${colorClasses[color as keyof typeof colorClasses]}`}>
      <h4 className="font-bold text-lg mb-2">{title}</h4>
      <p className="text-gray-300 mb-2">{description}</p>
      <p className="text-sm text-gray-400">{details}</p>
    </div>
  );
}

function PoolTypeCard({ title, description, formula, features, color }: { title: string; description: string; formula: string; features: string[]; color: string }) {
  const colorClasses = {
    green: 'from-green-900/40 to-green-800/40 border-green-500/30',
    purple: 'from-purple-900/40 to-purple-800/40 border-purple-500/30',
  };
  return (
    <div className={`rounded-lg p-5 border bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses]}`}>
      <h4 className="font-bold text-xl mb-2">{title}</h4>
      <p className="text-gray-300 mb-3">{description}</p>
      <div className="bg-black/30 rounded px-3 py-2 mb-3">
        <code className="text-sm text-yellow-400">{formula}</code>
      </div>
      <ul className="space-y-1">
        {features.map((f, i) => (
          <li key={i} className="text-sm text-gray-300">• {f}</li>
        ))}
      </ul>
    </div>
  );
}

function OptionCard({ title, description, benefits, tradeoffs }: { title: string; description: string; benefits: string; tradeoffs: string }) {
  return (
    <div className="bg-gray-700 rounded-lg p-4">
      <h4 className="font-bold mb-1">{title}</h4>
      <p className="text-sm text-gray-400 mb-2">{description}</p>
      <p className="text-xs text-green-400 mb-1">✓ {benefits}</p>
      <p className="text-xs text-red-400">✗ {tradeoffs}</p>
    </div>
  );
}

function BenefitCard({ title, description, icon }: { title: string; description: string; icon: string }) {
  const iconDisplay = icon === '💰' ? 'Capital' : icon === '📊' ? 'Flexible' : 'Multiple';
  return (
    <div className="bg-gray-700 rounded-lg p-4 text-center">
      <div className="text-xl font-bold text-blue-400 mb-2">{iconDisplay}</div>
      <h4 className="font-bold mb-1">{title}</h4>
      <p className="text-sm text-gray-400">{description}</p>
    </div>
  );
}

function RewardContractCard({ title, description, examples }: { title: string; description: string; examples: string }) {
  return (
    <div className="bg-gray-700 rounded-lg p-4">
      <h4 className="font-bold mb-1">{title}</h4>
      <p className="text-sm text-gray-400 mb-2">{description}</p>
      <p className="text-xs text-gray-500">Ex: {examples}</p>
    </div>
  );
}

function FeeOptionCard({ title, description, feeType, feeAmount, emission, bestFor }: { title: string; description: string; feeType: string; feeAmount: string; emission?: string; bestFor: string }) {
  return (
    <div className="bg-gray-700 rounded-lg p-5">
      <h4 className="font-bold text-lg mb-2">{title}</h4>
      <p className="text-sm text-gray-400 mb-3">{description}</p>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Fee Type:</span>
          <span className="text-blue-400">{feeType}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Fee Amount:</span>
          <span className="text-green-400">{feeAmount}</span>
        </div>
        {emission && (
          <div className="flex justify-between">
            <span className="text-gray-400">Emissions:</span>
            <span className="text-purple-400">{emission}</span>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-500 mt-3">Best for: {bestFor}</p>
    </div>
  );
}

function OperationCard({ title, description, steps }: { title: string; description: string; steps: string[] }) {
  return (
    <div className="bg-gray-700 rounded-lg p-4">
      <h4 className="font-bold mb-1">{title}</h4>
      <p className="text-sm text-gray-400 mb-2">{description}</p>
      <ol className="text-xs text-gray-500 space-y-1">
        {steps.map((s, i) => (
          <li key={i}>{i + 1}. {s}</li>
        ))}
      </ol>
    </div>
  );
}

function ContractTable({ contracts }: { contracts: Array<{ name: string; address: string; link: string }> }) {
  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-800">
            <th className="py-3 px-4 text-left font-semibold">Contract</th>
            <th className="py-3 px-4 text-left font-semibold">Address</th>
          </tr>
        </thead>
        <tbody>
          {contracts.map((c, i) => (
            <tr key={i} className="border-t border-gray-800">
              <td className="py-3 px-4 font-medium">{c.name}</td>
              <td className="py-3 px-4">
                <a href={c.link} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 font-mono text-xs break-all">
                  {c.address}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GovernanceCard({ title, description, features }: { title: string; description: string; features: string[] }) {
  return (
    <div className="bg-gray-700 rounded-lg p-6">
      <h4 className="font-bold text-xl mb-2 text-blue-400">{title}</h4>
      <p className="text-gray-400 mb-4">{description}</p>
      <ul className="space-y-2">
        {features.map((f, i) => (
          <li key={i} className="text-sm text-gray-300">• {f}</li>
        ))}
      </ul>
    </div>
  );
}

function FlowCard({ step, title, description, details, color }: { step: number; title: string; description: string; details: string; color: string }) {
  const colorClasses = {
    purple: 'border-purple-500/30 bg-purple-900/20',
    green: 'border-green-500/30 bg-green-900/20',
    yellow: 'border-yellow-500/30 bg-yellow-900/20',
  };
  return (
    <div className={`rounded-lg p-5 border ${colorClasses[color as keyof typeof colorClasses]}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-lg">
          {step}
        </div>
        <h4 className="font-bold text-lg">{title}</h4>
      </div>
      <p className="text-sm text-gray-300 mb-2">{description}</p>
      <p className="text-xs text-gray-400">{details}</p>
    </div>
  );
}

function StepCard({ step, title, description, details }: { step: number; title: string; description: string; details: string }) {
  return (
    <div className="bg-gray-700 rounded-lg p-4">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-sm">
          {step}
        </div>
        <div className="flex-1">
          <h4 className="font-bold mb-1">{title}</h4>
          <p className="text-sm text-gray-400 mb-2">{description}</p>
          <p className="text-xs text-gray-500">{details}</p>
        </div>
      </div>
    </div>
  );
}
