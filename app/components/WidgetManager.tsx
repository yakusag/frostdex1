import { useEffect, useState } from "react";

type ThemeMode = "frost" | "standard" | "extra";

const THEME_STORAGE_KEY = "frostdex_theme";
const THEMES: { value: ThemeMode; label: string }[] = [
  { value: "frost", label: "FrostDex" },
  { value: "standard", label: "Standard" },
  { value: "extra", label: "Extra" },
];

function getSavedTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "standard" || saved === "extra") return saved;
  } catch (error) {
    console.warn("Failed to restore theme preference:", error);
  }
  return "frost";
}

interface Props {
  visibility: {
    ai: boolean;
    whale: boolean;
    sentiment: boolean;
    frost: boolean;
    smartmoney: boolean;
    liq: boolean;
    mac: boolean;
    palert: boolean;
  };
  allVisible: boolean;
  onToggle: (
    key:
      | "ai"
      | "whale"
      | "sentiment"
      | "frost"
      | "smartmoney"
      | "liq"
      | "mac"
      | "palert",
  ) => void;
  onShowAll: () => void;
  onHideAll: () => void;
}

const WIDGETS = [
  { key: "frost" as const, label: "FROST Widget", icon: "❄" },
  { key: "ai" as const, label: "FrostAI", icon: "🤖" },
  { key: "whale" as const, label: "Whale Alerts", icon: "🐋" },
  { key: "smartmoney" as const, label: "Smart Money", icon: "🧠" },
  { key: "liq" as const, label: "Liq Heatmap", icon: "🔥" },
  { key: "mac" as const, label: "MAC + Liquidity", icon: "📈" },
  { key: "palert" as const, label: "Price Alerts", icon: "🔔" },
  { key: "sentiment" as const, label: "Market Mood", icon: "📊" },
];

export default function WidgetManager({
  visibility,
  allVisible,
  onToggle,
  onShowAll,
  onHideAll,
}: Props) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(getSavedTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
      console.warn("Failed to save theme preference:", error);
    }
  }, [theme]);

  return (
    <div className="wm-wrap">
      <button
        className="wm-fab"
        onClick={() => setOpen((v) => !v)}
        title="Manage widgets"
      >
        {open ? "✕" : "⠿"}
      </button>

      {open && (
        <div className="wm-panel">
          <div className="wm-title">Widgets</div>
          <div className="wm-theme-label">Theme</div>
          <div className="wm-theme-control" role="group" aria-label="Theme">
            {THEMES.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`wm-theme-option ${theme === item.value ? "wm-theme-option--active" : ""}`}
                aria-pressed={theme === item.value}
                onClick={() => setTheme(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
          {WIDGETS.map((w) => (
            <div key={w.key} className="wm-row">
              <span className="wm-label">
                {w.icon} {w.label}
              </span>
              <button
                className={`wm-toggle ${visibility[w.key] ? "wm-toggle--on" : "wm-toggle--off"}`}
                onClick={() => onToggle(w.key)}
              >
                {visibility[w.key] ? "ON" : "OFF"}
              </button>
            </div>
          ))}

          {allVisible ? (
            <button
              className="wm-show-all"
              onClick={() => {
                onHideAll();
                setOpen(false);
              }}
            >
              Hide All
            </button>
          ) : (
            <button
              className="wm-show-all"
              onClick={() => {
                onShowAll();
                setOpen(false);
              }}
            >
              Show All
            </button>
          )}
        </div>
      )}
    </div>
  );
}
