import { naturalSample } from "../natural-edges";
/**
 * Coil Ridge ("the Broken Stair") props: the Kingsbridge deck, ruin stones (Stele Field,
 * Toppled Gatehouse, Scarp Head) and sparse pines on the walkable shelf off the trails and water.
 * Scatter grid stays at least 8 m apart.
 */
import {
  CR_BOUNDS, CR_BRIDGE, CR_BRIDGE_DECK_W, CR_BRIDGE_ENDS, CR_RUINS, CR_TRAIL_WIDTH,
  coilRidgeBiome, coilRidgeInOpenWater, coilRidgeOnBridge, coilRidgeStandHeight, coilRidgeTrails, coilRidgeWalkable,
} from "../../../../packages/config/src/coil-ridge";
import { nearTrailCorridor } from "../../../../packages/config/src/trail-geom";
import { K, hash2, type Prop } from "../bake-props";

const STEP = 10;

export function coilRidgeProps(): Prop[] {
  const out: Prop[] = [];
  out.push({ kind: K.bridge, v: Math.round(0.2 * 200), x: CR_BRIDGE.x, z: CR_BRIDGE.z, y: CR_BRIDGE_ENDS.leftY, yaw: Math.atan2(CR_BRIDGE.dir.x, CR_BRIDGE.dir.z), s: CR_BRIDGE.span, w: CR_BRIDGE_DECK_W, h: 0.35, d: CR_BRIDGE_ENDS.rightY });
  // ruins: toppled stones and wall stubs around each site, never on a trail or in water
  for (const r of CR_RUINS) {
    const n = Math.round(r.r * 0.9);
    for (let i = 0; i < n; i++) {
      const a = hash2(i, r.r) * Math.PI * 2, d = r.r * (0.35 + 0.6 * hash2(r.r, i));
      const x = r.x + Math.cos(a) * d, z = r.z + Math.sin(a) * d;
      if (!coilRidgeWalkable(x, z) || coilRidgeInOpenWater(x, z) || nearTrailCorridor(x, z, coilRidgeTrails(), CR_TRAIL_WIDTH + 1)) continue;
      const kind = i % 3 === 0 ? K.wallBlock : i % 3 === 1 ? K.stone : K.moss;
      out.push({ kind, v: i % 4, x, z, y: coilRidgeStandHeight(x, z) - 0.1, yaw: a, s: kind === K.wallBlock ? 0.8 : 0.6, w: kind === K.wallBlock ? 1.6 : 0, h: kind === K.wallBlock ? 0.9 + hash2(i, 9) : 0, d: kind === K.wallBlock ? 0.5 : 0 });
    }
    out.push({ kind: K.cairn, v: 0, x: r.x, z: r.z, y: coilRidgeStandHeight(r.x, r.z), yaw: 0, s: 1, w: 0, h: 0, d: 0 });
  }
  const { minX, maxX, minZ, maxZ } = CR_BOUNDS;
  for (let iz = minZ + 8; iz <= maxZ - 8; iz += STEP) {
    for (let ix = minX + 8; ix <= maxX - 8; ix += STEP) {
      const jx = ix + (hash2(ix, iz) - 0.5) * 1.5, jz = iz + (hash2(iz, ix) - 0.5) * 1.5;
      if (!coilRidgeWalkable(jx, jz) || coilRidgeInOpenWater(jx, jz) || coilRidgeOnBridge(jx, jz)) continue;
      if (nearTrailCorridor(jx, jz, coilRidgeTrails(), CR_TRAIL_WIDTH + 1)) continue;
      if (naturalSample(coilRidgeBiome, jx, jz) !== "meadow") continue;
      if (CR_RUINS.some((r) => Math.hypot(jx - r.x, jz - r.z) < r.r + 4)) continue;
      const h = hash2(Math.floor(jx * 2), Math.floor(jz * 2));
      if (h < 0.55) continue;
      out.push({ kind: h > 0.8 ? K.pine : K.spruce, v: 0, x: jx, z: jz, y: coilRidgeStandHeight(jx, jz), yaw: h * Math.PI * 2, s: 3.4 + h * 1.6, w: 0, h: 0, d: 0 });
    }
  }
  return out;
}
