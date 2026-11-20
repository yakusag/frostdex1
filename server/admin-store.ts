import {
  DEFAULT_SITE_PAGE_FLAGS,
  SITE_PAGES,
  type SitePageFlags,
  type SitePageId,
} from "../shared/site-pages";

const PAGE_FLAGS_KEY = "frostdex:site-page-flags:v1";
const ADMIN_NONCE_PREFIX = "frostdex:admin-nonce:";

export class AdminSetupError extends Error {}

export class AdminStoreError extends Error {}

async function redisCommand(...command: string[]): Promise<unknown> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/+$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new AdminSetupError("Admin storage is not configured.");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });

  let result: { result?: unknown; error?: string };
  try {
    result = (await response.json()) as { result?: unknown; error?: string };
  } catch (error) {
    throw new AdminStoreError("Admin storage returned an invalid response.", {
      cause: error,
    });
  }

  if (!response.ok || result.error) {
    throw new AdminStoreError("Admin storage request failed.");
  }
  return result.result;
}

function isPageFlags(value: unknown): value is SitePageFlags {
  if (!value || typeof value !== "object") return false;
  const flags = value as Record<string, unknown>;
  return SITE_PAGES.every((page) => typeof flags[page.id] === "boolean");
}

export async function getSitePageFlags(): Promise<SitePageFlags> {
  const stored = await redisCommand("GET", PAGE_FLAGS_KEY);
  if (stored === null) return DEFAULT_SITE_PAGE_FLAGS;
  if (typeof stored !== "string") {
    throw new AdminStoreError("Stored site settings are invalid.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch (error) {
    throw new AdminStoreError("Stored site settings are invalid.", {
      cause: error,
    });
  }
  if (!isPageFlags(parsed)) {
    throw new AdminStoreError("Stored site settings are invalid.");
  }
  return parsed;
}

export async function setSitePageEnabled(
  pageId: SitePageId,
  enabled: boolean,
): Promise<SitePageFlags> {
  const current = await getSitePageFlags();
  const updated = { ...current, [pageId]: enabled };
  const result = await redisCommand(
    "SET",
    PAGE_FLAGS_KEY,
    JSON.stringify(updated),
  );
  if (result !== "OK") {
    throw new AdminStoreError("Unable to save site settings.");
  }
  return updated;
}

export async function saveAdminChallenge(
  nonce: string,
  address: string,
  message: string,
): Promise<void> {
  const result = await redisCommand(
    "SET",
    `${ADMIN_NONCE_PREFIX}${nonce}`,
    JSON.stringify({ address, message }),
    "EX",
    "300",
    "NX",
  );
  if (result !== "OK") {
    throw new AdminStoreError("Unable to create an admin login challenge.");
  }
}

export async function consumeAdminChallenge(
  nonce: string,
): Promise<{ address: string; message: string } | null> {
  const stored = await redisCommand("GETDEL", `${ADMIN_NONCE_PREFIX}${nonce}`);
  if (stored === null) return null;
  if (typeof stored !== "string") {
    throw new AdminStoreError("Stored admin challenge is invalid.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch (error) {
    throw new AdminStoreError("Stored admin challenge is invalid.", {
      cause: error,
    });
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("address" in parsed) ||
    !("message" in parsed) ||
    typeof parsed.address !== "string" ||
    typeof parsed.message !== "string"
  ) {
    throw new AdminStoreError("Stored admin challenge is invalid.");
  }
  return { address: parsed.address, message: parsed.message };
}

export async function consumeAdminRateLimit(
  bucket: string,
  maxRequests: number,
): Promise<boolean> {
  const key = `frostdex:admin-rate:${bucket}`;
  const count = await redisCommand("INCR", key);
  if (typeof count !== "number") {
    throw new AdminStoreError("Admin rate limit storage is invalid.");
  }
  if (count === 1) {
    await redisCommand("EXPIRE", key, "60");
  }
  return count <= maxRequests;
}
