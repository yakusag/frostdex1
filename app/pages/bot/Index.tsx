import {
  useState,
  useCallback,
  useEffect,
  useRef,
  lazy,
  Suspense,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  useAccount,
  useCollateral,
  useMarkPrice,
  useOrderEntry,
  useSymbolInfo,
  useSymbolsInfo,
} from "@orderly.network/hooks";
import { OrderSide, OrderType } from "@orderly.network/types";
import type { Candle } from "@/components/BotChart";
import {
  BOT_TAKER_FEE_RATE,
  computeATR,
  computeEMA,
  computeRSI,
  getDcaIntervalMs,
  getGridDecision,
  getSignalDecision,
} from "@/utils/bot-strategy";
import {
  getLastClosedTrendCandleIndex,
  isTrendPullbackEntry,
  normalizeTrendParameter,
} from "@/utils/trend-strategy";

const BotBacktest = lazy(() => import("@/components/BotBacktest"));

type BotStrategy = "grid" | "dca" | "signal" | "trend";
type BotStatus = "running" | "stopped" | "paused";

interface BotConfig {
  id: string;
  name: string;
  strategy: BotStrategy;
  symbol: string;
  investment: number;
  status: BotStatus;
  pnl: number;
  pnlPct: number;
  trades: number;
  createdAt: number;
  params: Record<string, string | number>;
  liveMode: boolean;
  realizedPnl?: number;
  position?: BotPosition | null;
  dcaLastBuyAt?: number;
  markPrice?: number;
  paperPosition?: ManagedPosition | null;
  paperRealizedPnl?: number;
  paperLastCandle?: number;
  marketDataStatus?: "ready" | "unavailable";
}

interface BotPosition {
  entryPrice: number;
  quantity: number;
}

interface BotPerformance {
  pnl: number;
  realizedPnl: number;
  position: BotPosition | null;
  markPrice: number;
}

interface TradeLog {
  id: string;
  botId: string;
  side: "BUY" | "SELL";
  symbol: string;
  qty: number;
  price: number;
  ts: number;
  live?: boolean;
  orderId?: string;
}

interface PendingOrder {
  botId: string;
  symbol: string;
  side: "BUY" | "SELL";
  qty: string;
  triggerPrice: number;
  position?: ManagedPosition;
}

interface SymbolOrderRules {
  base_dp: number;
  base_tick: number;
  base_min: number;
  min_notional: number;
}

interface ManagedPosition {
  qty: number;
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
}

type PaperBotUpdate = Partial<
  Pick<
    BotConfig,
    | "paperPosition"
    | "paperRealizedPnl"
    | "paperLastCandle"
    | "marketDataStatus"
    | "pnl"
    | "pnlPct"
  >
>;

const STORAGE_KEY = "frostdex_bots_v1";
const LOGS_KEY = "frostdex_bot_logs_v1";

const POPULAR_SYMBOLS = [
  "PERP_BTC_USDC",
  "PERP_ETH_USDC",
  "PERP_SOL_USDC",
  "PERP_ARB_USDC",
  "PERP_BNB_USDC",
  "PERP_MATIC_USDC",
  "PERP_AVAX_USDC",
  "PERP_DOGE_USDC",
  "PERP_LINK_USDC",
  "PERP_OP_USDC",
  "PERP_XAU_USDC",
  "PERP_XAG_USDC",
  "PERP_CL_USDC",
  "PERP_NATGAS_USDC_arthur",
];

const SYMBOL_DISPLAY_MAP: Record<string, string> = {
  PERP_XAU_USDC: "XAU/USDC",
  PERP_XAG_USDC: "XAG/USDC",
  PERP_CL_USDC: "OIL/USDC",
  PERP_NATGAS_USDC_arthur: "GAS/USDC",
};
function symbolDisplay(s: string) {
  if (SYMBOL_DISPLAY_MAP[s]) return SYMBOL_DISPLAY_MAP[s];
  const m = s.match(/^PERP_(.+?)_(USDC|USDT)(?:_|$)/);
  return m ? `${m[1]}/${m[2]}` : s;
}

function sortMarketSymbols(symbols: string[]) {
  const priority = [
    "PERP_BTC_USDT",
    "PERP_BTC_USDC",
    "PERP_ETH_USDT",
    "PERP_ETH_USDC",
    "PERP_SOL_USDT",
    "PERP_SOL_USDC",
    "PERP_ARB_USDT",
    "PERP_ARB_USDC",
    "PERP_BNB_USDT",
    "PERP_BNB_USDC",
  ];

  return [...new Set(symbols)].sort((a, b) => {
    const ai = priority.indexOf(a);
    const bi = priority.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });
}

function generateId() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

function getConfiguredGridBound(value: string | number | undefined) {
  if (value === undefined || value === "" || value === "auto") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getOrderQuantity(
  targetNotional: number,
  price: number,
  rules: SymbolOrderRules,
) {
  if (
    !Number.isFinite(targetNotional) ||
    targetNotional <= 0 ||
    !Number.isFinite(price) ||
    price <= 0
  ) {
    return null;
  }

  const step = rules.base_tick || 10 ** -rules.base_dp;
  const minimumQuantity = Math.max(rules.base_min, rules.min_notional / price);
  const quantity =
    Math.ceil(Math.max(targetNotional / price, minimumQuantity) / step) * step;
  const roundedQuantity = Number(quantity.toFixed(rules.base_dp));

  return Number.isFinite(roundedQuantity) && roundedQuantity > 0
    ? roundedQuantity
    : null;
}

function getHistoricalPerformance(trades: TradeLog[]) {
  let realizedPnl = 0;
  let positionEntryPrice = 0;
  let positionQuantity = 0;

  for (const trade of [...trades]
    .filter((item) => item.live)
    .sort((a, b) => a.ts - b.ts)) {
    if (trade.side === "BUY") {
      const quantity = positionQuantity + trade.qty;
      positionEntryPrice =
        (positionEntryPrice * positionQuantity + trade.price * trade.qty) /
        quantity;
      positionQuantity = quantity;
      realizedPnl -= trade.price * trade.qty * BOT_TAKER_FEE_RATE;
      continue;
    }

    if (positionQuantity <= 0) continue;

    const closedQty = Math.min(positionQuantity, trade.qty);
    realizedPnl +=
      (trade.price - positionEntryPrice) * closedQty -
      trade.price * closedQty * BOT_TAKER_FEE_RATE;
    positionQuantity -= closedQty;
  }

  return {
    realizedPnl,
    position:
      positionQuantity > 0
        ? { entryPrice: positionEntryPrice, quantity: positionQuantity }
        : null,
  };
}

interface OrderlyHistory {
  s?: string;
  t?: number[];
  o?: number[];
  h?: number[];
  l?: number[];
  c?: number[];
  v?: number[];
}

function useOrderlyFeed(symbol: string) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [latestPrice, setLatestPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let fetching = false;

    const load = async () => {
      if (fetching) return;
      fetching = true;
      const to = Math.floor(Date.now() / 1000);
      const from = to - 30 * 60 * 60;

      try {
        const response = await fetch(
          `https://api.orderly.org/v1/tv/history?symbol=${encodeURIComponent(symbol)}&resolution=15&from=${from}&to=${to}`,
          { cache: "no-store" },
        );
        if (!response.ok)
          throw new Error(`Market data unavailable (${response.status})`);

        const data = (await response.json()) as OrderlyHistory;
        const length = Math.min(
          data.t?.length ?? 0,
          data.o?.length ?? 0,
          data.h?.length ?? 0,
          data.l?.length ?? 0,
          data.c?.length ?? 0,
          data.v?.length ?? 0,
        );
        if (data.s !== "ok" || length === 0) {
          throw new Error("No market data available for this symbol");
        }

        const rows: Candle[] = Array.from({ length }, (_, index) => ({
          t: (data.t![index] ?? 0) * 1000,
          o: data.o![index] ?? 0,
          h: data.h![index] ?? 0,
          l: data.l![index] ?? 0,
          c: data.c![index] ?? 0,
          v: data.v![index] ?? 0,
        })).filter((candle) => candle.t > 0 && candle.c > 0);

        if (!active) return;
        setCandles(rows);
        setLatestPrice(rows.at(-1)?.c ?? null);
        setError(
          rows.length < 22
            ? "Insufficient candle history for this symbol"
            : null,
        );
      } catch (cause) {
        if (!active) return;
        setCandles([]);
        setLatestPrice(null);
        setError(
          cause instanceof Error ? cause.message : "Market data unavailable",
        );
      } finally {
        fetching = false;
        if (active) setLoading(false);
      }
    };

    setLoading(true);
    setCandles([]);
    setLatestPrice(null);
    void load();
    const interval = window.setInterval(() => void load(), 20_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [symbol]);

  return { candles, latestPrice, loading, error };
}

const STRATEGY_INFO: Record<
  BotStrategy,
  { label: string; desc: string; icon: string; color: string }
> = {
  grid: {
    label: "Grid Bot",
    desc: "Buys low, sells high inside a price range. Best for sideways markets.",
    icon: "⊞",
    color: "#38e0f8",
  },
  dca: {
    label: "DCA Bot",
    desc: "Invests a fixed amount at regular intervals to average entry price.",
    icon: "↻",
    color: "#0ecb81",
  },
  signal: {
    label: "Signal Bot",
    desc: "Trades on RSI + EMA crossover signals for momentum-based entries.",
    icon: "◈",
    color: "#f0b90b",
  },
  trend: {
    label: "Risk-Managed Trend",
    desc: "Trend pullback entries, 1% risk sizing, ATR stop and a 2.5R target. Risk is limited, not eliminated.",
    icon: "↗",
    color: "#ff8a65",
  },
};

// ── Live Order Submitter ──────────────────────────────────────────────────────
// Renders briefly to place one real market order on Orderly, then calls onDone.
function OrderSubmitter({
  pending,
  onDone,
  onInsufficientBalance,
}: {
  pending: PendingOrder;
  onDone: (result: { success: boolean; orderId?: string }) => void;
  onInsufficientBalance: () => void;
}) {
  const { freeCollateral } = useCollateral();
  const { submit } = useOrderEntry(pending.symbol, {
    initialOrder: {
      side: pending.side === "BUY" ? OrderSide.BUY : OrderSide.SELL,
      order_type: OrderType.MARKET,
      order_quantity: pending.qty,
    },
  });

  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current || !submit) return;
    submitted.current = true;
    const orderNotional = Number(pending.qty) * pending.triggerPrice;
    const orderCost = orderNotional * (1 + BOT_TAKER_FEE_RATE);
    if (
      pending.side === "BUY" &&
      (!Number.isFinite(freeCollateral) ||
        freeCollateral <= 0 ||
        orderCost > freeCollateral)
    ) {
      onInsufficientBalance();
      onDone({ success: false });
      return;
    }

    submit()
      .then((result) => {
        if (!result.success) {
          onDone({ success: false });
          return;
        }
        const data: unknown = result.data;
        const response =
          data && typeof data === "object"
            ? (data as Record<string, unknown>)
            : null;
        const nestedData = response?.data;
        const nestedResponse =
          nestedData && typeof nestedData === "object"
            ? (nestedData as Record<string, unknown>)
            : null;
        const orderId =
          typeof response?.order_id === "string"
            ? response.order_id
            : typeof nestedResponse?.order_id === "string"
              ? nestedResponse.order_id
              : undefined;
        onDone({ success: true, orderId });
      })
      .catch(() => onDone({ success: false }));
  }, [
    submit,
    onDone,
    onInsufficientBalance,
    freeCollateral,
    pending.qty,
    pending.side,
    pending.triggerPrice,
  ]);

  return null;
}

// ── Bot Live Engine ───────────────────────────────────────────────────────────
// Headless component: monitors real price + places real orders when signals fire.
function BotLiveEngine({
  bot,
  tradeLogs,
  onTradeExecuted,
  onPnlUpdate,
  onMarketDataStatus,
  onInsufficientBalance,
}: {
  bot: BotConfig;
  tradeLogs: TradeLog[];
  onTradeExecuted: (log: Omit<TradeLog, "id">) => void;
  onPnlUpdate: (botId: string, performance: BotPerformance) => void;
  onMarketDataStatus: (botId: string, status: "ready" | "unavailable") => void;
  onInsufficientBalance: (message?: string) => void;
}) {
  const { state: accountState } = useAccount();
  const { freeCollateral } = useCollateral();
  const symbolInfo = useSymbolInfo(bot.symbol);
  const symbolRules = symbolInfo?.();
  const feed = useOrderlyFeed(bot.symbol);

  useEffect(() => {
    if (feed.loading) return;
    const status =
      feed.error || !feed.latestPrice || feed.candles.length < 22
        ? "unavailable"
        : "ready";
    if (bot.marketDataStatus !== status) onMarketDataStatus(bot.id, status);
  }, [
    bot.id,
    bot.marketDataStatus,
    feed.loading,
    feed.error,
    feed.latestPrice,
    feed.candles.length,
    onMarketDataStatus,
  ]);

  const [managedPosition, setManagedPosition] =
    useState<ManagedPosition | null>(() => {
      try {
        return JSON.parse(
          localStorage.getItem(`frostdex_bot_position_${bot.id}`) || "null",
        );
      } catch {
        return null;
      }
    });
  const historicalPerformance = getHistoricalPerformance(tradeLogs);
  const initialPosition =
    bot.strategy === "trend" && managedPosition
      ? {
          entryPrice: managedPosition.entryPrice,
          quantity: managedPosition.qty,
        }
      : bot.position !== undefined
        ? bot.position
        : historicalPerformance.position;
  const initialRealizedPnl =
    bot.realizedPnl ?? historicalPerformance.realizedPnl;
  const positionRef = useRef<BotPosition | null>(initialPosition);
  const realizedPnlRef = useRef(initialRealizedPnl);
  const lastEvalRef = useRef(0);
  const [pendingOrder, setPendingOrder] = useState<PendingOrder | null>(null);
  const balanceAlertedRef = useRef(false);
  const lastDcaBuyRef = useRef(bot.dcaLastBuyAt ?? bot.createdAt);

  useEffect(() => {
    if (!feed.latestPrice) return;

    const position =
      bot.strategy === "trend" && managedPosition
        ? {
            entryPrice: managedPosition.entryPrice,
            quantity: managedPosition.qty,
          }
        : positionRef.current;
    onPnlUpdate(bot.id, {
      pnl:
        realizedPnlRef.current +
        (position
          ? (feed.latestPrice - position.entryPrice) * position.quantity
          : 0),
      realizedPnl: realizedPnlRef.current,
      position,
      markPrice: feed.latestPrice,
    });
  }, [bot.id, bot.strategy, feed.latestPrice, managedPosition, onPnlUpdate]);

  useEffect(() => {
    if (bot.status !== "running") return;
    if (!accountState?.accountId) return;
    if (!feed.latestPrice || feed.candles.length < 22) return;

    const now = Date.now();
    if (now - lastEvalRef.current < 20_000) return;
    lastEvalRef.current = now;

    const price = feed.latestPrice;
    const candles = feed.candles;
    const lastClosed = getLastClosedTrendCandleIndex(candles);
    if (lastClosed < 21) return;
    const investment = bot.investment;

    if (!symbolRules) return;

    const availableBudget = Math.min(investment, freeCollateral || 0);
    const currentPosition = positionRef.current;
    const dcaRemainingBudget =
      bot.strategy === "dca"
        ? Math.max(
            0,
            investment -
              (currentPosition
                ? currentPosition.entryPrice *
                  currentPosition.quantity *
                  (1 + BOT_TAKER_FEE_RATE)
                : 0),
          )
        : availableBudget;
    const strategyBudget = Math.min(availableBudget, dcaRemainingBudget);
    const orderBudget = strategyBudget / (1 + BOT_TAKER_FEE_RATE);
    const minimumOrderNotional = Math.max(
      symbolRules.min_notional,
      symbolRules.base_min * price,
    );
    const requestedBuyNotional =
      bot.strategy === "dca"
        ? Math.min(
            Number(bot.params.amount) || investment * 0.5,
            orderBudget,
          )
        : Math.min(investment * 0.5, orderBudget);
    const buyNotional = Math.min(
      orderBudget,
      Math.max(minimumOrderNotional, requestedBuyNotional),
    );

    const queueOrder = (
      order: PendingOrder,
      maxOrderBudget = bot.strategy === "dca" ? buyNotional : availableBudget,
    ) => {
      if (order.side === "BUY") {
        const quantity = getOrderQuantity(
          Number(order.qty) * order.triggerPrice,
          order.triggerPrice,
          symbolRules,
        );
        if (quantity === null) return;
        const orderNotional = quantity * order.triggerPrice;
        const orderCost = orderNotional * (1 + BOT_TAKER_FEE_RATE);
        if (
          !Number.isFinite(freeCollateral) ||
          freeCollateral <= 0 ||
          orderCost > freeCollateral ||
          orderCost > maxOrderBudget
        ) {
          if (!balanceAlertedRef.current) {
            balanceAlertedRef.current = true;
            onInsufficientBalance(
              `Orderly requires at least $${orderNotional.toFixed(2)} for this ${symbolDisplay(
                bot.symbol,
              )} order, but your available balance or bot allocation is too low.`,
            );
          }
          return;
        }
        balanceAlertedRef.current = false;
        order.qty = quantity.toFixed(symbolRules.base_dp);
        if (order.position) order.position.qty = quantity;
      }
      setPendingOrder(order);
    };

    let shouldBuy = false;
    let shouldSell = false;

    if (bot.strategy === "signal") {
      const rsiPeriod = Number(bot.params.rsi) || 14;
      const decision = getSignalDecision(
        candles,
        lastClosed,
        {
          rsiPeriod,
          rsiOversold: Number(bot.params.rsiOversold) || 35,
          rsiOverbought: Number(bot.params.rsiOverbought) || 68,
          emaFast: Number(bot.params.emaFast) || 9,
          emaSlow: Number(bot.params.ema) || 21,
        },
        !!positionRef.current,
      );
      shouldBuy = decision.buy;
      shouldSell = decision.sell;
    } else if (bot.strategy === "grid") {
      const grids = Number(bot.params.grids) || 10;
      const decision = getGridDecision(
        candles,
        lastClosed,
        grids,
        !!positionRef.current,
        getConfiguredGridBound(bot.params.lower),
        getConfiguredGridBound(bot.params.upper),
      );
      shouldBuy = decision.buy;
      shouldSell = decision.sell;
    } else if (bot.strategy === "dca") {
      shouldBuy =
        strategyBudget >= minimumOrderNotional &&
        Date.now() - lastDcaBuyRef.current >=
          getDcaIntervalMs(bot.params.interval);
      shouldSell =
        !!positionRef.current && price > positionRef.current.entryPrice * 1.05;
    } else if (bot.strategy === "trend") {
      const last = getLastClosedTrendCandleIndex(candles);
      if (last < 21) return;
      const emaFast = computeEMA(candles, 9);
      const emaSlow = computeEMA(candles, 21);
      const rsi = computeRSI(candles, 14);
      const atr = computeATR(candles, 14);
      const stopAtr = normalizeTrendParameter(bot.params.stopAtr, 2);
      const rewardRisk = normalizeTrendParameter(bot.params.rewardRisk, 2.5);
      const position = managedPosition;

      shouldBuy =
        !position &&
        isTrendPullbackEntry(candles, emaFast, emaSlow, rsi, atr, last);
      shouldSell =
        !!position &&
        (price <= position.stopPrice ||
          price >= position.targetPrice ||
          emaFast[last] < emaSlow[last]);

      if (!pendingOrder && shouldBuy) {
        const stopDistance = atr[last] * stopAtr;
        const riskBudget = investment * 0.01;
        const maxNotional = availableBudget * 0.25;
        const qty =
          Math.floor(
            Math.min(
              riskBudget / stopDistance,
              maxNotional / (price * (1 + BOT_TAKER_FEE_RATE)),
            ) * 1_000_000,
          ) / 1_000_000;
        if (qty > 0) {
          queueOrder(
            {
              botId: bot.id,
              symbol: bot.symbol,
              side: "BUY",
              qty: qty.toFixed(6),
              triggerPrice: price,
              position: {
                qty,
                entryPrice: price,
                stopPrice: price - stopDistance,
                targetPrice: price + stopDistance * rewardRisk,
              },
            },
            availableBudget * 0.25,
          );
        }
      } else if (!pendingOrder && shouldSell && position) {
        queueOrder({
          botId: bot.id,
          symbol: bot.symbol,
          side: "SELL",
          qty: position.qty.toFixed(6),
          triggerPrice: price,
        });
      }
      return;
    }

    if (shouldBuy && !pendingOrder) {
      queueOrder({
        botId: bot.id,
        symbol: bot.symbol,
        side: "BUY",
        qty: (buyNotional / price).toFixed(symbolRules.base_dp),
        triggerPrice: price,
      });
    } else if (shouldSell && !pendingOrder && positionRef.current) {
      const position = positionRef.current;
      queueOrder({
        botId: bot.id,
        symbol: bot.symbol,
        side: "SELL",
        qty: position.quantity.toFixed(6),
        triggerPrice: price,
      });
    }
  }, [
    feed.latestPrice,
    feed.candles,
    bot,
    accountState,
    freeCollateral,
    symbolRules,
    managedPosition,
    pendingOrder,
    onInsufficientBalance,
  ]);

  if (pendingOrder) {
    return (
      <OrderSubmitter
        pending={pendingOrder}
        onInsufficientBalance={onInsufficientBalance}
        onDone={(result) => {
          if (result.success) {
            const quantity = parseFloat(pendingOrder.qty);
            if (pendingOrder.side === "BUY") {
              const previous = positionRef.current;
              positionRef.current = {
                entryPrice:
                  bot.strategy === "dca" && previous
                    ? (previous.entryPrice * previous.quantity +
                        pendingOrder.triggerPrice * quantity) /
                      (previous.quantity + quantity)
                    : pendingOrder.triggerPrice,
                quantity:
                  bot.strategy === "dca" && previous
                    ? previous.quantity + quantity
                    : quantity,
              };
              realizedPnlRef.current -=
                pendingOrder.triggerPrice * quantity * BOT_TAKER_FEE_RATE;
              if (bot.strategy === "dca") {
                lastDcaBuyRef.current = Date.now();
              }
              if (bot.strategy === "trend") {
                const nextPosition = pendingOrder.position ?? null;
                setManagedPosition(nextPosition);
                if (nextPosition) {
                  localStorage.setItem(
                    `frostdex_bot_position_${bot.id}`,
                    JSON.stringify(nextPosition),
                  );
                }
              }
            } else if (positionRef.current) {
              const position = positionRef.current;
              const closedQty = Math.min(position.quantity, quantity);
              realizedPnlRef.current +=
                (pendingOrder.triggerPrice - position.entryPrice) * closedQty -
                pendingOrder.triggerPrice * closedQty * BOT_TAKER_FEE_RATE;
              const remainingQty: number = position.quantity - closedQty;
              positionRef.current =
                remainingQty > 0
                  ? { ...position, quantity: remainingQty }
                  : null;
              if (bot.strategy === "trend" && !positionRef.current) {
                setManagedPosition(null);
                localStorage.removeItem(`frostdex_bot_position_${bot.id}`);
              }
            }

            const position = positionRef.current;
            onPnlUpdate(bot.id, {
              pnl:
                realizedPnlRef.current +
                (position
                  ? (pendingOrder.triggerPrice - position.entryPrice) *
                    position.quantity
                  : 0),
              realizedPnl: realizedPnlRef.current,
              position,
              markPrice: pendingOrder.triggerPrice,
            });
            onTradeExecuted({
              botId: bot.id,
              side: pendingOrder.side,
              symbol: bot.symbol,
              qty: quantity,
              price: pendingOrder.triggerPrice,
              ts: Date.now(),
              live: true,
              orderId: result.orderId,
            });
          }
          setPendingOrder(null);
        }}
      />
    );
  }

  return null;
}

function BotPaperEngine({
  bot,
  onPaperUpdate,
}: {
  bot: BotConfig;
  onPaperUpdate: (
    botId: string,
    update: PaperBotUpdate,
    trade?: Omit<TradeLog, "id">,
  ) => void;
}) {
  const feed = useOrderlyFeed(bot.symbol);

  useEffect(() => {
    if (bot.status !== "running" || feed.loading) return;
    if (feed.error || !feed.latestPrice || feed.candles.length < 22) {
      if (bot.marketDataStatus !== "unavailable") {
        onPaperUpdate(bot.id, { marketDataStatus: "unavailable" });
      }
      return;
    }

    const price = feed.latestPrice;
    const candles = feed.candles;
    const last = getLastClosedTrendCandleIndex(candles);
    if (last < 21) {
      onPaperUpdate(bot.id, { marketDataStatus: "ready" });
      return;
    }
    const candleTime = candles[last].t;
    const closedCandle = candles[last];
    const newClosedCandle = candleTime !== bot.paperLastCandle;
    let position = bot.paperPosition ?? null;
    let realizedPnl = bot.paperRealizedPnl ?? 0;
    let trade: Omit<TradeLog, "id"> | undefined;

    if (position) {
      let exitPrice: number | null = null;
      if (
        price <= position.stopPrice ||
        (newClosedCandle && closedCandle.l <= position.stopPrice)
      ) {
        exitPrice = position.stopPrice;
      } else if (
        price >= position.targetPrice ||
        (newClosedCandle && closedCandle.h >= position.targetPrice)
      ) {
        exitPrice = position.targetPrice;
      } else if (
        newClosedCandle &&
        computeEMA(candles, 9)[last] < computeEMA(candles, 21)[last]
      ) {
        exitPrice = price;
      }

      if (exitPrice !== null) {
        realizedPnl +=
          position.qty * (exitPrice - position.entryPrice) -
          position.qty * exitPrice * BOT_TAKER_FEE_RATE;
        trade = {
          botId: bot.id,
          side: "SELL",
          symbol: bot.symbol,
          qty: position.qty,
          price: exitPrice,
          ts: Date.now(),
          live: false,
        };
        position = null;
      }
    } else if (newClosedCandle) {
      const emaFast = computeEMA(candles, 9);
      const emaSlow = computeEMA(candles, 21);
      const rsi = computeRSI(candles, 14);
      const atr = computeATR(candles, 14);
      const shouldBuy = isTrendPullbackEntry(
        candles,
        emaFast,
        emaSlow,
        rsi,
        atr,
        last,
      );

      if (shouldBuy) {
        const stopDistance =
          atr[last] * normalizeTrendParameter(bot.params.stopAtr, 2);
        const riskBudget = bot.investment * 0.01;
        const maxNotional = bot.investment * 0.25;
        const entryPrice = closedCandle.c;
        const qty =
          Math.floor(
            Math.min(riskBudget / stopDistance, maxNotional / entryPrice) *
              1_000_000,
          ) / 1_000_000;

        if (qty >= 0.001) {
          position = {
            qty,
            entryPrice,
            stopPrice: entryPrice - stopDistance,
            targetPrice:
              entryPrice +
              stopDistance *
                normalizeTrendParameter(bot.params.rewardRisk, 2.5),
          };
          realizedPnl -= entryPrice * qty * BOT_TAKER_FEE_RATE;
          trade = {
            botId: bot.id,
            side: "BUY",
            symbol: bot.symbol,
            qty,
            price: entryPrice,
            ts: Date.now(),
            live: false,
          };
        }
      }
    }

    const pnl =
      realizedPnl +
      (position ? position.qty * (price - position.entryPrice) : 0);
    onPaperUpdate(
      bot.id,
      {
        paperPosition: position,
        paperRealizedPnl: realizedPnl,
        paperLastCandle: candleTime,
        marketDataStatus: "ready",
        pnl,
        pnlPct: (pnl / bot.investment) * 100,
      },
      trade,
    );
  }, [
    bot.id,
    bot.status,
    bot.investment,
    bot.symbol,
    bot.params.stopAtr,
    bot.params.rewardRisk,
    bot.paperPosition,
    bot.paperRealizedPnl,
    bot.paperLastCandle,
    bot.marketDataStatus,
    feed.loading,
    feed.error,
    feed.latestPrice,
    feed.candles,
    onPaperUpdate,
  ]);

  return null;
}

function BotSimulationEngine({
  bot,
  onTradeExecuted,
  onPnlUpdate,
}: {
  bot: BotConfig;
  onTradeExecuted: (log: Omit<TradeLog, "id">) => void;
  onPnlUpdate: (botId: string, performance: BotPerformance) => void;
}) {
  const feed = useOrderlyFeed(bot.symbol);
  const positionRef = useRef<BotPosition | null>(bot.position ?? null);
  const realizedPnlRef = useRef(bot.realizedPnl ?? 0);
  const lastEvaluationRef = useRef<{
    price: number;
    candleTime: number;
  } | null>(null);
  const lastDcaBuyRef = useRef(bot.dcaLastBuyAt ?? bot.createdAt);

  useEffect(() => {
    if (bot.status !== "running" || feed.loading || !feed.latestPrice) return;

    const candles = feed.candles;
    const lastClosed = getLastClosedTrendCandleIndex(candles);
    if (lastClosed < 21) return;
    const candleTime = candles[lastClosed].t;
    const price = candles[lastClosed].c;
    const lastEvaluation = lastEvaluationRef.current;
    if (
      lastEvaluation?.price === price &&
      lastEvaluation.candleTime === candleTime
    ) {
      return;
    }
    lastEvaluationRef.current = { price, candleTime };

    const position = positionRef.current;
    let shouldBuy = false;
    let shouldSell = false;
    let buyNotional = Math.min(bot.investment * 0.5, bot.investment);

    if (bot.strategy === "signal") {
      const rsiPeriod = Number(bot.params.rsi) || 14;
      const decision = getSignalDecision(
        candles,
        lastClosed,
        {
          rsiPeriod,
          rsiOversold: Number(bot.params.rsiOversold) || 35,
          rsiOverbought: Number(bot.params.rsiOverbought) || 68,
          emaFast: Number(bot.params.emaFast) || 9,
          emaSlow: Number(bot.params.ema) || 21,
        },
        !!position,
      );
      shouldBuy = decision.buy;
      shouldSell = decision.sell;
    } else if (bot.strategy === "grid") {
      const decision = getGridDecision(
        candles,
        lastClosed,
        Math.max(1, Number(bot.params.grids) || 10),
        !!position,
        getConfiguredGridBound(bot.params.lower),
        getConfiguredGridBound(bot.params.upper),
      );
      shouldBuy = decision.buy;
      shouldSell = decision.sell;
    } else if (bot.strategy === "dca") {
      const committedNotional = position
        ? position.entryPrice *
          position.quantity *
          (1 + BOT_TAKER_FEE_RATE)
        : 0;
      buyNotional = Math.min(
        Number(bot.params.amount) || bot.investment * 0.5,
        Math.max(0, bot.investment - committedNotional),
      );
      shouldBuy =
        buyNotional > 0 &&
        Date.now() - lastDcaBuyRef.current >=
          getDcaIntervalMs(bot.params.interval);
      shouldSell = !!position && price > position.entryPrice * 1.05;
    } else {
      return;
    }

    let nextPosition = position;
    if (shouldBuy && buyNotional > 0) {
      const quantity = buyNotional / price;
      nextPosition =
        bot.strategy === "dca" && position
          ? {
              entryPrice:
                (position.entryPrice * position.quantity + price * quantity) /
                (position.quantity + quantity),
              quantity: position.quantity + quantity,
            }
          : { entryPrice: price, quantity };
      positionRef.current = nextPosition;
      realizedPnlRef.current -= buyNotional * BOT_TAKER_FEE_RATE;
      if (bot.strategy === "dca") lastDcaBuyRef.current = Date.now();
      onTradeExecuted({
        botId: bot.id,
        side: "BUY",
        symbol: bot.symbol,
        qty: quantity,
        price,
        ts: Date.now(),
        live: false,
      });
    } else if (shouldSell && position) {
      realizedPnlRef.current +=
        (price - position.entryPrice) * position.quantity -
        price * position.quantity * BOT_TAKER_FEE_RATE;
      nextPosition = null;
      positionRef.current = null;
      onTradeExecuted({
        botId: bot.id,
        side: "SELL",
        symbol: bot.symbol,
        qty: position.quantity,
        price,
        ts: Date.now(),
        live: false,
      });
    }

    onPnlUpdate(bot.id, {
      pnl:
        realizedPnlRef.current +
        (nextPosition
          ? (price - nextPosition.entryPrice) * nextPosition.quantity
          : 0),
      realizedPnl: realizedPnlRef.current,
      position: nextPosition,
      markPrice: price,
    });
  }, [
    bot,
    feed.candles,
    feed.latestPrice,
    feed.loading,
    onPnlUpdate,
    onTradeExecuted,
  ]);

  return null;
}

// ── Main Bot Page ─────────────────────────────────────────────────────────────
export default function BotPage() {
  const { state: accountState } = useAccount();
  const { freeCollateral } = useCollateral();
  const navigate = useNavigate();
  const [balanceMessage, setBalanceMessage] = useState("");

  const [bots, setBots] = useState<BotConfig[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  });
  const [logs, setLogs] = useState<TradeLog[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(LOGS_KEY) || "[]");
    } catch {
      return [];
    }
  });
  const [tab, setTab] = useState<"bots" | "create" | "logs" | "backtest">(
    "bots",
  );
  const [allSymbols, setAllSymbols] = useState<string[]>(POPULAR_SYMBOLS);
  const [strategy, setStrategy] = useState<BotStrategy>("grid");
  const [symbol, setSymbol] = useState("PERP_BTC_USDC");
  const selectedSymbolInfo = useSymbolInfo(symbol);
  const selectedSymbolRules = selectedSymbolInfo?.();
  const { data: selectedMarkPrice } = useMarkPrice(symbol);
  const minimumOrderNotional = Math.max(
    Number(selectedSymbolRules?.min_notional ?? 0),
    Number(selectedSymbolRules?.base_min ?? 0) *
      Number(selectedMarkPrice ?? 0),
  );
  const symbolsInfo = useSymbolsInfo();
  const [investment, setInvestment] = useState("500");
  const [botName, setBotName] = useState("");
  const [liveMode, setLiveMode] = useState(false);
  const [creating, setCreating] = useState(false);

  const [gridUpper, setGridUpper] = useState("");
  const [gridLower, setGridLower] = useState("");
  const [gridCount, setGridCount] = useState("10");
  const [dcaInterval, setDcaInterval] = useState("1h");
  const [dcaAmount, setDcaAmount] = useState("50");
  const [sigRsi, setSigRsi] = useState("14");
  const [sigEma, setSigEma] = useState("21");
  const [trendStopAtr, setTrendStopAtr] = useState("2");
  const [trendRewardRisk, setTrendRewardRisk] = useState("2.5");

  const isConnected = !!accountState?.accountId;
  const availableBalance = Number.isFinite(freeCollateral) ? freeCollateral : 0;
  const quoteAsset =
    selectedSymbolInfo?.("quote") ??
    symbol.match(/_(USDC|USDT)(?:_|$)/)?.[1] ??
    "USD";

  const handleInsufficientBalance = useCallback((message?: string) => {
    setBalanceMessage(
      message ??
        "Your available Orderly collateral is too low for this live order. Deposit supported collateral to continue.",
    );
  }, []);

  const saveBots = useCallback((updated: BotConfig[]) => {
    setBots(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, []);

  // Fetch all available Orderly perp markets
  useEffect(() => {
    fetch("https://api.orderly.org/v1/public/futures")
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `Unable to load Orderly markets (${response.status})`,
          );
        }
        return response.json();
      })
      .then((data) => {
        const syms: string[] = (data?.data?.rows ?? [])
          .map((market: { symbol?: string }) => market.symbol)
          .filter(
            (marketSymbol: string | undefined): marketSymbol is string =>
              !!marketSymbol &&
              /^PERP_.+_(USDC|USDT)(?:_|$)/.test(marketSymbol),
          );
        if (syms.length > 0) {
          setAllSymbols((current) => sortMarketSymbols([...current, ...syms]));
        }
      })
      .catch((error: unknown) => {
        console.error("Failed to load Orderly USDC/USDT markets:", error);
      });
  }, []);

  useEffect(() => {
    const supportedSymbols = Object.keys(symbolsInfo).filter((marketSymbol) =>
      /^PERP_.+_(USDC|USDT)(?:_|$)/.test(marketSymbol),
    );

    if (supportedSymbols.length > 0) {
      setAllSymbols((current) => {
        const mergedSymbols = sortMarketSymbols([
          ...current,
          ...supportedSymbols,
        ]);
        return current.join(",") === mergedSymbols.join(",")
          ? current
          : mergedSymbols;
      });
    }
  }, [symbolsInfo]);

  const handleTradeExecuted = useCallback((log: Omit<TradeLog, "id">) => {
    const entry: TradeLog = { ...log, id: generateId() };
    setLogs((prev) => {
      const updated = [entry, ...prev.slice(0, 199)];
      localStorage.setItem(LOGS_KEY, JSON.stringify(updated));
      return updated;
    });
    setBots((prev) => {
      const updated = prev.map((b) =>
        b.id === log.botId
          ? {
              ...b,
              trades: b.trades + 1,
              ...(b.strategy === "dca" && log.side === "BUY"
                ? { dcaLastBuyAt: log.ts }
                : {}),
            }
          : b,
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const handlePnlUpdate = useCallback(
    (botId: string, performance: BotPerformance) => {
      setBots((prev) => {
        let changed = false;
        const updated = prev.map((bot) => {
          if (bot.id !== botId) return bot;
          if (
            Math.round(bot.pnl * 100) === Math.round(performance.pnl * 100) &&
            bot.realizedPnl === performance.realizedPnl &&
            bot.position?.entryPrice === performance.position?.entryPrice &&
            bot.position?.quantity === performance.position?.quantity
          ) {
            return bot;
          }
          changed = true;
          return {
            ...bot,
            pnl: performance.pnl,
            pnlPct: (performance.pnl / bot.investment) * 100,
            realizedPnl: performance.realizedPnl,
            position: performance.position,
            markPrice: performance.markPrice,
          };
        });
        if (!changed) return prev;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
    },
    [],
  );

  const handleMarketDataStatus = useCallback(
    (botId: string, status: "ready" | "unavailable") => {
      setBots((prev) => {
        let changed = false;
        const updated = prev.map((bot) => {
          if (bot.id !== botId || bot.marketDataStatus === status) return bot;
          changed = true;
          return { ...bot, marketDataStatus: status };
        });
        if (!changed) return prev;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
    },
    [],
  );

  const handlePaperUpdate = useCallback(
    (botId: string, update: PaperBotUpdate, trade?: Omit<TradeLog, "id">) => {
      if (trade) {
        setLogs((prev) => {
          const updated = [
            { ...trade, id: generateId() },
            ...prev.slice(0, 199),
          ];
          localStorage.setItem(LOGS_KEY, JSON.stringify(updated));
          return updated;
        });
      }
      setBots((prev) => {
        const updated = prev.map((current) =>
          current.id === botId
            ? {
                ...current,
                ...update,
                trades: current.trades + (trade ? 1 : 0),
              }
            : current,
        );
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
    },
    [],
  );

  const configureLiveBot = (bot: BotConfig) => {
    setStrategy(bot.strategy);
    setSymbol(bot.symbol);
    setInvestment(String(bot.investment));
    setBotName(bot.name);
    setGridUpper(
      bot.params.upper === "auto" ? "" : String(bot.params.upper ?? ""),
    );
    setGridLower(
      bot.params.lower === "auto" ? "" : String(bot.params.lower ?? ""),
    );
    setGridCount(String(bot.params.grids ?? 10));
    setDcaInterval(String(bot.params.interval ?? "1h"));
    setDcaAmount(String(bot.params.amount ?? 50));
    setSigRsi(String(bot.params.rsi ?? 14));
    setSigEma(String(bot.params.ema ?? 21));
    setTrendStopAtr(String(normalizeTrendParameter(bot.params.stopAtr, 2)));
    setTrendRewardRisk(
      String(normalizeTrendParameter(bot.params.rewardRisk, 2.5)),
    );
    setLiveMode(true);
    setTab("create");
  };

  const handleCreate = () => {
    const lowerGrid = Number(gridLower);
    const upperGrid = Number(gridUpper);
    if (
      strategy === "grid" &&
      ((gridLower.trim() === "") !== (gridUpper.trim() === "") ||
        (gridLower.trim() !== "" &&
          (!Number.isFinite(lowerGrid) ||
            !Number.isFinite(upperGrid) ||
            lowerGrid >= upperGrid)))
    ) {
      setBalanceMessage(
        "Enter both grid bounds and make sure the lower price is below the upper price, or leave both set to Auto.",
      );
      return;
    }

    if (!Number.isFinite(Number(investment)) || Number(investment) <= 0) {
      setBalanceMessage("Investment must be a positive amount.");
      return;
    }
    if (
      strategy === "dca" &&
      (!Number.isFinite(Number(dcaAmount)) || Number(dcaAmount) <= 0)
    ) {
      setBalanceMessage("DCA amount per buy must be a positive amount.");
      return;
    }

    if (
      liveMode &&
      isConnected &&
      (availableBalance <= 0 || Number(investment) > availableBalance)
    ) {
      setBalanceMessage(
        availableBalance <= 0
          ? "Your Orderly account has no available collateral. Deposit supported collateral before starting a live bot."
          : "Your investment is greater than your available collateral. Lower the investment or deposit more collateral.",
      );
      return;
    }

    setBalanceMessage("");
    setCreating(true);
    const willUseLive = liveMode && isConnected;
    setTimeout(() => {
      const params: Record<string, string | number> =
        strategy === "grid"
          ? {
              upper: gridUpper || "auto",
              lower: gridLower || "auto",
              grids: Number(gridCount),
            }
          : strategy === "dca"
            ? { interval: dcaInterval, amount: Number(dcaAmount) }
            : strategy === "signal"
              ? { rsi: Number(sigRsi), ema: Number(sigEma) }
              : {
                  stopAtr: normalizeTrendParameter(trendStopAtr, 2),
                  rewardRisk: normalizeTrendParameter(trendRewardRisk, 2.5),
                };

      const newBot: BotConfig = {
        id: generateId(),
        name:
          botName ||
          `${STRATEGY_INFO[strategy].label} #${generateId().slice(0, 4)}`,
        strategy,
        symbol,
        investment: Number(investment),
        status: "running",
        pnl: 0,
        pnlPct: 0,
        trades: 0,
        createdAt: Date.now(),
        params,
        liveMode: willUseLive,
        realizedPnl: 0,
        position: null,
        markPrice: 0,
      };
      saveBots([newBot, ...bots]);
      setCreating(false);
      setBotName("");
      setInvestment("500");
      setTab("bots");
    }, 1200);
  };

  const toggleBot = (id: string) => {
    saveBots(
      bots.map((b) =>
        b.id === id
          ? {
              ...b,
              status: b.status === "running" ? "stopped" : "running",
            }
          : b,
      ),
    );
  };

  const deleteBot = (id: string) => {
    saveBots(bots.filter((b) => b.id !== id));
  };

  const totalInvestment = bots.reduce((s, b) => s + b.investment, 0);
  const totalPnl = bots.reduce((s, b) => s + b.pnl, 0);
  const runningCount = bots.filter((b) => b.status === "running").length;
  const liveCount = bots.filter(
    (b) => b.status === "running" && b.liveMode,
  ).length;

  const investmentNum = Number(investment);
  const balanceWarning =
    isConnected && investmentNum > 0 && investmentNum > availableBalance;

  const stats: {
    label: string;
    value: string | number;
    color: string;
    prefix?: string;
    suffix?: string;
  }[] = [
    {
      label: "Active Bots",
      value: runningCount,
      suffix: "",
      color: "#0ecb81",
    },
    {
      label: "Live Bots",
      value: liveCount,
      suffix: "",
      color: "#38e0f8",
    },
    {
      label: "Total Invested",
      value: totalInvestment.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      prefix: "$",
      color: "#eaecef",
    },
    {
      label: "Total P&L",
      value: (totalPnl >= 0 ? "+" : "") + totalPnl.toFixed(2),
      prefix: "$",
      color: totalPnl >= 0 ? "#0ecb81" : "#f6465d",
    },
    {
      label: "Free Collateral",
      value: isConnected
        ? availableBalance.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : "—",
      prefix: isConnected ? "$" : "",
      color: "#eaecef",
    },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "rgb(11, 14, 17)",
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
      {/* Live engines — one per running live bot */}
      {bots
        .filter((b) => b.status === "running" && b.liveMode && isConnected)
        .map((bot) => (
          <BotLiveEngine
            key={bot.id}
            bot={bot}
            tradeLogs={logs.filter((log) => log.botId === bot.id)}
            onTradeExecuted={handleTradeExecuted}
            onPnlUpdate={handlePnlUpdate}
            onMarketDataStatus={handleMarketDataStatus}
            onInsufficientBalance={handleInsufficientBalance}
          />
        ))}
      {bots
        .filter(
          (b) =>
            b.status === "running" && !b.liveMode && b.strategy === "trend",
        )
        .map((bot) => (
          <BotPaperEngine
            key={bot.id}
            bot={bot}
            onPaperUpdate={handlePaperUpdate}
          />
        ))}
      {bots
        .filter(
          (b) =>
            b.status === "running" && !b.liveMode && b.strategy !== "trend",
        )
        .map((bot) => (
          <BotSimulationEngine
            key={bot.id}
            bot={bot}
            onTradeExecuted={handleTradeExecuted}
            onPnlUpdate={handlePnlUpdate}
          />
        ))}

      {/* Hero Header with FrostDex background */}
      <div
        className="bot-hero"
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: "0 0 20px 20px",
          marginBottom: 24,
          minHeight: 180,
          display: "flex",
          alignItems: "center",
        }}
      >
        {/* Background image */}
        <div
          className="bot-hero-overlay"
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "url(/bot-bg.webp)",
            backgroundSize: "cover",
            backgroundPosition: "center 30%",
            backgroundRepeat: "no-repeat",
            opacity: 0.18,
            filter: "blur(1px)",
          }}
        />
        {/* Dark gradient overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(135deg, rgba(11,14,17,0.85) 0%, rgba(11,14,17,0.6) 50%, rgba(11,14,17,0.85) 100%)",
          }}
        />
        {/* Cyan glow bottom */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 2,
            background:
              "linear-gradient(90deg, transparent 0%, rgba(56,224,248,0.5) 50%, transparent 100%)",
          }}
        />

        {/* Content */}
        <div
          style={{ position: "relative", zIndex: 1, padding: "28px 24px 24px" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 8,
            }}
          >
            <span style={{ fontSize: 32 }}>🤖</span>
            <h1
              className="bot-hero-title"
              style={{
                fontSize: 26,
                fontWeight: 800,
                fontFamily: "Manrope, sans-serif",
                background: "linear-gradient(135deg, #38e0f8 0%, #0ecb81 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                margin: 0,
              }}
            >
              AI Trading Bot
            </h1>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1.5px solid rgba(46,204,113,0.55)",
                borderRadius: 8,
                padding: "2px 8px",
                background: "rgba(56,224,248,0.05)",
                boxShadow:
                  "0 0 14px rgba(56,224,248,0.22), 0 0 6px rgba(14,203,129,0.18)",
              }}
            >
              <img
                src="/frostdex-badge.webp"
                alt="FrostDex"
                style={{ height: 28, objectFit: "contain", display: "block" }}
              />
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <p
              style={{
                color: "rgba(180,190,210,0.65)",
                fontSize: 13,
                margin: 0,
              }}
            >
              Automated trading strategies —
            </p>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#38e0f8",
                letterSpacing: 0.5,
                fontFamily: "Manrope, sans-serif",
                textShadow: "0 0 12px rgba(56,224,248,0.6)",
              }}
            >
              ❄ Powered by FrostDex
            </span>
            {liveCount > 0 && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#0ecb81",
                  background: "rgba(14,203,129,0.1)",
                  border: "1px solid rgba(14,203,129,0.25)",
                  borderRadius: 4,
                  padding: "2px 8px",
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#0ecb81",
                    boxShadow: "0 0 6px #0ecb81",
                    animation: "dot-pulse 1.5s ease infinite",
                    display: "inline-block",
                  }}
                />
                {liveCount} bot{liveCount > 1 ? "s" : ""} trading live
              </span>
            )}
          </div>
        </div>
      </div>

      {balanceMessage && (
        <div
          role="alert"
          style={{
            margin: "0 16px 20px",
            padding: "12px 16px",
            border: "1px solid rgba(246,70,93,0.3)",
            borderRadius: 8,
            background: "rgba(246,70,93,0.08)",
            color: "#f6a0a9",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            fontSize: 13,
          }}
        >
          <span>{balanceMessage}</span>
          <span
            style={{ display: "inline-flex", alignItems: "center", gap: 12 }}
          >
            <button
              onClick={() => {
                setBalanceMessage("");
                navigate("/portfolio/assets");
              }}
              style={{
                border: 0,
                padding: 0,
                background: "none",
                color: "#38e0f8",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Deposit collateral
            </button>
            <button
              onClick={() => setBalanceMessage("")}
              aria-label="Dismiss balance warning"
              style={{
                border: 0,
                padding: 0,
                background: "none",
                color: "rgba(180,190,210,0.7)",
                cursor: "pointer",
              }}
            >
              Dismiss
            </button>
          </span>
        </div>
      )}

      {/* Stats Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
          marginBottom: 24,
          padding: "0 16px",
        }}
      >
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bot-card"
            style={{ padding: "16px 20px" }}
          >
            <div
              style={{
                fontSize: 11,
                color: "rgba(180,190,210,0.5)",
                fontWeight: 600,
                letterSpacing: 0.5,
                marginBottom: 6,
              }}
            >
              {stat.label}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: stat.color }}>
              {stat.prefix ?? ""}
              {stat.value}
              {stat.suffix ?? ""}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 20,
          borderBottom: "1px solid rgba(30,36,50,1)",
          paddingBottom: 0,
          overflowX: "auto",
          padding: "0 16px",
        }}
      >
        {(["bots", "create", "backtest", "logs"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "10px 18px",
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "Manrope, sans-serif",
              color: tab === t ? "#38e0f8" : "rgba(180,190,210,0.5)",
              borderBottom:
                tab === t ? "2px solid #38e0f8" : "2px solid transparent",
              marginBottom: -1,
              whiteSpace: "nowrap",
              transition: "color 0.15s ease",
            }}
          >
            {t === "bots"
              ? `My Bots (${bots.length})`
              : t === "create"
                ? "+ Create Bot"
                : t === "backtest"
                  ? "📊 Backtest"
                  : `Trade History (${logs.length})`}
          </button>
        ))}
      </div>

      {/* ── Tab: My Bots ──────────────────────────────────────────────── */}
      {tab === "bots" && (
        <div style={{ padding: "0 16px" }}>
          {bots.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 16,
                padding: "64px 24px",
                color: "rgba(180,190,210,0.4)",
                textAlign: "center",
              }}
            >
              <span style={{ fontSize: 48 }}>🤖</span>
              <div style={{ fontSize: 16, fontWeight: 600 }}>No bots yet</div>
              <div style={{ fontSize: 13 }}>
                Create your first automated trading bot
              </div>
              <button
                className="bot-launch-button"
                onClick={() => setTab("create")}
                style={{
                  borderRadius: 8,
                  padding: "10px 24px",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                  fontFamily: "Manrope, sans-serif",
                }}
              >
                Create Bot
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {bots.map((bot) => {
                const info = STRATEGY_INFO[bot.strategy];
                const isRunning = bot.status === "running";
                const isLive = bot.liveMode;
                const botLogs = logs.filter((l) => l.botId === bot.id);
                return (
                  <div key={bot.id} className="bot-card">
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 10,
                            background: `rgba(${
                              info.color === "#38e0f8"
                                ? "56,224,248"
                                : info.color === "#0ecb81"
                                  ? "14,203,129"
                                  : info.color === "#ff8a65"
                                    ? "255,138,101"
                                    : "240,185,11"
                            },0.12)`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 18,
                            flexShrink: 0,
                          }}
                        >
                          {info.icon}
                        </div>
                        <div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            <span
                              style={{
                                fontWeight: 700,
                                fontSize: 15,
                                color: "#eaecef",
                              }}
                            >
                              {bot.name}
                            </span>
                            <span
                              className={`bot-status-dot ${
                                isRunning ? "running" : "stopped"
                              }`}
                            />
                            <span
                              style={{
                                fontSize: 11,
                                color: isRunning
                                  ? "#0ecb81"
                                  : "rgba(180,190,210,0.4)",
                                fontWeight: 600,
                              }}
                            >
                              {isRunning ? "RUNNING" : "STOPPED"}
                            </span>
                            {isLive && (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: "1px 7px",
                                  borderRadius: 4,
                                  background: "rgba(14,203,129,0.12)",
                                  color: "#0ecb81",
                                  border: "1px solid rgba(14,203,129,0.25)",
                                  letterSpacing: 0.5,
                                }}
                              >
                                ● LIVE
                              </span>
                            )}
                            {!isLive && (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 600,
                                  padding: "1px 7px",
                                  borderRadius: 4,
                                  background: "rgba(180,190,210,0.06)",
                                  color: "rgba(180,190,210,0.4)",
                                  letterSpacing: 0.5,
                                }}
                              >
                                SIMULATION
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: "rgba(180,190,210,0.5)",
                              marginTop: 2,
                            }}
                          >
                            {info.label} · {symbolDisplay(bot.symbol)} · $
                            {bot.investment.toLocaleString()} · {botLogs.length}{" "}
                            trades
                          </div>
                          {isRunning && !isLive && bot.strategy === "trend" && (
                            <div
                              style={{
                                fontSize: 11,
                                color:
                                  bot.marketDataStatus === "unavailable"
                                    ? "#f6465d"
                                    : "rgba(180,190,210,0.55)",
                                marginTop: 4,
                              }}
                            >
                              {bot.marketDataStatus === "unavailable"
                                ? "Market data unavailable — paper trading is paused."
                                : bot.marketDataStatus === "ready"
                                  ? bot.paperPosition
                                    ? `Paper position open · stop $${bot.paperPosition.stopPrice.toLocaleString()} · target $${bot.paperPosition.targetPrice.toLocaleString()}`
                                    : "Waiting for a confirmed 15m pullback setup. Keep this page open."
                                  : "Connecting to live market data..."}
                            </div>
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 16,
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ textAlign: "right" }}>
                          <div
                            title={
                              isLive
                                ? "Estimated PnL uses 0.05% fees per side and requested prices; actual fills and fees may differ."
                                : "Simulation PnL includes estimated 0.05% fees per side."
                            }
                            style={{
                              fontSize: 16,
                              fontWeight: 700,
                              color: bot.pnl >= 0 ? "#0ecb81" : "#f6465d",
                            }}
                          >
                            {bot.pnl >= 0 ? "+" : ""}${bot.pnl.toFixed(2)}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: bot.pnlPct >= 0 ? "#0ecb81" : "#f6465d",
                              fontWeight: 600,
                            }}
                          >
                            {bot.pnlPct >= 0 ? "+" : ""}
                            {bot.pnlPct.toFixed(2)}%
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 8 }}>
                          {!isLive && (
                            <button
                              onClick={() => configureLiveBot(bot)}
                              style={{
                                background: "rgba(56,224,248,0.08)",
                                border: "1px solid rgba(56,224,248,0.25)",
                                borderRadius: 6,
                                color: "#38e0f8",
                                cursor: "pointer",
                                fontSize: 12,
                                fontWeight: 600,
                                padding: "6px 10px",
                                fontFamily: "Manrope, sans-serif",
                              }}
                            >
                              Configure Live
                            </button>
                          )}
                          <button
                            onClick={() => toggleBot(bot.id)}
                            style={{
                              background: isRunning
                                ? "rgba(246,70,93,0.1)"
                                : "rgba(14,203,129,0.1)",
                              border: `1px solid ${
                                isRunning
                                  ? "rgba(246,70,93,0.25)"
                                  : "rgba(14,203,129,0.25)"
                              }`,
                              borderRadius: 6,
                              color: isRunning ? "#f6465d" : "#0ecb81",
                              cursor: "pointer",
                              fontSize: 12,
                              fontWeight: 600,
                              padding: "6px 12px",
                              fontFamily: "Manrope, sans-serif",
                            }}
                          >
                            {isRunning ? "Stop" : "Start"}
                          </button>
                          <button
                            onClick={() => deleteBot(bot.id)}
                            style={{
                              background: "none",
                              border: "1px solid rgba(30,36,50,1)",
                              borderRadius: 6,
                              color: "rgba(180,190,210,0.4)",
                              cursor: "pointer",
                              fontSize: 12,
                              padding: "6px 10px",
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Params */}
                    <div
                      style={{
                        display: "flex",
                        gap: 16,
                        marginTop: 14,
                        flexWrap: "wrap",
                      }}
                    >
                      {Object.entries(bot.params).map(([k, v]) => (
                        <div key={k} style={{ fontSize: 11 }}>
                          <span
                            style={{
                              color: "rgba(180,190,210,0.4)",
                              textTransform: "uppercase",
                              letterSpacing: 0.5,
                            }}
                          >
                            {k}:{" "}
                          </span>
                          <span style={{ color: "#eaecef", fontWeight: 600 }}>
                            {String(
                              bot.strategy === "trend" && k === "stopAtr"
                                ? normalizeTrendParameter(v, 2)
                                : bot.strategy === "trend" && k === "rewardRisk"
                                  ? normalizeTrendParameter(v, 2.5)
                                  : v,
                            )}
                          </span>
                        </div>
                      ))}
                      <div style={{ fontSize: 11 }}>
                        <span
                          style={{
                            color: "rgba(180,190,210,0.4)",
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                          }}
                        >
                          created:{" "}
                        </span>
                        <span style={{ color: "#eaecef", fontWeight: 600 }}>
                          {new Date(bot.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Create Bot ────────────────────────────────────────────── */}
      {tab === "create" && (
        <div style={{ maxWidth: 600 }}>
          {/* Strategy Picker */}
          <div style={{ marginBottom: 24 }}>
            <div style={labelStyle}>Strategy</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 10,
              }}
            >
              {(["grid", "dca", "signal", "trend"] as BotStrategy[]).map(
                (s) => {
                  const info = STRATEGY_INFO[s];
                  const selected = strategy === s;
                  return (
                    <button
                      key={s}
                      onClick={() => setStrategy(s)}
                      style={{
                        background: selected
                          ? `rgba(${
                              info.color === "#38e0f8"
                                ? "56,224,248"
                                : info.color === "#0ecb81"
                                  ? "14,203,129"
                                  : info.color === "#ff8a65"
                                    ? "255,138,101"
                                    : "240,185,11"
                            },0.1)`
                          : "rgb(20,24,30)",
                        border: `1px solid ${
                          selected ? info.color : "rgba(30,36,50,1)"
                        }`,
                        borderRadius: 10,
                        padding: "14px 10px",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.15s ease",
                        fontFamily: "Manrope, sans-serif",
                      }}
                    >
                      <div style={{ fontSize: 22, marginBottom: 6 }}>
                        {info.icon}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: selected ? info.color : "#eaecef",
                        }}
                      >
                        {info.label}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "rgba(180,190,210,0.5)",
                          marginTop: 4,
                          lineHeight: 1.4,
                        }}
                      >
                        {info.desc}
                      </div>
                    </button>
                  );
                },
              )}
            </div>
          </div>

          {/* Portfolio Balance */}
          {isConnected && (
            <div
              style={{
                background: "rgba(56,224,248,0.06)",
                border: "1px solid rgba(56,224,248,0.15)",
                borderRadius: 8,
                padding: "12px 16px",
                marginBottom: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "rgba(56,224,248,0.7)",
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                    marginBottom: 2,
                  }}
                >
                  Your Portfolio — Available to Trade
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: "#38e0f8",
                  }}
                >
                  $
                  {availableBalance.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: "rgba(56,224,248,0.6)",
                    }}
                  >
                    USD equivalent
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  if (availableBalance > 0) {
                    setInvestment(
                      Math.floor(availableBalance * 0.8).toString(),
                    );
                  }
                }}
                style={{
                  background: "rgba(56,224,248,0.1)",
                  border: "1px solid rgba(56,224,248,0.2)",
                  borderRadius: 6,
                  padding: "6px 12px",
                  color: "#38e0f8",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "Manrope, sans-serif",
                }}
              >
                Use 80%
              </button>
            </div>
          )}
          {liveMode && isConnected && availableBalance <= 0 && (
            <div
              role="alert"
              style={{
                marginBottom: 20,
                padding: "12px 16px",
                border: "1px solid rgba(246,70,93,0.3)",
                borderRadius: 8,
                background: "rgba(246,70,93,0.08)",
                color: "#f6a0a9",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                fontSize: 12,
              }}
            >
              <span>
                No eligible collateral is available for live trading. Deposit
                USDC, USDT, or another supported asset into your Orderly
                account.
              </span>
              <button
                onClick={() => navigate("/portfolio/assets")}
                style={{
                  border: 0,
                  padding: 0,
                  background: "none",
                  color: "#38e0f8",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Deposit collateral
              </button>
            </div>
          )}

          {/* Basic Settings */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
              marginBottom: 20,
            }}
          >
            <div>
              <label htmlFor="bot-name" style={labelStyle}>
                Bot Name (optional)
              </label>
              <input
                id="bot-name"
                value={botName}
                onChange={(e) => setBotName(e.target.value)}
                placeholder={`My ${STRATEGY_INFO[strategy].label}`}
                style={inputStyle}
              />
            </div>
            <div>
              <label htmlFor="bot-symbol" style={labelStyle}>
                Symbol
              </label>
              <select
                id="bot-symbol"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                style={inputStyle}
              >
                {allSymbols.map((s) => (
                  <option key={s} value={s}>
                    {symbolDisplay(s)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="bot-investment" style={labelStyle}>
                Investment ({quoteAsset})
                {isConnected && (
                  <span
                    style={{
                      marginLeft: 6,
                      color: "rgba(56,224,248,0.5)",
                      fontWeight: 500,
                      textTransform: "none",
                      letterSpacing: 0,
                    }}
                  >
                    available {quoteAsset} {availableBalance.toFixed(2)}
                  </span>
                )}
              </label>
              <input
                id="bot-investment"
                type="number"
                value={investment}
                onChange={(e) => setInvestment(e.target.value)}
                placeholder="500"
                min="0.01"
                step="any"
                style={{
                  ...inputStyle,
                  borderColor: balanceWarning
                    ? "rgba(246,70,93,0.5)"
                    : "rgba(30,36,50,1)",
                }}
              />
              {liveMode &&
                strategy !== "dca" &&
                minimumOrderNotional > 0 && (
                <div
                  aria-live="polite"
                  style={{
                    fontSize: 11,
                    color: "rgba(240,185,11,0.75)",
                    marginTop: 4,
                  }}
                >
                  Minimum order for {symbolDisplay(symbol)}: {quoteAsset} {minimumOrderNotional.toFixed(2)}
                </div>
                )}
              {balanceWarning && availableBalance > 0 && (
                <div
                  style={{
                    fontSize: 11,
                    color: "#f6465d",
                    marginTop: 4,
                  }}
                >
                  ⚠ Investment exceeds available balance ($
                  {availableBalance.toFixed(2)} free). Lower the investment or
                  deposit more collateral.
                </div>
              )}
            </div>
          </div>

          {/* Strategy-specific params */}
          {strategy === "grid" && (
            <div style={{ marginBottom: 20 }}>
              <div style={sectionLabelStyle}>Grid Parameters</div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <label htmlFor="grid-upper" style={labelStyle}>
                    Upper Price
                  </label>
                  <input
                    id="grid-upper"
                    value={gridUpper}
                    onChange={(e) => setGridUpper(e.target.value)}
                    placeholder="Auto"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label htmlFor="grid-lower" style={labelStyle}>
                    Lower Price
                  </label>
                  <input
                    id="grid-lower"
                    value={gridLower}
                    onChange={(e) => setGridLower(e.target.value)}
                    placeholder="Auto"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label htmlFor="grid-count" style={labelStyle}>
                    Grid Count
                  </label>
                  <input
                    id="grid-count"
                    type="number"
                    value={gridCount}
                    onChange={(e) => setGridCount(e.target.value)}
                    min="3"
                    max="200"
                    style={inputStyle}
                  />
                </div>
              </div>
              <div
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  color: "rgba(180,190,210,0.4)",
                  lineHeight: 1.5,
                }}
              >
                💡 Leave Upper/Lower empty for auto range detection based on
                current volatility.
              </div>
            </div>
          )}

          {strategy === "dca" && (
            <div style={{ marginBottom: 20 }}>
              <div style={sectionLabelStyle}>DCA Parameters</div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <label htmlFor="dca-interval" style={labelStyle}>
                    Buy Interval
                  </label>
                  <select
                    id="dca-interval"
                    value={dcaInterval}
                    onChange={(e) => setDcaInterval(e.target.value)}
                    style={inputStyle}
                  >
                    {[
                      "15m",
                      "30m",
                      "1h",
                      "4h",
                      "8h",
                      "12h",
                      "1d",
                      "3d",
                      "1w",
                    ].map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>
                    Amount per Buy ({quoteAsset})
                  </label>
                  <input
                    type="number"
                    value={dcaAmount}
                    onChange={(e) => setDcaAmount(e.target.value)}
                    min="0.01"
                    style={inputStyle}
                  />
                  {liveMode && minimumOrderNotional > 0 && (
                    <div
                      aria-live="polite"
                      style={{
                        fontSize: 11,
                        color: "rgba(240,185,11,0.75)",
                        marginTop: 4,
                      }}
                    >
                      Minimum buy: {quoteAsset} {minimumOrderNotional.toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
              <div
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  color: "rgba(180,190,210,0.4)",
                  lineHeight: 1.5,
                }}
              >
                💡 DCA reduces volatility impact by spreading purchases over
                time.
              </div>
            </div>
          )}

          {strategy === "signal" && (
            <div style={{ marginBottom: 20 }}>
              <div style={sectionLabelStyle}>Signal Parameters</div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <label htmlFor="signal-rsi" style={labelStyle}>
                    RSI Period
                  </label>
                  <input
                    id="signal-rsi"
                    type="number"
                    value={sigRsi}
                    onChange={(e) => setSigRsi(e.target.value)}
                    min="2"
                    max="50"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label htmlFor="signal-ema" style={labelStyle}>
                    EMA Period
                  </label>
                  <input
                    id="signal-ema"
                    type="number"
                    value={sigEma}
                    onChange={(e) => setSigEma(e.target.value)}
                    min="5"
                    max="200"
                    style={inputStyle}
                  />
                </div>
              </div>
              <div
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  color: "rgba(180,190,210,0.4)",
                  lineHeight: 1.5,
                }}
              >
                💡 Buys when RSI &lt; 35 + EMA crossover confirmed, sells when
                RSI &gt; 68.
              </div>
            </div>
          )}

          {strategy === "trend" && (
            <div style={{ marginBottom: 20 }}>
              <div style={sectionLabelStyle}>Risk-Managed Trend Parameters</div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <label htmlFor="trend-stop-atr" style={labelStyle}>
                    Stop Distance (ATR)
                  </label>
                  <input
                    id="trend-stop-atr"
                    type="number"
                    value={trendStopAtr}
                    onChange={(e) => setTrendStopAtr(e.target.value)}
                    onBlur={() =>
                      setTrendStopAtr(
                        String(normalizeTrendParameter(trendStopAtr, 2)),
                      )
                    }
                    min="1"
                    max="5"
                    step="0.5"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label htmlFor="trend-reward-risk" style={labelStyle}>
                    Target (R multiple)
                  </label>
                  <input
                    id="trend-reward-risk"
                    type="number"
                    value={trendRewardRisk}
                    onChange={(e) => setTrendRewardRisk(e.target.value)}
                    onBlur={() =>
                      setTrendRewardRisk(
                        String(normalizeTrendParameter(trendRewardRisk, 2.5)),
                      )
                    }
                    min="1"
                    max="5"
                    step="0.5"
                    style={inputStyle}
                  />
                </div>
              </div>
              <div
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  color: "rgba(180,190,210,0.5)",
                  lineHeight: 1.5,
                }}
              >
                Enters after a pullback in an EMA 9/21 uptrend (RSI 45–70).
                Position size risks up to 1% of the bot allocation, capped at
                25% notional; targets are capped at 5R and are not guaranteed.
                Live stops are monitored by this app and can slip or fail during
                outages.
              </div>
            </div>
          )}

          {/* Live Mode Toggle */}
          <div
            style={{
              background: liveMode
                ? "rgba(14,203,129,0.06)"
                : "rgba(20,24,30,1)",
              border: `1px solid ${
                liveMode ? "rgba(14,203,129,0.25)" : "rgba(30,36,50,1)"
              }`,
              borderRadius: 8,
              padding: "14px 16px",
              marginBottom: 20,
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: liveMode ? "#0ecb81" : "#eaecef",
                  marginBottom: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {liveMode && (
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: "#0ecb81",
                      boxShadow: "0 0 6px #0ecb81",
                      display: "inline-block",
                    }}
                  />
                )}
                {liveMode ? "Live Trading Mode" : "Simulation Mode"}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(180,190,210,0.5)",
                  lineHeight: 1.5,
                }}
              >
                {liveMode
                  ? isConnected
                    ? "Real orders will be placed on Orderly Network using your portfolio."
                    : "⚠ Connect your wallet first to use live trading."
                  : strategy === "trend"
                    ? "Paper trades follow live Binance prices and the selected strategy. No real orders or funds are used."
                    : "Bot runs in simulation mode — no real orders are placed."}
              </div>
            </div>
            <button
              onClick={() => setLiveMode((v) => !v)}
              style={{
                flexShrink: 0,
                width: 44,
                height: 24,
                borderRadius: 12,
                border: "none",
                background: liveMode ? "#0ecb81" : "rgba(30,36,50,1)",
                cursor: "pointer",
                position: "relative",
                transition: "background 0.2s ease",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 3,
                  left: liveMode ? 23 : 3,
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: "#fff",
                  transition: "left 0.2s ease",
                  display: "block",
                }}
              />
            </button>
          </div>

          {/* Risk Warning */}
          <div
            style={{
              background: "rgba(246,70,93,0.06)",
              border: "1px solid rgba(246,70,93,0.15)",
              borderRadius: 8,
              padding: "12px 16px",
              marginBottom: 20,
              fontSize: 12,
              color: "rgba(246,70,93,0.8)",
              lineHeight: 1.5,
            }}
          >
            ⚠️ Trading bots involve financial risk. Only invest what you can
            afford to lose. Past performance does not guarantee future results.
          </div>

          <button
            className="bot-launch-button"
            onClick={handleCreate}
            disabled={
              creating ||
              !investment ||
              Number(investment) <= 0 ||
              (liveMode &&
                (!isConnected || availableBalance <= 0 || balanceWarning))
            }
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 700,
              cursor:
                creating ||
                (liveMode &&
                  (!isConnected || availableBalance <= 0 || balanceWarning))
                  ? "not-allowed"
                  : "pointer",
              fontFamily: "Manrope, sans-serif",
              letterSpacing: 0.3,
              transition: "opacity 0.15s ease",
            }}
          >
            {creating
              ? "Creating Bot..."
              : liveMode && !isConnected
                ? "Connect Wallet to Use Live Mode"
                : liveMode && availableBalance <= 0
                  ? "Deposit Collateral to Use Live Mode"
                  : liveMode && balanceWarning
                    ? "Investment Exceeds Available Balance"
                    : `🚀 Launch ${STRATEGY_INFO[strategy].label}${
                        liveMode ? " (Live)" : " (Simulation)"
                      }`}
          </button>
        </div>
      )}

      {/* ── Tab: Trade History ─────────────────────────────────────────── */}
      {tab === "logs" && (
        <div>
          {/* Link to full Orderly history */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div style={{ fontSize: 13, color: "rgba(180,190,210,0.5)" }}>
              Bot trade history · {logs.length} executions
              {logs.filter((l) => l.live).length > 0 && (
                <span
                  style={{ marginLeft: 8, color: "#0ecb81", fontWeight: 600 }}
                >
                  ({logs.filter((l) => l.live).length} live)
                </span>
              )}
            </div>
            <a
              href="/portfolio/history"
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#38e0f8",
                textDecoration: "none",
                background: "rgba(56,224,248,0.08)",
                border: "1px solid rgba(56,224,248,0.2)",
                borderRadius: 6,
                padding: "5px 12px",
              }}
            >
              Orderly Account History →
            </a>
          </div>

          {logs.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "64px 24px",
                color: "rgba(180,190,210,0.35)",
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>
                No trade history yet
              </div>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                Run a bot to see its simulated or live executions here
              </div>
            </div>
          ) : (
            <div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 80px 130px 100px 110px 90px 120px",
                  gap: 8,
                  padding: "8px 16px",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "rgba(180,190,210,0.4)",
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                  borderBottom: "1px solid rgba(30,36,50,1)",
                }}
              >
                <div>Bot</div>
                <div>Side</div>
                <div>Symbol</div>
                <div style={{ textAlign: "right" }}>Qty</div>
                <div style={{ textAlign: "right" }}>Price</div>
                <div>Mode</div>
                <div style={{ textAlign: "right" }}>Time</div>
              </div>
              {logs.slice(0, 100).map((log) => {
                const bot = bots.find((b) => b.id === log.botId);
                return (
                  <div
                    key={log.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "1fr 80px 130px 100px 110px 90px 120px",
                      gap: 8,
                      padding: "10px 16px",
                      fontSize: 13,
                      borderBottom: "1px solid rgba(30,36,50,0.5)",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ color: "#eaecef", fontWeight: 600 }}>
                      {bot?.name || log.botId}
                    </div>
                    <div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 4,
                          background:
                            log.side === "BUY"
                              ? "rgba(14,203,129,0.12)"
                              : "rgba(246,70,93,0.12)",
                          color: log.side === "BUY" ? "#0ecb81" : "#f6465d",
                        }}
                      >
                        {log.side}
                      </span>
                    </div>
                    <div style={{ color: "rgba(180,190,210,0.7)" }}>
                      {symbolDisplay(log.symbol)}
                    </div>
                    <div style={{ textAlign: "right", color: "#eaecef" }}>
                      {log.qty}
                    </div>
                    <div style={{ textAlign: "right", color: "#eaecef" }}>
                      ${log.price.toFixed(2)}
                    </div>
                    <div>
                      {log.live ? (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: "#0ecb81",
                            background: "rgba(14,203,129,0.1)",
                            padding: "1px 6px",
                            borderRadius: 3,
                          }}
                        >
                          LIVE
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: 10,
                            color: "rgba(180,190,210,0.35)",
                          }}
                        >
                          SIM
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        textAlign: "right",
                        color: "rgba(180,190,210,0.45)",
                        fontSize: 11,
                      }}
                    >
                      {new Date(log.ts).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Chart & Backtest ──────────────────────────────────────── */}
      {tab === "backtest" && (
        <div>
          <Suspense
            fallback={
              <div
                style={{
                  textAlign: "center",
                  padding: "64px 24px",
                  color: "rgba(180,190,210,0.35)",
                  fontSize: 13,
                }}
              >
                Loading chart...
              </div>
            }
          >
            <BotBacktest defaultStrategy="signal" defaultSymbol="BTC" />
          </Suspense>
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  color: "rgba(180,190,210,0.5)",
  letterSpacing: 0.5,
  textTransform: "uppercase",
  marginBottom: 6,
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "rgba(180,190,210,0.5)",
  letterSpacing: 1,
  textTransform: "uppercase",
  marginBottom: 10,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgb(20,24,30)",
  border: "1px solid rgba(30,36,50,1)",
  borderRadius: 8,
  padding: "10px 12px",
  color: "#eaecef",
  fontSize: 14,
  fontFamily: "Manrope, sans-serif",
  outline: "none",
  boxSizing: "border-box",
};
