import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_SITE_PAGE_FLAGS,
  SITE_PAGES,
  type SitePageFlags,
} from "../../shared/site-pages";

type SitePagesContextValue = {
  flags: SitePageFlags;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};
type SitePagesState = Omit<SitePagesContextValue, "refresh">;

const SitePagesContext = createContext<SitePagesContextValue | null>(null);

function isSitePageResponse(value: unknown): value is { pages: SitePageFlags } {
  if (!value || typeof value !== "object") return false;
  const pages = (value as Record<string, unknown>).pages;
  if (!pages || typeof pages !== "object") return false;
  const pageValues = pages as Record<string, unknown>;
  return SITE_PAGES.every((page) => typeof pageValues[page.id] === "boolean");
}

export function SitePagesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SitePagesState>({
    flags: DEFAULT_SITE_PAGE_FLAGS,
    loading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/site-pages", {
        headers: { Accept: "application/json" },
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        const message =
          body &&
          typeof body === "object" &&
          "error" in body &&
          typeof body.error === "string"
            ? body.error
            : `Unable to load site settings (${response.status}).`;
        throw new Error(message);
      }
      if (!isSitePageResponse(body)) {
        throw new Error("The site settings response is invalid.");
      }
      setState({ flags: body.pages, loading: false, error: null });
    } catch (error: unknown) {
      console.error("Failed to load site page settings:", error);
      setState({
        flags: DEFAULT_SITE_PAGE_FLAGS,
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load site settings.",
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <SitePagesContext.Provider value={{ ...state, refresh }}>
      {children}
    </SitePagesContext.Provider>
  );
}

export function useSitePages() {
  const context = useContext(SitePagesContext);
  if (!context) {
    throw new Error("useSitePages must be used within SitePagesProvider.");
  }
  return context;
}
