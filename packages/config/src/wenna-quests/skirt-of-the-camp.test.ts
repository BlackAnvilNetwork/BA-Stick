import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PH_ALL_MOBS, emptyPaleHollowQuests, paleHollowQuestCredit, paleHollowQuestTalk } from "../pale-hollow-field.ts";
import { paleHollowWalkable } from "../pale-hollow.ts";
import { SKIRT_HARE_IDS, SKIRT_OF_THE_CAMP } from "./skirt-of-the-camp.ts";

const WENNA = "npc-ph-herald";
const WENNA_POS = { x: -50.5, z: 301.5 };

describe("Skirt of the Camp", () => {
  it("keeps the Emberwatch kill job locked", () => {
    assert.equal(SKIRT_OF_THE_CAMP.id, "ph-skirt");
    assert.equal(SKIRT_OF_THE_CAMP.npcId, WENNA);
    assert.equal(SKIRT_OF_THE_CAMP.kind, "kill");
    assert.equal(SKIRT_OF_THE_CAMP.requires, "ph-wenna-emberwood");
    assert.equal(SKIRT_OF_THE_CAMP.need, 6);
    assert.equal(SKIRT_OF_THE_CAMP.gold, 25);
    assert.deepEqual([...SKIRT_OF_THE_CAMP.mobIds], [...SKIRT_HARE_IDS]);
    assert.deepEqual([...SKIRT_HARE_IDS], [
      "ph-ember-hare-1",
      "ph-ember-hare-2",
      "ph-ember-hare-3",
      "ph-ember-hare-4",
      "ph-ember-hare-5",
      "ph-ember-hare-6",
    ]);
  });

  it("does not offer Skirt on empty talk to Wenna — that is The Thin Watch", () => {
    const talk = paleHollowQuestTalk(emptyPaleHollowQuests(), WENNA);
    assert.equal(talk.title, "The Thin Watch");
    assert.notEqual(talk.title, "Skirt of the Camp");
    assert.equal(talk.state.active.some((a) => a.id === "ph-skirt"), false);
    assert.equal(talk.state.active.some((a) => a.id === "ph-wenna-watch"), true);
  });

  it("offers Skirt of the Camp after The Thin Watch and The Low Pile", () => {
    const talk = paleHollowQuestTalk(
      { zoneId: "pale_hollow", active: [], done: ["ph-wenna-watch", "ph-wenna-emberwood"] },
      WENNA,
    );
    assert.equal(talk.title, "Skirt of the Camp");
    assert.equal(talk.body, SKIRT_OF_THE_CAMP.offer);
    assert.match(talk.body, /Emberwatch/);
    assert.match(talk.body, /six of the nearest/);
    assert.equal(talk.gold, 0);
    assert.equal(talk.state.active.some((a) => a.id === "ph-skirt"), true);
  });

  it("credits all six Emberwatch hares, pays 25 once, then offers Salt for Emberwatch", () => {
    let state = paleHollowQuestTalk(
      { zoneId: "pale_hollow", active: [], done: ["ph-wenna-watch", "ph-wenna-emberwood"] },
      WENNA,
    ).state;
    for (const id of SKIRT_HARE_IDS) state = paleHollowQuestCredit(state, id);
    const paid = paleHollowQuestTalk(state, WENNA);
    assert.equal(paid.gold, 25);
    assert.ok(paid.state.done.includes("ph-skirt"));
    assert.equal(paid.state.active.some((a) => a.id === "ph-skirt"), false);
    const again = paleHollowQuestTalk(paid.state, WENNA);
    assert.equal(again.gold, 0);
    assert.equal(again.title, "Salt for Emberwatch");
    assert.equal(again.state.active.some((a) => a.id === "ph-wenna-tally"), true);
  });

  it("seats each Dust Hare on walkable grass within 40 m of Wenna", () => {
    assert.equal(SKIRT_OF_THE_CAMP.mobIds.length, 6);
    for (const id of SKIRT_OF_THE_CAMP.mobIds) {
      const mob = PH_ALL_MOBS.find((m) => m.id === id);
      assert.ok(mob, id);
      assert.equal(mob!.name, "Dust Hare", id);
      assert.equal(paleHollowWalkable(mob!.x, mob!.z), true, id);
      assert.ok(Math.hypot(mob!.x - WENNA_POS.x, mob!.z - WENNA_POS.z) <= 40, id);
    }
  });

  it("never says tutorial", () => {
    const copy = [SKIRT_OF_THE_CAMP.title, SKIRT_OF_THE_CAMP.offer, SKIRT_OF_THE_CAMP.progress, SKIRT_OF_THE_CAMP.done].join("\n");
    assert.equal(/tutorial/i.test(copy), false);
  });
});
