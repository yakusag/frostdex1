export default function Slide5Orderly() {
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

      {/* Two-column layout — headline left, stats right */}
      <div className="flex gap-[8vw] items-start flex-1 mt-[8vh]">
        {/* Left — headline block */}
        <div className="w-[36vw] flex-shrink-0">
          <div className="w-[5vw] h-[0.3vh] bg-accent mb-[2.5vh]" />
          <h2
            className="font-display font-extrabold text-primary tracking-tight leading-tight"
            style={{ fontSize: "5vw", textWrap: "balance" }}
          >
            Orderly Network
          </h2>
          <p
            className="font-body text-muted mt-[3vh] leading-relaxed"
            style={{ fontSize: "2.6vw", textWrap: "pretty" }}
          >
            The infrastructure layer powering FrostDex — a shared liquidity and orderbook protocol for on-chain derivatives.
          </p>
          <div className="mt-[4vh] flex items-center gap-[1.5vw]">
            <div className="h-[0.2vh] flex-1 bg-accent/30" />
            <span
              className="font-body text-accent font-bold tracking-widest uppercase"
              style={{ fontSize: "2.2vw" }}
            >
              Technology Stack
            </span>
            <div className="h-[0.2vh] flex-1 bg-accent/30" />
          </div>
        </div>

        {/* Right — 4 capability blocks */}
        <div className="flex-1 grid grid-cols-2 gap-[2.5vh]">
          <div className="bg-[#111820] rounded-[0.8vw] p-[2.5vh_2vw]">
            <p
              className="font-display font-bold text-accent mb-[1vh]"
              style={{ fontSize: "2.6vw" }}
            >
              Shared Orderbook
            </p>
            <p
              className="font-body text-muted leading-relaxed"
              style={{ fontSize: "2.2vw" }}
            >
              All frontends share the same deep liquidity pool, eliminating fragmentation.
            </p>
          </div>

          <div className="bg-[#111820] rounded-[0.8vw] p-[2.5vh_2vw]">
            <p
              className="font-display font-bold text-accent mb-[1vh]"
              style={{ fontSize: "2.6vw" }}
            >
              Multi-Chain
            </p>
            <p
              className="font-body text-muted leading-relaxed"
              style={{ fontSize: "2.2vw" }}
            >
              Deposits and withdrawals across Arbitrum, Optimism, Polygon, Solana, and more.
            </p>
          </div>

          <div className="bg-[#111820] rounded-[0.8vw] p-[2.5vh_2vw]">
            <p
              className="font-display font-bold text-accent mb-[1vh]"
              style={{ fontSize: "2.6vw" }}
            >
              Non-Custodial
            </p>
            <p
              className="font-body text-muted leading-relaxed"
              style={{ fontSize: "2.2vw" }}
            >
              Assets secured in smart contracts — no centralized entity holds user funds.
            </p>
          </div>

          <div className="bg-[#111820] rounded-[0.8vw] p-[2.5vh_2vw]">
            <p
              className="font-display font-bold text-accent mb-[1vh]"
              style={{ fontSize: "2.6vw" }}
            >
              Cross-Margin
            </p>
            <p
              className="font-body text-muted leading-relaxed"
              style={{ fontSize: "2.2vw" }}
            >
              Single margin account for all positions, with portfolio-level risk management.
            </p>
          </div>
        </div>
      </div>

      {/* Slide number */}
      <div
        className="absolute bottom-[4.5vh] right-[6vw] text-muted font-body"
        style={{ fontSize: "2.2vw" }}
      >
        05
      </div>
    </div>
  );
}
