/**
 * Write gear RON the way the hand-made files read: a comment header, fixed
 * field order, one shape per block, and shape comments kept with their shape.
 * Output must load in `parseGear` / `parsePlate` here, in `GearDef::from_ron`,
 * and in the renderer's plate scanner (`figure.rs` `parse_plate`).
 */
import { parseGear, parsePlate, type GearShape, type PlateDef, type Triple } from "./gear-ron.ts";

export type DocShape = GearShape & { note: string[]; gap: boolean };

export type GearDoc = {
  header: string[];
  id: string;
  slot: string;
  attach: string;
  stance: string;
  reach: number;
  swingWeight: number;
  material: string;
  thicknessMul: Array<[string, number]>;
  shapes: DocShape[];
};

export type PlateDoc = Omit<PlateDef, "id"> & { header: string[] };

export type EditorDoc = { gear: GearDoc; plate: PlateDoc | null };

/** The editor writes `{ gear, plate, at }` RON text here; the viewer lists it as a draft. */
export const PREVIEW_KEY = "ba-gear-editor:preview";

export const SLOTS = ["Head", "Shoulders", "Chest", "Hands", "Legs", "Feet", "Back", "MainHand", "OffHand"];

export const JOINTS = [
  "pelvis", "chest", "neck", "head", "l_hip", "r_hip", "l_knee", "r_knee", "l_foot", "r_foot",
  "l_shoulder", "r_shoulder", "l_elbow", "r_elbow", "l_hand", "r_hand",
];

export const BONE_NAMES = [
  "hips", "spine", "neck", "shoulders", "head", "l_thigh", "r_thigh", "l_shin", "r_shin",
  "l_upper_arm", "r_upper_arm", "l_forearm", "r_forearm",
];

export const COLOR_SLOTS = ["Material", "Trim", "Accent", "Body", "BodyFar", "Outline", "Glow", "Hair"];

/** Stick Engine ramp names (`raster::RAMPS`). `material` must be one of these. */
export const RAMP_NAMES = [
  "void", "stone", "bone", "blood", "steel", "gold", "leather", "dust", "arcane", "white", "fire", "ice",
  "team_blue", "team_green", "hair_black", "hair_brown", "hair_blonde", "hair_red", "hair_grey",
];

export const STANCES = ["1h", "2h", "staff", "shield"];

/** Plate cells, in the order the renderer maps them. `.` leaves the gear underneath. */
export const PLATE_CELLS = ".grkcbmldhsei";

const PLATE_KEYS = [
  "x0", "y0", "x1", "y1", "z", "arm_from", "arm_to", "arm_thick", "cuff_from", "cuff_to", "cuff_thick",
  "flow", "sleeve_drop", "wrap",
];

export const SLOT_ATTACH: Record<string, string> = {
  MainHand: "r_hand",
  OffHand: "l_hand",
  Head: "head",
  Legs: "pelvis",
  Feet: "pelvis",
};

export const LICENSE = [
  "Copyright (c) 2026 Black Anvil Network",
  "SPDX-License-Identifier: AGPL-3.0-or-later",
  "Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.",
];

export function newGear(slot = "Chest"): GearDoc {
  return {
    header: [...LICENSE, "", "Describe the look and what each group of shapes is."],
    id: "ba_new_item",
    slot,
    attach: SLOT_ATTACH[slot] ?? "chest",
    stance: slot === "MainHand" ? "1h" : slot === "OffHand" ? "shield" : "",
    reach: 0,
    swingWeight: 1,
    material: "steel",
    thicknessMul: [],
    shapes: [],
  };
}

export function newPlate(x0 = -0.13, y0 = -0.38, x1 = 0.13, y1 = 0, z = 0.06, cols = 15, rows = 18): PlateDoc {
  return {
    header: [...LICENSE, "", "Front-face paint. Rows run from the top of the quad downward."],
    x0, y0, x1, y1, z,
    armFrom: 0, armTo: 0, armThick: 0, cuffFrom: 0, cuffTo: 0, cuffThick: 0,
    flow: 0, sleeveDrop: 0, wrap: 0,
    rows: Array.from({ length: rows }, () => ".".repeat(cols)),
  };
}

/** Always a decimal point, at most four places, no `-0`. */
export function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return "0.0";
  const r = Math.round(n * 10000) / 10000;
  if (r === 0) return "0.0";
  const s = String(r);
  return s.includes(".") ? s : `${s}.0`;
}

function fmtTriple(t: Triple): string {
  return `(${t.map(fmtNum).join(", ")})`;
}

function quote(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function comment(lines: string[], indent: string): string[] {
  return lines.map((l) => (l.trim() ? `${indent}// ${l.replace(/\r?\n/g, " ")}` : `${indent}//`));
}

function shapeLines(sh: DocShape): string[] {
  const pad = "        ";
  if (sh.kind === "Disc") {
    const where = sh.at ? `at: Some(${quote(sh.at)})` : `center: ${fmtTriple(sh.center)}`;
    return [`${pad}Disc(${where}, r: ${fmtNum(sh.r)}, ramp: ${sh.ramp}),`];
  }
  return [
    `${pad}${sh.kind}(`,
    `${pad}    from: ${fmtTriple(sh.from)},`,
    `${pad}    to: ${fmtTriple(sh.to)},`,
    `${pad}    ramp: ${sh.ramp},`,
    `${pad}    thick: ${fmtNum(sh.thick)},`,
    `${pad}),`,
  ];
}

/** Field order: id, slot, attach, stance, reach, swing_weight, material, thickness_mul, shapes. */
export function formatGear(g: GearDoc): string {
  const out = comment(g.header, "");
  out.push("(");
  out.push(`    id: ${quote(g.id)},`);
  out.push(`    slot: ${g.slot},`);
  out.push(`    attach: Some(${quote(g.attach)}),`);
  if (g.stance) out.push(`    stance: Some(${quote(g.stance)}),`);
  if (g.reach) out.push(`    reach: ${fmtNum(g.reach)},`);
  if (g.swingWeight !== 1) out.push(`    swing_weight: ${fmtNum(g.swingWeight)},`);
  if (g.material) out.push(`    material: Some(${quote(g.material)}),`);
  if (g.thicknessMul.length) {
    out.push("    thickness_mul: {");
    for (const [k, v] of g.thicknessMul) out.push(`        ${quote(k)}: ${fmtNum(v)},`);
    out.push("    },");
  }
  out.push("    shapes: [");
  g.shapes.forEach((sh, i) => {
    if (sh.gap && i > 0) out.push("");
    out.push(...comment(sh.note, "        "));
    out.push(...shapeLines(sh));
  });
  out.push("    ],");
  out.push(")");
  return `${out.join("\n")}\n`;
}

/**
 * The renderer scans plate files for `key:` and for quoted rows anywhere,
 * comments included. Comments lose quotes and any `key:` spelling.
 */
export function plateSafe(line: string): string {
  let s = line.replace(/"/g, "'");
  for (const k of PLATE_KEYS) s = s.split(`${k}:`).join(`${k} -`);
  return s;
}

export function formatPlate(id: string, p: PlateDoc): string {
  const out = comment(p.header.map(plateSafe), "");
  out.push("(");
  out.push(`    id: ${quote(id)},`);
  out.push(`    x0: ${fmtNum(p.x0)},`);
  out.push(`    y0: ${fmtNum(p.y0)},`);
  out.push(`    x1: ${fmtNum(p.x1)},`);
  out.push(`    y1: ${fmtNum(p.y1)},`);
  out.push(`    z: ${fmtNum(p.z)},`);
  out.push("    // Upper-arm guard, as fractions of the shoulder-to-elbow bone. 0 draws none.");
  out.push(`    arm_from: ${fmtNum(p.armFrom)},`);
  out.push(`    arm_to: ${fmtNum(p.armTo)},`);
  out.push(`    arm_thick: ${fmtNum(p.armThick)},`);
  out.push(`    cuff_from: ${fmtNum(p.cuffFrom)},`);
  out.push(`    cuff_to: ${fmtNum(p.cuffTo)},`);
  out.push(`    cuff_thick: ${fmtNum(p.cuffThick)},`);
  if (p.flow) out.push(`    flow: ${fmtNum(p.flow)},`);
  if (p.sleeveDrop) out.push(`    sleeve_drop: ${fmtNum(p.sleeveDrop)},`);
  if (p.wrap) out.push(`    wrap: ${fmtNum(p.wrap)},`);
  out.push("    rows: [");
  for (const r of p.rows) out.push(`        ${quote(r)},`);
  out.push("    ],");
  out.push(")");
  return `${out.join("\n")}\n`;
}

function leadingComments(src: string): string[] {
  const out: string[] = [];
  for (const raw of src.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("//")) out.push(line.replace(/^\/\/ ?/, ""));
    else if (line === "" && out.length) out.push("");
    else if (line === "") continue;
    else break;
  }
  while (out.length && out[out.length - 1] === "") out.pop();
  return out;
}

/** Comment lines and a blank-line gap before each shape, in file order. */
function shapeNotes(src: string): Array<{ note: string[]; gap: boolean }> {
  const lines = src.split(/\r?\n/);
  const start = lines.findIndex((l) => /^\s*shapes\s*:/.test(l));
  if (start < 0) return [];
  const out: Array<{ note: string[]; gap: boolean }> = [];
  let note: string[] = [];
  let gap = false;
  let depth = 0;
  for (let i = start + 1; i < lines.length; i++) {
    const t = lines[i]!.trim();
    if (depth === 0 && /^\]/.test(t)) break;
    if (depth === 0) {
      if (t === "") gap = out.length > 0;
      else if (t.startsWith("//")) note.push(t.replace(/^\/\/ ?/, ""));
      else if (/^(Capsule|Disc|Line)\s*\(/.test(t)) {
        out.push({ note, gap });
        note = [];
        gap = false;
      }
    }
    const code = t.replace(/\/\/.*$/, "");
    for (const c of code) {
      if (c === "(") depth++;
      else if (c === ")") depth--;
    }
    if (depth < 0) depth = 0;
  }
  return out;
}

export function gearDocFrom(src: string): GearDoc {
  const g = parseGear(src);
  const notes = shapeNotes(src);
  return {
    header: leadingComments(src),
    id: g.id,
    slot: g.slot,
    attach: g.attach,
    stance: g.stance ?? "",
    reach: g.reach,
    swingWeight: g.swingWeight,
    material: g.material ?? "",
    thicknessMul: Object.entries(g.thicknessMul),
    shapes: g.shapes.map((sh, i) => ({ ...sh, note: notes[i]?.note ?? [], gap: notes[i]?.gap ?? false })),
  };
}

export function plateDocFrom(src: string): { id: string; plate: PlateDoc } {
  const p = parsePlate(src);
  const { id, ...rest } = p;
  return { id, plate: { ...rest, header: leadingComments(src) } };
}

export type Check = { level: "ok" | "warn" | "error"; text: string };

/** What the viewer, the engine, and the renderer's plate scanner would say. */
export function checkDoc(doc: EditorDoc): Check[] {
  const out: Check[] = [];
  const g = doc.gear;
  const gearText = formatGear(g);
  try {
    parseGear(gearText);
    out.push({ level: "ok", text: `${g.id}.ron parses` });
  } catch (err) {
    out.push({ level: "error", text: `${g.id}.ron: ${err instanceof Error ? err.message : String(err)}` });
  }
  if (!/^[a-z][a-z0-9_]*$/.test(g.id)) out.push({ level: "warn", text: "id should be lower snake_case, e.g. ba_iron_greaves" });
  if (!SLOTS.includes(g.slot)) out.push({ level: "error", text: `slot ${g.slot} is not a GearSlot` });
  if (!JOINTS.includes(g.attach)) out.push({ level: "error", text: `attach ${g.attach} is not a joint` });
  if (g.material && !RAMP_NAMES.includes(g.material)) out.push({ level: "error", text: `material ${g.material} is not a ramp` });
  for (const [k] of g.thicknessMul) {
    if (!BONE_NAMES.includes(k)) out.push({ level: "error", text: `thickness_mul ${k} is not a bone` });
  }
  g.shapes.forEach((sh, i) => {
    if (!COLOR_SLOTS.includes(sh.ramp)) out.push({ level: "error", text: `shape ${i + 1}: ramp ${sh.ramp} is not a color slot` });
    if (sh.kind === "Disc") {
      if (sh.at && !JOINTS.includes(sh.at)) out.push({ level: "error", text: `shape ${i + 1}: joint ${sh.at} does not exist` });
      if (!(sh.r > 0)) out.push({ level: "warn", text: `shape ${i + 1}: disc radius is 0` });
    } else if (!(sh.thick > 0)) out.push({ level: "warn", text: `shape ${i + 1}: thick is 0` });
  });
  if (!g.shapes.length) out.push({ level: "warn", text: "no shapes yet" });
  const p = doc.plate;
  if (p) {
    try {
      parsePlate(formatPlate(g.id, p));
      out.push({ level: "ok", text: `${g.id}.plate.ron parses` });
    } catch (err) {
      out.push({ level: "error", text: `${g.id}.plate.ron: ${err instanceof Error ? err.message : String(err)}` });
    }
    if (new RegExp(`^[${PLATE_CELLS.replace(".", "\\.")}]+$`).test(g.id)) {
      out.push({ level: "error", text: "the id is made only of plate letters, so the game would read it as a row" });
    }
    if (p.rows.every((r) => /^\.+$/.test(r))) out.push({ level: "warn", text: "plate has no painted cells" });
    if (!(p.x1 > p.x0 && p.y1 > p.y0)) out.push({ level: "error", text: "plate quad needs x1 > x0 and y1 > y0" });
  }
  return out;
}
