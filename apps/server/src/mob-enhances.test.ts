import assert from "node:assert/strict";
import test from "node:test";
import { resolveBattleMageAbility, type BattleMageHooks, type BattleMageMob, type BattleMagePlayer } from "./battlemage-abilities";
import { resetGameRollForTests, scriptNextRollsForTests } from "./game-roll";
import { emptyMobEnhances, stripMobEnhances, takeMobHit } from "./mob-enhances";
import { tryMobJobAbility, type MobJobCombatant } from "./mob-job-ai";

const NOW = 10_000;

test("Unravel strips enhancements and leaves the list empty", () => {
  const host = {
    ...emptyMobEnhances(),
    protectUntil: NOW + 5_000,
    protectPhysMul: 0.75,
    shellUntil: NOW + 5_000,
    shellMagMul: 0.75,
    hasteUntil: NOW + 5_000,
    hastePct: 0.25,
    stoneskinUntil: NOW + 5_000,
    stoneskinAbsorb: 40,
    atkBuffUntil: NOW + 5_000,
    atkBuffMul: 1.35,
    falseGuardUntil: NOW + 5_000,
    diaUntil: NOW + 5_000,
  };
  assert.deepEqual(stripMobEnhances(host, NOW), ["Protect", "Shell", "Haste", "Stoneskin", "Berserk", "False Guard"]);
  assert.deepEqual(stripMobEnhances(host, NOW), []);
  assert.equal(host.diaUntil, NOW + 5_000);
  assert.equal(host.atkBuffMul, 1);
  assert.equal(host.stoneskinAbsorb, 0);
});

test("Protect, Shell, and Stoneskin change the hit that lands", () => {
  const protect = { ...emptyMobEnhances(), protectUntil: NOW + 1, protectPhysMul: 0.75 };
  assert.equal(takeMobHit(protect, 20, "physical", NOW), 15);
  assert.equal(takeMobHit(protect, 20, "magic", NOW), 20);

  const shell = { ...emptyMobEnhances(), shellUntil: NOW + 1, shellMagMul: 0.75 };
  assert.equal(takeMobHit(shell, 20, "magic", NOW), 15);
  assert.equal(takeMobHit(shell, 20, "physical", NOW), 20);

  const skin = { ...emptyMobEnhances(), stoneskinUntil: NOW + 1, stoneskinAbsorb: 12 };
  assert.equal(takeMobHit(skin, 20, "physical", NOW), 8);
  assert.equal(skin.stoneskinAbsorb, 0);
  assert.equal(skin.stoneskinUntil, 0);
  assert.equal(takeMobHit({ ...emptyMobEnhances() }, 20, "physical", NOW), 20);
});

test("a healthy sorcerer opens with Shell", () => {
  const mob: MobJobCombatant = {
    id: "m1",
    name: "Ash Adept",
    x: 0,
    z: 0,
    hp: 100,
    maxHp: 100,
    mp: 40,
    maxMp: 40,
    job: "sorcerer",
    level: 12,
    archetype: "test",
    anim: "idle",
    animUntil: 0,
    nextSwingAt: 0,
    nextAbilityAt: 0,
    atkBuffUntil: 0,
    atkBuffMul: 1,
    atkDownUntil: 0,
    atkDownMul: 1,
    addleUntil: 0,
    silenceUntil: 0,
    slowUntil: 0,
    swingPenalty: 0,
  };
  const logs: string[] = [];
  resetGameRollForTests();
  scriptNextRollsForTests([0]);
  try {
    const res = tryMobJobAbility(mob, {
      now: NOW,
      dist: 4,
      player: {
        wallet: "0xp",
        x: 4,
        z: 0,
        hp: 100,
        maxHp: 100,
        mp: 0,
        maxMp: 0,
        slowUntil: 0,
        moveUntil: 0,
        movePct: 0,
        blindUntil: 0,
      },
      vitals: { vit: 10, agi: 10 },
      pushLog: (msg) => logs.push(msg),
      applyPlayerDamage: () => assert.fail("Shell is not a hit"),
    });
    assert.equal(res.ok, true);
    assert.equal(res.ok && res.pending, undefined);
    assert.equal(mob.shellUntil, NOW + 20_000);
    assert.equal(mob.shellMagMul, 0.75);
    assert.match(logs.join(" "), /Shell/);
  } finally {
    resetGameRollForTests();
  }
});

function battleMage(): BattleMagePlayer & { wallet: string } {
  return {
    wallet: "0xbm",
    level: 40,
    job: "battle_mage",
    mp: 100,
    maxMp: 100,
    hp: 200,
    maxHp: 200,
    tp: 0,
    equip: {} as BattleMagePlayer["equip"],
    inventory: [],
    anim: "idle",
    animUntil: 0,
    moveTo: null,
    targetId: "mob",
    facing: 0,
    x: 0,
    z: 0,
    recasts: {},
    hasteUntil: 0,
    hastePct: 0,
    protectUntil: 0,
    protectPhysMul: 1,
    shellUntil: 0,
    shellMagMul: 1,
    spellbladeUntil: 0,
    spellbladeFlashUntil: 0,
    focusWeave: false,
    corruptReady: false,
    spontaneityReady: false,
    lockspellReady: false,
    widenReady: false,
    enSpellUntil: 0,
    enSpellBonus: 0,
    phalanxUntil: 0,
    phalanxPhysMul: 1,
    stoneskinUntil: 0,
    stoneskinAbsorb: 0,
    refreshUntil: 0,
    refreshTick: 0,
  };
}

function foe(): BattleMageMob & { protectUntil: number; protectPhysMul: number; diaUntil: number } {
  return {
    id: "mob",
    name: "Ward Knight",
    alive: true,
    x: 1,
    z: 0,
    hp: 300,
    maxHp: 300,
    targetId: null,
    nextSwingAt: 0,
    slowUntil: 0,
    swingPenalty: 0,
    gravityUntil: 0,
    gravityPct: 0,
    bindUntil: 0,
    silenceUntil: 0,
    paraUntil: 0,
    blindUntil: 0,
    stunUntil: 0,
    sleepUntil: 0,
    frazzleUntil: 0,
    addleUntil: 0,
    falseGuardUntil: 0,
    diaUntil: NOW + 8_000,
    bioUntil: 0,
    bioTick: 0,
    protectUntil: 0,
    protectPhysMul: 1,
  };
}

function hooks(mob: BattleMageMob, logs: string[]): BattleMageHooks {
  return {
    pushLog: (_p, msg) => logs.push(msg),
    stopRest: () => {},
    facingTo: () => 0,
    findMob: () => mob,
    allMobs: () => [mob],
    allPlayers: () => [],
    onMobKill: () => {},
    dist: () => 1,
    playerCombatStats: () => ({ str: 10, dex: 10, vit: 10, agi: 10, int: 20, mnd: 10 }),
  };
}

test("Unravel spends MP only when an enhancement is up", () => {
  const bare = battleMage();
  const bareMob = foe();
  const bareLogs: string[] = [];
  resolveBattleMageAbility(bare, "bm_dispel", "mob", NOW, hooks(bareMob, bareLogs));
  assert.equal(bare.mp, 100);
  assert.match(bareLogs.join(" "), /nothing to unravel/);
  assert.equal(bareMob.diaUntil, NOW + 8_000);

  const caster = battleMage();
  const warded = foe();
  warded.protectUntil = NOW + 10_000;
  warded.protectPhysMul = 0.75;
  const logs: string[] = [];
  resolveBattleMageAbility(caster, "bm_dispel", "mob", NOW, hooks(warded, logs));
  assert.equal(caster.mp, 82);
  assert.equal(warded.protectUntil, 0);
  assert.equal(warded.diaUntil, NOW + 8_000);
  assert.match(logs.join(" "), /Protect unraveled/);
});
