import {
  newAdaptiveConformalState,
  observeAdaptiveConformal,
  type AdaptiveConformalState,
} from "./engine.js";

export type CalibrationHorizon = 5 | 10 | 15;

export interface PendingCalibrationForecast {
  originTime: number;
  targetTime: number;
  originClose: number;
  pUp: number;
  threshold: number;
}

export interface HorizonCalibrationBucket {
  adaptive: AdaptiveConformalState;
  pending: PendingCalibrationForecast[];
  lastForecastTime: number;
}

export interface CalibrationCandle {
  t: number;
  c: number;
}

export function newHorizonCalibrationBucket(): HorizonCalibrationBucket {
  return { adaptive: newAdaptiveConformalState(), pending: [], lastForecastTime: 0 };
}

/** Resolve labels only after the target candle has fully closed. Missing bars are discarded, never imputed. */
export function resolveHorizonForecasts(
  bucket: HorizonCalibrationBucket,
  candles: CalibrationCandle[],
  now: number,
  candleMs: number,
  missingBarGrace = 3,
): boolean {
  if (!candles.length) return false;
  const byTime = new Map(candles.map((c) => [c.t, c]));
  const latestTime = candles[candles.length - 1].t;
  let changed = false;
  const remaining: PendingCalibrationForecast[] = [];

  for (const pending of [...bucket.pending].sort((a, b) => a.originTime - b.originTime)) {
    const target = byTime.get(pending.targetTime);
    if (target && now >= pending.targetTime + candleMs) {
      const actualUp = target.c > pending.originClose;
      const score = actualUp ? 1 - pending.pUp : pending.pUp;
      observeAdaptiveConformal(bucket.adaptive, score, pending.threshold);
      changed = true;
    } else if (latestTime <= pending.targetTime + missingBarGrace * candleMs) {
      remaining.push(pending);
    } else {
      changed = true;
    }
  }
  bucket.pending = remaining;
  return changed;
}

/** Add at most one forecast per source candle to this horizon's own pending queue. */
export function queueHorizonForecast(
  bucket: HorizonCalibrationBucket,
  horizon: CalibrationHorizon,
  forecast: { candleTime: number; close: number; pUp: number },
  candleMs: number,
  threshold: number,
): boolean {
  if (!(forecast.close > 0) || !Number.isFinite(forecast.pUp) ||
      forecast.pUp < 0 || forecast.pUp > 1 ||
      !Number.isFinite(forecast.candleTime) ||
      forecast.candleTime <= bucket.lastForecastTime) return false;

  bucket.pending.push({
    originTime: forecast.candleTime,
    targetTime: forecast.candleTime + horizon * candleMs,
    originClose: forecast.close,
    pUp: forecast.pUp,
    threshold,
  });
  bucket.pending = bucket.pending.slice(-60);
  bucket.lastForecastTime = forecast.candleTime;
  return true;
}
