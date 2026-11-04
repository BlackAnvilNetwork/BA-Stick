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
    "Garth Underhill's stacks and saw-horse. He sells rope and axe-heads and will tell you which trees the Crown marked for felling.", "lantern"),
  P("ninefold-ring", "the Ninefold Ring", 13, -84, "fungus",
    "Nine pale caps in a ring that glows after dusk. Children of the woodlot dare each other to sleep inside it.", "crystal"),
  P("faceless-wright", "the Faceless Wright", -7, -69, "statue",
    "A toppled statue of a maker holding a level. The face was chiselled flat; the tool marks are newer than the moss.", undefined),
  P("aldrics-waystone", "Aldric's Waystone", -8, -50, "waystone",
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
  P("thornwall", "the Thornwall", -19.5, 36, "thicket",
    "A blackthorn tangle that squeezes the road to a single cart's width. Boars nest in the heart of it."),
  P("old-ashlin", "Old Ashlin", -50, 73, "village",
    "The makers' village the road was built to serve. Roofless now, birch growing from the hearths. The Crown's map calls it 'clearing'."),
  P("cold-forges", "the Cold Forges", -56, 72, "forge",
    "Three collapsed forges in a row, anvils still bedded in the stone. One hearth has been relit by someone who doesn't want to be found.", "forge"),
  P("ashlin-aqueduct", "the Ashlin Aqueduct", -57, 88, "aqueduct",
    "Arches stride west from Old Ashlin to the rim. A bucket-lift in the Briarwater still heaves water into the channel; one bay is down."),
  P("wrights-veil", "the Wright's Veil", -84, 121, "falls",
    "The Briarwater drops off a ledge of grey fell-stone into a round, deep pool. Behind the curtain the rock is carved with a maker's mark.", "lantern"),
  P("fenstone-pool", "Fenstone Pool", -86, 116.5, "vista",
    "Seen from the stair landing: the plunge pool below the Veil, named for Orla Fenstone who cut the first channel. Deep enough to swim; cold enough to regret it."),
  // ---- the Mere Path
  P("reedes-camp", "Reede's Camp", 5, 16, "camp",
    "Tobin Reede, a scholar from the coast, is copying the scraped waystones by charcoal rubbing. He pays for every one you bring.", "lantern"),
  P("merrow-stone", "the Merrow Stone", 17, 8, "waystone",
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
  P("ember-cairn", "the Ember Cairn", 125, 22, "shrine",
    "A cairn of fire-cracked stones where the charcoal carters stop to tip a coal for luck before the climb.", "fire"),
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
  P("the-brambles", "the Brambles", 71.5, -111, "thicket",
    "Bramble thicket on both sides of the Spur Way. Something rustles in it, always."),
  P("adders-rest", "Adder's Rest", 90, -99, "den",
    "Sun-warmed boulders, shed skins, and bones. Step lightly."),
  P("great-sink", "the Great Sink", 124, -30, "sink",
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
    "Plank-and-rope bridge over Rook's Throat. The Chapel keeps it in good repair, and watches who crosses."),
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
  { id: "fb-garth", name: "Garth Underhill", x: 26, z: -125, role: "vendor",
    lines: "Rope, axe-heads, lamp-oil. You'll want rope if you're going down the sinks." },
  { id: "fb-abel", name: "Abel Coalhurst", x: -16, z: 22, role: "crafter",
    lines: "Charcoal for the forges, what's left of them. Bring me good timber from Brannock Grove and I'll make you something that burns hot." },
  { id: "fb-hild", name: "Hild Coalhurst", x: -12, z: 26, role: "quest_giver",
    lines: "Someone's been lighting a hearth at the Cold Forges and stealing my charcoal to do it. Find out who. Tell Abel and you'll never hear the end of it." },
  { id: "fb-corwin", name: "Old Corwin Ashdown", x: 104, z: 42, role: "quest_giver",
    lines: "The vault by the Kiln Path? I know how the wheel-lock turns. Three marks: one on Heron Isle, one under the Veil, one at the Sunk Hall. Bring me rubbings and we'll see." },
  { id: "fb-tobin", name: "Tobin Reede", x: 0, z: 12, role: "quest_giver",
    lines: "Every waystone in this basin was scraped, but not every scraper was thorough. Rub the Merrow Stone, the Gannet Stone, Aldric's. Bring me what survives." },
  { id: "fb-pumice", name: "Sister Pumice", x: -56, z: -70, role: "quest_giver",
    lines: "Peace, traveller. The Chapel needs a pilgrim's pack fetched from the bottom of Rook's Throat. Unopened, mind. The Chapel will know." },
];

/** Hand-placed mob packs (zone-local). Levels rise away from the gate. */
export const FB_MOB_PACKS: readonly { id: string; archetype: string; name?: string; names?: readonly string[]; x: number; z: number; level: number; n: number }[] = [
  { id: "bracken-hares", archetype: "dust_hare", x: 38, z: -117, level: 8, n: 3 },
  { id: "long-fall-hares", archetype: "dust_hare", x: 55, z: -92, level: 8, n: 2 },
  { id: "ninefold-slimes", archetype: "pale_slime", x: 21, z: -75, level: 8, n: 2 },
  { id: "adders", archetype: "cliff_adder", x: 92, z: -95, level: 10, n: 2 },
  { id: "thornwall-boars", archetype: "ashbeam_boar", x: -30, z: 28, level: 9, n: 2 },
  { id: "boar-hollow", archetype: "ashbeam_boar", x: -50, z: -31, level: 9, n: 2 },
  { id: "boar-wallow", archetype: "ashbeam_boar", x: 132, z: 16, level: 11, n: 3 },
  { id: "mere-crabs", archetype: "clay_crab", x: 46, z: 40, level: 9, n: 2 },
  { id: "shore-crabs", archetype: "clay_crab", x: 101, z: 47, level: 10, n: 2 },
  { id: "forge-scavengers", archetype: "hollow_scavenger", x: -56, z: 72, level: 10, n: 3 },
  { id: "ashlin-dwellers", archetype: "ruin_dweller", x: -44, z: 64, level: 10, n: 2 },
  { id: "vault-golem", archetype: "seam_golem", x: 95, z: -22, level: 12, n: 1 },
  { id: "sink-wights", archetype: "shard_wight", x: 119.5, z: -41, level: 12, n: 1 },
  { id: "cuts-golem", archetype: "seam_golem", x: 14, z: 127, level: 11, n: 1 },
  { id: "gorge-adders", archetype: "cliff_adder", x: -38.5, z: -88, level: 10, n: 2 },
  { id: "pale-watch", archetype: "hollow_scavenger", names: ["Brother Lime", "Sister Chalk"], x: -62, z: -82, level: 11, n: 2 },
  { id: "chapel-steps", archetype: "ruin_dweller", name: "Brother Whitewash", x: -78, z: -58, level: 12, n: 1 },
  { id: "veil-slimes", archetype: "pale_slime", x: -80, z: 113, level: 10, n: 2 },
];

/** Kill tasks match Pale Hollow. A fetch is walked to, then brought back. There is no escort. */
export type FbQuestSite = { id: string; name: string; x: number; z: number; r: number; line: string };

export type FbQuestDef = {
  id: string;
  npcId: string;
  title: string;
  offer: string;
  progress: string;
  done: string;
  gold: number;
  need: number;
  mobIds: readonly string[];
  kind?: "kill" | "fetch";
  sites?: readonly FbQuestSite[];
};

export type FbQuestBag = {
  active: { id: string; kills: number; seen?: string[] }[];
  done: string[];
};

function packIds(pack: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => `fb-${pack}-${i}`);
}

export const FB_QUESTS: readonly FbQuestDef[] = [
  {
    id: "fb-cold-hearth",
    npcId: "fb-hild",
    title: "The Cold Hearth",
    offer: "Someone lights a hearth at the Cold Forges and feeds it with my charcoal. The scavengers there are the ones. Put them down, and don't tell Abel.",
    progress: "The hearth at the Cold Forges is still lit.",
    done: "The Cold Forges are quiet. Abel can wonder where his charcoal went.",
    gold: 24,
    need: 3,
    mobIds: packIds("forge-scavengers", 3),
  },
  {
    id: "fb-last-stones",
    npcId: "fb-tobin",
    title: "The Last Stones",
    kind: "fetch",
    offer: "Every waystone in this basin was scraped, but not every scraper was thorough. Take a rubbing from the Merrow Stone, the Gannet Stone, and Aldric's Waystone. Bring me what survives.",
    progress: "The stones still want a rubbing.",
    done: "These are enough. The names are gone, but the marks under them are not.",
    gold: 18,
    need: 3,
    mobIds: [],
    sites: [
      { id: "merrow", name: "the Merrow Stone", x: 17, z: 8, r: 4, line: "You take a rubbing from the Merrow Stone." },
      { id: "gannet", name: "the Gannet Stone", x: -68, z: -29, r: 4, line: "You take a rubbing from the Gannet Stone." },
      { id: "aldric", name: "Aldric's Waystone", x: -8, z: -50, r: 4, line: "You take a rubbing from Aldric's Waystone." },
    ],
  },
  {
    id: "fb-wheel-lock",
    npcId: "fb-corwin",
    title: "The Wheel-Lock",
    offer: "The vault by the Kiln Path has woken its guardian. The wheel-lock will not turn while that thing stands. Put it down.",
    progress: "The vault's guardian is still standing.",
    done: "The guardian is down. Bring me rubbings from Heron Isle, from under the Wright's Veil, and from the Sunk Hall, and I will turn the wheel.",
    gold: 32,
    need: 1,
    mobIds: packIds("vault-golem", 1),
  },
  {
    id: "fb-pilgrims-pack",
    npcId: "fb-pumice",
    title: "The Pilgrim's Pack",
    kind: "fetch",
    offer: "Peace, traveller. A pilgrim's pack lies at the bottom of Rook's Throat. Fetch it up. Unopened, mind. The Chapel will know.",
    progress: "The pack is still at the bottom of Rook's Throat.",
    done: "Leave it shut. The Chapel will know you brought it.",
    gold: 20,
    need: 1,
    mobIds: [],
    sites: [{
      id: "rooks-cache",
      name: "Rook's Cache",
      x: -41,
      z: -84,
      r: 8,
      line: "The pilgrim's pack is here. You leave it shut.",
    }],
  },
];

export function forestBasinQuestByNpc(npcId: string): FbQuestDef | undefined {
  return FB_QUESTS.find((quest) => quest.npcId === npcId);
}

export function forestBasinQuestById(id: string): FbQuestDef | undefined {
  return FB_QUESTS.find((quest) => quest.id === id);
}

export function forestBasinQuestLogEntries(state: FbQuestBag) {
  return state.active.flatMap((entry) => {
    const quest = forestBasinQuestById(entry.id);
    if (!quest) return [];
    return [{
      id: quest.id,
      title: quest.title,
      kills: entry.kills,
      need: quest.need,
      progress: quest.progress,
      ready: entry.kills >= quest.need,
    }];
  });
}

/** Stand on a fetch site to take what it holds. The same site does not count twice. */
export function forestBasinQuestVisit(
  state: FbQuestBag,
  x: number,
  z: number,
): { state: FbQuestBag; found: FbQuestSite[] } {
  const found: FbQuestSite[] = [];
  const active = state.active.map((entry) => {
    const quest = forestBasinQuestById(entry.id);
    if (!quest || quest.kind !== "fetch" || !quest.sites) return entry;
    const seen = entry.seen ?? [];
    if (seen.length >= quest.need) return entry;
    const hit = quest.sites.find(
      (site) => !seen.includes(site.id) && Math.hypot(site.x - x, site.z - z) <= site.r,
    );
    if (!hit) return entry;
    found.push(hit);
    const nextSeen = [...seen, hit.id];
    return { ...entry, seen: nextSeen, kills: nextSeen.length };
  });
  return { state: found.length ? { active, done: state.done } : state, found };
}

export function forestBasinQuestCredit(state: FbQuestBag, mobId: string): FbQuestBag {
  if (state.active.length === 0) return state;
  let changed = false;
  const active = state.active.map((entry) => {
    const quest = forestBasinQuestById(entry.id);
    if (!quest || !quest.mobIds.includes(mobId) || entry.kills >= quest.need) return entry;
    changed = true;
    return { ...entry, kills: entry.kills + 1 };
  });
  return changed ? { active, done: state.done } : state;
}

export function forestBasinQuestTalk(
  state: FbQuestBag,
  npcId: string,
): { state: FbQuestBag; title: string; body: string; gold: number } {
  const quest = forestBasinQuestByNpc(npcId);
  if (!quest) return { state, title: "…", body: "…", gold: 0 };
  if (state.done.includes(quest.id)) {
    return { state, title: quest.title, body: quest.done, gold: 0 };
  }
  const idx = state.active.findIndex((entry) => entry.id === quest.id);
  if (idx < 0) {
    return {
      state: { active: [...state.active, { id: quest.id, kills: 0 }], done: state.done },
      title: quest.title,
      body: quest.offer,
      gold: 0,
    };
  }
  const entry = state.active[idx]!;
  if (entry.kills < quest.need) {
    return { state, title: quest.title, body: `${quest.progress} ${entry.kills}/${quest.need}.`, gold: 0 };
  }
  return {
    state: { active: state.active.filter((row) => row.id !== quest.id), done: [...state.done, quest.id] },
    title: quest.title,
    body: quest.done,
    gold: quest.gold,
  };
}
