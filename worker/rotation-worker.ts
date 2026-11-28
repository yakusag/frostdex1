// Frostdex Capital Rotation — 24/7 worker.
// Run it on an always-on host (Railway / Fly / VPS), NOT on Vercel serverless:
//   yarn worker
// Required env: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, BOT_KEY_ENCRYPTION_KEY
// Optional env: BOT_MAINNET_ENABLED=true, BOT_NETWORKS=testnet,mainnet, PORT
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { decryptOrderlySecret } from "../server/bot-key-vault.js";
import {
  getOrderlyKey, listBotConfigs, listBotOwners,
  type BotNetwork, type BotWorkerConfig,
} from "../server/bot-store.js";
import { redisCommand } from "../server/redis.js";
import {
  DEFAULT_PARAMS, Kalman1D, featuresAt, normalizeParams, predictPUp, sigma1m,
  smoothedP, trainEnsemble, type Candle, type Ensemble, type MarketInput,
} from "../shared/rotation/engine.js";
import {
  PaperBroker, closePosition, newState, tick,
  type Broker, type RotationState,
} from "../shared/rotation/runner.js";
import {
  API_BASE, OrderlyBroker, OrderlyClient, loadRules, normalizeQty,
  type SymbolRules,
} from "./orderly.js";

const TICK_MS = 10_000;
const CONFIG_MS = 30_000;
const CANDLE_MS = 60_000;
const RETRAIN_MS = 30 * 60_000;
const CANDLES_BACK = 720;
const WORKER_ID = randomBytes(6).toString("hex");

const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);
const stateKey = (n: BotNetwork, owner: string, id: string) =>
  `frostdex:rotation:state:${n}:${owner.toLowerCase()}:${id}`;

// ------------------------------------------------------------ market data

class MarketData {
  symbols: string[] = [];
  prices = new Map<string, number>();
  candles = new Map<string, Candle[]>();
  fetchedAt = new Map<string, number>();
  models = new Map<string, Ensemble>();
  kalman = new Map<string, Kalman1D>();
  rules = new Map<string, SymbolRules>();
  rulesAt = 0;
  constructor(readonly network: BotNetwork) {}

  async refreshPrices() {
    const res = await fetch(`${API_BASE[this.network]}/v1/public/futures`, { cache: "no-store" });
    const body = (await res.json()) as any;
    const symbols: string[] = [];
    for (const r of body?.data?.rows ?? []) {
      if (!/^PERP_.+_USDC$/.test(String(r.symbol)) || r.status === "DELISTING") continue;
      const px = Number(r.mark_price ?? r.index_price);
      if (px > 0) {
        symbols.push(r.symbol);
        this.prices.set(r.symbol, px);
      }
    }
    if (symbols.length) this.symbols = symbols; // the full list shown on the Markets page
    if (Date.now() - this.rulesAt > 10 * 60_000) {
      this.rules = await loadRules(this.network);
      this.rulesAt = Date.now();
    }
  }

  private async fetchCandles(symbol: string) {
    const to = Math.floor(Date.now() / 1000);
    const from = to - CANDLES_BACK * 60;
    const res = await fetch(
      `${API_BASE[this.network]}/v1/tv/history?symbol=${encodeURIComponent(symbol)}&resolution=1&from=${from}&to=${to}`,
    );
    const d = (await res.json()) as any;
    if (d?.s !== "ok" || !Array.isArray(d.t)) return;
    const rows: Candle[] = d.t
      .map((t: number, i: number) => ({ t: t * 1000, o: +d.o[i], h: +d.h[i], l: +d.l[i], c: +d.c[i], v: +d.v[i] }))
      .filter((c: Candle) => c.t > 0 && c.c > 0);
    if (rows.length < 100) return;
    this.candles.set(symbol, rows);
    this.fetchedAt.set(symbol, Date.now());
    const m = this.models.get(symbol);
    if (!m || Date.now() - m.trainedAt > RETRAIN_MS) {
      const trained = trainEnsemble(rows, DEFAULT_PARAMS.trees, DEFAULT_PARAMS.eta);
      if (trained) this.models.set(symbol, trained);
    }
  }

  /** Refresh stale candles, 4 requests in parallel, to stay within public rate limits. */
  async refreshCandles() {
    const stale = this.symbols.filter((s) => Date.now() - (this.fetchedAt.get(s) ?? 0) > CANDLE_MS);
    let i = 0;
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        while (i < stale.length) {
          const s = stale[i++];
          try { await this.fetchCandles(s); } catch (e) { log("candles", s, (e as Error).message); }
          await new Promise((r) => setTimeout(r, 120));
        }
      }),
    );
  }

  inputs(): MarketInput[] {
    const out: MarketInput[] = [];
    for (const symbol of this.symbols) {
      const candles = this.candles.get(symbol);
      const model = this.models.get(symbol);
      const price = this.prices.get(symbol);
      if (!candles || !model || !price) continue;
      const x = featuresAt(candles, candles.length - 1);
      if (!x) continue;
      let k = this.kalman.get(symbol);
      if (!k) this.kalman.set(symbol, (k = new Kalman1D()));
      out.push({ symbol, price, pUp: smoothedP(k, predictPUp(model, x)), sigma: sigma1m(candles) });
    }
    return out;
  }
}

// ---------------------------------------------------------------- bot runs

interface Run {
  config: BotWorkerConfig;
  state: RotationState;
  broker: Broker;
  live?: OrderlyBroker;
}

const runs = new Map<string, Run>();
const markets: Record<BotNetwork, MarketData> = {
  testnet: new MarketData("testnet"),
  mainnet: new MarketData("mainnet"),
};

async function saveState(r: Run) {
  const { network, ownerAddress, id } = r.config;
  await redisCommand("SET", stateKey(network, ownerAddress, id), JSON.stringify(r.state));
}

async function loadState(c: BotWorkerConfig): Promise<RotationState | null> {
  const raw = await redisCommand("GET", stateKey(c.network, c.ownerAddress, c.id));
  if (typeof raw !== "string") return null;
  try {
    const s = JSON.parse(raw) as RotationState;
    return s.version === 1 ? s : null;
  } catch { return null; }
}

async function buildRun(c: BotWorkerConfig): Promise<Run> {
  const params = normalizeParams(c.params);
  const mode = c.liveMode ? "live" : "paper";
  let state = await loadState(c);
  if (state && state.mode !== mode && state.positions.length) {
    throw new Error("switching paper/live with open positions is not allowed; stop the bot first");
  }
  if (!state || state.mode !== mode) state = newState(mode, c.investment);
  if (!c.liveMode) return { config: c, state, broker: new PaperBroker(params) };

  const stored = await getOrderlyKey(c.ownerAddress, c.network);
  if (!stored) throw new Error("no Orderly key configured");
  const secret = decryptOrderlySecret(stored.encryptedSecret, c.ownerAddress, stored.orderlyKey);
  const client = new OrderlyClient(c.network, stored.accountId, stored.orderlyKey, secret);
  const md = markets[c.network];
  const live = new OrderlyBroker(client, md.rules, params.leverage, params.feeRate);
  // reconcile: drop positions the user already closed by hand
  const open = await live.openSymbols();
  for (const p of [...state.positions]) {
    if (Math.abs(open.get(p.symbol) ?? 0) < 1e-12) {
      state.positions = state.positions.filter((x) => x.id !== p.id);
      state.trace.push({ t: Date.now(), kind: "info", text: `${p.symbol} no longer open on exchange; removed` });
    }
  }
  return { config: c, state, broker: live, live };
}

async function reconcileConfigs(networks: BotNetwork[]) {
  const wanted = new Set<string>();
  for (const network of networks) {
    for (const owner of await listBotOwners(network)) {
      for (const c of await listBotConfigs(owner, network)) {
        if (c.strategy !== "rotation") continue;
        const key = `${network}:${owner}:${c.id}`;
        wanted.add(key);
        const existing = runs.get(key);
        if (existing && existing.config.updatedAt === c.updatedAt) continue;
        if (existing) {
          existing.config = c; // status / params changed; broker rebuilt only on mode change
          if ((existing.state.mode === "live") !== c.liveMode) runs.delete(key);
          else continue;
        }
        try {
          runs.set(key, await buildRun(c));
          log("bot loaded", key, c.liveMode ? "LIVE" : "paper", c.status);
        } catch (e) {
          log("bot load failed", key, (e as Error).message);
        }
      }
    }
  }
  for (const key of [...runs.keys()]) if (!wanted.has(key)) runs.delete(key); // config deleted
}

async function runBot(r: Run) {
  const md = markets[r.config.network];
  const params = normalizeParams(r.config.params);
  const running = r.config.status === "running";
  const stopped = r.config.status === "stopped";
  const prices = new Map(md.prices);

  // A user-requested single-position close is queued by the authenticated API.
  const commandKey = `frostdex:rotation:command:${r.config.network}:${r.config.ownerAddress.toLowerCase()}:${r.config.id}`;
  const rawCommand = await redisCommand("GETDEL", commandKey);
  if (typeof rawCommand === "string") {
    try {
      const command = JSON.parse(rawCommand) as { action?: string; positionId?: string };
      if (command.action === "close" && typeof command.positionId === "string") {
        const pos = r.state.positions.find((p) => p.id === command.positionId);
        if (pos) await closePosition(r.state, pos, prices.get(pos.symbol) ?? pos.entry, "user_closed", r.broker, Date.now());
      }
    } catch (e) { log("invalid rotation command", (e as Error).message); }
  }

  // Stop is the only status that flattens the whole portfolio. Pause keeps
  // positions open and continues managing their exits without opening entries.
  if (stopped && r.state.positions.length) {
    for (const p of [...r.state.positions]) {
      try { await closePosition(r.state, p, prices.get(p.symbol) ?? p.entry, "bot_stopped", r.broker, Date.now()); }
      catch (e) { log("flatten failed", p.symbol, (e as Error).message); }
    }
  }
  if (r.live) {
    // live broker needs the freshest rules for sizing
    (r.live as any).rules = md.rules;
  }
  await tick(r.state, params, prices, md.inputs(), r.broker, { tradingEnabled: running });
  await saveState(r);
}

// ---------------------------------------------------------------- main loop

async function acquireLock(network: BotNetwork): Promise<boolean> {
  const key = `frostdex:rotation:lock:${network}`;
  const got = await redisCommand("SET", key, WORKER_ID, "NX", "EX", "45");
  if (got === "OK") return true;
  if ((await redisCommand("GET", key)) === WORKER_ID) {
    await redisCommand("EXPIRE", key, "45");
    return true;
  }
  return false;
}

async function main() {
  const mainnetOn = process.env.BOT_MAINNET_ENABLED === "true";
  const configuredNetworks = (process.env.BOT_NETWORKS ?? (mainnetOn ? "testnet,mainnet" : "testnet"))
    .split(",").map((s) => s.trim())
    .filter((n): n is BotNetwork => n === "testnet" || (n === "mainnet" && mainnetOn));
  // Guest simulations always use Testnet, even if the operator configured Mainnet only.
  const networks: BotNetwork[] = [...new Set<BotNetwork>(["testnet", ...configuredNetworks])];
  log(`Frostdex Capital Rotation worker ${WORKER_ID} — networks: ${networks.join(", ")}`);

  const port = Number(process.env.PORT);
  if (port) {
    createServer((_q, res) => { res.end(JSON.stringify({ ok: true, runs: runs.size })); }).listen(port);
  }

  let lastConfig = 0;
  for (;;) {
    const started = Date.now();
    try {
      const owned: BotNetwork[] = [];
      for (const n of networks) if (await acquireLock(n)) owned.push(n);
      if (Date.now() - lastConfig > CONFIG_MS) {
        await reconcileConfigs(owned);
        lastConfig = Date.now();
      }
      for (const n of owned) {
        const md = markets[n];
        await md.refreshPrices();
        await md.refreshCandles();
      }
      for (const [key, r] of runs) {
        if (!owned.includes(r.config.network)) continue;
        try { await runBot(r); } catch (e) { log("bot error", key, (e as Error).message); }
      }
    } catch (e) {
      log("loop error", (e as Error).message);
    }
    await new Promise((res) => setTimeout(res, Math.max(1000, TICK_MS - (Date.now() - started))));
  }
}

void normalizeQty; // re-exported helper kept for tests/tools
main();
