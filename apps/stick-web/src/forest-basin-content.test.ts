import assert from "node:assert/strict";
import test from "node:test";
import {
  FB_POIS,
  FB_PLACES,
  FB_TRAIL_DEFS,
  FB_WARP_SITES,
  FB_BRIDGES,
  fieldMobDefs,
  fieldNpcDefs,
  fieldReachable,
} from "@bellgrave/config";

const retired = /drowned spoke|merewick|ondine|hush wood|counting ring|ledger|token|coin|chain|crypto/i;

test("forest basin POIs: unique, named, no retired names, reachable on foot", () => {
  const reach = fieldReachable("forest_basin");
  const ids = new Set<string>();
  for (const p of FB_POIS) {
    assert.ok(!ids.has(p.id), p.id);
    ids.add(p.id);
    assert.ok(!retired.test(p.name) && !retired.test(p.story), p.name);
    let ok = false;
    for (let r = 0; r <= 6 && !ok; r += 1.5) for (let a = 0; a < 6.28 && !ok; a += 0.5) ok = reach(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r);
    assert.ok(ok, `${p.name} unreachable`);
  }
  assert.ok(FB_POIS.length >= 45);
});

test("forest basin has something every 40 m along every trail", () => {
  const spots = [...FB_POIS, ...FB_PLACES, ...FB_WARP_SITES, ...FB_BRIDGES.map((b) => ({ x: (b.a.x + b.b.x) / 2, z: (b.a.z + b.b.z) / 2 }))];
  for (const t of FB_TRAIL_DEFS) {
    let run = 0;
    for (let i = 0; i < t.points.length - 1; i++) {
      const a = t.points[i]!, b = t.points[i + 1]!;
      const n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.z - a.z)));
      for (let s = 0; s < n; s++) {
        const x = a.x + ((b.x - a.x) * s) / n, z = a.z + ((b.z - a.z) * s) / n;
        run = spots.some((q) => Math.hypot(q.x - x, q.z - z) <= 15) ? 0 : run + 1;
        assert.ok(run <= 10, `${t.id} empty near ${x.toFixed(0)},${z.toFixed(0)}`);
      }
    }
  }
});

test("forest basin population: hand-placed mobs and NPCs stand on reachable ground", () => {
  const reach = fieldReachable("forest_basin");
  const mobs = fieldMobDefs("forest_basin");
  const npcs = fieldNpcDefs("forest_basin");
  assert.ok(mobs.length >= 30, `mobs ${mobs.length}`);
  assert.ok(npcs.some((n) => n.name === "Oswy Fernhallow" && n.role === "guide"));
  for (const d of [...mobs, ...npcs]) {
    assert.ok(reach(d.x, d.z), `${d.id} at ${d.x},${d.z}`);
    assert.ok(!retired.test(d.name), d.name);
  }
});
