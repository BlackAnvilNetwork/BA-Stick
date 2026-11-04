import assert from "node:assert/strict";
import test from "node:test";
import {
  FB_POIS,
  FB_PLACES,
  FB_QUESTS,
  FB_TRAIL_DEFS,
  FB_WARP_SITES,
  FB_BRIDGES,
  forestBasinQuestCredit,
  forestBasinQuestTalk,
  forestBasinQuestVisit,
  fieldMobDefs,
  fieldNpcDefs,
  fieldReachable,
  forestBasinWalkable,
  FB_SPAWN,
  FOREST_BASIN_BOUNDS,
} from "@bellgrave/config";

const retired = /drowned spoke|merewick|ondine|hush wood|counting ring|ledger|token|coin|chain|crypto/i;

/** Reachable on foot from the spawn, wading counted (0.5 m grid, 8-way). */
function wadeReach(): (x: number, z: number) => boolean {
  const { minX, maxX, minZ, maxZ } = FOREST_BASIN_BOUNDS;
  const c = 0.5, w = Math.round((maxX - minX) / c) + 1, h = Math.round((maxZ - minZ) / c) + 1;
  const walk = new Uint8Array(w * h), seen = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) walk[j * w + i] = forestBasinWalkable(minX + i * c, minZ + j * c) ? 1 : 0;
  const s = Math.round((FB_SPAWN.z - minZ) / c) * w + Math.round((FB_SPAWN.x - minX) / c);
  const q = [s];
  seen[s] = 1;
  for (let k = 0; k < q.length; k++) {
    const i = q[k]! % w, j = (q[k]! - i) / w;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue;
      const m = nj * w + ni;
      if (!seen[m] && walk[m]) { seen[m] = 1; q.push(m); }
    }
  }
  return (x, z) => seen[Math.round((z - minZ) / c) * w + Math.round((x - minX) / c)] === 1;
}

test("forest basin POIs: unique, named, no retired names, reachable on foot", () => {
  const reach = wadeReach();
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

test("forest basin quests: two kill tasks and two fetches", () => {
  const givers = ["Hild Coalhurst", "Tobin Reede", "Old Corwin Ashdown", "Sister Pumice"];
  const npcs = fieldNpcDefs("forest_basin");
  const mobs = new Set(fieldMobDefs("forest_basin").map((mob) => mob.id));
  assert.equal(FB_QUESTS.length, givers.length);
  for (const quest of FB_QUESTS) {
    const npc = npcs.find((row) => row.id === quest.npcId);
    assert.ok(npc && givers.includes(npc.name) && npc.role === "quest_giver", quest.title);
    const spoken = `${quest.title} ${quest.offer} ${quest.progress} ${quest.done}`;
    assert.equal(retired.test(spoken), false, quest.title);
    assert.equal(/\bfb-/.test(spoken), false, quest.title);
    const offered = forestBasinQuestTalk({ active: [], done: [] }, quest.npcId);
    assert.equal(offered.body, quest.offer);
    assert.equal(offered.gold, 0);
    let bag = offered.state;
    if (quest.kind === "fetch") {
      assert.equal(quest.sites?.length, quest.need);
      for (const site of quest.sites ?? []) {
        assert.equal(forestBasinWalkable(site.x, site.z), true, site.name);
        bag = forestBasinQuestVisit(bag, site.x, site.z).state;
      }
      if (quest.id === "fb-pilgrims-pack") {
        const cache = FB_POIS.find((p) => p.id === "rooks-cache");
        const site = quest.sites![0]!;
        assert.ok(cache && Math.hypot(site.x - cache.x, site.z - cache.z) <= site.r, "pack credits at Rook's Cache");
      }
    } else {
      assert.equal(quest.mobIds.length, quest.need);
      for (const id of quest.mobIds) assert.ok(mobs.has(id), id);
      for (const id of quest.mobIds) bag = forestBasinQuestCredit(bag, id);
    }
    const paid = forestBasinQuestTalk(bag, quest.npcId);
    assert.equal(paid.gold, quest.gold);
    assert.equal(paid.body, quest.done);
    assert.ok(paid.state.done.includes(quest.id));
  }
});
