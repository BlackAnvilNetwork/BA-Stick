// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

/**
 * Field population: the monsters and NPCs each registered field (ZONE_FIELDS)
 * serves. The server reads only `fieldMobDefs` / `fieldNpcDefs`; content comes
 * from a list of sources.
 *
 * - A dedicated source (for example a hand-designed or generated content pack
 *   for a region) registers with `registerFieldPopulation`. For every zone it
 *   covers, it replaces the baseline completely, so nothing is served twice.
 * - The baseline source keeps every other field alive: a few packs of the
 *   existing creatures scaled to the field's level, plus one warden near the
 *   arrival. Spots are generated against each field's own walk mask, reachable
 *   from the field spawn, off bridges and open water, and clear of gates.
 *
 * Coordinates are zone-local metres (the same frame as the field's walkable).
 * Nothing is computed at import time; results are memoised per zone.
 */
import {
  PH_ARCHETYPE_DEFAULT_JOB,
  type PaleHollowArchetype,
  type PaleHollowMobDef,
} from "./pale-hollow";
import { PH_ALL_MOBS } from "./pale-hollow-field";
import { ZONE_FIELDS, fieldById, type ZoneField } from "./zone-fields";

/** A Pale Hollow style mob def plus the field it lives in. */
export type FieldMobDef = PaleHollowMobDef & { zoneId: string };

export type FieldNpcRole = "guide" | "quest_giver" | "crafter" | "vendor";

export type FieldNpcDef = {
  id: string;
  zoneId: string;
  name: string;
  x: number;
  z: number;
  facing: number;
  role: FieldNpcRole;
  /** What the NPC says when spoken to (sources with their own dialog may omit it). */
  lines?: string;
};

export type FieldPopulationSource = {
  id: string;
  /** Zones this source owns; the baseline steps aside for them. */
  zones: readonly string[];
  mobs: () => readonly FieldMobDef[];
  npcs: () => readonly FieldNpcDef[];
};

const sources: FieldPopulationSource[] = [];
let mobCache: FieldMobDef[] | null = null;
let npcCache: FieldNpcDef[] | null = null;

/** Plug a content pack in. Re-registering the same id replaces it. */
export function registerFieldPopulation(src: FieldPopulationSource): void {
  const i = sources.findIndex((s) => s.id === src.id);
  if (i >= 0) sources.splice(i, 1, src);
  else sources.push(src);
  mobCache = null;
  npcCache = null;
}

/** Remove a source (tests). */
export function unregisterFieldPopulation(id: string): void {
  const i = sources.findIndex((s) => s.id === id);
  if (i >= 0) sources.splice(i, 1);
  mobCache = null;
  npcCache = null;
}

function ownedZones(): Set<string> {
  return new Set(sources.flatMap((s) => s.zones));
}

export function fieldMobDefs(zoneId?: string): FieldMobDef[] {
  if (!mobCache) {
    const owned = ownedZones();
    mobCache = [
      ...sources.flatMap((s) => s.mobs()),
      ...Object.keys(ZONE_FIELDS).filter((z) => !owned.has(z)).flatMap((z) => baseline(z).mobs),
    ];
  }
  return zoneId ? mobCache.filter((m) => m.zoneId === zoneId) : mobCache;
}

export function fieldNpcDefs(zoneId?: string): FieldNpcDef[] {
  if (!npcCache) {
    const owned = ownedZones();
    npcCache = [
      ...sources.flatMap((s) => s.npcs()),
      ...Object.keys(ZONE_FIELDS).filter((z) => !owned.has(z)).flatMap((z) => baseline(z).npcs),
    ];
  }
  return zoneId ? npcCache.filter((n) => n.zoneId === zoneId) : npcCache;
}

export function fieldMobDefById(id: string): FieldMobDef | undefined {
  return fieldMobDefs().find((m) => m.id === id);
}

export function fieldNpcById(id: string): FieldNpcDef | undefined {
  return fieldNpcDefs().find((n) => n.id === id);
}

// ---------------------------------------------------------------- baseline

type BaselinePlan = {
  level: number;
  /** Creatures used for the packs, in order. */
  packs: readonly PaleHollowArchetype[];
  warden: { name: string; lines: string };
};

/** Field levels follow the road east from Pale Hollow; never below a field's open-gate soft level. */
export const BASELINE_FIELD_PLANS: Readonly<Record<string, BaselinePlan>> = {
  hollow_road: {
    level: 8,
    packs: ["hollow_scavenger", "ashbeam_boar", "pale_slime"],
    warden: { name: "Brannoc Hale", lines: "Keep to the road. The scavengers watch it from the ditches, and the boars come when they hear you." },
  },
  forest_basin: {
    level: 9,
    packs: ["ashbeam_boar", "pale_slime", "cliff_adder"],
    warden: { name: "Oswy Fernhallow", lines: "The gaps west and north are choked with deadfall. The only way on is the southeast gap, toward the Spur Road." },
  },
  spur_road: {
    level: 10,
    packs: ["hollow_scavenger", "ruin_dweller", "ashbeam_boar"],
    warden: { name: "Tamsin Reeve", lines: "Ruin dwellers squat in the old waymarks along this spur. They fight in twos. Don't let them flank you." },
  },
  ring_ward: {
    level: 11,
    packs: ["ruin_dweller", "cliff_adder", "hollow_scavenger"],
    warden: { name: "Edric Coldwater", lines: "This ward was walled once. The stones still stand, and so do the things that hide among them." },
  },
  islet_fords: {
    level: 12,
    packs: ["pale_slime", "clay_crab", "cliff_adder"],
    warden: { name: "Maud Rushwater", lines: "Wade the shallows, never the dark water. The slimes thicken where the current slows." },
  },
  green_reach: {
    level: 13,
    packs: ["ashbeam_boar", "ruin_dweller", "seam_golem"],
    warden: { name: "Halvard Greave", lines: "The reach looks gentle. It isn't. Something old walks the far meadows when the light goes." },
  },
  coil_pass: {
    level: 14,
    packs: ["cliff_adder", "seam_golem", "shard_wight"],
    warden: { name: "Ysolde Thorne", lines: "The pass narrows ahead. Adders on the ledges, and worse past the turn. Go up rested." },
  },
  coil_ridge: {
    level: 16,
    packs: ["seam_golem", "shard_wight", "ruin_dweller"],
    warden: { name: "Gaut the Unsleeping", lines: "From the top you can see Anvilhold's smoke. The wights here remember the old roads. They do not let them be walked." },
  },
};

/** Distance rules for baseline spots (metres). */
export const BASELINE_CLEAR = { gate: 8, spawnMob: 24, spawnNpc: 5, npcMob: 10, packGap: 18 } as const;

const ARCHETYPE_TEMPLATE = new Map<PaleHollowArchetype, PaleHollowMobDef>();
function template(a: PaleHollowArchetype): PaleHollowMobDef {
  if (ARCHETYPE_TEMPLATE.size === 0) {
    for (const d of PH_ALL_MOBS) if (!ARCHETYPE_TEMPLATE.has(d.archetype)) ARCHETYPE_TEMPLATE.set(d.archetype, d);
  }
  const t = ARCHETYPE_TEMPLATE.get(a);
  if (!t) throw new Error(`no Pale Hollow template for ${a}`);
  return t;
}

/** HP scales gently with level from the creature's Pale Hollow template. */
export function baselineHp(t: Pick<PaleHollowMobDef, "hp" | "level">, level: number): number {
  return Math.max(t.hp, Math.round(t.hp * (1 + 0.1 * (level - t.level))));
}

type Pt = { x: number; z: number };

const reachCache = new Map<string, (x: number, z: number) => boolean>();

/** Cells (1 m) reachable on foot from the field spawn. */
export function fieldReachable(zoneId: string): (x: number, z: number) => boolean {
  const hit = reachCache.get(zoneId);
  if (hit) return hit;
  const f = fieldById(zoneId);
  if (!f) throw new Error(`unknown field ${zoneId}`);
  const { minX, maxX, minZ, maxZ } = f.bounds;
  const w = Math.floor(maxX - minX) + 1;
  const h = Math.floor(maxZ - minZ) + 1;
  const seen = new Uint8Array(w * h);
  const ok = (x: number, z: number) => f.walkable(x, z) && !f.openWater(x, z);
  const sx = Math.round(f.spawn.x - minX);
  const sz = Math.round(f.spawn.z - minZ);
  const q: number[] = [];
  if (ok(minX + sx, minZ + sz)) {
    seen[sz * w + sx] = 1;
    q.push(sz * w + sx);
  }
  for (let head = 0; head < q.length; head++) {
    const c = q[head]!;
    const cx = c % w;
    const cz = (c - cx) / w;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cx + dx;
      const nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= w || nz >= h) continue;
      const k = nz * w + nx;
      if (seen[k]) continue;
      const wx = minX + nx;
      const wz = minZ + nz;
      if (!ok(wx, wz) || !ok(minX + cx + dx / 2, minZ + cz + dz / 2)) continue;
      seen[k] = 1;
      q.push(k);
    }
  }
  const fn = (x: number, z: number) => {
    const ix = Math.round(x - minX);
    const iz = Math.round(z - minZ);
    return ix >= 0 && iz >= 0 && ix < w && iz < h && seen[iz * w + ix] === 1;
  };
  reachCache.set(zoneId, fn);
  return fn;
}

function gateDist(f: ZoneField, p: Pt): number {
  let best = Infinity;
  for (const g of f.gates) {
    const dx = Math.max(g.minX - p.x, 0, p.x - g.maxX);
    const dz = Math.max(g.minZ - p.z, 0, p.z - g.maxZ);
    best = Math.min(best, Math.hypot(dx, dz));
  }
  return best;
}

/** Why a spot is not fit for baseline content, or null when it is. */
export function baselineSpotProblem(zoneId: string, p: Pt): string | null {
  const f = fieldById(zoneId);
  if (!f) return "unknown field";
  const { minX, maxX, minZ, maxZ } = f.bounds;
  if (p.x < minX + 2 || p.x > maxX - 2 || p.z < minZ + 2 || p.z > maxZ - 2) return "near bounds";
  if (!f.walkable(p.x, p.z)) return "not walkable";
  if (f.openWater(p.x, p.z)) return "open water";
  if (f.onBridge(p.x, p.z)) return "on a bridge";
  if (!fieldReachable(zoneId)(p.x, p.z)) return "unreachable from spawn";
  if (gateDist(f, p) < BASELINE_CLEAR.gate) return "too close to a gate";
  return null;
}

/** Deterministic candidate spots: rings around the spawn, golden-angle spread. */
function* candidates(f: ZoneField, r0: number): Generator<Pt> {
  const span = Math.max(f.bounds.maxX - f.bounds.minX, f.bounds.maxZ - f.bounds.minZ);
  const GOLD = Math.PI * (3 - Math.sqrt(5));
  let k = 0;
  for (let r = r0; r <= span; r += 4) {
    const n = Math.max(8, Math.round((r * Math.PI * 2) / 6));
    for (let i = 0; i < n; i++) {
      const a = (k++ * GOLD) % (Math.PI * 2);
      yield { x: Math.round((f.spawn.x + Math.sin(a) * r) * 2) / 2, z: Math.round((f.spawn.z + Math.cos(a) * r) * 2) / 2 };
    }
  }
}

const baselineCache = new Map<string, { mobs: FieldMobDef[]; npcs: FieldNpcDef[] }>();

/** Baseline content for one field (empty when the field has no plan). */
export function baseline(zoneId: string): { mobs: FieldMobDef[]; npcs: FieldNpcDef[] } {
  const hit = baselineCache.get(zoneId);
  if (hit) return hit;
  const f = fieldById(zoneId);
  const plan = BASELINE_FIELD_PLANS[zoneId];
  const out = { mobs: [] as FieldMobDef[], npcs: [] as FieldNpcDef[] };
  if (!f || !plan) {
    baselineCache.set(zoneId, out);
    return out;
  }
  let warden: Pt | null = null;
  for (const c of candidates(f, BASELINE_CLEAR.spawnNpc + 1)) {
    if (baselineSpotProblem(zoneId, c)) continue;
    warden = c;
    break;
  }
  if (warden) {
    out.npcs.push({
      id: `${zoneId}-warden`,
      zoneId,
      name: plan.warden.name,
      x: warden.x,
      z: warden.z,
      facing: Math.atan2(f.spawn.x - warden.x, f.spawn.z - warden.z),
      role: "guide",
      lines: plan.warden.lines,
    });
  }
  const packs: Pt[] = [];
  const iter = candidates(f, BASELINE_CLEAR.spawnMob);
  for (const archetype of plan.packs) {
    for (let step = iter.next(); !step.done; step = iter.next()) {
      const c = step.value;
      if (packs.some((p) => Math.hypot(p.x - c.x, p.z - c.z) < BASELINE_CLEAR.packGap)) continue;
      if (warden && Math.hypot(warden.x - c.x, warden.z - c.z) < BASELINE_CLEAR.npcMob) continue;
      const mate = { x: c.x + 2.5, z: c.z };
      if (baselineSpotProblem(zoneId, c) || baselineSpotProblem(zoneId, mate)) continue;
      packs.push(c);
      const t = template(archetype);
      for (const [i, s] of [c, mate].entries()) {
        out.mobs.push({
          id: `${zoneId}-${archetype}-${i}`,
          zoneId,
          name: t.name,
          x: s.x,
          z: s.z,
          level: plan.level,
          archetype,
          job: t.job ?? PH_ARCHETYPE_DEFAULT_JOB[archetype],
          aggro: t.aggro,
          aggroRange: t.aggroRange,
          linkRange: t.linkRange,
          hp: baselineHp(t, plan.level),
          drops: [...t.drops],
          rareDrops: t.rareDrops ? [...t.rareDrops] : undefined,
          fixedDrops: t.fixedDrops ? [...t.fixedDrops] : undefined,
        });
      }
      break;
    }
  }
  baselineCache.set(zoneId, out);
  return out;
}
