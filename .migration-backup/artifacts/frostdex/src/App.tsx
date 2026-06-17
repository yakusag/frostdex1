import { useEffect, lazy, Suspense } from "react";
import { Outlet } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { SpeedInsights } from "@vercel/speed-insights/react";
import OrderlyProvider from "@/components/orderlyProvider";
import { HttpsRequiredWarning } from "@/components/HttpsRequiredWarning";
import { NetworkStatus } from "@/components/NetworkStatus";
import LeverageAutoMax from "@/components/LeverageAutoMax";
import ReferralHandler from "@/components/ReferralHandler";
import ReferralWelcome from "@/components/ReferralWelcome";
import MarketTickerBar from "@/components/MarketTickerBar";
import WidgetManager from "@/components/WidgetManager";
import { useWidgetVisibility } from "@/hooks/useWidgetVisibility";
import { withBasePath } from "./utils/base-path";
import { getSEOConfig, getUserLanguage } from "./utils/seo";
import { startFaviconAnimation } from "./utils/favicon-animation";

const FrostTradeWidget   = lazy(() => import("@/components/FrostTradeWidget"));
const AIAssistant        = lazy(() => import("@/components/AIAssistant"));
const WhaleAlerts        = lazy(() => import("@/components/WhaleAlerts"));
const SmartMoney         = lazy(() => import("@/components/SmartMoney"));
const SentimentDashboard = lazy(() => import("@/components/SentimentDashboard"));

export default function App() {
  const seoConfig = getSEOConfig();
  const defaultLanguage = getUserLanguage();
  const { visibility, toggle, showAll, anyHidden } = useWidgetVisibility();

  useEffect(() => {
    if (typeof (window as any).__hideSplash === "function") {
      (window as any).__hideSplash();
    }
    startFaviconAnimation(withBasePath("/favicon.webp"));
  }, []);

  return (
    <>
      <Helmet>
        <html lang={seoConfig.language || defaultLanguage} />
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/webp" href={withBasePath("/favicon.webp")} />
      </Helmet>
      <HttpsRequiredWarning />
      <NetworkStatus />
      <ReferralHandler />
      <ReferralWelcome />
      <MarketTickerBar />
      <OrderlyProvider>
        <LeverageAutoMax />
        <Outlet />
      </OrderlyProvider>
      <Suspense fallback={null}>
        {visibility.frost      && <FrostTradeWidget   onHide={() => toggle("frost")} />}
        {visibility.ai         && <AIAssistant        onHide={() => toggle("ai")} />}
        {visibility.whale      && <WhaleAlerts         onHide={() => toggle("whale")} />}
        {visibility.smartmoney && <SmartMoney          onHide={() => toggle("smartmoney")} />}
        {visibility.sentiment  && <SentimentDashboard  onHide={() => toggle("sentiment")} />}
      </Suspense>
      <WidgetManager
        visibility={visibility}
        anyHidden={anyHidden}
        onToggle={toggle}
        onShowAll={showAll}
      />
      <SpeedInsights />
    </>
  );
}
