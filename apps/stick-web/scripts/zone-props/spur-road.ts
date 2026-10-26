/**
 * Spur Road props. A few shelters on the mid pad, and scrub on the shoulders.
 * Shoulder grid is 8 m with at most 1 m of jitter, so neighbors stay at least 6 m apart.
 */
import { SR_PAD, spurRoadStandHeight, spurRoadWalkable } from "../../../../packages/config/src/spur-road";
import { K, hash2, type Prop } from "../bake-props";

const PAD = [
  { kind: K.tent, x: -6, z: 97, yaw: 0.4 },
  { kind: K.tent, x: 6.5, z: 103, yaw: -0.6 },
  { kind: K.tent, x: -5, z: 106, yaw: 1.2 },
  { kind: K.firePit, x: 2.5, z: 101, yaw: 0 },
  { kind: K.crate, x: 5, z: 95, yaw: 0.3 },
  { kind: K.crate, x: -4, z: 94, yaw: 0.8 },
] as const;

export function spurRoadProps(): Prop[] {
  const out: Prop[] = [];
  for (const p of PAD) {
    out.push({
      kind: p.kind,
      v: 0,
      x: p.x,
      z: p.z,
      y: spurRoadStandHeight(p.x, p.z),
      yaw: p.yaw,
      s: p.kind === K.crate ? 0.5 : 1,
      w: p.kind === K.crate ? 0.4 : 0,
      h: p.kind === K.crate ? 0.35 : 0,
      d: 0,
    });
  }
  const step = 8;
  for (let i = 1; i * step < 200; i++) {
    const gz = i * step;
    for (const side of [-1, 1] as const) {
      const gx = side * 6;
      const h = hash2(i, side * 3);
      const jx = gx + (hash2(i, side) - 0.5) * 2;
      const jz = gz + (hash2(side, i) - 0.5) * 2;
      if (Math.hypot(jx, jz - SR_PAD.z) < 13) continue;
      if (Math.abs(jx) < 3.5) continue;
      if (!spurRoadWalkable(jx, jz)) continue;
      if (h < 0.42) continue;
      const kind = h > 0.74 ? K.bush : K.scrub;
      out.push({
        kind,
        v: 0,
        x: jx,
        z: jz,
        y: spurRoadStandHeight(jx, jz),
        yaw: h * Math.PI * 2,
        s: 0.7 + h * 0.5,
        w: 0,
        h: 0,
        d: 0,
      });
    }
  }
  return out;
}
