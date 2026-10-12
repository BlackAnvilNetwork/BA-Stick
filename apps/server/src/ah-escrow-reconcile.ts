/**
 * Boot reconcile for open book listings vs on-chain asks.
 * Never treats `open=false` alone as a cancel — filled and cancelled look
 * identical in asks(). Scan AskFilled / AskCancelled logs first (H2).
 */
import { askFilledQuarantinePath, AskFilledQuarantine } from "./lok-ask-filled-quarantine";
import { ahEscrowAddress, ASK_FILLED_TOPIC } from "./ah-escrow";
import { readAskOnchain } from "./ah-escrow-tx";
import { defaultLokDir, type LokWorld } from "./lok-world";

/** Keccak of AskCancelled(uint256). */
export const ASK_CANCELLED_TOPIC =
  "0x5ab6d218303bd8dc01c2c5e812dcbbadcfc2eb5b1fb91111e0b0ae87888ac568";

export type ReconcileDecision =
  | { action: "skip"; reason: string }
  | { action: "wait-fill"; reason: string }
  | { action: "cancel-log"; reason: string };

export type ReconcileRpc = (method: string, params: unknown[]) => Promise<unknown>;

function listingTopic(listingId: string): string {
  return "0x" + BigInt(listingId).toString(16).padStart(64, "0");
}

export async function classifyClosedAsk(opts: {
  listingId: string;
  escrow: string;
  rpcCall: ReconcileRpc;
  quarantined: boolean;
  onchain: { open: boolean; used: boolean } | null;
}): Promise<ReconcileDecision> {
  if (opts.quarantined) {
    return { action: "skip", reason: "quarantined AskFilled — do not return item to seller" };
  }
  if (!opts.onchain) {
    return { action: "skip", reason: "could not read asks()" };
  }
  if (!opts.onchain.used || opts.onchain.open) {
    return { action: "skip", reason: "ask still open or never used" };
  }

  const topic1 = listingTopic(opts.listingId);
  const filled = (await opts.rpcCall("eth_getLogs", [
    {
      address: opts.escrow,
      fromBlock: "0x0",
      toBlock: "latest",
      topics: [ASK_FILLED_TOPIC, topic1],
    },
  ])) as unknown[];
  if (Array.isArray(filled) && filled.length > 0) {
    return {
      action: "wait-fill",
      reason: "AskFilled log present — leave listing for watcher / chainFill",
    };
  }

  const cancelled = (await opts.rpcCall("eth_getLogs", [
    {
      address: opts.escrow,
      fromBlock: "0x0",
      toBlock: "latest",
      topics: [ASK_CANCELLED_TOPIC, topic1],
    },
  ])) as unknown[];
  if (Array.isArray(cancelled) && cancelled.length > 0) {
    return {
      action: "cancel-log",
      reason: "AskCancelled log present — return item to seller inbox",
    };
  }

  // Closed on-chain but no event found (RPC truncated / wrong escrow): do NOT cancel.
  return {
    action: "skip",
    reason: "ask closed on-chain but neither AskFilled nor AskCancelled found — leave listing",
  };
}

async function defaultRpc(url: string, method: string, params: unknown[]): Promise<unknown> {
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
 * For each open book listing that is closed on-chain: cancel on the log only when
 * AskCancelled is present and AskFilled is not. Never cancel on open=false alone.
 */
export async function reconcileOpenAsksFromChain(
  world: Pick<LokWorld, "openBookListings" | "cancelAsk">,
  opts?: {
    env?: NodeJS.ProcessEnv;
    dataDir?: string;
    rpcCall?: ReconcileRpc;
    quarantine?: AskFilledQuarantine;
    /** Test seam — defaults to readAskOnchain. */
    readAsk?: (listingId: string) => Promise<{ ok: true; ask: { open: boolean; used: boolean } } | { ok: false }>;
  },
): Promise<{ cancelled: string[]; waitingFill: string[]; skipped: string[] }> {
  const env = opts?.env ?? process.env;
  const escrow = ahEscrowAddress(env);
  const rpc = env.LOK_CHAIN_RPC?.trim();
  const out = { cancelled: [] as string[], waitingFill: [] as string[], skipped: [] as string[] };
  if (!escrow || !rpc) return out;

  const dataDir = opts?.dataDir ?? defaultLokDir();
  const quarantine = opts?.quarantine ?? new AskFilledQuarantine(askFilledQuarantinePath(dataDir));
  const quarantinedListingIds = new Set(
    quarantine.list().map((e) => e.fill.listingId).filter(Boolean),
  );
  const rpcCall =
    opts?.rpcCall ??
    ((method: string, params: unknown[]) => defaultRpc(rpc, method, params));
  const readAsk =
    opts?.readAsk ??
    (async (listingId: string) => {
      const r = await readAskOnchain({ listingId, env });
      if (!r.ok) return r;
      return { ok: true as const, ask: { open: r.ask.open, used: r.ask.used } };
    });

  for (const row of world.openBookListings()) {
    const onchain = await readAsk(row.id);
    const decision = await classifyClosedAsk({
      listingId: row.id,
      escrow,
      rpcCall,
      quarantined: quarantinedListingIds.has(row.id),
      onchain: onchain.ok ? { open: onchain.ask.open, used: onchain.ask.used } : null,
    });
    if (decision.action === "wait-fill") {
      out.waitingFill.push(row.id);
      continue;
    }
    if (decision.action !== "cancel-log") {
      out.skipped.push(row.id);
      continue;
    }
    const seller = row.seller;
    if (!seller) {
      out.skipped.push(row.id);
      continue;
    }
    const res = world.cancelAsk(row.id, seller);
    if (res.ok) {
      out.cancelled.push(row.id);
      console.log(
        "[bellgrave] reconciled cancelled on-chain ask #" +
          row.id +
          " onto the log (" +
          decision.reason +
          ").",
      );
    } else {
      out.skipped.push(row.id);
    }
  }
  return out;
}
