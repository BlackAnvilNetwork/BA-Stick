/**
 * Kill the leader of the three-replica allowlist.
 *
 * The orderer is the real lok-order binary. Logical time is the handoff
 * counter and the orderer's timeout step. This file does not sleep to elect,
 * and it does not fetch Gnosis. The sim tick returns while the new leader is
 * still being adopted. The only session change is the leader address.
 */
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { orderSubmitLine, submitOnSimTick, type BatchOrderer, type ReplicaPeer } from "./order-submit";
import {
  HEARTBEAT_TIMEOUT,
  adoptedPrefix,
  createReplica,
  droppedInputIds,
  handle,
  type Command,
  type Replica,
  type ReplicaReport,
} from "./handoff-protocol";

const CRATE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../contracts/lok-order");
const GNU_HOST = "stable-x86_64-pc-windows-gnu";
const GNU_TARGET = "x86_64-pc-windows-gnu";

type Status = {
  lastCertifiedHeight: number | null;
  lastAnchoredHeight: null;
  clockSkew: number;
  peers: Array<ReplicaPeer & { present?: boolean }>;
  leader: string;
  directoryLeader: string;
  seedRoller: string;
  epoch: number;
  logicalTime: number;
  root: string | null;
  signatures: number | null;
  inFlight: string[];
  dropped: string[];
  presentCount: number;
};

function prepareCargo(cargoArgs: string[]): void {
  if (process.platform === "win32") {
    const host = spawnSync("rustup", ["run", GNU_HOST, "rustc", "-vV"], {
      cwd: tmpdir(),
      encoding: "utf8",
    });
    assert.equal(host.status, 0, host.stderr);
    assert.match(host.stdout, /^host: x86_64-pc-windows-gnu$/m);
    cargoArgs.unshift("+" + GNU_HOST);
    cargoArgs.push("--target", GNU_TARGET);
    return;
  }
  cargoArgs.unshift("+stable");
}

function buildLokOrder(): string {
  const cargoArgs = ["build", "--bin", "lok-order", "--locked"];
  prepareCargo(cargoArgs);
  const built = spawnSync("cargo", cargoArgs, {
    cwd: CRATE,
    encoding: "utf8",
    timeout: 20 * 60 * 1000,
    maxBuffer: 64 * 1024 * 1024,
  });
  const log = `${built.stdout ?? ""}\n${built.stderr ?? ""}`;
  assert.equal(built.status, 0, log.slice(-4000));
  if (process.platform === "win32") assert.equal(/\blink\.exe\b/i.test(log), false);
  const exe =
    process.platform === "win32"
      ? path.join(CRATE, "target", GNU_TARGET, "debug", "lok-order.exe")
      : path.join(CRATE, "target", "debug", "lok-order");
  assert.equal(existsSync(exe), true, exe);
  return exe;
}

function parseStatus(line: string): Status {
  const row = JSON.parse(line) as Record<string, unknown>;
  assert.equal(row.lastAnchoredHeight, null);
  const peers = row.peers as Status["peers"];
  assert.ok(Array.isArray(peers));
  return {
    lastCertifiedHeight: typeof row.lastCertifiedHeight === "number" ? row.lastCertifiedHeight : null,
    lastAnchoredHeight: null,
    clockSkew: row.clockSkew as number,
    peers,
    leader: row.leader as string,
    directoryLeader: row.directoryLeader as string,
    seedRoller: row.seedRoller as string,
    epoch: row.epoch as number,
    logicalTime: row.logicalTime as number,
    root: typeof row.root === "string" ? row.root : null,
    signatures: typeof row.signatures === "number" ? row.signatures : null,
    inFlight: row.inFlight as string[],
    dropped: row.dropped as string[],
    presentCount: peers.filter((peer) => peer.present !== false).length,
  };
}

type OrdererProc = {
  write(line: string): void;
  nextStatus(): Promise<Status>;
  stop(): Promise<void>;
  orderer(health: () => Status): BatchOrderer;
};

function startOrderer(bin: string): OrdererProc {
  const child: ChildProcess = spawn(bin, [], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
  if (!child.stdin || !child.stdout || !child.stderr) throw new Error("lok-order pipes");
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  let stderr = "";
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });
  const queued: string[] = [];
  const waiters: Array<(line: string) => void> = [];
  let buf = "";
  child.stdout.on("data", (chunk: string) => {
    buf += chunk;
    let nl = buf.indexOf("\n");
    while (nl >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) {
        const waiter = waiters.shift();
        if (waiter) waiter(line);
        else queued.push(line);
      }
      nl = buf.indexOf("\n");
    }
  });
  const nextLine = (): Promise<string> => {
    const ready = queued.shift();
    if (ready) return Promise.resolve(ready);
    return new Promise((resolve) => waiters.push(resolve));
  };
  return {
    write(line: string) {
      child.stdin?.write(line.endsWith("\n") ? line : `${line}\n`);
    },
    nextStatus() {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          child.kill();
          reject(new Error(`lok-order produced no status\n${stderr}`));
        }, 30_000);
        nextLine().then(
          (line) => {
            clearTimeout(timer);
            resolve(parseStatus(line));
          },
          (err: unknown) => {
            clearTimeout(timer);
            reject(err);
          },
        );
      });
    },
    stop() {
      if (child.exitCode != null || child.signalCode != null) return Promise.resolve();
      const exited = once(child, "exit");
      child.kill();
      return exited.then(() => undefined);
    },
    orderer(health: () => Status): BatchOrderer {
      return {
        submit(height: number, nextRoot: Uint8Array) {
          child.stdin?.write(orderSubmitLine(height, nextRoot));
        },
        replicaHealth: () => ({
          lastCertifiedHeight: health().lastCertifiedHeight,
          lastAnchoredHeight: null,
          clockSkew: health().clockSkew,
          peers: health().peers,
          seedRoller: health().seedRoller,
        }),
      };
    },
  };
}

function step(replica: Replica, command: Command): Replica {
  const result = handle(replica, command);
  assert.equal(result.ok, true, result.reason ?? "handoff step");
  return result.replica;
}

function reportOf(replica: Replica): ReplicaReport {
  return { id: replica.id, stored: replica.stored, inFlight: replica.inFlight };
}

test("killing the leader only reconnects the follower", { timeout: 20 * 60 * 1000 }, async () => {
  const bin = buildLokOrder();
  const proc = startOrderer(bin);
  try {
    const opened = await proc.nextStatus();
    assert.equal(opened.epoch, 0);
    assert.equal(opened.presentCount, 3);
    assert.equal(opened.lastCertifiedHeight, null);
    assert.equal(opened.lastAnchoredHeight, null);
    assert.equal(opened.clockSkew, 0);
    assert.notEqual(opened.seedRoller, opened.leader);
    assert.equal(opened.logicalTime, 0);

    const keepRoot = new Uint8Array(32);
    keepRoot[0] = 0x11;
    proc.write(orderSubmitLine(0, keepRoot).trim());
    const prefix = await proc.nextStatus();
    assert.equal(prefix.lastCertifiedHeight, 0);
    assert.equal(prefix.root, Buffer.from(keepRoot).toString("hex"));
    assert.equal(prefix.epoch, 0);
    assert.equal(prefix.lastAnchoredHeight, null);

    const oldLeader = prefix.directoryLeader;
    const followers = prefix.peers.map((peer) => peer.address).filter((address) => address !== oldLeader);
    assert.equal(followers.length, 2);
    let leader = createReplica(oldLeader, "leader");
    let followerA = createReplica(followers[0]!, "follower");
    let followerB = createReplica(followers[1]!, "follower");
    leader = step(leader, { op: "deliver", msg: { kind: "input", id: "keep", to: oldLeader } });
    const kept = step(leader, { op: "propose" });
    leader = kept;
    const keepBatch = kept && leader.stored[0];
    assert.ok(keepBatch);
    const keepWire = { kind: "batch" as const, ...keepBatch, inputs: keepBatch.inputs.slice() };
    followerA = step(followerA, { op: "deliver", msg: keepWire });
    followerB = step(followerB, { op: "deliver", msg: keepWire });

    proc.write(JSON.stringify({ op: "keep", id: "keep" }));
    await proc.nextStatus();
    proc.write(JSON.stringify({ op: "accept-input", id: "drop" }));
    await proc.nextStatus();

    const provisional = new Uint8Array(32);
    provisional[0] = 0x22;
    proc.write(JSON.stringify({ op: "propose", height: 1, root: Buffer.from(provisional).toString("hex") }));
    const proposed = await proc.nextStatus();
    assert.equal(proposed.lastCertifiedHeight, 0);
    assert.notEqual(proposed.root, Buffer.from(provisional).toString("hex"));

    leader = step(leader, { op: "deliver", msg: { kind: "input", id: "drop", to: oldLeader } });
    leader = step(leader, { op: "propose" });
    assert.deepEqual(leader.stored.map((batch) => batch.inputs), [["keep"], ["drop"]]);
    assert.deepEqual(followerA.stored.map((batch) => batch.inputs), [["keep"]]);

    proc.write(JSON.stringify({ op: "accept-input", id: "late" }));
    const late = await proc.nextStatus();
    assert.deepEqual(late.inFlight, ["late"]);
    leader = step(leader, { op: "deliver", msg: { kind: "input", id: "late", to: oldLeader } });
    assert.deepEqual(leader.inFlight, ["late"]);

    const beat = handle(leader, { op: "emit-heartbeat", at: 0 });
    assert.equal(beat.ok, true, beat.reason);
    leader = beat.replica;
    const heartbeat = beat.messages[0];
    assert.ok(heartbeat && heartbeat.kind === "heartbeat");
    followerA = step(followerA, { op: "deliver", msg: heartbeat });
    followerB = step(followerB, { op: "deliver", msg: heartbeat });
    leader = step(leader, { op: "advance", now: HEARTBEAT_TIMEOUT });
    followerA = step(followerA, { op: "advance", now: HEARTBEAT_TIMEOUT });
    followerB = step(followerB, { op: "advance", now: HEARTBEAT_TIMEOUT });
    assert.equal(followerA.epochClosed, true);
    assert.equal(followerB.epochClosed, true);

    const reports = [reportOf(leader), reportOf(followerA), reportOf(followerB)];
    const prefixBatches = adoptedPrefix(reports, 2);
    assert.deepEqual(
      prefixBatches.flatMap((batch) => batch.inputs),
      ["keep"],
    );
    assert.deepEqual(droppedInputIds(reports, prefixBatches), ["drop", "late"]);

    proc.write(JSON.stringify({ op: "kill-leader" }));
    const killed = await proc.nextStatus();
    assert.equal(killed.presentCount, 2);
    assert.equal(killed.lastCertifiedHeight, 0);
    assert.equal(killed.epoch, 0);
    assert.equal(killed.lastAnchoredHeight, null);
    assert.equal(killed.clockSkew, 0);

    const session = { sessionId: "wallet-session", leader: oldLeader };
    let latest = killed;
    let statusArrived = false;
    const pending = proc.nextStatus().then((status) => {
      statusArrived = true;
      latest = status;
      return status;
    });
    const fresh = new Uint8Array(32);
    fresh[0] = 0x33;
    const tick = submitOnSimTick(proc.orderer(() => latest), { ok: true, height: 1, nextRoot: fresh }, latest.peers);
    assert.equal(tick.tickFailed, false);
    assert.equal(tick.status, "submitted");
    assert.equal(statusArrived, false);
    assert.equal(latest.lastCertifiedHeight, 0);
    assert.equal(session.leader, oldLeader);

    const elected = await pending;
    assert.equal(elected.lastCertifiedHeight, 1);
    assert.equal(elected.root, Buffer.from(fresh).toString("hex"));
    assert.notEqual(elected.root, Buffer.from(provisional).toString("hex"));
    assert.equal(elected.epoch, 1);
    assert.notEqual(elected.directoryLeader, oldLeader);
    assert.equal(elected.leader, elected.directoryLeader);
    const livingAfter = elected.peers.filter((peer) => peer.present !== false).map((peer) => peer.address);
    assert.equal(livingAfter.length, 2);
    assert.equal(livingAfter.includes(elected.leader), true);
    assert.equal(livingAfter.includes(oldLeader), false);
    const otherLiving = livingAfter.find((address) => address !== elected.leader);
    assert.equal(elected.seedRoller, otherLiving);
    assert.notEqual(elected.seedRoller, elected.leader);
    assert.notEqual(elected.seedRoller, oldLeader);
    assert.ok((elected.signatures ?? 0) >= 2);
    assert.equal(elected.presentCount, 2);
    assert.ok(elected.logicalTime > 0);
    assert.equal(elected.lastAnchoredHeight, null);
    assert.equal(elected.clockSkew, 0);
    assert.deepEqual(elected.dropped, ["drop", "late"]);
    assert.deepEqual(elected.inFlight, []);

    const reconnected = session.leader === elected.directoryLeader
      ? { session, reconnected: false }
      : { session: { sessionId: session.sessionId, leader: elected.directoryLeader }, reconnected: true };
    assert.equal(reconnected.reconnected, true);
    assert.equal(reconnected.session.sessionId, "wallet-session");
    assert.equal(reconnected.session.leader, elected.directoryLeader);
    assert.deepEqual(Object.keys(reconnected.session).sort(), ["leader", "sessionId"]);

    const winner = [leader, followerA, followerB].find((replica) => replica.id === elected.directoryLeader);
    assert.ok(winner, elected.directoryLeader);
    const adopted = step(winner, {
      op: "adopt",
      reports,
      threshold: 2,
      asLeader: true,
    });
    assert.equal(adopted.epoch, 1);
    assert.deepEqual(adopted.stored.flatMap((batch) => batch.inputs), ["keep"]);
    for (const id of ["drop", "late"]) {
      const replayed = handle(adopted, { op: "replay", id });
      assert.equal(replayed.ok, false);
      assert.equal(replayed.reason, "dropped-input");
      assert.deepEqual(replayed.replica.inFlight, []);
    }

    proc.write(JSON.stringify({ op: "accept-input", id: "drop" }));
    const refused = await proc.nextStatus();
    assert.deepEqual(refused.dropped, ["drop", "late"]);
    assert.deepEqual(refused.inFlight, []);
    proc.write(JSON.stringify({ op: "accept-input", id: "fresh" }));
    const continued = await proc.nextStatus();
    assert.deepEqual(continued.inFlight, ["fresh"]);
    assert.equal(continued.lastAnchoredHeight, null);
  } finally {
    await proc.stop();
  }
});
