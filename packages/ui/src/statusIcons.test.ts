import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyBuffs, type UnitSnapshot } from "@bellgrave/protocol";
import { worldStatusIcons } from "./statusIcons";

function unit(kind: "player" | "mob", buffs: UnitSnapshot["buffs"]): UnitSnapshot {
  return {
    id: "u",
    kind,
    name: "U",
    x: 0,
    y: 0,
    z: 0,
    facing: 0,
    hp: 1,
    maxHp: 1,
    mp: 0,
    maxMp: 0,
    tp: 0,
    anim: "idle",
    animUntil: 0,
    targetId: null,
    job: kind === "player" ? "knight" : undefined,
    buffs,
  };
}

test("disease and curse use their own icons, not bm_bio / addle", () => {
  const now = 1_000;
  const b = emptyBuffs();
  b.diseaseUntil = now + 5_000;
  b.curseUntil = now + 5_000;
  const icons = worldStatusIcons(unit("player", b), now);
  const ids = icons.map((i) => i.id);
  assert.ok(ids.includes("cl_viruna"));
  assert.ok(ids.includes("cl_cursna"));
  assert.equal(ids.includes("bm_bio"), false);
  assert.equal(ids.includes("addle"), false);
});

test("player job buffs and ailments appear on the world column", () => {
  const now = 1_000;
  const b = emptyBuffs();
  b.berserkUntil = now + 1;
  b.warcryUntil = now + 1;
  b.spellbladeUntil = now + 1;
  b.phalanxUntil = now + 1;
  b.stoneskinUntil = now + 1;
  b.druidRingwakeUntil = now + 1;
  b.druidAshBraceUntil = now + 1;
  b.druidMereVeilUntil = now + 1;
  b.druidMereVeilHp = 12;
  b.paraUntil = now + 1;
  b.blindUntil = now + 1;
  const ids = worldStatusIcons(unit("player", b), now).map((i) => i.id);
  for (const id of [
    "berserk",
    "warcry",
    "spellblade",
    "bm_phalanx",
    "bm_stoneskin",
    "dr_ringwake",
    "dr_ash_brace",
    "dr_mere_veil",
    "paralyga",
    "kn_flash",
  ]) {
    assert.ok(ids.includes(id as (typeof ids)[number]), id);
  }
});
