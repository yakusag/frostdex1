<<<<<<< HEAD
=======
import { Helmet } from "react-helmet-async";
>>>>>>> 617bd7961f685f546560241d34a318d81084bab4
import { Link } from "react-router-dom";

export default function LegalPage() {
  return (
<<<<<<< HEAD
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
              To the maximum extent permitted by applicable law, FrostDex and its contributors shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits or data, arising from your use of the Platform. Our total liability shall not exceed the fees paid by you in the 30 days preceding the claim.
            </p>

            <h3>Platform Availability</h3>
            <p>
              We reserve the right to suspend, modify, or discontinue the Platform at any time, with or without notice. We are not liable for any losses resulting from downtime or service interruptions.
            </p>

            <h3>Governing Law</h3>
            <p>
              These terms shall be governed by and construed in accordance with applicable laws, without regard to conflict of law provisions. Any disputes shall be resolved through binding arbitration.
            </p>
          </Section>

          <Section id="privacy" title="🔒 Privacy Policy">
            <p>
              FrostDex is a decentralized application (dApp) built on the Orderly Network protocol. We are committed to protecting your privacy.
            </p>

            <h3>Data We Collect</h3>
            <p>
              We collect minimal data to operate the Platform:
            </p>
            <ul>
              <li><strong>Wallet addresses:</strong> Your public blockchain address when you connect a wallet. This is public information on-chain.</li>
              <li><strong>Usage data:</strong> Anonymized analytics such as page views, feature usage, and error logs to improve the Platform. We do not collect personally identifiable information.</li>
              <li><strong>Referral codes:</strong> If you use or generate a referral link, we record the association between referrer and referee wallet addresses.</li>
            </ul>

            <h3>Data We Do Not Collect</h3>
            <ul>
              <li>We do not collect your name, email address, or any KYC documents.</li>
              <li>We do not store your private keys — they remain in your wallet at all times.</li>
              <li>We do not sell your data to third parties.</li>
            </ul>

            <h3>Third-Party Services</h3>
            <p>
              The Platform integrates with third-party services including Orderly Network (trading infrastructure), Privy (wallet connection), and analytics providers. These services have their own privacy policies. On-chain transactions are permanently recorded on public blockchains and are not subject to erasure.
            </p>

            <h3>Cookies</h3>
            <p>
              We use local storage to save user preferences (such as trading settings and widget visibility). No tracking cookies are used.
            </p>
          </Section>

          <Section id="protocol" title="🔗 Protocol Disclaimer">
            <p>
              FrostDex is a front-end interface for the <strong>Orderly Network</strong> decentralized perpetuals protocol. FrostDex does not:
            </p>
            <ul>
              <li>Control or custody user funds at any point.</li>
              <li>Set trading fees, funding rates, or liquidation parameters — these are determined by the Orderly Network protocol.</li>
              <li>Guarantee the security or correctness of underlying smart contracts.</li>
              <li>Provide any insurance against losses.</li>
            </ul>
            <p>
              All trades are executed via smart contracts on the blockchain. You interact with these contracts directly through your wallet. FrostDex is a non-custodial interface and cannot reverse, cancel, or modify on-chain transactions.
            </p>
            <p>
              Smart contract security is audited by the Orderly Network team, but no audit guarantees complete freedom from bugs or exploits. Use the Protocol at your own risk.
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
=======
    <div style={{ minHeight: "100vh", background: "rgb(var(--oui-color-base-1))", color: "rgb(var(--oui-color-base-foreground))", fontFamily: "Manrope, 'Segoe UI', sans-serif" }}>
      <Helmet>
        <title>Legal — FrostDex</title>
        <meta name="description" content="FrostDex legal information: Terms of Service, Privacy Policy, and Risk Disclaimer." />
      </Helmet>

      {/* Header */}
      <div style={{ borderBottom: "1px solid rgba(var(--oui-color-primary),0.15)", padding: "24px 32px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link to="/" style={{ color: "rgba(56,224,248,0.8)", textDecoration: "none", fontSize: 13 }}>← Back</Link>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "rgba(56,224,248,0.95)" }}>Legal</h1>
      </div>

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "40px 32px", display: "flex", flexDirection: "column", gap: 48 }}>

        {/* Terms of Service */}
        <section>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "rgba(56,224,248,0.9)", marginBottom: 16, borderLeft: "3px solid rgba(56,224,248,0.6)", paddingLeft: 12 }}>Terms of Service</h2>
          <div style={{ lineHeight: 1.75, fontSize: 14, color: "rgba(var(--oui-color-base-foreground),0.75)", display: "flex", flexDirection: "column", gap: 12 }}>
            <p>By accessing or using FrostDex ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Platform.</p>
            <p><strong style={{ color: "rgba(var(--oui-color-base-foreground),0.9)" }}>Eligibility:</strong> You must be at least 18 years old and not a resident of a restricted jurisdiction. It is your responsibility to determine whether using FrostDex is lawful in your location.</p>
            <p><strong style={{ color: "rgba(var(--oui-color-base-foreground),0.9)" }}>No KYC / Non-Custodial:</strong> FrostDex is a non-custodial interface. We do not hold your funds. You retain full control of your assets through your own wallet at all times.</p>
            <p><strong style={{ color: "rgba(var(--oui-color-base-foreground),0.9)" }}>Prohibited Use:</strong> You agree not to use the Platform for money laundering, market manipulation, or any activity that violates applicable laws or regulations.</p>
            <p><strong style={{ color: "rgba(var(--oui-color-base-foreground),0.9)" }}>Modifications:</strong> We reserve the right to modify these terms at any time. Continued use of the Platform constitutes acceptance of updated terms.</p>
          </div>
        </section>

        {/* Privacy Policy */}
        <section>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "rgba(56,224,248,0.9)", marginBottom: 16, borderLeft: "3px solid rgba(56,224,248,0.6)", paddingLeft: 12 }}>Privacy Policy</h2>
          <div style={{ lineHeight: 1.75, fontSize: 14, color: "rgba(var(--oui-color-base-foreground),0.75)", display: "flex", flexDirection: "column", gap: 12 }}>
            <p>FrostDex is committed to protecting your privacy. This policy explains what information we collect and how we use it.</p>
            <p><strong style={{ color: "rgba(var(--oui-color-base-foreground),0.9)" }}>On-chain Data:</strong> All trades are executed on public blockchains. Your wallet address and transaction history are publicly visible on-chain. We do not control this.</p>
            <p><strong style={{ color: "rgba(var(--oui-color-base-foreground),0.9)" }}>Local Storage:</strong> We use your browser's local storage solely for user preferences (theme, language, referral code). No personal data is transmitted to our servers.</p>
            <p><strong style={{ color: "rgba(var(--oui-color-base-foreground),0.9)" }}>Third Parties:</strong> The Platform connects to Orderly Network's infrastructure for order matching and liquidity. Please review Orderly Network's privacy policy for their data practices.</p>
            <p><strong style={{ color: "rgba(var(--oui-color-base-foreground),0.9)" }}>Analytics:</strong> We may use anonymous, aggregated analytics to improve the Platform. No personally identifiable information is collected.</p>
          </div>
        </section>

        {/* Risk Disclaimer */}
        <section>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "rgba(56,224,248,0.9)", marginBottom: 16, borderLeft: "3px solid rgba(56,224,248,0.6)", paddingLeft: 12 }}>Risk Disclaimer</h2>
          <div style={{
            background: "rgba(255,100,60,0.06)",
            border: "1px solid rgba(255,100,60,0.2)",
            borderRadius: 8,
            padding: "20px 24px",
            lineHeight: 1.75,
            fontSize: 14,
            color: "rgba(var(--oui-color-base-foreground),0.75)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}>
            <p><strong style={{ color: "#ff6b6b" }}>⚠ HIGH RISK WARNING:</strong> Trading perpetual futures and leveraged products involves substantial risk of loss. You may lose more than your initial deposit.</p>
            <p>Cryptocurrency markets are highly volatile. Price movements can be rapid and unpredictable. Past performance is not indicative of future results.</p>
            <p>Leveraged trading amplifies both profits and losses. Using high leverage significantly increases your risk of liquidation.</p>
            <p>FrostDex is a decentralized protocol interface. We do not provide investment advice, financial guidance, or trading recommendations. All trading decisions are your own responsibility.</p>
            <p><strong style={{ color: "rgba(var(--oui-color-base-foreground),0.9)" }}>Only trade with funds you can afford to lose entirely. Always conduct your own due diligence (DYOR).</strong></p>
          </div>
        </section>

        {/* Footer */}
        <div style={{ borderTop: "1px solid rgba(var(--oui-color-primary),0.1)", paddingTop: 24, fontSize: 12, color: "rgba(var(--oui-color-base-foreground),0.35)", textAlign: "center" }}>
          Last updated: June 2025 · FrostDex is a decentralized exchange interface powered by Orderly Network.
>>>>>>> 617bd7961f685f546560241d34a318d81084bab4
        </div>
      </div>
    </div>
  );
}
<<<<<<< HEAD

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
=======
>>>>>>> 617bd7961f685f546560241d34a318d81084bab4
