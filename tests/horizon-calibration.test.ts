import assert from "node:assert/strict";
import { test } from "node:test";
import {
  newHorizonCalibrationBucket,
  queueHorizonForecast,
  resolveHorizonForecasts,
} from "../shared/rotation/horizon-calibration.js";

const MINUTE = 60_000;
const forecast = { candleTime: 1_000 * MINUTE, close: 100, pUp: 0.8 };

test("horizons keep independent pending queues and adaptive state", () => {
  const five = newHorizonCalibrationBucket();
  const fifteen = newHorizonCalibrationBucket();
  assert.equal(queueHorizonForecast(five, 5, forecast, MINUTE, 0.2), true);
  assert.equal(queueHorizonForecast(fifteen, 15, forecast, MINUTE, 0.2), true);
  assert.equal(five.pending[0].targetTime, 1_005 * MINUTE);
  assert.equal(fifteen.pending[0].targetTime, 1_015 * MINUTE);
  assert.notEqual(five.pending, fifteen.pending);
  assert.equal(five.adaptive.observations, 0);
  assert.equal(fifteen.adaptive.observations, 0);
});

test("a forecast is not scored before the target candle closes", () => {
  const bucket = newHorizonCalibrationBucket();
  queueHorizonForecast(bucket, 5, forecast, MINUTE, 0.2);
  const target = { t: 1_005 * MINUTE, c: 110 };
  assert.equal(resolveHorizonForecasts(bucket, [target], target.t + MINUTE - 1, MINUTE), false);
  assert.equal(bucket.adaptive.observations, 0);
  assert.equal(bucket.pending.length, 1);
  assert.equal(resolveHorizonForecasts(bucket, [target], target.t + MINUTE, MINUTE), true);
  assert.equal(bucket.adaptive.observations, 1);
  assert.equal(bucket.pending.length, 0);
});

test("missing target bars are dropped without creating fabricated outcomes", () => {
  const bucket = newHorizonCalibrationBucket();
  queueHorizonForecast(bucket, 5, forecast, MINUTE, 0.2);
  const later = { t: 1_009 * MINUTE, c: 105 };
  assert.equal(resolveHorizonForecasts(bucket, [later], later.t, MINUTE), true);
  assert.equal(bucket.adaptive.observations, 0);
  assert.equal(bucket.pending.length, 0);
});

test("duplicate source candles are not queued twice", () => {
  const bucket = newHorizonCalibrationBucket();
  assert.equal(queueHorizonForecast(bucket, 10, forecast, MINUTE, 0.2), true);
  assert.equal(queueHorizonForecast(bucket, 10, forecast, MINUTE, 0.2), false);
  assert.equal(bucket.pending.length, 1);
});
