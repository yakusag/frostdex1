import { useEffect, useState, useCallback } from "react";
import { withBasePath } from "../utils/base-path";

const STORAGE_KEY = "frost-pwa-dismissed";

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true
  );
}

export default function PWAInstallBanner() {
  const [show, setShow]           = useState(false);
  const [ios, setIos]             = useState(false);
  const [deferredPrompt, setDeferred] = useState<any>(null);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return;
    if (isStandalone()) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e);
      setShow(true);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);

    if (isIOS()) {
      setIos(true);
      setShow(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "1");
    setShow(false);
  }, []);

  const installAndroid = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    localStorage.setItem(STORAGE_KEY, "1");
    setDeferred(null);
    setShow(false);
  }, [deferredPrompt]);

  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 99990,
        background: "linear-gradient(135deg, #0d1219 0%, #111827 100%)",
        borderTop: "1px solid rgba(56,224,248,0.22)",
        boxShadow: "0 -4px 32px rgba(56,224,248,0.08)",
        padding: "16px 20px",
        fontFamily: "Manrope, 'Segoe UI', sans-serif",
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
        animation: "pwa-slide-up 0.35s cubic-bezier(0.34,1.56,0.64,1) both",
      }}
    >
      <style>{`
        @keyframes pwa-slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      <img
        src={withBasePath("/icon-192.png")}
        alt="FrostDex"
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          flexShrink: 0,
          border: "1px solid rgba(56,224,248,0.2)",
        }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
            Install FrostDex
          </span>
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "rgba(255,255,255,0.4)",
              fontSize: 18,
              lineHeight: 1,
              padding: "0 2px",
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2, marginBottom: 10 }}>
          {ios
            ? "Add to your Home Screen for quick access"
            : "Install the app for a faster, native-like experience"}
        </div>

        {ios ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <IOSStep n={1} text={<>Tap the <ShareIcon /> <strong style={{ color: "#fff" }}>Share</strong> button in Safari</>} />
            <IOSStep n={2} text={<>Scroll down and tap <strong style={{ color: "#fff" }}>Add to Home Screen</strong></>} />
            <IOSStep n={3} text={<>Tap <strong style={{ color: "#fff" }}>Add</strong> — done!</>} />
          </div>
        ) : (
          <button
            onClick={installAndroid}
            style={{
              background: "linear-gradient(135deg, rgba(56,224,248,0.15), rgba(14,203,129,0.1))",
              border: "1px solid rgba(56,224,248,0.4)",
              borderRadius: 8,
              padding: "7px 18px",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 700,
              color: "rgb(56,224,248)",
              fontFamily: "Manrope, sans-serif",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            ⬇ Install App
          </button>
        )}
      </div>
    </div>
  );
}

function IOSStep({ n, text }: { n: number; text: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "rgba(56,224,248,0.15)",
          border: "1px solid rgba(56,224,248,0.3)",
          color: "rgb(56,224,248)",
          fontSize: 11,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {n}
      </span>
      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>{text}</span>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline", verticalAlign: "middle", color: "rgb(56,224,248)" }}
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}
