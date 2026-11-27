export const SITE_PAGES = [
  { id: "Trading", label: "Trading", paths: ["/"], prefixes: ["/perp"] },
  {
    id: "Portfolio",
    label: "Portfolio",
    paths: [],
    prefixes: ["/portfolio"],
  },
  { id: "Markets", label: "Markets", paths: ["/markets"], prefixes: [] },
  {
    id: "Announcements",
    label: "Announcements",
    paths: ["/announcements"],
    prefixes: [],
  },
  {
    id: "Leaderboard",
    label: "Leaderboard",
    paths: ["/leaderboard"],
    prefixes: [],
  },
  { id: "Rewards", label: "Rewards", paths: ["/rewards"], prefixes: [] },
  { id: "Vaults", label: "Vaults", paths: ["/vaults"], prefixes: [] },
  { id: "Swap", label: "Swap", paths: ["/swap"], prefixes: [] },
  { id: "Points", label: "Points", paths: ["/points"], prefixes: [] },
  { id: "Bot", label: "Bot", paths: ["/bot"], prefixes: [] },
  {
    id: "AIBot",
    label: "AI Bot Capital Rotation",
    paths: ["/ai-bot"],
    prefixes: [],
  },
  { id: "About", label: "About", paths: ["/about"], prefixes: [] },
  { id: "Token", label: "Token Search", paths: ["/token"], prefixes: [] },
  { id: "Referral", label: "Referral", paths: ["/referral"], prefixes: [] },
  {
    id: "Whitepaper",
    label: "Whitepaper",
    paths: ["/whitepaper"],
    prefixes: [],
  },
] as const;

export type SitePageId = (typeof SITE_PAGES)[number]["id"];
export type SitePageFlags = Record<SitePageId, boolean>;

export const DEFAULT_SITE_PAGE_FLAGS = Object.fromEntries(
  SITE_PAGES.map(({ id }) => [id, true]),
) as SitePageFlags;

export function isSitePageId(value: string): value is SitePageId {
  return SITE_PAGES.some((page) => page.id === value);
}

export function getSitePageIdForPath(pathname: string): SitePageId | undefined {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

  return SITE_PAGES.find(
    (page) =>
      page.paths.some((candidate) => candidate === path) ||
      page.prefixes.some(
        (prefix) => path === prefix || path.startsWith(`${prefix}/`),
      ),
  )?.id;
}
