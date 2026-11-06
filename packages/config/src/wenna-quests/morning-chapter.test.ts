import assert from "node:assert/strict";
import { test } from "node:test";
import { paleHollowWalkable } from "../pale-hollow";
import { emptyPaleHollowQuests, paleHollowQuestTalk, paleHollowQuestVisit } from "../pale-hollow-field";
import { MAYFLOWER_RING_SITE, MORNING_CHAPTER } from "./morning-chapter";

const WENNA = "npc-ph-herald";
const PRIOR = ["ph-wenna-watch", "ph-wenna-emberwood", "ph-skirt", "ph-wenna-tally"] as const;

function afterPrior() {
  return { zoneId: "pale_hollow" as const, active: [], done: [...PRIOR] };
}

test("empty Wenna talk is not Morning Chapter", () => {
  const talk = paleHollowQuestTalk(emptyPaleHollowQuests(), WENNA);
  assert.notEqual(talk.title, MORNING_CHAPTER.title);
  assert.notEqual(talk.body, MORNING_CHAPTER.offer);
  assert.equal(talk.state.active.some((a) => a.id === MORNING_CHAPTER.id), false);
});

test("after the four prior jobs Wenna offers Morning Chapter", () => {
  const offered = paleHollowQuestTalk(afterPrior(), WENNA);
  assert.equal(offered.title, MORNING_CHAPTER.title);
  assert.equal(offered.body, MORNING_CHAPTER.offer);
  assert.equal(offered.gold, 0);
  assert.equal(offered.state.active.some((a) => a.id === MORNING_CHAPTER.id), true);
});

test("the Mayflower Ring centre is walkable", () => {
  assert.equal(paleHollowWalkable(174, 191.5), true);
  assert.equal(paleHollowWalkable(MAYFLOWER_RING_SITE.x, MAYFLOWER_RING_SITE.z), true);
});

test("visit at the ring credits and Wenna turn-in pays 30", () => {
  const offered = paleHollowQuestTalk(afterPrior(), WENNA);
  const visit = paleHollowQuestVisit(offered.state, MAYFLOWER_RING_SITE.x, MAYFLOWER_RING_SITE.z);
  assert.ok(visit.found.some((s) => s.id === "mayflower-ring"));
  const row = visit.state.active.find((a) => a.id === MORNING_CHAPTER.id);
  assert.equal(row?.kills, 1);
  const paid = paleHollowQuestTalk(visit.state, WENNA);
  assert.equal(paid.gold, 30);
  assert.equal(paid.body, MORNING_CHAPTER.done);
  assert.ok(paid.state.done.includes(MORNING_CHAPTER.id));
});

test("after the chain another Wenna talk pays 0 and repeats the done line", () => {
  const offered = paleHollowQuestTalk(afterPrior(), WENNA);
  const visit = paleHollowQuestVisit(offered.state, MAYFLOWER_RING_SITE.x, MAYFLOWER_RING_SITE.z);
  const paid = paleHollowQuestTalk(visit.state, WENNA);
  const again = paleHollowQuestTalk(paid.state, WENNA);
  assert.equal(again.gold, 0);
  assert.equal(again.body, MORNING_CHAPTER.done);
  assert.equal(again.title, MORNING_CHAPTER.title);
  assert.equal(again.state.active.length, 0);
  assert.equal(again.state.done.includes(MORNING_CHAPTER.id), true);
});

test("copy never says tutorial", () => {
  const copy = [
    MORNING_CHAPTER.title,
    MORNING_CHAPTER.offer,
    MORNING_CHAPTER.progress,
    MORNING_CHAPTER.done,
    ...(MORNING_CHAPTER.sites ?? []).flatMap((s) => [s.name, s.line]),
  ].join("\n");
  assert.equal(/tutorial/i.test(copy), false);
});
