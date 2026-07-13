import { writeFileSync } from "fs";
import { resolve } from "path";

const BASE_URL = "https://frostdex.pw";

const routes = [
  { path: "/",               priority: "1.0", changefreq: "daily" },
  { path: "/perp",           priority: "0.9", changefreq: "daily" },
  { path: "/markets",        priority: "0.8", changefreq: "hourly" },
  { path: "/portfolio",      priority: "0.7", changefreq: "daily" },
  { path: "/swap",           priority: "0.8", changefreq: "weekly" },
  { path: "/token",          priority: "0.7", changefreq: "weekly" },
  { path: "/rewards",        priority: "0.6", changefreq: "weekly" },
  { path: "/leaderboard",    priority: "0.6", changefreq: "daily" },
  { path: "/referral",       priority: "0.6", changefreq: "weekly" },
  { path: "/vaults",         priority: "0.5", changefreq: "weekly" },
  { path: "/points",         priority: "0.5", changefreq: "weekly" },
  { path: "/bot",            priority: "0.5", changefreq: "weekly" },
  { path: "/about",          priority: "0.4", changefreq: "monthly" },
];

const now = new Date().toISOString().split("T")[0];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map(
    (r) => `  <url>
    <loc>${BASE_URL}${r.path}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

const out = resolve(process.cwd(), "public/sitemap.xml");
writeFileSync(out, xml, "utf-8");
console.log(`✅ Generated: public/sitemap.xml (${routes.length} URLs)`);
