/** Front embed view of ba_bronze_axe → PNG. Usage: pnpm exec tsx scripts/snap-bronze-axe.ts [out.png] */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas } from "@napi-rs/canvas";
import { parseGear, gearFrame, HEIGHT_PX, solveIdle, toWorld, type Triple } from "../src/gear-ron.ts";
import { drawBronzeAxePlane, pixelAxeBounds } from "../src/pixel-axe.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ronPath = join(root, "../../engine/ba-stick-render/assets/gear/ba_bronze_axe.ron");
const gear = parseGear(readFileSync(ronPath, "utf8"));
const fig = solveIdle(0);
const frame = gearFrame(gear, fig);

type Pt = { x: number; y: number; d: number };
function screen(p: { x: number; y: number; z: number }): Pt {
  const d = { x: p.x - frame.o.x, y: p.y - frame.o.y, z: p.z - frame.o.z };
  const lx = d.x * frame.x.x + d.y * frame.x.y + d.z * frame.x.z;
  const ly = d.x * frame.y.x + d.y * frame.y.y + d.z * frame.y.z;
  const lz = d.x * frame.z.x + d.y * frame.z.y + d.z * frame.z.z;
  return { x: lx * HEIGHT_PX, y: -ly * HEIGHT_PX, d: lz };
}

const w = 320;
const h = 320;
const samples: Pt[] = [];
const put = (p: Triple) => samples.push(screen(toWorld(frame, p)));
for (const p of pixelAxeBounds(gear.id)) put(p);
for (const sh of gear.shapes) {
  put(sh.from);
  put(sh.to);
}
const minX = Math.min(...samples.map((p) => p.x));
const maxX = Math.max(...samples.map((p) => p.x));
const minY = Math.min(...samples.map((p) => p.y));
const maxY = Math.max(...samples.map((p) => p.y));
const fit = Math.min((w - 40) / Math.max(8, maxX - minX), (h - 40) / Math.max(8, maxY - minY));
const ox = w / 2 - ((minX + maxX) / 2) * fit;
const oy = h / 2 - ((minY + maxY) / 2) * fit;
const map = (p: Pt) => ({ x: ox + p.x * fit, y: oy + p.y * fit, d: p.d });
const at = (x: number, y: number) => map(screen(toWorld(frame, [x, y, 0])));

const canvas = createCanvas(w, h);
const ctx = canvas.getContext("2d");
ctx.fillStyle = "#221f2a";
ctx.fillRect(0, 0, w, h);
ctx.lineCap = "round";
ctx.lineJoin = "round";
const layer = createCanvas(w, h);
const octx = layer.getContext("2d");
octx.lineCap = "round";
octx.lineJoin = "round";
drawBronzeAxePlane(octx, at, fit);
const src = octx.getImageData(0, 0, w, h);
const d = src.data;
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (d[i + 3]! > 16) continue;
    const solid = (nx: number, ny: number) =>
      nx >= 0 && ny >= 0 && nx < w && ny < h && d[(ny * w + nx) * 4 + 3]! > 16;
    if (!solid(x - 1, y) && !solid(x + 1, y) && !solid(x, y - 1) && !solid(x, y + 1)) continue;
    d[i] = 0x0d;
    d[i + 1] = 0x0b;
    d[i + 2] = 0x14;
    d[i + 3] = 255;
  }
}
octx.putImageData(src, 0, 0);
ctx.drawImage(layer, 0, 0);

const out = process.argv[2] ?? join(root, "tmp-bronze-axe.png");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, canvas.toBuffer("image/png"));
console.log(out);
