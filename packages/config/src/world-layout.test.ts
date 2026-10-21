import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AREAS, CITIES } from "./world";
import { ZONES } from "./index";
import { LIGHT_EMIT_LEVELS, WORLD_LAYOUTS, WORLD_ROUTE } from "./world-layout";
import { PH_ALL_MOBS, PH_ALL_NODES, PH_HUB_NPCS } from "./pale-hollow";

const inside = (b: { minX: number; maxX: number; minZ: number; maxZ: number }, x: number, z: number) =>
  x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;

describe("world layouts", () => {
  it("covers every zone on the route", () => {
    for (const id of WORLD_ROUTE) {
      const l = WORLD_LAYOUTS[id];
      assert.ok(l, id);
      assert.equal(l!.kind, ZONES[id].kind);
      assert.ok(l!.loreHook.length > 20);
    }
  });

  it("only references ids that already exist", () => {
    const phNodes = new Set(PH_ALL_NODES.map((n) => n.id));
    const phMobs = new Set(PH_ALL_MOBS.map((m) => m.id));
    const phNpcs = new Set<string>(PH_HUB_NPCS.map((n) => n.id));
    for (const id of WORLD_ROUTE) {
      const l = WORLD_LAYOUTS[id]!;
      const area = ZONES[id].areaId ? AREAS[ZONES[id].areaId!] : undefined;
      for (const n of l.nodes) {
        const ok = l.status === "live" ? phNodes.has(n.nodeId) : !!area?.harvestNodes.some((h) => h.id === n.nodeId);
        assert.ok(ok, `${id} node ${n.nodeId}`);
        assert.ok(inside(l.bounds, n.x, n.z), `${id} ${n.id}`);
      }
      for (const m of l.mobs) {
        const ok = l.status === "live" ? phMobs.has(m.mobId) : !!area?.mobs.some((d) => d.id === m.mobId);
        assert.ok(ok, `${id} mob ${m.mobId}`);
        assert.ok(inside(l.bounds, m.x, m.z), `${id} ${m.id}`);
        if (area) {
          assert.ok(m.level >= area.levelBand[0], `${id} ${m.id} level`);
          assert.ok(m.level <= area.levelBand[1], `${id} ${m.id} level`);
        }
      }
      for (const n of l.npcs) {
        const city = ZONES[id].cityId ? CITIES[ZONES[id].cityId!] : undefined;
        const ok = l.status === "live" ? phNpcs.has(n.npcId) : !!city?.npcs.some((c) => c.id === n.npcId && c.role === n.role);
        assert.ok(ok, `${id} npc ${n.npcId}`);
      }
      for (const e of l.exits) assert.ok(WORLD_LAYOUTS[e.to], `${id} exit ${e.to}`);
    }
  });

  it("places every city NPC from world.ts in authored cities", () => {
    for (const id of WORLD_ROUTE) {
      const l = WORLD_LAYOUTS[id]!;
      if (l.kind !== "city" || l.status === "live") continue;
      const want = CITIES[ZONES[id].cityId!].npcs.map((n) => n.id).sort();
      assert.deepEqual(l.npcs.map((n) => n.npcId).sort(), want);
    }
  });

  it("uses every harvest node and mob def of each authored area", () => {
    for (const id of WORLD_ROUTE) {
      const l = WORLD_LAYOUTS[id]!;
      if (l.kind !== "field" || l.status === "live") continue;
      const area = AREAS[ZONES[id].areaId!];
      assert.deepEqual(new Set(l.nodes.map((n) => n.nodeId)), new Set(area.harvestNodes.map((h) => h.id)));
      assert.deepEqual(new Set(l.mobs.map((m) => m.mobId)), new Set(area.mobs.map((m) => m.id)));
    }
  });

  it("emitter values are valid L1–L4 tiers", () => {
    for (const id of WORLD_ROUTE) {
      const l = WORLD_LAYOUTS[id]!;
      for (const e of [...l.props, ...(l.landmarks ?? [])]) {
        if (e.emits !== undefined) assert.ok(LIGHT_EMIT_LEVELS.includes(e.emits), `${id} emits ${e.emits}`);
      }
    }
  });

  it("landmarks sit inside their zone (and district) with unique ids", () => {
    const ids = new Set<string>();
    for (const id of WORLD_ROUTE) {
      const l = WORLD_LAYOUTS[id]!;
      for (const m of l.landmarks ?? []) {
        assert.ok(!ids.has(m.id), `dup ${m.id}`);
        ids.add(m.id);
        assert.ok(inside(l.bounds, m.x, m.z), `${id} ${m.id}`);
        assert.ok(m.clearR > 0, `${id} ${m.id} clearR`);
        if (m.district) {
          const d = l.districts.find((d) => d.id === m.district);
          assert.ok(d && inside(d.rect, m.x, m.z), `${id} ${m.id} district ${m.district}`);
        }
      }
    }
    assert.ok((WORLD_LAYOUTS.pale_hollow!.landmarks ?? []).length >= 4);
  });

  it("world.ts Pale Hollow mob drops cover every live PH spawn drop", () => {
    const world = new Set(AREAS.pale_hollow.mobs.flatMap((m) => m.drops));
    for (const m of PH_ALL_MOBS) {
      for (const d of [...m.drops, ...(m.rareDrops ?? []).map((r) => r.slug)]) assert.ok(world.has(d), `${m.id} ${d}`);
    }
  });

  it("flags aliases and placeholders", () => {
    assert.equal(WORLD_LAYOUTS.shard_dwellings!.aliasOf?.zoneId, "pale_hollow");
    for (const id of WORLD_ROUTE) {
      const l = WORLD_LAYOUTS[id]!;
      if (l.status !== "needs-server") continue;
      assert.ok(l.placeholder?.districts && l.placeholder?.props, id);
      assert.ok(l.districts.every((d) => d.placeholder) && l.props.every((p) => p.placeholder), id);
    }
  });
});
