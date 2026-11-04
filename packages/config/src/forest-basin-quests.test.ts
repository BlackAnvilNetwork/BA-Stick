// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

import assert from "node:assert/strict";
import test from "node:test";
import {
  FB_ASCENTS,
  FB_CAMP,
  FB_MOB_PACKS,
  FB_NPCS,
  FB_POIS,
  FB_QUESTS,
  FB_SPAWN,
  FB_TRAIL_DEFS,
  forestBasinInOpenWater,
  forestBasinMobs,
  forestBasinOnBridge,
  forestBasinOnTrail,
  forestBasinQuestTalk,
  forestBasinQuestVisit,
  forestBasinWalkable,
} from "./index";
import { fieldReachable } from "./field-population";
import { fieldNav } from "./zone-fields";

const NPC_RANGE = 3.5;
const reach = fieldReachable("forest_basin");
const nav = fieldNav("forest_basin")!;

/** Standable: walkable, not a death pit — dry, trail, or deck. */
function standable(x: number, z: number): boolean {
  if (!forestBasinWalkable(x, z)) return false;
  return forestBasinOnBridge(x, z) || forestBasinOnTrail(x, z) || !forestBasinInOpenWater(x, z);
}

function progress(from: { x: number; z: number }, to: { x: number; z: number }, within: number) {
  const before = Math.hypot(to.x - from.x, to.z - from.z);
  if (before <= within) return { ok: true, left: before };
  const step = nav.clampMove(from.x, from.z, to.x, to.z);
  const left = Math.hypot(to.x - step.x, to.z - step.z);
  const moved = Math.hypot(step.x - from.x, step.z - from.z);
  return { ok: moved > 0.4 && left < before - 0.2, left };
}

function roadSamples(): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [];
  for (const t of [...FB_TRAIL_DEFS, ...FB_ASCENTS]) {
    for (let i = 0; i < t.points.length - 1; i++) {
      const a = t.points[i]!;
      const b = t.points[i + 1]!;
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const steps = Math.max(1, Math.ceil(len / 3));
      for (let s = 0; s <= steps; s++) {
        const u = s / steps;
        const x = a.x + (b.x - a.x) * u;
        const z = a.z + (b.z - a.z) * u;
        if (nav.walkable(x, z)) out.push({ x, z });
      }
    }
  }
  return out;
}

const roads = roadSamples();

function roadCanFinish(x: number, z: number, within: number): boolean {
  for (const p of roads) {
    if (Math.hypot(p.x - x, p.z - z) > 70) continue;
    const step = nav.clampMove(p.x, p.z, x, z);
    if (Math.hypot(step.x - x, step.z - z) <= within + 0.35) return true;
  }
  return false;
}

function dryOrWadeHit(site: { x: number; z: number; r: number }): boolean {
  for (let a = 0; a < Math.PI * 2; a += 0.35) {
    for (const d of [0, site.r * 0.4, site.r * 0.75, site.r]) {
      const x = site.x + Math.cos(a) * d;
      const z = site.z + Math.sin(a) * d;
      if (Math.hypot(x - site.x, z - site.z) > site.r + 0.01) continue;
      if (standable(x, z) && nav.walkable(x, z)) return true;
    }
  }
  return false;
}

const givers = FB_NPCS.filter((n) => FB_QUESTS.some((q) => q.npcId === n.id));
const mobs = forestBasinMobs();
const questPoiIds = new Set([
  "merrow-stone",
  "gannet-stone",
  "aldrics-waystone",
  "rooks-throat",
  "rooks-cache",
  "cold-forges",
  "sealed-vault",
  "ashdown-hut",
  "reedes-camp",
  "coalhurst-kilns",
  "pale-watch",
]);

test("every Forest Basin quest giver stands on reachable ground", () => {
  assert.ok(givers.length >= 4);
  for (const n of givers) {
    assert.equal(standable(n.x, n.z), true, `${n.id} not standable at ${n.x},${n.z}`);
    assert.equal(reach(n.x, n.z), true, `${n.id} unreachable from spawn`);
    assert.equal(nav.walkable(n.x, n.z), true, `${n.id} not fieldNav-walkable`);
    assert.equal(roadCanFinish(n.x, n.z, NPC_RANGE), true, `${n.id} no road approach within ${NPC_RANGE} m`);
  }
});

test("fieldNav from camp and spawn makes progress toward every giver", () => {
  for (const n of givers) {
    const camp = progress(FB_CAMP, n, NPC_RANGE);
    const spawn = progress(FB_SPAWN, n, NPC_RANGE);
    assert.equal(camp.ok, true, `${n.id} camp nav stuck (${camp.left.toFixed(1)} m left)`);
    assert.equal(spawn.ok, true, `${n.id} spawn nav stuck (${spawn.left.toFixed(1)} m left)`);
  }
});

test("every Forest Basin fetch site is standable and hittable from a road", () => {
  for (const q of FB_QUESTS) {
    if (q.kind !== "fetch") continue;
    assert.ok(q.sites && q.sites.length === q.need, q.id);
    for (const site of q.sites ?? []) {
      assert.equal(standable(site.x, site.z), true, `${q.id}/${site.id} not standable`);
      assert.equal(reach(site.x, site.z), true, `${q.id}/${site.id} unreachable`);
      assert.equal(nav.walkable(site.x, site.z), true, `${q.id}/${site.id} not fieldNav-walkable`);
      assert.equal(dryOrWadeHit(site), true, `${q.id}/${site.id} no dry/wade interact cell`);
      assert.equal(roadCanFinish(site.x, site.z, site.r), true, `${q.id}/${site.id} no road approach`);
    }
  }
});

test("every Forest Basin quest mob stands on reachable kill ground", () => {
  const used = new Set(FB_QUESTS.flatMap((q) => q.mobIds));
  assert.ok(used.size >= 4);
  for (const id of used) {
    const m = mobs.find((row) => row.id === id);
    assert.ok(m, `missing mob ${id}`);
    assert.equal(standable(m!.x, m!.z), true, `${id} not standable`);
    assert.equal(reach(m!.x, m!.z), true, `${id} unreachable`);
    assert.equal(nav.walkable(m!.x, m!.z), true, `${id} not fieldNav-walkable`);
  }
  for (const p of FB_MOB_PACKS) {
    if (p.id !== "forge-scavengers" && p.id !== "vault-golem" && p.id !== "gorge-adders") continue;
    assert.equal(standable(p.x, p.z), true, `${p.id} pack center not standable`);
    assert.equal(reach(p.x, p.z), true, `${p.id} pack center unreachable`);
  }
});

test("quest-named Forest Basin POIs stay on the walk mesh", () => {
  for (const p of FB_POIS) {
    if (!questPoiIds.has(p.id)) continue;
    assert.equal(standable(p.x, p.z), true, `${p.id} not standable`);
    assert.equal(reach(p.x, p.z), true, `${p.id} unreachable`);
  }
});

test("Forest Basin quest offer and turn-in still resolve", () => {
  for (const q of FB_QUESTS) {
    const npc = FB_NPCS.find((n) => n.id === q.npcId);
    assert.ok(npc && npc.role === "quest_giver", q.id);
    let bag = forestBasinQuestTalk({ active: [], done: [] }, q.npcId).state;
    if (q.kind === "fetch") {
      for (const site of q.sites ?? []) bag = forestBasinQuestVisit(bag, site.x, site.z).state;
    } else {
      bag = { ...bag, active: bag.active.map((e) => (e.id === q.id ? { ...e, kills: q.need } : e)) };
    }
    const paid = forestBasinQuestTalk(bag, q.npcId);
    assert.equal(paid.gold, q.gold, q.id);
    assert.ok(paid.state.done.includes(q.id), q.id);
  }
});
