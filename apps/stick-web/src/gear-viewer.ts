import {
  BONES, HEIGHT_PX, RAMP, type GearDef, type GearShape, type PlateDef, type Triple, type Vec3,
  add, cross, dot, gearFrame, mul, norm, parseGear, parsePlate, projectIso, solveIdle, solveWalk, sub, toWorld, vlen,
} from "./gear-ron.ts";
import { PREVIEW_KEY } from "./gear-ron-write.ts";
import { drawPixelAxePlaneForGearId, PIXEL_AXE_GEAR_IDS, pixelAxeBounds } from "./pixel-axe.ts";
import { applyViewerMeshAlias } from "./gear-viewer-mesh.ts";
import {
  PIXEL_SWORD_GEAR_IDS,
  SWORD_ART_COLORS,
  pixelSwordBounds,
  swordArtForGearId,
  swordLayoutForGearId,
  swordMeshMaterial,
  type SwordArt,
  type SwordLayout,
} from "./pixel-sword.ts";

type Item = { name: string; src: string; gear?: GearDef; error?: string };

/** Pointed cloth hat stack; per-item plate only. */
const CLOTH_HAT_GEAR_IDS = new Set(["ba_cloth_hat", "ba_silk_hat", "ba_velvet_hat"]);

/** Bandana mesh (brow, crown drape, knot, tails); per-item plate only. */
const BANDANA_GEAR_IDS = new Set([
  "ba_leather_bandana",
  "ba_linen_helm",
  "ba_fine_jerkin_helm",
  "ba_shade_leather_bandana",
  "ba_skull_bandana",
]);

/** Forehead ring stack (shared mesh, per-item plate). */
const FOREHEAD_RING_GEAR_IDS = new Set([
  "ba_headband",
  "ba_bell_torque_band",
  "ba_circlet",
  "ba_mythril_torque",
]);
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

const urlParams = new URLSearchParams(location.search);
const embed = urlParams.has("embed");
/** Wiki embed: draw the gear mesh only, no stick figure. */
const gearOnly = urlParams.has("gearOnly") || embed;
if (embed) document.documentElement.classList.add("embed");

function bundledSrcForGearId(want: string): string | undefined {
  const base = want.replace(/\.ron$/i, "");
  for (const [path, src] of Object.entries(bundled)) {
    if (path.endsWith(".plate.ron")) continue;
    if (path.endsWith(`/${base}.ron`) || path.endsWith(`\\${base}.ron`)) return src;
  }
  return undefined;
}

function gearDefById(id: string): GearDef | undefined {
  const src = bundledSrcForGearId(id);
  if (!src) return undefined;
  try {
    return parseGear(src);
  } catch {
    return undefined;
  }
}

function gearForViewer(raw: GearDef): GearDef {
  return applyViewerMeshAlias(raw, gearDefById);
}

function indexForGearId(want: string): number {
  if (!want) return -1;
  const byPath = bundledSrcForGearId(want);
  if (byPath) {
    const idx = items.findIndex((it) => it.src === byPath);
    if (idx >= 0) return idx;
  }
  for (let i = 0; i < items.length; i++) {
    if (load(items[i]!)?.id === want) return i;
  }
  const base = want.replace(/\.ron$/i, "");
  for (let i = 0; i < items.length; i++) {
    const name = items[i]!.name;
    if (name === `${base}.ron` || name.endsWith(`/${base}.ron`)) return i;
  }
  return -1;
}

let current = 0;
let mode: Mode = gearOnly ? "front" : "figure";
let yaw = 0.6;
let selected = -1;
/** Wiki embed asked for a gear id that is not in the bundled list (stale dev server, typo). */
let urlPinMissing: string | null = null;

const list = document.querySelector("#list") as HTMLUListElement | null;
const meta = document.querySelector("#meta") as HTMLElement | null;
const canvas = document.querySelector("#view") as HTMLCanvasElement;
const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
const drop = document.querySelector("#drop") as HTMLElement | null;

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
  if (!list) return;
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
  const firstGear = listFiles.find((f) => !f.name.endsWith(".plate.ron"))?.name;
  let left = listFiles.length;
  for (const file of listFiles) {
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result ?? "");
      const name = file.name;
      if (name.endsWith(".plate.ron")) {
        try {
          const plate = parsePlate(src);
          plates.set(plate.id, plate);
        } catch {
          /* a bad plate just draws the bare shapes */
        }
      } else {
        const existing = items.findIndex((it) => it.name === name);
        const item: Item = { name, src };
        if (existing >= 0) items[existing] = item;
        else items.unshift(item);
      }
      left--;
      if (left === 0) {
        if (firstGear) current = items.findIndex((it) => it.name === firstGear);
        selected = -1;
        paint();
      }
    };
    reader.readAsText(file);
  }
}

drop?.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("hot"); });
drop?.addEventListener("dragleave", () => drop.classList.remove("hot"));
drop?.addEventListener("drop", (e) => {
  e.preventDefault();
  drop.classList.remove("hot");
  if (e.dataTransfer?.files) readFiles(e.dataTransfer.files);
});
document.querySelector("#file")?.addEventListener("change", (e) => {
  const input = e.target as HTMLInputElement;
  if (input.files) readFiles(input.files);
});

for (const btn of document.querySelectorAll<HTMLButtonElement>("[data-mode]")) {
  btn.addEventListener("click", () => {
    mode = btn.dataset.mode as Mode;
    paint();
  });
}
const yawInput = document.querySelector("#yaw") as HTMLInputElement | null;
const yawRead = document.querySelector("#yaw-read") as HTMLElement | null;
function setYaw(next: number): void {
  yaw = next;
  const deg = ((yaw * 180) / Math.PI) % 360;
  const shown = (deg + 360) % 360;
  if (yawInput) yawInput.value = String(shown);
  if (yawRead) yawRead.textContent = `${Math.round(shown)}°`;
}
yawInput?.addEventListener("input", () => {
  setYaw((Number(yawInput.value) * Math.PI) / 180);
  if (!gearOnly && mode !== "figure") mode = "figure";
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
const walkBtn = document.querySelector("#walk") as HTMLButtonElement | null;

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

walkBtn?.addEventListener("click", () => {
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
  if (urlPinMissing) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#221f2a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#e8e2d0";
    ctx.font = "13px ui-monospace, Consolas, monospace";
    ctx.fillText(`Gear not found: ${urlPinMissing}`, 16, 28);
    ctx.fillStyle = "#7d7486";
    ctx.fillText("Restart stick-web dev server if this gear was just added.", 16, 48);
    if (gearOnly) document.title = urlPinMissing;
    return;
  }
  if (!it || !gear) {
    if (meta) meta.textContent = it?.error ?? "Drop a .ron gear file.";
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }
  const viewGear = gearForViewer(gear);
  if (!meta) {
    if (gearOnly) document.title = viewGear.id;
    draw(viewGear, plates.get(viewGear.id), figureNow());
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
  draw(viewGear, plates.get(viewGear.id), figureNow());
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
  const showBody =
    !gearOnly &&
    (mode === "figure" || gear.attach === "chest" || gear.attach === "head" || gear.attach === "pelvis");
  const samples: Pt[] = [];
  const put = (p: Vec3) => {
    const s = screen(p, frame);
    samples.push(s);
    return s;
  };
  if (showBody) for (const j of Object.values(fig.joints)) put(j);
  else put(frame.o);
  if (CLOTH_HAT_GEAR_IDS.has(gear.id)) {
    for (const [y, r] of [[0.58, 0.02], [0.07, 0.32]] as Array<[number, number]>) {
      put(toWorld(frame, [0, y, 0]));
      put(toWorld(frame, [r, y, 0]));
      put(toWorld(frame, [-r, y, 0]));
    }
  }
  if (BANDANA_GEAR_IDS.has(gear.id)) {
    const hf = headNeckFrame(fig);
    for (const y of [0.11, 0.015, -0.07]) {
      put(toWorld(hf, [0, y, -0.02]));
      put(toWorld(hf, [-0.06, y, 0.1]));
      put(toWorld(hf, [0.06, y, 0.1]));
    }
  } else if (FOREHEAD_RING_GEAR_IDS.has(gear.id)) {
    const hf = headNeckFrame(fig);
    for (const y of [0.06, 0.015]) {
      const r = Math.sqrt(Math.max(0.0004, 0.13 * 0.13 - y * y)) + 0.006;
      put(toWorld(hf, [0, y, 0]));
      put(toWorld(hf, [r, y, 0]));
      put(toWorld(hf, [-r, y, 0]));
      put(toWorld(hf, [0, y, r]));
    }
  }
  /** Wiki embed: tier helms have no visible capsules — frame to the painted shell. */
  if (gear.id.endsWith("_helm") && embed) {
    const R = 0.22;
    for (const y of [0.17, 0.08, 0, -0.04]) {
      put(toWorld(frame, [0, y, 0]));
      put(toWorld(frame, [R, y, 0]));
      put(toWorld(frame, [-R, y, 0]));
      put(toWorld(frame, [0, y, R]));
      put(toWorld(frame, [0, y, -R]));
    }
  }
  if (gear.id === "ba_iron_shield") {
    for (const p of [[0.24, 0.04, 0.16], [-0.24, 0.04, 0.16], [0, 0.04, 0.4], [0, 0.04, -0.08]] as Triple[]) {
      put(toWorld(frame, p));
    }
  }
  if (gear.id === "ba_kite_shield") {
    for (const [x, z] of kiteOutline()) put(toWorld(frame, [x, 0.04, z]));
  }
  if (PIXEL_SWORD_GEAR_IDS.has(gear.id)) {
    for (const p of pixelSwordBounds(gear.id)) put(toWorld(frame, p));
  }
  if (gear.id === "ba_iron_shovel") {
    for (const p of [[0, -0.16, 0], [-0.16, 0.88, 0], [0.16, 0.88, 0]] as Triple[]) put(toWorld(frame, p));
  }
  if (gear.id === "ba_iron_pickaxe") {
    for (const p of [[0, -0.16, 0], [-0.32, 0.66, 0], [0.18, 0.64, 0]] as Triple[]) put(toWorld(frame, p));
  }
  if (PIXEL_AXE_GEAR_IDS.has(gear.id)) {
    for (const p of pixelAxeBounds(gear.id)) put(toWorld(frame, p));
  }
  if (gear.id === "ba_iron_cuisses") {
    for (const side of [0, 1]) {
      for (let ring = 0; ring < CUISSE_T.length + 1; ring++) {
        put(cuissePoint(fig, side, ring, 0));
        put(cuissePoint(fig, side, ring, 0.5));
        put(cuissePoint(fig, side, ring, 1));
      }
    }
  }
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
  } else if (!gearOnly) {
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

  const octx = layerContext(w, h);
  octx.clearRect(0, 0, w, h);
  octx.lineCap = "round";
  octx.lineJoin = "round";
  const fabric = (plate?.flow ?? 0) > 0;
  const wrap = plate?.wrap ?? 0;
  if (plate && fabric) drawFabric(octx, plate, fig, frame, map);
  else if (plate && wrap > 0) drawWrap(octx, plate, fig, frame, map);
  if (gear.id.endsWith("_helm") && plate) drawHelm(octx, plate, frame, map);
  else if (CLOTH_HAT_GEAR_IDS.has(gear.id) && plate) drawHat(octx, plate, frame, map);
  else if (BANDANA_GEAR_IDS.has(gear.id) && plate) drawLeatherBandana(octx, plate, headNeckFrame(fig), map);
  else if (FOREHEAD_RING_GEAR_IDS.has(gear.id) && plate) drawHeadband(octx, plate, headNeckFrame(fig), map);
  else if (gear.id === "ba_iron_shield" && plate) {
    for (const sh of gear.shapes) strokeShape(octx, sh, fig, frame, map, fit, false, at, gear.material);
    drawShield(octx, plate, frame, map);
  } else if (gear.id === "ba_kite_shield" && plate) {
    for (const sh of gear.shapes) strokeShape(octx, sh, fig, frame, map, fit, false, at, gear.material);
    drawKite(octx, frame, map);
  } else if (gear.id === "ba_iron_cuisses" && plate) {
    drawCuisses(octx, plate, fig, frame, map);
  } else if (PIXEL_SWORD_GEAR_IDS.has(gear.id)) {
    const art = swordArtForGearId(gear.id) ?? "iron";
    const meshMat = swordMeshMaterial(gear.id, gear.material);
    for (const sh of gear.shapes) strokeShape(octx, sh, fig, frame, map, fit, false, at, meshMat);
    drawSword(octx, frame, map, fit, art, swordLayoutForGearId(gear.id));
  } else if (gear.id === "ba_iron_shovel") {
    drawShovel(octx, frame, map, fit);
  } else if (gear.id === "ba_iron_pickaxe") {
    drawPick(octx, frame, map, fit);
  } else if (PIXEL_AXE_GEAR_IDS.has(gear.id)) {
    for (const sh of gear.shapes) strokeShape(octx, sh, fig, frame, map, fit, false, at, gear.material);
    drawPixelAxe(octx, frame, map, fit, gear.id);
  } else if (!fabric) {
    const ordered = gear.shapes.map((sh, i) => ({ sh, i, d: depthOf(sh, fig, frame, at) }));
    const order = gear.id.endsWith("_helm") ? ordered : ordered.sort((a, b) => a.d - b.d);
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
  paintSilhouette(ctx, layerCanvas);
  ctx.drawImage(layerCanvas, 0, 0);
}

const layerCanvas = document.createElement("canvas");
const edgeCanvas = document.createElement("canvas");
let layerCtx: CanvasRenderingContext2D | null = null;
let edgeCtx: CanvasRenderingContext2D | null = null;

const readback2d = { willReadFrequently: true } as const;

function layerContext(w: number, h: number): CanvasRenderingContext2D {
  if (layerCanvas.width !== w || layerCanvas.height !== h) {
    layerCanvas.width = w;
    layerCanvas.height = h;
    layerCtx = null;
  }
  layerCtx ??= layerCanvas.getContext("2d", readback2d);
  if (!layerCtx) throw new Error("layer canvas 2d unavailable");
  return layerCtx;
}

function edgeContext(w: number, h: number): CanvasRenderingContext2D {
  if (edgeCanvas.width !== w || edgeCanvas.height !== h) {
    edgeCanvas.width = w;
    edgeCanvas.height = h;
    edgeCtx = null;
  }
  edgeCtx ??= edgeCanvas.getContext("2d", readback2d);
  if (!edgeCtx) throw new Error("edge canvas 2d unavailable");
  return edgeCtx;
}

/** One pixel of outline where empty space touches the gear, not between its parts. */
function paintSilhouette(dest: CanvasRenderingContext2D, src: HTMLCanvasElement): void {
  const w = src.width;
  const h = src.height;
  const read = layerContext(w, h).getImageData(0, 0, w, h);
  const d = read.data;
  const ectx = edgeContext(w, h);
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
  if (material === "darksteel" && ramp === "Material") return "#0d0b14";
  if (material === "decayed" && ramp === "Material") return "#18161f";
  if (material === "decayed" && ramp === "Trim") return "#18161f";
  if (material === "mythril" && ramp === "Material") return "#f4f7ff";
  if (material === "orichalcum" && ramp === "Material") return "#c8ccd4";
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
  o: [0xb8, 0x92, 0x4a],
  w: [0xf4, 0xf7, 0xff],
  n: [0x5f, 0xc4, 0xe8],
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
  const capInk = PLATE_INK[plate.rows[0]![0]!] ?? [0xd9, 0xa4, 0x41];
  const capHex = `#${capInk.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
  fillDisk(pen, frame, map, toWorld(frame, turn(cap.c)), axis(cap.right), axis(cap.fwd), cap.rx, cap.rz, capHex);
}

/** Shield face. Concentric strips in a plane. The boss is a filled gold disk, not a billboard. */
function drawShield(
  pen: CanvasRenderingContext2D,
  plate: PlateDef,
  frame: ReturnType<typeof gearFrame>,
  map: (p: Pt) => Pt,
): void {
  const center: Triple = [0, 0.04, 0.16];
  const radii = [0.05, 0.11, 0.17, 0.24];
  const right: Triple = [1, 0, 0];
  const fwd: Triple = [0, 0, 1];
  const steps = 24;
  type Disk = { c: Triple; right: Triple; fwd: Triple; rx: number; rz: number };
  const disks: Disk[] = radii.map((r) => ({ c: center, right, fwd, rx: r, rz: r }));
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
      const pa = map(screen(toWorld(frame, a), frame));
      const pb = map(screen(toWorld(frame, b), frame));
      const pc = map(screen(toWorld(frame, c), frame));
      const pd = map(screen(toWorld(frame, d), frame));
      fillCloth(pen, plate, pa, pb, pc, [u0, v0], [u1, v0], [u1, v1]);
      fillCloth(pen, plate, pa, pc, pd, [u0, v0], [u1, v1], [u0, v1]);
    }
  }
  const boss = disks[0]!;
  const axis = (a: Triple): Vec3 => add(mul(frame.x, a[0]), add(mul(frame.y, a[1]), mul(frame.z, a[2])));
  fillDisk(pen, frame, map, toWorld(frame, boss.c), axis(boss.right), axis(boss.fwd), boss.rx, boss.rz, "#d9a441");
}

const KITE_Y = 0.04;
const KITE_TOP = 0.5;
const KITE_BOT = -0.56;
const KITE_HALF = 0.32;
const KITE_RIM = 0.06;

function kiteHalf(v: number): number {
  const shoulder = 0.22;
  const corner = 0.06;
  const round = v < corner ? 0.94 + 0.06 * (1 - (1 - v / corner) ** 2) : 1;
  const taper = v <= shoulder ? 1 : (1 - v) / (1 - shoulder);
  return KITE_HALF * round * taper;
}

/** Closed (x, z) loop. Top-left, down to the point, up to the top-right. */
function kiteOutline(): Array<[number, number]> {
  const n = 16;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= n; i++) {
    const v = i / n;
    pts.push([-kiteHalf(v), KITE_TOP + (KITE_BOT - KITE_TOP) * v]);
  }
  for (let i = n - 1; i >= 0; i--) {
    const v = i / n;
    pts.push([kiteHalf(v), KITE_TOP + (KITE_BOT - KITE_TOP) * v]);
  }
  return pts;
}

function kiteInset(pts: Array<[number, number]>, dist: number): Array<[number, number]> {
  const n = pts.length;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % n]!;
    area += p[0] * q[1] - q[0] * p[1];
  }
  const sign = area > 0 ? 1 : -1;
  const norm = (x: number, z: number): [number, number] => {
    const len = Math.max(1e-6, Math.hypot(x, z));
    return [x / len, z / len];
  };
  const out: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const prev = pts[(i + n - 1) % n]!;
    const cur = pts[i]!;
    const next = pts[(i + 1) % n]!;
    const d0 = norm(cur[0] - prev[0], cur[1] - prev[1]);
    const d1 = norm(next[0] - cur[0], next[1] - cur[1]);
    const n0: [number, number] = [-d0[1] * sign, d0[0] * sign];
    const n1: [number, number] = [-d1[1] * sign, d1[0] * sign];
    let nx = n0[0] + n1[0];
    let nz = n0[1] + n1[1];
    const len = Math.max(1e-6, Math.hypot(nx, nz));
    nx /= len;
    nz /= len;
    const align = Math.max(0.25, n0[0] * nx + n0[1] * nz);
    const m = Math.min(dist / align, dist * 3.2);
    out.push([cur[0] + nx * m, cur[1] + nz * m]);
  }
  return out;
}

/** Kite face. Steel field, gold rim of even thickness, gold cross. Not a billboard. */
function drawKite(
  pen: CanvasRenderingContext2D,
  frame: ReturnType<typeof gearFrame>,
  map: (p: Pt) => Pt,
): void {
  const outer = kiteOutline();
  const inner = kiteInset(outer, KITE_RIM);
  const at = (x: number, z: number): Pt => map(screen(toWorld(frame, [x, KITE_Y, z]), frame));
  const loop = (pts: Array<[number, number]>) => {
    pts.forEach(([x, z], i) => {
      const p = at(x, z);
      if (i === 0) pen.moveTo(p.x, p.y);
      else pen.lineTo(p.x, p.y);
    });
    pen.closePath();
  };
  pen.fillStyle = "#9aa6b8";
  pen.beginPath();
  loop(outer);
  pen.fill();
  pen.fillStyle = "#d9a441";
  pen.beginPath();
  loop(outer);
  loop(inner);
  pen.fill("evenodd");
  const bars: Array<[number, number, number, number]> = [
    [-0.045, -0.08, 0.045, 0.4],
    [-0.15, 0.115, 0.15, 0.205],
  ];
  for (const [x0, z0, x1, z1] of bars) {
    const a = at(x0, z0);
    const b = at(x1, z0);
    const c = at(x1, z1);
    const d = at(x0, z1);
    pen.beginPath();
    pen.moveTo(a.x, a.y);
    pen.lineTo(b.x, b.y);
    pen.lineTo(c.x, c.y);
    pen.lineTo(d.x, d.y);
    pen.closePath();
    pen.fill();
  }
}

const CUISSE_T = [0, 0.22, 0.46, 0.68, 0.9];
const CUISSE_R = [0.108, 0.096, 0.084, 0.074, 0.064];
const CUISSE_HIP_R = 0.13;
const CUISSE_HIP_LIFT = 0.13;
const CUISSE_HIP_OUT = 0.04;
const CUISSE_ANG0 = -0.45;
const CUISSE_SWEEP = 4.6;
const CUISSE_STEPS = 12;

function bodyForward(fig: ReturnType<typeof solveIdle>): Vec3 {
  const right = norm(sub(fig.joints.r_hip!, fig.joints.l_hip!));
  const up = norm(sub(fig.joints.chest!, fig.joints.pelvis!));
  const fwd = cross(right, up);
  return vlen(fwd) < 0.5 ? { x: 0, y: 0, z: 1 } : norm(fwd);
}

function cuissePoint(fig: ReturnType<typeof solveIdle>, side: number, ring: number, u: number): Vec3 {
  const hip = fig.joints[side === 0 ? "l_hip" : "r_hip"]!;
  const knee = fig.joints[side === 0 ? "l_knee" : "r_knee"]!;
  const along = norm(sub(knee, hip));
  const fwd = bodyForward(fig);
  let front = sub(fwd, mul(along, dot(fwd, along)));
  if (vlen(front) < 0.25) {
    const up = sub({ x: 0, y: 1, z: 0 }, mul(along, dot({ x: 0, y: 1, z: 0 }, along)));
    front = vlen(up) > 0.25 ? up : { x: 1, y: 0, z: 0 };
  }
  front = norm(front);
  const right = norm(cross(front, along));
  const outward = side === 0 ? mul(right, -1) : right;
  const up = norm(sub(fig.joints.chest!, fig.joints.pelvis!));
  const ang = CUISSE_ANG0 + u * CUISSE_SWEEP;
  const center = ring === 0
    ? add(add(hip, mul(up, CUISSE_HIP_LIFT)), mul(outward, CUISSE_HIP_OUT))
    : add(hip, mul(sub(knee, hip), CUISSE_T[ring - 1]!));
  const radius = ring === 0 ? CUISSE_HIP_R : CUISSE_R[ring - 1]!;
  return add(center, add(mul(front, Math.cos(ang) * radius), mul(outward, Math.sin(ang) * radius)));
}

/** Blade, plate, and the triangle. The grip and the guard are the capsules. */
function drawSword(
  pen: CanvasRenderingContext2D,
  frame: ReturnType<typeof gearFrame>,
  map: (p: Pt) => Pt,
  fit: number,
  art: SwordArt = "iron",
  lay: SwordLayout = swordLayoutForGearId("ba_iron_sword"),
): void {
  const colors = SWORD_ART_COLORS[art];
  const { blade, edge, plate, grip, guard } = colors;
  const at = (x: number, y: number): Pt => map(screen(toWorld(frame, [x, y, 0]), frame));
  const bh = lay.bladeHalf;
  const bs = lay.bladeStart;
  const be = lay.bladeEnd;
  const pt = lay.point;
  const quad = (x0: number, y0: number, x1: number, y1: number, color: string) => {
    const a = at(x0, y0);
    const b = at(x1, y0);
    const c = at(x1, y1);
    const d = at(x0, y1);
    pen.fillStyle = color;
    pen.beginPath();
    pen.moveTo(a.x, a.y);
    pen.lineTo(b.x, b.y);
    pen.lineTo(c.x, c.y);
    pen.lineTo(d.x, d.y);
    pen.closePath();
    pen.fill();
  };
  const tri = (x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, color: string) => {
    const a = at(x0, y0);
    const b = at(x1, y1);
    const c = at(x2, y2);
    pen.fillStyle = color;
    pen.beginPath();
    pen.moveTo(a.x, a.y);
    pen.lineTo(b.x, b.y);
    pen.lineTo(c.x, c.y);
    pen.closePath();
    pen.fill();
  };
  const line = (x0: number, y0: number, x1: number, y1: number, color: string, width: number) => {
    const a = at(x0, y0);
    const b = at(x1, y1);
    pen.strokeStyle = color;
    pen.lineWidth = Math.max(1, width * fit);
    pen.beginPath();
    pen.moveTo(a.x, a.y);
    pen.lineTo(b.x, b.y);
    pen.stroke();
  };
  if (grip) line(0, lay.gripStart, 0, lay.gripEnd, grip, 2.0);
  if (guard && lay.crossguard) line(-lay.guardHalf, lay.guardY, lay.guardHalf, lay.guardY, guard, 1.6);
  quad(-bh, bs, bh, pt, blade);
  tri(-bh, pt, bh, pt, 0, be, blade);
  line(-bh, bs, -bh, pt, edge, 0.45);
  line(-bh, pt, 0, be, edge, 0.45);
  line(bh, bs, bh, pt, edge, 0.45);
  line(bh, pt, 0, be, edge, 0.45);
  line(0, bs + 0.04, 0, pt - 0.02, "#18161f", 0.4);
  if (lay.crossguard) {
    quad(-lay.plateHalf, lay.guardY - 0.034, lay.plateHalf, lay.guardY + 0.034, plate);
    line(0, 0.106, -0.028, 0.058, "#0d0b14", 0.45);
    line(-0.028, 0.058, 0.028, 0.058, "#0d0b14", 0.45);
    line(0.028, 0.058, 0, 0.106, "#0d0b14", 0.45);
  }
  const gripSpan = lay.gripEnd - lay.gripStart;
  if (gripSpan > 0.18 * 1.2) {
    const off = at(0, lay.gripStart + gripSpan * 0.3);
    const r = Math.max(1.2, 2.4 * fit);
    pen.fillStyle = "#c8a882";
    pen.beginPath();
    pen.arc(off.x, off.y, r, 0, Math.PI * 2);
    pen.fill();
  }
}

const WOOD = "#6c5a42";
const STEEL = "#9aa6b8";
const GOLD = "#d9a441";

/** Wood shaft and a steel scoop, wide at the mouth. */
function drawShovel(
  pen: CanvasRenderingContext2D,
  frame: ReturnType<typeof gearFrame>,
  map: (p: Pt) => Pt,
  fit: number,
): void {
  const at = (x: number, y: number): Pt => map(screen(toWorld(frame, [x, y, 0]), frame));
  const shaft = (y0: number, y1: number, color: string, width: number) => {
    const a = at(0, y0);
    const b = at(0, y1);
    pen.strokeStyle = color;
    pen.lineWidth = Math.max(1, width * fit);
    pen.beginPath();
    pen.moveTo(a.x, a.y);
    pen.lineTo(b.x, b.y);
    pen.stroke();
  };
  const tri = (pts: Array<[number, number]>, color: string) => {
    pen.fillStyle = color;
    pen.beginPath();
    pts.forEach(([x, y], i) => {
      const s = at(x, y);
      if (i === 0) pen.moveTo(s.x, s.y);
      else pen.lineTo(s.x, s.y);
    });
    pen.closePath();
    pen.fill();
  };
  const edge = (x0: number, y0: number, x1: number, y1: number) => {
    const a = at(x0, y0);
    const b = at(x1, y1);
    pen.strokeStyle = GOLD;
    pen.lineWidth = Math.max(1, 0.45 * fit);
    pen.beginPath();
    pen.moveTo(a.x, a.y);
    pen.lineTo(b.x, b.y);
    pen.stroke();
  };
  shaft(-0.16, 0.56, WOOD, 3.2);
  tri([[-0.045, 0.54], [0.045, 0.54], [0.16, 0.88]], STEEL);
  tri([[-0.045, 0.54], [0.16, 0.88], [-0.16, 0.88]], STEEL);
  edge(-0.045, 0.54, -0.16, 0.88);
  edge(-0.16, 0.88, 0.16, 0.88);
  edge(0.16, 0.88, 0.045, 0.54);
}

function drawPixelAxe(
  pen: CanvasRenderingContext2D,
  frame: ReturnType<typeof gearFrame>,
  map: (p: Pt) => Pt,
  fit: number,
  gearId: string,
): void {
  const at = (x: number, y: number): Pt => map(screen(toWorld(frame, [x, y, 0]), frame));
  drawPixelAxePlaneForGearId(pen, at, fit, gearId);
}

/** Wood shaft and a steel head: a long point and a short chisel. */
function drawPick(
  pen: CanvasRenderingContext2D,
  frame: ReturnType<typeof gearFrame>,
  map: (p: Pt) => Pt,
  fit: number,
): void {
  const at = (x: number, y: number): Pt => map(screen(toWorld(frame, [x, y, 0]), frame));
  const a = at(0, -0.16);
  const b = at(0, 0.62);
  pen.strokeStyle = WOOD;
  pen.lineWidth = Math.max(1, 3.2 * fit);
  pen.beginPath();
  pen.moveTo(a.x, a.y);
  pen.lineTo(b.x, b.y);
  pen.stroke();
  const tri = (pts: Array<[number, number]>) => {
    pen.fillStyle = STEEL;
    pen.beginPath();
    pts.forEach(([x, y], i) => {
      const s = at(x, y);
      if (i === 0) pen.moveTo(s.x, s.y);
      else pen.lineTo(s.x, s.y);
    });
    pen.closePath();
    pen.fill();
  };
  tri([[0, 0.56], [0, 0.72], [-0.32, 0.66]]);
  tri([[0, 0.56], [0, 0.72], [0.18, 0.64]]);
  pen.strokeStyle = GOLD;
  pen.lineWidth = Math.max(1, 0.45 * fit);
  for (const [x0, y0, x1, y1] of [[0, 0.72, -0.32, 0.66], [-0.32, 0.66, 0, 0.56], [0, 0.72, 0.18, 0.64], [0.18, 0.64, 0, 0.56]] as Array<[number, number, number, number]>) {
    const p0 = at(x0, y0);
    const p1 = at(x1, y1);
    pen.beginPath();
    pen.moveTo(p0.x, p0.y);
    pen.lineTo(p1.x, p1.y);
    pen.stroke();
  }
}

/** Shell over the hip and around the thigh. The inner thigh stays open. The knee stays clear. */
function drawCuisses(
  pen: CanvasRenderingContext2D,
  plate: PlateDef,
  fig: ReturnType<typeof solveIdle>,
  frame: ReturnType<typeof gearFrame>,
  map: (p: Pt) => Pt,
): void {
  const n = CUISSE_T.length + 1;
  for (const side of [0, 1]) {
    for (let i = 0; i < n - 1; i++) {
      const v0 = i / (n - 1);
      const v1 = (i + 1) / (n - 1);
      for (let step = 0; step < CUISSE_STEPS; step++) {
        const u0 = step / CUISSE_STEPS;
        const u1 = (step + 1) / CUISSE_STEPS;
        const proj = (ring: number, u: number) => map(screen(cuissePoint(fig, side, ring, u), frame));
        const a = proj(i, u0);
        const b = proj(i, u1);
        const c = proj(i + 1, u1);
        const d = proj(i + 1, u0);
        fillCloth(pen, plate, a, b, c, [u0, v0], [u1, v0], [u1, v1]);
        fillCloth(pen, plate, a, c, d, [u0, v0], [u1, v1], [u0, v1]);
      }
    }
  }
}

const HEADBAND_Y = [0.06, 0.045, 0.03, 0.015] as const;
const HEADBAND_SKIN = 0.13;

function headbandShellR(y: number): number {
  return Math.sqrt(Math.max(0.0004, HEADBAND_SKIN * HEADBAND_SKIN - y * y)) + 0.006;
}

function headNeckFrame(fig: ReturnType<typeof solveIdle>): ReturnType<typeof gearFrame> {
  const o = fig.joints.head!;
  const up = { x: 0, y: 1, z: 0 };
  let y = norm(sub(fig.joints.head!, fig.joints.neck!));
  let x = norm(cross(y, up));
  if (vlen(x) < 0.5) x = norm(cross(y, up));
  if (vlen(x) < 0.5) x = fig.right;
  const z = norm(cross(x, y));
  return { o, x, y, z };
}

/** Head-local mesh; 180° about Y so crown + knot match face/back (reference art). */
function bandanaDisk(cx: number, cy: number, cz: number, r: number): BandanaDisk {
  return { c: [-cx, cy, -cz], right: [-1, 0, 0], fwd: [0, 0, -1], rx: r, rz: r };
}

type BandanaDisk = { c: Triple; right: Triple; fwd: Triple; rx: number; rz: number };

function paintDiskChain(
  pen: CanvasRenderingContext2D,
  plate: PlateDef,
  frame: ReturnType<typeof gearFrame>,
  map: (p: Pt) => Pt,
  disks: BandanaDisk[],
): void {
  if (disks.length < 2) return;
  const steps = 16;
  const rim = (disk: BandanaDisk, u: number): Triple => {
    const ang = u * Math.PI * 2;
    const s = Math.sin(ang);
    const c = Math.cos(ang);
    return [
      disk.c[0] + disk.right[0] * s * disk.rx + disk.fwd[0] * c * disk.rz,
      disk.c[1] + disk.right[1] * s * disk.rx + disk.fwd[1] * c * disk.rz,
      disk.c[2] + disk.right[2] * s * disk.rx + disk.fwd[2] * c * disk.rz,
    ];
  };
  const proj = (p: Triple): Pt => {
    const pt = map(screen(toWorld(frame, p), frame));
    return p[2] > 0 ? { ...pt, d: pt.d - 0.5 } : pt;
  };
  for (let i = 0; i < disks.length - 1; i++) {
    const v0 = i / (disks.length - 1);
    const v1 = (i + 1) / (disks.length - 1);
    for (let col = 0; col < steps; col++) {
      const u0 = col / steps;
      const u1 = (col + 1) / steps;
      const a = rim(disks[i]!, u0);
      const b = rim(disks[i]!, u1);
      const c = rim(disks[i + 1]!, u1);
      const d = rim(disks[i + 1]!, u0);
      const pa = proj(a);
      const pb = proj(b);
      const pc = proj(c);
      const pd = proj(d);
      fillCloth(pen, plate, pa, pb, pc, [u0, v0], [u1, v0], [u1, v1]);
      fillCloth(pen, plate, pa, pc, pd, [u0, v0], [u1, v1], [u0, v1]);
    }
  }
}

/** Leather bandana: brow, crown drape, knot, and hanging tails. */
function drawLeatherBandana(
  pen: CanvasRenderingContext2D,
  plate: PlateDef,
  frame: ReturnType<typeof gearFrame>,
  map: (p: Pt) => Pt,
): void {
  const brow = HEADBAND_Y.map((y) => bandanaDisk(0, y, 0, headbandShellR(y)));
  const spine = [
    bandanaDisk(0, 0.058, 0.028, 0.072),
    bandanaDisk(0, 0.042, 0.058, 0.052),
    bandanaDisk(0, 0.024, 0.078, 0.036),
    bandanaDisk(0, 0.006, 0.092, 0.02),
  ];
  const wing = (side: number) => [
    bandanaDisk(side * 0.052, 0.052, 0.025, 0.038),
    bandanaDisk(side * 0.04, 0.035, 0.055, 0.028),
    bandanaDisk(side * 0.028, 0.018, 0.072, 0.02),
  ];
  const knot = bandanaDisk(0, 0.038, -0.128, 0.04);
  const tail = (side: number) => [
    bandanaDisk(side * 0.038, 0.012, -0.118, 0.03),
    bandanaDisk(side * 0.048, -0.028, -0.102, 0.026),
    bandanaDisk(side * 0.055, -0.068, -0.088, 0.022),
  ];
  const chains: BandanaDisk[][] = [
    brow,
    [brow[0]!, spine[0]!],
    spine,
    wing(-1),
    wing(1),
    [knot, tail(-1)[0]!],
    [knot, tail(1)[0]!],
    tail(-1),
    tail(1),
  ];
  for (let i = 0; i < 3; i++) {
    chains.push([spine[i]!, wing(-1)[i]!], [spine[i + 1]!, wing(-1)[i]!]);
    chains.push([spine[i]!, wing(1)[i]!], [spine[i + 1]!, wing(1)[i]!]);
  }
  for (const chain of chains) paintDiskChain(pen, plate, frame, map, chain);
}

/** Forehead headband. A short ring stack; no filled tip. */
function drawHeadband(
  pen: CanvasRenderingContext2D,
  plate: PlateDef,
  frame: ReturnType<typeof gearFrame>,
  map: (p: Pt) => Pt,
): void {
  const spec: Array<[number, number]> = HEADBAND_Y.map((y) => [y, headbandShellR(y)]);
  drawRingStack(pen, plate, frame, map, spec, false, undefined, (p) => (p[2] > 0 ? 0.5 : 0));
}

/** Pointed cloth hat. Strips run from the tip down to the brim. The face stays open. */
function drawHat(
  pen: CanvasRenderingContext2D,
  plate: PlateDef,
  frame: ReturnType<typeof gearFrame>,
  map: (p: Pt) => Pt,
): void {
  const spec: Array<[number, number]> = [
    [0.58, 0.02],
    [0.44, 0.07],
    [0.3, 0.12],
    [0.18, 0.15],
    [0.1, 0.16],
    [0.07, 0.32],
  ];
  drawRingStack(pen, plate, frame, map, spec, true);
}

function drawRingStack(
  pen: CanvasRenderingContext2D,
  plate: PlateDef,
  frame: ReturnType<typeof gearFrame>,
  map: (p: Pt) => Pt,
  spec: Array<[number, number]>,
  fillTip: boolean,
  skipLocal?: (p: Triple) => boolean,
  dBiasLocal?: (p: Triple) => number,
): void {
  const steps = 16;
  type Disk = { c: Triple; right: Triple; fwd: Triple; rx: number; rz: number };
  const disks: Disk[] = spec.map(([y, r]) => ({ c: [0, y, 0], right: [1, 0, 0], fwd: [0, 0, 1], rx: r, rz: r }));
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
      if (skipLocal && (skipLocal(a) || skipLocal(b) || skipLocal(c) || skipLocal(d))) continue;
      const proj = (p: Triple): Pt => {
        const pt = map(screen(toWorld(frame, p), frame));
        const bias = dBiasLocal?.(p) ?? 0;
        return bias ? { ...pt, d: pt.d - bias } : pt;
      };
      const pa = proj(a);
      const pb = proj(b);
      const pc = proj(c);
      const pd = proj(d);
      fillCloth(pen, plate, pa, pb, pc, [u0, v0], [u1, v0], [u1, v1]);
      fillCloth(pen, plate, pa, pc, pd, [u0, v0], [u1, v1], [u0, v1]);
    }
  }
  if (!fillTip) return;
  const tip = disks[0]!;
  const top = inkCss(plate.rows[0]![Math.floor(plate.rows[0]!.length / 2)]!);
  const axis = (a: Triple): Vec3 => add(mul(frame.x, a[0]), add(mul(frame.y, a[1]), mul(frame.z, a[2])));
  fillDisk(pen, frame, map, toWorld(frame, tip.c), axis(tip.right), axis(tip.fwd), tip.rx, tip.rz, top);
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

const DRAFT = "editor draft";
const bundledPlates = new Map(plates);

/** The gear editor's current item. It stays live while both pages are open. */
function readDraft(): { gear?: string; plate?: string } | null {
  try {
    return JSON.parse(localStorage.getItem(PREVIEW_KEY) ?? "null") as { gear?: string; plate?: string } | null;
  } catch {
    return null;
  }
}

function loadDraft(pick: boolean): void {
  const urlPinned = Boolean(gearOnly && gearIdFromUrl());
  const draft = readDraft();
  if (!draft?.gear) return;
  let id = "";
  try {
    id = parseGear(draft.gear).id;
  } catch {
    /* the list shows the parse error */
  }
  if (id) {
    let plate: PlateDef | undefined;
    try {
      plate = draft.plate ? parsePlate(draft.plate) : undefined;
    } catch {
      plate = undefined;
    }
    const fallback = bundledPlates.get(id);
    if (plate) plates.set(id, plate);
    else if (fallback) plates.set(id, fallback);
    else plates.delete(id);
  }
  const shown = items[current];
  const item: Item = { name: DRAFT, src: draft.gear };
  const at = items.findIndex((it) => it.name === DRAFT);
  if (at >= 0) items[at] = item;
  else items.unshift(item);
  if (pick || shown?.name === DRAFT) current = items.indexOf(item);
  else if (shown && !urlPinned) current = items.indexOf(shown);
}

function pinGearFromUrl(): boolean {
  const want = gearIdFromUrl();
  if (!want) return false;
  const idx = indexForGearId(want);
  if (idx < 0) {
    urlPinMissing = want;
    return false;
  }
  urlPinMissing = null;
  current = idx;
  selected = -1;
  return true;
}

function gearIdFromUrl(): string {
  const fromQuery = urlParams.get("gear")?.trim();
  if (fromQuery) return fromQuery;
  return decodeURIComponent(location.hash.replace(/^#/, "")).trim();
}

const pinnedFromUrl = gearIdFromUrl();
if (!pinGearFromUrl()) {
  if (!(gearOnly && pinnedFromUrl)) {
    current = Math.max(0, indexForGearId("ba_iron_greatsword"));
  }
}

loadDraft(new URLSearchParams(location.search).has("editor"));
if (gearIdFromUrl()) pinGearFromUrl();

window.addEventListener("storage", (e) => {
  if (e.key !== PREVIEW_KEY) return;
  loadDraft(false);
  if (gearIdFromUrl()) pinGearFromUrl();
  paint();
});
window.addEventListener("hashchange", () => {
  if (pinGearFromUrl()) paint();
});

paint();
