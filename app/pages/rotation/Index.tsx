import { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useAccount, useWalletConnector } from "@orderly.network/hooks";
import { getPublicKey } from "@noble/ed25519";

type Network = "testnet" | "mainnet";
const TITLE = "AI Bot Frostdex Capital Rotation";
const MIN_CAPITAL = 10; // USDC

interface Position { id: string; symbol: string; side: "LONG" | "SHORT"; entry: number; qty: number; margin: number; openedAt: number; slDist: number; tpDist: number; score: number; markPrice?: number; unrealizedPnl?: number; recommendation?: "HOLD" | "CLOSE" | "PAUSE" | "STOP"; recommendationReason?: string }
interface Trade { id: string; symbol: string; side: string; pnl: number; reason: string; closedAt: number; entry: number; exit: number }
interface Candidate { symbol: string; side: string; pTP: number; score: number; tauMin: number; expectedNet: number; regime?: string; mtfAgreement?: number; volatilityRatio?: number; regimeConfidence?: number; cusumSignal?: number; forecastSigma?: number }
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

  const [network, setNetwork] = useState<Network>("mainnet");
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
  const [botHistory, setBotHistory] = useState<BotConfig[]>([]);
  const [rot, setRot] = useState<RotationState | null>(null);
  const [workerOnline, setWorkerOnline] = useState(false);
  const [universe, setUniverse] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const capitalOk = Number.isFinite(capital) && capital >= MIN_CAPITAL && (!guest || capital <= 1000);

  // every perp shown on the Markets page
  useEffect(() => {
    fetch("https://api.orderly.org/v1/public/futures")
      .then((r) => r.json())
      .then((b: { data?: { rows?: { symbol: string; status?: string }[] } }) =>
        setUniverse((b.data?.rows ?? []).filter((r) => /^PERP_.+_USDC$/.test(r.symbol) && r.status !== "DELISTING").map((r) => r.symbol)))
      .catch(() => undefined);
  }, []);

  const refreshAccount = useCallback(async (targetNetwork: Network = network) => {
    try {
      const a = await api<{ authenticated: boolean; address: string | null; guest?: boolean }>("/api/bots/auth");
      const isGuest = Boolean(a.authenticated && a.guest);
      const effectiveNetwork: Network = isGuest ? "testnet" : targetNetwork;
      if (isGuest) { setNetwork("testnet"); setLive(false); }
      const ok = isGuest || (a.authenticated && !!address && a.address?.toLowerCase() === address.toLowerCase());
      setGuest(isGuest);
      setAuthed(ok);
      if (!ok) { setBot(null); setBotHistory([]); setKeyConfigured(false); return; }
      const [k, c] = await Promise.all([
        isGuest ? Promise.resolve({ configured: false }) : api<{ configured: boolean }>(`/api/bots/keys?network=${effectiveNetwork}`),
        api<{ bots: BotConfig[] }>(`/api/bots/config?network=${effectiveNetwork}`),
      ]);
      setKeyConfigured(k.configured);
      const history = c.bots.filter((b) => b.strategy === "rotation").sort((a2, b2) => b2.updatedAt - a2.updatedAt);
      setBotHistory(history);
      const mine = history[0] ?? null;
      setBot(mine);
      if (mine) {
        setLive(mine.liveMode);
        setCapital(mine.investment);
        setLeverage(Number(mine.params.leverage ?? 5));
        setMaxPositions(Number(mine.params.maxPositions ?? 3));
        setTpR(Number(mine.params.tpR ?? 2));
        setSlPct(Number(mine.params.slPct ?? 0.4));
        setTimeStopMin(Number(mine.params.timeStopMin ?? 20));
        setDailyLossPct(Number(mine.params.dailyLossPct ?? 5));
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
        const r = await api<{ state: RotationState | null; workerOnline: boolean }>(`/api/bots/rotation?network=${bot.network}&id=${bot.id}`);
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
      setLive(false);
      await refreshAccount("testnet");
      setMsg("Private guest simulation session created. No wallet or real funds are used.");
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };

  const switchToWallet = async () => {
    setBusy(true); setMsg(null);
    try {
      await api("/api/bots/auth", { method: "DELETE" });
      setGuest(false);
      setAuthed(false);
      setBot(null);
      setBotHistory([]);
      setRot(null);
      setWorkerOnline(false);
      setKeyConfigured(false);
      setMsg("Guest session ended. Connect your wallet and sign in to access live mode.");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
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

  const authorizeOrderlyKey = async () => {
    setBusy(true); setMsg(null);
    let secretKey = "";
    let seed: Uint8Array | null = null;
    try {
      if (!authed || !address) throw new Error("Sign in with your EVM wallet first.");
      if (network !== "mainnet") throw new Error("FrostDex live bot currently supports Mainnet only.");
      if (!account.accountId) throw new Error("Your Orderly account is not ready yet. Open the Orderly trading page and complete account setup first.");
      const provider = wallet?.provider as { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } | undefined;
      if (!provider || typeof provider.request !== "function") throw new Error("No connected EVM wallet provider found.");
      const connectedAddress = wallet?.accounts?.[0]?.address;
      if (!connectedAddress || connectedAddress.toLowerCase() !== address.toLowerCase()) {
        throw new Error("The connected wallet does not match the signed-in Orderly account.");
      }
      const chainHex = await provider.request({ method: "eth_chainId" });
      const chainId = typeof chainHex === "string" ? Number.parseInt(chainHex, 16) : Number(chainHex);
      if (!Number.isSafeInteger(chainId) || chainId <= 0) throw new Error("Unable to read the connected wallet chain.");
      const chainInfoResponse = await fetch("https://api.orderly.org/v1/public/chain_info?broker_id=frostdex");
      const chainInfo = await chainInfoResponse.json() as { data?: { chains?: { chain_id?: number | string }[] } };
      const supportedChainIds = (chainInfo.data?.chains ?? []).map((item) => Number(item.chain_id)).filter(Number.isSafeInteger);
      if (!chainInfoResponse.ok || !supportedChainIds.includes(chainId)) {
        throw new Error("Switch your wallet to a chain supported by FrostDex on Orderly Mainnet, then try again.");
      }
      seed = crypto.getRandomValues(new Uint8Array(32));
      const publicKey = await getPublicKey(seed);
      const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
      const toBase58 = (bytes: Uint8Array) => {
        let value = 0n;
        for (const byte of bytes) value = (value << 8n) | BigInt(byte);
        let encoded = "";
        while (value > 0n) { encoded = alphabet[Number(value % 58n)] + encoded; value /= 58n; }
        for (const byte of bytes) { if (byte !== 0) break; encoded = "1" + encoded; }
        return encoded;
      };
      const orderlyKey = `ed25519:${toBase58(publicKey)}`;
      secretKey = `ed25519:${toBase58(seed)}`;
      const timestamp = Date.now();
      const message = {
        brokerId: "frostdex",
        chainId,
        orderlyKey,
        scope: "read,trading",
        timestamp,
        expiration: timestamp + 365 * 24 * 60 * 60 * 1000,
      };
      const typedData = {
        types: {
          EIP712Domain: [
            { name: "name", type: "string" },
            { name: "version", type: "string" },
            { name: "chainId", type: "uint256" },
            { name: "verifyingContract", type: "address" },
          ],
          AddOrderlyKey: [
            { name: "brokerId", type: "string" },
            { name: "chainId", type: "uint256" },
            { name: "orderlyKey", type: "string" },
            { name: "scope", type: "string" },
            { name: "timestamp", type: "uint64" },
            { name: "expiration", type: "uint64" },
          ],
        },
        primaryType: "AddOrderlyKey",
        domain: {
          name: "Orderly",
          version: "1",
          chainId,
          verifyingContract: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC",
        },
        message,
      };
      const signature = await provider.request({
        method: "eth_signTypedData_v4",
        params: [address, JSON.stringify(typedData)],
      });
      if (typeof signature !== "string" || !signature.startsWith("0x")) {
        throw new Error("The wallet did not return a valid EIP-712 signature.");
      }
      const orderlyResponse = await fetch("https://api.orderly.org/v1/orderly_key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, signature, userAddress: address }),
      });
      const orderlyResult = await orderlyResponse.json() as { success?: boolean; message?: string; error?: string };
      if (!orderlyResponse.ok || orderlyResult.success !== true) {
        throw new Error(orderlyResult.message || orderlyResult.error || "Orderly rejected the new trading key.");
      }
      await api("/api/bots/keys", {
        method: "PUT",
        body: JSON.stringify({ network, accountId: account.accountId, scope: "read,trading", orderlyKey, secretKey }),
      });
      await refreshAccount();
      setMsg("Orderly trading key authorized and stored encrypted. You can now enable Live mode.");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      seed?.fill(0);
      seed = null;
      secretKey = "";
      setBusy(false);
    }
  };

  const save = async (status: "running" | "stopped" | "paused", fresh = false) => {
    if (!capitalOk) {
      if (guest && capital > 1000) return setMsg("Guest simulations are limited to 1,000 virtual USDC total capital.");
      return setMsg(`Capital must be at least ${MIN_CAPITAL} USDC${guest ? " and no more than 1,000 virtual USDC" : ""}.`);
    }
    if (guest && live) return setMsg("Guest sessions can only run testnet simulations.");
    if (live && !keyConfigured) return setMsg("Live mode needs a trading key (see step 2).");
    setBusy(true); setMsg(null);
    try {
      // Pin guest requests to testnet even if the UI network state is stale.
      const targetNetwork: Network = guest ? "testnet" : network;
      const targetLive = guest ? false : live;
      const id = fresh || !bot ? `ROT-${Date.now().toString(36).toUpperCase()}` : bot.id;
      await api("/api/bots/config", {
        method: "PUT",
        body: JSON.stringify({
          id, network: targetNetwork, strategy: "rotation", symbol: "PERP_ALL_USDC", investment: capital, liveMode: targetLive, status,
          params: { leverage, maxPositions, tpR, slPct, timeStopMin, dailyLossPct, universe: "all" },
        }),
      });
      await refreshAccount(targetNetwork);
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };

  const running = bot?.status === "running";
  const paused = bot?.status === "paused";
  const control = async (action: "pause" | "resume" | "stop" | "close", positionId?: string) => {
    if (!bot) return;
    setBusy(true); setMsg(null);
    try {
      const result = await api<{ queued?: boolean; status?: string }>(`/api/bots/rotation?network=${bot.network}&id=${bot.id}`, {
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
          132-tree signal + Bayesian probability calibration → HMM regime filter + GARCH volatility forecast + CUSUM shift detection + candle-close Kalman → Thompson opportunity selection → Fractional Kelly + Monte Carlo/CVaR risk sizing → adaptive TP/SL and net capital rotation. Runs 24/7 on the Frostdex worker across all {universe.length || "—"} USDC perps on the Markets page.
        </p>
      </div>

      <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-200">
        Experimental software, not financial advice. No edge is guaranteed — with no statistical edge the bot stays flat by design. Start in Simulation on testnet; live mode can lose your whole capital.
      </div>

      {/* 1. account */}
      <section className={`${card} space-y-3`}>
        <h2 className="font-semibold">1 · Sign in</h2>
        {guest ? <div className="flex flex-wrap items-center gap-3"><p className="text-sm text-emerald-400">Isolated guest simulation · no wallet · no real trades</p><button className={`${btn} bg-sky-500 text-white`} disabled={busy} onClick={switchToWallet}>Switch to wallet sign-in</button></div>
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
          {keyConfigured ? <p className="text-sm text-emerald-400">Orderly read+trading key is authorized and stored encrypted. Withdrawals are not permitted.</p> : (
            <>
              <p className="text-sm text-white/60">Authorize FrostDex with your connected wallet. A dedicated Ed25519 key is generated in this browser, signed through Orderly, then encrypted before server storage. No key or secret needs to be pasted.</p>
              <p className="text-xs text-amber-300">This grants the bot permission to read account data and place/cancel trades. It does not grant withdrawal permission. Only authorize if you accept live-trading risk.</p>
              <button className={`${btn} bg-sky-500 text-white`} disabled={busy || !address || !account.accountId} onClick={authorizeOrderlyKey}>{busy ? "Authorizing…" : "Authorize FrostDex"}</button>
            </>
          )}
        </section>
      )}

      {/* 3. config */}
      <section className={`${card} space-y-3`}>
        <h2 className="font-semibold">3 · Configure</h2>
        {guest && <p className="text-xs text-emerald-300">Guest sessions are isolated, testnet-only simulations with up to 1,000 virtual USDC. Use “Switch to wallet sign-in” above to leave guest mode before enabling live trading.</p>}
        {!guest && !live && <p className="text-xs text-white/50">Live mode requires wallet sign-in, Mainnet selection, an enabled Mainnet bot network, and a dedicated Orderly read,trading key.</p>}
        <div className="flex gap-2 text-sm">
          <button className={`${btn} ${!live ? "bg-emerald-500/30" : "bg-white/5"}`} onClick={() => setLive(false)}>Simulation</button>
          <button className={`${btn} ${live ? "bg-rose-500/30" : "bg-white/5"}`} disabled={guest || !authed || network !== "mainnet"} onClick={() => setLive(true)}>Live</button>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {([
            ["Capital (USDC, min 10)", capital, setCapital, 1],
            ["Leverage (1–10)", leverage, setLeverage, 1],
            ["Max open positions (1–8)", maxPositions, setMaxPositions, 1],
            ["Take profit (× risk)", tpR, setTpR, 0.5],
            ["Stop loss (%)", slPct, setSlPct, 0.1],
            ["Time stop (min)", timeStopMin, setTimeStopMin, 1],
            ["Daily loss limit (%)", dailyLossPct, setDailyLossPct, 0.5],
          ] as [string, number, (n: number) => void, number][]).map(([label, v, set, step]) => (
            <label key={label} className="text-xs text-white/60">{label}
              <input className={`${input} mt-1`} type="number" step={step} min={label.startsWith("Max open positions") ? 1 : undefined} max={label.startsWith("Max open positions") ? 8 : undefined} value={v} onChange={(e) => set(label.startsWith("Max open positions") ? Math.max(1, Math.min(8, Number(e.target.value))) : Number(e.target.value))} />
            </label>
          ))}
        </div>
        {!capitalOk && <p className="text-xs text-rose-400">
          {guest && capital > 1000 ? "Guest simulations are limited to 1,000 virtual USDC total capital." : `Capital must be at least ${MIN_CAPITAL} USDC.`}
        </p>}
        <p className="text-xs text-white/50">Max open positions controls simultaneous positions. The bot keeps scanning and can open new positions whenever a valid signal and sufficient free balance are available. It runs until you Pause or Stop it.</p>
        <div className="flex flex-wrap gap-2">
          {running && <button className={`${btn} bg-amber-500 text-black`} disabled={busy} onClick={() => control("pause")}>Ⅱ Pause (keep positions)</button>}
          {paused && <button className={`${btn} bg-emerald-500 text-black`} disabled={busy} onClick={() => control("resume")}>▶ Resume</button>}
          {(running || paused) && <button className={`${btn} bg-rose-500`} disabled={busy} onClick={() => control("stop")}>■ Stop &amp; close all</button>}
          <button className={`${btn} bg-emerald-500 text-black`} disabled={busy || (!authed && !guest) || !capitalOk || (guest && live)} onClick={() => save("running", true)}>▶ Start new 24/7 run ({live ? "LIVE" : "simulation"})</button>
        </div>
        {msg && <p className="text-sm text-amber-300">{msg}</p>}
        {bot && !workerOnline && running && <p className="text-sm text-rose-300">Worker offline — trading is paused until the 24/7 worker is running.</p>}
      </section>

      {botHistory.length > 0 && (
        <section className={`${card} space-y-2`}>
          <h2 className="font-semibold">Saved runs ({botHistory.length})</h2>
          <p className="text-xs text-white/50">Each Start creates a separate saved run. Select one to inspect its own positions, trades and results.</p>
          <div className="space-y-2">
            {botHistory.map((run) => (
              <button key={`${run.network}:${run.id}`} className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs ${bot?.id === run.id && bot?.network === run.network ? "border-sky-400/60 bg-sky-400/10" : "border-white/10 bg-black/20"}`} onClick={() => { setBot(run); setNetwork(run.network); setLive(run.liveMode); }}>
                <span><strong>{run.id}</strong><span className="ml-2 text-white/50">{new Date(run.updatedAt).toLocaleString()}</span></span>
                <span className="text-white/70">{run.liveMode ? "LIVE" : "SIMULATION"} · {run.status.toUpperCase()} · ${run.investment}</span>
              </button>
            ))}
          </div>
        </section>
      )}

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
            <h2 className="mb-2 font-semibold">Closed trade history</h2>
            {rot.trades.length === 0 ? <p className="text-sm text-white/50">No closed trades yet.</p> : (
              <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-xs md:text-sm"><thead><tr className="text-left text-white/50"><th className="py-2">Market</th><th>Side</th><th>Entry → Exit</th><th>Realized PnL</th><th>Result / reason</th><th>Closed</th></tr></thead><tbody>
                {[...rot.trades].reverse().map((t) => <tr key={t.id + t.closedAt} className="border-t border-white/5"><td className="py-2">{t.symbol.replace("PERP_", "").replace("_USDC", "")}</td><td>{t.side}</td><td>{t.entry.toPrecision(6)} → {t.exit.toPrecision(6)}</td><td className={t.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}>{usd(t.pnl)}</td><td>{t.pnl >= 0 ? "Profit" : "Loss"} · {t.reason.replace(/_/g, " ")}</td><td>{new Date(t.closedAt).toLocaleString()}</td></tr>)}
              </tbody></table></div>
            )}
          </section>

          <section className={card}>
            <h2 className="mb-2 font-semibold">Ranked entries · HMM + GARCH + CUSUM + Bayesian + Thompson</h2>
            <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead><tr className="text-left text-white/50"><th>Market</th><th>Side</th><th>pTP</th><th>Regime</th><th>HMM confidence</th><th>MTF agreement</th><th>Vol ratio</th><th>CUSUM</th><th>GARCH σ</th><th>τ</th><th>Net score</th></tr></thead><tbody>
              {rot.ranked.map((c) => (
                <tr key={c.symbol} className="border-t border-white/5">
                  <td className="py-2">{c.symbol.replace("PERP_", "").replace("_USDC", "")}</td><td>{c.side}</td>
                  <td>{(c.pTP * 100).toFixed(1)}%</td>
                  <td>{c.regime ?? "TRANSITION"}</td>
                  <td>{((c.regimeConfidence ?? 0) * 100).toFixed(0)}%</td>
                  <td>{((c.mtfAgreement ?? 0) * 100).toFixed(0)}%</td>
                  <td>{(c.volatilityRatio ?? 1).toFixed(2)}×</td>
                  <td>{c.cusumSignal === 1 ? "Bullish shift" : c.cusumSignal === -1 ? "Bearish shift" : "Neutral"}</td>
                  <td>{((c.forecastSigma ?? 0) * 100).toFixed(3)}%</td>
                  <td>{c.tauMin.toFixed(1)}m</td>
                  <td className={c.score > 0 ? "text-emerald-400" : "text-white/40"}>{c.score.toFixed(5)}{c.score <= 0 ? " · skipped" : ""}</td>
                </tr>
              ))}
            </tbody></table></div>
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
