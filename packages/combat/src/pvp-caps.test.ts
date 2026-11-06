import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { abilityBlockedBySilence, weaponSkillSealedByLevel } from "./abilities";
import { abilityUsableUnderCaps, applyAreaLevelCap } from "./dual-job";
import { accuracyWithDistract, slowedSwingDelay } from "./index";
import { BATTLEMAGE_ABILITIES } from "./battlemage-kit";
import { KNIGHT_ABILITIES } from "./knight-kit";
import { SORCERER_ABILITIES } from "./sorcerer-kit";
import { TIM_ABILITIES } from "./tim-kit";

describe("pvp level caps", () => {
  it("clamps main level", () => {
    assert.equal(applyAreaLevelCap(50, 30), 30);
    assert.equal(applyAreaLevelCap(12, 30), 12);
  });

  it("Ash Pit L30 keeps Druid forms and seals post-30 songs", () => {
    assert.equal(abilityUsableUnderCaps("druid", 30, null, "dr_stickbear"), true);
    assert.equal(abilityUsableUnderCaps("druid", 30, null, "dr_stickdeer"), true);
    assert.equal(abilityUsableUnderCaps("druid", 30, null, "dr_racerunner"), true);
    assert.equal(abilityUsableUnderCaps("druid", 30, null, "dr_sticklion"), true);
    assert.equal(abilityUsableUnderCaps("druid", 30, null, "dr_ring_walk"), true);
    assert.equal(abilityUsableUnderCaps("druid", 30, null, "dr_stick_rake"), true);
    assert.equal(abilityUsableUnderCaps("druid", 30, null, "dr_ash_brace"), true);
    assert.equal(abilityUsableUnderCaps("druid", 30, null, "dr_still_water"), true);
    assert.equal(abilityUsableUnderCaps("druid", 30, null, "dr_dustmend_ii"), false);
    assert.equal(abilityUsableUnderCaps("druid", 30, null, "dr_stick_rake_ii"), false);
    assert.equal(abilityUsableUnderCaps("druid", 30, null, "dr_stick_pounce"), false);
  });

  it("blocks high unlock abilities under L30/L15", () => {
    assert.equal(abilityUsableUnderCaps("knight", 30, null, "provoke"), true);
    // Support at L15: early rogue kit ok; unlock 60 blocked.
    assert.equal(abilityUsableUnderCaps("knight", 30, "rogue", "ghost_step"), true);
    assert.equal(abilityUsableUnderCaps("knight", 30, "rogue", "kill_edge"), false);
  });

  it("seals weapon skills above the area level", () => {
    assert.equal(weaponSkillSealedByLevel("ws_sword_fast_blade", 30), false);
    assert.equal(weaponSkillSealedByLevel("ws_sword_savage_blade", 30), true);
    assert.equal(weaponSkillSealedByLevel("ws_staff_omniscience", 75), false);
    assert.equal(weaponSkillSealedByLevel("provoke", 30), false);
  });
});

describe("slow and distract", () => {
  it("lengthens a swing only when a penalty is set", () => {
    assert.equal(slowedSwingDelay(2400, 0), 2400);
    assert.equal(slowedSwingDelay(2400, 0.28), 3072);
  });

  it("opens a distracted target and dulls a distracted attacker", () => {
    assert.equal(accuracyWithDistract(80, 0, 15), 95);
    assert.equal(accuracyWithDistract(80, 15, 0), 65);
  });
});

describe("hard control recasts", () => {
  it("cannot refresh a lock before it ends", () => {
    assert.ok(TIM_ABILITIES.temporal_distortion.recastMs >= 60 * 60 * 1000);
    assert.ok(SORCERER_ABILITIES.sc_root_sigil.recastMs >= (SORCERER_ABILITIES.sc_root_sigil.durationMs ?? 0));
    assert.ok(SORCERER_ABILITIES.sc_mana_siphon.recastMs >= 10_000);
    assert.ok(BATTLEMAGE_ABILITIES.bm_bind.recastMs >= (BATTLEMAGE_ABILITIES.bm_bind.durationMs ?? 0));
    assert.ok(BATTLEMAGE_ABILITIES.bm_sleep.recastMs >= (BATTLEMAGE_ABILITIES.bm_sleep.durationMs ?? 0));
    assert.ok(SORCERER_ABILITIES.sc_ember_lance.recastMs >= 4_000);
    assert.ok(SORCERER_ABILITIES.sc_ember_rain.recastMs > SORCERER_ABILITIES.sc_ember_lance.recastMs);
    assert.ok(BATTLEMAGE_ABILITIES.bm_fire.recastMs >= 4_000);
    assert.ok(BATTLEMAGE_ABILITIES.bm_firaga.recastMs > BATTLEMAGE_ABILITIES.bm_fire.recastMs);
    assert.equal(KNIGHT_ABILITIES.bulwark.physDt, 0.4);
  });
});

describe("silence", () => {
  it("blocks spells and leaves Rest, job abilities, and weapon skills", () => {
    assert.equal(abilityBlockedBySilence("rest"), false);
    assert.equal(abilityBlockedBySilence("bulwark"), false);
    assert.equal(abilityBlockedBySilence("flux"), false);
    assert.equal(abilityBlockedBySilence("ws_sword_fast_blade"), false);
    assert.equal(abilityBlockedBySilence("cure"), true);
    assert.equal(abilityBlockedBySilence("kn_cure"), true);
    assert.equal(abilityBlockedBySilence("cl_poisona"), true);
    assert.equal(abilityBlockedBySilence("map_raise"), false);
  });
});

