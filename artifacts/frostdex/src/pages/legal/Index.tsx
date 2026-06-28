import { Link } from "react-router-dom";

export default function LegalPage() {
  return (
    <div style={{ minHeight: "100vh", background: "rgb(var(--oui-color-base-1, 10 11 15))", color: "rgba(255,255,255,0.85)", fontFamily: "Manrope, 'Segoe UI', sans-serif" }}>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "48px 24px 80px" }}>

        <div style={{ marginBottom: 40 }}>
          <Link to="/" style={{ color: "rgba(56,224,248,0.8)", textDecoration: "none", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 24 }}>
            ← Back to Trading
          </Link>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5, color: "#fff", marginBottom: 8 }}>Legal & Disclaimers</h1>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", margin: 0 }}>Last updated: June 2025</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>

          <Section id="risk" title="⚠ Risk Disclaimer">
            <p>
              Trading perpetual futures contracts involves a <strong>substantial risk of loss</strong> and is not suitable for all investors. You may lose more than your initial deposit. Perpetual contracts are leveraged instruments and price movements can result in rapid and significant losses.
            </p>
            <p>
              By using FrostDex, you acknowledge and accept that:
            </p>
            <ul>
              <li>Cryptocurrency markets are highly volatile and unpredictable.</li>
              <li>Past performance is not indicative of future results.</li>
              <li>Leverage amplifies both gains and losses. You can lose your entire position.</li>
              <li>Liquidations may occur without prior notice if margin requirements are not maintained.</li>
              <li>Smart contract bugs, oracle failures, and network issues may result in loss of funds.</li>
              <li>You are solely responsible for your trading decisions.</li>
            </ul>
            <p>
              Do not trade with money you cannot afford to lose. We strongly recommend consulting a qualified financial advisor before trading.
            </p>
          </Section>

          <Section id="terms" title="📋 Terms of Use">
            <p>
              By accessing or using FrostDex ("the Platform"), you agree to be bound by these Terms of Use. If you do not agree, you must not use the Platform.
            </p>

            <h3>Eligibility</h3>
            <p>
              You must be at least 18 years of age and legally permitted to use trading services in your jurisdiction. You represent and warrant that you are not:
            </p>
            <ul>
              <li>A resident or citizen of the United States of America.</li>
              <li>A resident of any country or region subject to international sanctions, including but not limited to Iran, North Korea, Cuba, Syria, and the Crimea, Donetsk, and Luhansk regions.</li>
              <li>A politically exposed person (PEP) or sanctioned individual.</li>
            </ul>

            <h3>No Financial Advice</h3>
            <p>
              Nothing on this Platform constitutes financial, investment, legal, or tax advice. All content is provided for informational and educational purposes only. You should conduct your own research and due diligence before making any financial decisions.
            </p>

            <h3>No Warranty</h3>
            <p>
              FrostDex is provided "as is" and "as available" without warranties of any kind, either express or implied. We do not warrant that the Platform will be error-free, uninterrupted, or free from vulnerabilities.
            </p>

            <h3>Limitation of Liability</h3>
            <p>
              To the maximum extent permitted by applicable law, FrostDex and its contributors shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits or data, arising from your use of the Platform.
            </p>

            <h3>Governing Law</h3>
            <p>
              These terms shall be governed by and construed in accordance with applicable laws, without regard to conflict of law provisions. Any disputes shall be resolved through binding arbitration.
            </p>
          </Section>

          <Section id="privacy" title="🔒 Privacy Policy">
            <p>
              FrostDex is a decentralized application (dApp) built by FrostDex protocol. We are committed to protecting your privacy.
            </p>

            <h3>Data We Collect</h3>
            <ul>
              <li><strong>Wallet addresses:</strong> Your public blockchain address when you connect a wallet.</li>
              <li><strong>Usage data:</strong> Anonymized analytics such as page views and feature usage to improve the Platform.</li>
              <li><strong>Referral codes:</strong> Association between referrer and referee wallet addresses if applicable.</li>
            </ul>

            <h3>Data We Do Not Collect</h3>
            <ul>
              <li>We do not collect your name, email address, or any KYC documents.</li>
              <li>We do not store your private keys — they remain in your wallet at all times.</li>
              <li>We do not sell your data to third parties.</li>
            </ul>

            <h3>Third-Party Services</h3>
            <p>
              The Platform integrates with all Markets, Privy, and analytics providers. On-chain transactions are permanently recorded on public blockchains and are not subject to erasure.
            </p>
          </Section>

          <Section id="protocol" title="🔗 Protocol Disclaimer">
            <p>
              FrostDex stands for the <strong>Freedom,Trust,Trade</strong> decentralized perpetuals protocol. FrostDex does not:
            </p>
            <ul>
              <li>Control or custody user funds at any point.</li>
              <li>Set trading fees, funding rates, or liquidation parameters.</li>
              <li>Guarantee the security or correctness of underlying smart contracts.</li>
              <li>Provide any insurance against losses.</li>
            </ul>
            <p>
              All trades are executed via smart contracts on the blockchain. FrostDex is a non-custodial interface and cannot reverse, cancel, or modify on-chain transactions.
            </p>
          </Section>

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 24, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
              © {new Date().getFullYear()} FrostDex. All rights reserved.
            </span>
            <div style={{ display: "flex", gap: 16 }}>
              <a href="#risk" style={{ fontSize: 12, color: "rgba(56,224,248,0.6)", textDecoration: "none" }}>Risk</a>
              <a href="#terms" style={{ fontSize: 12, color: "rgba(56,224,248,0.6)", textDecoration: "none" }}>Terms</a>
              <a href="#privacy" style={{ fontSize: 12, color: "rgba(56,224,248,0.6)", textDecoration: "none" }}>Privacy</a>
              <a href="#protocol" style={{ fontSize: 12, color: "rgba(56,224,248,0.6)", textDecoration: "none" }}>Protocol</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "28px 28px" }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 20, marginTop: 0, letterSpacing: -0.3 }}>{title}</h2>
      <div style={{ fontSize: 14, lineHeight: 1.75, color: "rgba(255,255,255,0.7)", display: "flex", flexDirection: "column", gap: 12 }}>
        {children}
      </div>
    </section>
  );
}
