/**
 * One crown peak, plus pine and spruce on walkable meadow below 6 m.
 * The scatter grid stays at least 8 m and skips water and the tongue trail.
 */
import {
  CR_BOUNDS,
  CR_TRAIL_WIDTH,
  coilRidgeBiome,
  coilRidgeInOpenWater,
  coilRidgeStandHeight,
  coilRidgeTrails,
  coilRidgeWalkable,
} from "../../../../packages/config/src/coil-ridge";
import { nearTrailCorridor } from "../../../../packages/config/src/trail-geom";
import { K, hash2, type Prop } from "../bake-props";

const STEP = 10;

function onTongueTrail(x: number, z: number): boolean {
  return nearTrailCorridor(x, z, coilRidgeTrails(), CR_TRAIL_WIDTH);
}

export function coilRidgeProps(): Prop[] {
  const out: Prop[] = [];
  const peakH = 8;
  out.push({
    kind: K.peak,
    v: 0,
    x: 0,
    z: 10,
    y: coilRidgeStandHeight(0, 10),
    yaw: 0,
    s: Math.max(0.7, peakH / 8),
    w: 0,
    h: peakH,
    d: 0,
  });

  const { minX, maxX, minZ, maxZ } = CR_BOUNDS;
  for (let iz = minZ + 8; iz <= maxZ - 8; iz += STEP) {
    for (let ix = minX + 8; ix <= maxX - 8; ix += STEP) {
      const jx = ix + (hash2(ix, iz) - 0.5) * 1.5;
      const jz = iz + (hash2(iz, ix) - 0.5) * 1.5;
      if (!coilRidgeWalkable(jx, jz)) continue;
      if (coilRidgeInOpenWater(jx, jz)) continue;
      if (onTongueTrail(jx, jz)) continue;
      const y = coilRidgeStandHeight(jx, jz);
      if (y >= 6) continue;
      if (coilRidgeBiome(jx, jz) !== "meadow") continue;
      const h = hash2(Math.floor(jx * 2), Math.floor(jz * 2));
      const kind = h > 0.5 ? K.pine : K.spruce;
      out.push({
        kind,
        v: 0,
        x: jx,
        z: jz,
        y,
        yaw: h * Math.PI * 2,
        s: 3.4 + h * 1.6,
        w: 0,
        h: 0,
        d: 0,
      });
    }
  }
  return out;
}
