import {
  BONES, HEIGHT_PX, RAMP, type GearDef, type GearShape, type PlateDef, type Triple, type Vec3,
  add, cross, dot, gearFrame, mul, norm, parseGear, parsePlate, projectIso, solveIdle, solveWalk, sub, toWorld, vlen,
} from "./gear-ron.ts";

type Item = { name: string; src: string; gear?: GearDef; error?: string };
type Mode = "figure" | "front" | "side";

const bundled = import.meta.glob(
  [
    "../../../engine/ba-stick-render/assets/gear/*.ron",
    "../../../engine/stick-engine/crates/stick_engine/assets/gear/*.ron",
  ],
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

const plates = new Map<string, PlateDef>();
for (const [path, src] of Object.entries(bundled)) {
  if (!path.endsWith(".plate.ron")) continue;
  try {
    const plate = parsePlate(src);
    plates.set(plate.id, plate);
  } catch {
    /* a bad plate just draws the bare shapes */
  }
}

const items: Item[] = Object.entries(bundled)
  .filter(([path]) => !path.endsWith(".plate.ron"))
  .map(([path, src]) => ({ name: shortName(path), src }))
  .sort((a, b) => a.name.localeCompare(b.name));

let current = Math.max(0, items.findIndex((it) => it.name.includes("ba_iron_cuirass")));
let mode: Mode = "figure";
let yaw = 0.6;
let selected = -1;

const list = document.querySelector("#list") as HTMLUListElement;
const meta = document.querySelector("#meta") as HTMLElement;
const canvas = document.querySelector("#view") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const drop = document.querySelector("#drop") as HTMLElement;

function shortName(path: string): string {
  const file = path.split("/").pop() ?? path;
  if (path.includes("ba-stick-render")) return file;
  return `engine/${file}`;
}

function load(it: Item): GearDef | undefined {
  if (it.gear || it.error) return it.gear;
  try {
    it.gear = parseGear(it.src);
  } catch (err) {
    it.error = err instanceof Error ? err.message : String(err);
  }
  return it.gear;
}

function renderList(): void {
  list.replaceChildren();
  items.forEach((it, i) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = i === current ? "on" : "";
    const gear = load(it);
    btn.textContent = gear ? `${gear.id}` : it.name;
    const sub = document.createElement("small");
    sub.textContent = gear ? `${it.name} · ${gear.slot} · ${gear.shapes.length}` : (it.error ?? it.name);
    btn.append(sub);
    btn.addEventListener("click", () => {
      current = i;
      selected = -1;
      paint();
    });
    li.append(btn);
    list.append(li);
  });
}

function readFiles(files: FileList | File[]): void {
  const listFiles = [...files].filter((f) => f.name.endsWith(".ron"));
  if (!listFiles.length) return;
  let left = listFiles.length;
  for (const file of listFiles) {
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result ?? "");
      const name = file.name;
      const existing = items.findIndex((it) => it.name === name);
      const item: Item = { name, src };
      if (existing >= 0) items[existing] = item;
      else items.unshift(item);
      left--;
      if (left === 0) {
        current = items.findIndex((it) => it.name === listFiles[0]!.name);
        selected = -1;
        paint();
      }
    };
    reader.readAsText(file);
  }
}

drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("hot"); });
drop.addEventListener("dragleave", () => drop.classList.remove("hot"));
drop.addEventListener("drop", (e) => {
  e.preventDefault();
  drop.classList.remove("hot");
  if (e.dataTransfer?.files) readFiles(e.dataTransfer.files);
});
(document.querySelector("#file") as HTMLInputElement).addEventListener("change", (e) => {
  const input = e.target as HTMLInputElement;
  if (input.files) readFiles(input.files);
});

for (const btn of document.querySelectorAll<HTMLButtonElement>("[data-mode]")) {
  btn.addEventListener("click", () => {
    mode = btn.dataset.mode as Mode;
    paint();
  });
}
const yawInput = document.querySelector("#yaw") as HTMLInputElement;
const yawRead = document.querySelector("#yaw-read") as HTMLElement;
function setYaw(next: number): void {
  yaw = next;
  const deg = ((yaw * 180) / Math.PI) % 360;
  const shown = (deg + 360) % 360;
  yawInput.value = String(shown);
  yawRead.textContent = `${Math.round(shown)}°`;
}
yawInput.addEventListener("input", () => {
  setYaw((Number(yawInput.value) * Math.PI) / 180);
  if (mode !== "figure") mode = "figure";
  paint();
});

let dragging = false;
let dragX = 0;
canvas.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  dragging = true;
  dragX = e.clientX;
  canvas.classList.add("dragging");
  canvas.setPointerCapture(e.pointerId);
  if (mode !== "figure") {
    mode = "figure";
    paint();
  }
});
canvas.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  const dx = e.clientX - dragX;
  dragX = e.clientX;
  setYaw(yaw + dx * 0.012);
  paint();
});
function endDrag(): void {
  dragging = false;
  canvas.classList.remove("dragging");
}
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);
window.addEventListener("keydown", (e) => {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  if (e.target instanceof HTMLInputElement) return;
  setYaw(yaw + (e.key === "ArrowRight" ? 0.12 : -0.12));
  if (mode !== "figure") mode = "figure";
  paint();
});

type Pt = { x: number; y: number; d: number };

let walking = false;
let walkPhase = 0;
let lastWalk = 0;
const walkBtn = document.querySelector("#walk") as HTMLButtonElement;

function figureNow(): ReturnType<typeof solveIdle> {
  return walking ? solveWalk(yaw, walkPhase) : solveIdle(yaw);
}

function stepWalk(ts: number): void {
  if (!walking) return;
  if (lastWalk) walkPhase = (walkPhase + (ts - lastWalk) / 1000 * 0.65) % 1;
  lastWalk = ts;
  paint();
  requestAnimationFrame(stepWalk);
}

walkBtn.addEventListener("click", () => {
  walking = !walking;
  walkBtn.classList.toggle("on", walking);
  if (!walking) return;
  if (mode !== "figure") mode = "figure";
  lastWalk = 0;
  requestAnimationFrame(stepWalk);
});

function paint(): void {
  renderList();
  const it = items[current];
  const gear = it ? load(it) : undefined;
  for (const btn of document.querySelectorAll<HTMLButtonElement>("[data-mode]")) {
    btn.classList.toggle("on", btn.dataset.mode === mode);
  }
  setYaw(yaw);
  if (!it || !gear) {
    meta.textContent = it?.error ?? "Drop a .ron gear file.";
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }
  meta.replaceChildren();
  const head = document.createElement("h2");
  head.textContent = gear.id;
  const facts = document.createElement("p");
  facts.textContent = [
    gear.slot,
    `attach ${gear.attach}`,
    gear.material ? gear.material : "",
    gear.stance ? `stance ${gear.stance}` : "",
    gear.reach ? `reach ${gear.reach}` : "",
  ].filter(Boolean).join(" · ");
  meta.append(head, facts);
  const bones = Object.entries(gear.thicknessMul);
  if (bones.length) {
    const p = document.createElement("p");
    p.textContent = bones.map(([k, v]) => `${k} ×${v}`).join("  ");
    meta.append(p);
  }
  const ul = document.createElement("ol");
  gear.shapes.forEach((sh, i) => {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.className = i === selected ? "on" : "";
    b.textContent = shapeLabel(sh);
    b.addEventListener("click", () => {
      selected = selected === i ? -1 : i;
      paint();
    });
    li.append(b);
    ul.append(li);
  });
  meta.append(ul);
  const plate = plates.get(gear.id);
  if (plate) {
    const note = document.createElement("p");
    note.textContent = `plate overlay ${plate.rows[0]!.length}×${plate.rows.length}`;
    meta.append(note);
  }
  if (it.error) {
    const p = document.createElement("p");
    p.className = "err";
    p.textContent = it.error;
    meta.append(p);
  }
  draw(gear, plates.get(gear.id), figureNow());
}

function shapeLabel(sh: GearShape): string {
  if (sh.kind === "Disc") {
    const where = sh.at ? `@ ${sh.at}` : `(${sh.center.map((n) => n.toFixed(3)).join(", ")})`;
    return `Disc ${sh.ramp} r ${sh.r} ${where}`;
  }
  return `${sh.kind} ${sh.ramp} ${sh.thick}`;
}

function draw(gear: GearDef, plate: PlateDef | undefined, fig: ReturnType<typeof solveIdle>): void {
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#221f2a";
  ctx.fillRect(0, 0, w, h);
  const frame = gearFrame(gear, fig);
  const flow = plate?.flow ?? 0;
  const at = (p: Triple) => clothWorld(frame, p, fig, flow);
  const showBody = mode === "figure" || gear.attach === "chest" || gear.attach === "head" || gear.attach === "pelvis";
  const samples: Pt[] = [];
  const put = (p: Vec3) => {
    const s = screen(p, frame);
    samples.push(s);
    return s;
  };
  if (showBody) for (const j of Object.values(fig.joints)) put(j);
  else put(frame.o);
  for (const sh of gear.shapes) {
    if (sh.kind === "Disc") put(shapePoint(sh, fig, frame));
    else { put(at(sh.from)); put(at(sh.to)); }
  }
  const minX = Math.min(...samples.map((p) => p.x));
  const maxX = Math.max(...samples.map((p) => p.x));
  const minY = Math.min(...samples.map((p) => p.y));
  const maxY = Math.max(...samples.map((p) => p.y));
  const spanX = Math.max(8, maxX - minX);
  const spanY = Math.max(8, maxY - minY);
  const fit = Math.min((w - 80) / spanX, (h - 80) / spanY);
  const ox = w / 2 - ((minX + maxX) / 2) * fit;
  const oy = h / 2 - ((minY + maxY) / 2) * fit;
  const map = (p: Pt): Pt => ({ x: ox + p.x * fit, y: oy + p.y * fit, d: p.d });

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const limb = (a: Vec3, b: Vec3, thick: number, color: string) => {
    const pa = map(screen(a, frame));
    const pb = map(screen(b, frame));
    ctx.strokeStyle = "#0d0b14";
    ctx.lineWidth = thick * fit + 2;
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = thick * fit;
    ctx.stroke();
  };
  if (showBody) {
    const wrap = plate?.wrap ?? 0;
    const yoke = flow > 0 ? "#2c5d78" : wrap > 0 && gear.material === "bone" ? "#b59a74" : wrap > 0 ? "#7a5233" : "";
    for (const [a, b] of BONES) {
      const collar = yoke && ((a === "chest" && b === "neck") || (a === "l_shoulder" && b === "r_shoulder"));
      limb(fig.joints[a]!, fig.joints[b]!, 2.2, collar ? yoke : "#6a645c");
    }
    const head = map(screen(fig.joints.head!, frame));
    ctx.fillStyle = "#e8e2d0";
    ctx.beginPath();
    ctx.arc(head.x, head.y, 0.13 * HEIGHT_PX * fit, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const origin = map(screen(frame.o, frame));
    ctx.strokeStyle = "#4a4458";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(origin.x - 10, origin.y);
    ctx.lineTo(origin.x + 10, origin.y);
    ctx.moveTo(origin.x, origin.y - 14);
    ctx.lineTo(origin.x, origin.y + 8);
    ctx.stroke();
  }

  const layer = gearLayer(w, h);
  const octx = layer.getContext("2d")!;
  octx.clearRect(0, 0, w, h);
  octx.lineCap = "round";
  octx.lineJoin = "round";
  const fabric = (plate?.flow ?? 0) > 0;
  const wrap = plate?.wrap ?? 0;
  if (plate && fabric) drawFabric(octx, plate, fig, frame, map);
  else if (plate && wrap > 0) drawWrap(octx, plate, fig, frame, map);
  if (gear.id === "ba_iron_helm" && plate) drawHelm(octx, plate, frame, map);
  else if (!fabric) {
    const ordered = gear.shapes.map((sh, i) => ({ sh, i, d: depthOf(sh, fig, frame, at) }));
    const order = gear.id === "ba_iron_helm" ? ordered : ordered.sort((a, b) => a.d - b.d);
    for (const { sh, i } of order) {
      if (i === selected) continue;
      strokeShape(octx, sh, fig, frame, map, fit, false, at, gear.material);
    }
    if (selected >= 0 && gear.shapes[selected]) strokeShape(octx, gear.shapes[selected], fig, frame, map, fit, true, at, gear.material);
    if (plate && wrap <= 0) {
      drawUpperArms(octx, plate, fig, frame, map, fit);
      stampPlate(octx, plate, frame, map, at);
    }
  }
  paintSilhouette(ctx, layer);
  ctx.drawImage(layer, 0, 0);
}

const layerCanvas = document.createElement("canvas");
const edgeCanvas = document.createElement("canvas");

function gearLayer(w: number, h: number): HTMLCanvasElement {
  if (layerCanvas.width !== w || layerCanvas.height !== h) {
    layerCanvas.width = w;
    layerCanvas.height = h;
  }
  return layerCanvas;
}

/** One pixel of outline where empty space touches the gear, not between its parts. */
function paintSilhouette(dest: CanvasRenderingContext2D, src: HTMLCanvasElement): void {
  const w = src.width;
  const h = src.height;
  const read = src.getContext("2d")!.getImageData(0, 0, w, h);
  const d = read.data;
  if (edgeCanvas.width !== w || edgeCanvas.height !== h) {
    edgeCanvas.width = w;
    edgeCanvas.height = h;
  }
  const ectx = edgeCanvas.getContext("2d")!;
  const out = ectx.createImageData(w, h);
  const o = out.data;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && d[((y * w + x) << 2) + 3]! > 16;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (solid(x, y)) continue;
      if (!solid(x - 1, y) && !solid(x + 1, y) && !solid(x, y - 1) && !solid(x, y + 1)) continue;
      const i = (y * w + x) << 2;
      o[i] = 0x0d;
      o[i + 1] = 0x0b;
      o[i + 2] = 0x14;
      o[i + 3] = 255;
    }
  }
  ectx.putImageData(out, 0, 0);
  dest.drawImage(edgeCanvas, 0, 0);
}

function screen(p: Vec3, frame: ReturnType<typeof gearFrame>): Pt {
  if (mode === "figure") {
    const s = projectIso(p, 640, 360);
    return { x: s.x, y: s.y, d: s.d };
  }
  const d = sub(p, frame.o);
  const lx = dot(d, frame.x);
  const ly = dot(d, frame.y);
  const lz = dot(d, frame.z);
  if (mode === "side") return { x: lz * HEIGHT_PX, y: -ly * HEIGHT_PX, d: lx };
  return { x: lx * HEIGHT_PX, y: -ly * HEIGHT_PX, d: lz };
}

function shapePoint(sh: GearShape, fig: ReturnType<typeof solveIdle>, frame: ReturnType<typeof gearFrame>): Vec3 {
  if (sh.at && fig.joints[sh.at]) return fig.joints[sh.at]!;
  return toWorld(frame, sh.center);
}

function depthOf(sh: GearShape, fig: ReturnType<typeof solveIdle>, frame: ReturnType<typeof gearFrame>, at: (p: Triple) => Vec3): number {
  if (sh.kind === "Disc") return screen(shapePoint(sh, fig, frame), frame).d;
  return (screen(at(sh.from), frame).d + screen(at(sh.to), frame).d) / 2;
}

/** Hem follows the foot on its side. `flow` 0 leaves the point where the RON put it. */
function clothWorld(frame: ReturnType<typeof gearFrame>, p: Triple, fig: ReturnType<typeof solveIdle>, flow: number): Vec3 {
  const rest = toWorld(frame, p);
  const t = Math.min(1, Math.max(0, (-0.2 - p[1]) / 0.95));
  const w = t * t * flow;
  if (w <= 0.001) return rest;
  const side = Math.min(1, Math.max(-1, p[0] / 0.18));
  const k = (side + 1) / 2;
  const lf = fig.joints.l_foot!;
  const rf = fig.joints.r_foot!;
  const pel = fig.joints.pelvis!;
  const foot = { x: lf.x * (1 - k) + rf.x * k, y: lf.y * (1 - k) + rf.y * k, z: lf.z * (1 - k) + rf.z * k };
  const rel = sub(foot, pel);
  const push = add(mul(frame.z, dot(rel, frame.z)), mul(frame.x, dot(rel, frame.x) * 0.45));
  return add(rest, mul(push, w));
}

function ink(material: string | undefined, ramp: string, hot: boolean): string {
  if (hot) return "#f4f7ff";
  if (ramp === "Material" && material === "dust") return "#7d7486";
  if (material === "leather" && ramp === "Material") return "#7a5233";
  if (material === "leather" && ramp === "Trim") return "#9aa6b8";
  if (material === "bone" && ramp === "Material") return "#d8cfb4";
  return RAMP[ramp] ?? "#9aa6b8";
}

function strokeShape(
  pen: CanvasRenderingContext2D,
  sh: GearShape,
  fig: ReturnType<typeof solveIdle>,
  frame: ReturnType<typeof gearFrame>,
  map: (p: Pt) => Pt,
  fit: number,
  hot: boolean,
  at: (p: Triple) => Vec3,
  material?: string,
): void {
  const color = ink(material, sh.ramp, hot);
  if (sh.kind === "Disc") {
    const c = map(screen(shapePoint(sh, fig, frame), frame));
    const r = Math.max(1.5, sh.r * HEIGHT_PX * fit);
    pen.beginPath();
    pen.arc(c.x, c.y, r, 0, Math.PI * 2);
    pen.fillStyle = color;
    pen.fill();
    return;
  }
  const a = map(screen(at(sh.from), frame));
  const b = map(screen(at(sh.to), frame));
  if (vlen(sub({ x: a.x, y: a.y, z: 0 }, { x: b.x, y: b.y, z: 0 })) < 0.5 && sh.kind === "Line") return;
  // Engine capsules use `thick` as a radius. Lines stay a stroke of `thick` pixels.
  pen.strokeStyle = color;
  pen.lineWidth = Math.max(1, (sh.kind === "Capsule" ? sh.thick * 2 : sh.thick) * fit);
  pen.beginPath();
  pen.moveTo(a.x, a.y);
  pen.lineTo(b.x, b.y);
  pen.stroke();
}

/** Steel on the upper arm, from under the shoulder cap to a gold cuff. */
function drawUpperArms(
  pen: CanvasRenderingContext2D,
  plate: PlateDef,
  fig: ReturnType<typeof solveIdle>,
  frame: ReturnType<typeof gearFrame>,
  map: (p: Pt) => Pt,
  fit: number,
): void {
  const stroke = (a: Vec3, b: Vec3, thick: number, color: string) => {
    const pa = map(screen(a, frame));
    const pb = map(screen(b, frame));
    pen.strokeStyle = color;
    pen.lineWidth = Math.max(1, thick * 2 * fit);
    pen.beginPath();
    pen.moveTo(pa.x, pa.y);
    pen.lineTo(pb.x, pb.y);
    pen.stroke();
  };
  const guard = (shoulder: string, elbow: string) => {
    const s = fig.joints[shoulder]!;
    const e = fig.joints[elbow]!;
    const along = (t: number): Vec3 => ({
      x: s.x + (e.x - s.x) * t,
      y: s.y + (e.y - s.y) * t,
      z: s.z + (e.z - s.z) * t,
    });
    stroke(along(plate.armFrom), along(plate.armTo), plate.armThick, RAMP.Material ?? "#9aa6b8");
    stroke(along(plate.cuffFrom), along(plate.cuffTo), plate.cuffThick, RAMP.Trim ?? "#d9a441");
  };
  guard("l_shoulder", "l_elbow");
  guard("r_shoulder", "r_elbow");
}

const PLATE_INK: Record<string, [number, number, number]> = {
  k: [0x18, 0x16, 0x1f],
  c: [0x26, 0x4c, 0x62],
  b: [0x2c, 0x5d, 0x78],
  m: [0x33, 0x6a, 0x86],
  g: [0xd9, 0xa4, 0x41],
  r: [0xb3, 0x39, 0x39],
  l: [0x7a, 0x52, 0x33],
  d: [0x55, 0x38, 0x23],
  h: [0xb5, 0x9a, 0x74],
  s: [0x8a, 0x73, 0x56],
  e: [0x9a, 0xa6, 0xb8],
  i: [0x4a, 0x44, 0x58],
};

const SHEET_COLS = 7;
const SHEET_ROWS = 8;

/** A point on one side of the skeleton. v = 0 at the shoulder, 1 at the foot. */
function boneAt(fig: ReturnType<typeof solveIdle>, side: number, v: number): Vec3 {
  const pre = side === 0 ? "l_" : "r_";
  const shoulder = fig.joints[`${pre}shoulder`]!;
  const hip = fig.joints[`${pre}hip`]!;
  const knee = fig.joints[`${pre}knee`]!;
  const foot = fig.joints[`${pre}foot`]!;
  const lerp = (a: Vec3, b: Vec3, t: number) => add(a, mul(sub(b, a), t));
  const t = Math.min(1, Math.max(0, v));
  if (t < 0.34) return lerp(shoulder, hip, t / 0.34);
  if (t < 0.67) return lerp(hip, knee, (t - 0.34) / 0.33);
  return lerp(knee, foot, (t - 0.67) / 0.33);
}

/** Figure limb radius in metres. The torso capsule is a little thicker. */
const LIMB_R = 2.2 / HEIGHT_PX;
const TORSO_R = 2.8 / HEIGHT_PX;

/** Horizontal slice of a leaning leg is wider than the bone radius. */
function legClearance(frame: ReturnType<typeof gearFrame>, fig: ReturnType<typeof solveIdle>, v: number): number {
  let lean = 1;
  for (const side of [0, 1]) {
    const a = boneAt(fig, side, v < 0.67 ? 0.34 : 0.67);
    const b = boneAt(fig, side, v < 0.67 ? 0.67 : 1);
    lean = Math.min(lean, Math.max(0.35, Math.abs(dot(norm(sub(b, a)), frame.y))));
  }
  return LIMB_R / lean;
}

/** Ellipse radii that contain a circle of radius r around (bx, bz). */
function coverCircle(bx: number, bz: number, r: number): [number, number] {
  const ex = Math.abs(bx) + r;
  const ez = Math.abs(bz) + r;
  let need = 1;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const x = bx + Math.cos(a) * r;
    const z = bz + Math.sin(a) * r;
    need = Math.max(need, (x / ex) * (x / ex) + (z / ez) * (z / ez));
  }
  const s = Math.sqrt(need);
  return [ex * s, ez * s];
}

/** Disk around the two bones. Below the hip the rim is outside the leg capsules. */
function ringAt(frame: ReturnType<typeof gearFrame>, fig: ReturnType<typeof solveIdle>, v: number): { center: Vec3; rx: number; rz: number } {
  const left = boneAt(fig, 0, v);
  const right = boneAt(fig, 1, v);
  const span = sub(right, left);
  const shoulderPad = LIMB_R * (0.35 + 0.65 * Math.min(1, Math.max(0, v / 0.34)));
  const lift = (1 - Math.min(1, Math.max(0, v) / 0.18)) * LIMB_R * 0.65;
  const center = add(mul(add(left, right), 0.5), mul(frame.y, lift));
  const sx = Math.abs(dot(span, frame.x)) * 0.5 + shoulderPad;
  const sz = Math.max(TORSO_R, Math.abs(dot(span, frame.z)) * 0.5 + shoulderPad);
  const t = Math.min(1, Math.max(0, (v - 0.28) / 0.1));
  if (t <= 0) return { center, rx: sx, rz: sz };
  const clearance = legClearance(frame, fig, v);
  let lx = TORSO_R;
  let lz = TORSO_R;
  for (const bone of [left, right]) {
    const d = sub(bone, center);
    const [ex, ez] = coverCircle(dot(d, frame.x), dot(d, frame.z), clearance);
    lx = Math.max(lx, ex);
    lz = Math.max(lz, ez);
  }
  return { center, rx: sx * (1 - t) + lx * t, rz: sz * (1 - t) + lz * t };
}

/** Front or back cloth on the disk rim. The side edges are shared, including the hem. */
function sheetPoint(frame: ReturnType<typeof gearFrame>, fig: ReturnType<typeof solveIdle>, u: number, v: number, front: boolean): Vec3 {
  const ring = ringAt(frame, fig, v);
  const uu = Math.min(1, Math.max(0, u));
  const ang = front ? (uu - 0.5) * Math.PI : Math.PI - (uu - 0.5) * Math.PI;
  return add(add(ring.center, mul(frame.x, Math.sin(ang) * ring.rx)), mul(frame.z, Math.cos(ang) * ring.rz));
}

/** Upper arm 0.30 m, forearm 0.28 m. v = 0 at the shoulder, 1 at the wrist. */
const ARM_SPLIT = 0.3 / 0.58;

function armAt(fig: ReturnType<typeof solveIdle>, side: number, v: number): Vec3 {
  const pre = side === 0 ? "l_" : "r_";
  const shoulder = fig.joints[`${pre}shoulder`]!;
  const elbow = fig.joints[`${pre}elbow`]!;
  const hand = fig.joints[`${pre}hand`]!;
  const lerp = (a: Vec3, b: Vec3, t: number) => add(a, mul(sub(b, a), t));
  const t = Math.min(1, Math.max(0, v));
  if (t < ARM_SPLIT) return lerp(shoulder, elbow, t / ARM_SPLIT);
  return lerp(elbow, hand, (t - ARM_SPLIT) / (1 - ARM_SPLIT));
}

/** Disk around one arm. The wrist disk is centered on the hand. */
function sleeveRing(frame: ReturnType<typeof gearFrame>, fig: ReturnType<typeof solveIdle>, side: number, v: number): { center: Vec3; right: Vec3; fwd: Vec3; rx: number; rz: number } {
  const pre = side === 0 ? "l_" : "r_";
  const shoulder = fig.joints[`${pre}shoulder`]!;
  const elbow = fig.joints[`${pre}elbow`]!;
  const hand = fig.joints[`${pre}hand`]!;
  const t = Math.min(1, Math.max(0, v));
  let dir = norm(t < ARM_SPLIT ? sub(elbow, shoulder) : sub(hand, elbow));
  if (vlen(dir) < 0.5) dir = { x: 0, y: -1, z: 0 };
  let right = cross(dir, frame.z);
  if (vlen(right) < 0.25) right = cross(dir, { x: 0, y: 1, z: 0 });
  if (vlen(right) < 0.25) right = cross(dir, frame.x);
  right = norm(right);
  return { center: armAt(fig, side, v), right, fwd: norm(cross(right, dir)), rx: LIMB_R, rz: LIMB_R };
}

function sleevePoint(frame: ReturnType<typeof gearFrame>, fig: ReturnType<typeof solveIdle>, side: number, u: number, v: number, front: boolean): Vec3 {
  const ring = sleeveRing(frame, fig, side, v);
  const uu = Math.min(1, Math.max(0, u));
  const ang = front ? (uu - 0.5) * Math.PI : Math.PI - (uu - 0.5) * Math.PI;
  return add(add(ring.center, mul(ring.right, Math.sin(ang) * ring.rx)), mul(ring.fwd, Math.cos(ang) * ring.rz));
}

function inkCss(cell: string): string {
  const [r, g, b] = PLATE_INK[cell] ?? [0x2c, 0x5d, 0x78];
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Filled ellipse in the disk's plane. */
function fillDisk(
  pen: CanvasRenderingContext2D,
  frame: ReturnType<typeof gearFrame>,
  map: (p: Pt) => Pt,
  center: Vec3,
  right: Vec3,
  fwd: Vec3,
  rx: number,
  rz: number,
  color: string,
): void {
  const n = 16;
  pen.fillStyle = color;
  pen.beginPath();
  const mid = map(screen(center, frame));
  pen.moveTo(mid.x, mid.y);
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2;
    const p = add(add(center, mul(right, Math.sin(ang) * rx)), mul(fwd, Math.cos(ang) * rz));
    const s = map(screen(p, frame));
    pen.lineTo(s.x, s.y);
  }
  pen.closePath();
  pen.fill();
}

/** Invisible disks. Strips run from one disk to the next. The face opening is left empty. */
function drawHelm(
  pen: CanvasRenderingContext2D,
  plate: PlateDef,
  frame: ReturnType<typeof gearFrame>,
  map: (p: Pt) => Pt,
): void {
  const helmR = 0.17;
  const faceR = 0.13;
  const crownY = [0.155, 0.12, 0.08, 0.04, 0];
  const dorsalZ = [0.02, -0.03, -0.08, -0.12, -0.155];
  const steps = 16;
  const rad = (along: number) => Math.sqrt(Math.max(0.0004, helmR * helmR - along * along));
  type Disk = { c: Triple; right: Triple; fwd: Triple; rx: number; rz: number };
  const crown: Disk[] = crownY.map((y) => ({ c: [0, y, 0], right: [1, 0, 0], fwd: [0, 0, 1], rx: rad(y), rz: rad(y) }));
  const dorsal: Disk[] = dorsalZ.map((z) => ({ c: [0, 0, z], right: [1, 0, 0], fwd: [0, 1, 0], rx: rad(z), rz: rad(z) }));
  const rim = (disk: Disk, u: number): Triple => {
    const ang = u * Math.PI * 2;
    const s = Math.sin(ang);
    const c = Math.cos(ang);
    return [
      disk.c[0] + disk.right[0] * s * disk.rx + disk.fwd[0] * c * disk.rz,
      disk.c[1] + disk.right[1] * s * disk.rx + disk.fwd[1] * c * disk.rz,
      disk.c[2] + disk.right[2] * s * disk.rx + disk.fwd[2] * c * disk.rz,
    ];
  };
  const hole = (p: Triple) =>
    (p[2] > 0 && p[1] < 0.11 && p[0] * p[0] + p[1] * p[1] < faceR * faceR) ||
    (p[2] > -0.05 && p[1] < 0 && p[0] * p[0] < 0.1 * 0.1);
  const paint = (disks: Disk[]) => {
    const n = disks.length;
    for (let i = 0; i < n - 1; i++) {
      const v0 = i / (n - 1);
      const v1 = (i + 1) / (n - 1);
      for (let col = 0; col < steps; col++) {
        const u0 = col / steps;
        const u1 = (col + 1) / steps;
        const a = rim(disks[i]!, u0);
        const b = rim(disks[i]!, u1);
        const c = rim(disks[i + 1]!, u1);
        const d = rim(disks[i + 1]!, u0);
        if (hole(a) || hole(b) || hole(c) || hole(d)) continue;
        const turn = (p: Triple): Triple => [-p[0], p[1], -p[2]];
        const pa = map(screen(toWorld(frame, turn(a)), frame));
        const pb = map(screen(toWorld(frame, turn(b)), frame));
        const pc = map(screen(toWorld(frame, turn(c)), frame));
        const pd = map(screen(toWorld(frame, turn(d)), frame));
        fillCloth(pen, plate, pa, pb, pc, [u0, v0], [u1, v0], [u1, v1]);
        fillCloth(pen, plate, pa, pc, pd, [u0, v0], [u1, v1], [u0, v1]);
      }
    }
  };
  paint(crown);
  paint(dorsal);
  const cap = dorsal[dorsal.length - 1]!;
  const turn = (p: Triple): Triple => [-p[0], p[1], -p[2]];
  const axis = (a: Triple): Vec3 => {
    const t = turn(a);
    return add(mul(frame.x, t[0]), add(mul(frame.y, t[1]), mul(frame.z, t[2])));
  };
  fillDisk(pen, frame, map, toWorld(frame, turn(cap.c)), axis(cap.right), axis(cap.fwd), cap.rx, cap.rz, "#d9a441");
}

/** Front and back pixel sheets. The skeleton places every corner. */
function drawFabric(
  pen: CanvasRenderingContext2D,
  plate: PlateDef,
  fig: ReturnType<typeof solveIdle>,
  frame: ReturnType<typeof gearFrame>,
  map: (p: Pt) => Pt,
): void {
  const paint = (front: boolean) => {
    const at = (col: number, row: number) => {
      const u = col / (SHEET_COLS - 1);
      const v = row / (SHEET_ROWS - 1);
      return { p: map(screen(sheetPoint(frame, fig, u, v, front), frame)), u, v };
    };
    for (let row = 0; row < SHEET_ROWS - 1; row++) {
      for (let col = 0; col < SHEET_COLS - 1; col++) {
        const a = at(col, row);
        const b = at(col + 1, row);
        const c = at(col + 1, row + 1);
        const d = at(col, row + 1);
        fillCloth(pen, plate, a.p, b.p, c.p, [a.u, a.v], [b.u, b.v], [c.u, c.v]);
        fillCloth(pen, plate, a.p, c.p, d.p, [a.u, a.v], [c.u, c.v], [d.u, d.v]);
      }
    }
  };
  const paintSleeve = (side: number, front: boolean) => {
    const at = (col: number, row: number) => {
      const u = col / (SHEET_COLS - 1);
      const v = row / (SHEET_ROWS - 1);
      return { p: map(screen(sleevePoint(frame, fig, side, u, v, front), frame)), u, v };
    };
    for (let row = 0; row < SHEET_ROWS - 1; row++) {
      for (let col = 0; col < SHEET_COLS - 1; col++) {
        const a = at(col, row);
        const b = at(col + 1, row);
        const c = at(col + 1, row + 1);
        const d = at(col, row + 1);
        fillCloth(pen, plate, a.p, b.p, c.p, [a.u, a.v], [b.u, b.v], [c.u, c.v]);
        fillCloth(pen, plate, a.p, c.p, d.p, [a.u, a.v], [c.u, c.v], [d.u, d.v]);
      }
    }
  };
  const top = inkCss(plate.rows[0]![Math.floor(plate.rows[0]!.length / 2)]!);
  const last = plate.rows[plate.rows.length - 1]!;
  const bottom = inkCss(last[Math.floor(last.length / 2)]!);
  paint(false);
  paintSleeve(0, false);
  paintSleeve(1, false);
  paint(true);
  paintSleeve(0, true);
  paintSleeve(1, true);
  const collar = ringAt(frame, fig, 0);
  fillDisk(pen, frame, map, collar.center, frame.x, frame.z, collar.rx, collar.rz, top);
  const hem = ringAt(frame, fig, 1);
  fillDisk(pen, frame, map, hem.center, frame.x, frame.z, hem.rx, hem.rz, bottom);
  for (const side of [0, 1]) {
    const cap = sleeveRing(frame, fig, side, 0);
    fillDisk(pen, frame, map, cap.center, cap.right, cap.fwd, cap.rx, cap.rz, top);
  }
}

/** Short torso mesh. Texture v still runs the whole plate; the hem stops at `wrap`. */
function drawWrap(
  pen: CanvasRenderingContext2D,
  plate: PlateDef,
  fig: ReturnType<typeof solveIdle>,
  frame: ReturnType<typeof gearFrame>,
  map: (p: Pt) => Pt,
): void {
  const vend = Math.min(1, Math.max(0.05, plate.wrap));
  const paint = (front: boolean) => {
    const at = (col: number, row: number) => {
      const u = col / (SHEET_COLS - 1);
      const tv = row / (SHEET_ROWS - 1);
      return { p: map(screen(sheetPoint(frame, fig, u, tv * vend, front), frame)), u, v: tv };
    };
    for (let row = 0; row < SHEET_ROWS - 1; row++) {
      for (let col = 0; col < SHEET_COLS - 1; col++) {
        const a = at(col, row);
        const b = at(col + 1, row);
        const c = at(col + 1, row + 1);
        const d = at(col, row + 1);
        fillCloth(pen, plate, a.p, b.p, c.p, [a.u, a.v], [b.u, b.v], [c.u, c.v]);
        fillCloth(pen, plate, a.p, c.p, d.p, [a.u, a.v], [c.u, c.v], [d.u, d.v]);
      }
    }
  };
  const top = inkCss(plate.rows[0]![Math.floor(plate.rows[0]!.length / 2)]!);
  const last = plate.rows[plate.rows.length - 1]!;
  const bottom = inkCss(last[Math.floor(last.length / 2)]!);
  paint(false);
  paint(true);
  const collar = ringAt(frame, fig, 0);
  fillDisk(pen, frame, map, collar.center, frame.x, frame.z, collar.rx, collar.rz, top);
  const hem = ringAt(frame, fig, vend);
  fillDisk(pen, frame, map, hem.center, frame.x, frame.z, hem.rx, hem.rz, bottom);
}

function fillCloth(
  pen: CanvasRenderingContext2D,
  plate: PlateDef,
  a: Pt,
  b: Pt,
  c: Pt,
  ua: [number, number],
  ub: [number, number],
  uc: [number, number],
): void {
  const w = pen.canvas.width;
  const h = pen.canvas.height;
  const minX = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x)));
  const maxX = Math.min(w - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
  const minY = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y)));
  const maxY = Math.min(h - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
  const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  if (Math.abs(area) < 1e-4 || maxX < minX || maxY < minY) return;
  const img = pen.getImageData(minX, minY, maxX - minX + 1, maxY - minY + 1);
  const d = img.data;
  const iw = img.width;
  const inv = 1 / area;
  const cols = plate.rows[0]!.length;
  const rows = plate.rows.length;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const w0 = ((b.x - px) * (c.y - py) - (b.y - py) * (c.x - px)) * inv;
      const w1 = ((c.x - px) * (a.y - py) - (c.y - py) * (a.x - px)) * inv;
      const w2 = 1 - w0 - w1;
      if (w0 < -1e-3 || w1 < -1e-3 || w2 < -1e-3) continue;
      const u = Math.min(0.9999, Math.max(0, w0 * ua[0] + w1 * ub[0] + w2 * uc[0]));
      const v = Math.min(0.9999, Math.max(0, w0 * ua[1] + w1 * ub[1] + w2 * uc[1]));
      const cell = plate.rows[(v * rows) | 0]![(u * cols) | 0]!;
      const ink = PLATE_INK[cell] ?? [0x7d, 0x74, 0x86];
      const i = ((y - minY) * iw + (x - minX)) << 2;
      d[i] = ink[0];
      d[i + 1] = ink[1];
      d[i + 2] = ink[2];
      d[i + 3] = 255;
    }
  }
  pen.putImageData(img, minX, minY);
}

/** Paint the front-face grid onto gear pixels the chest quad covers. */
function stampPlate(
  pen: CanvasRenderingContext2D,
  plate: PlateDef,
  frame: ReturnType<typeof gearFrame>,
  map: (p: Pt) => Pt,
  at: (p: Triple) => Vec3,
): void {
  const proj = (x: number, y: number) => map(screen(at([x, y, plate.z]), frame));
  const tl = proj(plate.x0, plate.y1);
  const tr = proj(plate.x1, plate.y1);
  const br = proj(plate.x1, plate.y0);
  const bl = proj(plate.x0, plate.y0);
  const w = pen.canvas.width;
  const h = pen.canvas.height;
  const img = pen.getImageData(0, 0, w, h);
  const d = img.data;
  const cols = plate.rows[0]!.length;
  const rows = plate.rows.length;
  const tri = (a: Pt, b: Pt, c: Pt, ua: [number, number], ub: [number, number], uc: [number, number]) => {
    const minX = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x)));
    const maxX = Math.min(w - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
    const minY = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y)));
    const maxY = Math.min(h - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
    const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if (Math.abs(area) < 1e-4) return;
    const inv = 1 / area;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const w0 = ((b.x - px) * (c.y - py) - (b.y - py) * (c.x - px)) * inv;
        const w1 = ((c.x - px) * (a.y - py) - (c.y - py) * (a.x - px)) * inv;
        const w2 = 1 - w0 - w1;
        if (w0 < -1e-3 || w1 < -1e-3 || w2 < -1e-3) continue;
        const i = (y * w + x) << 2;
        if (d[i + 3]! <= 16) continue;
        const u = Math.min(0.9999, Math.max(0, w0 * ua[0] + w1 * ub[0] + w2 * uc[0]));
        const v = Math.min(0.9999, Math.max(0, w0 * ua[1] + w1 * ub[1] + w2 * uc[1]));
        const cell = plate.rows[(v * rows) | 0]![(u * cols) | 0]!;
        const ink = PLATE_INK[cell];
        if (!ink) continue;
        d[i] = ink[0];
        d[i + 1] = ink[1];
        d[i + 2] = ink[2];
        d[i + 3] = 255;
      }
    }
  };
  tri(tl, tr, br, [0, 0], [1, 0], [1, 1]);
  tri(tl, br, bl, [0, 0], [1, 1], [0, 1]);
  pen.putImageData(img, 0, 0);
}

paint();
