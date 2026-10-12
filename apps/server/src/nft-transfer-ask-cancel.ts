/**
 * When a character NFT transfers, cancel open AhEscrow book asks for that
 * character (mainnet rule 2: owner change cancels open listings).
 * Rebind-without-cancel needs an escrow change and is deferred to redeploy.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ahEscrowAddress, listingRoleKey } from "./ah-escrow";
import { cancelAskOnchain } from "./ah-escrow-tx";
import { defaultLokDir, type LokWorld } from "./lok-world";
import { writeTextAtomic } from "./lok-vault";

/** keccak256("Transfer(address,address,uint256)") — ERC-721. */
export const ERC721_TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

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

/**
 * Cancel every open book listing for `sellerTokenId` on-chain + log.
 * Safe to call when the NFT just transferred away from the previous owner.
 */
export async function cancelOpenAsksForCharacter(
  lok: Pick<LokWorld, "openBookListings" | "cancelAsk">,
  sellerTokenId: string,
  opts?: {
    env?: NodeJS.ProcessEnv;
    cancelOnchain?: (listingId: string) => Promise<
      | { ok: true; alreadyClosed?: boolean; neverOpened?: boolean }
      | { ok: false; error: string }
    >;
  },
): Promise<{ cancelled: string[]; skipped: string[] }> {
  const env = opts?.env ?? process.env;
  const out = { cancelled: [] as string[], skipped: [] as string[] };
  const rows = lok.openBookListings().filter((row) => row.seller === sellerTokenId);
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
      out.skipped.push(row.id);
      console.error(
        "[bellgrave] NFT transfer: on-chain cancel failed for ask #" +
          row.id +
          " char=" +
          sellerTokenId +
          ": " +
          chain.error,
      );
      continue;
    }
    if ("alreadyClosed" in chain && chain.alreadyClosed) {
      // Likely filled — leave log open for AskFilled watcher.
      out.skipped.push(row.id);
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
      out.skipped.push(row.id);
      console.error(
        "[bellgrave] NFT transfer: log cancel failed for ask #" +
          row.id +
          ": " +
          res.error,
      );
    }
  }
  return out;
}

export async function scanNftTransfers(opts: {
  cursor: bigint;
  nft: string;
  rpcCall: (method: string, params: unknown[]) => Promise<unknown>;
  onTransfer: (xfer: NftTransfer) => Promise<void>;
}): Promise<{ cursor: bigint }> {
  const latestHex = (await opts.rpcCall("eth_blockNumber", [])) as string;
  const latest = BigInt(latestHex);
  let from = opts.cursor === 0n ? (latest > 2n ? latest - 2n : 0n) : opts.cursor + 1n;
  if (from > latest) return { cursor: opts.cursor };

  const page = 2_000n;
  let cursor = opts.cursor;
  while (from <= latest) {
    const to = from + page - 1n > latest ? latest : from + page - 1n;
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
      // Ignore mint (from zero) for ask-cancel — no prior owner listings to fix.
      if (xfer.from === "0x0000000000000000000000000000000000000000") continue;
      await opts.onTransfer(xfer);
    }
    cursor = to;
    from = to + 1n;
  }
  return { cursor };
}

export function startNftTransferAskCancelWatcher(
  lok: Pick<LokWorld, "openBookListings" | "cancelAsk">,
  opts?: {
    cursorPath?: string;
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
  console.log(
    "[bellgrave] NFT transfer ask-cancel watcher rpc=" + rpc + " nft=" + nft,
  );

  let cursor = readCursor(cursorPath);
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      const next = await scanNftTransfers({
        cursor,
        nft,
        rpcCall: (method, params) => jsonRpc(rpc, method, params),
        onTransfer: async (xfer) => {
          await cancelOpenAsksForCharacter(lok, xfer.tokenId, { env });
        },
      });
      cursor = next.cursor;
      writeCursor(cursorPath, cursor);
    } catch (err) {
      console.error("[bellgrave] NFT transfer ask-cancel watcher", err);
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
