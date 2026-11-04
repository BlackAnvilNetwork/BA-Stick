import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FB_BRIDGES,
  FB_STILLMERE,
  FB_WADE_DEPTH,
  FOREST_BASIN_BOUNDS,
  fbDesignWater,
  fbShoreFillAt,
  forestBasinGroundY,
  forestBasinInOpenWater,
  forestBasinWalkable,
  forestBasinWaterSurfaceY,
  shoreFillGrid,
} from "./index";

const fill = (x: number, z: number) => fbShoreFillAt(x, z, FOREST_BASIN_BOUNDS, forestBasinGroundY);

test("fords are shallow and walkable", () => {
  for (const [name, x, z] of [
    ["Hartstep Ford", -71, 99],
    ["the Long Shallows", 13, 45],
    ["Pebble Ford", 49, 102],
    ["the Crossing Stones", 118, -3],
  ] as const) {
    const w = fbDesignWater(x, z);
    assert.ok(w, `${name} is water`);
    assert.equal(w.tier, "ford", `${name} is a ford`);
    assert.ok(w.depth <= FB_WADE_DEPTH, `${name} depth ${w.depth}`);
    assert.ok(forestBasinWalkable(x, z), `${name} walkable`);
  }
});

test("bridges span water too deep to wade and land on dry bank", () => {
  for (const b of FB_BRIDGES) {
    let deepest = 0;
    for (let t = 0.2; t <= 0.8; t += 0.05) {
      const w = fbDesignWater(b.a.x + (b.b.x - b.a.x) * t, b.a.z + (b.b.z - b.a.z) * t);
      if (w) deepest = Math.max(deepest, w.depth);
    }
    // A span over a dry ravine is fine; a bridge over water must not be over a ford.
    if (deepest > 0) assert.ok(deepest > FB_WADE_DEPTH, `${b.name} crosses deep water (${deepest.toFixed(2)} m)`);
    for (const p of [b.a, b.b]) {
      assert.equal(fbDesignWater(p.x, p.z), null, `${b.name} end is dry`);
      assert.equal(fill(p.x, p.z), null, `${b.name} end not flooded by shore cleanup`);
    }
  }
});

test("the Stillmere is deep enough in the middle to be a lake", () => {
  let lake = false;
  for (let x = 60; x <= 100 && !lake; x += 1) for (let z = 5; z <= 40 && !lake; z += 1) lake = fbDesignWater(x, z)?.tier === "lake" && !!FB_STILLMERE;
  assert.ok(lake);
});

test("shore cleanup: flooded cells take the lowest neighbouring level and agree with gameplay", () => {
  let n = 0;
  for (let z = 100; z <= 125; z += 0.5) {
    for (let x = -105; x <= -80; x += 0.5) {
      const s = fill(x, z);
      if (s == null) continue;
      n++;
      assert.ok(forestBasinInOpenWater(x, z), "server sees it as water");
      assert.equal(forestBasinWaterSurfaceY(x, z), s);
      let lo = Infinity;
      for (const [dx, dz] of [[-0.5, 0], [0.5, 0], [0, -0.5], [0, 0.5], [-0.5, -0.5], [0.5, 0.5], [-0.5, 0.5], [0.5, -0.5]]) {
        const y = fbDesignWater(x + dx!, z + dz!)?.surface;
        if (y != null) lo = Math.min(lo, y);
      }
      if (lo !== Infinity) assert.ok(s <= lo + 0.01, `fill ${s} vs lowest ${lo}`);
    }
  }
  assert.ok(n >= 0);
});

test("shoreFillGrid: a one-cell bar between two levels takes the lower, a high bank stays", () => {
  const N = -32768;
  // 5 x 3: water 1000 | bar | water 400, bar ground 420 (sliver) ; second row a bank at 900.
  const surf = Int16Array.from([N, N, N, N, N, 1000, 1000, N, 400, 400, N, N, N, N, N]);
  const ground = Int16Array.from([0, 0, 0, 0, 0, 0, 0, 420, 0, 0, 0, 0, 0, 0, 0]);
  const out = shoreFillGrid(5, 3, surf, ground, new Uint8Array(15));
  assert.equal(out[7], 400);
  const g2 = Int16Array.from([0, 0, 0, 0, 0, 0, 0, 900, 0, 0, 0, 0, 0, 0, 0]);
  const out2 = shoreFillGrid(5, 3, Int16Array.from([N, N, N, N, N, 400, 400, N, 400, 400, N, N, N, N, N]), g2, new Uint8Array(15));
  assert.equal(out2[7], N, "a bank 5 m above the water is kept");
});
