import { lazy, Suspense, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import OrderlyProvider from "@/components/orderlyProvider";
import { HttpsRequiredWarning } from "@/components/HttpsRequiredWarning";
import { NetworkStatus } from "@/components/NetworkStatus";
import LeverageAutoMax from "@/components/LeverageAutoMax";
import ReferralHandler from "@/components/ReferralHandler";
import ReferralWelcome from "@/components/ReferralWelcome";
import MarketTickerBar from "@/components/MarketTickerBar";
import WidgetManager from "@/components/WidgetManager";
import { useWidgetVisibility } from "@/hooks/useWidgetVisibility";
import PWAInstallBanner from "@/components/PWAInstallBanner";
import { withBasePath } from "./utils/base-path";
import { getSEOConfig, getUserLanguage } from "./utils/seo";
import { startFaviconAnimation } from "./utils/favicon-animation";
import PWAInstallBanner from "@/components/PWAInstallBanner";

const FrostTradeWidget  = lazy(() => import("@/components/FrostTradeWidget"));
const AIAssistant       = lazy(() => import("@/components/AIAssistant"));
const WhaleAlerts       = lazy(() => import("@/components/WhaleAlerts"));
const SentimentDashboard= lazy(() => import("@/components/SentimentDashboard"));
const SmartMoney        = lazy(() => import("@/components/SmartMoney"));
const LiqHeatmap        = lazy(() => import("@/components/LiqHeatmap"));
const MACWidget         = lazy(() => import("@/components/MACWidget"));
const PriceAlert        = lazy(() => import("@/components/PriceAlert"));

export default function App() {
  const seoConfig = getSEOConfig();
  const defaultLanguage = getUserLanguage();
  const { visibility, toggle, showAll, hideAll, anyHidden, allVisible } = useWidgetVisibility();

  useEffect(() => {
    if (typeof (window as any).__hideSplash === "function") {
      (window as any).__hideSplash();
    }
    startFaviconAnimation(withBasePath("/favicon.webp"));

    // One-time reset of widget positions to new left-side layout
    const LAYOUT_VER = "left-v1";
    if (localStorage.getItem("frost-layout-ver") !== LAYOUT_VER) {
      Object.keys(localStorage)
        .filter(k => k.startsWith("widget-pos-"))
        .forEach(k => localStorage.removeItem(k));
      localStorage.setItem("frost-layout-ver", LAYOUT_VER);
    }
  }, []);

  return (
    <>
      <Helmet>
        <html lang={seoConfig.language || defaultLanguage} />
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/webp" href={withBasePath("/favicon.webp")} />
      </Helmet>
      <PWAInstallBanner />
      <HttpsRequiredWarning />
      <NetworkStatus />
      <ReferralHandler />
      <ReferralWelcome />
      <PWAInstallBanner />
      <MarketTickerBar />
      <OrderlyProvider>
        <LeverageAutoMax />
        <Outlet />
      </OrderlyProvider>
      <Suspense fallback={null}>
        {visibility.frost      && <FrostTradeWidget   onHide={() => toggle("frost")} />}
        {visibility.ai         && <AIAssistant         onHide={() => toggle("ai")} />}
        {visibility.whale      && <WhaleAlerts          onHide={() => toggle("whale")} />}
        {visibility.smartmoney && <SmartMoney           onHide={() => toggle("smartmoney")} />}
        {visibility.liq        && <LiqHeatmap           onHide={() => toggle("liq")} />}
        {visibility.mac        && <MACWidget             onHide={() => toggle("mac")} />}
        {visibility.palert     && <PriceAlert            onHide={() => toggle("palert")} />}
        {visibility.sentiment  && <SentimentDashboard   onHide={() => toggle("sentiment")} />}
      </Suspense>
      <WidgetManager
        visibility={visibility}
        anyHidden={anyHidden}
        allVisible={allVisible}
        onToggle={toggle}
        onShowAll={showAll}
        onHideAll={hideAll}
      />
    </>
  );
}
