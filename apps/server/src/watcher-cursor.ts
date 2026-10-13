/**
 * Persisted watcher cursors with chainId + contract address binding.
 * A cursor from another chain or deploy is ignored so we fall back to LOK_DEPLOY_BLOCK.
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";

export type WatcherCursorFile = {
  cursor: string;
  chainId?: number;
  address?: string;
};

export type ReadWatcherCursorOpts = {
  path: string;
  expectedChainId: number;
  expectedAddress: string;
  /** When mismatch / missing, return this (usually 0 → startBlock backfill). */
  fallback?: bigint;
  onMismatch?: (reason: string) => void;
};

export function readWatcherCursor(opts: ReadWatcherCursorOpts): bigint {
  const fallback = opts.fallback ?? 0n;
  if (!existsSync(opts.path)) return fallback;
  try {
    const parsed = JSON.parse(readFileSync(opts.path, "utf8")) as WatcherCursorFile;
    if (!parsed.cursor || !/^\d+$/.test(parsed.cursor)) return fallback;

    // Reject legacy unbound cursors — must carry chainId + address matching this deploy.
    if (parsed.chainId == null || typeof parsed.chainId !== "number") {
      opts.onMismatch?.(
        "legacy unbound cursor (missing chainId); resetting to deploy block",
      );
      return fallback;
    }
    const addr = (parsed.address ?? "").trim().toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(addr)) {
      opts.onMismatch?.(
        "legacy unbound cursor (missing address); resetting to deploy block",
      );
      return fallback;
    }

    const expect = opts.expectedAddress.toLowerCase();
    if (parsed.chainId !== opts.expectedChainId) {
      opts.onMismatch?.(
        "cursor chainId=" + parsed.chainId + " != " + opts.expectedChainId + "; resetting",
      );
      return fallback;
    }
    if (addr !== expect) {
      opts.onMismatch?.(
        "cursor address=" + addr + " != " + expect + "; resetting",
      );
      return fallback;
    }
    return BigInt(parsed.cursor);
  } catch {
    return fallback;
  }
}

export function writeWatcherCursor(opts: {
  path: string;
  cursor: bigint;
  chainId: number;
  address: string;
}): void {
  const body: WatcherCursorFile = {
    cursor: opts.cursor.toString(),
    chainId: opts.chainId,
    address: opts.address.toLowerCase(),
  };
  const tmp = opts.path + ".tmp";
  writeFileSync(tmp, JSON.stringify(body, null, 2) + "\n");
  renameSync(tmp, opts.path);
}
