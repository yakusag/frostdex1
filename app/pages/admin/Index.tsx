import { useCallback, useEffect, useState } from "react";
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

  const handleLogin = async () => {
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
  };

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

  return (
    <main className="oui-mx-auto oui-w-full oui-max-w-4xl oui-px-4 oui-py-10">
      <header className="oui-mb-8 oui-flex oui-items-start oui-justify-between oui-gap-4">
        <div>
          <h1 className="oui-text-3xl oui-font-bold oui-text-base-contrast-80">
            FrostDex Admin
          </h1>
          <p className="oui-mt-2 oui-text-base-contrast-54">
            Manage which site pages are available to visitors.
          </p>
        </div>
        {authenticated && (
          <button
            type="button"
            className="oui-rounded-lg oui-border oui-border-line oui-px-4 oui-py-2"
            disabled={busy}
            onClick={handleLogout}
          >
            Sign out
          </button>
        )}
      </header>

      {(error || sitePagesError) && (
        <div
          role="alert"
          className="oui-mb-6 oui-rounded-lg oui-border oui-border-danger oui-bg-danger/10 oui-p-4 oui-text-danger"
        >
          {error || sitePagesError}
        </div>
      )}

      {checkingSession ? (
        <p role="status" className="oui-text-base-contrast-54">
          Checking admin access...
        </p>
      ) : authenticated && flags ? (
        <section
          aria-label="Page availability settings"
          className="oui-divide-y oui-divide-line oui-rounded-2xl oui-border oui-border-line oui-bg-base-2 oui-px-5"
        >
          {SITE_PAGES.map((page) => (
            <div
              key={page.id}
              className="oui-flex oui-items-center oui-justify-between oui-gap-4 oui-py-4"
            >
              <div>
                <h2 className="oui-font-semibold oui-text-base-contrast-80">
                  {page.label}
                </h2>
                <p className="oui-text-sm oui-text-base-contrast-54">
                  {flags[page.id]
                    ? "Page is available."
                    : "Visitors see a maintenance message."}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={flags[page.id]}
                aria-label={`${page.label} page`}
                disabled={savingPage !== null}
                onClick={() => handleToggle(page.id)}
                className={`oui-min-w-20 oui-rounded-full oui-px-4 oui-py-2 oui-font-semibold ${
                  flags[page.id]
                    ? "oui-bg-success oui-text-base-10"
                    : "oui-bg-base-6 oui-text-base-contrast-54"
                }`}
              >
                {savingPage === page.id
                  ? "Saving..."
                  : flags[page.id]
                    ? "On"
                    : "Off"}
              </button>
            </div>
          ))}
        </section>
      ) : !authenticated ? (
        <section className="oui-rounded-2xl oui-border oui-border-line oui-bg-base-2 oui-p-6">
          <h2 className="oui-text-xl oui-font-semibold oui-text-base-contrast-80">
            Broker owner sign-in
          </h2>
          <p className="oui-mt-2 oui-text-sm oui-text-base-contrast-54">
            Connect the EVM wallet registered as this broker&apos;s admin
            account. Sign-in asks for a message signature only; it never
            requests a transaction or private key.
          </p>
          <div className="oui-mt-5 oui-flex oui-flex-wrap oui-gap-3">
            {!wallet ? (
              <button
                type="button"
                className="oui-rounded-lg oui-bg-primary oui-px-5 oui-py-3 oui-font-semibold oui-text-primary-contrast"
                disabled={busy || connecting}
                onClick={handleConnect}
              >
                {busy || connecting ? "Connecting..." : "Connect wallet"}
              </button>
            ) : (
              <button
                type="button"
                className="oui-rounded-lg oui-bg-primary oui-px-5 oui-py-3 oui-font-semibold oui-text-primary-contrast"
                disabled={busy}
                onClick={handleLogin}
              >
                {busy ? "Verifying wallet..." : "Sign in as broker owner"}
              </button>
            )}
          </div>
        </section>
      ) : (
        <p role="status" className="oui-text-base-contrast-54">
          Admin settings are not available.
        </p>
      )}
    </main>
  );
}
