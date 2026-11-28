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
  DEFAULT_PARAMS, Kalman1D, adaptiveConformalDecision, analyzeMarket, featuresAt, fuseMultiTimeframe,
  newAdaptiveConformalState, normalizeParams, observeAdaptiveConformal, predictPUp, sigma1m, smoothedP, trainEnsemble,
  type AdaptiveConformalState, type Candle, type Ensemble, type MarketInput,
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
const calibrationKey = (network: BotNetwork, symbol: string) =>
  `frostdex:rotation:calibration:v1:${network}:${symbol}`;
const CALIBRATION_HORIZONS = [5, 10, 15] as const;
type CalibrationHorizon = typeof CALIBRATION_HORIZONS[number];

interface PendingCalibrationForecast {
  originTime: number;
  targetTime: number;
  originClose: number;
  pUp: number;
  threshold: number;
}

interface HorizonCalibrationBucket {
  adaptive: AdaptiveConformalState;
  pending: PendingCalibrationForecast[];
  lastForecastTime: number;
}
interface StoredAdaptiveCalibration {
  version: 2;
  horizons: Record<string, HorizonCalibrationBucket>;
}

interface MarketForecast {
  candleTime: number;
  close: number;
  pUp: number;
  price: number;
  sigma: number;
  distZ: number;
  analysis: NonNullable<MarketInput["analysis"]>;
}

// ------------------------------------------------------------ market data

class MarketData {
  symbols: string[] = [];
  prices = new Map<string, number>();
  candles = new Map<string, Candle[]>();
  fetchedAt = new Map<string, number>();
  models = new Map<string, Ensemble>();
  horizonModels = new Map<string, Partial<Record<CalibrationHorizon, Ensemble>>>();
  kalman = new Map<string, Kalman1D>();
  kalmanAt = new Map<string, number>();
  kalmanP = new Map<string, number>();
  rules = new Map<string, SymbolRules>();
  rulesAt = 0;
  calibrations = new Map<string, StoredAdaptiveCalibration>();
  calibrationLoaded = new Set<string>();
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
    if (symbols.length) this.symbols = symbols;
    if (Date.now() - this.rulesAt > 10 * 60_000) {
      this.rules = await loadRules(this.network);
      this.rulesAt = Date.now();
    }
  }

  private async loadCalibration(symbol: string): Promise<StoredAdaptiveCalibration> {
    const cached = this.calibrations.get(symbol);
    if (cached) return cached;
    const emptyBucket = (): HorizonCalibrationBucket => ({
      adaptive: newAdaptiveConformalState(), pending: [], lastForecastTime: 0,
    });
    let state: StoredAdaptiveCalibration = {
      version: 2,
      horizons: Object.fromEntries(CALIBRATION_HORIZONS.map((h) => [String(h), emptyBucket()])),
    };
    if (!this.calibrationLoaded.has(symbol)) {
      try {
        const raw = await redisCommand("GET", calibrationKey(this.network, symbol));
        if (typeof raw === "string") {
          const parsed = JSON.parse(raw) as Partial<StoredAdaptiveCalibration>;
          if (parsed.version === 2 && parsed.horizons && typeof parsed.horizons === "object") {
            for (const horizon of CALIBRATION_HORIZONS) {
              const bucket = (parsed.horizons as Record<string, Partial<HorizonCalibrationBucket>>)[String(horizon)];
              if (!bucket) continue;
              const a = bucket.adaptive;
              if (!a || !Array.isArray(a.scores)) continue;
              state.horizons[String(horizon)] = {
                adaptive: {
                  alpha: Number.isFinite(a.alpha) ? Math.max(0.01, Math.min(0.5, Number(a.alpha))) : 0.1,
                  scores: a.scores.filter((v): v is number => Number.isFinite(v)).slice(-300),
                  observations: Number.isFinite(a.observations) ? Math.max(0, Number(a.observations)) : 0,
                  misses: Number.isFinite(a.misses) ? Math.max(0, Number(a.misses)) : 0,
                },
                pending: Array.isArray(bucket.pending) ? bucket.pending.filter((p): p is PendingCalibrationForecast =>
                  Number.isFinite(p?.originTime) && Number.isFinite(p?.targetTime) &&
                  Number.isFinite(p?.originClose) && p.originClose > 0 &&
                  Number.isFinite(p?.pUp) && p.pUp >= 0 && p.pUp <= 1 &&
                  Number.isFinite(p?.threshold) && p.threshold >= 0 && p.threshold <= 1
                ).slice(-60) : [],
                lastForecastTime: Number.isFinite(bucket.lastForecastTime) ? Number(bucket.lastForecastTime) : 0,
              };
            }
          } else if ((parsed as any).version === 1 && (parsed as any).adaptive) {
            // Preserve the existing 10m calibration history when migrating the Redis key.
            const legacy = parsed as any;
            const bucket = state.horizons["10"];
            bucket.adaptive = legacy.adaptive;
            bucket.pending = Array.isArray(legacy.pending) ? legacy.pending.slice(-60) : [];
            bucket.lastForecastTime = Number.isFinite(legacy.lastForecastTime) ? legacy.lastForecastTime : 0;
          }
        }
      } catch (e) {
        log("calibration load failed", this.network, symbol, (e as Error).message);
      }
      this.calibrationLoaded.add(symbol);
    }
    this.calibrations.set(symbol, state);
    return state;
  }

  private forecast(symbol: string, horizon: CalibrationHorizon = 10): MarketForecast | null {
    const candles = this.candles.get(symbol);
    const model = this.horizonModels.get(symbol)?.[horizon] ?? (horizon === 10 ? this.models.get(symbol) : undefined);
    const price = this.prices.get(symbol);
    if (!candles || !model || !price || candles.length < 121) return null;
    const x = featuresAt(candles, candles.length - 1);
    if (!x) return null;
    const analysis = analyzeMarket(candles);
    if (!analysis) return null;
    const rawP = predictPUp(model, x);
    const fusedP = fuseMultiTimeframe(rawP, analysis);
    const candleTime = candles[candles.length - 1].t;
    const kalmanKey = `${symbol}:${horizon}`;
    let k = this.kalman.get(kalmanKey);
    if (!k) this.kalman.set(kalmanKey, (k = new Kalman1D()));
    // Each horizon owns its own smoother; update once per completed candle.
    if (this.kalmanAt.get(kalmanKey) !== candleTime || !this.kalmanP.has(kalmanKey)) {
      this.kalmanP.set(kalmanKey, smoothedP(k, fusedP));
      this.kalmanAt.set(kalmanKey, candleTime);
    }
    return {
      candleTime,
      close: candles[candles.length - 1].c,
      pUp: this.kalmanP.get(kalmanKey) ?? fusedP,
      price,
      sigma: sigma1m(candles),
      distZ: x[0],
      analysis,
    };
  }

  private async fetchCandles(symbol: string) {
    const to = Math.floor(Date.now() / 1000);
    const from = to - CANDLES_BACK * 60;
    const url = `${API_BASE[this.network]}/v1/tv/history?symbol=${encodeURIComponent(symbol)}&resolution=1&from=${from}&to=${to}`;

    // Public history may return an HTML edge page instead of JSON; retry transient errors.
    let d: any;
    let lastError = "unknown response";
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(url, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(12_000),
          cache: "no-store",
        });
        const contentType = res.headers.get("content-type") ?? "unknown";
        const body = await res.text();
        if (!res.ok) {
          lastError = `HTTP ${res.status} (${contentType}): ${body.slice(0, 180).replace(/\s+/g, " ")}`;
          if (res.status < 500 && res.status !== 429) break;
        } else if (!/application\/(?:[\w.+-]*\+)?json/i.test(contentType)) {
          lastError = `non-JSON response (${contentType}): ${body.slice(0, 180).replace(/\s+/g, " ")}`;
        } else {
          try { d = JSON.parse(body); break; }
          catch { lastError = `invalid JSON response: ${body.slice(0, 180).replace(/\s+/g, " ")}`; }
        }
      } catch (e) {
        lastError = (e as Error).message || String(e);
      }
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** (attempt - 1)));
    }

    if (!d) throw new Error(`${lastError} (after 3 attempts)`);
    if (d.s !== "ok" || !Array.isArray(d.t)) {
      throw new Error(`history API status=${String(d.s)}; ${String(d.errmsg ?? d.message ?? "no candle data")}`);
    }
    const now = Date.now();
    const rows: Candle[] = d.t
      .map((t: number, i: number) => ({
        t: t * 1000, o: Number(d.o?.[i]), h: Number(d.h?.[i]),
        l: Number(d.l?.[i]), c: Number(d.c?.[i]), v: Number(d.v?.[i] ?? 0),
      }))
      .filter((c: Candle) =>
        Number.isFinite(c.t) && c.t > 0 &&
        Number.isFinite(c.o) && Number.isFinite(c.h) &&
        Number.isFinite(c.l) && Number.isFinite(c.c) && c.c > 0 &&
        Number.isFinite(c.v) && c.t + CANDLE_MS <= now - 1_000,
      )
      .sort((a: Candle, b: Candle) => a.t - b.t);
    if (rows.length < 100) {
      throw new Error(`history returned only ${rows.length} completed valid candles; at least 100 required`);
    }

    this.candles.set(symbol, rows);
    this.fetchedAt.set(symbol, now);
    const current = this.horizonModels.get(symbol) ?? {};
    if (!current[5] || !current[10] || !current[15] ||
        Math.max(...CALIBRATION_HORIZONS.map((h) => current[h]?.trainedAt ?? 0)) + RETRAIN_MS < now) {
      const trainedByHorizon: Partial<Record<CalibrationHorizon, Ensemble>> = {};
      for (const horizon of CALIBRATION_HORIZONS) {
        const trained = trainEnsemble(rows, DEFAULT_PARAMS.trees, DEFAULT_PARAMS.eta, now, horizon);
        if (trained) trainedByHorizon[horizon] = trained;
      }
      if (trainedByHorizon[10]) {
        this.horizonModels.set(symbol, trainedByHorizon);
        this.models.set(symbol, trainedByHorizon[10]!);
      }
    }
  }

  /** Refresh stale candles, four requests in parallel, to stay within public rate limits. */
  async refreshCandles() {
    const stale = this.symbols.filter((s) => Date.now() - (this.fetchedAt.get(s) ?? 0) > CANDLE_MS);
    let i = 0;
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (i < stale.length) {
        const symbol = stale[i++];
        try { await this.fetchCandles(symbol); }
        catch (e) { log("candles", symbol, (e as Error).message); }
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
    }));
  }

  /**
   * Independent prequential ACI for 5m, 10m and 15m forecasts.
   * Each horizon has its own model, pending labels, adaptive alpha and score
   * window; outcomes are consumed only after the exact target candle closes.
   */
  async refreshAdaptiveCalibration() {
    for (const symbol of this.symbols) {
      const candles = this.candles.get(symbol);
      const models = this.horizonModels.get(symbol);
      if (!candles || !models || candles.length < 121) continue;
      const state = await this.loadCalibration(symbol);
      const candleByTime = new Map(candles.map((c) => [c.t, c]));
      const latestTime = candles[candles.length - 1].t;
      let changed = false;

      for (const horizon of CALIBRATION_HORIZONS) {
        const bucket = state.horizons[String(horizon)];
        const model = models[horizon];
        if (!bucket || !model) continue;
        const remaining: PendingCalibrationForecast[] = [];

        for (const pending of bucket.pending.sort((a, b) => a.originTime - b.originTime)) {
          const target = candleByTime.get(pending.targetTime);
          if (target && Date.now() >= pending.targetTime + CANDLE_MS) {
            const actualUp = target.c > pending.originClose;
            const nonconformity = actualUp ? 1 - pending.pUp : pending.pUp;
            observeAdaptiveConformal(bucket.adaptive, nonconformity, pending.threshold);
            changed = true;
          } else if (latestTime <= pending.targetTime + 3 * CANDLE_MS) {
            remaining.push(pending);
          } else {
            // Missing target candle: discard without fabricating a realised label.
            changed = true;
          }
        }
        bucket.pending = remaining;

        if (latestTime > bucket.lastForecastTime) {
          const forecast = this.forecast(symbol, horizon);
          if (forecast) {
            const threshold = adaptiveConformalDecision(
              bucket.adaptive, forecast.pUp, model.conformalQ ?? 1,
            ).threshold;
            bucket.pending.push({
              originTime: forecast.candleTime,
              targetTime: forecast.candleTime + horizon * CANDLE_MS,
              originClose: forecast.close,
              pUp: forecast.pUp,
              threshold,
            });
            bucket.pending = bucket.pending.slice(-60);
            bucket.lastForecastTime = forecast.candleTime;
            changed = true;
          }
        }
      }

      if (changed) {
        try {
          await redisCommand("SET", calibrationKey(this.network, symbol), JSON.stringify(state));
        } catch (e) {
          log("calibration save failed", this.network, symbol, (e as Error).message);
        }
      }
    }
  }

  inputs(): MarketInput[] {
    const out: MarketInput[] = [];
    for (const symbol of this.symbols) {
      const forecast = this.forecast(symbol);
      const model = this.models.get(symbol);
      if (!forecast || !model) continue;
      const calibration = this.calibrations.get(symbol);
      const tenMinute = calibration?.horizons["10"];
      const adaptive = tenMinute?.adaptive ?? newAdaptiveConformalState();
      const conformal = adaptiveConformalDecision(adaptive, forecast.pUp, model.conformalQ ?? 1);
      const horizonForecasts: NonNullable<MarketInput["horizonForecasts"]> = {};
      for (const horizon of CALIBRATION_HORIZONS) {
        const horizonForecast = this.forecast(symbol, horizon);
        const bucket = calibration?.horizons[String(horizon)];
        const horizonModel = this.horizonModels.get(symbol)?.[horizon];
        if (!horizonForecast || !horizonModel) continue;
        const decision = adaptiveConformalDecision(
          bucket?.adaptive ?? newAdaptiveConformalState(),
          horizonForecast.pUp,
          horizonModel.conformalQ ?? 1,
        );
        horizonForecasts[String(horizon) as "5" | "10" | "15"] = {
          pUp: horizonForecast.pUp,
          threshold: decision.threshold,
          alpha: decision.alpha,
          observations: bucket?.adaptive.observations ?? 0,
          misses: bucket?.adaptive.misses ?? 0,
          calibrated: decision.calibrated,
        };
      }
      out.push({
        symbol,
        price: forecast.price,
        pUp: forecast.pUp,
        sigma: forecast.sigma,
        distZ: forecast.distZ,
        conformalEligible: conformal.eligible,
        conformalSetSize: conformal.setSize,
        conformalIncludeUp: conformal.includeUp,
        conformalIncludeDown: conformal.includeDown,
        conformalThreshold: conformal.threshold,
        conformalAlpha: conformal.alpha,
        conformalCalibrationSamples: conformal.calibrationSamples,
        conformalCalibrated: conformal.calibrated,
        horizonForecasts,
        analysis: forecast.analysis,
      });
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
        await md.refreshAdaptiveCalibration();
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
