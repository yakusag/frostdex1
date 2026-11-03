import { useEffect, useRef, useState } from "react";
import { FROST_TOKEN } from "@/utils/customTokens";

interface MarketItem {
  symbol: string;
  base: string;
  price: number;
  change: number;
  isFrost?: boolean;
  volume?: number;
}

function fmt(price: number, base: string): string {
  if (["1000PEPE", "1000BONK", "1000SHIB"].includes(base)) {
    return price.toFixed(8);
  }
  if (price < 0.000001) return price.toFixed(10);
  if (price < 0.0001) return price.toFixed(8);
  if (price < 0.01) return price.toFixed(6);
  if (price < 1) return price.toFixed(4);
  if (price < 100) return price.toFixed(3);
  return price.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

async function fetchMarkets(): Promise<MarketItem[]> {
  try {
    const res = await fetch("https://api.orderly.org/v1/public/futures", {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: { rows?: unknown[] } };
    const marketRows = Array.isArray(json.data?.rows) ? json.data.rows : [];
    const markets: MarketItem[] = [];

    for (const candidate of marketRows) {
      if (!candidate || typeof candidate !== "object") continue;
      const row = candidate as Record<string, unknown>;
      const symbol = row.symbol;
      if (
        typeof symbol !== "string" ||
        !/^PERP_[A-Z0-9]+_USDC$/.test(symbol) ||
        row.status === "DELISTING"
      ) {
        continue;
      }

      const price = Number(row["24h_close"] ?? row.mark_price ?? 0);
      if (!Number.isFinite(price) || price <= 0) continue;

      const open = Number(row["24h_open"] ?? 0);
      const change =
        Number.isFinite(open) && open > 0 ? ((price - open) / open) * 100 : 0;
      const volume = Number(row["24h_volume"] ?? 0);
      const base =
        typeof row.display_symbol_name === "string"
          ? row.display_symbol_name
          : symbol.split("_")[1];

      markets.push({
        symbol,
        base,
        price,
        change,
        volume: Number.isFinite(volume) ? volume : 0,
      });
    }

    return markets.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
  } catch {
    return [];
  }
}

async function fetchFrostPrice(): Promise<MarketItem | null> {
  try {
    const res = await fetch(
      `https://api.geckoterminal.com/api/v2/networks/arbitrum/pools/${FROST_TOKEN.poolAddress}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const json = await res.json();
    const attrs = json?.data?.attributes;
    if (!attrs) return null;
    const price = parseFloat(attrs.base_token_price_usd ?? "0");
    const change = parseFloat(attrs.price_change_percentage?.h24 ?? "0");
    if (!price) return null;
    return {
      symbol: "FROST_USDC",
      base: "FROST",
      price,
      change,
      isFrost: true,
    };
  } catch {
    return null;
  }
}

export default function MarketTickerBar() {
  const [items, setItems] = useState<MarketItem[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function load() {
      const [markets, frost] = await Promise.all([
        fetchMarkets(),
        fetchFrostPrice(),
      ]);
      const all = frost ? [frost, ...markets] : markets;
      setItems(all);
    }
    load();
    intervalRef.current = setInterval(load, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (items.length === 0) return null;

  const doubled = [...items, ...items];
  const tickerDuration = Math.max(60, items.length * 4.3);

  return (
    <div className="market-ticker-bar" aria-label="Live market prices">
      <div
        className="ticker-track"
        style={{ animationDuration: `${tickerDuration}s` }}
      >
        {doubled.map((item, i) => (
          <div
            key={`${item.symbol}-${i}`}
            className={`ticker-item${item.isFrost ? " ticker-item--frost" : ""}`}
          >
            {item.isFrost && <span className="ticker-frost-badge">❄</span>}
            <span className="ticker-base">{item.base}</span>
            <span className="ticker-price">${fmt(item.price, item.base)}</span>
            <span
              className={`ticker-change ${item.change >= 0 ? "up" : "down"}`}
            >
              {item.change >= 0 ? "▲" : "▼"} {Math.abs(item.change).toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
