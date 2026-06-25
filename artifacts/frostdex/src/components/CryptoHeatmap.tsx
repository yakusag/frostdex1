import { useEffect, useRef, useState } from "react";
import { useDraggable } from "@/hooks/useDraggable";

interface Props { onHide: () => void; }

export default function CryptoHeatmap({ onHide }: Props) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptInjected = useRef(false);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const defaultPos = {
    x: typeof window !== "undefined" ? window.innerWidth - 500 : 400,
    y: 80,
  };
  const { pos, isDragging, isSnapping, elementRef, dragHandleProps, wasDragged } =
    useDraggable("crypto-heatmap", defaultPos);

  useEffect(() => {
    if (!open || !containerRef.current || scriptInjected.current) return;
    scriptInjected.current = true;
    const el = containerRef.current;
    el.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.className = "tradingview-widget-container__widget";
    wrapper.style.height = "100%";
    wrapper.style.width = "100%";
    el.appendChild(wrapper);

    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-crypto-coins-heatmap.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      dataSource: "Crypto",
      blockSize: "market_cap_calc",
      blockColor: "change|60",
      locale: "en",
      colorTheme: "dark",
      hasTopBar: false,
      isDataSetEnabled: true,
      isZoomEnabled: true,
      hasSymbolTooltip: true,
      isMonoSize: false,
      width: "100%",
      height: "100%",
    });
    el.appendChild(script);

    return () => {
      el.innerHTML = "";
      scriptInjected.current = false;
    };
  }, [open]);

  const collapsed = !open;

  const panelStyle: React.CSSProperties = {
    position: "fixed",
    left: pos.x,
    top: pos.y,
    zIndex: 1300,
    width: collapsed ? "auto" : (isMobile ? "calc(100vw - 24px)" : "480px"),
    background: "rgba(10,12,18,0.97)",
    border: `1px solid ${hovered || isDragging ? "rgba(56,224,248,0.55)" : "rgba(56,224,248,0.2)"}`,
    borderRadius: 14,
    boxShadow: isDragging
      ? "0 8px 40px rgba(56,224,248,0.25)"
      : "0 4px 24px rgba(0,0,0,0.6)",
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
          🌡 CRYPTO HEATMAP
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
        <div
          ref={containerRef}
          className="tradingview-widget-container"
          style={{ width: "100%", height: 340 }}
        />
      )}
    </div>
  );
}
