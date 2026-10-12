/**
 * HTTP ops probes: /health (liveness), /ready (data dir + optional RPC), /status (JSON).
 * Served on the same PORT as the WebSocket game server.
 *
 * /status and mutating ops POSTs are restricted to loopback or
 * Authorization: Bearer $LOK_OPS_STATUS_TOKEN.
 * RPC URLs and absolute data paths are redacted.
 */
import { existsSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { networkProfile, resolveNetworkName } from "@bellgrave/config";
import { replacePendingOpenAsk } from "./ah-escrow-tx";
import {
  AskFilledQuarantine,
  askFilledQuarantinePath,
} from "./lok-ask-filled-quarantine";
import { defaultLokDir } from "./lok-world";
import {
  nftTransferDroppedPath,
  readDroppedPendingCancels,
} from "./nft-transfer-ask-cancel";
import { recentOpsAlerts, watcherLagAlertBlocks } from "./ops-log";
import {
  jsonStringifySafe,
  redactDataDir,
  redactRpcText,
  redactRpcUrl,
} from "./ops-redact";
import {
  settlementRpcStats,
  watcherLagBlocks,
  type SettlementRpcStats,
} from "./settlement-rpc";

export type OpsHealthDeps = {
  dataDir?: string;
  /** When false, /ready stays 503. */
  lokReady: () => boolean;
  startedAtMs: number;
  env?: NodeJS.ProcessEnv;
  /** Override remote address for tests (req.socket.remoteAddress). */
  remoteAddress?: string | null;
  /** Override replacePendingOpenAsk for unit tests. */
  replacePendingOpenAsk?: typeof replacePendingOpenAsk;
};

export type OpsRpcStatusView = {
  url: string;
  urls: string[];
  calls: number;
  failures: number;
  rotations: number;
  lastError: string | null;
  lastOkAtMs: number | null;
  tipBlock: string | null;
  cursors: Record<string, string>;
};

export type OpsStatusBody = {
  ok: boolean;
  ready: boolean;
  uptimeSec: number;
  network: string;
  chainId: string | null;
  /** Basename only. */
  dataDir: string;
  rpc: OpsRpcStatusView | null;
  watchers: {
    lagAlertBlocks: string;
    askFilledLag: string | null;
    nftTransferLag: string | null;
  };
  alerts: {
    droppedCancels: number;
    askFilledQuarantine: number;
    recent: ReturnType<typeof recentOpsAlerts>;
  };
};

export function redactSettlementRpcStats(
  stats: SettlementRpcStats | null,
): OpsRpcStatusView | null {
  if (!stats) return null;
  const cursors: Record<string, string> = {};
  for (const [k, v] of Object.entries(stats.cursors)) {
    cursors[k] = v.toString();
  }
  return {
    url: redactRpcUrl(stats.url),
    urls: stats.urls.map((u) => redactRpcUrl(u)),
    calls: stats.calls,
    failures: stats.failures,
    rotations: stats.rotations,
    lastError: stats.lastError ? redactRpcText(stats.lastError) : null,
    lastOkAtMs: stats.lastOkAtMs,
    tipBlock: stats.tipBlock != null ? stats.tipBlock.toString() : null,
    cursors,
  };
}

export function buildOpsStatus(deps: OpsHealthDeps): OpsStatusBody {
  const env = deps.env ?? process.env;
  const dataDir = deps.dataDir ?? defaultLokDir();
  const ready = deps.lokReady();
  const rpc = settlementRpcStats();
  const confirmations = BigInt(env.LOK_CONFIRMATIONS?.trim() || "30");
  const tip = rpc?.tipBlock ?? null;
  const askCursor = rpc?.cursors.askFilled;
  const nftCursor = rpc?.cursors.nftTransfer;
  const askLag =
    askCursor != null
      ? watcherLagBlocks({ tip, cursor: askCursor, confirmations }).toString()
      : null;
  const nftLag =
    nftCursor != null
      ? watcherLagBlocks({ tip, cursor: nftCursor, confirmations }).toString()
      : null;

  let dropped = 0;
  try {
    dropped = readDroppedPendingCancels(nftTransferDroppedPath(dataDir)).length;
  } catch {
    dropped = -1;
  }
  let quarantine = 0;
  try {
    quarantine = new AskFilledQuarantine(askFilledQuarantinePath(dataDir)).list().length;
  } catch {
    quarantine = -1;
  }

  const profile = networkProfile(env as Record<string, string | undefined>);
  return {
    ok: true,
    ready,
    uptimeSec: Math.floor((Date.now() - deps.startedAtMs) / 1000),
    network: resolveNetworkName(env as Record<string, string | undefined>),
    chainId: env.LOK_CHAIN_ID?.trim() || String(profile.chainId),
    dataDir: redactDataDir(dataDir),
    rpc: redactSettlementRpcStats(rpc),
    watchers: {
      lagAlertBlocks: watcherLagAlertBlocks(env).toString(),
      askFilledLag: askLag,
      nftTransferLag: nftLag,
    },
    alerts: {
      droppedCancels: dropped,
      askFilledQuarantine: quarantine,
      recent: recentOpsAlerts(),
    },
  };
}

function isLoopback(addr: string | null | undefined): boolean {
  if (!addr) return false;
  const a = addr.replace(/^::ffff:/, "").toLowerCase();
  return a === "127.0.0.1" || a === "::1" || a === "localhost";
}

/** Gnosis mainnet (or NETWORK=gnosis) — /status must use LOK_OPS_STATUS_TOKEN. */
export function isProductionOpsEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  const named = (env.NETWORK ?? env.LOK_NETWORK)?.trim().toLowerCase();
  if (named === "gnosis") return true;
  const chain = (env.LOK_CHAIN_ID ?? "").trim();
  return chain === "100";
}

function socketRemoteAddress(
  req: IncomingMessage,
  override?: string | null,
): string | null {
  if (override != null && override !== "") return override;
  if (req.socket && "remoteAddress" in req.socket) {
    return (req.socket as { remoteAddress?: string | null }).remoteAddress ?? null;
  }
  return null;
}

function bearerMatches(req: IncomingMessage, token: string): boolean {
  const auth = req.headers.authorization;
  if (typeof auth !== "string") return false;
  const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
  return !!m && m[1] === token;
}

/**
 * /status auth:
 * - Never trusts Host / X-Forwarded-* (spoofable; reverse proxies look local).
 * - Uses socket remoteAddress only for loopback.
 * - Production (NETWORK=gnosis / chain 100): LOK_OPS_STATUS_TOKEN required; Bearer only
 *   (loopback bypass disabled — same-host proxies would otherwise open /status).
 * - Dev/anvil/chiado: loopback OR matching Bearer when token is set.
 */
export function statusAuthorized(
  req: IncomingMessage,
  env: NodeJS.ProcessEnv = process.env,
  remoteAddress?: string | null,
): boolean {
  const token = env.LOK_OPS_STATUS_TOKEN?.trim() ?? "";
  const production = isProductionOpsEnv(env);

  if (production) {
    if (!token) return false;
    return bearerMatches(req, token);
  }

  if (token && bearerMatches(req, token)) return true;
  return isLoopback(socketRemoteAddress(req, remoteAddress));
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  try {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(jsonStringifySafe(body));
  } catch (err) {
    try {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    } catch {
      /* socket already gone */
    }
  }
}

function readJsonBody(req: IncomingMessage, maxBytes = 4096): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer | string) => {
      const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
      size += buf.length;
      if (size > maxBytes) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(buf);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw) as unknown);
      } catch {
        reject(new Error("invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

export function handleOpsHttp(
  req: IncomingMessage,
  res: ServerResponse,
  deps: OpsHealthDeps,
): boolean {
  const env = deps.env ?? process.env;
  const host = req.headers.host ?? "localhost";
  let pathname = "/";
  try {
    pathname = new URL(req.url ?? "/", "http://" + host).pathname;
  } catch {
    pathname = "/";
  }

  try {
    if (pathname === "/health" || pathname === "/healthz") {
      writeJson(res, 200, { ok: true });
      return true;
    }

    if (pathname === "/ready" || pathname === "/readyz") {
      const dataDir = deps.dataDir ?? defaultLokDir();
      const ready = deps.lokReady() && existsSync(dataDir);
      const rpc = settlementRpcStats();
      const rpcOk = !rpc || rpc.lastError == null || rpc.lastOkAtMs != null;
      const ok = ready && rpcOk;
      writeJson(res, ok ? 200 : 503, { ok, ready, rpcOk });
      return true;
    }

    if (pathname === "/status") {
      if (!statusAuthorized(req, env, deps.remoteAddress)) {
        writeJson(res, 401, { ok: false, error: "unauthorized" });
        return true;
      }
      writeJson(res, 200, buildOpsStatus(deps));
      return true;
    }

    // Stuck openAsk mempool / pause: fee-bumped same-nonce replace or cancelAsk.
    if (pathname === "/ops/replace-open-ask") {
      const method = (req.method ?? "GET").toUpperCase();
      if (method !== "POST") {
        writeJson(res, 405, { ok: false, error: "POST required" });
        return true;
      }
      if (!statusAuthorized(req, env, deps.remoteAddress)) {
        writeJson(res, 401, { ok: false, error: "unauthorized" });
        return true;
      }
      void (async () => {
        try {
          const body = (await readJsonBody(req)) as { listingId?: unknown };
          const listingId =
            typeof body.listingId === "string"
              ? body.listingId.trim()
              : typeof body.listingId === "number"
                ? String(body.listingId)
                : "";
          if (!/^[1-9][0-9]{0,77}$/.test(listingId)) {
            writeJson(res, 400, { ok: false, error: "listingId required" });
            return;
          }
          const replace = deps.replacePendingOpenAsk ?? replacePendingOpenAsk;
          const out = await replace({
            listingId,
            env,
            dataDir: deps.dataDir,
          });
          writeJson(res, out.ok ? 200 : 400, out);
        } catch (err) {
          writeJson(res, 400, {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      })();
      return true;
    }
  } catch (err) {
    console.error(
      "[bellgrave] ops http error",
      err instanceof Error ? err.message : err,
    );
    writeJson(res, 500, {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
    return true;
  }

  return false;
}
