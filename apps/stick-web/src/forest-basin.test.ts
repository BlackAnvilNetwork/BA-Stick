import assert from "node:assert/strict";
import test from "node:test";
import {
  FB_ASCENTS,
  FB_BRIDGES,
  FB_GATES,
  FB_HEIGHTS,
  FB_MAP_LABELS,
  FB_RIVERS,
  FB_WARP_SITES,
  fbDesignWater,
  fbFallSpans,
  fbOnFallFace,
  forestBasinOnBridge,
  FB_SPAWN,
  forestBasinGroundY,
  FOREST_BASIN_BOUNDS,
  forestBasinInOpenWater,
  forestBasinStandHeight,
  forestBasinTrails,
  forestBasinWalkable,
} from "@bellgrave/config";
import { bakeForestBasin } from "../scripts/bake-zones";

test("forest basin spawn is dry, walkable ground in Kettle Hollow", () => {
  assert.equal(forestBasinWalkable(FB_SPAWN.x, FB_SPAWN.z), true);
  assert.equal(forestBasinInOpenWater(FB_SPAWN.x, FB_SPAWN.z), false);
  assert.ok(forestBasinStandHeight(FB_SPAWN.x, FB_SPAWN.z) > 1);
});

test("forest basin water runs downhill and wades only at fords", () => {
  for (const r of FB_RIVERS) {
    for (let i = 1; i < r.points.length; i++) assert.ok(r.points[i]!.y < r.points[i - 1]!.y, `${r.id} climbs at ${i}`);
  }
  let ford = 0;
  let deep = 0;
  for (let z = -156; z <= 156; z += 1) {
    for (let x = -156; x <= 156; x += 1) {
      const w = fbDesignWater(x, z);
      if (!w || forestBasinOnBridge(x, z)) continue;
      assert.equal(forestBasinInOpenWater(x, z), true);
      assert.equal(forestBasinWalkable(x, z), w.depth <= 0.5, `${x},${z} depth ${w.depth}`);
      if (w.depth <= 0.5) ford++;
      else deep++;
    }
  }
  assert.ok(ford > 50 && deep > 500, `ford ${ford} deep ${deep}`);
  for (const b of FB_BRIDGES) {
    const mx = (b.a.x + b.b.x) / 2;
    const mz = (b.a.z + b.b.z) / 2;
    assert.equal(forestBasinWalkable(mx, mz), true, b.id);
    // A bridge spans deep water, or (the Rope Span) a dry gorge well below its deck.
    const w = fbDesignWater(mx, mz);
    if (w) assert.ok(w.depth > 0.5, `${b.id} spans deep water`);
    else assert.ok(b.deckY - forestBasinGroundY(mx, mz) > 3, `${b.id} spans a drop`);
  }
});

test("forest basin veil face is a fall, not a water ramp", () => {
  const spans = fbFallSpans();
  assert.ok(spans.length >= 1, "veil span");
  const mid = { x: -93.25, z: 116.5 };
  assert.ok(fbOnFallFace(mid.x, mid.z), "mid-veil is the scarp");
  assert.equal(fbDesignWater(mid.x, mid.z), null);
  assert.equal(forestBasinWalkable(mid.x, mid.z), false);
  assert.equal(forestBasinInOpenWater(mid.x, mid.z), false);
  assert.ok(fbDesignWater(-93, 118.4), "lip stays water");
  assert.ok(fbDesignWater(-93.5, 114.6), "pool stays water");
});

test("forest basin most of the bowl is walkable", () => {
  let walk = 0;
  let n = 0;
  const { minX, maxX, minZ, maxZ } = FOREST_BASIN_BOUNDS;
  for (let z = minZ; z <= maxZ; z += 4) {
    for (let x = minX; x <= maxX; x += 4) {
      n++;
      if (forestBasinWalkable(x, z)) walk++;
    }
  }
  const frac = walk / n;
  assert.ok(frac > 0.7, `walkable fraction ${frac.toFixed(3)}`);
});

test("forest basin gates stay reachable from spawn", () => {
  const step = 2;
  const { minX, minZ, maxX, maxZ } = FOREST_BASIN_BOUNDS;
  const cols = Math.ceil((maxX - minX) / step) + 1;
  const key = (x: number, z: number) =>
    Math.round((x - minX) / step) + Math.round((z - minZ) / step) * cols;
  const q: [number, number][] = [[FB_SPAWN.x, FB_SPAWN.z]];
  const seen = new Uint8Array(cols * Math.ceil((maxZ - minZ) / step) + 1);
  seen[key(FB_SPAWN.x, FB_SPAWN.z)] = 1;
  for (let i = 0; i < q.length; i++) {
    const [x, z] = q[i]!;
    for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]] as const) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < minX || nx > maxX || nz < minZ || nz > maxZ) continue;
      const k = key(nx, nz);
      if (seen[k] || !forestBasinWalkable(nx, nz)) continue;
      seen[k] = 1;
      q.push([nx, nz]);
    }
  }
  const reached = (x: number, z: number) => seen[key(x, z)] === 1;
  for (const w of FB_WARP_SITES) assert.equal(reached(Math.round(w.x / 2) * 2, Math.round(w.z / 2) * 2), true, w.id);
  for (const h of FB_HEIGHTS) {
    assert.equal(reached(Math.round(h.x / 2) * 2, Math.round(h.z / 2) * 2), true, `${h.id} reachable by its ascent`);
    // Every height stands at its design level and well above the spawn.
    assert.ok(Math.abs(forestBasinStandHeight(h.x, h.z) - h.y) < 0.8, `${h.id} at design height`);
    assert.ok(forestBasinStandHeight(h.x, h.z) > forestBasinStandHeight(FB_SPAWN.x, FB_SPAWN.z) + 5, `${h.id} is high`);
  }
  assert.ok(FB_ASCENTS.length >= 7);
  for (const g of FB_GATES) {
    const cx = (g.minX + g.maxX) / 2;
    const cz = (g.minZ + g.maxZ) / 2;
    if (!g.blocked) {
      assert.equal(forestBasinWalkable(cx, cz), true, g.id);
      assert.equal(reached(cx, cz), true, g.id);
    } else {
      assert.equal(forestBasinWalkable(cx, cz), false, g.id);
    }
  }
});

test("forest basin trails and labels: named, in bounds, no retired names", () => {
  assert.ok(forestBasinTrails().length >= 6);
  const retired = /drowned spoke|merewick|ondine|hush|counting ring|ledger|token|coin|chain/i;
  for (const l of FB_MAP_LABELS) {
    assert.ok(l.x >= FOREST_BASIN_BOUNDS.minX && l.x <= FOREST_BASIN_BOUNDS.maxX);
    assert.ok(l.z >= FOREST_BASIN_BOUNDS.minZ && l.z <= FOREST_BASIN_BOUNDS.maxZ);
    assert.ok(!retired.test(l.text), l.text);
  }
});

test("forest basin bake is the area-sheet byte length", () => {
  const buf = bakeForestBasin();
  const w = 641;
  const h = 641;
  assert.equal(buf.length, 24 + 4 * w * h);
  assert.equal(buf.toString("ascii", 0, 4), "BAZ1");
});

test("forest basin bridges land on dry banks and the deck is continuous", () => {
  for (const b of FB_BRIDGES) {
    const L = Math.hypot(b.b.x - b.a.x, b.b.z - b.a.z);
    const ux = (b.b.x - b.a.x) / L, uz = (b.b.z - b.a.z) / L;
    const at = (t: number, off = 0) => ({ x: b.a.x + ux * t + uz * off, z: b.a.z + uz * t - ux * off });
    // Both ends, and a short overlap past them, are dry walkable bank at deck height.
    for (const [t, yEnd] of [[0, b.yA], [L, b.yB]] as const) {
      for (const dt of [0, t === 0 ? -0.75 : 0.75]) {
        const p = at(t + dt);
        assert.equal(fbDesignWater(p.x, p.z), null, `${b.id} end ${t === 0 ? "a" : "b"} is dry`);
        assert.ok(forestBasinWalkable(p.x, p.z), `${b.id} end walkable`);
      }
      const p = at(t);
      assert.ok(Math.abs(forestBasinGroundY(p.x, p.z) - yEnd) < 0.45, `${b.id} end meets the bank (ground ${forestBasinGroundY(p.x, p.z).toFixed(2)} deck ${yEnd})`);
      const past = at(t + (t === 0 ? -0.6 : 0.6));
      assert.ok(Math.abs(forestBasinStandHeight(past.x, past.z) - yEnd) < 0.5, `${b.id} no step off the end`);
    }
    // Every wet or dropped cell along the line is under the deck, and the deck never jumps.
    let prev = forestBasinStandHeight(b.a.x, b.a.z);
    let spansGap = false;
    for (let t = 0.25; t <= L; t += 0.25) {
      for (const off of [-b.halfWidth * 0.8, 0, b.halfWidth * 0.8]) {
        const p = at(t, off);
        assert.ok(forestBasinOnBridge(p.x, p.z) && forestBasinWalkable(p.x, p.z), `${b.id} deck at ${t.toFixed(2)}`);
        const w = fbDesignWater(p.x, p.z);
        if ((w && w.depth > 0.5) || forestBasinStandHeight(p.x, p.z) - forestBasinGroundY(p.x, p.z) > 2) spansGap = true;
        if (w) assert.ok(forestBasinStandHeight(p.x, p.z) > w.surface + 0.3, `${b.id} deck clears the water`);
      }
      const p = at(t);
      const y = forestBasinStandHeight(p.x, p.z);
      assert.ok(Math.abs(y - prev) < 0.3, `${b.id} deck step at ${t.toFixed(2)}`);
      prev = y;
    }
    assert.ok(spansGap, `${b.id} crosses deep water or a drop`);
  }
});
