import { useState, useEffect, useRef, useCallback } from "react";
import type { Candle } from "@/components/BotChart";

export const BINANCE_SYMBOLS: Record<string, string> = {
  BTC: "BTC",
  ETH: "ETH",
  SOL: "SOL",
  ARB: "ARB",
  BNB: "BNB",
};

const CC_SYMBOLS: Record<string, string> = {
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
  SOL: "SOLUSDT",
  ARB: "ARBUSDT",
  BNB: "BNBUSDT",
};

const TF_LIMIT: Record<string, number> = {
  "15m": 96,
  "1h": 120,
  "4h": 90,
  "1d": 180,
};

const TF_CC: Record<string, { endpoint: string; aggregate: number }> = {
  "15m": { endpoint: "histominute", aggregate: 15 },
  "1h":  { endpoint: "histohour",   aggregate: 1  },
  "4h":  { endpoint: "histohour",   aggregate: 4  },
  "1d":  { endpoint: "histoday",    aggregate: 1  },
};

export interface BinanceFeedResult {
  candles: Candle[];
  latestPrice: number | null;
  loading: boolean;
  error: string | null;
  wsConnected: boolean;
  refetch: () => void;
}

export function useBinanceFeed(
  symbol: string,
  timeframe: string,
  liveEnabled = false
): BinanceFeedResult {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [latestPrice, setLatestPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const limit = TF_LIMIT[timeframe] ?? 120;
  const ccSym = BINANCE_SYMBOLS[symbol] ?? symbol;
  const ccTf = TF_CC[timeframe] ?? TF_CC["1h"];

  const fetchCandles = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);

    // CryptoCompare free public API — no key needed, CORS-friendly
    const url =
      `https://min-api.cryptocompare.com/data/${ccTf.endpoint}` +
      `?fsym=${ccSym}&tsym=USDT&limit=${limit}&aggregate=${ccTf.aggregate}&e=CCCAGG`;

    fetch(url, { signal: ctrl.signal })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: any) => {
        const rows: any[] = json?.Data ?? [];
        if (!Array.isArray(rows) || rows.length === 0) throw new Error("No data");
        // CryptoCompare returns time in seconds
        const mapped: Candle[] = rows.map(k => ({
          t: k.time * 1000,
          o: k.open,
          h: k.high,
          l: k.low,
          c: k.close,
          v: k.volumefrom,
        }));
        setCandles(mapped);
        setLatestPrice(mapped[mapped.length - 1].c);
        setLoading(false);
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") {
          setError(e?.message ?? "Fetch failed");
          setLoading(false);
        }
      });
  }, [ccSym, timeframe, limit, ccTf.endpoint, ccTf.aggregate]);

  useEffect(() => {
    fetchCandles();
    return () => { abortRef.current?.abort(); };
  }, [fetchCandles]);

  // WebSocket live updates via Binance (best-effort — works in browser, may not work server-side)
  useEffect(() => {
    if (!liveEnabled) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
        setWsConnected(false);
      }
      return;
    }

    const binanceSym = CC_SYMBOLS[symbol]?.toLowerCase();
    if (!binanceSym) return;

    const streamName = `${binanceSym}@kline_${timeframe}`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(`wss://stream.binance.com:9443/ws/${streamName}`);
    } catch {
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => setWsConnected(true);
    ws.onclose = () => setWsConnected(false);
    ws.onerror = () => setWsConnected(false);

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string);
        const k = msg.k;
        if (!k) return;
        const candle: Candle = {
          t: k.t as number,
          o: parseFloat(k.o as string),
          h: parseFloat(k.h as string),
          l: parseFloat(k.l as string),
          c: parseFloat(k.c as string),
          v: parseFloat(k.v as string),
        };
        setLatestPrice(candle.c);
        setCandles((prev) => {
          if (prev.length === 0) return prev;
          const last = prev[prev.length - 1];
          if (last.t === candle.t) {
            return [...prev.slice(0, -1), candle];
          } else if (candle.t > last.t) {
            return [...prev.slice(-(limit - 1)), candle];
          }
          return prev;
        });
      } catch {
        // ignore malformed messages
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
      setWsConnected(false);
    };
  }, [liveEnabled, symbol, timeframe, limit]);

  return { candles, latestPrice, loading, error, wsConnected, refetch: fetchCandles };
}
