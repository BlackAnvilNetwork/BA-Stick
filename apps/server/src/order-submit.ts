/**
 * Hand a sealed batch to the orderer without waiting for a consensus round.
 *
 * The TypeScript server does not implement consensus. Movement and combat
 * stay on the provisional path. A missing orderer, a refused submit, or a
 * submit that has not committed yet leaves the batch provisional and returns.
 *
 * `LOK_ORDER_BIN`, when set, is the `lok-order` process. That process holds
 * three in-memory Malachite validators and ferries their consensus messages.
 * This module does not read `LOK_OWNER_KEY`, `PRIVATE_KEY`, or the listing key,
 * and it does not wait for a round.
 */
import { spawn, type ChildProcess } from "node:child_process";

export type ReplicaPeer = {
  address: string;
  heard: boolean;
};

/** What `/status` reports for the allowlist. Anchored height stays null until Gnosis. */
export type ReplicaHealth = {
  lastCertifiedHeight: number | null;
  lastAnchoredHeight: null;
  clockSkew: number;
  peers: ReplicaPeer[];
  /** Allowlisted replica that rolls the world seed. Not the leader when three are configured. */
  seedRoller: string | null;
};

export function emptyReplicaHealth(): ReplicaHealth {
  return {
    lastCertifiedHeight: null,
    lastAnchoredHeight: null,
    clockSkew: 0,
    peers: [],
    seedRoller: null,
  };
}

/**
 * True when the process has already heard someone, and that set is not a majority.
 * Hearing nobody yet does not block the first submit: the tick must not wait for a round.
 * One heard peer of three is short. Two heard peers are a majority.
 */
export function shortOfMajority(peers: readonly { heard: boolean }[] | undefined): boolean {
  if (!peers || peers.length === 0) return false;
  const heard = peers.reduce((count, peer) => count + (peer.heard ? 1 : 0), 0);
  if (heard === 0) return false;
  return heard * 2 <= peers.length;
}

/** Apply one orderer stdout line. An anchored height in the line is ignored. */
export function replicaHealthFromLine(line: string, prev: ReplicaHealth): ReplicaHealth {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return prev;
  }
  if (!parsed || typeof parsed !== "object") return prev;
  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.peers)) return prev;
  const peers: ReplicaPeer[] = [];
  for (const peer of obj.peers) {
    if (!peer || typeof peer !== "object") continue;
    const row = peer as Record<string, unknown>;
    if (typeof row.address !== "string" || typeof row.heard !== "boolean") continue;
    peers.push({ address: row.address, heard: row.heard });
  }
  const height = obj.lastCertifiedHeight;
  const skew = obj.clockSkew;
  const roller = obj.seedRoller;
  return {
    lastCertifiedHeight:
      typeof height === "number" ? height : height === null ? null : prev.lastCertifiedHeight,
    lastAnchoredHeight: null,
    clockSkew: typeof skew === "number" ? skew : 0,
    peers,
    seedRoller: typeof roller === "string" ? roller : prev.seedRoller,
  };
}

export type SealedOrder = {
  ok: true;
  height: number;
  nextRoot: Uint8Array;
};

export type OrderSubmitResult = "submitted" | "provisional";

export type BatchOrderer = {
  /** Throw to refuse. The tick helper catches that and stays provisional. */
  submit(height: number, nextRoot: Uint8Array): void;
  /** Latest allowlist view. Absent until the orderer prints a status line. */
  replicaHealth?: () => ReplicaHealth;
};

/** A spawned `lok-order`. `stop` ends the process; the tick never calls it. */
export type ProcessOrderer = BatchOrderer & { stop(): Promise<void> };

/**
 * The one JSON line `lok-order` reads. `nextRoot` is 32 bytes, written as 64 hex
 * characters. The tick writes this line and does not wait for the commit.
 */
export function orderSubmitLine(height: number, nextRoot: Uint8Array): string {
  return (
    JSON.stringify({
      height,
      root: Buffer.from(nextRoot).toString("hex"),
    }) + "\n"
  );
}

/**
 * What `tickSim` calls after a successful seal.
 * Always returns. A stopped orderer or a submit that has not committed
 * leaves `tickFailed` false so the 20 Hz loop keeps playing.
 */
export function submitOnSimTick(
  orderer: BatchOrderer | null | undefined,
  sealed: { ok: true; height: number; nextRoot: Uint8Array } | { ok: false },
  peers?: readonly { heard: boolean }[],
): { tickFailed: false; status: OrderSubmitResult } {
  return { tickFailed: false, status: submitSealedBatch(orderer, sealed, peers) };
}

export function submitSealedBatch(
  orderer: BatchOrderer | null | undefined,
  sealed: { ok: true; height: number; nextRoot: Uint8Array } | { ok: false },
  peers?: readonly { heard: boolean }[],
): OrderSubmitResult {
  if (!sealed.ok) return "provisional";
  if (!(sealed.nextRoot instanceof Uint8Array) || sealed.nextRoot.length !== 32) return "provisional";
  if (!Number.isInteger(sealed.height) || sealed.height < 0) return "provisional";
  if (shortOfMajority(peers)) return "provisional";
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
export function startProcessOrderer(bin: string): ProcessOrderer | null {
  let child: ChildProcess;
  try {
    child = spawn(bin, [], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
  } catch (err) {
    console.error("[order] orderer absent", err);
    return null;
  }
  let failed = false;
  let health = emptyReplicaHealth();
  let stdoutBuf = "";
  child.stdout?.setEncoding("utf8");
  child.stdout?.on("data", (chunk: string) => {
    stdoutBuf += chunk;
    let nl = stdoutBuf.indexOf("\n");
    while (nl >= 0) {
      const line = stdoutBuf.slice(0, nl).trim();
      stdoutBuf = stdoutBuf.slice(nl + 1);
      if (line) health = replicaHealthFromLine(line, health);
      nl = stdoutBuf.indexOf("\n");
    }
  });
  child.stderr?.on("data", () => {
    /* keep the pipe drained so a full buffer cannot stall the orderer */
  });
  child.on("error", (err) => {
    failed = true;
    console.error("[order] orderer absent", err);
  });
  child.stdin?.on("error", () => {
    failed = true;
  });
  child.on("exit", () => {
    failed = true;
  });
  return {
    replicaHealth: () => health,
    submit(height: number, nextRoot: Uint8Array) {
      const stdin = child.stdin;
      if (failed || child.exitCode != null || !stdin || stdin.destroyed || !stdin.writable) {
        throw new Error("orderer absent");
      }
      // A full buffer still queued the line. Do not wait for the drain or the commit.
      stdin.write(orderSubmitLine(height, nextRoot));
    },
    stop() {
      failed = true;
      if (child.exitCode != null || child.signalCode != null) return Promise.resolve();
      return new Promise((resolve) => {
        child.once("exit", () => resolve());
        child.kill();
      });
    },
  };
}
