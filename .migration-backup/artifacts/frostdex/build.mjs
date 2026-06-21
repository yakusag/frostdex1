#!/usr/bin/env node
/**
 * FrostDex custom esbuild-based production build.
 * Replaces the slow Vite/Rollup production build (which times out on Replit's
 * constrained environment with 4697 modules) with esbuild — written in Go,
 * handles the same module graph in ~10 seconds.
 *
 * Dev server still uses Vite (hot-reload, fast iteration).
 */
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createRequire } from "module";

// Resolve esbuild from the pnpm virtual store — it lives there as a
// transitive dep of Vite and is NOT in the artifact's own node_modules.
function findEsbuild() {
  const pnpmDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)), "../../node_modules/.pnpm"
  );
  const dirs = fs.readdirSync(pnpmDir).filter(d => d.startsWith("esbuild@"));
  // pick highest version
  dirs.sort((a, b) => {
    const va = a.slice("esbuild@".length).split("_")[0].split(".").map(Number);
    const vb = b.slice("esbuild@".length).split("_")[0].split(".").map(Number);
    for (let i = 0; i < 3; i++) if ((va[i]||0) !== (vb[i]||0)) return (vb[i]||0) - (va[i]||0);
    return 0;
  });
  for (const d of dirs) {
    const p = path.join(pnpmDir, d, "node_modules/esbuild/lib/main.js");
    if (fs.existsSync(p)) return p;
  }
  throw new Error("esbuild not found in pnpm store");
}
const esbuild = await import(findEsbuild());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _require = createRequire(import.meta.url);

// ── polyfill shim paths (from vite-plugin-node-polyfills) ──────────────────
const vpnpMain  = _require.resolve("vite-plugin-node-polyfills");
const vpnpDir   = path.resolve(path.dirname(vpnpMain), "..");
const bufferShim  = path.join(vpnpDir, "shims/buffer/dist/index.cjs");
const processShim = path.join(vpnpDir, "shims/process/dist/index.cjs");

// ── find the MOST COMPLETE viem ESM installation ───────────────────────────
function findCompleteViemDir() {
  const pnpmDir = path.resolve(__dirname, "../../node_modules/.pnpm");
  try {
    const entries = fs.readdirSync(pnpmDir).filter(e => e.startsWith("viem@"));
    entries.sort((a, b) => {
      const va = a.slice("viem@".length).split("_")[0];
      const vb = b.slice("viem@".length).split("_")[0];
      const pa = va.split(".").map(Number);
      const pb = vb.split(".").map(Number);
      for (let i = 0; i < 3; i++) {
        if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pb[i] ?? 0) - (pa[i] ?? 0);
      }
      return a < b ? 1 : -1;
    });
    for (const entry of entries) {
      const viemDir = path.join(pnpmDir, entry, "node_modules/viem");
      if (fs.existsSync(path.join(viemDir, "_esm/clients/createClient.js"))) return viemDir;
    }
  } catch {}
  return null;
}
const viemAlias = findCompleteViemDir() ??
  path.dirname(_require.resolve("viem/package.json"));

// ── viem sub-path cache ────────────────────────────────────────────────────
const viemCache = new Map();
function resolveViem(id) {
  if (viemCache.has(id)) return viemCache.get(id);
  if (id === "viem") {
    const p = path.join(viemAlias, "_esm/index.js");
    viemCache.set(id, p); return p;
  }
  const sub = id.slice("viem/".length);
  const c1 = path.join(viemAlias, "_esm", sub, "index.js");
  if (fs.existsSync(c1)) { viemCache.set(id, c1); return c1; }
  const c2 = path.join(viemAlias, "_esm", sub + ".js");
  if (fs.existsSync(c2)) { viemCache.set(id, c2); return c2; }
  viemCache.set(id, null); return null;
}
// pre-warm common paths
["viem", "viem/chains", "viem/actions", "viem/utils", "viem/clients",
 "viem/errors", "viem/accounts", "viem/contract"].forEach(resolveViem);

// ── esbuild plugins ────────────────────────────────────────────────────────
const viemPlugin = {
  name: "viem-redirect",
  setup(build) {
    build.onResolve({ filter: /^viem($|\/)/ }, args => {
      const resolved = resolveViem(args.path);
      return resolved ? { path: resolved } : null;
    });
  },
};

const es5ExtPlugin = {
  name: "es5-ext-stub",
  setup(build) {
    build.onResolve({ filter: /^es5-ext\// }, args => ({
      path: args.path, namespace: "es5-ext-stub",
    }));
    build.onLoad({ filter: /.*/, namespace: "es5-ext-stub" }, args => {
      const id = args.path;
      if (/array\/#\/e-?index-?of/i.test(id))
        return { contents: "module.exports=function(v){return Array.prototype.indexOf.call(this,v);};" };
      if (/array\/#\/contains/i.test(id))
        return { contents: "module.exports=function(v){return Array.prototype.indexOf.call(this,v)!==-1;};" };
      if (/string\/#\/contains/i.test(id))
        return { contents: "module.exports=function(v){return String.prototype.indexOf.call(this,v)!==-1;};" };
      if (/string\/#\/starts-with/i.test(id))
        return { contents: "module.exports=function(v){return String.prototype.startsWith.call(this,v);};" };
      if (/function\/is-arguments/i.test(id))
        return { contents: "module.exports=function(v){return Object.prototype.toString.call(v)==='[object Arguments]';};" };
      if (/object\/is-object/i.test(id))
        return { contents: "module.exports=function(v){return v!=null&&typeof v==='object';};" };
      if (/object\/valid-callable/i.test(id))
        return { contents: "module.exports=function(v){if(typeof v!=='function')throw new TypeError(v+' is not a function');return v;};" };
      return { contents: "module.exports=function(){};" };
    });
  },
};

// resolve lib/ shim packages that are overridden in root package.json
const shimRoot = path.resolve(__dirname, "../../lib");
const shimPlugin = {
  name: "lib-shims",
  setup(build) {
    build.onResolve({ filter: /^(vite-plugin-node-polyfills\/shims\/)/ }, args => {
      if (args.path.includes("/buffer")) return { path: bufferShim };
      if (args.path.includes("/process")) return { path: processShim };
      return null;
    });
  },
};

// ── output directories ─────────────────────────────────────────────────────
const outDir = path.resolve(__dirname, "dist/public");
const assetsDir = path.join(outDir, "assets");
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(assetsDir, { recursive: true });

// ── copy public/ → dist/public/ ────────────────────────────────────────────
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}
const publicDir = path.join(__dirname, "public");
if (fs.existsSync(publicDir)) copyDir(publicDir, outDir);

// ── run esbuild ─────────────────────────────────────────────────────────────
console.log("esbuild: bundling…");
const t0 = Date.now();

const result = await esbuild.build({
  absWorkingDir: __dirname,
  entryPoints: ["src/main.tsx"],
  bundle: true,
  splitting: true,
  format: "esm",
  outdir: assetsDir,
  minify: true,
  sourcemap: false,
  target: ["es2020", "chrome90", "firefox90", "safari14"],
  jsx: "automatic",
  jsxImportSource: "react",
  metafile: true,
  legalComments: "none",
  treeShaking: true,
  entryNames: "[name]-[hash]",
  chunkNames: "chunk-[hash]",
  assetNames: "[name]-[hash]",
  loader: {
    ".png": "file", ".webp": "file", ".svg": "file",
    ".jpg": "file", ".jpeg": "file", ".gif": "file",
    ".woff": "file", ".woff2": "file", ".ttf": "file", ".eot": "file",
    ".mp4": "file", ".webm": "file",
    ".json": "json",
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    "process.browser":      "true",
    "global":               "globalThis",
  },
  inject: [
    processShim,
    bufferShim,
  ],
  alias: {
    "@": path.join(__dirname, "src"),
    "@assets": path.join(__dirname, "../../attached_assets"),
  },
  plugins: [viemPlugin, es5ExtPlugin, shimPlugin],
  logLevel: "warning",
});

const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`esbuild: done in ${elapsed}s`);

// ── inject into index.html ─────────────────────────────────────────────────
const outputs = result.metafile.outputs;
const assetsPrefix = "dist/public/assets/";

let mainJsFile = null;
let mainCssFile = null;

for (const [outPath, meta] of Object.entries(outputs)) {
  if (meta.entryPoint === "src/main.tsx") {
    mainJsFile = "/" + outPath.replace(/^dist\/public\//, "");
  }
  if (outPath.endsWith(".css") && !outPath.includes("chunk-")) {
    mainCssFile = "/" + outPath.replace(/^dist\/public\//, "");
  }
}

// Also look for the CSS associated with the main entry
for (const [outPath] of Object.entries(outputs)) {
  if (!mainCssFile && outPath.endsWith(".css")) {
    mainCssFile = "/" + outPath.replace(/^dist\/public\//, "");
  }
}

const indexSrc = path.join(__dirname, "index.html");
let html = fs.readFileSync(indexSrc, "utf8");

// Remove the Vite dev entry script tag
html = html.replace(/<script[^>]+type="module"[^>]+src="\/src\/main\.tsx"[^>]*><\/script>/g, "");

// Inject before </body>
const injectTags = [
  mainCssFile ? `  <link rel="stylesheet" href="${mainCssFile}">` : "",
  mainJsFile  ? `  <script type="module" src="${mainJsFile}"></script>` : "",
].filter(Boolean).join("\n");

html = html.replace("</body>", `${injectTags}\n</body>`);

fs.writeFileSync(path.join(outDir, "index.html"), html);

// ── summary ────────────────────────────────────────────────────────────────
const jsFiles  = Object.keys(outputs).filter(f => f.endsWith(".js")).length;
const cssFiles = Object.keys(outputs).filter(f => f.endsWith(".css")).length;
const totalKb  = Object.values(outputs)
  .reduce((s, o) => s + (o.bytes ?? 0), 0) / 1024;

console.log(`✓ ${jsFiles} JS chunks, ${cssFiles} CSS files, ${Math.round(totalKb)} kB total`);
console.log(`  main JS:  ${mainJsFile ?? "(not found)"}`);
console.log(`  main CSS: ${mainCssFile ?? "(not found)"}`);
console.log(`  output:   ${outDir}`);
