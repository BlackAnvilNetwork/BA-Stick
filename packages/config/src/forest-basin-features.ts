// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Forest Basin: water, bridges, trails and named places.
 *
 * The ground itself is sculpted in game with the map-builder spells and
 * folded into `forest-basin-terrain.ts`. What the sculpting spells cannot
 * express (water surfaces, bridge decks, trails, names, story, lights) lives
 * here. The scripted builder (`tools/map-builder/`) reads this file to carve
 * river beds, lake floors, fords and stairs with the same spells.
 *
 * North is +z. Water always runs downhill: every river's surface falls
 * monotonically from its first point to its last.
 */

export type WaterTier = "ford" | "deep" | "lake";

/** A river vertex: centre, surface height, half-width and depth below surface at the centre. */
export type RiverPoint = { x: number; z: number; y: number; w: number; d: number };

export type FbRiver = { id: string; name: string; points: readonly RiverPoint[] };

/** Depth (m) at or below which water is wadeable. */
export const FB_WADE_DEPTH = 0.5;

const RIVER_SPINES: readonly FbRiver[] = [
  {
    // From the Wrights' Spring high in the Graven Fells, down the west valley into the Stillmere.
    id: "briarwater",
    name: "the Briarwater",
    points: [
      { x: -101, z: 131, y: 12.6, w: 1.6, d: 0.3 },
      { x: -96, z: 121, y: 12.3, w: 1.9, d: 0.35 },
      { x: -93, z: 117.5, y: 12.2, w: 2.0, d: 0.3 }, // lip of the Wright's Veil
      { x: -91.5, z: 115.5, y: 10.4, w: 2.6, d: 0.6 }, // foot of the falls
      { x: -89, z: 112.5, y: 10.35, w: 4.4, d: 1.7 }, // Fenstone Pool (plunge pool)
      { x: -85, z: 109, y: 10.0, w: 2.4, d: 0.4 },
      { x: -79, z: 104, y: 9.4, w: 2.5, d: 0.4 },
      { x: -71, z: 99, y: 8.3, w: 2.8, d: 0.35 }, // Hartstep Ford (shallow riffle)
      { x: -63, z: 93, y: 7.4, w: 3.1, d: 0.45 },
      { x: -52, z: 82, y: 6.3, w: 3.6, d: 0.9 },
      { x: -41, z: 71, y: 5.4, w: 4.2, d: 1.3 },
      { x: -28, z: 64, y: 4.6, w: 4.8, d: 1.6 }, // Wrightsbridge
      { x: -14, z: 58, y: 3.9, w: 5.2, d: 1.5 },
      { x: 1, z: 49, y: 3.2, w: 5.4, d: 1.3 },
      { x: 13, z: 45, y: 2.75, w: 5.9, d: 0.4 }, // the Long Shallows (ford)
      { x: 24, z: 40, y: 2.4, w: 5.6, d: 0.42 },
      { x: 35, z: 36, y: 2.1, w: 5.4, d: 1.0 },
      { x: 46, z: 31, y: 1.75, w: 6.2, d: 1.4 },
      { x: 54, z: 28, y: 1.6, w: 7.0, d: 1.6 },
    ],
  },
  {
    // Cold, fast water off the north fells; joins the Stillmere's north arm.
    id: "coldrun",
    name: "the Coldrun",
    points: [
      { x: 37, z: 140, y: 11.4, w: 1.4, d: 0.3 },
      { x: 42, z: 127, y: 10.2, w: 1.8, d: 0.35 },
      { x: 44, z: 114, y: 8.9, w: 2.2, d: 0.4 },
      { x: 49, z: 102, y: 7.6, w: 2.6, d: 0.35 }, // Pebble Ford
      { x: 53, z: 90, y: 6.3, w: 3.0, d: 0.7 },
      { x: 56, z: 77, y: 5.0, w: 3.6, d: 1.3 },
      { x: 59, z: 67, y: 3.9, w: 4.0, d: 1.5 }, // Stoneback Bridge
      { x: 62, z: 57, y: 2.9, w: 4.4, d: 1.4 },
      { x: 66, z: 50, y: 2.1, w: 5.0, d: 1.3 },
      { x: 70, z: 45, y: 1.6, w: 6.0, d: 1.5 },
    ],
  },
  {
    // The Stillmere's only outflow: east past Kiln Crag, then into the ground at the Swallow.
    id: "sinkwater",
    name: "the Sinkwater",
    points: [
      { x: 103, z: 9, y: 1.6, w: 5.0, d: 1.2 },
      { x: 110, z: 3, y: 1.42, w: 4.4, d: 1.0 },
      { x: 118, z: -3, y: 1.25, w: 4.6, d: 0.38 }, // the Crossing Stones (ford)
      { x: 126, z: -9, y: 1.1, w: 3.8, d: 0.9 },
      { x: 134, z: -17, y: 0.9, w: 3.2, d: 1.4 },
      { x: 140, z: -24, y: 0.65, w: 3.4, d: 2.2 }, // the Swallow
    ],
  },
];

/** Stillmere shoreline, clockwise from the west inlet. Lobed and uneven on purpose. */
/**
 * Rivers bend between their named spine points (fords and bridges stay put):
 * each span is cut into ~5 m pieces pushed sideways by two out-of-phase waves.
 */
function meander<P extends { x: number; z: number }>(pts: readonly P[], amp: number, seed: number, lerp: (a: P, b: P, t: number, x: number, z: number) => P): P[] {
  const out: P[] = [pts[0]!];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.max(2, Math.round(len / 5));
    const nx = -(b.z - a.z) / len;
    const nz = (b.x - a.x) / len;
    const side = (i + seed) % 2 === 0 ? 1 : -1;
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const env = Math.sin(Math.PI * t);
      const off = side * amp * env * (0.75 + 0.25 * Math.sin(seed * 1.7 + i * 2.3)) + amp * 0.3 * env * Math.sin(t * 9.4 + seed + i);
      out.push(lerp(a, b, t, a.x + (b.x - a.x) * t + nx * off, a.z + (b.z - a.z) * t + nz * off));
    }
  }
  return out;
}

export const FB_RIVERS: readonly FbRiver[] = RIVER_SPINES.map((r, ri) => ({
  ...r,
  points: meander(r.points, ri === 2 ? 2.2 : 3.6, ri * 5 + 1, (a, b, t, x, z) => ({
    x,
    z,
    y: a.y + (b.y - a.y) * t,
    w: a.w + (b.w - a.w) * t,
    d: a.d + (b.d - a.d) * t,
  })),
}));

export const FB_STILLMERE = {
  name: "the Stillmere",
  surface: 1.6,
  /** Deepest point, metres below the surface. Deep water is lake, never wadeable. */
  maxDepth: 3.4,
  /** Wadeable margin width (m) inside the shore. */
  shelf: 3.5,
  outline: [
    { x: 50, z: 33 },
    { x: 57, z: 41 },
    { x: 64, z: 49 },
    { x: 72, z: 50 },
    { x: 78, z: 44 },
    { x: 87, z: 45 },
    { x: 96, z: 39 },
    { x: 99, z: 29 },
    { x: 107, z: 20 },
    { x: 106, z: 9 },
    { x: 98, z: 4 },
    { x: 91, z: -6 },
    { x: 80, z: -8 },
    { x: 73, z: -1 },
    { x: 64, z: 2 },
    { x: 58, z: 11 },
    { x: 53, z: 18 },
    { x: 49, z: 25 },
  ],
} as const;

export type FbBridge = {
  id: string;
  name: string;
  /** Deck centre line, bank to bank. */
  a: { x: number; z: number };
  b: { x: number; z: number };
  halfWidth: number;
  deckY: number;
};

export const FB_BRIDGES: readonly FbBridge[] = [
  { id: "wrightsbridge", name: "Wrightsbridge", a: { x: -31.2, z: 57.3 }, b: { x: -24.8, z: 70.7 }, halfWidth: 1.9, deckY: 5.5 },
  { id: "stoneback", name: "Stoneback Bridge", a: { x: 52.6, z: 65.1 }, b: { x: 65.4, z: 68.9 }, halfWidth: 1.9, deckY: 4.8 },
  { id: "rope-span", name: "the Rope Span", a: { x: -46.5, z: -61.7 }, b: { x: -31.8, z: -66.3 }, halfWidth: 1.3, deckY: 3.4 },
  { id: "mere-causeway", name: "the Reedwalk", a: { x: 51.4, z: 20.5 }, b: { x: 56.6, z: 35.5 }, halfWidth: 1.7, deckY: 2.3 },
];

export type FbTrail = { id: string; name: string; surface: "dirt" | "stone"; points: readonly { x: number; z: number }[] };

/** Trails meander; no long straight runs. */
const TRAIL_SPINES: readonly FbTrail[] = [
  {
    id: "hollow-way",
    name: "the Hollow Way",
    surface: "dirt",
    points: [
      { x: 8, z: -140 }, { x: 6, z: -126 }, { x: 10, z: -113 }, { x: 13, z: -101 }, { x: 8, z: -86 },
      { x: -2, z: -68 }, { x: -9, z: -50 }, { x: -13, z: -31 }, { x: -16, z: -12 }, { x: -18, z: 4 },
    ],
  },
  {
    id: "spur-way",
    name: "the Spur Way",
    surface: "dirt",
    points: [
      { x: 13, z: -101 }, { x: 30, z: -106 }, { x: 52, z: -103 }, { x: 74, z: -110 }, { x: 95, z: -106 },
      { x: 112, z: -100 }, { x: 124, z: -106 }, { x: 129, z: -113 },
    ],
  },
  {
    id: "wrights-road",
    name: "the Wrights' Road",
    surface: "stone",
    points: [
      { x: -18, z: 4 }, { x: -23, z: 21 }, { x: -21, z: 38 }, { x: -27, z: 50 }, { x: -31.2, z: 57.3 },
      { x: -24.8, z: 70.7 }, { x: -36, z: 78 }, { x: -44, z: 82 }, { x: -58, z: 90 }, { x: -71, z: 99 }, { x: -78, z: 110 },
    ],
  },
  {
    id: "mere-path",
    name: "the Mere Path",
    surface: "dirt",
    points: [
      { x: -18, z: 4 }, { x: -2, z: 9 }, { x: 15, z: 8 }, { x: 31, z: 14 }, { x: 44, z: 17 }, { x: 51.4, z: 20.5 },
      { x: 56.6, z: 35.5 }, { x: 52, z: 45 }, { x: 50, z: 57 }, { x: 52.6, z: 65.1 }, { x: 65.4, z: 68.9 }, { x: 72, z: 76 },
    ],
  },
  {
    id: "kiln-path",
    name: "the Kiln Path",
    surface: "dirt",
    points: [
      { x: 44, z: 17 }, { x: 60, z: -12 }, { x: 82, z: -18 }, { x: 101, z: -12 }, { x: 112, z: -6 },
      { x: 118, z: -3 }, { x: 124, z: 7 }, { x: 121, z: 22 }, { x: 113, z: 31 },
    ],
  },
  {
    id: "chapel-track",
    name: "the Chapel Track",
    surface: "dirt",
    points: [{ x: -9, z: -50 }, { x: -24, z: -59 }, { x: -31.8, z: -66.3 }, { x: -46.5, z: -61.7 }, { x: -58, z: -68 }, { x: -72, z: -72 }],
  },
  {
    id: "ledge-track",
    name: "the Ledge Track",
    surface: "dirt",
    points: [{ x: -16, z: -12 }, { x: -38, z: -16 }, { x: -58, z: -22 }, { x: -78, z: -30 }, { x: -92, z: -36 }],
  },
];

/** Trails meander; no long straight runs. Spine points (bridge ends, gates) stay put. */
export const FB_TRAIL_DEFS: readonly FbTrail[] = TRAIL_SPINES.map((t, ti) => ({
  ...t,
  points: meander(t.points, 1.6, ti * 3 + 2, (_a, _b, _t, x, z) => ({ x, z })),
}));

/**
 * Ascent routes: walkable climbs through otherwise blocked cliffs. The
 * scripted builder carves each as steps (stairs), a graded shelf (ledges)
 * or a cut between crag walls (cleft), and marks it walkable.
 */
export type FbAscent = {
  id: string;
  name: string;
  kind: "stair" | "ledge" | "cleft";
  halfWidth: number;
  points: readonly { x: number; z: number; y: number }[];
};

export const FB_ASCENTS: readonly FbAscent[] = [
  {
    id: "kestrel-ledge",
    name: "the Kestrel Ledge",
    kind: "ledge",
    halfWidth: 1.2,
    points: [{ x: -112, z: -38, y: 8.2 }, { x: -116, z: -45, y: 9.4 }, { x: -120, z: -50, y: 10.6 }, { x: -124, z: -55, y: 11.6 }],
  },
  {
    id: "sink-stair",
    name: "the Sink Stair",
    kind: "stair",
    halfWidth: 1.3,
    points: [{ x: 127, z: -30, y: 3.3 }, { x: 128, z: -34, y: 1.2 }, { x: 128, z: -38, y: -1.4 }],
  },
  {
    id: "swallow-cut",
    name: "the Swallow Cut",
    kind: "cleft",
    halfWidth: 1.3,
    points: [{ x: 128, z: -40, y: -1.6 }, { x: 133, z: -46, y: 1.2 }, { x: 139, z: -47, y: 4.2 }, { x: 142, z: -52, y: 7.0 }, { x: 146, z: -50, y: 9.5 }],
  },
  {
    id: "cutters-ramp",
    name: "the Cutters' Ramp",
    kind: "ledge",
    halfWidth: 1.5,
    points: [{ x: 2, z: 106, y: 7.3 }, { x: 10, z: 112, y: 9.0 }, { x: 6, z: 121, y: 10.6 }, { x: 15, z: 128, y: 12.4 }, { x: 13, z: 136, y: 13.9 }, { x: 22, z: 140, y: 15.5 }],
  },
  {
    id: "wrights-stair",
    name: "the Wrights' Stair",
    kind: "stair",
    halfWidth: 1.6,
    points: [
      { x: -78, z: 110, y: 9.9 }, { x: -86, z: 116, y: 11.6 }, { x: -82, z: 123, y: 13.4 },
      { x: -91, z: 127, y: 15.2 }, { x: -88, z: 134, y: 16.6 }, { x: -94, z: 137, y: 17.5 },
    ],
  },
  {
    id: "goat-ledges",
    name: "the Goat Ledges",
    kind: "ledge",
    halfWidth: 1.5,
    points: [
      { x: -92, z: -36, y: 3.0 }, { x: -106, z: -28, y: 5.6 }, { x: -112, z: -38, y: 8.2 },
      { x: -121, z: -27, y: 10.8 }, { x: -129, z: -35, y: 13.4 }, { x: -135, z: -29, y: 16.0 },
    ],
  },
  {
    id: "smoke-cleft",
    name: "the Smoke Cleft",
    kind: "cleft",
    halfWidth: 1.4,
    points: [
      { x: 113, z: 31, y: 3.2 }, { x: 119, z: 40, y: 5.6 }, { x: 126, z: 46, y: 8.2 },
      { x: 128, z: 55, y: 11.0 }, { x: 124, z: 62, y: 13.5 },
    ],
  },
];

/** High places worth reaching; flat-ish tops the builder levels. */
export const FB_HEIGHTS: readonly { id: string; name: string; x: number; z: number; r: number; y: number }[] = [
  { id: "unnamed-hall", name: "the Unnamed Hall", x: -97, z: 141, r: 7, y: 17.5 },
  { id: "lantern-rock", name: "Lantern Rock", x: -139, z: -30, r: 5, y: 16.0 },
  { id: "kiln-shelf", name: "the Kiln Shelf", x: 121, z: 67, r: 6, y: 13.5 },
  { id: "kestrel-shelf", name: "the Kestrel Shelf", x: -124, z: -55, r: 3.5, y: 11.6 },
  { id: "swallows-brow", name: "the Swallow's Brow", x: 147, z: -51, r: 4, y: 9.5 },
  { id: "cutters-crown", name: "the Cutters' Crown", x: 22, z: 140, r: 4, y: 15.5 },
];

/** Forge-stone rings (warp circles) at the hub, the crossroads and the region gate. */
export const FB_WARP_SITES: readonly { id: string; name: string; role: "hub" | "crossroads" | "gate"; x: number; z: number; r: number }[] = [
  { id: "fb-ring-kettle", name: "the Kettle Ring", role: "hub", x: 20, z: -94, r: 2.6 },
  { id: "fb-ring-scraped", name: "the Scraped Ring", role: "crossroads", x: -24, z: 6, r: 2.6 },
  { id: "fb-ring-spurgate", name: "the Spurgate Ring", role: "gate", x: 112, z: -96, r: 2.6 },
];

export type FbPlace = {
  id: string;
  name: string;
  x: number;
  z: number;
  kind: "camp" | "ruin" | "landmark" | "water" | "height" | "cult";
  /** What a player learns here. */
  story: string;
};

export const FB_PLACES: readonly FbPlace[] = [
  {
    id: "kettle-hollow",
    name: "Kettle Hollow",
    x: 10,
    z: -102,
    kind: "camp",
    story: "Woodcutters' camp in a dip of the replanted burn. Every trunk here is the same age; the old wood was burned on the Crown's order and the ash ploughed in.",
  },
  {
    id: "scraped-stones",
    name: "the Scraped Stones",
    x: -24,
    z: 6,
    kind: "ruin",
    story: "Seven standing stones around a forge-stone ring. Six were re-cut with House marks over the makers' names. The seventh was never cut at all: its house walked away nameless.",
  },
  {
    id: "wrightsbridge",
    name: "Wrightsbridge",
    x: -28,
    z: 64,
    kind: "ruin",
    story: "A stonewrights' bridge over the deep Briarwater. Crowns are overcut on every keystone, but under the arch the crosswise hammer is still struck beside each mason's mark.",
  },
  {
    id: "hartstep-ford",
    name: "Hartstep Ford",
    x: -71,
    z: 99,
    kind: "water",
    story: "Knee-deep riffle where deer cross. The makers paved its bed with flat stones; a few still carry a hawthorn sprig.",
  },
  {
    id: "unnamed-hall",
    name: "the Unnamed Hall",
    x: -97,
    z: 140,
    kind: "height",
    story: "A stonewrights' hall at the Wrights' Spring, its name wall chiselled bare. Where the spring runs over the wall, the water has worn one name back into the stone: Orla Fenstone, wright.",
  },
  {
    id: "wrights-spring",
    name: "the Wrights' Spring",
    x: -101,
    z: 131,
    kind: "water",
    story: "Source of the Briarwater, rising from a cut basin the makers lined with dressed stone.",
  },
  {
    id: "stillmere",
    name: "the Stillmere",
    x: 82,
    z: 20,
    kind: "water",
    story: "The basin's lake. Shallow at the reeds, then black and deep. Nothing flows out but the Sinkwater.",
  },
  {
    id: "reedwalk",
    name: "the Reedwalk",
    x: 53,
    z: 25,
    kind: "landmark",
    story: "A low plank walk over the Briarwater's mouth, mended so often no plank is older than a child.",
  },
  {
    id: "stoneback-bridge",
    name: "Stoneback Bridge",
    x: 59,
    z: 67,
    kind: "ruin",
    story: "One arch over the Coldrun's deep cut. A royal plaque names it for a king; the arch stones underneath are signed by a maker the plaque forgot.",
  },
  {
    id: "pebble-ford",
    name: "Pebble Ford",
    x: 49,
    z: 102,
    kind: "water",
    story: "The Coldrun runs ankle-deep over gravel before it drops into its gorge.",
  },
  {
    id: "crossing-stones",
    name: "the Crossing Stones",
    x: 118,
    z: -3,
    kind: "water",
    story: "Stepping stones across the Sinkwater's shallows, set by makers, reset by woodcutters.",
  },
  {
    id: "the-swallow",
    name: "the Swallow",
    x: 141,
    z: -25,
    kind: "water",
    story: "The Sinkwater pours into a hole in the crag and is gone. Time Mages once marked it as the place where the basin's water goes under the ridge toward the Hollow.",
  },
  {
    id: "kiln-shelf",
    name: "the Kiln Shelf",
    x: 121,
    z: 66,
    kind: "height",
    story: "Brick kilns on a shelf high in Kiln Crag, reached up the Smoke Cleft. Each firebrick is stamped with a hawthorn sprig; the House stamps were pressed over the top while the clay was still soft.",
  },
  {
    id: "lantern-rock",
    name: "Lantern Rock",
    x: -139,
    z: -30,
    kind: "height",
    story: "A beacon cairn on the West Ridge. In May of the Crown's first year the makers lit it to guide the Exodus across the basin by night.",
  },
  {
    id: "whitewashed-chapel",
    name: "the Whitewashed Chapel",
    x: -72,
    z: -72,
    kind: "cult",
    story: "Cultists of the Seven keep a makers' stele here and whitewash it every dawn. Brother Scour leads the Whitening; Lime-Hand and Sister Pumice carry the buckets. Under the lime the stele still lists the seven houses.",
  },
  {
    id: "stacked-pass",
    name: "the Stacked Pass",
    x: -22,
    z: 128,
    kind: "landmark",
    story: "What the Crown calls a rockfall is quarry blocks stacked by hand to shut the north pass.",
  },
  {
    id: "graven-fells",
    name: "the Graven Fells",
    x: 0,
    z: 118,
    kind: "landmark",
    story: "Bare high ground above the wood, cut with old quarry benches.",
  },
];

/** Camp light sources and glows (lighting overhaul `MapLight` shape). */
export const FB_LIGHTS: readonly { name: string; kind: "fire" | "lantern" | "forge" | "brazier" | "lava" | "crystal" | "torch"; x: number; z: number; radius?: number }[] = [
  { name: "Kettle Hollow campfire", kind: "fire", x: 8, z: -104 },
  { name: "Kettle Hollow torch", kind: "torch", x: 15, z: -99 },
  { name: "Hollow Way gate brazier", kind: "brazier", x: 8, z: -138 },
  { name: "Spur gate brazier", kind: "brazier", x: 126, z: -108 },
  ...FB_WARP_SITES.map((w) => ({ name: `${w.name} glow`, kind: "crystal" as const, x: w.x, z: w.z, radius: 4.5 })),
  { name: "Wrightsbridge lantern", kind: "lantern", x: -32, z: 69 },
  { name: "Wrightsbridge lantern", kind: "lantern", x: -24, z: 59 },
  { name: "Stoneback Bridge lantern", kind: "lantern", x: 53, z: 69 },
  { name: "Reedwalk lantern", kind: "lantern", x: 50, z: 23 },
  { name: "Whitewashed Chapel candles", kind: "torch", x: -70, z: -70 },
  { name: "Whitewashed Chapel brazier", kind: "brazier", x: -75, z: -74 },
  { name: "Lantern Rock beacon", kind: "fire", x: -139, z: -30, radius: 9 },
  { name: "Kiln Shelf kiln glow", kind: "forge", x: 121, z: 66, radius: 7 },
  { name: "Unnamed Hall brazier", kind: "brazier", x: -95, z: 138 },
];

/** Suggested mood: green-grey shade under the replanted wood. */
export const FB_LIGHT_MOOD = { ambient: [0.66, 0.72, 0.7] as const, playerRadius: 5, playerStrength: 0.32, glow: 0.45, night: 1 };

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function segProject(px: number, pz: number, ax: number, az: number, bx: number, bz: number): { t: number; d: number } {
  const vx = bx - ax;
  const vz = bz - az;
  const l2 = vx * vx + vz * vz || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / l2));
  return { t, d: Math.hypot(px - (ax + vx * t), pz - (az + vz * t)) };
}

/** Low-amplitude deterministic wobble so edges are never ruler-straight. */
export function fbWobble(x: number, z: number, amp = 1): number {
  return (
    amp *
    (0.55 * Math.sin(x * 0.21 + z * 0.13) + 0.3 * Math.sin(x * 0.07 - z * 0.29 + 1.7) + 0.15 * Math.sin(x * 0.53 + z * 0.41))
  );
}

export type RiverHit = { river: FbRiver; surface: number; halfWidth: number; centreDepth: number; dist: number };

/** Nearest river reach containing (x,z), with interpolated surface/width/depth. */
export function fbRiverAt(x: number, z: number): RiverHit | null {
  let best: RiverHit | null = null;
  for (const r of FB_RIVERS) {
    const p = r.points;
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i]!;
      const b = p[i + 1]!;
      const { t, d } = segProject(x, z, a.x, a.z, b.x, b.z);
      const w = a.w + (b.w - a.w) * t + fbWobble(x, z, 0.6);
      if (d > w) continue;
      if (best && d >= best.dist) continue;
      best = { river: r, surface: a.y + (b.y - a.y) * t, halfWidth: w, centreDepth: a.d + (b.d - a.d) * t, dist: d };
    }
  }
  return best;
}

function pointInPoly(x: number, z: number, poly: readonly { x: number; z: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

function distToPoly(x: number, z: number, poly: readonly { x: number; z: number }[]): number {
  let d = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    d = Math.min(d, segProject(x, z, poly[j]!.x, poly[j]!.z, poly[i]!.x, poly[i]!.z).d);
  }
  return d;
}

/** Distance inside the Stillmere shore (positive inside, with a wobbled shoreline), or null outside. */
export function fbLakeSigned(x: number, z: number): number {
  const d = distToPoly(x, z, FB_STILLMERE.outline);
  const inside = pointInPoly(x, z, FB_STILLMERE.outline);
  return (inside ? d : -d) + fbWobble(x * 1.3, z * 1.3, 1.4);
}

export function fbLakeInset(x: number, z: number): number | null {
  const inset = fbLakeSigned(x, z);
  return inset > 0 ? inset : null;
}

/** Water depth below the surface at (x,z) by design (0 = dry). */
export function fbDesignWater(x: number, z: number): { surface: number; depth: number; tier: WaterTier } | null {
  const inset = fbLakeInset(x, z);
  if (inset != null) {
    if (fbIslandAt(x, z)) return null;
    const s = FB_STILLMERE;
    let depth = inset <= s.shelf ? 0.1 + 0.35 * (inset / s.shelf) : Math.min(s.maxDepth, 0.45 + (inset - s.shelf) * 0.22);
    // Islands shelve: wadeable margin round each, then deepening.
    for (const isl of FB_ISLANDS) {
      const d = Math.hypot(x - isl.x, z - isl.z) - isl.r;
      if (d < 6) depth = Math.min(depth, 0.15 + Math.max(0, d) * 0.22);
    }
    for (const sh of FB_SHOALS) {
      if (segProject(x, z, sh.a.x, sh.a.z, sh.b.x, sh.b.z).d <= sh.halfWidth + fbWobble(x * 2, z * 2, 0.3)) depth = Math.min(depth, 0.38);
    }
    return { surface: s.surface, depth, tier: depth <= FB_WADE_DEPTH ? "ford" : "lake" };
  }
  const r = fbRiverAt(x, z);
  if (!r) return null;
  const u = r.dist / Math.max(0.5, r.halfWidth);
  const depth = Math.max(0.05, r.centreDepth * (1 - u * u));
  return { surface: r.surface, depth, tier: depth <= FB_WADE_DEPTH ? "ford" : "deep" };
}

export function fbBridgeAt(x: number, z: number): FbBridge | null {
  for (const b of FB_BRIDGES) {
    if (segProject(x, z, b.a.x, b.a.z, b.b.x, b.b.z).d <= b.halfWidth) return b;
  }
  return null;
}

export function fbAscentAt(x: number, z: number): { ascent: FbAscent; y: number; dist: number } | null {
  for (const a of FB_ASCENTS) {
    const p = a.points;
    for (let i = 0; i < p.length - 1; i++) {
      const A = p[i]!;
      const B = p[i + 1]!;
      const { t, d } = segProject(x, z, A.x, A.z, B.x, B.z);
      if (d <= a.halfWidth + 0.6) return { ascent: a, y: A.y + (B.y - A.y) * t, dist: d };
    }
  }
  return null;
}

export function fbTrailDist(x: number, z: number): number {
  let d = Infinity;
  for (const t of FB_TRAIL_DEFS) {
    for (let i = 0; i < t.points.length - 1; i++) {
      const a = t.points[i]!;
      const b = t.points[i + 1]!;
      d = Math.min(d, segProject(x, z, a.x, a.z, b.x, b.z).d);
    }
  }
  return d;
}

// ------------------------------------------------------------------ set pieces

/** Islands in the Stillmere (lobed by wobble, never round). */
export const FB_ISLANDS: readonly { id: string; name: string; x: number; z: number; r: number; top: number }[] = [
  { id: "heron-isle", name: "Heron Isle", x: 85, z: 30, r: 6, top: 2.9 },
  { id: "rush-isle", name: "Rush Isle", x: 70, z: 13, r: 3.5, top: 2.3 },
];

/** Wadeable shoals: the only dry-shod ways onto the islands. */
export const FB_SHOALS: readonly { id: string; name: string; a: { x: number; z: number }; b: { x: number; z: number }; halfWidth: number }[] = [
  { id: "stepping-shoal", name: "the Stepping Shoal", a: { x: 64, z: 3 }, b: { x: 69, z: 10 }, halfWidth: 1.6 },
  { id: "heron-bar", name: "the Heron Bar", a: { x: 72, z: 15 }, b: { x: 81, z: 26 }, halfWidth: 1.4 },
];

export function fbIslandAt(x: number, z: number): boolean {
  for (const i of FB_ISLANDS) {
    const a = Math.atan2(z - i.z, x - i.x);
    const r = i.r * (1 + 0.22 * Math.sin(a * 3 + i.x) + 0.12 * Math.sin(a * 5 + i.z));
    if (Math.hypot(x - i.x, z - i.z) < r) return true;
  }
  return false;
}

/** Dry ravines: carved below the woods, floor walkable from the open mouth (last point). */
export const FB_GORGES: readonly { id: string; name: string; halfWidth: number; depth: number; points: readonly { x: number; z: number }[] }[] = [
  {
    id: "rooks-throat",
    name: "Rook's Throat",
    halfWidth: 3.6,
    depth: 5,
    points: [{ x: -50, z: -36 }, { x: -45, z: -50 }, { x: -39, z: -64 }, { x: -42, z: -80 }, { x: -35, z: -96 }, { x: -30, z: -110 }],
  },
];

/** Sinkholes by the Swallow: cones the Sinkwater has eaten out of the ground. */
export const FB_SINKS: readonly { id: string; name: string; x: number; z: number; r: number; depth: number }[] = [
  { id: "great-sink", name: "the Great Sink", x: 128, z: -40, r: 7, depth: 5.5 },
  { id: "little-sink", name: "the Little Sink", x: 113, z: -31, r: 4, depth: 3 },
  { id: "pale-sink", name: "the Pale Sink", x: 136, z: -52, r: 4.5, depth: 3.5 },
];

/** Terraced quarry: ground snapped to cut benches inside r. */
export const FB_QUARRY = { id: "graven-cuts", name: "the Graven Cuts", x: 12, z: 124, r: 22, bench: 2.4 } as const;
