import assert from "node:assert/strict";
import test from "node:test";
import {
  PH_ASH_ROAD,
  PH_HUB_SPAWN,
  paleHollowOnTrail,
  paleHollowWalkable,
} from "./pale-hollow";
import {
  FB_CAMP,
  FB_GATES,
  FB_SPAWN,
  FOREST_BASIN_BOUNDS,
  forestBasinClampMove,
  forestBasinInOpenWater,
  forestBasinOnBridge,
  forestBasinOnTrail,
  forestBasinStandHeight,
  forestBasinWalkable,
} from "./forest-basin";
import { effectiveForestBasinWalkable } from "./forest-basin-overlay";
import { FB_AQUEDUCT, FB_BRIDGES, FB_TRAIL_DEFS, FB_WADE_DEPTH, fbAqueductBays, fbAqueductDist, fbAqueductRiverLift, fbDesignWater, fbOnFallFace, fbRiverAt } from "./forest-basin-features";
import { gradedCorridorY, nearTrailCorridor } from "./trail-geom";
import { PH_START_SPAWN } from "./warp-unlocks";
import { fieldNav } from "./zone-fields";

test("pale hollow blocks tree scatter on a dirt corridor sample", () => {
  assert.equal(paleHollowOnTrail(50, 220), true);
  assert.equal(paleHollowOnTrail(50, 228), false);
});

test("the Hollow Way is the south run; the old sample sits off the meander", () => {
  // The generated South Run was a straight finger through (5, -90).
  // The walked Hollow Way bends east of that, between the south lip and the Ninefold Ring.
  assert.equal(forestBasinOnTrail(10.5, -93.5), true);
  assert.equal(forestBasinOnTrail(8, -86), true);
  assert.equal(forestBasinOnTrail(5, -90), false);
});

test("forest basin trail spines are walkable street", () => {
  const PAD = 4;
  const inPad = (x: number, z: number) =>
    x >= FOREST_BASIN_BOUNDS.minX + PAD &&
    x <= FOREST_BASIN_BOUNDS.maxX - PAD &&
    z >= FOREST_BASIN_BOUNDS.minZ + PAD &&
    z <= FOREST_BASIN_BOUNDS.maxZ - PAD;
  const blockedGate = (x: number, z: number) =>
    FB_GATES.some((g) => g.blocked && x >= g.minX && x <= g.maxX && z >= g.minZ && z <= g.maxZ);

  const names = new Set(FB_TRAIL_DEFS.map((t) => t.id));
  assert.ok(names.has("wrights-road") && names.has("hollow-way") && names.has("mere-path"));
  assert.ok(names.has("kiln-path") && names.has("spur-way") && names.has("chapel-track") && names.has("ledge-track"));

  let n = 0;
  let street = 0;
  const per = new Map<string, number>();
  for (const t of FB_TRAIL_DEFS) {
    for (let i = 0; i < t.points.length - 1; i++) {
      const a = t.points[i]!;
      const b = t.points[i + 1]!;
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const steps = Math.max(1, Math.ceil(len / 2));
      for (let s = 0; s <= steps; s++) {
        const u = s / steps;
        const x = a.x + (b.x - a.x) * u;
        const z = a.z + (b.z - a.z) * u;
        n++;
        if (!inPad(x, z) || blockedGate(x, z)) continue;
        if (fbOnFallFace(x, z) && !forestBasinOnBridge(x, z)) continue;
        street++;
        per.set(t.id, (per.get(t.id) ?? 0) + 1);
        assert.equal(forestBasinWalkable(x, z), true, `${t.id} walkable ${x.toFixed(1)},${z.toFixed(1)}`);
        assert.equal(effectiveForestBasinWalkable(x, z), true, `${t.id} effective ${x.toFixed(1)},${z.toFixed(1)}`);
        const w = fbDesignWater(x, z);
        if (w && w.depth > FB_WADE_DEPTH) {
          assert.equal(forestBasinOnBridge(x, z), true, `${t.id} deep water needs a bridge at ${x.toFixed(1)},${z.toFixed(1)}`);
        } else {
          assert.equal(forestBasinWalkable(x, z) && (w != null || !forestBasinInOpenWater(x, z)), true, `${t.id} dry street ${x.toFixed(1)},${z.toFixed(1)}`);
        }
      }
    }
  }
  for (const id of names) assert.ok((per.get(id) ?? 0) > 0, `${id} sampled`);
  assert.ok(street > 0 && n >= street, `samples ${n} street ${street}`);
});

test("roads meet each Forest Basin deck: on the line, graded to the bank, no step", () => {
  for (const b of FB_BRIDGES) {
    const L = Math.hypot(b.b.x - b.a.x, b.b.z - b.a.z);
    const ux = (b.b.x - b.a.x) / L;
    const uz = (b.b.z - b.a.z) / L;
    for (const [end, toward, yEnd] of [
      [b.a, { x: -ux, z: -uz }, b.yA],
      [b.b, { x: ux, z: uz }, b.yB],
    ] as const) {
      assert.equal(forestBasinOnTrail(end.x, end.z), true, `${b.id} trail hits ${end.x},${end.z}`);
      assert.equal(forestBasinOnBridge(end.x, end.z), true, `${b.id} end is the deck`);
      assert.equal(forestBasinWalkable(end.x, end.z), true, `${b.id} end walkable`);
      const approach = { x: end.x + toward.x * 2.5, z: end.z + toward.z * 2.5 };
      if (forestBasinOnTrail(approach.x, approach.z) && !forestBasinOnBridge(approach.x, approach.z)) {
        const y = forestBasinStandHeight(approach.x, approach.z);
        assert.ok(Math.abs(y - yEnd) < 0.55, `${b.id} approach ${y.toFixed(2)} vs deck ${yEnd}`);
      }
    }
    let prev = forestBasinStandHeight(b.a.x, b.a.z);
    for (let s = 0; s <= L; s += 1) {
      const x = b.a.x + ux * s;
      const z = b.a.z + uz * s;
      assert.equal(forestBasinOnTrail(x, z), true, `${b.id} road stays on the deck at ${s.toFixed(1)}`);
      assert.equal(forestBasinWalkable(x, z), true, `${b.id} deck walkable at ${s.toFixed(1)}`);
      const y = forestBasinStandHeight(x, z);
      assert.ok(Math.abs(y - prev) < 0.45, `${b.id} stand step ${Math.abs(y - prev).toFixed(2)} at ${s.toFixed(1)}`);
      prev = y;
    }
  }
});

test("the painted trail hem stays walkable where the Briarwater clips Wrights' Road", () => {
  // Spine stays dry; the 3.3 m street hangs over deep water west of Wrightsbridge.
  // Players who hug that bank used to fall in and A* around the woods.
  const wet = [
    { x: -42.2, z: 79.4 },
    { x: -43.3, z: 80.5 },
    { x: -44.4, z: 81.6 },
    { x: -45.8, z: 82.7 },
  ];
  for (const p of wet) {
    assert.equal(forestBasinOnTrail(p.x, p.z), true, `street ${p.x},${p.z}`);
    const w = fbDesignWater(p.x, p.z);
    assert.ok(w && w.depth > FB_WADE_DEPTH, `deep clip ${p.x},${p.z}`);
    assert.equal(forestBasinOnBridge(p.x, p.z), false);
    assert.equal(forestBasinWalkable(p.x, p.z), true, `walk street ${p.x},${p.z}`);
    assert.equal(effectiveForestBasinWalkable(p.x, p.z), true, `effective ${p.x},${p.z}`);
  }
  const from = { x: -37.5, z: 78.2 };
  const to = { x: -42.0, z: 78.9 };
  assert.equal(forestBasinOnTrail(from.x, from.z), true);
  assert.equal(forestBasinOnTrail(to.x, to.z), true);
  const hit = forestBasinClampMove(from.x, from.z, to.x, to.z);
  assert.ok(Math.hypot(hit.x - to.x, hit.z - to.z) < 0.2, `WASD along the road stays on it, miss ${Math.hypot(hit.x - to.x, hit.z - to.z).toFixed(2)}`);
});

test("Pale Hollow trail hem stays walkable beside the Ash Pit", () => {
  const hem = [
    { x: -56.3, z: 337.1 },
    { x: -57.4, z: 339.3 },
    { x: -58.2, z: 340.4 },
  ];
  for (const p of hem) {
    assert.equal(paleHollowOnTrail(p.x, p.z), true, `street ${p.x},${p.z}`);
    assert.equal(paleHollowWalkable(p.x, p.z), true, `walk street ${p.x},${p.z}`);
  }
});

test("camp, open gates, and spawn are walkable; fieldNav steps toward them from a nearby trail", () => {
  const navFb = fieldNav("forest_basin");
  assert.ok(navFb, "forest_basin fieldNav");
  const fbSteps: { id: string; to: { x: number; z: number }; from: { x: number; z: number } }[] = [
    { id: "camp", to: { x: FB_CAMP.x, z: FB_CAMP.z }, from: { x: 13, z: -101 } },
    { id: "spawn", to: { x: FB_SPAWN.x, z: FB_SPAWN.z }, from: { x: 13, z: -101 } },
    { id: "southeast-gap", to: { x: 130, z: -114 }, from: { x: 124, z: -106 } },
    { id: "south-lip", to: { x: 8, z: -144 }, from: { x: 8, z: -140 } },
  ];
  for (const row of fbSteps) {
    assert.equal(forestBasinWalkable(row.to.x, row.to.z), true, `${row.id} walkable`);
    assert.equal(navFb.walkable(row.to.x, row.to.z), true, `${row.id} fieldNav roomy`);
    assert.equal(forestBasinOnTrail(row.from.x, row.from.z), true, `${row.id} from-trail`);
    const step = navFb.clampMove(row.from.x, row.from.z, row.to.x, row.to.z);
    assert.ok(Math.hypot(step.x - row.to.x, step.z - row.to.z) < 0.35, `${row.id} fieldNav step`);
  }

  const navPh = fieldNav("pale_hollow");
  assert.ok(navPh, "pale_hollow fieldNav");
  const phSteps: { id: string; to: { x: number; z: number }; from: { x: number; z: number } }[] = [
    { id: "hub-spawn", to: { x: PH_HUB_SPAWN.x, z: PH_HUB_SPAWN.z }, from: { x: PH_HUB_SPAWN.x + 12, z: PH_HUB_SPAWN.z } },
    { id: "warp-spawn", to: { x: PH_START_SPAWN.x, z: PH_START_SPAWN.z }, from: { x: -55, z: 320 } },
    { id: "ash-road", to: { x: (PH_ASH_ROAD.minX + PH_ASH_ROAD.maxX) / 2, z: (PH_ASH_ROAD.minZ + PH_ASH_ROAD.maxZ) / 2 }, from: { x: 0, z: 468 } },
  ];
  for (const row of phSteps) {
    assert.equal(paleHollowWalkable(row.to.x, row.to.z), true, `${row.id} walkable`);
    assert.equal(navPh.walkable(row.to.x, row.to.z), true, `${row.id} fieldNav roomy`);
    assert.equal(paleHollowOnTrail(row.from.x, row.from.z), true, `${row.id} from-trail`);
    const step = navPh.clampMove(row.from.x, row.from.z, row.to.x, row.to.z);
    assert.ok(Math.hypot(step.x - row.to.x, step.z - row.to.z) < 0.35, `${row.id} fieldNav step`);
  }
});

test("field nav does not shove a trail cell off the corridor next to water", () => {
  const nav = fieldNav("forest_basin")!;
  let n = 0;
  for (const t of FB_TRAIL_DEFS) {
    for (const p of t.points) {
      if (!forestBasinWalkable(p.x, p.z) || !forestBasinOnTrail(p.x, p.z)) continue;
      // Street hem is walkable; look just outside the 3.3 m corridor for the river.
      const tight = (
        [
          [2.1, 0],
          [-2.1, 0],
          [0, 2.1],
          [0, -2.1],
        ] as const
      ).some(([dx, dz]) => !forestBasinOnTrail(p.x + dx, p.z + dz) && !forestBasinWalkable(p.x + dx, p.z + dz));
      if (!tight) continue;
      n++;
      assert.equal(nav.walkable(p.x, p.z), true, `${t.id} roomy at ${p.x.toFixed(1)},${p.z.toFixed(1)}`);
      const along = t.points[t.points.indexOf(p) + 1];
      if (!along) continue;
      const len = Math.hypot(along.x - p.x, along.z - p.z);
      if (len < 2) continue;
      const tx = p.x + ((along.x - p.x) / len) * 4.5;
      const tz = p.z + ((along.z - p.z) / len) * 4.5;
      if (!forestBasinOnTrail(tx, tz) || !forestBasinWalkable(tx, tz)) continue;
      const step = nav.clampMove(p.x, p.z, tx, tz);
      assert.ok(Math.hypot(step.x - tx, step.z - tz) < 0.35, `${t.id} 4.5 m step stays on the path`);
    }
  }
  assert.ok(n > 0, "need a trail cell with water just outside the street");
});

test("Ashlin Aqueduct has a water lift in the Briarwater under the arcade", () => {
  const lift = fbAqueductRiverLift();
  assert.ok(lift, "lift sits where the river crosses the arcade");
  assert.ok(fbAqueductDist(lift.x, lift.z) < 4, `on the run ${fbAqueductDist(lift.x, lift.z)}`);
  assert.ok(fbRiverAt(lift.x, lift.z) || fbDesignWater(lift.x, lift.z), "in the river");
  assert.ok(lift.depth >= 0.85, `dips ${lift.depth}`);
  assert.ok(lift.x < -40 && lift.x > -80 && lift.z > 70 && lift.z < 100, `${lift.x},${lift.z}`);
});

test("Ashlin Aqueduct reaches the west rim through the two new legs", () => {
  const bays = fbAqueductBays();
  assert.ok(bays.length >= 20, `bays ${bays.length}`);
  const near = (x: number, z: number) => bays.some((b) => Math.hypot(b.x - x, b.z - z) < 3);
  assert.ok(near(-73, 76.5), "west of the old arcade");
  assert.ok(near(-110.5, 44.8), "the bend");
  assert.ok(near(-155, 42), "the rim");
  assert.ok(fbAqueductDist(-110.5, 44.8) < 0.2);
  assert.ok(fbAqueductDist(-90, 60) < 6);
});

test("nearTrailCorridor matches half width", () => {
  const trails = [{ points: [{ x: 0, z: 0 }, { x: 0, z: 100 }] }];
  assert.equal(nearTrailCorridor(0, 50, trails, 3.3), true);
  assert.equal(nearTrailCorridor(2, 50, trails, 3.3), false);
});

test("gradedCorridorY flattens a bump; across-width Y matches", () => {
  const trails = [{ points: [{ x: 0, z: 0 }, { x: 0, z: 40 }] }];
  const groundY = (_x: number, z: number) => (z > 18 && z < 22 ? 10 : 2);
  const yMid = gradedCorridorY(0, 20, trails, 1.65, groundY);
  assert.ok(yMid != null, "on the spine");
  assert.ok(yMid! < 6, `bump flattened, got ${yMid}`);
  assert.ok(yMid! > 2.5, `still a gentle grade, got ${yMid}`);
  const yL = gradedCorridorY(-1.2, 20, trails, 1.65, groundY);
  const yR = gradedCorridorY(1.2, 20, trails, 1.65, groundY);
  assert.equal(yL, yMid);
  assert.equal(yR, yMid);
  assert.equal(gradedCorridorY(5, 20, trails, 1.65, groundY), null);
});
