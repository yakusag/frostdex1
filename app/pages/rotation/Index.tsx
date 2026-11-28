import { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useAccount, useWalletConnector } from "@orderly.network/hooks";
import { getPublicKey } from "@noble/ed25519";

type Network = "testnet" | "mainnet";
const TITLE = "AI Bot Frostdex Capital Rotation";
const MIN_CAPITAL = 10; // USDC

interface Position { id: string; symbol: string; side: "LONG" | "SHORT"; entry: number; qty: number; margin: number; openedAt: number; slDist: number; tpDist: number; score: number; markPrice?: number; unrealizedPnl?: number; recommendation?: "HOLD" | "CLOSE" | "PAUSE" | "STOP"; recommendationReason?: string }
interface Trade { id: string; symbol: string; side: string; pnl: number; reason: string; closedAt: number; entry: number; exit: number }
interface Candidate { symbol: string; side: string; pTP: number; score: number; tauMin: number; expectedNet: number; regime?: string; mtfAgreement?: number; volatilityRatio?: number; regimeConfidence?: number; cusumSignal?: number; forecastSigma?: number; strategy?: string; conformalEligible?: boolean; changePointProbability?: number; expectedRegimeMinutes?: number }
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
          132-tree signal + Bayesian calibration → HMM/GARCH/CUSUM/Kalman market intelligence → regime-aware Trend / Mean-Reversion / Momentum competition → Thompson selection → Fractional Kelly + Monte Carlo/CVaR sizing → adaptive TP/SL and capital rotation. Runs 24/7 on the Frostdex worker across all {universe.length || "—"} USDC perps on the Markets page.
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

      {/* 3. professional configuration */}
      <section className="overflow-hidden rounded-2xl border border-sky-400/20 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 shadow-2xl shadow-sky-950/20">
        <div className="border-b border-white/10 bg-white/[0.03] p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-sky-300">Capital Rotation Control Center</div>
              <h2 className="mt-1 text-xl font-bold tracking-tight">Bot configuration</h2>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">Configure capital, exposure and exit behaviour. Changes are applied when you start or save a run.</p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-[10px] font-bold tracking-wider ${live ? "border-rose-400/30 bg-rose-400/10 text-rose-300" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"}`}>{live ? "LIVE EXECUTION" : "PAPER SIMULATION"}</span>
          </div>
          {guest && <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3 text-xs leading-5 text-emerald-200">Guest mode is isolated and testnet-only. It uses virtual capital up to 1,000 USDC and cannot place real trades.</div>}
          {!guest && !live && <p className="mt-3 text-[11px] leading-5 text-slate-500">Live mode requires wallet sign-in, Mainnet, Mainnet bot access and an authorized Orderly trading key.</p>}
          <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-black/30 p-1">
            <button className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${!live ? "bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-950/30" : "text-slate-400 hover:bg-white/5"}`} onClick={() => setLive(false)}>Simulation</button>
            <button className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${live ? "bg-rose-400 text-slate-950 shadow-lg shadow-rose-950/30" : "text-slate-400 hover:bg-white/5"}`} disabled={guest || !authed || network !== "mainnet"} onClick={() => setLive(true)}>Live mode</button>
          </div>
        </div>

        <div className="space-y-5 p-4 sm:p-5">
          <div>
            <div className="mb-3 flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-400/10 text-xs font-bold text-sky-300">01</span><div><h3 className="text-sm font-semibold">Capital & exposure</h3><p className="text-[11px] text-slate-500">Define the account budget and simultaneous market exposure</p></div></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="rounded-xl border border-white/10 bg-black/20 p-3">
                <span className="text-[11px] font-medium text-slate-400">Trading capital</span>
                <div className="mt-2 flex items-center gap-2"><input className="w-full min-w-0 bg-transparent text-2xl font-bold text-white outline-none" type="number" min={MIN_CAPITAL} max={guest ? 1000 : undefined} step="1" value={capital} onChange={(e) => setCapital(Number(e.target.value))}/><span className="text-xs font-bold text-sky-300">USDC</span></div>
                <p className="mt-1 text-[10px] text-slate-500">Minimum 10 USDC{guest ? " · Guest cap 1,000" : ""}</p>
              </label>
              <label className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between"><span className="text-[11px] font-medium text-slate-400">Maximum open positions</span><strong className="text-lg text-white">{maxPositions}</strong></div>
                <input className="mt-4 w-full accent-sky-400" type="range" min="1" max="8" step="1" value={maxPositions} onChange={(e) => setMaxPositions(Number(e.target.value))}/>
                <div className="mt-1 flex justify-between text-[10px] text-slate-600"><span>1 position</span><span>8 positions</span></div>
              </label>
              <label className="rounded-xl border border-white/10 bg-black/20 p-3 sm:col-span-2">
                <div className="flex items-center justify-between"><span className="text-[11px] font-medium text-slate-400">Leverage</span><strong className="text-lg text-white">{leverage}×</strong></div>
                <input className="mt-4 w-full accent-sky-400" type="range" min="1" max="10" step="1" value={leverage} onChange={(e) => setLeverage(Number(e.target.value))}/>
                <div className="mt-1 flex justify-between text-[10px] text-slate-600"><span>1× · Lower exposure</span><span>10× · Higher exposure</span></div>
              </label>
            </div>
          </div>

          <div className="border-t border-white/10 pt-5">
            <div className="mb-3 flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-400/10 text-xs font-bold text-violet-300">02</span><div><h3 className="text-sm font-semibold">Trade management</h3><p className="text-[11px] text-slate-500">Set profit objectives and protective exit boundaries</p></div></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="rounded-xl border border-white/10 bg-black/20 p-3"><div className="flex items-center justify-between"><span className="text-[11px] text-slate-400">Take-profit / risk</span><strong className="text-lg text-emerald-300">{tpR.toFixed(1)}R</strong></div><input className="mt-4 w-full accent-emerald-400" type="range" min="0.5" max="5" step="0.5" value={tpR} onChange={(e) => setTpR(Number(e.target.value))}/><p className="mt-1 text-[10px] text-slate-500">Target reward relative to the stop distance</p></label>
              <label className="rounded-xl border border-white/10 bg-black/20 p-3"><div className="flex items-center justify-between"><span className="text-[11px] text-slate-400">Minimum stop distance</span><strong className="text-lg text-rose-300">{slPct.toFixed(1)}%</strong></div><input className="mt-4 w-full accent-rose-400" type="range" min="0.1" max="2" step="0.1" value={slPct} onChange={(e) => setSlPct(Number(e.target.value))}/><p className="mt-1 text-[10px] text-slate-500">Volatility and ATR may widen the actual stop</p></label>
              <label className="rounded-xl border border-white/10 bg-black/20 p-3"><div className="flex items-center justify-between"><span className="text-[11px] text-slate-400">Maximum holding time</span><strong className="text-lg text-white">{timeStopMin} min</strong></div><input className="mt-4 w-full accent-violet-400" type="range" min="3" max="120" step="1" value={timeStopMin} onChange={(e) => setTimeStopMin(Number(e.target.value))}/><p className="mt-1 text-[10px] text-slate-500">Time-based exit if neither TP nor SL is reached</p></label>
              <label className="rounded-xl border border-white/10 bg-black/20 p-3"><div className="flex items-center justify-between"><span className="text-[11px] text-slate-400">Daily loss limit</span><strong className="text-lg text-amber-300">{dailyLossPct.toFixed(1)}%</strong></div><input className="mt-4 w-full accent-amber-400" type="range" min="0.5" max="10" step="0.5" value={dailyLossPct} onChange={(e) => setDailyLossPct(Number(e.target.value))}/><p className="mt-1 text-[10px] text-slate-500">Halts new entries and triggers portfolio close at the limit</p></label>
            </div>
          </div>

          <div className="rounded-xl border border-sky-400/15 bg-sky-400/[0.04] p-3">
            <div className="flex items-center justify-between gap-2"><div><div className="text-[10px] font-bold uppercase tracking-widest text-sky-300">Active intelligence stack</div><p className="mt-1 text-xs text-slate-300">132-tree · Bayesian · HMM · GARCH · CUSUM · Kalman · Thompson · Kelly · Monte Carlo/CVaR</p></div><span className="rounded-lg bg-sky-400/10 px-2 py-1 text-[10px] font-semibold text-sky-200">ENGINE</span></div>
            <p className="mt-2 text-[10px] leading-4 text-slate-500">Shared intelligence stack runs identically in Simulation and Live: 132-tree + Bayesian calibration, HSMM duration, conformal abstention, Bayesian change-point, GARCH/CUSUM/Kalman, strategy competition, Thompson selection, Fractional Kelly and Monte Carlo/CVaR.</p>
          </div>

          {!capitalOk && <p className="rounded-lg border border-rose-400/20 bg-rose-400/10 p-3 text-xs text-rose-300">{guest && capital > 1000 ? "Guest simulations are limited to 1,000 virtual USDC." : `Capital must be at least ${MIN_CAPITAL} USDC.`}</p>}
          <p className="text-[11px] leading-5 text-slate-500">The bot scans the full eligible USDC perpetual universe. It may hold fewer positions than the maximum when no candidate passes its expected-net-edge and risk checks. Pause keeps existing positions managed; Stop closes the portfolio.</p>
        </div>

        <div className="border-t border-white/10 bg-black/20 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><div className="text-xs font-semibold text-white">Execution controls</div><p className="mt-1 text-[10px] text-slate-500">Start creates a new saved run using the settings above.</p></div>
            <div className="flex flex-wrap gap-2">
              {running && <button className={`${btn} border border-amber-300/20 bg-amber-400/10 text-amber-200`} disabled={busy} onClick={() => control("pause")}>Ⅱ Pause</button>}
              {paused && <button className={`${btn} bg-emerald-400 text-slate-950`} disabled={busy} onClick={() => control("resume")}>▶ Resume</button>}
              {(running || paused) && <button className={`${btn} border border-rose-400/20 bg-rose-400/10 text-rose-200`} disabled={busy} onClick={() => control("stop")}>■ Stop & close</button>}
              <button className={`${btn} bg-sky-400 text-slate-950 shadow-lg shadow-sky-950/30 hover:bg-sky-300`} disabled={busy || (!authed && !guest) || !capitalOk || (guest && live)} onClick={() => save("running", true)}>{busy ? "Applying…" : `▶ Start new run · ${live ? "LIVE" : "SIMULATION"}`}</button>
            </div>
          </div>
          {msg && <p className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-xs text-amber-200">{msg}</p>}
          {bot && !workerOnline && running && <p className="mt-3 rounded-lg border border-rose-400/20 bg-rose-400/10 p-3 text-xs text-rose-200">Worker offline — entries are not running until the 24/7 worker reconnects.</p>}
        </div>
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
            <h2 className="mb-2 font-semibold">Ranked opportunities · Strategy competition + HSMM + Conformal + Change-point + GARCH + CUSUM</h2>
            <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead><tr className="text-left text-white/50"><th>Market</th><th>Side</th><th>Strategy</th><th>pTP</th><th>Regime</th><th>HSMM confidence</th><th>MTF agreement</th><th>Vol ratio</th><th>CUSUM</th><th>GARCH σ</th><th>HSMM duration</th><th>Change point</th><th>Conformal</th><th>τ</th><th>Net score</th></tr></thead><tbody>
              {rot.ranked.map((c) => (
                <tr key={c.symbol} className="border-t border-white/5">
                  <td className="py-2">{c.symbol.replace("PERP_", "").replace("_USDC", "")}</td><td>{c.side}</td>
                  <td><span className="rounded bg-sky-400/10 px-2 py-1 text-[10px] text-sky-200">{(c.strategy ?? "MOMENTUM").replace(/_/g, " ")}</span></td>
                  <td>{(c.pTP * 100).toFixed(1)}%</td>
                  <td>{c.regime ?? "TRANSITION"}</td>
                  <td>{((c.regimeConfidence ?? 0) * 100).toFixed(0)}%</td>
                  <td>{((c.mtfAgreement ?? 0) * 100).toFixed(0)}%</td>
                  <td>{(c.volatilityRatio ?? 1).toFixed(2)}×</td>
                  <td>{c.cusumSignal === 1 ? "Bullish shift" : c.cusumSignal === -1 ? "Bearish shift" : "Neutral"}</td>
                  <td>{((c.forecastSigma ?? 0) * 100).toFixed(3)}%</td>
                  <td>{c.expectedRegimeMinutes === undefined ? "—" : `${c.expectedRegimeMinutes.toFixed(1)}m`}</td>
                  <td>{((c.changePointProbability ?? 0) * 100).toFixed(0)}%</td>
                  <td><span className={c.conformalEligible === false ? "text-rose-300" : "text-emerald-300"}>{c.conformalEligible === false ? "ABSTAIN" : "PASS"}</span></td>
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
