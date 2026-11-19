import { lazy, Suspense, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Outlet, useNavigate } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { HttpsRequiredWarning } from "@/components/HttpsRequiredWarning";
import IOSInstallGuide from "@/components/IOSInstallGuide";
import MarketTickerBar from "@/components/MarketTickerBar";
import { NetworkStatus } from "@/components/NetworkStatus";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import ReferralHandler from "@/components/ReferralHandler";
import ReferralWelcome from "@/components/ReferralWelcome";
import WidgetManager from "@/components/WidgetManager";
import OrderlyProvider from "@/components/orderlyProvider";
import { useWidgetVisibility } from "@/hooks/useWidgetVisibility";
import { withBasePath } from "./utils/base-path";
import { startFaviconAnimation } from "./utils/favicon-animation";
import { getSEOConfig, getUserLanguage } from "./utils/seo";

const AIAssistant = lazy(() => import("@/components/AIAssistant"));
const FrostTradeWidget = lazy(() => import("@/components/FrostTradeWidget"));
const LiqHeatmap = lazy(() => import("@/components/LiqHeatmap"));
const MACWidget = lazy(() => import("@/components/MACWidget"));
const PriceAlert = lazy(() => import("@/components/PriceAlert"));
const SentimentDashboard = lazy(
  () => import("@/components/SentimentDashboard"),
);
const SmartMoney = lazy(() => import("@/components/SmartMoney"));
const WhaleAlerts = lazy(() => import("@/components/WhaleAlerts"));

export default function App() {
  const navigate = useNavigate();
  const seoConfig = getSEOConfig();
  const defaultLanguage = getUserLanguage();
  const { visibility, toggle, showAll, hideAll, allVisible } =
    useWidgetVisibility();

  useEffect(() => {
    window.__hideSplash?.();
    startFaviconAnimation(withBasePath("/favicon.webp"));

    // One-time reset of widget positions to new left-side layout
    const LAYOUT_VER = "left-v1";
    if (localStorage.getItem("frost-layout-ver") !== LAYOUT_VER) {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("widget-pos-"))
        .forEach((k) => localStorage.removeItem(k));
      localStorage.setItem("frost-layout-ver", LAYOUT_VER);
    }
  }, []);

  useEffect(() => {
    const handleAnnouncementClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;

      const target = event.target;
      if (
        !target.closest(".orderly-notification") ||
        target.closest("button, a")
      ) {
        return;
      }

      navigate("/announcements");
    };

    document.addEventListener("click", handleAnnouncementClick);
    return () => {
      document.removeEventListener("click", handleAnnouncementClick);
    };
  }, [navigate]);

  return (
    <>
      <Helmet>
        <html lang={defaultLanguage || seoConfig.language || "en"} />
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          rel="icon"
          type="image/webp"
          href={withBasePath("/favicon.webp")}
        />
      </Helmet>
      <HttpsRequiredWarning />
      <NetworkStatus />
      <ReferralHandler />
      <ReferralWelcome />
      <MarketTickerBar />
      <OrderlyProvider>
        <Outlet />
      </OrderlyProvider>
      {visibility.frost && (
        <Suspense fallback={null}>
          <FrostTradeWidget onHide={() => toggle("frost")} />
        </Suspense>
      )}
      {visibility.ai && (
        <Suspense fallback={null}>
          <AIAssistant onHide={() => toggle("ai")} />
        </Suspense>
      )}
      {visibility.whale && (
        <Suspense fallback={null}>
          <WhaleAlerts onHide={() => toggle("whale")} />
        </Suspense>
      )}
      {visibility.smartmoney && (
        <Suspense fallback={null}>
          <SmartMoney onHide={() => toggle("smartmoney")} />
        </Suspense>
      )}
      {visibility.liq && (
        <Suspense fallback={null}>
          <LiqHeatmap onHide={() => toggle("liq")} />
        </Suspense>
      )}
      {visibility.mac && (
        <Suspense fallback={null}>
          <MACWidget onHide={() => toggle("mac")} />
        </Suspense>
      )}
      {visibility.palert && (
        <Suspense fallback={null}>
          <PriceAlert onHide={() => toggle("palert")} />
        </Suspense>
      )}
      {visibility.sentiment && (
        <Suspense fallback={null}>
          <SentimentDashboard onHide={() => toggle("sentiment")} />
        </Suspense>
      )}
      <WidgetManager
        visibility={visibility}
        allVisible={allVisible}
        onToggle={toggle}
        onShowAll={showAll}
        onHideAll={hideAll}
      />
      <PWAInstallPrompt />
      <IOSInstallGuide />
      <SpeedInsights />
      <Analytics />
    </>
  );
}
