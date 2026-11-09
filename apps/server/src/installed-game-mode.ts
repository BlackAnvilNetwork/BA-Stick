/**
 * Process role. `docs/multi-operator.md` section 3.
 *
 * The process default is observer. An observer replays and does not append.
 * Replica is leader-eligible. It still does not tick unless `can("tick")`
 * says this process holds the lease. `LOK_REPLICA=1` selects the replica
 * role only after the resource self-check and the reachability check pass.
 *
 * Leader is not a field on this role. The lease is a separate axis.
 *
 * The resource self-check asks the OS. No CPU, RAM, or disk minimum is applied.
 * Those profiles are not published. A read that throws, or an answer that is
 * not a finite number, fails the check.
 *
 * The reachability check is a loopback accept this process opens. It is not a
 * boolean the caller supplies.
 *
 * Replica does not grant a combat bonus, a second guild, or the listing key.
 * Malachite calls its voting nodes validators. In this process those nodes
 * are replicas.
 */

import { statfsSync } from "node:fs";
import { createConnection, createServer } from "node:net";
import { cpus, freemem } from "node:os";

export type InstalledGameMode = {
  role: "observer" | "replica";
};

export type ResourceSnapshot = {
  logicalCpus: number;
  freeMemoryBytes: number;
  freeDiskBytes: number;
};

export type ModeChecks = {
  /** Directory whose volume is asked about disk. Defaults to the process cwd. */
  dataDir?: string;
  /** Test seam. Production boot omits this and reads the OS. */
  readResources?: () => ResourceSnapshot;
  /** Test seam. Production boot omits this and probes loopback. */
  probeReachability?: () => Promise<boolean>;
};

const OBSERVER: InstalledGameMode = { role: "observer" };

const REPLICA: InstalledGameMode = { role: "replica" };

/** Operator opt-in. Any other value leaves the replica flag off. */
export function replicaFlagEnabled(env: NodeJS.ProcessEnv): boolean {
  return env.LOK_REPLICA === "1";
}

/** OS answer for the resource self-check. No capacity floor is applied here. */
export function readResourceSnapshot(dir: string = process.cwd()): ResourceSnapshot {
  const disk = statfsSync(dir);
  return {
    logicalCpus: cpus().length,
    freeMemoryBytes: freemem(),
    freeDiskBytes: Number(disk.bavail) * Number(disk.bsize),
  };
}

/** True when the process could read a finite OS answer. A throw fails closed. */
export function resourceSelfCheck(read: () => ResourceSnapshot = () => readResourceSnapshot()): boolean {
  try {
    const seen = read();
    return (
      Number.isFinite(seen.logicalCpus) &&
      Number.isFinite(seen.freeMemoryBytes) &&
      Number.isFinite(seen.freeDiskBytes)
    );
  } catch {
    return false;
  }
}

/**
 * Accept one loopback connection. Failure, including a timeout, is not reachable.
 */
export function probeLoopbackReachability(): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ok);
    };
    const server = createServer();
    const timer = setTimeout(() => {
      server.close();
      finish(false);
    }, 1_000);
    timer.unref?.();
    server.unref?.();
    server.once("error", () => {
      server.close();
      finish(false);
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close();
        finish(false);
        return;
      }
      const socket = createConnection({ host: "127.0.0.1", port: address.port });
      socket.unref?.();
      socket.once("connect", () => {
        socket.end();
        server.close(() => finish(true));
      });
      socket.once("error", () => {
        socket.destroy();
        server.close();
        finish(false);
      });
    });
  });
}

export function reachabilityCheck(
  probe: () => Promise<boolean> = probeLoopbackReachability,
): Promise<boolean> {
  return Promise.resolve()
    .then(() => probe())
    .then((ok) => ok === true)
    .catch(() => false);
}

/**
 * Default is observer. Replica requires the operator flag plus a passing
 * resource self-check and a passing reachability check. The result never
 * carries a combat bonus, a second guild, or the listing key.
 */
export async function installedGameMode(
  env: NodeJS.ProcessEnv = process.env,
  checks?: ModeChecks,
): Promise<InstalledGameMode> {
  if (!replicaFlagEnabled(env)) return { ...OBSERVER };
  const read = checks?.readResources ?? (() => readResourceSnapshot(checks?.dataDir));
  if (!resourceSelfCheck(read)) return { ...OBSERVER };
  const reachable = await reachabilityCheck(checks?.probeReachability);
  if (!reachable) return { ...OBSERVER };
  return { ...REPLICA };
}
