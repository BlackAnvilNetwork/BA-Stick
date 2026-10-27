// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

import {
  clampPaleHollow,
  fieldById,
  fieldNpcDefs,
  paleHollowClampMove,
  paleHollowInBuildingClearing,
  paleHollowInOpenWater,
  paleHollowPlaceOnDryLand,
  paleHollowWalkable,
} from "@bellgrave/config";

/**
 * Ground rules for mob movement in one zone. Pale Hollow keeps its own
 * functions exactly; a registered field uses its walk mask (open water is
 * never mob ground) and keeps mobs out of a clearing around each field NPC
 * (field-population.ts), the way Pale Hollow keeps them out of buildings.
 */
export type MobGround = {
  zoneId: string;
  walkable: (x: number, z: number) => boolean;
  inClearing: (x: number, z: number) => boolean;
  inOpenWater: (x: number, z: number) => boolean;
  placeOnDry: (x: number, z: number) => { x: number; z: number };
  clamp: (x: number, z: number) => { x: number; z: number };
  clampMove: (fromX: number, fromZ: number, toX: number, toZ: number) => { x: number; z: number };
};

/** Clearing radius around a field NPC (camp props + the NPC). */
export const CAMP_CLEARING_R = 3.5;

export const PALE_HOLLOW_GROUND: MobGround = {
  zoneId: "pale_hollow",
  walkable: paleHollowWalkable,
  inClearing: paleHollowInBuildingClearing,
  inOpenWater: paleHollowInOpenWater,
  placeOnDry: paleHollowPlaceOnDryLand,
  clamp: clampPaleHollow,
  clampMove: paleHollowClampMove,
};

const cache = new Map<string, MobGround>();

export function mobGround(zoneId: string | null | undefined): MobGround {
  const f = fieldById(zoneId);
  if (!f) return PALE_HOLLOW_GROUND;
  const hit = cache.get(f.id);
  if (hit) return hit;
  const camps = fieldNpcDefs(f.id);
  const walkable = (x: number, z: number) => f.walkable(x, z) && !f.openWater(x, z);
  const placeOnDry = (x: number, z: number) => {
    const c = f.clamp(x, z);
    if (walkable(c.x, c.z)) return c;
    for (let r = 0.5; r <= 12; r += 0.5) {
      const n = Math.max(6, Math.round(r * 8));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        const q = f.clamp(c.x + Math.sin(a) * r, c.z + Math.cos(a) * r);
        if (walkable(q.x, q.z)) return q;
      }
    }
    return { x: f.spawn.x, z: f.spawn.z };
  };
  const g: MobGround = {
    zoneId: f.id,
    walkable,
    inClearing: (x, z) => camps.some((c) => Math.hypot(c.x - x, c.z - z) < CAMP_CLEARING_R),
    inOpenWater: f.openWater,
    placeOnDry,
    clamp: f.clamp,
    clampMove: f.clampMove,
  };
  cache.set(f.id, g);
  return g;
}

/** Zone key a unit lives in for mob purposes: a registered field, else Pale Hollow. */
export function mobZoneKey(zoneId: string | null | undefined): string {
  return fieldById(zoneId) ? zoneId! : "pale_hollow";
}

/** Units of one zone only (field coordinates overlap Pale Hollow's and each other's). */
export function inZone<T extends { zoneId: string }>(units: readonly T[], zoneId: string | null | undefined): T[] {
  const k = mobZoneKey(zoneId);
  return units.filter((u) => u.zoneId === k);
}
