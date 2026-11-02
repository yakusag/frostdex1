import type { Candle } from "@/components/BotChart";

const TREND_CANDLE_INTERVAL_MS = 15 * 60 * 1000;

export function normalizeTrendParameter(value: unknown, fallback: number) {
  if (typeof value === "string" && value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(5, Math.max(1, parsed));
}

export function getLastClosedTrendCandleIndex(
  candles: Candle[],
  now = Date.now(),
) {
  const lastIndex = candles.length - 1;
  if (lastIndex < 0) return lastIndex;

  return candles[lastIndex].t + TREND_CANDLE_INTERVAL_MS <= now
    ? lastIndex
    : lastIndex - 1;
}

export function isTrendPullbackEntry(
  candles: Candle[],
  emaFast: number[],
  emaSlow: number[],
  rsi: number[],
  atr: number[],
  index: number,
) {
  if (index < 1 || index >= candles.length) return false;

  const pullbackStart = Math.max(0, index - 3);
  const hadRecentPullback = candles
    .slice(pullbackStart, index)
    .some((candle, offset) => candle.c <= emaFast[pullbackStart + offset]);

  return (
    emaFast[index] > emaSlow[index] &&
    hadRecentPullback &&
    candles[index].c > emaFast[index] &&
    rsi[index] >= 45 &&
    rsi[index] <= 70 &&
    atr[index] > 0
  );
}
