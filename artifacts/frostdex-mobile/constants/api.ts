export const ORDERLY_API_BASE = "https://api-evm.orderly.org";

export interface FuturesMarket {
  symbol: string;
  index_price: number;
  mark_price: number;
  "24h_open": number;
  "24h_close": number;
  "24h_high": number;
  "24h_low": number;
  "24h_volume": number;
  "24h_amount": number;
  open_interest: number;
  est_funding_rate: number;
  last_funding_rate: number;
  next_funding_time: number;
}

export interface OrderbookLevel {
  price: number;
  quantity: number;
}

export interface Orderbook {
  asks: OrderbookLevel[];
  bids: OrderbookLevel[];
  timestamp: number;
}

export async function fetchMarkets(): Promise<FuturesMarket[]> {
  const res = await fetch(`${ORDERLY_API_BASE}/v1/public/futures`);
  const json = await res.json();
  return json?.data?.rows ?? [];
}

export async function fetchTicker(symbol: string): Promise<FuturesMarket | null> {
  const res = await fetch(`${ORDERLY_API_BASE}/v1/public/futures/${symbol}`);
  const json = await res.json();
  return json?.data ?? null;
}

export async function fetchOrderbook(symbol: string, maxLevel = 15): Promise<Orderbook | null> {
  const res = await fetch(`${ORDERLY_API_BASE}/v1/orderbook/${symbol}?max_level=${maxLevel}`);
  const json = await res.json();
  if (!json?.data) return null;
  const asks: OrderbookLevel[] = (json.data.asks ?? []).map(([price, quantity]: [number, number]) => ({ price, quantity }));
  const bids: OrderbookLevel[] = (json.data.bids ?? []).map(([price, quantity]: [number, number]) => ({ price, quantity }));
  return { asks, bids, timestamp: json.data.timestamp ?? Date.now() };
}

export function formatSymbolDisplay(symbol: string): string {
  return symbol.replace("PERP_", "").replace("_USDC", "").replace(/_/g, "/");
}

export function formatPrice(price: number): string {
  if (!price) return "0.00";
  if (price >= 1000) return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(4);
  return price.toFixed(6);
}

export function formatVolume(volume: number): string {
  if (!volume) return "$0";
  if (volume >= 1_000_000_000) return `$${(volume / 1_000_000_000).toFixed(2)}B`;
  if (volume >= 1_000_000) return `$${(volume / 1_000_000).toFixed(2)}M`;
  if (volume >= 1_000) return `$${(volume / 1_000).toFixed(2)}K`;
  return `$${volume.toFixed(2)}`;
}

export function getPriceChange(market: FuturesMarket): number {
  const open = market["24h_open"];
  const close = market["24h_close"] ?? market.index_price;
  if (!open || open === 0) return 0;
  return ((close - open) / open) * 100;
}
