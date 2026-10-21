/**
 * Replace a durable file without a window where a crash leaves it empty.
 *
 * writeFileSync + renameSync can publish a tmp file whose bytes are still in
 * the page cache. fsync the tmp before the rename, then fsync the directory so
 * the new name itself survives power loss. A synced folder (OneDrive and the
 * like) can return EPERM or EBUSY from rename; those are retried briefly.
 */
import { closeSync, fsyncSync, mkdirSync, openSync, renameSync, writeSync } from "node:fs";
import { dirname } from "node:path";

const RENAME_RETRY_MS = [20, 50, 100, 200];

function sleepMs(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function retryableRename(err: unknown): boolean {
  const code = (err as NodeJS.ErrnoException).code;
  return code === "EPERM" || code === "EBUSY";
}

export function renameReplacing(
  from: string,
  to: string,
  rename: (from: string, to: string) => void = renameSync,
): void {
  for (let attempt = 0; ; attempt++) {
    try {
      rename(from, to);
      return;
    } catch (err) {
      if (!retryableRename(err) || attempt >= RENAME_RETRY_MS.length) throw err;
      sleepMs(RENAME_RETRY_MS[attempt]!);
    }
  }
}

/** Directory fsync is not available on every platform. The file fsync already happened. */
function fsyncDir(dir: string): void {
  let fd: number | undefined;
  try {
    fd = openSync(dir, "r");
    fsyncSync(fd);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EPERM" || code === "EINVAL" || code === "ENOTSUP" || code === "EISDIR" || code === "EBADF") return;
    throw err;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

export type DurableWriteOpts = {
  rename?: (from: string, to: string) => void;
};

export function durableWrite(path: string, text: string, opts?: DurableWriteOpts): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = path + ".tmp";
  const fd = openSync(tmp, "w");
  try {
    const buf = Buffer.from(text, "utf8");
    let off = 0;
    while (off < buf.length) {
      const wrote = writeSync(fd, buf, off, buf.length - off);
      if (wrote <= 0) throw new Error("durable write stalled");
      off += wrote;
    }
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameReplacing(tmp, path, opts?.rename);
  fsyncDir(dirname(path));
}
