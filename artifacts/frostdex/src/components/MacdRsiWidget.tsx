import { useEffect, useRef, useState } from "react";
import { useDraggable } from "@/hooks/useDraggable";

interface Props { onHide: () => void; }

const SYMBOLS = [
  { label: "BTC", value: "BINANCE:BTCUSDT" },
  { label: "ETH", value: "BINANCE:ETHUSDT" },
  { label: "SOL", value: "BINANCE:SOLUSDT" },
  { label: "ARB", value: "BINANCE:ARBUSDT" },
];

export default function MacdRsiWidget({ onHide }: Props) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [symbol, setSymbol] = useState(SYMBOLS[0].value);
  const [interval, setInterval] = useState("1h");
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptInjected = useRef(false);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const defaultPos = {
    x: 12,
    y: typeof window !== "undefined" ? Math.max(80, window.innerHeight - 460) : 300,
  };
  const { pos, isDragging, isSnapping, elementRef, dragHandleProps } =
    useDraggable("macd-rsi-widget", defaultPos);

  const injectScript = () => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    el.innerHTML = "";
    scriptInjected.current = false;
    if (scriptInjected.current) return;
    scriptInjected.current = true;

    const wrapper = document.createElement("div");
    wrapper.className = "tradingview-widget-container__widget";
    wrapper.style.height = "100%";
    wrapper.style.width = "100%";
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
  };

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(injectScript, 80);
    return () => {
      clearTimeout(t);
      if (containerRef.current) containerRef.current.innerHTML = "";
      scriptInjected.current = false;
    };
  }, [open, symbol, interval]);

  const collapsed = !open;
  const panelStyle: React.CSSProperties = {
    position: "fixed",
    left: pos.x,
    top: pos.y,
    zIndex: 1300,
    width: collapsed ? "auto" : (isMobile ? "calc(100vw - 24px)" : "420px"),
    background: "rgba(10,12,18,0.97)",
    border: `1px solid ${hovered || isDragging ? "rgba(56,224,248,0.55)" : "rgba(56,224,248,0.2)"}`,
    borderRadius: 14,
    boxShadow: isDragging
      ? "0 8px 40px rgba(56,224,248,0.25)"
      : "0 4px 24px rgba(0,0,0,0.6)",
    transition: isSnapping
      ? "left 0.35s cubic-bezier(.4,0,.2,1), top 0.35s cubic-bezier(.4,0,.2,1)"
      : "none",
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
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          cursor: "grab",
          borderBottom: open ? "1px solid rgba(56,224,248,0.1)" : "none",
          background: "rgba(56,224,248,0.05)",
        }}
      >
        <span style={{ color: "rgba(56,224,248,0.9)", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em" }}>
          📉 MACD · RSI
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
            style={{ background: "none", border: "none", color: "rgba(56,224,248,0.7)", cursor: "pointer", fontSize: 13, padding: "2px 6px", borderRadius: 4 }}
            title={open ? "Collapse" : "Expand"}
          >
            {open ? "▲" : "▼"}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onHide(); }}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 13, padding: "2px 6px", borderRadius: 4 }}
            title="Hide"
          >
            ✕
          </button>
        </div>
      </div>

      {open && (
        <>
          <div style={{ display: "flex", gap: 6, padding: "8px 10px", borderBottom: "1px solid rgba(56,224,248,0.08)", flexWrap: "wrap" }}>
            {SYMBOLS.map(s => (
              <button
                key={s.value}
                onClick={() => setSymbol(s.value)}
                style={{
                  fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6, cursor: "pointer", border: "none",
                  background: symbol === s.value ? "rgba(56,224,248,0.18)" : "rgba(255,255,255,0.05)",
                  color: symbol === s.value ? "rgba(56,224,248,0.9)" : "rgba(255,255,255,0.45)",
                  transition: "all 0.15s",
                }}
              >
                {s.label}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            {["15m", "1h", "4h", "1D"].map(iv => (
              <button
                key={iv}
                onClick={() => setInterval(iv)}
                style={{
                  fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, cursor: "pointer", border: "none",
                  background: interval === iv ? "rgba(56,224,248,0.18)" : "rgba(255,255,255,0.05)",
                  color: interval === iv ? "rgba(56,224,248,0.9)" : "rgba(255,255,255,0.45)",
                  transition: "all 0.15s",
                }}
              >
                {iv}
              </button>
            ))}
          </div>
          <div
            ref={containerRef}
            className="tradingview-widget-container"
            style={{ width: "100%", height: 340 }}
          />
        </>
      )}
    </div>
  );
}
