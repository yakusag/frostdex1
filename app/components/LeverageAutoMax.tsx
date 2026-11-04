import { useEffect, useRef } from "react";
import {
  useAccount,
  useLeverage,
  useLeverageBySymbol,
  useMaxLeverage,
  useSymbolInfo,
  useSymbolLeverage,
} from "@orderly.network/hooks";
import { useLocation } from "react-router-dom";

const DEFAULT_SYMBOL = "PERP_BTC_USDC";

export default function LeverageAutoMax() {
  const { state } = useAccount();
  const { curLeverage: accountLeverage } = useLeverage();
  const { pathname } = useLocation();
  const routeSymbol = pathname.match(/^\/perp\/([^/]+)/)?.[1];
  const symbol = routeSymbol ? decodeURIComponent(routeSymbol) : null;
  const hookSymbol = symbol ?? DEFAULT_SYMBOL;
  const symbolInfo = useSymbolInfo(hookSymbol);
  const maxLeverage = useMaxLeverage(hookSymbol);
  const currentSymbolLeverage = useLeverageBySymbol(hookSymbol);
  const { update, isLoading } = useSymbolLeverage(hookSymbol);
  const lastAttempt = useRef("");

  useEffect(() => {
    const baseImr = Number(symbolInfo?.("base_imr") ?? 0);
    if (
      !symbol ||
      !state?.accountId ||
      isLoading ||
      !Number.isFinite(baseImr) ||
      baseImr <= 0 ||
      !Number.isFinite(maxLeverage) ||
      maxLeverage < 1
    ) {
      return;
    }

    const currentLeverage = currentSymbolLeverage ?? accountLeverage;
    if (currentLeverage === maxLeverage) {
      lastAttempt.current = "";
      return;
    }

    const attempt = `${state.accountId}:${symbol}:${currentLeverage}:${maxLeverage}`;
    if (lastAttempt.current === attempt) return;
    lastAttempt.current = attempt;

    update({ leverage: maxLeverage, symbol }).catch(() => {
      if (lastAttempt.current === attempt) lastAttempt.current = "";
    });
  }, [
    accountLeverage,
    currentSymbolLeverage,
    isLoading,
    maxLeverage,
    state?.accountId,
    symbol,
    symbolInfo,
    update,
  ]);

  return null;
}
