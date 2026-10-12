/**
 * Structured ops alerts (one JSON line on stderr) for lag / dropped cancels / quarantine.
 * Keeps a small in-memory ring for /status.
 */

export type OpsAlertEvent =
  | "watcher_lag"
  | "nft_transfer_cancel_dropped"
  | "ask_filled_quarantine"
  | "ops";

export type OpsAlert = {
  ts: string;
  level: "alert" | "warn" | "info";
  event: OpsAlertEvent;
  msg: string;
  [key: string]: unknown;
};

export type OpsAlertInput = {
  level: "alert" | "warn" | "info";
  event: OpsAlertEvent;
  msg: string;
  ts?: string;
  dedupeKey?: string;
  dedupeMs?: number;
  [key: string]: unknown;
};

const RING_MAX = 50;
const ring: OpsAlert[] = [];
const lastByKey = new Map<string, number>();

/** Min ms between identical lag alerts (same watcher + lag bucket). */
const DEFAULT_DEDUPE_MS = 60_000;

export function watcherLagAlertBlocks(env: NodeJS.ProcessEnv = process.env): bigint {
  const raw = env.LOK_WATCHER_LAG_ALERT_BLOCKS?.trim();
  if (raw && /^\d+$/.test(raw)) return BigInt(raw);
  return 50n;
}

export function opsAlert(partial: OpsAlertInput): OpsAlert {
  const dedupeKey = typeof partial.dedupeKey === "string" ? partial.dedupeKey : undefined;
  const dedupeMs =
    typeof partial.dedupeMs === "number" ? partial.dedupeMs : DEFAULT_DEDUPE_MS;
  if (dedupeKey) {
    const prev = lastByKey.get(dedupeKey) ?? 0;
    if (Date.now() - prev < dedupeMs) {
      return {
        ts: new Date().toISOString(),
        level: partial.level,
        event: partial.event,
        msg: partial.msg,
        suppressed: true,
      };
    }
    lastByKey.set(dedupeKey, Date.now());
  }

  const entry: OpsAlert = {
    level: partial.level,
    event: partial.event,
    msg: partial.msg,
    ts: typeof partial.ts === "string" ? partial.ts : new Date().toISOString(),
  };
  for (const [k, v] of Object.entries(partial)) {
    if (
      k === "dedupeKey" ||
      k === "dedupeMs" ||
      k === "ts" ||
      k === "level" ||
      k === "event" ||
      k === "msg"
    ) {
      continue;
    }
    entry[k] = v;
  }
  ring.push(entry);
  if (ring.length > RING_MAX) ring.shift();

  console.error("[bellgrave] " + JSON.stringify(entry));
  return entry;
}

export function recentOpsAlerts(): OpsAlert[] {
  return ring.slice();
}

/** Test seam. */
export function resetOpsAlertsForTests(): void {
  ring.length = 0;
  lastByKey.clear();
}
