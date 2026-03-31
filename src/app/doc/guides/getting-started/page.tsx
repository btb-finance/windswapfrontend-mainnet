
'use client';

import React from 'react';
import Link from 'next/link';

export default function GettingStartedGuide() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link href="/doc" className="text-blue-400 hover:text-blue-300 mb-8 inline-block">
          ← Back to Documentation
        </Link>

        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-green-400 to-blue-600 bg-clip-text text-transparent">
          Getting Started with Wind Swap
        </h1>
        <p className="text-xl text-gray-400 mb-12">
          A step-by-step guide to participating in the Wind Swap ecosystem on Base Mainnet
        </p>

        <div className="space-y-8">
          {/* Step 1 */}
          <GuideStep step={1} title="Get WIND Tokens">
            <p className="text-gray-300 mb-4">
              Before you can participate in governance or earn rewards, you'll need WIND tokens:
            </p>
            <div className="bg-gray-800 rounded-lg p-5 space-y-3">
              <ActionItem
                title="Buy on DEX"
                description="Purchase WIND from Wind Swap or other DEXs on Sei Network"
              />
              <ActionItem
                title="Earn from Liquidity"
                description="Provide liquidity and earn WIND emissions"
              />
              <ActionItem
                title="Receive as Airdrop"
                description="Check if you're eligible for protocol airdrops"
              />
            </div>
          </GuideStep>

          {/* Step 2 */}
          <GuideStep step={2} title="Lock WIND for veNFT (Long-Term Passive Income)">
            <p className="text-gray-300 mb-4">
              Create a Vote-Escrowed NFT to establish long-term passive income. Think of this as setting up a 
              pension fund - you lock WIND for 4-5 years and earn weekly rewards indefinitely.
            </p>
            <div className="bg-gray-800 rounded-lg p-5 mb-4">
              <h4 className="font-bold mb-3 text-purple-400">Lock Parameters</h4>
              <ul className="space-y-2 text-gray-300">
                <li>• <strong>Amount:</strong> How many WIND to lock</li>
                <li>• <strong>Duration:</strong> Lock time (1 week to 4 years)</li>
                <li>• <strong>Voting Power:</strong> Amount × Lock Time</li>
              </ul>
            </div>
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-4">
              <p className="text-blue-200">
                <strong>Long-Term Strategy:</strong> Lock WIND for maximum duration (4 years) to create sustainable 
                passive income. Your veNFT will earn weekly rebases (protocol emissions) plus you can vote for 
                pools to earn bribes and trading fees. You can sell your veNFT anytime on NFT marketplaces if 
                you need liquidity.
              </p>
            </div>
            <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
              <h4 className="font-bold mb-2 text-green-300">Passive Income Breakdown</h4>
              <ul className="space-y-1 text-gray-300 text-sm">
                <li>• <strong>Rebases:</strong> Automatic weekly WIND distribution</li>
                <li>• <strong>Voter Rewards:</strong> Trading fees + bribes from voted pools</li>
                <li>• <strong>Flexible:</strong> Sell veNFT anytime or merge into permanent lock</li>
                <li>• <strong>Time Horizon:</strong> 4-5 years for maximum returns</li>
              </ul>
            </div>
          </GuideStep>

          {/* Step 3 */}
          <GuideStep step={3} title="Choose Your Strategy">
            <p className="text-gray-300 mb-4">
              Decide how you want to participate in the ecosystem:
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <StrategyCard
                title="Voter (Passive Income)"
                description="Vote with veNFT and earn weekly rewards"
                icon="VOTE"
                steps={[
                  'Lock WIND for 4 years (maximum veNFT)',
                  'Research pools with highest bribes',
                  'Vote weekly (Thursday to Thursday)',
                  'Claim rebases + bribes + fees',
                  'Passive income for 4-5 years',
                ]}
              />
              <StrategyCard
                title="Liquidity Provider"
                description="Provide liquidity and earn higher yields"
                icon="LP"
                steps={[
                  'Choose V2 or V3 pool',
                  'Add liquidity tokens',
                  'Stake LP tokens in gauge',
                  'Earn WIND emissions + fees',
                  'Higher yields than unstaked LP',
                ]}
              />
              <StrategyCard
                title="Managed NFT"
                description="Deposit into managed service for auto-compounding"
                icon="MGT"
                steps={[
                  'Find trusted managed NFT service',
                  'Deposit your veNFT',
                  'Service optimizes voting',
                  'Earn compounded returns',
                  'Pay performance fee',
                ]}
              />
              <StrategyCard
                title="Trader"
                description="Swap tokens on Wind Swap"
                icon="TRD"
                steps={[
                  'Use V2 for stable pairs (low slippage)',
                  'Use V3 for volatile pairs (capital efficient)',
                  'Benefit from deep liquidity',
                  'Low fees on Base Network',
                ]}
              />
            </div>
          </GuideStep>

          {/* Step 4 */}
          <GuideStep step={4} title="Voting for Pools">
            <p className="text-gray-300 mb-4">
              Use your veNFT to direct emissions and earn rewards:
            </p>
            <div className="bg-gray-800 rounded-lg p-5 mb-4">
              <h4 className="font-bold mb-3 text-yellow-400">Weekly Voting Process</h4>
              <ol className="space-y-3 text-gray-300">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-yellow-600 flex items-center justify-center font-bold">1</span>
                  <div>
                    <strong>Research:</strong> Check bribe amounts and fee potential
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-yellow-600 flex items-center justify-center font-bold">2</span>
                  <div>
                    <strong>Vote:</strong> Allocate your voting power to chosen pools (max 30)
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-yellow-600 flex items-center justify-center font-bold">3</span>
                  <div>
                    <strong>Wait:</strong> Voting ends at epoch close (Thursday midnight UTC)
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-yellow-600 flex items-center justify-center font-bold">4</span>
                  <div>
                    <strong>Claim:</strong> Collect rewards from previous week's votes
                  </div>
                </li>
              </ol>
            </div>
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
              <p className="text-yellow-200">
                <strong>Important:</strong> You can only vote OR deposit into a managed NFT each epoch, not both. 
                Plan your strategy accordingly!
              </p>
            </div>
          </GuideStep>

          {/* Step 5 */}
          <GuideStep step={5} title="Providing Liquidity (Higher Yields)">
            <p className="text-gray-300 mb-4">
              Earn WIND emissions by providing liquidity to voted pools. Staked LPs earn HIGHER yields than 
              unstaked LPs because they receive emissions in addition to trading fees.
            </p>
            <div className="space-y-4">
              <div className="bg-gray-800 rounded-lg p-5">
                <h4 className="font-bold mb-3 text-green-400">V2 Liquidity</h4>
                <ul className="space-y-2 text-gray-300">
                  <li>• Choose stable or volatile pool</li>
                  <li>• Deposit both tokens in 50/50 value ratio</li>
                  <li>• Stake LP tokens in gauge to earn emissions</li>
                  <li>• Unstaked LPs earn trading fees only (lower yield)</li>
                </ul>
                <div className="mt-3 bg-green-900/20 border border-green-500/30 rounded p-3">
                  <p className="text-sm text-green-200">
                    <strong>Higher Yields:</strong> Staked LPs give up some trading fees to voters but receive 
                    valuable WIND emissions, typically resulting in higher overall returns.
                  </p>
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-5">
                <h4 className="font-bold mb-3 text-blue-400">V3 Liquidity</h4>
                <ul className="space-y-2 text-gray-300">
                  <li>• Choose your price range (capital efficient)</li>
                  <li>• Wider ranges = less risk, less return</li>
                  <li>• Narrower ranges = more risk, more return</li>
                  <li>• Stake NFT position in gauge for emissions</li>
                  <li>• Only active tick liquidity earns emissions</li>
                </ul>
                <div className="mt-3 bg-blue-900/20 border border-blue-500/30 rounded p-3">
                  <p className="text-sm text-blue-200">
                    <strong>Active Tick Rewards:</strong> V3 gauges only reward liquidity in the current price tick. 
                    This maximizes capital efficiency by rewarding useful liquidity.
                  </p>
                </div>
              </div>
            </div>
          </GuideStep>

          {/* Step 6 */}
          <GuideStep step={6} title="Claiming Rewards">
            <p className="text-gray-300 mb-4">
              Don't forget to claim your hard-earned rewards:
            </p>
            <div className="bg-gray-800 rounded-lg p-5 space-y-4">
              <RewardTypeCard
                title="Voter Rewards"
                types={['Bribes (external incentives)', 'Trading fees from staked LPs']}
                frequency="Weekly (after epoch flip)"
              />
              <RewardTypeCard
                title="LP Rewards"
                types={['WIND emissions', 'Trading fees (if unstaked)']}
                frequency="Continuous (claim anytime)"
              />
              <RewardTypeCard
                title="Rebases"
                types={['Extra WIND distribution', 'Proportional to locked amount']}
                frequency="Weekly (automatic)"
              />
            </div>
          </GuideStep>

          {/* Advanced Tips */}
          <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-lg p-6 border border-purple-500/30">
            <h3 className="text-2xl font-bold mb-4 text-purple-400">Advanced Strategies</h3>
            <div className="space-y-4">
              <TipCard
                title="Permanent Locking"
                description="Permanently lock WIND to maintain maximum voting power without decay. Best for long-term holders."
                risk="High commitment, can't withdraw tokens (only sell NFT)"
              />
              <TipCard
                title="Managed NFTs"
                description="Deposit into managed NFT for auto-compounding and optimized voting. Passive income with expert management."
                risk="Must trust manager, pay performance fees"
              />
              <TipCard
                title="Vote Optimization"
                description="Research and vote for pools with highest bribes each week. Active strategy for maximum returns."
                risk="Bribes fluctuate weekly, requires time investment"
              />
              <TipCard
                title="Liquidity Provision"
                description="Provide liquidity to high-volume pools. Earn fees + emissions by staking in gauges."
                risk="Impermanent loss possible, requires monitoring"
              />
              <TipCard
                title="NFT Splitting/Merging"
                description="Split or merge veNFTs to optimize voting strategy across multiple pools."
                risk="Gas costs, adds complexity"
              />
            </div>
          </div>

          {/* Security */}
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6">
            <h3 className="text-2xl font-bold mb-4 text-red-400">Security Best Practices</h3>
            <ul className="space-y-2 text-gray-300">
              <li>• Never share your private keys or seed phrase</li>
              <li>• Verify contract addresses on BaseScan</li>
              <li>• Be cautious of phishing attempts</li>
              <li>• Start with small amounts to test</li>
              <li>• Understand the risks of impermanent loss</li>
              <li>• Keep your veNFT secure - it's valuable!</li>
              <li>• Research before voting for new pools</li>
            </ul>
          </div>

          {/* Resources */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-2xl font-bold mb-4 text-blue-400">Additional Resources</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <ResourceLink
                title="Full Documentation"
                href="/doc"
                description="Complete protocol documentation"
              />
              <ResourceLink
                title="Etherscan Explorer"
                href="https://etherscan.io"
                description="View transactions and contracts"
              />
              <ResourceLink
                title="Governance Portal"
                href="/vote"
                description="Participate in protocol governance"
              />
              <ResourceLink
                title="Community"
                href="#"
                description="Join the Wind Swap community"
              />
            </div>
          </div>
        </div>

        <div className="mt-12 text-center text-gray-400">
          <p>Happy trading and farming on Wind Swap!</p>
        </div>
      </div>
    </div>
  );
}

function GuideStep({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xl font-bold">
          {step}
        </div>
        <h2 className="text-2xl font-bold">{title}</h2>
      </div>
      <div>{children}</div>
    </div>
  );
}

function ActionItem({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex gap-3">
      <div className="w-2 h-2 rounded-full bg-blue-400 mt-2 flex-shrink-0"></div>
      <div>
        <h4 className="font-semibold text-blue-400">{title}</h4>
        <p className="text-sm text-gray-400">{description}</p>
      </div>
    </div>
  );
}

function StrategyCard({ title, description, icon, steps }: { title: string; description: string; icon: string; steps: string[] }) {
  const iconDisplay = icon === 'VOTE' ? 'VOTE' : icon === 'LP' ? 'LP' : icon === 'MGT' ? 'MGD' : 'TRD';
  return (
    <div className="bg-gray-700 rounded-lg p-5">
      <div className="text-xl font-bold text-blue-400 mb-2">{iconDisplay}</div>
      <h4 className="font-bold text-lg mb-1">{title}</h4>
      <p className="text-sm text-gray-400 mb-3">{description}</p>
      <ol className="text-xs text-gray-300 space-y-1">
        {steps.map((s, i) => (
          <li key={i}>{i + 1}. {s}</li>
        ))}
      </ol>
    </div>
  );
}

function RewardTypeCard({ title, types, frequency }: { title: string; types: string[]; frequency: string }) {
  return (
    <div className="bg-gray-700/50 rounded p-4">
      <h4 className="font-bold mb-2">{title}</h4>
      <ul className="text-sm text-gray-300 mb-2">
        {types.map((t, i) => (
          <li key={i}>• {t}</li>
        ))}
      </ul>
      <p className="text-xs text-gray-500">Frequency: {frequency}</p>
    </div>
  );
}

function TipCard({ title, description, risk }: { title: string; description: string; risk: string }) {
  return (
    <div className="bg-gray-800/50 rounded p-4">
      <h4 className="font-bold text-purple-300 mb-1">{title}</h4>
      <p className="text-sm text-gray-300 mb-2">{description}</p>
      <p className="text-xs text-red-400">⚠️ {risk}</p>
    </div>
  );
}

function ResourceLink({ title, href, description }: { title: string; href: string; description: string }) {
  return (
    <a href={href} className="block bg-gray-700 rounded p-4 hover:bg-gray-600 transition">
      <h4 className="font-bold text-blue-400 mb-1">{title}</h4>
      <p className="text-sm text-gray-400">{description}</p>
    </a>
  );
}
