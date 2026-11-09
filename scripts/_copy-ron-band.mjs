import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const spec = JSON.parse(readFileSync(join(ROOT, "scripts/_non-smith-gear-ron-spec.json"), "utf8"));
const band = process.argv[2];
if (!band || !spec.bands[band]) {
  console.error("usage: node scripts/_copy-ron-band.mjs <band>");
  console.error("bands:", Object.keys(spec.bands).join(", "));
  process.exit(1);
}
const gearDir = join(ROOT, spec.gearDir);
const iconDir = join(ROOT, spec.iconDir);
const { visible, hidden } = spec.bands[band];

function destId(slug) {
  return "ba_" + slug.replace(/-/g, "_");
}

function copyRon(piece) {
  const dest = destId(piece.slug);
  const srcRon = join(gearDir, `${piece.copyRon}.ron`);
  const destRon = join(gearDir, `${dest}.ron`);
  if (!existsSync(srcRon)) throw new Error("missing source ron " + srcRon);
  let text = readFileSync(srcRon, "utf8");
  text = text.replaceAll(piece.copyRon, dest);
  writeFileSync(destRon, text, "utf8");
  if (piece.copyPlate) {
    const srcPlate = join(gearDir, `${piece.copyRon}.plate.ron`);
    const destPlate = join(gearDir, `${dest}.plate.ron`);
    if (!existsSync(srcPlate)) throw new Error("missing source plate " + srcPlate);
    let p = readFileSync(srcPlate, "utf8");
    p = p.replaceAll(piece.copyRon, dest);
    writeFileSync(destPlate, p, "utf8");
  }
  const srcIcon = join(iconDir, piece.copyIcon);
  const destIcon = join(iconDir, `${piece.slug}.png`);
  if (!existsSync(srcIcon)) throw new Error("missing source icon " + srcIcon);
  copyFileSync(srcIcon, destIcon);
  console.log("wrote", dest, piece.copyPlate ? "+plate" : "", piece.slug + ".png");
}

function copyHidden(piece) {
  const srcIcon = join(iconDir, piece.copyIcon);
  const destIcon = join(iconDir, `${piece.slug}.png`);
  if (!existsSync(srcIcon)) throw new Error("missing source icon " + srcIcon);
  copyFileSync(srcIcon, destIcon);
  console.log("icon", piece.slug + ".png");
}

for (const p of visible) copyRon(p);
for (const p of hidden) copyHidden(p);
console.log("band", band, "ok");
