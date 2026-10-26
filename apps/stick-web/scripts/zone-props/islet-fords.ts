/**
 * Islet Fords props. Shore reeds and rocks on a 6.5 m grid, a few pines
 * on the islet interiors, one lean-to on the mid islet.
 */
import { K, hash2, type Prop } from "../bake-props";
import {
  IF_ISLETS,
  IF_FORDS,
  IF_TRAIL_WIDTH,
  isletFordsBiome,
  isletFordsInOpenWater,
  isletFordsStandHeight,
  isletFordsTrails,
  isletFordsWalkable,
  isletFordsWaterSurfaceY,
} from "../../../../packages/config/src/islet-fords";
import { nearTrailCorridor } from "../../../../packages/config/src/trail-geom";

const SHORE_STEP = 6.5;
const PINE_STEP = 8;
const LEAN = { x: 106, z: 9 };

function onLane(x: number, z: number): boolean {
  return nearTrailCorridor(x, z, isletFordsTrails(), IF_TRAIL_WIDTH);
}

function inIslet(x: number, z: number): boolean {
  for (const c of IF_ISLETS) {
    if (Math.hypot(x - c.x, z - c.z) <= c.r) return true;
  }
  return false;
}

function pushReed(out: Prop[], x: number, z: number, salt: number): void {
  if (Math.abs(z) >= 28) return;
  if (!isletFordsInOpenWater(x, z)) return;
  const h = hash2(Math.floor(x * 2) + salt, Math.floor(z * 2) - salt);
  out.push({
    kind: K.reed, v: h > 0.5 ? 1 : 0, x, z,
    y: isletFordsWaterSurfaceY(x, z) ?? 0.3,
    yaw: h * 6.28, s: 0.9 + h * 0.7, w: 0, h: 0, d: 0,
  });
}

function pushRock(out: Prop[], x: number, z: number, salt: number): void {
  if (!isletFordsWalkable(x, z)) return;
  if (onLane(x, z)) return;
  const h = hash2(Math.floor(x * 3) + salt, Math.floor(z * 3) - salt);
  out.push({
    kind: K.rock, v: 0, x, z, y: isletFordsStandHeight(x, z),
    yaw: h * 6.28, s: 0.4 + h * 0.45, w: 0, h: 0, d: 0,
  });
}

export function isletFordsProps(): Prop[] {
  const out: Prop[] = [];
  out.push({
    kind: K.leanTo, v: 0, x: LEAN.x, z: LEAN.z, y: isletFordsStandHeight(LEAN.x, LEAN.z),
    yaw: 0.6, s: 1, w: 0, h: 0, d: 0,
  });

  IF_ISLETS.forEach((c, i) => {
    const n = Math.max(6, Math.round((2 * Math.PI * (c.r + 1)) / SHORE_STEP));
    for (let k = 0; k < n; k++) {
      const h = hash2(k + 1, i + 3);
      const ang = (k / n) * Math.PI * 2;
      const co = Math.cos(ang);
      const sn = Math.sin(ang);
      pushReed(out, c.x + co * (c.r + 0.85 + h * 0.8), c.z + sn * (c.r + 0.85 + h * 0.8), 4 + i);
      pushRock(out, c.x + co * (c.r - 1.15 - h * 0.45), c.z + sn * (c.r - 1.15 - h * 0.45), 9 + i);
    }
  });

  for (const f of IF_FORDS) {
    const dx = f.bx - f.ax;
    const dz = f.bz - f.az;
    const len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len;
    const nz = dx / len;
    const n = Math.max(2, Math.round(len / SHORE_STEP));
    for (let k = 1; k < n; k++) {
      const t = k / n;
      const x = f.ax + dx * t;
      const z = f.az + dz * t;
      if (inIslet(x, z)) continue;
      const h = hash2(k + 20, Math.floor(t * 100));
      for (const side of [-1, 1] as const) {
        const ox = nx * side;
        const oz = nz * side;
        pushReed(out, x + ox * (f.r + 0.75 + h * 0.45), z + oz * (f.r + 0.75 + h * 0.45), 15);
        pushRock(out, x + ox * (f.r - 0.85), z + oz * (f.r - 0.85), 18);
      }
    }
  }

  for (const isle of IF_ISLETS) {
    for (let iz = isle.z - isle.r + 4; iz <= isle.z + isle.r - 4; iz += PINE_STEP) {
      for (let ix = isle.x - isle.r + 4; ix <= isle.x + isle.r - 4; ix += PINE_STEP) {
        const h = hash2(Math.round(ix * 10), Math.round(iz * 10));
        const h2 = hash2(Math.round(iz * 10), Math.round(ix * 10));
        const jx = ix + (h - 0.5) * 2;
        const jz = iz + (h2 - 0.5) * 2;
        if (Math.hypot(jx - isle.x, jz - isle.z) > isle.r - 3.5) continue;
        if (h < 0.55) continue;
        if (!isletFordsWalkable(jx, jz)) continue;
        if (isletFordsBiome(jx, jz) !== "grass") continue;
        if (onLane(jx, jz)) continue;
        if (Math.hypot(jx - LEAN.x, jz - LEAN.z) < 4.5) continue;
        out.push({
          kind: K.pine, v: 0, x: jx, z: jz, y: isletFordsStandHeight(jx, jz),
          yaw: h * 6.28, s: 3.1 + h * 1.2, w: 0, h: 0, d: 0,
        });
      }
    }
  }

  return out;
}
