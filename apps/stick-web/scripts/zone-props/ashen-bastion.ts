/**
 * Ashen Bastion props — bridges + light clutter only.
 * Curtain, gatehouse, walkways, and houses ship as BAM1 SDF meshes — no wallBlock massing.
 */
import {
  AB_GATES,
  AB_YARD_Y,
  ashenBastionOnBridge,
  ashenBastionStandHeight,
  ashenBastionWalkable,
} from "../../../../packages/config/src/ashen-bastion";
import { K, hash2, type Prop } from "../bake-props";

function inGate(x: number, z: number): boolean {
  for (const g of AB_GATES) {
    if (x >= g.minX && x <= g.maxX && z >= g.minZ && z <= g.maxZ) return true;
  }
  return false;
}

function push(
  out: Prop[],
  kind: number,
  x: number,
  z: number,
  yaw: number,
  w: number,
  h: number,
  d: number,
  v = 0,
  y = ashenBastionStandHeight(x, z),
): void {
  out.push({ kind, v, x, z, y, yaw, s: 1, w, h, d });
}

function bridges(out: Prop[]): void {
  const decks: { x: number; z: number; yaw: number; span: number }[] = [
    { x: -55, z: 26, yaw: Math.PI / 2, span: 12 },
    { x: 48, z: 32, yaw: Math.atan2(34, -8), span: 10 },
  ];
  for (const b of decks) {
    const y = ashenBastionStandHeight(b.x, b.z);
    out.push({
      kind: K.bridge,
      v: Math.round(0.12 * 200),
      x: b.x,
      z: b.z,
      y,
      yaw: b.yaw,
      s: b.span,
      w: 3.0,
      h: 0.28,
      d: y,
    });
  }
}

function clutter(out: Prop[]): void {
  const spots = [
    { kind: K.crate, x: 4, z: -6, yaw: 0.3 },
    { kind: K.barrel, x: -3, z: -5, yaw: 0.8 },
    { kind: K.crate, x: -40, z: 24, yaw: 0.2 },
    { kind: K.barrel, x: 44, z: 18, yaw: 1.1 },
    { kind: K.weaponRack, x: 0, z: 20, yaw: 0.4 },
  ];
  for (const p of spots) {
    if (!ashenBastionWalkable(p.x, p.z)) continue;
    out.push({
      kind: p.kind,
      v: 0,
      x: p.x,
      z: p.z,
      y: ashenBastionStandHeight(p.x, p.z),
      yaw: p.yaw,
      s: p.kind === K.crate ? 0.5 : 1,
      w: p.kind === K.crate ? 0.42 : 0,
      h: p.kind === K.crate ? 0.36 : 0,
      d: 0,
    });
  }
}

function rocks(out: Prop[]): void {
  for (let i = 0; i < 22; i++) {
    const x = -50 + hash2(i, 3) * 100;
    const z = -44 + hash2(7, i) * 14;
    if (ashenBastionWalkable(x, z) || ashenBastionOnBridge(x, z)) continue;
    if (z > -16) continue;
    out.push({
      kind: K.stone,
      v: i % 3,
      x,
      z,
      y: ashenBastionStandHeight(x, z),
      yaw: hash2(i, 9) * Math.PI * 2,
      s: 0.8 + hash2(i, 11) * 1.4,
      w: 0,
      h: 0,
      d: 0,
    });
  }
}

function ivy(out: Prop[]): void {
  for (let x = -52; x <= 52; x += 6.5) {
    if (inGate(x, -14)) continue;
    push(out, K.moss, x + 0.4, -13.2, 0, 1.2, 1.8, 0.5, 0, AB_YARD_Y + 0.4);
  }
}

export function ashenBastionProps(): Prop[] {
  const out: Prop[] = [];
  bridges(out);
  clutter(out);
  rocks(out);
  ivy(out);
  return out;
}
