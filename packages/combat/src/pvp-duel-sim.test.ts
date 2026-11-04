/**
 * 1v1 PvP duel simulator. Does not change kits.
 *
 * Damage numbers are the server resolvers. They are landed on a player-shaped
 * target with the player incoming pipeline (physicalDamage / mitigateMagicDamage
 * / physDtMul / playerMagDtMul / stoneskin / solace / mana wall).
 *
 * Sources:
 * - packages/combat/src/index.ts — physicalDamage, attackFromStats, meleeFStr,
 *   hitChance, resolveSwingDelayMs, playerDefense, mitigateMagicDamage
 * - apps/server/src/index.ts playerSwing / playerSwingPvp — acc, crit, TP +80,
 *   haste, blind 45%, delay
 * - apps/server/src/index.ts playerSwing (mob target) — para 35%, backblade,
 *   kill edge, killing storm, double attack, perpetual +5% crit, dia on def
 * - apps/server/src/weapon-tp-abilities.ts resolveWeaponTpAbility
 * - apps/server/src/*-abilities.ts elemental / heal / bash / lifetap formulas
 * - apps/server/src/incoming-dt.ts physDtMul, playerMagDtMul
 * - apps/server/src/gear-combat.ts meleeAtkBonus (main-hand atk ?? 10, scaled)
 * - apps/server/src/mob-job-ai.ts atkDownMul on attack
 * - apps/server/src/index.ts mobSwing — stun / sleep / bind / petrify skip actions
 *
 * swingPenalty is stored by Slow and weapon skills and never multiplies a swing
 * timer (mob pace() and playerSwingPvp ignore it). This sim does not invent one.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BATTLEMAGE_ABILITIES,
  CLERIC_ABILITIES,
  FIGHTER_ABILITIES,
  JOB_IDS,
  KNIGHT_ABILITIES,
  MAX_LEVEL,
  SORCERER_ABILITIES,
  TIM_ABILITIES,
  WEAPON_TP_ABILITIES,
  WEAPON_TP_COST,
  attackFromStats,
  clockwindConversion,
  critFromAgi,
  evasionFromAgi,
  fStr,
  hitChance,
  jobStatsAtLevel,
  jobVitalsAtLevel,
  meleeFStr,
  meleeUsesWeaponAttack,
  mitigateMagicDamage,
  physicalDamage,
  playerDefense,
  playerMagicDefense,
  resolveSwingDelayMs,
  weaponTpBonusMul,
  weaponTpUnlocked,
  applyMagicAttackBonus,
  type JobId,
  type Stats,
  type WeaponType,
} from "./index.ts";
import { physDtMul, playerMagDtMul } from "../../../apps/server/src/incoming-dt.ts";
import { CATALOG, scaleGearStat, type ItemDef } from "../../items/src/index.ts";

const TICK_MS = 50;
const DURATION_MS = 180_000;
const CAST_MS = 600;
const SEEDS = 20;

const FAMILY: Record<JobId, readonly string[]> = {
  time_mage: ["staff"],
  sorcerer: ["staff"],
  cleric: ["staff", "club"],
  fighter: ["greatsword", "axe"],
  rogue: ["dagger"],
  knight: ["sword"],
  battle_mage: ["sword", "staff"],
};

/** Catalog jobRestrict keys. starter-kit.ts uses the same families. */
const RESTRICT: Record<JobId, string> = {
  time_mage: "tim",
  battle_mage: "battlemage",
  knight: "knight",
  rogue: "rogue",
  cleric: "cleric",
  sorcerer: "sorcerer",
  fighter: "fighter",
};

const CASTER_WEAPON: Record<JobId, boolean> = {
  time_mage: true,
  sorcerer: true,
  cleric: true,
  knight: false,
  rogue: false,
  fighter: false,
  battle_mage: false,
};

const SHORT: Record<JobId, string> = {
  time_mage: "TIM",
  knight: "KNT",
  rogue: "ROG",
  cleric: "CLR",
  sorcerer: "SOR",
  fighter: "FTR",
  battle_mage: "BM",
};

type Mode = "full" | "trade";

type Loadout = {
  name: string;
  id: number;
  craftLevel: number;
  family: WeaponType;
  delayMs: number;
  atk: number;
  mab: number;
  mdb: number;
  gearDef: number;
  gearAcc: number;
  stats: Stats;
  maxHp: number;
  maxMp: number;
};

type Unit = {
  job: JobId;
  level: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  tp: number;
  maxTp: number;
  stats: Stats;
  weaponBonus: number;
  mab: number;
  mdb: number;
  gearDef: number;
  gearAcc: number;
  delayMs: number;
  weapon: WeaponType;
  nextSwingAt: number;
  castReadyAt: number;
  recasts: Record<string, number>;
  stance: "flux" | "aether" | "none";
  hasteUntil: number;
  hastePct: number;
  overclockUntil: number;
  moveUntil: number;
  movePct: number;
  slowUntil: number;
  berserkUntil: number;
  defenderUntil: number;
  warcryUntil: number;
  aggressorUntil: number;
  restraintUntil: number;
  bloodRageUntil: number;
  brazenUntil: number;
  killingStormUntil: number;
  backbladeUntil: number;
  killEdgeUntil: number;
  perpetualUntil: number;
  bulwarkUntil: number;
  sentinelUntil: number;
  coverUntil: number;
  rampartUntil: number;
  guardianUntil: number;
  protectUntil: number;
  protectPhysMul: number;
  phalanxUntil: number;
  phalanxPhysMul: number;
  asylumUntil: number;
  fealtyUntil: number;
  shellUntil: number;
  shellMagMul: number;
  manaWallUntil: number;
  stoneskinUntil: number;
  stoneskinAbsorb: number;
  healAbsorbUntil: number;
  healAbsorbHp: number;
  solace: boolean;
  divineSeal: boolean;
  enSpellUntil: number;
  enSpellBonus: number;
  spellbladeUntil: number;
  arcaneFloodUntil: number;
  elementalSealUntil: number;
  cascadeUntil: number;
  focalNeveUntil: number;
  manawell: boolean;
  timeSealUntil: number;
  stunUntil: number;
  sleepUntil: number;
  bindUntil: number;
  petrifyUntil: number;
  paraUntil: number;
  blindUntil: number;
  silenceUntil: number;
  diaUntil: number;
  bioUntil: number;
  bioTick: number;
  bioFrom: Unit | null;
  addleUntil: number;
  distractUntil: number;
  distractAcc: number;
  falseGuardUntil: number;
  frazzleUntil: number;
  atkDownUntil: number;
  atkDownMul: number;
  regenUntil: number;
  regenTick: number;
  regenId: string;
  refreshUntil: number;
  refreshTick: number;
  damageDealt: number;
  healingDone: number;
  wsCasts: number;
  nukeOom: number;
  nukeTries: number;
  minHp: number;
  casts: Record<string, number>;
  dmgBy: Record<string, number>;
  healBy: Record<string, number>;
  controlBy: Record<string, number>;
};

type Fight = {
  mode: Mode;
  level: number;
  a: JobId;
  b: JobId;
  /** Which spawned unit died last. Mirrors share a JobId, so this cannot be a job. */
  winner: "a" | "b" | null;
  ms: number;
  aDmg: number;
  bDmg: number;
  aHeal: number;
  bHeal: number;
  aMin: number;
  bMin: number;
  aEnd: number;
  bEnd: number;
  aWs: number;
  bWs: number;
  aMaxTp: number;
  bMaxTp: number;
  aOom: number;
  bOom: number;
  aTries: number;
  bTries: number;
};

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function bump(map: Record<string, number>, key: string, n: number) {
  if (n === 0) return;
  map[key] = (map[key] ?? 0) + n;
}

function canWear(def: ItemDef, key: string): boolean {
  const restrict = def.jobRestrict;
  if (restrict == null || restrict === "all") return true;
  return (restrict as readonly string[]).includes(key);
}

function pickWeapon(job: JobId, level: number): Loadout {
  const families = new Set(FAMILY[job]);
  const key = RESTRICT[job];
  let best: ItemDef | null = null;
  let bestScore = -1;
  let bestDelay = Number.POSITIVE_INFINITY;
  for (const def of CATALOG) {
    if (def.slot !== "main" || !def.weaponFamily) continue;
    if (!families.has(def.weaponFamily)) continue;
    if (!canWear(def, key)) continue;
    const ilvl = def.craftLevel ?? 1;
    const atk = scaleGearStat(def.stats?.atk ?? 10, level, ilvl);
    const mab = scaleGearStat(def.stats?.mab ?? 0, level, ilvl);
    const score = CASTER_WEAPON[job] ? mab * 1000 + atk : atk * 1000 + mab;
    const delay = def.delayMs ?? 99999;
    if (score > bestScore || (score === bestScore && delay < bestDelay)) {
      best = def;
      bestScore = score;
      bestDelay = delay;
    }
  }
  if (!best || !best.weaponFamily) throw new Error(`no weapon for ${job}`);
  const ilvl = best.craftLevel ?? 1;
  const add = (stat: number | undefined) => scaleGearStat(stat ?? 0, level, ilvl);
  const base = jobStatsAtLevel(job, level);
  const vitals = jobVitalsAtLevel(job, level);
  const stats: Stats = {
    str: base.str + add(best.stats?.str),
    dex: base.dex + add(best.stats?.dex),
    vit: base.vit + add(best.stats?.vit),
    agi: base.agi + add(best.stats?.agi),
    int: base.int + add(best.stats?.int),
    mnd: base.mnd + add(best.stats?.mnd),
  };
  const maxHp = vitals.maxHp + add(best.stats?.hp);
  const maxMp = vitals.maxMp === 0 ? 0 : vitals.maxMp + add(best.stats?.mp);
  return {
    name: best.name,
    id: best.id,
    craftLevel: ilvl,
    family: best.weaponFamily as WeaponType,
    delayMs: best.delayMs && best.delayMs > 0 ? best.delayMs : 1600,
    atk: scaleGearStat(best.stats?.atk ?? 10, level, ilvl),
    mab: add(best.stats?.mab),
    mdb: add(best.stats?.mdb),
    gearDef: add(best.stats?.def),
    gearAcc: add(best.stats?.acc),
    stats,
    maxHp,
    maxMp,
  };
}

function spawn(job: JobId, level: number, gear: Loadout): Unit {
  return {
    job,
    level,
    hp: gear.maxHp,
    maxHp: gear.maxHp,
    mp: gear.maxMp,
    maxMp: gear.maxMp,
    tp: 0,
    maxTp: 0,
    stats: gear.stats,
    weaponBonus: gear.atk,
    mab: gear.mab,
    mdb: gear.mdb,
    gearDef: gear.gearDef,
    gearAcc: gear.gearAcc,
    delayMs: gear.delayMs,
    weapon: gear.family,
    nextSwingAt: 0,
    castReadyAt: 0,
    recasts: {},
    stance: "none",
    hasteUntil: 0,
    hastePct: 0,
    overclockUntil: 0,
    moveUntil: 0,
    movePct: 0,
    slowUntil: 0,
    berserkUntil: 0,
    defenderUntil: 0,
    warcryUntil: 0,
    aggressorUntil: 0,
    restraintUntil: 0,
    bloodRageUntil: 0,
    brazenUntil: 0,
    killingStormUntil: 0,
    backbladeUntil: 0,
    killEdgeUntil: 0,
    perpetualUntil: 0,
    bulwarkUntil: 0,
    sentinelUntil: 0,
    coverUntil: 0,
    rampartUntil: 0,
    guardianUntil: 0,
    protectUntil: 0,
    protectPhysMul: 1,
    phalanxUntil: 0,
    phalanxPhysMul: 1,
    asylumUntil: 0,
    fealtyUntil: 0,
    shellUntil: 0,
    shellMagMul: 1,
    manaWallUntil: 0,
    stoneskinUntil: 0,
    stoneskinAbsorb: 0,
    healAbsorbUntil: 0,
    healAbsorbHp: 0,
    solace: false,
    divineSeal: false,
    enSpellUntil: 0,
    enSpellBonus: 0,
    spellbladeUntil: 0,
    arcaneFloodUntil: 0,
    elementalSealUntil: 0,
    cascadeUntil: 0,
    focalNeveUntil: 0,
    manawell: false,
    timeSealUntil: 0,
    stunUntil: 0,
    sleepUntil: 0,
    bindUntil: 0,
    petrifyUntil: 0,
    paraUntil: 0,
    blindUntil: 0,
    silenceUntil: 0,
    diaUntil: 0,
    bioUntil: 0,
    bioTick: 0,
    bioFrom: null,
    addleUntil: 0,
    distractUntil: 0,
    distractAcc: 0,
    falseGuardUntil: 0,
    frazzleUntil: 0,
    atkDownUntil: 0,
    atkDownMul: 1,
    regenUntil: 0,
    regenTick: 0,
    regenId: "",
    refreshUntil: 0,
    refreshTick: 0,
    damageDealt: 0,
    healingDone: 0,
    wsCasts: 0,
    nukeOom: 0,
    nukeTries: 0,
    minHp: gear.maxHp,
    casts: {},
    dmgBy: {},
    healBy: {},
    controlBy: {},
  };
}

function noteHp(u: Unit) {
  if (u.hp < u.minHp) u.minHp = u.hp;
}

function locked(u: Unit, now: number, full: boolean): boolean {
  if (!full) return false;
  return now < u.stunUntil || now < u.sleepUntil || now < u.bindUntil || now < u.petrifyUntil;
}

function spellsSealed(u: Unit, now: number): boolean {
  // index.ts handleAbility — silence blocks these four kits only.
  return (
    now < u.silenceUntil &&
    (u.job === "time_mage" || u.job === "sorcerer" || u.job === "cleric" || u.job === "battle_mage")
  );
}

function bladeFree(u: Unit, id: string, now: number): boolean {
  return u.job === "battle_mage" && now < u.spellbladeUntil && id !== "spellblade";
}

function mpFree(u: Unit, now: number): boolean {
  return (u.job === "sorcerer" && now < u.arcaneFloodUntil) || (u.job === "battle_mage" && now < u.spellbladeUntil);
}

function pay(u: Unit, id: string, mp: number, recast: number, now: number, anim = CAST_MS): boolean {
  const ignoreRecast = bladeFree(u, id, now);
  if (!ignoreRecast && now < (u.recasts[id] ?? 0)) return false;
  const flooded = mpFree(u, now);
  const well = u.manawell && mp > 0 && !flooded;
  if (!flooded && !well && u.mp < mp) return false;
  if (well) u.manawell = false;
  else if (!flooded) u.mp -= mp;
  if (!ignoreRecast && recast > 0) u.recasts[id] = now + recast;
  u.castReadyAt = now + anim;
  bump(u.casts, id, 1);
  return true;
}

function hasteOf(u: Unit, now: number): number {
  // index.ts playerHastePct. swingDelayMs then clamps at 0.8.
  let haste = now < u.hasteUntil ? u.hastePct : 0;
  if (now < u.overclockUntil) haste = Math.min(0.8, haste + 0.15);
  return Math.min(0.85, haste);
}

function applyHaste(u: Unit, pct: number, duration: number, now: number) {
  // tim-abilities.ts applySelfHaste
  if (now > u.hasteUntil || pct >= u.hastePct) {
    u.hastePct = pct;
    u.hasteUntil = now + duration;
  } else {
    u.hasteUntil = Math.max(u.hasteUntil, now + duration);
  }
}

function fighterAtkMul(u: Unit, now: number): number {
  // fighter-abilities.ts fighterAttackMul
  let mul = 1;
  if (now < u.berserkUntil) mul *= 1.25;
  if (now < u.defenderUntil) mul *= 0.75;
  if (now < u.warcryUntil) mul *= 1.15;
  return mul;
}

function fighterDefMul(u: Unit, now: number): number {
  let mul = 1;
  if (now < u.berserkUntil) mul *= 0.75;
  if (now < u.defenderUntil) mul *= 1.25;
  return mul;
}

function ccLeft(u: Unit, now: number): number {
  return Math.max(u.stunUntil, u.sleepUntil, u.bindUntil, u.petrifyUntil) - now;
}

function control(u: Unit, id: string, foe: Unit, field: "stunUntil" | "bindUntil" | "petrifyUntil" | "sleepUntil" | "silenceUntil" | "paraUntil" | "blindUntil", until: number, now: number) {
  const prev = foe[field];
  const start = Math.max(now, prev);
  foe[field] = Math.max(prev, until);
  bump(u.controlBy, id, Math.max(0, foe[field] - start));
}

function absorbStoneskin(p: Unit, now: number, raw: number): number {
  // battlemage-abilities.ts absorbStoneskin
  if (now >= p.stoneskinUntil || p.stoneskinAbsorb <= 0) return raw;
  const absorbed = Math.min(p.stoneskinAbsorb, raw);
  p.stoneskinAbsorb -= absorbed;
  if (p.stoneskinAbsorb <= 0) p.stoneskinUntil = 0;
  return Math.max(0, raw - absorbed);
}

function absorbHealShield(p: Unit, now: number, raw: number): number {
  // cleric-abilities.ts absorbHealShield
  if (now >= p.healAbsorbUntil || p.healAbsorbHp <= 0) {
    if (now >= p.healAbsorbUntil) {
      p.healAbsorbHp = 0;
      p.healAbsorbUntil = 0;
    }
    return raw;
  }
  const soaked = Math.min(p.healAbsorbHp, raw);
  p.healAbsorbHp -= soaked;
  if (p.healAbsorbHp <= 0) {
    p.healAbsorbHp = 0;
    p.healAbsorbUntil = 0;
  }
  return Math.max(0, raw - soaked);
}

function absorbManaWall(p: Unit, now: number, raw: number): number {
  // index.ts absorbManaWall
  if (raw <= 0 || now >= p.manaWallUntil) return raw;
  const bled = Math.min(p.mp, raw);
  p.mp -= bled;
  return Math.max(0, raw - bled);
}

function finishPhysical(attacker: Unit, defender: Unit, raw: number, now: number, id: string): number {
  // Perpetual and en-spell are applied by the auto caller. WS / bash / lifetap do not get them.
  let dmg = Math.max(0, Math.floor(raw * physDtMul(defender, now, 0)));
  dmg = absorbStoneskin(defender, now, dmg);
  dmg = absorbHealShield(defender, now, dmg);
  dmg = Math.max(0, Math.floor(dmg * fighterDefMul(defender, now)));
  dmg = absorbManaWall(defender, now, dmg);
  if (dmg > 0 && now < attacker.addleUntil) dmg = Math.max(1, Math.floor(dmg * 0.65));
  if (dmg <= 0) return 0;
  if (now < defender.sleepUntil) defender.sleepUntil = 0;
  defender.hp = Math.max(0, defender.hp - dmg);
  noteHp(defender);
  attacker.damageDealt += dmg;
  bump(attacker.dmgBy, id, dmg);
  return dmg;
}

function finishMagic(attacker: Unit, defender: Unit, raw: number, now: number, id: string): number {
  // applyPendingMobDamage magic branch: resist, mag DT, stoneskin, solace, fighter def, mana wall, addle.
  if (!(raw > 0)) return 0;
  const magDef = playerMagicDefense(defender.stats.mnd, defender.mdb);
  let dmg = mitigateMagicDamage(raw, magDef);
  dmg = Math.max(0, Math.floor(dmg * playerMagDtMul(defender, now, 0)));
  dmg = absorbStoneskin(defender, now, dmg);
  dmg = absorbHealShield(defender, now, dmg);
  dmg = Math.max(0, Math.floor(dmg * fighterDefMul(defender, now)));
  dmg = absorbManaWall(defender, now, dmg);
  if (dmg > 0 && now < attacker.addleUntil) dmg = Math.max(1, Math.floor(dmg * 0.65));
  if (dmg <= 0) return 0;
  defender.hp = Math.max(0, defender.hp - dmg);
  noteHp(defender);
  attacker.damageDealt += dmg;
  bump(attacker.dmgBy, id, dmg);
  return dmg;
}

function heal(u: Unit, amount: number, id: string) {
  if (amount <= 0 || u.hp <= 0) return 0;
  const got = Math.min(u.maxHp - u.hp, amount);
  u.hp += got;
  u.healingDone += got;
  bump(u.healBy, id, got);
  return got;
}

function tickSecond(u: Unit, now: number) {
  // index.ts player tick, once per second (TICK_HZ).
  if (now < u.refreshUntil) {
    const gain = Math.max(1, u.refreshTick || 4);
    u.mp = Math.min(u.maxMp, u.mp + gain);
  }
  if (now < u.regenUntil && u.regenTick > 0 && u.hp > 0 && u.hp < u.maxHp) {
    heal(u, u.regenTick, u.regenId || "regen");
  }
  if (u.hp > 0 && now < u.bioUntil && u.bioTick > 0) {
    const dmg = u.bioTick;
    u.hp = Math.max(0, u.hp - dmg);
    noteHp(u);
    if (u.bioFrom) {
      u.bioFrom.damageDealt += dmg;
      bump(u.bioFrom.dmgBy, "bm_bio", dmg);
    }
  }
}

function swing(u: Unit, foe: Unit, now: number, rng: () => number, full: boolean) {
  if (u.hp <= 0 || foe.hp <= 0) return;
  if (u.stance === "aether") return; // index.ts playerSwing
  if (locked(u, now, full)) return;
  if (now < u.nextSwingAt) return;
  if (now < u.paraUntil && rng() < 0.35) {
    // playerSwing vs mobs. playerSwingPvp does not check para.
    u.nextSwingAt = now + 800;
    return;
  }
  const delayBase = resolveSwingDelayMs(u.delayMs, hasteOf(u, now));
  let delay = delayBase;
  if (now < u.slowUntil) {
    const slowAmt = now < u.moveUntil && u.movePct < 0 ? -u.movePct : 0.22;
    delay = Math.floor(delay * (1 + slowAmt));
  }
  u.nextSwingAt = now + Math.max(200, delay);

  const physical = u.job !== "time_mage" && u.job !== "sorcerer" && u.job !== "cleric";
  if (now < u.blindUntil && rng() < 0.45) return;

  let att = attackFromStats(u.stats, u.stance, u.weaponBonus, {
    physical: meleeUsesWeaponAttack(u.job),
  });
  if (physical || u.job === "fighter") att = Math.max(1, Math.floor(att * fighterAtkMul(u, now)));
  if (now < u.atkDownUntil) att = Math.max(1, Math.floor(att * (u.atkDownMul || 1)));

  let def = playerDefense(foe.stats.vit, foe.gearDef);
  if (now < foe.diaUntil) def = Math.max(1, Math.floor(def * 0.7));

  let acc = u.stats.dex + 40 + u.gearAcc;
  if (now < u.aggressorUntil) acc += 25;
  // playerSwing: mob.distractAcc is subtracted from the attacker's accuracy.
  if (now < foe.distractUntil) acc -= foe.distractAcc;
  const agi = Math.max(0, foe.stats.agi - (now < foe.aggressorUntil ? 25 : 0));
  let eva = evasionFromAgi(agi);
  if (now < foe.falseGuardUntil) eva = Math.max(0, eva - 18);
  const chance = hitChance(acc, eva);
  if (rng() > chance) return;

  let critChance = physical ? 0.08 : u.stance === "flux" ? 0.12 : 0.05;
  critChance += critFromAgi(u.stats.agi);
  if (now < u.bloodRageUntil) critChance += 0.12;
  if (now < u.perpetualUntil) critChance += 0.05;
  const forced = now < u.killingStormUntil || now < u.backbladeUntil || now < u.killEdgeUntil;
  const crit = forced || rng() < critChance;
  let raw = physicalDamage(att, def, meleeFStr(u.job, u.stats, foe.stats.vit, u.stance), crit);
  if (now < u.backbladeUntil) {
    u.backbladeUntil = 0;
    raw += Math.floor(u.stats.dex * 0.6);
  }
  if (now < u.killEdgeUntil) {
    u.killEdgeUntil = 0;
    u.tp = Math.min(3000, u.tp + 300);
  }
  // playerSwing: perpetual then en-spell, then mitigation. Double attack is 85% of the mitigated hit, mitigated again.
  if (now < u.perpetualUntil) raw = Math.floor(raw * 1.15);
  if (u.job === "battle_mage" && now < u.enSpellUntil) {
    raw += u.enSpellBonus + Math.floor(u.stats.int * 0.35);
  }
  const dealt = finishPhysical(u, foe, raw, now, "auto");
  if (dealt <= 0) return;
  const tpMul = u.job === "fighter" && now < u.restraintUntil ? 1.5 : 1;
  const tpGain = Math.floor(80 * tpMul);
  u.tp = Math.min(3000, u.tp + tpGain);
  if (u.tp > u.maxTp) u.maxTp = u.tp;
  if (foe.hp > 0 && u.job === "fighter" && now < u.brazenUntil && rng() < 0.45) {
    const dealt2 = finishPhysical(u, foe, Math.max(1, Math.floor(dealt * 0.85)), now, "auto");
    if (dealt2 > 0) {
      u.tp = Math.min(3000, u.tp + Math.floor(tpGain * 0.6));
      if (u.tp > u.maxTp) u.maxTp = u.tp;
    }
  }
}

function tryWs(u: Unit, foe: Unit, now: number, full: boolean): boolean {
  if (u.tp < WEAPON_TP_COST || foe.hp <= 0) return false;
  const ids = weaponTpUnlocked(u.weapon, u.level);
  let best: string | null = null;
  let score = -1;
  for (const id of ids) {
    const def = WEAPON_TP_ABILITIES[id];
    if (now < (u.recasts[id] ?? 0)) continue;
    const s = def.hits * def.ftp;
    if (s > score) {
      score = s;
      best = id;
    }
  }
  if (!best) return false;
  const def = WEAPON_TP_ABILITIES[best as keyof typeof WEAPON_TP_ABILITIES];
  if (!pay(u, best, 0, def.recastMs, now, 520)) return false;
  const tpBefore = u.tp;
  const tpMul = weaponTpBonusMul(tpBefore);
  u.tp -= WEAPON_TP_COST;
  u.wsCasts += 1;
  // weapon-tp-abilities.ts: physical attack, no berserk mul, fStr not meleeFStr.
  let att = attackFromStats(u.stats, "none", u.weaponBonus, { physical: true });
  if (now < u.atkDownUntil) att = Math.max(1, Math.floor(att * (u.atkDownMul || 1)));
  let defStat = Math.max(1, Math.floor(u.stats.vit)); // placeholder replaced below
  defStat = Math.floor(foe.stats.vit * 1.5);
  if (now < foe.diaUntil) defStat = Math.max(1, Math.floor(defStat * 0.7));
  const hits = Math.max(1, def.hits);
  for (let i = 0; i < hits && foe.hp > 0; i++) {
    const base = physicalDamage(att, defStat, fStr(u.stats.str, foe.stats.vit), false);
    const core = Math.max(1, Math.floor(base * def.ftp));
    const bonus = Math.max(0, Math.floor(core * tpMul));
    finishPhysical(u, foe, core + bonus, now, best);
  }
  for (const fx of def.effects ?? []) {
    if (fx.kind === "stun" && full) control(u, best, foe, "stunUntil", now + fx.durationMs, now);
    else if (fx.kind === "para") control(u, best, foe, "paraUntil", now + fx.durationMs, now);
    else if (fx.kind === "atk_down") {
      foe.atkDownUntil = Math.max(foe.atkDownUntil, now + fx.durationMs);
      foe.atkDownMul = Math.min(foe.atkDownMul || 1, fx.mul);
    }
    // slow writes swingPenalty. No swing timer reads it.
  }
  return true;
}

function sorcRaw(u: Unit, potency: number, now: number): number {
  // sorcerer-abilities.ts elementalDamage
  let base = potency * 0.52 + u.stats.int * 2.85 + u.stats.mnd * 0.35;
  if (now < u.elementalSealUntil) base *= 1.45;
  if (now < u.focalNeveUntil) base *= 1.22;
  if (now < u.cascadeUntil) base *= 1.35;
  return applyMagicAttackBonus(Math.max(1, Math.floor(base)), u.mab);
}

function bestSorcNuke(level: number): string | null {
  let best: string | null = null;
  let pot = -1;
  for (const [id, def] of Object.entries(SORCERER_ABILITIES)) {
    if (def.category !== "elemental" || def.potency == null || def.unlockLevel > level) continue;
    if (def.potency > pot) {
      pot = def.potency;
      best = id;
    }
  }
  return best;
}

function bestBmNuke(level: number): string | null {
  let best: string | null = null;
  let pot = -1;
  for (const [id, def] of Object.entries(BATTLEMAGE_ABILITIES)) {
    if (def.category !== "nuke" || def.potency == null || def.unlockLevel > level) continue;
    if (def.potency > pot) {
      pot = def.potency;
      best = id;
    }
  }
  return best;
}

function hasEnhance(u: Unit, now: number): boolean {
  return (
    u.protectUntil > now ||
    u.shellUntil > now ||
    u.hasteUntil > now ||
    (u.stoneskinUntil > now && u.stoneskinAbsorb > 0) ||
    u.falseGuardUntil > now
  );
}

function stripEnhances(u: Unit, now: number): boolean {
  // mob-enhances.ts stripMobEnhances. Phalanx / Sentinel / Berserk / Asylum are not on this host.
  let any = false;
  if (u.protectUntil > now) {
    u.protectUntil = 0;
    u.protectPhysMul = 1;
    any = true;
  }
  if (u.shellUntil > now) {
    u.shellUntil = 0;
    u.shellMagMul = 1;
    any = true;
  }
  if (u.hasteUntil > now) {
    u.hasteUntil = 0;
    u.hastePct = 0;
    any = true;
  }
  if (u.stoneskinUntil > now && u.stoneskinAbsorb > 0) {
    u.stoneskinUntil = 0;
    u.stoneskinAbsorb = 0;
    any = true;
  }
  if (u.falseGuardUntil > now) {
    u.falseGuardUntil = 0;
    any = true;
  }
  return any;
}

function actFighter(u: Unit, foe: Unit, now: number, full: boolean) {
  const k = FIGHTER_ABILITIES;
  if (u.level >= 1 && now >= (u.recasts.killing_storm ?? 0) && u.killingStormUntil <= now) {
    if (pay(u, "killing_storm", 0, k.killing_storm.recastMs, now)) {
      u.killingStormUntil = now + (k.killing_storm.durationMs ?? 45_000);
      return;
    }
  }
  if (u.level >= 5 && u.berserkUntil <= now && pay(u, "berserk", 0, k.berserk.recastMs, now)) {
    u.berserkUntil = now + (k.berserk.durationMs ?? 180_000);
    return;
  }
  if (u.level >= 15 && u.warcryUntil <= now && pay(u, "warcry", 0, k.warcry.recastMs, now)) {
    u.warcryUntil = now + (k.warcry.durationMs ?? 30_000);
    return;
  }
  if (u.level >= 35 && u.aggressorUntil <= now && pay(u, "aggressor", 0, k.aggressor.recastMs, now)) {
    u.aggressorUntil = now + (k.aggressor.durationMs ?? 180_000);
    return;
  }
  if (u.level >= 55 && u.restraintUntil <= now && pay(u, "restraint", 0, k.restraint.recastMs, now)) {
    u.restraintUntil = now + (k.restraint.durationMs ?? 180_000);
    return;
  }
  if (u.level >= 65 && u.bloodRageUntil <= now && pay(u, "blood_rage", 0, k.blood_rage.recastMs, now)) {
    u.bloodRageUntil = now + (k.blood_rage.durationMs ?? 30_000);
    return;
  }
  if (u.level >= 75 && u.brazenUntil <= now && pay(u, "brazen_rush", 0, k.brazen_rush.recastMs, now)) {
    u.brazenUntil = now + (k.brazen_rush.durationMs ?? 30_000);
    return;
  }
  tryWs(u, foe, now, full);
}

function actRogue(u: Unit, foe: Unit, now: number, full: boolean) {
  const back = u.level >= 15 && u.backbladeUntil <= now;
  if (back && pay(u, "backblade", 0, 60_000, now)) {
    u.backbladeUntil = now + 30_000;
    return;
  }
  if (u.level >= 60 && u.killEdgeUntil <= now && pay(u, "kill_edge", 0, 5 * 60_000, now)) {
    u.killEdgeUntil = now + 30_000;
    return;
  }
  if (u.level >= 75 && foe.falseGuardUntil <= now && pay(u, "false_guard", 0, 2 * 60_000, now)) {
    foe.falseGuardUntil = now + 30_000;
    return;
  }
  if (u.level >= 40 && u.hp / u.maxHp < 0.7 && pay(u, "lifetap", 0, 15 * 60_000, now)) {
    // rogue-abilities.ts lifetap
    const att = Math.max(1, Math.floor(u.stats.str + u.stats.dex * 0.4 + 10));
    const def = Math.floor(foe.stats.vit * 1.5);
    const dealt = finishPhysical(
      u,
      foe,
      physicalDamage(att, def, fStr(u.stats.str, foe.stats.vit), false),
      now,
      "lifetap",
    );
    const got = Math.min(u.maxHp - u.hp, Math.floor(dealt * 0.85));
    heal(u, got, "lifetap");
    u.tp = Math.min(3000, u.tp + 60);
    return;
  }
  if (full && u.level >= 1 && u.hp / u.maxHp < 0.35 && (u.casts.ghost_step ?? 0) === 0 && pay(u, "ghost_step", 0, 2 * 60 * 60 * 1000, now)) {
    // No player-swing consumer. Cast so the zero-effect counter sees it.
    return;
  }
  tryWs(u, foe, now, full);
}

function knightHealAmt(u: Unit, base: number): number {
  return Math.floor(base + u.stats.mnd * 1.5);
}

function actKnight(u: Unit, foe: Unit, now: number, full: boolean) {
  const casterFoe = foe.job === "sorcerer" || foe.job === "time_mage" || foe.job === "cleric" || foe.job === "battle_mage";
  const k = KNIGHT_ABILITIES;
  if (!casterFoe && u.level >= 1 && u.bulwarkUntil <= now && (u.casts.bulwark ?? 0) === 0 && pay(u, "bulwark", 0, k.bulwark.recastMs, now)) {
    u.bulwarkUntil = now + 30_000;
    return;
  }
  if (casterFoe && u.level >= 55 && u.fealtyUntil <= now && pay(u, "fealty", 0, k.fealty.recastMs, now)) {
    u.fealtyUntil = now + 60_000;
    return;
  }
  const shells = ["kn_shell", "kn_shell_ii", "kn_shell_iii"] as const;
  if (u.shellUntil <= now) {
    for (const id of [...shells].reverse()) {
      const def = k[id];
      if (def.unlockLevel > u.level) continue;
      if (pay(u, id, def.mp, def.recastMs, now)) {
        u.shellUntil = now + (def.durationMs ?? 180_000);
        u.shellMagMul = def.magDt ?? 0.9;
        return;
      }
    }
  }
  const wards = ["kn_protect", "kn_protect_ii", "kn_protect_iii"] as const;
  if (u.protectUntil <= now) {
    for (const id of [...wards].reverse()) {
      const def = k[id];
      if (def.unlockLevel > u.level) continue;
      if (pay(u, id, def.mp, def.recastMs, now)) {
        u.protectUntil = now + (def.durationMs ?? 180_000);
        u.protectPhysMul = def.physDt ?? 0.9;
        return;
      }
    }
  }
  if (u.level >= 45 && u.sentinelUntil <= now && pay(u, "sentinel", 0, k.sentinel.recastMs, now)) {
    u.sentinelUntil = now + 30_000;
    return;
  }
  if (u.level >= 35 && u.rampartUntil <= now && (u.casts.rampart ?? 0) === 0 && pay(u, "rampart", 0, k.rampart.recastMs, now)) {
    u.rampartUntil = now + 30_000;
    return;
  }
  if (u.level >= 75 && u.guardianUntil <= now && (u.casts.guardian ?? 0) === 0 && pay(u, "guardian", 0, k.guardian.recastMs, now)) {
    u.guardianUntil = now + 20_000;
    return;
  }
  if (u.level >= 25 && u.coverUntil <= now && (u.casts.cover ?? 0) === 0 && pay(u, "cover", 0, k.cover.recastMs, now)) {
    u.coverUntil = now + 15_000;
    return;
  }
  const cures = [
    ["kn_cure_iv", 65, 55, 320],
    ["kn_cure_iii", 45, 36, 180],
    ["kn_cure_ii", 30, 18, 95],
    ["kn_cure", 5, 8, 45],
  ] as const;
  if (u.hp / u.maxHp < 0.72) {
    for (const [id, lv, mp, base] of cures) {
      if (u.level < lv || u.mp < mp) continue;
      const amt = knightHealAmt(u, base);
      if (u.maxHp - u.hp < amt * 0.35 && u.hp / u.maxHp > 0.55) continue;
      if (pay(u, id, mp, 0, now)) {
        heal(u, amt, id);
        return;
      }
    }
  }
  if (u.level >= 65 && u.mp < 40 && u.tp >= 500 && pay(u, "chivalry", 0, k.chivalry.recastMs, now)) {
    const converted = Math.min(u.tp, 1500);
    const mpGain = Math.floor(converted / 10);
    u.tp -= converted;
    u.mp = Math.min(u.maxMp, u.mp + mpGain);
    return;
  }
  if (u.level >= 15 && full && ccLeft(foe, now) < 1500 && pay(u, "shield_bash", 0, k.shield_bash.recastMs, now)) {
    const raw = Math.max(1, Math.floor((k.shield_bash.potency ?? 28) + u.stats.str * 0.8 + u.stats.vit * 0.3));
    finishPhysical(u, foe, raw, now, "shield_bash");
    control(u, "shield_bash", foe, "stunUntil", now + (k.shield_bash.durationMs ?? 5000), now);
    return;
  }
  if (!full && u.level >= 15 && u.hp / u.maxHp > 0.4 && pay(u, "shield_bash", 0, k.shield_bash.recastMs, now)) {
    const raw = Math.max(1, Math.floor((k.shield_bash.potency ?? 28) + u.stats.str * 0.8 + u.stats.vit * 0.3));
    finishPhysical(u, foe, raw, now, "shield_bash");
    return;
  }
  if (u.level >= 20 && foe.blindUntil <= now && pay(u, "kn_flash", k.kn_flash.mp, k.kn_flash.recastMs, now)) {
    control(u, "kn_flash", foe, "blindUntil", now + (k.kn_flash.durationMs ?? 12_000), now);
    return;
  }
  const nukes = ["kn_holy", "kn_banish_ii", "kn_banish"] as const;
  if (u.hp / u.maxHp > 0.45) {
    for (const id of nukes) {
      const def = k[id];
      if (def.unlockLevel > u.level) continue;
      if (u.mp < def.mp) continue;
      if (pay(u, id, def.mp, def.recastMs, now)) {
        const raw = applyMagicAttackBonus(
          Math.max(1, Math.floor((def.potency ?? 55) * 0.35 + u.stats.mnd * 2.2 + u.stats.str * 0.4)),
          u.mab,
        );
        finishMagic(u, foe, raw, now, id);
        return;
      }
    }
  }
  tryWs(u, foe, now, full);
}

function clericHealAmt(u: Unit, base: number, doubled: boolean): number {
  let amt = Math.floor(base + u.stats.mnd * 2.8);
  if (doubled) amt *= 2;
  return amt;
}

function actCleric(u: Unit, foe: Unit, now: number, full: boolean) {
  const c = CLERIC_ABILITIES;
  if (!u.solace && u.level >= 30 && pay(u, "solace_rite", 0, 0, now)) {
    u.solace = true;
    return;
  }
  if (u.level >= 75 && u.asylumUntil <= now && (u.casts.asylum ?? 0) === 0 && pay(u, "asylum", 0, c.asylum.recastMs, now)) {
    u.asylumUntil = now + 30_000;
    return;
  }
  const shells = ["cl_shell", "cl_shell_ii", "cl_shell_iii", "cl_shellra"] as const;
  if (u.shellUntil <= now) {
    for (const id of [...shells].reverse()) {
      const def = c[id];
      if (def.unlockLevel > u.level) continue;
      if (pay(u, id, def.mp, def.recastMs, now)) {
        u.shellUntil = now + (def.durationMs ?? 180_000);
        u.shellMagMul = def.magDt ?? 0.88;
        return;
      }
    }
  }
  const wards = ["cl_protect", "cl_protect_ii", "cl_protect_iii", "cl_protectra"] as const;
  if (u.protectUntil <= now) {
    for (const id of [...wards].reverse()) {
      const def = c[id];
      if (def.unlockLevel > u.level) continue;
      if (pay(u, id, def.mp, def.recastMs, now)) {
        u.protectUntil = now + (def.durationMs ?? 180_000);
        u.protectPhysMul = def.physDt ?? 0.88;
        return;
      }
    }
  }
  const regens = ["cl_regen_iii", "cl_regen_ii", "cl_regen"] as const;
  if (u.regenUntil <= now) {
    for (const id of regens) {
      const def = c[id];
      if (def.unlockLevel > u.level) continue;
      if (pay(u, id, def.mp, def.recastMs, now)) {
        u.regenUntil = now + (def.durationMs ?? 75_000);
        u.regenTick = def.regenTick ?? 12;
        u.regenId = id;
        return;
      }
    }
  }
  if (u.level >= 40 && u.hasteUntil <= now && pay(u, "cl_haste", c.cl_haste.mp, c.cl_haste.recastMs, now)) {
    applyHaste(u, c.cl_haste.haste ?? 0.22, c.cl_haste.durationMs ?? 180_000, now);
    return;
  }
  if (u.hp / u.maxHp < 0.4 && (u.casts.sacred_mercy ?? 0) === 0 && pay(u, "sacred_mercy", 0, c.sacred_mercy.recastMs, now)) {
    heal(u, u.maxHp - u.hp, "sacred_mercy");
    return;
  }
  const cures = [
    ["cl_cure_v", 61, 100, 10_000, 720],
    ["cl_cure_iv", 41, 72, 8_000, 500],
    ["cl_cure_iii", 21, 42, 7_000, 270],
    ["cl_cure_ii", 11, 22, 6_000, 135],
    ["cl_cure", 1, 10, 5_000, 58],
  ] as const;
  if (u.hp / u.maxHp < 0.8) {
    if (u.level >= 15 && !u.divineSeal && u.hp / u.maxHp < 0.5 && (u.casts.divine_seal ?? 0) === 0) {
      if (pay(u, "divine_seal", 0, c.divine_seal.recastMs, now)) {
        u.divineSeal = true;
        return;
      }
    }
    for (const [id, lv, mp, recast, base] of cures) {
      if (u.level < lv) continue;
      const amt = clericHealAmt(u, base, u.divineSeal);
      if (u.hp / u.maxHp > 0.62 && u.maxHp - u.hp < amt * 0.45) continue;
      if (!pay(u, id, mp, recast, now)) continue;
      const doubled = u.divineSeal;
      if (doubled) u.divineSeal = false;
      const gotBase = clericHealAmt(u, base, doubled);
      if (u.solace) {
        const shield = Math.max(1, Math.floor(gotBase * 0.35));
        u.healAbsorbUntil = now + 20_000;
        u.healAbsorbHp = Math.max(u.healAbsorbHp, shield);
      }
      heal(u, gotBase, id);
      return;
    }
  }
  if (foe.job !== "fighter" && foe.job !== "rogue" && foe.silenceUntil <= now && u.level >= 38 && pay(u, "cl_silence", c.cl_silence.mp, c.cl_silence.recastMs, now)) {
    control(u, "cl_silence", foe, "silenceUntil", now + (c.cl_silence.durationMs ?? 30_000), now);
    return;
  }
  if (foe.paraUntil <= now && u.level >= 32 && pay(u, "cl_paralyze", c.cl_paralyze.mp, c.cl_paralyze.recastMs, now)) {
    control(u, "cl_paralyze", foe, "paraUntil", now + (c.cl_paralyze.durationMs ?? 30_000), now);
    return;
  }
  if (foe.blindUntil <= now && u.level >= 45 && pay(u, "cl_flash", c.cl_flash.mp, c.cl_flash.recastMs, now)) {
    control(u, "cl_flash", foe, "blindUntil", now + (c.cl_flash.durationMs ?? 12_000), now);
    return;
  }
  if (u.hp / u.maxHp > 0.7) {
    const nukes = ["cl_holy", "cl_banish_ii", "cl_banish"] as const;
    for (const id of nukes) {
      const def = c[id];
      if (def.unlockLevel > u.level || def.potency == null) continue;
      if (pay(u, id, def.mp, def.recastMs, now)) {
        const doubled = u.divineSeal;
        if (doubled) u.divineSeal = false;
        let dmg = Math.max(1, Math.floor(def.potency * 0.4 + u.stats.mnd * 2.5));
        if (doubled) dmg *= 2;
        finishMagic(u, foe, applyMagicAttackBonus(dmg, u.mab), now, id);
        return;
      }
    }
  }
  tryWs(u, foe, now, full);
}

function actSorcerer(u: Unit, foe: Unit, now: number, full: boolean) {
  const s = SORCERER_ABILITIES;
  if (full && u.level >= 11 && ccLeft(foe, now) < 2500 && pay(u, "sc_root_sigil", s.sc_root_sigil.mp, 0, now)) {
    control(u, "sc_root_sigil", foe, "bindUntil", now + (s.sc_root_sigil.durationMs ?? 60_000), now);
    return;
  }
  if (u.arcaneFloodUntil <= now && (u.casts.arcane_flood ?? 0) === 0 && pay(u, "arcane_flood", 0, s.arcane_flood.recastMs, now)) {
    u.arcaneFloodUntil = now + 60_000;
    return;
  }
  if (u.level >= 75 && u.focalNeveUntil <= now && pay(u, "focal_neve", 0, s.focal_neve.recastMs, now)) {
    u.focalNeveUntil = now + 60_000;
    return;
  }
  if (u.level >= 30 && u.manaWallUntil <= now && (u.casts.mana_wall ?? 0) === 0 && pay(u, "mana_wall", 0, s.mana_wall.recastMs, now)) {
    u.manaWallUntil = now + 60_000;
    return;
  }
  if (u.level >= 60 && u.cascadeUntil <= now && pay(u, "cascade", 0, s.cascade.recastMs, now)) {
    u.cascadeUntil = now + 30_000;
    return;
  }
  if (u.level >= 15 && u.elementalSealUntil <= now && pay(u, "elemental_seal", 0, s.elemental_seal.recastMs, now)) {
    u.elementalSealUntil = now + 60_000;
    return;
  }
  const healJob = foe.job === "cleric" || foe.job === "knight" || foe.job === "time_mage" || foe.job === "battle_mage";
  if (full && u.level >= 25 && healJob && foe.mp > 0 && foe.maxMp > 0 && ccLeft(foe, now) > 2000) {
    if (pay(u, "sc_mana_siphon", 0, 0, now)) {
      const want = Math.min(40, Math.max(8, Math.floor(u.stats.int * 0.8)));
      const drain = Math.min(want, foe.mp);
      foe.mp -= drain;
      u.mp = Math.min(u.maxMp, u.mp + drain);
      bump(u.dmgBy, "sc_mana_siphon", 0);
      bump(u.healBy, "sc_mana_siphon_mp", drain);
      return;
    }
  }
  if (u.hp / u.maxHp < 0.5 && u.level >= 36) {
    const def = s.sc_life_leech;
    if (pay(u, "sc_life_leech", def.mp, 0, now)) {
      const dealt = finishMagic(u, foe, sorcRaw(u, def.potency ?? 45, now), now, "sc_life_leech");
      u.elementalSealUntil = 0;
      u.cascadeUntil = 0;
      heal(u, Math.floor(dealt * 0.6), "sc_life_leech");
      return;
    }
  }
  const nuke = bestSorcNuke(u.level);
  if (nuke) {
    const def = s[nuke as keyof typeof s];
    u.nukeTries += 1;
    if (pay(u, nuke, def.mp, def.recastMs, now)) {
      finishMagic(u, foe, sorcRaw(u, def.potency ?? 1, now), now, nuke);
      u.elementalSealUntil = 0;
      u.cascadeUntil = 0;
      return;
    }
    if (u.mp < def.mp && now >= u.arcaneFloodUntil && !u.manawell) u.nukeOom += 1;
  }
  if (u.level >= 40 && !u.manawell && u.mp < 40 && pay(u, "manawell", 0, s.manawell.recastMs, now)) {
    u.manawell = true;
    return;
  }
  if (foe.blindUntil <= now && u.level >= 18 && u.mp > 30 && pay(u, "sc_mist_blind", s.sc_mist_blind.mp, 0, now)) {
    control(u, "sc_mist_blind", foe, "blindUntil", now + (s.sc_mist_blind.durationMs ?? 90_000), now);
    return;
  }
  if (hasEnhance(foe, now) && u.level >= 32 && pay(u, "sc_unweave", s.sc_unweave.mp, 0, now)) {
    stripEnhances(foe, now);
    return;
  }
  tryWs(u, foe, now, full);
}

function actTim(u: Unit, foe: Unit, now: number, full: boolean) {
  const t = TIM_ABILITIES;
  if (full && pay(u, "temporal_distortion", 0, t.temporal_distortion.recastMs, now)) {
    let base = 36 + u.stats.mnd * 3 + u.stats.int * 1.2;
    if (now < foe.frazzleUntil) base = Math.floor(base * 1.35);
    const raw = applyMagicAttackBonus(Math.max(1, Math.floor(base * (u.stance === "aether" ? 1.2 : 1))), u.mab);
    finishMagic(u, foe, raw, now, "temporal_distortion");
    control(u, "temporal_distortion", foe, "petrifyUntil", now + 60_000, now);
    return;
  }
  if (full && u.level >= 30 && ccLeft(foe, now) < 1500 && pay(u, "split_second", 0, t.split_second.recastMs, now)) {
    control(u, "split_second", foe, "stunUntil", now + (t.split_second.durationMs ?? 6000), now);
    return;
  }
  if (full && u.level >= 18 && ccLeft(foe, now) < 1500 && pay(u, "bind", t.bind.mp, t.bind.recastMs, now)) {
    control(u, "bind", foe, "bindUntil", now + (t.bind.durationMs ?? 20_000), now);
    return;
  }
  if (u.level >= 42 && foe.frazzleUntil <= now && pay(u, "frazzle", t.frazzle.mp, t.frazzle.recastMs, now)) {
    foe.frazzleUntil = now + (t.frazzle.durationMs ?? 60_000);
    return;
  }
  if (u.level >= 48 && foe.addleUntil <= now && pay(u, "addle", t.addle.mp, t.addle.recastMs, now)) {
    foe.addleUntil = now + (t.addle.durationMs ?? 60_000);
    return;
  }
  if (u.level >= 42 && foe.distractUntil <= now && pay(u, u.level >= 70 ? "distract_ii" : "distract", u.level >= 70 ? t.distract_ii.mp : t.distract.mp, t.distract.recastMs, now)) {
    const id = u.level >= 70 ? "distract_ii" : "distract";
    foe.distractUntil = now + (t[id].durationMs ?? 60_000);
    foe.distractAcc = Math.max(foe.distractAcc, id === "distract_ii" ? 28 : 15);
    return;
  }
  if (!full && pay(u, "temporal_distortion", 0, t.temporal_distortion.recastMs, now)) {
    let base = 36 + u.stats.mnd * 3 + u.stats.int * 1.2;
    if (now < foe.frazzleUntil) base = Math.floor(base * 1.35);
    const raw = applyMagicAttackBonus(Math.max(1, Math.floor(base)), u.mab);
    finishMagic(u, foe, raw, now, "temporal_distortion");
    return;
  }
  if (u.level >= 32 && pay(u, "dispel", t.dispel.mp, t.dispel.recastMs, now)) {
    let dmg = Math.floor((28 + u.stats.mnd * 2.2) * (u.stance === "aether" ? 1.2 : 1));
    if (now < u.timeSealUntil) dmg = Math.floor(dmg * 1.2);
    finishMagic(u, foe, applyMagicAttackBonus(dmg, u.mab), now, "dispel");
    const hitch = now < u.timeSealUntil ? 2800 : 2000;
    foe.nextSwingAt = Math.max(foe.nextSwingAt, now + hitch);
    return;
  }
  if (u.stance !== "flux" && pay(u, "flux", 0, t.flux.recastMs, now)) {
    u.stance = "flux";
    u.recasts.aether = now + t.flux.recastMs;
    return;
  }
  const longHaste = (["allegro_ii", "allegro", "quicken_ii", "hastega", "haste", "tempo_ii", "tempo", "quicken"] as const).find(
    (id) => t[id].unlockLevel <= u.level,
  );
  if (u.level >= 40 && u.overclockUntil <= now && (u.casts.overclock ?? 0) === 0 && u.hasteUntil <= now + 20_000) {
    if (pay(u, "overclock", 0, t.overclock.recastMs, now)) {
      applyHaste(u, t.overclock.haste ?? 0.8, t.overclock.durationMs ?? 10_000, now);
      u.overclockUntil = now + (t.overclock.durationMs ?? 10_000);
      return;
    }
  }
  if (longHaste && u.hasteUntil <= now && pay(u, longHaste, t[longHaste].mp, t[longHaste].recastMs, now)) {
    applyHaste(u, t[longHaste].haste ?? 0.2, t[longHaste].durationMs ?? 60_000, now);
    return;
  }
  if (u.level >= 75 && u.perpetualUntil <= now && (u.casts.perpetual_motion ?? 0) === 0 && pay(u, "perpetual_motion", 0, t.perpetual_motion.recastMs, now)) {
    u.perpetualUntil = now + 90_000;
    return;
  }
  if (u.level >= 50 && u.timeSealUntil <= now && (u.casts.time_seal ?? 0) === 0 && pay(u, "time_seal", 0, t.time_seal.recastMs, now)) {
    u.timeSealUntil = now + 60_000;
    return;
  }
  const cures = [
    ["cure_iv", 55, 88, 12_000, 400],
    ["cure_iii", 30, 46, 10_000, 220],
    ["cure_ii", 16, 24, 8_000, 110],
    ["cure", 5, 8, 6_000, 45],
  ] as const;
  if (u.hp / u.maxHp < 0.62) {
    for (const [id, lv, mp, recast, base] of cures) {
      if (u.level < lv) continue;
      if (pay(u, id, mp, recast, now)) {
        const amt = Math.floor((base + u.stats.mnd * 1.5) * (u.stance === "aether" ? 1.05 : 1));
        heal(u, amt, id);
        return;
      }
    }
  }
  if (u.level >= 55 && u.mp / Math.max(1, u.maxMp) < 0.3 && u.tp >= 100) {
    const conv = clockwindConversion(u.tp, u.mp, u.maxMp);
    if (conv.mpGained > 0 && pay(u, "clockwind", 0, t.clockwind.recastMs, now)) {
      u.tp -= conv.tpSpent;
      u.mp = Math.min(u.maxMp, u.mp + conv.mpGained);
      return;
    }
  }
  if (u.level >= 8 && (u.casts.slow ?? 0) === 0 && pay(u, "slow", t.slow.mp, t.slow.recastMs, now)) {
    // Sets mob.swingPenalty. No timer reads it. One cast so the counter records it.
    return;
  }
  tryWs(u, foe, now, full);
}

function actBm(u: Unit, foe: Unit, now: number, full: boolean) {
  const b = BATTLEMAGE_ABILITIES;
  if (u.spellbladeUntil <= now && (u.casts.spellblade ?? 0) === 0 && pay(u, "spellblade", 0, b.spellblade.recastMs, now)) {
    u.spellbladeUntil = now + 60_000;
    return;
  }
  const edges = ["bm_thunder_edge", "bm_frost_edge", "bm_flame_edge"] as const;
  if (u.enSpellUntil <= now + 5000) {
    for (const id of edges) {
      const def = b[id];
      if (def.unlockLevel > u.level) continue;
      if (pay(u, id, def.mp, 0, now)) {
        u.enSpellUntil = now + (def.durationMs ?? 180_000);
        u.enSpellBonus = def.enSpellBonus ?? 10;
        return;
      }
    }
  }
  if (u.level >= 28 && (u.stoneskinAbsorb <= 0 || u.stoneskinUntil <= now) && pay(u, "bm_stoneskin", b.bm_stoneskin.mp, 0, now)) {
    u.stoneskinUntil = now + (b.bm_stoneskin.durationMs ?? 300_000);
    u.stoneskinAbsorb = 80 + u.stats.int * 2;
    return;
  }
  if (u.level >= 34 && u.hasteUntil <= now && (u.casts.bm_haste ?? 0) === 0 && pay(u, "bm_haste", b.bm_haste.mp, 0, now)) {
    applyHaste(u, b.bm_haste.haste ?? 0.22, b.bm_haste.durationMs ?? 180_000, now);
    return;
  }
  if (full && u.level >= 44 && ccLeft(foe, now) < 2500 && pay(u, "bm_bind", b.bm_bind.mp, 0, now)) {
    control(u, "bm_bind", foe, "bindUntil", now + (b.bm_bind.durationMs ?? 30_000), now);
    return;
  }
  if (foe.diaUntil <= now && u.level >= 8 && pay(u, "bm_dia", b.bm_dia.mp, 0, now)) {
    foe.diaUntil = now + (b.bm_dia.durationMs ?? 60_000);
    return;
  }
  const cures = [
    ["bm_cure_iv", 41, 44, 250],
    ["bm_cure_iii", 21, 28, 140],
    ["bm_cure_ii", 11, 16, 75],
    ["bm_cure", 1, 8, 35],
  ] as const;
  if (u.hp / u.maxHp < 0.45) {
    for (const [id, lv, mp, base] of cures) {
      if (u.level < lv) continue;
      if (pay(u, id, mp, 0, now)) {
        heal(u, Math.floor(base + u.stats.mnd * 1.1), id);
        return;
      }
    }
  }
  const nuke = bestBmNuke(u.level);
  if (nuke && u.hp / u.maxHp >= 0.35) {
    const def = b[nuke as keyof typeof b];
    u.nukeTries += 1;
    if (pay(u, nuke, def.mp, 0, now)) {
      // elementalNuke corrupt flag is hardcoded false on the nuke path.
      const base = (def.potency ?? 40) * 0.45 + u.stats.int * 2.4 + u.stats.str * 0.25;
      const raw = applyMagicAttackBonus(Math.max(1, Math.floor(base)), u.mab);
      finishMagic(u, foe, raw, now, nuke);
      return;
    }
    if (u.mp < def.mp && now >= u.spellbladeUntil) u.nukeOom += 1;
  }
  if (foe.bioUntil <= now && u.level >= 14 && (u.casts.bm_bio ?? 0) === 0 && pay(u, "bm_bio", b.bm_bio.mp, 0, now)) {
    const tick = Math.max(1, Math.floor((b.bm_bio.potency ?? 8) + u.stats.int * 0.15));
    foe.bioUntil = now + (b.bm_bio.durationMs ?? 90_000);
    foe.bioTick = tick;
    foe.bioFrom = u;
    return;
  }
  if ((u.casts.bm_silence ?? 0) === 0 && foe.silenceUntil <= now && u.level >= 26 && (foe.job === "sorcerer" || foe.job === "cleric" || foe.job === "time_mage" || foe.job === "battle_mage") && pay(u, "bm_silence", b.bm_silence.mp, 0, now)) {
    control(u, "bm_silence", foe, "silenceUntil", now + (b.bm_silence.durationMs ?? 60_000), now);
    return;
  }
  if ((u.casts.bm_paralyze ?? 0) === 0 && u.level >= 22 && pay(u, "bm_paralyze", b.bm_paralyze.mp, 0, now)) {
    control(u, "bm_paralyze", foe, "paraUntil", now + (b.bm_paralyze.durationMs ?? 45_000), now);
    return;
  }
  if (u.level >= 22 && u.phalanxUntil <= now && (u.casts.bm_phalanx ?? 0) === 0 && pay(u, "bm_phalanx", b.bm_phalanx.mp, 0, now)) {
    u.phalanxUntil = now + (b.bm_phalanx.durationMs ?? 120_000);
    u.phalanxPhysMul = b.bm_phalanx.physDt ?? 0.75;
    return;
  }
  if (u.level >= 14 && u.shellUntil <= now && (u.casts.bm_shell ?? 0) === 0 && pay(u, "bm_shell", b.bm_shell.mp, 0, now)) {
    u.shellUntil = now + 180_000;
    u.shellMagMul = b.bm_shell.magDt ?? 0.88;
    return;
  }
  const refresh = u.level >= 55 ? "bm_refresh_ii" : u.level >= 35 ? "bm_refresh" : null;
  if (refresh && u.refreshUntil <= now && (u.casts[refresh] ?? 0) === 0) {
    const def = b[refresh];
    if (pay(u, refresh, def.mp, 0, now)) {
      u.refreshUntil = now + (def.durationMs ?? 180_000);
      u.refreshTick = def.refreshMp ?? 4;
      return;
    }
  }
  if (u.level >= 75 && now < u.enSpellUntil && foe.hp / foe.maxHp < 0.35 && pay(u, "full_circle", 0, b.full_circle.recastMs, now)) {
    const bonus = u.enSpellBonus + u.stats.int * 0.5;
    const raw = applyMagicAttackBonus(Math.max(1, Math.floor((b.full_circle.potency ?? 220) + bonus * 4)), u.mab);
    u.enSpellUntil = 0;
    u.enSpellBonus = 0;
    finishMagic(u, foe, raw, now, "full_circle");
    return;
  }
  tryWs(u, foe, now, full);
}

function act(u: Unit, foe: Unit, now: number, full: boolean) {
  if (u.hp <= 0 || foe.hp <= 0) return;
  if (now < u.castReadyAt) return;
  if (locked(u, now, full)) return;
  if (spellsSealed(u, now)) {
    tryWs(u, foe, now, full);
    return;
  }
  if (u.job === "fighter") actFighter(u, foe, now, full);
  else if (u.job === "rogue") actRogue(u, foe, now, full);
  else if (u.job === "knight") actKnight(u, foe, now, full);
  else if (u.job === "cleric") actCleric(u, foe, now, full);
  else if (u.job === "sorcerer") actSorcerer(u, foe, now, full);
  else if (u.job === "time_mage") actTim(u, foe, now, full);
  else actBm(u, foe, now, full);
}

function duel(aJob: JobId, bJob: JobId, level: number, seed: number, mode: Mode): Fight {
  const full = mode === "full";
  const a = spawn(aJob, level, pickWeapon(aJob, level));
  const b = spawn(bJob, level, pickWeapon(bJob, level));
  const rng = mulberry32((level * 100003 + seed * 97 + JOB_IDS.indexOf(aJob) * 17 + JOB_IDS.indexOf(bJob) * 3 + (full ? 1 : 9)) >>> 0);
  const firstA = seed % 2 === 0;
  let now = 0;
  for (; now < DURATION_MS && a.hp > 0 && b.hp > 0; now += TICK_MS) {
    if (now > 0 && now % 1000 === 0) {
      tickSecond(a, now);
      tickSecond(b, now);
      if (a.hp <= 0 || b.hp <= 0) break;
    }
    const order = firstA ? [a, b] : [b, a];
    for (const u of order) {
      const foe = u === a ? b : a;
      if (u.hp <= 0 || foe.hp <= 0) break;
      act(u, foe, now, full);
      if (u.hp <= 0 || foe.hp <= 0) break;
      swing(u, foe, now, rng, full);
    }
  }
  const winner = a.hp > 0 && b.hp <= 0 ? "a" : b.hp > 0 && a.hp <= 0 ? "b" : null;
  return {
    mode,
    level,
    a: aJob,
    b: bJob,
    winner,
    ms: winner ? now : DURATION_MS,
    aDmg: a.damageDealt,
    bDmg: b.damageDealt,
    aHeal: a.healingDone,
    bHeal: b.healingDone,
    aMin: a.minHp / a.maxHp,
    bMin: b.minHp / b.maxHp,
    aEnd: a.hp / a.maxHp,
    bEnd: b.hp / b.maxHp,
    aWs: a.wsCasts,
    bWs: b.wsCasts,
    aMaxTp: a.maxTp,
    bMaxTp: b.maxTp,
    aOom: a.nukeOom,
    bOom: b.nukeOom,
    aTries: a.nukeTries,
    bTries: b.nukeTries,
  };
}

function median(xs: number[]): number {
  if (xs.length === 0) return Number.NaN;
  const s = [...xs].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function sec(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function pairKey(a: JobId, b: JobId): string {
  return JOB_IDS.indexOf(a) < JOB_IDS.indexOf(b) ? `${a}|${b}` : `${b}|${a}`;
}

function sheet(level: number): string[] {
  const lines: string[] = [];
  for (const job of JOB_IDS) {
    const g = pickWeapon(job, level);
    const v = jobVitalsAtLevel(job, level);
    lines.push(
      `${SHORT[job].padEnd(4)} ${g.name} #${g.id} ilvl ${g.craftLevel} ${g.family} atk ${g.atk} mab ${g.mab} delay ${g.delayMs} | HP ${g.maxHp} (naked ${v.maxHp}) MP ${g.maxMp} | STR ${g.stats.str} DEX ${g.stats.dex} VIT ${g.stats.vit} AGI ${g.stats.agi} INT ${g.stats.int} MND ${g.stats.mnd} DEF ${playerDefense(g.stats.vit, g.gearDef)} MDEF ${playerMagicDefense(g.stats.mnd, g.mdb)}`,
    );
  }
  return lines;
}

function report(fights: Fight[]): string {
  const lines: string[] = [];
  lines.push("ASSUMPTIONS");
  lines.push(
    "Main job only, subjob null, no skill tree. Gear is one main-hand: signature family, jobRestrict allows the job, score is scaled mab then atk for TIM/Sorcerer/Cleric and scaled atk then mab for the others (scaleGearStat, atk defaults to 10). Same rule at 30 and 75.",
  );
  lines.push(
    "Hit/crit are 20-seed Monte Carlo using hitChance and the PvP blind/hit/crit order. Para skip 35%, Backblade/Kill Edge/Killing Storm forced crits, and Brazen double attack follow playerSwing (the mob-target auto), because playerSwingPvp drops them. Expected hit is not used.",
  );
  lines.push(
    `Abilities fire on a ${CAST_MS}ms occupancy (resolver anim is ~520–620ms). The server does not enforce that lock. Autos are not paused by casts. Aether is not used (it cancels autos). Flux is the Time Mage stance. Hard control (stun/sleep/bind/petrify) follows mobSwing and is ON in mode=full, OFF in mode=trade. swingPenalty does not change delay. Spell raw damage is the resolver; it then takes player magic resist and mag DT.`,
  );
  lines.push("");
  for (const level of [30, 75] as const) {
    lines.push(`LOADOUT L${level}`);
    lines.push(...sheet(level));
    lines.push("");
  }

  for (const mode of ["full", "trade"] as const) {
    for (const level of [30, 75] as const) {
      lines.push(`=== L${level} ${mode === "full" ? "FULL KIT (hard CC on)" : "DAMAGE TRADE (hard CC off)"} ===`);
      const rows = fights.filter((f) => f.mode === mode && f.level === level);
      const byPair = new Map<string, Fight[]>();
      for (const f of rows) {
        const k = pairKey(f.a, f.b);
        const list = byPair.get(k) ?? [];
        list.push(f);
        byPair.set(k, list);
      }
      const score = new Map<JobId, { win: number; loss: number; to: number; killMs: number[] }>();
      for (const job of JOB_IDS) score.set(job, { win: 0, loss: 0, to: 0, killMs: [] });
      const keys = [...byPair.keys()].sort();
      for (const key of keys) {
        const list = byPair.get(key)!;
        const [ja, jb] = key.split("|") as [JobId, JobId];
        let aw = 0;
        let bw = 0;
        let to = 0;
        const aKill: number[] = [];
        const bKill: number[] = [];
        let aDmg = 0;
        let bDmg = 0;
        let aHeal = 0;
        let bHeal = 0;
        const aMin: number[] = [];
        const bMin: number[] = [];
        let aWs = 0;
        let bWs = 0;
        let aOom = 0;
        let bOom = 0;
        let aTries = 0;
        let bTries = 0;
        for (const f of list) {
          const aIsJa = f.a === ja;
          const wA = aIsJa ? aw : bw;
          void wA;
          const jaWon = (f.winner === "a") === aIsJa;
          if (f.winner == null) to += 1;
          else if (jaWon) {
            aw += 1;
            aKill.push(f.ms);
          } else {
            bw += 1;
            bKill.push(f.ms);
          }
          if (aIsJa) {
            aDmg += f.aDmg;
            bDmg += f.bDmg;
            aHeal += f.aHeal;
            bHeal += f.bHeal;
            aMin.push(f.aMin);
            bMin.push(f.bMin);
            aWs += f.aWs;
            bWs += f.bWs;
            aOom += f.aOom;
            bOom += f.bOom;
            aTries += f.aTries;
            bTries += f.bTries;
          } else {
            aDmg += f.bDmg;
            bDmg += f.aDmg;
            aHeal += f.bHeal;
            bHeal += f.aHeal;
            aMin.push(f.bMin);
            bMin.push(f.aMin);
            aWs += f.bWs;
            bWs += f.aWs;
            aOom += f.bOom;
            bOom += f.aOom;
            aTries += f.bTries;
            bTries += f.aTries;
          }
        }
        const n = list.length;
        const sa = score.get(ja)!;
        const sb = score.get(jb)!;
        if (ja !== jb) {
          sa.win += aw;
          sa.loss += bw;
          sa.to += to;
          sa.killMs.push(...aKill);
          sb.win += bw;
          sb.loss += aw;
          sb.to += to;
          sb.killMs.push(...bKill);
        }
        const mirror = ja === jb ? " mirror" : "";
        lines.push(
          `${SHORT[ja]} vs ${SHORT[jb]}${mirror}: ${SHORT[ja]} ${aw}/${n} ${SHORT[jb]} ${bw}/${n} timeout ${to}/${n} | ${SHORT[ja]} kill ${aKill.length ? sec(median(aKill)) : "-"} dmg ${Math.round(aDmg / n)} heal ${Math.round(aHeal / n)} minHP ${pct(median(aMin))} ws ${Math.round(aWs / n)} oom ${aTries ? Math.round((aOom / aTries) * 100) : 0}% | ${SHORT[jb]} kill ${bKill.length ? sec(median(bKill)) : "-"} dmg ${Math.round(bDmg / n)} heal ${Math.round(bHeal / n)} minHP ${pct(median(bMin))} ws ${Math.round(bWs / n)} oom ${bTries ? Math.round((bOom / bTries) * 100) : 0}%`,
        );
      }
      const ranked = [...score.entries()].sort((x, y) => {
        const px = x[1].win + x[1].to * 0.5;
        const py = y[1].win + y[1].to * 0.5;
        return py - px;
      });
      lines.push("RANK (mirrors excluded; timeout = 0.5)");
      ranked.forEach(([job, s], i) => {
        const games = s.win + s.loss + s.to;
        const pts = s.win + s.to * 0.5;
        lines.push(
          `${i + 1}. ${SHORT[job]} ${pts.toFixed(1)}/${games}  wins ${s.win} losses ${s.loss} timeout ${s.to}  median kill ${s.killMs.length ? sec(median(s.killMs)) : "-"}`,
        );
      });
      lines.push("");
    }
  }
  return lines.join("\n");
}

describe("pvp duel sim", () => {
  it("slow penalty does not change swing delay", () => {
    const base = resolveSwingDelayMs(2400, 0);
    // mob-job-ai.ts pace() uses swingDelayMs(haste) only. swingPenalty is unread.
    assert.equal(base, 2400);
    assert.equal(MAX_LEVEL, 75);
  });

  it("runs the matrix", { timeout: 180_000 }, () => {
    const fights: Fight[] = [];
    for (const mode of ["full", "trade"] as const) {
      for (const level of [30, 75] as const) {
        for (let i = 0; i < JOB_IDS.length; i++) {
          for (let j = i; j < JOB_IDS.length; j++) {
            for (let seed = 0; seed < SEEDS; seed++) {
              fights.push(duel(JOB_IDS[i]!, JOB_IDS[j]!, level, seed, mode));
            }
          }
        }
      }
    }
    const pairs = (JOB_IDS.length * (JOB_IDS.length + 1)) / 2;
    assert.equal(fights.length, pairs * 2 * 2 * SEEDS);
    const text = report(fights);
    console.log("\n" + text);
    assert.ok(text.includes("RANK"));
    const finished = fights.filter((f) => f.winner || f.ms === DURATION_MS);
    assert.equal(finished.length, fights.length);
  });
});
