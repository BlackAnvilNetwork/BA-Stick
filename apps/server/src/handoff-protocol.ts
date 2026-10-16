/**
 * Hand-off rules from docs/multi-operator.md section 6.
 *
 * One replica's view of parent-root match, heartbeat timeout, and in-flight
 * inputs. Logical time is a counter the caller advances. This is not a
 * consensus engine: it does not elect a leader, sign certificates, or tick
 * the world. The next root below is a stand-in so two processes agree on a
 * link. The live tick still uses the chain link.
 */
import { keccak256, toBytes } from "viem";

export const GENESIS_ROOT = `0x${"00".repeat(32)}`;
/** Genesis count on the logical counter. The harness drives it. */
export const HEARTBEAT_TIMEOUT = 3;

export type Role = "leader" | "follower";

export type Batch = {
  epoch: number;
  height: number;
  parentRoot: string;
  nextRoot: string;
  inputs: string[];
};

export type RejectReason = "parent-mismatch" | "stale-epoch" | "dropped-input";

export type Wire =
  | { kind: "heartbeat"; epoch: number; height: number; tipRoot: string; at: number }
  | {
      kind: "batch";
      epoch: number;
      height: number;
      parentRoot: string;
      nextRoot: string;
      inputs: string[];
    }
  | { kind: "received"; epoch: number; height: number; nextRoot: string; from: string }
  | { kind: "reject"; epoch: number; height: number; reason: RejectReason; from: string }
  | { kind: "input"; id: string; to: string };

export type Replica = {
  id: string;
  role: Role;
  epoch: number;
  epochClosed: boolean;
  now: number;
  lastHeartbeatAt: number | null;
  parentRoot: string;
  height: number;
  stored: Batch[];
  inFlight: string[];
  dropped: string[];
};

export type ReplicaReport = {
  id: string;
  stored: Batch[];
  inFlight: string[];
};

export type Command =
  | { op: "advance"; now: number }
  | { op: "emit-heartbeat"; at: number }
  | { op: "deliver"; msg: Wire }
  | { op: "propose" }
  | { op: "adopt"; reports: ReplicaReport[]; threshold: number; asLeader: boolean }
  | { op: "replay"; id: string }
  | { op: "snapshot" };

export type Step = {
  replica: Replica;
  ok: boolean;
  reason?: string;
  messages: Wire[];
};

export function createReplica(id: string, role: Role): Replica {
  return {
    id,
    role,
    epoch: 0,
    epochClosed: false,
    now: 0,
    lastHeartbeatAt: null,
    parentRoot: GENESIS_ROOT,
    height: -1,
    stored: [],
    inFlight: [],
    dropped: [],
  };
}

/** Stand-in link so both processes derive the same next root. Not the live chain link. */
export function batchNextRoot(parentRoot: string, height: number, inputs: readonly string[]): string {
  const body = [parentRoot, String(height), ...inputs.map((id) => `${id.length}:${id}`)].join("|");
  return keccak256(toBytes(body));
}

export function adoptedPrefix(reports: readonly ReplicaReport[], threshold: number): Batch[] {
  const prefix: Batch[] = [];
  for (let height = 0; ; height++) {
    const present = reports
      .map((report) => report.stored.find((batch) => batch.height === height))
      .filter((batch): batch is Batch => batch !== undefined);
    if (present.length < threshold) break;
    const expectedParent = height === 0 ? GENESIS_ROOT : prefix[height - 1]!.nextRoot;
    const head = present.find((batch) => batch.parentRoot === expectedParent);
    if (!head) break;
    const votes = present.filter((batch) => sameBatch(batch, head));
    if (votes.length < threshold) break;
    prefix.push(cloneBatch(head));
  }
  return prefix;
}

export function droppedInputIds(reports: readonly ReplicaReport[], prefix: readonly Batch[]): string[] {
  const kept = new Set(prefix.flatMap((batch) => batch.inputs));
  const seen = new Set<string>();
  for (const report of reports) {
    for (const id of report.inFlight) seen.add(id);
    for (const batch of report.stored) {
      for (const id of batch.inputs) seen.add(id);
    }
  }
  return [...seen].filter((id) => !kept.has(id)).sort();
}

export function handle(replica: Replica, command: Command): Step {
  switch (command.op) {
    case "snapshot":
      return { replica, ok: true, messages: [] };
    case "advance":
      return advance(replica, command.now);
    case "emit-heartbeat":
      return emitHeartbeat(replica, command.at);
    case "deliver":
      return deliver(replica, command.msg);
    case "propose":
      return propose(replica);
    case "adopt":
      return adopt(replica, command.reports, command.threshold, command.asLeader);
    case "replay":
      return acceptInput(replica, command.id);
    default:
      return { replica, ok: false, reason: "unknown-op", messages: [] };
  }
}

function advance(replica: Replica, now: number): Step {
  if (now < replica.now) {
    return { replica, ok: false, reason: "time-went-backwards", messages: [] };
  }
  const timedOut =
    replica.lastHeartbeatAt !== null && now >= replica.lastHeartbeatAt + HEARTBEAT_TIMEOUT;
  return {
    replica: { ...replica, now, epochClosed: replica.epochClosed || timedOut },
    ok: true,
    messages: [],
  };
}

function emitHeartbeat(replica: Replica, at: number): Step {
  if (replica.role !== "leader") return { replica, ok: false, reason: "not-leader", messages: [] };
  if (replica.epochClosed) return { replica, ok: false, reason: "stale-epoch", messages: [] };
  const msg: Wire = {
    kind: "heartbeat",
    epoch: replica.epoch,
    height: replica.height,
    tipRoot: replica.parentRoot,
    at,
  };
  const noted = noteHeartbeat({ ...replica, now: Math.max(replica.now, at) }, msg);
  return { replica: noted.replica, ok: true, messages: [msg] };
}

function deliver(replica: Replica, msg: Wire): Step {
  switch (msg.kind) {
    case "heartbeat":
      return noteHeartbeat(replica, msg);
    case "batch":
      return storeBatch(replica, msg);
    case "input":
      if (msg.to !== replica.id) return { replica, ok: true, messages: [] };
      return acceptInput(replica, msg.id);
    case "received":
    case "reject":
      return { replica, ok: true, messages: [] };
    default:
      return { replica, ok: false, reason: "unknown-message", messages: [] };
  }
}

function noteHeartbeat(replica: Replica, msg: Extract<Wire, { kind: "heartbeat" }>): Step {
  if (msg.epoch !== replica.epoch || replica.epochClosed) {
    return { replica, ok: true, messages: [] };
  }
  if (replica.lastHeartbeatAt !== null && msg.at < replica.lastHeartbeatAt) {
    return { replica, ok: true, messages: [] };
  }
  return {
    replica: {
      ...replica,
      lastHeartbeatAt: msg.at,
      now: Math.max(replica.now, msg.at),
    },
    ok: true,
    messages: [],
  };
}

function propose(replica: Replica): Step {
  if (replica.role !== "leader") return { replica, ok: false, reason: "not-leader", messages: [] };
  if (replica.epochClosed) return { replica, ok: false, reason: "stale-epoch", messages: [] };
  if (replica.inFlight.length === 0) return { replica, ok: false, reason: "no-inputs", messages: [] };
  if (replica.inFlight.some((id) => replica.dropped.includes(id))) {
    return refuse(replica, replica.epoch, replica.height, "dropped-input");
  }
  const inputs = replica.inFlight.slice();
  const height = replica.height + 1;
  const batch: Batch = {
    epoch: replica.epoch,
    height,
    parentRoot: replica.parentRoot,
    nextRoot: batchNextRoot(replica.parentRoot, height, inputs),
    inputs,
  };
  const stored = storeBatch(replica, batch);
  if (!stored.ok) return stored;
  const wire: Wire = { kind: "batch", ...cloneBatch(batch) };
  return { replica: stored.replica, ok: true, messages: [wire, ...stored.messages] };
}

function storeBatch(replica: Replica, batch: Batch): Step {
  if (replica.epochClosed || batch.epoch !== replica.epoch) {
    return refuse(replica, batch.epoch, batch.height, "stale-epoch");
  }
  if (batch.parentRoot !== replica.parentRoot || batch.height !== replica.height + 1) {
    return refuse(replica, batch.epoch, batch.height, "parent-mismatch");
  }
  if (batch.inputs.some((id) => replica.dropped.includes(id))) {
    return refuse(replica, batch.epoch, batch.height, "dropped-input");
  }
  const stored = cloneBatch(batch);
  return {
    replica: {
      ...replica,
      stored: replica.stored.concat(stored),
      inFlight: replica.inFlight.filter((id) => !stored.inputs.includes(id)),
      parentRoot: stored.nextRoot,
      height: stored.height,
    },
    ok: true,
    messages: [
      {
        kind: "received",
        epoch: stored.epoch,
        height: stored.height,
        nextRoot: stored.nextRoot,
        from: replica.id,
      },
    ],
  };
}

function acceptInput(replica: Replica, id: string): Step {
  if (replica.role !== "leader") return { replica, ok: false, reason: "not-leader", messages: [] };
  if (replica.dropped.includes(id)) return refuse(replica, replica.epoch, replica.height, "dropped-input");
  if (replica.inFlight.includes(id) || replica.stored.some((batch) => batch.inputs.includes(id))) {
    return { replica, ok: true, messages: [] };
  }
  return {
    replica: { ...replica, inFlight: replica.inFlight.concat(id) },
    ok: true,
    messages: [],
  };
}

function adopt(
  replica: Replica,
  reports: readonly ReplicaReport[],
  threshold: number,
  asLeader: boolean,
): Step {
  const prefix = adoptedPrefix(reports, threshold);
  const dropped = droppedInputIds(reports, prefix);
  const tip = prefix.length === 0 ? GENESIS_ROOT : prefix[prefix.length - 1]!.nextRoot;
  return {
    replica: {
      ...replica,
      role: asLeader ? "leader" : "follower",
      epoch: replica.epoch + 1,
      epochClosed: false,
      lastHeartbeatAt: null,
      stored: prefix,
      parentRoot: tip,
      height: prefix.length - 1,
      inFlight: [],
      dropped: [...new Set([...replica.dropped, ...dropped])].sort(),
    },
    ok: true,
    messages: [],
  };
}

function refuse(replica: Replica, epoch: number, height: number, reason: RejectReason): Step {
  return {
    replica,
    ok: reason === "dropped-input" ? false : true,
    reason,
    messages: [{ kind: "reject", epoch, height, reason, from: replica.id }],
  };
}

function sameBatch(a: Batch, b: Batch): boolean {
  return (
    a.epoch === b.epoch &&
    a.height === b.height &&
    a.parentRoot === b.parentRoot &&
    a.nextRoot === b.nextRoot &&
    a.inputs.length === b.inputs.length &&
    a.inputs.every((id, index) => id === b.inputs[index])
  );
}

function cloneBatch(batch: Batch): Batch {
  return {
    epoch: batch.epoch,
    height: batch.height,
    parentRoot: batch.parentRoot,
    nextRoot: batch.nextRoot,
    inputs: batch.inputs.slice(),
  };
}
