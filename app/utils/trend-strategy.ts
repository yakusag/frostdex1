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
