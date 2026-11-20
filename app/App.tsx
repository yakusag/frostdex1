import { lazy, Suspense, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
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
import { useSitePages } from "@/contexts/SitePagesContext";
import { withBasePath } from "./utils/base-path";
import { startFaviconAnimation } from "./utils/favicon-animation";
import { getSEOConfig, getUserLanguage } from "./utils/seo";
import { getSitePageIdForPath } from "../shared/site-pages";

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
  const location = useLocation();
  const seoConfig = getSEOConfig();
  const defaultLanguage = getUserLanguage();
  const {
    flags: sitePageFlags,
    loading: sitePagesLoading,
    error: sitePagesError,
  } = useSitePages();
  const { visibility, toggle, showAll, hideAll, allVisible } =
    useWidgetVisibility();
  const currentPageId = getSitePageIdForPath(location.pathname);
  const isCurrentPageDisabled =
    currentPageId !== undefined && !sitePageFlags[currentPageId];

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
      const isAnnouncementsPage =
        location.pathname === "/announcements" ||
        location.pathname.startsWith("/announcements/");
      if (
        isAnnouncementsPage ||
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
  }, [location.pathname, navigate]);

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
        {sitePagesLoading && currentPageId ? (
          <div className="oui-flex oui-min-h-[50vh] oui-items-center oui-justify-center">
            <span className="oui-text-base-contrast-54">
              Loading site settings...
            </span>
          </div>
        ) : sitePagesError && currentPageId ? (
          <main className="oui-flex oui-min-h-[60vh] oui-flex-col oui-items-center oui-justify-center oui-gap-3 oui-p-6 oui-text-center">
            <h1 className="oui-text-2xl oui-font-bold oui-text-base-contrast-80">
              Site settings are unavailable
            </h1>
            <p className="oui-max-w-lg oui-text-base-contrast-54">
              This page cannot be opened until page availability settings can
              be loaded.
            </p>
          </main>
        ) : isCurrentPageDisabled ? (
          <main className="oui-flex oui-min-h-[60vh] oui-flex-col oui-items-center oui-justify-center oui-gap-3 oui-p-6 oui-text-center">
            <h1 className="oui-text-2xl oui-font-bold oui-text-base-contrast-80">
              Page temporarily unavailable
            </h1>
            <p className="oui-max-w-lg oui-text-base-contrast-54">
              This page is currently disabled by the site administrator.
            </p>
            <Link to="/" className="oui-text-primary">
              Return to trading
            </Link>
          </main>
        ) : (
          <Outlet />
        )}
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
