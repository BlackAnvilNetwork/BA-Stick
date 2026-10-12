/**
 * When a character NFT transfers, cancel open AhEscrow book asks for that
 * character (mainnet rule 2: owner change cancels open listings).
 * Failed on-chain cancels are persisted and retried each tick so the cursor
 * can advance without dropping work. Rebind-without-cancel needs an escrow
 * change and is deferred to redeploy.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ahEscrowAddress, listingRoleKey } from "./ah-escrow";
import { classifyClosedAsk, type ReconcileRpc } from "./ah-escrow-reconcile";
import { cancelAskOnchain, readAskOnchain } from "./ah-escrow-tx";
import { defaultLokDir, type LokWorld } from "./lok-world";
import { writeTextAtomic } from "./lok-vault";

/** keccak256("Transfer(address,address,uint256)") — ERC-721. */
export const ERC721_TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

/** Scan this many blocks behind tip so a reorg cannot hide a Transfer. */
export const NFT_TRANSFER_CONFIRMATIONS = 2n;

type RpcLog = {
  topics?: string[];
  data?: string;
  blockNumber?: string;
  logIndex?: string;
  transactionHash?: string;
};

export type NftTransfer = {
  from: string;
  to: string;
  tokenId: string;
};

export type PendingCancel = {
  listingId: string;
  sellerTokenId: string;
};

export function decodeErc721Transfer(log: { topics?: string[] }): NftTransfer | null {
  const topics = log.topics ?? [];
  if (topics.length < 4 || topics[0]?.toLowerCase() !== ERC721_TRANSFER_TOPIC.toLowerCase()) {
    return null;
  }
  try {
    return {
      from: ("0x" + topics[1]!.slice(26)).toLowerCase(),
      to: ("0x" + topics[2]!.slice(26)).toLowerCase(),
      tokenId: BigInt(topics[3]!).toString(),
    };
  } catch {
    return null;
  }
}

export function nftTransferCursorPath(dataDir: string): string {
  return join(dataDir, "nft-transfer-ask-cancel-cursor.json");
}

export function nftTransferPendingPath(dataDir: string): string {
  return join(dataDir, "nft-transfer-pending-cancels.json");
}

function readCursor(path: string): bigint {
  if (!existsSync(path)) return 0n;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as { cursor?: string };
    if (raw.cursor && /^\d+$/.test(raw.cursor)) return BigInt(raw.cursor);
  } catch {
    /* start over */
  }
  return 0n;
}

function writeCursor(path: string, cursor: bigint): void {
  writeTextAtomic(path, JSON.stringify({ cursor: cursor.toString() }, null, 2) + "\n");
}

export function readPendingCancels(path: string): PendingCancel[] {
  if (!existsSync(path)) return [];
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as { pending?: PendingCancel[] };
    if (!Array.isArray(raw.pending)) return [];
    const out: PendingCancel[] = [];
    const seen = new Set<string>();
    for (const row of raw.pending) {
      if (!row || typeof row !== "object") continue;
      const listingId = String(row.listingId ?? "");
      const sellerTokenId = String(row.sellerTokenId ?? "");
      if (!/^[1-9][0-9]{0,77}$/.test(listingId) || !/^[1-9][0-9]{0,77}$/.test(sellerTokenId)) {
        continue;
      }
      if (seen.has(listingId)) continue;
      seen.add(listingId);
      out.push({ listingId, sellerTokenId });
    }
    return out;
  } catch {
    return [];
  }
}

export function writePendingCancels(path: string, pending: PendingCancel[]): void {
  const unique: PendingCancel[] = [];
  const seen = new Set<string>();
  for (const row of pending) {
    if (seen.has(row.listingId)) continue;
    seen.add(row.listingId);
    unique.push({ listingId: row.listingId, sellerTokenId: row.sellerTokenId });
  }
  writeTextAtomic(path, JSON.stringify({ pending: unique }, null, 2) + "\n");
}

function nftAddress(env: NodeJS.ProcessEnv): string | null {
  const nft = env.LOK_NFT?.trim() || "";
  return /^0x[0-9a-fA-F]{40}$/.test(nft) ? nft.toLowerCase() : null;
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

export type CancelAsksResult = {
  cancelled: string[];
  /** Filled on-chain — leave for AskFilled watcher. */
  skipped: string[];
  /** On-chain or log cancel failed / ambiguous — retry next tick. */
  pending: PendingCancel[];
};

/**
 * Cancel every open book listing for `sellerTokenId` on-chain + log.
 * Failed cancels are returned in `pending` for durable retry.
 */
export async function cancelOpenAsksForCharacter(
  lok: Pick<LokWorld, "openBookListings" | "cancelAsk">,
  sellerTokenId: string,
  opts?: {
    env?: NodeJS.ProcessEnv;
    /** Limit to these listing ids (pending retry). Default: all open book asks for the character. */
    listingIds?: string[];
    cancelOnchain?: (listingId: string) => Promise<
      | { ok: true; alreadyClosed?: boolean; neverOpened?: boolean }
      | { ok: false; error: string }
    >;
    /** When on-chain ask is already closed, classify AskFilled vs AskCancelled. */
    classifyClosed?: (listingId: string) => Promise<
      | { action: "cancel-log" }
      | { action: "wait-fill" }
      | { action: "skip" }
    >;
  },
): Promise<CancelAsksResult> {
  const env = opts?.env ?? process.env;
  const out: CancelAsksResult = { cancelled: [], skipped: [], pending: [] };
  const idFilter = opts?.listingIds ? new Set(opts.listingIds) : null;
  const rows = lok
    .openBookListings()
    .filter((row) => row.seller === sellerTokenId && (!idFilter || idFilter.has(row.id)));
  if (rows.length === 0) return out;

  const cancel =
    opts?.cancelOnchain ??
    (async (listingId: string) => {
      if (!ahEscrowAddress(env) || !listingRoleKey(env)) {
        return { ok: true as const, neverOpened: true };
      }
      return cancelAskOnchain({ listingId, env });
    });

  for (const row of rows) {
    const chain = await cancel(row.id);
    if (!chain.ok) {
      out.pending.push({ listingId: row.id, sellerTokenId });
      console.error(
        "[bellgrave] NFT transfer: on-chain cancel failed for ask #" +
          row.id +
          " char=" +
          sellerTokenId +
          ": " +
          chain.error +
          " (queued for retry)",
      );
      continue;
    }
    if ("alreadyClosed" in chain && chain.alreadyClosed) {
      // Filled vs cancelled look the same in asks() — classify events (H2 / boot reconcile).
      const decision = opts?.classifyClosed
        ? await opts.classifyClosed(row.id)
        : { action: "skip" as const };
      if (decision.action === "cancel-log") {
        const res = lok.cancelAsk(row.id, sellerTokenId);
        if (res.ok) {
          out.cancelled.push(row.id);
          console.log(
            "[bellgrave] NFT transfer: log-cancelled ask #" +
              row.id +
              " after AskCancelled (on-chain already closed)",
          );
        } else {
          out.pending.push({ listingId: row.id, sellerTokenId });
          console.error(
            "[bellgrave] NFT transfer: log cancel failed for already-closed ask #" +
              row.id +
              ": " +
              res.error +
              " (queued for retry)",
          );
        }
      } else if (decision.action === "wait-fill") {
        out.skipped.push(row.id);
      } else {
        // Ambiguous closed ask — retry classify later (covers crash before log cancel).
        out.pending.push({ listingId: row.id, sellerTokenId });
      }
      continue;
    }
    const neverOpened = "neverOpened" in chain && !!chain.neverOpened;
    const res = lok.cancelAsk(row.id, sellerTokenId);
    if (res.ok) {
      out.cancelled.push(row.id);
      console.log(
        "[bellgrave] NFT transfer: cancelled ask #" +
          row.id +
          " for character " +
          sellerTokenId +
          (neverOpened ? " (log only)" : ""),
      );
    } else {
      // On-chain cancel succeeded; log cancel failed — retry (next pass sees alreadyClosed).
      out.pending.push({ listingId: row.id, sellerTokenId });
      console.error(
        "[bellgrave] NFT transfer: log cancel failed for ask #" +
          row.id +
          ": " +
          res.error +
          " (queued for retry)",
      );
    }
  }
  return out;
}

/** Retry persisted pending cancels; drop rows that are no longer open book asks. */
export async function retryPendingCancels(
  lok: Pick<LokWorld, "openBookListings" | "cancelAsk">,
  pending: PendingCancel[],
  opts?: Parameters<typeof cancelOpenAsksForCharacter>[2],
): Promise<{ remaining: PendingCancel[]; cancelled: string[] }> {
  const stillOpen = new Set(lok.openBookListings().map((r) => r.id));
  const bySeller = new Map<string, string[]>();
  const remaining: PendingCancel[] = [];
  const cancelled: string[] = [];

  for (const row of pending) {
    if (!stillOpen.has(row.listingId)) continue; // already gone from the book
    const list = bySeller.get(row.sellerTokenId) ?? [];
    list.push(row.listingId);
    bySeller.set(row.sellerTokenId, list);
  }

  for (const [sellerTokenId, listingIds] of bySeller) {
    const res = await cancelOpenAsksForCharacter(lok, sellerTokenId, {
      ...opts,
      listingIds,
    });
    cancelled.push(...res.cancelled);
    remaining.push(...res.pending);
    // skipped (wait-fill) are intentionally dropped from pending
  }
  return { remaining, cancelled };
}

export async function scanNftTransfers(opts: {
  cursor: bigint;
  nft: string;
  rpcCall: (method: string, params: unknown[]) => Promise<unknown>;
  onTransfer: (xfer: NftTransfer) => Promise<void>;
  /** Blocks behind tip (default NFT_TRANSFER_CONFIRMATIONS). */
  confirmations?: bigint;
}): Promise<{ cursor: bigint }> {
  const confirmations = opts.confirmations ?? NFT_TRANSFER_CONFIRMATIONS;
  const latestHex = (await opts.rpcCall("eth_blockNumber", [])) as string;
  const latest = BigInt(latestHex);
  const safeHead = latest > confirmations ? latest - confirmations : 0n;
  let from = opts.cursor === 0n ? (safeHead > 0n ? safeHead : 0n) : opts.cursor + 1n;
  if (from > safeHead) return { cursor: opts.cursor };

  const page = 2_000n;
  let cursor = opts.cursor;
  while (from <= safeHead) {
    const to = from + page - 1n > safeHead ? safeHead : from + page - 1n;
    const logs = (await opts.rpcCall("eth_getLogs", [
      {
        address: opts.nft,
        fromBlock: "0x" + from.toString(16),
        toBlock: "0x" + to.toString(16),
        topics: [ERC721_TRANSFER_TOPIC],
      },
    ])) as RpcLog[];
    if (!Array.isArray(logs)) throw new Error("eth_getLogs returned no list");
    for (const log of logs) {
      const xfer = decodeErc721Transfer(log);
      if (!xfer) continue;
      // Ignore mint (from zero) — no prior owner listings to fix.
      if (xfer.from === "0x0000000000000000000000000000000000000000") continue;
      // Self-transfer does not change ownership — do not cancel asks.
      if (xfer.from === xfer.to) continue;
      await opts.onTransfer(xfer);
    }
    cursor = to;
    from = to + 1n;
  }
  return { cursor };
}

function defaultClassifyClosed(
  env: NodeJS.ProcessEnv,
  rpc: string,
): (listingId: string) => Promise<{ action: "cancel-log" } | { action: "wait-fill" } | { action: "skip" }> {
  const escrow = ahEscrowAddress(env);
  return async (listingId: string) => {
    if (!escrow) return { action: "skip" };
    const rpcCall: ReconcileRpc = (method, params) => jsonRpc(rpc, method, params);
    const onchainRaw = await (async () => {
      try {
        const r = await readAskOnchain({ listingId, env });
        if (!r.ok) return null;
        return { open: r.ask.open, used: r.ask.used };
      } catch {
        return null;
      }
    })();
    const decision = await classifyClosedAsk({
      listingId,
      escrow,
      rpcCall,
      quarantined: false,
      onchain: onchainRaw,
    });
    if (decision.action === "cancel-log") return { action: "cancel-log" };
    if (decision.action === "wait-fill") return { action: "wait-fill" };
    return { action: "skip" };
  };
}

export function startNftTransferAskCancelWatcher(
  lok: Pick<LokWorld, "openBookListings" | "cancelAsk">,
  opts?: {
    cursorPath?: string;
    pendingPath?: string;
    dataDir?: string;
    env?: NodeJS.ProcessEnv;
  },
): void {
  const env = opts?.env ?? process.env;
  const rpc = env.LOK_CHAIN_RPC?.trim();
  const nft = nftAddress(env);
  if (!rpc || !nft) return;
  if (!ahEscrowAddress(env)) return;

  const dataDir = opts?.dataDir ?? defaultLokDir();
  const cursorPath = opts?.cursorPath ?? nftTransferCursorPath(dataDir);
  const pendingPath = opts?.pendingPath ?? nftTransferPendingPath(dataDir);
  console.log(
    "[bellgrave] NFT transfer ask-cancel watcher rpc=" +
      rpc +
      " nft=" +
      nft +
      " confirmations=" +
      NFT_TRANSFER_CONFIRMATIONS.toString(),
  );

  let cursor = readCursor(cursorPath);
  let pending = readPendingCancels(pendingPath);
  let busy = false;
  const classifyClosed = defaultClassifyClosed(env, rpc);

  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      const retried = await retryPendingCancels(lok, pending, { env, classifyClosed });
      pending = retried.remaining;

      const next = await scanNftTransfers({
        cursor,
        nft,
        rpcCall: (method, params) => jsonRpc(rpc, method, params),
        onTransfer: async (xfer) => {
          const res = await cancelOpenAsksForCharacter(lok, xfer.tokenId, {
            env,
            classifyClosed,
          });
          pending = pending.concat(res.pending);
        },
      });
      cursor = next.cursor;
      writeCursor(cursorPath, cursor);
      writePendingCancels(pendingPath, pending);
    } catch (err) {
      console.error("[bellgrave] NFT transfer ask-cancel watcher", err);
      try {
        writePendingCancels(pendingPath, pending);
      } catch {
        /* ignore */
      }
    } finally {
      busy = false;
    }
  };
  tick().catch((err) => console.error("[bellgrave] NFT transfer ask-cancel watcher", err));
  const timer = setInterval(() => {
    tick().catch((err) => console.error("[bellgrave] NFT transfer ask-cancel watcher", err));
  }, 5000);
  timer.unref?.();
}
