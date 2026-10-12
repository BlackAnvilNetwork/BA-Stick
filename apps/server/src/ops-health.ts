/**
 * HTTP ops probes: /health (liveness), /ready (data dir + optional RPC), /status (JSON).
 * Served on the same PORT as the WebSocket game server.
 *
 * /status is restricted to loopback or Authorization: Bearer $LOK_OPS_STATUS_TOKEN.
 * RPC URLs and absolute data paths are redacted.
 */
import { existsSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { networkProfile, resolveNetworkName } from "@bellgrave/config";
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

/**
 * /status allowed from loopback, or with Bearer token matching LOK_OPS_STATUS_TOKEN.
 * When the token env is set, Bearer is always accepted (including remote).
 */
export function statusAuthorized(
  req: IncomingMessage,
  env: NodeJS.ProcessEnv = process.env,
  remoteAddress?: string | null,
): boolean {
  const token = env.LOK_OPS_STATUS_TOKEN?.trim();
  const auth = req.headers.authorization;
  if (token && typeof auth === "string") {
    const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
    if (m && m[1] === token) return true;
  }
  const remote =
    remoteAddress ??
    (req.socket && "remoteAddress" in req.socket
      ? (req.socket as { remoteAddress?: string }).remoteAddress
      : null);
  if (isLoopback(remote)) return true;
  // When Host is localhost and no X-Forwarded-For, treat as local probe (dev).
  const host = (req.headers.host ?? "").split(":")[0]?.toLowerCase() ?? "";
  const fwd = req.headers["x-forwarded-for"];
  if (!fwd && (host === "localhost" || host === "127.0.0.1" || host === "::1")) {
    return true;
  }
  return false;
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
