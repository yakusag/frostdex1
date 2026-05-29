import { useEffect, useRef, useState } from "react";
import { useDraggable } from "@/hooks/useDraggable";

interface WhaleAlert { id: string; symbol: string; side: "buy" | "sell"; size: number; price: number; value: number; time: number; address?: string; }

const SYMBOLS = [
  "PERP_BTC_USDC","PERP_ETH_USDC","PERP_SOL_USDC","PERP_ARB_USDC",
  "PERP_BNB_USDC","PERP_AVAX_USDC","PERP_DOGE_USDC","PERP_SUI_USDC",
  "PERP_LINK_USDC","PERP_OP_USDC","PERP_WIF_USDC","PERP_PEPE_USDC",
];

const THRESHOLDS = [
  { label: "$10K", value: 10_000 },
  { label: "$50K", value: 50_000 },
  { label: "$100K", value: 100_000 },
  { label: "$500K", value: 500_000 },
];

function fmtVal(v: number) {
  if (v >= 1e9) return "$" + (v/1e9).toFixed(2) + "B";
  if (v >= 1e6) return "$" + (v/1e6).toFixed(2) + "M";
  if (v >= 1e3) return "$" + (v/1e3).toFixed(0) + "K";
  return "$" + v.toFixed(0);
}
function fmtTime(ts: number) {
  const d = Math.floor((Date.now()-ts)/1000);
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d/60)}m ago`;
  return `${Math.floor(d/3600)}h ago`;
}
function shortAddr(addr: string) {
  if (addr.length < 10) return addr;
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

async function fetchRecentTrades(symbol: string): Promise<WhaleAlert[]> {
  try {
    const res = await fetch(`https://api.orderly.org/v1/public/market_trades?symbol=${symbol}&limit=50`, { cache: "no-store" });
    if (!res.ok) return [];
    const json = await res.json();
    return (json?.data?.rows ?? [])
      .map((t: any) => ({
        id: `${symbol}-${t.ts}-${t.executed_quantity}-${t.side}`,
        symbol,
        side: t.side?.toLowerCase() === "buy" ? "buy" : "sell",
        size: Number(t.executed_quantity),
        price: Number(t.executed_price),
        value: Number(t.executed_price) * Number(t.executed_quantity),
        time: Number(t.ts),
      }));
  } catch { return []; }
}

async function fetchAddressTrades(address: string): Promise<WhaleAlert[]> {
  try {
    const results: WhaleAlert[] = [];
    await Promise.all(SYMBOLS.map(async (symbol) => {
      const res = await fetch(
        `https://api.orderly.org/v1/public/market_trades?symbol=${symbol}&limit=50`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const json = await res.json();
      const rows: WhaleAlert[] = (json?.data?.rows ?? [])
        .filter((t: any) => t.maker_address?.toLowerCase() === address.toLowerCase() || t.taker_address?.toLowerCase() === address.toLowerCase())
        .map((t: any) => ({
          id: `addr-${symbol}-${t.ts}-${t.executed_quantity}`,
          symbol,
          side: t.side?.toLowerCase() === "buy" ? "buy" : "sell",
          size: Number(t.executed_quantity),
          price: Number(t.executed_price),
          value: Number(t.executed_price) * Number(t.executed_quantity),
          time: Number(t.ts),
          address,
        }));
      results.push(...rows);
    }));
    return results;
  } catch { return []; }
}

interface Props { onHide: () => void; }

export default function WhaleAlerts({ onHide }: Props) {
  const [alerts, setAlerts] = useState<WhaleAlert[]>([]);
  const [open, setOpen] = useState(false);
  const [hasNew, setHasNew] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [threshold, setThreshold] = useState(50_000);
  const [addrInput, setAddrInput] = useState("");
  const [searchAddr, setSearchAddr] = useState("");
  const [addrAlerts, setAddrAlerts] = useState<WhaleAlert[]>([]);
  const [addrLoading, setAddrLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"live" | "address">("live");
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const seenIds = useRef<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const defaultPos = { x: typeof window !== "undefined" ? window.innerWidth - 66 : 1200, y: typeof window !== "undefined" ? window.innerHeight - 178 : 500 };
  const { pos, isDragging, isSnapping, elementRef, isBottomHalf, dragHandleProps, wasDragged } = useDraggable("whale-alerts", defaultPos);

  const fetchAll = async () => {
    const all = (await Promise.all(SYMBOLS.map(fetchRecentTrades))).flat();
    const filtered = all.filter(a => a.value >= threshold);
    const newAlerts = filtered.filter(a => !seenIds.current.has(a.id));
    if (newAlerts.length > 0) {
      newAlerts.forEach(a => seenIds.current.add(a.id));
      setAlerts(prev => [...newAlerts, ...prev].sort((a,b) => b.time - a.time).slice(0, 100));
      if (!open) setHasNew(true);
    }
  };

  useEffect(() => {
    seenIds.current.clear();
    setAlerts([]);
    fetchAll();
    intervalRef.current = setInterval(fetchAll, 15_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [threshold]);

  const searchByAddress = async () => {
    const addr = addrInput.trim();
    if (!addr) return;
    setSearchAddr(addr);
    setAddrLoading(true);
    setAddrAlerts([]);
    const found = await fetchAddressTrades(addr);
    setAddrAlerts(found.sort((a, b) => b.time - a.time));
    setAddrLoading(false);
  };

  const base = (sym: string) => sym.replace("PERP_", "").replace("_USDC", "");
  const displayed = activeTab === "live" ? alerts : addrAlerts;

  const panelStyle: React.CSSProperties = isBottomHalf
    ? { position: "absolute", bottom: "calc(100% + 8px)", right: 0 }
    : { position: "absolute", top: "calc(100% + 8px)", right: 0 };

  return (
    <div
      ref={elementRef}
      {...dragHandleProps}
      style={{ position: "fixed", left: pos.x, top: pos.y, zIndex: 200, userSelect: isDragging ? "none" : "auto", cursor: isDragging ? "grabbing" : "grab", transition: isSnapping ? "left 0.25s cubic-bezier(.22,1,.36,1), top 0.25s cubic-bezier(.22,1,.36,1)" : "none" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {(hovered || isMobile) && !open && (
        <div className="widget-controls widget-controls--right">
          <button className="widget-hide-btn" onMouseDown={e => e.stopPropagation()} onClick={onHide} title="Hide widget">✕</button>
        </div>
      )}

      <button className="whale-fab" onClick={() => { if (wasDragged()) return; setOpen(v => !v); setHasNew(false); }} aria-label="Whale Alerts">
        🐋
        {hasNew && <span className="whale-badge" />}
      </button>

      {open && (
        <div
          className="whale-panel"
          style={{ ...panelStyle, width: 320, maxWidth: "calc(100vw - 24px)" }}
          onMouseDown={e => e.stopPropagation()}
          onTouchStart={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="whale-panel-header">
            <span className="whale-panel-title">🐋 Whale Alerts</span>
            <button
              onClick={() => setOpen(false)}
              style={{ background: "none", border: "none", color: "rgba(180,190,210,0.5)", cursor: "pointer", fontSize: 14, padding: "0 2px" }}
            >✕</button>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.07)", marginBottom: 6 }}>
            {(["live", "address"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1, padding: "7px 0", fontSize: 11, fontWeight: 600, border: "none", background: "none", cursor: "pointer",
                  color: activeTab === tab ? "#38e0f8" : "rgba(180,190,210,0.5)",
                  borderBottom: activeTab === tab ? "2px solid #38e0f8" : "2px solid transparent",
                  marginBottom: -1,
                }}
              >
                {tab === "live" ? "🔴 Live Feed" : "🔍 By Address"}
              </button>
            ))}
          </div>

          {/* Live tab controls */}
          {activeTab === "live" && (
            <div style={{ padding: "4px 10px 6px", display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10, color: "rgba(180,190,210,0.5)", marginRight: 2 }}>Min size:</span>
              {THRESHOLDS.map(t => (
                <button
                  key={t.value}
                  onClick={() => setThreshold(t.value)}
                  style={{
                    padding: "2px 8px", borderRadius: 4, border: "none", fontSize: 10, cursor: "pointer", fontWeight: 600,
                    background: threshold === t.value ? "#38e0f8" : "rgba(56,224,248,0.1)",
                    color: threshold === t.value ? "#0b0e11" : "#38e0f8",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {/* Address search tab */}
          {activeTab === "address" && (
            <div style={{ padding: "6px 10px" }}>
              <div style={{ display: "flex", gap: 4 }}>
                <input
                  value={addrInput}
                  onChange={e => setAddrInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") searchByAddress(); }}
                  placeholder="0x... wallet address"
                  style={{
                    flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 6, padding: "5px 8px", fontSize: 11, color: "#eaecef", outline: "none",
                  }}
                />
                <button
                  onClick={searchByAddress}
                  disabled={addrLoading}
                  style={{
                    padding: "5px 10px", borderRadius: 6, border: "none", background: "#38e0f8",
                    color: "#0b0e11", fontSize: 11, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  {addrLoading ? "…" : "Search"}
                </button>
              </div>
              {searchAddr && !addrLoading && (
                <div style={{ fontSize: 10, color: "rgba(180,190,210,0.5)", marginTop: 4 }}>
                  {addrAlerts.length} trades found for {shortAddr(searchAddr)}
                </div>
              )}
            </div>
          )}

          {/* Alert list */}
          <div className="whale-list">
            {activeTab === "live" && alerts.length === 0 && (
              <div className="whale-empty">Watching for whale trades ≥ {fmtVal(threshold)}…</div>
            )}
            {activeTab === "address" && !searchAddr && (
              <div className="whale-empty">Enter a wallet address to search trades</div>
            )}
            {activeTab === "address" && searchAddr && addrLoading && (
              <div className="whale-empty">Searching…</div>
            )}
            {activeTab === "address" && searchAddr && !addrLoading && addrAlerts.length === 0 && (
              <div className="whale-empty">No trades found for this address</div>
            )}
            {displayed.map(a => (
              <div key={a.id} className={`whale-item whale-item--${a.side}`}>
                <div className="whale-item-left">
                  <span className={`whale-side-badge whale-side-badge--${a.side}`}>{a.side === "buy" ? "▲ BUY" : "▼ SELL"}</span>
                  <span className="whale-symbol">{base(a.symbol)}</span>
                </div>
                <div className="whale-item-right">
                  <span className="whale-value">{fmtVal(a.value)}</span>
                  <span className="whale-time">{fmtTime(a.time)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="whale-panel-footer">
            {activeTab === "live"
              ? `Live · ${fmtVal(threshold)}+ · refreshes every 15s`
              : searchAddr ? `Showing trades for ${shortAddr(searchAddr)}` : "Search by wallet address"
            }
          </div>
        </div>
      )}
    </div>
  );
}
