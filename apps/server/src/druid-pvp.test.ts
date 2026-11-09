import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ASH_PIT } from "@bellgrave/config";
import { ITEM, type Equipment } from "@bellgrave/items";
import { BATTLEMAGE_ABILITIES, DRUID_SHIFT_RECAST_MS, isDruidAbilityId } from "@bellgrave/combat";
import { pvpAbilityAllowed, canPvpStrike } from "./pvp";
import { pvpFoeView } from "./pvp-foe";
import {
  dropDruidForm,
  resolveDruidAbility,
  type DruidHooks,
  type DruidMob,
  type DruidPlayer,
} from "./druid-abilities";

const NOW = 80_000;

function emptyEquip(main: number | null = ITEM.STAFF_ASHBEAM): Equipment {
  return { main } as Equipment;
}

function druid(over: Partial<DruidPlayer> = {}): DruidPlayer {
  return {
    job: "druid",
    level: 30,
    wallet: "0xdruid",
    name: "Druid",
    mp: 200,
    maxMp: 200,
    hp: 280,
    maxHp: 280,
    tp: 0,
    x: ASH_PIT.spawn.x,
    z: ASH_PIT.spawn.z,
    facing: 0,
    anim: "idle",
    animUntil: 0,
    moveTo: null,
    targetId: "0xknight",
    equip: emptyEquip(),
    inventory: [{ tokenId: ITEM.STAFF_ASHBEAM, amount: 1 }],
    recasts: {},
    enmity: 0,
    druidForm: 0,
    druidFormUntil: 0,
    druidRingwakeUntil: 0,
    druidAshBraceUntil: 0,
    druidAshBraceMul: 1,
    druidBundleThickenUntil: 0,
    druidBundleThickenMul: 1,
    druidBrackenRootUntil: 0,
    druidAntlerHumUntil: 0,
    druidAntlerHumTick: 0,
    druidAntlerHumNext: 0,
    druidMereVeilUntil: 0,
    druidMereVeilHp: 0,
    druidManeDustUntil: 0,
    druidManeRakeMul: 1,
    druidManeDustLeft: 0,
    druidEmberTailUntil: 0,
    druidRunMul: 1.5,
    druidChalkWardUntil: 0,
    druidChalkWardMul: 1,
    druidSourHumUntil: 0,
    druidBleedUntil: 0,
    druidBleedPot: 0,
    druidRingSplitUntil: 0,
    ...over,
  };
}

function foePlayer(): DruidMob & { wallet: string; name: string } {
  return {
    id: "0xknight",
    wallet: "0xknight",
    name: "Knight",
    alive: true,
    x: ASH_PIT.spawn.x + 1,
    z: ASH_PIT.spawn.z,
    hp: 390,
    maxHp: 390,
    targetId: null,
    stunUntil: 0,
  };
}

function hooks(caster: DruidPlayer, foe: DruidMob, logs: string[]): DruidHooks {
  const view = pvpFoeView(foe, {
    pvpDef: 40,
    pvpVit: 29,
    pvpMagDef: 20,
    pvpTreePhys: 0,
    pvpTreeMag: 0,
  });
  return {
    pushLog: (_p, m) => logs.push(m),
    stopRest: () => {},
    facingTo: () => 0,
    findMob: (id) => (id && (id === foe.id || id === (foe as { wallet?: string }).wallet) ? view : null),
    allMobs: () => [view],
    allPlayers: () => [caster],
    onMobKill: () => {},
    dist: (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz),
    playerCombatStats: () => ({ str: 14, dex: 18, vit: 20, mnd: 24 }),
    syncVitals: () => {},
    dashToward: () => {},
  };
}

describe("Druid Ash Pit PvP resolver", () => {
  it("is not a Battle Mage kit", () => {
    assert.equal(isDruidAbilityId("bm_fire"), false);
    assert.ok(BATTLEMAGE_ABILITIES.bm_fire);
    assert.equal(isDruidAbilityId("dr_sticklion"), true);
    assert.equal(isDruidAbilityId("dr_stick_rake"), true);
  });

  it("lets a staffed L30 Druid shift lion and rake a marked fighter", () => {
    const p = druid();
    const foe = foePlayer();
    const logs: string[] = [];
    const h = hooks(p, foe, logs);

    assert.equal(pvpAbilityAllowed("druid", 30, null, "dr_sticklion", ASH_PIT), true);
    assert.equal(pvpAbilityAllowed("druid", 30, null, "dr_stick_rake", ASH_PIT), true);
    assert.equal(pvpAbilityAllowed("druid", 30, null, "dr_stick_rake_ii", ASH_PIT), false);
    assert.equal(pvpAbilityAllowed("druid", 30, null, "dr_stick_pounce", ASH_PIT), false);

    resolveDruidAbility(p, "dr_stick_rake", foe.id, NOW, h);
    assert.ok(logs.some((m) => m.includes("Need Stick Lion")));
    assert.equal(foe.hp, 390);

    resolveDruidAbility(p, "dr_sticklion", undefined, NOW, h);
    assert.equal(p.druidForm, 3);
    assert.ok(logs.some((m) => m.includes("Stick Lion")));

    resolveDruidAbility(p, "dr_stick_rake", foe.id, NOW + 50, h);
    assert.ok(foe.hp < 390, "rake must write through the PvP foe view");
    assert.ok(logs.some((m) => m.includes("Stick Rake hits")));
    assert.ok((foe.druidBleedUntil ?? 0) > NOW);
  });

  it("drops Racerunner when a non-travel song is used, and form HP stays a Druid song", () => {
    const p = druid({ druidForm: 4 });
    const foe = foePlayer();
    const logs: string[] = [];
    resolveDruidAbility(p, "dr_dustmend", undefined, NOW, hooks(p, foe, logs));
    assert.equal(p.druidForm, 0);
    assert.ok(logs.some((m) => /racerunner startles/i.test(m)));
  });

  it("requires both fighters to stand in Ash Pit with a bounty", () => {
    const ok = canPvpStrike(
      { x: ASH_PIT.spawn.x, z: ASH_PIT.spawn.z },
      { x: ASH_PIT.spawn.x + 2, z: ASH_PIT.spawn.z },
      true,
    );
    assert.equal(ok.ok, true);
    const noBounty = canPvpStrike(
      { x: ASH_PIT.spawn.x, z: ASH_PIT.spawn.z },
      { x: ASH_PIT.spawn.x + 2, z: ASH_PIT.spawn.z },
      false,
    );
    assert.equal(noBounty.ok, false);
    const outside = canPvpStrike({ x: 0, z: 0 }, { x: ASH_PIT.spawn.x, z: ASH_PIT.spawn.z }, true);
    assert.equal(outside.ok, false);
    const otherZone = canPvpStrike(
      { x: ASH_PIT.spawn.x, z: ASH_PIT.spawn.z, zoneId: "forest_basin" },
      { x: ASH_PIT.spawn.x + 2, z: ASH_PIT.spawn.z, zoneId: "forest_basin" },
      true,
    );
    assert.equal(otherZone.ok, false);
  });

  it("lets a used form toggle while sibling forms recast", () => {
    const p = druid();
    const foe = foePlayer();
    const logs: string[] = [];
    const h = hooks(p, foe, logs);

    resolveDruidAbility(p, "dr_stickbear", undefined, NOW, h);
    assert.equal(p.druidForm, 1);
    assert.equal(p.recasts.dr_stickbear, undefined);
    assert.equal(p.recasts.dr_stickdeer, NOW + DRUID_SHIFT_RECAST_MS);
    assert.equal(p.recasts.dr_sticklion, NOW + DRUID_SHIFT_RECAST_MS);
    assert.equal(p.recasts.dr_racerunner, NOW + DRUID_SHIFT_RECAST_MS);

    resolveDruidAbility(p, "dr_stickbear", undefined, NOW + 50, h);
    assert.equal(p.druidForm, 0);
    resolveDruidAbility(p, "dr_stickbear", undefined, NOW + 100, h);
    assert.equal(p.druidForm, 1);

    const before = logs.length;
    resolveDruidAbility(p, "dr_stickdeer", undefined, NOW + 150, h);
    assert.equal(p.druidForm, 1);
    assert.ok(logs.slice(before).some((m) => m.includes("not ready")));
  });

  it("refuses Unstruck Echo beyond kit range and does not spend", () => {
    const p = druid({ mp: 200 });
    const foe = foePlayer();
    foe.x = p.x + 40;
    const logs: string[] = [];
    resolveDruidAbility(p, "dr_unstruck_echo", foe.id, NOW, hooks(p, foe, logs));
    assert.equal(foe.stunUntil, 0);
    assert.equal(p.mp, 200);
    assert.ok(logs.some((m) => /too far/i.test(m)));
  });

  it("dustmend does not heal a party member beyond kit range", () => {
    const p = druid({ hp: 200, maxHp: 280 });
    const far = druid({ wallet: "0xally", name: "Ally", x: p.x + 40, z: p.z, hp: 80, maxHp: 280 });
    const foe = foePlayer();
    const logs: string[] = [];
    const h = hooks(p, foe, logs);
    h.allPlayers = () => [p, far];
    resolveDruidAbility(p, "dr_dustmend", far.wallet, NOW, h);
    assert.equal(far.hp, 80);
    assert.ok(p.hp > 200);
  });

  it("lets Ring-Walk put the song down", () => {
    const p = druid({ druidForm: 1 });
    const logs: string[] = [];
    dropDruidForm(p, { pushLog: (_pl, m) => logs.push(m), syncVitals: () => {} }, "test drop");
    assert.equal(p.druidForm, 0);
    assert.ok(logs.includes("test drop"));
  });
});
