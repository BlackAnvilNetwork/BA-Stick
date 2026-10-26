/**
 * Coldhearth: the exiles' town on Pale Hollow's eastern spur (lore-bible §7.6).
 *
 * The scout encampment (`PH_HUB`, the Scout Gate) is the front door. Behind it, the
 * town steps up the spur in organic terraces joined by curved, ramped streets. Each
 * encampment NPC stands in a district that shows what they do.
 *
 * Shared by server and client through `paleHollowHeight` / `paleHollowWalkable`:
 *   - terraces are level floors with wobbly (non-straight) edges;
 *   - streets are ramped ribbons between terrace levels (grade <= ~0.25);
 *   - where a terrace or street sits more than `WALL_DROP` off the natural ground, its
 *     edge band is a retaining wall (not walkable): the town is entered by its streets;
 *   - building footprints (the only straight lines: real masonry) are not walkable.
 * Props (`COLDHEARTH_PROPS`) are client-visual data only.
 *
 * This module must not import pale-hollow.ts (pale-hollow imports it).
 */

export const COLDHEARTH_NAME = "Coldhearth";

/** Natural lift of the spur under the town (added to the basin height field). */
export const COLDHEARTH_SPUR = { x: 238, z: 226, r: 78, h: 6.5 } as const;

export type ColdhearthDistrictId =
  | "scout_gate" | "tally_row" | "turning_yard" | "strongroom" | "jobhouse" | "eightfold" | "elders_stair";

export type ColdhearthDistrict = {
  id: ColdhearthDistrictId;
  name: string;
  /** NPC ids whose station is here (code is authoritative on who exists). */
  npcs: readonly string[];
  /** Lore name of the district's keeper (labels/notes only; NPC display names are unchanged). */
  keeper: string;
  x: number;
  z: number;
  /** Mean radius of the terrace floor; the edge wobbles around it. */
  r: number;
  level: number;
  seed: number;
  blurb: string;
};

/** Scout Gate is the existing PH_HUB pad (168,190, floor 3.0); it is listed for labels only. */
export const COLDHEARTH_DISTRICTS: readonly ColdhearthDistrict[] = [
  { id: "scout_gate", keeper: "Wenna Gatesmoke", name: "The Scout Gate", npcs: ["npc-ph-herald"], x: 168, z: 190, r: 0, level: 3.0, seed: 0,
    blurb: "The old encampment: watch-fires, lookout post toward the Ash Road, the Herald's lectern." },
  { id: "tally_row", keeper: "Maudry Saltpenny", name: "Tally Row", npcs: ["npc-ph-vendor"], x: 196, z: 178, r: 10, level: 3.2, seed: 1.3,
    blurb: "Covered market: stalls, barrels, granary and smokehouses; honest scales." },
  { id: "turning_yard", keeper: "Ilse Morrowglass", name: "The Turning Yard", npcs: ["npc-ph-chronomancer"], x: 192, z: 150, r: 11, level: 1.6, seed: 2.1,
    blurb: "Sand yard under the seven-hour sundial tower: dummies, sparring ring, archery butts." },
  { id: "strongroom", keeper: "Gaunt Hobb", name: "The Strongroom", npcs: ["npc-ph-storage"], x: 214, z: 194, r: 6.5, level: 4.0, seed: 3.7,
    blurb: "Vaulted stone strongroom; the town's mark-books lie under its floor." },
  { id: "jobhouse", keeper: "Teodric Vane", name: "The Jobhouse", npcs: ["npc-ph-job-master"], x: 206, z: 214, r: 8, level: 4.6, seed: 4.4,
    blurb: "Drill-yard and lodging hall; practice weapons racked in sevens." },
  { id: "eightfold", keeper: "Brann Coldiron", name: "The Eightfold", npcs: ["npc-ph-crafter"], x: 238, z: 214, r: 14, level: 6.0, seed: 5.9,
    blurb: "Eight craft halls ringed round the anvil-stone; the Great Forge Hall and its chimney stack; water-wheel and quench troughs." },
  { id: "elders_stair", keeper: "Orrin Haltmark", name: "Elder's Stair", npcs: ["npc-shard-elder"], x: 232, z: 246, r: 8, level: 7.6, seed: 6.6,
    blurb: "Whitewashed terraces at the top of the town; the spring and the aqueduct head; lookout over the hollow." },
];

type Node = { x: number; z: number; level: number | null };
const D = (id: ColdhearthDistrictId): Node => {
  const d = COLDHEARTH_DISTRICTS.find((q) => q.id === id)!;
  return { x: d.x, z: d.z, level: d.level };
};

/** Curved streets: [from, to, perpendicular bow (m), half width]. level null = natural ground there. */
export const COLDHEARTH_STREETS: readonly { id: string; a: Node; b: Node; bow: number; halfW: number }[] = [
  { id: "gate-street", a: { x: 181, z: 190, level: 3.0 }, b: D("tally_row"), bow: 2.0, halfW: 2.2 },
  { id: "yard-stair", a: D("tally_row"), b: D("turning_yard"), bow: -2.5, halfW: 1.9 },
  { id: "yard-lane", a: D("turning_yard"), b: { x: 186, z: 126, level: null }, bow: 3.0, halfW: 1.9 },
  { id: "tally-climb", a: D("tally_row"), b: D("strongroom"), bow: -2.0, halfW: 2.0 },
  { id: "vault-lane", a: D("strongroom"), b: D("jobhouse"), bow: 1.5, halfW: 1.8 },
  { id: "hearth-way", a: D("strongroom"), b: D("eightfold"), bow: 3.5, halfW: 2.4 },
  { id: "drill-way", a: D("jobhouse"), b: D("eightfold"), bow: 4.0, halfW: 1.8 },
  { id: "elders-stair", a: D("eightfold"), b: D("elders_stair"), bow: -3.0, halfW: 1.7 },
];

/** Masonry footprints (not walkable). x/z world centre, w along yaw, d across. */
export type ColdhearthBuilding = {
  id: string; district: ColdhearthDistrictId; name: string;
  x: number; z: number; w: number; d: number; yaw: number; h: number;
};

const ring = (cx: number, cz: number, r: number, n: number, a0: number) =>
  Array.from({ length: n }, (_, i) => {
    const a = a0 + (i / n) * Math.PI * 2;
    return { x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, a };
  });

/** The eight halls of the Eightfold (§7.6), ringed round the anvil-stone, open side to it. */
export const EIGHTFOLD_HALLS = [
  "Smithing", "Woodworking", "Leathercraft", "Clothcraft", "Bonecraft", "Goldsmithing", "Alchemy", "Cooking",
] as const;

const EF = COLDHEARTH_DISTRICTS.find((d) => d.id === "eightfold")!;
// Halls sit on the inner rim; the arcs facing the streets (west, south-west, north) are left open.
const HALL_ANGLES = [-1.25, -0.65, -0.05, 0.55, 1.1, 2.45, 3.0, 3.55].map((a) => a);

export const COLDHEARTH_BUILDINGS: readonly ColdhearthBuilding[] = [
  { id: "great-forge-hall", district: "eightfold", name: "Great Forge Hall", x: EF.x + 4.5, z: EF.z + 0.5, w: 7, d: 5, yaw: 0.35, h: 4.2 },
  { id: "chimney-stack", district: "eightfold", name: "Chimney Stack", x: EF.x + 8.6, z: EF.z + 2.3, w: 1.8, d: 1.8, yaw: 0.35, h: 13 },
  ...HALL_ANGLES.map((a, i) => ({
    id: `hall-${EIGHTFOLD_HALLS[i].toLowerCase()}`, district: "eightfold" as const, name: `${EIGHTFOLD_HALLS[i]} Hall`,
    x: EF.x + Math.cos(a) * (EF.r - 3.2), z: EF.z + Math.sin(a) * (EF.r - 3.2), w: 3.4, d: 2.6, yaw: -a + Math.PI / 2, h: 2.6,
  })).filter((h) => Math.hypot(h.x - (EF.x + 4.5), h.z - (EF.z + 0.5)) > 6.5),
  { id: "granary", district: "tally_row", name: "Granary", x: 200, z: 184.5, w: 4, d: 3.2, yaw: -0.3, h: 3.4 },
  { id: "smokehouse", district: "tally_row", name: "Smokehouse", x: 203.5, z: 175, w: 2.6, d: 2.4, yaw: 0.5, h: 2.6 },
  { id: "sundial-tower", district: "turning_yard", name: "Sundial Tower", x: 198.5, z: 154.5, w: 2.4, d: 2.4, yaw: 0.2, h: 9 },
  { id: "strongroom-vault", district: "strongroom", name: "Strongroom Vault", x: 217, z: 196.5, w: 4.2, d: 3.4, yaw: -0.6, h: 3.2 },
  { id: "jobhouse-hall", district: "jobhouse", name: "Jobhouse Lodge", x: 203, z: 219, w: 6, d: 3.4, yaw: 0.4, h: 3.6 },
  { id: "elders-house", district: "elders_stair", name: "Elders' House", x: 234.5, z: 250.5, w: 4.5, d: 3.2, yaw: -0.25, h: 3.4 },
  { id: "spring-house", district: "elders_stair", name: "Spring House", x: 226.5, z: 249, w: 2.2, d: 2.2, yaw: 0.4, h: 2.2 },
];

/** Aqueduct: spring house (Elder's Stair) down to the Eightfold water-wheel. Piers are masonry footprints. */
export const COLDHEARTH_AQUEDUCT = [
  { x: 226.5, z: 246.5 }, { x: 228.5, z: 238 }, { x: 231.5, z: 230 }, { x: 234.5, z: 224.5 },
] as const;

/** Rundown stream (visual runnel) from the wheel down the streets to the yard lane: wheel, ford stones where streets cross. */
export const COLDHEARTH_RUNNEL = [
  { x: 234.5, z: 224.5 }, { x: 228, z: 214 }, { x: 222, z: 204 }, { x: 214, z: 188 },
  { x: 206, z: 180 }, { x: 198, z: 168 }, { x: 196, z: 161 }, { x: 188, z: 140 }, { x: 186, z: 128 },
] as const;

/** NPC stations inside their districts (world coords; walkable, clear of buildings). */
export const COLDHEARTH_STATIONS = {
  "npc-ph-herald": { x: 168.4, z: 193.0 },
  "npc-shard-elder": { x: 229.5, z: 243.0 },
  "npc-ph-crafter": { x: 236.0, z: 211.0 },
  "npc-ph-vendor": { x: 194.0, z: 179.5 },
  "npc-ph-job-master": { x: 206.5, z: 212.0 },
  "npc-ph-chronomancer": { x: 194.5, z: 152.0 },
  "npc-ph-storage": { x: 213.0, z: 193.0 },
} as const;

export const WALL_DROP = 0.6;
const BAND = 2.4;

function smooth01(t: number): number {
  const u = Math.max(0, Math.min(1, t));
  return u * u * (3 - 2 * u);
}

function wobble(d: ColdhearthDistrict, x: number, z: number): number {
  const a = Math.atan2(z - d.z, x - d.x);
  return d.r * (1 + 0.1 * Math.sin(3 * a + d.seed) + 0.05 * Math.sin(5 * a + 2 * d.seed));
}

const TERRACES = COLDHEARTH_DISTRICTS.filter((d) => d.r > 0);

type Seg = { ax: number; az: number; bx: number; bz: number; la: number; lb: number; t0: number; t1: number };
let streetSegs: { halfW: number; a: Node; b: Node; segs: Seg[] }[] | null = null;
function streets() {
  if (streetSegs) return streetSegs;
  streetSegs = COLDHEARTH_STREETS.map((s) => {
    const dx = s.b.x - s.a.x, dz = s.b.z - s.a.z, L = Math.hypot(dx, dz);
    const mx = (s.a.x + s.b.x) / 2 - (dz / L) * s.bow, mz = (s.a.z + s.b.z) / 2 + (dx / L) * s.bow;
    const N = 12, pts: { x: number; z: number; t: number }[] = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, u = 1 - t;
      pts.push({ x: u * u * s.a.x + 2 * u * t * mx + t * t * s.b.x, z: u * u * s.a.z + 2 * u * t * mz + t * t * s.b.z, t });
    }
    const segs: Seg[] = [];
    for (let i = 0; i < N; i++) segs.push({ ax: pts[i].x, az: pts[i].z, bx: pts[i + 1].x, bz: pts[i + 1].z, la: 0, lb: 0, t0: pts[i].t, t1: pts[i + 1].t });
    return { halfW: s.halfW, a: s.a, b: s.b, segs };
  });
  return streetSegs;
}

export const COLDHEARTH_BBOX = { minX: 172, maxX: 254, minZ: 120, maxZ: 260 } as const;

/** 0..1 weight: how much the fine height field (not the coarse terrain mesh) applies. */
export function coldhearthFieldWeight(x: number, z: number): number {
  const b = COLDHEARTH_BBOX;
  const e = Math.max(b.minX - x, x - b.maxX, b.minZ - z, z - b.maxZ);
  return 1 - smooth01(e / 8 + 1); // 1 inside (e<=-8), fades to 0 at the bbox edge
}

function inBuilding(x: number, z: number, pad = 0): ColdhearthBuilding | null {
  for (const b of COLDHEARTH_BUILDINGS) {
    const c = Math.cos(b.yaw), s = Math.sin(b.yaw);
    const lx = (x - b.x) * c - (z - b.z) * s, lz = (x - b.x) * s + (z - b.z) * c;
    if (Math.abs(lx) <= b.w / 2 + pad && Math.abs(lz) <= b.d / 2 + pad) return b;
  }
  for (const p of COLDHEARTH_AQUEDUCT) if (Math.hypot(x - p.x, z - p.z) < 0.9 + pad) return COLDHEARTH_BUILDINGS[0];
  return null;
}

export type ColdhearthSample = { y: number; walk: boolean; district: ColdhearthDistrictId | null; onStreet: boolean };

/**
 * Town shaping at (x,z) given the natural ground height there (lazy). Null = outside town.
 * `groundAt` gives natural ground at street ends with level null.
 */
export function coldhearthSample(
  x: number, z: number, ground: () => number, groundAt: (x: number, z: number) => number,
): ColdhearthSample | null {
  const b = COLDHEARTH_BBOX;
  if (x < b.minX - 4 || x > b.maxX + 4 || z < b.minZ - 4 || z > b.maxZ + 4) return null;
  // Terraces
  let edge = Infinity, edgeLevel = 0;
  for (const d of TERRACES) {
    const e = Math.hypot(x - d.x, z - d.z) - wobble(d, x, z);
    if (e <= 0) return { y: d.level, walk: !inBuilding(x, z), district: d.id, onStreet: false };
    if (e < edge) { edge = e; edgeLevel = d.level; }
  }
  // Streets
  for (const s of streets()) {
    const la = s.a.level ?? groundAt(s.a.x, s.a.z), lb = s.b.level ?? groundAt(s.b.x, s.b.z);
    for (const g of s.segs) {
      const dx = g.bx - g.ax, dz = g.bz - g.az, l2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - g.ax) * dx + (z - g.az) * dz) / l2));
      const dist = Math.hypot(x - (g.ax + t * dx), z - (g.az + t * dz));
      const tt = g.t0 + (g.t1 - g.t0) * t;
      const lvl = la + (lb - la) * tt;
      const e = dist - s.halfW;
      if (e <= 0) {
        // Natural-ground street ends fade the ramp into the ground.
        let y = lvl;
        if (s.b.level == null && tt > 0.7) y = lvl + (ground() - lvl) * smooth01((tt - 0.7) / 0.3);
        if (s.a.level == null && tt < 0.3) y = lvl + (ground() - lvl) * smooth01((0.3 - tt) / 0.3);
        return { y, walk: !inBuilding(x, z), district: null, onStreet: true };
      }
      if (e < edge) { edge = e; edgeLevel = lvl; }
    }
  }
  if (edge >= BAND) return null;
  const g = ground();
  const y = edgeLevel + (g - edgeLevel) * smooth01(edge / BAND);
  const wall = Math.abs(edgeLevel - g) > WALL_DROP;
  return { y, walk: !wall && !inBuilding(x, z), district: null, onStreet: false };
}

/** Client-visual prop placements (kind names map to renderer PropKind in bake-props). */
export type ColdhearthProp = { kind: string; x: number; z: number; yaw?: number; s?: number; w?: number; h?: number; d?: number; v?: number; dy?: number };

function districtProps(): ColdhearthProp[] {
  const P: ColdhearthProp[] = [];
  const dist = (id: ColdhearthDistrictId) => COLDHEARTH_DISTRICTS.find((d) => d.id === id)!;
  // Buildings as masonry boxes (+ banners on the big ones).
  for (const b of COLDHEARTH_BUILDINGS) {
    P.push({ kind: "wallBlock", x: b.x, z: b.z, yaw: b.yaw, w: b.w, h: b.h, d: b.d, v: b.id.startsWith("hall-") || b.id === "elders-house" ? 1 : 0 });
  }
  // Eightfold: anvil-stone centre, anvils & quench troughs before each hall, racks, bellows lean-to, wheel.
  const ef = dist("eightfold");
  P.push({ kind: "anvil", x: ef.x - 1.5, z: ef.z - 1.0, yaw: 0.3, s: 1.6 });
  P.push({ kind: "stone", x: ef.x - 1.5, z: ef.z - 1.0, s: 1.6 });
  for (const b of COLDHEARTH_BUILDINGS.filter((q) => q.id.startsWith("hall-"))) {
    const a = Math.atan2(b.z - ef.z, b.x - ef.x), r = Math.hypot(b.x - ef.x, b.z - ef.z) - 2.6;
    P.push({ kind: "anvil", x: ef.x + Math.cos(a) * r, z: ef.z + Math.sin(a) * r, yaw: a });
    P.push({ kind: "trough", x: ef.x + Math.cos(a + 0.12) * r, z: ef.z + Math.sin(a + 0.12) * r, yaw: a + Math.PI / 2, w: 1.2, d: 0.5 });
    P.push({ kind: "lantern", x: ef.x + Math.cos(a - 0.16) * (r + 0.4), z: ef.z + Math.sin(a - 0.16) * (r + 0.4) });
  }
  P.push({ kind: "leanTo", x: ef.x + 3.5, z: ef.z - 4.2, yaw: 0.35 }); // bellows house
  P.push({ kind: "weaponRack", x: ef.x + 1.2, z: ef.z + 4.6, yaw: 0.35 });
  P.push({ kind: "weaponRack", x: ef.x - 0.4, z: ef.z + 5.2, yaw: 0.35 });
  P.push({ kind: "crate", x: ef.x + 0.5, z: ef.z - 4.6, w: 0.6, h: 0.45, d: 0.5 });
  P.push({ kind: "firewood", x: ef.x + 5.8, z: ef.z - 3.4 });
  P.push({ kind: "wheel", x: 234.5, z: 224.5, yaw: 0.9, s: 2.2 });
  P.push({ kind: "banner", x: ef.x + 1.0, z: ef.z + 3.4 });
  // Aqueduct piers and channel.
  const aq = COLDHEARTH_AQUEDUCT;
  for (let i = 0; i < aq.length; i++) P.push({ kind: "wallBlock", x: aq[i].x, z: aq[i].z, w: 1.4, h: 2.4, d: 1.4, v: 1 });
  for (let i = 0; i + 1 < aq.length; i++) {
    const a = aq[i], b = aq[i + 1];
    P.push({ kind: "channel", x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, yaw: Math.atan2(b.x - a.x, b.z - a.z), s: Math.hypot(b.x - a.x, b.z - a.z), w: 0.7, dy: 2.2 });
  }
  // Runnel down the town (visual water at ground level).
  const rn = COLDHEARTH_RUNNEL;
  for (let i = 0; i + 1 < rn.length; i++) {
    const a = rn[i], b = rn[i + 1];
    P.push({ kind: "channel", x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, yaw: Math.atan2(b.x - a.x, b.z - a.z), s: Math.hypot(b.x - a.x, b.z - a.z), w: 0.45, dy: 0.02 });
  }
  // Tally Row: stalls in a crescent, barrels, crates.
  const tr = dist("tally_row");
  ring(tr.x, tr.z, 6.4, 5, 2.3).forEach((p, i) => {
    P.push({ kind: "stall", x: p.x, z: p.z, yaw: -p.a + Math.PI / 2 });
    P.push({ kind: i % 2 ? "barrel" : "crate", x: p.x + Math.cos(p.a) * 1.4, z: p.z + Math.sin(p.a) * 1.4, w: 0.48, h: 0.38, d: 0.4 });
  });
  for (const [dx, dz] of [[6.5, 2.4], [7.2, 1.6], [6.0, 1.2]]) P.push({ kind: "barrel", x: tr.x + dx, z: tr.z + dz });
  P.push({ kind: "firePit", x: 205.5, z: 172.8 });
  P.push({ kind: "banner", x: tr.x - 1, z: tr.z + 3 });
  // Turning Yard: dummies, sparring ring of stones, archery butts.
  const ty = dist("turning_yard");
  for (const [dx, dz] of [[-6, 2], [-6, -1.5], [-5, -5]]) P.push({ kind: "dummy", x: ty.x + dx, z: ty.z + dz, yaw: 0.6 });
  ring(ty.x + 1, ty.z - 4.5, 3, 12, 0).forEach((p) => P.push({ kind: "pebble", x: p.x, z: p.z, s: 0.7 }));
  for (const [dx, dz] of [[4, 6.5], [6.5, 4.5], [8, 1.5]]) P.push({ kind: "butt", x: ty.x + dx, z: ty.z + dz, yaw: 2.4 });
  P.push({ kind: "weaponRack", x: ty.x - 3, z: ty.z + 6, yaw: 0.2 });
  P.push({ kind: "trainer", x: ty.x + 3.2, z: ty.z + 1.6, yaw: 0.4 });
  // Strongroom: chest at the vault door, crates, lantern.
  const sr = dist("strongroom");
  P.push({ kind: "chest", x: sr.x - 0.2, z: sr.z + 0.4, yaw: -0.6 });
  P.push({ kind: "crate", x: sr.x + 1.2, z: sr.z - 2.6, w: 0.48, h: 0.38, d: 0.4 });
  P.push({ kind: "lantern", x: sr.x + 1.4, z: sr.z + 0.2 });
  // Jobhouse: racks in sevens, banners, dummies.
  const jh = dist("jobhouse");
  for (let i = 0; i < 7; i++) P.push({ kind: "weaponRack", x: jh.x - 4.5 + i * 1.4, z: jh.z - 4.6, yaw: 0 });
  P.push({ kind: "banner", x: jh.x + 2.5, z: jh.z + 1.5 });
  P.push({ kind: "banner", x: jh.x - 3.5, z: jh.z + 1.5 });
  P.push({ kind: "dummy", x: jh.x + 4.5, z: jh.z - 1.5, yaw: 1.2 });
  // Elder's Stair: cairn lookout, lanterns, bloom beds.
  const es = dist("elders_stair");
  P.push({ kind: "cairn", x: es.x - 5, z: es.z - 2 });
  P.push({ kind: "banner", x: es.x + 1, z: es.z - 2.5 });
  for (const [dx, dz] of [[-2, -5], [4, -4], [-5, 3]]) P.push({ kind: "bloom", x: es.x + dx, z: es.z + dz });
  // Scout Gate: twin gate towers on the street mouth (east side of the camp), watch-fire.
  P.push({ kind: "wallBlock", x: 183.6, z: 194.2, w: 1.6, h: 3.6, d: 1.6, yaw: 0.1 });
  P.push({ kind: "wallBlock", x: 183.6, z: 185.6, w: 1.6, h: 3.6, d: 1.6, yaw: 0.1 });
  P.push({ kind: "lantern", x: 183.8, z: 193.0 });
  P.push({ kind: "lantern", x: 183.8, z: 186.8 });
  return P;
}

/** Lanterns along every street, alternating sides every ~7 m. */
function streetLanterns(): ColdhearthProp[] {
  const P: ColdhearthProp[] = [];
  for (const s of streets()) {
    let acc = 0, side = 1;
    for (const g of s.segs) {
      const L = Math.hypot(g.bx - g.ax, g.bz - g.az);
      acc += L;
      if (acc < 7) continue;
      acc = 0; side = -side;
      const nx = -(g.bz - g.az) / L, nz = (g.bx - g.ax) / L;
      P.push({ kind: "lantern", x: g.bx + nx * (s.halfW - 0.35) * side, z: g.bz + nz * (s.halfW - 0.35) * side });
    }
  }
  return P;
}

export function coldhearthProps(): ColdhearthProp[] {
  return [...districtProps(), ...streetLanterns()];
}

/** Building footprint test (exported for props/clearings). */
export function coldhearthInBuilding(x: number, z: number, pad = 0): boolean {
  return inBuilding(x, z, pad) != null;
}

/** True inside the town's influence (terraces, streets, wall bands). */
export function coldhearthInTown(x: number, z: number): boolean {
  return coldhearthSample(x, z, () => 0, () => 0) != null;
}
