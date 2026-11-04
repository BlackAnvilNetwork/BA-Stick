import assert from "node:assert/strict";
import { test } from "node:test";
import { supportJobActive } from "./dual-job";
import {
  DRUID_ABILITIES,
  DRUID_ABILITY_IDS,
  DRUID_FORM_LABEL,
  DRUID_FORM_PRESET,
  DRUID_SHIFT_IDS,
  druidFormHp,
  druidHotbarOrder,
  druidMoveMul,
} from "./druid-kit";
import { JOB_GRADES, jobVitalsAtLevel } from "./grades";
import { JOB_IDS, JOBS, JOB_WEAPON } from "./jobs";
import { JOB_LABEL, SKILL_NODES, SKILL_TREE_NODE_COUNT } from "./skill-tree";
import { isTrainerFreeAbility } from "./trainer";

const RETIRED = [
  "Cinderhide",
  "Graven Asp",
  "Stillmere Hart",
  "Waystone Hare",
  "Tusk Clamour",
  "Glass Fang",
  "Circle Hop",
  "dr_cinderhide",
  "dr_graven_asp",
  "dr_stillmere_hart",
  "dr_waystone_hare",
];

test("druid is append-only job index 7", () => {
  assert.equal(JOB_IDS[7], "druid");
  assert.equal(JOB_IDS.length, 8);
  assert.equal(JOBS.druid.playable, true);
  assert.equal(JOB_WEAPON.druid, "staff");
});

test("Stick form labels and presets are the live lock", () => {
  assert.deepEqual(DRUID_FORM_LABEL, {
    0: "Ring-Walker",
    1: "Stick Bear",
    2: "Stick Deer",
    3: "Stick Lion",
    4: "Racerunner",
  });
  assert.deepEqual(DRUID_FORM_PRESET, {
    0: "druid",
    1: "druid:stickbear",
    2: "druid:stickdeer",
    3: "druid:sticklion",
    4: "druid:racerunner",
  });
  const kitText = JSON.stringify(DRUID_ABILITIES) + Object.values(DRUID_FORM_LABEL).join(" ");
  for (const name of RETIRED) {
    assert.equal(kitText.includes(name), false, name);
  }
});

test("Druid is never a support job", () => {
  assert.equal(supportJobActive("knight", 40, "druid"), false);
  assert.equal(supportJobActive("druid", 40, "knight"), true);
});

test("form HP clamp never out-Knights and travel is the smallest", () => {
  const human = jobVitalsAtLevel("druid", 1).maxHp;
  const knight = jobVitalsAtLevel("knight", 1).maxHp;
  const bear = druidFormHp(human, 1, knight);
  assert.equal(human, 122);
  assert.equal(bear, 156);
  assert.ok(bear <= knight - 4);
  assert.equal(druidFormHp(human, 3, knight), Math.floor(human * 0.9));
  assert.equal(druidFormHp(human, 4, knight), Math.floor(human * 0.75));
  assert.equal(druidFormHp(human, 2, knight), human);
});

test("Racerunner moves faster without haste and rest stays on the kit", () => {
  assert.equal(druidMoveMul(4, 0, 0), 1.4);
  assert.equal(druidMoveMul(4, 100, 50), 1.5);
  assert.equal(druidMoveMul(4, 100, 50, 1.55), 1.55);
  assert.equal(druidMoveMul(4, 100, 50, 1.65), 1.65);
  assert.equal(DRUID_ABILITIES.dr_long_run.moveMul, 1.55);
  assert.equal(DRUID_ABILITIES.dr_ember_run.moveMul, 1.65);
  assert.equal(DRUID_ABILITIES.dr_ash_brace_ii.physDt, 0.74);
  assert.equal(DRUID_ABILITIES.dr_kiln_shoulder.physDt, 0.68);
  assert.equal(druidMoveMul(1, 100, 50), 1);
  assert.ok(DRUID_ABILITY_IDS.includes("rest"));
  assert.ok(isTrainerFreeAbility("rest"));
  assert.ok(isTrainerFreeAbility("dr_ringwake"));
  assert.ok(isTrainerFreeAbility("dr_stickbear"));
});

test("Racerunner hotbar hides Ringwake", () => {
  const unlocked = DRUID_ABILITY_IDS.filter((id) => DRUID_ABILITIES[id].unlockLevel <= 20);
  const travel = druidHotbarOrder(unlocked, 4);
  assert.equal(travel.includes("dr_ringwake"), false);
  assert.ok(travel.includes("dr_ring_walk"));
  assert.ok(druidHotbarOrder(unlocked, 0).includes("dr_ringwake"));
});

test("Ring-Walk is unlocked by L12 so Racerunner can return", () => {
  assert.equal(DRUID_ABILITIES.dr_ring_walk.unlockLevel, 1);
  const at12 = DRUID_ABILITY_IDS.filter((id) => DRUID_ABILITIES[id].unlockLevel <= 12);
  assert.ok(at12.includes("dr_ring_walk"));
  assert.ok(at12.includes("dr_racerunner"));
});

test("Henge island is a 685 add-on and the seven stay 85", () => {
  assert.equal(SKILL_TREE_NODE_COUNT, 685);
  assert.equal(JOB_LABEL.druid, "Henge");
  assert.ok(SKILL_NODES.knight_84);
  assert.ok(SKILL_NODES.druid_84);
  assert.ok(SKILL_NODES.time_mage_84);
  assert.equal(SKILL_NODES.druid_0?.x, 0);
  assert.equal(SKILL_NODES.druid_0?.y, 0);
});

test("grades stay C+ HP / B MND / D STR", () => {
  assert.equal(JOB_GRADES.druid.hp, "C+");
  assert.equal(JOB_GRADES.druid.mp, "B");
  assert.equal(JOB_GRADES.druid.str, "D");
  assert.equal(JOB_GRADES.druid.mnd, "B");
});

test("shift family is the five locked songs", () => {
  assert.deepEqual([...DRUID_SHIFT_IDS], [
    "dr_stickbear",
    "dr_stickdeer",
    "dr_sticklion",
    "dr_racerunner",
    "dr_ring_walk",
  ]);
});
