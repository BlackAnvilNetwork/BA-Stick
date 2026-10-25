/**
 * Shoulder rocks and scrub for the coil pass. Grid stays at least 6 m.
 */
import { CP_BOUNDS, coilPassPathDist, coilPassStandHeight } from "../../../../packages/config/src/coil-pass";
import { K, hash2, type Prop } from "../bake-props";

const POLY: readonly { x: number; z: number }[] = [
  { x: 0, z: 8 },
  { x: 10, z: 40 },
  { x: -10, z: 80 },
  { x: 10, z: 120 },
  { x: 0, z: 168 },
];

const GAP = 6;
const SHOULDER = 7.2;

function tooClose(out: Prop[], x: number, z: number): boolean {
  for (const p of out) {
    if (Math.hypot(p.x - x, p.z - z) < GAP - 1e-3) return true;
  }
  return false;
}

export function coilPassProps(): Prop[] {
  const out: Prop[] = [];
  for (let i = 1; i < POLY.length; i++) {
    const a = POLY[i - 1]!;
    const b = POLY[i]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    const px = -dz / len;
    const pz = dx / len;
    const steps = Math.floor(len / GAP);
    for (let s = 0; s <= steps; s++) {
      const t = Math.min(1, (s * GAP) / len);
      const x = a.x + dx * t;
      const z = a.z + dz * t;
      for (const side of [-1, 1] as const) {
        const sx = x + px * SHOULDER * side;
        const sz = z + pz * SHOULDER * side;
        if (sx < CP_BOUNDS.minX + 1 || sx > CP_BOUNDS.maxX - 1) continue;
        if (sz < CP_BOUNDS.minZ + 1 || sz > CP_BOUNDS.maxZ - 1) continue;
        if (coilPassPathDist(sx, sz) < 6.4) continue;
        if (tooClose(out, sx, sz)) continue;
        const h = hash2(Math.round(sx * 10), Math.round(sz * 10) + side);
        const kind = h > 0.48 ? K.rock : K.scrub;
        out.push({
          kind,
          v: h > 0.75 ? 1 : 0,
          x: sx,
          z: sz,
          y: coilPassStandHeight(sx, sz),
          yaw: h * Math.PI * 2,
          s: kind === K.rock ? 0.45 + h * 0.4 : 0.8 + h * 0.45,
          w: 0.9,
          h: 0,
          d: 0,
        });
      }
    }
  }
  return out;
}
