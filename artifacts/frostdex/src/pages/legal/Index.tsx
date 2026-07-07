import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

export default function LegalPage() {
  return (
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
            <p><strong style={{ color: "rgba(var(--oui-color-base-foreground),0.9)" }}>Third Parties:</strong> The Platform connects to decentralized infrastructure for order matching and liquidity. Please review the privacy policies of any third-party services you interact with.</p>
            <p><strong style={{ color: "rgba(var(--oui-color-base-foreground),0.9)" }}>Analytics:</strong> We may use anonymous, aggregated analytics to improve the Platform. No personally identifiable information is collected.</p>
          </div>
        </section>

        {/* Risk Disclaimer */}
        <section>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "rgba(56,224,248,0.9)", margin: "0 0 16px", borderLeft: "3px solid rgba(56,224,248,0.6)", paddingLeft: 12 }}>Risk Disclaimer</h2>
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
          Last updated: June 2025 · FrostDex — Decentralized Perpetual Futures Exchange.
        </div>
      </div>
    </div>
  );
}
