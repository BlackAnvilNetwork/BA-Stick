/**
 * Item icon atlas for in-world sprites (#30): every PNG in
 * apps/stick-web/public/icons/items is chroma-keyed (magenta key, same rule as the
 * old client's `chroma.ts`), downsized to 16×16 with a hard alpha edge and a
 * dark 1px outline, and packed into public/zones/icons.png + icons.json
 * ({ slug: index }, 32 per row). HTML panels keep the full-size PNGs.
 */
import { readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { isMagentaKey } from "@bellgrave/ui/chroma-icons";
import { CATALOG } from "@bellgrave/items";

export const ICON = 16;
export const COLS = 32;

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, "../public/icons/items");
const OUT = join(here, "../public/zones");

async function icon(file: string): Promise<Buffer> {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    if (isMagentaKey(data[i]!, data[i + 1]!, data[i + 2]!)) data[i + 3] = 0;
  }
  const small = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .resize(ICON, ICON, { kernel: "lanczos3", fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .raw()
    .toBuffer();
  // hard alpha + outline
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < ICON && y < ICON && small[(y * ICON + x) * 4 + 3]! >= 128;
  const out = Buffer.alloc(ICON * ICON * 4);
  for (let y = 0; y < ICON; y++)
    for (let x = 0; x < ICON; x++) {
      const i = (y * ICON + x) * 4;
      if (solid(x, y)) {
        out[i] = small[i]!; out[i + 1] = small[i + 1]!; out[i + 2] = small[i + 2]!; out[i + 3] = 255;
      } else if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
        out[i] = 13; out[i + 1] = 11; out[i + 2] = 20; out[i + 3] = 255;
      }
    }
  return out;
}

async function main(): Promise<void> {
  const files = readdirSync(SRC).filter((f) => f.endsWith(".png")).sort();
  const rows = Math.ceil(files.length / COLS);
  const W = COLS * ICON, H = rows * ICON;
  const atlas = Buffer.alloc(W * H * 4);
  const index: Record<string, number> = {};
  for (const [n, f] of files.entries()) {
    const px = await icon(join(SRC, f));
    const ox = (n % COLS) * ICON, oy = Math.floor(n / COLS) * ICON;
    for (let y = 0; y < ICON; y++) px.copy(atlas, ((oy + y) * W + ox) * 4, y * ICON * 4, (y + 1) * ICON * 4);
    index[f.replace(/\.png$/, "")] = n;
  }
  // catalog slugs whose icon file has another name (old gatherIconUrl rule)
  for (const it of CATALOG) {
    const base = it.icon?.split("/").pop()?.replace(/\.png$/, "");
    if (base && index[base] !== undefined && index[it.slug] === undefined) index[it.slug] = index[base];
  }
  mkdirSync(OUT, { recursive: true });
  await sharp(atlas, { raw: { width: W, height: H, channels: 4 } }).png().toFile(join(OUT, "icons.png"));
  writeFileSync(join(OUT, "icons.json"), JSON.stringify({ size: ICON, cols: COLS, index }));
  console.log(`baked ${files.length} icons → ${W}x${H} atlas`);
}

void main();
