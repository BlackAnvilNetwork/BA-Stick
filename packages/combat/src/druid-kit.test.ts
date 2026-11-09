import assert from "node:assert/strict";
import { test } from "node:test";
import { supportJobActive } from "./dual-job";
import {
  DRUID_ABILITIES,
  DRUID_ABILITY_IDS,
  DRUID_FORM_LABEL,
  DRUID_FORM_PRESET,
  DRUID_SHIFT_IDS,
  DRUID_SHIFT_RECAST_MS,
  applyDruidShiftRecast,
  druidFormHp,
  druidHotbarOrder,
  druidMoveMul,
} from "./druid-kit";
import { JOB_GRADES, jobVitalsAtLevel } from "./grades";
import { JOB_IDS, JOBS, JOB_WEAPON, mintableStartingJobs } from "./jobs";
import { JOB_LABEL, SKILL_NODES, SKILL_TREE_NODE_COUNT } from "./skill-tree";
import { isTrainerFreeAbility } from "./trainer";
import { abilityIconUrl, abilityLabel } from "./abilities";
import {
  WEAPON_TP_ABILITIES,
  druidFormWsLabel,
  weaponTypeForDruidForm,
  weaponTpUnlocked,
  withFormWeaponSkills,
} from "./weapon-tp";

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

test("mintableStartingJobs treats an empty factory list as none", () => {
  assert.ok(mintableStartingJobs(undefined).includes("druid"));
  assert.deepEqual(mintableStartingJobs([]), []);
  assert.deepEqual(mintableStartingJobs([0, 7]), ["time_mage", "druid"]);
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

test("default bar is a form line, not every unlocked id", () => {
  const unlocked = DRUID_ABILITY_IDS.filter((id) => id !== "rest");
  const human = druidHotbarOrder(unlocked, 0);
  assert.ok(human.length <= 30, `human bar is ${human.length}`);
  assert.equal(human.includes("dr_stick_rake"), false, "lion JAs stay in the book");
  assert.ok(human.includes("dr_dustmend_ii"));
  assert.equal(DRUID_ABILITIES.dr_stick_maul.needsTarget, true);
  assert.equal(DRUID_ABILITIES.dr_stick_maul_ii.needsTarget, true);
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

test("using a form recasts siblings and leaves that form ready to toggle", () => {
  const recasts: Partial<Record<string, number>> = {};
  const now = 10_000;
  applyDruidShiftRecast(recasts, "dr_stickbear", now);
  assert.equal(recasts.dr_stickbear, undefined);
  assert.equal(recasts.dr_stickdeer, now + DRUID_SHIFT_RECAST_MS);
  assert.equal(recasts.dr_sticklion, now + DRUID_SHIFT_RECAST_MS);
  assert.equal(recasts.dr_racerunner, now + DRUID_SHIFT_RECAST_MS);
  assert.equal(recasts.dr_ring_walk, now + DRUID_SHIFT_RECAST_MS);
  applyDruidShiftRecast(recasts, "dr_stickbear", now, true);
  assert.equal(recasts.dr_stickbear, undefined);
  assert.equal(recasts.dr_stickdeer, now + DRUID_SHIFT_RECAST_MS);
});

test("form weapon skills follow tank / heal / dps families, not the hidden staff", () => {
  assert.equal(weaponTypeForDruidForm(0, "staff"), "staff");
  assert.equal(weaponTypeForDruidForm(0, "club"), "club");
  assert.equal(weaponTypeForDruidForm(1, "staff"), "sword");
  assert.equal(weaponTypeForDruidForm(2, "staff"), "club");
  assert.equal(weaponTypeForDruidForm(3, "staff"), "dagger");
  assert.equal(weaponTypeForDruidForm(4, "staff"), null);
  const bear = weaponTpUnlocked(weaponTypeForDruidForm(1, "staff"), 1);
  const deer = weaponTpUnlocked(weaponTypeForDruidForm(2, "staff"), 1);
  const lion = weaponTpUnlocked(weaponTypeForDruidForm(3, "staff"), 1);
  const race = weaponTpUnlocked(weaponTypeForDruidForm(4, "staff"), 75);
  assert.ok(bear.includes("ws_sword_fast_blade"));
  assert.equal(bear.includes("ws_staff_heavy_swing"), false);
  assert.ok(deer.includes("ws_club_shiny_strike"));
  assert.equal(deer.includes("ws_staff_heavy_swing"), false);
  assert.ok(lion.includes("ws_dg_wasp_sting"));
  assert.equal(lion.includes("ws_staff_heavy_swing"), false);
  assert.equal(race.length, 0);
});

test("withFormWeaponSkills strips staff WS from a stale unlocked list", () => {
  const stale = ["dr_stickbear", "ws_staff_heavy_swing", "ws_staff_omniscience"] as const;
  const bear = withFormWeaponSkills(stale, { job: "druid", form: 1, level: 1 });
  assert.ok(bear.includes("dr_stickbear"));
  assert.ok(bear.includes("ws_sword_fast_blade"));
  assert.equal(bear.includes("ws_staff_heavy_swing"), false);
  const knight = withFormWeaponSkills(["ws_sword_fast_blade"] as const, { job: "knight", form: 1, level: 1 });
  assert.deepEqual(knight, ["ws_sword_fast_blade"]);
});

test("form WS skins rename display only; original labels stay", () => {
  assert.equal(WEAPON_TP_ABILITIES.ws_sword_fast_blade.label, "Oath Cut");
  assert.equal(abilityLabel("ws_sword_fast_blade"), "Oath Cut");
  assert.equal(abilityLabel("ws_sword_fast_blade", 1), "Ferocious Maul");
  assert.equal(abilityLabel("ws_club_shiny_strike", 2), "Buck");
  assert.equal(abilityLabel("ws_dg_wasp_sting", 3), "Blazing Bite");
  assert.equal(abilityLabel("ws_sword_fast_blade", 0), "Oath Cut");
  assert.equal(abilityIconUrl("ws_sword_fast_blade"), "/icons/abilities/ws_sword_fast_blade.png");
  assert.equal(abilityIconUrl("ws_sword_fast_blade", 1), "/icons/abilities/dr_form1_ws_sword_fast_blade.png");
  assert.equal(abilityIconUrl("ws_club_shiny_strike", 2), "/icons/abilities/dr_form2_ws_club_shiny_strike.png");
  assert.equal(abilityIconUrl("ws_dg_wasp_sting", 3), "/icons/abilities/dr_form3_ws_dg_wasp_sting.png");
  for (const [form, weapon] of [
    [1, "sword"],
    [2, "club"],
    [3, "dagger"],
  ] as const) {
    for (const id of weaponTpUnlocked(weapon, 75)) {
      const skin = druidFormWsLabel(id, form);
      assert.ok(skin, `${id} form ${form}`);
      assert.notEqual(skin, WEAPON_TP_ABILITIES[id].label);
    }
  }
});
