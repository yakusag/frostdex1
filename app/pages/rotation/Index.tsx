import { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useAccount, useWalletConnector } from "@orderly.network/hooks";

type Network = "testnet" | "mainnet";
const TITLE = "AI Bot Frostdex Capital Rotation";
const MIN_CAPITAL = 10; // USDC

interface Position { id: string; symbol: string; side: "LONG" | "SHORT"; entry: number; qty: number; margin: number; openedAt: number; slDist: number; tpDist: number; score: number; markPrice?: number; unrealizedPnl?: number; recommendation?: "HOLD" | "CLOSE" | "PAUSE" | "STOP"; recommendationReason?: string }
interface Trade { id: string; symbol: string; side: string; pnl: number; reason: string; closedAt: number; entry: number; exit: number }
interface Candidate { symbol: string; side: string; pTP: number; score: number; tauMin: number; expectedNet: number }
interface RotationState {
  mode: "paper" | "live"; startEquity: number; balance: number; equity: number;
  haltedReason: string | null; positions: Position[]; trades: Trade[]; ranked: Candidate[];
  trace: { t: number; kind: string; text: string }[];
  stats: { wins: number; losses: number; longs: number; shorts: number; passes: number; pnl: number };
  heartbeat: number;
}
interface BotConfig {
  id: string; strategy: string; symbol: string; investment: number; liveMode: boolean;
  status: "running" | "stopped" | "paused"; params: Record<string, string | number>; network: Network; updatedAt: number;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json;
}

const usd = (n: number) => `${n >= 0 ? "+" : "−"}$${Math.abs(n).toFixed(2)}`;
const card = "rounded-xl border border-white/10 bg-white/5 p-4";
const input = "w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-sky-400";
const btn = "rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-40";

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div className={card}>
      <div className="text-xs text-white/50">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${tone === "up" ? "text-emerald-400" : tone === "down" ? "text-rose-400" : "text-white"}`}>{value}</div>
    </div>
  );
}

export default function RotationPage() {
  const { state: account } = useAccount();
  const { wallet } = useWalletConnector();
  const address = account.address;

  const [network, setNetwork] = useState<Network>("testnet");
  const [live, setLive] = useState(false);
  const [capital, setCapital] = useState(100);
  const [leverage, setLeverage] = useState(5);
  const [maxPositions, setMaxPositions] = useState(3);
  const [tpR, setTpR] = useState(2);
  const [slPct, setSlPct] = useState(0.4);
  const [timeStopMin, setTimeStopMin] = useState(20);
  const [dailyLossPct, setDailyLossPct] = useState(5);

  const [authed, setAuthed] = useState(false);
  const [guest, setGuest] = useState(false);
  const [keyConfigured, setKeyConfigured] = useState(false);
  const [bot, setBot] = useState<BotConfig | null>(null);
  const [rot, setRot] = useState<RotationState | null>(null);
  const [workerOnline, setWorkerOnline] = useState(false);
  const [universe, setUniverse] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [keyForm, setKeyForm] = useState({ orderlyKey: "", secretKey: "" });

  const capitalOk = Number.isFinite(capital) && capital >= MIN_CAPITAL;

  // every perp shown on the Markets page
  useEffect(() => {
    fetch("https://api.orderly.org/v1/public/futures")
      .then((r) => r.json())
      .then((b: { data?: { rows?: { symbol: string; status?: string }[] } }) =>
        setUniverse((b.data?.rows ?? []).filter((r) => /^PERP_.+_USDC$/.test(r.symbol) && r.status !== "DELISTING").map((r) => r.symbol)))
      .catch(() => undefined);
  }, []);

  const refreshAccount = useCallback(async () => {
    try {
      const a = await api<{ authenticated: boolean; address: string | null; guest?: boolean }>("/api/bots/auth");
      const isGuest = Boolean(a.authenticated && a.guest);
      const ok = isGuest || (a.authenticated && !!address && a.address?.toLowerCase() === address.toLowerCase());
      setGuest(isGuest);
      setAuthed(ok);
      if (!ok) { setBot(null); setKeyConfigured(false); return; }
      const [k, c] = await Promise.all([
        isGuest ? Promise.resolve({ configured: false }) : api<{ configured: boolean }>(`/api/bots/keys?network=${network}`),
        api<{ bots: BotConfig[] }>(`/api/bots/config?network=${network}`),
      ]);
      setKeyConfigured(k.configured);
      const mine = c.bots.filter((b) => b.strategy === "rotation").sort((a2, b2) => b2.updatedAt - a2.updatedAt)[0] ?? null;
      setBot(mine);
      if (mine) {
        setLive(mine.liveMode);
        setCapital(mine.investment);
      }
    } catch (e) {
      setMsg((e as Error).message);
    }
  }, [address, network]);

  useEffect(() => { void refreshAccount(); }, [refreshAccount]);

  useEffect(() => {
    if (!authed || !bot) { setRot(null); return; }
    let alive = true;
    const poll = async () => {
      try {
        const r = await api<{ state: RotationState | null; workerOnline: boolean }>(`/api/bots/rotation?network=${network}&id=${bot.id}`);
        if (alive) { setRot(r.state); setWorkerOnline(r.workerOnline); }
      } catch { /* keep last state */ }
    };
    void poll();
    const t = setInterval(poll, 5000);
    return () => { alive = false; clearInterval(t); };
  }, [authed, bot, network]);

  const startGuest = async () => {
    setBusy(true); setMsg(null);
    try {
      await api("/api/bots/auth", { method: "POST", body: JSON.stringify({ action: "guest" }) });
      setNetwork("testnet");
      setMsg("Private guest simulation session created. No wallet or real funds are used.");
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };

  const signIn = async () => {
    if (!address) return setMsg("Connect your wallet first.");
    setBusy(true); setMsg(null);
    try {
      const ch = await api<{ nonce: string; message: string }>("/api/bots/auth", { method: "POST", body: JSON.stringify({ action: "challenge", address }) });
      const provider = (wallet?.provider ?? (window as unknown as { ethereum?: unknown }).ethereum) as
        | { request: (a: { method: string; params: unknown[] }) => Promise<string> } | undefined;
      if (!provider) throw new Error("No wallet provider available.");
      const signature = await provider.request({ method: "personal_sign", params: [ch.message, address] });
      await api("/api/bots/auth", { method: "POST", body: JSON.stringify({ action: "login", address, nonce: ch.nonce, signature }) });
      await refreshAccount();
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };

  const saveKey = async () => {
    setBusy(true); setMsg(null);
    try {
      await api("/api/bots/keys", {
        method: "PUT",
        body: JSON.stringify({ network, accountId: account.accountId, scope: "read,trading", orderlyKey: keyForm.orderlyKey.trim(), secretKey: keyForm.secretKey.trim() }),
      });
      setKeyForm({ orderlyKey: "", secretKey: "" });
      await refreshAccount();
      setMsg("Trading key saved (encrypted).");
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };

  const save = async (status: "running" | "stopped" | "paused", fresh = false) => {
    if (!capitalOk) return setMsg(`Minimum capital is ${MIN_CAPITAL} USDC.`);
    if (live && !keyConfigured) return setMsg("Live mode needs a trading key (see step 2).");
    setBusy(true); setMsg(null);
    try {
      const id = fresh || !bot ? `ROT-${Date.now().toString(36).toUpperCase()}` : bot.id;
      await api("/api/bots/config", {
        method: "PUT",
        body: JSON.stringify({
          id, network, strategy: "rotation", symbol: "PERP_ALL_USDC", investment: capital, liveMode: live, status,
          params: { leverage, maxPositions, tpR, slPct, timeStopMin, dailyLossPct, universe: "all" },
        }),
      });
      await refreshAccount();
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };

  const running = bot?.status === "running";
  const paused = bot?.status === "paused";
  const control = async (action: "pause" | "resume" | "stop" | "close", positionId?: string) => {
    if (!bot) return;
    setBusy(true); setMsg(null);
    try {
      const result = await api<{ queued?: boolean; status?: string }>(`/api/bots/rotation?network=${network}&id=${bot.id}`, {
        method: "POST", body: JSON.stringify({ action, ...(positionId ? { positionId } : {}) }),
      });
      if (action === "close") setMsg(result.queued ? "Close request queued; the worker will execute it on its next cycle." : "Close request submitted.");
      await refreshAccount();
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };
  const winRate = useMemo(() => {
    const s = rot?.stats; const n = (s?.wins ?? 0) + (s?.losses ?? 0);
    return n ? `${((s!.wins / n) * 100).toFixed(1)}%` : "—";
  }, [rot]);

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 text-white">
      <Helmet><title>{TITLE} | FrostDex</title></Helmet>
      <div>
        <h1 className="text-2xl font-bold">🤖 {TITLE}</h1>
        <p className="mt-1 text-sm text-white/60">
          Boosted-tree signal → Kalman smoothing → capital-rotation ranking. Runs 24/7 on the Frostdex worker across all {universe.length || "—"} USDC perps on the Markets page.
        </p>
      </div>

      <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-200">
        Experimental software, not financial advice. No edge is guaranteed — with no statistical edge the bot stays flat by design. Start in Simulation on testnet; live mode can lose your whole capital.
      </div>

      {/* 1. account */}
      <section className={`${card} space-y-3`}>
        <h2 className="font-semibold">1 · Sign in</h2>
        {guest ? <p className="text-sm text-emerald-400">Isolated guest simulation · no wallet · no real trades</p>
          : address && authed ? <p className="text-sm text-emerald-400">Signed in as {address.slice(0, 6)}…{address.slice(-4)}</p>
          : <div className="flex flex-wrap gap-2"><button className={`${btn} bg-sky-500 text-white`} disabled={busy || !address} onClick={signIn}>Sign in with wallet</button><button className={`${btn} bg-emerald-500 text-black`} disabled={busy} onClick={startGuest}>Start guest simulation</button></div>}
        <div className="flex gap-2 text-sm">
          {(["testnet", "mainnet"] as Network[]).map((n) => (
            <button key={n} disabled={guest && n === "mainnet"} className={`${btn} ${network === n ? "bg-white/20" : "bg-white/5"}`} onClick={() => setNetwork(n)}>{n}</button>
          ))}
        </div>
      </section>

      {/* 2. key (live only) */}
      {authed && live && (
        <section className={`${card} space-y-3`}>
          <h2 className="font-semibold">2 · Trading key (live mode)</h2>
          {keyConfigured ? <p className="text-sm text-emerald-400">A read+trading key is stored encrypted on the server. It cannot withdraw funds.</p> : (
            <>
              <p className="text-sm text-white/60">Paste a dedicated Orderly key with scope read,trading. Account: {account.accountId?.slice(0, 10)}…</p>
              <input className={input} placeholder="ed25519:… (public key)" value={keyForm.orderlyKey} onChange={(e) => setKeyForm({ ...keyForm, orderlyKey: e.target.value })} />
              <input className={input} type="password" placeholder="secret key" value={keyForm.secretKey} onChange={(e) => setKeyForm({ ...keyForm, secretKey: e.target.value })} />
              <button className={`${btn} bg-sky-500`} disabled={busy || !keyForm.orderlyKey || !keyForm.secretKey} onClick={saveKey}>Save key</button>
            </>
          )}
        </section>
      )}

      {/* 3. config */}
      <section className={`${card} space-y-3`}>
        <h2 className="font-semibold">3 · Configure</h2>
        {guest && <p className="text-xs text-emerald-300">Guest sessions are isolated, testnet-only simulations with up to 1,000 virtual USDC. Live trading is disabled.</p>}
        <div className="flex gap-2 text-sm">
          <button className={`${btn} ${!live ? "bg-emerald-500/30" : "bg-white/5"}`} disabled={running} onClick={() => setLive(false)}>Simulation</button>
          <button className={`${btn} ${live ? "bg-rose-500/30" : "bg-white/5"}`} disabled={running || guest} onClick={() => setLive(true)}>Live</button>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {([
            ["Capital (USDC, min 10)", capital, setCapital, 1],
            ["Leverage (1–10)", leverage, setLeverage, 1],
            ["Max positions", maxPositions, setMaxPositions, 1],
            ["Take profit (× risk)", tpR, setTpR, 0.5],
            ["Stop loss (%)", slPct, setSlPct, 0.1],
            ["Time stop (min)", timeStopMin, setTimeStopMin, 1],
            ["Daily loss limit (%)", dailyLossPct, setDailyLossPct, 0.5],
          ] as [string, number, (n: number) => void, number][]).map(([label, v, set, step]) => (
            <label key={label} className="text-xs text-white/60">{label}
              <input className={`${input} mt-1`} type="number" step={step} value={v} disabled={running} onChange={(e) => set(Number(e.target.value))} />
            </label>
          ))}
        </div>
        {!capitalOk && <p className="text-xs text-rose-400">Minimum capital is {MIN_CAPITAL} USDC.</p>}
        <div className="flex flex-wrap gap-2">
          {running && <button className={`${btn} bg-amber-500 text-black`} disabled={busy} onClick={() => control("pause")}>Ⅱ Pause (keep positions)</button>}
          {paused && <button className={`${btn} bg-emerald-500 text-black`} disabled={busy} onClick={() => control("resume")}>▶ Resume</button>}
          {(running || paused) && <button className={`${btn} bg-rose-500`} disabled={busy} onClick={() => control("stop")}>■ Stop &amp; close all</button>}
          {!running && !paused && <button className={`${btn} bg-emerald-500 text-black`} disabled={busy || (!authed && !guest) || !capitalOk || (guest && live)} onClick={() => save("running", !!bot && (bot.liveMode !== live || bot.investment !== capital))}>▶ Start 24/7 ({live ? "LIVE" : "simulation"})</button>}
          {bot && !running && !paused && <button className={`${btn} bg-white/10`} disabled={busy} onClick={() => save("stopped", true)}>Reset (new run)</button>}
        </div>
        {msg && <p className="text-sm text-amber-300">{msg}</p>}
        {bot && !workerOnline && running && <p className="text-sm text-rose-300">Worker offline — trading is paused until the 24/7 worker is running.</p>}
      </section>

      {/* dashboard */}
      {rot && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            <Stat label={`Equity (${rot.mode})`} value={`$${rot.equity.toFixed(2)}`} />
            <Stat label="Total PnL" value={usd(rot.stats.pnl)} tone={rot.stats.pnl >= 0 ? "up" : "down"} />
            <Stat label="Win rate" value={winRate} />
            <Stat label="Trades W/L" value={`${rot.stats.wins}/${rot.stats.losses}`} />
            <Stat label="L / S" value={`${rot.stats.longs} / ${rot.stats.shorts}`} />
            <Stat label="Passes (no edge)" value={String(rot.stats.passes)} />
          </div>
          {rot.haltedReason && <p className="text-sm text-rose-300">Halted: {rot.haltedReason}</p>}

          <section className={card}>
            <h2 className="mb-2 font-semibold">Open positions</h2>
            {paused && <p className="mb-2 text-xs text-amber-300">Paused: no new entries. Existing positions remain monitored for TP/SL and time exits.</p>}
            {rot.positions.length === 0 ? <p className="text-sm text-white/50">No open positions.</p> : (
              <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-xs md:text-sm"><thead><tr className="text-left text-white/50"><th className="py-2">Market</th><th>Side</th><th>Entry → Mark</th><th>Unrealized PnL</th><th>Margin / Qty</th><th>Opened</th><th>TP / SL</th><th>AI guidance</th><th>Action</th></tr></thead><tbody>
                {rot.positions.map((p) => {
                  const pnl = Number(p.unrealizedPnl ?? 0);
                  return <tr key={p.id} className="border-t border-white/5 align-top"><td className="py-2 font-semibold">{p.symbol.replace("PERP_", "").replace("_USDC", "")}</td><td className={p.side === "LONG" ? "text-emerald-400" : "text-rose-400"}>{p.side}</td><td>{p.entry.toPrecision(6)}<br/><span className="text-white/50">{p.markPrice ? p.markPrice.toPrecision(6) : "Waiting for price"}</span></td><td className={pnl >= 0 ? "text-emerald-400" : "text-rose-400"}>{usd(pnl)}</td><td>${p.margin.toFixed(2)}<br/><span className="text-white/50">{p.qty}</span></td><td>{new Date(p.openedAt).toLocaleString()}</td><td>TP {(p.tpDist * 100).toFixed(2)}%<br/>SL {(p.slDist * 100).toFixed(2)}%</td><td><span className={p.recommendation === "CLOSE" || p.recommendation === "STOP" ? "text-rose-300" : p.recommendation === "PAUSE" ? "text-amber-300" : "text-emerald-300"}>{p.recommendation ?? "HOLD"}</span><br/><span className="text-white/50">{p.recommendationReason ?? "Awaiting next worker tick"}</span></td><td><button className={`${btn} bg-rose-500/80 px-2 py-1`} disabled={busy} onClick={() => control("close", p.id)}>Close</button></td></tr>;
                })}
              </tbody></table></div>
            )}
          </section>

          <section className={card}>
            <h2 className="mb-2 font-semibold">Ranked entries (score = $ per $ per minute)</h2>
            <table className="w-full text-sm"><tbody>
              {rot.ranked.map((c) => (
                <tr key={c.symbol} className="border-t border-white/5">
                  <td className="py-1">{c.symbol.replace("PERP_", "").replace("_USDC", "")}</td><td>{c.side}</td>
                  <td>pTP {(c.pTP * 100).toFixed(1)}%</td><td>τ {c.tauMin.toFixed(1)}m</td>
                  <td className={c.score > 0 ? "text-emerald-400" : "text-white/40"}>{c.score.toFixed(5)}{c.score <= 0 ? " · skipped" : ""}</td>
                </tr>
              ))}
            </tbody></table>
          </section>

          <section className={card}>
            <h2 className="mb-2 font-semibold">Decision trace</h2>
            <div className="max-h-64 space-y-1 overflow-y-auto text-xs text-white/70">
              {[...rot.trace].reverse().map((t, i) => <div key={i}><span className="text-white/40">{new Date(t.t).toLocaleTimeString()}</span> [{t.kind}] {t.text}</div>)}
            </div>
          </section>
        </>
      )}

      <section className={card}>
        <h2 className="mb-2 font-semibold">Universe ({universe.length} markets)</h2>
        <div className="flex flex-wrap gap-1 text-xs text-white/60">
          {universe.map((s) => <span key={s} className="rounded bg-white/5 px-2 py-0.5">{s.replace("PERP_", "").replace("_USDC", "")}</span>)}
        </div>
      </section>
    </div>
  );
}
