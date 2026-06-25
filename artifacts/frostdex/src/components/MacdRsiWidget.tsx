import { useEffect, useRef, useState } from "react";
import { useDraggable } from "@/hooks/useDraggable";

interface Props { onHide: () => void; }

const SYMBOLS = [
  { label: "BTC",  value: "BINANCE:BTCUSDT" },
  { label: "ETH",  value: "BINANCE:ETHUSDT" },
  { label: "SOL",  value: "BINANCE:SOLUSDT" },
  { label: "ARB",  value: "BINANCE:ARBUSDT" },
  { label: "BNB",  value: "BINANCE:BNBUSDT" },
  { label: "AVAX", value: "BINANCE:AVAXUSDT" },
  { label: "DOGE", value: "BINANCE:DOGEUSDT" },
  { label: "WIF",  value: "BINANCE:WIFUSDT" },
  { label: "PEPE", value: "BINANCE:PEPEUSDT" },
  { label: "OP",   value: "BINANCE:OPUSDT" },
  { label: "TIA",  value: "BINANCE:TIAUSDT" },
  { label: "SUI",  value: "BINANCE:SUIUSDT" },
  { label: "LINK", value: "BINANCE:LINKUSDT" },
  { label: "NEAR", value: "BINANCE:NEARUSDT" },
];

const INTERVALS = ["15m", "1h", "4h", "1D"];

export default function MacdRsiWidget({ onHide }: Props) {
  const [open, setOpen]       = useState(false);
  const [hovered, setHovered] = useState(false);
  const [symbol, setSymbol]   = useState(SYMBOLS[0].value);
  const [interval, setIv]     = useState("1h");
  const containerRef          = useRef<HTMLDivElement>(null);
  const injectedKey           = useRef("");

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const defaultPos = {
    x: 12,
    y: typeof window !== "undefined" ? Math.max(80, window.innerHeight - 460) : 300,
  };
  const { pos, isDragging, isSnapping, elementRef, dragHandleProps } =
    useDraggable("macd-rsi-widget", defaultPos);

  useEffect(() => {
    const key = `${symbol}|${interval}`;
    if (!open || !containerRef.current || injectedKey.current === key) return;
    injectedKey.current = key;

    const el = containerRef.current;
    el.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.className = "tradingview-widget-container__widget";
    wrapper.style.cssText = "height:100%;width:100%;";
    el.appendChild(wrapper);

    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      interval,
      width: "100%",
      height: "100%",
      isTransparent: true,
      symbol,
      showIntervalTabs: false,
      displayMode: "single",
      locale: "en",
      colorTheme: "dark",
    });
    el.appendChild(script);

    return () => {
      el.innerHTML = "";
      injectedKey.current = "";
    };
  }, [open, symbol, interval]);

  const panelStyle: React.CSSProperties = {
    position: "fixed",
    left: pos.x,
    top: pos.y,
    zIndex: 1300,
    width: open ? (isMobile ? "calc(100vw - 24px)" : "420px") : "auto",
    background: "rgba(10,12,18,0.97)",
    border: `1px solid ${hovered || isDragging ? "rgba(56,224,248,0.55)" : "rgba(56,224,248,0.2)"}`,
    borderRadius: 14,
    boxShadow: isDragging ? "0 8px 40px rgba(56,224,248,0.25)" : "0 4px 24px rgba(0,0,0,0.6)",
    transition: isSnapping ? "left 0.35s cubic-bezier(.4,0,.2,1), top 0.35s cubic-bezier(.4,0,.2,1)" : "none",
    userSelect: "none",
    overflow: "hidden",
  };

  return (
    <div
      ref={elementRef}
      style={panelStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        {...dragHandleProps}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 12px", cursor: "grab",
          borderBottom: open ? "1px solid rgba(56,224,248,0.1)" : "none",
          background: "rgba(56,224,248,0.05)",
        }}
      >
        <span style={{ color: "rgba(56,224,248,0.9)", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em" }}>
          📉 MACD · RSI
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
            style={{ background: "none", border: "none", color: "rgba(56,224,248,0.7)", cursor: "pointer", fontSize: 13, padding: "2px 6px", borderRadius: 4 }}>
            {open ? "▲" : "▼"}
          </button>
          <button onClick={e => { e.stopPropagation(); onHide(); }}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 13, padding: "2px 6px", borderRadius: 4 }}>
            ✕
          </button>
        </div>
      </div>

      {open && (
        <>
          <div style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "6px 10px", borderBottom: "1px solid rgba(56,224,248,0.08)",
            flexWrap: "wrap", rowGap: 4,
          }}>
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap", flex: 1 }}>
              {SYMBOLS.map(s => (
                <button key={s.value} onClick={() => setSymbol(s.value)} style={{
                  fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5, cursor: "pointer", border: "none",
                  background: symbol === s.value ? "rgba(56,224,248,0.18)" : "rgba(255,255,255,0.05)",
                  color: symbol === s.value ? "rgba(56,224,248,0.95)" : "rgba(255,255,255,0.4)",
                  transition: "all 0.12s",
                }}>
                  {s.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 3 }}>
              {INTERVALS.map(iv => (
                <button key={iv} onClick={() => setIv(iv)} style={{
                  fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5, cursor: "pointer", border: "none",
                  background: interval === iv ? "rgba(56,224,248,0.18)" : "rgba(255,255,255,0.05)",
                  color: interval === iv ? "rgba(56,224,248,0.95)" : "rgba(255,255,255,0.4)",
                  transition: "all 0.12s",
                }}>
                  {iv}
                </button>
              ))}
            </div>
          </div>
          <div ref={containerRef} className="tradingview-widget-container" style={{ width: "100%", height: 340 }} />
        </>
      )}
    </div>
  );
}
