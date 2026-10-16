import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { flushGameRoll, loadGameRoll, resetGameRollForTests } from "./game-roll";
import {
  PVP_ROLL_BLIND,
  PVP_ROLL_CRIT,
  PVP_ROLL_HIT,
  rollPvpAutoAttack,
  type PvpAutoAttackRoll,
} from "./pvp-auto-rolls";

const SWINGS = 40;

function swingAt(i: number): { blinded: boolean; hitChance: number; critChance: number } {
  return {
    blinded: i % 2 === 0,
    hitChance: 0.35 + (i % 5) * 0.1,
    critChance: 0.08 + (i % 4) * 0.12,
  };
}

function play(seed: string): PvpAutoAttackRoll[] {
  resetGameRollForTests(seed);
  const outcomes: PvpAutoAttackRoll[] = [];
  for (let i = 0; i < SWINGS; i++) outcomes.push(rollPvpAutoAttack(swingAt(i)));
  return outcomes;
}

test("the same roll cursor replays pvp blind, hit, and crit", () => {
  const prev = process.env.LOK_ROLL_SEED;
  const dir = mkdtempSync(join(tmpdir(), "pvp-rolls-"));
  try {
    const first = play("pvp-cursor-a");
    const replay = play("pvp-cursor-a");
    assert.deepEqual(replay, first);
    assert.ok(first.some((row) => row.outcome === "blind" || row.outcome === "miss" || row.outcome === "hit"));

    let differed = false;
    for (let n = 0; n < 12; n++) {
      const other = play(`pvp-cursor-b-${n}`);
      if (JSON.stringify(other) !== JSON.stringify(first)) {
        differed = true;
        break;
      }
    }
    assert.equal(differed, true);

    process.env.LOK_ROLL_SEED = "pvp-tape-seed";
    loadGameRoll(dir);
    for (let i = 0; i < SWINGS; i++) rollPvpAutoAttack(swingAt(i));
    flushGameRoll();
    const tags = readFileSync(join(dir, "game-roll.jsonl"), "utf8")
      .trim()
      .split("\n")
      .map((line) => (JSON.parse(line) as { tag: string }).tag);
    assert.ok(tags.includes(PVP_ROLL_BLIND));
    assert.ok(tags.includes(PVP_ROLL_HIT));
    assert.ok(tags.includes(PVP_ROLL_CRIT));
    for (const tag of tags) {
      assert.ok(tag === PVP_ROLL_BLIND || tag === PVP_ROLL_HIT || tag === PVP_ROLL_CRIT);
    }
  } finally {
    if (prev === undefined) delete process.env.LOK_ROLL_SEED;
    else process.env.LOK_ROLL_SEED = prev;
    resetGameRollForTests();
    rmSync(dir, { recursive: true, force: true });
  }
});
