/**
 * World POIs / lore markers: the civilization & story layer (data only).
 *
 * Each POI is a place on walkable ground that tells one part of the Black
 * Anvil story in its `story` text and `props`. POIs carrying a
 * `fragmentId` form the campaign thread "The Seven Hands" (see
 * black-anvil-lore/civilization-layer.md §3); `requires` lists fragment ids that
 * must be read before this one is legible. The trail ends off-field at
 * TRAIL_ENDPOINT (the Seven-Stone Ring, Throne Approach): "Struck once, true for all".
 *
 * NOT wired into gameplay, UI or server. Coordinates are zone-local metres
 * (same frame as each zone's walkable function); validated by world-pois.test.ts.
 */

export type PoiZone =
  | "pale_hollow" | "hollow_road" | "forest_basin" | "spur_road" | "ring_ward"
  | "islet_fords" | "green_reach" | "coil_pass" | "coil_ridge";

export type PoiKind =
  | "ruin" | "shrine" | "defaced-statue" | "battlefield" | "grave" | "mine"
  | "waystone" | "lookout" | "warp-remnant" | "old-road" | "works" | "quay";

export interface WorldPoi {
  id: string;
  zone: PoiZone;
  name: string;
  x: number;
  z: number;
  kind: PoiKind;
  /** This place's part of the Black Anvil story, as the player reads it on site. */
  story: string;
  /** Environmental-storytelling props to dress the spot (art brief, not wired). */
  props: string[];
  /** Campaign-thread fragment carried here, if any. */
  fragmentId?: string;
  /** Fragment ids that must already be read for `story` to be legible. */
  requires?: string[];
}

/** "The Seven Hands" fragments in campaign order. */
export const LORE_FRAGMENTS = [
  "f01-crest-over-anvil", "f02-mooring-tally", "f03-mill-census", "f04-saddle-ruts",
  "f05-seventh-post", "f06-drowned-village", "f07-boundary-seven", "f08-older-paving",
  "f09-ring-held", "f10-view-of-seven", "f11-crown-alignment", "f12-scriveners-oath",
  "f13-seven-hands",
] as const;
export type LoreFragmentId = (typeof LORE_FRAGMENTS)[number];

/** Endpoint of the trail (not yet placed: Throne Approach has no field yet). */
export const TRAIL_ENDPOINT = {
  fragmentId: "f14-struck-once", area: "throne_approach", place: "Seven-Stone Ring, Anvil Hall",
  requires: ["f13-seven-hands"],
  story: "Six of the seven stones carry a re-cut House mark. The seventh is plain: its rune is the hammer laid crosswise, the open strike scraped from every defaced Anvil. The Seventh Seat was never a throne. Struck once, true for all.",
} as const;

const F = LORE_FRAGMENTS;
const after = (i: number) => (i > 0 ? [F[i - 1]] : undefined);

export const WORLD_POIS: WorldPoi[] = [
  // ── Pale Hollow ────────────────────────────────────────────────────────
  { id: "ph-crestcut-stele", zone: "pale_hollow", name: "Crestcut Knoll", x: 41, z: 96, kind: "defaced-statue",
    story: "A royal crest is cut shallow over a deeper strike: an Anvil, seven hammer-marks, and something scraped off below the anvil. The stele is older than any crown.",
    props: ["chisel spoil heaped at the base", "lichen line stopping where the new crest begins", "seven pits under the crest"],
    fragmentId: F[0] },
  { id: "ph-moorings-west", zone: "pale_hollow", name: "West Moorings", x: -138, z: 306, kind: "quay",
    story: "Mooring stones with rope-worn grooves stand 5 m above the water. Tally notches on each count cargo in sevens.",
    props: ["rope-groove bollards in dry grass", "a rotted keel rib in the silt", "tally notches grouped in sevens"],
    fragmentId: F[1], requires: after(1) },
  { id: "ph-moorings-north", zone: "pale_hollow", name: "North Moorings", x: -118, z: 390, kind: "quay",
    story: "A paved landing with the old shoreline as a clear terrace; the lake was once wide enough to sail to the saddle.",
    props: ["shell midden", "paving lifted by roots", "a capstan socket"] },
  { id: "ph-dry-millrace", zone: "pale_hollow", name: "Dry Millrace", x: -51, z: 193, kind: "works",
    story: "Cut-stone race lining and a millstone half-buried in the creek bed. Sacks of grain once paid tithe here, in a census the Kings burned.",
    props: ["broken millstone", "race lining in dressed stone", "scorched census tablet shards"],
    fragmentId: F[2], requires: after(2) },
  { id: "ph-old-saddle", zone: "pale_hollow", name: "Old Saddle", x: -4, z: 441, kind: "old-road",
    story: "Wheel ruts worn a hand deep run over the lowest crest — the natural way north, older than the toll gate.",
    props: ["paired wheel ruts in bedrock", "a cart axle pin", "toll-gate sightline back to the ruts"],
    fragmentId: F[3], requires: after(3) },
  { id: "ph-sheepfold-ring", zone: "pale_hollow", name: "The Sheepfold", x: 84, z: 216, kind: "warp-remnant",
    story: "Rune stones ring a sunken floor at the old crossroads: a Time Mage circle of the pre-Kings network, dormant.",
    props: ["rune stones under turf", "sunken paving floor", "no sheep dung anywhere"] },
  { id: "ph-westwatch-lookout", zone: "pale_hollow", name: "Westwatch", x: -198, z: 90, kind: "lookout",
    story: "From here the old shore terrace reads as one ring around the Ash Pit, and the saddle ruts line up with the defaced stele.",
    props: ["ruined watch-hut footing", "sighting notch cut in a boulder", "cairn of dressed stones"] },
  { id: "ph-copper-adit", zone: "pale_hollow", name: "Old Adit", x: 32, z: 407, kind: "mine",
    story: "Tool marks in the adit are bronze, not iron; the seam was worked long before the Writ and the tally on the lintel counts in sevens.",
    props: ["bronze pick-head", "lintel tally", "soot of a forge-stone hearth"] },
  { id: "ph-twofold-graves", zone: "pale_hollow", name: "Twofold Barrows", x: 16, z: 252, kind: "battlefield",
    story: "Low barrows along the confluence, laid in rows of seven; arrowheads in the bank are royal pattern.",
    props: ["barrow mounds in rows", "royal-pattern arrowheads", "a cracked forge-stone grave marker"] },

  // ── Hollow Road ────────────────────────────────────────────────────────
  { id: "hr-kings-milestone", zone: "hollow_road", name: "First Milestone", x: 4, z: 25, kind: "waystone",
    story: "The numeral is cut into a reused block; the underside bears an older waymark pointing east, off the road.",
    props: ["upturned waymark face", "survey peg holes", "road gravel over older cobbles"] },
  { id: "hr-seven-posts", zone: "hollow_road", name: "The Seven Posts", x: 5, z: 64, kind: "warp-remnant",
    story: "Seven stones in a ring beside the camp; no road has seven miles. They are a warp circle's boundary stones, the seventh deliberately broken.",
    props: ["seven toppled stones, one shattered", "ring of flattened grass", "camp fire-pit kept outside the ring"],
    fragmentId: F[4], requires: after(4) },
  { id: "hr-dressed-shoulder", zone: "hollow_road", name: "Dressed Shoulder", x: -4, z: 118, kind: "old-road",
    story: "The shoulders are dressed stone: the pass was cut. The land's own path runs the ravine east, where older cairns still stand.",
    props: ["chisel-faced road walls", "quarry wedge slots", "a cairn visible in the ravine"] },

  // ── Forest Basin ───────────────────────────────────────────────────────
  { id: "fb-counting-ring", zone: "forest_basin", name: "Counting Ring", x: -6, z: -112, kind: "warp-remnant",
    story: "Moss-split stones under trees that are all one age: the forest was planted after a burning, the ring left standing.",
    props: ["moss-split circle stones", "even-aged trunks", "charcoal layer in a root hole"] },
  { id: "fb-drowned-spoke", zone: "forest_basin", name: "Drowned Spoke", x: -38, z: 100, kind: "ruin",
    story: "The spoke runs into the mere. Roof-beams show under the water; the village was flooded and kept on the map to collect its tithe.",
    props: ["road ending at the water", "chimney tops in the shallows", "tithe post still standing"],
    fragmentId: F[5], requires: after(5) },
  { id: "fb-valley-cross", zone: "forest_basin", name: "Valley Cross Graves", x: -14, z: 75, kind: "grave",
    story: "The graves face the mere, not the road: Merewick's dead, buried by survivors who could no longer go home.",
    props: ["graves facing the water", "carved door-lintels used as headstones", "wilted offerings"] },
  { id: "fb-west-ridge-lookout", zone: "forest_basin", name: "West Ridge Top", x: -150, z: 28, kind: "lookout",
    story: "From the top, the six spokes meet at the Counting Ring, not at the Kings' camp — the basin was laid out around the circle.",
    props: ["spoke sighting stones", "a wind-worn survey cairn"] },
  { id: "fb-corner-lookout", zone: "forest_basin", name: "High Ridge Corner", x: 142, z: -132, kind: "lookout",
    story: "The watch-post faces inward, at the basin: built to watch the foresters, not the road.",
    props: ["arrow-slit facing the basin", "ration crates with royal seals"] },
  { id: "fb-north-pass-shrine", zone: "forest_basin", name: "Sealed Pass Shrine", x: -22, z: 116, kind: "shrine",
    story: "A Struck Faith shrine at the rockfall; the fall is quarried blocks, stacked.",
    props: ["shrine niche with struck rune", "squared blocks in the rockfall", "pilgrim tokens"] },

  // ── Spur Road ──────────────────────────────────────────────────────────
  { id: "sr-seven-stones", zone: "spur_road", name: "Seven-Stone Bench", x: 5, z: 64, kind: "warp-remnant",
    story: "Seven stones on the bench mark a boundary no charter records — the edge of a free hold, counted in sevens like the moorings.",
    props: ["seven standing stones", "boundary oath cut in Anvil-reckoning"],
    fragmentId: F[6], requires: after(6) },
  { id: "sr-toll-ledger", zone: "spur_road", name: "Toll-Keeper's Cairn", x: -4, z: 140, kind: "waystone",
    story: "Older tolls cut below the royal one were paid in labour, not coin.",
    props: ["layered toll schedules", "coin slot added later"] },

  // ── Ring Ward ──────────────────────────────────────────────────────────
  { id: "rw-older-paving", zone: "ring_ward", name: "Older Paving", x: -29, z: 52, kind: "warp-remnant",
    story: "The paving circle is older than the walls; the walls bend around it because the builders dared not cut it.",
    props: ["wall kinked around the circle", "paving worn by feet older than the street"],
    fragmentId: F[7], requires: after(7) },
  { id: "rw-canal-quay", zone: "ring_ward", name: "West Canal Steps", x: -64, z: 20, kind: "quay",
    story: "The canal follows a natural channel; the steps were cut for boats coming from the Ash Pit side.",
    props: ["worn boat steps", "mooring rings matching Pale Hollow's"] },
  { id: "rw-wharf-tallies", zone: "ring_ward", name: "Wharf Tallies", x: 69, z: -49, kind: "works",
    story: "Tally walls count cargo in sevens, then a royal hand switches to tens mid-wall.",
    props: ["tally wall with a change of hand"] },

  // ── Islet Fords ────────────────────────────────────────────────────────
  { id: "if-ring-held", zone: "islet_fords", name: "Islet Ring", x: 96, z: 4, kind: "warp-remnant",
    story: "Stones stand above the flood line on a dry islet. The river has moved; the ring has not.",
    props: ["stones with flood rings below them", "old river bank far to the side"],
    fragmentId: F[8], requires: after(8) },
  { id: "if-west-cairn", zone: "islet_fords", name: "West Cairn", x: 32, z: 2, kind: "grave",
    story: "Ferrymen's graves, with ferry tokens of the old network.",
    props: ["ferry tokens", "oar planted as marker"] },
  { id: "if-east-causeway", zone: "islet_fords", name: "Broken Causeway", x: 160, z: -2, kind: "old-road",
    story: "Causeway stones under the shallows link the islets in a straight line.",
    props: ["submerged causeway blocks", "a bollard on the islet"] },

  // ── Green Reach ────────────────────────────────────────────────────────
  { id: "gr-ungrazed-ring", zone: "green_reach", name: "Ungrazed Ring", x: -26, z: 26, kind: "warp-remnant",
    story: "A grassed-over ring at the trail fan; shepherds will not graze it, and the grass grows in seven bands.",
    props: ["untouched grass circle", "shepherd's warding cords"] },
  { id: "gr-white-caps-lookout", zone: "green_reach", name: "White Caps Summit", x: 40, z: 45, kind: "lookout",
    story: "From the summit the seven ring sites of the north line up on one bearing, pointing at the Broken Stair.",
    props: ["sighting stones aligned north", "a cut bearing line"],
    fragmentId: F[9], requires: after(9) },
  { id: "gr-east-cap-ledge", zone: "green_reach", name: "East Cap Ledge", x: 70, z: 30, kind: "lookout",
    story: "A sentry niche with Unwritten graffiti mocking the Ledger.",
    props: ["carved niche", "graffiti"] },
  { id: "gr-hollow-stair", zone: "green_reach", name: "Hollow Stair Top", x: -20, z: 70, kind: "shrine",
    story: "A Struck Faith refuge at the top of the cave stair: names of erased Time Mages struck in stone.",
    props: ["name wall", "sleeping pallets", "forge-stone lamp"] },
  { id: "gr-south-point", zone: "green_reach", name: "South Point Barrow", x: 20, z: -58, kind: "grave",
    story: "A family barrow, no weapons.",
    props: ["barrow", "toys among grave goods"] },

  // ── Coil Pass ──────────────────────────────────────────────────────────
  { id: "cp-milestone", zone: "coil_pass", name: "Switchback Marker", x: 2, z: 44, kind: "waystone",
    story: "An older marker below the royal one shows the pass climbed by carts.",
    props: ["two marker faces"] },
  { id: "cp-crown-stones", zone: "coil_pass", name: "Crown Stones", x: 4, z: 116, kind: "warp-remnant",
    story: "The stones are aligned to the Ember Crown summit: the ring was oriented to a beacon that no longer burns.",
    props: ["aligned stones", "a sighting gap toward the Crown"],
    fragmentId: F[10], requires: after(10) },

  // ── Coil Ridge ─────────────────────────────────────────────────────────
  { id: "cr-scarp-cave-shrine", zone: "coil_ridge", name: "Scarp Cave Shrine", x: -67, z: -72, kind: "shrine",
    story: "Inside the cave climb, the Scriveners' Oath struck in stone: seven hands sworn to record, never rule. Six signatures are re-cut as crowns; the seventh is a hammer laid crosswise.",
    props: ["oath wall", "scribe's inkstones"],
    fragmentId: F[11], requires: after(11) },
  { id: "cr-scarp-head-ring", zone: "coil_ridge", name: "Scarp Head Ring", x: 6, z: -32, kind: "warp-remnant",
    story: "The stair's last landing is a ring older than the stair: seven handprints, six of them under crowns. The seventh hand left the hammer open and walked away unwritten. The ring's glassed north face points the way on, to the Seven-Stone Ring.",
    props: ["ring stones", "seven handprints", "north face fused to glass"],
    fragmentId: F[12], requires: after(12) },
  { id: "cr-stele-field", zone: "coil_ridge", name: "Stele Field", x: -66, z: 64, kind: "defaced-statue",
    story: "Steles with names chiselled off; the shapes of the gaps match the Struck Faith name wall.",
    props: ["defaced steles", "chisel spoil"] },
  { id: "cr-toppled-gatehouse", zone: "coil_ridge", name: "Toppled Gatehouse", x: 52, z: 22, kind: "ruin",
    story: "Toppled from inside; siege stones lie within the walls.",
    props: ["inward-fallen walls", "siege stones"] },
  { id: "cr-mirror-tarn", zone: "coil_ridge", name: "Mirror Tarn", x: -14, z: 24, kind: "battlefield",
    story: "The tarn floor is glassed rock — the same burn as the ring's face; bones lie in the shallows.",
    props: ["glassy shore", "bones in the shallows"] },
];
