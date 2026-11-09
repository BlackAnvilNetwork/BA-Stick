/**
 * Druid kit — Ring-Walker shapeshift flex (jobs-from-plan §4.8).
 * Feel: shift, then play that form's short bar. Never best-in-role.
 * Forms: Stick Bear / Stick Deer / Stick Lion / Racerunner.
 * FX: dust, ash-gold, incomplete heptad — not TIM teal.
 */

import { pickHotbarLines } from "./hotbar-lines";
import { isTrainerFreeAbility } from "./trainer";

export const DRUID_FORM = {
  ringWalker: 0,
  stickbear: 1,
  stickdeer: 2,
  sticklion: 3,
  racerunner: 4,
} as const;

export type DruidForm = (typeof DRUID_FORM)[keyof typeof DRUID_FORM];

export const DRUID_FORM_PRESET: Record<DruidForm, string> = {
  0: "druid",
  1: "druid:stickbear",
  2: "druid:stickdeer",
  3: "druid:sticklion",
  4: "druid:racerunner",
};

export const DRUID_FORM_LABEL: Record<DruidForm, string> = {
  0: "Ring-Walker",
  1: "Stick Bear",
  2: "Stick Deer",
  3: "Stick Lion",
  4: "Racerunner",
};

export const DRUID_SHIFT_RECAST_MS = 20_000;
export const DRUID_SHIFT_IDS = [
  "dr_stickbear",
  "dr_stickdeer",
  "dr_sticklion",
  "dr_racerunner",
  "dr_ring_walk",
] as const;

/**
 * Using a form leaves that song ready to toggle. Sibling forms share the
 * family recast. Ring Split skips the family lock for the next shift.
 */
export function applyDruidShiftRecast(
  recasts: Partial<Record<string, number>>,
  usedId: string,
  now: number,
  skipFamily = false,
): void {
  if (skipFamily) {
    delete recasts[usedId];
    return;
  }
  const until = now + DRUID_SHIFT_RECAST_MS;
  for (const id of DRUID_SHIFT_IDS) {
    if (id === usedId) {
      delete recasts[id];
      continue;
    }
    recasts[id] = until;
  }
}

export const DRUID_ABILITY_IDS = [
  "rest",
  "dr_ringwake",
  "dr_stickbear",
  "dr_dustmend",
  "dr_sour_hum",
  "dr_stickdeer",
  "dr_chalk_ward",
  "dr_racerunner",
  "dr_ring_walk",
  "dr_sticklion",
  "dr_hollow_listen",
  "dr_dustmend_ii",
  "dr_sour_hum_ii",
  "dr_chalk_ward_ii",
  "dr_ring_split",
  "dr_unstruck_echo",
  "dr_mirror_glaze",
  "dr_stick_clamour",
  "dr_ash_brace",
  "dr_bracken_root",
  "dr_stick_maul",
  "dr_bundle_thicken",
  "dr_stick_clamour_ii",
  "dr_ash_brace_ii",
  "dr_stick_maul_ii",
  "dr_kiln_shoulder",
  "dr_ring_of_stakes",
  "dr_still_water",
  "dr_antler_hum",
  "dr_mere_veil",
  "dr_pair_mend",
  "dr_still_water_ii",
  "dr_antler_hum_ii",
  "dr_still_water_iii",
  "dr_pair_mend_ii",
  "dr_mere_veil_ii",
  "dr_still_water_iv",
  "dr_heptad_hum",
  "dr_stick_rake",
  "dr_mane_dust",
  "dr_stick_rake_ii",
  "dr_stick_pounce",
  "dr_mane_dust_ii",
  "dr_stick_rake_iii",
  "dr_long_pounce",
  "dr_mane_fury",
  "dr_tail_dash",
  "dr_ember_tail",
  "dr_tail_dash_ii",
  "dr_long_run",
  "dr_ember_run",
] as const;

export type DruidAbilityId = (typeof DRUID_ABILITY_IDS)[number];

export type DruidAbilityCategory = "utility" | "shift" | "human" | "bear" | "deer" | "lion" | "racerunner";

export type DruidAbilityDef = {
  id: DruidAbilityId;
  label: string;
  glyph: string;
  unlockLevel: number;
  mp: number;
  recastMs: number;
  category: DruidAbilityCategory;
  durationMs?: number;
  heal?: number;
  potency?: number;
  physDt?: number;
  range?: number;
  aoe?: number;
  needsTarget?: boolean;
  allyTarget?: boolean;
  staffRequired?: boolean;
  /** Required form; omit = any except where noted. */
  form?: DruidForm;
  /** Shift destination. */
  shiftTo?: DruidForm;
  hateFrac?: number;
  hitMul?: number;
  absorb?: number;
  moveMul?: number;
};

const ja = (
  id: DruidAbilityId,
  label: string,
  glyph: string,
  unlockLevel: number,
  extra: Partial<DruidAbilityDef> = {},
): DruidAbilityDef => ({
  id,
  label,
  glyph,
  unlockLevel,
  mp: 0,
  recastMs: extra.recastMs ?? 0,
  category: extra.category ?? "human",
  ...extra,
});

export const DRUID_ABILITIES: Record<DruidAbilityId, DruidAbilityDef> = {
  rest: ja("rest", "Rest", "Rs", 1, { category: "utility" }),
  dr_ringwake: ja("dr_ringwake", "Ringwake", "Rw", 1, {
    recastMs: 2 * 60 * 60 * 1000,
    durationMs: 30_000,
    category: "utility",
  }),
  dr_stickbear: ja("dr_stickbear", "Stick Bear", "Sb", 1, {
    recastMs: DRUID_SHIFT_RECAST_MS,
    category: "shift",
    shiftTo: 1,
  }),
  dr_dustmend: ja("dr_dustmend", "Dustmend", "Dm", 1, {
    mp: 12,
    recastMs: 6_000,
    heal: 32,
    range: 12,
    allyTarget: true,
    staffRequired: true,
    form: 0,
  }),
  dr_sour_hum: ja("dr_sour_hum", "Sour Hum", "Sh", 5, {
    mp: 16,
    recastMs: 18_000,
    durationMs: 12_000,
    range: 12,
    needsTarget: true,
    staffRequired: true,
    form: 0,
    hitMul: 0.92,
  }),
  dr_stickdeer: ja("dr_stickdeer", "Stick Deer", "Sd", 8, {
    recastMs: DRUID_SHIFT_RECAST_MS,
    category: "shift",
    shiftTo: 2,
  }),
  dr_chalk_ward: ja("dr_chalk_ward", "Chalk Ward", "Cw", 10, {
    mp: 18,
    recastMs: 30_000,
    durationMs: 90_000,
    allyTarget: true,
    range: 12,
    staffRequired: true,
    form: 0,
    physDt: 0.92,
  }),
  dr_racerunner: ja("dr_racerunner", "Racerunner", "Rr", 12, {
    recastMs: DRUID_SHIFT_RECAST_MS,
    category: "shift",
    shiftTo: 4,
  }),
  dr_ring_walk: ja("dr_ring_walk", "Ring-Walk", "Rk", 1, {
    recastMs: DRUID_SHIFT_RECAST_MS,
    category: "shift",
    shiftTo: 0,
  }),
  dr_sticklion: ja("dr_sticklion", "Stick Lion", "Sl", 18, {
    recastMs: DRUID_SHIFT_RECAST_MS,
    category: "shift",
    shiftTo: 3,
  }),
  dr_hollow_listen: ja("dr_hollow_listen", "Hollow Listen", "Hl", 20, {
    mp: 10,
    recastMs: 45_000,
    durationMs: 15_000,
    staffRequired: true,
    form: 0,
  }),
  dr_dustmend_ii: ja("dr_dustmend_ii", "Dustmend II", "D2", 32, {
    mp: 22,
    recastMs: 6_000,
    heal: 70,
    range: 12,
    allyTarget: true,
    staffRequired: true,
    form: 0,
  }),
  dr_sour_hum_ii: ja("dr_sour_hum_ii", "Sour Hum II", "S2", 40, {
    mp: 22,
    recastMs: 18_000,
    durationMs: 12_000,
    range: 12,
    needsTarget: true,
    staffRequired: true,
    form: 0,
    hitMul: 0.88,
  }),
  dr_chalk_ward_ii: ja("dr_chalk_ward_ii", "Chalk Ward II", "C2", 48, {
    mp: 26,
    recastMs: 30_000,
    durationMs: 90_000,
    allyTarget: true,
    range: 12,
    staffRequired: true,
    form: 0,
    physDt: 0.88,
  }),
  dr_ring_split: ja("dr_ring_split", "Ring Split", "Rp", 55, {
    mp: 20,
    recastMs: 20_000,
    durationMs: 8_000,
    form: 0,
  }),
  dr_unstruck_echo: ja("dr_unstruck_echo", "Unstruck Echo", "Ue", 65, {
    mp: 28,
    recastMs: 45_000,
    durationMs: 8_000,
    range: 12,
    needsTarget: true,
    staffRequired: true,
    form: 0,
  }),
  dr_mirror_glaze: ja("dr_mirror_glaze", "Mirror Glaze", "Mg", 75, {
    recastMs: 10 * 60_000,
    durationMs: 12_000,
    form: 0,
    physDt: 0.85,
  }),
  dr_stick_clamour: ja("dr_stick_clamour", "Stick Clamour", "Sc", 1, {
    recastMs: 45_000,
    range: 12,
    needsTarget: true,
    form: 1,
    category: "bear",
    hateFrac: 0.7,
  }),
  dr_ash_brace: ja("dr_ash_brace", "Ash Brace", "Ab", 5, {
    recastMs: 90_000,
    durationMs: 20_000,
    form: 1,
    category: "bear",
    physDt: 0.78,
  }),
  dr_bracken_root: ja("dr_bracken_root", "Bracken Root", "Br", 10, {
    mp: 12,
    recastMs: 40_000,
    durationMs: 6_000,
    form: 1,
    category: "bear",
    moveMul: 0.85,
  }),
  dr_stick_maul: ja("dr_stick_maul", "Stick Maul", "Sm", 15, {
    recastMs: 30_000,
    potency: 28,
    aoe: 4,
    needsTarget: true,
    form: 1,
    category: "bear",
  }),
  dr_bundle_thicken: ja("dr_bundle_thicken", "Bundle Thicken", "Bt", 20, {
    recastMs: 3 * 60_000,
    durationMs: 15_000,
    form: 1,
    category: "bear",
    physDt: 0.7,
  }),
  dr_stick_clamour_ii: ja("dr_stick_clamour_ii", "Stick Clamour II", "S3", 35, {
    recastMs: 30_000,
    range: 12,
    needsTarget: true,
    form: 1,
    category: "bear",
    hateFrac: 0.7,
  }),
  dr_ash_brace_ii: ja("dr_ash_brace_ii", "Ash Brace II", "A2", 45, {
    recastMs: 90_000,
    durationMs: 20_000,
    form: 1,
    category: "bear",
    physDt: 0.74,
  }),
  dr_stick_maul_ii: ja("dr_stick_maul_ii", "Stick Maul II", "M2", 50, {
    recastMs: 30_000,
    potency: 48,
    aoe: 4,
    needsTarget: true,
    form: 1,
    category: "bear",
  }),
  dr_kiln_shoulder: ja("dr_kiln_shoulder", "Kiln Shoulder", "Ks", 60, {
    recastMs: 5 * 60_000,
    durationMs: 12_000,
    form: 1,
    category: "bear",
    physDt: 0.68,
  }),
  dr_ring_of_stakes: ja("dr_ring_of_stakes", "Ring of Stakes", "Rs2", 75, {
    recastMs: 10 * 60_000,
    durationMs: 12_000,
    aoe: 8,
    form: 1,
    category: "bear",
    hateFrac: 0.5,
  }),
  dr_still_water: ja("dr_still_water", "Still Water", "Sw", 8, {
    mp: 12,
    recastMs: 5_000,
    heal: 40,
    range: 12,
    allyTarget: true,
    form: 2,
    category: "deer",
  }),
  dr_antler_hum: ja("dr_antler_hum", "Antler Hum", "Ah", 10, {
    mp: 16,
    recastMs: 12_000,
    durationMs: 12_000,
    heal: 48,
    range: 12,
    allyTarget: true,
    form: 2,
    category: "deer",
  }),
  dr_mere_veil: ja("dr_mere_veil", "Mere Veil", "Mv", 15, {
    mp: 20,
    recastMs: 40_000,
    durationMs: 20_000,
    absorb: 25,
    range: 12,
    allyTarget: true,
    form: 2,
    category: "deer",
  }),
  dr_pair_mend: ja("dr_pair_mend", "Pair Mend", "Pm", 18, {
    mp: 28,
    recastMs: 10_000,
    heal: 36,
    range: 12,
    form: 2,
    category: "deer",
  }),
  dr_still_water_ii: ja("dr_still_water_ii", "Still Water II", "W2", 20, {
    mp: 22,
    recastMs: 6_000,
    heal: 90,
    range: 12,
    allyTarget: true,
    form: 2,
    category: "deer",
  }),
  dr_antler_hum_ii: ja("dr_antler_hum_ii", "Antler Hum II", "H2", 30, {
    mp: 22,
    recastMs: 12_000,
    durationMs: 12_000,
    heal: 72,
    range: 12,
    allyTarget: true,
    form: 2,
    category: "deer",
  }),
  dr_still_water_iii: ja("dr_still_water_iii", "Still Water III", "W3", 40, {
    mp: 32,
    recastMs: 6_000,
    heal: 180,
    range: 12,
    allyTarget: true,
    form: 2,
    category: "deer",
  }),
  dr_pair_mend_ii: ja("dr_pair_mend_ii", "Pair Mend II", "P2", 50, {
    mp: 40,
    recastMs: 10_000,
    heal: 70,
    range: 12,
    form: 2,
    category: "deer",
  }),
  dr_mere_veil_ii: ja("dr_mere_veil_ii", "Mere Veil II", "V2", 55, {
    mp: 28,
    recastMs: 40_000,
    durationMs: 20_000,
    absorb: 60,
    range: 12,
    allyTarget: true,
    form: 2,
    category: "deer",
  }),
  dr_still_water_iv: ja("dr_still_water_iv", "Still Water IV", "W4", 65, {
    mp: 44,
    recastMs: 6_000,
    heal: 340,
    range: 12,
    allyTarget: true,
    form: 2,
    category: "deer",
  }),
  dr_heptad_hum: ja("dr_heptad_hum", "Heptad Hum", "Hh", 75, {
    mp: 48,
    recastMs: 8_000,
    durationMs: 8_000,
    heal: 80,
    aoe: 10,
    form: 2,
    category: "deer",
  }),
  dr_stick_rake: ja("dr_stick_rake", "Stick Rake", "Rk2", 18, {
    mp: 8,
    recastMs: 6_000,
    potency: 38,
    durationMs: 6_000,
    range: 3,
    needsTarget: true,
    form: 3,
    category: "lion",
  }),
  dr_mane_dust: ja("dr_mane_dust", "Mane Dust", "Md", 20, {
    mp: 12,
    recastMs: 20_000,
    durationMs: 8_000,
    form: 3,
    category: "lion",
  }),
  dr_stick_rake_ii: ja("dr_stick_rake_ii", "Stick Rake II", "R2", 32, {
    mp: 14,
    recastMs: 6_000,
    potency: 72,
    durationMs: 6_000,
    range: 3,
    needsTarget: true,
    form: 3,
    category: "lion",
  }),
  dr_stick_pounce: ja("dr_stick_pounce", "Stick Pounce", "Sp", 40, {
    recastMs: 15_000,
    potency: 40,
    durationMs: 1_500,
    range: 6,
    needsTarget: true,
    form: 3,
    category: "lion",
  }),
  dr_mane_dust_ii: ja("dr_mane_dust_ii", "Mane Dust II", "M3", 48, {
    mp: 16,
    recastMs: 20_000,
    durationMs: 8_000,
    form: 3,
    category: "lion",
  }),
  dr_stick_rake_iii: ja("dr_stick_rake_iii", "Stick Rake III", "R3", 58, {
    mp: 20,
    recastMs: 6_000,
    potency: 140,
    durationMs: 6_000,
    range: 3,
    needsTarget: true,
    form: 3,
    category: "lion",
  }),
  dr_long_pounce: ja("dr_long_pounce", "Long Pounce", "Lp", 68, {
    recastMs: 45_000,
    potency: 160,
    range: 6,
    needsTarget: true,
    form: 3,
    category: "lion",
  }),
  dr_mane_fury: ja("dr_mane_fury", "Mane Fury", "Mf", 75, {
    recastMs: 3 * 60_000,
    durationMs: 12_000,
    form: 3,
    category: "lion",
  }),
  dr_tail_dash: ja("dr_tail_dash", "Tail Dash", "Td", 15, {
    recastMs: 45_000,
    form: 4,
    category: "racerunner",
    range: 8,
  }),
  dr_ember_tail: ja("dr_ember_tail", "Ember Tail", "Et", 20, {
    recastMs: 60_000,
    durationMs: 8_000,
    form: 4,
    category: "racerunner",
    moveMul: 1.5,
  }),
  dr_tail_dash_ii: ja("dr_tail_dash_ii", "Tail Dash II", "T2", 40, {
    recastMs: 45_000,
    form: 4,
    category: "racerunner",
    range: 12,
  }),
  dr_long_run: ja("dr_long_run", "Long Run", "Lr", 55, {
    recastMs: 3 * 60_000,
    durationMs: 20_000,
    form: 4,
    category: "racerunner",
    moveMul: 1.55,
  }),
  dr_ember_run: ja("dr_ember_run", "Ember Run", "Er", 75, {
    recastMs: 10 * 60_000,
    durationMs: 12_000,
    form: 4,
    category: "racerunner",
    moveMul: 1.65,
  }),
};

export const DRUID_CATEGORY_TABS: { id: DruidAbilityCategory | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "shift", label: "Shift" },
  { id: "human", label: "Ring-Walker" },
  { id: "bear", label: "Stick Bear" },
  { id: "deer", label: "Stick Deer" },
  { id: "lion", label: "Stick Lion" },
  { id: "racerunner", label: "Racerunner" },
  { id: "utility", label: "Utility" },
];

export function isDruidAbilityId(id: string): id is DruidAbilityId {
  return Object.prototype.hasOwnProperty.call(DRUID_ABILITIES, id);
}

export function isDruidShiftId(id: string): boolean {
  return (DRUID_SHIFT_IDS as readonly string[]).includes(id);
}

export function druidAbilitiesUnlocked(
  level: number,
  learned: readonly string[] = [],
): DruidAbilityId[] {
  const learnedSet = new Set(learned);
  return DRUID_ABILITY_IDS.filter((id) => {
    if (DRUID_ABILITIES[id].unlockLevel > level) return false;
    if (isTrainerFreeAbility(id)) return true;
    return learnedSet.has(id);
  });
}

/** One JA per line, best-first. Other-form songs stay in the book. */
const FORM_LINES: Record<DruidForm, readonly (readonly DruidAbilityId[])[]> = {
  0: [
    ["dr_dustmend_ii", "dr_dustmend"],
    ["dr_sour_hum_ii", "dr_sour_hum"],
    ["dr_chalk_ward_ii", "dr_chalk_ward"],
    ["dr_hollow_listen"],
    ["dr_unstruck_echo"],
    ["dr_mirror_glaze"],
    ["dr_ring_split"],
    ["dr_ringwake"],
    ["dr_stickbear"],
    ["dr_stickdeer"],
    ["dr_racerunner"],
    ["dr_sticklion"],
    ["dr_ring_walk"],
  ],
  1: [
    ["dr_stick_clamour_ii", "dr_stick_clamour"],
    ["dr_ash_brace_ii", "dr_ash_brace"],
    ["dr_bracken_root"],
    ["dr_stick_maul_ii", "dr_stick_maul"],
    ["dr_bundle_thicken"],
    ["dr_kiln_shoulder"],
    ["dr_ring_of_stakes"],
    ["dr_ringwake"],
    ["dr_ring_walk"],
    ["dr_stickdeer"],
    ["dr_sticklion"],
    ["dr_racerunner"],
  ],
  2: [
    ["dr_still_water_iv", "dr_still_water_iii", "dr_still_water_ii", "dr_still_water"],
    ["dr_antler_hum_ii", "dr_antler_hum"],
    ["dr_mere_veil_ii", "dr_mere_veil"],
    ["dr_pair_mend_ii", "dr_pair_mend"],
    ["dr_heptad_hum"],
    ["dr_ringwake"],
    ["dr_ring_walk"],
    ["dr_stickbear"],
    ["dr_sticklion"],
    ["dr_racerunner"],
  ],
  3: [
    ["dr_stick_rake_iii", "dr_stick_rake_ii", "dr_stick_rake"],
    ["dr_mane_fury", "dr_mane_dust_ii", "dr_mane_dust"],
    ["dr_long_pounce", "dr_stick_pounce"],
    ["dr_ringwake"],
    ["dr_ring_walk"],
    ["dr_stickbear"],
    ["dr_stickdeer"],
    ["dr_racerunner"],
  ],
  4: [
    ["dr_tail_dash_ii", "dr_tail_dash"],
    ["dr_ember_run", "dr_long_run", "dr_ember_tail"],
    ["dr_ring_walk"],
    ["dr_stickbear"],
    ["dr_stickdeer"],
    ["dr_sticklion"],
  ],
};

export function druidHotbarOrder(
  unlocked: readonly DruidAbilityId[],
  form: DruidForm = 0,
): DruidAbilityId[] {
  return pickHotbarLines(unlocked, FORM_LINES[form] ?? FORM_LINES[0]);
}

export function druidFormHp(humanHp: number, form: DruidForm, knightHp: number): number {
  if (form === 1) return Math.min(Math.floor(humanHp * 1.28), knightHp - 4);
  if (form === 3) return Math.floor(humanHp * 0.9);
  if (form === 4) return Math.floor(humanHp * 0.75);
  return humanHp;
}

export function druidMoveMul(form: DruidForm, emberUntil: number, now: number, runMul = 1.5): number {
  if (form !== 4) return 1;
  if (now < emberUntil) return runMul;
  return 1.4;
}

export function isDruidForm(n: number): n is DruidForm {
  return n === 0 || n === 1 || n === 2 || n === 3 || n === 4;
}

export function druidAbilityTooltip(id: DruidAbilityId): { title: string; body: string; meta: string } {
  const def = DRUID_ABILITIES[id];
  const bits: string[] = [`Lv ${def.unlockLevel}`];
  if (def.mp > 0) bits.push(`MP ${def.mp}`);
  if (def.recastMs > 0) {
    const s = def.recastMs / 1000;
    bits.push(s >= 3600 ? `CD ${Math.round(s / 3600)}h` : s >= 60 ? `CD ${Math.round(s / 60)}m` : `CD ${s}s`);
  }
  if (def.durationMs) bits.push(`Dur ${def.durationMs / 1000}s`);
  if (def.heal) bits.push(`Heal ~${def.heal}`);
  if (def.potency) bits.push(`Potency ${def.potency}`);
  if (def.form != null) bits.push(`Need ${DRUID_FORM_LABEL[def.form]}`);
  if (def.shiftTo != null) bits.push(`Become ${DRUID_FORM_LABEL[def.shiftTo]}`);
  if (def.staffRequired) bits.push("Staff");
  return { title: def.label, body: DRUID_ABILITY_BLURBS[id], meta: bits.join(" · ") };
}

export function druidAbilityIconUrl(id: DruidAbilityId | string): string {
  return `/icons/abilities/${id}.png`;
}

export const DRUID_ABILITY_BLURBS: Record<DruidAbilityId, string> = {
  rest: "Sit and recover.",
  dr_ringwake: "Wake a sour chord. The next form sings a little louder.",
  dr_stickbear: "Borrow the bundled-stick bear.",
  dr_dustmend: "A weak chalk mend. Below a Time Mage's Cure.",
  dr_sour_hum: "The circle is out of tune. The foe misses more.",
  dr_stickdeer: "Borrow the antlered stick deer.",
  dr_chalk_ward: "A thin dust coat. Weaker than Protect.",
  dr_racerunner: "Borrow the bound-stick racerunner.",
  dr_ring_walk: "Return to the Ring-Walker.",
  dr_sticklion: "Borrow the mane of sticks.",
  dr_hollow_listen: "Dump a little hate. The circle is sour here.",
  dr_dustmend_ii: "A stronger chalk mend. Still below Cure II.",
  dr_sour_hum_ii: "A deeper sour. The foe misses more.",
  dr_chalk_ward_ii: "A thicker dust coat. Still weaker than Protect.",
  dr_ring_split: "The next shift does not share the family recast.",
  dr_unstruck_echo: "Catch the song in their throat.",
  dr_mirror_glaze: "A glazed self-shell. Worse than Oathbound.",
  dr_stick_clamour: "Rattle the bundle. Hate, not a Knight's Warhorn.",
  dr_ash_brace: "Brace the sticks. Self only.",
  dr_bracken_root: "Root the paws. Not Cover.",
  dr_stick_maul: "A cone of kindling.",
  dr_bundle_thicken: "Pack the hide. No magic ward.",
  dr_stick_clamour_ii: "Louder rattle. Still under Warhorn.",
  dr_ash_brace_ii: "A harder brace.",
  dr_stick_maul_ii: "A heavier cone.",
  dr_kiln_shoulder: "Shoulder the kiln-sticks. Still worse than Holdfast.",
  dr_ring_of_stakes: "A ring of hate. No party ward.",
  dr_still_water: "A still mend. Below Ashmend.",
  dr_antler_hum: "A short antler hum.",
  dr_mere_veil: "A tiny absorb veil.",
  dr_pair_mend: "Two lowest allies. Not Curaga.",
  dr_still_water_ii: "A deeper still mend.",
  dr_antler_hum_ii: "A longer hum.",
  dr_still_water_iii: "Still water, third pull.",
  dr_pair_mend_ii: "Two stronger mends.",
  dr_mere_veil_ii: "A thicker veil.",
  dr_still_water_iv: "Still below Ashmend IV.",
  dr_heptad_hum: "A short party hum. Not Curaga.",
  dr_stick_rake: "Splinter claws and dust-bleed.",
  dr_mane_dust: "The next rakes bite harder.",
  dr_stick_rake_ii: "Deeper splinters.",
  dr_stick_pounce: "A short stun pounce.",
  dr_mane_dust_ii: "A thicker mane of dust.",
  dr_stick_rake_iii: "Still under Ember Lance III.",
  dr_long_pounce: "Close the gap.",
  dr_mane_fury: "A short fury. Not Killing Storm.",
  dr_tail_dash: "A dash. Not a strike.",
  dr_ember_tail: "The tail-ember brightens. Faster, still no combat.",
  dr_tail_dash_ii: "A longer dash.",
  dr_long_run: "A long, quiet run.",
  dr_ember_run: "Breaks if anything looks at you.",
};
