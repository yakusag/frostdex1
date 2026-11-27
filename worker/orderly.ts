import { createPrivateKey, sign as edSign } from "node:crypto";
import type { Broker, Fill } from "../shared/rotation/runner.js";
import { dirOf } from "../shared/rotation/engine.js";

export type Network = "testnet" | "mainnet";
export const API_BASE: Record<Network, string> = {
  mainnet: "https://api.orderly.org",
  testnet: "https://testnet-api.orderly.org",
};

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58decode(s: string): Buffer {
  let n = 0n;
  for (const ch of s) {
    const i = B58.indexOf(ch);
    if (i < 0) throw new Error("not base58");
    n = n * 58n + BigInt(i);
  }
  let hex = n.toString(16);
  if (hex.length % 2) hex = "0" + hex;
  const bytes = Buffer.from(hex, "hex");
  const zeros = s.length - s.replace(/^1+/, "").length;
  return Buffer.concat([Buffer.alloc(zeros), bytes]);
}

/** Accepts "ed25519:<base58 seed>" (32 or 64 bytes) or a base64 seed. */
export function parseSecretSeed(secret: string): Buffer {
  const raw = secret.replace(/^ed25519:/, "");
  let bytes: Buffer;
  try {
    bytes = b58decode(raw);
  } catch {
    bytes = Buffer.from(raw, "base64");
  }
  if (bytes.length === 64) bytes = bytes.subarray(0, 32);
  if (bytes.length !== 32) throw new Error("Unsupported Orderly secret key format.");
  return bytes;
}

const PKCS8_ED25519_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

export class OrderlyClient {
  private key;
  constructor(
    readonly network: Network,
    private accountId: string,
    private orderlyKey: string,
    secret: string,
  ) {
    this.key = createPrivateKey({
      key: Buffer.concat([PKCS8_ED25519_PREFIX, parseSecretSeed(secret)]),
      format: "der",
      type: "pkcs8",
    });
  }

  signRequest(ts: number, method: string, path: string, body = "") {
    return edSign(null, Buffer.from(`${ts}${method}${path}${body}`), this.key).toString("base64url");
  }

  async request<T = any>(method: "GET" | "POST" | "DELETE", path: string, payload?: unknown): Promise<T> {
    const body = payload === undefined ? "" : JSON.stringify(payload);
    const ts = Date.now();
    const res = await fetch(API_BASE[this.network] + path, {
      method,
      headers: {
        "Content-Type": method === "GET" || method === "DELETE" ? "application/x-www-form-urlencoded" : "application/json",
        "orderly-timestamp": String(ts),
        "orderly-account-id": this.accountId,
        "orderly-key": this.orderlyKey,
        "orderly-signature": this.signRequest(ts, method, path, body),
      },
      body: body || undefined,
    });
    const json = (await res.json().catch(() => ({}))) as any;
    if (!res.ok || json.success === false) {
      throw new Error(`Orderly ${method} ${path} failed: ${json.message ?? res.status}`);
    }
    return json;
  }
}

export interface SymbolRules {
  base_tick: number;
  base_min: number;
  min_notional: number;
  decimals: number;
}

const decimalsOf = (step: number) => {
  const s = step.toString();
  if (s.includes("e-")) return Number(s.split("e-")[1]);
  return s.includes(".") ? s.split(".")[1].length : 0;
};

export function normalizeQty(rules: SymbolRules | undefined, qty: number, price: number): number {
  if (!rules || !(rules.base_tick > 0)) return 0;
  const q = Math.floor(qty / rules.base_tick + 1e-9) * rules.base_tick;
  const fixed = Number(q.toFixed(rules.decimals));
  if (fixed < rules.base_min || fixed * price < rules.min_notional) return 0;
  return fixed;
}

export async function loadRules(network: Network): Promise<Map<string, SymbolRules>> {
  const res = await fetch(`${API_BASE[network]}/v1/public/info`);
  const body = (await res.json()) as any;
  const map = new Map<string, SymbolRules>();
  for (const r of body?.data?.rows ?? []) {
    const base_tick = Number(r.base_tick);
    if (typeof r.symbol === "string" && base_tick > 0) {
      map.set(r.symbol, {
        base_tick,
        base_min: Number(r.base_min) || base_tick,
        min_notional: Number(r.min_notional) || 10,
        decimals: Number.isFinite(Number(r.base_dp)) ? Number(r.base_dp) : decimalsOf(base_tick),
      });
    }
  }
  return map;
}

/** Real executor. Market orders only; never touches symbols the user holds manually. */
export class OrderlyBroker implements Broker {
  private levSet = new Set<string>();
  constructor(
    private client: OrderlyClient,
    private rules: Map<string, SymbolRules>,
    private leverage: number,
    private feeRate: number,
  ) {}

  normalizeQty(symbol: string, qty: number, price: number) {
    return normalizeQty(this.rules.get(symbol), qty, price);
  }

  private async positionQty(symbol: string): Promise<number> {
    const r = await this.client.request("GET", `/v1/position/${symbol}`);
    return Number(r?.data?.position_qty ?? 0);
  }

  private async fill(orderId: number, ref: number, qty: number): Promise<Fill> {
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const r = await this.client.request("GET", `/v1/order/${orderId}`);
      const o = r?.data;
      if (o?.status === "REJECTED" || o?.status === "CANCELLED") {
        throw new Error(`order ${o.status}`);
      }
      const px = Number(o?.average_executed_price);
      if (o?.status === "FILLED" && px > 0) {
        const fee = Number(o?.total_fee);
        return { price: px, fee: Number.isFinite(fee) && fee > 0 ? fee : px * qty * this.feeRate };
      }
    }
    throw new Error("order not confirmed filled in time");
  }

  async open(symbol: string, side: "LONG" | "SHORT", qty: number, ref: number) {
    // Fail closed: never submit a new live order without a fresh collateral check.
    const holding = await this.client.request("GET", "/v1/positions");
    const freeCollateral = Number(holding?.data?.free_collateral);
    const requiredMargin = (qty * ref) / this.leverage;
    const feeBuffer = qty * ref * this.feeRate * 2;
    if (!Number.isFinite(freeCollateral) || freeCollateral <= 0) {
      throw new Error("Unable to verify Orderly free_collateral; live entry blocked.");
    }
    if (freeCollateral < requiredMargin + feeBuffer) {
      throw new Error(`Insufficient free collateral: available ${freeCollateral.toFixed(2)}, required ${(requiredMargin + feeBuffer).toFixed(2)} USDC.`);
    }
    if (Math.abs(await this.positionQty(symbol)) > 0) {
      throw new Error("existing position on this symbol (not opened by the bot)");
    }
    if (!this.levSet.has(symbol)) {
      try {
        await this.client.request("POST", "/v1/client/leverage", { symbol, leverage: this.leverage });
        this.levSet.add(symbol);
      } catch (e) {
        console.warn(`[orderly] leverage not set for ${symbol}:`, (e as Error).message);
      }
    }
    const r = await this.client.request("POST", "/v1/order", {
      symbol, order_type: "MARKET", side: side === "LONG" ? "BUY" : "SELL", order_quantity: qty,
    });
    return this.fill(r.data.order_id, ref, qty);
  }

  async close(symbol: string, side: "LONG" | "SHORT", qty: number, ref: number) {
    const r = await this.client.request("POST", "/v1/order", {
      symbol, order_type: "MARKET", side: dirOf(side) === 1 ? "SELL" : "BUY",
      order_quantity: qty, reduce_only: true,
    });
    return this.fill(r.data.order_id, ref, qty);
  }

  async openSymbols(): Promise<Map<string, number>> {
    const r = await this.client.request("GET", "/v1/positions");
    const m = new Map<string, number>();
    for (const row of r?.data?.rows ?? []) m.set(row.symbol, Number(row.position_qty));
    return m;
  }
}
