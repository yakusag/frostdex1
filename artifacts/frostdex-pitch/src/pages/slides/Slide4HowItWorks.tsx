export default function Slide4HowItWorks() {
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
        <div className="w-[2vw] h-[0.15vh] bg-accent opacity-40" />
        <span
          className="font-body text-muted/60 tracking-[0.25em] uppercase"
          style={{ fontSize: "2.2vw" }}
        >
          FrostDex
        </span>
      </div>

      {/* Headline */}
      <div className="mt-[8vh] mb-[5vh]">
        <div className="w-[5vw] h-[0.3vh] bg-accent mb-[2.5vh]" />
        <h2
          className="font-display font-extrabold text-primary tracking-tight"
          style={{ fontSize: "5vw" }}
        >
          Order Execution
        </h2>
        <p
          className="font-body text-muted mt-[1.5vh]"
          style={{ fontSize: "2.5vw" }}
        >
          From wallet connection to on-chain settlement
        </p>
      </div>

      {/* 4-step flow */}
      <div className="flex items-center flex-1">
        {/* Step 1 */}
        <div className="flex-1 flex flex-col items-center text-center px-[1.5vw]">
          <div
            className="w-[8vw] h-[8vw] rounded-full bg-[#111820] border border-accent/30 flex items-center justify-center mb-[2.5vh]"
          >
            <span
              className="font-display font-extrabold text-accent"
              style={{ fontSize: "3.5vw" }}
            >
              1
            </span>
          </div>
          <p
            className="font-display font-bold text-primary mb-[1.5vh]"
            style={{ fontSize: "2.8vw" }}
          >
            Connect Wallet
          </p>
          <p
            className="font-body text-muted leading-relaxed"
            style={{ fontSize: "2.4vw", textWrap: "pretty" }}
          >
            MetaMask, Solana, or any EVM-compatible wallet. No account creation.
          </p>
        </div>

        {/* Arrow */}
        <div className="flex-shrink-0 flex items-center">
          <div className="w-[3.5vw] h-[0.2vh] bg-accent/40" />
          <div
            className="w-0 h-0 border-t-transparent border-b-transparent border-l-accent/40"
            style={{ borderTopWidth: "0.7vh", borderBottomWidth: "0.7vh", borderLeftWidth: "1vw" }}
          />
        </div>

        {/* Step 2 */}
        <div className="flex-1 flex flex-col items-center text-center px-[1.5vw]">
          <div
            className="w-[8vw] h-[8vw] rounded-full bg-[#111820] border border-accent/30 flex items-center justify-center mb-[2.5vh]"
          >
            <span
              className="font-display font-extrabold text-accent"
              style={{ fontSize: "3.5vw" }}
            >
              2
            </span>
          </div>
          <p
            className="font-display font-bold text-primary mb-[1.5vh]"
            style={{ fontSize: "2.8vw" }}
          >
            Deposit Funds
          </p>
          <p
            className="font-body text-muted leading-relaxed"
            style={{ fontSize: "2.4vw", textWrap: "pretty" }}
          >
            Assets deposited to a non-custodial FrostDex smart contract.
          </p>
        </div>

        {/* Arrow */}
        <div className="flex-shrink-0 flex items-center">
          <div className="w-[3.5vw] h-[0.2vh] bg-accent/40" />
          <div
            className="w-0 h-0 border-t-transparent border-b-transparent border-l-accent/40"
            style={{ borderTopWidth: "0.7vh", borderBottomWidth: "0.7vh", borderLeftWidth: "1vw" }}
          />
        </div>

        {/* Step 3 */}
        <div className="flex-1 flex flex-col items-center text-center px-[1.5vw]">
          <div
            className="w-[8vw] h-[8vw] rounded-full bg-[#111820] border border-accent/30 flex items-center justify-center mb-[2.5vh]"
          >
            <span
              className="font-display font-extrabold text-accent"
              style={{ fontSize: "3.5vw" }}
            >
              3
            </span>
          </div>
          <p
            className="font-display font-bold text-primary mb-[1.5vh]"
            style={{ fontSize: "2.8vw" }}
          >
            Place Order
          </p>
          <p
            className="font-body text-muted leading-relaxed"
            style={{ fontSize: "2.4vw", textWrap: "pretty" }}
          >
            Orders route to FrostDex's shared orderbook for fast, deep execution.
          </p>
        </div>

        {/* Arrow */}
        <div className="flex-shrink-0 flex items-center">
          <div className="w-[3.5vw] h-[0.2vh] bg-accent/40" />
          <div
            className="w-0 h-0 border-t-transparent border-b-transparent border-l-accent/40"
            style={{ borderTopWidth: "0.7vh", borderBottomWidth: "0.7vh", borderLeftWidth: "1vw" }}
          />
        </div>

        {/* Step 4 */}
        <div className="flex-1 flex flex-col items-center text-center px-[1.5vw]">
          <div
            className="w-[8vw] h-[8vw] rounded-full bg-[#111820] border border-accent flex items-center justify-center mb-[2.5vh]"
          >
            <span
              className="font-display font-extrabold text-accent"
              style={{ fontSize: "3.5vw" }}
            >
              4
            </span>
          </div>
          <p
            className="font-display font-bold text-primary mb-[1.5vh]"
            style={{ fontSize: "2.8vw" }}
          >
            Settle On-Chain
          </p>
          <p
            className="font-body text-muted leading-relaxed"
            style={{ fontSize: "2.4vw", textWrap: "pretty" }}
          >
            PnL settles on-chain. Withdraw to your wallet at any time.
          </p>
        </div>
      </div>

      {/* Slide number */}
      <div
        className="absolute bottom-[4.5vh] right-[6vw] text-muted font-body"
        style={{ fontSize: "2.2vw" }}
      >
        04
      </div>
    </div>
  );
}
