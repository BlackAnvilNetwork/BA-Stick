// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

/** Hand-placed Forest Basin population (replaces the baseline for forest_basin). */
import { FB_MOB_PACKS, FB_NPCS } from "./forest-basin-content";
import {
  baselineHp,
  fieldMobTemplate,
  registerFieldPopulation,
  type FieldMobDef,
  type FieldNpcDef,
} from "./field-population";
import { PH_ARCHETYPE_DEFAULT_JOB, type PaleHollowArchetype } from "./pale-hollow";

const ZONE = "forest_basin";
const ARRIVAL = { x: 12, z: -100 };

export function forestBasinMobs(): FieldMobDef[] {
  const out: FieldMobDef[] = [];
  for (const p of FB_MOB_PACKS) {
    const a = p.archetype as PaleHollowArchetype;
    const t = fieldMobTemplate(a);
    for (let i = 0; i < p.n; i++) {
      const ang = (i / Math.max(1, p.n)) * Math.PI * 2;
      const r = p.n > 1 ? 2.2 : 0;
      out.push({
        id: `fb-${p.id}-${i}`,
        zoneId: ZONE,
        name: p.name ?? t.name,
        x: Math.round((p.x + Math.cos(ang) * r) * 2) / 2,
        z: Math.round((p.z + Math.sin(ang) * r) * 2) / 2,
        level: p.level,
        archetype: a,
        job: t.job ?? PH_ARCHETYPE_DEFAULT_JOB[a],
        aggro: t.aggro,
        aggroRange: t.aggroRange,
        linkRange: t.linkRange,
        hp: baselineHp(t, p.level),
        drops: [...t.drops],
        rareDrops: t.rareDrops ? [...t.rareDrops] : undefined,
        fixedDrops: t.fixedDrops ? [...t.fixedDrops] : undefined,
      });
    }
  }
  return out;
}

export function forestBasinNpcs(): FieldNpcDef[] {
  return FB_NPCS.map((n) => ({
    ...n,
    zoneId: ZONE,
    facing: Math.atan2(ARRIVAL.x - n.x, ARRIVAL.z - n.z),
  }));
}

registerFieldPopulation({ id: "forest-basin-hand", zones: [ZONE], mobs: forestBasinMobs, npcs: forestBasinNpcs });
