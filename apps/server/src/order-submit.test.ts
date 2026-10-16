/**
 * The tick helper submits a sealed root and returns.
 * A missing or refusing orderer does not throw, and the batch stays provisional.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { submitOnSimTick, submitSealedBatch, type BatchOrderer } from "./order-submit";

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
