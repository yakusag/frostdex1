import React, { lazy } from "react";
import ReactDOM from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { withBasePath } from "./utils/base-path";
import { getRuntimeConfig } from "./utils/runtime-config";
import "./styles/index.css";

const IndexPage = lazy(() => import("./pages/Index"));
const PerpLayout = lazy(() => import("./pages/perp/Layout"));
const PerpIndex = lazy(() => import("./pages/perp/Index"));
const PerpSymbol = lazy(() => import("./pages/perp/Symbol"));
const PortfolioLayout = lazy(() => import("./pages/portfolio/Layout"));
const PortfolioIndex = lazy(() => import("./pages/portfolio/Index"));
const PortfolioPositions = lazy(() => import("./pages/portfolio/Positions"));
const PortfolioOrders = lazy(() => import("./pages/portfolio/Orders"));
const PortfolioAssets = lazy(() => import("./pages/portfolio/Assets"));
const PortfolioApiKey = lazy(() => import("./pages/portfolio/ApiKey"));
const PortfolioFee = lazy(() => import("./pages/portfolio/Fee"));
const PortfolioHistory = lazy(() => import("./pages/portfolio/History"));
const PortfolioSetting = lazy(() => import("./pages/portfolio/Setting"));
const MarketsLayout = lazy(() => import("./pages/markets/Layout"));
const MarketsIndex = lazy(() => import("./pages/markets/Index"));
const LeaderboardLayout = lazy(() => import("./pages/leaderboard/Layout"));
const LeaderboardIndex = lazy(() => import("./pages/leaderboard/Index"));
const RewardsLayout = lazy(() => import("./pages/rewards/Layout"));
const RewardsIndex = lazy(() => import("./pages/rewards/Index"));
const RewardsAffiliate = lazy(() => import("./pages/rewards/Affiliate"));
const VaultsLayout = lazy(() => import("./pages/vaults/Layout"));
const VaultsIndex = lazy(() => import("./pages/vaults/Index"));
const SwapLayout = lazy(() => import("./pages/swap/Layout"));
const SwapIndex = lazy(() => import("./pages/swap/Index"));
const PointsLayout = lazy(() => import("./pages/points/Layout"));
const PointsIndex = lazy(() => import("./pages/points/Index"));
const BotLayout = lazy(() => import("./pages/bot/Layout"));
const BotIndex = lazy(() => import("./pages/bot/Index"));
const AboutLayout = lazy(() => import("./pages/about/Layout"));
const AboutIndex = lazy(() => import("./pages/about/Index"));
const TokenLayout = lazy(() => import("./pages/token/Layout"));
const TokenIndex = lazy(() => import("./pages/token/Index"));
const ReferralLayout = lazy(() => import("./pages/referral/Layout"));
const ReferralIndex = lazy(() => import("./pages/referral/Index"));
const WhitepaperLayout = lazy(() => import("./pages/whitepaper/Layout"));
const WhitepaperIndex = lazy(() => import("./pages/whitepaper/Index"));

async function loadRuntimeConfig() {
  return new Promise<void>((resolve) => {
    const script = document.createElement("script");
    script.src = withBasePath("/config.js");
    script.onload = () => {
      console.log("Runtime config loaded successfully");
      resolve();
    };
    script.onerror = () => {
      console.log("Runtime config not found, using build-time env vars");
      resolve();
    };
    document.head.appendChild(script);
  });
}

function loadAnalytics() {
  const analyticsScript = getRuntimeConfig("VITE_ANALYTICS_SCRIPT");

  if (analyticsScript) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(analyticsScript, "text/html");
    const scripts = doc.querySelectorAll("script");

    scripts.forEach((originalScript) => {
      const newScript = document.createElement("script");

      Array.from(originalScript.attributes).forEach((attr) => {
        newScript.setAttribute(attr.name, attr.value);
      });

      if (originalScript.textContent) {
        newScript.textContent = originalScript.textContent;
      }

      document.head.appendChild(newScript);
    });
  }
}

const basePath = import.meta.env.BASE_URL || "/";

const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <App />,
      errorElement: <ErrorBoundary />,
      children: [
        { index: true, element: <IndexPage /> },
        {
          path: "perp",
          element: <PerpLayout />,
          children: [
            { index: true, element: <PerpIndex /> },
            { path: ":symbol", element: <PerpSymbol /> },
          ],
        },
        {
          path: "portfolio",
          element: <PortfolioLayout />,
          children: [
            { index: true, element: <PortfolioIndex /> },
            { path: "positions", element: <PortfolioPositions /> },
            { path: "orders", element: <PortfolioOrders /> },
            { path: "assets", element: <PortfolioAssets /> },
            { path: "api-key", element: <PortfolioApiKey /> },
            { path: "fee", element: <PortfolioFee /> },
            { path: "history", element: <PortfolioHistory /> },
            { path: "setting", element: <PortfolioSetting /> },
          ],
        },
        {
          path: "markets",
          element: <MarketsLayout />,
          children: [{ index: true, element: <MarketsIndex /> }],
        },
        {
          path: "leaderboard",
          element: <LeaderboardLayout />,
          children: [{ index: true, element: <LeaderboardIndex /> }],
        },
        {
          path: "rewards",
          element: <RewardsLayout />,
          children: [
            { index: true, element: <RewardsIndex /> },
            { path: "affiliate", element: <RewardsAffiliate /> },
          ],
        },
        {
          path: "vaults",
          element: <VaultsLayout />,
          children: [{ index: true, element: <VaultsIndex /> }],
        },
        {
          path: "swap",
          element: <SwapLayout />,
          children: [{ index: true, element: <SwapIndex /> }],
        },
        {
          path: "points",
          element: <PointsLayout />,
          children: [{ index: true, element: <PointsIndex /> }],
        },
        {
          path: "bot",
          element: <BotLayout />,
          children: [{ index: true, element: <BotIndex /> }],
        },
        {
          path: "about",
          element: <AboutLayout />,
          children: [{ index: true, element: <AboutIndex /> }],
        },
        {
          path: "token",
          element: <TokenLayout />,
          children: [{ index: true, element: <TokenIndex /> }],
        },
        {
          path: "referral",
          element: <ReferralLayout />,
          children: [{ index: true, element: <ReferralIndex /> }],
        },
        {
          path: "whitepaper",
          element: <WhitepaperLayout />,
          children: [{ index: true, element: <WhitepaperIndex /> }],
        },
      ],
    },
  ],
  { basename: basePath },
);

const routePrefetchers: Record<string, () => Promise<unknown>> = {
  "/": () => import("./pages/Index"),
  "/perp": () =>
    Promise.all([import("./pages/perp/Layout"), import("./pages/perp/Index")]),
  "/perp/*": () => import("./pages/perp/Symbol"),
  "/portfolio": () =>
    Promise.all([
      import("./pages/portfolio/Layout"),
      import("./pages/portfolio/Index"),
    ]),
  "/portfolio/positions": () => import("./pages/portfolio/Positions"),
  "/portfolio/orders": () => import("./pages/portfolio/Orders"),
  "/portfolio/assets": () => import("./pages/portfolio/Assets"),
  "/portfolio/api-key": () => import("./pages/portfolio/ApiKey"),
  "/portfolio/fee": () => import("./pages/portfolio/Fee"),
  "/portfolio/history": () => import("./pages/portfolio/History"),
  "/portfolio/setting": () => import("./pages/portfolio/Setting"),
  "/markets": () =>
    Promise.all([
      import("./pages/markets/Layout"),
      import("./pages/markets/Index"),
    ]),
  "/leaderboard": () =>
    Promise.all([
      import("./pages/leaderboard/Layout"),
      import("./pages/leaderboard/Index"),
    ]),
  "/rewards": () =>
    Promise.all([
      import("./pages/rewards/Layout"),
      import("./pages/rewards/Index"),
    ]),
  "/rewards/affiliate": () => import("./pages/rewards/Affiliate"),
  "/vaults": () =>
    Promise.all([
      import("./pages/vaults/Layout"),
      import("./pages/vaults/Index"),
    ]),
  "/swap": () =>
    Promise.all([import("./pages/swap/Layout"), import("./pages/swap/Index")]),
  "/points": () =>
    Promise.all([
      import("./pages/points/Layout"),
      import("./pages/points/Index"),
    ]),
  "/bot": () =>
    Promise.all([import("./pages/bot/Layout"), import("./pages/bot/Index")]),
  "/about": () =>
    Promise.all([
      import("./pages/about/Layout"),
      import("./pages/about/Index"),
    ]),
  "/token": () =>
    Promise.all([
      import("./pages/token/Layout"),
      import("./pages/token/Index"),
    ]),
  "/referral": () =>
    Promise.all([
      import("./pages/referral/Layout"),
      import("./pages/referral/Index"),
    ]),
  "/whitepaper": () =>
    Promise.all([
      import("./pages/whitepaper/Layout"),
      import("./pages/whitepaper/Index"),
    ]),
};

const prefetchedRoutes = new Set<string>();

function prefetchRoute(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const root = segments.length === 0 ? "/" : `/${segments[0]}`;
  const routeKeys = [root, pathname, segments.length > 1 ? `${root}/*` : ""];

  for (const key of routeKeys) {
    const prefetch = routePrefetchers[key];
    if (!prefetch || prefetchedRoutes.has(key)) continue;
    prefetchedRoutes.add(key);
    void prefetch().catch((error: unknown) => {
      prefetchedRoutes.delete(key);
      console.error(`Failed to prefetch route "${key}":`, error);
    });
  }
}

function prefetchOnNavigationIntent(event: Event) {
  if (!(event.target instanceof Element)) return;
  const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
  if (!anchor || (anchor.target && anchor.target !== "_self")) return;

  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return;

  const basePrefix = basePath === "/" ? "" : basePath.replace(/\/$/, "");
  if (
    basePrefix &&
    url.pathname !== basePrefix &&
    !url.pathname.startsWith(`${basePrefix}/`)
  ) {
    return;
  }
  const pathname =
    basePrefix && url.pathname !== basePrefix
      ? url.pathname.slice(basePrefix.length) || "/"
      : basePrefix
        ? "/"
        : url.pathname;
  prefetchRoute(pathname);
}

loadRuntimeConfig().then(() => {
  loadAnalytics();

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <HelmetProvider>
        <RouterProvider router={router} />
      </HelmetProvider>
    </React.StrictMode>,
  );

  document.addEventListener("pointerover", prefetchOnNavigationIntent, {
    passive: true,
  });
  document.addEventListener("focusin", prefetchOnNavigationIntent);
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(withBasePath("/sw.js"))
      .then((registration) => {
        console.log("SW registered:", registration);
      })
      .catch((error) => {
        console.log("SW registration failed:", error);
      });
  });
}
