/**
 * HTTP ops probes: /health (liveness), /ready (data dir + optional RPC), /status (JSON).
 * Served on the same PORT as the WebSocket game server.
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
  settlementRpcStats,
  watcherLagBlocks,
} from "./settlement-rpc";

export type OpsHealthDeps = {
  dataDir?: string;
  /** When false, /ready stays 503. */
  lokReady: () => boolean;
  startedAtMs: number;
  env?: NodeJS.ProcessEnv;
};

export type OpsStatusBody = {
  ok: boolean;
  ready: boolean;
  uptimeSec: number;
  network: string;
  chainId: string | null;
  dataDir: string;
  rpc: ReturnType<typeof settlementRpcStats>;
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

export function buildOpsStatus(deps: OpsHealthDeps): OpsStatusBody {
  const env = deps.env ?? process.env;
  const dataDir = deps.dataDir ?? defaultLokDir();
  const ready = deps.lokReady();
  const rpc = settlementRpcStats();
  const confirmations = BigInt(env.LOK_CONFIRMATIONS?.trim() || "2");
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
    dataDir,
    rpc,
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

export function handleOpsHttp(
  req: IncomingMessage,
  res: ServerResponse,
  deps: OpsHealthDeps,
): boolean {
  const host = req.headers.host ?? "localhost";
  let pathname = "/";
  try {
    pathname = new URL(req.url ?? "/", "http://" + host).pathname;
  } catch {
    pathname = "/";
  }

  if (pathname === "/health" || pathname === "/healthz") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return true;
  }

  if (pathname === "/ready" || pathname === "/readyz") {
    const dataDir = deps.dataDir ?? defaultLokDir();
    const ready = deps.lokReady() && existsSync(dataDir);
    const rpc = settlementRpcStats();
    const rpcOk = !rpc || rpc.lastError == null || rpc.lastOkAtMs != null;
    const ok = ready && rpcOk;
    res.writeHead(ok ? 200 : 503, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok, ready, rpcOk }));
    return true;
  }

  if (pathname === "/status") {
    const body = buildOpsStatus(deps);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
    return true;
  }

  return false;
}
