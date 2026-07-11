import { useEffect, useState } from "react";
import { X, Download } from "lucide-react";

export default function PWAInstallPrompt() {
  const [prompt, setPrompt] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (dismissed) return;
    if (sessionStorage.getItem("pwa-dismissed")) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler as any);
    return () => window.removeEventListener("beforeinstallprompt", handler as any);
  }, [dismissed]);

  const handleInstall = async () => {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") {
      setVisible(false);
      setDismissed(true);
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    setDismissed(true);
    sessionStorage.setItem("pwa-dismissed", "1");
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "80px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 99998,
        width: "calc(100% - 32px)",
        maxWidth: "400px",
        background: "linear-gradient(135deg, #0d1219 0%, #111827 100%)",
        border: "1px solid rgba(56,224,248,0.25)",
        borderRadius: "16px",
        padding: "16px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(56,224,248,0.08)",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        animation: "pwa-slide-up 0.4s cubic-bezier(0.34,1.56,0.64,1) both",
      }}
    >
      <style>{`
        @keyframes pwa-slide-up {
          from { opacity: 0; transform: translateX(-50%) translateY(24px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>

      <img
        src="/favicon.webp"
        alt="FrostDex"
        style={{ width: "44px", height: "44px", borderRadius: "10px", flexShrink: 0 }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: "#ffffff", fontWeight: 700, fontSize: "14px", margin: 0 }}>
          Install FrostDex
        </p>
        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "12px", margin: "2px 0 0" }}>
          Add to home screen for the full experience
        </p>
      </div>

      <button
        onClick={handleInstall}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          background: "rgba(56,224,248,0.15)",
          color: "rgba(56,224,248,0.9)",
          border: "1px solid rgba(56,224,248,0.3)",
          borderRadius: "10px",
          padding: "8px 14px",
          fontSize: "13px",
          fontWeight: 700,
          cursor: "pointer",
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}
      >
        <Download size={13} />
        Install
      </button>

      <button
        onClick={handleDismiss}
        style={{
          background: "none",
          border: "none",
          color: "rgba(255,255,255,0.3)",
          cursor: "pointer",
          padding: "4px",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
