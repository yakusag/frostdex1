import type { Candle } from "@/components/BotChart";

export const BOT_TAKER_FEE_RATE = 0.0005;
export const BOT_MAINTENANCE_MARGIN_RATE = 0.005;

export function normalizeSimulationLeverage(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(10, Math.max(1, parsed));
}

export function getRemainingBotBudget(
  investment: number,
  realizedPnl: number,
  unrealizedPnl = 0,
) {
  if (
    !Number.isFinite(investment) ||
    investment <= 0 ||
    !Number.isFinite(realizedPnl) ||
    !Number.isFinite(unrealizedPnl)
  ) {
    return 0;
  }
  return Math.min(
    investment,
    Math.max(0, investment + realizedPnl + unrealizedPnl),
  );
}

export function getLongLiquidationPrice(entryPrice: number, leverage: number) {
  if (leverage <= 1) return 0;
  return (entryPrice * (1 - 1 / leverage)) / (1 - BOT_MAINTENANCE_MARGIN_RATE);
}

export interface SignalParameters {
  rsiPeriod?: number;
  rsiOversold?: number;
  rsiOverbought?: number;
  emaFast?: number;
  emaSlow?: number;
}

export interface SniperAlert {
  kind: "PUMP" | "DUMP";
  symbol: string;
  price: number;
  changePct: number;
  volumeRatio: number;
  candleTime: number;
}

export const SNIPER_DEFAULT_THRESHOLDS = {
  pumpPct: 8,
  dumpPct: 5,
  volumeMultiplier: 3,
};

export function getSniperAlert(
  symbol: string,
  candles: Candle[],
  index: number,
  thresholds = SNIPER_DEFAULT_THRESHOLDS,
): SniperAlert | null {
  if (index < 50 || index >= candles.length) return null;
  const current = candles[index];
  const baseline = candles[index - 4]?.c;
  const averageVolume =
    candles.slice(index - 20, index).reduce((total, candle) => total + Math.max(0, candle.v), 0) / 20;
  const candleRange = current.h - current.l;
  if (!Number.isFinite(baseline) || baseline <= 0 || !Number.isFinite(current.v) || averageVolume <= 0 || candleRange <= 0) return null;
  const volumeRatio = current.v / averageVolume;
  if (volumeRatio < thresholds.volumeMultiplier) return null;
  const changePct = ((current.c - baseline) / baseline) * 100;
  const recentHigh = Math.max(...candles.slice(index - 4, index + 1).map((c) => c.h));
  const drawdownPct = ((current.c - recentHigh) / recentHigh) * 100;
  const ema20 = computeEMA(candles, 20);
  const ema50 = computeEMA(candles, 50);
  const closeLocation = (current.c - current.l) / candleRange;
  const risingTrend = ema20[index] > ema50[index] && ema20[index] >= ema20[index - 3];
  const fallingTrend = ema20[index] < ema50[index] && ema20[index] <= ema20[index - 3];
  if (changePct >= thresholds.pumpPct && risingTrend && current.c > current.o && closeLocation >= 0.65) {
    return { kind: "PUMP", symbol, price: current.c, changePct, volumeRatio, candleTime: current.t };
  }
  if (drawdownPct <= -thresholds.dumpPct && fallingTrend && current.c < current.o && closeLocation <= 0.35 && current.c < candles[index - 1].c) {
    return { kind: "DUMP", symbol, price: current.c, changePct: drawdownPct, volumeRatio, candleTime: current.t };
  }
  return null;
}

export function computeRSI(candles: Candle[], period = 14): number[] {
  const rsi: number[] = Array(candles.length).fill(50);
  if (candles.length < period + 1) return rsi;

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const change = candles[i].c - candles[i - 1].c;
    if (change > 0) gainSum += change;
    else lossSum -= change;
  }

  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  for (let i = period; i < candles.length; i++) {
    const change = candles[i].c - candles[i - 1].c;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return rsi;
}

export function computeEMA(candles: Candle[], period: number): number[] {
  const multiplier = 2 / (period + 1);
  const ema: number[] = [];
  candles.forEach((candle, index) => {
    ema.push(
      index === 0
        ? candle.c
        : candle.c * multiplier + ema[index - 1] * (1 - multiplier),
    );
  });
  return ema;
}

export function computeATR(candles: Candle[], period = 14): number[] {
  const atr: number[] = Array(candles.length).fill(0);
  for (let i = 1; i < candles.length; i++) {
    const trueRange = Math.max(
      candles[i].h - candles[i].l,
      Math.abs(candles[i].h - candles[i - 1].c),
      Math.abs(candles[i].l - candles[i - 1].c),
    );
    atr[i] =
      i < period
        ? (atr[i - 1] * (i - 1) + trueRange) / i
        : (atr[i - 1] * (period - 1) + trueRange) / period;
  }
  return atr;
}

export function getSignalDecision(
  candles: Candle[],
  index: number,
  parameters: SignalParameters,
  hasPosition: boolean,
) {
  const rsiPeriod = parameters.rsiPeriod ?? 14;
  const emaFastPeriod = parameters.emaFast ?? 9;
  const emaSlowPeriod = parameters.emaSlow ?? 21;
  if (index < Math.max(rsiPeriod, emaFastPeriod, emaSlowPeriod, 50) || index >= candles.length) return { buy: false, sell: false };
  const rsi = computeRSI(candles, rsiPeriod);
  const emaFast = computeEMA(candles, emaFastPeriod);
  const emaSlow = computeEMA(candles, emaSlowPeriod);
  const emaTrend = computeEMA(candles, 50);
  return getSignalDecisionFromIndicators(
    index, parameters, hasPosition, rsi, emaFast, emaSlow, emaTrend,
    candles.map((candle) => candle.c),
  );
}


export function getRotationDecision(
  candles: Candle[],
  index: number,
  hasPosition: boolean,
) {
  const decision = getSignalDecision(
    candles,
    index,
    { rsiPeriod: 14, rsiOversold: 42, rsiOverbought: 68, emaFast: 9, emaSlow: 21 },
    hasPosition,
  );
  if (hasPosition || !decision.buy || index < 50 || index >= candles.length) {
    return decision;
  }
  const close = candles[index].c;
  const previousClose = candles[index - 4]?.c ?? 0;
  const momentum = previousClose > 0 ? ((close / previousClose) - 1) * 100 : 0;
  const averageVolume = candles.slice(index - 20, index)
    .reduce((sum, candle) => sum + Math.max(0, candle.v), 0) / 20;
  const volumeRatio = averageVolume > 0 ? candles[index].v / averageVolume : 0;
  return {
    buy: Number.isFinite(momentum) && momentum > 0.05 && momentum <= 4 && volumeRatio >= 0.65,
    sell: decision.sell,
  };
}

export function getSignalDecisionFromIndicators(
  index: number,
  parameters: SignalParameters,
  hasPosition: boolean,
  rsi: number[],
  emaFast: number[],
  emaSlow: number[],
  emaTrend: number[] = emaSlow,
  closes?: number[],
) {
  if (
    index < 1 || index >= rsi.length || index >= emaFast.length ||
    index >= emaSlow.length || index >= emaTrend.length ||
    index < Math.max(parameters.rsiPeriod ?? 14, parameters.emaFast ?? 9, parameters.emaSlow ?? 21, 50)
  ) return { buy: false, sell: false };
  const oversold = parameters.rsiOversold ?? 35;
  const overbought = parameters.rsiOverbought ?? 68;
  const trendWasRising = emaTrend[index] >= emaTrend[index - 3];
  const priceAboveTrend = !closes || closes[index] >= emaTrend[index];
  const priceBelowTrend = !!closes && closes[index] < emaTrend[index] * 0.995;
  const bullishMomentum =
    rsi[index] > rsi[index - 1] &&
    rsi[index - 1] <= Math.max(55, oversold + 15) &&
    rsi[index] <= 65;
  return {
    buy:
      !hasPosition && emaFast[index] > emaSlow[index] &&
      emaSlow[index] >= emaSlow[index - 3] && trendWasRising &&
      priceAboveTrend && bullishMomentum,
    sell:
      hasPosition &&
      (rsi[index] >= overbought || emaFast[index] < emaSlow[index] || priceBelowTrend),
  };
}

export function getGridDecision(
  candles: Candle[],
  index: number,
  gridCount: number,
  hasPosition: boolean,
  lowerBound?: number,
  upperBound?: number,
) {
  if (index < 50 || index >= candles.length || gridCount < 2) return { buy: false, sell: false };
  const history = candles.slice(Math.max(0, index - 100), index);
  const hasConfiguredRange = lowerBound !== undefined && upperBound !== undefined &&
    Number.isFinite(lowerBound) && Number.isFinite(upperBound) && lowerBound < upperBound;
  const lower = hasConfiguredRange && lowerBound !== undefined ? lowerBound : Math.min(...history.map((c) => c.l));
  const upper = hasConfiguredRange && upperBound !== undefined ? upperBound : Math.max(...history.map((c) => c.h));
  const range = upper - lower;
  const step = range / gridCount;
  if (!Number.isFinite(step) || step <= 0 || candles[index].c < lower || candles[index].c > upper ||
      candles[index - 1].c < lower || candles[index - 1].c > upper) return { buy: false, sell: false };
  const previousLevel = Math.floor((candles[index - 1].c - lower) / step);
  const currentLevel = Math.floor((candles[index].c - lower) / step);
  const rsi = computeRSI(candles, 14);
  const ema50 = computeEMA(candles, 50);
  const mildOrPositiveTrend = ema50[index] >= ema50[index - 5] * 0.995;
  return {
    buy:
      !hasPosition && currentLevel < previousLevel &&
      candles[index].c <= lower + range * 0.7 && rsi[index] <= 48 &&
      rsi[index] > rsi[index - 1] && mildOrPositiveTrend,
    sell:
      hasPosition && currentLevel > previousLevel &&
      candles[index].c >= lower + range * 0.3 && rsi[index] >= 52,
  };
}

export function getDcaDecision(
  candles: Candle[],
  index: number,
  intervalElapsed: boolean,
  hasPosition: boolean,
  entryPrice = 0,
) {
  if (index < 50 || index >= candles.length) return { buy: false, sell: false };
  const rsi = computeRSI(candles, 14);
  const ema20 = computeEMA(candles, 20);
  const ema50 = computeEMA(candles, 50);
  const current = candles[index];
  const previous = candles[index - 1];
  const trendConfirmed = ema20[index] > ema50[index] && ema50[index] >= ema50[index - 4] * 0.998;
  const controlledPullback = current.c <= ema20[index] * 1.003 && current.c >= ema50[index] * 0.985;
  const bullishReclaim = current.c > current.o && current.c >= previous.c;
  return {
    buy: intervalElapsed && trendConfirmed && controlledPullback && bullishReclaim && rsi[index] >= 35 && rsi[index] <= 55,
    sell: hasPosition && entryPrice > 0 &&
      (current.c >= entryPrice * 1.03 || rsi[index] >= 68 || ema20[index] < ema50[index]),
  };
}

export function getDcaIntervalMs(interval: unknown) {
  const intervals: Record<string, number> = {
    "15m": 15 * 60 * 1000,
    "30m": 30 * 60 * 1000,
    "1h": 60 * 60 * 1000,
    "4h": 4 * 60 * 60 * 1000,
    "8h": 8 * 60 * 60 * 1000,
    "12h": 12 * 60 * 60 * 1000,
    "1d": 24 * 60 * 60 * 1000,
    "3d": 3 * 24 * 60 * 60 * 1000,
    "1w": 7 * 24 * 60 * 60 * 1000,
  };
  return intervals[String(interval)] ?? 60 * 60 * 1000;
}
