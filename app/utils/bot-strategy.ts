import type { Candle } from "@/components/BotChart";

export const BOT_TAKER_FEE_RATE = 0.0005;
export const BOT_MAINTENANCE_MARGIN_RATE = 0.005;

export function normalizeSimulationLeverage(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(100, Math.max(1, parsed));
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
  if (index < 20 || index >= candles.length) return null;

  const current = candles[index];
  const baseline = candles[index - 4]?.c;
  const averageVolume =
    candles
      .slice(index - 20, index)
      .reduce((total, candle) => total + Math.max(0, candle.v), 0) / 20;
  if (
    !Number.isFinite(baseline) ||
    baseline <= 0 ||
    !Number.isFinite(current.v) ||
    averageVolume <= 0
  ) {
    return null;
  }

  const volumeRatio = current.v / averageVolume;
  if (volumeRatio < thresholds.volumeMultiplier) return null;

  const changePct = ((current.c - baseline) / baseline) * 100;
  const recentHigh = Math.max(
    ...candles.slice(index - 4, index + 1).map((candle) => candle.h),
  );
  const drawdownPct = ((current.c - recentHigh) / recentHigh) * 100;

  if (drawdownPct <= -thresholds.dumpPct && current.c < candles[index - 1].c) {
    return {
      kind: "DUMP",
      symbol,
      price: current.c,
      changePct: drawdownPct,
      volumeRatio,
      candleTime: current.t,
    };
  }

  if (changePct >= thresholds.pumpPct) {
    return {
      kind: "PUMP",
      symbol,
      price: current.c,
      changePct,
      volumeRatio,
      candleTime: current.t,
    };
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
  if (
    index < Math.max(rsiPeriod, emaFastPeriod, emaSlowPeriod) ||
    index >= candles.length
  ) {
    return { buy: false, sell: false };
  }

  const rsi = computeRSI(candles, rsiPeriod);
  const emaFast = computeEMA(candles, emaFastPeriod);
  const emaSlow = computeEMA(candles, emaSlowPeriod);
  return getSignalDecisionFromIndicators(
    index,
    parameters,
    hasPosition,
    rsi,
    emaFast,
    emaSlow,
  );
}

export function getSignalDecisionFromIndicators(
  index: number,
  parameters: SignalParameters,
  hasPosition: boolean,
  rsi: number[],
  emaFast: number[],
  emaSlow: number[],
) {
  if (
    index < 0 ||
    index >= rsi.length ||
    index >= emaFast.length ||
    index >= emaSlow.length ||
    index <
      Math.max(
        parameters.rsiPeriod ?? 14,
        parameters.emaFast ?? 9,
        parameters.emaSlow ?? 21,
      )
  ) {
    return { buy: false, sell: false };
  }

  return {
    buy:
      !hasPosition &&
      rsi[index] < (parameters.rsiOversold ?? 35) &&
      emaFast[index] > emaSlow[index],
    sell:
      hasPosition &&
      (rsi[index] > (parameters.rsiOverbought ?? 68) ||
        emaFast[index] < emaSlow[index]),
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
  if (index < 1 || index >= candles.length || gridCount < 1) {
    return { buy: false, sell: false };
  }

  const history = candles.slice(Math.max(0, index - 100), index);
  const hasConfiguredRange =
    lowerBound !== undefined &&
    upperBound !== undefined &&
    Number.isFinite(lowerBound) &&
    Number.isFinite(upperBound) &&
    lowerBound < upperBound;
  const lower =
    hasConfiguredRange && lowerBound !== undefined
      ? lowerBound
      : Math.min(...history.map((candle) => candle.l));
  const upper =
    hasConfiguredRange && upperBound !== undefined
      ? upperBound
      : Math.max(...history.map((candle) => candle.h));
  const step = (upper - lower) / gridCount;
  if (!Number.isFinite(step) || step <= 0) return { buy: false, sell: false };

  const previous = candles[index - 1].c;
  const current = candles[index].c;
  return {
    buy:
      !hasPosition &&
      previous >= lower &&
      current >= lower &&
      previous <= upper &&
      current <= upper &&
      Math.floor((current - lower) / step) <
        Math.floor((previous - lower) / step),
    sell:
      hasPosition &&
      previous >= lower &&
      current >= lower &&
      previous <= upper &&
      current <= upper &&
      Math.floor((current - lower) / step) >
        Math.floor((previous - lower) / step),
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
