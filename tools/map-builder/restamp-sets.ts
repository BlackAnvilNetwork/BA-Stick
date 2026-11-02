// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Rework two places on the folded Forest Basin grid without a full builder drive.
 *
 * The Graven Cuts: four cut-rock benches (about 12, 9, 6 and 3 m). Floors stay
 * a little uneven. The outline wanders, so the steps are not rings. Cells the
 * hill never reached are left alone, so a bench is a cut, not a platform.
 *
 * The sinks: a silt floor that dips and carries rubble, a short steep rock
 * wall, and a low rim. The floor is never a disc. The wall is painted
 * mountain so the overhead view reads as a pit. Stairs are put back afterwards.
 *
 *   pnpm --filter @bellgrave/config exec tsx ../../tools/map-builder/restamp-sets.ts
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { FB_ASCENTS, FB_HEIGHTS, FB_QUARRY, FB_SINKS, fbDesignWater } from "../../packages/config/src/forest-basin-features";
import { FB_TERRAIN_B64, FB_TERRAIN_N } from "../../packages/config/src/forest-basin-terrain";

const MIN = -160;
const N = FB_TERRAIN_N;
const buf = Buffer.from(FB_TERRAIN_B64, "base64");
const orig = Buffer.from(buf);

function cmAt(src: Buffer, i: number, j: number): number {
  const ii = Math.max(0, Math.min(N - 1, i));
  const jj = Math.max(0, Math.min(N - 1, j));
  return src.readInt16LE((jj * N + ii) * 3);
}
function setCm(i: number, j: number, metres: number): void {
  const o = (j * N + i) * 3;
  buf.writeInt16LE(Math.round(metres * 100), o);
}
/** Low two flag bits are the paint: 3 is mountain, the dark rock. */
function setRock(i: number, j: number): void {
  const o = (j * N + i) * 3 + 2;
  buf[o] = (buf[o]! & ~3) | 3;
}
function ij(x: number, z: number): { i: number; j: number } {
  return {
    i: Math.max(0, Math.min(N - 1, Math.round(x - MIN))),
    j: Math.max(0, Math.min(N - 1, Math.round(z - MIN))),
  };
}
function metres(src: Buffer, x: number, z: number): number {
  const { i, j } = ij(x, z);
  return cmAt(src, i, j) / 100;
}

/** Slow outline wander. Not a circle, not a sine with many teeth. */
function lobe(x: number, z: number, cx: number, cz: number): number {
  const a = Math.atan2(z - cz, x - cx);
  return 2.6 * Math.sin(a * 2 + 0.7) + 1.4 * Math.sin(a * 3 - 1.2) + 0.7 * Math.sin(a * 5 + 0.4);
}

function smoothstep(t: number): number {
  const u = Math.max(0, Math.min(1, t));
  return u * u * (3 - 2 * u);
}

// --- Graven Cuts -----------------------------------------------------------
// Outer bench to inner floor. Each step is one bench height.
const BENCHES = [12, 9, 6, 3];
const BAND = 5.4;
{
  const q = FB_QUARRY;
  const reach = q.r + 6;
  for (let j = 0; j < N; j++) {
    const z = MIN + j;
    if (Math.abs(z - q.z) > reach) continue;
    for (let i = 0; i < N; i++) {
      const x = MIN + i;
      if (Math.abs(x - q.x) > reach) continue;
      const d = Math.hypot(x - q.x, z - q.z);
      const edge = q.r + lobe(x, z, q.x, q.z) * 0.55;
      const inward = edge - d;
      if (inward <= 0) continue;
      const tier = Math.min(BENCHES.length - 1, Math.floor(inward / BAND));
      const grit = 0.1 * Math.sin(x * 0.62 + 0.4) * Math.sin(z * 0.47 - 0.2);
      const target = BENCHES[tier]! + grit;
      const was = cmAt(orig, i, j) / 100;
      // Cut highs down onto the bench. Fill only the small holes in a floor
      // the hill already reached, so the south skirt is not built up into a wall.
      if (was + 1.6 < target) continue;
      setCm(i, j, target);
    }
  }
}

function carveAscent(id: string, widthPad: number): void {
  const a = FB_ASCENTS.find((s) => s.id === id);
  if (!a) throw new Error(id);
  const p = a.points;
  const pad = a.halfWidth + widthPad;
  for (let j = 0; j < N; j++) {
    const z = MIN + j;
    for (let i = 0; i < N; i++) {
      const x = MIN + i;
      let bestD = Infinity;
      let y = 0;
      for (let k = 0; k < p.length - 1; k++) {
        const A = p[k]!;
        const B = p[k + 1]!;
        const vx = B.x - A.x;
        const vz = B.z - A.z;
        const l2 = vx * vx + vz * vz || 1;
        const t = Math.max(0, Math.min(1, ((x - A.x) * vx + (z - A.z) * vz) / l2));
        const d = Math.hypot(x - (A.x + vx * t), z - (A.z + vz * t));
        if (d < bestD) {
          bestD = d;
          y = A.y + (B.y - A.y) * t;
        }
      }
      if (bestD > pad) continue;
      const grit = 0.06 * Math.sin(x * 1.3 + z);
      // The ramp's old grades sit metres above the new floors. Follow the cut,
      // and only rise where the crown is actually that high.
      const floor = buf.readInt16LE((j * N + i) * 3) / 100;
      const h = y > floor + 0.5 ? floor + 0.08 : y;
      setCm(i, j, h + grit);
    }
  }
}

carveAscent("cutters-ramp", 0.3);

// The Cutters' Crown is a high place, not a bench. Put its top back.
{
  const crown = FB_HEIGHTS.find((h) => h.id === "cutters-crown");
  if (!crown) throw new Error("cutters crown");
  for (let j = 0; j < N; j++) {
    const z = MIN + j;
    if (Math.abs(z - crown.z) > crown.r + 1) continue;
    for (let i = 0; i < N; i++) {
      const x = MIN + i;
      const d = Math.hypot(x - crown.x, z - crown.z);
      if (d > crown.r) continue;
      const grit = 0.08 * Math.sin(x * 0.5 + z * 0.3);
      setCm(i, j, crown.y + grit);
    }
  }
}

// --- Sinks -----------------------------------------------------------------
type Pit = { id: string; x: number; z: number; r: number; depth: number; stair?: string };

function rimMedian(x0: number, z0: number, r: number): number {
  const ys: number[] = [];
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    ys.push(metres(orig, x0 + Math.cos(a) * r * 1.2, z0 + Math.sin(a) * r * 1.2));
  }
  ys.sort((a, b) => a - b);
  return ys[6]!;
}

/** A few mounds, different in each hole, so the silt is not a stamped disc. */
function rubble(x: number, z: number, pit: Pit): number {
  const bumps = [
    [0.28, 0.16, 0.22, 0.55],
    [-0.34, 0.3, 0.18, 0.42],
    [0.06, -0.4, 0.24, 0.72],
    [-0.2, -0.14, 0.15, 0.34],
    [0.4, -0.06, 0.14, 0.48],
  ] as const;
  const shift = pit.x * 0.01 + pit.z * 0.02;
  let h = 0;
  for (const [ox, oz, rad, amp] of bumps) {
    const dx = (x - pit.x) / pit.r - ox - shift;
    const dz = (z - pit.z) / pit.r - oz;
    const t = 1 - Math.hypot(dx, dz) / rad;
    if (t > 0) h = Math.max(h, amp * t * t);
  }
  return h;
}

/** Deeper in the middle, then rubble. The edge of the silt meets the wall. */
function pitFloor(x: number, z: number, pit: Pit, floor: number, d: number): number {
  const bowl = 0.7 * (1 - Math.min(1, d / 0.58));
  const grit = 0.08 * Math.sin(x * 0.73 + pit.x) * Math.sin(z * 0.61 + pit.z);
  return floor - bowl + rubble(x, z, pit) + grit;
}

const pits: Pit[] = [
  ...FB_SINKS.map((s) => ({
    ...s,
    stair: s.id === "great-sink" ? "sink-stair" : s.id === "little-sink" ? "little-sink-steps" : "pale-sink-steps",
  })),
  { id: "the-swallow", x: 141, z: -25, r: 5.2, depth: 4.2 },
];

for (const pit of pits) {
  const rim = rimMedian(pit.x, pit.z, pit.r);
  const floor = rim - pit.depth;
  const reach = pit.r * 1.45;
  for (let j = 0; j < N; j++) {
    const z = MIN + j;
    if (Math.abs(z - pit.z) > reach) continue;
    for (let i = 0; i < N; i++) {
      const x = MIN + i;
      if (Math.abs(x - pit.x) > reach) continue;
      // Leave the Swallow's incoming channel at its bed. The hole is the end of the water.
      if (pit.id === "the-swallow" && fbDesignWater(x, z) && x < pit.x - 1.5) continue;
      const ang = Math.atan2(z - pit.z, x - pit.x);
      const rad = pit.r * (1 + 0.1 * Math.sin(ang * 3 + 0.5) + 0.05 * Math.sin(ang * 2 - 0.8));
      const d = Math.hypot(x - pit.x, z - pit.z) / rad;
      const was = cmAt(orig, i, j) / 100;
      const wet = pit.id === "the-swallow" && fbDesignWater(x, z);
      let h = was;
      if (d < 0.58) h = pitFloor(x, z, pit, floor, d);
      else if (d < 0.78) h = floor + (rim - floor) * smoothstep((d - 0.58) / 0.2);
      else if (d < 1.12) h = was + 0.55 * Math.sin(Math.PI * smoothstep((d - 0.78) / 0.34));
      else continue;
      setCm(i, j, h);
      if (d < 0.9 && !wet) setRock(i, j);
    }
  }
  if (pit.stair) carveAscent(pit.stair, 0);
  // The stair meets the silt. The middle of the hole stays a floor, not a pedestal.
  for (let j = 0; j < N; j++) {
    const z = MIN + j;
    if (Math.abs(z - pit.z) > pit.r) continue;
    for (let i = 0; i < N; i++) {
      const x = MIN + i;
      const ang = Math.atan2(z - pit.z, x - pit.x);
      const rad = pit.r * (1 + 0.1 * Math.sin(ang * 3 + 0.5) + 0.05 * Math.sin(ang * 2 - 0.8));
      if (Math.hypot(x - pit.x, z - pit.z) > rad * 0.5) continue;
      if (pit.id === "the-swallow" && fbDesignWater(x, z) && x < pit.x - 1.5) continue;
      const inward = Math.hypot(x - pit.x, z - pit.z) / rad;
      setCm(i, j, pitFloor(x, z, pit, floor, inward));
      if (!fbDesignWater(x, z)) setRock(i, j);
    }
  }
}

const ROOT = resolve(import.meta.dirname, "../..");
const b64 = buf.toString("base64");
const lines: string[] = [];
for (let k = 0; k < b64.length; k += 120) lines.push(`  "${b64.slice(k, k + 120)}"`);
writeFileSync(
  resolve(ROOT, "packages/config/src/forest-basin-terrain.ts"),
  `// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// GENERATED by tools/map-builder/restamp-sets.ts from the folded grid. Do not hand-edit:
// sculpt in game with the Map tab, then fold again, or rerun the restamp.
/** Forest Basin terrain: ${N}x${N} cells at 1 m from (${MIN},${MIN}); int16 LE cm + flag byte per cell. */
export const FB_TERRAIN_N = ${N};
export const FB_TERRAIN_B64 =
${lines.join(" +\n")};
`,
);
console.log("restamped Graven Cuts, sinks and the Swallow");
