const base = import.meta.env.BASE_URL;

export default function Slide7CTA() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-[#0B0E11] flex flex-col items-center justify-center">
      {/* Background glow — mirror of title slide */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 75% 65% at 25% 85%, #0C2233 0%, #0B0E11 60%)",
        }}
      />
      <img
        src={`${base}hero-bg.png`}
        crossOrigin="anonymous"
        className="absolute inset-0 w-full h-full object-cover opacity-[0.08]"
        alt=""
      />

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center text-center px-[10vw]">
        <div className="flex items-center gap-[1.5vw] mb-[4vh]">
          <div className="w-[6vw] h-[0.25vh] bg-accent" />
          <span
            className="font-body font-bold text-accent tracking-[0.3em] uppercase"
            style={{ fontSize: "2.2vw" }}
          >
            Call to Action
          </span>
          <div className="w-[6vw] h-[0.25vh] bg-accent" />
        </div>

        <h2
          className="font-display font-extrabold text-primary tracking-tight leading-none"
          style={{ fontSize: "8vw", textWrap: "balance" }}
        >
          Start Trading
        </h2>

        <div className="w-[15vw] h-[0.25vh] bg-accent mt-[3vh] mb-[3.5vh]" />

        <p
          className="font-body font-bold text-primary/80 leading-tight"
          style={{ fontSize: "3vw" }}
        >
          Non-custodial perpetual futures, built for DeFi traders.
        </p>

        <p
          className="font-body text-muted mt-[2.5vh]"
          style={{ fontSize: "2.6vw" }}
        >
          frostdex.trade
        </p>

        {/* Three info pills */}
        <div className="flex gap-[3vw] mt-[5vh]">
          <div className="bg-[#111820] rounded-[0.6vw] px-[2.5vw] py-[1.8vh] border border-accent/20">
            <p
              className="font-body font-bold text-primary"
              style={{ fontSize: "2.6vw" }}
            >
              FROST Token
            </p>
            <p
              className="font-body text-muted mt-[0.5vh]"
              style={{ fontSize: "2.2vw" }}
            >
              Arbitrum One
            </p>
          </div>
          <div className="bg-[#111820] rounded-[0.6vw] px-[2.5vw] py-[1.8vh] border border-accent/20">
            <p
              className="font-body font-bold text-primary"
              style={{ fontSize: "2.6vw" }}
            >
              FrostDex
            </p>
            <p
              className="font-body text-muted mt-[0.5vh]"
              style={{ fontSize: "2.2vw" }}
            >
              Infrastructure
            </p>
          </div>
          <div className="bg-[#111820] rounded-[0.6vw] px-[2.5vw] py-[1.8vh] border border-accent/20">
            <p
              className="font-body font-bold text-primary"
              style={{ fontSize: "2.6vw" }}
            >
              FrostAI
            </p>
            <p
              className="font-body text-muted mt-[0.5vh]"
              style={{ fontSize: "2.2vw" }}
            >
              Powered by Groq
            </p>
          </div>
        </div>
      </div>

      {/* Bottom-right slide number */}
      <div
        className="absolute bottom-[4.5vh] right-[6vw] text-muted font-body"
        style={{ fontSize: "2.2vw" }}
      >
        07
      </div>
    </div>
  );
}
