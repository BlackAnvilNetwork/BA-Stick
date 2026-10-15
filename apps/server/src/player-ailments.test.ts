import assert from "node:assert/strict";
import test from "node:test";
import {
  activeAilments,
  ailmentLabel,
  applyAilment,
  clearAilments,
  curseTaken,
  diseasedHeal,
  emptyAilments,
  mobBoltAilment,
  naTargets,
} from "./player-ailments";

const NOW = 1_000;

test("each -na spell clears only its ailment, and Erase clears all", () => {
  const host = emptyAilments();
  applyAilment(host, "poison", NOW, 5_000, 3);
  applyAilment(host, "para", NOW, 5_000);
  assert.deepEqual(clearAilments(host, NOW + 1, naTargets("cl_poisona")!), ["poison"]);
  assert.equal(host.poisonTick, 0);
  assert.equal(host.paraUntil > NOW, true);
  assert.deepEqual(clearAilments(host, NOW + 1, naTargets("cl_poisona")!), []);

  const all = emptyAilments();
  for (const kind of naTargets("cl_erase")!) applyAilment(all, kind, NOW, 5_000, 2);
  assert.equal(clearAilments(all, NOW + 1).length, 7);
  assert.deepEqual(activeAilments(all, NOW + 1), []);
  assert.equal(ailmentLabel("silence"), "silenced");
});

test("field casters and shiny casters cover every ailment -na can remove", () => {
  const kinds = [
    mobBoltAilment("sorcerer", false)?.kind,
    mobBoltAilment("cleric", false)?.kind,
    mobBoltAilment("time_mage", false)?.kind,
    mobBoltAilment("battle_mage", false)?.kind,
    mobBoltAilment("sorcerer", true)?.kind,
    mobBoltAilment("cleric", true)?.kind,
    mobBoltAilment("time_mage", true)?.kind,
  ];
  assert.deepEqual(kinds, ["poison", "para", "silence", "blind", "disease", "curse", "petrify"]);
  assert.equal(mobBoltAilment("fighter", false), null);
  assert.equal(mobBoltAilment("sorcerer", false)?.poisonTick, 3);
});

test("disease halves a cure and curse raises damage that got through", () => {
  assert.equal(diseasedHeal(10, NOW + 5, NOW), 5);
  assert.equal(diseasedHeal(10, NOW, NOW), 10);
  assert.equal(diseasedHeal(0, NOW + 5, NOW), 0);
  assert.equal(curseTaken(10, NOW + 5, NOW), 11);
  assert.equal(curseTaken(10, 0, NOW), 10);
});
