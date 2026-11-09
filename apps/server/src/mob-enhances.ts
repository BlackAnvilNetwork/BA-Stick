/**
 * Enemy enhancements that Unravel and Unweave strip.
 * Protect, Shell, Haste, Stoneskin, and Berserk are cast by field mobs.
 * False Guard stays on the list because Rogue already applies it.
 * Player enfeebles (Dia, Bio, Slow, Silence, and the rest) are not enhancements.
 * Innate magResist is not an enhancement — Unravel does not strip it.
 */
import { magicResistMul, mitigateMagicDamage } from "@bellgrave/combat";
import { pendingHitDtMul, type MagDtUnit, type PhysDtUnit } from "./incoming-dt";
import { curseTaken } from "./player-ailments";
import { asCastWindup, interruptCastOnDamage } from "./mob-cast-interrupt";

export type MobEnhanceHost = {
  protectUntil?: number;
  protectPhysMul?: number;
  shellUntil?: number;
  shellMagMul?: number;
  hasteUntil?: number;
  hastePct?: number;
  stoneskinUntil?: number;
  stoneskinAbsorb?: number;
  atkBuffUntil?: number;
  atkBuffMul?: number;
  falseGuardUntil?: number;
  /**
   * Innate magic defense (MND). Magic hits consult it before Shell.
   * Not an enhancement — stripMobEnhances leaves it alone.
   */
  magResist?: number;
};

function read(host: MobEnhanceHost, key: keyof MobEnhanceHost): number {
  const value = host[key];
  return typeof value === "number" ? value : 0;
}

export function emptyMobEnhances(): Required<MobEnhanceHost> {
  return {
    protectUntil: 0,
    protectPhysMul: 1,
    shellUntil: 0,
    shellMagMul: 1,
    hasteUntil: 0,
    hastePct: 0,
    stoneskinUntil: 0,
    stoneskinAbsorb: 0,
    atkBuffUntil: 0,
    atkBuffMul: 1,
    falseGuardUntil: 0,
    magResist: 0,
  };
}

/** Names of enhancements that are still up. Order is stable for logs. */
export function activeMobEnhances(host: MobEnhanceHost, now: number): string[] {
  const names: string[] = [];
  if (read(host, "protectUntil") > now) names.push("Protect");
  if (read(host, "shellUntil") > now) names.push("Shell");
  if (read(host, "hasteUntil") > now) names.push("Haste");
  if (read(host, "stoneskinUntil") > now && read(host, "stoneskinAbsorb") > 0) names.push("Stoneskin");
  if (read(host, "atkBuffUntil") > now) names.push("Berserk");
  if (read(host, "falseGuardUntil") > now) names.push("False Guard");
  return names;
}

/** Clear every active enhancement. Returns the names removed. */
export function stripMobEnhances(host: MobEnhanceHost, now: number): string[] {
  const names = activeMobEnhances(host, now);
  if (names.length > 0) {
    host.protectUntil = 0;
    host.protectPhysMul = 1;
    host.shellUntil = 0;
    host.shellMagMul = 1;
    host.hasteUntil = 0;
    host.hastePct = 0;
    host.stoneskinUntil = 0;
    host.stoneskinAbsorb = 0;
    host.atkBuffUntil = 0;
    host.atkBuffMul = 1;
    host.falseGuardUntil = 0;
  }
  const extra = host as MobEnhanceHost & Record<string, number | undefined>;
  const clear = (key: string, label: string, reset?: string) => {
    const until = extra[key];
    if (typeof until === "number" && until > now) {
      extra[key] = 0;
      if (reset) extra[reset] = reset.endsWith("Mul") ? 1 : 0;
      names.push(label);
    }
  };
  clear("bulwarkUntil", "Bulwark");
  clear("sentinelUntil", "Sentinel");
  clear("rampartUntil", "Rampart");
  clear("guardianUntil", "Guardian");
  clear("coverUntil", "Cover");
  clear("fealtyUntil", "Fealty");
  clear("asylumUntil", "Asylum");
  clear("phalanxUntil", "Phalanx", "phalanxPhysMul");
  clear("berserkUntil", "Berserk");
  return names;
}

/**
 * Apply Protect / Shell, then Stoneskin.
 * A multiplier never reduces a positive hit to 0; Stoneskin can.
 */
type PvpVictimHost = MobEnhanceHost & {
  pvpVictim?: boolean;
  pvpMagDef?: number;
  pvpTreePhys?: number;
  pvpTreeMag?: number;
  mp?: number;
  manaWallUntil?: number;
  stoneskinUntil?: number;
  stoneskinAbsorb?: number;
  healAbsorbUntil?: number;
  healAbsorbHp?: number;
  berserkUntil?: number;
  defenderUntil?: number;
  curseUntil?: number;
  sleepUntil?: number;
  miseryRite?: boolean;
  miseryEmpowerUntil?: number;
  druidAshBraceUntil?: number;
  druidAshBraceMul?: number;
  druidBundleThickenUntil?: number;
  druidBundleThickenMul?: number;
  druidChalkWardUntil?: number;
  druidChalkWardMul?: number;
  druidMereVeilUntil?: number;
  druidMereVeilHp?: number;
};

function soakStoneskin(host: PvpVictimHost, now: number, raw: number): number {
  if (now >= (host.stoneskinUntil ?? 0) || (host.stoneskinAbsorb ?? 0) <= 0) return raw;
  const absorbed = Math.min(host.stoneskinAbsorb ?? 0, raw);
  host.stoneskinAbsorb = (host.stoneskinAbsorb ?? 0) - absorbed;
  if ((host.stoneskinAbsorb ?? 0) <= 0) {
    host.stoneskinAbsorb = 0;
    host.stoneskinUntil = 0;
  }
  return Math.max(0, raw - absorbed);
}

function soakHealShield(host: PvpVictimHost, now: number, raw: number): number {
  if (raw <= 0 || now >= (host.healAbsorbUntil ?? 0) || (host.healAbsorbHp ?? 0) <= 0) return raw;
  const soaked = Math.min(host.healAbsorbHp ?? 0, raw);
  host.healAbsorbHp = (host.healAbsorbHp ?? 0) - soaked;
  if ((host.healAbsorbHp ?? 0) <= 0) {
    host.healAbsorbHp = 0;
    host.healAbsorbUntil = 0;
  }
  return Math.max(0, raw - soaked);
}

function bleedManaWall(host: PvpVictimHost, now: number, raw: number): number {
  if (raw <= 0 || now >= (host.manaWallUntil ?? 0)) return raw;
  const bled = Math.min(host.mp ?? 0, raw);
  host.mp = (host.mp ?? 0) - bled;
  return Math.max(0, raw - bled);
}

/** Berserk and Defender, matching fighterDefenseMul without importing that module. */
function victimDefenseMul(host: PvpVictimHost, now: number): number {
  let mul = 1;
  if (now < (host.berserkUntil ?? 0)) mul *= 0.75;
  if (now < (host.defenderUntil ?? 0)) mul *= 1.25;
  return mul;
}

/** Ash Brace / Bundle / Chalk Ward — same stack as autos (`druidPhysDt`). */
function pvpDruidPhysDt(host: PvpVictimHost, now: number): number {
  let mul = 1;
  if (now < (host.druidAshBraceUntil ?? 0)) mul = Math.min(mul, host.druidAshBraceMul || 0.78);
  if (now < (host.druidBundleThickenUntil ?? 0)) mul = Math.min(mul, host.druidBundleThickenMul || 0.7);
  if (now < (host.druidChalkWardUntil ?? 0)) mul *= host.druidChalkWardMul || 1;
  return mul;
}

function soakMereVeil(host: PvpVictimHost, now: number, raw: number): number {
  if (now >= (host.druidMereVeilUntil ?? 0) || (host.druidMereVeilHp ?? 0) <= 0) {
    if (now >= (host.druidMereVeilUntil ?? 0)) host.druidMereVeilHp = 0;
    return raw;
  }
  const soaked = Math.min(host.druidMereVeilHp ?? 0, raw);
  host.druidMereVeilHp = (host.druidMereVeilHp ?? 0) - soaked;
  if ((host.druidMereVeilHp ?? 0) <= 0) {
    host.druidMereVeilHp = 0;
    host.druidMereVeilUntil = 0;
  }
  return raw - soaked;
}

/**
 * Player wards for a PvP stand-in. Mob enhances use the branch below this.
 * Bulwark still returns 0. Magic resistance runs before Asylum / Shell / Mana Wall.
 */
function takePvpVictimHit(host: PvpVictimHost, raw: number, kind: "physical" | "magic", now: number): number {
  if (raw <= 0) return 0;
  let dmg = raw;
  if (kind === "magic") dmg = mitigateMagicDamage(dmg, host.pvpMagDef ?? 0);
  dmg = Math.max(
    0,
    Math.floor(
      dmg *
        pendingHitDtMul(host as PhysDtUnit & MagDtUnit, now, kind === "magic", {
          physDt: host.pvpTreePhys ?? 0,
          magDt: host.pvpTreeMag ?? 0,
        }),
    ),
  );
  if (kind === "physical") dmg = Math.max(0, Math.floor(dmg * pvpDruidPhysDt(host, now)));
  dmg = soakStoneskin(host, now, dmg);
  dmg = soakHealShield(host, now, dmg);
  dmg = soakMereVeil(host, now, dmg);
  dmg = Math.max(0, Math.floor(dmg * victimDefenseMul(host, now)));
  dmg = bleedManaWall(host, now, dmg);
  dmg = curseTaken(dmg, host.curseUntil ?? 0, now);
  if (dmg > 0 && (host.sleepUntil ?? 0) > now) host.sleepUntil = 0;
  if (dmg > 0 && host.miseryRite) host.miseryEmpowerUntil = now + 15_000;
  return dmg;
}

export function takeMobHit(
  host: MobEnhanceHost,
  raw: number,
  kind: "physical" | "magic",
  now: number,
): number {
  if ((host as PvpVictimHost).pvpVictim) return takePvpVictimHit(host as PvpVictimHost, raw, kind, now);
  if (raw <= 0) return 0;
  let dmg = raw;
  if (kind === "magic") {
    const resist = read(host, "magResist");
    if (resist > 0) dmg = Math.max(1, Math.floor(dmg * magicResistMul(resist)));
  }
  if (kind === "physical" && read(host, "protectUntil") > now) {
    dmg = Math.max(1, Math.floor(dmg * (read(host, "protectPhysMul") || 1)));
  }
  if (kind === "magic" && read(host, "shellUntil") > now) {
    dmg = Math.max(1, Math.floor(dmg * (read(host, "shellMagMul") || 1)));
  }
  const absorb = read(host, "stoneskinAbsorb");
  if (read(host, "stoneskinUntil") > now && absorb > 0) {
    const soaked = Math.min(absorb, dmg);
    host.stoneskinAbsorb = absorb - soaked;
    dmg -= soaked;
    if ((host.stoneskinAbsorb ?? 0) <= 0) {
      host.stoneskinAbsorb = 0;
      host.stoneskinUntil = 0;
    }
  }
  const dealt = Math.max(0, dmg);
  const wind = asCastWindup(host);
  if (wind && dealt > 0) interruptCastOnDamage(wind, now, dealt);
  return dealt;
}
