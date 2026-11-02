// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

/**
 * Forest Basin points of interest: the things worth stopping for along (and
 * off) every route. Pure data; bake-props turns each `kind` into a prop recipe
 * and the render/light tools read `light`. Coordinates are zone-local metres.
 */

export type FbPoiKind =
  | "grove" | "glade" | "thicket" | "fungus" | "hollow-tree" | "fallen-giant"
  | "forge" | "statue" | "vault" | "aqueduct" | "waystone" | "edict" | "village" | "sunken"
  | "charcoal" | "hermit" | "shrine" | "cult" | "den" | "vista" | "cache" | "camp"
  | "falls" | "quarry" | "sink" | "gorge" | "isle" | "ruin";

export type FbPoi = {
  id: string;
  name: string;
  x: number;
  z: number;
  kind: FbPoiKind;
  story: string;
  light?: "fire" | "lantern" | "forge" | "brazier" | "crystal" | "torch";
};

const P = (id: string, name: string, x: number, z: number, kind: FbPoiKind, story: string, light?: FbPoi["light"]): FbPoi =>
  ({ id, name, x, z, kind, story, light });

export const FB_POIS: readonly FbPoi[] = [
  // ---- the Hollow Way (south gate to the Scraped Ring)
  P("gatewarden-stone", "the Gatewarden's Stone", 2, -131, "edict",
    "A New Kings edict stone, bolted over a makers' carving of three hands at an anvil. The bolts have rusted; a finger of the carving shows through.", "torch"),
  P("underhill-woodlot", "Underhill's Woodlot", 22, -121, "camp",
    "Garth Underhill's stacks and saw-horse. He sells rope and axe-heads and will tell you which trees the Crown counted.", "lantern"),
  P("ninefold-ring", "the Ninefold Ring", 13, -84, "fungus",
    "Nine pale caps in a ring that glows after dusk. Children of the woodlot dare each other to sleep inside it.", "crystal"),
  P("faceless-wright", "the Faceless Wright", -7, -69, "statue",
    "A toppled statue of a maker holding a level. The face was chiselled flat; the tool marks are newer than the moss.", undefined),
  P("aldrics-waystone", "Aldric's Waystone", -3, -53, "waystone",
    "A mile-stone with its maker-script scraped off. Someone has scratched a name back in: Aldric. Nobody remembers who he was."),
  P("brannock-grove", "Brannock Grove", -21, -38, "grove",
    "Old-growth the burn missed: spruce five arms round. Under them the ground is soft and silent."),
  P("wennas-shrine", "Wenna's Shrine", -4, -27, "shrine",
    "A cairn shrine heaped with river pebbles, each one painted with a name. Woodcutters leave one for every friend the wood took.", "lantern"),
  P("hollow-oak", "the Hollow Oak", -24, -17, "hollow-tree",
    "A giant split by lightning and hollowed by time. Climb in: a cache of trapper's goods sits on a shelf of fungus inside."),
  P("corbel-stone", "the Corbel Stone", -11, -5, "waystone",
    "A scraped waystone at the ledge fork. The New Kings' surveyors painted a white arrow on it pointing to the Chapel."),
  // ---- the Wrights' Road
  P("coalhurst-kilns", "the Coalhurst Kilns", -10, 27, "charcoal",
    "Abel and Hild Coalhurst burn charcoal here in three turf kilns. The smoke never stops; neither does Hild.", "forge"),
  P("thornwall", "the Thornwall", -33, 36, "thicket",
    "A blackthorn tangle that squeezes the road to a single cart's width. Boars nest in the heart of it."),
  P("old-ashlin", "Old Ashlin", -50, 73, "village",
    "The makers' village the road was built to serve. Roofless now, birch growing from the hearths. The Crown's map calls it 'clearing'."),
  P("cold-forges", "the Cold Forges", -58, 81, "forge",
    "Three collapsed forges in a row, anvils still bedded in the stone. One hearth has been relit by someone who doesn't want to be found.", "forge"),
  P("ashlin-aqueduct", "the Ashlin Aqueduct", -66, 88, "aqueduct",
    "Five pillars march toward the Wrights' Spring; the channel they carried fell long ago. The Briarwater took its old bed back."),
  P("wrights-veil", "the Wright's Veil", -93, 117, "falls",
    "The Briarwater drops off a ledge of grey fell-stone into a round, deep pool. Behind the curtain the rock is carved with a maker's mark.", "lantern"),
  P("fenstone-pool", "Fenstone Pool", -88, 111, "vista",
    "The plunge pool below the Veil, named for Orla Fenstone who cut the first channel. Deep enough to swim; cold enough to regret it."),
  // ---- the Mere Path
  P("reedes-camp", "Reede's Camp", 5, 16, "camp",
    "Tobin Reede, a scholar from the coast, is copying the scraped waystones by charcoal rubbing. He pays for every one you bring.", "lantern"),
  P("merrow-stone", "the Merrow Stone", 17, 6, "waystone",
    "Scraped, but carelessly: half a line of maker-script survives. Reede has been staring at it for a week."),
  P("fernglade", "the Fernglade", 29, 18, "glade",
    "A sunlit glade of chest-high fern. Hares by day, glowing moths by night."),
  P("sunk-hall", "the Sunk Hall", 55, 10, "sunken",
    "A makers' hall half-drowned in the Stillmere shelf. Wade in to the doorway; the lintel names it the Hall of Edrin."),
  P("old-landing", "the Old Landing", 47, 44, "ruin",
    "Stone jetty footings where barges once took iron down the Briarwater. Rope-wear still grooves the bollards."),
  P("otter-holt", "the Otter Holt", 70, 80, "den",
    "Bank burrows under a root-mat by the Coldrun. The otters steal anything shiny."),
  P("rush-isle", "Rush Isle", 70, 13, "isle",
    "Reeds and one leaning willow-stump, reached by the Stepping Shoal. A heron's cache of bright things lies in the reeds."),
  P("heron-isle", "Heron Isle", 85, 30, "isle",
    "The larger island, wading-reachable along the Heron Bar. A makers' boundary stone stands at its crown, unscraped: no one from the Crown ever got their feet wet."),
  P("heron-cache", "the Heron Cache", 86, 31, "cache",
    "A sealed iron box under the boundary stone."),
  // ---- the Graven Fells
  P("graven-cuts", "the Graven Cuts", 9, 119, "quarry",
    "Terraced quarry benches stepping up the fell. Blocks from here built Wrightsbridge and Stoneback.", "torch"),
  P("cutters-crown", "the Cutters' Crown", 22, 140, "vista",
    "The top bench. The whole basin opens below: the Stillmere, both rivers, the white smudge of the Chapel."),
  P("cutters-cache", "the Cutters' Strongbox", 23, 141, "cache",
    "The quarry-master's strongbox, left when the Crown closed the cuts."),
  // ---- the Kiln Path
  P("brokenback-forge", "the Brokenback Forge", 72, -20, "forge",
    "A maker forge whose chimney fell across the road. The path climbs over it.", "brazier"),
  P("sealed-vault", "the Sealed Vault", 92, -26, "vault",
    "A stone door set into the hill, sealed with a makers' wheel-lock no one alive can turn. Fresh pry-marks: someone keeps trying."),
  P("boar-wallow", "the Boar Wallow", 127, 9, "den",
    "Churned mud and gored saplings. The boars here are big."),
  P("ashdown-hut", "Ashdown's Hut", 104, 42, "hermit",
    "Old Corwin Ashdown's turf hut on the mere's east shore. He was a maker's apprentice once, and is the last who will admit it.", "lantern"),
  // ---- the Spur Way and the sinks
  P("bracken-glade", "the Bracken Glade", 31, -114, "glade",
    "A clearing of rust-red bracken where deer lie up at noon."),
  P("long-fall", "the Long Fall", 51, -96, "fallen-giant",
    "A giant spruce lies across the slope for thirty paces, moss-furred. Walk its length to a nest of hare-runs."),
  P("the-brambles", "the Brambles", 71, -114, "thicket",
    "Bramble thicket on both sides of the Spur Way. Something rustles in it, always."),
  P("adders-rest", "Adder's Rest", 90, -99, "den",
    "Sun-warmed boulders, shed skins, and bones. Step lightly."),
  P("great-sink", "the Great Sink", 128, -40, "sink",
    "The ground simply gave way here, eaten from below by the Sinkwater. Stairs cut by someone go down; the Swallow Cut climbs out the far side.", "crystal"),
  P("little-sink", "the Little Sink", 113, -31, "sink",
    "A young sinkhole, edges still crumbling. Glowcaps grow on the wet walls.", "crystal"),
  P("pale-sink", "the Pale Sink", 136, -52, "sink",
    "Chalky walls and a floor of white silt."),
  P("swallows-brow", "the Swallow's Brow", 147, -51, "vista",
    "The knoll above the sinks: the Sinkwater vanishing into the Swallow, and beyond, the Spurgate road."),
  P("brow-cache", "the Delver's Cache", 148, -52, "cache",
    "A delver's bundle, rope and lamp-oil, wedged in a crack at the top of the Cut."),
  // ---- the Chapel Track
  P("rooks-throat", "Rook's Throat", -42, -80, "gorge",
    "A dry ravine split into the forest floor, rooks nesting in the walls. Its mouth opens to the south.", undefined),
  P("rope-span", "the Rope Span", -39, -64, "vista",
    "Plank-and-rope bridge over Rook's Throat. The Chapel keeps it in good repair, and counts who crosses."),
  P("rooks-cache", "Rook's Cache", -41, -84, "cache",
    "On the gorge floor below the Span: a pilgrim's pack that went over the rail."),
  P("pale-watch", "the Pale Watch", -57, -76, "cult",
    "A cult picket in whitewashed tents. Sister Pumice reads the sermons here at dusk; the braziers burn all night.", "brazier"),
  P("chapel-braziers", "the Chapel Steps", -70, -68, "cult",
    "The whitewashed approach to the Chapel, lined with braziers.", "brazier"),
  // ---- the Ledge Track
  P("lantern-caps", "the Lantern Caps", -33, -20, "fungus",
    "A ring of tall fungus that glows a soft green at night. The Chapel says they mark where a maker died.", "crystal"),
  P("boar-hollow", "Boar Hollow", -51, -27, "den",
    "A mud-dip beside the track, rooted bare."),
  P("gannet-stone", "the Gannet Stone", -68, -29, "waystone",
    "A scraped waystone with a New Kings edict nailed to it, and beneath the nails, a carving of a heron.", "torch"),
  P("kestrel-shelf", "the Kestrel Shelf", -124, -55, "vista",
    "A ledge loop off the Goat Ledges to a shelf where kestrels hunt. Look back: the Hollow Oak, the Chapel, the whole western wood."),
  P("kestrel-cache", "the Kestrel Cache", -125, -56, "cache",
    "A goatherd's oilskin cache tucked under the shelf's lip."),
];

/** NPC placements for the field population (zone-local). */
export const FB_NPCS: readonly { id: string; name: string; x: number; z: number; role: "guide" | "quest_giver" | "crafter" | "vendor"; lines: string }[] = [
  { id: "fb-oswy", name: "Oswy Fernhallow", x: 16, z: -98, role: "guide",
    lines: "Welcome to the Basin. Follow the Hollow Way north to the Scraped Ring. The Coalhursts' kilns smoke east of the road; the Chapel's pickets west. And if you hear water falling, that's the Wright's Veil. Worth the walk." },
  { id: "fb-garth", name: "Garth Underhill", x: 21, z: -119, role: "vendor",
    lines: "Rope, axe-heads, lamp-oil. You'll want rope if you're going down the sinks." },
  { id: "fb-abel", name: "Abel Coalhurst", x: -12, z: 25, role: "crafter",
    lines: "Charcoal for the forges, what's left of them. Bring me good timber from Brannock Grove and I'll make you something that burns hot." },
  { id: "fb-hild", name: "Hild Coalhurst", x: -7, z: 29, role: "quest_giver",
    lines: "Someone's been lighting a hearth at the Cold Forges and stealing my charcoal to do it. Find out who. Tell Abel and you'll never hear the end of it." },
  { id: "fb-corwin", name: "Old Corwin Ashdown", x: 103, z: 40, role: "quest_giver",
    lines: "The vault by the Kiln Path? I know how the wheel-lock turns. Three marks: one on Heron Isle, one under the Veil, one at the Sunk Hall. Bring me rubbings and we'll see." },
  { id: "fb-tobin", name: "Tobin Reede", x: 6, z: 14, role: "quest_giver",
    lines: "Every waystone in this basin was scraped, but not every scraper was thorough. Rub the Merrow Stone, the Gannet Stone, Aldric's. Bring me what survives." },
  { id: "fb-pumice", name: "Sister Pumice", x: -56, z: -73, role: "quest_giver",
    lines: "Peace, traveller. The Chapel needs a pilgrim's pack fetched from the bottom of Rook's Throat. Unopened, mind. The Chapel will know." },
];

/** Hand-placed mob packs (zone-local). Levels rise away from the gate. */
export const FB_MOB_PACKS: readonly { id: string; archetype: string; name?: string; x: number; z: number; level: number; n: number }[] = [
  { id: "bracken-hares", archetype: "dust_hare", x: 33, z: -112, level: 8, n: 3 },
  { id: "long-fall-hares", archetype: "dust_hare", x: 55, z: -92, level: 8, n: 2 },
  { id: "ninefold-slimes", archetype: "pale_slime", x: 17, z: -80, level: 8, n: 2 },
  { id: "adders", archetype: "cliff_adder", x: 92, z: -95, level: 10, n: 2 },
  { id: "thornwall-boars", archetype: "ashbeam_boar", x: -38, z: 32, level: 9, n: 2 },
  { id: "boar-hollow", archetype: "ashbeam_boar", x: -50, z: -31, level: 9, n: 2 },
  { id: "boar-wallow", archetype: "ashbeam_boar", x: 127, z: 13, level: 11, n: 3 },
  { id: "mere-crabs", archetype: "clay_crab", x: 46, z: 40, level: 9, n: 2 },
  { id: "isle-crabs", archetype: "clay_crab", x: 84, z: 27, level: 10, n: 2 },
  { id: "forge-scavengers", archetype: "hollow_scavenger", x: -56, z: 77, level: 10, n: 3 },
  { id: "ashlin-dwellers", archetype: "ruin_dweller", x: -47, z: 70, level: 10, n: 2 },
  { id: "vault-golem", archetype: "seam_golem", x: 95, z: -22, level: 12, n: 1 },
  { id: "sink-wights", archetype: "shard_wight", x: 128, z: -42, level: 12, n: 2 },
  { id: "cuts-golem", archetype: "seam_golem", x: 14, z: 127, level: 11, n: 1 },
  { id: "gorge-adders", archetype: "cliff_adder", x: -40, z: -88, level: 10, n: 2 },
  { id: "pale-watch", archetype: "hollow_scavenger", name: "Brother Lime", x: -60, z: -78, level: 11, n: 1 },
  { id: "pale-watch-2", archetype: "hollow_scavenger", name: "Sister Chalk", x: -54, z: -79, level: 11, n: 1 },
  { id: "chapel-steps", archetype: "ruin_dweller", name: "Brother Whitewash", x: -68, z: -66, level: 12, n: 1 },
  { id: "veil-slimes", archetype: "pale_slime", x: -84, z: 106, level: 10, n: 2 },
];
