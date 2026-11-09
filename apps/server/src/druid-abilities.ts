/**
 * Druid ability resolution — Ring-Walker + Stick Bear / Deer / Lion / Racerunner.
 * Motifs: dust, ash-gold, incomplete heptad. Not TIM teal.
 */
import {
  DRUID_ABILITIES,
  DRUID_FORM,
  DRUID_FORM_LABEL,
  applyDruidShiftRecast,
  druidFormHp,
  isDruidAbilityId,
  isDruidShiftId,
  type DruidAbilityId,
  type DruidForm,
} from "@bellgrave/combat";
import { jobVitalsAtLevel } from "@bellgrave/combat";
import { signatureWeaponEquipped } from "./starter-kit";
import { takeMobHit, type MobEnhanceHost } from "./mob-enhances";
import type { AbilityId } from "@bellgrave/protocol";

export type DruidPlayer = {
  job: string;
  level: number;
  wallet: string;
  name: string;
  mp: number;
  maxMp: number;
  hp: number;
  maxHp: number;
  tp: number;
  x: number;
  z: number;
  facing: number;
  anim: string;
  animUntil: number;
  moveTo: { x: number; z: number } | null;
  dash?: unknown;
  targetId: string | null;
  equip: import("@bellgrave/items").Equipment;
  inventory: { tokenId: number; amount: number }[];
  recasts: Partial<Record<AbilityId, number>>;
  enmity: number;
  druidForm: DruidForm;
  druidFormUntil: number;
  druidRingwakeUntil: number;
  druidAshBraceUntil: number;
  druidAshBraceMul: number;
  druidBundleThickenUntil: number;
  druidBundleThickenMul: number;
  druidBrackenRootUntil: number;
  druidAntlerHumUntil: number;
  druidAntlerHumTick: number;
  druidAntlerHumNext: number;
  druidMereVeilUntil: number;
  druidMereVeilHp: number;
  druidManeDustUntil: number;
  druidManeRakeMul: number;
  druidManeDustLeft: number;
  druidEmberTailUntil: number;
  druidRunMul: number;
  druidChalkWardUntil: number;
  druidChalkWardMul: number;
  druidSourHumUntil: number;
  druidBleedUntil: number;
  druidBleedPot: number;
  druidRingSplitUntil: number;
};

export type DruidMob = {
  id: string;
  name?: string;
  alive: boolean;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  targetId: string | null;
  stunUntil: number;
  druidSourHumUntil?: number;
  druidSourHumMul?: number;
  druidBleedUntil?: number;
  druidBleedPot?: number;
} & MobEnhanceHost;

export type DruidHooks = {
  pushLog: (p: DruidPlayer, msg: string) => void;
  stopRest: (p: DruidPlayer, reason?: string) => void;
  facingTo: (ax: number, az: number, bx: number, bz: number) => number;
  findMob: (id: string | null | undefined) => DruidMob | null;
  allMobs: () => DruidMob[];
  allPlayers: () => DruidPlayer[];
  onMobKill: (p: DruidPlayer, m: DruidMob, now: number) => void;
  dist: (ax: number, az: number, bx: number, bz: number) => number;
  playerCombatStats: (p: DruidPlayer) => { str: number; dex: number; vit: number; mnd: number };
  syncVitals: (p: DruidPlayer, refill: boolean) => void;
  dashToward: (p: DruidPlayer, range: number, now: number) => void;
};

/** Timers only. Form survives unequip, zone, and warpIntoPit. */
export function clearDruidBuffs(p: DruidPlayer) {
  p.druidFormUntil = 0;
  p.druidRingwakeUntil = 0;
  p.druidAshBraceUntil = 0;
  p.druidAshBraceMul = 1;
  p.druidBundleThickenUntil = 0;
  p.druidBundleThickenMul = 1;
  p.druidBrackenRootUntil = 0;
  p.druidAntlerHumUntil = 0;
  p.druidAntlerHumTick = 0;
  p.druidAntlerHumNext = 0;
  p.druidMereVeilUntil = 0;
  p.druidMereVeilHp = 0;
  p.druidManeDustUntil = 0;
  p.druidManeRakeMul = 1;
  p.druidManeDustLeft = 0;
  p.druidEmberTailUntil = 0;
  p.druidRunMul = 1.5;
  p.druidChalkWardUntil = 0;
  p.druidChalkWardMul = 1;
  p.druidSourHumUntil = 0;
  p.druidBleedUntil = 0;
  p.druidBleedPot = 0;
  p.druidRingSplitUntil = 0;
}

/** Mere Veil absorb — soak incoming damage while the dust veil remains. */
export function absorbMereVeil(p: DruidPlayer, now: number, raw: number): number {
  if (now >= p.druidMereVeilUntil || p.druidMereVeilHp <= 0) {
    if (now >= p.druidMereVeilUntil) p.druidMereVeilHp = 0;
    return raw;
  }
  const soaked = Math.min(p.druidMereVeilHp, raw);
  p.druidMereVeilHp -= soaked;
  if (p.druidMereVeilHp <= 0) {
    p.druidMereVeilHp = 0;
    p.druidMereVeilUntil = 0;
  }
  return raw - soaked;
}

export function dropDruidForm(
  p: DruidPlayer,
  hooks: {
    pushLog: (p: any, msg: string) => void;
    syncVitals: (p: any, refill: boolean) => void;
  },
  why?: string,
) {
  if (p.druidForm === 0) return;
  p.druidForm = 0;
  p.druidAshBraceUntil = 0;
  p.druidAshBraceMul = 1;
  p.druidBundleThickenUntil = 0;
  p.druidBundleThickenMul = 1;
  p.druidBrackenRootUntil = 0;
  p.druidAntlerHumUntil = 0;
  p.druidAntlerHumTick = 0;
  p.druidAntlerHumNext = 0;
  p.druidMereVeilUntil = 0;
  p.druidMereVeilHp = 0;
  p.druidManeDustUntil = 0;
  p.druidManeRakeMul = 1;
  p.druidManeDustLeft = 0;
  p.druidEmberTailUntil = 0;
  p.druidRunMul = 1.5;
  hooks.syncVitals(p, false);
  hooks.pushLog(p, why ?? "The song lets you go. You are a Ring-Walker again.");
}

function applyShiftRecast(p: DruidPlayer, now: number, usedId: string, skipFamily: boolean) {
  applyDruidShiftRecast(p.recasts, usedId, now, skipFamily);
}

export function resolveDruidAbility(
  p: DruidPlayer,
  id: AbilityId,
  targetId: string | undefined,
  now: number,
  hooks: DruidHooks,
): void {
  if (!isDruidAbilityId(id)) return;
  if (p.job !== "druid") {
    hooks.pushLog(p, "Only a Druid main can walk the ring.");
    return;
  }
  const def = DRUID_ABILITIES[id];
  if (now < (p.recasts[id] ?? 0)) {
    hooks.pushLog(p, `${def.label} is not ready.`);
    return;
  }
  if (def.mp > 0 && p.mp < def.mp) {
    hooks.pushLog(p, "Not enough MP.");
    return;
  }
  if (def.staffRequired && !signatureWeaponEquipped(p, "druid")) {
    hooks.pushLog(p, "You need a staff or club in hand.");
    return;
  }
  if (p.druidForm === 4 && !isDruidShiftId(id) && id !== "rest" && id !== "dr_tail_dash" && id !== "dr_tail_dash_ii" && id !== "dr_ember_tail" && id !== "dr_long_run" && id !== "dr_ember_run") {
    hooks.dashToward(p, 8, now);
    hooks.pushLog(p, "The racerunner bounds.");
    return;
  }
  if (def.form != null && p.druidForm !== def.form) {
    hooks.pushLog(p, `Need ${DRUID_FORM_LABEL[def.form]}.`);
    return;
  }
  if (id === "dr_ringwake" && p.druidForm === 4) {
    hooks.pushLog(p, "Ringwake is silent in Racerunner.");
    return;
  }

  if (def.shiftTo != null) {
    const dest = def.shiftTo;
    if (p.druidForm === dest) {
      dropDruidForm(p, hooks, "You set the song down.");
      applyShiftRecast(p, now, id, now < p.druidRingSplitUntil);
      return;
    }
    p.druidForm = dest;
    p.druidFormUntil = now + 1200;
    p.druidAshBraceUntil = 0;
    p.druidAshBraceMul = 1;
    p.druidBundleThickenUntil = 0;
    p.druidBundleThickenMul = 1;
    p.druidBrackenRootUntil = 0;
    p.druidAntlerHumUntil = 0;
    p.druidAntlerHumTick = 0;
    p.druidAntlerHumNext = 0;
    p.druidMereVeilUntil = 0;
    p.druidMereVeilHp = 0;
    p.druidManeDustUntil = 0;
    p.druidManeRakeMul = 1;
    p.druidManeDustLeft = 0;
    p.druidEmberTailUntil = 0;
    p.druidRunMul = 1.5;
    const human = jobVitalsAtLevel("druid", p.level).maxHp;
    const knight = jobVitalsAtLevel("knight", p.level).maxHp;
    const nextHp = druidFormHp(human, dest, knight);
    hooks.syncVitals(p, false);
    if (p.maxHp !== nextHp) {
      p.maxHp = nextHp;
      p.hp = Math.min(p.hp, p.maxHp);
    }
    applyShiftRecast(p, now, id, now < p.druidRingSplitUntil);
    p.druidRingSplitUntil = 0;
    p.anim = dest === 0 ? "cast" : "melee";
    p.animUntil = now + 600;
    hooks.stopRest(p);
    hooks.pushLog(p, dest === 0 ? "You walk the ring as yourself." : `You borrow ${DRUID_FORM_LABEL[dest]}.`);
    return;
  }

  const spend = () => {
    if (def.mp > 0) p.mp -= def.mp;
    if (def.recastMs > 0) p.recasts[id] = now + def.recastMs;
  };

  const resolveAlly = (tid: string | undefined, range: number) => {
    const id = tid ?? p.targetId ?? undefined;
    if (!id) return p;
    const found = hooks.allPlayers().find((a) => a.wallet === id || a.name === id);
    if (found && hooks.dist(p.x, p.z, found.x, found.z) <= range) return found;
    return p;
  };

  const foe = () => hooks.findMob(targetId ?? p.targetId);

  if (id === "rest") {
    if (p.anim === "rest") {
      hooks.stopRest(p);
      return;
    }
    if (p.moveTo) {
      hooks.pushLog(p, "Stop moving before you rest.");
      return;
    }
    p.targetId = null;
    p.anim = "rest";
    p.animUntil = Number.POSITIVE_INFINITY;
    hooks.pushLog(p, "You kneel and rest — HP/MP recover, TP fades.");
    return;
  }

  if (id === "dr_ringwake") {
    spend();
    p.druidRingwakeUntil = now + (def.durationMs ?? 30_000);
    p.anim = "cast";
    p.animUntil = now + 700;
    hooks.stopRest(p);
    hooks.pushLog(p, "An incomplete heptad wakes under your feet.");
    return;
  }

  if (id === "dr_dustmend" || id === "dr_dustmend_ii" || id === "dr_still_water" || id === "dr_still_water_ii" || id === "dr_still_water_iii" || id === "dr_still_water_iv") {
    spend();
    let heal = def.heal ?? 32;
    if (now < p.druidRingwakeUntil) heal = Math.floor(heal * 1.12);
    const t = resolveAlly(targetId, def.range ?? 12);
    t.hp = Math.min(t.maxHp, t.hp + heal);
    p.anim = "cast";
    p.animUntil = now + 700;
    hooks.stopRest(p);
    hooks.pushLog(p, `${def.label} mends ${t === p ? "you" : t.name} for ${heal}.`);
    return;
  }

  if (id === "dr_pair_mend" || id === "dr_pair_mend_ii") {
    spend();
    let heal = def.heal ?? 36;
    if (now < p.druidRingwakeUntil) heal = Math.floor(heal * 1.12);
    const r = def.range ?? 12;
    const folks = [...hooks.allPlayers()]
      .filter((t) => hooks.dist(p.x, p.z, t.x, t.z) <= r)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
    for (const t of folks.slice(0, 2)) t.hp = Math.min(t.maxHp, t.hp + heal);
    p.anim = "cast";
    p.animUntil = now + 700;
    hooks.stopRest(p);
    hooks.pushLog(p, `${def.label} washes the lowest.`);
    return;
  }

  if (id === "dr_antler_hum" || id === "dr_antler_hum_ii") {
    spend();
    const t = resolveAlly(targetId, def.range ?? 12);
    const ticks = 6;
    let pot = Math.floor((def.heal ?? 48) / ticks);
    if (now < p.druidRingwakeUntil) pot = Math.floor(pot * 1.12);
    applyAntlerHum(t, now + (def.durationMs ?? 12_000), pot, now);
    p.anim = "cast";
    p.animUntil = now + 700;
    hooks.stopRest(p);
    hooks.pushLog(p, "Antlers hum.");
    return;
  }

  if (id === "dr_heptad_hum") {
    spend();
    const ticks = 4;
    let pot = Math.floor((def.heal ?? 80) / ticks);
    if (now < p.druidRingwakeUntil) pot = Math.floor(pot * 1.12);
    const until = now + (def.durationMs ?? 8_000);
    const r = def.aoe ?? 10;
    for (const t of hooks.allPlayers()) {
      if (hooks.dist(p.x, p.z, t.x, t.z) > r) continue;
      applyAntlerHum(t, until, pot, now);
    }
    p.anim = "cast";
    p.animUntil = now + 700;
    hooks.stopRest(p);
    hooks.pushLog(p, "A short heptad hum.");
    return;
  }

  if (id === "dr_mere_veil" || id === "dr_mere_veil_ii") {
    spend();
    const t = resolveAlly(targetId, def.range ?? 12);
    t.druidMereVeilUntil = now + (def.durationMs ?? 20_000);
    t.druidMereVeilHp = def.absorb ?? 25;
    p.anim = "cast";
    p.animUntil = now + 700;
    hooks.stopRest(p);
    hooks.pushLog(p, "A thin veil of mere-dust.");
    return;
  }

  if (id === "dr_sour_hum" || id === "dr_sour_hum_ii") {
    const m = foe();
    if (!m || !m.alive) {
      hooks.pushLog(p, "No foe in the circle.");
      return;
    }
    if (hooks.dist(p.x, p.z, m.x, m.z) > (def.range ?? 12)) {
      hooks.pushLog(p, "Too far.");
      return;
    }
    spend();
    m.druidSourHumUntil = now + (def.durationMs ?? 12_000);
    m.druidSourHumMul = def.hitMul ?? 0.92;
    p.facing = hooks.facingTo(p.x, p.z, m.x, m.z);
    p.anim = "cast";
    p.animUntil = now + 700;
    hooks.stopRest(p);
    hooks.pushLog(p, "The circle is sour here.");
    return;
  }

  if (id === "dr_chalk_ward" || id === "dr_chalk_ward_ii" || id === "dr_mirror_glaze") {
    spend();
    const t = id === "dr_mirror_glaze" ? p : resolveAlly(targetId, def.range ?? 12);
    t.druidChalkWardUntil = now + (def.durationMs ?? 90_000);
    t.druidChalkWardMul = def.physDt ?? 0.92;
    p.anim = "cast";
    p.animUntil = now + 700;
    hooks.stopRest(p);
    hooks.pushLog(p, `${def.label} settles like dust.`);
    return;
  }

  if (id === "dr_hollow_listen") {
    spend();
    p.enmity = Math.max(0, p.enmity * 0.7);
    p.anim = "cast";
    p.animUntil = now + 500;
    hooks.stopRest(p);
    hooks.pushLog(p, "The circle is sour here.");
    return;
  }

  if (id === "dr_ring_split") {
    spend();
    p.druidRingSplitUntil = now + (def.durationMs ?? 8_000);
    hooks.pushLog(p, "The next shift will not share the family recast.");
    return;
  }

  if (id === "dr_unstruck_echo") {
    const m = foe();
    if (!m || !m.alive) {
      hooks.pushLog(p, "No foe.");
      return;
    }
    if (hooks.dist(p.x, p.z, m.x, m.z) > (def.range ?? 12)) {
      hooks.pushLog(p, "Too far.");
      return;
    }
    spend();
    m.stunUntil = Math.max(m.stunUntil, now + (def.durationMs ?? 8_000));
    p.anim = "cast";
    p.animUntil = now + 700;
    hooks.stopRest(p);
    hooks.pushLog(p, "You catch the song in their throat.");
    return;
  }

  if (id === "dr_stick_clamour" || id === "dr_stick_clamour_ii" || id === "dr_ring_of_stakes") {
    spend();
    const wake = now < p.druidRingwakeUntil ? 1.12 : 1;
    p.enmity += Math.min(10_000, 800 * (def.hateFrac ?? 0.7) * wake);
    if (id === "dr_ring_of_stakes") {
      for (const m of hooks.allMobs()) {
        if (m.alive && hooks.dist(p.x, p.z, m.x, m.z) <= (def.aoe ?? 8)) m.targetId = p.wallet;
      }
    } else {
      const m = foe();
      if (m && m.alive) m.targetId = p.wallet;
    }
    p.anim = "melee";
    p.animUntil = now + 500;
    hooks.stopRest(p);
    hooks.pushLog(p, "Sticks rattle. Something looks at you.");
    return;
  }

  if (id === "dr_ash_brace" || id === "dr_ash_brace_ii" || id === "dr_bundle_thicken" || id === "dr_kiln_shoulder") {
    spend();
    const until = now + (def.durationMs ?? 20_000);
    const dt = def.physDt ?? 0.78;
    if (id === "dr_bundle_thicken" || id === "dr_kiln_shoulder") {
      p.druidBundleThickenUntil = until;
      p.druidBundleThickenMul = dt;
    } else {
      p.druidAshBraceUntil = until;
      p.druidAshBraceMul = dt;
    }
    p.anim = "melee";
    p.animUntil = now + 400;
    hooks.stopRest(p);
    hooks.pushLog(p, "The bundle packs tighter.");
    return;
  }

  if (id === "dr_bracken_root") {
    spend();
    p.druidBrackenRootUntil = now + (def.durationMs ?? 6_000);
    p.enmity += 40;
    p.anim = "melee";
    p.animUntil = now + 400;
    hooks.stopRest(p);
    hooks.pushLog(p, "Paws root in the bracken.");
    return;
  }

  if (id === "dr_stick_maul" || id === "dr_stick_maul_ii" || id === "dr_stick_rake" || id === "dr_stick_rake_ii" || id === "dr_stick_rake_iii" || id === "dr_stick_pounce" || id === "dr_long_pounce") {
    const m = foe();
    if (!m || !m.alive) {
      hooks.pushLog(p, "No foe.");
      return;
    }
    const range = def.range ?? 4;
    if (hooks.dist(p.x, p.z, m.x, m.z) > range + (def.aoe ?? 0)) {
      hooks.pushLog(p, "Too far.");
      return;
    }
    spend();
    const stats = hooks.playerCombatStats(p);
    let pot = def.potency ?? 28;
    if (now < p.druidRingwakeUntil) pot = Math.floor(pot * 1.12);
    const mane = druidManeMul(p, now);
    if (mane > 1) {
      pot = Math.floor(pot * mane);
      consumeDruidMane(p, now);
    }
    const dmg = takeMobHit(
      m,
      Math.max(1, Math.floor(pot + stats.str * 0.35 + stats.dex * 0.2)),
      "physical",
      now,
    );
    m.hp -= dmg;
    if (id.startsWith("dr_stick_rake")) {
      m.druidBleedUntil = now + 6_000;
      m.druidBleedPot = 4;
    }
    if (id === "dr_stick_pounce") m.stunUntil = Math.max(m.stunUntil, now + 1_500);
    if (id === "dr_long_pounce") hooks.dashToward(p, def.range ?? 6, now);
    p.facing = hooks.facingTo(p.x, p.z, m.x, m.z);
    p.anim = "melee";
    p.animUntil = now + 500;
    p.enmity += Math.floor(dmg * 0.6);
    hooks.stopRest(p);
    hooks.pushLog(p, `${def.label} hits ${m.name ?? "the foe"} for ${dmg}.`);
    if (m.hp <= 0) hooks.onMobKill(p, m, now);
    return;
  }

  if (id === "dr_mane_dust" || id === "dr_mane_dust_ii" || id === "dr_mane_fury") {
    spend();
    p.druidManeDustUntil = now + (def.durationMs ?? 8_000);
    p.druidManeRakeMul = id === "dr_mane_fury" ? 1.2 : 1.15;
    p.druidManeDustLeft = id === "dr_mane_fury" ? 99 : 3;
    p.anim = "melee";
    p.animUntil = now + 400;
    hooks.stopRest(p);
    hooks.pushLog(p, id === "dr_mane_fury" ? "The mane sparks." : "The mane sheds dust.");
    return;
  }

  if (id === "dr_tail_dash" || id === "dr_tail_dash_ii") {
    spend();
    hooks.dashToward(p, def.range ?? 8, now);
    p.anim = "walk";
    p.animUntil = now + 300;
    hooks.stopRest(p);
    hooks.pushLog(p, "The tail flicks. Dust.");
    return;
  }

  if (id === "dr_ember_tail" || id === "dr_long_run" || id === "dr_ember_run") {
    spend();
    p.druidEmberTailUntil = now + (def.durationMs ?? 8_000);
    p.druidRunMul = def.moveMul ?? 1.5;
    hooks.stopRest(p);
    hooks.pushLog(p, "The tail-ember brightens.");
    return;
  }
}

function applyAntlerHum(t: DruidPlayer, until: number, tick: number, now: number) {
  t.druidAntlerHumUntil = until;
  t.druidAntlerHumTick = tick;
  t.druidAntlerHumNext = now + 2_000;
  t.hp = Math.min(t.maxHp, t.hp + tick);
}

export function tickDruidAntlerHum(p: DruidPlayer, now: number): number {
  if (now >= p.druidAntlerHumUntil || p.druidAntlerHumTick <= 0) return 0;
  if (now < p.druidAntlerHumNext) return 0;
  p.druidAntlerHumNext = now + 2_000;
  return p.druidAntlerHumTick;
}

export function druidManeMul(p: DruidPlayer, now: number): number {
  if (now >= p.druidManeDustUntil) return 1;
  if ((p.druidManeDustLeft ?? 0) <= 0) return 1;
  return p.druidManeRakeMul || 1;
}

export function consumeDruidMane(p: DruidPlayer, now: number): void {
  if (now >= p.druidManeDustUntil) return;
  if ((p.druidManeDustLeft ?? 0) <= 0) return;
  if (p.druidManeDustLeft >= 90) return;
  p.druidManeDustLeft -= 1;
  if (p.druidManeDustLeft <= 0) p.druidManeDustUntil = 0;
}

export function druidPhysDt(p: DruidPlayer, now: number): number {
  let mul = 1;
  if (now < p.druidAshBraceUntil) mul = Math.min(mul, p.druidAshBraceMul || 0.78);
  if (now < p.druidBundleThickenUntil) mul = Math.min(mul, p.druidBundleThickenMul || 0.7);
  if (now < p.druidChalkWardUntil) mul *= p.druidChalkWardMul || 1;
  return mul;
}
