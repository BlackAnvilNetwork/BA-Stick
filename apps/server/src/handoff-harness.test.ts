/**
 * Two OS processes speak the section 6 hand-off protocol.
 * Logical time is the `now` field. This file does not sleep or read the wall clock.
 */
import assert from "node:assert/strict";
import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import test, { type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import {
  GENESIS_ROOT,
  HEARTBEAT_TIMEOUT,
  type Batch,
  type Command,
  type Replica,
  type ReplicaReport,
  type Wire,
} from "./handoff-protocol";

const peerPath = fileURLToPath(new URL("./handoff-peer.ts", import.meta.url));
const serverRoot = fileURLToPath(new URL("..", import.meta.url));
const OTHER_ROOT = `0x${"11".repeat(32)}`;

type Reply = {
  ok: boolean;
  reason?: string;
  messages: Wire[];
  snapshot: Replica;
};

type Peer = {
  pid: number;
  request(command: Command): Promise<Reply>;
  close(): Promise<void>;
};

function loaderArgv(): string[] {
  const out: string[] = [];
  const args = process.execArgv;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--require" || arg === "--import" || arg === "--loader" || arg === "-r") {
      const next = args[i + 1];
      if (next) out.push(arg, next);
      i++;
      continue;
    }
    if (arg.startsWith("--require=") || arg.startsWith("--import=") || arg.startsWith("--loader=")) {
      out.push(arg);
    }
  }
  return out.length > 0 ? out : ["--import", "tsx"];
}

function startPeer(id: string, role: "leader" | "follower"): Promise<Peer> {
  const child: ChildProcessWithoutNullStreams = spawn(
    process.execPath,
    [...loaderArgv(), peerPath, "--id", id, "--role", role],
    { cwd: serverRoot, stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
  );
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  let stderr = "";
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
  const pending: Array<{ resolve: (reply: Reply) => void; reject: (err: Error) => void }> = [];
  let ready = false;
  let failed: Error | undefined;

  const fail = (err: Error) => {
    failed = err;
    for (const waiter of pending.splice(0)) waiter.reject(err);
  };

  const peer: Peer = {
    pid: child.pid ?? -1,
    request(command: Command) {
      if (failed) return Promise.reject(failed);
      return new Promise<Reply>((resolve, reject) => {
        pending.push({ resolve, reject });
        child.stdin.write(`${JSON.stringify(command)}\n`, (err) => {
          if (err) reject(err);
        });
      });
    },
    close() {
      return new Promise<void>((resolve) => {
        if (child.exitCode !== null || child.signalCode !== null) {
          resolve();
          return;
        }
        child.once("exit", () => resolve());
        child.kill();
      });
    },
  };

  return new Promise<Peer>((resolve, reject) => {
    lines.on("line", (line) => {
      let msg: { ready?: boolean } & Partial<Reply>;
      try {
        msg = JSON.parse(line) as { ready?: boolean } & Partial<Reply>;
      } catch {
        fail(new Error(`peer ${id} non-json: ${line}\n${stderr}`));
        reject(failed);
        return;
      }
      if (!ready) {
        if (msg.ready !== true) {
          fail(new Error(`peer ${id} bad ready: ${line}\n${stderr}`));
          reject(failed);
          return;
        }
        ready = true;
        resolve(peer);
        return;
      }
      const waiter = pending.shift();
      if (!waiter) {
        fail(new Error(`peer ${id} unexpected line: ${line}`));
        return;
      }
      waiter.resolve(msg as Reply);
    });
    child.once("exit", (code) => {
      if (!ready || pending.length > 0) {
        fail(new Error(`peer ${id} exited ${code}\n${stderr}`));
        if (!ready) reject(failed);
      }
    });
    child.once("error", (err) => {
      fail(err);
      if (!ready) reject(err);
    });
  });
}

async function openPair(t: TestContext): Promise<{ leader: Peer; follower: Peer }> {
  const peers: Peer[] = [];
  t.after(async () => {
    await Promise.all(peers.map((peer) => peer.close()));
  });
  const leader = await startPeer("leader", "leader");
  peers.push(leader);
  const follower = await startPeer("follower", "follower");
  peers.push(follower);
  assert.notEqual(leader.pid, follower.pid);
  assert.ok(leader.pid > 0);
  assert.ok(follower.pid > 0);
  return { leader, follower };
}

function chainInputs(snapshot: Replica): string[] {
  return snapshot.stored.flatMap((batch) => batch.inputs);
}

function reportOf(snapshot: Replica): ReplicaReport {
  return { id: snapshot.id, stored: snapshot.stored, inFlight: snapshot.inFlight };
}

function batchMessage(reply: Reply): Extract<Wire, { kind: "batch" }> {
  const msg = reply.messages.find((message) => message.kind === "batch");
  assert.ok(msg && msg.kind === "batch");
  return msg;
}

function rejectReason(reply: Reply): string {
  const msg = reply.messages.find((message) => message.kind === "reject");
  assert.ok(msg && msg.kind === "reject");
  return msg.reason;
}

async function offer(peer: Peer, id: string, to: string): Promise<Reply> {
  return peer.request({ op: "deliver", msg: { kind: "input", id, to } });
}

test("follower rejects a batch whose parent root does not match", { timeout: 15_000 }, async (t) => {
  const { leader, follower } = await openPair(t);
  const offered = await offer(leader, "keep", "leader");
  assert.equal(offered.ok, true);
  const proposed = await leader.request({ op: "propose" });
  assert.equal(proposed.ok, true);
  const batch = batchMessage(proposed);
  assert.equal(batch.parentRoot, GENESIS_ROOT);
  assert.deepEqual(chainInputs(proposed.snapshot), ["keep"]);

  const tampered: Batch = { ...batch, parentRoot: OTHER_ROOT, inputs: batch.inputs.slice() };
  const rejected = await follower.request({ op: "deliver", msg: { kind: "batch", ...tampered } });
  assert.equal(rejected.ok, true);
  assert.equal(rejectReason(rejected), "parent-mismatch");
  assert.equal(rejected.snapshot.parentRoot, GENESIS_ROOT);
  assert.equal(rejected.snapshot.height, -1);
  assert.deepEqual(chainInputs(rejected.snapshot), []);
  assert.deepEqual(chainInputs(proposed.snapshot), ["keep"]);
});

test("missed heartbeat stops the follower accepting the old epoch", { timeout: 15_000 }, async (t) => {
  const { leader, follower } = await openPair(t);
  const beat = await leader.request({ op: "emit-heartbeat", at: 0 });
  assert.equal(beat.ok, true);
  const heartbeat = beat.messages[0];
  assert.ok(heartbeat && heartbeat.kind === "heartbeat");
  const heard = await follower.request({ op: "deliver", msg: heartbeat });
  assert.equal(heard.snapshot.lastHeartbeatAt, 0);
  assert.equal(heard.snapshot.epochClosed, false);

  const stillOpen = await follower.request({ op: "advance", now: HEARTBEAT_TIMEOUT - 1 });
  assert.equal(stillOpen.snapshot.epochClosed, false);

  const closed = await follower.request({ op: "advance", now: HEARTBEAT_TIMEOUT });
  assert.equal(closed.snapshot.epochClosed, true);
  assert.equal(closed.snapshot.epoch, 0);

  const again = await follower.request({ op: "deliver", msg: { ...heartbeat, at: HEARTBEAT_TIMEOUT } });
  assert.equal(again.snapshot.epochClosed, true);
  assert.equal(again.snapshot.lastHeartbeatAt, 0);

  const offered = await offer(leader, "keep", "leader");
  assert.equal(offered.ok, true);
  const proposed = await leader.request({ op: "propose" });
  const batch = batchMessage(proposed);
  const rejected = await follower.request({ op: "deliver", msg: batch });
  assert.equal(rejectReason(rejected), "stale-epoch");
  assert.equal(rejected.snapshot.parentRoot, GENESIS_ROOT);
  assert.deepEqual(chainInputs(rejected.snapshot), []);
});

test("in-flight inputs outside the adopted prefix are dropped and not replayed", { timeout: 15_000 }, async (t) => {
  const { leader, follower } = await openPair(t);
  const beat = await leader.request({ op: "emit-heartbeat", at: 0 });
  const heartbeat = beat.messages[0];
  assert.ok(heartbeat);
  await follower.request({ op: "deliver", msg: heartbeat });

  await offer(leader, "keep", "leader");
  const kept = await leader.request({ op: "propose" });
  const keepBatch = batchMessage(kept);
  const stored = await follower.request({ op: "deliver", msg: keepBatch });
  assert.deepEqual(chainInputs(stored.snapshot), ["keep"]);
  assert.equal(stored.messages.some((message) => message.kind === "received"), true);

  await offer(leader, "drop", "leader");
  const tail = await leader.request({ op: "propose" });
  const dropBatch = batchMessage(tail);
  assert.deepEqual(dropBatch.inputs, ["drop"]);
  const late = await offer(leader, "late", "leader");
  assert.deepEqual(late.snapshot.inFlight, ["late"]);

  await leader.request({ op: "advance", now: HEARTBEAT_TIMEOUT });
  await follower.request({ op: "advance", now: HEARTBEAT_TIMEOUT });
  const leaderView = await leader.request({ op: "snapshot" });
  const followerView = await follower.request({ op: "snapshot" });
  const reports = [reportOf(leaderView.snapshot), reportOf(followerView.snapshot)];

  const adopted = await follower.request({
    op: "adopt",
    reports,
    threshold: 2,
    asLeader: true,
  });
  const demoted = await leader.request({
    op: "adopt",
    reports,
    threshold: 2,
    asLeader: false,
  });
  assert.equal(adopted.snapshot.role, "leader");
  assert.equal(adopted.snapshot.epoch, 1);
  assert.equal(demoted.snapshot.role, "follower");
  assert.equal(demoted.snapshot.epoch, 1);
  assert.deepEqual(chainInputs(adopted.snapshot), ["keep"]);
  assert.deepEqual(chainInputs(demoted.snapshot), ["keep"]);
  assert.deepEqual(adopted.snapshot.dropped, ["drop", "late"]);
  assert.equal(adopted.snapshot.parentRoot, demoted.snapshot.parentRoot);

  const replayedTail = await follower.request({ op: "deliver", msg: dropBatch });
  assert.equal(rejectReason(replayedTail), "stale-epoch");
  assert.deepEqual(chainInputs(replayedTail.snapshot), ["keep"]);

  for (const id of ["drop", "late"]) {
    const replayed = await follower.request({ op: "replay", id });
    assert.equal(replayed.ok, false);
    assert.equal(rejectReason(replayed), "dropped-input");
    assert.deepEqual(replayed.snapshot.inFlight, []);
    assert.deepEqual(chainInputs(replayed.snapshot), ["keep"]);
  }

  const forged: Wire = {
    kind: "batch",
    epoch: adopted.snapshot.epoch,
    height: adopted.snapshot.height + 1,
    parentRoot: adopted.snapshot.parentRoot,
    nextRoot: OTHER_ROOT,
    inputs: ["drop"],
  };
  const forgedReply = await follower.request({ op: "deliver", msg: forged });
  assert.equal(forgedReply.ok, false);
  assert.equal(rejectReason(forgedReply), "dropped-input");
  assert.deepEqual(chainInputs(forgedReply.snapshot), ["keep"]);

  const fresh = await offer(follower, "fresh", "follower");
  assert.equal(fresh.ok, true);
  const extended = await follower.request({ op: "propose" });
  const freshBatch = batchMessage(extended);
  assert.deepEqual(freshBatch.inputs, ["fresh"]);
  assert.equal(freshBatch.epoch, 1);
  const followed = await leader.request({ op: "deliver", msg: freshBatch });
  assert.deepEqual(chainInputs(extended.snapshot), ["keep", "fresh"]);
  assert.deepEqual(chainInputs(followed.snapshot), ["keep", "fresh"]);
  assert.equal(followed.snapshot.dropped.includes("drop"), true);
  assert.equal(followed.snapshot.dropped.includes("late"), true);
});
