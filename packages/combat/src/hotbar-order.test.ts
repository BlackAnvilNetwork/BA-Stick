import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { abilitiesUnlockedForJob, hotbarOrderDual } from "./abilities.ts";
import { JOB_IDS, type JobId } from "./jobs.ts";
import { weaponTpUnlocked, type WeaponType } from "./weapon-tp.ts";
import { TIM_ABILITY_IDS } from "./tim-kit.ts";
import { KNIGHT_ABILITY_IDS } from "./knight-kit.ts";
import { ROGUE_ABILITY_IDS } from "./rogue-kit.ts";
import { SORCERER_ABILITY_IDS } from "./sorcerer-kit.ts";
import { FIGHTER_ABILITY_IDS } from "./fighter-kit.ts";
import { CLERIC_ABILITY_IDS } from "./cleric-kit.ts";
import { BATTLEMAGE_ABILITY_IDS } from "./battlemage-kit.ts";
import { DRUID_ABILITY_IDS } from "./druid-kit.ts";

const LEARNED: Record<JobId, readonly string[]> = {
  time_mage: TIM_ABILITY_IDS,
  knight: KNIGHT_ABILITY_IDS,
  rogue: ROGUE_ABILITY_IDS,
  sorcerer: SORCERER_ABILITY_IDS,
  fighter: FIGHTER_ABILITY_IDS,
  cleric: CLERIC_ABILITY_IDS,
  battle_mage: BATTLEMAGE_ABILITY_IDS,
  druid: DRUID_ABILITY_IDS,
};

const WEAPON: Record<JobId, WeaponType> = {
  time_mage: "staff",
  sorcerer: "staff",
  cleric: "club",
  fighter: "greatsword",
  rogue: "dagger",
  knight: "sword",
  battle_mage: "sword",
  druid: "staff",
};

function bar(job: JobId) {
  const unlocked = [
    ...abilitiesUnlockedForJob(job, 75, LEARNED[job]),
    ...weaponTpUnlocked(WEAPON[job], 75),
  ];
  return hotbarOrderDual(job, null, unlocked).filter((id) => id !== "rest");
}

describe("default hotbar", () => {
  it("fits three rows at 75 with a weapon equipped", () => {
    for (const job of JOB_IDS) {
      const order = bar(job);
      assert.ok(order.length <= 30, `${job} default bar is ${order.length}`);
    }
  });

  it("puts the best unlocked nuke on the bar and leaves the first tier in the book", () => {
    const order = bar("sorcerer");
    assert.ok(order.includes("sc_ember_lance_iv"));
    assert.equal(order.includes("sc_ember_lance"), false);
    assert.ok(order.includes("ws_staff_omniscience"));
  });

  it("keeps one cure and the knight weapon skills", () => {
    const knight = bar("knight");
    assert.ok(knight.includes("kn_cure_iv"));
    assert.equal(knight.includes("kn_cure"), false);
    assert.ok(knight.includes("ws_sword_fast_blade"));
    const tim = bar("time_mage");
    assert.ok(tim.includes("cure_iv"));
    assert.equal(tim.includes("cure"), false);
    assert.equal(tim.includes("slowga"), false);
  });
});
