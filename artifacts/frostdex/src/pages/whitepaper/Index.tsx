import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { withBasePath } from "@/utils/base-path";

const Section = ({ id, children }: { id?: string; children: React.ReactNode }) => (
  <section id={id} className="mx-auto max-w-4xl px-6 py-14 border-b border-white/5">
    {children}
  </section>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-2xl font-bold mb-6" style={{ color: "rgba(56,224,248,0.9)" }}>
    {children}
  </h2>
);

const FeatureCard = ({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) => (
  <div
    className="rounded-xl p-5 flex gap-4"
    style={{
      background: "rgba(56,224,248,0.04)",
      border: "1px solid rgba(56,224,248,0.12)",
    }}
  >
    <span className="text-2xl mt-0.5">{icon}</span>
    <div>
      <h3 className="font-semibold text-white mb-1">{title}</h3>
      <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.54)" }}>
        {description}
      </p>
    </div>
  </div>
);

const StepCard = ({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) => (
  <div className="flex gap-4">
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5"
      style={{ background: "rgba(56,224,248,0.15)", color: "rgba(56,224,248,0.9)" }}
    >
      {number}
    </div>
    <div>
      <h3 className="font-semibold text-white mb-1">{title}</h3>
      <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.54)" }}>
        {description}
      </p>
    </div>
  </div>
);

export default function WhitepaperIndex() {
  return (
    <>
      <Helmet>
        <title>Whitepaper — FrostDex</title>
        <meta
          name="description"
          content="FrostDex Whitepaper — learn about the protocol, features, and vision behind the decentralized exchange."
        />
      </Helmet>

      <div
        className="min-h-screen"
        style={{ background: "radial-gradient(ellipse at 50% 0%, #0d1219 0%, #0b0e11 70%)" }}
      >
        {/* ── Top Nav ── */}
        <nav
          className="sticky top-0 z-50 flex items-center justify-between px-6 py-3"
          style={{
            background: "rgba(11,14,17,0.88)",
            borderBottom: "1px solid rgba(56,224,248,0.08)",
            backdropFilter: "blur(12px)",
          }}
        >
          <Link to="/" className="flex items-center gap-2 no-underline">
            <img
              src={withBasePath("/logo.webp")}
              alt="FrostDex"
              style={{ height: "34px" }}
            />
          </Link>

          <div className="flex items-center gap-4">
            <a
              href="#features"
              className="text-sm no-underline hidden md:block"
              style={{ color: "rgba(255,255,255,0.6)" }}
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="text-sm no-underline hidden md:block"
              style={{ color: "rgba(255,255,255,0.6)" }}
            >
              How it works
            </a>
            <a
              href="#tokenomics"
              className="text-sm no-underline hidden md:block"
              style={{ color: "rgba(255,255,255,0.6)" }}
            >
              Token
            </a>
            <Link
              to="/"
              className="text-sm font-semibold no-underline px-4 py-1.5 rounded-lg"
              style={{
                background: "rgba(56,224,248,0.12)",
                color: "rgba(56,224,248,0.9)",
                border: "1px solid rgba(56,224,248,0.2)",
              }}
            >
              Launch App
            </Link>
          </div>
        </nav>

        {/* ── Hero ── */}
        <div className="mx-auto max-w-4xl px-6 pt-20 pb-16 text-center">
          <div
            className="inline-block text-xs font-semibold tracking-widest uppercase mb-6 px-4 py-1.5 rounded-full"
            style={{
              background: "rgba(56,224,248,0.08)",
              color: "rgba(56,224,248,0.7)",
              border: "1px solid rgba(56,224,248,0.15)",
            }}
          >
            ❄ Whitepaper v1.0
          </div>

          <h1
            className="text-4xl md:text-5xl font-bold mb-6 leading-tight"
            style={{
              background: "linear-gradient(135deg, #fff 30%, rgba(56,224,248,0.85) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            FrostDex
            <br />
            <span className="text-3xl md:text-4xl font-medium">
              The Future of Decentralized Trading
            </span>
          </h1>

          <p
            className="text-base md:text-lg leading-relaxed max-w-2xl mx-auto mb-10"
            style={{ color: "rgba(255,255,255,0.6)" }}
          >
            FrostDex is a next-generation decentralized exchange (DEX) offering
            perpetual futures trading with institutional-grade liquidity, ultra-low
            fees, and zero KYC — powered by the Orderly Network's cross-chain
            infrastructure.
          </p>

          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/"
              className="no-underline px-6 py-2.5 rounded-lg font-semibold text-sm"
              style={{
                background: "rgba(56,224,248,0.15)",
                color: "rgba(56,224,248,1)",
                border: "1px solid rgba(56,224,248,0.3)",
              }}
            >
              Start Trading
            </Link>
            <a
              href="#features"
              className="no-underline px-6 py-2.5 rounded-lg font-semibold text-sm"
              style={{
                background: "rgba(255,255,255,0.05)",
                color: "rgba(255,255,255,0.7)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              Read More ↓
            </a>
          </div>
        </div>

        {/* ── What is FrostDex ── */}
        <Section>
          <SectionTitle>What is FrostDex?</SectionTitle>
          <p className="text-base leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.72)" }}>
            FrostDex is a decentralized perpetual futures exchange that gives traders
            access to deep, shared liquidity across multiple blockchains. Unlike
            traditional centralized exchanges, FrostDex is fully non-custodial —
            your assets stay in your wallet until you choose to trade.
          </p>
          <p className="text-base leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.72)" }}>
            Built on the <strong style={{ color: "rgba(56,224,248,0.85)" }}>Orderly Network</strong>, 
            FrostDex benefits from a shared liquidity layer that aggregates order books across all
            connected DEXs, giving users tighter spreads and deeper markets than any
            single exchange could achieve alone.
          </p>
          <p className="text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.72)" }}>
            Our mission is to make professional-grade derivatives trading accessible
            to everyone — anywhere in the world, without barriers.
          </p>
        </Section>

        {/* ── Key Features ── */}
        <Section id="features">
          <SectionTitle>Key Features</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FeatureCard
              icon="📈"
              title="Perpetual Futures Trading"
              description="Trade BTC, ETH, SOL and 50+ assets with up to 50× leverage. Long or short any market 24/7 with no expiry date."
            />
            <FeatureCard
              icon="💧"
              title="Deep Cross-Chain Liquidity"
              description="FrostDex taps into shared order books across EVM and Solana ecosystems, ensuring tight spreads and minimal slippage at all times."
            />
            <FeatureCard
              icon="🛡️"
              title="Non-Custodial & Permissionless"
              description="No KYC required. Your funds remain in your wallet. Connect, deposit to trade, and withdraw whenever you want."
            />
            <FeatureCard
              icon="💸"
              title="Ultra-Low Fees"
              description="Maker fees as low as 0% and competitive taker fees. No hidden costs — what you see is what you pay."
            />
            <FeatureCard
              icon="🤖"
              title="AI-Powered Assistant"
              description="FrostDex's built-in AI chat assistant helps you analyze markets, understand positions, and make smarter trading decisions."
            />
            <FeatureCard
              icon="⚡"
              title="Automated Trading Bot"
              description="Set up automated strategies with the FrostDex Bot. Backtest your strategies and let the bot execute trades on your behalf."
            />
            <FeatureCard
              icon="📊"
              title="Advanced Charting"
              description="Professional-grade TradingView charts with dozens of indicators, drawing tools, and real-time order book data."
            />
            <FeatureCard
              icon="🏆"
              title="Leaderboards & Rewards"
              description="Compete in trading competitions, earn rewards for referrals, and climb the leaderboard to unlock exclusive perks."
            />
          </div>
        </Section>

        {/* ── How it Works ── */}
        <Section id="how-it-works">
          <SectionTitle>How It Works</SectionTitle>
          <div className="flex flex-col gap-8">
            <StepCard
              number={1}
              title="Connect Your Wallet"
              description="Connect any EVM-compatible wallet (MetaMask, WalletConnect, Privy, and more) or a Solana wallet. No account creation or email required."
            />
            <StepCard
              number={2}
              title="Deposit Collateral"
              description="Deposit USDC or supported assets as collateral. Your funds are secured by smart contracts and can be withdrawn at any time."
            />
            <StepCard
              number={3}
              title="Choose a Market"
              description="Browse 50+ perpetual markets across crypto assets. Use the Markets page to compare funding rates, open interest, and 24h volume."
            />
            <StepCard
              number={4}
              title="Open a Position"
              description="Go long or short with your chosen leverage. Set take-profit and stop-loss orders to manage risk automatically."
            />
            <StepCard
              number={5}
              title="Manage & Withdraw"
              description="Monitor all your positions, orders, and PnL from the Portfolio dashboard. Withdraw your profits to your wallet at any time."
            />
          </div>
        </Section>

        {/* ── Architecture ── */}
        <Section>
          <SectionTitle>Architecture</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[
              {
                label: "Shared Order Book",
                desc: "All trades on FrostDex contribute to and benefit from a single unified order book, providing maximum depth.",
              },
              {
                label: "On-Chain Settlement",
                desc: "Every trade is settled on-chain via audited smart contracts. No centralized server controls your funds.",
              },
              {
                label: "Cross-Chain Bridge",
                desc: "Deposit from Arbitrum, Base, Optimism, Polygon, Solana, and more — all in one unified experience.",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl p-5 text-center"
                style={{
                  background: "rgba(56,224,248,0.04)",
                  border: "1px solid rgba(56,224,248,0.1)",
                }}
              >
                <h3
                  className="font-semibold mb-2 text-sm"
                  style={{ color: "rgba(56,224,248,0.85)" }}
                >
                  {item.label}
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Tokenomics / Launch Token — Coming Soon ── */}
        <Section id="tokenomics">
          <SectionTitle>Launch Token</SectionTitle>

          <div
            className="rounded-2xl p-8 md:p-12 text-center relative overflow-hidden"
            style={{
              background:
                "linear-gradient(135deg, rgba(56,224,248,0.07) 0%, rgba(14,203,129,0.05) 100%)",
              border: "1px solid rgba(56,224,248,0.2)",
            }}
          >
            {/* Glow */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse at 50% 0%, rgba(56,224,248,0.08) 0%, transparent 70%)",
              }}
            />

            <div className="relative z-10">
              <div
                className="inline-block text-xs font-bold tracking-widest uppercase mb-5 px-4 py-1.5 rounded-full"
                style={{
                  background: "rgba(56,224,248,0.1)",
                  color: "rgba(56,224,248,0.8)",
                  border: "1px solid rgba(56,224,248,0.2)",
                }}
              >
                🚀 Coming Soon
              </div>

              <h3 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Create Your Token
              </h3>

              <p
                className="text-base leading-relaxed max-w-xl mx-auto mb-8"
                style={{ color: "rgba(255,255,255,0.6)" }}
              >
                FrostDex is building a fully on-chain token launchpad. 
                Create, launch, and manage your own token directly on FrostDex — 
                with built-in liquidity, trading pairs, and distribution tools.
                No technical knowledge required.
              </p>

              <div className="flex flex-wrap justify-center gap-6 mb-10">
                {[
                  { label: "Token Creation", value: "1-Click Deploy" },
                  { label: "Built-in Liquidity", value: "Instant Pairs" },
                  { label: "Distribution", value: "Fair Launch" },
                  { label: "Access", value: "No-Code" },
                ].map((stat) => (
                  <div key={stat.label} className="text-center">
                    <div
                      className="text-lg font-bold mb-0.5"
                      style={{ color: "rgba(56,224,248,0.9)" }}
                    >
                      {stat.value}
                    </div>
                    <div
                      className="text-xs"
                      style={{ color: "rgba(255,255,255,0.45)" }}
                    >
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>

              <button
                disabled
                className="px-8 py-3 rounded-xl text-sm font-bold cursor-not-allowed"
                style={{
                  background: "rgba(56,224,248,0.08)",
                  color: "rgba(56,224,248,0.45)",
                  border: "1px solid rgba(56,224,248,0.15)",
                }}
              >
                ❄ Coming Soon — Stay Tuned
              </button>
            </div>
          </div>
        </Section>

        {/* ── CTA ── */}
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">
            Ready to start trading?
          </h2>
          <p className="text-sm mb-8" style={{ color: "rgba(255,255,255,0.5)" }}>
            Join thousands of traders already using FrostDex.
          </p>
          <Link
            to="/"
            className="no-underline inline-block px-8 py-3 rounded-xl font-bold text-sm"
            style={{
              background: "rgba(56,224,248,0.15)",
              color: "rgba(56,224,248,1)",
              border: "1px solid rgba(56,224,248,0.3)",
            }}
          >
            Launch FrostDex →
          </Link>
        </div>

        {/* ── Footer ── */}
        <footer
          className="text-center py-6 text-xs"
          style={{
            color: "rgba(255,255,255,0.25)",
            borderTop: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          ❄ Powered by FrostDex · {new Date().getFullYear()}
        </footer>
      </div>
    </>
  );
}
