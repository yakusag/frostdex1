export default function Slide6Mobile() {
  return (
    <div
      className="w-screen h-screen overflow-hidden relative flex"
      style={{
        background:
          "linear-gradient(145deg, #0B0E11 0%, #0E1520 100%)",
      }}
    >
      {/* Top-left brand mark */}
      <div className="absolute top-[5vh] left-[6vw] flex items-center gap-[0.8vw] z-10">
        <div className="w-[2vw] h-[0.15vh] bg-accent opacity-60" />
        <span
          className="font-body text-muted tracking-[0.25em] uppercase"
          style={{ fontSize: "2.2vw" }}
        >
          FrostDex
        </span>
      </div>

      {/* Left — text content */}
      <div className="w-[50vw] flex flex-col justify-center px-[8vw] py-[8vh]">
        <div className="w-[5vw] h-[0.3vh] bg-accent mb-[2.5vh]" />
        <h2
          className="font-display font-extrabold text-primary tracking-tight leading-tight"
          style={{ fontSize: "5.5vw", textWrap: "balance" }}
        >
          Mobile Companion
        </h2>
        <p
          className="font-body text-muted mt-[3vh] mb-[4vh] leading-relaxed"
          style={{ fontSize: "2.6vw", textWrap: "pretty" }}
        >
          Stay connected to your positions and the market from anywhere.
        </p>

        {/* Feature list */}
        <div className="flex flex-col gap-[2.2vh]">
          <div className="flex items-start gap-[1.5vw]">
            <div className="w-[0.4vw] h-[0.4vw] rounded-full bg-accent mt-[1.2vh] flex-shrink-0" />
            <p
              className="font-body text-primary leading-tight"
              style={{ fontSize: "2.6vw" }}
            >
              Real-time market data and portfolio tracking
            </p>
          </div>
          <div className="flex items-start gap-[1.5vw]">
            <div className="w-[0.4vw] h-[0.4vw] rounded-full bg-accent mt-[1.2vh] flex-shrink-0" />
            <p
              className="font-body text-primary leading-tight"
              style={{ fontSize: "2.6vw" }}
            >
              FrostAI chat — trading guidance on the go
            </p>
          </div>
          <div className="flex items-start gap-[1.5vw]">
            <div className="w-[0.4vw] h-[0.4vw] rounded-full bg-accent mt-[1.2vh] flex-shrink-0" />
            <p
              className="font-body text-primary leading-tight"
              style={{ fontSize: "2.6vw" }}
            >
              Whale alerts and sentiment dashboard
            </p>
          </div>
          <div className="flex items-start gap-[1.5vw]">
            <div className="w-[0.4vw] h-[0.4vw] rounded-full bg-accent mt-[1.2vh] flex-shrink-0" />
            <p
              className="font-body text-primary leading-tight"
              style={{ fontSize: "2.6vw" }}
            >
              iOS and Android — built with Expo
            </p>
          </div>
        </div>
      </div>

      {/* Right — visual panels */}
      <div className="flex-1 flex flex-col justify-center pr-[7vw] gap-[3vh]">
        {/* Panel A — Markets */}
        <div className="bg-[#111820] rounded-[0.8vw] p-[3vh_2.5vw] border-l-[0.3vw] border-accent">
          <p
            className="font-body font-bold text-accent tracking-widest uppercase mb-[1.5vh]"
            style={{ fontSize: "2.2vw" }}
          >
            Markets
          </p>
          <p
            className="font-display font-bold text-primary"
            style={{ fontSize: "3vw" }}
          >
            BTC-PERP
          </p>
          <p
            className="font-body text-muted mt-[0.8vh]"
            style={{ fontSize: "2.4vw" }}
          >
            Live price · Funding rate · OI
          </p>
        </div>

        {/* Panel B — FrostAI */}
        <div className="bg-[#111820] rounded-[0.8vw] p-[3vh_2.5vw] border-l-[0.3vw] border-accent/50">
          <p
            className="font-body font-bold text-accent tracking-widest uppercase mb-[1.5vh]"
            style={{ fontSize: "2.2vw" }}
          >
            FrostAI
          </p>
          <p
            className="font-display font-bold text-primary"
            style={{ fontSize: "3vw" }}
          >
            Ask anything
          </p>
          <p
            className="font-body text-muted mt-[0.8vh]"
            style={{ fontSize: "2.4vw" }}
          >
            Market analysis · Risk guidance · DeFi concepts
          </p>
        </div>

        {/* Panel C — Alerts */}
        <div className="bg-[#111820] rounded-[0.8vw] p-[3vh_2.5vw] border-l-[0.3vw] border-accent/30">
          <p
            className="font-body font-bold text-accent tracking-widest uppercase mb-[1.5vh]"
            style={{ fontSize: "2.2vw" }}
          >
            Whale Alerts
          </p>
          <p
            className="font-display font-bold text-primary"
            style={{ fontSize: "3vw" }}
          >
            Large moves, instantly
          </p>
          <p
            className="font-body text-muted mt-[0.8vh]"
            style={{ fontSize: "2.4vw" }}
          >
            On-chain signals · Sentiment dashboard
          </p>
        </div>
      </div>

      {/* Slide number */}
      <div
        className="absolute bottom-[4.5vh] right-[6vw] text-muted font-body"
        style={{ fontSize: "2.2vw" }}
      >
        06
      </div>
    </div>
  );
}
