import { existsSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";

/**
 * Single-writer guard for a lok data directory.
 *
 * Two processes that open the same data dir (for example a `tsx watch` dev
 * server started while the `start` server is still up, or a maintenance
 * script) each hold their own in-memory engine and both append to
 * lok-world.jsonl and rewrite lok-world.json / lok-bind.json. The second
 * writer forks the hash chain on disk and the next restart either refuses the
 * journal or silently loses one side. This lock makes the second open fail
 * loudly instead.
 *
 * The lock is advisory: a file `lok-world.lock` holding `{pid, host, startedAt}`
 * created with O_EXCL. A lock whose pid is no longer alive on this host is
 * stale and is taken over. The same pid may re-open its own directory (tests
 * reopen a dir to check replay). Set LOK_ALLOW_SHARED_DATA_DIR=1 to bypass.
 *
 * The lock is created (O_EXCL) and then written, so there is a short window in
 * which it exists but is empty. An empty or unparseable lock younger than
 * LOCK_FRESH_MS (by mtime) is treated as held, so a second process starting in
 * that window cannot delete it and take over. Only an unreadable lock older
 * than that is stale.
 */
export const DATA_DIR_LOCK_FILE = "lok-world.lock";

/** An unreadable lock younger than this is assumed to be mid-write by its owner. */
export const LOCK_FRESH_MS = 10_000;

export type DataDirLockInfo = { pid: number; host: string; startedAt: string };

const held = new Set<string>();
let exitHookInstalled = false;

function pidAlive(pid: number): boolean {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM: the process exists but belongs to someone else.
    return (err as NodeJS.ErrnoException)?.code === "EPERM";
  }
}

export function readDataDirLock(dataDir: string): DataDirLockInfo | null {
  const path = join(dataDir, DATA_DIR_LOCK_FILE);
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<DataDirLockInfo>;
    return {
      pid: typeof parsed.pid === "number" ? parsed.pid : -1,
      host: typeof parsed.host === "string" ? parsed.host : "",
      startedAt: typeof parsed.startedAt === "string" ? parsed.startedAt : "",
    };
  } catch {
    return { pid: -1, host: "", startedAt: "" };
  }
}

/** Age of the lock file by mtime in ms, or null when it is missing. */
function lockAgeMs(path: string, now: number): number | null {
  try {
    return now - statSync(path).mtimeMs;
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return null;
    throw err;
  }
}

/** A lock with no usable pid that was written moments ago: its owner may still be writing it. */
function freshUnreadable(path: string, info: DataDirLockInfo, now: number): boolean {
  if (Number.isSafeInteger(info.pid) && info.pid > 0) return false;
  const age = lockAgeMs(path, now);
  return age !== null && age < LOCK_FRESH_MS;
}

/** True when another live process on this host (or an unknown host) holds the lock. */
export function dataDirLockedByOther(dataDir: string, now: number = Date.now()): DataDirLockInfo | null {
  const info = readDataDirLock(dataDir);
  if (!info) return null;
  if (freshUnreadable(join(dataDir, DATA_DIR_LOCK_FILE), info, now)) return info;
  if (info.host && info.host !== hostname()) return info;
  if (info.pid === process.pid) return null;
  return pidAlive(info.pid) ? info : null;
}

function installExitHook() {
  if (exitHookInstalled) return;
  exitHookInstalled = true;
  process.on("exit", () => {
    for (const path of held) {
      try {
        const info = JSON.parse(readFileSync(path, "utf8")) as Partial<DataDirLockInfo>;
        if (info.pid === process.pid) unlinkSync(path);
      } catch {
        // Best effort: a stale lock is taken over on the next start.
      }
    }
  });
}

/**
 * Take the data-dir lock or throw. Safe to call again from the same process.
 */
export function acquireDataDirLock(
  dataDir: string,
  env: NodeJS.ProcessEnv = process.env,
  now: () => number = Date.now,
): void {
  if (env.LOK_ALLOW_SHARED_DATA_DIR === "1") return;
  const path = join(dataDir, DATA_DIR_LOCK_FILE);
  const mine: DataDirLockInfo = { pid: process.pid, host: hostname(), startedAt: new Date().toISOString() };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      writeFileSync(path, JSON.stringify(mine), { flag: "wx" });
      held.add(path);
      installExitHook();
      return;
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code !== "EEXIST") throw err;
    }
    const other = readDataDirLock(dataDir);
    if (other && other.pid === process.pid && (!other.host || other.host === mine.host)) {
      held.add(path);
      installExitHook();
      return;
    }
    if (other && freshUnreadable(path, other, now())) {
      throw new Error(
        `lok data dir ${dataDir} has a lock file that is still being written (under ${LOCK_FRESH_MS / 1000}s old). ` +
          `Another process is starting on it. Wait and retry, or delete ${DATA_DIR_LOCK_FILE} if it is stale.`,
      );
    }
    if (other && other.host && other.host !== mine.host) {
      throw new Error(
        `lok data dir ${dataDir} is locked by pid ${other.pid} on host ${other.host} (since ${other.startedAt}). ` +
          `Stop that process, or delete ${DATA_DIR_LOCK_FILE} if it is stale, or set LOK_ALLOW_SHARED_DATA_DIR=1.`,
      );
    }
    if (other && pidAlive(other.pid)) {
      throw new Error(
        `lok data dir ${dataDir} is already open by live pid ${other.pid} (since ${other.startedAt}). ` +
          `A second writer would fork the world log. Stop it first, or set LOK_ALLOW_SHARED_DATA_DIR=1.`,
      );
    }
    // Stale (dead pid, or unreadable and older than LOCK_FRESH_MS): take it over.
    try {
      unlinkSync(path);
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") throw err;
    }
  }
  throw new Error(`could not take the lok data dir lock in ${dataDir}`);
}
