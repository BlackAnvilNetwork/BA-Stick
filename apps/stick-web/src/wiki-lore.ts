/**
 * Player-facing world lore for the main-menu wiki.
 * Spoiler-safe: it describes the setting as players first meet it.
 * Lines starting with "- " render as list items; "> " as a quote.
 */
export type LorePage = { key: string; title: string; lines: string[] };

export const LORE_PAGES: LorePage[] = [
  {
    key: "intro",
    title: "The Reach",
    lines: [
      "Every town in the Reach keeps a Book of Crowns, bolted to a lectern, and every copy tells the same story. That is the first thing that should worry you.",
      "The histories are tidy. The walls are freshly whitewashed every spring. Yet the old stones under the paint carry names that someone has chiselled flat, and the songs your grandmother hummed have verses nobody will sing aloud.",
      "You arrive in Pale Hollow with little more than a blade and your own name. Hear the Book. Take the Crown's gold. But keep your eyes on the chiselled places.",
      "> Before the Crown there was only Ash. — the first words of the Book of Crowns",
    ],
  },
  {
    key: "coronation",
    title: "The Coronation (official history)",
    lines: [
      "As read aloud by the Campaign Herald, from the Book of Crowns:",
      "In the Ashen Age the Reach was a ruin of warring towns, each with its own false songs and its own false forges, and the smoke of them hid the sky. Out of that ash rose the Concord of the Realm, and the Concord raised the New Kings to the Seven-Seat Throne, that the land might have one law, one toll and one true history.",
      "The Kings rebuilt the roads. They set a Herald in every town and a Book on every lectern, so that no child need ever again be troubled by rival tellings. Those who clung to the old smoke-songs were not harmed; they were corrected.",
      "Since the Coronation there has been no war worth the name, no famine the Crown did not relieve, and no history but this one. Rejoice in it. It has been approved.",
    ],
  },
  {
    key: "kings",
    title: "The New Kings and the Seven Seats",
    lines: [
      "The New Kings rule from the Citadel of the Seven Seats, high in the Throne Approach at the head of the King's Way. Their faces are never shown. Their crowns are carried on poles through every hub, and coins bear a crown over a smooth, blank head.",
      "There are seven seats and the Book names seven Kings, yet the seventh seat is always empty. Court custom says it is \"kept for the realm.\" It is not polite to ask more.",
      "The Crown rules through its servants:",
      "- The Crownwardens: grey cloaks with a red bend, road guards and soldiery.",
      "- The Tollhouse: the Toll of Gold, taken at every gate and bridge.",
      "- The Heralds: they read the Book of Crowns aloud and hand out Crown service.",
      "- The Licensed Trainers: one per town, teaching every job on the Crown curriculum.",
      "Pilgrims of the Seats are sometimes seen on the high roads, walking north in grey. They do not speak to travellers.",
    ],
  },
  {
    key: "regions",
    title: "The five regions",
    lines: [
      "Pale Hollow. A chalk-white, fog-soft basin under a western mountain wall. Two rivers meet near the Shard, a colossal shattered white monument whose fragments people have hollowed into homes. The Book calls it the Crown Spire, toppled by rebels long ago. This is where your road begins.",
      "The Ashlands (not yet visited). Black glass and ash under a smoking volcanic crown. Obsidia's mirror plazas carry no written signs; travellers say one old mirror there will not polish clear.",
      "The Slagpits (not yet visited). A trough of slag and sulphur, reached down the Chainstair. At its gorge head the Great Filter sorts ore from waste and, it is said, people too.",
      "Bellmarsh (not yet visited). A drowned fen of grey water and causeways, ruled from Belltower Keep, where bells ring every hour and at every death.",
      "Throne Approach (not yet visited). The Crown Massif, the roof of the Reach. One road climbs to the Citadel: the King's Stair, beside roaring cataracts.",
    ],
  },
  {
    key: "fields",
    title: "The road north from Pale Hollow",
    lines: [
      "Beyond the Hollow's north lip lie the open fields of the march, in the order a traveller meets them:",
      "- Hollow Road: a scrub track climbing out of the chalk.",
      "- Forest Basin: dark timber and quiet clearings.",
      "- Spur Road: a ridge path along the eastern spur.",
      "- Ring Ward: grazing land around an old stone circle. Shepherds swear it sings on still nights; the wardens prefer you leave it alone.",
      "- Islet Fords: shallow crossings and reed islands.",
      "- Green Reach: high meadow under white-capped peaks.",
      "- Coil Pass: a winding cut through the hills.",
      "- Coil Ridge: the scarp locals call the Broken Stair. The cut stair up its face, the Book says, was always there.",
    ],
  },
  {
    key: "mayflower",
    title: "Mayflower and its people",
    lines: [
      "On Pale Hollow's eastern spur, past the scout encampment, a humble town of makers has grown into the Shard's broken fragments. The first settlers came in May, tools on their backs, and found the valley full of wildflowers; they named the town for it. Ask where they came from, and the elders change the subject.",
      "- Wenna Gatesmoke, Herald of the Scout Gate: reads the Crown's news each morning and minds the signal fires. \"Crown's own news, read fair.\"",
      "- Old Orrin Haltmark, Shard Elder of the Elder's Stair: tells visitors the story of the Crown Spire. \"Come back after dark and I'll tell you what everyone forgot.\"",
      "- Brann Coldiron, Craft Master of the Eightfold: master of the eight craft halls, smithing to cooking. \"Bank the fire low and strike it true.\"",
      "- Maudry Saltpenny, Provisioner of Tally Row: buys your log stacks, sells your supplies, keeps honest scales. \"That's the Crown's price, and I'll not cheat you on it.\"",
      "- Teodric Vane, Job Master of the Jobhouse: matches each newcomer to a calling. \"Every hand's good for something.\"",
      "- Ilse Morrowglass, Trainer of the Turning Yard: teaches the turn of a blade under an old sundial tower. \"Turn with the blade, not after it.\"",
      "- Gaunt Hobb, keeper of the Strongroom: watches over what travellers leave behind. \"Leave your goods. Leave your questions.\"",
    ],
  },
  {
    key: "jobs",
    title: "The jobs and their orders",
    lines: [
      "- Knight, the Sworn of the Seats: some still mutter an older oath. \"I hold the line, not the crown.\"",
      "- Fighter, the Muster: many wrap a hammer-strap round the sword grip, for luck.",
      "- Rogue: no order, only the Crown's Wanted Roll. The Lampless work the roads at night without lanterns.",
      "- Cleric, the Licensed Rite: healers who swear \"I see. I mend.\"",
      "- Sorcerer, the Licensed Arcanum: licence renewed yearly. Examiners make them stop humming.",
      "- Battle Mage, the Ashgrave Lances: sorcery made obedient. Deserters snap the lance-pin off their collar.",
      "- Time Mage, the Crown curriculum: licensed for battle only. Anything more, the Book says, is a heresy purged long ago.",
    ],
  },
  {
    key: "sky",
    title: "The Anvil's Sparks",
    lines: [
      "Look up on a clear night. The bright band across the sky has two names. The Crown calls it the Ash Veil, smoke of the old false forges. Country folk call it the Anvil's Sparks, and say every star is a name the Kings could not reach.",
      "The three spiral swirls are better left unnamed; the Crown forbids it. When a star falls, people whisper the name of someone they lost. That is against the Crown Rite, which is why they whisper.",
      "The sun is the Crown's Eye. The moon, in the old count, is the Witness. Fog that hides the stars is called Crown weather.",
    ],
  },
  {
    key: "sayings",
    title: "Proverbs and rumours",
    lines: [
      "- \"White hides, white hides.\" (Pale Hollow)",
      "- \"Every flow has a tail.\" (the Ashlands)",
      "- \"Worth is measured, and the measure's bent.\" (the Slagpits)",
      "- \"The mere keeps what the Keep forgets.\" (Bellmarsh)",
      "- \"Struck once, true for all.\" Nobody remembers where that one comes from.",
      "Rumours heard at Tally Row:",
      "- Scrape the whitewash off the Shard and there are names carved underneath.",
      "- There are people called the Unwritten, who remember for those who cannot. Nobody admits to knowing one.",
      "- The old stone circles sing, but out of tune. The Crownwardens topple any stone that glows.",
      "- Every masterwork in Mayflower carries its maker's mark. Look closely and there is something else stamped beside it.",
    ],
  },
];
