export default function Slide3Features() {
  return (
    <div
      className="w-screen h-screen overflow-hidden relative flex flex-col px-[8vw] py-[7vh]"
      style={{
        background:
          "linear-gradient(145deg, #0B0E11 0%, #0E1520 100%)",
      }}
    >
      {/* Top-left brand mark */}
      <div className="absolute top-[5vh] left-[6vw] flex items-center gap-[0.8vw]">
        <div className="w-[2vw] h-[0.15vh] bg-accent opacity-60" />
        <span
          className="font-body text-muted tracking-[0.25em] uppercase"
          style={{ fontSize: "2.2vw" }}
        >
          FrostDex
        </span>
      </div>

      {/* Headline */}
      <div className="mt-[8vh] mb-[4vh]">
        <div className="w-[5vw] h-[0.3vh] bg-accent mb-[2.5vh]" />
        <h2
          className="font-display font-extrabold text-primary tracking-tight"
          style={{ fontSize: "5vw" }}
        >
          Platform Features
        </h2>
      </div>

      {/* Three-column feature cards */}
      <div className="flex gap-[3vw] flex-1">
        {/* Feature 1 — Perps Trading */}
        <div className="flex-1 bg-[#111820] rounded-[0.8vw] p-[4vh_3vw] flex flex-col">
          <div
            className="font-body font-bold text-accent tracking-[0.2em] uppercase mb-[2vh]"
            style={{ fontSize: "2.2vw" }}
          >
            01
          </div>
          <p
            className="font-display font-bold text-primary leading-tight mb-[2vh]"
            style={{ fontSize: "3vw" }}
          >
            Perpetual Futures
          </p>
          <div className="w-[3vw] h-[0.2vh] bg-accent mb-[2vh]" />
          <p
            className="font-body text-muted leading-relaxed"
            style={{ fontSize: "2.4vw", textWrap: "pretty" }}
          >
            Trade leveraged positions on a wide range of assets with no expiry date.
          </p>
          <div className="mt-auto pt-[2vh]">
            <p
              className="font-body text-muted"
              style={{ fontSize: "2.2vw" }}
            >
              Cross-margin · TradingView charts · Orderbook depth
            </p>
          </div>
        </div>

        {/* Feature 2 — FrostAI */}
        <div className="flex-1 bg-[#111820] rounded-[0.8vw] p-[4vh_3vw] flex flex-col border border-accent/20">
          <div
            className="font-body font-bold text-accent tracking-[0.2em] uppercase mb-[2vh]"
            style={{ fontSize: "2.2vw" }}
          >
            02
          </div>
          <p
            className="font-display font-bold text-primary leading-tight mb-[2vh]"
            style={{ fontSize: "3vw" }}
          >
            FrostAI Assistant
          </p>
          <div className="w-[3vw] h-[0.2vh] bg-accent mb-[2vh]" />
          <p
            className="font-body text-muted leading-relaxed"
            style={{ fontSize: "2.4vw", textWrap: "pretty" }}
          >
            An integrated AI trading assistant for market analysis and platform guidance.
          </p>
          <div className="mt-auto pt-[2vh]">
            <p
              className="font-body text-muted"
              style={{ fontSize: "2.2vw" }}
            >
              Powered by Groq · Llama 3.3 70B · Risk analysis
            </p>
          </div>
        </div>

        {/* Feature 3 — FROST Token */}
        <div className="flex-1 bg-[#111820] rounded-[0.8vw] p-[4vh_3vw] flex flex-col">
          <div
            className="font-body font-bold text-accent tracking-[0.2em] uppercase mb-[2vh]"
            style={{ fontSize: "2.2vw" }}
          >
            03
          </div>
          <p
            className="font-display font-bold text-primary leading-tight mb-[2vh]"
            style={{ fontSize: "3vw" }}
          >
            FROST Token
          </p>
          <div className="w-[3vw] h-[0.2vh] bg-accent mb-[2vh]" />
          <p
            className="font-body text-muted leading-relaxed"
            style={{ fontSize: "2.4vw", textWrap: "pretty" }}
          >
            The native utility token driving fee discounts, staking rewards, and governance.
          </p>
          <div className="mt-auto pt-[2vh]">
            <p
              className="font-body text-muted"
              style={{ fontSize: "2.2vw" }}
            >
              Arbitrum One · Uniswap V3 · Protocol revenue share
            </p>
          </div>
        </div>
      </div>

      {/* Slide number */}
      <div
        className="absolute bottom-[4.5vh] right-[6vw] text-muted font-body"
        style={{ fontSize: "2.2vw" }}
      >
        03
      </div>
    </div>
  );
}
