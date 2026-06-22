const base = import.meta.env.BASE_URL;

export default function Slide1Cover() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-[#0B0E11] flex flex-col items-center justify-center">
      {/* Radial glow — upper right warmth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 75% 65% at 78% 15%, #0C2233 0%, #0B0E11 65%)",
        }}
      />
      {/* Hero background image */}
      <img
        src={`${base}hero-bg.png`}
        crossOrigin="anonymous"
        className="absolute inset-0 w-full h-full object-cover opacity-[0.15]"
        alt=""
      />

      {/* Top-left brand mark */}
      <div className="absolute top-[5vh] left-[6vw] flex items-center gap-[0.8vw]">
        <div className="w-[2.5vw] h-[0.2vh] bg-accent opacity-60" />
        <span
          className="font-body font-bold text-muted tracking-[0.25em] uppercase"
          style={{ fontSize: "2.2vw" }}
        >
          FrostDex
        </span>
        <div className="w-[2.5vw] h-[0.2vh] bg-accent opacity-60" />
      </div>

      {/* Main hero content — centered */}
      <div className="relative z-10 flex flex-col items-center text-center px-[10vw]">
        <p
          className="font-body font-bold text-accent tracking-[0.3em] uppercase mb-[2.5vh]"
          style={{ fontSize: "2.2vw" }}
        >
          Decentralized · Non-Custodial · Permissionless
        </p>
        <h1
          className="font-display font-extrabold text-primary tracking-tighter leading-none"
          style={{ fontSize: "10vw", textWrap: "balance" }}
        >
          FrostDex
        </h1>
        <div className="w-[18vw] h-[0.25vh] bg-accent mt-[2.5vh] mb-[3vh]" />
        <p
          className="font-body font-bold text-primary/80 leading-tight"
          style={{ fontSize: "3.2vw" }}
        >
          Perpetual Futures Trading
        </p>
        <p
          className="font-body text-muted mt-[1.5vh]"
          style={{ fontSize: "2.4vw" }}
        >
          Powered by Orderly Network
        </p>
      </div>

      {/* Slide number */}
      <div
        className="absolute bottom-[4.5vh] right-[6vw] text-muted font-body"
        style={{ fontSize: "2.2vw" }}
      >
        01
      </div>
    </div>
  );
}
