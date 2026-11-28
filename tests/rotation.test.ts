import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_PARAMS, Kalman1D, analyzeMarket, featuresAt, fuseMultiTimeframe,
  normalizeParams, predictPUp, rankCandidates, scoreCandidate, sigma1m,
  smoothedP, trainEnsemble, type Candle,
} from "../shared/rotation/engine";
import { PaperBroker, newState, tick } from "../shared/rotation/runner";

function lcg(seed: number) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}
function walk(n: number, drift: number, vol: number, seed = 1): Candle[] {
  const rnd = lcg(seed);
  let p = 100;
  const out: Candle[] = [];
  for (let i = 0; i < n; i++) {
    const z = (rnd() + rnd() + rnd() + rnd() - 2) * 1.7;
    const o = p;
    p = p * Math.exp(drift + vol * z);
    out.push({ t: i * 60000, o, h: Math.max(o, p), l: Math.min(o, p), c: p, v: 1 });
  }
  return out;
}

test("pure random walk: model has no reliable edge => p collapses to 0.5", () => {
  const c = walk(1500, 0, 0.001, 7);
  const m = trainEnsemble(c, 132, 0.1)!;
  assert.ok(m.stumps.length > 0 && m.stumps.length <= 132);
  const x = featuresAt(c, c.length - 1)!;
  const p = predictPUp(m, x);
  assert.ok(p > 0 && p < 1);
  if (m.valAccuracy <= 0.5) assert.equal(p, 0.5);
});

test("persistent momentum regime is learnable out-of-sample", () => {
  // AR(1) returns: strong positive autocorrelation
  const rnd = lcg(3);
  let p = 100, r = 0;
  const c: Candle[] = [];
  for (let i = 0; i < 3000; i++) {
    r = 0.85 * r + 0.0006 * (rnd() + rnd() + rnd() + rnd() - 2);
    const o = p; p *= Math.exp(r);
    c.push({ t: i * 60000, o, h: Math.max(o, p), l: Math.min(o, p), c: p, v: 1 });
  }
  const m = trainEnsemble(c, 132, 0.1)!;
  assert.ok(m.valAccuracy > 0.55, `valAccuracy ${m.valAccuracy}`);
});

test("kalman smooths a single noisy flip", () => {
  const k = new Kalman1D();
  for (let i = 0; i < 20; i++) smoothedP(k, 0.62);
  const after = smoothedP(k, 0.40);
  assert.ok(after > 0.5, `one bad candle must not flip the signal (${after})`);
});

test("no edge => negative score => skipped; strong edge => positive", () => {
  const params = DEFAULT_PARAMS;
  const flat = scoreCandidate({ symbol: "A", price: 10, pUp: 0.5, sigma: 0.001 }, 100, params);
  assert.ok(flat.score < 0);
  const strong = scoreCandidate({ symbol: "A", price: 10, pUp: 0.85, sigma: 0.001 }, 100, params);
  assert.ok(strong.score > 0 && strong.side === "LONG");
  const short = scoreCandidate({ symbol: "A", price: 10, pUp: 0.15, sigma: 0.001 }, 100, params);
  assert.equal(short.side, "SHORT");
});

test("capital rotation: fast small win outranks slow big win", () => {
  const params = normalizeParams({ slPct: 0.1 });
  const fast = scoreCandidate({ symbol: "FAST", price: 1, pUp: 0.8, sigma: 0.002 }, 100, params);
  const slow = scoreCandidate({ symbol: "SLOW", price: 1, pUp: 0.8, sigma: 0.0004 }, 100, params);
  assert.ok(fast.tauMin < slow.tauMin);
  assert.equal(rankCandidates([
    { symbol: "SLOW", price: 1, pUp: 0.8, sigma: 0.0004 },
    { symbol: "FAST", price: 1, pUp: 0.8, sigma: 0.002 },
  ], 100, params)[0].symbol, "FAST");
});

test("tick: opens best entry, exits on take-profit, frees capital", async () => {
  const params = normalizeParams({ maxPositions: 1, leverage: 5 });
  const s = newState("paper", 1000, 0);
  const broker = new PaperBroker(params);
  const mk = (price: number) => [{ symbol: "X", price, pUp: 0.9, sigma: 0.001 }];
  await tick(s, params, new Map([["X", 100]]), mk(100), broker, { tradingEnabled: true, now: 60_000 });
  assert.equal(s.positions.length, 1);
  const tp = s.positions[0].tpDist;
  await tick(s, params, new Map([["X", 100 * (1 + tp + 0.001)]]), [], broker, { tradingEnabled: true, now: 120_000 });
  assert.equal(s.positions.length, 0);
  assert.ok(s.trades[0].reason === "take_profit" && s.trades[0].pnl > 0);
});


test("paused tick keeps existing positions managed but opens no new positions", async () => {
  const params = normalizeParams({ maxPositions: 2, leverage: 2, slPct: 1, timeStopMin: 240 });
  const s = newState("paper", 1000, 0);
  const broker = new PaperBroker(params);
  const first = [{ symbol: "X", price: 100, pUp: 0.95, sigma: 0.0005 }];
  await tick(s, params, new Map([["X", 100]]), first, broker, { tradingEnabled: true, now: 60_000 });
  assert.equal(s.positions.length, 1);
  const heldId = s.positions[0].id;

  await tick(
    s, params, new Map([["X", 100], ["Y", 50]]),
    [{ symbol: "Y", price: 50, pUp: 0.99, sigma: 0.0005 }],
    broker, { tradingEnabled: false, now: 120_000 },
  );
  assert.equal(s.positions.length, 1);
  assert.equal(s.positions[0].id, heldId);
  assert.equal(s.positions[0].markPrice, 100);
  assert.equal(s.positions[0].recommendation, "HOLD");

  const tp = s.positions[0].tpDist;
  await tick(s, params, new Map([["X", 100 * (1 + tp + 0.001)]]), [], broker, { tradingEnabled: false, now: 180_000 });
  assert.equal(s.positions.length, 0);
  assert.equal(s.trades[0].reason, "take_profit");
});

test("daily loss limit halts and flattens", async () => {
  const params = normalizeParams({ maxPositions: 1, dailyLossPct: 1, slPct: 5, leverage: 10 });
  const s = newState("paper", 1000, 0);
  const broker = new PaperBroker(params);
  await tick(s, params, new Map([["X", 100]]), [{ symbol: "X", price: 100, pUp: 0.95, sigma: 0.0005 }], broker, { tradingEnabled: true, now: 60_000 });
  assert.equal(s.positions.length, 1);
  await tick(s, params, new Map([["X", 99.5]]), [], broker, { tradingEnabled: true, now: 120_000 });
  assert.ok(s.haltedReason);
  assert.equal(s.positions.length, 0);
});

test("params are clamped", () => {
  const p = normalizeParams({ leverage: 999, maxPositions: 0, tpR: "abc" });
  assert.equal(p.leverage, 10);
  assert.equal(p.maxPositions, 1);
  assert.equal(p.tpR, DEFAULT_PARAMS.tpR);
});

test("market analysis identifies trend and produces multi-timeframe diagnostics", () => {
  let p = 100;
  const trend: Candle[] = [];
  for (let i = 0; i < 180; i++) {
    const next = p * Math.exp(0.0008);
    trend.push({ t: i * 60000, o: p, h: next * 1.0001, l: p * 0.9999, c: next, v: 10 });
    p = next;
  }
  const a = analyzeMarket(trend)!;
  assert.equal(a.regime, "TRENDING");
  assert.ok(a.mtfBias > 0.5);
  assert.ok(a.mtfAgreement >= 2 / 3);
  const fused = fuseMultiTimeframe(0.6, a);
  assert.ok(fused > 0.6 && fused < 1);
});

test("volatility expansion is classified as a high-volatility regime", () => {
  let p = 100;
  const c: Candle[] = [];
  for (let i = 0; i < 180; i++) {
    const ret = i < 150 ? (i % 2 ? 0.0001 : -0.0001) : (i % 2 ? 0.004 : -0.004);
    const next = p * Math.exp(ret);
    c.push({ t: i * 60000, o: p, h: Math.max(p, next) * 1.0001,
      l: Math.min(p, next) * 0.9999, c: next, v: 10 });
    p = next;
  }
  const a = analyzeMarket(c)!;
  assert.equal(a.regime, "HIGH_VOL");
  assert.ok(a.volatilityRatio >= 1.8);
  assert.ok(a.atrPct > 0);
});

test("regime changes target distance and MTF disagreement discounts score", () => {
  const base = { symbol: "X", price: 100, pUp: 0.8, sigma: 0.001 };
  const trend = scoreCandidate({ ...base, analysis: {
    regime: "TRENDING", efficiencyRatio: 0.7, volatilityRatio: 1,
    atrPct: 0.001, mtfBias: 0.8, mtfAgreement: 1,
  } }, 100, DEFAULT_PARAMS);
  const range = scoreCandidate({ ...base, analysis: {
    regime: "RANGING", efficiencyRatio: 0.1, volatilityRatio: 1,
    atrPct: 0.001, mtfBias: -0.8, mtfAgreement: 0.33,
  } }, 100, DEFAULT_PARAMS);
  assert.ok(trend.tpDist > range.tpDist);
  assert.ok(trend.score > range.score);
});

test("sigma1m is positive on noisy data", () => {
  assert.ok(sigma1m(walk(100, 0, 0.002)) > 0);
});

import { createPublicKey, verify, randomBytes } from "node:crypto";
import { OrderlyClient, normalizeQty, parseSecretSeed } from "../worker/orderly";

test("orderly signing: base64url ed25519 over ts+method+path+body verifies", () => {
  const seed = randomBytes(32);
  const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let n = BigInt("0x" + seed.toString("hex")), enc = "";
  while (n > 0n) { enc = B58[Number(n % 58n)] + enc; n /= 58n; }
  assert.deepEqual(parseSecretSeed(`ed25519:${enc}`), seed);
  const c = new OrderlyClient("testnet", "0xabc", "ed25519:pub", `ed25519:${enc}`);
  const sig = c.signRequest(1700000000000, "POST", "/v1/order", '{"a":1}');
  const pub = createPublicKey((c as any).key);
  assert.ok(verify(null, Buffer.from('1700000000000POST/v1/order{"a":1}'), pub, Buffer.from(sig, "base64url")));
});

test("qty normalisation respects tick, min size and min notional", () => {
  const rules = { base_tick: 0.001, base_min: 0.001, min_notional: 10, decimals: 3 };
  assert.equal(normalizeQty(rules, 0.12349, 100), 0.123);
  assert.equal(normalizeQty(rules, 0.05, 100), 0); // $5 < $10 min notional
  assert.equal(normalizeQty(undefined, 1, 1), 0);
});
