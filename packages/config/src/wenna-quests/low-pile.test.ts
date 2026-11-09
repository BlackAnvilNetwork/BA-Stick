import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PH_ALL_NODES, paleHollowWalkable } from "../pale-hollow";
import {
  emptyPaleHollowQuests,
  paleHollowQuestGather,
  paleHollowQuestLogEntries,
  paleHollowQuestTalk,
} from "../pale-hollow-field";
import { ASHBEAM_LOG_SPAWNS, LOW_PILE } from "./low-pile";

const WENNA = "npc-ph-herald";

function afterThinWatch() {
  return { zoneId: "pale_hollow" as const, active: [], done: ["ph-wenna-watch"] };
}

function copyBlob(): string {
  return `${LOW_PILE.offer}\n${LOW_PILE.progress}\n${LOW_PILE.done}`;
}

describe("The Low Pile", () => {
  it("keeps locked Emberwatch gather mechanics", () => {
    assert.equal(LOW_PILE.id, "ph-wenna-emberwood");
    assert.equal(LOW_PILE.npcId, WENNA);
    assert.equal(LOW_PILE.kind, "gather");
    assert.equal(LOW_PILE.requires, "ph-wenna-watch");
    assert.equal(LOW_PILE.need, 2);
    assert.equal(LOW_PILE.gold, 12);
    assert.deepEqual([...LOW_PILE.mobIds], []);
    assert.deepEqual([...LOW_PILE.gatherIds!], [...ASHBEAM_LOG_SPAWNS]);
    assert.deepEqual([...LOW_PILE.gatherYields!], ["ashbeam-log"]);
  });

  it("does not offer from an empty state — first talk is The Thin Watch", () => {
    const first = paleHollowQuestTalk(emptyPaleHollowQuests(), WENNA);
    assert.equal(first.title, "The Thin Watch");
    assert.notEqual(first.title, LOW_PILE.title);
    assert.equal(first.state.active.some((a) => a.id === LOW_PILE.id), false);
  });

  it("offers The Low Pile after The Thin Watch is done", () => {
    const offered = paleHollowQuestTalk(afterThinWatch(), WENNA);
    assert.equal(offered.title, "The Low Pile");
    assert.equal(offered.body, LOW_PILE.offer);
    assert.equal(offered.gold, 0);
    assert.equal(offered.state.active.some((a) => a.id === LOW_PILE.id), true);
  });

  it("credits two ashbeam-log gathers, then Wenna pays 12 gold", () => {
    let state = paleHollowQuestTalk(afterThinWatch(), WENNA).state;

    const first = paleHollowQuestGather(state, "ph-ash-a", "ashbeam-log");
    assert.deepEqual(first.credited, [LOW_PILE.id]);
    state = first.state;
    const halfway = paleHollowQuestLogEntries(state).find((e) => e.id === LOW_PILE.id)!;
    assert.equal(halfway.kills, 1);
    assert.equal(halfway.need, 2);
    assert.equal(halfway.ready, false);
    const midTalk = paleHollowQuestTalk(state, WENNA);
    assert.match(midTalk.body, /1\/2/);
    assert.equal(midTalk.gold, 0);

    const second = paleHollowQuestGather(state, "relocated-ash", "ashbeam-log");
    assert.deepEqual(second.credited, [LOW_PILE.id]);
    state = second.state;
    const ready = paleHollowQuestLogEntries(state).find((e) => e.id === LOW_PILE.id)!;
    assert.equal(ready.kills, 2);
    assert.equal(ready.ready, true);

    const paid = paleHollowQuestTalk(state, WENNA);
    assert.equal(paid.gold, 12);
    assert.equal(paid.body, LOW_PILE.done);
    assert.equal(paid.state.done.includes(LOW_PILE.id), true);
  });

  it("does not credit a non-ash yield such as pale-flax", () => {
    const state = paleHollowQuestTalk(afterThinWatch(), WENNA).state;
    const miss = paleHollowQuestGather(state, "ph-flax-a", "pale-flax");
    assert.deepEqual(miss.credited, []);
    const row = miss.state.active.find((a) => a.id === LOW_PILE.id)!;
    assert.equal(row.kills, 0);
  });

  it("places ph-ash-a..e in PH_ALL_NODES on walkable ground", () => {
    assert.deepEqual([...ASHBEAM_LOG_SPAWNS], ["ph-ash-a", "ph-ash-b", "ph-ash-c", "ph-ash-d", "ph-ash-e"]);
    for (const id of ASHBEAM_LOG_SPAWNS) {
      const node = PH_ALL_NODES.find((n) => n.id === id);
      assert.ok(node, id);
      assert.equal(paleHollowWalkable(node.x, node.z), true, id);
    }
  });

  it("never says tutorial in copy", () => {
    assert.equal(/tutorial/i.test(copyBlob()), false);
    assert.match(LOW_PILE.offer, /stream out of camp/i);
    assert.match(LOW_PILE.offer, /ashbeam/i);
    assert.match(LOW_PILE.offer, /two/i);
  });
});
