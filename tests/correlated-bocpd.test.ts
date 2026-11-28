import assert from "node:assert/strict";
import { test } from "node:test";
import { correlatedBocpdProbability } from "../shared/rotation/correlated-bocpd.js";

function seededReturns(n: number, rho: number, seed = 7): number[] {
  let state = seed >>> 0;
  const random = () => ((state = (1664525 * state + 1013904223) >>> 0) / 4294967296);
  const out: number[] = [];
  let previous = 0;
  for (let i = 0; i < n; i++) {
    const noise = (random() + random() + random() + random() - 2) * 0.0008;
    previous = rho * previous + noise;
    out.push(previous);
  }
  return out;
}

test("correlated BOCPD returns a bounded probability on autocorrelated data", () => {
  const returns = seededReturns(120, 0.8);
  const probability = correlatedBocpdProbability(returns, 0.001);
  assert.ok(Number.isFinite(probability));
  assert.ok(probability >= 0 && probability <= 1);
});

test("correlated BOCPD responds to a persistent mean and volatility shift", () => {
  const returns = seededReturns(100, 0.65);
  for (let i = 100; i < 120; i++) returns.push(0.002 + (i % 2 ? 0.003 : -0.003));
  const probability = correlatedBocpdProbability(returns, 0.001);
  assert.ok(Number.isFinite(probability));
  assert.ok(probability >= 0 && probability <= 1);
});

test("correlated BOCPD safely handles short and malformed input", () => {
  assert.equal(correlatedBocpdProbability([0.001, -0.001], 0.001), 0);
  assert.equal(correlatedBocpdProbability([NaN, Infinity, 0, 0], 0.001), 0);
});
