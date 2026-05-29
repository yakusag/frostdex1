const domain = process.env.EXPO_PUBLIC_DOMAIN ?? "";

export function getWebAppUrl(path: string = ""): string {
  if (!domain) {
    return path ? `/${path.replace(/^\//, "")}` : "/";
  }
  return `https://${domain}${path.startsWith("/") ? path : `/${path}`}`;
}

export const WEB_APP_BASE = domain ? `https://${domain}` : "";
