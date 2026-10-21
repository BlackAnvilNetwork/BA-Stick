/**
 * Bake zone grids for ba-stick-render from the same @bellgrave/config functions the
 * server uses (biome, stand height, water, walkability, trails, bridges).
 *
 * Output: public/zones/<id>.baz (gitignored), format "BAZ1" (little-endian):
 *   magic[4] | f32 minX | f32 minZ | f32 cell | u32 w | u32 h |
 *   u8 biome[w*h] | u8 flags[w*h] | i16 heightCm[w*h]
 * flags: 1 water, 2 trail, 4 bridge, 8 blocked, 16 stone trail
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PALE_HOLLOW_BOUNDS,
  paleHollowBiome,
  paleHollowInOpenWater,
  paleHollowOnBridge,
  paleHollowStandHeight,
  paleHollowTrails,
  paleHollowWalkable,
  paleHollowWaterSurfaceY,
  PH_TRAIL_WIDTH,
} from "@bellgrave/config";

export const BIOMES = [
  "hub_indoor", "terrace", "farm", "river", "riverbank", "bridge", "ashbeam", "scrub",
  "quarry", "vine_cliff", "ore_seam", "crypt", "ash_road", "grass", "mountain", "meadow",
] as const;

type Seg = { ax: number; az: number; bx: number; bz: number; stone: boolean };

function segDist(px: number, pz: number, s: Seg): number {
  const dx = s.bx - s.ax, dz = s.bz - s.az;
  const l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - s.ax) * dx + (pz - s.az) * dz) / l2));
  return Math.hypot(px - (s.ax + t * dx), pz - (s.az + t * dz));
}

export function bakePaleHollow(cell = 0.5): Buffer {
  const { minX, maxX, minZ, maxZ } = PALE_HOLLOW_BOUNDS;
  const w = Math.ceil((maxX - minX) / cell) + 1;
  const h = Math.ceil((maxZ - minZ) / cell) + 1;
  const segs: Seg[] = [];
  for (const t of paleHollowTrails()) {
    for (let i = 1; i < t.points.length; i++) {
      const a = t.points[i - 1]!, b = t.points[i]!;
      segs.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, stone: t.surface === "stone" });
    }
  }
  const half = PH_TRAIL_WIDTH / 2;
  const header = 4 + 4 * 3 + 4 * 2;
  const buf = Buffer.alloc(header + w * h * 4);
  buf.write("BAZ1", 0, "ascii");
  buf.writeFloatLE(minX, 4);
  buf.writeFloatLE(minZ, 8);
  buf.writeFloatLE(cell, 12);
  buf.writeUInt32LE(w, 16);
  buf.writeUInt32LE(h, 20);
  const bio = header, flg = header + w * h, hgt = header + w * h * 2;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const x = minX + i * cell, z = minZ + j * cell;
      const k = j * w + i;
      const biome = paleHollowBiome(x, z);
      let flags = 0;
      let y = paleHollowStandHeight(x, z);
      const water = paleHollowWaterSurfaceY(x, z);
      if (paleHollowOnBridge(x, z)) flags |= 4;
      else if (paleHollowInOpenWater(x, z) && water != null) {
        flags |= 1;
        y = water;
      }
      if (!paleHollowWalkable(x, z)) flags |= 8;
      if (!(flags & 5)) {
        for (const s of segs) {
          if (segDist(x, z, s) <= half) {
            flags |= 2 | (s.stone ? 16 : 0);
            break;
          }
        }
      }
      buf.writeUInt8(Math.max(0, BIOMES.indexOf(biome as (typeof BIOMES)[number])), bio + k);
      buf.writeUInt8(flags, flg + k);
      buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(y * 100))), hgt + k * 2);
    }
  }
  return buf;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const out = resolve(dirname(fileURLToPath(import.meta.url)), "../public/zones/pale_hollow.baz");
  mkdirSync(dirname(out), { recursive: true });
  const t0 = Date.now();
  const buf = bakePaleHollow();
  writeFileSync(out, buf);
  console.log(`baked ${out} (${(buf.length / 1024).toFixed(0)} KiB) in ${Date.now() - t0} ms`);
}
