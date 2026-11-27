import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
} from "react";
import {
  Activity,
  BarChart3,
  Bot,
  Boxes,
  ChevronRight,
  CircleDollarSign,
  Globe2,
  LayoutDashboard,
  Medal,
  Search,
  Settings,
  ShieldCheck,
  Trophy,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { stringToHex } from "viem";
import { useWalletConnector } from "@orderly.network/hooks";
import { useSitePages } from "@/contexts/SitePagesContext";
import { SITE_PAGES, type SitePageFlags } from "../../../shared/site-pages";

type AdminSessionResponse = {
  authenticated: boolean;
};

function getErrorMessage(body: unknown, fallback: string): string {
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    typeof body.error === "string"
  ) {
    return body.error;
  }
  return fallback;
}

async function readResponse<T>(
  response: Response,
  fallback: string,
): Promise<T> {
  const body: unknown = await response.json();
  if (!response.ok) {
    throw new Error(getErrorMessage(body, `${fallback} (${response.status}).`));
  }
  return body as T;
}

export default function AdminIndex() {
  const { wallet, connect, connecting } = useWalletConnector();
  const { refresh: refreshSitePages, error: sitePagesError } = useSitePages();
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [flags, setFlags] = useState<SitePageFlags | null>(null);
  const [savingPage, setSavingPage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const autoLoginAttemptedForAddress = useRef<string | null>(null);

  const loadPages = useCallback(async () => {
    const response = await fetch("/api/admin/pages", {
      headers: { Accept: "application/json" },
    });
    const result = await readResponse<{ pages: SitePageFlags }>(
      response,
      "Unable to load admin settings",
    );
    setFlags(result.pages);
  }, []);

  useEffect(() => {
    let active = true;

    fetch("/api/admin/auth", { headers: { Accept: "application/json" } })
      .then((response) =>
        readResponse<AdminSessionResponse>(
          response,
          "Unable to check admin sign-in",
        ),
      )
      .then(async (session) => {
        if (!active) return;
        setAuthenticated(session.authenticated);
        if (session.authenticated) {
          await loadPages();
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to check admin sign-in.",
          );
        }
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });

    return () => {
      active = false;
    };
  }, [loadPages]);

  const handleConnect = async () => {
    setBusy(true);
    setError(null);
    try {
      await connect();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Wallet connection failed.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleLogin = useCallback(async () => {
    const address = wallet?.accounts[0]?.address;
    if (!address || !/^0x[0-9a-f]{40}$/i.test(address)) {
      setError("Connect the EVM wallet registered as this broker's admin.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const challengeResponse = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "challenge", address }),
      });
      const challenge = await readResponse<{
        nonce: string;
        message: string;
      }>(challengeResponse, "Unable to start admin sign-in");

      const provider = wallet.provider;
      if (!("request" in provider) || typeof provider.request !== "function") {
        throw new Error("The connected wallet cannot sign admin messages.");
      }

      const signature = await provider.request({
        method: "personal_sign",
        params: [stringToHex(challenge.message), address],
      });
      if (typeof signature !== "string") {
        throw new Error("The wallet returned an invalid signature.");
      }

      const loginResponse = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "login",
          address,
          nonce: challenge.nonce,
          signature,
        }),
      });
      await readResponse<AdminSessionResponse>(
        loginResponse,
        "Admin sign-in failed",
      );
      setAuthenticated(true);
      await loadPages();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Admin sign-in failed.",
      );
    } finally {
      setBusy(false);
    }
  }, [loadPages, wallet]);

  useEffect(() => {
    const address = wallet?.accounts[0]?.address;
    if (!address) {
      autoLoginAttemptedForAddress.current = null;
      return;
    }
    if (
      checkingSession ||
      authenticated ||
      busy ||
      autoLoginAttemptedForAddress.current === address
    ) {
      return;
    }

    autoLoginAttemptedForAddress.current = address;
    void handleLogin();
  }, [authenticated, busy, checkingSession, handleLogin, wallet]);

  const handleLogout = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/auth", { method: "DELETE" });
      await readResponse<AdminSessionResponse>(response, "Unable to sign out");
      setAuthenticated(false);
      setFlags(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign out.");
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async (pageId: keyof SitePageFlags) => {
    if (!flags) return;
    setSavingPage(pageId);
    setError(null);
    try {
      const response = await fetch("/api/admin/pages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, enabled: !flags[pageId] }),
      });
      const result = await readResponse<{ pages: SitePageFlags }>(
        response,
        "Unable to save page setting",
      );
      setFlags(result.pages);
      await refreshSitePages();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to save page setting.",
      );
    } finally {
      setSavingPage(null);
    }
  };

  const pageIcon: Record<string, ComponentType<{ size?: number }>> = {
    Trading: BarChart3,
    Portfolio: WalletCards,
    Markets: Globe2,
    Announcements: Activity,
    Leaderboard: Trophy,
    Rewards: Medal,
    Vaults: Boxes,
    Swap: CircleDollarSign,
    Points: CircleDollarSign,
    Bot: Bot,
    AIBot: Bot,
    About: LayoutDashboard,
    Token: Search,
    Referral: Users,
    Whitepaper: ShieldCheck,
  };

  const pageDescription: Record<string, string> = {
    Trading: "Trading terminal and perpetual markets",
    Portfolio: "Balances, positions and account settings",
    Markets: "Market overview and discovery",
    Announcements: "Platform updates and notices",
    Leaderboard: "Trader rankings and competitions",
    Rewards: "Rewards and affiliate programs",
    Vaults: "Vault products and strategies",
    Swap: "Token swap and exchange tools",
    Points: "Points activity and campaigns",
    Bot: "Automated trading and strategies",
    AIBot: "24/7 AI capital-rotation trading bot",
    About: "Platform information and policies",
    Token: "Token search and market details",
    Referral: "Referral program and invitations",
    Whitepaper: "Documentation and project resources",
  };

  const visiblePages = SITE_PAGES.filter((page) =>
    `${page.label} ${pageDescription[page.id] ?? ""}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  const enabledCount = flags ? Object.values(flags).filter(Boolean).length : 0;
  const disabledCount = flags
    ? Object.values(flags).filter((enabled) => !enabled).length
    : 0;
  const walletAddress = wallet?.accounts[0]?.address;

  return (
    <main className="oui-min-h-[calc(100vh-64px)] oui-bg-[#080b10] oui-text-white">
      {(error || sitePagesError) && (
        <div
          role="alert"
          className="oui-fixed oui-right-5 oui-top-20 oui-z-50 oui-flex oui-max-w-md oui-items-start oui-gap-3 oui-rounded-xl oui-border oui-border-danger/40 oui-bg-[#1c1114] oui-p-4 oui-shadow-2xl"
        >
          <Activity
            className="oui-mt-0.5 oui-shrink-0 oui-text-danger"
            size={18}
          />
          <span className="oui-flex-1 oui-text-sm oui-text-danger">
            {error || sitePagesError}
          </span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setError(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {checkingSession ? (
        <div className="oui-flex oui-min-h-[70vh] oui-items-center oui-justify-center">
          <div
            role="status"
            className="oui-flex oui-items-center oui-gap-3 oui-rounded-xl oui-border oui-border-white/10 oui-bg-white/[0.03] oui-px-5 oui-py-4 oui-text-sm oui-text-white/60"
          >
            <ShieldCheck size={18} className="oui-text-[#b9ff66]" />
            Checking admin access...
          </div>
        </div>
      ) : !authenticated ? (
        <div className="oui-grid oui-min-h-[calc(100vh-64px)] oui-place-items-center oui-px-5 oui-py-12">
          <section className="oui-relative oui-w-full oui-max-w-md oui-overflow-hidden oui-rounded-3xl oui-border oui-border-white/10 oui-bg-[#10141b] oui-p-8 oui-shadow-[0_24px_80px_rgba(0,0,0,.45)]">
            <div className="oui-absolute oui-right-[-60px] oui-top-[-70px] oui-h-44 oui-w-44 oui-rounded-full oui-bg-[#b9ff66]/10 oui-blur-3xl" />
            <div className="oui-relative">
              <div className="oui-mb-7 oui-flex oui-h-12 oui-w-12 oui-items-center oui-justify-center oui-rounded-2xl oui-border oui-border-[#b9ff66]/20 oui-bg-[#b9ff66]/10">
                <ShieldCheck size={24} className="oui-text-[#b9ff66]" />
              </div>
              <p className="oui-mb-2 oui-text-xs oui-font-semibold oui-uppercase oui-tracking-[0.18em] oui-text-[#b9ff66]">
                FrostDex Control
              </p>
              <h1 className="oui-text-3xl oui-font-semibold oui-tracking-tight">
                Broker administration
              </h1>
              <p className="oui-mt-3 oui-leading-6 oui-text-white/50">
                Sign in with the registered broker wallet to manage platform
                page availability.
              </p>
              <div className="oui-mt-7 oui-rounded-2xl oui-border oui-border-white/[0.07] oui-bg-black/20 oui-p-4">
                <div className="oui-flex oui-items-center oui-gap-3">
                  <WalletCards size={18} className="oui-text-white/50" />
                  <div>
                    <p className="oui-text-xs oui-text-white/35">
                      Authentication method
                    </p>
                    <p className="oui-mt-0.5 oui-text-sm oui-font-medium oui-text-white/80">
                      Wallet message signature
                    </p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="oui-mt-4 oui-flex oui-w-full oui-items-center oui-justify-center oui-gap-2 oui-rounded-xl oui-bg-[#b9ff66] oui-px-5 oui-py-3.5 oui-font-semibold oui-text-[#10130d] oui-transition oui-hover:bg-[#cdfa91] disabled:oui-opacity-50"
                disabled={busy || connecting}
                onClick={wallet ? handleLogin : handleConnect}
              >
                {busy || connecting
                  ? wallet
                    ? "Verifying wallet..."
                    : "Connecting..."
                  : wallet
                    ? "Sign in as broker owner"
                    : "Connect wallet"}
                <ChevronRight size={18} />
              </button>
              <p className="oui-mt-4 oui-text-center oui-text-xs oui-leading-5 oui-text-white/30">
                Secure signature only. No transaction or private key required.
              </p>
            </div>
          </section>
        </div>
      ) : flags ? (
        <div className="oui-grid oui-min-h-[calc(100vh-64px)] oui-grid-cols-1 md:oui-grid-cols-[220px_minmax(0,1fr)]">
          <aside className="oui-hidden oui-border-r oui-border-white/[0.07] oui-bg-[#0d1016] md:oui-flex oui-flex-col">
            <div className="oui-flex oui-h-20 oui-items-center oui-gap-3 oui-border-b oui-border-white/[0.07] oui-px-5">
              <div className="oui-flex oui-h-9 oui-w-9 oui-items-center oui-justify-center oui-rounded-xl oui-bg-[#b9ff66]">
                <LayoutDashboard size={19} className="oui-text-[#11150d]" />
              </div>
              <div>
                <p className="oui-font-semibold oui-tracking-tight">FrostDex</p>
                <p className="oui-text-[11px] oui-text-white/35">
                  Admin console
                </p>
              </div>
            </div>
            <nav className="oui-flex-1 oui-p-3" aria-label="Admin navigation">
              <button
                type="button"
                className="oui-flex oui-w-full oui-items-center oui-gap-3 oui-rounded-xl oui-bg-white/[0.07] oui-px-3 oui-py-3 oui-text-sm oui-font-medium oui-text-white"
              >
                <Settings size={17} className="oui-text-[#b9ff66]" />
                Page control
              </button>
            </nav>
            <div className="oui-border-t oui-border-white/[0.07] oui-p-4">
              <div className="oui-mb-3 oui-flex oui-items-center oui-gap-2 oui-text-xs oui-text-white/40">
                <span className="oui-h-2 oui-w-2 oui-rounded-full oui-bg-[#b9ff66]" />
                Admin wallet connected
              </div>
              {walletAddress && (
                <p className="oui-mb-3 oui-font-mono oui-text-xs oui-text-white/55">
                  {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                </p>
              )}
              <button
                type="button"
                className="oui-flex oui-w-full oui-items-center oui-gap-2 oui-rounded-lg oui-border oui-border-white/[0.08] oui-px-3 oui-py-2.5 oui-text-xs oui-text-white/60 oui-hover:bg-white/[0.04]"
                disabled={busy}
                onClick={handleLogout}
              >
                <X size={15} />
                Sign out
              </button>
            </div>
          </aside>

          <div className="oui-min-w-0">
            <header className="oui-flex oui-h-20 oui-items-center oui-justify-between oui-border-b oui-border-white/[0.07] oui-bg-[#0d1016]/90 oui-px-5 md:oui-px-8">
              <div>
                <p className="oui-text-xs oui-text-white/35">Control center</p>
                <h1 className="oui-mt-1 oui-text-xl oui-font-semibold oui-tracking-tight">
                  Page management
                </h1>
              </div>
              <button
                type="button"
                className="oui-flex oui-items-center oui-gap-2 oui-rounded-lg oui-border oui-border-white/[0.08] oui-px-3 oui-py-2 oui-text-xs oui-text-white/60 md:oui-hidden"
                disabled={busy}
                onClick={handleLogout}
              >
                <X size={14} />
                Sign out
              </button>
            </header>

            <div className="oui-mx-auto oui-max-w-[1180px] oui-p-5 md:oui-p-8">
              <div className="oui-grid oui-gap-3 oui-sm:grid-cols-3">
                <article className="oui-rounded-2xl oui-border oui-border-white/[0.07] oui-bg-[#10141b] oui-p-5">
                  <div className="oui-flex oui-items-start oui-justify-between">
                    <div>
                      <p className="oui-text-xs oui-text-white/40">
                        Total pages
                      </p>
                      <p className="oui-mt-2 oui-text-3xl oui-font-semibold">
                        {SITE_PAGES.length}
                      </p>
                    </div>
                    <div className="oui-flex oui-h-9 oui-w-9 oui-items-center oui-justify-center oui-rounded-xl oui-bg-white/[0.06]">
                      <Globe2 size={18} className="oui-text-white/60" />
                    </div>
                  </div>
                </article>
                <article className="oui-rounded-2xl oui-border oui-border-[#b9ff66]/10 oui-bg-[#b9ff66]/[0.04] oui-p-5">
                  <div className="oui-flex oui-items-start oui-justify-between">
                    <div>
                      <p className="oui-text-xs oui-text-white/40">
                        Pages online
                      </p>
                      <p className="oui-mt-2 oui-text-3xl oui-font-semibold oui-text-[#b9ff66]">
                        {enabledCount}
                      </p>
                    </div>
                    <div className="oui-flex oui-h-9 oui-w-9 oui-items-center oui-justify-center oui-rounded-xl oui-bg-[#b9ff66]/10">
                      <Activity size={18} className="oui-text-[#b9ff66]" />
                    </div>
                  </div>
                </article>
                <article className="oui-rounded-2xl oui-border oui-border-white/[0.07] oui-bg-[#10141b] oui-p-5">
                  <div className="oui-flex oui-items-start oui-justify-between">
                    <div>
                      <p className="oui-text-xs oui-text-white/40">
                        Pages offline
                      </p>
                      <p className="oui-mt-2 oui-text-3xl oui-font-semibold oui-text-white/55">
                        {disabledCount}
                      </p>
                    </div>
                    <div className="oui-flex oui-h-9 oui-w-9 oui-items-center oui-justify-center oui-rounded-xl oui-bg-white/[0.06]">
                      <ShieldCheck size={18} className="oui-text-white/45" />
                    </div>
                  </div>
                </article>
              </div>

              <section
                aria-label="Page availability settings"
                className="oui-mt-5 oui-rounded-2xl oui-border oui-border-white/[0.07] oui-bg-[#10141b] oui-overflow-hidden"
              >
                <div className="oui-flex oui-flex-col oui-gap-3 oui-border-b oui-border-white/[0.07] oui-p-5 sm:oui-flex-row sm:oui-items-center sm:oui-justify-between">
                  <div>
                    <h2 className="oui-font-semibold">Website pages</h2>
                    <p className="oui-mt-1 oui-text-xs oui-text-white/35">
                      Control visitor access across the platform
                    </p>
                  </div>
                  <label className="oui-relative oui-block oui-w-full sm:oui-w-64">
                    <Search
                      size={15}
                      className="oui-pointer-events-none oui-absolute oui-left-3 oui-top-1/2 oui-translate-y-[-50%] oui-text-white/30"
                    />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search pages"
                      className="oui-h-10 oui-w-full oui-rounded-lg oui-border oui-border-white/[0.08] oui-bg-black/20 oui-pl-9 oui-pr-3 oui-text-sm oui-outline-none oui-placeholder:text-white/25 oui-focus:border-[#b9ff66]/40"
                    />
                  </label>
                </div>

                <div className="oui-grid oui-gap-px oui-bg-white/[0.06] sm:oui-grid-cols-2 xl:oui-grid-cols-3">
                  {visiblePages.map((page) => {
                    const Icon = pageIcon[page.id] ?? LayoutDashboard;
                    const enabled = flags[page.id];
                    return (
                      <article
                        key={page.id}
                        className="oui-bg-[#10141b] oui-p-4 oui-transition oui-hover:bg-white/[0.018]"
                      >
                        <div className="oui-flex oui-items-start oui-gap-3">
                          <div
                            className={`oui-flex oui-h-10 oui-w-10 oui-shrink-0 oui-items-center oui-justify-center oui-rounded-xl ${
                              enabled
                                ? "oui-bg-[#b9ff66]/10 oui-text-[#b9ff66]"
                                : "oui-bg-white/[0.05] oui-text-white/35"
                            }`}
                          >
                            <Icon size={18} />
                          </div>
                          <div className="oui-min-w-0 oui-flex-1">
                            <div className="oui-flex oui-items-center oui-justify-between oui-gap-3">
                              <h3 className="oui-truncate oui-text-sm oui-font-semibold">
                                {page.label}
                              </h3>
                              <span
                                className={`oui-flex oui-shrink-0 oui-items-center oui-gap-1.5 oui-text-[10px] oui-font-semibold oui-uppercase oui-tracking-wider ${
                                  enabled
                                    ? "oui-text-[#b9ff66]"
                                    : "oui-text-white/35"
                                }`}
                              >
                                <span
                                  className={`oui-h-1.5 oui-w-1.5 oui-rounded-full ${
                                    enabled
                                      ? "oui-bg-[#b9ff66]"
                                      : "oui-bg-white/30"
                                  }`}
                                />
                                {enabled ? "Online" : "Offline"}
                              </span>
                            </div>
                            <p className="oui-mt-1 oui-line-clamp-1 oui-text-xs oui-text-white/35">
                              {pageDescription[page.id]}
                            </p>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={enabled}
                              aria-label={`${page.label} page`}
                              disabled={savingPage !== null}
                              onClick={() => handleToggle(page.id)}
                              className="oui-mt-4 oui-flex oui-w-full oui-items-center oui-justify-between oui-rounded-lg oui-border oui-border-white/[0.07] oui-bg-black/10 oui-p-2"
                            >
                              <span className="oui-pl-1 oui-text-[11px] oui-text-white/45">
                                {savingPage === page.id
                                  ? "Saving..."
                                  : enabled
                                    ? "Public access"
                                    : "Maintenance mode"}
                              </span>
                              <span
                                className={`oui-relative oui-h-6 oui-w-11 oui-rounded-full oui-transition ${
                                  enabled
                                    ? "oui-bg-[#b9ff66]"
                                    : "oui-bg-white/15"
                                }`}
                              >
                                <span
                                  className={`oui-absolute oui-top-1 oui-h-4 oui-w-4 oui-rounded-full oui-shadow oui-transition ${
                                    enabled
                                      ? "oui-left-6 oui-bg-[#17210c]"
                                      : "oui-left-1 oui-bg-white/70"
                                  }`}
                                />
                              </span>
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
                {visiblePages.length === 0 && (
                  <div className="oui-p-10 oui-text-center oui-text-sm oui-text-white/35">
                    No pages match &quot;{query}&quot;
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      ) : (
        <div className="oui-grid oui-min-h-[70vh] oui-place-items-center oui-text-sm oui-text-white/50">
          Admin settings are not available.
        </div>
      )}
    </main>
  );
}
