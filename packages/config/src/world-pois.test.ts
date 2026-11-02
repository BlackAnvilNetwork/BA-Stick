import test from "node:test";
import assert from "node:assert/strict";
import * as C from "./index";
import { WORLD_POIS, LORE_FRAGMENTS, TRAIL_ENDPOINT, UNPLACED_FRAGMENTS, type PoiZone } from "./world-pois";

const CELL = 0.5;
const CLEAR = 4; // metres from any spawn / NPC / gather node / arrival / mob spawn
const GATE_CLEAR = 6; // metres from any gate rectangle

type Z = { bounds: { minX: number; maxX: number; minZ: number; maxZ: number }; walkable: (x: number, z: number) => boolean; spawn: { x: number; z: number }; gates: { minX: number; maxX: number; minZ: number; maxZ: number }[]; anchors: { id: string; x: number; z: number }[] };

function zone(id: PoiZone): Z {
  const arrivals = C.ZONE_LINKS.filter((l) => l.to === id).map((l) => ({ id: "arrival:" + l.id, ...l.spawn }));
  if (id === "pale_hollow") {
    return {
      bounds: C.PALE_HOLLOW_BOUNDS, walkable: C.paleHollowWalkable, spawn: C.PH_HUB_SPAWN, gates: [C.PH_ASH_ROAD],
      anchors: [
        { id: "hub-spawn", ...C.PH_HUB_SPAWN }, { id: "out-spawn", ...C.PH_OUTDOOR_SPAWN },
        ...C.PH_HUB_NPCS, C.PH_STORAGE_CHEST, ...C.PH_FIELD_NPCS, ...C.PH_ALL_NODES, ...C.PH_ALL_MOBS, ...arrivals,
      ].map((a: any) => ({ id: a.id, x: a.x, z: a.z })),
    };
  }
  const f = (C.ZONE_FIELDS as any)[id];
  return { bounds: f.bounds, walkable: f.walkable, spawn: f.spawn, gates: f.gates, anchors: [
    { id: "spawn", ...f.spawn }, ...arrivals,
    // Field population (baseline or a content pack); read-at-landmark markers (lm-*) sit on their POI by design.
    ...[...C.fieldMobDefs(id), ...C.fieldNpcDefs(id)].filter((u) => !u.id.startsWith("lm-")).map((u) => ({ id: u.id, x: u.x, z: u.z })),
  ] };
}

const reachCache = new Map<string, (x: number, z: number) => boolean>();
function reach(id: PoiZone, z: Z) {
  if (reachCache.has(id)) return reachCache.get(id)!;
  const { minX, maxX, minZ, maxZ } = z.bounds;
  const w = Math.floor((maxX - minX) / CELL) + 1, h = Math.floor((maxZ - minZ) / CELL) + 1;
  const walk = new Uint8Array(w * h), seen = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) walk[j * w + i] = z.walkable(minX + i * CELL, minZ + j * CELL) ? 1 : 0;
  const near = (x: number, zz: number) => {
    const i0 = Math.round((x - minX) / CELL), j0 = Math.round((zz - minZ) / CELL);
    for (let r = 0; r <= 2; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      const i = i0 + di, j = j0 + dj; if (i >= 0 && j >= 0 && i < w && j < h && walk[j * w + i]) return j * w + i;
    }
    return -1;
  };
  const s = near(z.spawn.x, z.spawn.z); assert.ok(s >= 0, id + " spawn not walkable");
  const q = [s]; seen[s] = 1;
  while (q.length) {
    const c = q.pop()!, i = c % w, j = (c / w) | 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj, n = nj * w + ni;
      if (ni >= 0 && nj >= 0 && ni < w && nj < h && walk[n] && !seen[n]) { seen[n] = 1; q.push(n); }
    }
  }
  const fn = (x: number, zz: number) => { const c = near(x, zz); return c >= 0 && seen[c] === 1; };
  reachCache.set(id, fn); return fn;
}

test("POI ids unique, fragments complete and ordered", () => {
  const ids = new Set(WORLD_POIS.map((p) => p.id)); assert.equal(ids.size, WORLD_POIS.length);
  const frag = WORLD_POIS.filter((p) => p.fragmentId).map((p) => p.fragmentId);
  assert.deepEqual(frag, LORE_FRAGMENTS.filter((f) => !(f in UNPLACED_FRAGMENTS)));
  assert.deepEqual([...TRAIL_ENDPOINT.requires], [LORE_FRAGMENTS.at(-1)]);
  for (const p of WORLD_POIS) for (const r of p.requires ?? []) assert.ok((LORE_FRAGMENTS as readonly string[]).includes(r), p.id + " requires unknown " + r);
});

test("every POI is on walkable, reachable ground and clear of anchors and gates", () => {
  const bad: string[] = [];
  for (const p of WORLD_POIS) {
    const z = zone(p.zone);
    if (!z.walkable(p.x, p.z)) bad.push(`${p.id}: not walkable`);
    else if (!reach(p.zone, z)(p.x, p.z)) bad.push(`${p.id}: not reachable from spawn`);
    for (const a of z.anchors) { const d = Math.hypot(a.x - p.x, a.z - p.z); if (d < CLEAR) bad.push(`${p.id}: ${d.toFixed(1)} m from ${a.id}`); }
    for (const g of z.gates) {
      const dx = Math.max(g.minX - p.x, 0, p.x - g.maxX), dz = Math.max(g.minZ - p.z, 0, p.z - g.maxZ);
      if (Math.hypot(dx, dz) < GATE_CLEAR) bad.push(`${p.id}: within ${GATE_CLEAR} m of a gate`);
    }
    for (const o of WORLD_POIS) if (o !== p && o.zone === p.zone && Math.hypot(o.x - p.x, o.z - p.z) < 8) bad.push(`${p.id}: overlaps ${o.id}`);
  }
  assert.deepEqual(bad, []);
});
