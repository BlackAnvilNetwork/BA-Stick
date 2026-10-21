/**
 * The tick helper submits a sealed root and returns.
 * A missing or refusing orderer does not throw, and the batch stays provisional.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyReplicaHealth,
  replicaHealthFromLine,
  submitOnSimTick,
  submitSealedBatch,
  type BatchOrderer,
} from "./order-submit";

const root = new Uint8Array(32);
root[0] = 0xab;

test("a missing orderer leaves the tick helper provisional", () => {
  assert.doesNotThrow(() => {
    const result = submitSealedBatch(null, { ok: true, height: 0, nextRoot: root });
    assert.equal(result, "provisional");
  });
  assert.equal(submitSealedBatch(undefined, { ok: true, height: 1, nextRoot: root }), "provisional");
});

test("a refusing orderer does not throw and stays provisional", () => {
  const refusing: BatchOrderer = {
    submit() {
      throw new Error("orderer refused");
    },
  };
  let called = 0;
  const seeing: BatchOrderer = {
    submit(height, nextRoot) {
      called += 1;
      assert.equal(height, 4);
      assert.equal(nextRoot.length, 32);
      assert.equal(nextRoot[0], 0xab);
      throw new Error("refused after seeing the batch");
    },
  };
  assert.doesNotThrow(() => {
    assert.equal(submitSealedBatch(refusing, { ok: true, height: 2, nextRoot: root }), "provisional");
    assert.equal(submitSealedBatch(seeing, { ok: true, height: 4, nextRoot: root }), "provisional");
  });
  assert.equal(called, 1);
});

test("a stopped engine or a missing commit does not fail the sim tick", () => {
  const sealed = { ok: true as const, height: 7, nextRoot: root };
  const stopped = submitOnSimTick(null, sealed);
  assert.equal(stopped.tickFailed, false);
  assert.equal(stopped.status, "provisional");

  const dead: BatchOrderer = {
    submit() {
      throw new Error("orderer stopped");
    },
  };
  const halted = submitOnSimTick(dead, sealed);
  assert.equal(halted.tickFailed, false);
  assert.equal(halted.status, "provisional");

  let commits = 0;
  const silent: BatchOrderer = {
    submit(height, nextRoot) {
      assert.equal(height, 7);
      assert.equal(nextRoot[0], 0xab);
    },
  };
  const pending = submitOnSimTick(silent, sealed);
  assert.equal(pending.tickFailed, false);
  assert.equal(pending.status, "submitted");
  assert.equal(commits, 0);
});

test("fewer than a majority of heard peers leaves the tick provisional", () => {
  let calls = 0;
  const orderer: BatchOrderer = {
    submit() {
      calls += 1;
    },
  };
  const sealed = { ok: true as const, height: 1, nextRoot: root };
  const oneHeard = [
    { address: "aa", heard: true },
    { address: "bb", heard: false },
    { address: "cc", heard: false },
  ];
  const short = submitOnSimTick(orderer, sealed, oneHeard);
  assert.equal(short.tickFailed, false);
  assert.equal(short.status, "provisional");
  assert.equal(calls, 0);

  const twoHeard = [
    { address: "aa", heard: true },
    { address: "bb", heard: true },
    { address: "cc", heard: false },
  ];
  const majority = submitOnSimTick(orderer, sealed, twoHeard);
  assert.equal(majority.tickFailed, false);
  assert.equal(majority.status, "submitted");
  assert.equal(calls, 1);
});

test("a replica status line records height, skew, and peers, and drops an anchor", () => {
  const next = replicaHealthFromLine(
    JSON.stringify({
      lastCertifiedHeight: 3,
      lastAnchoredHeight: 9,
      clockSkew: 0,
      peers: [
        { address: "aa", heard: true },
        { address: "bb", heard: false },
        { address: "cc", heard: true },
      ],
      seedRoller: "bb",
      leader: "aa",
    }),
    emptyReplicaHealth(),
  );
  assert.equal(next.lastCertifiedHeight, 3);
  assert.equal(next.lastAnchoredHeight, null);
  assert.equal(next.clockSkew, 0);
  assert.equal(next.peers.length, 3);
  assert.equal(next.peers[1]?.heard, false);
  assert.equal(next.seedRoller, "bb");
  assert.notEqual(next.seedRoller, "aa");
});

test("a successful submit returns without a commit", () => {
  let saw: { height: number; nextRoot: Uint8Array } | undefined;
  const orderer: BatchOrderer = {
    submit(height, nextRoot) {
      saw = { height, nextRoot };
    },
  };
  const result = submitSealedBatch(orderer, { ok: true, height: 3, nextRoot: root });
  assert.equal(result, "submitted");
  assert.equal(saw?.height, 3);
  assert.deepEqual(saw?.nextRoot, root);
});
