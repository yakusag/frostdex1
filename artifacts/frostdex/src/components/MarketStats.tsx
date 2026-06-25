import { useEffect, useState } from "react";

interface Stats {
  btcDominance: number;
  totalMarketCap: number;
  marketCapChange24h: number;
  fearGreed: number;
  fearGreedLabel: string;
}

function fmtCap(v: number): string {
  if (v >= 1e12) return "$" + (v / 1e12).toFixed(2) + "T";
  if (v >= 1e9)  return "$" + (v / 1e9).toFixed(1) + "B";
  return "$" + (v / 1e6).toFixed(0) + "M";
}

function fgColor(v: number) {
  if (v <= 25) return "#f6465d";
  if (v <= 45) return "#ff9500";
  if (v <= 55) return "#b7bec8";
  if (v <= 75) return "#0ecb81";
  return "#38e0f8";
}

export default function MarketStats() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [cgRes, fgRes] = await Promise.allSettled([
          fetch("https://api.coingecko.com/api/v3/global", { cache: "no-store" }),
          fetch("https://api.alternative.me/fng/?limit=1", { cache: "no-store" }),
        ]);

        if (cancelled) return;

        let btcDom = 0, cap = 0, capChange = 0;
        if (cgRes.status === "fulfilled" && cgRes.value.ok) {
          const cg = await cgRes.value.json();
          const d = cg?.data;
          btcDom = d?.market_cap_percentage?.btc ?? 0;
          cap = d?.total_market_cap?.usd ?? 0;
          capChange = d?.market_cap_change_percentage_24h_usd ?? 0;
        }

        let fg = 50, fgLabel = "Neutral";
        if (fgRes.status === "fulfilled" && fgRes.value.ok) {
          const fgData = await fgRes.value.json();
          const entry = fgData?.data?.[0];
          if (entry) { fg = Number(entry.value); fgLabel = entry.value_classification; }
        }

        if (!cancelled) {
          setStats({ btcDominance: btcDom, totalMarketCap: cap, marketCapChange24h: capChange, fearGreed: fg, fearGreedLabel: fgLabel });
        }
      } catch {}
    }

    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (!stats) return null;

  const changeColor = stats.marketCapChange24h >= 0 ? "#0ecb81" : "#f6465d";
  const changeSign  = stats.marketCapChange24h >= 0 ? "+" : "";

  return (
    <div style={{
      width: "100%",
      background: "rgba(7,9,14,0.98)",
      borderBottom: "1px solid rgba(255,255,255,0.045)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexWrap: "wrap",
      gap: "0 20px",
      padding: "3px 16px",
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.02em",
      color: "rgba(255,255,255,0.45)",
      lineHeight: 1.8,
      userSelect: "none",
      zIndex: 900,
    }}>
      <span>
        <span style={{ color: "rgba(255,255,255,0.28)", marginRight: 4 }}>BTC.D</span>
        <span style={{ color: "#f0b90b" }}>{stats.btcDominance.toFixed(1)}%</span>
      </span>
      <span style={{ color: "rgba(255,255,255,0.15)" }}>|</span>
      <span>
        <span style={{ color: "rgba(255,255,255,0.28)", marginRight: 4 }}>Market Cap</span>
        <span style={{ color: "rgba(255,255,255,0.7)" }}>{fmtCap(stats.totalMarketCap)}</span>
        {stats.marketCapChange24h !== 0 && (
          <span style={{ color: changeColor, marginLeft: 4 }}>
            {changeSign}{stats.marketCapChange24h.toFixed(2)}%
          </span>
        )}
      </span>
      <span style={{ color: "rgba(255,255,255,0.15)" }}>|</span>
      <span>
        <span style={{ color: "rgba(255,255,255,0.28)", marginRight: 4 }}>F&G</span>
        <span style={{ color: fgColor(stats.fearGreed), fontWeight: 700 }}>
          {stats.fearGreed} {stats.fearGreedLabel}
        </span>
      </span>
    </div>
  );
}
