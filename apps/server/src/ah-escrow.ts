/**
 * First-party AhEscrow helpers: open asks on-chain, watch AskFilled, mirror into
 * the log as chainFill (items only — no settlement ETH on the character log).
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { defaultLokDir, type LokWorld } from "./lok-world";

/** Keccak of AskFilled(uint256,address,uint256,address,uint256,uint256,uint256). */
export const ASK_FILLED_TOPIC = "0x4f31be848e37f66bf5ef389ecfd87011d9fbf0c3fcf65dbf46b119f5058564ca";

/** Match deposit watcher depth so anvil/local and L2 behave the same. */
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
  /** Unique key for this on-chain fill (txHash-logIndex). */
  fillKey: string;
};

type RpcLog = {
  topics?: string[];
  data?: string;
  blockNumber?: string;
  logIndex?: string;
  transactionHash?: string;
};

export function decodeAskFilled(log: { topics?: string[]; data?: string }): AskFilled | null {
  const topics = log.topics ?? [];
  if (topics.length < 4 || topics[0]?.toLowerCase() !== ASK_FILLED_TOPIC.toLowerCase()) return null;
  const data = log.data ?? "";
  // abi.encode(address sellerPayout, uint256 priceWei, uint256 itemId, uint256 amount)
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

/** Apply a fill the server already observed on-chain. Items move; ETH does not enter the log. */
export function applyAskFilled(
  lok: Pick<LokWorld, "noteChainFill" | "chainFill">,
  fill: AskFilled,
  fillKey: string,
): { ok: true } | { ok: false; error: string } {
  lok.noteChainFill({
    listingId: fill.listingId,
    buyerTokenId: fill.buyerTokenId,
    priceWei: fill.priceWei,
    fillKey,
  });
  return lok.chainFill(fill.listingId, fill.buyerTokenId, fill.priceWei, fillKey);
}

/** Listing already gone / fill already mirrored — safe to advance the cursor. */
export function classifyAskFilledFailure(error: string): "replay" | "other" {
  if (/unknown listing|not found|already/i.test(error)) return "replay";
  if (/self.?transfer/i.test(error)) return "other";
  if (/over.?ask|price/i.test(error)) return "other";
  if (/not a recorded on-chain fill/i.test(error)) return "other";
  return "other";
}

export function ahEscrowAddress(env: NodeJS.ProcessEnv = process.env): string | null {
  const addr = env.LOK_AH_ESCROW?.trim();
  return addr && /^0x[0-9a-fA-F]{40}$/.test(addr) ? addr : null;
}

/** Public chain config the web client uses to sign buyAsk. RPC must be browser-reachable. */
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
  apply: (fill: AskFilled, fillKey: string) => { ok: true } | { ok: false; error: string };
}): Promise<{ cursor: bigint }> {
  const latest = BigInt(String(await opts.rpcCall("eth_blockNumber", [])));
  if (latest < ASK_FILL_CONFIRMATIONS) return { cursor: opts.cursor };
  const safeHead = latest - ASK_FILL_CONFIRMATIONS;
  if (safeHead < opts.cursor) return { cursor: opts.cursor };
  const logs = (await opts.rpcCall("eth_getLogs", [
    {
      address: opts.escrow,
      fromBlock: "0x" + opts.cursor.toString(16),
      toBlock: "0x" + safeHead.toString(16),
      topics: [ASK_FILLED_TOPIC],
    },
  ])) as RpcLog[];
  if (!Array.isArray(logs)) throw new Error("eth_getLogs returned no list");
  let cursor = safeHead + 1n;
  const ordered = logs
    .slice()
    .sort((a, b) => cmpHex(a.blockNumber, b.blockNumber) || cmpHex(a.logIndex, b.logIndex));
  for (const log of ordered) {
    const fill = decodeAskFilled(log);
    if (!fill) continue;
    const key = fillKeyOf(log);
    const res = opts.apply(fill, key);
    if (res.ok) continue;
    if (classifyAskFilledFailure(res.error) === "replay") continue;
    cursor = BigInt(log.blockNumber && log.blockNumber !== "0x" ? log.blockNumber : "0x0");
    break;
  }
  return { cursor };
}

export type AskFilledApplied = AskFilled & { sellerTokenId?: string };

export function startAskFilledWatcher(
  lok: Pick<LokWorld, "noteChainFill" | "chainFill" | "listingOf">,
  opts?: {
    cursorPath?: string;
    onFilled?: (fill: AskFilledApplied, fillKey: string) => void;
    env?: NodeJS.ProcessEnv;
  },
): void {
  const env = opts?.env ?? process.env;
  const rpc = env.LOK_CHAIN_RPC?.trim();
  const escrow = ahEscrowAddress(env);
  if (!rpc || !escrow) return;
  const cursorPath = opts?.cursorPath ?? askFilledCursorPath(defaultLokDir());
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
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      const next = await scanAskFilled({
        cursor,
        escrow,
        rpcCall: (method, params) => jsonRpc(rpc, method, params),
        apply: (fill, fillKey) => {
          const sellerTokenId = lok.listingOf?.(fill.listingId)?.seller;
          const res = applyAskFilled(lok, fill, fillKey);
          if (res.ok) {
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
            opts?.onFilled?.({ ...fill, sellerTokenId }, fillKey);
            return res;
          }
          const kind = classifyAskFilledFailure(res.error);
          if (kind === "replay") return res;
          console.error(
            "[bellgrave] AskFilled halted listing=" + fill.listingId + " key=" + fillKey + ": " + res.error,
          );
          return res;
        },
      });
      cursor = next.cursor;
      writeAskFilledCursor(cursorPath, cursor);
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

export function openAskCastArgs(
  escrow: string,
  listingId: string,
  sellerTokenId: string,
  sellerPayout: string,
  itemId: string,
  amount: string,
  priceWei: string,
  rpc: string,
  key: string,
): string[] {
  return [
    "send",
    "--rpc-url",
    rpc,
    "--private-key",
    key,
    escrow,
    "openAsk(uint256,uint256,address,uint256,uint256,uint256)",
    listingId,
    sellerTokenId,
    sellerPayout,
    itemId,
    amount,
    priceWei,
  ];
}

export function cancelAskCastArgs(escrow: string, listingId: string, rpc: string, key: string): string[] {
  return ["send", "--rpc-url", rpc, "--private-key", key, escrow, "cancelAsk(uint256)", listingId];
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
