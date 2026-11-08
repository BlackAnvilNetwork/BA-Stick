import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  emptyPaleHollowQuests,
  paleHollowQuestTalk,
  paleHollowQuestTalkNpc,
} from "../pale-hollow-field.ts";
import { PH_HUB_NPCS } from "../pale-hollow.ts";
import { MAYFLOWER_STATIONS } from "../pale-hollow-town.ts";
import { SALT_FOR_EMBERWATCH } from "./salt-for-emberwatch.ts";

const WENNA = "npc-ph-herald";
const MAUDRY = "npc-ph-vendor";
const PRIOR = ["ph-wenna-watch", "ph-wenna-emberwood", "ph-skirt"] as const;

function afterSkirt() {
  return {
    zoneId: "pale_hollow" as const,
    active: [],
    done: [...PRIOR],
  };
}

describe("Salt for Emberwatch", () => {
  it("keeps locked talk mechanics", () => {
    assert.equal(SALT_FOR_EMBERWATCH.id, "ph-wenna-tally");
    assert.equal(SALT_FOR_EMBERWATCH.npcId, WENNA);
    assert.equal(SALT_FOR_EMBERWATCH.kind, "talk");
    assert.equal(SALT_FOR_EMBERWATCH.requires, "ph-skirt");
    assert.equal(SALT_FOR_EMBERWATCH.talkNpcId, MAUDRY);
    assert.equal(SALT_FOR_EMBERWATCH.need, 1);
    assert.equal(SALT_FOR_EMBERWATCH.gold, 20);
    assert.deepEqual(SALT_FOR_EMBERWATCH.mobIds, []);
  });

  it("empty Wenna talk is not this quest", () => {
    const r = paleHollowQuestTalk(emptyPaleHollowQuests(), WENNA);
    assert.notEqual(r.title, SALT_FOR_EMBERWATCH.title);
    assert.notEqual(r.body, SALT_FOR_EMBERWATCH.offer);
    assert.equal(r.state.active.some((a) => a.id === SALT_FOR_EMBERWATCH.id), false);
  });

  it("offers Salt for Emberwatch after the first three Emberwatch jobs", () => {
    const offered = paleHollowQuestTalk(afterSkirt(), WENNA);
    assert.equal(offered.title, "Salt for Emberwatch");
    assert.equal(offered.body, SALT_FOR_EMBERWATCH.offer);
    assert.equal(offered.gold, 0);
    assert.equal(offered.state.active.some((a) => a.id === "ph-wenna-tally"), true);
  });

  it("talking to Wenna while active reports progress and does not credit", () => {
    const offered = paleHollowQuestTalk(afterSkirt(), WENNA);
    const progress = paleHollowQuestTalk(offered.state, WENNA);
    assert.equal(progress.title, "Salt for Emberwatch");
    assert.equal(progress.body, SALT_FOR_EMBERWATCH.progress);
    assert.equal(progress.gold, 0);
    const row = progress.state.active.find((a) => a.id === "ph-wenna-tally")!;
    assert.equal(row.kills, 0);
    const self = paleHollowQuestTalkNpc(offered.state, WENNA);
    assert.deepEqual(self.credited, []);
    assert.equal(self.state.active.find((a) => a.id === "ph-wenna-tally")!.kills, 0);
  });

  it("credits Maudry then pays 20 on Wenna turn-in", () => {
    const offered = paleHollowQuestTalk(afterSkirt(), WENNA);
    const credit = paleHollowQuestTalkNpc(offered.state, MAUDRY);
    assert.deepEqual(credit.credited, ["ph-wenna-tally"]);
    assert.equal(credit.state.active.find((a) => a.id === "ph-wenna-tally")!.kills, 1);
    const paid = paleHollowQuestTalk(credit.state, WENNA);
    assert.equal(paid.gold, 20);
    assert.equal(paid.title, "Salt for Emberwatch");
    assert.equal(paid.body, SALT_FOR_EMBERWATCH.done);
    assert.ok(paid.state.done.includes("ph-wenna-tally"));
    assert.equal(paid.state.active.some((a) => a.id === "ph-wenna-tally"), false);
  });

  it("seats Maudry Saltpenny at Tally Row", () => {
    const vendor = PH_HUB_NPCS.find((n) => n.id === MAUDRY);
    assert.ok(vendor);
    assert.equal(vendor.name, "Maudry Saltpenny");
    assert.ok(Math.abs(vendor.x - 194) < 0.1);
    assert.ok(Math.abs(vendor.z - 179.5) < 0.1);
    assert.equal(MAYFLOWER_STATIONS[MAUDRY].x, 194.0);
    assert.equal(MAYFLOWER_STATIONS[MAUDRY].z, 179.5);
  });

  it("keeps tutorial words out of the copy", () => {
    const copy = [SALT_FOR_EMBERWATCH.offer, SALT_FOR_EMBERWATCH.progress, SALT_FOR_EMBERWATCH.done].join("\n");
    assert.match(copy, /Maudry/);
    assert.match(copy, /Tally Row/);
    assert.match(copy, /honest/);
    assert.match(copy, /Emberwatch/);
    assert.equal(/tutorial/i.test(copy), false);
  });
});
