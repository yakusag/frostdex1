// Frostdex Capital Rotation — pure strategy engine (no I/O, no dependencies).
// Used by the 24/7 worker. All maths is deterministic and unit-testable.

export interface Candle {
  t: number; // ms
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface RotationParams {
  leverage: number;
  maxPositions: number;
  tpR: number; // take-profit as multiple of stop distance
  slPct: number; // minimum stop distance, % of price
  timeStopMin: number;
  dailyLossPct: number;
  feeRate: number; // per side, fraction (0.0005 = 5 bps)
  slippage: number; // per side, fraction
  minScore: number; // $ per $ per minute
  trees: number;
  eta: number;
}

export const DEFAULT_PARAMS: RotationParams = {
  leverage: 5,
  maxPositions: 3,
  tpR: 2,
  slPct: 0.4,
  timeStopMin: 20,
  dailyLossPct: 5,
  feeRate: 0.0005,
  slippage: 0.0002,
  minScore: 0,
  trees: 132,
  eta: 0.1,
};

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

export function normalizeParams(
  raw: Record<string, string | number> = {},
): RotationParams {
  const n = (key: keyof RotationParams, lo: number, hi: number) => {
    const value = Number(raw[key]);
    return Number.isFinite(value) && raw[key] !== undefined && raw[key] !== ""
      ? clamp(value, lo, hi)
      : DEFAULT_PARAMS[key];
  };
  return {
    leverage: Math.round(n("leverage", 1, 10)),
    maxPositions: Math.round(n("maxPositions", 1, 8)),
    tpR: n("tpR", 0.5, 5),
    slPct: n("slPct", 0.1, 5),
    timeStopMin: Math.round(n("timeStopMin", 3, 240)),
    dailyLossPct: n("dailyLossPct", 0.5, 50),
    feeRate: n("feeRate", 0, 0.005),
    slippage: n("slippage", 0, 0.005),
    minScore: n("minScore", -1, 1),
    trees: Math.round(n("trees", 10, 300)),
    eta: n("eta", 0.01, 0.5),
  };
}

// ---------------------------------------------------------------- features

export const FEATURE_NAMES = ["distZ", "vol", "mom5", "rsi"] as const;
export const HORIZON_CANDLES = 10;

function std(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(
    values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1),
  );
}

/** 1-minute log-return volatility over the last `n` candles ending at index i. */
export function sigma1m(candles: Candle[], i = candles.length - 1, n = 30) {
  const rets: number[] = [];
  for (let k = Math.max(1, i - n + 1); k <= i; k++) {
    rets.push(Math.log(candles[k].c / candles[k - 1].c));
  }
  return std(rets);
}

/** Feature vector at candle index i, using only data up to and including i. */
export function featuresAt(candles: Candle[], i: number): number[] | null {
  if (i < 30) return null;
  const sigma = sigma1m(candles, i, 30);
  if (!(sigma > 0)) return null;

  let ema = candles[i - 29].c;
  const alpha = 2 / 21;
  for (let k = i - 28; k <= i; k++) ema = alpha * candles[k].c + (1 - alpha) * ema;
  const distZ = Math.log(candles[i].c / ema) / sigma;
  const mom5 = Math.log(candles[i].c / candles[i - 5].c) / (sigma * Math.sqrt(5));

  let gain = 0;
  let loss = 0;
  for (let k = i - 13; k <= i; k++) {
    const d = candles[k].c - candles[k - 1].c;
    if (d >= 0) gain += d;
    else loss -= d;
  }
  const rsi = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);

  return [distZ, sigma * 1000, mom5, rsi];
}

// ------------------------------------------------- boosted decision stumps

interface Stump {
  f: number; // feature index
  thr: number;
  left: number;
  right: number;
}

export interface Ensemble {
  f0: number;
  eta: number;
  stumps: Stump[];
  valAccuracy: number; // out-of-sample directional accuracy (walk-forward)
  samples: number;
  trainedAt: number;
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const logit = (p: number) => Math.log(p / (1 - p));

function fitStumps(
  X: number[][],
  y: number[],
  trees: number,
  eta: number,
): { f0: number; stumps: Stump[] } {
  const n = X.length;
  const pBar = clamp(y.reduce((a, b) => a + b, 0) / n, 0.05, 0.95);
  const f0 = logit(pBar);
  const nFeat = X[0].length;
  const BINS = 16;
  const LAMBDA = 5;
  const MIN_LEAF = 20;

  // quantile thresholds per feature
  const thresholds: number[][] = [];
  for (let f = 0; f < nFeat; f++) {
    const sorted = X.map((row) => row[f]).sort((a, b) => a - b);
    const t: number[] = [];
    for (let b = 1; b < BINS; b++) t.push(sorted[Math.floor((b / BINS) * n)]);
    thresholds.push([...new Set(t)]);
  }

  const F = new Array(n).fill(f0);
  const stumps: Stump[] = [];
  for (let m = 0; m < trees; m++) {
    const r = new Array(n);
    const h = new Array(n);
    for (let k = 0; k < n; k++) {
      const p = sigmoid(F[k]);
      r[k] = y[k] - p;
      h[k] = Math.max(p * (1 - p), 1e-6);
    }
    let best: (Stump & { gain: number }) | null = null;
    for (let f = 0; f < nFeat; f++) {
      for (const thr of thresholds[f]) {
        let gl = 0, hl = 0, nl = 0, gr = 0, hr = 0;
        for (let k = 0; k < n; k++) {
          if (X[k][f] <= thr) {
            gl += r[k]; hl += h[k]; nl++;
          } else {
            gr += r[k]; hr += h[k];
          }
        }
        const nr = n - nl;
        if (nl < MIN_LEAF || nr < MIN_LEAF) continue;
        const gain = gl ** 2 / (hl + LAMBDA) + gr ** 2 / (hr + LAMBDA);
        if (!best || gain > best.gain) {
          best = { f, thr, left: gl / (hl + LAMBDA), right: gr / (hr + LAMBDA), gain };
        }
      }
    }
    if (!best) break;
    stumps.push({ f: best.f, thr: best.thr, left: best.left, right: best.right });
    for (let k = 0; k < n; k++) {
      F[k] += eta * (X[k][best.f] <= best.thr ? best.left : best.right);
    }
  }
  return { f0, stumps };
}

function rawLogit(model: { f0: number; eta: number; stumps: Stump[] }, x: number[]) {
  let F = model.f0;
  for (const s of model.stumps) F += model.eta * (x[s.f] <= s.thr ? s.left : s.right);
  return F;
}

/** Train on candles, validate walk-forward on the most recent 25%. */
export function trainEnsemble(
  candles: Candle[],
  trees: number,
  eta: number,
  now = Date.now(),
): Ensemble | null {
  const X: number[][] = [];
  const y: number[] = [];
  for (let i = 30; i + HORIZON_CANDLES < candles.length; i++) {
    const x = featuresAt(candles, i);
    if (!x) continue;
    X.push(x);
    y.push(candles[i + HORIZON_CANDLES].c > candles[i].c ? 1 : 0);
  }
  if (X.length < 200) return null;

  const split = Math.floor(X.length * 0.75);
  // purge HORIZON_CANDLES between train and validation to avoid label leakage
  const trainEnd = Math.max(50, split - HORIZON_CANDLES);
  const val = fitStumps(X.slice(0, trainEnd), y.slice(0, trainEnd), trees, eta);
  let correct = 0;
  for (let k = split; k < X.length; k++) {
    const pred = sigmoid(rawLogit({ ...val, eta }, X[k])) > 0.5 ? 1 : 0;
    if (pred === y[k]) correct++;
  }
  const valAccuracy = correct / (X.length - split);

  const full = fitStumps(X, y, trees, eta);
  return { ...full, eta, valAccuracy, samples: X.length, trainedAt: now };
}

/**
 * P(up) for the next horizon. The raw model output is shrunk toward 0.5 by the
 * out-of-sample reliability: accuracy <= 50% => weight 0 => p = 0.5 (no trade).
 */
export function predictPUp(model: Ensemble, x: number[]): number {
  const weight = clamp((model.valAccuracy - 0.5) / 0.05, 0, 1);
  return sigmoid(weight * rawLogit(model, x));
}

// ----------------------------------------------------------------- Kalman

export class Kalman1D {
  x: number | undefined;
  P = 1;
  constructor(
    private q = 0.02,
    private r = 0.15,
  ) {}
  update(z: number): number {
    if (this.x === undefined) {
      this.x = z;
      this.P = this.r;
      return z;
    }
    this.P += this.q;
    const K = this.P / (this.P + this.r);
    this.x += K * (z - this.x);
    this.P *= 1 - K;
    return this.x;
  }
}

export const smoothedP = (k: Kalman1D, pUp: number) =>
  sigmoid(k.update(logit(clamp(pUp, 0.001, 0.999))));

// ----------------------------------------------------------- ranking

export interface MarketInput {
  symbol: string;
  price: number;
  pUp: number; // Kalman-smoothed
  sigma: number; // 1m log-return vol
}

export interface Candidate {
  symbol: string;
  side: "LONG" | "SHORT";
  pSide: number;
  pTP: number;
  slDist: number; // fraction of price
  tpDist: number;
  tauMin: number;
  margin: number;
  expectedNet: number; // $
  score: number; // $ per $ of margin per minute
}

/**
 * Capital-rotation score: (pTP*TP$ - (1-pTP)*SL$ - fees$) / (margin * tau).
 * pTP is the barrier-hit probability: for a driftless walk P(hit +a before -b)
 * = b/(a+b); the model's odds for the chosen side tilt it multiplicatively.
 */
export function scoreCandidate(
  m: MarketInput,
  margin: number,
  params: RotationParams,
): Candidate {
  const side: "LONG" | "SHORT" = m.pUp >= 0.5 ? "LONG" : "SHORT";
  const pSide = side === "LONG" ? m.pUp : 1 - m.pUp;
  const slDist = Math.max(params.slPct / 100, m.sigma * Math.sqrt(5));
  const tpDist = slDist * params.tpR;
  const base = slDist / (slDist + tpDist);
  const odds = (base / (1 - base)) * (pSide / (1 - pSide));
  const pTP = odds / (1 + odds);
  const notional = margin * params.leverage;
  const fees = notional * 2 * (params.feeRate + params.slippage);
  const expectedNet = pTP * notional * tpDist - (1 - pTP) * notional * slDist - fees;
  const tauMin = clamp((slDist / Math.max(m.sigma, 1e-9)) ** 2, 2, params.timeStopMin);
  return {
    symbol: m.symbol,
    side,
    pSide,
    pTP,
    slDist,
    tpDist,
    tauMin,
    margin,
    expectedNet,
    score: expectedNet / (margin * tauMin),
  };
}

export function rankCandidates(
  markets: MarketInput[],
  margin: number,
  params: RotationParams,
): Candidate[] {
  return markets
    .map((m) => scoreCandidate(m, margin, params))
    .sort((a, b) => b.score - a.score);
}

// ----------------------------------------------------------- exits

export interface Position {
  id: string;
  symbol: string;
  side: "LONG" | "SHORT";
  entry: number;
  qty: number;
  margin: number;
  slDist: number;
  tpDist: number;
  openedAt: number;
  entryFee: number;
  peak: number; // best favorable price seen
  score: number;
  live: boolean;
}

export const dirOf = (side: "LONG" | "SHORT") => (side === "LONG" ? 1 : -1);

export function unrealized(pos: Position, price: number) {
  return (price - pos.entry) * pos.qty * dirOf(pos.side);
}

export function evaluateExit(
  pos: Position,
  price: number,
  now: number,
  params: RotationParams,
): string | null {
  const dir = dirOf(pos.side);
  const move = ((price - pos.entry) / pos.entry) * dir; // favorable fraction
  const peakMove = ((pos.peak - pos.entry) / pos.entry) * dir;
  if (move >= pos.tpDist) return "take_profit";
  if (move <= -pos.slDist) return "stop_loss";
  // trailing stop once +1R was reached: give back at most 0.7R from the peak
  if (peakMove >= pos.slDist && peakMove - move >= pos.slDist * 0.7) {
    return "trailing_stop";
  }
  if (now - pos.openedAt >= params.timeStopMin * 60_000) return "time_stop";
  return null;
}
