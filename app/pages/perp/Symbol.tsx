import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTickerStream } from "@orderly.network/hooks";
import { TradingPage } from "@orderly.network/trading";
import { API } from "@orderly.network/types";
import RiskCopilot from "@/components/RiskCopilot";
import { useOrderlyConfig } from "@/utils/config";
import { getRuntimeConfig } from "@/utils/runtime-config";
import { getPageMeta } from "@/utils/seo";
import { renderSEOTags } from "@/utils/seo-tags";
import { updateSymbol } from "@/utils/storage";
import { formatSymbol, generatePageTitle } from "@/utils/utils";

function LiveTitle({
  symbol,
  ticker,
}: {
  symbol: string;
  ticker: ReturnType<typeof useTickerStream>;
}) {
  const brokerName = getRuntimeConfig("VITE_ORDERLY_BROKER_NAME") || "FrostDex";

  useEffect(() => {
    const price = ticker?.["24h_close"] ?? ticker?.mark_price;
    const base = symbol.split("_")[1] ?? symbol;
    if (price) {
      const formatted = Number(price).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      document.title = `${base} ${formatted} | ${brokerName}`;
    }
  }, [ticker, symbol, brokerName]);

  return null;
}

export default function PerpSymbol() {
  const params = useParams();
  const [symbol, setSymbol] = useState(params.symbol!);
  const config = useOrderlyConfig();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ticker = useTickerStream(symbol);

  useEffect(() => {
    updateSymbol(symbol);
  }, [symbol]);

  const onSymbolChange = useCallback(
    (data: API.Symbol) => {
      const newSymbol = data.symbol;
      if (newSymbol === symbol) return;
      setSymbol(newSymbol);

      const searchParamsString = searchParams.toString();
      const queryString = searchParamsString ? `?${searchParamsString}` : "";

      navigate(`/perp/${newSymbol}${queryString}`);
    },
    [navigate, searchParams, symbol],
  );

  const pageMeta = getPageMeta();
  const pageTitle = generatePageTitle(formatSymbol(params.symbol!));

  return (
    <div className="h-full">
      {renderSEOTags(pageMeta, pageTitle)}
      <LiveTitle symbol={symbol} ticker={ticker} />
      <RiskCopilot
        symbol={symbol}
        markPrice={ticker?.mark_price}
        estimatedFundingRate={ticker?.est_funding_rate}
      />
      <TradingPage
        symbol={symbol}
        onSymbolChange={onSymbolChange}
        tradingViewConfig={config.tradingPage.tradingViewConfig}
        sharePnLConfig={config.tradingPage.sharePnLConfig}
      />
    </div>
  );
}
