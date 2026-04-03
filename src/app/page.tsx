import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen">

      {/* ── HERO ── */}
      <section className="relative pt-10 pb-8 md:pt-20 md:pb-16 text-center px-4">
        {/* Headline */}
        <h1 className="text-4xl sm:text-6xl md:text-8xl font-extrabold tracking-tight mb-5 leading-none">
          <span className="gradient-text">Wind Swap</span>
        </h1>
        <p className="text-base md:text-2xl text-gray-300 font-medium max-w-xl mx-auto mb-3">
          The next-gen DEX on Base
        </p>
        <p className="text-sm md:text-base text-gray-500 max-w-2xl mx-auto mb-10 px-2">
          Swap with the best rates, earn fees as a liquidity provider, and lock WIND to vote on pool incentives and collect rewards every week.
        </p>

        {/* CTAs */}
        <div className="flex flex-wrap gap-3 justify-center mb-12">
          <Link href="/swap">
            <button className="btn-gradient px-8 py-3.5 text-base font-semibold hover:scale-[1.03] active:scale-[0.97] transition-transform">
              Start Trading
            </button>
          </Link>
          <Link href="/pools">
            <button className="btn-secondary px-8 py-3.5 text-base font-semibold hover:scale-[1.03] active:scale-[0.97] transition-transform">
              Add Liquidity
            </button>
          </Link>
          <Link href="/vote">
            <button className="px-8 py-3.5 text-base font-semibold rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 hover:scale-[1.03] active:scale-[0.97] transition-all">
              Lock & Vote
            </button>
          </Link>
        </div>

        {/* Stats Bar */}
        <div className="max-w-2xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-px rounded-2xl overflow-hidden border border-white/8 bg-white/8">
          {[
            { label: 'Liquidity', value: 'V2 + V3', color: 'text-indigo-400' },
            { label: 'Routing', value: 'Best Rate', color: 'text-purple-400' },
            { label: 'Governance', value: 'veWIND', color: 'text-amber-400' },
            { label: 'Network', value: 'Base', color: 'text-blue-400' },
          ].map((s) => (
            <div key={s.label} className="bg-[#0d0d14] px-4 py-4 text-center">
              <div className={`text-xl md:text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="max-w-5xl mx-auto px-4 py-10 md:py-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-4xl font-bold mb-3">How it works</h2>
          <p className="text-gray-400 text-sm md:text-base max-w-lg mx-auto">
            Lock WIND → vote on pools → pools attract liquidity → you earn fees. Every week, forever.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              step: '01',
              title: 'Lock WIND',
              desc: 'Lock WIND tokens to receive veWIND NFTs. Longer lock = more voting power.',
              gradient: 'from-amber-500 to-orange-500',
              icon: (
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              ),
            },
            {
              step: '02',
              title: 'Vote on Pools',
              desc: 'Use your veWIND to vote on which pools receive WIND emissions each week.',
              gradient: 'from-indigo-500 to-violet-500',
              icon: (
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ),
            },
            {
              step: '03',
              title: 'Pools Attract LPs',
              desc: 'Pools with more votes attract liquidity providers chasing higher yields.',
              gradient: 'from-cyan-500 to-blue-500',
              icon: (
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              ),
            },
            {
              step: '04',
              title: 'Earn Every Week',
              desc: 'Collect 100% of trading fees and bribes from every pool you voted for.',
              gradient: 'from-emerald-500 to-teal-500',
              icon: (
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ),
            },
          ].map((item) => (
            <div key={item.step} className="rounded-2xl bg-white/[0.03] border border-white/8 p-5 flex flex-col gap-4 hover:bg-white/[0.05] transition-colors">
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${item.gradient} flex items-center justify-center shrink-0`}>
                {item.icon}
              </div>
              <div>
                <div className="text-[10px] font-bold text-gray-600 tracking-widest mb-1">STEP {item.step}</div>
                <div className="font-bold text-sm md:text-base mb-1.5">{item.title}</div>
                <div className="text-xs text-gray-500 leading-relaxed">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl bg-gradient-to-r from-amber-500/8 to-orange-500/8 border border-amber-500/15 p-4 text-center">
          <span className="text-sm text-gray-400">
            <span className="text-amber-400 font-semibold">The flywheel:</span> better pools → more LPs → more volume → more fees → more voters → better pools
          </span>
        </div>
      </section>

      {/* ── WHY CONCENTRATED LIQUIDITY ── */}
      <section className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-4xl font-bold mb-3">V3 Concentrated Liquidity</h2>
          <p className="text-gray-400 text-sm md:text-base">Up to 4000× more capital efficient than classic AMMs</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gray-700/60 flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div>
                <div className="font-bold">Classic AMM (V2)</div>
                <div className="text-xs text-gray-500">Simple, passive</div>
              </div>
            </div>
            <ul className="space-y-2.5 text-sm text-gray-400">
              {['Liquidity spread across all prices', 'Capital mostly sits idle', 'Lower fees earned per dollar', 'Set and forget — great for beginners'].map(t => (
                <li key={t} className="flex items-start gap-2">
                  <span className="text-gray-600 mt-0.5">—</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-amber-500/8 to-orange-500/5 border border-amber-500/20 p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <div className="font-bold">Concentrated (V3)</div>
                <div className="text-xs text-amber-500">Maximum efficiency</div>
              </div>
            </div>
            <ul className="space-y-2.5 text-sm">
              {[
                'Liquidity focused where trades happen',
                'Every dollar actively earns fees',
                'Up to 4000× better capital efficiency',
                'Earn 10–100× more in trading fees',
              ].map(t => (
                <li key={t} className="flex items-start gap-2 text-gray-300">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>



      {/* ── WIND TOKEN ── */}
      <section className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        <div className="rounded-2xl bg-gradient-to-br from-amber-500/8 via-transparent to-orange-500/5 border border-amber-500/15 p-6 md:p-8">
          <div className="flex flex-col sm:flex-row items-center gap-6 justify-between">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg shadow-amber-500/20 shrink-0">
                <img src="/logo.png" alt="WIND" className="w-full h-full object-contain" />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold mb-1">WIND Token</h2>
                <p className="text-sm text-gray-400 max-w-sm">
                  The governance and rewards token of Wind Swap. Lock it, vote with it, and earn real yield from protocol fees every week.
                </p>
              </div>
            </div>
            <div className="flex gap-3 shrink-0">
              <Link href="/swap">
                <button className="btn-gradient px-5 py-2.5 text-sm font-semibold hover:scale-[1.03] active:scale-95 transition-transform">
                  Get WIND
                </button>
              </Link>
              <Link href="/vote">
                <button className="btn-secondary px-5 py-2.5 text-sm font-semibold hover:scale-[1.03] active:scale-95 transition-transform">
                  Lock & Vote
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
