import {
  BONES, HEIGHT_PX, add, dot, gearFrame, mul, projectIso, solveIdle, sub, toWorld,
  type Figure, type Frame, type GearDef, type Triple, type Vec3,
} from "./gear-ron.ts";
import {
  BONE_NAMES, COLOR_SLOTS, JOINTS, PLATE_CELLS, PREVIEW_KEY, RAMP_NAMES, SLOTS, SLOT_ATTACH, STANCES,
  checkDoc, formatGear, formatPlate, gearDocFrom, newGear, newPlate, plateDocFrom,
  type DocShape, type EditorDoc, type GearDoc, type PlateDoc,
} from "./gear-ron-write.ts";

type View = "front" | "side" | "figure";
type Tool = "select" | "Capsule" | "Line" | "Disc" | "joint" | "paint" | "rect";
type Pt = { x: number; y: number; d: number };
type Proj = { P: (w: Vec3) => Pt; mpx: number };
type Handle = { which: "from" | "to" | "center" | "radius"; x: number; y: number };

const DOC_KEY = "ba-gear-editor:doc";

const bundled = import.meta.glob(
  [
    "../../../engine/ba-stick-render/assets/gear/*.ron",
    "../../../engine/stick-engine/crates/stick_engine/assets/gear/*.ron",
  ],
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

/** Shade 3 of each Stick Engine ramp, the colour a lit gear face reads as. */
const RAMP_INK: Record<string, string> = {
  void: "#0d0b14", stone: "#34303f", bone: "#c9b98f", blood: "#b33939", steel: "#9aa6b8", gold: "#d9a441",
  leather: "#6c5a42", dust: "#7d7486", arcane: "#3a96bc", white: "#ffffff", fire: "#e0601a", ice: "#6ea2c8",
  team_blue: "#3a64b8", team_green: "#34864a", hair_black: "#282834", hair_brown: "#5a4228",
  hair_blonde: "#d8b45c", hair_red: "#ac4624", hair_grey: "#9e9ea6",
};

/** Default `RampMap`: the ramp each colour slot draws from when the item has no material. */
const SLOT_INK: Record<string, string> = {
  Material: "#9aa6b8", Trim: "#d9a441", Accent: "#b33939", Body: "#e8e2d0", BodyFar: "#c9b98f",
  Outline: "#0d0b14", Glow: "#5fc4e8", Hair: "#5a4228",
};

const PLATE_INK: Record<string, [number, number, number]> = {
  g: [0xd9, 0xa4, 0x41], r: [0xb3, 0x39, 0x39], k: [0x18, 0x16, 0x1f], c: [0x26, 0x4c, 0x62],
  b: [0x2c, 0x5d, 0x78], m: [0x33, 0x6a, 0x86], l: [0x7a, 0x52, 0x33], d: [0x55, 0x38, 0x23],
  h: [0xb5, 0x9a, 0x74], s: [0x8a, 0x73, 0x56], e: [0x9a, 0xa6, 0xb8], i: [0x4a, 0x44, 0x58],
  o: [0xb8, 0x92, 0x4a], w: [0xf4, 0xf7, 0xff], n: [0x5f, 0xc4, 0xe8],
};

const CELL_NAMES: Record<string, string> = {
  ".": "leave the gear (void/Outline underneath)", g: "gold", r: "red", k: "shadow / iron black", c: "deep blue", b: "blue", m: "light blue",
  l: "leather", d: "dark leather", h: "bone", s: "dark bone", e: "steel", i: "iron", o: "bronze",
  w: "white / mythril highlight", n: "mythril light blue",
};

const W = 960;
const H = 600;

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const canvas = $<HTMLCanvasElement>("#view");
const ctx = canvas.getContext("2d")!;
const hint = $<HTMLElement>("#hint");

let doc: EditorDoc = { gear: newGear("Chest"), plate: null };
let view: View = "front";
let tool: Tool = "select";
let selected = -1;
let paintCell = "g";
let yaw = 0.6;
let figZoom = 1;
let spaceHeld = false;
let altHeld = false;
let hoverJoint = "";
let textDirty = false;
const cams = { front: { u: 0, v: -0.15, s: 1100 }, side: { u: 0, v: -0.15, s: 1100 } };
const defaults = { ramp: "Material", thick: 2.5, r: 0.05, depthFront: 0.05, depthSide: 0, snap: 0.005, body: true };

const undoStack: string[] = [];
const redoStack: string[] = [];

function remember(): void {
  undoStack.push(JSON.stringify(doc));
  if (undoStack.length > 200) undoStack.shift();
  redoStack.length = 0;
}

function restore(from: string[], to: string[]): void {
  const s = from.pop();
  if (!s) return;
  to.push(JSON.stringify(doc));
  doc = JSON.parse(s) as EditorDoc;
  if (selected >= doc.gear.shapes.length) selected = -1;
  save();
  refreshAll();
}

let previewTimer = 0;
function save(): void {
  try {
    localStorage.setItem(DOC_KEY, JSON.stringify(doc));
  } catch {
    /* storage full or blocked: the editor still works */
  }
  clearTimeout(previewTimer);
  previewTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(PREVIEW_KEY, JSON.stringify({
        gear: formatGear(doc.gear),
        plate: doc.plate ? formatPlate(doc.gear.id, doc.plate) : "",
        at: Date.now(),
      }));
    } catch {
      /* the viewer just keeps the last draft */
    }
  }, 150);
}

function defOf(g: GearDoc): GearDef {
  return {
    id: g.id, slot: g.slot, stance: g.stance || undefined, attach: g.attach, reach: g.reach,
    swingWeight: g.swingWeight, material: g.material || undefined, thicknessMul: Object.fromEntries(g.thicknessMul),
    shapes: g.shapes,
  };
}

function scene(): { fig: Figure; frame: Frame } {
  const fig = solveIdle(view === "figure" ? yaw : 0);
  return { fig, frame: gearFrame(defOf(doc.gear), fig) };
}

function localOf(frame: Frame, p: Vec3): Triple {
  const d = sub(p, frame.o);
  return [dot(d, frame.x), dot(d, frame.y), dot(d, frame.z)];
}

const editView = () => (view === "side" ? cams.side : cams.front);
const uvOf = (t: Triple): [number, number] => (view === "side" ? [t[2], t[1]] : [t[0], t[1]]);
const depthOf = (t: Triple): number => (view === "side" ? t[0] : t[2]);
const withUv = (t: Triple, u: number, v: number): Triple => (view === "side" ? [t[0], v, u] : [u, v, t[2]]);

function toCanvas(u: number, v: number): { x: number; y: number } {
  const c = editView();
  return { x: W / 2 + (u - c.u) * c.s, y: H / 2 - (v - c.v) * c.s };
}

function fromCanvas(x: number, y: number): [number, number] {
  const c = editView();
  return [c.u + (x - W / 2) / c.s, c.v - (y - H / 2) / c.s];
}

function snapN(n: number): number {
  const step = altHeld ? 0 : defaults.snap;
  const v = step > 0 ? Math.round(n / step) * step : n;
  return Math.round(v * 10000) / 10000;
}

function depth(): number {
  return view === "side" ? defaults.depthSide : defaults.depthFront;
}

function placeAt(u: number, v: number): Triple {
  const d = depth();
  return view === "side" ? [d, snapN(v), snapN(u)] : [snapN(u), snapN(v), d];
}

function showBody(): boolean {
  return defaults.body && (view === "figure" || !doc.gear.attach.endsWith("_hand"));
}

function discWorld(sh: DocShape, fig: Figure, frame: Frame): Vec3 {
  return sh.at && fig.joints[sh.at] ? fig.joints[sh.at]! : toWorld(frame, sh.center);
}

function shapePoints(sh: DocShape, fig: Figure, frame: Frame): Vec3[] {
  return sh.kind === "Disc" ? [discWorld(sh, fig, frame)] : [toWorld(frame, sh.from), toWorld(frame, sh.to)];
}

function makeProj(fig: Figure, frame: Frame): Proj {
  if (view !== "figure") {
    return {
      P: (w) => {
        const t = localOf(frame, w);
        const [u, v] = uvOf(t);
        const c = toCanvas(u, v);
        return { x: c.x, y: c.y, d: depthOf(t) };
      },
      mpx: editView().s,
    };
  }
  const pts: Vec3[] = [...Object.values(fig.joints)];
  for (const sh of doc.gear.shapes) pts.push(...shapePoints(sh, fig, frame));
  const iso = pts.map((p) => projectIso(p, 640, 360));
  const minX = Math.min(...iso.map((p) => p.x));
  const maxX = Math.max(...iso.map((p) => p.x));
  const minY = Math.min(...iso.map((p) => p.y));
  const maxY = Math.max(...iso.map((p) => p.y));
  const fit = Math.min((W - 80) / Math.max(8, maxX - minX), (H - 80) / Math.max(8, maxY - minY)) * figZoom;
  const ox = W / 2 - ((minX + maxX) / 2) * fit;
  const oy = H / 2 - ((minY + maxY) / 2) * fit;
  return {
    P: (w) => {
      const s = projectIso(w, 640, 360);
      return { x: ox + s.x * fit, y: oy + s.y * fit, d: w.x + w.z };
    },
    mpx: HEIGHT_PX * fit,
  };
}

function ink(ramp: string): string {
  if (ramp === "Material" && doc.gear.material) return RAMP_INK[doc.gear.material] ?? SLOT_INK.Material!;
  return SLOT_INK[ramp] ?? SLOT_INK.Material!;
}

function strokeShape(pen: CanvasRenderingContext2D, sh: DocShape, color: string, proj: Proj, fig: Figure, frame: Frame): void {
  const gp = proj.mpx / HEIGHT_PX;
  pen.fillStyle = color;
  pen.strokeStyle = color;
  if (sh.kind === "Disc") {
    const c = proj.P(discWorld(sh, fig, frame));
    pen.beginPath();
    pen.arc(c.x, c.y, Math.max(1.5, sh.r * proj.mpx), 0, Math.PI * 2);
    pen.fill();
    return;
  }
  const a = proj.P(toWorld(frame, sh.from));
  const b = proj.P(toWorld(frame, sh.to));
  const width = Math.max(1, (sh.kind === "Capsule" ? sh.thick * 2 : sh.thick) * gp);
  if (Math.hypot(a.x - b.x, a.y - b.y) < 0.5) {
    pen.beginPath();
    pen.arc(a.x, a.y, width / 2, 0, Math.PI * 2);
    pen.fill();
    return;
  }
  pen.lineWidth = width;
  pen.beginPath();
  pen.moveTo(a.x, a.y);
  pen.lineTo(b.x, b.y);
  pen.stroke();
}

function shapeDepth(sh: DocShape, proj: Proj, fig: Figure, frame: Frame): number {
  const ds = shapePoints(sh, fig, frame).map((p) => proj.P(p).d);
  return ds.reduce((a, b) => a + b, 0) / ds.length;
}

const layer = document.createElement("canvas");
layer.width = W;
layer.height = H;
const edge = document.createElement("canvas");
edge.width = W;
edge.height = H;

/** One pixel of outline where empty space touches the gear, as the game draws it. */
function silhouette(src: HTMLCanvasElement): void {
  const d = src.getContext("2d")!.getImageData(0, 0, W, H).data;
  const ectx = edge.getContext("2d")!;
  const out = ectx.createImageData(W, H);
  const o = out.data;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && d[((y * W + x) << 2) + 3]! > 16;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (solid(x, y)) continue;
      if (!solid(x - 1, y) && !solid(x + 1, y) && !solid(x, y - 1) && !solid(x, y + 1)) continue;
      const i = (y * W + x) << 2;
      o[i] = 0x0d;
      o[i + 1] = 0x0b;
      o[i + 2] = 0x14;
      o[i + 3] = 255;
    }
  }
  ectx.putImageData(out, 0, 0);
  ctx.drawImage(edge, 0, 0);
}

/** Paint plate cells onto gear pixels the quad covers. `.` leaves the gear. */
function stampPlate(pen: CanvasRenderingContext2D, plate: PlateDoc, frame: Frame, proj: Proj): void {
  const corner = (x: number, y: number) => proj.P(toWorld(frame, [x, y, plate.z]));
  const tl = corner(plate.x0, plate.y1);
  const tr = corner(plate.x1, plate.y1);
  const br = corner(plate.x1, plate.y0);
  const bl = corner(plate.x0, plate.y0);
  const img = pen.getImageData(0, 0, W, H);
  const d = img.data;
  const cols = plate.rows[0]!.length;
  const rows = plate.rows.length;
  const tri = (a: Pt, b: Pt, c: Pt, ua: [number, number], ub: [number, number], uc: [number, number]) => {
    const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if (Math.abs(area) < 1e-4) return;
    const inv = 1 / area;
    const x0 = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x)));
    const x1 = Math.min(W - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
    const y0 = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y)));
    const y1 = Math.min(H - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const w0 = ((b.x - px) * (c.y - py) - (b.y - py) * (c.x - px)) * inv;
        const w1 = ((c.x - px) * (a.y - py) - (c.y - py) * (a.x - px)) * inv;
        const w2 = 1 - w0 - w1;
        if (w0 < -1e-3 || w1 < -1e-3 || w2 < -1e-3) continue;
        const i = (y * W + x) << 2;
        if (d[i + 3]! <= 16) continue;
        const u = Math.min(0.9999, Math.max(0, w0 * ua[0] + w1 * ub[0] + w2 * uc[0]));
        const v = Math.min(0.9999, Math.max(0, w0 * ua[1] + w1 * ub[1] + w2 * uc[1]));
        const rgb = PLATE_INK[plate.rows[(v * rows) | 0]![(u * cols) | 0]!];
        if (!rgb) continue;
        d[i] = rgb[0];
        d[i + 1] = rgb[1];
        d[i + 2] = rgb[2];
        d[i + 3] = 255;
      }
    }
  };
  tri(tl, tr, br, [0, 0], [1, 0], [1, 1]);
  tri(tl, br, bl, [0, 0], [1, 1], [0, 1]);
  pen.putImageData(img, 0, 0);
}

function drawGrid(): void {
  const c = editView();
  const [u0, v1] = fromCanvas(0, 0);
  const [u1, v0] = fromCanvas(W, H);
  const minor = c.s > 1600 ? 0.01 : c.s > 500 ? 0.05 : 0.1;
  const major = minor * (minor === 0.05 ? 2 : 5);
  ctx.lineWidth = 1;
  const lines = (step: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.beginPath();
    for (let u = Math.ceil(u0 / step) * step; u <= u1; u += step) {
      const x = Math.round(toCanvas(u, 0).x) + 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
    }
    for (let v = Math.ceil(v0 / step) * step; v <= v1; v += step) {
      const y = Math.round(toCanvas(0, v).y) + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();
  };
  lines(minor, "#27232f");
  lines(major, "#302b3a");
  const o = toCanvas(0, 0);
  ctx.strokeStyle = "#4a4458";
  ctx.beginPath();
  ctx.moveTo(Math.round(o.x) + 0.5, 0);
  ctx.lineTo(Math.round(o.x) + 0.5, H);
  ctx.moveTo(0, Math.round(o.y) + 0.5);
  ctx.lineTo(W, Math.round(o.y) + 0.5);
  ctx.stroke();
  ctx.fillStyle = "#5a5468";
  ctx.font = "10px ui-monospace, Consolas, monospace";
  for (let u = Math.ceil(u0 / major) * major; u <= u1; u += major) {
    if (Math.abs(u) < 1e-6) continue;
    ctx.fillText(u.toFixed(2), toCanvas(u, 0).x + 2, Math.min(H - 4, Math.max(10, o.y - 3)));
  }
  for (let v = Math.ceil(v0 / major) * major; v <= v1; v += major) {
    if (Math.abs(v) < 1e-6) continue;
    ctx.fillText(v.toFixed(2), Math.min(W - 34, Math.max(2, o.x + 3)), toCanvas(0, v).y - 2);
  }
}

function drawBody(fig: Figure, proj: Proj): void {
  const gp = proj.mpx / HEIGHT_PX;
  ctx.save();
  ctx.globalAlpha = view === "figure" ? 1 : 0.55;
  ctx.lineCap = "round";
  for (const [a, b] of BONES) {
    const pa = proj.P(fig.joints[a]!);
    const pb = proj.P(fig.joints[b]!);
    ctx.strokeStyle = "#0d0b14";
    ctx.lineWidth = 4.4 * gp + 2;
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
    ctx.strokeStyle = "#6a645c";
    ctx.lineWidth = 4.4 * gp;
    ctx.stroke();
  }
  const head = proj.P(fig.joints.head!);
  ctx.fillStyle = "#e8e2d0";
  ctx.beginPath();
  ctx.arc(head.x, head.y, 0.13 * proj.mpx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawJoints(fig: Figure, proj: Proj): void {
  ctx.font = "11px ui-monospace, Consolas, monospace";
  for (const name of JOINTS) {
    const p = proj.P(fig.joints[name]!);
    const hot = name === hoverJoint;
    ctx.fillStyle = hot ? "#d9a441" : "#c9b98f";
    ctx.beginPath();
    ctx.arc(p.x, p.y, hot ? 5 : 3, 0, Math.PI * 2);
    ctx.fill();
    if (hot || tool === "joint") {
      ctx.fillStyle = hot ? "#f4f7ff" : "#7d7486";
      ctx.fillText(name, p.x + 7, p.y - 6);
    }
  }
}

function plateCellRect(plate: PlateDoc, col: number, row: number): { x: number; y: number; w: number; h: number } {
  const cols = plate.rows[0]!.length;
  const rows = plate.rows.length;
  const cw = (plate.x1 - plate.x0) / cols;
  const ch = (plate.y1 - plate.y0) / rows;
  const a = toCanvas(plate.x0 + col * cw, plate.y1 - row * ch);
  const b = toCanvas(plate.x0 + (col + 1) * cw, plate.y1 - (row + 1) * ch);
  return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
}

function drawPlateGuide(plate: PlateDoc): void {
  const editing = tool === "paint" || tool === "rect";
  const cols = plate.rows[0]!.length;
  const rows = plate.rows.length;
  if (editing) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const rgb = PLATE_INK[plate.rows[r]![c]!];
        if (!rgb) continue;
        const q = plateCellRect(plate, c, r);
        ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
        ctx.fillRect(q.x, q.y, q.w, q.h);
      }
    }
    ctx.restore();
    ctx.strokeStyle = "rgba(244,247,255,0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 1; c < cols; c++) {
      const q = plateCellRect(plate, c, 0);
      ctx.moveTo(q.x, q.y);
      ctx.lineTo(q.x, plateCellRect(plate, c, rows - 1).y + q.h);
    }
    for (let r = 1; r < rows; r++) {
      const q = plateCellRect(plate, 0, r);
      ctx.moveTo(q.x, q.y);
      ctx.lineTo(plateCellRect(plate, cols - 1, r).x + q.w, q.y);
    }
    ctx.stroke();
  }
  const a = toCanvas(plate.x0, plate.y1);
  const b = toCanvas(plate.x1, plate.y0);
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = editing ? "#d9a441" : "rgba(217,164,65,0.35)";
  ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
  ctx.setLineDash([]);
}

function handles(fig: Figure, frame: Frame, proj: Proj): Handle[] {
  const sh = doc.gear.shapes[selected];
  if (!sh || view === "figure") return [];
  if (sh.kind === "Disc") {
    if (sh.at) return [];
    const c = proj.P(discWorld(sh, fig, frame));
    return [{ which: "center", x: c.x, y: c.y }, { which: "radius", x: c.x + sh.r * proj.mpx, y: c.y }];
  }
  const a = proj.P(toWorld(frame, sh.from));
  const b = proj.P(toWorld(frame, sh.to));
  return [{ which: "from", x: a.x, y: a.y }, { which: "to", x: b.x, y: b.y }];
}

function paint(): void {
  const { fig, frame } = scene();
  const proj = makeProj(fig, frame);
  ctx.fillStyle = "#221f2a";
  ctx.fillRect(0, 0, W, H);
  if (view !== "figure") drawGrid();
  if (showBody()) drawBody(fig, proj);
  else {
    const o = proj.P(frame.o);
    ctx.strokeStyle = "#6a645c";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(o.x - 12, o.y);
    ctx.lineTo(o.x + 12, o.y);
    ctx.moveTo(o.x, o.y - 16);
    ctx.lineTo(o.x, o.y + 10);
    ctx.stroke();
  }
  const pen = layer.getContext("2d")!;
  pen.clearRect(0, 0, W, H);
  pen.lineCap = "round";
  pen.lineJoin = "round";
  const order = doc.gear.shapes
    .map((sh, i) => ({ sh, i, d: shapeDepth(sh, proj, fig, frame) }))
    .sort((a, b) => a.d - b.d);
  for (const { sh } of order) strokeShape(pen, sh, ink(sh.ramp), proj, fig, frame);
  if (doc.plate) stampPlate(pen, doc.plate, frame, proj);
  silhouette(layer);
  ctx.drawImage(layer, 0, 0);
  if (doc.plate && view === "front") drawPlateGuide(doc.plate);
  const sel = doc.gear.shapes[selected];
  if (sel) {
    ctx.save();
    ctx.globalAlpha = 0.45;
    strokeShape(ctx, sel, "#f4f7ff", proj, fig, frame);
    ctx.restore();
    for (const h of handles(fig, frame, proj)) {
      ctx.fillStyle = h.which === "radius" ? "#5fc4e8" : "#d9a441";
      ctx.strokeStyle = "#0d0b14";
      ctx.fillRect(h.x - 4, h.y - 4, 8, 8);
      ctx.strokeRect(h.x - 4.5, h.y - 4.5, 9, 9);
    }
  }
  if (showBody() && (tool === "joint" || hoverJoint)) drawJoints(fig, proj);
  ctx.fillStyle = "#7d7486";
  ctx.font = "11px ui-monospace, Consolas, monospace";
  const label = view === "front"
    ? `front · ${doc.gear.attach} frame · x → right, y ↑, z toward you · depth z ${defaults.depthFront}`
    : view === "side"
      ? `side · ${doc.gear.attach} frame · z → right, y ↑ · depth x ${defaults.depthSide}`
      : "on figure · drag to turn · wheel to zoom";
  ctx.fillText(label, 10, 16);
}

function pointer(e: PointerEvent | WheelEvent): { x: number; y: number } {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * H) / r.height };
}

function hitShape(x: number, y: number): number {
  const { fig, frame } = scene();
  const proj = makeProj(fig, frame);
  const gp = proj.mpx / HEIGHT_PX;
  const order = doc.gear.shapes
    .map((sh, i) => ({ sh, i, d: shapeDepth(sh, proj, fig, frame) }))
    .sort((a, b) => b.d - a.d);
  for (const { sh, i } of order) {
    if (sh.kind === "Disc") {
      const c = proj.P(discWorld(sh, fig, frame));
      if (Math.hypot(x - c.x, y - c.y) <= Math.max(5, sh.r * proj.mpx) + 2) return i;
      continue;
    }
    const a = proj.P(toWorld(frame, sh.from));
    const b = proj.P(toWorld(frame, sh.to));
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2)) : 0;
    const dist = Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t));
    const half = (sh.kind === "Capsule" ? sh.thick : sh.thick * 0.5) * gp;
    if (dist <= Math.max(5, half) + 2) return i;
  }
  return -1;
}

function nearestJoint(x: number, y: number): string {
  if (!showBody()) return "";
  const { fig, frame } = scene();
  const proj = makeProj(fig, frame);
  let best = "";
  let bestD = 22;
  for (const name of JOINTS) {
    const p = proj.P(fig.joints[name]!);
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bestD) {
      bestD = d;
      best = name;
    }
  }
  return best;
}

function blankShape(kind: DocShape["kind"]): DocShape {
  return { kind, from: [0, 0, 0], to: [0, 0, 0], center: [0, 0, 0], r: defaults.r, ramp: defaults.ramp, thick: defaults.thick, note: [], gap: false };
}

/** Plate quad around the shapes in the front view, or the cuirass quad when there are none. */
function fittedPlate(): PlateDoc {
  const { fig, frame } = scene();
  const pts: Triple[] = [];
  for (const sh of doc.gear.shapes) {
    for (const p of shapePoints(sh, fig, frame)) pts.push(localOf(frame, p));
  }
  if (!pts.length) return newPlate();
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const pad = 0.04;
  const z = Math.max(...pts.map((p) => p[2])) + 0.01;
  const r = (n: number) => Math.round(n * 100) / 100;
  return newPlate(r(Math.min(...xs) - pad), r(Math.min(...ys) - pad), r(Math.max(...xs) + pad), r(Math.max(...ys) + pad), r(z));
}

function ensurePlate(): PlateDoc {
  if (!doc.plate) doc.plate = fittedPlate();
  return doc.plate;
}

function paintAt(u: number, v: number, cell: string): boolean {
  const p = doc.plate;
  if (!p) return false;
  const cols = p.rows[0]!.length;
  const rows = p.rows.length;
  const col = Math.floor(((u - p.x0) / (p.x1 - p.x0)) * cols);
  const row = Math.floor(((p.y1 - v) / (p.y1 - p.y0)) * rows);
  if (col < 0 || row < 0 || col >= cols || row >= rows) return false;
  return setCell(col, row, cell);
}

function setCell(col: number, row: number, cell: string): boolean {
  const p = doc.plate!;
  const line = p.rows[row]!;
  if (line[col] === cell) return false;
  p.rows[row] = line.slice(0, col) + cell + line.slice(col + 1);
  return true;
}

type Drag =
  | { kind: "pan"; x: number; y: number; u: number; v: number }
  | { kind: "turn"; x: number }
  | { kind: "handle"; which: Handle["which"] }
  | { kind: "move"; u: number; v: number; orig: DocShape }
  | { kind: "paint"; cell: string }
  | { kind: "rect"; u: number; v: number };
let drag: Drag | null = null;

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

canvas.addEventListener("pointerdown", (e) => {
  const { x, y } = pointer(e);
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch {
    /* pen and synthetic pointers may not be capturable */
  }
  if (textDirty) textDirty = false;
  if (view === "figure") {
    drag = { kind: "turn", x: e.clientX };
    return;
  }
  const c = editView();
  if (e.button === 1 || (e.button === 0 && spaceHeld) || (e.button === 2 && tool !== "paint")) {
    drag = { kind: "pan", x, y, u: c.u, v: c.v };
    return;
  }
  const [u, v] = fromCanvas(x, y);
  if (tool === "paint" || tool === "rect") {
    if (view !== "front") {
      hint.textContent = "Paint and the plate quad work in the front view. Press 1.";
      return;
    }
    remember();
    ensurePlate();
    if (tool === "rect") {
      drag = { kind: "rect", u: snapN(u), v: snapN(v) };
    } else {
      const cell = e.button === 2 ? "." : paintCell;
      paintAt(u, v, cell);
      drag = { kind: "paint", cell };
    }
    refreshLight();
    return;
  }
  if (tool === "joint") {
    const j = nearestJoint(x, y);
    if (!j) {
      hint.textContent = "Click a joint dot.";
      return;
    }
    remember();
    const sh = blankShape("Disc");
    sh.at = j;
    doc.gear.shapes.push(sh);
    selected = doc.gear.shapes.length - 1;
    refreshAll();
    save();
    return;
  }
  if (tool === "Capsule" || tool === "Line") {
    remember();
    const sh = blankShape(tool);
    sh.from = placeAt(u, v);
    sh.to = [...sh.from];
    doc.gear.shapes.push(sh);
    selected = doc.gear.shapes.length - 1;
    drag = { kind: "handle", which: "to" };
    paint();
    return;
  }
  if (tool === "Disc") {
    remember();
    const sh = blankShape("Disc");
    sh.center = placeAt(u, v);
    doc.gear.shapes.push(sh);
    selected = doc.gear.shapes.length - 1;
    drag = { kind: "handle", which: "radius" };
    paint();
    return;
  }
  const { fig, frame } = scene();
  const hit = handles(fig, frame, makeProj(fig, frame)).find((h) => Math.abs(h.x - x) <= 6 && Math.abs(h.y - y) <= 6);
  if (hit) {
    remember();
    drag = { kind: "handle", which: hit.which };
    return;
  }
  const i = hitShape(x, y);
  selected = i;
  if (i >= 0 && !(doc.gear.shapes[i]!.kind === "Disc" && doc.gear.shapes[i]!.at)) {
    remember();
    drag = { kind: "move", u, v, orig: structuredClone(doc.gear.shapes[i]!) };
  }
  refreshAll();
});

canvas.addEventListener("pointermove", (e) => {
  const { x, y } = pointer(e);
  if (view !== "figure") {
    const [u, v] = fromCanvas(x, y);
    const a = view === "side" ? "z" : "x";
    hint.textContent = `${a} ${u.toFixed(3)}  y ${v.toFixed(3)} · ${toolHint}`;
    const j = tool === "joint" || tool === "select" ? nearestJoint(x, y) : "";
    if (j !== hoverJoint) {
      hoverJoint = j;
      if (!drag) paint();
    }
  }
  if (!drag) return;
  if (drag.kind === "turn") {
    yaw += (e.clientX - drag.x) * 0.012;
    drag.x = e.clientX;
    paint();
    return;
  }
  const c = editView();
  if (drag.kind === "pan") {
    c.u = drag.u - (x - drag.x) / c.s;
    c.v = drag.v + (y - drag.y) / c.s;
    paint();
    return;
  }
  const [u, v] = fromCanvas(x, y);
  if (drag.kind === "paint") {
    if (paintAt(u, v, drag.cell)) refreshLight();
    return;
  }
  if (drag.kind === "rect") {
    const p = doc.plate!;
    const a = [drag.u, snapN(u)].sort((m, n) => m - n);
    const b = [drag.v, snapN(v)].sort((m, n) => m - n);
    if (a[1]! - a[0]! > 0.005 && b[1]! - b[0]! > 0.005) {
      p.x0 = a[0]!;
      p.x1 = a[1]!;
      p.y0 = b[0]!;
      p.y1 = b[1]!;
    }
    paint();
    return;
  }
  const sh = doc.gear.shapes[selected];
  if (!sh) return;
  if (drag.kind === "handle") {
    if (drag.which === "from") sh.from = withUv(sh.from, snapN(u), snapN(v));
    else if (drag.which === "to") sh.to = withUv(sh.to, snapN(u), snapN(v));
    else if (drag.which === "center") sh.center = withUv(sh.center, snapN(u), snapN(v));
    else {
      const [cu, cv] = uvOf(sh.center);
      const r = snapN(Math.hypot(u - cu, v - cv));
      if (r >= 0.005) sh.r = r;
    }
    refreshLight();
    return;
  }
  if (drag.kind === "move") {
    const du = snapN(u - drag.u);
    const dv = snapN(v - drag.v);
    const shift = (t: Triple): Triple => {
      const [tu, tv] = uvOf(t);
      return withUv(t, Math.round((tu + du) * 10000) / 10000, Math.round((tv + dv) * 10000) / 10000);
    };
    if (sh.kind === "Disc") sh.center = shift(drag.orig.center);
    else {
      sh.from = shift(drag.orig.from);
      sh.to = shift(drag.orig.to);
    }
    refreshLight();
  }
});

function endDrag(): void {
  if (!drag) return;
  const sh = doc.gear.shapes[selected];
  if (drag.kind === "handle" && sh?.kind === "Line" && sh.from.every((n, i) => n === sh.to[i])) {
    doc.gear.shapes.splice(selected, 1);
    selected = -1;
  }
  const changed = drag.kind !== "pan" && drag.kind !== "turn";
  drag = null;
  if (changed) {
    save();
    refreshAll();
  }
}
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);
canvas.addEventListener("pointerleave", () => {
  if (hoverJoint) {
    hoverJoint = "";
    paint();
  }
});

canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  const k = e.deltaY > 0 ? 1 / 1.15 : 1.15;
  if (view === "figure") {
    figZoom = Math.max(0.3, Math.min(6, figZoom * k));
    paint();
    return;
  }
  const { x, y } = pointer(e);
  const [u, v] = fromCanvas(x, y);
  const c = editView();
  c.s = Math.max(80, Math.min(12000, c.s * k));
  c.u = u - (x - W / 2) / c.s;
  c.v = v + (y - H / 2) / c.s;
  paint();
}, { passive: false });

function fit(): void {
  if (view === "figure") {
    figZoom = 1;
    paint();
    return;
  }
  const { fig, frame } = scene();
  const uvs: Array<[number, number]> = [[0, 0]];
  const edges = (t: Triple, pad: number) => {
    const [u, v] = uvOf(t);
    uvs.push([u - pad, v - pad], [u + pad, v + pad]);
  };
  for (const sh of doc.gear.shapes) {
    if (sh.kind === "Disc") edges(localOf(frame, discWorld(sh, fig, frame)), sh.r);
    else {
      edges(sh.from, sh.thick / HEIGHT_PX);
      edges(sh.to, sh.thick / HEIGHT_PX);
    }
  }
  const p = doc.plate;
  if (p && view === "front") uvs.push([p.x0, p.y0], [p.x1, p.y1]);
  if (uvs.length < 3) {
    if (showBody()) {
      for (const j of Object.values(fig.joints)) {
        const t = localOf(frame, j);
        if (Math.hypot(t[0], t[1], t[2]) < 0.55) edges(t, 0);
      }
    }
    uvs.push([-0.3, -0.3], [0.3, 0.3]);
  }
  const us = uvs.map((q) => q[0]);
  const vs = uvs.map((q) => q[1]);
  const minU = Math.min(...us);
  const maxU = Math.max(...us);
  const minV = Math.min(...vs);
  const maxV = Math.max(...vs);
  const c = editView();
  c.s = Math.max(80, Math.min(6000, Math.min((W * 0.8) / Math.max(0.05, maxU - minU), (H * 0.8) / Math.max(0.05, maxV - minV))));
  c.u = (minU + maxU) / 2;
  c.v = (minV + maxV) / 2;
  paint();
}

// --- panels ------------------------------------------------------------------

function option(sel: HTMLSelectElement, value: string, label = value): void {
  const o = document.createElement("option");
  o.value = value;
  o.textContent = label;
  sel.append(o);
}

for (const s of SLOTS) {
  option($<HTMLSelectElement>("#f-slot"), s);
  option($<HTMLSelectElement>("#slot-new"), s);
}
$<HTMLSelectElement>("#slot-new").value = "Chest";
for (const j of JOINTS) option($<HTMLSelectElement>("#f-attach"), j);
option($<HTMLSelectElement>("#f-material"), "", "(none)");
for (const r of RAMP_NAMES) option($<HTMLSelectElement>("#f-material"), r);
for (const r of COLOR_SLOTS) option($<HTMLSelectElement>("#d-ramp"), r);
for (const s of STANCES) {
  const o = document.createElement("option");
  o.value = s;
  $<HTMLDataListElement>("#stances").append(o);
}

/** Text fields: one undo step per focus, live while typing. */
function bindField(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, apply: (value: string) => void, rebuild = false): void {
  let fresh = true;
  el.addEventListener("focus", () => (fresh = true));
  el.addEventListener(el instanceof HTMLSelectElement ? "change" : "input", () => {
    if (fresh) {
      remember();
      fresh = el instanceof HTMLSelectElement;
    }
    apply(el.value);
    save();
    if (rebuild) refreshAll();
    else refreshLight();
  });
}

const num = (s: string, fallback = 0) => (Number.isFinite(Number(s)) && s.trim() !== "" ? Number(s) : fallback);

bindField($("#f-id"), (v) => (doc.gear.id = v.trim()));
bindField($("#f-slot"), (v) => {
  doc.gear.slot = v;
  doc.gear.attach = SLOT_ATTACH[v] ?? "chest";
}, true);
bindField($("#f-attach"), (v) => (doc.gear.attach = v), true);
bindField($("#f-stance"), (v) => (doc.gear.stance = v.trim()));
bindField($("#f-reach"), (v) => (doc.gear.reach = num(v)));
bindField($("#f-swing"), (v) => (doc.gear.swingWeight = num(v, 1)));
bindField($("#f-material"), (v) => (doc.gear.material = v));
bindField($("#f-header"), (v) => (doc.gear.header = v.split("\n")));

const plateNums: Array<[string, keyof PlateDoc]> = [
  ["x0", "x0"], ["x1", "x1"], ["y0", "y0"], ["y1", "y1"], ["z", "z"],
  ["armFrom", "armFrom"], ["armTo", "armTo"], ["armThick", "armThick"],
  ["cuffFrom", "cuffFrom"], ["cuffTo", "cuffTo"], ["cuffThick", "cuffThick"],
  ["flow", "flow"], ["sleeveDrop", "sleeveDrop"], ["wrap", "wrap"],
];
for (const [id, key] of plateNums) {
  bindField($(`#p-${id}`), (v) => {
    if (doc.plate) (doc.plate[key] as number) = num(v);
  });
}
bindField($("#p-header"), (v) => {
  if (doc.plate) doc.plate.header = v.split("\n");
});

function resizePlate(cols: number, rows: number): void {
  const p = doc.plate;
  if (!p) return;
  const c = Math.max(1, Math.min(64, Math.round(cols)));
  const r = Math.max(1, Math.min(64, Math.round(rows)));
  p.rows = Array.from({ length: r }, (_, i) => (p.rows[i] ?? "").padEnd(c, ".").slice(0, c));
}
bindField($("#p-cols"), (v) => resizePlate(num(v, 15), doc.plate?.rows.length ?? 18), true);
bindField($("#p-rows"), (v) => resizePlate(doc.plate?.rows[0]?.length ?? 15, num(v, 18)), true);

$<HTMLInputElement>("#p-on").addEventListener("change", (e) => {
  remember();
  doc.plate = (e.target as HTMLInputElement).checked ? fittedPlate() : null;
  save();
  refreshAll();
});

$<HTMLButtonElement>("#mul-add").addEventListener("click", () => {
  const used = new Set(doc.gear.thicknessMul.map(([k]) => k));
  const next = BONE_NAMES.find((b) => !used.has(b));
  if (!next) return;
  remember();
  doc.gear.thicknessMul.push([next, 1.2]);
  save();
  refreshAll();
});

function renderMul(): void {
  const box = $<HTMLElement>("#mul");
  box.replaceChildren();
  doc.gear.thicknessMul.forEach(([bone, value], i) => {
    const row = document.createElement("div");
    row.className = "mtable";
    const sel = document.createElement("select");
    for (const b of BONE_NAMES) option(sel, b);
    sel.value = bone;
    const val = document.createElement("input");
    val.type = "number";
    val.step = "0.02";
    val.value = String(value);
    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "×";
    bindField(sel, (v) => (doc.gear.thicknessMul[i]![0] = v));
    bindField(val, (v) => (doc.gear.thicknessMul[i]![1] = num(v, 1)));
    del.addEventListener("click", () => {
      remember();
      doc.gear.thicknessMul.splice(i, 1);
      save();
      refreshAll();
    });
    row.append(sel, val, del);
    box.append(row);
  });
  if (!doc.gear.thicknessMul.length) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "Widens a body bone under the gear, e.g. spine ×1.7 for a breastplate.";
    box.append(p);
  }
}

function syncForm(): void {
  const g = doc.gear;
  $<HTMLInputElement>("#f-id").value = g.id;
  $<HTMLSelectElement>("#f-slot").value = g.slot;
  $<HTMLSelectElement>("#f-attach").value = g.attach;
  $<HTMLInputElement>("#f-stance").value = g.stance;
  $<HTMLInputElement>("#f-reach").value = String(g.reach);
  $<HTMLInputElement>("#f-swing").value = String(g.swingWeight);
  $<HTMLSelectElement>("#f-material").value = g.material;
  $<HTMLTextAreaElement>("#f-header").value = g.header.join("\n");
  const p = doc.plate;
  $<HTMLInputElement>("#p-on").checked = !!p;
  $<HTMLElement>("#plate-fields").style.display = p ? "" : "none";
  if (p) {
    for (const [id, key] of plateNums) $<HTMLInputElement>(`#p-${id}`).value = String(p[key]);
    $<HTMLInputElement>("#p-cols").value = String(p.rows[0]!.length);
    $<HTMLInputElement>("#p-rows").value = String(p.rows.length);
    $<HTMLTextAreaElement>("#p-header").value = p.header.join("\n");
  }
  $<HTMLSelectElement>("#d-ramp").value = defaults.ramp;
  $<HTMLInputElement>("#d-thick").value = String(defaults.thick);
  $<HTMLInputElement>("#d-r").value = String(defaults.r);
  $<HTMLInputElement>("#d-depth").value = String(depth());
  $<HTMLSelectElement>("#d-snap").value = String(defaults.snap);
  renderMul();
}

$<HTMLSelectElement>("#d-ramp").addEventListener("change", (e) => (defaults.ramp = (e.target as HTMLSelectElement).value));
$<HTMLInputElement>("#d-thick").addEventListener("input", (e) => (defaults.thick = num((e.target as HTMLInputElement).value, 2.5)));
$<HTMLInputElement>("#d-r").addEventListener("input", (e) => (defaults.r = num((e.target as HTMLInputElement).value, 0.05)));
$<HTMLInputElement>("#d-depth").addEventListener("input", (e) => {
  const v = num((e.target as HTMLInputElement).value);
  if (view === "side") defaults.depthSide = v;
  else defaults.depthFront = v;
  paint();
});
$<HTMLSelectElement>("#d-snap").addEventListener("change", (e) => (defaults.snap = num((e.target as HTMLSelectElement).value)));
$<HTMLInputElement>("#d-body").addEventListener("change", (e) => {
  defaults.body = (e.target as HTMLInputElement).checked;
  paint();
});

function shapeLabel(sh: DocShape, i: number): string {
  const size = sh.kind === "Disc" ? `r ${sh.r}` : `thick ${sh.thick}`;
  const where = sh.kind === "Disc" && sh.at ? ` @ ${sh.at}` : "";
  return `${i + 1}. ${sh.kind} ${sh.ramp} ${size}${where}`;
}

function renderShapes(): void {
  const ul = $<HTMLUListElement>("#shapes");
  ul.replaceChildren();
  $<HTMLElement>("#count").textContent = `(${doc.gear.shapes.length})`;
  doc.gear.shapes.forEach((sh, i) => {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.className = i === selected ? "on" : "";
    b.textContent = shapeLabel(sh, i);
    if (sh.note[0]) {
      const small = document.createElement("small");
      small.textContent = ` ${sh.note[0]}`;
      b.append(small);
    }
    b.addEventListener("click", () => {
      selected = selected === i ? -1 : i;
      refreshAll();
    });
    li.append(b);
    ul.append(li);
  });
}

function xyzRow(label: string, value: Triple, apply: (t: Triple) => void): HTMLElement {
  const row = document.createElement("div");
  row.className = "xyz";
  const span = document.createElement("span");
  span.textContent = label;
  row.append(span);
  value.forEach((n, k) => {
    const input = document.createElement("input");
    input.type = "number";
    input.step = "0.005";
    input.value = String(n);
    input.title = "xyz"[k]!;
    bindField(input, (v) => {
      const t: Triple = [...value];
      t[k] = num(v);
      value = t;
      apply(t);
    });
    row.append(input);
  });
  return row;
}

function labelled(text: string, el: HTMLElement): HTMLElement {
  const l = document.createElement("label");
  l.append(text, el);
  return l;
}

function renderInspector(): void {
  const box = $<HTMLElement>("#inspector");
  box.replaceChildren();
  const sh = doc.gear.shapes[selected];
  if (!sh) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "Select a shape to edit its numbers, comment, and colour slot.";
    box.append(p);
    return;
  }
  const kind = document.createElement("select");
  for (const k of ["Capsule", "Line", "Disc"]) option(kind, k);
  kind.value = sh.kind;
  bindField(kind, (v) => {
    const next = v as DocShape["kind"];
    if (next === "Disc" && sh.kind !== "Disc") {
      sh.center = sh.from.map((n, i) => Math.round(((n + sh.to[i]!) / 2) * 10000) / 10000) as Triple;
      sh.r = sh.r || defaults.r;
    } else if (next !== "Disc" && sh.kind === "Disc") {
      sh.from = [...sh.center];
      sh.to = [sh.center[0], Math.round((sh.center[1] - 0.1) * 10000) / 10000, sh.center[2]];
      sh.at = undefined;
    }
    sh.kind = next;
  }, true);
  box.append(labelled("kind", kind));
  const ramp = document.createElement("select");
  for (const r of COLOR_SLOTS) option(ramp, r);
  ramp.value = sh.ramp;
  bindField(ramp, (v) => (sh.ramp = v));
  box.append(labelled("ramp", ramp));
  const size = document.createElement("input");
  size.type = "number";
  size.step = sh.kind === "Disc" ? "0.005" : "0.1";
  size.value = String(sh.kind === "Disc" ? sh.r : sh.thick);
  bindField(size, (v) => {
    if (sh.kind === "Disc") sh.r = num(v);
    else sh.thick = num(v, 1);
  });
  box.append(labelled(sh.kind === "Disc" ? "r (m)" : "thick (px)", size));
  if (sh.kind === "Disc") {
    const at = document.createElement("select");
    option(at, "", "(center)");
    for (const j of JOINTS) option(at, j);
    at.value = sh.at ?? "";
    bindField(at, (v) => {
      if (!v && sh.at) {
        const { fig, frame } = scene();
        sh.center = localOf(frame, fig.joints[sh.at]!).map((n) => Math.round(n * 10000) / 10000) as Triple;
      }
      sh.at = v || undefined;
    }, true);
    box.append(labelled("on joint", at));
    if (!sh.at) box.append(xyzRow("center", sh.center, (t) => (sh.center = t)));
  } else {
    box.append(xyzRow("from", sh.from, (t) => (sh.from = t)));
    box.append(xyzRow("to", sh.to, (t) => (sh.to = t)));
  }
  const note = document.createElement("textarea");
  note.rows = 2;
  note.placeholder = "comment above this shape";
  note.value = sh.note.join("\n");
  bindField(note, (v) => (sh.note = v.trim() ? v.split("\n") : []));
  const noteLabel = labelled("comment", note);
  noteLabel.style.gridTemplateColumns = "1fr";
  box.append(noteLabel);
  const gap = document.createElement("input");
  gap.type = "checkbox";
  gap.checked = sh.gap;
  gap.addEventListener("change", () => {
    remember();
    sh.gap = gap.checked;
    save();
    refreshLight();
  });
  const gapLabel = document.createElement("label");
  gapLabel.className = "row";
  gapLabel.append(gap, " blank line before");
  box.append(gapLabel);
  const btns = document.createElement("div");
  btns.className = "btns";
  const act = (text: string, title: string, fn: () => void) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    b.title = title;
    b.addEventListener("click", fn);
    btns.append(b);
  };
  act("Duplicate", "Ctrl+D", duplicate);
  act("Mirror x", "M: copy to the other side", mirror);
  act("Up", "Draw earlier", () => moveShape(-1));
  act("Down", "Draw later", () => moveShape(1));
  act("Delete", "Del", removeShape);
  box.append(btns);
}

function duplicate(): void {
  const sh = doc.gear.shapes[selected];
  if (!sh) return;
  remember();
  doc.gear.shapes.splice(selected + 1, 0, { ...structuredClone(sh), note: [], gap: false });
  selected++;
  save();
  refreshAll();
}

function mirror(): void {
  const sh = doc.gear.shapes[selected];
  if (!sh) return;
  remember();
  const flip = (t: Triple): Triple => [t[0] === 0 ? 0 : -t[0], t[1], t[2]];
  const other = (j?: string) => (j?.startsWith("l_") ? `r_${j.slice(2)}` : j?.startsWith("r_") ? `l_${j.slice(2)}` : j);
  const copy: DocShape = { ...structuredClone(sh), from: flip(sh.from), to: flip(sh.to), center: flip(sh.center), at: other(sh.at), note: [], gap: false };
  doc.gear.shapes.splice(selected + 1, 0, copy);
  selected++;
  save();
  refreshAll();
}

function moveShape(by: number): void {
  const to = selected + by;
  if (selected < 0 || to < 0 || to >= doc.gear.shapes.length) return;
  remember();
  const [sh] = doc.gear.shapes.splice(selected, 1);
  doc.gear.shapes.splice(to, 0, sh!);
  selected = to;
  save();
  refreshAll();
}

function removeShape(): void {
  if (selected < 0) return;
  remember();
  doc.gear.shapes.splice(selected, 1);
  selected = -1;
  save();
  refreshAll();
}

function renderPalette(): void {
  const box = $<HTMLElement>("#palette");
  box.replaceChildren();
  for (const c of PLATE_CELLS) {
    const b = document.createElement("button");
    b.type = "button";
    const rgb = PLATE_INK[c];
    b.style.background = rgb ? `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` : "#221f2a";
    b.textContent = c;
    b.title = `${c}: ${CELL_NAMES[c]}`;
    b.className = c === paintCell ? "on" : "";
    b.addEventListener("click", () => {
      paintCell = c;
      if (tool !== "paint") setTool("paint");
      renderPalette();
    });
    box.append(b);
  }
}

let gridPainting: string | null = null;
window.addEventListener("pointerup", () => {
  if (gridPainting !== null) {
    gridPainting = null;
    save();
    refreshLight();
  }
});

function renderGrid(): void {
  const box = $<HTMLElement>("#grid");
  box.replaceChildren();
  const p = doc.plate;
  if (!p) {
    box.style.display = "none";
    return;
  }
  box.style.display = "";
  const cols = p.rows[0]!.length;
  box.style.gridTemplateColumns = `repeat(${cols}, 13px)`;
  p.rows.forEach((row, r) => {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement("div");
      const rgb = PLATE_INK[row[c]!];
      cell.style.background = rgb ? `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` : "#221f2a";
      cell.title = `col ${c} row ${r}: ${row[c]}`;
      cell.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        remember();
        gridPainting = e.button === 2 ? "." : paintCell;
        if (setCell(c, r, gridPainting)) refreshLight();
      });
      cell.addEventListener("pointerenter", () => {
        if (gridPainting !== null && setCell(c, r, gridPainting)) refreshLight();
      });
      cell.addEventListener("contextmenu", (e) => e.preventDefault());
      box.append(cell);
    }
  });
}

$<HTMLButtonElement>("#mirror-plate").addEventListener("click", () => {
  const p = doc.plate;
  if (!p) return;
  remember();
  p.rows = p.rows.map((row) => {
    const n = row.length;
    return [...row].map((ch, c) => (c >= Math.ceil(n / 2) ? row[n - 1 - c]! : ch)).join("");
  });
  save();
  refreshLight();
});
$<HTMLButtonElement>("#clear-plate").addEventListener("click", () => {
  const p = doc.plate;
  if (!p) return;
  remember();
  p.rows = p.rows.map((row) => ".".repeat(row.length));
  save();
  refreshLight();
});

function renderChecks(extra?: string): void {
  const ul = $<HTMLUListElement>("#checks");
  ul.replaceChildren();
  const list = checkDoc(doc);
  if (extra) list.unshift({ level: "error", text: extra });
  for (const c of list) {
    const li = document.createElement("li");
    li.className = c.level;
    li.textContent = `${c.level === "ok" ? "✓" : c.level === "warn" ? "!" : "✗"} ${c.text}`;
    ul.append(li);
  }
}

function refreshOutput(): void {
  if (textDirty) return;
  $<HTMLTextAreaElement>("#ron-gear").value = formatGear(doc.gear);
  $<HTMLTextAreaElement>("#ron-plate").value = doc.plate ? formatPlate(doc.gear.id, doc.plate) : "";
}

for (const id of ["#ron-gear", "#ron-plate"]) {
  $<HTMLTextAreaElement>(id).addEventListener("input", () => (textDirty = true));
}

$<HTMLButtonElement>("#apply").addEventListener("click", () => {
  try {
    const gear = gearDocFrom($<HTMLTextAreaElement>("#ron-gear").value);
    const plateSrc = $<HTMLTextAreaElement>("#ron-plate").value.trim();
    const plate = plateSrc ? plateDocFrom(plateSrc).plate : null;
    remember();
    doc = { gear, plate };
    selected = -1;
    textDirty = false;
    save();
    refreshAll();
  } catch (err) {
    renderChecks(`Apply: ${err instanceof Error ? err.message : String(err)}`);
  }
});

function refreshLight(): void {
  renderShapes();
  if (gridPainting === null) renderGrid();
  refreshOutput();
  renderChecks();
  paint();
}

function refreshAll(): void {
  syncForm();
  renderInspector();
  renderPalette();
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-tool]")) b.classList.toggle("on", b.dataset.tool === tool);
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-view]")) b.classList.toggle("on", b.dataset.view === view);
  refreshLight();
}

const HINTS: Record<Tool, string> = {
  select: "Click a shape to select it. Drag it to move; drag its squares to reshape.",
  Capsule: "Drag from one end to the other. Depth sets the coordinate you look along.",
  Line: "Drag from one end to the other. Lines are thin strokes of `thick` pixels.",
  Disc: "Click for the center, drag for the radius.",
  joint: "Click a joint dot to put a disc on it. It follows the joint when the figure moves.",
  paint: "Paint plate cells in the front view. Right-drag erases.",
  rect: "Drag the plate quad in the front view. The grid keeps its cells.",
};

let toolHint = "";

function setTool(t: Tool): void {
  tool = t;
  toolHint = `${HINTS[t]} Middle-drag or Space-drag pans, wheel zooms, Alt turns snap off.`;
  hint.textContent = toolHint;
  refreshAll();
}

function setView(v: View): void {
  view = v;
  $<HTMLInputElement>("#d-depth").value = String(depth());
  refreshAll();
}

for (const b of document.querySelectorAll<HTMLButtonElement>("[data-tool]")) b.addEventListener("click", () => setTool(b.dataset.tool as Tool));
for (const b of document.querySelectorAll<HTMLButtonElement>("[data-view]")) b.addEventListener("click", () => setView(b.dataset.view as View));
$<HTMLButtonElement>("#fit").addEventListener("click", fit);
$<HTMLButtonElement>("#undo").addEventListener("click", () => restore(undoStack, redoStack));
$<HTMLButtonElement>("#redo").addEventListener("click", () => restore(redoStack, undoStack));

const typing = (t: EventTarget | null) => t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement;

window.addEventListener("keydown", (e) => {
  altHeld = e.altKey;
  if (typing(e.target)) return;
  if (e.key === " ") {
    spaceHeld = true;
    e.preventDefault();
    return;
  }
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === "z") {
    e.preventDefault();
    if (e.shiftKey) restore(redoStack, undoStack);
    else restore(undoStack, redoStack);
    return;
  }
  if (mod && e.key.toLowerCase() === "y") {
    e.preventDefault();
    restore(redoStack, undoStack);
    return;
  }
  if (mod && e.key.toLowerCase() === "d") {
    e.preventDefault();
    duplicate();
    return;
  }
  if (mod) return;
  const keys: Record<string, () => void> = {
    v: () => setTool("select"), c: () => setTool("Capsule"), l: () => setTool("Line"), d: () => setTool("Disc"),
    j: () => setTool("joint"), p: () => setTool("paint"), r: () => setTool("rect"),
    "1": () => setView("front"), "2": () => setView("side"), "3": () => setView("figure"),
    f: fit, m: mirror, Delete: removeShape, Backspace: removeShape,
    Escape: () => {
      selected = -1;
      refreshAll();
    },
  };
  const fn = keys[e.key] ?? keys[e.key.toLowerCase()];
  if (fn) {
    e.preventDefault();
    fn();
  }
});
window.addEventListener("keyup", (e) => {
  altHeld = e.altKey;
  if (e.key === " ") spaceHeld = false;
});

// --- files ---------------------------------------------------------------------

function shortName(path: string): string {
  const file = path.split("/").pop() ?? path;
  return path.includes("stick-engine") ? `engine/${file}` : file;
}

const bundledGear = Object.entries(bundled).filter(([p]) => !p.endsWith(".plate.ron")).sort((a, b) => shortName(a[0]).localeCompare(shortName(b[0])));
const bundledPlates = new Map<string, string>();
for (const [p, src] of Object.entries(bundled)) {
  if (!p.endsWith(".plate.ron")) continue;
  try {
    bundledPlates.set(plateDocFrom(src).id, src);
  } catch {
    /* listed gear opens without its plate */
  }
}
for (const [p] of bundledGear) option($<HTMLSelectElement>("#bundled"), p, shortName(p));

function open(gearSrc: string, plateSrc?: string): void {
  try {
    const gear = gearDocFrom(gearSrc);
    const ps = plateSrc ?? bundledPlates.get(gear.id);
    const plate = ps ? plateDocFrom(ps).plate : null;
    remember();
    doc = { gear, plate };
    selected = -1;
    textDirty = false;
    save();
    refreshAll();
    fit();
  } catch (err) {
    renderChecks(`Open: ${err instanceof Error ? err.message : String(err)}`);
  }
}

$<HTMLSelectElement>("#bundled").addEventListener("change", (e) => {
  const sel = e.target as HTMLSelectElement;
  const src = bundled[sel.value];
  if (src) open(src);
  sel.value = "";
});

$<HTMLInputElement>("#file").addEventListener("change", async (e) => {
  const input = e.target as HTMLInputElement;
  const files = [...(input.files ?? [])];
  const texts = await Promise.all(files.map(async (f) => ({ name: f.name, src: await f.text() })));
  const gear = texts.find((t) => !t.name.endsWith(".plate.ron"));
  const plates = texts.filter((t) => t.name.endsWith(".plate.ron"));
  if (gear) {
    const id = (() => {
      try {
        return gearDocFrom(gear.src).id;
      } catch {
        return "";
      }
    })();
    const match = plates.find((p) => {
      try {
        return plateDocFrom(p.src).id === id;
      } catch {
        return false;
      }
    });
    open(gear.src, match?.src);
  } else if (plates[0]) {
    try {
      remember();
      doc.plate = plateDocFrom(plates[0].src).plate;
      save();
      refreshAll();
    } catch (err) {
      renderChecks(`Open: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  input.value = "";
});

$<HTMLButtonElement>("#new").addEventListener("click", () => {
  remember();
  doc = { gear: newGear($<HTMLSelectElement>("#slot-new").value), plate: null };
  selected = -1;
  textDirty = false;
  save();
  refreshAll();
  fit();
});

async function saveText(name: string, text: string): Promise<void> {
  const picker = (window as unknown as {
    showSaveFilePicker?: (o: unknown) => Promise<{ createWritable: () => Promise<{ write: (s: string) => Promise<void>; close: () => Promise<void> }> }>;
  }).showSaveFilePicker;
  if (picker) {
    try {
      const handle = await picker({ suggestedName: name, types: [{ description: "RON", accept: { "text/plain": [".ron"] } }] });
      const w = await handle.createWritable();
      await w.write(text);
      await w.close();
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

$<HTMLButtonElement>("#save").addEventListener("click", () => void saveText(`${doc.gear.id}.ron`, formatGear(doc.gear)));
$<HTMLButtonElement>("#save-plate").addEventListener("click", () => {
  if (doc.plate) void saveText(`${doc.gear.id}.plate.ron`, formatPlate(doc.gear.id, doc.plate));
});
$<HTMLButtonElement>("#copy").addEventListener("click", () => void navigator.clipboard.writeText(formatGear(doc.gear)));
$<HTMLButtonElement>("#viewer").addEventListener("click", () => {
  save();
  window.setTimeout(() => window.open("./gear-viewer.html?editor=1", "gear-viewer"), 200);
});

function boot(): void {
  try {
    const saved = localStorage.getItem(DOC_KEY);
    const parsed = saved ? (JSON.parse(saved) as EditorDoc) : null;
    if (parsed?.gear && Array.isArray(parsed.gear.shapes)) {
      doc = parsed;
      setTool("select");
      fit();
      return;
    }
  } catch {
    /* fall through to the example */
  }
  const cuirass = bundledGear.find(([p]) => p.endsWith("/ba_iron_cuirass.ron"));
  setTool("select");
  if (cuirass) open(cuirass[1]);
  else fit();
}

boot();
