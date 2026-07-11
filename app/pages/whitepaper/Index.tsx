import { Helmet } from "react-helmet-async";
import { generatePageTitle } from "@/utils/utils";
import { withBasePath } from "@/utils/base-path";
import { Zap, Shield, DollarSign, Globe, Layers, TrendingUp, BookOpen, Snowflake, ChevronRight, Download } from "lucide-react";

const CYAN = "rgba(56,224,248,0.9)";
const GREEN = "#0ecb81";

function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`oui-rounded-2xl oui-p-6 md:oui-p-8 ${className}`}
      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
      {children}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="oui-inline-flex oui-items-center oui-gap-1.5 oui-text-xs oui-font-semibold oui-px-3 oui-py-1 oui-rounded-full"
      style={{ background: `${CYAN}15`, color: CYAN, border: `1px solid ${CYAN}30` }}>
      {children}
    </span>
  );
}

export default function WhitepaperIndex() {
  return (
    <>
      <Helmet><title>{generatePageTitle("Whitepaper")}</title></Helmet>
      <div className="oui-min-h-screen oui-bg-base-9 oui-text-base-contrast-80">
        <div className="oui-max-w-5xl oui-mx-auto oui-px-4 oui-py-8 oui-space-y-8">

          {/* ── Hero image ── */}
          <div className="oui-rounded-2xl oui-overflow-hidden oui-relative" style={{ border: "1px solid rgba(56,224,248,0.15)" }}>
            <img
              src={withBasePath("/whitepaper-hero.webp")}
              alt="FrostDex — A Next-Generation Decentralized Exchange"
              className="oui-w-full oui-object-cover"
              style={{ maxHeight: "360px", objectPosition: "center" }}
            />
          </div>

          {/* ── Title block ── */}
          <div className="oui-text-center oui-space-y-3">
            <div className="oui-flex oui-justify-center oui-gap-2 oui-flex-wrap">
              <Badge><Snowflake size={12} /> FrostDex Whitepaper</Badge>
              <Badge>v1.0 — 2025</Badge>
            </div>
            <h1 className="oui-text-3xl md:oui-text-5xl oui-font-black oui-text-base-contrast oui-leading-tight">
              A Next-Generation<br />
              <span style={{ color: CYAN }}>Decentralized Exchange</span>
            </h1>
            <p className="oui-text-base oui-text-base-contrast-54 oui-max-w-2xl oui-mx-auto">
              Built for <span style={{ color: GREEN }} className="oui-font-semibold">fast, secure</span> and{" "}
              <span style={{ color: GREEN }} className="oui-font-semibold">limitless</span> DeFi trading with
              ultra-low fees and true financial freedom.
            </p>
          </div>

          {/* ── Feature cards ── */}
          <div className="oui-grid oui-grid-cols-2 md:oui-grid-cols-4 oui-gap-4">
            {[
              { icon: <Zap size={22} />, title: "Fast Trading", desc: "Sub-second order execution powered by Orderly's shared orderbook", color: CYAN },
              { icon: <Shield size={22} />, title: "Secure & Trustless", desc: "Non-custodial architecture — your keys, your funds, always", color: "#a78bfa" },
              { icon: <DollarSign size={22} />, title: "Ultra-Low Fees", desc: "Maker rebates and taker fees starting from 0.02%", color: GREEN },
              { icon: <Globe size={22} />, title: "Financial Freedom", desc: "Trade permissionlessly from anywhere, any time, any asset", color: "#fb923c" },
            ].map((f) => (
              <div key={f.title} className="oui-rounded-xl oui-p-5 oui-text-center oui-space-y-3"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="oui-flex oui-justify-center">
                  <div className="oui-rounded-xl oui-p-3" style={{ background: `${f.color}15`, color: f.color }}>
                    {f.icon}
                  </div>
                </div>
                <p className="oui-text-sm oui-font-bold oui-text-base-contrast">{f.title}</p>
                <p className="oui-text-xs oui-text-base-contrast-36 oui-leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* ── Abstract ── */}
          <Section>
            <div className="oui-flex oui-items-center oui-gap-2 oui-mb-4">
              <BookOpen size={16} style={{ color: CYAN }} />
              <h2 className="oui-text-lg oui-font-bold oui-text-base-contrast">Abstract</h2>
            </div>
            <p className="oui-text-sm oui-text-base-contrast-54 oui-leading-relaxed oui-mb-3">
              FrostDex is a high-performance, non-custodial perpetuals DEX built on top of
              <span className="oui-text-base-contrast oui-font-semibold"> Orderly Network</span>'s
              shared infrastructure. By leveraging a unified cross-chain orderbook, FrostDex delivers
              a centralized-exchange-grade trading experience while preserving full self-custody and
              on-chain settlement guarantees.
            </p>
            <p className="oui-text-sm oui-text-base-contrast-54 oui-leading-relaxed">
              Traders on FrostDex benefit from deep, aggregated liquidity contributed by every broker
              connected to the Orderly Network, resulting in tighter spreads and superior price discovery
              compared to isolated AMM-based venues. Positions are settled on-chain — ensuring
              transparency, censorship-resistance, and permissionless access for all users globally.
            </p>
          </Section>

          {/* ── Built on Orderly Network ── */}
          <Section>
            <div className="oui-flex oui-items-center oui-gap-2 oui-mb-6">
              <Layers size={16} style={{ color: CYAN }} />
              <h2 className="oui-text-lg oui-font-bold oui-text-base-contrast">Built on Orderly Network</h2>
            </div>
            <div className="oui-grid oui-grid-cols-1 md:oui-grid-cols-2 oui-gap-4 oui-mb-6">
              {[
                { title: "Shared Orderbook", desc: "Every trade is matched against the deepest unified liquidity pool across all Orderly-connected brokers, ensuring best-in-class execution." },
                { title: "Cross-Chain Settlement", desc: "Orderly Network supports Arbitrum, Optimism, Base, Blast, and more — letting traders deposit, trade, and withdraw on their preferred chain." },
                { title: "Permissioned Matching", desc: "The Orderly matching engine operates off-chain for speed, with on-chain settlement ensuring all trades are verifiable and final." },
                { title: "Risk Engine", desc: "Built-in cross-margin risk management, liquidation engine, and insurance fund protect traders and maintain market integrity at all times." },
              ].map((item) => (
                <div key={item.title} className="oui-flex oui-gap-3">
                  <div className="oui-mt-1 oui-flex-shrink-0">
                    <ChevronRight size={14} style={{ color: CYAN }} />
                  </div>
                  <div>
                    <p className="oui-text-sm oui-font-semibold oui-text-base-contrast oui-mb-1">{item.title}</p>
                    <p className="oui-text-xs oui-text-base-contrast-36 oui-leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Supported chains */}
            <div>
              <p className="oui-text-xs oui-font-semibold oui-text-base-contrast-36 oui-uppercase oui-tracking-widest oui-mb-3">Supported Networks</p>
              <div className="oui-flex oui-flex-wrap oui-gap-2">
                {["Arbitrum", "Optimism", "Base", "Blast", "Polygon", "Mantle", "zkSync"].map((chain) => (
                  <span key={chain}
                    className="oui-text-xs oui-font-semibold oui-px-3 oui-py-1.5 oui-rounded-full"
                    style={{
                      background: chain === "Blast" ? `${GREEN}15` : "rgba(255,255,255,0.05)",
                      color: chain === "Blast" ? GREEN : "rgba(255,255,255,0.6)",
                      border: chain === "Blast" ? `1px solid ${GREEN}40` : "1px solid rgba(255,255,255,0.08)",
                    }}>
                    {chain === "Blast" ? "⚡ " : ""}{chain}
                  </span>
                ))}
              </div>
            </div>
          </Section>

          {/* ── Platform Features ── */}
          <Section>
            <div className="oui-flex oui-items-center oui-gap-2 oui-mb-6">
              <TrendingUp size={16} style={{ color: CYAN }} />
              <h2 className="oui-text-lg oui-font-bold oui-text-base-contrast">Platform Features</h2>
            </div>
            <div className="oui-grid oui-grid-cols-1 sm:oui-grid-cols-2 oui-gap-3">
              {[
                "Perpetual futures on 50+ assets",
                "Up to 100× leverage",
                "Portfolio margin with cross-collateral",
                "Advanced order types — limit, market, stop, TP/SL, trailing stop",
                "TradingView-powered professional charts",
                "One-click trading mode",
                "Affiliate & referral program (up to 20% rebate)",
                "FrostAI — AI trading assistant powered by Groq",
                "Real-time whale alert tracker",
                "Market sentiment dashboard",
                "Grid & DCA trading bots",
                "PnL sharing cards",
                "Multi-language interface",
                "Dark-mode only — optimized for traders",
              ].map((feat) => (
                <div key={feat} className="oui-flex oui-items-start oui-gap-2">
                  <span className="oui-font-bold oui-text-xs oui-mt-0.5 oui-flex-shrink-0" style={{ color: CYAN }}>✦</span>
                  <p className="oui-text-sm oui-text-base-contrast-54">{feat}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* ── FROST Token ── */}
          <Section>
            <div className="oui-flex oui-items-center oui-justify-between oui-mb-4 oui-flex-wrap oui-gap-2">
              <div className="oui-flex oui-items-center oui-gap-2">
                <Snowflake size={16} style={{ color: CYAN }} />
                <h2 className="oui-text-lg oui-font-bold oui-text-base-contrast">FROST Token</h2>
              </div>
              <span className="oui-text-xs oui-font-bold oui-px-3 oui-py-1.5 oui-rounded-full oui-animate-pulse"
                style={{ background: `${CYAN}15`, color: CYAN, border: `1px solid ${CYAN}30` }}>
                Coming Soon
              </span>
            </div>
            <p className="oui-text-sm oui-text-base-contrast-54 oui-leading-relaxed oui-mb-4">
              The <span className="oui-font-semibold oui-text-base-contrast">FROST token</span> is the
              native governance and utility token of the FrostDex ecosystem. Token holders will be able
              to participate in protocol governance, earn staking rewards, and receive fee discounts on
              the platform.
            </p>
            <div className="oui-grid oui-grid-cols-2 md:oui-grid-cols-4 oui-gap-3">
              {[
                { label: "Ticker", value: "FROST" },
                { label: "Chain", value: "TBA" },
                { label: "Total Supply", value: "TBA" },
                { label: "Launch", value: "TBA" },
              ].map((t) => (
                <div key={t.label} className="oui-rounded-lg oui-p-3 oui-text-center"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="oui-text-xs oui-text-base-contrast-36 oui-mb-1">{t.label}</p>
                  <p className="oui-text-sm oui-font-bold" style={{ color: CYAN }}>{t.value}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* ── Create Your Token — Coming Soon ── */}
          <div className="oui-rounded-2xl oui-overflow-hidden oui-relative oui-p-8 md:oui-p-10"
            style={{
              background: "linear-gradient(135deg, rgba(56,224,248,0.06) 0%, rgba(14,203,129,0.04) 50%, rgba(11,14,17,0) 100%)",
              border: "1px solid rgba(56,224,248,0.15)",
            }}>
            <div className="oui-absolute oui-inset-0 oui-pointer-events-none"
              style={{ background: "radial-gradient(ellipse 70% 60% at 80% 50%, rgba(56,224,248,0.05) 0%, transparent 70%)" }} />
            <div className="oui-relative oui-flex oui-items-center oui-justify-between oui-flex-wrap oui-gap-6">
              <div>
                <div className="oui-flex oui-items-center oui-gap-2 oui-mb-3">
                  <span className="oui-text-xs oui-font-bold oui-px-3 oui-py-1 oui-rounded-full oui-animate-pulse"
                    style={{ background: `${GREEN}15`, color: GREEN, border: `1px solid ${GREEN}30` }}>
                    🚀 Coming Soon
                  </span>
                </div>
                <h2 className="oui-text-2xl md:oui-text-3xl oui-font-black oui-text-base-contrast oui-mb-2">
                  Create Your Own Token
                </h2>
                <p className="oui-text-sm oui-text-base-contrast-54 oui-max-w-lg oui-leading-relaxed">
                  Launch your own token directly from FrostDex — no coding required. Set your tokenomics,
                  deploy to your preferred chain, and list for trading instantly. The FrostDex token
                  launchpad is coming soon.
                </p>
              </div>
              <div className="oui-flex oui-flex-col oui-items-center oui-gap-3">
                <div className="oui-w-20 oui-h-20 oui-rounded-2xl oui-flex oui-items-center oui-justify-center"
                  style={{ background: `${CYAN}12`, border: `2px solid ${CYAN}25` }}>
                  <Snowflake size={36} style={{ color: CYAN, opacity: 0.7 }} />
                </div>
                <button
                  disabled
                  className="oui-px-6 oui-py-3 oui-rounded-xl oui-text-sm oui-font-bold oui-cursor-not-allowed"
                  style={{ background: `${CYAN}10`, color: `${CYAN}60`, border: `1px solid ${CYAN}20` }}>
                  Notify Me
                </button>
              </div>
            </div>
          </div>

          {/* ── Download App ── */}
          <Section>
            <div className="oui-flex oui-items-center oui-gap-2 oui-mb-4">
              <Download size={16} style={{ color: CYAN }} />
              <h2 className="oui-text-lg oui-font-bold oui-text-base-contrast">Mobile App</h2>
              <span className="oui-text-xs oui-font-bold oui-px-2 oui-py-0.5 oui-rounded-full oui-ml-1"
                style={{ background: `${CYAN}15`, color: CYAN, border: `1px solid ${CYAN}30` }}>Coming Soon</span>
            </div>
            <p className="oui-text-sm oui-text-base-contrast-54 oui-mb-5">
              The FrostDex mobile app is in development — bringing the full trading experience to iOS and Android.
            </p>
            <div className="oui-flex oui-gap-3 oui-flex-wrap">
              <a
                href="#"
                onClick={(e) => e.preventDefault()}
                className="oui-flex oui-items-center oui-gap-3 oui-px-5 oui-py-3 oui-rounded-xl oui-transition-all oui-opacity-60 oui-cursor-not-allowed"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <svg viewBox="0 0 24 24" className="oui-w-6 oui-h-6 oui-fill-current oui-text-base-contrast">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                <div>
                  <div className="oui-text-xs oui-text-base-contrast-36">Download on the</div>
                  <div className="oui-text-sm oui-font-semibold oui-text-base-contrast">App Store</div>
                </div>
              </a>
              <a
                href="#"
                onClick={(e) => e.preventDefault()}
                className="oui-flex oui-items-center oui-gap-3 oui-px-5 oui-py-3 oui-rounded-xl oui-transition-all oui-opacity-60 oui-cursor-not-allowed"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <svg viewBox="0 0 24 24" className="oui-w-6 oui-h-6 oui-fill-current oui-text-base-contrast">
                  <path d="M3.18 23.76c.3.17.64.23.99.17l12.45-7.24-2.65-2.65-10.79 9.72zm-1.43-1.1c-.47-.44-.75-1.1-.75-1.95V3.29c0-.85.28-1.51.75-1.95L2 1.5l11.18 11.18L2 23.82l-.25-.16zM20.3 10.52l-2.56-1.5-3.07 3.07 3.07 3.07 2.59-1.51c.74-.43 1.17-1.03 1.17-1.57 0-.53-.43-1.12-1.2-1.56zM4.17.07L16.62 7.3l-2.65 2.65L3.18.23c.3-.17.65-.23.99-.16z"/>
                </svg>
                <div>
                  <div className="oui-text-xs oui-text-base-contrast-36">Get it on</div>
                  <div className="oui-text-sm oui-font-semibold oui-text-base-contrast">Google Play</div>
                </div>
              </a>
            </div>
          </Section>

          {/* ── Disclaimer ── */}
          <div className="oui-text-xs oui-text-base-contrast-36 oui-text-center oui-pb-4 oui-leading-relaxed">
            This document is for informational purposes only and does not constitute financial advice or a solicitation to invest.
            FrostDex is a non-custodial protocol — users are solely responsible for their own funds and trading decisions.
          </div>

        </div>
      </div>
    </>
  );
}
