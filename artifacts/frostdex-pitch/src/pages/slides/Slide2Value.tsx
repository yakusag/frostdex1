export default function Slide2Value() {
  return (
    <div
      className="w-screen h-screen overflow-hidden relative flex flex-col justify-center px-[8vw] py-[7vh]"
      style={{
        background:
          "linear-gradient(145deg, #0B0E11 0%, #0E1520 100%)",
      }}
    >
      {/* Top-left brand mark */}
      <div className="absolute top-[5vh] left-[6vw] flex items-center gap-[0.8vw]">
        <div className="w-[2vw] h-[0.15vh] bg-accent opacity-40" />
        <span
          className="font-body text-muted/60 tracking-[0.25em] uppercase"
          style={{ fontSize: "2.2vw" }}
        >
          FrostDex
        </span>
      </div>

      {/* Left column — headline */}
      <div className="flex gap-[8vw] items-center h-full pt-[8vh]">
        <div className="flex-shrink-0 w-[38vw]">
          <div className="w-[5vw] h-[0.3vh] bg-accent mb-[2.5vh]" />
          <h2
            className="font-display font-extrabold text-primary tracking-tight leading-tight"
            style={{ fontSize: "5.5vw", textWrap: "balance" }}
          >
            Value Proposition
          </h2>
          <p
            className="font-body text-muted mt-[3vh] leading-relaxed"
            style={{ fontSize: "2.6vw", textWrap: "pretty" }}
          >
            Trade perpetual futures without handing over your assets.
          </p>
        </div>

        {/* Right column — 4 pillars in 2x2 grid */}
        <div className="flex-1 grid grid-cols-2 gap-[2.5vh]">
          {/* Pillar 1 */}
          <div className="bg-[#111820] rounded-[0.8vw] p-[3vh_2.5vw]">
            <div className="w-[2.5vw] h-[0.25vh] bg-accent mb-[1.5vh]" />
            <p
              className="font-display font-bold text-primary leading-tight mb-[1vh]"
              style={{ fontSize: "2.8vw" }}
            >
              Non-Custodial
            </p>
            <p
              className="font-body text-muted leading-relaxed"
              style={{ fontSize: "2.3vw" }}
            >
              Your keys, your funds. No exchange holds your assets.
            </p>
          </div>

          {/* Pillar 2 */}
          <div className="bg-[#111820] rounded-[0.8vw] p-[3vh_2.5vw]">
            <div className="w-[2.5vw] h-[0.25vh] bg-accent mb-[1.5vh]" />
            <p
              className="font-display font-bold text-primary leading-tight mb-[1vh]"
              style={{ fontSize: "2.8vw" }}
            >
              No KYC
            </p>
            <p
              className="font-body text-muted leading-relaxed"
              style={{ fontSize: "2.3vw" }}
            >
              Permissionless access. Connect a wallet and start trading.
            </p>
          </div>

          {/* Pillar 3 */}
          <div className="bg-[#111820] rounded-[0.8vw] p-[3vh_2.5vw]">
            <div className="w-[2.5vw] h-[0.25vh] bg-accent mb-[1.5vh]" />
            <p
              className="font-display font-bold text-primary leading-tight mb-[1vh]"
              style={{ fontSize: "2.8vw" }}
            >
              Deep Liquidity
            </p>
            <p
              className="font-body text-muted leading-relaxed"
              style={{ fontSize: "2.3vw" }}
            >
              Orderbook execution via Orderly Network's shared liquidity layer.
            </p>
          </div>

          {/* Pillar 4 */}
          <div className="bg-[#111820] rounded-[0.8vw] p-[3vh_2.5vw]">
            <div className="w-[2.5vw] h-[0.25vh] bg-accent mb-[1.5vh]" />
            <p
              className="font-display font-bold text-primary leading-tight mb-[1vh]"
              style={{ fontSize: "2.8vw" }}
            >
              Low Fees
            </p>
            <p
              className="font-body text-muted leading-relaxed"
              style={{ fontSize: "2.3vw" }}
            >
              Competitive maker/taker fees — reduced further by holding FROST.
            </p>
          </div>
        </div>
      </div>

      {/* Slide number */}
      <div
        className="absolute bottom-[4.5vh] right-[6vw] text-muted font-body"
        style={{ fontSize: "2.2vw" }}
      >
        02
      </div>
    </div>
  );
}
