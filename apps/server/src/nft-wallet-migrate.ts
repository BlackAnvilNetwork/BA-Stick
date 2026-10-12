/**
 * One-off / boot migration: rebind log character wallets to live CharacterNFT ownerOf.
 * Fixes burner-bound rows when the NFT is held by a different wallet (C-1 re-test #3).
 *
 * Runs with bounded concurrency and a per-RPC timeout so boot cannot stall indefinitely.
 */
import { readCharacterNftOwner } from "./lok-vault";
import type { LokWorld } from "./lok-world";
import { nftOwnerCache } from "./nft-owner-cache";
import { opsAlert } from "./ops-log";

export type MigrateResult = {
  checked: number;
  rebound: number;
  skipped: number;
  errors: string[];
};

/** Max concurrent ownerOf reads during boot migration. */
export const MIGRATE_CONCURRENCY = 8;

/** Per-character ownerOf timeout (ms). */
export const MIGRATE_RPC_TIMEOUT_MS = 8_000;

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(label + " timed out after " + ms + "ms")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const i = next;
      next += 1;
      out[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return out;
}

export async function migrateCharacterWalletsToNftOwners(
  lok: Pick<LokWorld, "boundChars" | "rebindWallet">,
  opts?: {
    env?: NodeJS.ProcessEnv;
    dataDir?: string;
    concurrency?: number;
    rpcTimeoutMs?: number;
    /** Test seam. */
    readOwner?: typeof readCharacterNftOwner;
  },
): Promise<MigrateResult> {
  const out: MigrateResult = { checked: 0, rebound: 0, skipped: 0, errors: [] };
  const chars = lok.boundChars();
  const concurrency = opts?.concurrency ?? MIGRATE_CONCURRENCY;
  const timeoutMs = opts?.rpcTimeoutMs ?? MIGRATE_RPC_TIMEOUT_MS;
  const readOwner = opts?.readOwner ?? readCharacterNftOwner;

  type Row = (typeof chars)[number];
  type RowResult =
    | { kind: "skip" }
    | { kind: "checked-skip" }
    | { kind: "rebound"; charId: string; tokenId: string; previous: string | null; owner: string }
    | { kind: "error"; msg: string };

  const results = await mapPool(chars, concurrency, async (row: Row): Promise<RowResult> => {
    if (!row.tokenId || !/^[1-9][0-9]{0,77}$/.test(row.tokenId)) {
      return { kind: "skip" };
    }
    try {
      const live = await withTimeout(
        readOwner(row.tokenId, opts?.env),
        timeoutMs,
        "ownerOf #" + row.tokenId,
      );
      if (!live.ok) {
        return { kind: "error", msg: "#" + row.tokenId + ": " + live.error };
      }
      const owner = live.holder.toLowerCase();
      nftOwnerCache(opts?.dataDir).set(row.tokenId, owner, 0);
      const current = row.wallet?.toLowerCase() ?? null;
      if (current === owner) {
        return { kind: "checked-skip" };
      }
      const reb = lok.rebindWallet(row.charId, owner);
      if (!reb.ok) {
        return { kind: "error", msg: row.charId + ": " + reb.error };
      }
      return {
        kind: "rebound",
        charId: row.charId,
        tokenId: row.tokenId,
        previous: reb.previous ?? null,
        owner,
      };
    } catch (err) {
      return {
        kind: "error",
        msg: "#" + row.tokenId + ": " + (err instanceof Error ? err.message : String(err)),
      };
    }
  });

  for (const r of results) {
    if (r.kind === "skip") {
      out.skipped += 1;
      continue;
    }
    out.checked += 1;
    if (r.kind === "checked-skip") {
      out.skipped += 1;
      continue;
    }
    if (r.kind === "error") {
      out.errors.push(r.msg);
      continue;
    }
    out.rebound += 1;
    console.log(
      "[bellgrave] C-1 migrate rebind char=" +
        r.charId +
        " token=" +
        r.tokenId +
        " " +
        (r.previous ?? "null") +
        " → " +
        r.owner,
    );
  }
  if (out.rebound > 0) {
    opsAlert({
      level: "info",
      event: "ops",
      msg: "C-1 wallet migration rebound " + out.rebound + " character(s)",
      rebound: out.rebound,
      checked: out.checked,
      dedupeKey: "c1-migrate:" + out.rebound,
    });
  }
  if (out.errors.length > 0) {
    opsAlert({
      level: "alert",
      event: "ops",
      msg:
        "C-1 wallet migration ownerOf errors: " +
        out.errors.length +
        (out.errors[0] ? " (e.g. " + out.errors[0] + ")" : ""),
      errors: out.errors.length,
      checked: out.checked,
      rebound: out.rebound,
      dedupeKey: "c1-migrate-errors",
    });
  }
  return out;
}
