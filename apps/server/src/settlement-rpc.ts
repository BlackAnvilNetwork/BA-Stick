/**
 * Settlement JSON-RPC with URL rotation, retries, and light rate limiting.
 * Used by AhEscrow AskFilled + NFT Transfer watchers (and later health).
 */
import { settlementRpcUrls } from "@bellgrave/config";
import { redactRpcText, redactRpcUrl } from "./ops-redact";

export type SettlementRpcCall = (method: string, params: unknown[]) => Promise<unknown>;

export type SettlementRpcStats = {
  url: string;
  urls: string[];
  calls: number;
  failures: number;
  rotations: number;
  lastError: string | null;
  lastOkAtMs: number | null;
  /** Latest known tip (from eth_blockNumber). */
  tipBlock: bigint | null;
  /** Highest confirmed cursor across watchers (best-effort). */
  cursors: Record<string, bigint>;
};

const DEFAULT_MIN_INTERVAL_MS = 40;
const DEFAULT_MAX_RETRIES = 4;

let shared: RotatingJsonRpc | null = null;

export class RotatingJsonRpc {
  readonly urls: string[];
  private index = 0;
  private lastCallAt = 0;
  private readonly minIntervalMs: number;
  private readonly maxRetries: number;
  stats: SettlementRpcStats;

  constructor(
    urls: string[],
    opts?: { minIntervalMs?: number; maxRetries?: number },
  ) {
    const cleaned = [...new Set(urls.map((u) => u.trim().replace(/\/$/, "")).filter(Boolean))];
    if (cleaned.length === 0) throw new Error("settlement RPC: no URLs");
    this.urls = cleaned;
    this.minIntervalMs = opts?.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
    this.maxRetries = opts?.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.stats = {
      url: cleaned[0]!,
      urls: cleaned,
      calls: 0,
      failures: 0,
      rotations: 0,
      lastError: null,
      lastOkAtMs: null,
      tipBlock: null,
      cursors: {},
    };
  }

  currentUrl(): string {
    return this.urls[this.index]!;
  }

  noteCursor(name: string, cursor: bigint): void {
    this.stats.cursors[name] = cursor;
  }

  private async throttle(): Promise<void> {
    const wait = this.minIntervalMs - (Date.now() - this.lastCallAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastCallAt = Date.now();
  }

  private rotate(reason: string): void {
    if (this.urls.length < 2) return;
    this.index = (this.index + 1) % this.urls.length;
    this.stats.rotations += 1;
    this.stats.url = this.currentUrl();
    console.warn(
      "[bellgrave] settlement RPC rotate → " +
        redactRpcUrl(this.stats.url) +
        " (" +
        redactRpcText(reason) +
        ")",
    );
  }

  async call(method: string, params: unknown[]): Promise<unknown> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const url = this.currentUrl();
      try {
        await this.throttle();
        this.stats.calls += 1;
        const result = await postJsonRpc(url, method, params);
        this.stats.lastOkAtMs = Date.now();
        this.stats.lastError = null;
        if (method === "eth_blockNumber" && typeof result === "string") {
          try {
            this.stats.tipBlock = BigInt(result);
          } catch {
            /* ignore */
          }
        }
        return result;
      } catch (err) {
        lastErr = err;
        this.stats.failures += 1;
        const raw = err instanceof Error ? err.message : String(err);
        this.stats.lastError = redactRpcText(raw);
        const retryable = isRetryableRpcError(err);
        if (!retryable || attempt === this.maxRetries) break;
        this.rotate(this.stats.lastError);
        await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }

  asCall(): SettlementRpcCall {
    return (method, params) => this.call(method, params);
  }
}

async function postJsonRpc(url: string, method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error("HTTP " + res.status + " from " + redactRpcUrl(url));
  const body = (await res.json()) as { result?: unknown; error?: { message?: string; code?: number } };
  if (body.error) {
    const msg = body.error.message || "rpc error";
    const err = new Error(msg) as Error & { code?: number };
    err.code = body.error.code;
    throw err;
  }
  return body.result;
}

function isRetryableRpcError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (msg.includes("429") || msg.includes("rate") || msg.includes("timeout")) return true;
  if (msg.includes("503") || msg.includes("502") || msg.includes("econn") || msg.includes("fetch")) {
    return true;
  }
  if (msg.includes("limit") || msg.includes("too many") || msg.includes("busy")) return true;
  return false;
}

/** Shared client for the process (created once from env). */
export function settlementRpc(env: NodeJS.ProcessEnv = process.env): RotatingJsonRpc {
  if (shared) return shared;
  const urls = settlementRpcUrls(env as Record<string, string | undefined>);
  const primary = env.LOK_CHAIN_RPC?.trim();
  const ordered = primary ? [primary, ...urls.filter((u) => u !== primary)] : urls;
  shared = new RotatingJsonRpc(ordered);
  return shared;
}

/** Test seam — reset shared client. */
export function resetSettlementRpcForTests(): void {
  shared = null;
}

/**
 * First block to scan when a watcher cursor is still 0.
 * Prefer LOK_DEPLOY_BLOCK; else 0 (full history — expensive on mainnet).
 */
export function watcherStartBlock(env: NodeJS.ProcessEnv = process.env): bigint {
  const raw = env.LOK_DEPLOY_BLOCK?.trim();
  if (raw && /^\d+$/.test(raw)) {
    const n = BigInt(raw);
    return n > 0n ? n : 0n;
  }
  return 0n;
}

/** Lag in blocks: tip - confirmations - cursor (0 if caught up / unknown). */
export function watcherLagBlocks(opts: {
  tip: bigint | null;
  cursor: bigint;
  confirmations: bigint;
}): bigint {
  if (opts.tip == null) return 0n;
  const safe = opts.tip > opts.confirmations ? opts.tip - opts.confirmations : 0n;
  if (safe <= opts.cursor) return 0n;
  return safe - opts.cursor;
}

/**
 * Reorg-safe head for watchers.
 * On Gnosis / Chiado prefer `finalized`; fall back to tip − confirmations (~30).
 */
export async function settlementSafeHead(opts: {
  rpcCall: SettlementRpcCall;
  confirmations: bigint;
  preferFinalized?: boolean;
}): Promise<{ tip: bigint; safeHead: bigint; source: "finalized" | "confirmations" }> {
  const tipHex = String(await opts.rpcCall("eth_blockNumber", []));
  const tip = BigInt(tipHex);
  if (opts.preferFinalized !== false) {
    try {
      const block = (await opts.rpcCall("eth_getBlockByNumber", ["finalized", false])) as {
        number?: string;
      } | null;
      if (block?.number) {
        const finalized = BigInt(block.number);
        if (shared) shared.stats.tipBlock = tip;
        return { tip, safeHead: finalized, source: "finalized" };
      }
    } catch {
      /* finalized unsupported — use confirmations */
    }
  }
  if (shared) shared.stats.tipBlock = tip;
  const safeHead = tip > opts.confirmations ? tip - opts.confirmations : 0n;
  return { tip, safeHead, source: "confirmations" };
}

export function settlementRpcStats(): SettlementRpcStats | null {
  return shared ? { ...shared.stats, cursors: { ...shared.stats.cursors } } : null;
}

/** Test seam — inject a shared client with populated tip/cursors. */
export function setSettlementRpcForTests(client: RotatingJsonRpc | null): void {
  shared = client;
}
