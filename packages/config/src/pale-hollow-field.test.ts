import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PH_ALL_NODES,
  PH_ASH_ROAD,
  PH_LAKE,
  PH_QUARRY_CUT,
  PH_SEAM_TUNNEL,
  PH_TIMBER_BRIDGE,
  PH_YARDS,
  paleHollowBiome,
  paleHollowInHubApron,
  paleHollowInOpenWater,
  paleHollowLakeDist,
  paleHollowOnBridge,
  paleHollowWalkable,
} from "./pale-hollow.ts";
import {
  PH_ALL_MOBS,
  PH_QUESTS,
  emptyPaleHollowQuests,
  paleHollowQuestCredit,
  paleHollowQuestTalk,
} from "./pale-hollow-field.ts";

function inRect(
  x: number,
  z: number,
  r: { minX: number; maxX: number; minZ: number; maxZ: number },
): boolean {
  return x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;
}

describe("pale hollow field", () => {
  it("seats 225 dry spawns with room between them", () => {
    assert.equal(PH_ALL_MOBS.length, 225);
    const linked = new Set(["hollow_scavenger", "ruin_dweller", "shard_wight"]);
    for (let i = 0; i < PH_ALL_MOBS.length; i++) {
      const a = PH_ALL_MOBS[i]!;
      assert.equal(paleHollowWalkable(a.x, a.z), true, a.id);
      assert.equal(paleHollowInOpenWater(a.x, a.z), false, a.id);
      assert.equal(paleHollowInHubApron(a.x, a.z), false, a.id);
      assert.equal(paleHollowOnBridge(a.x, a.z), false, a.id);
      assert.ok(paleHollowLakeDist(a.x, a.z) >= PH_LAKE.r, a.id);
      assert.equal(inRect(a.x, a.z, PH_TIMBER_BRIDGE), false, a.id);
      assert.equal(inRect(a.x, a.z, PH_QUARRY_CUT), false, a.id);
      assert.equal(inRect(a.x, a.z, PH_SEAM_TUNNEL), false, a.id);
      assert.equal(inRect(a.x, a.z, PH_ASH_ROAD), false, a.id);
      const biome = paleHollowBiome(a.x, a.z);
      assert.ok(biome !== "river" && biome !== "bridge" && biome !== "mountain" && biome !== "hub_indoor" && biome !== "ash_road", a.id);
      for (const yard of PH_YARDS) {
        assert.ok(Math.hypot(a.x - yard.x, a.z - yard.z) >= 8, a.id);
      }
      let neighbor = Infinity;
      for (let j = 0; j < PH_ALL_MOBS.length; j++) {
        if (i === j) continue;
        const b = PH_ALL_MOBS[j]!;
        const d = Math.hypot(a.x - b.x, a.z - b.z);
        assert.ok(d >= 6.5, `${a.id} ${b.id} ${d}`);
        if (linked.has(a.archetype) && b.archetype === a.archetype) neighbor = Math.min(neighbor, d);
      }
      if (linked.has(a.archetype)) assert.ok(neighbor <= 12, a.id);
    }
  });

  it("keeps each quest to a handful of real mobs and pays once", () => {
    const ids = new Set(PH_ALL_MOBS.map((m) => m.id));
    assert.ok(PH_QUESTS.length >= 11);
    for (const quest of PH_QUESTS) {
      assert.ok(quest.need <= 6, quest.id);
      assert.equal(quest.mobIds.length, quest.need, quest.id);
      for (const id of quest.mobIds) assert.equal(ids.has(id), true, id);
    }
    const skirt = PH_QUESTS.find((q) => q.id === "ph-skirt")!;
    let state = paleHollowQuestTalk(emptyPaleHollowQuests(), skirt.npcId).state;
    for (const id of skirt.mobIds) state = paleHollowQuestCredit(state, id);
    const paid = paleHollowQuestTalk(state, skirt.npcId);
    assert.equal(paid.gold, skirt.gold);
    assert.equal(paid.state.active, null);
    const again = paleHollowQuestTalk(paid.state, skirt.npcId);
    assert.equal(again.gold, 0);
  });

  it("keeps gather nodes on dry land beside the yards", () => {
    for (const node of PH_ALL_NODES) {
      assert.equal(paleHollowWalkable(node.x, node.z), true, node.id);
      assert.equal(paleHollowInOpenWater(node.x, node.z), false, node.id);
    }
  });
});
