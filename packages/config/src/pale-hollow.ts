/**
 * Pale Hollow â€” open basin with northbound segment bands.
 * Wider playable field (Reisenjima-style room to roam); soft mountains on the fringe.
 * Server + client share `paleHollowHeight`.
 */

/**
 * The basin is a region, not a valley you can see in one glance.
 * East is a spur (the camp). North-center is the Ash Pit. The river
 * runs the length of the land and forks in the south.
 */
export const PALE_HOLLOW_BOUNDS = {
  minX: -220,
  maxX: 260,
  minZ: -70,
  maxZ: 500,
} as const;

/** Scout encampment, on the eastern spur. Local camp props are authored near the origin. */
export const PH_CAMP_SHIFT_X = 168;
export const PH_CAMP_SHIFT_Z = 188;

export const PH_HUB = {
  minX: -14 + PH_CAMP_SHIFT_X,
  maxX: 14 + PH_CAMP_SHIFT_X,
  minZ: -6 + PH_CAMP_SHIFT_Z,
  maxZ: 10 + PH_CAMP_SHIFT_Z,
  floorY: 3.0,
} as const;

/**
 * Impassable footprint of the visual `HubRearRockWall` in PaleHollowMap
 * (mossy chalk cliff on the camp's north rear). The mesh runs about x -9..9,
 * z 7.4..10.5; this rect is that body with a small pad so a point-mover
 * cannot clip the boxes.
 *
 * It does not span the hub. The camp stays enterable:
 *   - south face of the camp (spawn at z 2) is open
 *   - west gap: x < minX (hub continues to -14, apron further)
 *   - east gap: x > maxX (the east trail already leaves near x 10, z 6)
 * North of the cliff (outdoor spawn at z 14) connects through those side gaps.
 */
export const PH_HUB_REAR_WALL = {
  minX: -9.4 + PH_CAMP_SHIFT_X,
  maxX: 9.4 + PH_CAMP_SHIFT_X,
  minZ: 7.15 + PH_CAMP_SHIFT_Z,
  maxZ: 10.85 + PH_CAMP_SHIFT_Z,
} as const;

export function paleHollowInHubRearWall(x: number, z: number): boolean {
  return (
    x >= PH_HUB_REAR_WALL.minX &&
    x <= PH_HUB_REAR_WALL.maxX &&
    z >= PH_HUB_REAR_WALL.minZ &&
    z <= PH_HUB_REAR_WALL.maxZ
  );
}

/**
 * Shared hub apron beyond `PH_HUB` â€” single source for height ramp, tree/prop
 * clearings, and placement. Rect SDF (not a circle) so diagonals don't seam.
 */
export const PH_HUB_APRON = {
  padX: 4,
  padZSouth: 4,
  padZNorth: 8,
  /** Soft height falloff distance outside the apron (world units). */
  softRadius: 22,
} as const;

export function paleHollowHubApronRect(): {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
} {
  return {
    minX: PH_HUB.minX - PH_HUB_APRON.padX,
    maxX: PH_HUB.maxX + PH_HUB_APRON.padX,
    minZ: PH_HUB.minZ - PH_HUB_APRON.padZSouth,
    maxZ: PH_HUB.maxZ + PH_HUB_APRON.padZNorth,
  };
}

/** Distance outside the hub apron rect (0 = inside or on edge). */
export function paleHollowHubApronDistance(x: number, z: number): number {
  const r = paleHollowHubApronRect();
  return Math.max(0, Math.max(r.minX - x, x - r.maxX, r.minZ - z, z - r.maxZ));
}

export function paleHollowInHubApron(x: number, z: number): boolean {
  return paleHollowHubApronDistance(x, z) <= 0;
}

/**
 * Party storage chest (hub) â€” interact stub only; full storage inventory later.
 * Visual prop lives in PaleHollowMap HubEncampment.
 */
export const PH_STORAGE_CHEST = {
  id: "npc-ph-storage",
  name: "Storage Chest",
  x: 3.2 + PH_CAMP_SHIFT_X,
  z: -1.5 + PH_CAMP_SHIFT_Z,
} as const;

/** Soft level bands â€” content focus, not hard walls. Stretched with the basin. */
export const PH_SEGMENT_A = { minX: -180, maxX: 220, minZ: 0, maxZ: 140 } as const;
export const PH_SEGMENT_B = { minX: -190, maxX: 230, minZ: 130, maxZ: 250 } as const;
export const PH_SEGMENT_C = { minX: -200, maxX: 240, minZ: 240, maxZ: 360 } as const;
export const PH_SEGMENT_D = { minX: -210, maxX: 250, minZ: 350, maxZ: 490 } as const;

/** Soft gates â€” wider crossings, recommend level, still crossable. */
export const PH_TIMBER_BRIDGE = {
  minX: -24,
  maxX: 20,
  minZ: 218,
  maxZ: 244,
  softLevel: 5,
  blocked: false,
} as const;

export const PH_QUARRY_CUT = {
  minX: 24,
  maxX: 72,
  minZ: 108,
  maxZ: 134,
  softLevel: 10,
  blocked: false,
} as const;

export const PH_SEAM_TUNNEL = {
  minX: -28,
  maxX: 16,
  minZ: 400,
  maxZ: 424,
  softLevel: 15,
  blocked: false,
} as const;

/** North lip of the hollow. Walking onto it enters Hollow Road. */
export const PH_ASH_ROAD = {
  id: "ash-road",
  minX: -14,
  maxX: 14,
  minZ: 468,
  maxZ: 500,
  softLevel: 18,
  blocked: false,
} as const;

/** River channel / bank-wall metrics â€” shared by water ribbon, walls, bridges, walkability. */
export const PH_RIVER_MAIN = {
  bankDist: 5.2,
  /** A thread through the basin. The lake is the wide water. */
  waterHalf: 5.0,
  bridgeHalfSpan: 6.4,
  z0: 40,
  z1: 308,
} as const;

/** Southeast fork. Splits off the main stem in the lower basin. */
export const PH_RIVER_TRIB = {
  bankDist: 4.2,
  waterHalf: 4.0,
  bridgeHalfSpan: 5.2,
  z0: 40,
  z1: 200,
} as const;

/** The Ash Pit. North-center of the basin; the river leaves its south shore. */
export const PH_LAKE = { x: -10, z: 360, r: 52 } as const;

/** Modular bank-wall body â€” keep in sync with PaleHollowRiverBanks visuals. */
export const PH_RIVER_WALL = {
  thick: 0.48,
  h: 1.05,
  lift: 0.28,
  copeH: 0.12,
  /** Extra radius so locomotion can't clip the coping. */
  collidePad: 0.35,
} as const;

/**
 * Stone deck width along flow (local X in bridge mesh).
 * Slightly wider than the rails so bank landings clear the wall annulus.
 */
export const PH_BRIDGE_DECK_W = 3.9;

/** Walk footprint pad beyond mesh half-width (forgives wall/water thresholds). */
export const PH_BRIDGE_WALK_PAD = 0.65;

/** Span extends past each bank-wall outer face onto dry grass (per side). */
export const PH_BRIDGE_SPAN_LANDING = 2.75;

/** Deck centerline clearance above the water surface at mid-span. */
export const PH_BRIDGE_DECK_CLEARANCE = 1.05;

/** Extra centerline height above wall coping where the span crosses a bank wall. */
export const PH_BRIDGE_WALL_CLEAR = 0.65;

/** Half thickness of the visual deck slab (underside = curve âˆ’ this). */
export const PH_BRIDGE_DECK_HALF_T = 0.11;

/**
 * Mid-span deck Y â€” at least water + clearance. Ends use bank stand heights.
 */
export function paleHollowComputeBridgeDeckY(bankStandAvg: number, waterY: number): number {
  return Math.max(bankStandAvg, waterY + PH_BRIDGE_DECK_CLEARANCE);
}

/**
 * Default fraction of the span taken by each bridge ramp. A bridge rises in a
 * straight ramp from each bank landing, runs flat across the river, and ramps
 * down to the other bank (a trapezoid profile). Each site's ramp ends where its
 * span crosses the bank wall (see `paleHollowBridgeGeom`), in 1/200 steps so
 * the client mesh can carry it exactly.
 */
export const PH_BRIDGE_RAMP = 0.3;

/** Lift fraction 0..1 of the trapezoid bridge profile at span parameter `t`. */
export function paleHollowBridgeProfile(t: number, ramp = PH_BRIDGE_RAMP): number {
  const u = Math.max(0, Math.min(1, t));
  return Math.min(1, u / ramp, (1 - u) / ramp);
}

/**
 * Bridge walk/deck height from left grass (t=0) to right grass (t=1): the
 * straight bank-to-bank lerp plus `arch` times the trapezoid profile, so `arch`
 * is the flat deck's height above that lerp (0 at both ends). This is the one
 * source for the server's stand height and the client's bridge mesh.
 */
export function paleHollowBridgeCurveY(
  leftY: number,
  rightY: number,
  arch: number,
  t: number,
  ramp = PH_BRIDGE_RAMP,
): number {
  const u = Math.max(0, Math.min(1, t));
  const base = leftY * (1 - u) + rightY * u;
  return base + Math.max(0, arch) * paleHollowBridgeProfile(u, ramp);
}

export type PaleHollowRiverKind = "main" | "tributary";

export type PaleHollowBridgeSite = {
  id: string;
  river: PaleHollowRiverKind;
  /** Channel sample Z â€” bankâ†’bank span is built here. */
  z: number;
};

/**
 * Spans only where the road changes banks. Clay Bank stays on the spring's
 * west side, and the marches road stays on the quarry's east rim.
 */
export const PH_BRIDGE_SITES: readonly PaleHollowBridgeSite[] = [
  // The neck road from the eastern spur crosses the main stem here.
  { id: "hub-north", river: "main", z: 230 },
  // Across the southeast fork, where the fork runs mostly north-south.
  { id: "chalkworks-corridor", river: "tributary", z: 120 },
] as const;

export function paleHollowBridgeCrossings(river: PaleHollowRiverKind): number[] {
  return PH_BRIDGE_SITES.filter((s) => s.river === river).map((s) => s.z);
}

export type PaleHollowBiome =
  | "hub_indoor"
  | "terrace"
  | "farm"
  | "river"
  | "riverbank"
  | "bridge"
  | "ashbeam"
  | "scrub"
  | "quarry"
  | "vine_cliff"
  | "ore_seam"
  | "crypt"
  | "ash_road"
  | "grass"
  | "mountain"
  | "meadow";

export type PaleHollowSegmentId = "hub" | "a" | "b" | "c" | "d";

export function paleHollowSegment(x: number, z: number): PaleHollowSegmentId {
  if (x >= PH_HUB.minX && x <= PH_HUB.maxX && z >= PH_HUB.minZ && z <= PH_HUB.maxZ) return "hub";
  if (z < 55) return "a";
  if (z < 115) return "b";
  if (z < 178) return "c";
  return "d";
}

function inRect(
  x: number,
  z: number,
  r: { minX: number; maxX: number; minZ: number; maxZ: number },
): boolean {
  return x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;
}

function smooth01(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

/** Mountain / ridge peaks for open-world silhouette (ring around the basin). */
/** Highland rim, plus a few interior ridges so the basin has depth. Kept off the lake, the river, and the camp spur. */
export const PH_MOUNTAINS: { x: number; z: number; r: number; h: number }[] = [
  { x: -150, z: 0, r: 40, h: 9.5 },
  { x: -40, z: -30, r: 36, h: 8 },
  { x: 90, z: -20, r: 38, h: 8.5 },
  { x: 200, z: 10, r: 34, h: 7.5 },
  { x: -200, z: 90, r: 42, h: 11 },
  { x: -205, z: 200, r: 40, h: 10 },
  { x: -190, z: 310, r: 38, h: 10 },
  { x: -160, z: 420, r: 36, h: 9 },
  { x: 240, z: 70, r: 36, h: 8.5 },
  { x: 245, z: 300, r: 40, h: 9.5 },
  { x: 220, z: 430, r: 36, h: 8.5 },
  { x: -90, z: 480, r: 38, h: 9 },
  { x: 30, z: 490, r: 32, h: 7.5 },
  { x: 150, z: 460, r: 34, h: 8 },
  { x: -130, z: 150, r: 30, h: 7 },
  { x: -110, z: 270, r: 28, h: 6.5 },
  { x: 70, z: 250, r: 26, h: 6 },
  { x: 100, z: 130, r: 24, h: 5.5 },
];

/**
 * The river leaves the Ash Pit and runs south. This stem is the southwest
 * branch. The southeast branch is the tributary. z increases along the list.
 */
const CHALK_RUN: readonly (readonly [number, number])[] = [
  [40, -90],
  [90, -60],
  [150, -30],
  [210, -8],
  [260, 8],
  [308, -10],
];

const CHALK_FORK: readonly (readonly [number, number])[] = [
  [40, 75],
  [90, 52],
  [150, 44],
  [185, 8],
  [200, -12],
];

function sampleRun(pts: readonly (readonly [number, number])[], z: number): number {
  const first = pts[0]!;
  if (z <= first[0]) return first[1];
  const last = pts[pts.length - 1]!;
  if (z >= last[0]) return last[1];
  let i = 1;
  while (pts[i]![0] < z) i++;
  const a = pts[i - 1]!;
  const b = pts[i]!;
  const t = (z - a[0]) / (b[0] - a[0]);
  const s = t * t * (3 - 2 * t);
  return a[1] + (b[1] - a[1]) * s;
}

function riverCenterX(z: number): number {
  return sampleRun(CHALK_RUN, z);
}

/** Southeast fork of the chalk run. */
function tributaryCenterX(z: number): number {
  return sampleRun(CHALK_FORK, z);
}

export function paleHollowLakeDist(x: number, z: number): number {
  return Math.hypot(x - PH_LAKE.x, z - PH_LAKE.z);
}

/** Shared with client water ribbon / shore foam. */
export function paleHollowRiverCenterX(z: number): number {
  return riverCenterX(z);
}

export function paleHollowTributaryCenterX(z: number): number {
  return tributaryCenterX(z);
}

/** Soft-gate / terrain biomes â€” excludes river stone-bridge footprints. */
function paleHollowBiomeCore(x: number, z: number): PaleHollowBiome {
  if (x >= PH_HUB.minX && x <= PH_HUB.maxX && z >= PH_HUB.minZ && z <= PH_HUB.maxZ) {
    return "hub_indoor";
  }
  if (inRect(x, z, PH_TIMBER_BRIDGE) || inRect(x, z, PH_QUARRY_CUT) || inRect(x, z, PH_SEAM_TUNNEL)) {
    return "bridge";
  }
  if (inRect(x, z, PH_ASH_ROAD)) return "ash_road";

  {
    const lake = paleHollowLakeDist(x, z);
    if (lake < PH_LAKE.r) return "river";
    if (lake < PH_LAKE.r + 5) return "riverbank";
  }

  for (const m of PH_MOUNTAINS) {
    if (Math.hypot(x - m.x, z - m.z) < m.r * 0.55) return "mountain";
  }

  // Southwest stem.
  {
    const dx = Math.abs(x - riverCenterX(z));
    if (z > PH_RIVER_MAIN.z0 - 2 && z < PH_RIVER_MAIN.z1 + 2 && dx < 7.2) return "river";
    if (z > PH_RIVER_MAIN.z0 - 2 && z < PH_RIVER_MAIN.z1 + 2 && dx < 16) return "riverbank";
  }
  // Southeast fork.
  {
    const dx = Math.abs(x - tributaryCenterX(z));
    if (z > PH_RIVER_TRIB.z0 - 2 && z < PH_RIVER_TRIB.z1 + 2 && dx < 5.6) return "river";
    if (z > PH_RIVER_TRIB.z0 - 2 && z < PH_RIVER_TRIB.z1 + 2 && dx < 12) return "riverbank";
  }

  // Large regions, so the land reads as country between the water and the camp.
  if (Math.hypot(x - 40, z - 90) < 48) return "quarry";
  if (Math.hypot(x + 120, z - 200) < 55 || Math.hypot(x - 40, z - 170) < 36) return "ashbeam";
  if (Math.hypot(x - 120, z - 280) < 40) return "ashbeam";
  if (z < 110 && x > -140 && x < 40) return "farm";
  if (z < 130 && x > 40 && x < 140) return "meadow";
  if (Math.hypot(x + 20, z - 430) < 22) return "crypt";
  if (Math.hypot(x - 20, z - 410) < 28) return "ore_seam";
  if (z > 400 && Math.abs(x) < 40) return "scrub";
  if (Math.abs(x) > 170 || z > 440 || z < 20) return "scrub";
  return "grass";
}

export function paleHollowBiome(x: number, z: number): PaleHollowBiome {
  if (paleHollowOnBridge(x, z)) return "bridge";
  return paleHollowBiomeCore(x, z);
}

type BridgeFrame = {
  id: string;
  river: PaleHollowRiverKind;
  z: number;
  cx: number;
  cz: number;
  sx: number;
  sz: number;
  fx: number;
  fz: number;
  spanHalf: number;
  deckHalfW: number;
  leftY: number;
  rightY: number;
  waterY: number;
  /** Extra mid-span height above the leftâ†’right lerp. */
  arch: number;
  /** Ramp fraction of the span at each end (trapezoid profile). */
  ramp: number;
  /** Mid curve sample â€” not the stand height along the span. */
  deckY: number;
};

function riverParams(river: PaleHollowRiverKind) {
  return river === "main" ? PH_RIVER_MAIN : PH_RIVER_TRIB;
}

function riverCenterFn(river: PaleHollowRiverKind): (z: number) => number {
  return river === "main" ? riverCenterX : tributaryCenterX;
}

/** Bank midline sample â€” same geometry as PaleHollowRiverBanks.bankPoint. */
export function paleHollowBankPoint(
  river: PaleHollowRiverKind,
  z: number,
  side: 1 | -1,
): { x: number; z: number } {
  const centerX = riverCenterFn(river);
  const bankDist = riverParams(river).bankDist;
  const eps = 0.85;
  const c0 = centerX(z - eps);
  const c1 = centerX(z + eps);
  const tx = c1 - c0;
  const tz = eps * 2;
  const tLen = Math.hypot(tx, tz) || 1;
  const px = -tz / tLen;
  const pz = tx / tLen;
  return {
    x: centerX(z) + side * bankDist * px,
    z: z + side * bankDist * pz,
  };
}

/** Shared bridge layout â€” visuals and walk/stand must agree. */
export type PaleHollowBridgeGeom = {
  id: string;
  river: PaleHollowRiverKind;
  z: number;
  x: number;
  zWorld: number;
  span: number;
  spanHalf: number;
  deckHalfW: number;
  /** Mid-span curve height (arch / legacy). Stand height varies â€” see `paleHollowBridgeCurveY`. */
  deckY: number;
  /** Left grass stand height (t=0). */
  leftY: number;
  /** Right grass stand height (t=1). */
  rightY: number;
  /** Flat-deck height above the straight bank-to-bank lerp. */
  arch: number;
  /** Ramp fraction of the span at each end (trapezoid profile). */
  ramp: number;
  waterY: number;
  spanDir: { x: number; z: number };
  flowDir: { x: number; z: number };
  postL: { x: number; z: number; y: number };
  postR: { x: number; z: number; y: number };
};

function isBridgeLandingDry(x: number, z: number): boolean {
  if (paleHollowWaterSurfaceY(x, z) != null) return false;
  if (paleHollowBiomeCore(x, z) === "river") return false;
  return true;
}

/**
 * Walk outward from a bank wall midline onto dry grass well outside the wall.
 * The deck ends here so the arch can rise before it crosses the coping.
 */
function findBankLanding(
  river: PaleHollowRiverKind,
  z: number,
  side: 1 | -1,
  ux: number,
  uz: number,
): { x: number; z: number; y: number } {
  const wall = paleHollowBankPoint(river, z, side);
  const wallY = paleHollowHeightField(wall.x, wall.z);
  /** Past the wall midline onto the grass apron. */
  const minOut = 2.5;
  let best = {
    x: wall.x + ux * minOut,
    z: wall.z + uz * minOut,
    y: paleHollowHeightField(wall.x + ux * minOut, wall.z + uz * minOut),
  };

  for (let t = minOut; t <= 9; t += 0.25) {
    const x = wall.x + ux * t;
    const z = wall.z + uz * t;
    if (!isBridgeLandingDry(x, z)) continue;
    if (paleHollowRiverWallBand(x, z)) continue;
    const y = paleHollowHeightField(x, z);
    if (y < wallY - 0.55) continue;
    best = { x, z, y };
    const bio = paleHollowBiomeCore(x, z);
    if (bio === "farm" || bio === "meadow" || bio === "grass" || bio === "ashbeam") break;
  }
  return best;
}

/** Coping top at a bank-wall midline. */
function riverWallTopY(x: number, z: number): number {
  return paleHollowHeightField(x, z) + PH_RIVER_WALL.lift + PH_RIVER_WALL.h + PH_RIVER_WALL.copeH;
}

/**
 * Arch lift so the deck center clears water at mid-span and coping at each wall crossing.
 * Shape is `lerp + arch * profile(t)` (trapezoid, 0 at the grass ends).
 */
function bridgeArchLift(
  leftY: number,
  rightY: number,
  checks: { t: number; minY: number }[],
  ramp: number,
): number {
  let arch = 1.05;
  for (const c of checks) {
    const u = Math.max(0.06, Math.min(0.94, c.t));
    const bump = paleHollowBridgeProfile(u, ramp);
    const base = leftY * (1 - u) + rightY * u;
    const need = (c.minY - base) / bump;
    if (need > arch) arch = need;
  }
  return arch;
}

/**
 * Authoritative bridge geometry for a site (deck Y, footprint, bankâ†’bank axes).
 * RiverBanks meshes and walk frames both derive from this.
 */
export function paleHollowBridgeGeom(site: PaleHollowBridgeSite): PaleHollowBridgeGeom {
  const params = riverParams(site.river);
  const centerX = riverCenterFn(site.river);
  const left = paleHollowBankPoint(site.river, site.z, -1);
  const right = paleHollowBankPoint(site.river, site.z, 1);
  let sx = right.x - left.x;
  let sz = right.z - left.z;
  const bankSep = Math.hypot(sx, sz) || 1;
  sx /= bankSep;
  sz /= bankSep;

  const eps = 1.2;
  const tx = centerX(site.z + eps) - centerX(site.z - eps);
  const tz = eps * 2;

  // Outward from channel through each bank (along span axis)
  let landL = findBankLanding(site.river, site.z, -1, -sx, -sz);
  let landR = findBankLanding(site.river, site.z, 1, sx, sz);

  // Ends ARE the landings â€” never overshoot past dry grass into wall/channel
  let lsx = landR.x - landL.x;
  let lsz = landR.z - landL.z;
  let span = Math.hypot(lsx, lsz) || bankSep;
  lsx /= span;
  lsz /= span;

  const minSpan = Math.max(
    params.bridgeHalfSpan * 2,
    bankSep + 2 * (PH_RIVER_WALL.thick * 0.5 + PH_BRIDGE_SPAN_LANDING),
  );
  // Only widen toward minSpan if the extended ends stay dry / elevated
  if (span < minSpan - 0.05) {
    const midX = (landL.x + landR.x) * 0.5;
    const midZ = (landL.z + landR.z) * 0.5;
    const half = minSpan * 0.5;
    const candL = { x: midX - lsx * half, z: midZ - lsz * half };
    const candR = { x: midX + lsx * half, z: midZ + lsz * half };
    const yL = paleHollowHeightField(candL.x, candL.z);
    const yR = paleHollowHeightField(candR.x, candR.z);
    const okL =
      isBridgeLandingDry(candL.x, candL.z) &&
      !paleHollowRiverWallBand(candL.x, candL.z) &&
      yL >= landL.y - 0.55;
    const okR =
      isBridgeLandingDry(candR.x, candR.z) &&
      !paleHollowRiverWallBand(candR.x, candR.z) &&
      yR >= landR.y - 0.55;
    if (okL && okR) {
      landL = { ...candL, y: yL };
      landR = { ...candR, y: yR };
      span = minSpan;
    }
  }

  const spanHalf = span * 0.5;
  const deckHalfW = PH_BRIDGE_DECK_W * 0.5 + PH_BRIDGE_WALK_PAD;
  const cx = (landL.x + landR.x) * 0.5;
  const cz = (landL.z + landR.z) * 0.5;
  const lx = landL.x;
  const lz = landL.z;
  const rx = landR.x;
  const rz = landR.z;

  // Along-flow from span axis, matched to channel tangent
  let nfx = -lsz;
  let nfz = lsx;
  if (nfx * tx + nfz * tz < 0) {
    nfx = -nfx;
    nfz = -nfz;
  }
  const nfLen = Math.hypot(nfx, nfz) || 1;
  nfx /= nfLen;
  nfz /= nfLen;

  const waterY =
    paleHollowWaterSurfaceY(cx, cz) ?? paleHollowHeightField(cx, cz) + PALE_HOLLOW_WATER_CLEARANCE;
  // Deck ends meet the walkable ground mesh exactly, so stepping on or off never snaps.
  const standL = paleHollowTerrainMeshY(landL.x, landL.z);
  const standR = paleHollowTerrainMeshY(landR.x, landR.z);
  const tOf = (x: number, z: number) => {
    const along = (x - cx) * lsx + (z - cz) * lsz;
    return span > 1e-4 ? along / span + 0.5 : 0.5;
  };
  const undersidePad = PH_BRIDGE_DECK_HALF_T + PH_BRIDGE_WALL_CLEAR;
  const checks: { t: number; minY: number }[] = [
    { t: 0.5, minY: waterY + PH_BRIDGE_DECK_CLEARANCE },
  ];
  const tL = tOf(left.x, left.z);
  const tR = tOf(right.x, right.z);
  if (tL > 0.04 && tL < 0.96) {
    checks.push({ t: tL, minY: riverWallTopY(left.x, left.z) + undersidePad });
  }
  if (tR > 0.04 && tR < 0.96) {
    checks.push({ t: tR, minY: riverWallTopY(right.x, right.z) + undersidePad });
  }
  // Ramps end where the span crosses each bank wall, so the flat deck carries
  // the walk over the coping and the river (1/200 steps: exact on the client).
  const wallT = Math.min(tL > 0.04 && tL < 0.96 ? tL : 0.5, tR > 0.04 && tR < 0.96 ? 1 - tR : 0.5);
  const ramp = Math.round(Math.max(0.12, Math.min(0.45, wallT)) * 200) / 200;
  const arch = bridgeArchLift(standL, standR, checks, ramp);
  const deckY = paleHollowBridgeCurveY(standL, standR, arch, 0.5, ramp);

  return {
    id: site.id,
    river: site.river,
    z: site.z,
    x: cx,
    zWorld: cz,
    span,
    spanHalf,
    deckHalfW,
    deckY,
    leftY: standL,
    rightY: standR,
    arch,
    ramp,
    waterY,
    spanDir: { x: lsx, z: lsz },
    flowDir: { x: nfx, z: nfz },
    postL: { x: lx, z: lz, y: standL },
    postR: { x: rx, z: rz, y: standR },
  };
}

export const PH_TRAIL_WIDTH = 3.3;
export const PH_TRAIL_STONE_WIDTH = 3.45;

export type PaleHollowTrail = {
  id: string;
  surface: "dirt" | "stone";
  bridgeId?: string;
  points: { x: number; z: number }[];
};

function trailBridge(id: string): PaleHollowBridgeGeom {
  const site = PH_BRIDGE_SITES.find((s) => s.id === id);
  if (!site) throw new Error(`missing bridge ${id}`);
  return paleHollowBridgeGeom(site);
}

/** Point on the grass just outside a landing, away from the channel. */
function trailApproach(post: { x: number; z: number }, center: { x: number; z: number }, dist = 3.6) {
  let dx = post.x - center.x;
  let dz = post.z - center.z;
  const len = Math.hypot(dx, dz) || 1;
  dx /= len;
  dz /= len;
  const clear = (ux: number, uz: number) => {
    for (let t = 0.7; t <= dist; t += 0.35) {
      if (!paleHollowWalkable(post.x + ux * t, post.z + uz * t)) return false;
    }
    return true;
  };
  const angles = [0, 28, -28, 55, -55, 85, -85, 120, -120, 160, 180];
  for (const deg of angles) {
    const a = (deg * Math.PI) / 180;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const ux = dx * c - dz * s;
    const uz = dx * s + dz * c;
    if (clear(ux, uz)) return { x: post.x + ux * dist, z: post.z + uz * dist };
  }
  return { x: post.x + dx * 1.2, z: post.z + dz * 1.2 };
}

/** Stay on the same bank as `anchorX` while walking toward a goal. */
function dryTrail(points: { x: number; z: number }[]): { x: number; z: number }[] {
  const bankOf = (x: number, z: number, anchorX: number) => {
    const main = riverCenterX(z);
    const trib = tributaryCenterX(z);
    const useTrib = z > 54 && z < 150 && Math.abs(anchorX - trib) < Math.abs(anchorX - main);
    const rx = useTrib ? trib : main;
    const sign = anchorX >= rx ? 1 : -1;
    const edge = rx + sign * 8;
    let nx = x;
    if (sign > 0 && nx < edge) nx = edge;
    if (sign < 0 && nx > edge) nx = edge;
    if (!paleHollowWalkable(nx, z)) {
      for (let k = 1; k <= 10; k++) {
        const tryX = nx + sign * k * 1.2;
        if (paleHollowWalkable(tryX, z)) return { x: tryX, z };
      }
    }
    return paleHollowWalkable(nx, z) ? { x: nx, z } : null;
  };

  const chordOk = (a: { x: number; z: number }, b: { x: number; z: number }) => {
    const dist = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.max(2, Math.ceil(dist / 0.45));
    for (let s = 1; s < n; s++) {
      const u = s / n;
      if (!paleHollowWalkable(a.x + (b.x - a.x) * u, a.z + (b.z - a.z) * u)) return false;
    }
    return true;
  };

  const out: { x: number; z: number }[] = [];
  const push = (p: { x: number; z: number }) => {
    const last = out[out.length - 1];
    if (!last) {
      out.push(p);
      return;
    }
    if (Math.hypot(last.x - p.x, last.z - p.z) < 0.9) return;
    if (!chordOk(last, p)) return;
    out.push(p);
  };

  let cursor = points[0]!;
  if (!paleHollowWalkable(cursor.x, cursor.z)) {
    const fixed = bankOf(cursor.x, cursor.z, cursor.x);
    if (fixed) cursor = fixed;
  }
  push(cursor);

  const stepTo = (from: { x: number; z: number }, x: number, z: number) => {
    const hit = bankOf(x, z, from.x);
    if (hit && chordOk(from, hit)) return hit;
    return null;
  };

  for (let i = 1; i < points.length; i++) {
    const goal = points[i]!;
    for (let guard = 0; guard < 80; guard++) {
      const dx = goal.x - cursor.x;
      const dz = goal.z - cursor.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 1.6 && paleHollowWalkable(goal.x, goal.z) && chordOk(cursor, goal)) {
        push(goal);
        cursor = goal;
        break;
      }
      const step = Math.min(1.25, dist);
      const ux = dx / (dist || 1);
      const uz = dz / (dist || 1);
      const ahead = stepTo(cursor, cursor.x + ux * step, cursor.z + uz * step);
      if (ahead) {
        push(ahead);
        cursor = ahead;
        continue;
      }
      const zStep = stepTo(cursor, cursor.x, cursor.z + Math.sign(dz || 1) * 1.1);
      if (zStep) {
        push(zStep);
        cursor = zStep;
        continue;
      }
      const main = riverCenterX(cursor.z);
      const sign = cursor.x >= main ? 1 : -1;
      const side = stepTo(cursor, cursor.x + sign * 1.3, cursor.z + Math.sign(dz || 1) * 0.6);
      if (side) {
        push(side);
        cursor = side;
        continue;
      }
      break;
    }
  }
  return out.length >= 2 ? out : points;
}

function stoneApproach(id: string, end: "L" | "R", g: PaleHollowBridgeGeom): PaleHollowTrail {
  const post = end === "L" ? g.postL : g.postR;
  let outer = trailApproach(post, { x: g.x, z: g.zWorld });
  for (let k = 0; k < 8; k++) {
    let ok = true;
    for (let s = 1; s < 14; s++) {
      const u = s / 14;
      const x = outer.x + (post.x - outer.x) * u;
      const z = outer.z + (post.z - outer.z) * u;
      if (!paleHollowWalkable(x, z)) {
        ok = false;
        break;
      }
    }
    if (ok) break;
    outer = {
      x: outer.x + (post.x - outer.x) * 0.22,
      z: outer.z + (post.z - outer.z) * 0.22,
    };
  }
  return {
    id: `${id}-stone-${end}`,
    surface: "stone",
    bridgeId: id,
    points: [outer, { x: post.x, z: post.z }],
  };
}

/**
 * Packed-dirt corridors from the scout encampment onto each bridge landing,
 * then onward along the north and east corridors. Stone stubs meet the decks.
 */
export function paleHollowTrails(): PaleHollowTrail[] {
  const north = trailBridge("hub-north");
  const chalk = trailBridge("chalkworks-corridor");

  const near = (g: PaleHollowBridgeGeom, end: "L" | "R") =>
    trailApproach(end === "L" ? g.postL : g.postR, { x: g.x, z: g.zWorld });

  // postL is the +x bank; postR is the -x bank.
  const raw: PaleHollowTrail[] = [
    {
      id: "camp-to-north",
      surface: "dirt",
      points: [
        { x: PH_HUB.maxX - 2, z: 2 + PH_CAMP_SHIFT_Z },
        { x: 110, z: 200 },
        { x: 50, z: 220 },
        near(north, "L"),
      ],
    },
    {
      id: "north-to-ashbeam",
      surface: "dirt",
      points: [
        near(north, "R"),
        { x: -40, z: 270 },
        { x: -55, z: 320 },
      ],
    },
    {
      id: "camp-to-west-farm",
      surface: "dirt",
      points: [
        near(north, "R"),
        { x: -55, z: 170 },
        { x: -95, z: 100 },
        { x: -125, z: 55 },
      ],
    },
    {
      id: "ashbeam-to-chalkworks",
      surface: "dirt",
      points: [
        { x: 70, z: 180 },
        { x: 55, z: 150 },
        near(chalk, "R"),
      ],
    },
    {
      id: "east-grove",
      surface: "dirt",
      points: [
        near(chalk, "L"),
        { x: 90, z: 100 },
        { x: 130, z: 80 },
      ],
    },
    {
      id: "chalkworks-to-marches",
      surface: "dirt",
      points: [
        { x: -70, z: 330 },
        { x: -30, z: 390 },
        { x: -8, z: 410 },
      ],
    },
    {
      id: "marches-to-ash-road",
      surface: "dirt",
      points: [
        { x: -8, z: 424 },
        { x: 0, z: 450 },
        { x: 0, z: 468 },
        { x: 0, z: 492 },
      ],
    },
    stoneApproach("hub-north", "L", north),
    stoneApproach("hub-north", "R", north),
    stoneApproach("chalkworks-corridor", "L", chalk),
    stoneApproach("chalkworks-corridor", "R", chalk),
  ];
  return raw.map((t) => (t.surface === "dirt" ? { ...t, points: dryTrail(t.points) } : t));
}

function buildBridgeFrame(site: PaleHollowBridgeSite): BridgeFrame {
  const g = paleHollowBridgeGeom(site);
  return {
    id: g.id,
    river: g.river,
    z: g.z,
    cx: g.x,
    cz: g.zWorld,
    sx: g.spanDir.x,
    sz: g.spanDir.z,
    fx: g.flowDir.x,
    fz: g.flowDir.z,
    spanHalf: g.spanHalf,
    deckHalfW: g.deckHalfW,
    leftY: g.leftY,
    rightY: g.rightY,
    waterY: g.waterY,
    arch: g.arch,
    ramp: g.ramp,
    deckY: g.deckY,
  };
}

let bridgeFrameCache: BridgeFrame[] | null = null;
let bridgeFramesBuilding = false;

function bridgeFrames(): BridgeFrame[] {
  if (bridgeFrameCache) return bridgeFrameCache;
  if (bridgeFramesBuilding) return [];
  bridgeFramesBuilding = true;
  try {
    bridgeFrameCache = PH_BRIDGE_SITES.map(buildBridgeFrame);
  } finally {
    bridgeFramesBuilding = false;
  }
  return bridgeFrameCache;
}

function bridgeLocal(f: BridgeFrame, x: number, z: number): { along: number; across: number } {
  const dx = x - f.cx;
  const dz = z - f.cz;
  return {
    along: dx * f.sx + dz * f.sz,
    across: dx * f.fx + dz * f.fz,
  };
}

/** True when standing on a stone bridge deck (bankâ†’bank footprint). */
export function paleHollowOnBridge(x: number, z: number): boolean {
  for (const f of bridgeFrames()) {
    const { along, across } = bridgeLocal(f, x, z);
    if (Math.abs(along) <= f.spanHalf && Math.abs(across) <= f.deckHalfW) return true;
  }
  return false;
}

/**
 * Expanded bridge footprint for carving water ribbon gaps (slightly larger than walk).
 * Prefer punching water under decks so the mesh never draws through the crossing.
 */
export function paleHollowInBridgeWaterGap(
  x: number,
  z: number,
  river?: PaleHollowRiverKind,
): boolean {
  const padAlong = 0.5;
  const padAcross = 0.6;
  for (const f of bridgeFrames()) {
    if (river && f.river !== river) continue;
    const { along, across } = bridgeLocal(f, x, z);
    if (Math.abs(along) <= f.spanHalf + padAlong && Math.abs(across) <= f.deckHalfW + padAcross) {
      return true;
    }
  }
  return false;
}

/**
 * Wall mesh opens only where the deck underside still cuts the coping.
 * A span that clears the wall keeps the wall continuous.
 */
export function paleHollowInBridgeWallVisualGap(
  x: number,
  z: number,
  river?: PaleHollowRiverKind,
): boolean {
  const halfAcross = PH_BRIDGE_DECK_W * 0.5 + 0.08;
  for (const f of bridgeFrames()) {
    if (river && f.river !== river) continue;
    const { along, across } = bridgeLocal(f, x, z);
    if (Math.abs(across) > halfAcross || Math.abs(along) > f.spanHalf) continue;
    const t = f.spanHalf > 1e-4 ? (along / f.spanHalf + 1) * 0.5 : 0.5;
    const underside =
      paleHollowBridgeCurveY(f.leftY, f.rightY, f.arch, t, f.ramp) - PH_BRIDGE_DECK_HALF_T;
    const coping =
      paleHollowHeightField(x, z) + PH_RIVER_WALL.lift + PH_RIVER_WALL.h + PH_RIVER_WALL.copeH;
    if (underside < coping + 0.08) return true;
  }
  return false;
}

/** Deck world Y if on a bridge, else null. Varies along the span (bank â†’ arch â†’ bank). */
export function paleHollowBridgeDeckY(x: number, z: number): number | null {
  for (const f of bridgeFrames()) {
    const { along, across } = bridgeLocal(f, x, z);
    if (Math.abs(along) <= f.spanHalf && Math.abs(across) <= f.deckHalfW) {
      const t = f.spanHalf > 1e-4 ? (along / f.spanHalf + 1) * 0.5 : 0.5;
      return paleHollowBridgeCurveY(f.leftY, f.rightY, f.arch, t, f.ramp);
    }
  }
  return null;
}

/**
 * Wall annulus around a channel, ignoring bridge decks.
 * Landings use this so a span cannot stop inside the coping.
 */
function paleHollowRiverWallBand(x: number, z: number): boolean {
  const solid = PH_RIVER_WALL.thick * 0.5 + PH_RIVER_WALL.collidePad;
  const hit = (river: PaleHollowRiverKind, z0: number, z1: number) => {
    if (z < z0 - 2 || z > z1 + 2) return false;
    const centerX = riverCenterFn(river);
    const bankDist = riverParams(river).bankDist;
    const eps = 0.85;
    const cx = centerX(z);
    const tx = centerX(z + eps) - centerX(z - eps);
    const tz = eps * 2;
    const tLen = Math.hypot(tx, tz) || 1;
    const fx = tx / tLen;
    const fz = tz / tLen;
    const rx = x - cx;
    const along = rx * fx;
    const qx = cx + along * fx;
    const qz = z + along * fz;
    const dist = Math.hypot(x - qx, z - qz);
    return Math.abs(dist - bankDist) <= solid;
  };
  if (hit("main", PH_RIVER_MAIN.z0, PH_RIVER_MAIN.z1)) return true;
  if (hit("tributary", PH_RIVER_TRIB.z0, PH_RIVER_TRIB.z1)) return true;
  if (culdesacWall(riverCenterX, PH_RIVER_MAIN.z0, PH_RIVER_MAIN.bankDist, -1, x, z)) return true;
  if (culdesacWall(riverCenterX, PH_RIVER_MAIN.z1, PH_RIVER_MAIN.bankDist, 1, x, z)) return true;
  if (culdesacWall(tributaryCenterX, PH_RIVER_TRIB.z0, PH_RIVER_TRIB.bankDist, -1, x, z)) return true;
  if (culdesacWall(tributaryCenterX, PH_RIVER_TRIB.z1, PH_RIVER_TRIB.bankDist, 1, x, z)) return true;
  return false;
}

/** Rounded end wall: semicircle of radius `bankDist` bulging out of the channel. */
function culdesacWall(
  centerX: (z: number) => number,
  zEnd: number,
  bankDist: number,
  outward: 1 | -1,
  x: number,
  z: number,
): boolean {
  const solid = PH_RIVER_WALL.thick * 0.5 + PH_RIVER_WALL.collidePad;
  const eps = 0.85;
  const tx = centerX(zEnd + eps) - centerX(zEnd - eps);
  const tz = eps * 2;
  const tLen = Math.hypot(tx, tz) || 1;
  const fx = (tx / tLen) * outward;
  const fz = (tz / tLen) * outward;
  const cx = centerX(zEnd);
  const dx = x - cx;
  const dz = z - zEnd;
  const out = dx * fx + dz * fz;
  if (out < -0.4) return false;
  const radial = Math.hypot(dx, dz);
  return Math.abs(radial - bankDist) <= solid;
}

/**
 * True when overlapping a modular river bank wall (not on a bridge deck).
 * Walls sit at `bankDist` from the local channel centerline at this Z.
 */
export function paleHollowInRiverWall(x: number, z: number): boolean {
  if (paleHollowOnBridge(x, z)) return false;
  return paleHollowRiverWallBand(x, z);
}

/**
 * Clear walkable check: dry land OR on-bridge; reject open water and river walls.
 * Soft-gate landmark "bridge" biomes are dry land and remain walkable.
 */
export function paleHollowWalkable(x: number, z: number): boolean {
  if (paleHollowInHubRearWall(x, z)) return false;
  if (paleHollowOnBridge(x, z)) return true;
  if (paleHollowInOpenWater(x, z)) return false;
  if (paleHollowInRiverWall(x, z)) return false;
  if (paleHollowBiomeCore(x, z) === "river") return false;
  return true;
}

/**
 * Clamp a desired move so the path cannot enter water or river walls.
 * Stops at the last walkable sample along the segment (bridges remain passable).
 */
export function paleHollowClampMove(
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
): { x: number; z: number } {
  const end = clampPaleHollow(toX, toZ);
  const fromWalk = paleHollowWalkable(fromX, fromZ);
  if (!fromWalk && paleHollowWalkable(end.x, end.z)) {
    return end;
  }
  const dist = Math.hypot(end.x - fromX, end.z - fromZ);
  if (dist < 1e-4) return { x: fromX, z: fromZ };
  const steps = Math.max(1, Math.ceil(dist / 0.3));
  let last = { x: fromX, z: fromZ };
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const c = clampPaleHollow(fromX + (end.x - fromX) * t, fromZ + (end.z - fromZ) * t);
    if (!paleHollowWalkable(c.x, c.z)) return last;
    last = c;
  }
  return last;
}

/**
 * Open height field â€” continuous soft hills; no hard canyon clamps.
 * (Hard Math.min river floors caused the canal cliffs in-game.)
 * Does not apply stone-bridge deck elevation (see `paleHollowHeight`).
 */
function paleHollowHeightField(x: number, z: number): number {
  const biome = paleHollowBiomeCore(x, z);
  if (biome === "hub_indoor") return PH_HUB.floorY;

  // Long, gentle ramp off the dwellings into the basin (both Z and shared apron SDF)
  const fromHubZ = smooth01((z - PH_HUB.maxZ + 2) / 40);
  const fromHubPad = smooth01(paleHollowHubApronDistance(x, z) / PH_HUB_APRON.softRadius);
  const leaveHub = Math.max(fromHubZ, fromHubPad);
  let y = PH_HUB.floorY * (1 - leaveHub) + 1.05 * leaveHub;

  // Multi-octave rolling basin â€” readable hills without stair walls
  y += Math.sin(x * 0.026) * 0.62 + Math.cos(z * 0.021) * 0.48;
  y += Math.sin(x * 0.062 + z * 0.048) * 0.28;
  y += Math.sin(x * 0.14 - z * 0.11) * 0.1;
  y += Math.sin(x * 0.31 + z * 0.27) * 0.035;

  // Channel distances before hills, so a lobe cannot lift the bed the water sits on.
  // `|x - centerX(z)|` misses the north meander (flow runs east-west around z 224â€“236).
  const mainNear = nearestOnCenterline(riverCenterX, PH_RIVER_MAIN.z0, PH_RIVER_MAIN.z1, x, z);
  const tribNear = nearestOnCenterline(tributaryCenterX, PH_RIVER_TRIB.z0, PH_RIVER_TRIB.z1, x, z);
  const lakeDist = paleHollowLakeDist(x, z);
  const mountainKeep = (dist: number, bankDist: number) => {
    const inner = bankDist + 0.6;
    const outer = inner + 8;
    if (dist <= inner) return 0;
    if (dist >= outer) return 1;
    return smooth01((dist - inner) / (outer - inner));
  };
  let mountainScale = 1;
  if (mainNear) mountainScale = Math.min(mountainScale, mountainKeep(mainNear.dist, PH_RIVER_MAIN.bankDist));
  if (tribNear) mountainScale = Math.min(mountainScale, mountainKeep(tribNear.dist, PH_RIVER_TRIB.bankDist));
  if (lakeDist < PH_LAKE.r + 8) mountainScale = Math.min(mountainScale, mountainKeep(lakeDist, PH_LAKE.r));

  // Soft mountain lobes â€” faded inside the channel so water does not ride the hillside.
  if (mountainScale > 0) {
    for (const m of PH_MOUNTAINS) {
      const d = Math.hypot(x - m.x, z - m.z);
      const R = m.r * 1.2;
      if (d < R) {
        const t = 1 - d / R;
        y += smooth01(t) * smooth01(t) * m.h * 0.82 * mountainScale;
      }
    }
  }

  // Gentle world rim
  const rim = Math.min(
    x - PALE_HOLLOW_BOUNDS.minX,
    PALE_HOLLOW_BOUNDS.maxX - x,
    z - PALE_HOLLOW_BOUNDS.minZ,
    PALE_HOLLOW_BOUNDS.maxZ - z,
  );
  if (rim < 18) {
    y += (1 - smooth01(rim / 18)) ** 2 * 2.2;
  }

  // Smooth channel trough (not a hard floor). Deepest on the centerline, gone
  // before the wall footing, so arches have a bed under them and banks stay grass.
  const channelTrough = (rd: number, bankDist: number, depth: number) => {
    const lip = bankDist * 0.9;
    if (rd >= lip) return 0;
    const s = smooth01(1 - rd / lip);
    return s * s * depth;
  };
  if (lakeDist < PH_LAKE.r) y -= channelTrough(lakeDist, PH_LAKE.r, 1.6);
  if (mainNear) {
    y -= channelTrough(mainNear.dist, PH_RIVER_MAIN.bankDist, 1.35);
    const bank = 1 - Math.min(1, mainNear.dist / 14);
    y -= smooth01(bank) * 0.1;
  }
  if (tribNear) {
    y -= channelTrough(tribNear.dist, PH_RIVER_TRIB.bankDist, 1.15);
    const bank = 1 - Math.min(1, tribNear.dist / 9.5);
    y -= smooth01(bank) * 0.08;
  }

  // Micro-detail â€” continuous weights only (hard biome branches made thin border creases)
  {
    const tw = paleHollowTerrainWeights(x, z);
    y +=
      Math.sin(x * 0.18) * 0.055 +
      Math.cos(z * 0.14) * 0.04 +
      Math.sin(x * 0.31 + z * 0.22) * 0.02;
    y += (Math.sin(x * 0.22) * 0.04 + Math.cos(z * 0.18) * 0.03) * Math.max(tw.farm, tw.meadow);
    y += Math.sin(x * 0.2) * 0.06 * tw.scrub;
    y += Math.sin(x * 0.18 + z * 0.1) * 0.12 * tw.ore;
    y -= tw.quarry * tw.quarry * 1.6;
    const oreBump = Math.hypot(x - 14, z - 200);
    if (oreBump < 14) y += smooth01(1 - oreBump / 14) * 0.85 * tw.ore;
  }

  if (biome === "bridge") {
    if (z >= PH_QUARRY_CUT.minZ && z <= PH_QUARRY_CUT.maxZ) y += 0.55;
    else if (z >= PH_SEAM_TUNNEL.minZ && z <= PH_SEAM_TUNNEL.maxZ) y += 0.35;
    else y += 0.4;
  } else if (biome === "vine_cliff") {
    y += 0.85 + Math.sin(z * 0.15) * 0.2;
  } else if (biome === "crypt") {
    y -= 0.55 + Math.sin(x * 0.35) * 0.04;
  } else if (biome === "ash_road") {
    y = Math.max(y, 0.85);
  }

  // Copper outcrop â€” soft bump
  {
    const d = Math.hypot(x - 18, z - 26);
    if (d < 7) y += smooth01(1 - d / 7) ** 1.5 * 0.7;
  }

  return y;
}

/** Terrain and bank footings. Never the stone deck â€” the deck is a span over this bed. */
export function paleHollowGroundHeight(x: number, z: number): number {
  return paleHollowHeightField(x, z);
}

/** Stand height â€” stone bridge decks sit at bank wall-tops; elsewhere the terrain field. */
export function paleHollowHeight(x: number, z: number): number {
  const deck = paleHollowBridgeDeckY(x, z);
  if (deck != null) return deck;
  return paleHollowHeightField(x, z);
}

/**
 * Terrain PlaneGeometry segments in PaleHollowMap (`widthSegments`, `heightSegments`).
 * `paleHollowStandHeight` barycentric-samples this same grid.
 */
export const PALE_HOLLOW_TERRAIN_SEG_X = 72;
export const PALE_HOLLOW_TERRAIN_SEG_Z = Math.floor(PALE_HOLLOW_TERRAIN_SEG_X * 1.35);

/**
 * Height of the rendered terrain triangle at (x, z).
 * The mesh is piecewise-linear; `paleHollowHeight` bows above those chords on hills.
 */
export function paleHollowTerrainMeshY(x: number, z: number): number {
  const { minX, maxX, minZ, maxZ } = PALE_HOLLOW_BOUNDS;
  const segX = PALE_HOLLOW_TERRAIN_SEG_X;
  const segZ = PALE_HOLLOW_TERRAIN_SEG_Z;
  const dx = (maxX - minX) / segX;
  const dz = (maxZ - minZ) / segZ;
  const u = Math.max(0, Math.min(segX - 1e-6, (x - minX) / dx));
  const v = Math.max(0, Math.min(segZ - 1e-6, (z - minZ) / dz));
  const i = Math.floor(u);
  const j = Math.floor(v);
  const fu = u - i;
  const fv = v - j;
  const x0 = minX + i * dx;
  const z0 = minZ + j * dz;
  const h00 = paleHollowGroundHeight(x0, z0);
  const h10 = paleHollowGroundHeight(x0 + dx, z0);
  const h01 = paleHollowGroundHeight(x0, z0 + dz);
  const h11 = paleHollowGroundHeight(x0 + dx, z0 + dz);
  // PlaneGeometry triangles: (ix,iy)-(ix,iy+1)-(ix+1,iy) and the opposite corner.
  if (fu + fv <= 1) {
    return h00 * (1 - fu - fv) + h10 * fu + h01 * fv;
  }
  return h11 * (fu + fv - 1) + h10 * (1 - fv) + h01 * (1 - fu);
}

/**
 * Feet height. On a stone deck, the flat bridge Y (not the riverbed triangles).
 * Elsewhere the visible terrain mesh, so slopes and hills don't leave a gap under the sprite.
 */
export function paleHollowStandHeight(x: number, z: number): number {
  const deck = paleHollowBridgeDeckY(x, z);
  if (deck != null) return deck;
  return paleHollowTerrainMeshY(x, z);
}

export function clampPaleHollow(x: number, z: number): { x: number; z: number } {
  let cx = Math.max(PALE_HOLLOW_BOUNDS.minX + 1, Math.min(PALE_HOLLOW_BOUNDS.maxX - 1, x));
  let cz = Math.max(PALE_HOLLOW_BOUNDS.minZ + 1, Math.min(PALE_HOLLOW_BOUNDS.maxZ - 1, z));
  if (PH_ASH_ROAD.blocked && cx >= PH_ASH_ROAD.minX && cx <= PH_ASH_ROAD.maxX && cz >= PH_ASH_ROAD.minZ) {
    cz = Math.min(cz, PH_ASH_ROAD.minZ - 0.5);
  }
  return { x: cx, z: cz };
}

/**
 * Shared with the client water ribbon â€” height above the centerline bed.
 * Bed carve is ~1.35, so this keeps the table above the old shallow sheet
 * and still under the arch (deck center is water + PH_BRIDGE_DECK_CLEARANCE).
 */
export const PALE_HOLLOW_WATER_CLEARANCE = 2.55;

/**
 * Continuous 0â€“1 bank/mud weight from river distance (not discrete biome).
 * Used to soft-blend grass â†’ dirt â†’ mud without sawtooth ID edges.
 */
export function paleHollowBankBlend(x: number, z: number): number {
  let w = 0;
  if (z > 10 && z < 245) {
    const rd = Math.abs(x - riverCenterX(z));
    w = Math.max(w, 1 - smooth01(rd / 36));
  }
  if (z > 52 && z < 152) {
    const td = Math.abs(x - tributaryCenterX(z));
    w = Math.max(w, 1 - smooth01(td / 24));
  }
  return w;
}

/**
 * Soft visual blend weights (0â€“1) for terrain shading â€” independent of discrete biomes.
 * Spans hard grove circles, scrub rims, farm bands, quarry, etc.
 */
export function paleHollowTerrainWeights(x: number, z: number): {
  bank: number;
  ash: number;
  scrub: number;
  farm: number;
  meadow: number;
  quarry: number;
  mountain: number;
  ore: number;
} {
  const bank = paleHollowBankBlend(x, z);

  // Ashbeam groves â€” soft disks past the hard gameplay radii
  let ash = 0;
  ash = Math.max(ash, 1 - smooth01(Math.hypot(x + 6, z - 82) / 36));
  ash = Math.max(ash, 1 - smooth01(Math.hypot(x - 38, z - 70) / 26));
  ash = Math.max(ash, 1 - smooth01(Math.hypot(x + 42, z - 98) / 24));
  ash = Math.max(ash, 1 - smooth01(Math.hypot(x - 36, z - 130) / 22));

  // Outer scrub rim + soft quarry scrub ring
  let scrub = smooth01((Math.abs(x) - 52) / 16);
  const qd = Math.hypot(x, z - 145);
  const scrubRing = smooth01((qd - 24) / 12) * (1 - smooth01((qd - 44) / 10));
  scrub = Math.max(scrub, scrubRing);
  // Segment D scrub flanks
  if (z > 175) {
    scrub = Math.max(scrub, smooth01((Math.abs(x) - 48) / 14));
  }

  // Farm / meadow â€” soft rect + bleed across segment Aâ†’B seam (zâ‰ˆ50)
  let farm = 0;
  let meadow = 0;
  if (z > 4 && z < 62) {
    const zBand = smooth01((z - 4) / 10) * (1 - smooth01((z - 48) / 14));
    farm = (1 - smooth01((Math.abs(x) - 26) / 12)) * zBand;
    meadow =
      smooth01((Math.abs(x) - 26) / 12) * (1 - smooth01((Math.abs(x) - 54) / 12)) * zBand;
  }

  // Quarry bowl
  const quarry = 1 - smooth01(qd / 32);

  // Soft mountain lobes (visual; core mountain biome stays for gameplay)
  let mountain = 0;
  for (const m of PH_MOUNTAINS) {
    const d = Math.hypot(x - m.x, z - m.z);
    mountain = Math.max(mountain, 1 - smooth01(d / (m.r * 0.9)));
  }

  // Ore seam + crypt pocket
  let ore = 0;
  if (z > 178) {
    ore = (1 - smooth01((Math.abs(x) - 30) / 14)) * smooth01((z - 182) / 12);
  }
  ore = Math.max(ore, 1 - smooth01(Math.hypot(x + 18, z - 210) / 20));

  return { bank, ash, scrub, farm, meadow, quarry, mountain, ore };
}

/**
 * Distance from (x,z) to the nearest point on a channel centerline.
 * An east-west meander is not `|x - centerX(z)|` â€” that test misses the
 * north bend and leaves a dry gap between the banks.
 */
function nearestOnCenterline(
  centerX: (z: number) => number,
  z0: number,
  z1: number,
  x: number,
  z: number,
): { dist: number; cx: number; cz: number } | null {
  if (z < z0 - 6 || z > z1 + 6) return null;
  let bestD = Infinity;
  let bestCx = 0;
  let bestCz = z;
  const a = Math.max(z0, z - 16);
  const b = Math.min(z1, z + 16);
  for (let zz = a; zz <= b; zz += 1) {
    const cx = centerX(zz);
    const d = Math.hypot(x - cx, z - zz);
    if (d < bestD) {
      bestD = d;
      bestCx = cx;
      bestCz = zz;
    }
  }
  for (let zz = bestCz - 1; zz <= bestCz + 1; zz += 0.25) {
    if (zz < z0 || zz > z1) continue;
    const cx = centerX(zz);
    const d = Math.hypot(x - cx, z - zz);
    if (d < bestD) {
      bestD = d;
      bestCx = cx;
      bestCz = zz;
    }
  }
  return { dist: bestD, cx: bestCx, cz: bestCz };
}

/**
 * World Y of the water surface at (x,z), or null if not in a waterbody.
 * Used to clip billboards: legs under water, torso above.
 */
export function paleHollowWaterSurfaceY(x: number, z: number): number | null {
  if (paleHollowLakeDist(x, z) <= PH_LAKE.r) {
    return paleHollowHeightField(PH_LAKE.x, PH_LAKE.z) + PALE_HOLLOW_WATER_CLEARANCE;
  }
  const main = nearestOnCenterline(riverCenterX, PH_RIVER_MAIN.z0, PH_RIVER_MAIN.z1, x, z);
  if (main && main.dist <= PH_RIVER_MAIN.waterHalf) {
    return paleHollowHeightField(main.cx, main.cz) + PALE_HOLLOW_WATER_CLEARANCE;
  }
  const trib = nearestOnCenterline(tributaryCenterX, PH_RIVER_TRIB.z0, PH_RIVER_TRIB.z1, x, z);
  if (trib && trib.dist <= PH_RIVER_TRIB.waterHalf) {
    return paleHollowHeightField(trib.cx, trib.cz) + PALE_HOLLOW_WATER_CLEARANCE;
  }
  return null;
}

/**
 * True when standing in the river/tributary channel (not bridge decks / docks).
 * Use to keep non-water structures and trees out of the waterbody.
 */
export function paleHollowInOpenWater(x: number, z: number): boolean {
  if (paleHollowOnBridge(x, z)) return false;
  if (paleHollowBiomeCore(x, z) === "bridge") return false;
  return paleHollowWaterSurfaceY(x, z) != null || paleHollowBiomeCore(x, z) === "river";
}

/**
 * Landmark / building footprints where trees & large props should not spawn.
 * Hub apron is handled by `paleHollowInHubApron` â€” do not duplicate a hub circle here.
 */
/**
 * Roofs on the live roads. `lean_to` and `shack` and `cairn` are RON volumes.
 * The 8 m pad stays clear of trees and of field spawns.
 */
export const PH_YARDS: readonly {
  id: string;
  x: number;
  z: number;
  kind: "lean_to" | "shack" | "cairn";
  yaw: number;
}[] = [
  { id: "span", x: 28, z: 222, kind: "lean_to", yaw: -Math.PI / 2 },
  { id: "terrace", x: -82, z: 123, kind: "lean_to", yaw: Math.PI },
  { id: "clay", x: -35, z: 207, kind: "shack", yaw: Math.PI / 2 },
  { id: "grove", x: -57, z: 167, kind: "shack", yaw: -1.1 },
  { id: "hunter", x: 70, z: 180, kind: "lean_to", yaw: Math.atan2(-15, -30) },
  { id: "cut", x: 53, z: 136, kind: "shack", yaw: Math.PI },
  { id: "rim", x: 105, z: 93, kind: "lean_to", yaw: -Math.PI / 2 },
  { id: "seam", x: 18, z: 412, kind: "shack", yaw: Math.PI / 2 },
  { id: "watch", x: 8, z: 434, kind: "lean_to", yaw: -Math.PI / 2 },
  { id: "cairn", x: 0, z: 450, kind: "cairn", yaw: 0 },
];

export const PH_BUILDING_CLEARINGS: readonly { x: number; z: number; r: number }[] = PH_YARDS.map(
  (y) => ({ x: y.x, z: y.z, r: 8 }),
);

/** True if (x,z) is inside a building / landmark clearing. */
export function paleHollowInBuildingClearing(x: number, z: number): boolean {
  if (paleHollowInHubApron(x, z)) return true;
  for (const c of PH_BUILDING_CLEARINGS) {
    if (Math.hypot(x - c.x, z - c.z) < c.r) return true;
  }
  return false;
}

/**
 * Nudge a point onto dry land (not open water, not hub interior).
 * Returns the original point if already dry. Prefer staying near the source.
 */
export function paleHollowPlaceOnDryLand(
  x: number,
  z: number,
  maxRadius = 36,
): { x: number; z: number } {
  const ok = (px: number, pz: number) => {
    if (paleHollowBiomeCore(px, pz) === "hub_indoor") return false;
    return paleHollowWalkable(px, pz);
  };
  if (ok(x, z)) return { x, z };
  for (let r = 2; r <= maxRadius; r += 2) {
    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2;
      const px = x + Math.cos(ang) * r;
      const pz = z + Math.sin(ang) * r;
      if (ok(px, pz)) return { x: px, z: pz };
    }
  }
  return { x, z };
}

/** Terrain move modifiers â€” rivers slow; banks soft slow. */
export function paleHollowMoveMul(x: number, z: number): number {
  const b = paleHollowBiome(x, z);
  if (b === "river") return 0.55;
  if (b === "riverbank") return 0.82;
  if (b === "quarry" && Math.hypot(x, z - 145) < 18) return 0.88;
  return 1;
}

export function paleHollowGateSoftLevel(z: number): number | null {
  if (z >= PH_ASH_ROAD.minZ) return PH_ASH_ROAD.softLevel;
  if (z >= PH_SEAM_TUNNEL.minZ && z <= PH_SEAM_TUNNEL.maxZ) return PH_SEAM_TUNNEL.softLevel;
  if (z >= PH_QUARRY_CUT.minZ && z <= PH_QUARRY_CUT.maxZ) return PH_QUARRY_CUT.softLevel;
  if (z >= PH_TIMBER_BRIDGE.minZ && z <= PH_TIMBER_BRIDGE.maxZ) return PH_TIMBER_BRIDGE.softLevel;
  return null;
}

export const PH_HUB_SPAWN = { x: PH_CAMP_SHIFT_X, z: 2 + PH_CAMP_SHIFT_Z, facing: 0 } as const;
export const PH_OUTDOOR_SPAWN = { x: PH_CAMP_SHIFT_X, z: 14 + PH_CAMP_SHIFT_Z, facing: 0 } as const;

export type GatherNodeKind = "harvest" | "mine" | "fish";

export type PaleHollowNodeDef = {
  id: string;
  name: string;
  x: number;
  z: number;
  kind: GatherNodeKind;
  yields: string[];
  interactMs: number;
  respawnMs: number;
};

export const PH_SEGMENT_A_NODES: PaleHollowNodeDef[] = [
  { id: "ph-farm-a", name: "Dustgrain Patch", x: -85, z: 121, kind: "harvest", yields: ["dustgrain", "pale-dust"], interactMs: 2500, respawnMs: 55_000 },
  { id: "ph-farm-b", name: "Dustgrain Patch", x: -79, z: 121, kind: "harvest", yields: ["dustgrain", "pale-dust"], interactMs: 2500, respawnMs: 55_000 },
  { id: "ph-farm-c", name: "Dustgrain Patch", x: -85, z: 125, kind: "harvest", yields: ["dustgrain"], interactMs: 2500, respawnMs: 50_000 },
  { id: "ph-farm-d", name: "Dustgrain Patch", x: -79, z: 125, kind: "harvest", yields: ["dustgrain", "pale-dust"], interactMs: 2500, respawnMs: 55_000 },
  { id: "ph-farm-e", name: "Dustgrain Patch", x: -82, z: 126, kind: "harvest", yields: ["dustgrain", "pale-dust"], interactMs: 2500, respawnMs: 55_000 },
  { id: "ph-farm-f", name: "Dustgrain Patch", x: -82, z: 120, kind: "harvest", yields: ["dustgrain"], interactMs: 2500, respawnMs: 55_000 },
  { id: "ph-flax-a", name: "Pale Flax Stand", x: -86, z: 123, kind: "harvest", yields: ["pale-flax", "dead-fiber"], interactMs: 2800, respawnMs: 60_000 },
  { id: "ph-flax-b", name: "Pale Flax Stand", x: -78, z: 123, kind: "harvest", yields: ["pale-flax", "pale-dust"], interactMs: 2800, respawnMs: 60_000 },
  { id: "ph-sand-a", name: "River Sand Bar", x: -33, z: 205, kind: "harvest", yields: ["river-sand", "pale-dust"], interactMs: 2500, respawnMs: 65_000 },
  { id: "ph-clay-a", name: "Clay Bank", x: -37, z: 205, kind: "harvest", yields: ["potters-clay", "clay-crab", "river-sand"], interactMs: 2500, respawnMs: 65_000 },
  { id: "ph-fish-a", name: "Chalk Pool", x: -33, z: 209, kind: "fish", yields: ["fossil-minnow"], interactMs: 4000, respawnMs: 75_000 },
  { id: "ph-fish-b", name: "Chalk Pool", x: -37, z: 209, kind: "fish", yields: ["fossil-minnow"], interactMs: 4000, respawnMs: 75_000 },
  { id: "ph-copper-nugget", name: "Copper Nugget Vein", x: 20, z: 410, kind: "mine", yields: ["copper-ore"], interactMs: 4000, respawnMs: 120_000 },
];

export const PH_SEGMENT_B_NODES: PaleHollowNodeDef[] = [
  { id: "ph-ash-a", name: "Ashbeam Log", x: -60, z: 165, kind: "harvest", yields: ["ashbeam-log", "bark-strip"], interactMs: 3000, respawnMs: 70_000 },
  { id: "ph-ash-b", name: "Ashbeam Log", x: -54, z: 165, kind: "harvest", yields: ["ashbeam-log"], interactMs: 3000, respawnMs: 70_000 },
  { id: "ph-ash-c", name: "Ashbeam Log", x: -60, z: 169, kind: "harvest", yields: ["ashbeam-log", "bark-strip"], interactMs: 3000, respawnMs: 70_000 },
  { id: "ph-ash-d", name: "Ashbeam Log", x: -54, z: 169, kind: "harvest", yields: ["ashbeam-log"], interactMs: 3000, respawnMs: 70_000 },
  { id: "ph-ash-e", name: "Ashbeam Log", x: -57, z: 164, kind: "harvest", yields: ["ashbeam-log", "bark-strip"], interactMs: 3000, respawnMs: 70_000 },
  { id: "ph-fiber-a", name: "Dead Fiber Thicket", x: -63, z: 167, kind: "harvest", yields: ["dead-fiber", "pale-flax", "pale-dust"], interactMs: 2800, respawnMs: 60_000 },
  { id: "ph-fiber-b", name: "Dead Fiber Thicket", x: -51, z: 167, kind: "harvest", yields: ["dead-fiber", "pale-flax"], interactMs: 2800, respawnMs: 60_000 },
  { id: "ph-root-a", name: "Antidote Root", x: -57, z: 170, kind: "harvest", yields: ["antidote-root", "pale-dust"], interactMs: 3200, respawnMs: 90_000 },
];

export const PH_SEGMENT_C_NODES: PaleHollowNodeDef[] = [
  { id: "ph-cobble-a", name: "Cobble Heap", x: 51, z: 134, kind: "mine", yields: ["cobble", "pale-dust"], interactMs: 3500, respawnMs: 80_000 },
  { id: "ph-lime-a", name: "Limestone Face", x: 55, z: 134, kind: "mine", yields: ["limestone", "rock-salt"], interactMs: 4000, respawnMs: 100_000 },
  { id: "ph-lime-b", name: "Limestone Face", x: 53, z: 138, kind: "mine", yields: ["limestone", "cobble", "rock-salt"], interactMs: 4000, respawnMs: 100_000 },
  { id: "ph-cord-a", name: "Climbing Cord", x: 103, z: 91, kind: "harvest", yields: ["climbing-cord"], interactMs: 3500, respawnMs: 110_000 },
  { id: "ph-cord-b", name: "Climbing Cord", x: 107, z: 95, kind: "harvest", yields: ["climbing-cord"], interactMs: 3500, respawnMs: 110_000 },
];

export const PH_SEGMENT_D_NODES: PaleHollowNodeDef[] = [
  { id: "ph-cu-a", name: "Copper Seam", x: 20, z: 414, kind: "mine", yields: ["copper-ore"], interactMs: 4500, respawnMs: 130_000 },
  { id: "ph-sn-a", name: "Tin Seam", x: 22, z: 412, kind: "mine", yields: ["tin-ore"], interactMs: 4500, respawnMs: 130_000 },
  { id: "ph-cu-b", name: "Copper Seam", x: 20, z: 416, kind: "mine", yields: ["copper-ore", "pale-dust"], interactMs: 4500, respawnMs: 140_000 },
  { id: "ph-crystal-a", name: "Pale Dust Crystal", x: 10, z: 432, kind: "harvest", yields: ["pale-dust"], interactMs: 5000, respawnMs: 160_000 },
  { id: "ph-crystal-b", name: "Pale Dust Crystal", x: 10, z: 436, kind: "harvest", yields: ["pale-dust"], interactMs: 5000, respawnMs: 160_000 },
];

export const PH_ALL_NODES: PaleHollowNodeDef[] = [
  ...PH_SEGMENT_A_NODES,
  ...PH_SEGMENT_B_NODES,
  ...PH_SEGMENT_C_NODES,
  ...PH_SEGMENT_D_NODES,
];

/** How many gather nodes are live in the world at once (drawn from PH_ALL_NODES spawn points). */
export const PH_ACTIVE_GATHER_COUNT = 20;

/** Chance a node relocates to another free spawn point when gathered / refreshing. */
export const PH_GATHER_RELOCATE_CHANCE = 0.6;

/** All authored gather coordinates â€” spawn pool for live nodes. */
export function paleHollowNodeSpawnPoints(): { id: string; name: string; x: number; z: number; kind: GatherNodeKind }[] {
  return PH_ALL_NODES.map((n) => ({ id: n.id, name: n.name, x: n.x, z: n.z, kind: n.kind }));
}

export type PaleHollowArchetype =
  | "dust_hare"
  | "pale_slime"
  | "hollow_scavenger"
  | "ashbeam_boar"
  | "ruin_dweller"
  | "cliff_adder"
  | "seam_golem"
  | "shard_wight";

export type PaleHollowAggro = "safe" | "proximity" | "sight" | "sound";

export type PaleHollowRareDrop = {
  slug: string;
  /** Absolute drop chance in [0, 1] (independent of the flat 65% mat roll). */
  chance: number;
};

/**
 * Same ids as player `JobId` â€” kept local so `@bellgrave/config` stays free of a combat dep.
 * Job drives mob AI ability choice, engage range, and attack stat curves.
 */
export type PaleHollowMobJob =
  | "time_mage"
  | "knight"
  | "rogue"
  | "cleric"
  | "sorcerer"
  | "fighter"
  | "battle_mage";

/**
 * Default job per archetype (theme match).
 * Spawn defs may override with `job` for variants (e.g. knight dweller).
 *
 * Follow-ups: weighted job tables per segment, UI nameplate job glyph,
 * and richer kit reuse beyond the NPC-safe ability stubs in mob-job-ai.
 */
export const PH_ARCHETYPE_DEFAULT_JOB: Record<PaleHollowArchetype, PaleHollowMobJob> = {
  dust_hare: "fighter",
  pale_slime: "battle_mage",
  hollow_scavenger: "rogue",
  ashbeam_boar: "fighter",
  ruin_dweller: "sorcerer",
  cliff_adder: "rogue",
  seam_golem: "knight",
  shard_wight: "time_mage",
};

export type PaleHollowMobDef = {
  id: string;
  name: string;
  x: number;
  z: number;
  level: number;
  archetype: PaleHollowArchetype;
  /** Optional job override â€” defaults via `PH_ARCHETYPE_DEFAULT_JOB`. */
  job?: PaleHollowMobJob;
  aggro: PaleHollowAggro;
  aggroRange: number;
  linkRange?: number;
  hp: number;
  drops: string[];
  /** Optional rare gear â€” rolled once per kill at the given chance. */
  rareDrops?: PaleHollowRareDrop[];
};

export function paleHollowMobJob(
  d: Pick<PaleHollowMobDef, "archetype" | "job">,
): PaleHollowMobJob {
  return d.job ?? PH_ARCHETYPE_DEFAULT_JOB[d.archetype];
}


// Field packs, yards' NPCs and kill quests live in pale-hollow-field.ts.
// They are five times the old corridor list, seated on the enlarged basin.

export const PH_HUB_NPCS = [
  { id: "npc-shard-elder", name: "Shard Elder", x: -2.2 + PH_CAMP_SHIFT_X, z: 2.8 + PH_CAMP_SHIFT_Z, facing: Math.PI / 2, role: "guide" as const },
  { id: "npc-ph-herald", name: "Campaign Herald", x: 0.4 + PH_CAMP_SHIFT_X, z: 5.0 + PH_CAMP_SHIFT_Z, facing: Math.PI, role: "quest_giver" as const },
  { id: "npc-ph-job-master", name: "Job Master", x: 3.5 + PH_CAMP_SHIFT_X, z: 2.5 + PH_CAMP_SHIFT_Z, facing: -Math.PI / 2, role: "job_master" as const },
  { id: "npc-ph-crafter", name: "Craft Master", x: 3.8 + PH_CAMP_SHIFT_X, z: -0.2 + PH_CAMP_SHIFT_Z, facing: -Math.PI / 2, role: "crafter" as const },
  { id: "npc-ph-vendor", name: "Provisioner", x: -3.8 + PH_CAMP_SHIFT_X, z: -0.2 + PH_CAMP_SHIFT_Z, facing: Math.PI / 2, role: "vendor" as const },
] as const;

/**
 * Minimap road names, keyed by `paleHollowTrails()` id (layout data only).
 * Stone bridge approaches are drawn but not named; they read as part of the bridge.
 */
export const PH_ROAD_NAMES: Readonly<Record<string, string>> = {
  "camp-to-north": "Terrace Way",
  "camp-to-west-farm": "Clay Bank Path",
  "north-to-ashbeam": "Hollow Steps Road",
  "ashbeam-to-chalkworks": "Quarry Road",
  "chalkworks-to-marches": "Seam Road",
  "marches-to-ash-road": "Ash Road",
  "east-grove": "East Grove Path",
};

export type PaleHollowMapLabelKind = "area" | "camp" | "landmark" | "water";

/**
 * Minimap labels: segment names, encampments and landmarks from
 * docs/pale-hollow-area.md, placed at the geometry they name above.
 */
export const PH_MAP_LABELS: readonly { text: string; x: number; z: number; kind: PaleHollowMapLabelKind }[] = [
  { text: "The Shard Dwellings", x: PH_CAMP_SHIFT_X, z: 2 + PH_CAMP_SHIFT_Z, kind: "camp" },
  { text: "Scavenger Camp", x: -57, z: 167, kind: "camp" },
  { text: "Hollow Steps", x: -82, z: 123, kind: "area" },
  { text: "Ashbeam Reach", x: -120, z: 200, kind: "area" },
  { text: "Chalkworks", x: 40, z: 90, kind: "area" },
  { text: "Pale Marches", x: 0, z: 450, kind: "area" },
  { text: "Clay Bank", x: -125, z: 55, kind: "landmark" },
  { text: "Timber Bridge", x: (PH_TIMBER_BRIDGE.minX + PH_TIMBER_BRIDGE.maxX) / 2, z: (PH_TIMBER_BRIDGE.minZ + PH_TIMBER_BRIDGE.maxZ) / 2, kind: "landmark" },
  { text: "Quarry Cut", x: (PH_QUARRY_CUT.minX + PH_QUARRY_CUT.maxX) / 2, z: (PH_QUARRY_CUT.minZ + PH_QUARRY_CUT.maxZ) / 2, kind: "landmark" },
  { text: "Hollow Quarry", x: 53, z: 136, kind: "landmark" },
  { text: "Seam Tunnel", x: (PH_SEAM_TUNNEL.minX + PH_SEAM_TUNNEL.maxX) / 2, z: (PH_SEAM_TUNNEL.minZ + PH_SEAM_TUNNEL.maxZ) / 2, kind: "landmark" },
  { text: "Copper Seams", x: 20, z: 410, kind: "landmark" },
  { text: "Shard Crypt", x: -20, z: 430, kind: "landmark" },
  { text: "Ash Pit", x: PH_LAKE.x, z: PH_LAKE.z, kind: "water" },
  { text: "Hollow Road", x: 0, z: 484, kind: "landmark" },
];
