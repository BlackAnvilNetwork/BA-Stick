import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ALL_ABILITY_IDS,
  abilityBlockedBySilence,
  isAbilityId,
  isMapBuilderAbilityId,
} from "./abilities";
import { abilityUsableUnderCaps, applyAreaLevelCap } from "./dual-job";

describe("pvp level caps", () => {
  it("clamps main level", () => {
    assert.equal(applyAreaLevelCap(50, 30), 30);
    assert.equal(applyAreaLevelCap(12, 30), 12);
  });

  it("blocks high unlock abilities under L30/L15", () => {
    assert.equal(abilityUsableUnderCaps("knight", 30, null, "provoke"), true);
    // Support at L15: early rogue kit ok; unlock 60 blocked.
    assert.equal(abilityUsableUnderCaps("knight", 30, "rogue", "ghost_step"), true);
    assert.equal(abilityUsableUnderCaps("knight", 30, "rogue", "kill_edge"), false);
  });
});

describe("silence", () => {
  it("blocks spells and leaves Rest, job abilities, weapon skills, and map tools", () => {
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

describe("map builder protocol ids", () => {
  it("lists map_raise so the protocol enum accepts it", () => {
    assert.equal(isMapBuilderAbilityId("map_raise"), true);
    assert.equal(isMapBuilderAbilityId("cure"), false);
    assert.ok(ALL_ABILITY_IDS.includes("map_raise"));
    assert.equal(isAbilityId("map_raise"), true);
  });
});

