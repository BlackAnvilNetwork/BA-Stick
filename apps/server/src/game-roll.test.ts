import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  flushGameRoll,
  gameRollCount,
  loadGameRoll,
  resetGameRollForTests,
  rollIndex,
  rollUnit,
  scriptNextRollsForTests,
} from "./game-roll";

function freshDir(): string {
  return mkdtempSync(join(tmpdir(), "lok-roll-"));
}

test("the same seed replays the same rolls, and a reload continues past them", () => {
  const prev = process.env.LOK_ROLL_SEED;
  process.env.LOK_ROLL_SEED = "bellgrave-roll-seed";
  try {
    const first = freshDir();
    loadGameRoll(first);
    const prefix = [rollUnit("gold.mob-kill"), rollIndex("loot.mat", 7), rollUnit("combat.player.hit")];
    assert.equal(gameRollCount(), 3);
    flushGameRoll();

    const again = freshDir();
    loadGameRoll(again);
    const replay = [rollUnit("gold.mob-kill"), rollIndex("loot.mat", 7), rollUnit("combat.player.hit")];
    assert.deepEqual(replay, prefix);

    loadGameRoll(first);
    const continued = rollUnit("gold.mob-kill");
    assert.notEqual(continued, prefix[0]);
    assert.equal(gameRollCount(), 4);

    const tape = readFileSync(join(first, "game-roll.jsonl"), "utf8").trim().split("\n");
    assert.equal(tape.length, 3);
    const row = JSON.parse(tape[0]!) as { n: number; tag: string; z: string };
    assert.equal(row.n, 1);
    assert.equal(row.tag, "gold.mob-kill");
    assert.match(row.z, /^[0-9a-f]{16}$/);
  } finally {
    if (prev === undefined) delete process.env.LOK_ROLL_SEED;
    else process.env.LOK_ROLL_SEED = prev;
    resetGameRollForTests();
  }
});

test("an idle flush does not rewrite the cursor", () => {
  const prev = process.env.LOK_ROLL_SEED;
  process.env.LOK_ROLL_SEED = "idle-seed";
  try {
    const dir = freshDir();
    loadGameRoll(dir);
    const path = join(dir, "game-roll.json");
    const before = readFileSync(path, "utf8");
    const mtime = statSync(path).mtimeMs;
    flushGameRoll();
    assert.equal(readFileSync(path, "utf8"), before);
    assert.equal(statSync(path).mtimeMs, mtime);
    rollUnit("gather.yield");
    flushGameRoll();
    const saved = JSON.parse(readFileSync(path, "utf8")) as { count: number; seed: string };
    assert.equal(saved.count, 1);
    assert.equal(saved.seed, "idle-seed");
    assert.ok(statSync(path).mtimeMs >= mtime);
  } finally {
    if (prev === undefined) delete process.env.LOK_ROLL_SEED;
    else process.env.LOK_ROLL_SEED = prev;
    resetGameRollForTests();
  }
});

test("scripted rolls do not advance the saved sequence", () => {
  resetGameRollForTests("scripted");
  scriptNextRollsForTests([0]);
  assert.equal(rollUnit("mob.ai.spend"), 0);
  assert.equal(gameRollCount(), 0);
  assert.equal(rollIndex("mob.ai.pick", 1), 0);
  assert.equal(gameRollCount(), 0);
  const drawn = rollUnit("after");
  assert.equal(gameRollCount(), 1);
  assert.ok(drawn >= 0 && drawn < 1);
  resetGameRollForTests();
});

test("a broken cursor refuses to boot a new seed", () => {
  const dir = freshDir();
  writeFileSync(join(dir, "game-roll.json"), "{not json");
  assert.throws(() => loadGameRoll(dir), /not valid JSON/);
  resetGameRollForTests();
});
