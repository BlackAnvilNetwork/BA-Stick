/**
 * Ring Ward props. Outer-ring stones, canal walls, one bridge, keep and street clutter.
 * Trees stay outside r=40 on an 8 m grid.
 */
import {
  RW_APPROACH,
  RW_BRIDGE,
  RW_CANAL,
  RW_GATES,
  ringWardBiome,
  ringWardInOpenWater,
  ringWardOnBridge,
  ringWardOnTrail,
  ringWardStandHeight,
  ringWardWalkable,
} from "../../../../packages/config/src/ring-ward";
import { K, hash2, type Prop } from "../bake-props";

function segDist(x: number, z: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
  return Math.hypot(x - (ax + t * dx), z - (az + t * dz));
}

function inGate(x: number, z: number): boolean {
  for (const g of RW_GATES) {
    if (x >= g.minX && x <= g.maxX && z >= g.minZ && z <= g.maxZ) return true;
  }
  return false;
}

/** Street gaps plus a margin so a block does not stand in the road or the gate. */
function wallGap(x: number, z: number): boolean {
  if (Math.min(Math.abs(x), Math.abs(z)) <= 6) return true;
  if (inGate(x, z)) return true;
  if (segDist(x, z, RW_APPROACH.ax, RW_APPROACH.az, RW_APPROACH.bx, RW_APPROACH.bz) <= RW_APPROACH.half + 2) return true;
  if (ringWardInOpenWater(x, z)) return true;
  if (ringWardOnBridge(x, z)) return true;
  return false;
}

function outerWalls(out: Prop[]): void {
  const radius = 77;
  const n = Math.round((Math.PI * 2 * radius) / 4);
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    const x = Math.cos(th) * radius;
    const z = Math.sin(th) * radius;
    if (wallGap(x, z)) continue;
    const yaw = Math.atan2(-Math.sin(th), Math.cos(th));
    out.push({
      kind: K.wallBlock,
      v: i % 2,
      x,
      z,
      y: ringWardStandHeight(x, z),
      yaw,
      s: 1,
      w: 3.6,
      h: 2.6,
      d: 1.5,
    });
  }
}

function canalWalls(out: Prop[]): void {
  const cope = 0.22;
  const thick = 0.46;
  const banks = [RW_CANAL.x - RW_CANAL.halfWidth - 0.8, RW_CANAL.x + RW_CANAL.halfWidth + 0.8];
  for (const bankX of banks) {
    for (let z = RW_CANAL.z0; z < RW_CANAL.z1 - 0.01; z += 4) {
      const z1 = Math.min(RW_CANAL.z1, z + 4);
      const zLo = Math.min(z, z1);
      const zHi = Math.max(z, z1);
      const bridgeLo = RW_BRIDGE.z - RW_BRIDGE.halfDeck - 1.2;
      const bridgeHi = RW_BRIDGE.z + RW_BRIDGE.halfDeck + 1.2;
      if (zHi > bridgeLo && zLo < bridgeHi) continue;
      const x = bankX;
      const mz = (z + z1) * 0.5;
      if (ringWardInOpenWater(x, mz)) continue;
      const len = z1 - z;
      if (len < 0.15) continue;
      const y = ringWardStandHeight(x, mz);
      const h = Math.max(1.05, RW_CANAL.surface + 0.25 - cope - y);
      out.push({
        kind: K.riverWall,
        v: 0,
        x,
        z: mz,
        y,
        yaw: Math.atan2(0, z1 - z),
        s: len,
        w: thick,
        h,
        d: cope,
      });
    }
  }
}

function bridgeProp(out: Prop[]): void {
  const deck = ringWardStandHeight(RW_BRIDGE.x, RW_BRIDGE.z);
  out.push({
    kind: K.bridge,
    v: Math.round(0.18 * 200),
    x: RW_BRIDGE.x,
    z: RW_BRIDGE.z,
    y: deck,
    yaw: Math.atan2(1, 0),
    s: RW_BRIDGE.halfSpan * 2,
    w: RW_BRIDGE.halfDeck * 2,
    h: 0.35,
    d: deck,
  });
}

function clutter(out: Prop[]): void {
  const spots = [
    { kind: K.stall, x: -6, z: 3, yaw: 0.4 },
    { kind: K.stall, x: 5, z: -4, yaw: -0.3 },
    { kind: K.crate, x: 6, z: 5, yaw: 0.2 },
    { kind: K.crate, x: -4, z: -5, yaw: 0.8 },
    { kind: K.barrel, x: 2, z: 6, yaw: 0.1 },
    { kind: K.barrel, x: -2, z: -6, yaw: 1.1 },
    { kind: K.stall, x: 22, z: 1.6, yaw: 0.2 },
    { kind: K.crate, x: 30, z: -1.4, yaw: 0.5 },
    { kind: K.barrel, x: 36, z: 1.2, yaw: -0.4 },
    { kind: K.crate, x: 44, z: -1.5, yaw: 0.7 },
  ];
  for (const p of spots) {
    out.push({
      kind: p.kind,
      v: 0,
      x: p.x,
      z: p.z,
      y: ringWardStandHeight(p.x, p.z),
      yaw: p.yaw,
      s: p.kind === K.crate ? 0.5 : 1,
      w: p.kind === K.crate ? 0.42 : 0,
      h: p.kind === K.crate ? 0.36 : 0,
      d: 0,
    });
  }
}

function parkTrees(out: Prop[]): void {
  const step = 8;
  for (let iz = -96; iz <= 96; iz += step) {
    for (let ix = -96; ix <= 96; ix += step) {
      const jx = ix + (hash2(ix, iz) - 0.5) * 2;
      const jz = iz + (hash2(iz, ix) - 0.5) * 2;
      if (Math.hypot(jx, jz) < 40) continue;
      if (!ringWardWalkable(jx, jz) || ringWardOnBridge(jx, jz)) continue;
      if (ringWardOnTrail(jx, jz)) continue;
      if (ringWardBiome(jx, jz) !== "meadow") continue;
      const h = hash2(Math.floor(jx), Math.floor(jz));
      if (h < 0.7) continue;
      out.push({
        kind: h > 0.88 ? K.cypress : K.ashMed,
        v: 0,
        x: jx,
        z: jz,
        y: ringWardStandHeight(jx, jz),
        yaw: h * Math.PI * 2,
        s: 2.8 + h * 1.6,
        w: 0,
        h: 0,
        d: 0,
      });
    }
  }
}

export function ringWardProps(): Prop[] {
  const out: Prop[] = [];
  outerWalls(out);
  canalWalls(out);
  bridgeProp(out);
  clutter(out);
  parkTrees(out);
  return out;
}
