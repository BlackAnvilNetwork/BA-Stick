import assert from "node:assert/strict";
import test from "node:test";
import { EMBERWATCH_LOOKOUT, THIN_WATCH } from "./thin-watch.ts";
import {
  emptyPaleHollowQuests,
  paleHollowQuestTalk,
  paleHollowQuestVisit,
} from "../pale-hollow-field.ts";
import { paleHollowWalkable } from "../pale-hollow.ts";

const HERALD = "npc-ph-herald";

test("locked Thin Watch fields stay put", () => {
  assert.equal(THIN_WATCH.id, "ph-wenna-watch");
  assert.equal(THIN_WATCH.npcId, HERALD);
  assert.equal(THIN_WATCH.title, "The Thin Watch");
  assert.equal(THIN_WATCH.kind, "fetch");
  assert.equal(THIN_WATCH.need, 1);
  assert.equal(THIN_WATCH.gold, 8);
  assert.deepEqual([...THIN_WATCH.mobIds], []);
  assert.equal(THIN_WATCH.requires, undefined);
  assert.equal(EMBERWATCH_LOOKOUT.x, -46);
  assert.equal(EMBERWATCH_LOOKOUT.z, 293);
  const site = THIN_WATCH.sites?.[0];
  assert.ok(site);
  assert.equal(site.id, "emberwatch-lookout");
  assert.equal(site.x, EMBERWATCH_LOOKOUT.x);
  assert.equal(site.z, EMBERWATCH_LOOKOUT.z);
  assert.equal(site.r, 6);
});

test("first talk to the Herald offers The Thin Watch", () => {
  const offered = paleHollowQuestTalk(emptyPaleHollowQuests(), HERALD);
  assert.equal(offered.title, "The Thin Watch");
  assert.equal(offered.body, THIN_WATCH.offer);
  assert.equal(offered.gold, 0);
  assert.equal(offered.state.active.some((a) => a.id === "ph-wenna-watch"), true);
});

test("Emberwatch lookout stands on walkable ground", () => {
  assert.equal(paleHollowWalkable(EMBERWATCH_LOOKOUT.x, EMBERWATCH_LOOKOUT.z), true);
});

test("visit at the lookout credits 1/1, then turn-in pays once and the chain continues", () => {
  let { state } = paleHollowQuestTalk(emptyPaleHollowQuests(), HERALD);
  const visit = paleHollowQuestVisit(state, EMBERWATCH_LOOKOUT.x, EMBERWATCH_LOOKOUT.z);
  assert.ok(visit.found.some((s) => s.id === "emberwatch-lookout"));
  const entry = visit.state.active.find((a) => a.id === "ph-wenna-watch");
  assert.ok(entry);
  assert.equal(entry.kills, 1);
  assert.equal(THIN_WATCH.need, 1);

  const paid = paleHollowQuestTalk(visit.state, HERALD);
  assert.equal(paid.gold, 8);
  assert.equal(paid.title, "The Thin Watch");
  assert.equal(paid.body, THIN_WATCH.done);
  assert.ok(paid.state.done.includes("ph-wenna-watch"));
  assert.equal(paid.state.active.some((a) => a.id === "ph-wenna-watch"), false);

  const again = paleHollowQuestTalk(paid.state, HERALD);
  assert.equal(again.gold, 0);
  assert.equal(again.title, "The Low Pile");
  assert.equal(again.state.active.some((a) => a.id === "ph-wenna-emberwood"), true);
});

test("Thin Watch copy never says tutorial", () => {
  const site = THIN_WATCH.sites?.[0];
  assert.ok(site);
  const copy = [THIN_WATCH.offer, THIN_WATCH.progress, THIN_WATCH.done, site.line].join("\n");
  assert.doesNotMatch(copy, /tutorial/i);
});

test("Thin Watch points at the timber stand, not a compass bearing", () => {
  const site = THIN_WATCH.sites?.[0];
  assert.ok(site);
  const copy = [THIN_WATCH.offer, THIN_WATCH.progress, THIN_WATCH.done, site.line].join("\n");
  assert.doesNotMatch(copy, /\b(east|west|north|south)\b/i);
  assert.match(THIN_WATCH.offer, /four posts/i);
  assert.match(THIN_WATCH.offer, /banner/i);
  const talked = paleHollowQuestTalk(emptyPaleHollowQuests(), HERALD);
  const again = paleHollowQuestTalk(talked.state, HERALD);
  assert.equal(again.body, THIN_WATCH.progress);
  assert.equal(again.body.includes("0/1"), false);
});
