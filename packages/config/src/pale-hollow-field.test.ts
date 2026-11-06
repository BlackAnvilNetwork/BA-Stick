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
  PH_BRIDGE_SITES,
  paleHollowBridgeGeom,
  paleHollowInOpenWater,
  paleHollowInRiverWall,
  paleHollowLakeDist,
  paleHollowOnBridge,
  paleHollowRiverCenterX,
  paleHollowWalkable,
  PH_RIVER_MAIN,
} from "./pale-hollow.ts";
import {
  PH_ALL_MOBS,
  PH_QUESTS,
  emptyPaleHollowQuests,
  paleHollowQuestById,
  paleHollowQuestCredit,
  paleHollowQuestGather,
  paleHollowQuestKind,
  paleHollowQuestTalk,
  paleHollowQuestTalkNpc,
  paleHollowQuestVisit,
} from "./pale-hollow-field.ts";
import { WENNA_NPC_ID, WENNA_QUESTS } from "./wenna-quests.ts";

function canWalk(from: { x: number; z: number }, to: { x: number; z: number }): boolean {
  const key = (x: number, z: number) => `${x},${z}`;
  const q: [number, number][] = [[Math.round(from.x), Math.round(from.z)]];
  const seen = new Set<string>([key(q[0]![0], q[0]![1])]);
  while (q.length > 0) {
    const [x, z] = q.pop()!;
    if (Math.hypot(x - to.x, z - to.z) <= 1.5) return true;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < -90 || nx > -10 || nz < 250 || nz > 330) continue;
      const id = key(nx, nz);
      if (seen.has(id) || !paleHollowWalkable(nx, nz)) continue;
      seen.add(id);
      q.push([nx, nz]);
    }
  }
  return false;
}

function inRect(
  x: number,
  z: number,
  r: { minX: number; maxX: number; minZ: number; maxZ: number },
): boolean {
  return x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;
}

describe("pale hollow field", () => {
  it("seats 226 dry spawns with room between them", () => {
    assert.equal(PH_ALL_MOBS.length, 233);
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
      if (linked.has(a.archetype) && a.id !== "ph-camp-dog" && a.id !== "ph-clay-crab") {
        assert.ok(neighbor <= 12, a.id);
      }
    }
  });

  it("keeps Skirt of the Camp on the grass around Emberwatch", () => {
    const wenna = { x: -50.5, z: 301.5 };
    const skirt = PH_QUESTS.find((q) => q.id === "ph-skirt")!;
    assert.match(skirt.offer, /Emberwatch/);
    assert.equal(skirt.offer.includes("south of the dwellings"), false);
    assert.equal(skirt.mobIds.length, 6);
    const seen = new Set(skirt.mobIds);
    assert.equal(seen.size, 6);
    for (const id of skirt.mobIds) {
      const mob = PH_ALL_MOBS.find((m) => m.id === id)!;
      assert.equal(mob.name, "Dust Hare");
      assert.equal(paleHollowWalkable(mob.x, mob.z), true, id);
      assert.ok(Math.hypot(mob.x - wenna.x, mob.z - wenna.z) <= 40, id);
    }
    const hare = PH_ALL_MOBS.find((m) => m.id === "ph-hare-1")!;
    assert.equal(hare.x, 152);
    assert.equal(hare.z, 56);
    const boar = PH_ALL_MOBS.find((m) => m.id === "ph-boar-7")!;
    assert.equal(boar.x, 82);
    assert.equal(boar.z, 282);
    const start = { x: -53, z: 297 };
    const dog = PH_ALL_MOBS.find((m) => m.id === "ph-camp-dog")!;
    const crab = PH_ALL_MOBS.find((m) => m.id === "ph-clay-crab")!;
    const watch = { x: -55, z: 300 };
    for (const mob of [dog, crab]) {
      assert.equal(paleHollowWalkable(mob.x, mob.z), true, mob.id);
      assert.ok(Math.hypot(mob.x - watch.x, mob.z - watch.z) <= 15, mob.id);
      assert.equal(canWalk(start, mob), true, mob.id);
    }
    assert.equal(canWalk(start, wenna), true, "wenna");
    for (const id of skirt.mobIds) {
      const mob = PH_ALL_MOBS.find((m) => m.id === id)!;
      assert.equal(canWalk(start, mob), true, id);
    }
  });

  it("keeps each kill quest to a handful of real mobs and pays once", () => {
    const ids = new Set(PH_ALL_MOBS.map((m) => m.id));
    assert.ok(PH_QUESTS.length >= 11);
    for (const quest of PH_QUESTS) {
      assert.ok(quest.need <= 6, quest.id);
      if (paleHollowQuestKind(quest) !== "kill") {
        assert.equal(quest.mobIds.length, 0, quest.id);
        continue;
      }
      assert.equal(quest.mobIds.length, quest.need, quest.id);
      for (const id of quest.mobIds) assert.equal(ids.has(id), true, id);
    }
    const yard = PH_QUESTS.find((q) => q.id === "ph-clay")!;
    let state = paleHollowQuestTalk(emptyPaleHollowQuests(), yard.npcId).state;
    for (const id of yard.mobIds) state = paleHollowQuestCredit(state, id);
    const paid = paleHollowQuestTalk(state, yard.npcId);
    assert.equal(paid.gold, yard.gold);
    assert.deepEqual(paid.state.active, []);
    const again = paleHollowQuestTalk(paid.state, yard.npcId);
    assert.equal(again.gold, 0);
  });

  it("accepts a second quest when legacy save used a single active object", () => {
    const first = WENNA_QUESTS[0]!;
    const yard = PH_QUESTS.find((q) => q.id === "ph-clay")!;
    const legacy = {
      zoneId: "pale_hollow" as const,
      active: { id: yard.id, kills: 1 },
      done: [] as string[],
    };
    const r = paleHollowQuestTalk(legacy as unknown as ReturnType<typeof emptyPaleHollowQuests>, first.npcId);
    assert.equal(r.body, first.offer);
    assert.equal(r.state.active.length, 2);
  });

  it("tracks several active kill quests at once", () => {
    const grove = PH_QUESTS.find((q) => q.id === "ph-grove")!;
    const yard = PH_QUESTS.find((q) => q.id === "ph-clay")!;
    let state = paleHollowQuestTalk(emptyPaleHollowQuests(), grove.npcId).state;
    state = paleHollowQuestTalk(state, yard.npcId).state;
    assert.equal(state.active.length, 2);
    state = paleHollowQuestCredit(state, grove.mobIds[0]!);
    const groveRow = state.active.find((a) => a.id === grove.id)!;
    const yardRow = state.active.find((a) => a.id === yard.id)!;
    assert.equal(groveRow.kills, 1);
    assert.equal(yardRow.kills, 0);
  });

  it("Wenna offers one Emberwatch quest at a time and chains five", () => {
    assert.equal(WENNA_QUESTS.length, 5);
    assert.equal(WENNA_QUESTS[0]!.requires, undefined);
    for (let i = 1; i < WENNA_QUESTS.length; i++) {
      assert.equal(WENNA_QUESTS[i]!.requires, WENNA_QUESTS[i - 1]!.id);
      assert.equal(WENNA_QUESTS[i]!.npcId, WENNA_NPC_ID);
    }
    let state = emptyPaleHollowQuests();
    for (let i = 0; i < WENNA_QUESTS.length; i++) {
      const quest = WENNA_QUESTS[i]!;
      const offered = paleHollowQuestTalk(state, WENNA_NPC_ID);
      assert.equal(offered.title, quest.title, quest.id);
      assert.equal(offered.body, quest.offer, quest.id);
      assert.equal(offered.gold, 0, quest.id);
      state = offered.state;
      assert.equal(state.active.some((a) => a.id === quest.id), true, quest.id);
      for (let j = i + 1; j < WENNA_QUESTS.length; j++) {
        assert.equal(state.active.some((a) => a.id === WENNA_QUESTS[j]!.id), false);
      }
      const kind = paleHollowQuestKind(quest);
      if (kind === "fetch") {
        for (const site of quest.sites ?? []) {
          const v = paleHollowQuestVisit(state, site.x, site.z);
          assert.ok(v.found.some((s) => s.id === site.id), site.id);
          state = v.state;
        }
      } else if (kind === "gather") {
        for (let n = 0; n < quest.need; n++) {
          state = paleHollowQuestGather(state, quest.gatherIds?.[n] ?? "ph-ash-a", "ashbeam-log").state;
        }
      } else if (kind === "talk") {
        const credit = paleHollowQuestTalkNpc(state, quest.talkNpcId!);
        assert.deepEqual(credit.credited, [quest.id]);
        state = credit.state;
      } else {
        for (const id of quest.mobIds) state = paleHollowQuestCredit(state, id);
      }
      const paid = paleHollowQuestTalk(state, WENNA_NPC_ID);
      assert.equal(paid.gold, quest.gold, quest.id);
      assert.ok(paid.state.done.includes(quest.id), quest.id);
      state = paid.state;
    }
    const after = paleHollowQuestTalk(state, WENNA_NPC_ID);
    assert.equal(after.gold, 0);
    assert.equal(after.body, WENNA_QUESTS[4]!.done);
    assert.equal(paleHollowQuestById("ph-skirt")?.requires, "ph-wenna-emberwood");
  });

  it("keeps gather nodes on dry land beside the yards", () => {
    for (const node of PH_ALL_NODES) {
      assert.equal(paleHollowWalkable(node.x, node.z), true, node.id);
      assert.equal(paleHollowInOpenWater(node.x, node.z), false, node.id);
    }
  });

  it("keeps bridge spans and river walls out of the open-water mask", () => {
    for (const site of PH_BRIDGE_SITES) {
      const g = paleHollowBridgeGeom(site);
      assert.equal(paleHollowOnBridge(g.x, g.zWorld), true, site.id);
      assert.equal(paleHollowInOpenWater(g.x, g.zWorld), false, site.id);
    }
    const z = 218;
    const cx = paleHollowRiverCenterX(z);
    const bank = PH_RIVER_MAIN.bankDist;
    const onWall = { x: cx - bank, z };
    assert.equal(paleHollowInRiverWall(onWall.x, onWall.z), true);
    assert.equal(paleHollowInOpenWater(onWall.x, onWall.z), false);
    const hubNorth = paleHollowBridgeGeom(PH_BRIDGE_SITES[0]!);
    const underArch = {
      x: hubNorth.x + hubNorth.flowDir.x * 4,
      z: hubNorth.zWorld + hubNorth.flowDir.z * 4,
    };
    assert.equal(paleHollowOnBridge(underArch.x, underArch.z), false, "beside-deck");
    assert.equal(paleHollowInOpenWater(underArch.x, underArch.z), true, "channel-under-arch");
  });
});
