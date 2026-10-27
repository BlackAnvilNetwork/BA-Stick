// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

import { PH_HUB_SPAWN, fieldById, paleHollowWalkable } from "@bellgrave/config";

export type EntrySpot = { zoneId: string; x: number; z: number; facing: number };

/**
 * Where `char/enter` puts a character (#124). The client only names the zone;
 * any x/z it sends is ignored. A character already standing in that zone on
 * walkable ground stays at its saved spot; anyone else lands on the zone's
 * spawn. An unknown zone returns null (the character stays put).
 */
export function chooseEntryPoint(saved: EntrySpot, zone: string | undefined): EntrySpot | null {
  const field = fieldById(zone);
  if (!field && zone !== "pale_hollow") return null;
  const walk = field?.walkable ?? paleHollowWalkable;
  const savedZone = saved.zoneId || "pale_hollow";
  if (savedZone === zone && Number.isFinite(saved.x) && Number.isFinite(saved.z) && walk(saved.x, saved.z)) {
    return { zoneId: zone, x: saved.x, z: saved.z, facing: saved.facing };
  }
  const spawn = field?.spawn ?? PH_HUB_SPAWN;
  return { zoneId: zone!, x: spawn.x, z: spawn.z, facing: spawn.facing };
}
