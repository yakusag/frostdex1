import { useState, useCallback } from "react";

const STORAGE_KEY = "frost-widget-visibility";

interface Visibility {
  ai: boolean;
  whale: boolean;
  sentiment: boolean;
  frost: boolean;
  smartmoney: boolean;
  heatmap: boolean;
  macdRsi: boolean;
}

const DEFAULTS: Visibility = { ai: true, whale: true, sentiment: true, frost: true, smartmoney: true, heatmap: true, macdRsi: true };

function load(): Visibility {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...DEFAULTS, ...JSON.parse(saved) };
  } catch {}
  return { ...DEFAULTS };
}

export function useWidgetVisibility() {
  const [visibility, setVisibility] = useState<Visibility>(load);

  const toggle = useCallback((key: keyof Visibility) => {
    setVisibility(prev => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const showAll = useCallback(() => {
    setVisibility(DEFAULTS);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULTS)); } catch {}
  }, []);

  const anyHidden = (Object.keys(DEFAULTS) as (keyof Visibility)[]).some(k => !visibility[k]);

  return { visibility, toggle, showAll, anyHidden };
}
