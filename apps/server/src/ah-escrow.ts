/**
 * First-party AhEscrow helpers: open/cancel asks on-chain, watch AskFilled,
 * mirror into the log as chainFill (items only). Permanently unapplyable fills
 * are quarantined (#214 policy) so one bad fill cannot freeze AH for everyone.
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  alertAskFilledQuarantine,
  AskFilledQuarantine,
  askFilledMirroredPath,
  askFilledQuarantinePath,
  MirroredFills,
  reasonFromEngineError,
  type QuarantinedAskFill,
} from "./lok-ask-filled-quarantine";
import { defaultLokDir, type LokWorld } from "./lok-world";

/** Keccak of AskFilled(uint256,address,uint256,address,uint256,uint256,uint256). */
export const ASK_FILLED_TOPIC = "0x4f31be848e37f66bf5ef389ecfd87011d9fbf0c3fcf65dbf46b119f5058564ca";

export const ASK_FILL_CONFIRMATIONS = 2n;

export type AskFilled = {
  listingId: string;
  buyer: string;
  buyerTokenId: string;
  sellerPayout: string;
  priceWei: string;
  itemId: string;
  amount: string;
};

export type ChainFillNote = {
  listingId: string;
  buyerTokenId: string;
  priceWei: string;
  fillKey: string;
  itemId: string;
  amount: string;
  sellerTokenId: string;
  txHash: string;
  logIndex: string;
};

type RpcLog = {
  topics?: string[];
  data?: string;
  blockNumber?: string;
  logIndex?: string;
  transactionHash?: string;
};

export type ApplyAskFilledResult =
  | { ok: true; kind: "applied" | "replay" }
  | { ok: false; kind: "quarantine"; error: string; reason: ReturnType<typeof reasonFromEngineError> }
  | { ok: false; kind: "halt"; error: string };

export function decodeAskFilled(log: { topics?: string[]; data?: string }): AskFilled | null {
  const topics = log.topics ?? [];
  if (topics.length < 4 || topics[0]?.toLowerCase() !== ASK_FILLED_TOPIC.toLowerCase()) return null;
  const data = log.data ?? "";
  if (!data.startsWith("0x") || data.length < 2 + 64 * 4) return null;
  try {
    const sellerWord = data.slice(2, 2 + 64);
    const sellerPayout = "0x" + sellerWord.slice(24);
    return {
      listingId: BigInt(topics[1]!).toString(),
      buyer: "0x" + topics[2]!.slice(26),
      buyerTokenId: BigInt(topics[3]!).toString(),
      sellerPayout,
      priceWei: BigInt("0x" + data.slice(2 + 64, 2 + 128)).toString(),
      itemId: BigInt("0x" + data.slice(2 + 128, 2 + 192)).toString(),
      amount: BigInt("0x" + data.slice(2 + 192, 2 + 256)).toString(),
    };
  } catch {
    return null;
  }
}

export function fillKeyOf(log: { transactionHash?: string; logIndex?: string; blockNumber?: string }): string {
  const tx = (log.transactionHash ?? "").toLowerCase();
  const idx = log.logIndex && log.logIndex !== "0x" ? BigInt(log.logIndex).toString() : "0";
  if (tx && tx !== "0x") return tx + "-" + idx;
  const block = log.blockNumber && log.blockNumber !== "0x" ? BigInt(log.blockNumber).toString() : "0";
  return "block-" + block + "-" + idx;
}

function parseTxHash(fillKey: string, log?: RpcLog): string {
  if (log?.transactionHash && /^0x[0-9a-fA-F]{64}$/.test(log.transactionHash)) {
    return log.transactionHash.toLowerCase();
  }
  const head = fillKey.split("-")[0] ?? "";
  if (/^0x[0-9a-fA-F]{64}$/.test(head)) return head.toLowerCase();
  return "0x" + "0".repeat(64);
}

function parseLogIndex(fillKey: string, log?: RpcLog): string {
  if (log?.logIndex && log.logIndex !== "0x") {
    try {
      return BigInt(log.logIndex).toString();
    } catch {
      /* fall through */
    }
  }
  const parts = fillKey.split("-");
  const last = parts[parts.length - 1] ?? "0";
  return /^\d+$/.test(last) ? last : "0";
}

/**
 * Mirror an AskFilled into the log. Replay only when this exact fillKey was
 * already mirrored. Unknown listing / self-buy / not spawned / mismatch →
 * quarantine (caller persists). Transient/unexpected → halt.
 */
export function applyAskFilled(
  lok: Pick<LokWorld, "noteChainFill" | "chainFill" | "listingOf">,
  fill: AskFilled,
  fillKey: string,
  opts?: {
    mirrored?: MirroredFills;
    log?: RpcLog;
  },
): ApplyAskFilledResult {
  const mirrored = opts?.mirrored;
  if (mirrored?.has(fillKey)) return { ok: true, kind: "replay" };

  const listing = lok.listingOf(fill.listingId);
  if (!listing) {
    return {
      ok: false,
      kind: "quarantine",
      error: "unknown listing",
      reason: "unknown-listing",
    };
  }

  const txHash = parseTxHash(fillKey, opts?.log);
  const logIndex = parseLogIndex(fillKey, opts?.log);

  lok.noteChainFill({
    listingId: fill.listingId,
    buyerTokenId: fill.buyerTokenId,
    priceWei: fill.priceWei,
    fillKey,
    itemId: fill.itemId,
    amount: fill.amount,
    sellerTokenId: listing.seller,
    txHash,
    logIndex,
  });
  const res = lok.chainFill(fill.listingId, fill.buyerTokenId, fill.priceWei, fillKey);
  if (res.ok) {
    mirrored?.add(fillKey);
    return { ok: true, kind: "applied" };
  }

  const reason = reasonFromEngineError(res.error);
  if (reason) {
    return { ok: false, kind: "quarantine", error: res.error, reason };
  }
  return { ok: false, kind: "halt", error: res.error };
}

/** @deprecated use applyAskFilled result kinds; kept for older tests that only check ok. */
export function classifyAskFilledFailure(error: string): "replay" | "quarantine" | "other" {
  if (/already mirrored|already (applied|consumed)/i.test(error)) return "replay";
  return reasonFromEngineError(error) ? "quarantine" : "other";
}

export function ahEscrowAddress(env: NodeJS.ProcessEnv = process.env): string | null {
  const addr = env.LOK_AH_ESCROW?.trim();
  return addr && /^0x[0-9a-fA-F]{40}$/.test(addr) ? addr : null;
}

export function ahEscrowClientConfig(env: NodeJS.ProcessEnv = process.env): {
  address: string;
  rpcUrl: string;
  chainId: number;
} | null {
  const address = ahEscrowAddress(env);
  const rpcUrl = (env.LOK_PUBLIC_RPC?.trim() || env.LOK_CHAIN_RPC?.trim() || "").replace(/\/$/, "");
  if (!address || !rpcUrl) return null;
  if (!/^https?:\/\//i.test(rpcUrl) && !rpcUrl.startsWith("ws")) return null;
  const chainRaw = env.LOK_CHAIN_ID?.trim() || "31337";
  if (!/^\d+$/.test(chainRaw)) return null;
  const chainId = Number(chainRaw);
  if (!Number.isSafeInteger(chainId) || chainId <= 0) return null;
  return { address, rpcUrl, chainId };
}

export function askFilledCursorPath(dataDir: string): string {
  return join(dataDir, "lok-ask-filled-cursor.json");
}

export function readAskFilledCursor(path: string): bigint {
  if (!existsSync(path)) return 0n;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as { cursor?: string };
    if (!parsed.cursor || !/^\d+$/.test(parsed.cursor)) return 0n;
    return BigInt(parsed.cursor);
  } catch {
    return 0n;
  }
}

export function writeAskFilledCursor(path: string, cursor: bigint): void {
  const tmp = path + ".tmp";
  writeFileSync(tmp, JSON.stringify({ cursor: cursor.toString() }));
  renameSync(tmp, path);
}

export async function scanAskFilled(opts: {
  cursor: bigint;
  escrow: string;
  rpcCall: (method: string, params: unknown[]) => Promise<unknown>;
  apply: (fill: AskFilled, fillKey: string, log: RpcLog) => ApplyAskFilledResult;
  quarantine?: AskFilledQuarantine;
}): Promise<{ cursor: bigint }> {
  const latest = BigInt(String(await opts.rpcCall("eth_blockNumber", [])));
  if (latest < ASK_FILL_CONFIRMATIONS) return { cursor: opts.cursor };
  const safeHead = latest - ASK_FILL_CONFIRMATIONS;
  if (safeHead < opts.cursor) return { cursor: opts.cursor };

  // Page getLogs in 2k-block chunks so L2 RPCs with range limits still work.
  const PAGE = 2000n;
  let from = opts.cursor;
  let cursor = safeHead + 1n;
  while (from <= safeHead) {
    const to = from + PAGE - 1n > safeHead ? safeHead : from + PAGE - 1n;
    const logs = (await opts.rpcCall("eth_getLogs", [
      {
        address: opts.escrow,
        fromBlock: "0x" + from.toString(16),
        toBlock: "0x" + to.toString(16),
        topics: [ASK_FILLED_TOPIC],
      },
    ])) as RpcLog[];
    if (!Array.isArray(logs)) throw new Error("eth_getLogs returned no list");
    const ordered = logs
      .slice()
      .sort((a, b) => cmpHex(a.blockNumber, b.blockNumber) || cmpHex(a.logIndex, b.logIndex));
    for (const log of ordered) {
      const fill = decodeAskFilled(log);
      if (!fill) continue;
      const key = fillKeyOf(log);
      const res = opts.apply(fill, key, log);
      if (res.ok) continue;
      if (res.kind === "quarantine") {
        if (opts.quarantine) {
          const entry: QuarantinedAskFill = {
            id: key,
            reason: res.reason,
            error: res.error,
            fill,
            blockNumber: log.blockNumber ?? "0x0",
            logIndex: log.logIndex ?? "0x0",
            transactionHash: log.transactionHash ?? "",
            quarantinedAt: new Date().toISOString(),
          };
          if (opts.quarantine.add(entry)) alertAskFilledQuarantine(entry);
        }
        continue;
      }
      // halt
      cursor = BigInt(log.blockNumber && log.blockNumber !== "0x" ? log.blockNumber : "0x0");
      return { cursor };
    }
    from = to + 1n;
  }
  return { cursor };
}

export type AskFilledApplied = AskFilled & { sellerTokenId?: string };

export function startAskFilledWatcher(
  lok: Pick<LokWorld, "noteChainFill" | "chainFill" | "listingOf">,
  opts?: {
    cursorPath?: string;
    dataDir?: string;
    onFilled?: (fill: AskFilledApplied, fillKey: string) => void;
    env?: NodeJS.ProcessEnv;
  },
): void {
  const env = opts?.env ?? process.env;
  const rpc = env.LOK_CHAIN_RPC?.trim();
  const escrow = ahEscrowAddress(env);
  if (!rpc || !escrow) return;
  const dataDir = opts?.dataDir ?? defaultLokDir();
  const cursorPath = opts?.cursorPath ?? askFilledCursorPath(dataDir);
  const quarantine = new AskFilledQuarantine(askFilledQuarantinePath(dataDir));
  const mirrored = new MirroredFills(askFilledMirroredPath(dataDir));
  if (quarantine.list().length > 0) {
    console.error(
      "[bellgrave] ALERT " +
        quarantine.list().length +
        " AskFilled fill(s) still quarantined — pnpm --filter @bellgrave/server lok:replay-ask-filled --list",
    );
  }
  console.log(
    "[bellgrave] AhEscrow watcher rpc=" +
      rpc +
      " escrow=" +
      escrow +
      " confirmations=" +
      ASK_FILL_CONFIRMATIONS.toString(),
  );
  let cursor = readAskFilledCursor(cursorPath);
  let busy = false;
  let haltedLogged = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      const next = await scanAskFilled({
        cursor,
        escrow,
        quarantine,
        rpcCall: (method, params) => jsonRpc(rpc, method, params),
        apply: (fill, fillKey, log) => {
          const beforeSeller = lok.listingOf(fill.listingId)?.seller;
          const res = applyAskFilled(lok, fill, fillKey, { mirrored, log });
          if (res.ok && res.kind === "applied") {
            console.log(
              "[bellgrave] chainFill listing=" +
                fill.listingId +
                " buyer=" +
                fill.buyerTokenId +
                " price=" +
                fill.priceWei +
                " key=" +
                fillKey,
            );
            opts?.onFilled?.({ ...fill, sellerTokenId: beforeSeller }, fillKey);
            haltedLogged = false;
            return res;
          }
          if (res.ok) {
            haltedLogged = false;
            return res;
          }
          if (res.kind === "halt") {
            if (!haltedLogged) {
              console.error(
                "[bellgrave] AskFilled halted listing=" + fill.listingId + " key=" + fillKey + ": " + res.error,
              );
              haltedLogged = true;
            }
          }
          return res;
        },
      });
      cursor = next.cursor;
      writeAskFilledCursor(cursorPath, cursor);
    } catch (err) {
      console.error("[bellgrave] AhEscrow watcher", err);
    } finally {
      busy = false;
    }
  };
  tick().catch((err) => console.error("[bellgrave] AhEscrow watcher", err));
  const timer = setInterval(() => {
    tick().catch((err) => console.error("[bellgrave] AhEscrow watcher", err));
  }, 4000);
  timer.unref?.();
}

export function listingRoleKey(env: NodeJS.ProcessEnv = process.env): string | null {
  const key = (env.LOK_LISTING_KEY?.trim() || env.LOK_OWNER_KEY?.trim() || "").trim();
  return /^0x[0-9a-fA-F]{64}$/.test(key) ? key : null;
}

function cmpHex(a: string | undefined, b: string | undefined): number {
  const left = BigInt(a && a !== "0x" ? a : "0x0");
  const right = BigInt(b && b !== "0x" ? b : "0x0");
  return left < right ? -1 : left > right ? 1 : 0;
}

async function jsonRpc(url: string, method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = (await res.json()) as { result?: unknown; error?: { message?: string } };
  if (body.error) throw new Error(body.error.message || "rpc error");
  return body.result;
}
