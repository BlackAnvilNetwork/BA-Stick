/**
 * Hand a sealed batch to the orderer without waiting for a consensus round.
 *
 * The TypeScript server does not implement consensus. Movement and combat
 * stay on the provisional path. A missing orderer, a refused submit, or a
 * submit that has not committed yet leaves the batch provisional and returns.
 *
 * `LOK_ORDER_BIN`, when set, is the `lok-order` process. That process holds
 * one in-memory Malachite validator. This module does not read `LOK_OWNER_KEY`,
 * `PRIVATE_KEY`, or the listing key.
 */
import { spawn, type ChildProcess } from "node:child_process";

export type SealedOrder = {
  ok: true;
  height: number;
  nextRoot: Uint8Array;
};

export type OrderSubmitResult = "submitted" | "provisional";

export type BatchOrderer = {
  /** Throw to refuse. The tick helper catches that and stays provisional. */
  submit(height: number, nextRoot: Uint8Array): void;
};

/**
 * Submit after a successful seal. Never throws.
 * Does not wait for a commit certificate.
 */
/**
 * What `tickSim` calls after a successful seal.
 * Always returns. A stopped orderer or a submit that has not committed
 * leaves `tickFailed` false so the 20 Hz loop keeps playing.
 */
export function submitOnSimTick(
  orderer: BatchOrderer | null | undefined,
  sealed: { ok: true; height: number; nextRoot: Uint8Array } | { ok: false },
): { tickFailed: false; status: OrderSubmitResult } {
  return { tickFailed: false, status: submitSealedBatch(orderer, sealed) };
}

export function submitSealedBatch(
  orderer: BatchOrderer | null | undefined,
  sealed: { ok: true; height: number; nextRoot: Uint8Array } | { ok: false },
): OrderSubmitResult {
  if (!sealed.ok) return "provisional";
  if (!(sealed.nextRoot instanceof Uint8Array) || sealed.nextRoot.length !== 32) return "provisional";
  if (!Number.isInteger(sealed.height) || sealed.height < 0) return "provisional";
  if (!orderer) return "provisional";
  try {
    orderer.submit(sealed.height, sealed.nextRoot);
    return "submitted";
  } catch {
    return "provisional";
  }
}

/** Start `lok-order` if `LOK_ORDER_BIN` names it. Otherwise the orderer is absent. */
export function loadTickOrderer(env: NodeJS.ProcessEnv = process.env): BatchOrderer | null {
  const bin = env.LOK_ORDER_BIN;
  if (!bin) return null;
  return startProcessOrderer(bin);
}

/** Spawn the orderer. A binary that cannot start is absent, not fatal. */
export function startProcessOrderer(bin: string): BatchOrderer | null {
  let child: ChildProcess;
  try {
    child = spawn(bin, [], {
      stdio: ["pipe", "ignore", "ignore"],
      windowsHide: true,
    });
  } catch (err) {
    console.error("[order] orderer absent", err);
    return null;
  }
  let failed = false;
  child.on("error", (err) => {
    failed = true;
    console.error("[order] orderer absent", err);
  });
  child.on("exit", () => {
    failed = true;
  });
  return {
    submit(height: number, nextRoot: Uint8Array) {
      const stdin = child.stdin;
      if (failed || child.exitCode != null || !stdin || stdin.destroyed || !stdin.writable) {
        throw new Error("orderer absent");
      }
      const line =
        JSON.stringify({
          height,
          root: Buffer.from(nextRoot).toString("hex"),
        }) + "\n";
      // A full buffer still queued the line. Do not wait for the drain.
      stdin.write(line);
    },
  };
}
