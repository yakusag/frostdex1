import { useEffect, useState } from "react";
import { Palette } from "lucide-react";

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

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState<ThemeMode>(getSavedTheme);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.ouiTheme =
      theme === "standard" ? "light" : "dark";
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
      console.warn("Failed to save theme preference:", error);
    }
    window.dispatchEvent(new Event("frostdex-theme-change"));
  }, [theme]);

  return (
    <div className="theme-switcher">
      <button
        type="button"
        className="theme-switcher__trigger"
        aria-label="Change appearance"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Change appearance"
        onClick={() => setOpen((value) => !value)}
      >
        <Palette size={17} aria-hidden="true" />
      </button>
      {open && (
        <div className="theme-switcher__menu" role="menu" aria-label="Theme">
          {THEMES.map((item) => (
            <button
              key={item.value}
              type="button"
              role="menuitemradio"
              aria-checked={theme === item.value}
              className={`theme-switcher__option${theme === item.value ? " theme-switcher__option--active" : ""}`}
              onClick={() => {
                setTheme(item.value);
                setOpen(false);
              }}
            >
              <span>{item.label}</span>
              {theme === item.value && (
                <span className="theme-switcher__check" aria-hidden="true">
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
