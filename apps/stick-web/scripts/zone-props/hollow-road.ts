/**
 * Hollow Road props. A camp on the mid rise, scrub on the shoulders.
 * Shoulder grid is 8 m with at most 1 m of jitter, so neighbors stay at least 6 m apart.
 */
import { hollowRoadStandHeight, hollowRoadWalkable } from "../../../../packages/config/src/hollow-road";
import { K, hash2, type Prop } from "../bake-props";

const PAD_Z = 80;

const PAD = [
  { kind: K.tent, x: -5, z: 77, yaw: 0.3 },
  { kind: K.tent, x: 5.5, z: 83, yaw: -0.5 },
  { kind: K.firePit, x: 1.5, z: 80, yaw: 0 },
  { kind: K.crate, x: 4, z: 74, yaw: 0.4 },
] as const;

export function hollowRoadProps(): Prop[] {
  const out: Prop[] = [];
  for (const p of PAD) {
    out.push({
      kind: p.kind,
      v: 0,
      x: p.x,
      z: p.z,
      y: hollowRoadStandHeight(p.x, p.z),
      yaw: p.yaw,
      s: p.kind === K.crate ? 0.5 : 1,
      w: p.kind === K.crate ? 0.4 : 0,
      h: p.kind === K.crate ? 0.35 : 0,
      d: 0,
    });
  }
  const step = 8;
  for (let i = 1; i * step < 160; i++) {
    const gz = i * step;
    for (const side of [-1, 1] as const) {
      const h = hash2(i, side * 5);
      const jx = side * 6 + (hash2(i, side) - 0.5) * 2;
      const jz = gz + (hash2(side, i) - 0.5) * 2;
      if (Math.hypot(jx, jz - PAD_Z) < 11) continue;
      if (Math.abs(jx) < 3.5) continue;
      if (!hollowRoadWalkable(jx, jz)) continue;
      if (h < 0.45) continue;
      const kind = h > 0.75 ? K.bush : K.scrub;
      out.push({
        kind,
        v: 0,
        x: jx,
        z: jz,
        y: hollowRoadStandHeight(jx, jz),
        yaw: h * Math.PI * 2,
        s: 0.7 + h * 0.4,
        w: 0,
        h: 0,
        d: 0,
      });
    }
  }
  return out;
}
