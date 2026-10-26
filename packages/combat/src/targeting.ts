import type { AbilityId } from "@bellgrave/protocol";
import type { UnitSnapshot } from "@bellgrave/protocol";
import {
  abilityNeedsTarget,
  abilityTargetFaction,
} from "./abilities";

/** Matches server `ENGAGE_MAX_RANGE` — tab-select and engage. */
export const TAB_HOSTILE_RANGE = 30;
/** Default ally spell assist range for tab-select. */
export const TAB_FRIENDLY_RANGE = 15;

function distUnits(a: UnitSnapshot, b: UnitSnapshot): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function sameWallet(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

export function isHostileTabUnit(u: UnitSnapshot, wallet: string): boolean {
  if (u.kind === "mob" && u.hp > 0 && u.anim !== "dead") return true;
  if (u.kind === "player" && u.pvpBounty && !sameWallet(u.id, wallet)) return true;
  return false;
}

/** HUD target plate + tab cycle (includes passive mobs before engage). */
export function enemyTargetLabel(u: UnitSnapshot): string {
  if (u.kind === "mob") {
    return `${u.shiny ? "★ " : ""}${u.name}${u.level ? ` · Lv${u.level}` : ""}`;
  }
  return `${u.pvpBounty ? "☠ " : ""}${u.name}`;
}

export function isFriendlyTabUnit(u: UnitSnapshot, wallet: string): boolean {
  if (u.kind !== "player") return false;
  if (u.hp <= 0 || u.anim === "dead") return false;
  return true;
}

export function listHostileTabTargets(
  units: readonly UnitSnapshot[],
  me: UnitSnapshot,
  wallet: string,
): UnitSnapshot[] {
  return units
    .filter((u) => isHostileTabUnit(u, wallet) && distUnits(me, u) <= TAB_HOSTILE_RANGE)
    .sort((a, b) => distUnits(me, a) - distUnits(me, b));
}

/** Self first, then other players by distance. */
export function listFriendlyTabTargets(
  units: readonly UnitSnapshot[],
  me: UnitSnapshot,
  wallet: string,
): UnitSnapshot[] {
  const out: UnitSnapshot[] = [];
  const self = units.find((u) => u.kind === "player" && sameWallet(u.id, wallet));
  if (self && isFriendlyTabUnit(self, wallet)) out.push(self);
  const rest = units
    .filter(
      (u) =>
        isFriendlyTabUnit(u, wallet) &&
        !sameWallet(u.id, wallet) &&
        distUnits(me, u) <= TAB_FRIENDLY_RANGE,
    )
    .sort((a, b) => distUnits(me, a) - distUnits(me, b));
  out.push(...rest);
  return out;
}

export function cycleTabTarget(
  current: string | null,
  list: readonly UnitSnapshot[],
  dir: 1 | -1,
): string | null {
  if (list.length === 0) return null;
  const idx = current ? list.findIndex((u) => u.id === current) : -1;
  const next =
    idx === -1
      ? dir === 1
        ? 0
        : list.length - 1
      : (idx + dir + list.length) % list.length;
  return list[next]!.id;
}

export function canEngageSelected(
  units: readonly UnitSnapshot[],
  targetId: string | null,
  wallet: string,
): boolean {
  if (!targetId) return false;
  const u = units.find((x) => x.id === targetId);
  if (!u) return false;
  return isHostileTabUnit(u, wallet);
}

/**
 * Client-side target id sent with `ability` — never invent a fallback mob id.
 */
export function resolveAbilityTargetId(
  id: AbilityId,
  selected: string | null,
  wallet: string,
  combatTargetId: string | null,
  units: readonly UnitSnapshot[],
): string | undefined {
  if (!abilityNeedsTarget(id)) return undefined;
  const faction = abilityTargetFaction(id);
  const picked = selected ? units.find((u) => u.id === selected) : undefined;

  if (faction === "ally") {
    if (picked && picked.kind === "player") return picked.id;
    return wallet;
  }

  if (faction === "enemy") {
    if (picked && isHostileTabUnit(picked, wallet)) return picked.id;
    if (combatTargetId) {
      const combat = units.find((u) => u.id === combatTargetId);
      if (combat && isHostileTabUnit(combat, wallet)) return combatTargetId;
    }
    return undefined;
  }

  return selected ?? undefined;
}
