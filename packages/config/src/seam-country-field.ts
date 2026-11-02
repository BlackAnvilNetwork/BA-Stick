// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

/**
 * Seam Country population: monsters, quest givers, camps, readable landmarks
 * and quests for the seven fields east of Pale Hollow (Hollow Road → The
 * Broken Stair; Forest Basin is left to the baseline while it is rebuilt from a
 * blank map). Design: black-anvil-lore/seam-country-population.md.
 *
 * Placement is generated, not hand-placed: every spot is checked against the
 * frozen terrain (walkable, BFS-reachable from the field spawn, not open
 * water, not a bridge) and kept clear of trails, gates, warp circles, POIs,
 * ascent mouths/summits, spawns, arrivals and friendly camps. Results are
 * deterministic and memoised; nothing is computed at import time.
 *
 * Coordinates are zone-local metres, the same frame as each field's
 * walkable function. Mob ids carry the field prefix (hr-, fb-, sr-, rw-, if-,
 * gr-, cp-, cr-).
 */
import type {
  PaleHollowArchetype,
  PaleHollowFixedDrop,
  PaleHollowMobDef,
  PaleHollowRareDrop,
} from "./pale-hollow";
import {
  PH_QUESTS,
  normalizePaleHollowQuestState,
  type PaleHollowQuestDef,
  type PaleHollowQuestLogEntry,
  type PaleHollowQuestState,
} from "./pale-hollow-field";
import { ZONE_FIELDS, type ZoneField } from "./zone-fields";
import { ZONE_LINKS } from "./zone-links";
import { registerFieldPopulation, type FieldNpcDef } from "./field-population";
import { WORLD_POIS, type WorldPoi } from "./world-pois";
import { greenReachAscents } from "./green-reach";

export const SEAM_COUNTRY_ZONES = [
  "hollow_road", "spur_road", "ring_ward",
  "islet_fords", "green_reach", "coil_pass", "coil_ridge",
] as const;
export type SeamCountryZone = (typeof SEAM_COUNTRY_ZONES)[number];

export function isSeamCountryZone(id: string | null | undefined): id is SeamCountryZone {
  return !!id && (SEAM_COUNTRY_ZONES as readonly string[]).includes(id);
}

/** Field mob: a Pale Hollow mob def plus the field it lives in. */
export type SeamCountryMobDef = PaleHollowMobDef & { zoneId: SeamCountryZone };

export type SeamCountryCamp = {
  id: string;
  zoneId: SeamCountryZone;
  name: string;
  /** friendly = a giver stands here; hostile = a mob den (Crown, bandit, cult). */
  side: "friendly" | "hostile";
  /** Prop kit used by the zone bake (apps/stick-web/scripts/bake-zones.ts). */
  kit: "lean_to" | "crown" | "bandit" | "cult" | "ferry" | "fold";
  x: number;
  z: number;
  yaw: number;
};

export type SeamCountryNpc = {
  id: string;
  zoneId: SeamCountryZone;
  name: string;
  x: number;
  z: number;
  facing: number;
  role: "quest_giver";
  campId: string;
};

/** A readable landmark: the POI itself, exposed as an interactable unit. */
export type SeamCountryLandmark = {
  id: string;
  zoneId: SeamCountryZone;
  poiId: string;
  name: string;
  x: number;
  z: number;
  story: string;
  fragmentId?: string;
};

export type SeamCountryQuestDef = PaleHollowQuestDef & {
  zoneId: SeamCountryZone;
  /** Quest id that must be done before this one is offered. */
  requires?: string;
  /** POI the player must read on site (landmark unit id `lm-<poiId>`). */
  readPoi?: string;
  /** Mayflower figure the quest reports to (lore credit). */
  for?: string;
};

// ── Placement ──────────────────────────────────────────────────────────────

/** Warp circles per field (generator data: /workspace/worldgen-review/*.validation.json). */
export const SEAM_COUNTRY_WARPS: Readonly<Record<SeamCountryZone, { x: number; z: number }>> = {
  hollow_road: { x: 0, z: 68 },
  spur_road: { x: 0, z: 68 },
  ring_ward: { x: -33, z: 56 },
  islet_fords: { x: 92, z: -1 },
  green_reach: { x: -30, z: 22 },
  coil_pass: { x: 8, z: 112 },
  coil_ridge: { x: -3, z: -40 },
};

/** Scarp Cave climb (coil-ridge.ts keeps it private): mouth and top, plus the line. */
const SCARP_CAVE = [
  { x: -16, z: -125 }, { x: -30, z: -119 }, { x: -47, z: -113 }, { x: -63, z: -107 }, { x: -73, z: -99 }, { x: -67, z: -91 },
  { x: -52, z: -87 }, { x: -48, z: -80 }, { x: -57, z: -74 }, { x: -75, z: -70 }, { x: -81, z: -62 }, { x: -71, z: -55 },
  { x: -61, z: -49 }, { x: -58, z: -40 },
];

/** Clearances in metres (design doc §5). */
export const SC_CLEAR = {
  trail: { mob: 6, camp: 6, npc: 3.5 },
  gate: 8,
  warp: 12,
  poi: { mob: 4, camp: 10, npc: 6 },
  ascentEnd: 8,
  ascentPath: 3,
  spawn: { mob: 14, camp: 8, npc: 6 },
  friendlyCamp: 14,
  hostileCamp: 4,
  mobGap: 6.5,
} as const;

/**
 * Narrow fields where the 6 m mob trail clearance leaves no ground: Ring Ward
 * is all lanes (every street is a trail) and Coil Pass is one switchback.
 * Mobs there keep 3.5 m / 4.5 m off the centreline instead; camps keep 6 m.
 */
export const SC_MOB_TRAIL_CLEAR: Partial<Record<SeamCountryZone, number>> = { ring_ward: 3.5, coil_pass: 4.5 };

type Pt = { x: number; z: number };
type Kind = "mob" | "camp" | "npc";

function segDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dz = b.z - a.z;
  const L = dx * dx + dz * dz || 1;
  const u = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / L));
  return Math.hypot(p.x - a.x - u * dx, p.z - a.z - u * dz);
}
function lineDist(p: Pt, pts: readonly Pt[]): number {
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) best = Math.min(best, segDist(p, pts[i]!, pts[i + 1]!));
  if (pts.length === 1) best = Math.hypot(p.x - pts[0]!.x, p.z - pts[0]!.z);
  return best;
}

type Ascent = { name: string; pts: readonly Pt[] };
function ascents(zone: SeamCountryZone): Ascent[] {
  if (zone === "green_reach") return greenReachAscents().map((a) => ({ name: a.name, pts: a.pts }));
  if (zone === "coil_ridge") return [{ name: "Scarp Cave", pts: SCARP_CAVE }];
  return [];
}

const CELL = 0.5;
type Reach = (x: number, z: number) => boolean;
const reachCache = new Map<string, Reach>();
/** 0.5 m flood fill from the field spawn (same rule as world-pois.test.ts). */
export function seamCountryReachable(zone: SeamCountryZone): Reach {
  const hit = reachCache.get(zone);
  if (hit) return hit;
  const f = ZONE_FIELDS[zone]!;
  const { minX, maxX, minZ, maxZ } = f.bounds;
  const w = Math.floor((maxX - minX) / CELL) + 1, h = Math.floor((maxZ - minZ) / CELL) + 1;
  const walk = new Uint8Array(w * h), seen = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) walk[j * w + i] = f.walkable(minX + i * CELL, minZ + j * CELL) ? 1 : 0;
  const near = (x: number, z: number) => {
    const i0 = Math.round((x - minX) / CELL), j0 = Math.round((z - minZ) / CELL);
    for (let r = 0; r <= 2; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      const i = i0 + di, j = j0 + dj;
      if (i >= 0 && j >= 0 && i < w && j < h && walk[j * w + i]) return j * w + i;
    }
    return -1;
  };
  const s = near(f.spawn.x, f.spawn.z);
  if (s >= 0) {
    const q = [s]; seen[s] = 1;
    while (q.length) {
      const c = q.pop()!, i = c % w, j = (c / w) | 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const ni = i + di, nj = j + dj, n = nj * w + ni;
        if (ni >= 0 && nj >= 0 && ni < w && nj < h && walk[n] && !seen[n]) { seen[n] = 1; q.push(n); }
      }
    }
  }
  const fn: Reach = (x, z) => {
    if (!f.walkable(x, z)) return false;
    const c = near(x, z);
    return c >= 0 && seen[c] === 1;
  };
  reachCache.set(zone, fn);
  return fn;
}

function gateDist(p: Pt, g: { minX: number; maxX: number; minZ: number; maxZ: number }): number {
  const dx = Math.max(g.minX - p.x, 0, p.x - g.maxX), dz = Math.max(g.minZ - p.z, 0, p.z - g.maxZ);
  return Math.hypot(dx, dz);
}

/** Why a spot is illegal for `kind` (null = legal). Exposed for tests. */
export function seamCountrySpotProblem(zone: SeamCountryZone, p: Pt, kind: Kind, camps: readonly SeamCountryCamp[] = []): string | null {
  const f: ZoneField = ZONE_FIELDS[zone]!;
  if (!f.walkable(p.x, p.z)) return "not walkable";
  if (f.openWater(p.x, p.z)) return "open water";
  if (f.onBridge(p.x, p.z)) return "bridge";
  for (const [dx, dz] of [[1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]] as const) {
    const x = p.x + dx, z = p.z + dz;
    if (!f.walkable(x, z) || f.openWater(x, z) || f.onBridge(x, z)) return "edge";
  }
  if (!seamCountryReachable(zone)(p.x, p.z)) return "unreachable";
  const trailClear = kind === "mob" ? (SC_MOB_TRAIL_CLEAR[zone] ?? SC_CLEAR.trail.mob) : SC_CLEAR.trail[kind];
  for (const t of f.trails()) if (lineDist(p, t.points) < trailClear) return `trail ${t.id}`;
  for (const g of f.gates) if (gateDist(p, g) < SC_CLEAR.gate) return "gate";
  const warp = SEAM_COUNTRY_WARPS[zone];
  if (Math.hypot(p.x - warp.x, p.z - warp.z) < SC_CLEAR.warp) return "warp circle";
  for (const poi of WORLD_POIS) {
    if (poi.zone !== zone) continue;
    if (Math.hypot(p.x - poi.x, p.z - poi.z) < SC_CLEAR.poi[kind]) return `poi ${poi.id}`;
  }
  for (const a of ascents(zone)) {
    const ends = [a.pts[0]!, a.pts[a.pts.length - 1]!];
    for (const e of ends) if (Math.hypot(p.x - e.x, p.z - e.z) < SC_CLEAR.ascentEnd) return `ascent end ${a.name}`;
    if (lineDist(p, a.pts) < SC_CLEAR.ascentPath) return `ascent ${a.name}`;
  }
  const spawns = [f.spawn, ...ZONE_LINKS.filter((l) => l.to === zone).map((l) => l.spawn)];
  for (const s of spawns) if (Math.hypot(p.x - s.x, p.z - s.z) < SC_CLEAR.spawn[kind]) return "spawn/arrival";
  if (kind === "mob") {
    for (const c of camps) {
      const r = c.side === "friendly" ? SC_CLEAR.friendlyCamp : SC_CLEAR.hostileCamp;
      if (Math.hypot(p.x - c.x, p.z - c.z) < r) return `camp ${c.id}`;
    }
  }
  return null;
}

function hash(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Nearest legal spot to `pref` within `maxR` (rings of 0.5 m). */
function snap(zone: SeamCountryZone, pref: Pt, kind: Kind, camps: readonly SeamCountryCamp[], extra?: (p: Pt) => boolean, maxR = 40): Pt {
  for (let r = 0; r <= maxR; r += 0.5) {
    const n = Math.max(1, Math.round((2 * Math.PI * r) / 0.75));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * 2 * Math.PI;
      const p = { x: Math.round((pref.x + r * Math.cos(a)) * 2) / 2, z: Math.round((pref.z + r * Math.sin(a)) * 2) / 2 };
      if (!seamCountrySpotProblem(zone, p, kind, camps) && (!extra || extra(p))) return p;
    }
  }
  throw new Error(`seam-country: no legal ${kind} spot near ${zone} (${pref.x}, ${pref.z})`);
}

/** Up to `count` legal, spaced spots around a den, nearest-first with a jittered order. */
function spread(zone: SeamCountryZone, den: Pt, radius: number, count: number, placed: Pt[], camps: readonly SeamCountryCamp[], salt: number): Pt[] {
  const out: Pt[] = [];
  for (let grow = 1; grow <= 3 && out.length < count; grow++) {
    const R = radius * grow;
    const cand: { p: Pt; key: number }[] = [];
    for (let x = Math.ceil(den.x - R); x <= den.x + R; x += 1) {
      for (let z = Math.ceil(den.z - R); z <= den.z + R; z += 1) {
        const d = Math.hypot(x - den.x, z - den.z);
        if (d > R) continue;
        cand.push({ p: { x, z }, key: d + hash(x + salt, z - salt) * 6 });
      }
    }
    cand.sort((a, b) => a.key - b.key);
    for (const { p } of cand) {
      if (out.length >= count) break;
      if (placed.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < SC_CLEAR.mobGap)) continue;
      if (seamCountrySpotProblem(zone, p, "mob", camps)) continue;
      out.push(p);
      placed.push(p);
    }
  }
  if (out.length < count) throw new Error(`seam-country: ${zone} den (${den.x}, ${den.z}) fits ${out.length}/${count}`);
  return out;
}

// ── Authored content ───────────────────────────────────────────────────────

const PREFIX: Record<SeamCountryZone, string> = {
  hollow_road: "hr", spur_road: "sr", ring_ward: "rw",
  islet_fords: "if", green_reach: "gr", coil_pass: "cp", coil_ridge: "cr",
};

type Family = {
  key: string;
  name: string | readonly string[];
  archetype: PaleHollowArchetype;
  levels: readonly number[];
  aggro: PaleHollowMobDef["aggro"];
  aggroRange: number;
  linkRange?: number;
  hpMul?: number;
  drops: string[];
  rareDrops?: PaleHollowRareDrop[];
  fixedDrops?: PaleHollowFixedDrop[];
  den: Pt;
  radius: number;
  count: number;
};

type CampSpec = Omit<SeamCountryCamp, "zoneId" | "x" | "z"> & { pref: Pt };
type GiverSpec = { id: string; name: string; campId: string };
type QuestSpec = Omit<SeamCountryQuestDef, "zoneId" | "mobIds"> & { families: readonly string[] };

type FieldSpec = { camps: CampSpec[]; givers: GiverSpec[]; families: Family[]; quests: QuestSpec[] };

const SIGHT = 9, SOUND = 7, NEAR = 4.5;
const CROWN_DROPS = ["linen-scrap", "metal-scrap", "dried-ration-scrap"];
const HOUND_DROPS = ["soft-pelt", "desiccated-hide", "horn"];

/** HP on Pale Hollow's curve (~21 hp per level + 20). */
export function seamCountryHp(level: number, mul = 1): number {
  return Math.round(((21 * level + 20) * mul) / 5) * 5;
}

const FIELDS: Record<SeamCountryZone, FieldSpec> = {
  hollow_road: {
    camps: [
      { id: "hr-camp-wick", name: "Wick's Lean-to", side: "friendly", kit: "lean_to", pref: { x: 10, z: 38 }, yaw: -Math.PI / 2 },
      { id: "hr-camp-tithe", name: "Tithe Booth", side: "hostile", kit: "crown", pref: { x: 11, z: 112 }, yaw: -Math.PI / 2 },
    ],
    givers: [{ id: "npc-hr-wick", name: "Wick Tallow, Roadside Hermit", campId: "hr-camp-wick" }],
    families: [
      { key: "tithe", name: "Tithe-Taker", archetype: "crown_soldier", levels: [13, 14], aggro: "sight", aggroRange: SIGHT, linkRange: 7, drops: CROWN_DROPS, den: { x: 9, z: 108 }, radius: 24, count: 6 },
      { key: "hound", name: "Toll Hound", archetype: "hollow_scavenger", levels: [13], aggro: "sound", aggroRange: SOUND, hpMul: 0.9, drops: HOUND_DROPS, den: { x: -9, z: 100 }, radius: 24, count: 5 },
    ],
    quests: [
      { id: "hr-seventh-post", npcId: "npc-hr-wick", for: "Orrin Haltmark", title: "The Seventh Post", families: ["tithe"], need: 5, readPoi: "hr-seven-posts", gold: 360,
        offer: "The Crown's tithe-takers squat at the Seven Posts and call them mile-stones. No road has seven miles. Drive five of them off, then go and read the broken seventh stone for Orrin Haltmark in Mayflower.",
        progress: "Five tithe-takers, and the seventh stone read.",
        done: "Broken on purpose, you say. Orrin will want to hear it from you. Take this for the road." },
      { id: "hr-one-in-seven", npcId: "npc-hr-wick", for: "Maudry Saltpenny", title: "One in Seven", families: ["hound"], need: 4, gold: 240, requires: "hr-seventh-post",
        offer: "Their hounds run the carts down by the Tithe Booth. One cart in seven never reaches Mayflower. Put four of the hounds down for Maudry Saltpenny.",
        progress: "The hounds still run.",
        done: "Maudry's carts will come through. She pays in salt and coin both." },
    ],
  },
  spur_road: {
    camps: [
      { id: "sr-camp-hearth", name: "Freeholder's Hearth", side: "friendly", kit: "lean_to", pref: { x: -8, z: 92 }, yaw: Math.PI / 2 },
      { id: "sr-camp-watch", name: "Spur Watch Fire", side: "hostile", kit: "crown", pref: { x: -8, z: 156 }, yaw: Math.PI / 2 },
    ],
    givers: [{ id: "npc-sr-hesk", name: "Old Hesk, Last Freeholder", campId: "sr-camp-hearth" }],
    families: [
      { key: "outrider", name: "Crown Outrider", archetype: "crown_soldier", levels: [15, 16], aggro: "sight", aggroRange: SIGHT, linkRange: 7, drops: CROWN_DROPS, den: { x: -6, z: 168 }, radius: 20, count: 5 },
      { key: "adder", name: "Spur Adder", archetype: "cliff_adder", levels: [15], aggro: "proximity", aggroRange: NEAR, drops: ["poison-sac", "desiccated-hide"], den: { x: -6, z: 124 }, radius: 16, count: 4 },
    ],
    quests: [
      { id: "sr-bounded-sevens", npcId: "npc-sr-hesk", for: "Orrin Haltmark", title: "Bounded in Sevens", families: ["outrider"], need: 5, readPoi: "sr-seven-stones", gold: 405, requires: "hr-seventh-post",
        offer: "My hold was bounded by seven stones. The outriders say there were never any. Turn five of them back up the spur, and read the Seven-Stone Bench for Orrin Haltmark.",
        progress: "Five outriders, and the bench read.",
        done: "Seven stones. My grandmother counted them. Tell Orrin the free hold stands." },
      { id: "sr-under-cairn", npcId: "npc-sr-hesk", for: "Maudry Saltpenny", title: "Under the Cairn", families: ["adder"], need: 4, gold: 280,
        offer: "Adders nest under the Toll-Keeper's Cairn. The old tolls were paid in labour; I will pay in coin. Four of them, for Maudry's wagons.",
        progress: "The cairn still hisses.",
        done: "The cairn is quiet. Maudry's wagons can stop there again." },
    ],
  },
  ring_ward: {
    camps: [
      { id: "rw-camp-stoop", name: "Lampman's Stoop", side: "friendly", kit: "lean_to", pref: { x: 24, z: 40 }, yaw: Math.PI },
      { id: "rw-camp-post", name: "Wharfwarden's Post", side: "hostile", kit: "crown", pref: { x: -26, z: -30 }, yaw: Math.PI / 4 },
    ],
    givers: [{ id: "npc-rw-marrow", name: "Marrow Quaylan, Wharf Lampman", campId: "rw-camp-stoop" }],
    families: [
      { key: "drowned", name: "Wharf Drowned", archetype: "drowned_one", levels: [16, 17], aggro: "proximity", aggroRange: NEAR, drops: ["bone-chip", "slime-oil", "linen-scrap"], den: { x: 28, z: -28 }, radius: 18, count: 5 },
      { key: "lockkeeper", name: "The Lockkeeper Drowned", archetype: "drowned_one", levels: [18], aggro: "sight", aggroRange: 10, hpMul: 2.2, drops: ["bone-chip", "parchment"], fixedDrops: [{ slug: "parchment", qty: 2 }, { slug: "bone-chip", qty: 2 }], den: { x: 22, z: -34 }, radius: 14, count: 1 },
      { key: "warden", name: "Crown Wharfwarden", archetype: "crown_soldier", levels: [17], aggro: "sight", aggroRange: SIGHT, linkRange: 7, drops: [...CROWN_DROPS, "parchment"], den: { x: -28, z: -28 }, radius: 16, count: 3 },
      { key: "crab", name: "Canal Crab", archetype: "clay_crab", levels: [16], aggro: "safe", aggroRange: 0, hpMul: 1.1, drops: ["clay-crab", "river-sand"], den: { x: -80, z: 0 }, radius: 30, count: 4 },
    ],
    quests: [
      { id: "rw-older-walls", npcId: "npc-rw-marrow", for: "Ilse Morrowglass", title: "Older Than the Walls", families: ["drowned", "lockkeeper"], need: 5, readPoi: "rw-older-paving", gold: 435, requires: "sr-bounded-sevens",
        offer: "The wharf hands the canal drowned have climbed into the inner lanes, and the Lockkeeper Drowned with them, keys still at his belt. Lay five to rest, then read the Older Paving under the ring wall. Ilse Morrowglass asked for a rubbing.",
        progress: "Five of the drowned, and the paving read.",
        done: "Older than the walls. Seven courses, not ten. Ilse will have her rubbing." },
      { id: "rw-seven-courses", npcId: "npc-rw-marrow", for: "Brann Coldiron", title: "Seven Courses", families: ["warden"], need: 3, gold: 300,
        offer: "The Crown's wharfwardens chisel the old sevens off the wharf stones and cut tens in their place. Three of them hold a post in the south-west lanes. Brann Coldiron wants their iron.",
        progress: "The wardens still chisel.",
        done: "The stones keep their sevens, for a day at least." },
    ],
  },
  islet_fords: {
    camps: [{ id: "if-camp-ferry", name: "Ferry Stage", side: "friendly", kit: "ferry", pref: { x: 166, z: -14 }, yaw: Math.PI }],
    givers: [{ id: "npc-if-tobin", name: "Ferryman Tobin Reed", campId: "if-camp-ferry" }],
    families: [
      { key: "drowned", name: "Ford Drowned", archetype: "drowned_one", levels: [17, 18], aggro: "proximity", aggroRange: NEAR, drops: ["bone-chip", "slime-oil", "linen-scrap"], den: { x: 110, z: 8 }, radius: 18, count: 5 },
      { key: "lamprey", name: "Causeway Lamprey", archetype: "lamprey", levels: [17], aggro: "proximity", aggroRange: NEAR, drops: ["slime-oil", "poison-sac", "stone-scale"], den: { x: 170, z: 12 }, radius: 12, count: 5 },
      { key: "crab", name: "Ford Crab", archetype: "clay_crab", levels: [17], aggro: "safe", aggroRange: 0, hpMul: 1.1, drops: ["clay-crab", "river-sand"], den: { x: 175, z: 8 }, radius: 18, count: 3 },
    ],
    quests: [
      { id: "if-ring-held", npcId: "npc-if-tobin", for: "Orrin Haltmark", title: "The Ring Held", families: ["drowned"], need: 5, readPoi: "if-ring-held", gold: 450, requires: "rw-older-walls",
        offer: "The ferrymen from the West Cairn graves walk the middle islet. Lay five of them down and read the Islet Ring. The river moved, and the ring held. Orrin Haltmark should hear how.",
        progress: "Five of the ford drowned, and the ring read.",
        done: "The ring held because it was set to. Tell Orrin the river remembers." },
      { id: "if-eels", npcId: "npc-if-tobin", for: "Maudry Saltpenny", title: "Eels on the Causeway", families: ["lamprey"], need: 5, gold: 320,
        offer: "Most of the year these fords are wading water, and I keep this stage to show folk the safe stones. Come May, when the snowmelt drowns the fords, I pole them across instead. Either way, lampreys hunt the wet stones of the Broken Causeway, just north of here. They take ankles. Five of them, and Maudry Saltpenny pays for the oil.",
        progress: "The edges still bite.",
        done: "Maudry will render the oil. I will keep my ankles, and the safe stones stay safe until the May flood." },
    ],
  },
  green_reach: {
    camps: [{ id: "gr-camp-fold", name: "Herders' Fold", side: "friendly", kit: "fold", pref: { x: -40, z: -15 }, yaw: Math.PI / 2 }],
    givers: [{ id: "npc-gr-annet", name: "Drover-Widow Annet", campId: "gr-camp-fold" }],
    families: [
      { key: "grazer", name: "Banded Grazer", archetype: "stag", levels: [18], aggro: "safe", aggroRange: 0, drops: ["soft-pelt", "horn", "bark-strip"], den: { x: 30, z: -25 }, radius: 28, count: 6 },
      { key: "wolf", name: "Ringblight Wolf", archetype: "hollow_scavenger", levels: [18, 19], aggro: "sight", aggroRange: SIGHT, linkRange: 7, hpMul: 0.95, drops: ["soft-pelt", "horn", "giant-femur"], den: { x: 60, z: 62 }, radius: 24, count: 5 },
      { key: "adder", name: "Cord Adder", archetype: "cliff_adder", levels: [19], aggro: "proximity", aggroRange: NEAR, drops: ["poison-sac", "desiccated-hide"], den: { x: 88, z: 10 }, radius: 18, count: 3 },
      { key: "banding", name: "Old Banding", archetype: "stag", levels: [20], aggro: "sight", aggroRange: 10, hpMul: 2.2, drops: ["soft-pelt", "giant-femur"], fixedDrops: [{ slug: "horn", qty: 2 }, { slug: "soft-pelt", qty: 1 }, { slug: "giant-femur", qty: 1 }], den: { x: 12, z: -42 }, radius: 12, count: 1 },
    ],
    quests: [
      { id: "gr-view-of-seven", npcId: "npc-gr-annet", for: "Ilse Morrowglass", title: "The View of Seven", families: ["wolf", "banding"], need: 5, readPoi: "gr-white-caps-lookout", gold: 465, requires: "if-ring-held",
        offer: "Grass that grows in bands isn't for eating. The ringblight took the wolves and Old Banding with them. Bring down five of that blight, then climb the White Caps Stair and read what the summit shows. Ilse Morrowglass asked.",
        progress: "Five of the ringblight, and the summit read.",
        done: "Seven rings, seen all at once. My man saw it too, before. Tell Ilse." },
      { id: "gr-strays", npcId: "npc-gr-annet", for: "Brann Coldiron", title: "Strays of the Reach", families: ["grazer"], need: 6, gold: 340,
        offer: "Our herd went feral when the drovers left. Six of the banded grazers, for Brann Coldiron's tannery. It is kinder than the blight.",
        progress: "The strays still graze the bands.",
        done: "It is done, then. Brann will have his leather." },
    ],
  },
  coil_pass: {
    camps: [
      { id: "cp-camp-shelter", name: "Pilgrim Shelter", side: "friendly", kit: "lean_to", pref: { x: -10, z: 32 }, yaw: Math.PI / 2 },
      { id: "cp-camp-drover", name: "Drover Camp", side: "hostile", kit: "bandit", pref: { x: 14, z: 136 }, yaw: -Math.PI / 2 },
    ],
    givers: [{ id: "npc-cp-lantern", name: "Brother Lantern, Pass Pilgrim", campId: "cp-camp-shelter" }],
    families: [
      { key: "drover", name: "Seam Drover", archetype: "seam_drover", levels: [19, 20], aggro: "sight", aggroRange: SIGHT, linkRange: 7, drops: ["linen-scrap", "dried-ration-scrap", "shade-cotton", "copper-ore"], den: { x: 12, z: 140 }, radius: 22, count: 5 },
      { key: "maddoc", name: "Crook Maddoc, Drover Chief", archetype: "seam_drover", levels: [20], aggro: "sight", aggroRange: 10, hpMul: 2.2, drops: ["shade-cotton", "copper-ore"], fixedDrops: [{ slug: "shade-cotton", qty: 2 }, { slug: "copper-ore", qty: 2 }, { slug: "linen-scrap", qty: 2 }], den: { x: 18, z: 124 }, radius: 12, count: 1 },
      { key: "mastiff", name: "Drover Mastiff", archetype: "hollow_scavenger", levels: [19], aggro: "sound", aggroRange: SOUND, drops: HOUND_DROPS, den: { x: -14, z: 82 }, radius: 18, count: 4 },
    ],
    quests: [
      { id: "cp-crown-stones", npcId: "npc-cp-lantern", for: "Orrin Haltmark", title: "Crown Stones", families: ["drover", "maddoc"], need: 6, readPoi: "cp-crown-stones", gold: 480, requires: "gr-view-of-seven",
        offer: "Crook Maddoc holds the switchback toll the Kings forgot to collect. Five of his drovers and the crook himself, then read the Crown Stones. They point somewhere, brother. Orrin Haltmark will know where.",
        progress: "Maddoc's drovers, the crook, and the stones read.",
        done: "They point north, up the Broken Stair. Orrin will not sleep tonight." },
      { id: "cp-contraband", npcId: "npc-cp-lantern", for: "Maudry Saltpenny", title: "Contraband Hides", families: ["mastiff"], need: 4, gold: 360,
        offer: "The drovers' mastiffs guard hides that were never tithed. Four of them, and Maudry Saltpenny finds the hides a quiet buyer.",
        progress: "The mastiffs still guard the bend.",
        done: "Maudry thanks you. She did not say for what." },
    ],
  },
  coil_ridge: {
    camps: [
      { id: "cr-camp-cell", name: "Wenlo's Cell", side: "friendly", kit: "lean_to", pref: { x: 18, z: -108 }, yaw: Math.PI },
      { id: "cr-camp-whitewash", name: "Penitents' Whitewash Camp", side: "hostile", kit: "cult", pref: { x: -46, z: 80 }, yaw: Math.PI / 2 },
    ],
    givers: [{ id: "npc-cr-wenlo", name: "Ashen Wenlo, Stair Hermit", campId: "cr-camp-cell" }],
    families: [
      { key: "haunt", name: "Stair Haunt", archetype: "shard_wight", levels: [20, 21], aggro: "proximity", aggroRange: NEAR, drops: ["bone-chip", "ash-dust"], rareDrops: [{ slug: "skull-plate", chance: 0.1 }], den: { x: 62, z: 38 }, radius: 22, count: 5 },
      { key: "revenant", name: "Scarp Revenant", archetype: "ruin_dweller", levels: [20, 21], aggro: "sight", aggroRange: SIGHT, drops: ["cracked-brick", "metal-scrap", "giant-femur"], den: { x: -36, z: 2 }, radius: 22, count: 5 },
      { key: "whitener", name: "Penitent Whitener", archetype: "penitent", levels: [21], aggro: "sight", aggroRange: SIGHT, linkRange: 7, drops: ["linen-scrap", "parchment", "ink-salt", "ash-dust"], den: { x: -48, z: 86 }, radius: 22, count: 6 },
      { key: "named", name: ["Hollow", "Ashmouth", "Sootkin"], archetype: "penitent", levels: [22], aggro: "sight", aggroRange: 10, hpMul: 2.5, drops: ["parchment", "ink-salt", "ash-dust"], fixedDrops: [{ slug: "parchment", qty: 2 }, { slug: "ink-salt", qty: 2 }, { slug: "ash-dust", qty: 2 }], den: { x: -84, z: 86 }, radius: 18, count: 3 },
    ],
    quests: [
      { id: "cr-scriveners-oath", npcId: "npc-cr-wenlo", for: "Ilse Morrowglass", title: "The Scriveners' Oath", families: ["haunt"], need: 5, readPoi: "cr-scarp-cave-shrine", gold: 495, requires: "cp-crown-stones",
        offer: "The haunts of the Toppled Gatehouse walk the old stair. Lay five of them down, then climb the Scarp Cave to the shrine and read the oath the scriveners cut there. Ilse Morrowglass must have it word for word.",
        progress: "Five stair haunts, and the shrine read.",
        done: "They swore to carve true, and were broken for it. Carry it to Ilse." },
      { id: "cr-seven-hands", npcId: "npc-cr-wenlo", for: "Orrin Haltmark", title: "Seven Hands", families: ["named"], need: 3, readPoi: "cr-scarp-head-ring", gold: 630, requires: "cr-scriveners-oath",
        offer: "Hollow, Ashmouth and Sootkin ride ahead of the Cultists of the Seven, whitening every stone that remembers. Put all three down, then read the Scarp Head Ring before they scrub it.",
        progress: "Hollow, Ashmouth and Sootkin, and the ring read.",
        done: "Seven hands, and the seventh scraped away. The trail runs on to the Citadel. Orrin Haltmark must hear this first." },
      { id: "cr-whitewash", npcId: "npc-cr-wenlo", for: "Brann Coldiron", title: "Whitewash", families: ["whitener"], need: 6, gold: 400,
        offer: "The penitents whitewash the Stele Field a stone a day. Six of them. Brann Coldiron will melt their brushes' iron for nails.",
        progress: "The brushes are still wet.",
        done: "The steles keep their faces. Brann will have his iron." },
    ],
  },
};

// ── Generation (memoised) ──────────────────────────────────────────────────

type Built = {
  camps: SeamCountryCamp[];
  npcs: SeamCountryNpc[];
  landmarks: SeamCountryLandmark[];
  mobs: SeamCountryMobDef[];
  quests: SeamCountryQuestDef[];
};
const built = new Map<SeamCountryZone, Built>();

function build(zone: SeamCountryZone): Built {
  const hit = built.get(zone);
  if (hit) return hit;
  const spec = FIELDS[zone];
  const prefix = PREFIX[zone];
  const camps: SeamCountryCamp[] = [];
  for (const c of spec.camps) {
    const p = snap(zone, c.pref, "camp", camps, (q) => camps.every((o) => Math.hypot(o.x - q.x, o.z - q.z) >= 20));
    camps.push({ id: c.id, zoneId: zone, name: c.name, side: c.side, kit: c.kit, x: p.x, z: p.z, yaw: c.yaw });
  }
  const npcs: SeamCountryNpc[] = spec.givers.map((g) => {
    const camp = camps.find((c) => c.id === g.campId)!;
    // 2–3 m off the camp centre, facing out.
    const p = snap(zone, { x: camp.x + 2.4 * Math.cos(camp.yaw), z: camp.z - 2.4 * Math.sin(camp.yaw) }, "npc", camps,
      (q) => { const d = Math.hypot(q.x - camp.x, q.z - camp.z); return d >= 2 && d <= 3.5; }, 4);
    return { id: g.id, zoneId: zone, name: g.name, x: p.x, z: p.z, facing: camp.yaw, role: "quest_giver" as const, campId: camp.id };
  });
  const placed: Pt[] = [...npcs];
  const mobs: SeamCountryMobDef[] = [];
  const famIds = new Map<string, string[]>();
  spec.families.forEach((fam, fi) => {
    const spots = spread(zone, fam.den, fam.radius, fam.count, placed, camps, fi * 17 + prefix.charCodeAt(0));
    const ids: string[] = [];
    spots.forEach((s, i) => {
      const level = fam.levels[i % fam.levels.length]!;
      const name = typeof fam.name === "string" ? fam.name : fam.name[i % fam.name.length]!;
      const id = `${prefix}-${fam.key}-${i + 1}`;
      const row: SeamCountryMobDef = {
        id, name, x: s.x, z: s.z, level, archetype: fam.archetype,
        aggro: fam.aggro, aggroRange: fam.aggroRange, hp: seamCountryHp(level, fam.hpMul), drops: fam.drops, zoneId: zone,
      };
      if (fam.linkRange) row.linkRange = fam.linkRange;
      if (fam.rareDrops) row.rareDrops = fam.rareDrops;
      if (fam.fixedDrops) row.fixedDrops = fam.fixedDrops;
      mobs.push(row);
      ids.push(id);
    });
    famIds.set(fam.key, ids);
  });
  const landmarks: SeamCountryLandmark[] = WORLD_POIS.filter((p: WorldPoi) => p.zone === zone).map((p) => {
    const row: SeamCountryLandmark = { id: `lm-${p.id}`, zoneId: zone, poiId: p.id, name: p.name, x: p.x, z: p.z, story: p.story };
    if (p.fragmentId) row.fragmentId = p.fragmentId;
    return row;
  });
  const quests: SeamCountryQuestDef[] = spec.quests.map(({ families, ...q }) => ({
    ...q, zoneId: zone, mobIds: families.flatMap((k) => famIds.get(k) ?? []),
  }));
  const out = { camps, npcs, landmarks, mobs, quests };
  built.set(zone, out);
  return out;
}

export function seamCountryCamps(zone?: SeamCountryZone): SeamCountryCamp[] {
  return zone ? build(zone).camps : SEAM_COUNTRY_ZONES.flatMap((z) => build(z).camps);
}
export function seamCountryNpcs(zone?: SeamCountryZone): SeamCountryNpc[] {
  return zone ? build(zone).npcs : SEAM_COUNTRY_ZONES.flatMap((z) => build(z).npcs);
}
export function seamCountryLandmarks(zone?: SeamCountryZone): SeamCountryLandmark[] {
  return zone ? build(zone).landmarks : SEAM_COUNTRY_ZONES.flatMap((z) => build(z).landmarks);
}
export function seamCountryMobs(zone?: SeamCountryZone): SeamCountryMobDef[] {
  return zone ? build(zone).mobs : SEAM_COUNTRY_ZONES.flatMap((z) => build(z).mobs);
}
export function seamCountryQuests(zone?: SeamCountryZone): SeamCountryQuestDef[] {
  return zone ? build(zone).quests : SEAM_COUNTRY_ZONES.flatMap((z) => build(z).quests);
}

/** Static quest metadata (titles, givers, POIs) without running placement. */
export const SEAM_COUNTRY_QUEST_IDS: readonly string[] = SEAM_COUNTRY_ZONES.flatMap((z) => FIELDS[z].quests.map((q) => q.id));
export const SEAM_COUNTRY_NPC_IDS: readonly string[] = SEAM_COUNTRY_ZONES.flatMap((z) => FIELDS[z].givers.map((g) => g.id));

// ── World quest registry (Pale Hollow + Seam Country) ──────────────────────
//
// One quest state per player (the existing `hollowQuest` save). Pale Hollow
// quests keep their own functions and behaviour; these wrap both registries
// and add the "read at the landmark" step for quests with `readPoi`.

export type WorldQuestDef = PaleHollowQuestDef & { zoneId: string; requires?: string; readPoi?: string };

function allQuests(): WorldQuestDef[] {
  return [...PH_QUESTS.map((q) => ({ ...q, zoneId: "pale_hollow" })), ...seamCountryQuests()];
}
let questIndex: Map<string, WorldQuestDef> | null = null;
function index(): Map<string, WorldQuestDef> {
  if (!questIndex) questIndex = new Map(allQuests().map((q) => [q.id, q]));
  return questIndex;
}

export function worldQuestById(id: string): WorldQuestDef | undefined {
  return index().get(id);
}
export function worldQuestsByNpc(npcId: string): WorldQuestDef[] {
  return [...index().values()].filter((q) => q.npcId === npcId);
}
export function isWorldQuestGiver(npcId: string): boolean {
  return worldQuestsByNpc(npcId).length > 0;
}

export const LANDMARK_PREFIX = "lm-";
export function isLandmarkId(id: string): boolean {
  return id.startsWith(LANDMARK_PREFIX);
}
export function landmarkById(id: string): SeamCountryLandmark | undefined {
  if (!isLandmarkId(id)) return undefined;
  return seamCountryLandmarks().find((l) => l.id === id);
}

function entryReady(q: WorldQuestDef, e: { kills: number; read?: boolean }): boolean {
  return e.kills >= q.need && (!q.readPoi || e.read === true);
}

/** Quest log rows; a read step counts as one more step of `need`. */
export function worldQuestLogEntries(state: PaleHollowQuestState): PaleHollowQuestLogEntry[] {
  const st = normalizePaleHollowQuestState(state);
  return st.active.map((e) => {
    const q = worldQuestById(e.id);
    if (!q) return { id: e.id, title: e.id, kills: e.kills, need: 1, progress: "", ready: false };
    const read = q.readPoi ? (e.read ? 1 : 0) : 0;
    const poi = q.readPoi ? WORLD_POIS.find((p) => p.id === q.readPoi) : undefined;
    const progress = q.readPoi && !e.read && poi ? `${q.progress} Read ${poi.name}.` : q.progress;
    return {
      id: q.id,
      title: q.title,
      kills: Math.min(e.kills, q.need) + read,
      need: q.need + (q.readPoi ? 1 : 0),
      progress,
      ready: entryReady(q, e),
    };
  });
}

/** Kill credit by unique mob id, across every registry. */
export function worldQuestCredit(state: PaleHollowQuestState, mobId: string): PaleHollowQuestState {
  const st = normalizePaleHollowQuestState(state);
  if (st.active.length === 0) return st;
  let changed = false;
  const active = st.active.map((e) => {
    const q = worldQuestById(e.id);
    if (!q || !q.mobIds.includes(mobId) || e.kills >= q.need) return e;
    changed = true;
    return { ...e, kills: e.kills + 1 };
  });
  return changed ? { ...st, active } : st;
}

export type WorldQuestTalk = { state: PaleHollowQuestState; title: string; body: string; gold: number };

/**
 * Talk to a giver: turn in a ready quest, else report progress, else offer the
 * next quest whose `requires` is done. Pale Hollow givers keep one quest each.
 */
export function worldQuestTalk(state: PaleHollowQuestState, npcId: string): WorldQuestTalk {
  const st = normalizePaleHollowQuestState(state);
  const qs = worldQuestsByNpc(npcId);
  if (qs.length === 0) return { state: st, title: "…", body: "…", gold: 0 };
  for (const q of qs) {
    const e = st.active.find((a) => a.id === q.id);
    if (e && entryReady(q, e)) {
      return {
        state: { ...st, active: st.active.filter((a) => a.id !== q.id), done: [...st.done, q.id] },
        title: q.title, body: q.done, gold: q.gold,
      };
    }
  }
  for (const q of qs) {
    const e = st.active.find((a) => a.id === q.id);
    if (e) {
      const parts = [`${q.progress} ${Math.min(e.kills, q.need)}/${q.need}.`];
      if (q.readPoi && !e.read) {
        const poi = WORLD_POIS.find((p) => p.id === q.readPoi);
        if (poi) parts.push(`Then read ${poi.name}.`);
      }
      return { state: st, title: q.title, body: parts.join(" "), gold: 0 };
    }
  }
  for (const q of qs) {
    if (st.done.includes(q.id)) continue;
    if (q.requires && !st.done.includes(q.requires)) continue;
    return { state: { ...st, active: [...st.active, { id: q.id, kills: 0 }] }, title: q.title, body: q.offer, gold: 0 };
  }
  const waiting = qs.find((q) => !st.done.includes(q.id));
  if (waiting) {
    const need = waiting.requires ? worldQuestById(waiting.requires) : undefined;
    return { state: st, title: waiting.title, body: need ? `Come back when "${need.title}" is done.` : "…", gold: 0 };
  }
  const last = qs[qs.length - 1]!;
  return { state: st, title: last.title, body: last.done, gold: 0 };
}

/**
 * Read a landmark on site: marks the read step of every active quest that
 * names this POI. Always returns the POI's story so any landmark can be read.
 */
export function worldQuestRead(state: PaleHollowQuestState, landmarkId: string): WorldQuestTalk & { credited: string[] } {
  const st = normalizePaleHollowQuestState(state);
  const lm = landmarkById(landmarkId);
  if (!lm) return { state: st, title: "…", body: "…", gold: 0, credited: [] };
  const credited: string[] = [];
  const active = st.active.map((e) => {
    const q = worldQuestById(e.id);
    if (!q || q.readPoi !== lm.poiId || e.read) return e;
    credited.push(q.id);
    return { ...e, read: true };
  });
  const body = credited.length > 0 ? `${lm.story} (Remembered for "${worldQuestById(credited[0]!)!.title}".)` : lm.story;
  return { state: credited.length ? { ...st, active } : st, title: lm.name, body, gold: 0, credited };
}

// ── Field population ───────────────────────────────────────────────────────
// Seam Country owns its fields in field-population.ts: its monsters, quest
// givers and readable landmarks replace the starter packs and warden there.
// Landmarks are served as "guide" NPCs whose ids start with LANDMARK_PREFIX.
registerFieldPopulation({
  id: "seam-country",
  zones: SEAM_COUNTRY_ZONES,
  mobs: () => seamCountryMobs(),
  npcs: (): FieldNpcDef[] => [
    ...seamCountryNpcs().map((n) => ({ id: n.id, zoneId: n.zoneId, name: n.name, x: n.x, z: n.z, facing: n.facing, role: "quest_giver" as const })),
    ...seamCountryLandmarks().map((l) => ({ id: l.id, zoneId: l.zoneId, name: l.name, x: l.x, z: l.z, facing: 0, role: "guide" as const, lines: l.story })),
  ],
});
