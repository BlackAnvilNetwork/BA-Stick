/**
 * Per-character / per-wallet rate limits for lok/list, lok/cancel, lok/reclaim (H-1).
 * Also enforces a minimum listing lifetime before cancel and a global LISTING gas budget.
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { defaultLokDir } from "./lok-world";
import { opsAlert } from "./ops-log";

type Bucket = { count: number; resetAt: number };

const listByChar = new Map<string, Bucket>();
const listByWallet = new Map<string, Bucket>();
const cancelByChar = new Map<string, Bucket>();
const cancelByWallet = new Map<string, Bucket>();

/** Earliest cancel time per listingId (ms). */
const listingOpenedAt = new Map<string, number>();

export const LIST_MAX_PER_CHAR_PER_HOUR = 10;
export const LIST_MAX_PER_WALLET_PER_HOUR = 30;
export const CANCEL_MAX_PER_CHAR_PER_HOUR = 10;
export const CANCEL_MAX_PER_WALLET_PER_HOUR = 30;
/** Cap LISTING key txs (list+cancel+reclaim) across all wallets — persisted. */
export const GLOBAL_LISTING_TX_MAX_PER_HOUR = 120;
/** Minimum time a listing must stay open before cancel/reclaim (ms). */
export const MIN_LISTING_LIFETIME_MS = 60_000;

const HOUR = 3_600_000;
const GLOBAL_BUDGET_FILE = "listing-tx-budget.json";

type GlobalBudget = { count: number; resetAt: number };

function globalBudgetPath(dataDir = defaultLokDir()): string {
  return join(dataDir, GLOBAL_BUDGET_FILE);
}

function readGlobalBudget(dataDir?: string): GlobalBudget {
  const path = globalBudgetPath(dataDir);
  if (!existsSync(path)) return { count: 0, resetAt: 0 };
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as GlobalBudget;
    if (typeof raw.count === "number" && typeof raw.resetAt === "number") return raw;
  } catch {
    /* fresh */
  }
  return { count: 0, resetAt: 0 };
}

function writeGlobalBudget(row: GlobalBudget, dataDir?: string): void {
  const path = globalBudgetPath(dataDir);
  const tmp = path + ".tmp";
  writeFileSync(tmp, JSON.stringify(row, null, 2) + "\n");
  renameSync(tmp, path);
}

export function consumeGlobalListingTxBudget(opts?: {
  now?: number;
  dataDir?: string;
  max?: number;
}): { ok: true } | { ok: false; error: string } {
  const now = opts?.now ?? Date.now();
  const max = opts?.max ?? GLOBAL_LISTING_TX_MAX_PER_HOUR;
  let row = readGlobalBudget(opts?.dataDir);
  if (now >= row.resetAt) row = { count: 0, resetAt: now + HOUR };
  if (row.count >= max) {
    return {
      ok: false,
      error:
        "Global listing gas budget exhausted (max " +
        max +
        " LISTING txs/h). Try again later.",
    };
  }
  row.count += 1;
  writeGlobalBudget(row, opts?.dataDir);
  return { ok: true };
}

function consume(map: Map<string, Bucket>, key: string, max: number, now: number, windowMs = HOUR): boolean {
  const row = map.get(key);
  if (!row || now >= row.resetAt) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (row.count >= max) return false;
  row.count += 1;
  return true;
}

export function noteListingOpened(listingId: string, now = Date.now()): void {
  listingOpenedAt.set(listingId, now);
}

export function clearListingOpened(listingId: string): void {
  listingOpenedAt.delete(listingId);
}

export function listingMinLifetimeOk(
  listingId: string,
  now = Date.now(),
  minMs = MIN_LISTING_LIFETIME_MS,
): { ok: true } | { ok: false; error: string; waitMs: number } {
  let opened = listingOpenedAt.get(listingId);
  if (opened == null) {
    opened = now;
    listingOpenedAt.set(listingId, now);
  }
  const elapsed = now - opened;
  if (elapsed >= minMs) return { ok: true };
  const waitMs = minMs - elapsed;
  return {
    ok: false,
    waitMs,
    error: "Listing must stay open at least " + Math.ceil(minMs / 1000) + "s before cancel (" + Math.ceil(waitMs / 1000) + "s left).",
  };
}

/**
 * Per-char / per-wallet only. Charge `consumeGlobalListingTxBudget` immediately
 * before a real LISTING broadcast — never on refused / neverOpened paths.
 */
export function consumeListBudget(opts: {
  charId: string;
  wallet: string;
  now?: number;
}): { ok: true } | { ok: false; error: string } {
  const now = opts.now ?? Date.now();
  if (!consume(listByChar, opts.charId, LIST_MAX_PER_CHAR_PER_HOUR, now)) {
    return { ok: false, error: "List rate limit: too many listings for this character (max " + LIST_MAX_PER_CHAR_PER_HOUR + "/h)." };
  }
  if (!consume(listByWallet, opts.wallet.toLowerCase(), LIST_MAX_PER_WALLET_PER_HOUR, now)) {
    return { ok: false, error: "List rate limit: too many listings for this wallet (max " + LIST_MAX_PER_WALLET_PER_HOUR + "/h)." };
  }
  return { ok: true };
}

export function consumeCancelBudget(opts: {
  charId: string;
  wallet: string;
  now?: number;
}): { ok: true } | { ok: false; error: string } {
  const now = opts.now ?? Date.now();
  if (!consume(cancelByChar, opts.charId, CANCEL_MAX_PER_CHAR_PER_HOUR, now)) {
    return { ok: false, error: "Cancel rate limit: too many cancels for this character (max " + CANCEL_MAX_PER_CHAR_PER_HOUR + "/h)." };
  }
  if (!consume(cancelByWallet, opts.wallet.toLowerCase(), CANCEL_MAX_PER_WALLET_PER_HOUR, now)) {
    return { ok: false, error: "Cancel rate limit: too many cancels for this wallet (max " + CANCEL_MAX_PER_WALLET_PER_HOUR + "/h)." };
  }
  return { ok: true };
}

/** LISTING EOA balance alert threshold (wei). Default 0.05 xDAI. */
export function listingLowBalanceWei(env: NodeJS.ProcessEnv = process.env): bigint {
  const raw = env.LOK_LISTING_LOW_BALANCE_WEI?.trim();
  if (raw && /^\d+$/.test(raw)) return BigInt(raw);
  return 5n * 10n ** 16n; // 0.05 xDAI
}

let lastLowBalAlertAt = 0;

export async function maybeAlertListingLowBalance(opts: {
  balanceWei: bigint;
  address: string;
  env?: NodeJS.ProcessEnv;
  now?: number;
}): Promise<boolean> {
  const threshold = listingLowBalanceWei(opts.env);
  if (opts.balanceWei >= threshold) return false;
  const now = opts.now ?? Date.now();
  if (now - lastLowBalAlertAt < 60_000) return false;
  lastLowBalAlertAt = now;
  opsAlert({
    level: "alert",
    event: "ops",
    msg: "LISTING wallet low balance",
    address: opts.address,
    balanceWei: opts.balanceWei.toString(),
    thresholdWei: threshold.toString(),
    dedupeKey: "listing-low-bal",
  });
  return true;
}

export function resetListRateForTests(): void {
  listByChar.clear();
  listByWallet.clear();
  cancelByChar.clear();
  cancelByWallet.clear();
  listingOpenedAt.clear();
  lastLowBalAlertAt = 0;
}
