import { useEffect, useRef, useState } from "react";
import { useDraggable } from "@/hooks/useDraggable";

interface MarketData {
  symbol: string;
  base: string;
  change24h: number;
  volume24h: number;
  openInterest: number;
  price: number;
}

async function fetchMarkets(): Promise<MarketData[]> {
  try {
    const res = await fetch("https://api.orderly.org/v1/public/futures", { cache: "no-store" });
    if (!res.ok) return [];
    const rows: any[] = (await res.json())?.data?.rows ?? [];
    return rows
      .map((r: any) => {
        const close = Number(r["24h_close"] ?? 0);
        const open = Number(r["24h_open"] ?? 0);
        const change = open > 0 ? ((close - open) / open) * 100 : 0;
        return {
          symbol: r.symbol ?? "",
          base: (r.symbol ?? "").split("_")[1] ?? r.symbol ?? "",
          change24h: change,
          volume24h: Number(r["24h_volumn"] ?? r["24h_volume"] ?? 0),
          openInterest: Number(r["open_interest"] ?? 0),
          price: close,
        };
      })
      .sort((a, b) => b.volume24h - a.volume24h);
  } catch {
    return [];
  }
}

function getColor(change: number): string {
  if (change > 8) return "#00e676";
  if (change > 4) return "#0ecb81";
  if (change > 2) return "#1a8f5e";
  if (change > 0.5) return "#145a3c";
  if (change > -0.5) return "#2a2e36";
  if (change > -2) return "#5a1f1f";
  if (change > -4) return "#a02828";
  if (change > -8) return "#d63131";
  return "#f6465d";
}

function fmtVol(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function fmtOI(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toFixed(0);
}

interface Props { onHide: () => void; }

export default function LiquidityHeatmap({ onHide }: Props) {
  const [open, setOpen] = useState(false);
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [loading, setLoading] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [tooltip, setTooltip] = useState<MarketData | null>(null);
  const [sizeBy, setSizeBy] = useState<"volume" | "oi">("volume");
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const defaultPos = {
    x: 12,
    y: typeof window !== "undefined" ? window.innerHeight - 270 : 500,
  };
  const { pos, isDragging, isSnapping, elementRef, isBottomHalf, dragHandleProps, wasDragged } =
    useDraggable("liquidity-heatmap", defaultPos);

  const load = async () => {
    setLoading(true);
    const data = await fetchMarkets();
    setMarkets(data);
    setLoading(false);
  };

  useEffect(() => {
    if (open && !markets.length) load();
    if (open) {
      intervalRef.current = setInterval(load, 30_000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [open]);

  const panelStyle: React.CSSProperties = isBottomHalf
    ? { position: "absolute", bottom: "calc(100% + 8px)", left: 0 }
    : { position: "absolute", top: "calc(100% + 8px)", left: 0 };

  const maxMetric = markets.length
    ? sizeBy === "volume"
      ? markets[0].volume24h
      : Math.max(...markets.map((m) => m.openInterest))
    : 1;

  return (
    <div
      ref={elementRef}
      {...dragHandleProps}
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        zIndex: 200,
        userSelect: isDragging ? "none" : "auto",
        cursor: isDragging ? "grabbing" : "grab",
        transition: isSnapping
          ? "left 0.25s cubic-bezier(.22,1,.36,1), top 0.25s cubic-bezier(.22,1,.36,1)"
          : "none",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {(hovered || isMobile) && !open && (
        <div className="widget-controls">
          <button
            className="widget-hide-btn"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onHide}
            title="Hide widget"
          >
            ✕
          </button>
        </div>
      )}

      <button
        className="sentiment-fab"
        onClick={() => {
          if (wasDragged()) return;
          setOpen((v) => !v);
        }}
        aria-label="Liquidity Heatmap"
      >
        🌡 <span>Heatmap</span>
      </button>

      {open && (
        <div
          className="sentiment-panel"
          style={{ ...panelStyle, width: 440, maxWidth: "calc(100vw - 24px)" }}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <div className="sentiment-header">
            <span className="sentiment-title">
              🌡 Liquidity Heatmap
              {markets.length > 0 && (
                <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.55, marginLeft: 6 }}>
                  {markets.length} markets
                </span>
              )}
            </span>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button
                onClick={load}
                disabled={loading}
                className="sentiment-refresh"
                style={{ fontSize: 14 }}
              >
                {loading ? "…" : "↺"}
              </button>
              <button className="sentiment-close" onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "5px 12px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              fontSize: 10,
            }}
          >
            <span style={{ color: "rgba(255,255,255,0.4)" }}>Size by:</span>
            <button
              onClick={() => setSizeBy("volume")}
              style={{
                fontSize: 10,
                padding: "2px 8px",
                borderRadius: 3,
                border: "none",
                cursor: "pointer",
                background: sizeBy === "volume" ? "rgba(56,224,248,0.18)" : "rgba(255,255,255,0.06)",
                color: sizeBy === "volume" ? "rgb(56,224,248)" : "rgba(255,255,255,0.5)",
                fontWeight: sizeBy === "volume" ? 700 : 400,
              }}
            >
              Volume
            </button>
            <button
              onClick={() => setSizeBy("oi")}
              style={{
                fontSize: 10,
                padding: "2px 8px",
                borderRadius: 3,
                border: "none",
                cursor: "pointer",
                background: sizeBy === "oi" ? "rgba(56,224,248,0.18)" : "rgba(255,255,255,0.06)",
                color: sizeBy === "oi" ? "rgb(56,224,248)" : "rgba(255,255,255,0.5)",
                fontWeight: sizeBy === "oi" ? 700 : 400,
              }}
            >
              Open Interest
            </button>
            <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.25)", fontSize: 9 }}>
              Color = 24h change
            </span>
          </div>

          {tooltip && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "5px 12px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                fontSize: 11,
                background: "rgba(0,0,0,0.3)",
              }}
            >
              <span style={{ fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>{tooltip.base}/USDC</span>
              <span style={{ color: "rgba(255,255,255,0.5)" }}>
                ${tooltip.price.toLocaleString("en-US", { maximumFractionDigits: 4 })}
              </span>
              <span
                style={{
                  fontWeight: 700,
                  color: tooltip.change24h >= 0 ? "#0ecb81" : "#f6465d",
                }}
              >
                {tooltip.change24h >= 0 ? "+" : ""}
                {tooltip.change24h.toFixed(2)}%
              </span>
              <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.4)" }}>
                Vol {fmtVol(tooltip.volume24h)}
              </span>
              <span style={{ color: "rgba(255,255,255,0.4)" }}>OI {fmtOI(tooltip.openInterest)}</span>
            </div>
          )}

          {loading && !markets.length && (
            <div className="sentiment-loading">Loading all markets…</div>
          )}

          {markets.length > 0 && (
            <div style={{ padding: "8px 10px", overflowY: "auto", maxHeight: 360 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                {markets.map((m) => {
                  const metric = sizeBy === "volume" ? m.volume24h : m.openInterest;
                  const sizeFactor = maxMetric > 0 ? Math.sqrt(metric / maxMetric) : 0.1;
                  const minSize = 34;
                  const maxSize = 82;
                  const size = Math.round(minSize + sizeFactor * (maxSize - minSize));
                  const color = getColor(m.change24h);
                  const fontSize = Math.max(8, Math.min(11, size / 5));
                  return (
                    <div
                      key={m.symbol}
                      onMouseEnter={() => setTooltip(m)}
                      onMouseLeave={() => setTooltip(null)}
                      style={{
                        width: size,
                        height: size,
                        background: color,
                        borderRadius: 4,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "default",
                        fontSize,
                        fontWeight: 700,
                        color: "rgba(255,255,255,0.95)",
                        border:
                          tooltip?.symbol === m.symbol
                            ? "1px solid rgba(255,255,255,0.7)"
                            : "1px solid transparent",
                        textAlign: "center",
                        padding: 2,
                        overflow: "hidden",
                        letterSpacing: 0.2,
                        transition: "border 0.1s",
                      }}
                    >
                      <span
                        style={{
                          lineHeight: 1.1,
                          maxWidth: "100%",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          paddingInline: 1,
                        }}
                      >
                        {m.base}
                      </span>
                      {size >= 42 && (
                        <span
                          style={{
                            fontSize: Math.max(7, fontSize - 1),
                            opacity: 0.88,
                            lineHeight: 1.1,
                          }}
                        >
                          {m.change24h >= 0 ? "+" : ""}
                          {m.change24h.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 9,
                  color: "rgba(255,255,255,0.2)",
                }}
              >
                <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                  {[-8, -4, -2, 0.5, 2, 4, 8].map((v) => (
                    <div
                      key={v}
                      style={{ width: 8, height: 8, background: getColor(v + 0.01), borderRadius: 1 }}
                    />
                  ))}
                  <span style={{ marginLeft: 2 }}>Bear → Bull</span>
                </div>
                <span style={{ marginLeft: "auto" }}>Auto-refresh 30s · FrostDex</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
