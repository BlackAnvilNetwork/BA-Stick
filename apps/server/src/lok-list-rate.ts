/**
 * Per-character / per-wallet rate limits for lok/list, lok/cancel, lok/reclaim (H-1).
 * Also enforces a minimum listing lifetime before cancel.
 */
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
/** Minimum time a listing must stay open before cancel/reclaim (ms). */
export const MIN_LISTING_LIFETIME_MS = 60_000;

const HOUR = 3_600_000;

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
  const opened = listingOpenedAt.get(listingId);
  if (opened == null) return { ok: true }; // legacy / unknown — allow (watcher-driven cancels)
  const elapsed = now - opened;
  if (elapsed >= minMs) return { ok: true };
  const waitMs = minMs - elapsed;
  return {
    ok: false,
    waitMs,
    error: "Listing must stay open at least " + Math.ceil(minMs / 1000) + "s before cancel (" + Math.ceil(waitMs / 1000) + "s left).",
  };
}

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
