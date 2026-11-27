import {
  dirOf,
  evaluateExit,
  rankCandidates,
  unrealized,
  type Candidate,
  type MarketInput,
  type Position,
  type RotationParams,
} from "./engine";

export interface Fill {
  price: number;
  fee: number;
}

/** Executor abstraction: PaperBroker simulates, OrderlyBroker trades for real. */
export interface Broker {
  open(symbol: string, side: "LONG" | "SHORT", qty: number, refPrice: number): Promise<Fill>;
  close(symbol: string, side: "LONG" | "SHORT", qty: number, refPrice: number): Promise<Fill>;
  /** Round qty to the exchange step; return 0 when below the minimum. */
  normalizeQty(symbol: string, qty: number, price: number): number;
}

export interface ClosedTrade {
  id: string;
  symbol: string;
  side: "LONG" | "SHORT";
  entry: number;
  exit: number;
  qty: number;
  pnl: number;
  reason: string;
  openedAt: number;
  closedAt: number;
}

export interface TraceEntry {
  t: number;
  kind: "entry" | "exit" | "skip" | "risk" | "info";
  text: string;
}

export interface RotationState {
  version: 1;
  mode: "paper" | "live";
  startEquity: number;
  balance: number; // realized cash (start + realized pnl)
  equity: number; // balance + unrealized
  dayKey: string;
  dayStartEquity: number;
  haltedReason: string | null;
  positions: Position[];
  trades: ClosedTrade[];
  ranked: Candidate[];
  trace: TraceEntry[];
  stats: { wins: number; losses: number; longs: number; shorts: number; passes: number; pnl: number };
  heartbeat: number;
}

export function newState(mode: "paper" | "live", capital: number, now = Date.now()): RotationState {
  return {
    version: 1,
    mode,
    startEquity: capital,
    balance: capital,
    equity: capital,
    dayKey: dayKeyOf(now),
    dayStartEquity: capital,
    haltedReason: null,
    positions: [],
    trades: [],
    ranked: [],
    trace: [],
    stats: { wins: 0, losses: 0, longs: 0, shorts: 0, passes: 0, pnl: 0 },
    heartbeat: now,
  };
}

export const dayKeyOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function pushTrace(s: RotationState, kind: TraceEntry["kind"], text: string, now: number) {
  s.trace.push({ t: now, kind, text });
  if (s.trace.length > 200) s.trace.splice(0, s.trace.length - 200);
}

export class PaperBroker implements Broker {
  constructor(private p: Pick<RotationParams, "feeRate" | "slippage">) {}
  async open(_s: string, side: "LONG" | "SHORT", qty: number, ref: number) {
    const price = ref * (1 + dirOf(side) * this.p.slippage);
    return { price, fee: price * qty * this.p.feeRate };
  }
  async close(_s: string, side: "LONG" | "SHORT", qty: number, ref: number) {
    const price = ref * (1 - dirOf(side) * this.p.slippage);
    return { price, fee: price * qty * this.p.feeRate };
  }
  normalizeQty(_s: string, qty: number) {
    return Math.floor(qty * 1e6) / 1e6;
  }
}

export async function closePosition(
  s: RotationState,
  pos: Position,
  price: number,
  reason: string,
  broker: Broker,
  now: number,
) {
  const fill = await broker.close(pos.symbol, pos.side, pos.qty, price);
  const gross = (fill.price - pos.entry) * pos.qty * dirOf(pos.side);
  const pnl = gross - pos.entryFee - fill.fee;
  s.balance += pnl;
  s.stats.pnl += pnl;
  if (pnl >= 0) s.stats.wins++;
  else s.stats.losses++;
  s.positions = s.positions.filter((p) => p.id !== pos.id);
  s.trades.push({
    id: pos.id, symbol: pos.symbol, side: pos.side, entry: pos.entry, exit: fill.price,
    qty: pos.qty, pnl, reason, openedAt: pos.openedAt, closedAt: now,
  });
  if (s.trades.length > 150) s.trades.splice(0, s.trades.length - 150);
  pushTrace(s, "exit", `${pos.side} ${pos.symbol} closed (${reason}) pnl ${pnl.toFixed(2)}$ — ${pos.margin.toFixed(2)}$ margin freed`, now);
}

/**
 * One decision cycle. `prices` covers every symbol the bot holds; `markets`
 * covers every scannable symbol (with model probability).
 */
export async function tick(
  s: RotationState,
  params: RotationParams,
  prices: Map<string, number>,
  markets: MarketInput[],
  broker: Broker,
  opts: { tradingEnabled: boolean; now?: number },
) {
  const now = opts.now ?? Date.now();
  s.heartbeat = now;

  // 1. exits
  for (const pos of [...s.positions]) {
    const price = prices.get(pos.symbol);
    if (!price) continue;
    const dir = dirOf(pos.side);
    if ((price - pos.peak) * dir > 0) pos.peak = price;
    pos.markPrice = price;
    pos.unrealizedPnl = unrealized(pos, price) - pos.entryFee - price * pos.qty * params.feeRate;
    const reason = evaluateExit(pos, price, now, params);
    if (reason) {
      pos.recommendation = "CLOSE";
      pos.recommendationReason = reason.replace(/_/g, " ");
      await closePosition(s, pos, price, reason, broker, now);
    } else {
      const move = ((price - pos.entry) / pos.entry) * dir;
      const riskUsed = move / Math.max(pos.slDist, 1e-9);
      pos.recommendation = riskUsed <= -0.7 ? "PAUSE" : "HOLD";
      pos.recommendationReason = riskUsed <= -0.7
        ? "Near stop-loss; no new entries recommended"
        : riskUsed >= 1.5
          ? "Profit developing; protect gains"
          : "Exit rules not triggered";
    }
  }

  // 2. equity + daily risk limit
  const upnl = s.positions.reduce((a, p) => a + unrealized(p, prices.get(p.symbol) ?? p.entry), 0);
  s.equity = s.balance + upnl;
  const today = dayKeyOf(now);
  if (today !== s.dayKey) {
    s.dayKey = today;
    s.dayStartEquity = s.equity;
    if (s.haltedReason?.startsWith("daily")) {
      s.haltedReason = null;
      pushTrace(s, "risk", "New UTC day: trading resumed", now);
    }
  }
  if (!s.haltedReason && s.equity <= s.dayStartEquity * (1 - params.dailyLossPct / 100)) {
    s.haltedReason = `daily loss limit ${params.dailyLossPct}% reached`;
    pushTrace(s, "risk", `Halted: ${s.haltedReason}. Closing all positions.`, now);
    for (const pos of [...s.positions]) {
      await closePosition(s, pos, prices.get(pos.symbol) ?? pos.entry, "daily_limit", broker, now);
    }
  }

  // 3. rank + rotate freed capital into the best entries
  const held = new Set(s.positions.map((p) => p.symbol));
  const used = s.positions.reduce((a, p) => a + p.margin, 0);
  const free = s.balance - used;
  const margin = Math.min(free, s.balance / params.maxPositions);
  const ranked = margin > 0
    ? rankCandidates(markets.filter((m) => !held.has(m.symbol)), margin, params)
    : [];
  s.ranked = ranked.slice(0, 10);

  if (!opts.tradingEnabled || s.haltedReason || s.positions.length >= params.maxPositions) return;
  let slots = params.maxPositions - s.positions.length;
  let freeNow = free;
  let opened = 0;
  for (const c of ranked) {
    if (slots <= 0 || freeNow < margin * 0.999) break;
    if (c.score <= params.minScore) break; // sorted: everything after is worse
    const price = markets.find((m) => m.symbol === c.symbol)?.price;
    if (!price) continue;
    const qty = broker.normalizeQty(c.symbol, (margin * params.leverage) / price, price);
    if (qty <= 0) {
      pushTrace(s, "skip", `${c.symbol}: below exchange minimum size`, now);
      continue;
    }
    try {
      const fill = await broker.open(c.symbol, c.side, qty, price);
      const pos: Position = {
        id: `${now}-${c.symbol}`, symbol: c.symbol, side: c.side, entry: fill.price, qty,
        margin, slDist: c.slDist, tpDist: c.tpDist, openedAt: now, entryFee: fill.fee,
        peak: fill.price, score: c.score, live: s.mode === "live",
      };
      s.positions.push(pos);
      if (c.side === "LONG") s.stats.longs++;
      else s.stats.shorts++;
      pushTrace(s, "entry", `${c.side} ${c.symbol} @ ${fill.price.toPrecision(6)} score ${c.score.toFixed(5)} pTP ${(c.pTP * 100).toFixed(1)}% TP ${(c.tpDist * 100).toFixed(2)}% SL ${(c.slDist * 100).toFixed(2)}%`, now);
      slots--; freeNow -= margin; opened++;
    } catch (e) {
      pushTrace(s, "skip", `${c.symbol}: order failed (${(e as Error).message.slice(0, 120)})`, now);
    }
  }
  if (opened === 0 && ranked.length > 0 && ranked[0].score <= params.minScore) {
    s.stats.passes++; // best available entry has negative edge: stay flat
  }
}
