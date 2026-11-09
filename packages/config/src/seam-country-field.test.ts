// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as C from "./index";
import { WORLD_POIS, LORE_FRAGMENTS, UNPLACED_FRAGMENTS } from "./world-pois";

const catalog = JSON.parse(readFileSync(new URL("../../items/src/catalog.json", import.meta.url), "utf8")) as unknown;
const items: { slug: string; kind: string }[] = Array.isArray(catalog) ? catalog : Object.values((catalog as any).items ?? catalog);
const BASE = new Set(items.filter((i) => i.kind === "base").map((i) => i.slug));

test("every field mob, giver and camp sits on legal ground", () => {
  const bad: string[] = [];
  for (const z of C.SEAM_COUNTRY_ZONES) {
    const camps = C.seamCountryCamps(z);
    for (const c of camps) { const p = C.seamCountrySpotProblem(z, c, "camp"); if (p) bad.push(`${c.id}: ${p}`); }
    for (const n of C.seamCountryNpcs(z)) { const p = C.seamCountrySpotProblem(z, n, "npc"); if (p) bad.push(`${n.id}: ${p}`); }
    const mobs = C.seamCountryMobs(z);
    for (const m of mobs) {
      const p = C.seamCountrySpotProblem(z, m, "mob", camps); if (p) bad.push(`${m.id}: ${p}`);
      for (const o of mobs) if (o !== m && Math.hypot(o.x - m.x, o.z - m.z) < C.SC_CLEAR.mobGap) bad.push(`${m.id}: crowds ${o.id}`);
      for (const n of C.seamCountryNpcs(z)) if (Math.hypot(n.x - m.x, n.z - m.z) < C.SC_CLEAR.friendlyCamp - 3) bad.push(`${m.id}: near giver ${n.id}`);
    }
    for (const a of camps) for (const b of camps) if (a !== b && Math.hypot(a.x - b.x, a.z - b.z) < 20) bad.push(`${a.id}: overlaps ${b.id}`);
  }
  assert.deepEqual(bad, []);
});

test("ids are unique, zone-prefixed and names are player-facing", () => {
  const prefix: Record<string, string> = { hollow_road: "hr-", spur_road: "sr-", ring_ward: "rw-", islet_fords: "if-", green_reach: "gr-", coil_pass: "cp-", coil_ridge: "cr-" };
  const ids = new Set<string>();
  const phIds = new Set([...C.PH_ALL_MOBS, ...C.PH_FIELD_NPCS, ...C.PH_HUB_NPCS].map((r: { id: string }) => r.id));
  for (const z of C.SEAM_COUNTRY_ZONES) {
    for (const r of [...C.seamCountryMobs(z), ...C.seamCountryCamps(z)]) {
      assert.ok(r.id.startsWith(prefix[z]!), r.id);
      assert.ok(!ids.has(r.id) && !phIds.has(r.id), "duplicate " + r.id); ids.add(r.id);
    }
    for (const n of C.seamCountryNpcs(z)) { assert.ok(n.id.startsWith("npc-" + prefix[z]!), n.id); assert.ok(!ids.has(n.id)); ids.add(n.id); }
    for (const l of C.seamCountryLandmarks(z)) { assert.ok(l.id.startsWith("lm-" + prefix[z]!), l.id); assert.ok(!ids.has(l.id)); ids.add(l.id); }
    const text = [...C.seamCountryMobs(z).map((m) => m.name), ...C.seamCountryNpcs(z).map((n) => n.name), ...C.seamCountryCamps(z).map((c) => c.name),
      ...C.seamCountryQuests(z).flatMap((q) => [q.title, q.offer, q.progress, q.done])];
    for (const t of text) {
      assert.ok(!/kek/i.test(t), "KEK in " + t);
      assert.ok(!/coldhearth/i.test(t), "old town name in " + t);
      assert.ok(!/\b[a-z]+_[a-z_]+\b/.test(t), "slug in " + t);
    }
  }
});

test("levels ramp 13–22 and drops are catalog base materials", () => {
  const order = C.SEAM_COUNTRY_ZONES;
  let prevMin = 0;
  for (const z of order) {
    const lv = C.seamCountryMobs(z).map((m) => m.level);
    const lo = Math.min(...lv), hi = Math.max(...lv);
    assert.ok(lo >= 13 && hi <= 22, `${z} ${lo}-${hi}`);
    assert.ok(lo >= prevMin, `${z} ramp drops back`);
    prevMin = lo;
    for (const m of C.seamCountryMobs(z)) {
      assert.ok(m.drops.length > 0, m.id);
      for (const d of [...m.drops, ...(m.fixedDrops ?? []).map((f) => f.slug), ...(m.rareDrops ?? []).map((r) => r.slug)]) assert.ok(BASE.has(d), `${m.id} drops ${d}`);
      assert.ok(m.hp >= 250 && m.hp <= 1400, `${m.id} hp ${m.hp}`);
    }
  }
  for (const loot of Object.values(C.SHINY_LOOT_BY_ARCHETYPE)) for (const d of loot) assert.ok(BASE.has(d), d);
});

test("quests: givers, mobs, landmark reads and the fragment chain line up", () => {
  const qs = C.seamCountryQuests();
  assert.equal(qs.length, 15); // Forest Basin's two quests wait for its rebuild
  const npcIds = new Set(C.seamCountryNpcs().map((n) => n.id));
  const mobIds = new Set(C.seamCountryMobs().map((m) => m.id));
  const frag = qs.filter((q) => q.readPoi).map((q) => WORLD_POIS.find((p) => p.id === q.readPoi)?.fragmentId);
  assert.deepEqual(frag, [...LORE_FRAGMENTS].slice(4).filter((f) => !(f in UNPLACED_FRAGMENTS)));
  for (const q of qs) {
    assert.ok(npcIds.has(q.npcId), q.id);
    assert.ok(q.mobIds.length >= q.need, q.id);
    for (const id of q.mobIds) assert.ok(mobIds.has(id), id);
    if (q.requires) assert.ok(C.worldQuestById(q.requires), q.id + " requires " + q.requires);
    if (q.readPoi) {
      const poi = WORLD_POIS.find((p) => p.id === q.readPoi)!;
      assert.equal(poi.zone, q.zoneId);
      assert.ok(C.landmarkById("lm-" + poi.id), "landmark for " + poi.id);
    }
    assert.ok(q.gold >= 240 && q.gold <= 630, q.id);
  }
  const fragQs = qs.filter((q) => q.readPoi);
  for (let i = 1; i < fragQs.length; i++) assert.equal(fragQs[i]!.requires, fragQs[i - 1]!.id);
});

test("talk → kill → read → turn in, with the read saved", () => {
  let st = C.emptyPaleHollowQuests();
  const q = C.worldQuestById("hr-seventh-post")!;
  let t = C.worldQuestTalk(st, q.npcId);
  assert.equal(t.title, "The Seventh Post"); st = t.state;
  assert.equal(C.worldQuestLogEntries(st)[0]!.need, q.need + 1);
  for (const id of q.mobIds.slice(0, q.need)) st = C.worldQuestCredit(st, id);
  st = C.worldQuestCredit(st, "ph-hare-1");
  let log = C.worldQuestLogEntries(st)[0]!;
  assert.equal(log.kills, q.need); assert.equal(log.ready, false); assert.match(log.progress, /Read The Seven Posts/);
  t = C.worldQuestTalk(st, q.npcId); assert.equal(t.gold, 0); assert.match(t.body, /Then read The Seven Posts/);
  const r = C.worldQuestRead(st, "lm-hr-seven-posts");
  assert.deepEqual(r.credited, ["hr-seventh-post"]); st = r.state;
  // Survives the save round-trip.
  st = C.normalizePaleHollowQuestState(JSON.parse(JSON.stringify(st)));
  log = C.worldQuestLogEntries(st)[0]!;
  assert.equal(log.ready, true); assert.equal(log.kills, log.need);
  t = C.worldQuestTalk(st, q.npcId);
  assert.equal(t.gold, q.gold); st = t.state;
  assert.ok(st.done.includes(q.id));
  // Next quest from the same giver unlocks.
  t = C.worldQuestTalk(st, q.npcId); assert.equal(t.title, "One in Seven");
  // A landmark with no quest still reads.
  const free = C.worldQuestRead(st, "lm-hr-kings-milestone");
  assert.deepEqual(free.credited, []); assert.match(free.body, /numeral/);
});

test("worldQuestLogEntries omits unknown ids so Forest Basin rows are not stubbed", () => {
  const st = { ...C.emptyPaleHollowQuests(), active: [{ id: "fb-cold-hearth", kills: 0 }] };
  assert.deepEqual(C.worldQuestLogEntries(st), []);
});

test("fragment quests wait for the previous fragment", () => {
  const st = C.emptyPaleHollowQuests();
  const t = C.worldQuestTalk(st, "npc-sr-hesk");
  assert.ok(!t.state.active.some((e) => e.id === "sr-bounded-sevens"));
  // Pale Hollow givers are unchanged through the world wrapper.
  const ph = C.worldQuestTalk(st, "npc-ph-herald");
  assert.deepEqual(ph, C.paleHollowQuestTalk(st, "npc-ph-herald"));
});
