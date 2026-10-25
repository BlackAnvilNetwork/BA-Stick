/**
 * Green Reach props. One peak rock on each cap, pine and spruce on walkable
 * grass and meadow. Grid is 8 m by 8.5 m. Pools and peak cores are skipped.
 */
import { K, hash2, type Prop } from "../bake-props";
import {
  GR_BOUNDS,
  GR_PEAKS,
  GR_TRAIL_WIDTH,
  greenReachBiome,
  greenReachInOpenWater,
  greenReachStandHeight,
  greenReachTrails,
  greenReachWalkable,
} from "../../../../packages/config/src/green-reach";
import { nearTrailCorridor } from "../../../../packages/config/src/trail-geom";

const STEP_X = 8;
const STEP_Z = 8.5;
const PEAK_CORE = 0.38;

function onLane(x: number, z: number): boolean {
  return nearTrailCorridor(x, z, greenReachTrails(), GR_TRAIL_WIDTH);
}

function inPeakCore(x: number, z: number): boolean {
  for (const m of GR_PEAKS) {
    if (Math.hypot(x - m.x, z - m.z) < m.r * PEAK_CORE) return true;
  }
  return false;
}

export function greenReachProps(): Prop[] {
  const out: Prop[] = [];
  for (const m of GR_PEAKS) {
    out.push({
      kind: K.peak, v: 0, x: m.x, z: m.z, y: greenReachStandHeight(m.x, m.z),
      yaw: 0, s: Math.max(0.7, m.h / 8), w: 0, h: m.h, d: 0,
    });
  }

  const { minX, maxX, minZ, maxZ } = GR_BOUNDS;
  for (let iz = minZ + 7; iz <= maxZ - 7; iz += STEP_Z) {
    for (let ix = minX + 7; ix <= maxX - 7; ix += STEP_X) {
      const h = hash2(ix, iz);
      const h2 = hash2(iz, ix);
      const jx = ix + (h - 0.5) * 3;
      const jz = iz + (h2 - 0.5) * 3;
      if (greenReachInOpenWater(jx, jz)) continue;
      if (inPeakCore(jx, jz)) continue;
      if (!greenReachWalkable(jx, jz)) continue;
      if (onLane(jx, jz)) continue;
      const b = greenReachBiome(jx, jz);
      if (b !== "grass" && b !== "meadow") continue;
      if (h < 0.32) continue;
      const kind = h > 0.66 ? K.pine : K.spruce;
      out.push({
        kind, v: 0, x: jx, z: jz, y: greenReachStandHeight(jx, jz),
        yaw: h * 6.28, s: 3.2 + h2 * 1.5, w: 0, h: 0, d: 0,
      });
    }
  }
  return out;
}
