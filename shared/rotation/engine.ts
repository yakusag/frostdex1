import { correlatedBocpdProbability } from "./correlated-bocpd.js";

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
  conformalQ?: number;
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
  horizonCandles = HORIZON_CANDLES,
): Ensemble | null {
  const X: number[][] = [];
  const y: number[] = [];
  for (let i = 30; i + horizonCandles < candles.length; i++) {
    const x = featuresAt(candles, i);
    if (!x) continue;
    X.push(x);
    y.push(candles[i + horizonCandles].c > candles[i].c ? 1 : 0);
  }
  if (X.length < 200) return null;

  const split = Math.floor(X.length * 0.75);
  // Purge this model's own target horizon between train and validation.
  const trainEnd = Math.max(50, split - horizonCandles);
  const val = fitStumps(X.slice(0, trainEnd), y.slice(0, trainEnd), trees, eta);
  let correct = 0;
  for (let k = split; k < X.length; k++) {
    const pred = sigmoid(rawLogit({ ...val, eta }, X[k])) > 0.5 ? 1 : 0;
    if (pred === y[k]) correct++;
  }
  const valAccuracy = correct / (X.length - split);
  // Split-conformal calibration on the untouched walk-forward validation tail.
  // Nonconformity is 1 - probability assigned to the realised class.
  const reliability = clamp((valAccuracy - 0.5) / 0.05, 0, 1);
  const nonconformity: number[] = [];
  for (let k = split; k < X.length; k++) {
    const p = sigmoid(reliability * rawLogit({ ...val, eta }, X[k]));
    nonconformity.push(1 - (y[k] === 1 ? p : 1 - p));
  }
  nonconformity.sort((a, b) => a - b);
  const qIndex = Math.min(nonconformity.length - 1, Math.ceil(0.90 * (nonconformity.length + 1)) - 1);
  const conformalQ = nonconformity.length ? nonconformity[Math.max(0, qIndex)] : 1;

  // Keep the exact model that generated the untouched calibration scores.
  // Refitting on the calibration tail would invalidate the split calibration.
  // The holdout is chronological; due to serial dependence this is an empirical
  // abstention heuristic, not a distribution-free coverage guarantee.
  return { ...val, eta, valAccuracy, samples: trainEnd, trainedAt: now, conformalQ };
}

/**
 * P(up) for the next horizon. The raw model output is shrunk toward 0.5 by the
 * out-of-sample reliability: accuracy <= 50% => weight 0 => p = 0.5 (no trade).
 */
export function predictPUp(model: Ensemble, x: number[]): number {
  const weight = clamp((model.valAccuracy - 0.5) / 0.05, 0, 1);
  return sigmoid(weight * rawLogit(model, x));
}

/** Chronological holdout-calibrated class set; temporal coverage is approximate. */
export function conformalDecision(model: Ensemble, pUp: number) {
  const q = clamp(model.conformalQ ?? 1, 0, 1);
  const includeUp = 1 - pUp <= q;
  const includeDown = pUp <= q;
  return {
    includeUp,
    includeDown,
    eligible: includeUp !== includeDown,
    lower: Math.max(0, pUp - q),
    upper: Math.min(1, pUp + q),
    setSize: Number(includeUp) + Number(includeDown),
  };
}

/**
 * Online ACI-style calibration for sequential binary forecasts.
 * The rolling score window and feedback update adapt the singleton-set
 * threshold to recent forecast errors. It is empirical for market data:
 * temporal dependence and predictor drift mean this is not a coverage guarantee.
 */
export interface AdaptiveConformalState {
  alpha: number;
  scores: number[];
  observations: number;
  misses: number;
}

export const newAdaptiveConformalState = (): AdaptiveConformalState => ({
  alpha: 0.1,
  scores: [],
  observations: 0,
  misses: 0,
});

const ACI_TARGET_ALPHA = 0.1;
const ACI_LEARNING_RATE = 0.02;
const ACI_MIN_SAMPLES = 40;
const ACI_WINDOW = 300;

export function adaptiveConformalThreshold(
  state: AdaptiveConformalState,
  fallbackQ = 1,
): number {
  const scores = state.scores.filter((v) => Number.isFinite(v)).slice(-ACI_WINDOW);
  if (scores.length < ACI_MIN_SAMPLES) return clamp(fallbackQ, 0, 1);
  const sorted = [...scores].sort((a, b) => a - b);
  const alpha = clamp(state.alpha, 0.01, 0.5);
  const index = clamp(Math.ceil((sorted.length + 1) * (1 - alpha)) - 1, 0, sorted.length - 1);
  return sorted[index];
}

/** Update only after the forecast's full HORIZON_CANDLES outcome is observable. */
export function observeAdaptiveConformal(
  state: AdaptiveConformalState,
  nonconformity: number,
  thresholdAtForecast: number,
): boolean {
  const score = clamp(nonconformity, 0, 1);
  const missed = score > clamp(thresholdAtForecast, 0, 1);
  state.scores.push(score);
  if (state.scores.length > ACI_WINDOW) state.scores.splice(0, state.scores.length - ACI_WINDOW);
  state.alpha = clamp(
    state.alpha + ACI_LEARNING_RATE * (ACI_TARGET_ALPHA - Number(missed)),
    0.01,
    0.5,
  );
  state.observations = Math.max(0, state.observations || 0) + 1;
  state.misses = Math.max(0, state.misses || 0) + Number(missed);
  return missed;
}

export function adaptiveConformalDecision(
  state: AdaptiveConformalState,
  pUp: number,
  fallbackQ = 1,
) {
  const q = adaptiveConformalThreshold(state, fallbackQ);
  const includeUp = 1 - pUp <= q;
  const includeDown = pUp <= q;
  return {
    includeUp,
    includeDown,
    eligible: includeUp !== includeDown,
    lower: Math.max(0, pUp - q),
    upper: Math.min(1, pUp + q),
    setSize: Number(includeUp) + Number(includeDown),
    threshold: q,
    alpha: clamp(state.alpha, 0.01, 0.5),
    calibrationSamples: state.scores.length,
    calibrated: state.scores.length >= ACI_MIN_SAMPLES,
  };
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

// ------------------------------------------------------ market regime + MTF

export type MarketRegime = "TRENDING" | "RANGING" | "HIGH_VOL" | "TRANSITION";

export interface MarketAnalysis {
  regime: MarketRegime;
  efficiencyRatio: number;
  volatilityRatio: number;
  atrPct: number;
  mtfBias: number;
  mtfAgreement: number;
  forecastSigma: number;
  cusumSignal: -1 | 0 | 1;
  regimeConfidence: number;
  regimeProbabilities: Record<MarketRegime, number>;
  expectedRegimeMinutes?: number;
  changePointProbability?: number;
}

/** Gaussian HMM forward filter over the recent efficiency/volatility sequence. */
function hmmRegimeFilter(candles: Candle[], end: number) {
  const states: MarketRegime[] = ["TRENDING", "RANGING", "HIGH_VOL", "TRANSITION"];
  const means = [[0.85, 0], [0.10, -0.1], [0.25, 0.8], [0.40, 0.15]];
  const transition = [
    [0.88, 0.03, 0.03, 0.06], [0.04, 0.86, 0.03, 0.07],
    [0.04, 0.04, 0.86, 0.06], [0.12, 0.12, 0.08, 0.68],
  ];
  let alpha = [0.25, 0.25, 0.25, 0.25];
  for (let t = Math.max(120, end - 59); t <= end; t++) {
    let path = 0;
    for (let k = t - 19; k <= t; k++) path += Math.abs(candles[k].c - candles[k - 1].c);
    const efficiency = path > 0 ? clamp(Math.abs(candles[t].c - candles[t - 20].c) / path, 0, 1) : 0;
    const longVol = sigma1m(candles, t, 120);
    const shortVol = sigma1m(candles, t, 30);
    const obs = [efficiency, Math.log(clamp(longVol > 0 ? shortVol / longVol : 1, 0.1, 10))];
    const emission = means.map(([e, v]) => Math.exp(-0.5 * (((obs[0] - e) / 0.22) ** 2 + ((obs[1] - v) / 0.55) ** 2)));
    const predicted = states.map((_, j) => alpha.reduce((sum, p, i) => sum + p * transition[i][j], 0));
    const weighted = predicted.map((p, i) => p * emission[i]);
    const total = weighted.reduce((sum, value) => sum + value, 0) || 1;
    alpha = weighted.map((value) => value / total);
  }
  const probabilities = Object.fromEntries(states.map((state, i) => [state, alpha[i]])) as Record<MarketRegime, number>;
  const regime = states.reduce((best, state) => probabilities[state] > probabilities[best] ? state : best, states[0]);
  return { regime, probabilities, confidence: probabilities[regime] };
}

/**
 * Explicit-duration semi-Markov filter. State dwell hazards vary with age,
 * preventing the memoryless switching assumption of a plain HMM.
 */
function hsmmRegimeFilter(candles: Candle[], end: number) {
  const states: MarketRegime[] = ["TRENDING", "RANGING", "HIGH_VOL", "TRANSITION"];
  const means = [[0.85, 0], [0.10, -0.1], [0.25, 0.8], [0.40, 0.15]];
  const transition = [
    [0, 0.42, 0.18, 0.40], [0.38, 0, 0.22, 0.40],
    [0.28, 0.32, 0, 0.40], [0.38, 0.38, 0.24, 0],
  ];
  const meanDuration = [18, 24, 10, 6];
  const maxAge = 30;
  let mass = states.map(() => Array(maxAge + 1).fill(0));
  for (let state = 0; state < states.length; state++) mass[state][1] = 0.25;

  for (let t = Math.max(120, end - 59); t <= end; t++) {
    let path = 0;
    for (let k = t - 19; k <= t; k++) path += Math.abs(candles[k].c - candles[k - 1].c);
    const efficiency = path > 0 ? clamp(Math.abs(candles[t].c - candles[t - 20].c) / path, 0, 1) : 0;
    const longVol = sigma1m(candles, t, 120);
    const shortVol = sigma1m(candles, t, 30);
    const obs = [efficiency, Math.log(clamp(longVol > 0 ? shortVol / longVol : 1, 0.1, 10))];
    const emission = means.map(([e, v]) =>
      Math.exp(-0.5 * (((obs[0] - e) / 0.22) ** 2 + ((obs[1] - v) / 0.55) ** 2)));
    const next = states.map(() => Array(maxAge + 1).fill(0));
    for (let state = 0; state < states.length; state++) {
      for (let age = 1; age <= maxAge; age++) {
        const p = mass[state][age];
        if (p <= 0) continue;
        const durationHazard = age >= maxAge ? 1 :
          clamp(Math.pow(age / meanDuration[state], 1.5) / meanDuration[state], 0.004, 0.45);
        next[state][Math.min(maxAge, age + 1)] += p * (1 - durationHazard);
        for (let target = 0; target < states.length; target++) {
          if (target !== state) next[target][1] += p * durationHazard * transition[state][target];
        }
      }
    }
    let total = 0;
    for (let state = 0; state < states.length; state++) {
      for (let age = 1; age <= maxAge; age++) {
        next[state][age] *= emission[state];
        total += next[state][age];
      }
    }
    const norm = total || 1;
    mass = next.map(row => row.map(v => v / norm));
  }
  const probabilities = Object.fromEntries(states.map((state, i) => [
    state, mass[i].reduce((sum, p) => sum + p, 0),
  ])) as Record<MarketRegime, number>;
  const regime = states.reduce((best, state) =>
    probabilities[state] > probabilities[best] ? state : best, states[0]);
  const expectedAge = states.map((_, i) =>
    mass[i].reduce((sum, p, age) => sum + p * age, 0) / Math.max(probabilities[states[i]], 1e-9));
  const expectedRegimeMinutes = Math.max(0, meanDuration[states.indexOf(regime)] - expectedAge[states.indexOf(regime)]);
  return { regime, probabilities, confidence: probabilities[regime], expectedRegimeMinutes };
}

/** Markovian/heteroskedastic BOCPD on AR(1)-filtered returns. */
function bayesianChangePointProbability(candles: Candle[], i: number, sigma: number) {
  const returns: number[] = [];
  for (let k = Math.max(1, i - 119); k <= i; k++) {
    returns.push(Math.log(candles[k].c / candles[k - 1].c));
  }
  return correlatedBocpdProbability(returns, sigma);
}

/** GARCH(1,1) variance forecast with conservative fixed coefficients. */
function garchSigmaForecast(candles: Candle[], i: number): number {
  const returns: number[] = [];
  for (let k = Math.max(1, i - 119); k <= i; k++) returns.push(Math.log(candles[k].c / candles[k - 1].c));
  const variance = Math.max(std(returns) ** 2, 1e-12);
  const alpha = 0.08, beta = 0.90;
  const omega = variance * (1 - alpha - beta);
  let h = variance;
  for (const r of returns) h = omega + alpha * r * r + beta * h;
  return Math.sqrt(clamp(h, variance * 0.25, variance * 4));
}

/** Two-sided standardized CUSUM change detector on recent candle returns. */
function detectCusum(candles: Candle[], i: number, sigma: number): -1 | 0 | 1 {
  let positive = 0, negative = 0;
  for (let k = Math.max(1, i - 29); k <= i; k++) {
    const z = Math.log(candles[k].c / candles[k - 1].c) / Math.max(sigma, 1e-9);
    positive = Math.max(0, positive + z - 0.25);
    negative = Math.max(0, negative - z - 0.25);
  }
  return positive > 4.5 && positive > negative ? 1 : negative > 4.5 ? -1 : 0;
}

/**
 * Candle-only market diagnostics. Higher-timeframe returns are reconstructed
 * from the 1m series; no synthetic order-book/funding data is assumed.
 */
export function analyzeMarket(candles: Candle[]): MarketAnalysis | null {
  const i = candles.length - 1;
  if (i < 120) return null;
  const close = candles[i].c;
  if (!(close > 0)) return null;

  let path = 0;
  for (let k = i - 19; k <= i; k++) path += Math.abs(candles[k].c - candles[k - 1].c);
  const efficiencyRatio = path > 0
    ? clamp(Math.abs(close - candles[i - 20].c) / path, 0, 1)
    : 0;

  const shortVol = sigma1m(candles, i, 30);
  const longVol = sigma1m(candles, i, 120);
  const volatilityRatio = longVol > 0 ? shortVol / longVol : 1;

  let tr = 0;
  for (let k = i - 13; k <= i; k++) {
    const prev = candles[k - 1].c;
    tr += Math.max(candles[k].h - candles[k].l,
      Math.abs(candles[k].h - prev), Math.abs(candles[k].l - prev));
  }
  const atrPct = tr / 14 / close;

  const horizons = [5, 15, 60] as const;
  const weights = [0.5, 0.3, 0.2] as const;
  const signals = horizons.map((n) => {
    const z = Math.log(close / candles[i - n].c) /
      Math.max(longVol * Math.sqrt(n), 1e-9);
    return Math.tanh(z / 2);
  });
  const mtfBias = clamp(signals.reduce((sum, v, k) => sum + v * weights[k], 0), -1, 1);
  const sign = Math.sign(mtfBias);
  const mtfAgreement = sign === 0 ? 0 :
    signals.filter((v) => Math.sign(v) === sign).length / signals.length;

  const hsmm = hsmmRegimeFilter(candles, i);
  const forecastSigma = garchSigmaForecast(candles, i);
  const cusumSignal = detectCusum(candles, i, Math.max(shortVol, forecastSigma));
  const changePointProbability = bayesianChangePointProbability(candles, i, Math.max(shortVol, forecastSigma));

  // A fast/slow volatility expansion is a direct observable risk override:
  // do not let semi-Markov dwell inertia mislabel a fresh volatility shock.
  const highVolOverride = volatilityRatio >= 1.8;
  const regime = highVolOverride
    ? "HIGH_VOL"
    : hsmm.confidence >= 0.42 ? hsmm.regime : "TRANSITION";
  const regimeProbabilities = { ...hsmm.probabilities };
  const regimeConfidence = highVolOverride
    ? Math.max(hsmm.probabilities.HIGH_VOL, clamp((volatilityRatio - 1.4) / 1.2, 0.42, 0.9))
    : hsmm.confidence;
  if (highVolOverride && regimeProbabilities.HIGH_VOL < regimeConfidence) {
    const otherTotal = Math.max(1e-9, 1 - regimeProbabilities.HIGH_VOL);
    for (const state of ["TRENDING", "RANGING", "TRANSITION"] as const) {
      regimeProbabilities[state] *= (1 - regimeConfidence) / otherTotal;
    }
    regimeProbabilities.HIGH_VOL = regimeConfidence;
  }
  return {
    regime, efficiencyRatio, volatilityRatio, atrPct, mtfBias, mtfAgreement,
    forecastSigma, cusumSignal, regimeConfidence,
    regimeProbabilities,
    expectedRegimeMinutes: hsmm.expectedRegimeMinutes,
    changePointProbability,
  };
}

/** Modest log-odds fusion: MTF confirmation can adjust, never replace, the trained model. */
export function fuseMultiTimeframe(pUp: number, analysis: MarketAnalysis): number {
  const p = clamp(pUp, 0.001, 0.999);
  const weight = analysis.regime === "HIGH_VOL" ? 0.12 : 0.24;
  return sigmoid(logit(p) + weight * analysis.mtfBias * analysis.mtfAgreement);
}

// ----------------------------------------------------------- ranking

export interface MarketInput {
  symbol: string;
  price: number;
  pUp: number; // Kalman-smoothed
  sigma: number; // 1m log-return vol
  analysis?: MarketAnalysis;
  distZ?: number;
  conformalEligible?: boolean;
  conformalSetSize?: number;
  conformalIncludeUp?: boolean;
  conformalIncludeDown?: boolean;
  conformalThreshold?: number;
  conformalAlpha?: number;
  conformalCalibrationSamples?: number;
  conformalCalibrated?: boolean;
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
  regime: MarketRegime;
  mtfAgreement: number;
  volatilityRatio: number;
  regimeConfidence: number;
  cusumSignal: -1 | 0 | 1;
  forecastSigma: number;
  strategy: "TREND_FOLLOWING" | "MEAN_REVERSION" | "MOMENTUM";
  conformalEligible?: boolean;
  conformalThreshold?: number;
  conformalAlpha?: number;
  conformalCalibrationSamples?: number;
  conformalCalibrated?: boolean;
  changePointProbability?: number;
  expectedRegimeMinutes?: number;
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
  const a = m.analysis;
  const trendAligned = Boolean(a && a.efficiencyRatio >= 0.34 && a.mtfAgreement >= 2 / 3);
  const meanReversionSetup = Boolean(a && a.regime === "RANGING" && Math.abs(m.distZ ?? 0) >= 1.5);
  const strategy: Candidate["strategy"] = meanReversionSetup
    ? "MEAN_REVERSION"
    : trendAligned ? "TREND_FOLLOWING" : "MOMENTUM";
  // Strategy competition selects the context; the trained probability remains
  // the primary directional input and is only blended modestly for reversion.
  let side: "LONG" | "SHORT" = m.pUp >= 0.5 ? "LONG" : "SHORT";
  if (strategy === "MEAN_REVERSION" && Math.abs(m.distZ ?? 0) >= 1.5) {
    side = (m.distZ ?? 0) > 0 ? "SHORT" : "LONG";
  }
  let pSide = side === "LONG" ? m.pUp : 1 - m.pUp;