import { useEffect, useRef, useState } from "react";
import { useDraggable } from "@/hooks/useDraggable";

interface FuturesRow {
  symbol: string;
  mark_price: number;
  open_interest: number;
}

interface LiqLevel {
  price: number;
  side: "long" | "short";
  leverage: string;
  movePct: number;
}

const DISPLAY_MAP: Record<string, string> = {
  PERP_XAU_USDC: "XAU",
  PERP_XAG_USDC: "XAG",
  PERP_CL_USDC: "OIL",
  PERP_NATGAS_USDC_arthur: "GAS",
};

function baseLabel(sym: string): string {
  if (DISPLAY_MAP[sym]) return DISPLAY_MAP[sym];
  const m = sym.match(/^PERP_(.+?)_USDC/);
  return m ? m[1] : sym;
}

const LEVERAGE_LEVELS = [100, 75, 50, 25, 20, 15, 10, 5];

const PRIORITY = [
  "PERP_BTC_USDC",
  "PERP_ETH_USDC",
  "PERP_SOL_USDC",
  "PERP_ARB_USDC",
  "PERP_BNB_USDC",
  "PERP_XAU_USDC",
  "PERP_XAG_USDC",
  "PERP_CL_USDC",
];

async function fetchAllFutures(): Promise<FuturesRow[]> {
  try {
    const res = await fetch("https://api.orderly.org/v1/public/futures", {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { data?: { rows?: unknown[] } };
    const rows = Array.isArray(body.data?.rows) ? body.data.rows : [];
    return rows
      .filter(
        (row): row is Record<string, unknown> =>
          typeof row === "object" && row !== null,
      )
      .map((row) => ({
        symbol: typeof row.symbol === "string" ? row.symbol : "",
        mark_price: Number(row.mark_price ?? row["24h_close"] ?? 0),
        open_interest: Number(row.open_interest ?? 0),
      }))
      .filter((r) => r.symbol && r.mark_price > 0)
      .sort((a, b) => {
        const ai = PRIORITY.indexOf(a.symbol),
          bi = PRIORITY.indexOf(b.symbol);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return a.symbol.localeCompare(b.symbol);
      });
  } catch {
    return [];
  }
}

function buildLevels(mark: number): LiqLevel[] {
  const levels: LiqLevel[] = [];
  for (const leverage of LEVERAGE_LEVELS) {
    const movePct = 100 / leverage;
    levels.push({
      price: mark * (1 - movePct / 100),
      side: "long",
      leverage: `${leverage}x`,
      movePct,
    });
    levels.push({
      price: mark * (1 + movePct / 100),
      side: "short",
      leverage: `${leverage}x`,
      movePct,
    });
  }
  return levels.sort((a, b) => b.price - a.price);
}

function fmtPrice(p: number): string {
  if (p >= 10000) return p.toFixed(0);
  if (p >= 100) return p.toFixed(2);
  if (p >= 1) return p.toFixed(3);
  return p.toFixed(4);
}
function fmtUSD(v: number): string {
  if (v >= 1e6) return "$" + (v / 1e6).toFixed(1) + "M";
  if (v >= 1e3) return "$" + (v / 1e3).toFixed(0) + "K";
  return "$" + v.toFixed(0);
}

interface Props {
  onHide: () => void;
}

export default function LiqHeatmap({ onHide }: Props) {
  const [open, setOpen] = useState(false);
  const [allRows, setAllRows] = useState<FuturesRow[]>([]);
  const [selected, setSelected] = useState<FuturesRow | null>(null);
  const [levels, setLevels] = useState<LiqLevel[]>([]);
  const [loading, setLoading] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [symSearch, setSymSearch] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  const defaultPos = { x: 12, y: 70 };
  const {
    pos,
    isDragging,
    isSnapping,
    elementRef,
    isBottomHalf,
    dragHandleProps,
    wasDragged,
  } = useDraggable("liq-heatmap", defaultPos, true);

  const loadAll = async () => {
    setLoading(true);
    const rows = await fetchAllFutures();
    setAllRows(rows);
    setSelected((prev) => {
      const sym = prev?.symbol ?? rows[0]?.symbol;
      const found = rows.find((r) => r.symbol === sym) ?? rows[0] ?? null;
      if (found) setLevels(buildLevels(found.mark_price));
      return found;
    });
    setLoading(false);
  };

  const selectRow = (row: FuturesRow) => {
    setSelected(row);
    setLevels(buildLevels(row.mark_price));
    setSymSearch("");
  };

  useEffect(() => {
    loadAll();
    intervalRef.current = setInterval(loadAll, 20_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const panelStyle: React.CSSProperties = isBottomHalf
    ? { position: "absolute", bottom: "calc(100% + 8px)", right: 0 }
    : { position: "absolute", top: "calc(100% + 8px)", right: 0 };

  const markPrice = selected?.mark_price ?? 0;
  const maxMove = Math.max(...levels.map((level) => level.movePct), 0.01);
  const query = symSearch.trim().toUpperCase();
  const filteredRows = query
    ? allRows.filter(
        (r) => baseLabel(r.symbol).includes(query) || r.symbol.includes(query),
      )
    : allRows;

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
        <div className="widget-controls widget-controls--right">
          <button
            className="widget-hide-btn"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onHide}
            title="Hide"
          >
            ✕
          </button>
        </div>
      )}

      <button
        className="liq-fab"
        onClick={() => {
          if (wasDragged()) return;
          setOpen((v) => !v);
        }}
        aria-label="Liquidation Heatmap"
      >
        <span style={{ fontSize: 16 }}>🔥</span>
      </button>

      {open && (
        <div
          className="liq-panel"
          style={{ ...panelStyle, width: 310, maxWidth: "calc(100vw - 24px)" }}
        >
          <div className="liq-header">
            <div className="liq-header-left">
              <span style={{ fontSize: 14 }}>🔥</span>
              <div>
                <div className="liq-title">Liq Scenarios</div>
                <div className="liq-sub">
                  Live OI {fmtUSD(markPrice * (selected?.open_interest ?? 0))} · {allRows.length} markets
                </div>
              </div>
            </div>
            {selected && (
              <div className="liq-mark">
                <div
                  style={{ fontSize: 11, fontWeight: 700, color: "#38e0f8" }}
                >
                  ${fmtPrice(markPrice)}
                </div>
                <div style={{ fontSize: 9, color: "rgba(180,190,210,0.4)" }}>
                  mark
                </div>
              </div>
            )}
          </div>

          {/* Symbol picker — search + scrollable list */}
          <div
            className="liq-sym-picker"
            role="presentation"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <div className="liq-sym-search-wrap">
              <input
                className="liq-sym-search"
                placeholder={
                  selected
                    ? `${baseLabel(selected.symbol)} — search markets…`
                    : "Search markets…"
                }
                value={symSearch}
                onChange={(e) => setSymSearch(e.target.value)}
              />
              {symSearch && (
                <button
                  className="liq-sym-clear"
                  onClick={() => setSymSearch("")}
                >
                  ✕
                </button>
              )}
            </div>
            <div className="liq-symbols">
              {filteredRows.map((r) => (
                <button
                  key={r.symbol}
                  className={`liq-sym-btn ${selected?.symbol === r.symbol ? "liq-sym-btn--active" : ""}`}
                  onClick={() => selectRow(r)}
                >
                  {baseLabel(r.symbol)}
                </button>
              ))}
              {filteredRows.length === 0 && (
                <span
                  style={{
                    fontSize: 10,
                    color: "rgba(180,190,210,0.4)",
                    padding: "4px 6px",
                  }}
                >
                  No markets found
                </span>
              )}
            </div>
          </div>

          <div className="liq-legend">
            <span style={{ color: "#0ecb81" }}>■</span> Short-risk move &nbsp;
            <span style={{ color: "#f6465d" }}>■</span> Long-risk move
          </div>

          <div
            className="liq-grid"
            role="presentation"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            {loading && levels.length === 0 && (
              <div className="liq-empty">Loading price levels…</div>
            )}
            {levels.map((lv, i) => {
              const isAbove = lv.price > markPrice;
              const barPct = Math.round((lv.movePct / maxMove) * 100);
              const color = isAbove ? "#0ecb81" : "#f6465d";
              const isMarkRow =
                i < levels.length - 1 &&
                levels[i].price > markPrice &&
                levels[i + 1].price < markPrice;
              return (
                <div key={`${lv.leverage}-${lv.side}`}>
                  {isMarkRow && (
                    <div className="liq-mark-line">
                      <span className="liq-mark-price">
                        ${fmtPrice(markPrice)}
                      </span>
                      <div className="liq-mark-dash" />
                    </div>
                  )}
                  <div
                    className={`liq-row liq-row--${isAbove ? "short" : "long"}`}
                  >
                    <div className="liq-row-price">${fmtPrice(lv.price)}</div>
                    <div className="liq-bar-wrap">
                      <div
                        className="liq-bar"
                        style={{
                          width: `${barPct}%`,
                          background: color,
                          opacity: 0.15 + (barPct / 100) * 0.7,
                        }}
                      />
                      <span className="liq-bar-label" style={{ color }}>
                        {lv.movePct.toFixed(2)}% move
                      </span>
                    </div>
                    <div className="liq-row-lev">{lv.leverage}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="liq-footer">
            Live mark/OI · 1 ÷ leverage price moves only; actual liquidation depends on venue margin rules, fees, and funding.
          </div>
        </div>
      )}
    </div>
  );
}
