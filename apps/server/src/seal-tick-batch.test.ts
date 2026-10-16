import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { keccak256 } from "viem";
import { commitInputs, commitRoll, LEADER_KEY_BYTES, LEADER_SIG_BYTES } from "./batch-envelope";
import { fallbackEpochSeed } from "./fallback-epoch-seed";
import {
  flushGameRoll,
  gameRollCount,
  loadGameRoll,
  resetGameRollForTests,
  rollUnit,
  startEpochRoll,
} from "./game-roll";
import {
  checkSealedTick,
  provisionalChainLink,
  sealParentRoot,
  sealTickBatch,
  sealView,
  type SealTickBatchArgs,
} from "./seal-tick-batch";

const gnosis = new Uint8Array(32).fill(0x42);
const ruleset = new Uint8Array(32).fill(0x33);
const rollBytes = Uint8Array.from([1, 2, 3, 4]);

function zeros(): Uint8Array {
  return new Uint8Array(32);
}

function flipLast(src: Uint8Array): Uint8Array {
  const out = new Uint8Array(src);
  out[out.length - 1] = (out[out.length - 1]! ^ 0xff) & 0xff;
  return out;
}

function seal(inputs: Uint8Array, parentRoot: Uint8Array, chainLink: Uint8Array) {
  const args: SealTickBatchArgs = {
    inputs,
    rollBytes,
    rulesetHash: ruleset,
    gnosisRandomness: gnosis,
    parentRoot,
    chainLink,
  };
  return sealTickBatch(args);
}

test("one process seals a tick, links the next parent, and rejects a bad batch", async (t) => {
  const worldCommitment = sealView().leaderCommitment;

  await t.test("accepts one tick", () => {
    assert.equal(sealView().leaderPublicKey.length, LEADER_KEY_BYTES);
    assert.deepEqual(sealParentRoot(), zeros());
    const inputs = Uint8Array.from([9, 9, 9]);
    const parent = sealParentRoot();
    const chainLink = provisionalChainLink(parent, inputs);
    const result = seal(inputs, parent, chainLink);
    assert.deepEqual(result, { ok: true, epoch: 0, height: 0 });
    assert.deepEqual(sealParentRoot(), chainLink);
    assert.deepEqual(sealView().leaderCommitment, worldCommitment);
    assert.equal(sealView().epoch, 0);
  });

  await t.test("a second tick parents on the first chain link", () => {
    const parent = sealParentRoot();
    const inputs = Uint8Array.from([8, 8, 8]);
    const chainLink = provisionalChainLink(parent, inputs);
    const result = seal(inputs, parent, chainLink);
    assert.deepEqual(result, { ok: true, epoch: 0, height: 1 });
    assert.deepEqual(sealParentRoot(), chainLink);
    assert.deepEqual(sealView().leaderCommitment, worldCommitment);
    const seed = fallbackEpochSeed(worldCommitment, gnosis);
    assert.deepEqual(fallbackEpochSeed(sealView().leaderCommitment, gnosis), seed);
  });

  await t.test("rejects a stale parent", () => {
    const before = sealView();
    const inputs = Uint8Array.from([7, 7]);
    const result = seal(inputs, flipLast(before.parentRoot), provisionalChainLink(before.parentRoot, inputs));
    assert.deepEqual(result, { ok: false, error: "stale_parent" });
    assert.equal(sealView().height, before.height);
    assert.deepEqual(sealParentRoot(), before.parentRoot);
  });

  await t.test("rejects a roll commitment of the roll bytes alone", () => {
    const view = sealView();
    const inputs = Uint8Array.from([6, 5, 4]);
    const inputsCommitment = commitInputs(inputs);
    const epochSeed = fallbackEpochSeed(view.leaderCommitment, gnosis);
    const bound = commitRoll(inputsCommitment, epochSeed, rollBytes);
    const bytesOnly = new Uint8Array(keccak256(rollBytes, "bytes"));
    assert.notDeepEqual(bound, bytesOnly);
    const chainLink = provisionalChainLink(view.parentRoot, inputs);
    const rejected = checkSealedTick(
      {
        inputs,
        inputsCommitment,
        parentRoot: view.parentRoot,
        nextRoot: chainLink,
        rulesetHash: ruleset,
        epoch: view.epoch,
        height: view.height,
        worldId: view.worldId,
        protocolVersion: view.protocolVersion,
        leaderCommitment: view.leaderCommitment,
        gnosisRandomness: gnosis,
        epochSeed,
        rollCommitment: bytesOnly,
        signature: new Uint8Array(LEADER_SIG_BYTES),
      },
      rollBytes,
      ruleset,
      chainLink,
    );
    assert.deepEqual(rejected, { ok: false, error: "roll_commitment_mismatch" });
    assert.equal(sealView().height, view.height);
    assert.deepEqual(sealParentRoot(), view.parentRoot);
  });

  await t.test("a successful seal starts the shared tape from the epoch seed, and the same seed does not rewind", () => {
    const prev = process.env.LOK_ROLL_SEED;
    delete process.env.LOK_ROLL_SEED;
    const epochSeed = fallbackEpochSeed(sealView().leaderCommitment, gnosis);
    const epochHex = Buffer.from(epochSeed).toString("hex");
    try {
      resetGameRollForTests();
      startEpochRoll(epochSeed);
      const expectedFirst = rollUnit("loot.mat");
      const expectedSecond = rollUnit("gold.mob-kill");
      resetGameRollForTests();

      const dir = mkdtempSync(join(tmpdir(), "lok-seal-epoch-"));
      loadGameRoll(dir);
      const parent = sealParentRoot();
      const sealedHeight = sealView().height;
      const inputs = Uint8Array.from([4, 4, 4]);
      const sealed = seal(inputs, parent, provisionalChainLink(parent, inputs));
      assert.deepEqual(sealed, { ok: true, epoch: 0, height: sealedHeight });

      const cursorPath = join(dir, "game-roll.json");
      const started = JSON.parse(readFileSync(cursorPath, "utf8")) as { seed: string; count: number };
      assert.equal(started.seed, epochHex);
      assert.equal(started.count, 0);
      assert.equal(gameRollCount(), 0);

      const first = rollUnit("loot.mat");
      assert.equal(first, expectedFirst);
      assert.equal(gameRollCount(), 1);
      flushGameRoll();
      const held = readFileSync(cursorPath, "utf8");

      const parent2 = sealParentRoot();
      const inputs2 = Uint8Array.from([3, 3, 3]);
      const again = seal(inputs2, parent2, provisionalChainLink(parent2, inputs2));
      assert.equal(again.ok, true);
      assert.equal(gameRollCount(), 1);
      assert.equal(readFileSync(cursorPath, "utf8"), held);

      const second = rollUnit("gold.mob-kill");
      assert.equal(second, expectedSecond);
      assert.notEqual(second, first);
      assert.equal(gameRollCount(), 2);
      flushGameRoll();

      const continued = JSON.parse(readFileSync(cursorPath, "utf8")) as { seed: string; count: number };
      assert.equal(continued.seed, epochHex);
      assert.equal(continued.count, 2);
      const tape = readFileSync(join(dir, "game-roll.jsonl"), "utf8").trim().split("\n");
      assert.deepEqual(
        tape.map((line) => {
          const row = JSON.parse(line) as { n: number; tag: string; z: string };
          assert.match(row.z, /^[0-9a-f]{16}$/);
          return { n: row.n, tag: row.tag };
        }),
        [
          { n: 1, tag: "loot.mat" },
          { n: 2, tag: "gold.mob-kill" },
        ],
      );
    } finally {
      if (prev === undefined) delete process.env.LOK_ROLL_SEED;
      else process.env.LOK_ROLL_SEED = prev;
      resetGameRollForTests();
    }
  });
});
