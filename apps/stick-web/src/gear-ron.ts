/**
 * Stick Engine gear RON: the subset used by chest, hand, and shield files
 * (`id`, `slot`, `shapes` of Line / Capsule / Disc). The figure pose matches
 * the engine idle clip so shoulder discs and hand weapons land on the joints.
 */

export type Vec3 = { x: number; y: number; z: number };
export type Triple = [number, number, number];

export type GearShape = {
  kind: "Line" | "Capsule" | "Disc";
  from: Triple;
  to: Triple;
  center: Triple;
  /** Joint name when the disc is parented, e.g. `l_shoulder`. */
  at?: string;
  r: number;
  ramp: string;
  thick: number;
};

export type GearDef = {
  id: string;
  slot: string;
  stance?: string;
  attach: string;
  reach: number;
  swingWeight: number;
  material?: string;
  thicknessMul: Record<string, number>;
  shapes: GearShape[];
};

export class GearParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GearParseError";
  }
}

type Tok =
  | { k: "id" | "str"; v: string; line: number }
  | { k: "num"; v: number; line: number }
  | { k: "(" | ")" | "[" | "]" | "{" | "}" | ":" | ","; line: number };

const SLOT_ATTACH: Record<string, string> = {
  MainHand: "r_hand",
  OffHand: "l_hand",
  Head: "head",
  Legs: "pelvis",
  Feet: "pelvis",
  Chest: "chest",
};

export type PlateDef = {
  id: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  z: number;
  /** Upper-arm guard, as fractions of the shoulder-to-elbow bone. */
  armFrom: number;
  armTo: number;
  armThick: number;
  cuffFrom: number;
  cuffTo: number;
  cuffThick: number;
  /** How far the hem follows a foot. 0 keeps the shape still. */
  flow: number;
  /** Bell sleeves hang this far below the arm, in metres. */
  sleeveDrop: number;
  /** Skeleton v where a short mesh ends. 0 is a flat stamp. */
  wrap: number;
  rows: string[];
};

/** Front-face palette grid. Rows are top to bottom; '.' is empty. */
export function parsePlate(src: string): PlateDef {
  const p = new Parser(tokenize(src));
  const raw = p.parseValue();
  p.end();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new GearParseError("plate file must be a struct");
  }
  const o = raw as Record<string, unknown>;
  const id = str(o.id, "id");
  const num = (k: string) => {
    if (typeof o[k] !== "number") throw new GearParseError(`plate missing ${k}`);
    return o[k] as number;
  };
  if (!Array.isArray(o.rows) || o.rows.length === 0 || o.rows.some((r) => typeof r !== "string")) {
    throw new GearParseError("plate rows must be strings");
  }
  const rows = o.rows as string[];
  const w = rows[0]!.length;
  if (rows.some((r) => r.length !== w || /[^.grckbmdlhsei]/.test(r))) {
    throw new GearParseError("plate rows must be the same width and use . g r c k b m d l h s e i");
  }
  return {
    id, x0: num("x0"), y0: num("y0"), x1: num("x1"), y1: num("y1"), z: num("z"),
    armFrom: num("arm_from"), armTo: num("arm_to"), armThick: num("arm_thick"),
    cuffFrom: num("cuff_from"), cuffTo: num("cuff_to"), cuffThick: num("cuff_thick"),
    flow: typeof o.flow === "number" ? o.flow : 0,
    sleeveDrop: typeof o.sleeve_drop === "number" ? o.sleeve_drop : 0,
    wrap: typeof o.wrap === "number" ? o.wrap : 0,
    rows,
  };
}

export function parseGear(src: string): GearDef {
  const p = new Parser(tokenize(src));
  const raw = p.parseValue();
  p.end();
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || !("id" in raw)) {
    throw new GearParseError("gear file must be a struct with an id");
  }
  const o = raw as Record<string, unknown>;
  const id = str(o.id, "id");
  const slot = str(o.slot, "slot");
  const shapes = Array.isArray(o.shapes) ? o.shapes.map((s, i) => shape(s, i)) : [];
  const mul: Record<string, number> = {};
  if (o.thickness_mul && typeof o.thickness_mul === "object" && !Array.isArray(o.thickness_mul)) {
    for (const [k, v] of Object.entries(o.thickness_mul as Record<string, unknown>)) {
      if (k === "kind") continue;
      if (typeof v !== "number") throw new GearParseError(`thickness_mul.${k} must be a number`);
      mul[k] = v;
    }
  }
  return {
    id,
    slot,
    stance: typeof o.stance === "string" ? o.stance : undefined,
    attach: typeof o.attach === "string" ? o.attach : (SLOT_ATTACH[slot] ?? "chest"),
    reach: typeof o.reach === "number" ? o.reach : 0,
    swingWeight: typeof o.swing_weight === "number" ? o.swing_weight : 1,
    material: typeof o.material === "string" ? o.material : undefined,
    thicknessMul: mul,
    shapes,
  };
}

function shape(raw: unknown, i: number): GearShape {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new GearParseError(`shape ${i} is not a struct`);
  const o = raw as Record<string, unknown>;
  const kind = o.kind;
  if (kind !== "Line" && kind !== "Capsule" && kind !== "Disc") {
    throw new GearParseError(`shape ${i} has unknown kind ${String(kind)}`);
  }
  const ramp = typeof o.ramp === "string" ? o.ramp : "Material";
  const thick = typeof o.thick === "number" ? o.thick : 1;
  if (kind === "Disc") {
    return {
      kind,
      from: [0, 0, 0],
      to: [0, 0, 0],
      center: triple(o.center, [0, 0, 0]),
      at: typeof o.at === "string" ? o.at : undefined,
      r: typeof o.r === "number" ? o.r : 0,
      ramp,
      thick,
    };
  }
  return { kind, from: triple(o.from, [0, 0, 0]), to: triple(o.to, [0, 0, 0]), center: [0, 0, 0], r: 0, ramp, thick };
}

function triple(v: unknown, fallback: Triple): Triple {
  if (v == null) return fallback;
  if (!Array.isArray(v) || v.length !== 3 || v.some((n) => typeof n !== "number")) {
    throw new GearParseError("expected a 3-number tuple");
  }
  return [v[0] as number, v[1] as number, v[2] as number];
}

function str(v: unknown, label: string): string {
  if (typeof v !== "string" || !v) throw new GearParseError(`missing ${label}`);
  return v;
}

class Parser {
  i = 0;
  constructor(private toks: Tok[]) {}
  private peek(): Tok | undefined { return this.toks[this.i]; }
  private next(): Tok {
    const t = this.toks[this.i++];
    if (!t) throw new GearParseError("unexpected end of file");
    return t;
  }
  end(): void {
    if (this.peek()) throw new GearParseError(`unexpected ${label(this.peek()!)} on line ${this.peek()!.line}`);
  }
  parseValue(): unknown {
    const t = this.next();
    if (t.k === "num") return t.v;
    if (t.k === "str") return t.v;
    if (t.k === "id") {
      if (this.peek()?.k !== "(") return t.v;
      this.next();
      if (t.v === "Some") {
        const v = this.parseValue();
        this.close(")");
        return v;
      }
      if (t.v === "None") {
        this.close(")");
        return null;
      }
      const fields = this.fields(")");
      return { kind: t.v, ...fields };
    }
    if (t.k === "(") {
      if (this.peek()?.k === "id" && this.toks[this.i + 1]?.k === ":") return this.fields(")");
      const xs: unknown[] = [];
      while (this.peek() && this.peek()!.k !== ")") {
        xs.push(this.parseValue());
        if (this.peek()?.k === ",") this.next();
      }
      this.close(")");
      return xs;
    }
    if (t.k === "[") {
      const xs: unknown[] = [];
      while (this.peek() && this.peek()!.k !== "]") {
        xs.push(this.parseValue());
        if (this.peek()?.k === ",") this.next();
      }
      this.close("]");
      return xs;
    }
    if (t.k === "{") {
      const o: Record<string, unknown> = {};
      while (this.peek() && this.peek()!.k !== "}") {
        const key = this.next();
        if (key.k !== "str" && key.k !== "id") throw new GearParseError(`map key on line ${key.line}`);
        this.expect(":");
        o[key.v] = this.parseValue();
        if (this.peek()?.k === ",") this.next();
      }
      this.close("}");
      return o;
    }
    throw new GearParseError(`unexpected ${label(t)} on line ${t.line}`);
  }
  private fields(end: ")" | "}"): Record<string, unknown> {
    const o: Record<string, unknown> = {};
    while (this.peek() && this.peek()!.k !== end) {
      const key = this.next();
      if (key.k !== "id") throw new GearParseError(`expected a field name on line ${key.line}`);
      this.expect(":");
      o[key.v] = this.parseValue();
      if (this.peek()?.k === ",") this.next();
    }
    this.close(end);
    return o;
  }
  private close(k: Tok["k"]): void {
    const t = this.next();
    if (t.k !== k) throw new GearParseError(`expected ${k} on line ${t.line}`);
  }
  private expect(k: Tok["k"]): void { this.close(k); }
}

function label(t: Tok): string {
  if (t.k === "id" || t.k === "str") return t.v;
  if (t.k === "num") return String(t.v);
  return t.k;
}

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  let line = 1;
  type Punct = "(" | ")" | "[" | "]" | "{" | "}" | ":" | ",";
  const singles: Record<string, Punct> = { "(": "(", ")": ")", "[": "[", "]": "]", "{": "{", "}": "}", ":": ":", ",": "," };
  while (i < src.length) {
    const c = src[i]!;
    if (c === "\n") { line++; i++; continue; }
    if (c === " " || c === "\r" || c === "\t") { i++; continue; }
    if (c === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) {
        if (src[i] === "\n") line++;
        i++;
      }
      i += 2;
      continue;
    }
    const single = singles[c];
    if (single) { out.push({ k: single, line }); i++; continue; }
    if (c === '"') {
      i++;
      let s = "";
      while (i < src.length && src[i] !== '"') {
        if (src[i] === "\\") { i++; s += src[i] ?? ""; }
        else s += src[i];
        i++;
      }
      if (src[i] !== '"') throw new GearParseError(`unterminated string on line ${line}`);
      i++;
      out.push({ k: "str", v: s, line });
      continue;
    }
    if (c === "-" || c === "+" || (c >= "0" && c <= "9")) {
      const start = i;
      const startLine = line;
      if (c === "-" || c === "+") i++;
      let saw = false;
      while (i < src.length && src[i]! >= "0" && src[i]! <= "9") { saw = true; i++; }
      if (src[i] === ".") { i++; while (i < src.length && src[i]! >= "0" && src[i]! <= "9") { saw = true; i++; } }
      if (!saw) throw new GearParseError(`bad number on line ${startLine}`);
      out.push({ k: "num", v: Number(src.slice(start, i)), line: startLine });
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const start = i;
      const startLine = line;
      i++;
      while (i < src.length && /[A-Za-z0-9_]/.test(src[i]!)) i++;
      out.push({ k: "id", v: src.slice(start, i), line: startLine });
      continue;
    }
    throw new GearParseError(`unexpected '${c}' on line ${line}`);
  }
  return out;
}

const BODY = { thigh: 0.46, shin: 0.46, upperArm: 0.3, forearm: 0.28, torso: 0.52, neck: 0.08, headR: 0.13, shoulderW: 0.4, hipW: 0.22 };

/** Idle clip base plus the first key. Degrees, except `bob` which is metres. */
const IDLE: Record<string, number> = {
  l_hip: 6, l_knee: 8, r_hip: -6, r_knee: 6,
  l_shoulder: -8, l_elbow: 15, l_arm_out: 12,
  r_shoulder: 15, r_elbow: 30, r_arm_out: 14,
  r_wpn_yaw: 25, r_wpn_pitch: -55, twist: -10,
  bob: -0.02, lean: 4,
};

export type Figure = {
  joints: Record<string, Vec3>;
  wpnL: Vec3;
  wpnR: Vec3;
  right: Vec3;
};

const UP: Vec3 = { x: 0, y: 1, z: 0 };
export const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const mul = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
export const vlen = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
export const norm = (a: Vec3): Vec3 => { const l = vlen(a); return l > 1e-6 ? mul(a, 1 / l) : a; };

function basis(yaw: number): { f: Vec3; r: Vec3 } {
  return { f: { x: Math.sin(yaw), y: 0, z: Math.cos(yaw) }, r: { x: Math.cos(yaw), y: 0, z: -Math.sin(yaw) } };
}

/** Standing idle pose. `yaw` 0 faces +z, matching the game. */
export function solveIdle(yaw: number): Figure {
  return solveFigure(yaw, IDLE);
}

/**
 * One walk step. `phase` is 0..1. Hip swing matches the engine gait at a walk
 * (25°), so a robe hem can be checked against a real stride.
 */
export function solveWalk(yaw: number, phase: number): Figure {
  const ph = Math.PI * 2 * phase;
  const lHip = 25 * Math.sin(ph);
  const rHip = 25 * Math.sin(ph + Math.PI);
  const knee = (p: number) => 8 * Math.max(0, Math.cos(p + 0.6)) + 5;
  return solveFigure(yaw, {
    l_hip: lHip, r_hip: rHip,
    l_knee: knee(ph), r_knee: knee(ph + Math.PI),
    l_shoulder: -0.7 * lHip, r_shoulder: -0.7 * rHip,
    l_elbow: 15, r_elbow: 15,
    l_arm_out: 10, r_arm_out: 12,
    r_wpn_yaw: 20, r_wpn_pitch: -50,
    twist: 4 * Math.sin(ph),
    bob: 0.015 * Math.cos(2 * ph) - 0.02,
    lean: 2,
  });
}

function solveFigure(yaw: number, pose: Record<string, number>): Figure {
  const rad = (d: number) => (d * Math.PI) / 180;
  const ang = (k: string) => rad(pose[k] ?? 0);
  const { f, r } = basis(yaw);
  const joints: Record<string, Vec3> = {};
  const pelvis = { x: 0, y: BODY.thigh + BODY.shin - 0.02 + (pose.bob ?? 0), z: 0 };
  joints.pelvis = pelvis;
  const hang = (a: number, forward: Vec3) => add(mul(UP, -Math.cos(a)), mul(forward, Math.sin(a)));
  const legs: Array<[number, string, string, string, string, string]> = [
    [-1, "l_hip", "l_knee", "l_hip", "l_knee", "l_foot"],
    [1, "r_hip", "r_knee", "r_hip", "r_knee", "r_foot"],
  ];
  for (const [s, hc, kc, hj, kj, fj] of legs) {
    const a = ang(hc);
    const hip = add(pelvis, mul(r, s * BODY.hipW * 0.5));
    const knee = add(hip, mul(hang(a, f), BODY.thigh));
    joints[hj] = hip;
    joints[kj] = knee;
    joints[fj] = add(knee, mul(hang(a - ang(kc), f), BODY.shin));
  }
  const lean = ang("lean");
  const sdir = add(mul(UP, Math.cos(lean)), mul(f, Math.sin(lean)));
  const chest = add(pelvis, mul(sdir, BODY.torso));
  const neck = add(chest, mul(sdir, BODY.neck));
  const ha = lean * 0.5;
  const head = add(neck, mul(add(mul(UP, Math.cos(ha)), mul(f, Math.sin(ha))), BODY.headR));
  joints.chest = chest;
  joints.neck = neck;
  joints.head = head;
  const tw = yaw + ang("twist");
  const { f: f2, r: r2 } = basis(tw);
  const arms: Array<[number, number, string, string, string, string, string, string, string, string]> = [
    [0, -1, "l_shoulder", "l_elbow", "l_arm_out", "l_shoulder", "l_elbow", "l_hand", "l_wpn_yaw", "l_wpn_pitch"],
    [1, 1, "r_shoulder", "r_elbow", "r_arm_out", "r_shoulder", "r_elbow", "r_hand", "r_wpn_yaw", "r_wpn_pitch"],
  ];
  const wpn = [UP, UP];
  for (const [i, s, sh, el, out, sj, ej, hj, wy, wp] of arms) {
    const a = ang(sh);
    const o = ang(out);
    const arm = (aa: number) => add(mul(hang(aa, f2), Math.cos(o)), mul(r2, s * Math.sin(o)));
    const shoulder = add(add(chest, mul(sdir, -0.03)), mul(r2, s * BODY.shoulderW * 0.5));
    const elbow = add(shoulder, mul(arm(a), BODY.upperArm));
    joints[sj] = shoulder;
    joints[ej] = elbow;
    joints[hj] = add(elbow, mul(arm(a + ang(el)), BODY.forearm));
    const { f: fs } = basis(tw + ang(wy));
    const p = ang(wp);
    wpn[i] = add(mul(fs, Math.cos(p)), mul(UP, Math.sin(p)));
  }
  return { joints, wpnL: wpn[0]!, wpnR: wpn[1]!, right: r };
}

export type Frame = { o: Vec3; x: Vec3; y: Vec3; z: Vec3 };

export function gearFrame(gear: GearDef, fig: Figure): Frame {
  const o = fig.joints[gear.attach] ?? fig.joints.chest!;
  let y = norm(sub(fig.joints.chest!, fig.joints.pelvis!));
  if (gear.attach === "r_hand") y = norm(fig.wpnR);
  else if (gear.attach === "l_hand") y = norm(fig.wpnL);
  let x = norm(cross(y, UP));
  if (vlen(x) < 0.5) x = fig.right;
  const z = norm(cross(x, y));
  return { o, x, y, z };
}

export function toWorld(frame: Frame, p: Triple): Vec3 {
  return add(frame.o, add(mul(frame.x, p[0]), add(mul(frame.y, p[1]), mul(frame.z, p[2]))));
}

export const ISO_X = 32;
export const ISO_Y = 16;
export const HEIGHT_PX = 44;

export function projectIso(p: Vec3, w: number, h: number): { x: number; y: number; d: number } {
  const u = p.x - p.z;
  const vv = p.x + p.z;
  return { x: w * 0.5 + u * ISO_X, y: h * 0.55 + vv * ISO_Y - p.y * HEIGHT_PX, d: -(p.x + p.z) };
}

/** BA palette slots the gear files name. */
export const RAMP: Record<string, string> = {
  Material: "#9aa6b8",
  Trim: "#d9a441",
  Accent: "#b33939",
  Body: "#e8e2d0",
  Outline: "#0d0b14",
  Glow: "#5fc4e8",
  Hair: "#6c5a42",
};

export const BONES: Array<[string, string]> = [
  ["l_hip", "r_hip"], ["pelvis", "chest"], ["chest", "neck"], ["l_shoulder", "r_shoulder"],
  ["l_hip", "l_knee"], ["l_knee", "l_foot"], ["r_hip", "r_knee"], ["r_knee", "r_foot"],
  ["l_shoulder", "l_elbow"], ["l_elbow", "l_hand"], ["r_shoulder", "r_elbow"], ["r_elbow", "r_hand"],
];
