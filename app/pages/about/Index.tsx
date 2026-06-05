import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { generatePageTitle } from "@/utils/utils";
import { getRuntimeConfig } from "@/utils/runtime-config";

type Section = "about" | "terms" | "privacy" | "risk" | "cookies" | "aml";

const sections: { id: Section; label: string }[] = [
  { id: "about", label: "About" },
  { id: "terms", label: "Terms of Service" },
  { id: "privacy", label: "Privacy Policy" },
  { id: "risk", label: "Risk Disclosure" },
  { id: "cookies", label: "Cookie Policy" },
  { id: "aml", label: "AML / KYC Policy" },
];

const brokerName = () =>
  (typeof window !== "undefined" &&
    (window as any).__RUNTIME_CONFIG__?.VITE_ORDERLY_BROKER_NAME) ||
  "FrostDex";

export default function AboutIndex() {
  const [active, setActive] = useState<Section>("about");
  const name = getRuntimeConfig("VITE_ORDERLY_BROKER_NAME") || "FrostDex";
  const siteUrl = getRuntimeConfig("VITE_SEO_SITE_URL") || "https://frostdex.pw";

  return (
    <>
      <Helmet>
        <title>{generatePageTitle("About & Legal")}</title>
      </Helmet>

      <div className="oui-min-h-screen oui-bg-base-9 oui-text-base-contrast-80">
        <div className="oui-max-w-6xl oui-mx-auto oui-px-4 oui-py-10 oui-flex oui-gap-8">

          {/* Sidebar */}
          <aside className="oui-hidden md:oui-block oui-w-56 oui-flex-shrink-0">
            <div className="oui-sticky oui-top-24 oui-bg-base-8 oui-rounded-xl oui-p-4 oui-border oui-border-line-12">
              <p className="oui-text-xs oui-font-semibold oui-text-base-contrast-36 oui-uppercase oui-tracking-wider oui-mb-3 oui-px-2">
                Legal
              </p>
              <nav className="oui-flex oui-flex-col oui-gap-1">
                {sections.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setActive(s.id)}
                    className={`oui-text-left oui-px-3 oui-py-2 oui-rounded-lg oui-text-sm oui-font-medium oui-transition-colors oui-w-full oui-border-none oui-cursor-pointer ${
                      active === s.id
                        ? "oui-bg-primary oui-text-white"
                        : "oui-text-base-contrast-54 hover:oui-bg-base-7 oui-bg-transparent hover:oui-text-base-contrast-80"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* Mobile tab bar */}
          <div className="md:oui-hidden oui-w-full">
            <div className="oui-flex oui-overflow-x-auto oui-gap-2 oui-pb-3 oui-mb-6">
              {sections.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActive(s.id)}
                  className={`oui-flex-shrink-0 oui-px-4 oui-py-2 oui-rounded-full oui-text-xs oui-font-semibold oui-border-none oui-cursor-pointer oui-transition-colors ${
                    active === s.id
                      ? "oui-bg-primary oui-text-white"
                      : "oui-bg-base-7 oui-text-base-contrast-54"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <main className="oui-flex-1 oui-min-w-0">
            <div className="oui-bg-base-8 oui-rounded-xl oui-border oui-border-line-12 oui-p-8">
              {active === "about" && <AboutContent name={name} siteUrl={siteUrl} />}
              {active === "terms" && <TermsContent name={name} />}
              {active === "privacy" && <PrivacyContent name={name} />}
              {active === "risk" && <RiskContent name={name} />}
              {active === "cookies" && <CookiesContent name={name} />}
              {active === "aml" && <AmlContent name={name} />}
            </div>
          </main>
        </div>
      </div>
    </>
  );
}

/* ─── Helpers ─── */

function H1({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="oui-text-2xl oui-font-bold oui-text-base-contrast-80 oui-mb-2">
      {children}
    </h1>
  );
}
function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="oui-text-lg oui-font-semibold oui-text-base-contrast-80 oui-mt-8 oui-mb-3">
      {children}
    </h2>
  );
}
function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="oui-text-sm oui-leading-relaxed oui-text-base-contrast-54 oui-mb-4">
      {children}
    </p>
  );
}
function Updated({ date }: { date: string }) {
  return (
    <p className="oui-text-xs oui-text-base-contrast-36 oui-mb-6">
      Last updated: {date}
    </p>
  );
}
function Divider() {
  return <hr className="oui-border-line-12 oui-my-6" />;
}
function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="oui-inline-block oui-bg-primary/10 oui-text-primary oui-text-xs oui-font-semibold oui-px-2 oui-py-0.5 oui-rounded-md oui-mr-2 oui-mb-2">
      {children}
    </span>
  );
}

/* ─── Sections ─── */

function AboutContent({ name, siteUrl }: { name: string; siteUrl: string }) {
  return (
    <>
      <H1>{name}</H1>
      <Updated date="June 2025" />
      <P>
        {name} is a non-custodial decentralized perpetual exchange built on the
        Orderly Network — a shared liquidity layer for on-chain derivatives.
        Trade perpetual futures with deep liquidity, low fees, and full
        self-custody of your assets.
      </P>

      <div className="oui-grid oui-grid-cols-2 md:oui-grid-cols-3 oui-gap-4 oui-my-6">
        {[
          { label: "Non-Custodial", desc: "You control your keys and funds at all times." },
          { label: "Deep Liquidity", desc: "Shared order books powered by Orderly Network." },
          { label: "Low Fees", desc: "Competitive maker/taker fees with no hidden costs." },
          { label: "Multi-Chain", desc: "Trade across Ethereum, Arbitrum, Base, BNB Chain, and more." },
          { label: "On-Chain Settlement", desc: "All trades settled transparently on-chain." },
          { label: "Open Source", desc: "Protocol contracts are public and audited." },
        ].map((f) => (
          <div
            key={f.label}
            className="oui-bg-base-7 oui-rounded-xl oui-p-4 oui-border oui-border-line-12"
          >
            <p className="oui-text-sm oui-font-semibold oui-text-base-contrast-80 oui-mb-1">
              {f.label}
            </p>
            <p className="oui-text-xs oui-text-base-contrast-36">{f.desc}</p>
          </div>
        ))}
      </div>

      <Divider />
      <H2>Powered by Orderly Network</H2>
      <P>
        {name} is a broker built on top of{" "}
        <a
          href="https://orderly.network"
          target="_blank"
          rel="noopener noreferrer"
          className="oui-text-primary"
        >
          Orderly Network
        </a>
        , a permissionless liquidity layer that provides order-book infrastructure
        for decentralized perpetuals. Settlement is handled by smart contracts —
        {name} never holds user funds.
      </P>

      <Divider />
      <H2>Supported Networks</H2>
      <div className="oui-flex oui-flex-wrap oui-mb-4">
        {["Ethereum", "Arbitrum", "Base", "BNB Chain", "Optimism", "Solana"].map(
          (c) => <Badge key={c}>{c}</Badge>
        )}
      </div>

      <Divider />
      <H2>Contact</H2>
      <P>
        For support, partnerships, or legal inquiries reach us at{" "}
        <a
          href={`mailto:contact@${new URL(siteUrl).hostname}`}
          className="oui-text-primary"
        >
          {`contact@${new URL(siteUrl).hostname}`}
        </a>
        .
      </P>
    </>
  );
}

function TermsContent({ name }: { name: string }) {
  return (
    <>
      <H1>Terms of Service</H1>
      <Updated date="June 2025" />
      <P>
        These Terms of Service ("Terms") govern your access to and use of {name}
        and all related services (collectively, the "Protocol"). By connecting
        your wallet or using the Protocol in any way, you agree to these Terms.
        If you do not agree, do not use the Protocol.
      </P>

      <H2>1. Eligibility</H2>
      <P>
        You must be at least 18 years of age and not a resident of any
        jurisdiction where access to decentralized derivative trading is
        prohibited, restricted, or requires a license not obtained by {name}.
        This includes but is not limited to the United States of America, Canada,
        Cuba, Iran, North Korea, Syria, and the Crimea region.
      </P>

      <H2>2. Non-Custodial Nature</H2>
      <P>
        {name} is a non-custodial interface. It does not hold, control, or take
        custody of any user funds. All transactions are executed on-chain via
        smart contracts. You are solely responsible for your private keys and
        wallet security.
      </P>

      <H2>3. No Financial Advice</H2>
      <P>
        Nothing on {name} constitutes financial, investment, legal, or tax advice.
        All trading decisions are made solely by you. The Protocol provides
        infrastructure only.
      </P>

      <H2>4. Risk Acknowledgment</H2>
      <P>
        You acknowledge that trading perpetual futures is highly speculative and
        carries a substantial risk of loss, including the complete loss of funds.
        Leverage amplifies both gains and losses. You must read and accept the
        Risk Disclosure before trading.
      </P>

      <H2>5. Prohibited Activities</H2>
      <P>
        You may not use the Protocol to: (a) violate any applicable law or
        regulation; (b) launder money or finance terrorism; (c) manipulate
        markets or engage in wash trading; (d) circumvent geographic restrictions
        via VPNs or proxies; (e) reverse-engineer or exploit the frontend
        interface.
      </P>

      <H2>6. Smart Contract Risk</H2>
      <P>
        Smart contracts may contain bugs or vulnerabilities. {name} does not
        guarantee the security or correctness of any smart contract. Users
        interact with contracts at their own risk.
      </P>

      <H2>7. Limitation of Liability</H2>
      <P>
        To the maximum extent permitted by applicable law, {name} and its
        contributors shall not be liable for any indirect, incidental, special,
        consequential, or exemplary damages arising from your use of the
        Protocol, including trading losses.
      </P>

      <H2>8. Changes to Terms</H2>
      <P>
        These Terms may be updated at any time. Continued use of the Protocol
        after changes constitutes acceptance of the new Terms.
      </P>

      <H2>9. Governing Law</H2>
      <P>
        These Terms shall be governed by and construed in accordance with the
        laws of a neutral jurisdiction, without regard to conflict of law
        principles. Any disputes shall be resolved by binding arbitration.
      </P>
    </>
  );
}

function PrivacyContent({ name }: { name: string }) {
  return (
    <>
      <H1>Privacy Policy</H1>
      <Updated date="June 2025" />
      <P>
        {name} is committed to protecting your privacy. This policy explains what
        data we collect, how we use it, and your rights as a user.
      </P>

      <H2>1. Data We Collect</H2>
      <P>
        Because {name} is non-custodial, we do not collect identity information
        such as names or email addresses. We may collect: (a) wallet addresses
        used to interact with the Protocol; (b) on-chain transaction data which
        is publicly visible by nature; (c) anonymized analytics data (page views,
        referral sources, device type) if analytics is enabled.
      </P>

      <H2>2. Cookies and Local Storage</H2>
      <P>
        We use browser local storage to store user preferences (language,
        leverage settings, widget positions). We may set cookies for analytics
        purposes. See our Cookie Policy for details.
      </P>

      <H2>3. Third-Party Services</H2>
      <P>
        The Protocol integrates with third-party services including Orderly
        Network, WalletConnect, and TradingView. Each has its own privacy policy.
        We are not responsible for their data practices.
      </P>

      <H2>4. Data Sharing</H2>
      <P>
        We do not sell your data. We may share anonymized aggregate data with
        partners for analytics purposes. On-chain data is inherently public.
      </P>

      <H2>5. Your Rights</H2>
      <P>
        You may request deletion of any off-chain data we hold about you by
        contacting us. On-chain data is immutable by nature and cannot be deleted.
      </P>

      <H2>6. Data Retention</H2>
      <P>
        Analytics data is retained for up to 24 months. Local storage data
        remains on your device until you clear your browser data.
      </P>

      <H2>7. Security</H2>
      <P>
        We implement reasonable technical and organizational measures to protect
        the data we store. However, no system is completely secure and we cannot
        guarantee absolute security.
      </P>
    </>
  );
}

function RiskContent({ name }: { name: string }) {
  return (
    <>
      <H1>Risk Disclosure</H1>
      <Updated date="June 2025" />

      <div className="oui-bg-yellow-500/10 oui-border oui-border-yellow-500/30 oui-rounded-xl oui-p-4 oui-mb-6">
        <p className="oui-text-sm oui-font-semibold oui-text-yellow-400 oui-mb-1">
          ⚠ Important Warning
        </p>
        <p className="oui-text-sm oui-text-base-contrast-54">
          Trading perpetual futures contracts involves a very high degree of
          risk and may not be suitable for all investors. You can lose all of
          your invested capital and more.
        </p>
      </div>

      <H2>1. Leverage Risk</H2>
      <P>
        Perpetual futures allow trading with leverage, meaning you can control a
        position much larger than your deposited margin. While this amplifies
        potential gains, it equally amplifies losses. A small adverse price
        movement can result in the complete loss of your margin (liquidation).
      </P>

      <H2>2. Liquidation Risk</H2>
      <P>
        If your margin falls below the maintenance margin level, your position
        will be automatically liquidated by the protocol. Liquidation may occur
        at prices less favorable than the liquidation price shown due to market
        conditions. You may lose your entire margin.
      </P>

      <H2>3. Market Risk</H2>
      <P>
        Cryptocurrency markets are highly volatile. Prices can move rapidly and
        unpredictably. Past performance is not indicative of future results.
        Markets may be subject to manipulation, low liquidity, or flash crashes.
      </P>

      <H2>4. Smart Contract Risk</H2>
      <P>
        The Protocol relies on smart contracts which may contain bugs or
        vulnerabilities. Although contracts are audited, no audit guarantees
        complete security. Funds interacting with smart contracts are always at
        risk of exploits.
      </P>

      <H2>5. Counterparty and Protocol Risk</H2>
      <P>
        {name} is built on the Orderly Network infrastructure. Issues with
        Orderly Network, including technical failures, oracle malfunctions, or
        insolvency, could adversely affect your positions and funds.
      </P>

      <H2>6. Regulatory Risk</H2>
      <P>
        The regulatory landscape for decentralized finance is evolving rapidly.
        Changes in laws or regulations in your jurisdiction may restrict or
        prohibit your ability to use the Protocol, potentially affecting access
        to your funds.
      </P>

      <H2>7. Technology Risk</H2>
      <P>
        You are responsible for the security of your wallet, private keys, and
        seed phrases. Loss of keys means permanent loss of funds. Phishing
        attacks, malware, and social engineering are common attack vectors.
        Always verify you are on the correct domain.
      </P>

      <H2>8. No Guarantee of Profit</H2>
      <P>
        {name} makes no representation that you will profit from trading. You
        should only trade with funds you can afford to lose entirely.
      </P>
    </>
  );
}

function CookiesContent({ name }: { name: string }) {
  return (
    <>
      <H1>Cookie Policy</H1>
      <Updated date="June 2025" />
      <P>
        This Cookie Policy explains how {name} uses cookies and similar
        technologies when you use the Protocol.
      </P>

      <H2>1. What Are Cookies</H2>
      <P>
        Cookies are small text files stored on your device. We also use browser
        local storage for similar purposes. These help us remember your
        preferences and improve your experience.
      </P>

      <H2>2. Cookies We Use</H2>
      <div className="oui-overflow-x-auto oui-mb-4">
        <table className="oui-w-full oui-text-sm oui-border-collapse">
          <thead>
            <tr className="oui-border-b oui-border-line-12">
              <th className="oui-text-left oui-py-2 oui-pr-4 oui-text-base-contrast-54 oui-font-semibold">Type</th>
              <th className="oui-text-left oui-py-2 oui-pr-4 oui-text-base-contrast-54 oui-font-semibold">Purpose</th>
              <th className="oui-text-left oui-py-2 oui-text-base-contrast-54 oui-font-semibold">Duration</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Essential", "Language, layout, and session preferences", "Session / Persistent"],
              ["Analytics", "Anonymized usage statistics to improve the app", "Up to 24 months"],
              ["Functional", "Widget positions, leverage settings, last symbol", "Persistent (localStorage)"],
            ].map(([type, purpose, duration]) => (
              <tr key={type} className="oui-border-b oui-border-line-12/50">
                <td className="oui-py-2 oui-pr-4 oui-text-base-contrast-80 oui-font-medium">{type}</td>
                <td className="oui-py-2 oui-pr-4 oui-text-base-contrast-54">{purpose}</td>
                <td className="oui-py-2 oui-text-base-contrast-36 oui-whitespace-nowrap">{duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2>3. Third-Party Cookies</H2>
      <P>
        TradingView, WalletConnect, and analytics providers may set their own
        cookies. We do not control these cookies — please refer to each
        provider's cookie policy.
      </P>

      <H2>4. Managing Cookies</H2>
      <P>
        You can control cookies through your browser settings. Note that
        disabling certain cookies may affect the functionality of the Protocol.
        You can clear local storage by using your browser's developer tools.
      </P>
    </>
  );
}

function AmlContent({ name }: { name: string }) {
  return (
    <>
      <H1>AML / KYC Policy</H1>
      <Updated date="June 2025" />
      <P>
        {name} is committed to preventing money laundering, terrorist financing,
        and other financial crimes. This policy outlines our approach to
        Anti-Money Laundering (AML) and Know Your Customer (KYC) obligations.
      </P>

      <H2>1. Non-Custodial Nature</H2>
      <P>
        Because {name} is a non-custodial, decentralized interface, we do not
        collect identity documents or perform traditional KYC verification.
        Compliance is enforced at the protocol and smart contract level.
      </P>

      <H2>2. Geographic Restrictions</H2>
      <P>
        Access to the Protocol is restricted for users located in sanctioned
        countries and jurisdictions, including but not limited to the United
        States, Cuba, Iran, North Korea, Syria, and the Crimea region. By using
        the Protocol, you represent that you are not located in any restricted
        jurisdiction.
      </P>

      <H2>3. On-Chain Screening</H2>
      <P>
        The Orderly Network infrastructure may perform on-chain screening of
        wallet addresses against known sanctions lists (OFAC and equivalent
        lists). Wallets identified as sanctioned may be blocked at the protocol
        level.
      </P>

      <H2>4. Prohibited Use</H2>
      <P>
        You must not use {name} to: (a) launder the proceeds of criminal
        activity; (b) finance terrorism or other illegal activities; (c)
        evade sanctions; (d) engage in market manipulation or fraud.
      </P>

      <H2>5. Cooperation with Authorities</H2>
      <P>
        To the extent technically feasible and legally required, {name} will
        cooperate with law enforcement authorities. On-chain transactions are
        publicly visible and traceable by design.
      </P>

      <H2>6. Reporting Obligations</H2>
      <P>
        If you become aware of suspicious activity related to money laundering
        or terrorist financing on the Protocol, please report it through our
        official contact channels.
      </P>
    </>
  );
}
