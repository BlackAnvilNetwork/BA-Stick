/* eslint-disable */
/** Auto-generated — do not edit by hand. */
/** Source: packages/items/src/catalog.json */
import type { ItemDef } from "./types";

export const CATALOG: ItemDef[] = [
  {
    "id": 1,
    "name": "Ashbeam Staff",
    "description": "Ashbeam Staff. Ruined gear dug from the ashes of Anvilhold's fallen craft halls.",
    "icon": "/icons/items/ashbeam-staff.png",
    "slug": "ashbeam-staff",
    "kind": "equipment",
    "craftLevel": 6,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 170,
      "materialsText": "Ashbeam Lumber×2, Pale Dust×1"
    },
    "stats": {
      "mab": 7,
      "mnd": 2
    },
    "delayMs": 3600,
    "slot": "main",
    "twoHand": true,
    "jobRestrict": [
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "weaponFamily": "staff",
    "rarity": "Common"
  },
  {
    "id": 2,
    "name": "Linen Robe",
    "description": "Linen Robe. Ruined gear dug from the ashes of Anvilhold's fallen craft halls.",
    "icon": "/icons/items/linen-robe.png",
    "slug": "linen-robe",
    "kind": "equipment",
    "craftLevel": 10,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 250,
      "materialsText": "Linen Cloth×3, Pale Dust×1"
    },
    "stats": {
      "def": 7,
      "int": 7,
      "mp": 17,
      "hp": 11
    },
    "slot": "body",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Common"
  },
  {
    "id": 3,
    "name": "Potion",
    "description": "Potion. Desiccated grain medicine for wounds of the dead city.",
    "icon": "/icons/items/potion.png",
    "slug": "potion",
    "kind": "consumable",
    "craftLevel": 5,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 150,
      "materialsText": "Distilled Pale×1, Dustgrain×1, Pale Dust×1"
    },
    "stats": {
      "hp": 70
    },
    "consume": {
      "hp": 70
    }
  },
  {
    "id": 4,
    "name": "Iron Sword",
    "description": "Iron Sword. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/iron-sword.png",
    "slug": "iron-sword",
    "kind": "equipment",
    "craftLevel": 22,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 490,
      "materialsText": "Iron Ingot×2, Ashbeam Lumber×1, Ash Dust×1"
    },
    "stats": {
      "atk": 13,
      "str": 3,
      "int": 2
    },
    "delayMs": 2400,
    "slot": "main",
    "jobRestrict": [
      "knight",
      "fighter",
      "battlemage"
    ],
    "weaponFamily": "sword",
    "rarity": "Common"
  },
  {
    "id": 5,
    "name": "Iron Mail",
    "description": "Iron Mail. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/iron-mail.png",
    "slug": "iron-mail",
    "kind": "equipment",
    "craftLevel": 28,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 610,
      "materialsText": "Iron Ingot×3, Ash Dust×1"
    },
    "stats": {
      "def": 20,
      "vit": 7,
      "hp": 29
    },
    "slot": "body",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Common"
  },
  {
    "id": 6,
    "name": "Iron Dagger",
    "description": "Iron Dagger. Tempered steel for quiet cuts through slag alleys.",
    "icon": "/icons/items/iron-dagger.png",
    "slug": "iron-dagger",
    "kind": "equipment",
    "craftLevel": 23,
    "craftSkill": "smithing",
    "slot": "main",
    "jobRestrict": [
      "rogue"
    ],
    "stats": {
      "atk": 10,
      "dex": 4
    },
    "delayMs": 1800,
    "weaponFamily": "dagger",
    "recipe": {
      "gold": 510,
      "materialsText": "Iron Ingot×1, Ash Dust×1"
    },
    "rarity": "Common"
  },
  {
    "id": 7,
    "name": "Leather Vest",
    "description": "Leather Vest. Ruined gear dug from the ashes of Anvilhold's fallen craft halls.",
    "icon": "/icons/items/leather-vest.png",
    "slug": "leather-vest",
    "kind": "equipment",
    "craftLevel": 10,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 250,
      "materialsText": "Leather×3, Pale Dust×1"
    },
    "stats": {
      "def": 8,
      "agi": 7,
      "hp": 14
    },
    "slot": "body",
    "jobRestrict": [
      "battlemage",
      "rogue",
      "tim"
    ],
    "rarity": "Common"
  },
  {
    "id": 8,
    "name": "Iron Greatsword",
    "description": "Iron Greatsword. Heavy tempered steel for knights and fighters.",
    "icon": "/icons/items/iron-greatsword.png",
    "slug": "iron-greatsword",
    "kind": "equipment",
    "craftLevel": 34,
    "craftSkill": "smithing",
    "slot": "main",
    "twoHand": true,
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "stats": {
      "atk": 22,
      "str": 5
    },
    "delayMs": 3800,
    "weaponFamily": "greatsword",
    "recipe": {
      "gold": 730,
      "materialsText": "Iron Ingot×4, Ash Dust×1"
    },
    "rarity": "Common"
  },
  {
    "id": 9,
    "name": "Scale Harness",
    "description": "Scale Harness. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/scale-harness.png",
    "slug": "scale-harness",
    "kind": "equipment",
    "craftLevel": 40,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 850,
      "materialsText": "Stone Scale×3, Soft Pelt×1, Ash Dust×1"
    },
    "stats": {
      "def": 29,
      "vit": 10,
      "hp": 41
    },
    "slot": "body",
    "jobRestrict": [
      "knight",
      "fighter",
      "rogue"
    ],
    "rarity": "Uncommon"
  },
  {
    "id": 10,
    "name": "Bronze Arrowhead×6",
    "description": "Bronze Arrowhead×6 — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/bronze-arrowhead.png",
    "slug": "bronze-arrowhead",
    "kind": "intermediate",
    "craftLevel": 3,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 110,
      "materialsText": "Bronze Ingot×1, Pale Dust×1"
    },
    "craftOutputQty": 6
  },
  {
    "id": 11,
    "name": "Iron Arrowhead×6",
    "description": "Iron Arrowhead×6 — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/iron-arrowhead.png",
    "slug": "iron-arrowhead",
    "kind": "intermediate",
    "craftLevel": 20,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 450,
      "materialsText": "Iron Ingot×1, Ash Dust×1"
    },
    "craftOutputQty": 6
  },
  {
    "id": 12,
    "name": "Steel Nail×12",
    "description": "Steel Nail×12 — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/steel-nail.png",
    "slug": "steel-nail",
    "kind": "intermediate",
    "craftLevel": 40,
    "craftSkill": "smithing",
    "craftOutputQty": 12,
    "recipe": {
      "gold": 850,
      "materialsText": "Steel Ingot×1, Slag Dust×1"
    }
  },
  {
    "id": 13,
    "name": "Mythril Arrowhead×6",
    "description": "Mythril Arrowhead×6 — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/mythril-arrowhead.png",
    "slug": "mythril-arrowhead",
    "kind": "intermediate",
    "craftLevel": 44,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 930,
      "materialsText": "Mythril Ingot×1, Slag Dust×1"
    },
    "craftOutputQty": 6
  },
  {
    "id": 14,
    "name": "Mythril Nail×12",
    "description": "Mythril Nail×12 — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/mythril-nail.png",
    "slug": "mythril-nail",
    "kind": "intermediate",
    "craftLevel": 60,
    "craftSkill": "smithing",
    "craftOutputQty": 12,
    "recipe": {
      "gold": 1250,
      "materialsText": "Mythril Ingot×1, Bell Dust×1"
    }
  },
  {
    "id": 15,
    "name": "Darksteel Nail×12",
    "description": "Darksteel Nail×12 — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/darksteel-nail.png",
    "slug": "darksteel-nail",
    "kind": "intermediate",
    "craftLevel": 80,
    "craftSkill": "smithing",
    "craftOutputQty": 12,
    "recipe": {
      "gold": 1650,
      "materialsText": "Darksteel Ingot×1, Throne Dust×1"
    }
  },
  {
    "id": 16,
    "name": "Steel Arrowhead×6",
    "description": "Steel Arrowhead×6 — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/steel-arrowhead.png",
    "slug": "steel-arrowhead",
    "kind": "intermediate",
    "craftLevel": 40,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 850,
      "materialsText": "Steel Ingot×1, Slag Dust×1"
    },
    "craftOutputQty": 6
  },
  {
    "id": 17,
    "name": "Orichalcum Arrowhead×6",
    "description": "Orichalcum Arrowhead×6 — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/orichalcum-arrowhead.png",
    "slug": "orichalcum-arrowhead",
    "kind": "intermediate",
    "craftLevel": 86,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1770,
      "materialsText": "Orichalcum Ingot×1, Throne Dust×1"
    },
    "craftOutputQty": 6
  },
  {
    "id": 18,
    "name": "Bronze Arrow×12",
    "description": "Bronze Arrow×12. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/bronze-arrow.png",
    "slug": "bronze-arrow",
    "kind": "consumable",
    "craftLevel": 10,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 250,
      "materialsText": "Ashbeam Lumber×1, Bronze Arrowhead×1, Pale Dust×1"
    },
    "stats": {
      "hp": 29
    },
    "consume": {
      "hp": 29
    },
    "craftOutputQty": 12
  },
  {
    "id": 19,
    "name": "Ashbeam Peg×12",
    "description": "Ashbeam Peg×12 — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/ashbeam-peg.png",
    "slug": "ashbeam-peg",
    "kind": "base",
    "craftLevel": 20,
    "craftSkill": "woodworking",
    "craftOutputQty": 12,
    "recipe": {
      "gold": 450,
      "materialsText": "Ashbeam Lumber×1, Pale Dust×1"
    }
  },
  {
    "id": 21,
    "name": "Mythril Arrow×12",
    "description": "Mythril Arrow×12. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/mythril-arrow.png",
    "slug": "mythril-arrow",
    "kind": "consumable",
    "craftLevel": 48,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 1010,
      "materialsText": "Bloodbeam Lumber×1, Mythril Arrowhead×1, Slag Dust×1"
    },
    "stats": {
      "hp": 50
    },
    "consume": {
      "hp": 50
    },
    "craftOutputQty": 12
  },
  {
    "id": 25,
    "name": "Darksteel Bolt×12",
    "description": "Darksteel Bolt×12. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/darksteel-bolt.png",
    "slug": "darksteel-bolt",
    "kind": "consumable",
    "craftLevel": 75,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 1550,
      "materialsText": "Bellwood Lumber×1, Darksteel Ingot×1, Acid Bolt Compound×1, Bell Dust×1"
    },
    "stats": {
      "hp": 68
    },
    "consume": {
      "hp": 68
    },
    "craftOutputQty": 12
  },
  {
    "id": 31,
    "name": "Ashbeam Fire Rod",
    "description": "Ashbeam Fire Rod. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/ashbeam-fire-rod.png",
    "slug": "ashbeam-fire-rod",
    "kind": "equipment",
    "craftLevel": 33,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 710,
      "materialsText": "Ashbeam Lumber×2, Sulfur Bit×1, Ash Dust×1"
    },
    "stats": {
      "mab": 19,
      "int": 4
    },
    "delayMs": 3600,
    "slot": "main",
    "jobRestrict": [
      "sorcerer"
    ],
    "weaponFamily": "staff",
    "rarity": "Common"
  },
  {
    "id": 32,
    "name": "Ashbeam Water Rod",
    "description": "Ashbeam Water Rod. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/ashbeam-water-rod.png",
    "slug": "ashbeam-water-rod",
    "kind": "equipment",
    "craftLevel": 33,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 710,
      "materialsText": "Ashbeam Lumber×2, Echo Extract×1, Ash Dust×1"
    },
    "stats": {
      "mab": 16,
      "mnd": 4,
      "mp": 20
    },
    "delayMs": 3600,
    "slot": "main",
    "jobRestrict": [
      "sorcerer"
    ],
    "weaponFamily": "staff",
    "rarity": "Common"
  },
  {
    "id": 33,
    "name": "Bloodbeam Thunder Wand",
    "description": "Bloodbeam Thunder Wand. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/bloodbeam-thunder-wand.png",
    "slug": "bloodbeam-thunder-wand",
    "kind": "equipment",
    "craftLevel": 57,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 1190,
      "materialsText": "Bloodbeam Lumber×2, Lapis×1, Slag Dust×1"
    },
    "stats": {
      "mab": 28,
      "int": 5,
      "acc": 4
    },
    "delayMs": 3600,
    "slot": "main",
    "jobRestrict": [
      "sorcerer"
    ],
    "weaponFamily": "staff",
    "rarity": "Uncommon"
  },
  {
    "id": 34,
    "name": "Bloodbeam Earth Wand",
    "description": "Bloodbeam Earth Wand. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/bloodbeam-earth-wand.png",
    "slug": "bloodbeam-earth-wand",
    "kind": "equipment",
    "craftLevel": 57,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 1190,
      "materialsText": "Bloodbeam Lumber×2, Onyx×1, Slag Dust×1"
    },
    "stats": {
      "mab": 27,
      "vit": 4,
      "hp": 25
    },
    "delayMs": 3600,
    "slot": "main",
    "jobRestrict": [
      "sorcerer"
    ],
    "weaponFamily": "staff",
    "rarity": "Uncommon"
  },
  {
    "id": 35,
    "name": "Bellwood Ice Staff",
    "description": "Bellwood Ice Staff. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/bellwood-ice-staff.png",
    "slug": "bellwood-ice-staff",
    "kind": "equipment",
    "craftLevel": 80,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 1650,
      "materialsText": "Bellwood Lumber×2, Glass Bead×1, Bell Dust×1"
    },
    "stats": {
      "mab": 40,
      "int": 9
    },
    "delayMs": 3600,
    "slot": "main",
    "twoHand": true,
    "jobRestrict": [
      "sorcerer"
    ],
    "weaponFamily": "staff",
    "rarity": "Epic"
  },
  {
    "id": 36,
    "name": "Bellwood Wind Staff",
    "description": "Bellwood Wind Staff. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/bellwood-wind-staff.png",
    "slug": "bellwood-wind-staff",
    "kind": "equipment",
    "craftLevel": 80,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 1650,
      "materialsText": "Bellwood Lumber×2, Bat Wing×2, Bell Dust×1"
    },
    "stats": {
      "mab": 36,
      "agi": 6,
      "acc": 6
    },
    "delayMs": 3600,
    "slot": "main",
    "twoHand": true,
    "jobRestrict": [
      "sorcerer"
    ],
    "weaponFamily": "staff",
    "rarity": "Epic"
  },
  {
    "id": 37,
    "name": "Steel Arrow×12",
    "description": "Steel Arrow×12. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/steel-arrow.png",
    "slug": "steel-arrow",
    "kind": "consumable",
    "craftLevel": 41,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 870,
      "materialsText": "Ashbeam Lumber×1, Steel Arrowhead×1, Ash Dust×1"
    },
    "stats": {
      "hp": 47
    },
    "consume": {
      "hp": 47
    },
    "craftOutputQty": 12
  },
  {
    "id": 38,
    "name": "Orichalcum Bolt×12",
    "description": "Orichalcum Bolt×12. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/orichalcum-bolt.png",
    "slug": "orichalcum-bolt",
    "kind": "consumable",
    "craftLevel": 87,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 1790,
      "materialsText": "Bellwood Lumber×1, Orichalcum Arrowhead×1, Throne Dust×1"
    },
    "stats": {
      "hp": 74
    },
    "consume": {
      "hp": 74
    },
    "craftOutputQty": 12
  },
  {
    "id": 39,
    "name": "Ashbeam Fishing Rod",
    "description": "Ashbeam Fishing Rod. Ruined gear dug from the ashes of Anvilhold's fallen craft halls.",
    "icon": "/icons/items/ashbeam-fishing-rod.png",
    "slug": "ashbeam-fishing-rod",
    "kind": "equipment",
    "craftLevel": 15,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 350,
      "materialsText": "Ashbeam Lumber×2, Climbing Cord×1, Pale Dust×1"
    },
    "stats": {
      "mnd": 2,
      "agi": 1
    },
    "delayMs": 3600,
    "slot": "main",
    "rarity": "Common"
  },
  {
    "id": 40,
    "name": "Bloodbeam Fishing Rod",
    "description": "Bloodbeam Fishing Rod. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/bloodbeam-fishing-rod.png",
    "slug": "bloodbeam-fishing-rod",
    "kind": "equipment",
    "craftLevel": 45,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 950,
      "materialsText": "Bloodbeam Lumber×2, Silk Thread×1, Slag Dust×1"
    },
    "stats": {
      "mnd": 3,
      "agi": 3,
      "hp": 15
    },
    "delayMs": 3600,
    "slot": "main",
    "rarity": "Common"
  },
  {
    "id": 41,
    "name": "Bellwood Fishing Rod",
    "description": "Bellwood Fishing Rod. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/bellwood-fishing-rod.png",
    "slug": "bellwood-fishing-rod",
    "kind": "equipment",
    "craftLevel": 75,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 1550,
      "materialsText": "Bellwood Lumber×2, Mythril Chain×1, Bell Dust×1"
    },
    "stats": {
      "mnd": 4,
      "agi": 4,
      "hp": 25
    },
    "delayMs": 3600,
    "slot": "main",
    "rarity": "Common"
  },
  {
    "id": 42,
    "name": "Sovereign's Staff",
    "description": "Sovereign's Staff. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/sovereigns-staff.png",
    "slug": "sovereigns-staff",
    "kind": "equipment",
    "craftLevel": 100,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 2050,
      "materialsText": "Relic Staff Blank×1, Diamond×1, Ornamented Plate Accent×1, Throne Dust×2"
    },
    "stats": {
      "mab": 49,
      "mnd": 11
    },
    "delayMs": 3600,
    "slot": "main",
    "twoHand": true,
    "jobRestrict": [
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "weaponFamily": "staff",
    "rarity": "Legendary"
  },
  {
    "id": 43,
    "name": "Leather Royal Cord×4",
    "description": "Leather Royal Cord×4 — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/leather-royal-cord.png",
    "slug": "leather-royal-cord",
    "kind": "base",
    "craftLevel": 19,
    "craftSkill": "leathercraft",
    "craftOutputQty": 4,
    "recipe": {
      "gold": 430,
      "materialsText": "Leather×1, Pale Dust×1"
    }
  },
  {
    "id": 46,
    "name": "Leather Strip×8",
    "description": "Leather Strip×8 — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/leather-strip.png",
    "slug": "leather-strip",
    "kind": "intermediate",
    "craftLevel": 12,
    "craftSkill": "leathercraft",
    "craftOutputQty": 8,
    "recipe": {
      "gold": 290,
      "materialsText": "Leather×1, Pale Dust×1"
    }
  },
  {
    "id": 51,
    "name": "Linen Thread",
    "description": "Linen Thread — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/linen-thread.png",
    "slug": "linen-thread",
    "kind": "intermediate",
    "craftLevel": 1,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 70,
      "materialsText": "Pale Flax×2, Dead Fiber×1, Pale Dust×1"
    }
  },
  {
    "id": 54,
    "name": "Shade Cotton Thread",
    "description": "Shade Cotton Thread — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/ash-linen-thread.png",
    "slug": "ash-linen-thread",
    "kind": "intermediate",
    "craftLevel": 25,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 550,
      "materialsText": "Shade Cotton×2, Ash Dust×1"
    }
  },
  {
    "id": 56,
    "name": "Spun Silk",
    "description": "Spun Silk — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/silk-thread-2.png",
    "slug": "silk-thread-2",
    "kind": "intermediate",
    "craftLevel": 45,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 950,
      "materialsText": "Silk Thread×3, Slag Dust×1"
    }
  },
  {
    "id": 57,
    "name": "Velvet Thread",
    "description": "Velvet Thread — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/velvet-thread.png",
    "slug": "velvet-thread",
    "kind": "intermediate",
    "craftLevel": 60,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1250,
      "materialsText": "Velvet Fiber×2 or Velvet Dust×3, Bell Dust×1"
    }
  },
  {
    "id": 59,
    "name": "Spellbound Tome",
    "description": "Spellbound Tome. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/spellbound-tome.png",
    "slug": "spellbound-tome",
    "kind": "equipment",
    "craftLevel": 30,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 650,
      "materialsText": "Linen Cloth×2, Spell Parchment×1, Ash Dust×1"
    },
    "stats": {
      "mab": 17,
      "int": 4,
      "mp": 15
    },
    "delayMs": 2400,
    "slot": "main",
    "jobRestrict": [
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Rare",
    "weaponFamily": "staff"
  },
  {
    "id": 60,
    "name": "Grimoire of Throne",
    "description": "Grimoire of Throne. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/grimoire-of-throne.png",
    "slug": "grimoire-of-throne",
    "kind": "equipment",
    "craftLevel": 78,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1610,
      "materialsText": "Velvet Cloth×2, Spell Parchment×2, Bell Dust×1"
    },
    "stats": {
      "mab": 37,
      "int": 7,
      "mnd": 4,
      "mp": 30
    },
    "delayMs": 2400,
    "slot": "main",
    "jobRestrict": [
      "tim",
      "sorcerer",
      "druid"
    ],
    "rarity": "Legendary",
    "weaponFamily": "staff"
  },
  {
    "id": 61,
    "name": "Bone Arrowhead×6",
    "description": "Bone Arrowhead×6 — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/bone-arrowhead.png",
    "slug": "bone-arrowhead",
    "kind": "intermediate",
    "craftLevel": 5,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 150,
      "materialsText": "Bone Chip×2, Pale Dust×1"
    },
    "craftOutputQty": 6
  },
  {
    "id": 62,
    "name": "Bone Arrow×12",
    "description": "Bone Arrow×12. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/bone-arrow.png",
    "slug": "bone-arrow",
    "kind": "consumable",
    "craftLevel": 12,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 290,
      "materialsText": "Bone Arrowhead×1, Ashbeam Lumber×1, Pale Dust×1"
    },
    "stats": {
      "hp": 29
    },
    "consume": {
      "hp": 29
    },
    "craftOutputQty": 12
  },
  {
    "id": 65,
    "name": "Ash Bone Shell Buckle",
    "description": "Ash Bone Shell Buckle — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/ash-bone-shell-buckle.png",
    "slug": "ash-bone-shell-buckle",
    "kind": "base",
    "craftLevel": 34,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 730,
      "materialsText": "Bone Chip×2, Ash Dust×1"
    }
  },
  {
    "id": 86,
    "name": "Neolithic Dagger",
    "description": "Neolithic Dagger. Ruined gear dug from the ashes of Anvilhold's fallen craft halls.",
    "icon": "/icons/items/bone-parrying-dagger.png",
    "slug": "neolithic-dagger",
    "kind": "equipment",
    "craftLevel": 10,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 250,
      "materialsText": "Bone Chip×2, Leather×1, Pale Dust×1"
    },
    "stats": {
      "atk": 6,
      "dex": 3
    },
    "delayMs": 1800,
    "slot": "main",
    "jobRestrict": [
      "rogue"
    ],
    "weaponFamily": "dagger",
    "rarity": "Rare"
  },
  {
    "id": 87,
    "name": "Fang Dagger",
    "description": "Fang Dagger. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/fang-parrying-dagger.png",
    "slug": "fang-dagger",
    "kind": "equipment",
    "craftLevel": 55,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 1150,
      "materialsText": "Giant Femur×1, Fine Leather×1, Bone Hilt×1, Slag Dust×1"
    },
    "stats": {
      "atk": 30,
      "dex": 8
    },
    "delayMs": 1800,
    "slot": "main",
    "jobRestrict": [
      "rogue"
    ],
    "weaponFamily": "dagger",
    "rarity": "Epic"
  },
  {
    "id": 88,
    "name": "Copper Goldsmith Cabochon",
    "description": "Copper Goldsmith Cabochon — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/copper-goldsmith-cabochon.png",
    "slug": "copper-goldsmith-cabochon",
    "kind": "base",
    "craftLevel": 7,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 190,
      "materialsText": "Copper Ore×1, Pale Dust×1"
    }
  },
  {
    "id": 89,
    "name": "Copper Goldsmith Torque Links×4",
    "description": "Copper Goldsmith Torque Links×4 — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/copper-goldsmith-torque-links.png",
    "slug": "copper-goldsmith-torque-links",
    "kind": "base",
    "craftLevel": 9,
    "craftSkill": "goldsmithing",
    "craftOutputQty": 4,
    "recipe": {
      "gold": 230,
      "materialsText": "Copper Ore×1, Pale Dust×1"
    }
  },
  {
    "id": 90,
    "name": "Copper Goldsmith Royal Setting",
    "description": "Copper Goldsmith Royal Setting — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/copper-goldsmith-royal-setting.png",
    "slug": "copper-goldsmith-royal-setting",
    "kind": "base",
    "craftLevel": 17,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 390,
      "materialsText": "Copper Ore×1, Pale Dust×1"
    }
  },
  {
    "id": 91,
    "name": "Copper Goldsmith Accent Socket",
    "description": "Copper Goldsmith Accent Socket — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/copper-goldsmith-accent-socket.png",
    "slug": "copper-goldsmith-accent-socket",
    "kind": "base",
    "craftLevel": 19,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 430,
      "materialsText": "Copper Ore×1, Pale Dust×1"
    }
  },
  {
    "id": 100,
    "name": "Bronze Ingot",
    "description": "Bronze Ingot — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/bronze-ingot.png",
    "slug": "bronze-ingot",
    "kind": "intermediate",
    "craftLevel": 1,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 70,
      "materialsText": "Copper Ore×2, Tin Ore×1 or Metal Scrap×5, Pale Dust×1"
    }
  },
  {
    "id": 102,
    "name": "Bronze Sword",
    "description": "Bronze Sword. Ruined gear dug from the ashes of Anvilhold's fallen craft halls.",
    "icon": "/icons/items/bronze-sword.png",
    "slug": "bronze-sword",
    "kind": "equipment",
    "craftLevel": 5,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 150,
      "materialsText": "Bronze Ingot×2, Ashbeam Lumber×1, Pale Dust×1"
    },
    "stats": {
      "atk": 6,
      "str": 2,
      "int": 1
    },
    "delayMs": 2400,
    "slot": "main",
    "jobRestrict": [
      "knight",
      "fighter",
      "battlemage"
    ],
    "weaponFamily": "sword",
    "rarity": "Common"
  },
  {
    "id": 103,
    "name": "Bronze Axe",
    "description": "Bronze Axe. Ruined gear dug from the ashes of Anvilhold's fallen craft halls.",
    "icon": "/icons/items/bronze-axe.png",
    "slug": "bronze-axe",
    "kind": "equipment",
    "craftLevel": 7,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 190,
      "materialsText": "Bronze Ingot×2, Pale Dust×1"
    },
    "stats": {
      "atk": 6,
      "str": 3
    },
    "delayMs": 2600,
    "slot": "main",
    "jobRestrict": [
      "fighter"
    ],
    "weaponFamily": "axe",
    "rarity": "Common"
  },
  {
    "id": 104,
    "name": "Bronze Helm",
    "description": "Bronze Helm. Ruined gear dug from the ashes of Anvilhold's fallen craft halls.",
    "icon": "/icons/items/bronze-helm.png",
    "slug": "bronze-helm",
    "kind": "equipment",
    "craftLevel": 8,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 210,
      "materialsText": "Bronze Ingot×1, Pale Dust×1"
    },
    "stats": {
      "def": 3,
      "str": 1,
      "acc": 1
    },
    "slot": "head",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Common"
  },
  {
    "id": 105,
    "name": "Bronze Mittens",
    "description": "Bronze Mittens. Ruined gear dug from the ashes of Anvilhold's fallen craft halls.",
    "icon": "/icons/items/bronze-mittens.png",
    "slug": "bronze-mittens",
    "kind": "equipment",
    "craftLevel": 9,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 230,
      "materialsText": "Bronze Ingot×1, Pale Dust×1"
    },
    "stats": {
      "def": 3,
      "atk": 1,
      "acc": 1
    },
    "slot": "hands",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Common"
  },
  {
    "id": 106,
    "name": "Bronze Harness",
    "description": "Bronze Harness. Ruined gear dug from the ashes of Anvilhold's fallen craft halls.",
    "icon": "/icons/items/bronze-harness.png",
    "slug": "bronze-harness",
    "kind": "equipment",
    "craftLevel": 10,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 250,
      "materialsText": "Bronze Ingot×3, Pale Dust×1"
    },
    "stats": {
      "def": 11,
      "vit": 4,
      "hp": 17
    },
    "slot": "body",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Common"
  },
  {
    "id": 107,
    "name": "Bronze Subligar",
    "description": "Bronze Subligar. Ruined gear dug from the ashes of Anvilhold's fallen craft halls.",
    "icon": "/icons/items/bronze-subligar.png",
    "slug": "bronze-subligar",
    "kind": "equipment",
    "craftLevel": 11,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 270,
      "materialsText": "Bronze Ingot×2, Pale Dust×1"
    },
    "stats": {
      "def": 5,
      "str": 2,
      "hp": 20
    },
    "slot": "legs",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Common"
  },
  {
    "id": 108,
    "name": "Bronze Leggings",
    "description": "Bronze Leggings. Ruined gear dug from the ashes of Anvilhold's fallen craft halls.",
    "icon": "/icons/items/bronze-leggings.png",
    "slug": "bronze-leggings",
    "kind": "equipment",
    "craftLevel": 12,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 290,
      "materialsText": "Bronze Ingot×2, Pale Dust×1"
    },
    "stats": {
      "def": 6,
      "str": 2,
      "hp": 25
    },
    "slot": "legs",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Common"
  },
  {
    "id": 109,
    "name": "Bronze Shield",
    "description": "Bronze Shield. Ruined gear dug from the ashes of Anvilhold's fallen craft halls.",
    "icon": "/icons/items/bronze-shield.png",
    "slug": "bronze-shield",
    "kind": "equipment",
    "craftLevel": 14,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 330,
      "materialsText": "Bronze Ingot×3, Cobble×2, Pale Dust×1"
    },
    "stats": {
      "def": 8,
      "vit": 1
    },
    "slot": "sub",
    "jobRestrict": [
      "knight",
      "battlemage",
      "cleric"
    ],
    "rarity": "Common"
  },
  {
    "id": 110,
    "name": "Bronze Sallet",
    "description": "Bronze Sallet. Ruined gear dug from the ashes of Anvilhold's fallen craft halls.",
    "icon": "/icons/items/bronze-sallet.png",
    "slug": "bronze-sallet",
    "kind": "equipment",
    "craftLevel": 16,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 370,
      "materialsText": "Bronze Ingot×1, Pale Dust×1"
    },
    "stats": {
      "def": 5,
      "str": 2,
      "acc": 2
    },
    "slot": "head",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Common"
  },
  {
    "id": 111,
    "name": "Iron Ingot",
    "description": "Iron Ingot — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/iron-ingot.png",
    "slug": "iron-ingot",
    "kind": "intermediate",
    "craftLevel": 18,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 410,
      "materialsText": "Iron Ore×3, Ash Dust×1"
    }
  },
  {
    "id": 113,
    "name": "Iron Great Axe",
    "description": "Iron Great Axe. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/iron-great-axe.png",
    "slug": "iron-great-axe",
    "kind": "equipment",
    "craftLevel": 24,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 530,
      "materialsText": "Iron Ingot×4, Ash Dust×1"
    },
    "stats": {
      "atk": 14,
      "str": 4
    },
    "delayMs": 2600,
    "slot": "main",
    "twoHand": true,
    "jobRestrict": [
      "fighter"
    ],
    "weaponFamily": "axe",
    "rarity": "Common"
  },
  {
    "id": 114,
    "name": "Iron Helm",
    "description": "Iron Helm. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/iron-helm.png",
    "slug": "iron-helm",
    "kind": "equipment",
    "craftLevel": 26,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 570,
      "materialsText": "Iron Ingot×1, Ash Dust×1"
    },
    "stats": {
      "def": 7,
      "str": 3,
      "acc": 3
    },
    "slot": "head",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Common"
  },
  {
    "id": 115,
    "name": "Iron Mittens",
    "description": "Iron Mittens. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/iron-mittens.png",
    "slug": "iron-mittens",
    "kind": "equipment",
    "craftLevel": 27,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 590,
      "materialsText": "Iron Ingot×1, Ash Dust×1"
    },
    "stats": {
      "def": 7,
      "atk": 3,
      "acc": 3
    },
    "slot": "hands",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Common"
  },
  {
    "id": 116,
    "name": "Iron Subligar",
    "description": "Iron Subligar. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/iron-subligar.png",
    "slug": "iron-subligar",
    "kind": "equipment",
    "craftLevel": 29,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 630,
      "materialsText": "Iron Ingot×2, Ash Dust×1"
    },
    "stats": {
      "def": 9,
      "str": 5,
      "hp": 35
    },
    "slot": "legs",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Common"
  },
  {
    "id": 117,
    "name": "Iron Leggings",
    "description": "Iron Leggings. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/iron-leggings.png",
    "slug": "iron-leggings",
    "kind": "equipment",
    "craftLevel": 30,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 650,
      "materialsText": "Iron Ingot×2, Ash Dust×1"
    },
    "stats": {
      "def": 11,
      "str": 4,
      "hp": 40
    },
    "slot": "legs",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Common"
  },
  {
    "id": 119,
    "name": "Iron Tower Shield",
    "description": "Iron Tower Shield. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/iron-tower-shield.png",
    "slug": "iron-tower-shield",
    "kind": "equipment",
    "craftLevel": 34,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 730,
      "materialsText": "Iron Ingot×1, Ash Dust×1"
    },
    "stats": {
      "def": 18,
      "vit": 4
    },
    "slot": "sub",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Common"
  },
  {
    "id": 120,
    "name": "Steel Ingot",
    "description": "Steel Ingot — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/steel-ingot.png",
    "slug": "steel-ingot",
    "kind": "intermediate",
    "craftLevel": 35,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 750,
      "materialsText": "Iron Ingot×2, Iron Sand×1, Slag Dust×1"
    }
  },
  {
    "id": 122,
    "name": "Steel Greatsword",
    "description": "Steel Greatsword. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/steel-greatsword.png",
    "slug": "steel-greatsword",
    "kind": "equipment",
    "craftLevel": 38,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 810,
      "materialsText": "Steel Ingot×4, Slag Dust×1"
    },
    "stats": {
      "atk": 25,
      "str": 6
    },
    "delayMs": 3800,
    "slot": "main",
    "twoHand": true,
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "weaponFamily": "greatsword",
    "rarity": "Uncommon"
  },
  {
    "id": 124,
    "name": "Mythril Ingot",
    "description": "Mythril Ingot — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/mythril-ingot.png",
    "slug": "mythril-ingot",
    "kind": "intermediate",
    "craftLevel": 42,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 890,
      "materialsText": "Mythril Ore×3, Slag Dust×1"
    }
  },
  {
    "id": 126,
    "name": "Mythril Sword",
    "description": "Mythril Sword. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/mythril-sword.png",
    "slug": "mythril-sword",
    "kind": "equipment",
    "craftLevel": 46,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 970,
      "materialsText": "Mythril Ingot×2, Bloodbeam Lumber×1, Slag Dust×1"
    },
    "stats": {
      "atk": 24,
      "str": 6,
      "int": 4
    },
    "delayMs": 2400,
    "slot": "main",
    "jobRestrict": [
      "knight",
      "fighter",
      "battlemage"
    ],
    "weaponFamily": "sword",
    "rarity": "Rare"
  },
  {
    "id": 127,
    "name": "Mythril Helm",
    "description": "Mythril Helm. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/mythril-helm.png",
    "slug": "mythril-helm",
    "kind": "equipment",
    "craftLevel": 48,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 1010,
      "materialsText": "Mythril Ingot×1, Slag Dust×1"
    },
    "stats": {
      "def": 11,
      "vit": 5,
      "hp": 50
    },
    "slot": "head",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Rare"
  },
  {
    "id": 128,
    "name": "Mythril Mittens",
    "description": "Mythril Mittens. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/mythril-mittens.png",
    "slug": "mythril-mittens",
    "kind": "equipment",
    "craftLevel": 49,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 1030,
      "materialsText": "Mythril Ingot×1, Slag Dust×1"
    },
    "stats": {
      "def": 11,
      "atk": 5,
      "vit": 5
    },
    "slot": "hands",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Rare"
  },
  {
    "id": 129,
    "name": "Mythril Breastplate",
    "description": "Mythril Breastplate. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/mythril-breastplate.png",
    "slug": "mythril-breastplate",
    "kind": "equipment",
    "craftLevel": 50,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 1050,
      "materialsText": "Mythril Ingot×3, Steel Nail×1, Slag Dust×1"
    },
    "stats": {
      "def": 35,
      "vit": 12,
      "hp": 49
    },
    "slot": "body",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Rare"
  },
  {
    "id": 130,
    "name": "Mythril Cuisses",
    "description": "Mythril Cuisses. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/mythril-cuisses.png",
    "slug": "mythril-cuisses",
    "kind": "equipment",
    "craftLevel": 51,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 1070,
      "materialsText": "Mythril Ingot×2, Slag Dust×1"
    },
    "stats": {
      "def": 17,
      "hp": 70,
      "vit": 4
    },
    "slot": "legs",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Rare"
  },
  {
    "id": 131,
    "name": "Mythril Sabatons",
    "description": "Mythril Sabatons. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/mythril-sabatons.png",
    "slug": "mythril-sabatons",
    "kind": "equipment",
    "craftLevel": 52,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 1090,
      "materialsText": "Mythril Ingot×2, Slag Dust×1"
    },
    "stats": {
      "def": 12,
      "vit": 6,
      "agi": 6
    },
    "slot": "feet",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Rare"
  },
  {
    "id": 132,
    "name": "Mythril Shield",
    "description": "Mythril Shield. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/mythril-shield.png",
    "slug": "mythril-shield",
    "kind": "equipment",
    "craftLevel": 54,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 1130,
      "materialsText": "Mythril Ingot×3, Steel Nail×1, Slag Dust×1"
    },
    "stats": {
      "def": 24,
      "vit": 5
    },
    "slot": "sub",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Rare"
  },
  {
    "id": 133,
    "name": "Mythril Sallet",
    "description": "Mythril Sallet. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/mythril-sallet.png",
    "slug": "mythril-sallet",
    "kind": "equipment",
    "craftLevel": 56,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 1170,
      "materialsText": "Mythril Ingot×1, Slag Dust×1"
    },
    "stats": {
      "def": 13,
      "str": 6,
      "acc": 6
    },
    "slot": "head",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Rare"
  },
  {
    "id": 134,
    "name": "Mythril Greatsword",
    "description": "Mythril Greatsword. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/mythril-greatsword.png",
    "slug": "mythril-greatsword",
    "kind": "equipment",
    "craftLevel": 58,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 1210,
      "materialsText": "Mythril Ingot×4, Slag Dust×1"
    },
    "stats": {
      "atk": 36,
      "str": 8
    },
    "delayMs": 3800,
    "slot": "main",
    "twoHand": true,
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "weaponFamily": "greatsword",
    "rarity": "Rare"
  },
  {
    "id": 136,
    "name": "Darksteel Ingot",
    "description": "Darksteel Ingot — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/darksteel-ingot.png",
    "slug": "darksteel-ingot",
    "kind": "intermediate",
    "craftLevel": 62,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1290,
      "materialsText": "Darksteel Ore×3, Iron Sand×1, Bell Dust×1"
    }
  },
  {
    "id": 137,
    "name": "Darksteel Blade",
    "description": "Darksteel Blade. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/darksteel-blade.png",
    "slug": "darksteel-blade",
    "kind": "equipment",
    "craftLevel": 65,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1350,
      "materialsText": "Darksteel Ingot×2, Bellwood Lumber×1, Bell Dust×1"
    },
    "stats": {
      "atk": 32,
      "str": 8,
      "int": 5
    },
    "delayMs": 2400,
    "slot": "main",
    "jobRestrict": [
      "knight",
      "fighter",
      "battlemage"
    ],
    "weaponFamily": "sword",
    "rarity": "Epic"
  },
  {
    "id": 138,
    "name": "Darksteel Great Axe",
    "description": "Darksteel Great Axe. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/darksteel-great-axe.png",
    "slug": "darksteel-great-axe",
    "kind": "equipment",
    "craftLevel": 66,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1370,
      "materialsText": "Darksteel Ingot×4, Bell Dust×1"
    },
    "stats": {
      "atk": 35,
      "str": 9
    },
    "delayMs": 2600,
    "slot": "main",
    "twoHand": true,
    "jobRestrict": [
      "fighter"
    ],
    "weaponFamily": "axe",
    "rarity": "Epic"
  },
  {
    "id": 139,
    "name": "Darksteel Helm",
    "description": "Darksteel Helm. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/darksteel-helm.png",
    "slug": "darksteel-helm",
    "kind": "equipment",
    "craftLevel": 68,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1410,
      "materialsText": "Darksteel Ingot×1, Bell Dust×1"
    },
    "stats": {
      "def": 15,
      "str": 7,
      "acc": 7
    },
    "slot": "head",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Epic"
  },
  {
    "id": 140,
    "name": "Darksteel Mittens",
    "description": "Darksteel Mittens. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/darksteel-mittens.png",
    "slug": "darksteel-mittens",
    "kind": "equipment",
    "craftLevel": 69,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1430,
      "materialsText": "Darksteel Ingot×1, Bell Dust×1"
    },
    "stats": {
      "def": 15,
      "atk": 7,
      "acc": 7
    },
    "slot": "hands",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Epic"
  },
  {
    "id": 141,
    "name": "Darksteel Hauberk",
    "description": "Darksteel Hauberk. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/darksteel-hauberk.png",
    "slug": "darksteel-hauberk",
    "kind": "equipment",
    "craftLevel": 70,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1450,
      "materialsText": "Darksteel Ingot×3, Mythril Nail×1, Bell Dust×1"
    },
    "stats": {
      "def": 47,
      "vit": 16,
      "hp": 65
    },
    "slot": "body",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Epic"
  },
  {
    "id": 142,
    "name": "Darksteel Breeches",
    "description": "Darksteel Breeches. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/darksteel-breeches.png",
    "slug": "darksteel-breeches",
    "kind": "equipment",
    "craftLevel": 71,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1470,
      "materialsText": "Darksteel Ingot×2, Bell Dust×1"
    },
    "stats": {
      "def": 23,
      "str": 8,
      "hp": 80
    },
    "slot": "legs",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Epic"
  },
  {
    "id": 143,
    "name": "Darksteel Greaves",
    "description": "Darksteel Greaves. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/darksteel-greaves.png",
    "slug": "darksteel-greaves",
    "kind": "equipment",
    "craftLevel": 72,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1490,
      "materialsText": "Darksteel Ingot×2, Bell Dust×1"
    },
    "stats": {
      "def": 16,
      "agi": 8,
      "str": 8
    },
    "slot": "feet",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Epic"
  },
  {
    "id": 144,
    "name": "Darksteel Shield",
    "description": "Darksteel Shield. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/darksteel-shield.png",
    "slug": "darksteel-shield",
    "kind": "equipment",
    "craftLevel": 74,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1530,
      "materialsText": "Darksteel Ingot×3, Mythril Nail×1, Bell Dust×1"
    },
    "stats": {
      "def": 32,
      "vit": 7
    },
    "slot": "sub",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Epic"
  },
  {
    "id": 145,
    "name": "Darksteel Sallet",
    "description": "Darksteel Sallet. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/darksteel-sallet.png",
    "slug": "darksteel-sallet",
    "kind": "equipment",
    "craftLevel": 76,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1570,
      "materialsText": "Darksteel Ingot×1, Bell Dust×1"
    },
    "stats": {
      "def": 17,
      "str": 8,
      "acc": 8
    },
    "slot": "head",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Epic"
  },
  {
    "id": 148,
    "name": "Orichalcum Ingot",
    "description": "Orichalcum Ingot — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/orichalcum-ingot.png",
    "slug": "orichalcum-ingot",
    "kind": "intermediate",
    "craftLevel": 82,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1690,
      "materialsText": "Orichalcum Ore×2, Mythril Ingot×1, Throne Dust×1"
    }
  },
  {
    "id": 150,
    "name": "Orichalcum Mace Head",
    "description": "Orichalcum Mace Head — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/orichalcum-mace-head.png",
    "slug": "orichalcum-mace-head",
    "kind": "base",
    "craftLevel": 86,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1770,
      "materialsText": "Orichalcum Ingot×1, Throne Dust×1"
    }
  },
  {
    "id": 151,
    "name": "Orichalcum Sword",
    "description": "Orichalcum Sword. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/orichalcum-sword.png",
    "slug": "orichalcum-sword",
    "kind": "equipment",
    "craftLevel": 88,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1810,
      "materialsText": "Orichalcum Ingot×2, Bellwood Lumber×1, Throne Dust×1"
    },
    "stats": {
      "atk": 41,
      "str": 10,
      "int": 7
    },
    "delayMs": 2400,
    "slot": "main",
    "jobRestrict": [
      "knight",
      "battlemage"
    ],
    "weaponFamily": "sword",
    "rarity": "Epic"
  },
  {
    "id": 152,
    "name": "Orichalcum Shield Boss",
    "description": "Orichalcum Shield Boss — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/orichalcum-shield-boss.png",
    "slug": "orichalcum-shield-boss",
    "kind": "base",
    "craftLevel": 90,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1850,
      "materialsText": "Orichalcum Ingot×1, Throne Dust×1"
    }
  },
  {
    "id": 153,
    "name": "Palace Helm",
    "description": "Palace Helm. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/palace-helm.png",
    "slug": "palace-helm",
    "kind": "equipment",
    "craftLevel": 92,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1890,
      "materialsText": "Orichalcum Ingot×1, Marble Chip×1, Throne Dust×1"
    },
    "stats": {
      "def": 20,
      "vit": 10,
      "hp": 100
    },
    "slot": "head",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Legendary"
  },
  {
    "id": 154,
    "name": "Palace Gauntlets",
    "description": "Palace Gauntlets. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/palace-gauntlets.png",
    "slug": "palace-gauntlets",
    "kind": "equipment",
    "craftLevel": 93,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1910,
      "materialsText": "Orichalcum Ingot×1, Marble Chip×1, Throne Dust×1"
    },
    "stats": {
      "def": 20,
      "atk": 10,
      "vit": 10
    },
    "slot": "hands",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Legendary"
  },
  {
    "id": 155,
    "name": "Palace Plate",
    "description": "Palace Plate. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/palace-plate.png",
    "slug": "palace-plate",
    "kind": "equipment",
    "craftLevel": 94,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1930,
      "materialsText": "Orichalcum Ingot×3, Marble Chip×2, Darksteel Goldsmith Wire×2, Goldsmith Filigree×1, Darksteel Nail×1, Throne Dust×1"
    },
    "stats": {
      "def": 59,
      "vit": 20,
      "hp": 81
    },
    "slot": "body",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Legendary"
  },
  {
    "id": 156,
    "name": "Palace Cuisses",
    "description": "Palace Cuisses. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/palace-cuisses.png",
    "slug": "palace-cuisses",
    "kind": "equipment",
    "craftLevel": 95,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1950,
      "materialsText": "Orichalcum Ingot×2, Marble Chip×1, Darksteel Nail×1, Throne Dust×1"
    },
    "stats": {
      "def": 31,
      "hp": 120,
      "vit": 8
    },
    "slot": "legs",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Legendary"
  },
  {
    "id": 157,
    "name": "Palace Sabatons",
    "description": "Palace Sabatons. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/palace-sabatons.png",
    "slug": "palace-sabatons",
    "kind": "equipment",
    "craftLevel": 96,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1970,
      "materialsText": "Orichalcum Ingot×2, Marble Chip×1, Throne Dust×1"
    },
    "stats": {
      "def": 21,
      "vit": 10,
      "agi": 10
    },
    "slot": "feet",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Legendary"
  },
  {
    "id": 158,
    "name": "Palace Great Axe",
    "description": "Palace Great Axe. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/palace-great-axe.png",
    "slug": "palace-great-axe",
    "kind": "equipment",
    "craftLevel": 98,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 2010,
      "materialsText": "Orichalcum Ingot×3, Column Fragment×1, Throne Dust×1"
    },
    "stats": {
      "atk": 50,
      "str": 12
    },
    "delayMs": 2600,
    "slot": "main",
    "twoHand": true,
    "jobRestrict": [
      "fighter"
    ],
    "weaponFamily": "axe",
    "rarity": "Legendary"
  },
  {
    "id": 159,
    "name": "Ornamented Plate Accent",
    "description": "Ornamented Plate Accent — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/ornamented-plate-accent.png",
    "slug": "ornamented-plate-accent",
    "kind": "intermediate",
    "craftLevel": 100,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 2050,
      "materialsText": "Orichalcum Ingot×1, Diamond×1, Throne Dust×1"
    }
  },
  {
    "id": 160,
    "name": "Ashbeam Lumber",
    "description": "Ashbeam Lumber — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/ashbeam-lumber.png",
    "slug": "ashbeam-lumber",
    "kind": "intermediate",
    "craftLevel": 1,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 70,
      "materialsText": "Ashbeam Log×2, Bark Strip×1, Pale Dust×1"
    }
  },
  {
    "id": 161,
    "name": "Ashbeam Cane",
    "description": "Ashbeam Cane — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/ashbeam-cane.png",
    "slug": "ashbeam-cane",
    "kind": "base",
    "craftLevel": 3,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 110,
      "materialsText": "Ashbeam Lumber×1, Pale Dust×1"
    }
  },
  {
    "id": 162,
    "name": "Buckler (wood)",
    "description": "Buckler (wood). Ruined gear dug from the ashes of Anvilhold's fallen craft halls.",
    "icon": "/icons/items/buckler-wood.png",
    "slug": "buckler-wood",
    "kind": "equipment",
    "craftLevel": 4,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 130,
      "materialsText": "Ashbeam Lumber×2, Cracked Brick×1, Ashbeam Shield Rim×1, Pale Dust×1"
    },
    "stats": {
      "def": 4,
      "vit": 1
    },
    "slot": "sub",
    "rarity": "Common"
  },
  {
    "id": 163,
    "name": "Ashbeam Flatbow",
    "description": "Ashbeam Flatbow. Ruined gear dug from the ashes of Anvilhold's fallen craft halls.",
    "icon": "/icons/items/ashbeam-flatbow.png",
    "slug": "ashbeam-flatbow",
    "kind": "equipment",
    "craftLevel": 8,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 210,
      "materialsText": "Ashbeam Lumber×1, Pale Dust×1"
    },
    "stats": {
      "agi": 2,
      "acc": 3
    },
    "slot": "ranged",
    "rarity": "Common"
  },
  {
    "id": 165,
    "name": "Ashbeam Bow Stave",
    "description": "Ashbeam Bow Stave — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/ashbeam-bow-stave.png",
    "slug": "ashbeam-bow-stave",
    "kind": "base",
    "craftLevel": 12,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 290,
      "materialsText": "Ashbeam Lumber×1, Pale Dust×1"
    }
  },
  {
    "id": 166,
    "name": "Ashbeam Shield Rim",
    "description": "Ashbeam Shield Rim — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/ashbeam-shield-rim.png",
    "slug": "ashbeam-shield-rim",
    "kind": "intermediate",
    "craftLevel": 3,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 110,
      "materialsText": "Ashbeam Lumber×1, Pale Dust×1"
    }
  },
  {
    "id": 167,
    "name": "Ashbeam Grip",
    "description": "Ashbeam Grip. Ruined gear dug from the ashes of Anvilhold's fallen craft halls.",
    "icon": "/icons/items/ashbeam-grip.png",
    "slug": "ashbeam-grip",
    "kind": "equipment",
    "craftLevel": 16,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 370,
      "materialsText": "Ashbeam Lumber×1, Leather×1, Ash Dust×1"
    },
    "stats": {
      "acc": 2,
      "mab": 2
    },
    "slot": "grip",
    "rarity": "Common"
  },
  {
    "id": 170,
    "name": "Ashbeam Wand",
    "description": "Ashbeam Wand. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/ashbeam-wand.png",
    "slug": "ashbeam-wand",
    "kind": "equipment",
    "craftLevel": 22,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 490,
      "materialsText": "Ashbeam Lumber×1, Ash Dust×1"
    },
    "stats": {
      "mab": 14,
      "int": 3
    },
    "delayMs": 3600,
    "slot": "main",
    "jobRestrict": [
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "weaponFamily": "staff",
    "rarity": "Common"
  },
  {
    "id": 172,
    "name": "Ashbeam Rod",
    "description": "Ashbeam Rod. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/ashbeam-rod.png",
    "slug": "ashbeam-rod",
    "kind": "equipment",
    "craftLevel": 25,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 550,
      "materialsText": "Ashbeam Lumber×1, Bone Chip×1, Ash Dust×1"
    },
    "stats": {
      "mab": 16,
      "mnd": 4
    },
    "delayMs": 3600,
    "slot": "main",
    "jobRestrict": [
      "battlemage",
      "cleric"
    ],
    "weaponFamily": "staff",
    "rarity": "Common"
  },
  {
    "id": 175,
    "name": "Ashbeam Quarterstaff",
    "description": "Ashbeam Quarterstaff. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/ashbeam-quarterstaff.png",
    "slug": "ashbeam-quarterstaff",
    "kind": "equipment",
    "craftLevel": 31,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 670,
      "materialsText": "Ashbeam Lumber×1, Ash Dust×1"
    },
    "stats": {
      "mab": 17,
      "str": 3,
      "mnd": 3
    },
    "delayMs": 3600,
    "slot": "main",
    "twoHand": true,
    "jobRestrict": [
      "fighter",
      "battlemage",
      "cleric",
      "tim",
      "druid"
    ],
    "weaponFamily": "staff",
    "rarity": "Common"
  },
  {
    "id": 178,
    "name": "Ashbeam Longbow",
    "description": "Ashbeam Longbow. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/ashbeam-longbow.png",
    "slug": "ashbeam-longbow",
    "kind": "equipment",
    "craftLevel": 37,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 790,
      "materialsText": "Ashbeam Lumber×1, Ash Dust×1"
    },
    "stats": {
      "agi": 5,
      "acc": 6
    },
    "slot": "ranged",
    "rarity": "Common"
  },
  {
    "id": 180,
    "name": "Bloodbeam Lumber",
    "description": "Bloodbeam Lumber — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/bloodbeam-lumber.png",
    "slug": "bloodbeam-lumber",
    "kind": "intermediate",
    "craftLevel": 40,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 850,
      "materialsText": "Bloodbeam Log×2, Bark Strip×1, Slag Dust×1"
    }
  },
  {
    "id": 181,
    "name": "Bloodbeam Wand",
    "description": "Bloodbeam Wand. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/bloodbeam-wand.png",
    "slug": "bloodbeam-wand",
    "kind": "equipment",
    "craftLevel": 42,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 890,
      "materialsText": "Bloodbeam Lumber×1, Slag Dust×1"
    },
    "stats": {
      "mab": 22,
      "int": 4,
      "acc": 3
    },
    "delayMs": 3600,
    "slot": "main",
    "jobRestrict": [
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "weaponFamily": "staff",
    "rarity": "Uncommon"
  },
  {
    "id": 183,
    "name": "Ashbeam Club",
    "description": "Ashbeam Club. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/ashbeam-club.png",
    "slug": "ashbeam-club",
    "kind": "equipment",
    "craftLevel": 12,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 290,
      "materialsText": "Ashbeam Lumber×2, Soft Pelt×1, Pale Dust×1"
    },
    "stats": {
      "atk": 21,
      "mnd": 6
    },
    "delayMs": 2400,
    "slot": "main",
    "jobRestrict": [
      "cleric"
    ],
    "weaponFamily": "club",
    "rarity": "Common"
  },
  {
    "id": 186,
    "name": "Composite Bow",
    "description": "Composite Bow. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/composite-bow.png",
    "slug": "composite-bow",
    "kind": "equipment",
    "craftLevel": 50,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 1050,
      "materialsText": "Bloodbeam Bow Stave×1, Bloodbeam Lumber×1, Silk Thread×1, Slag Dust×1"
    },
    "stats": {
      "agi": 6,
      "acc": 8
    },
    "slot": "ranged",
    "rarity": "Rare"
  },
  {
    "id": 187,
    "name": "Bloodbeam Bow Stave",
    "description": "Bloodbeam Bow Stave — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/bloodbeam-bow-stave.png",
    "slug": "bloodbeam-bow-stave",
    "kind": "intermediate",
    "craftLevel": 48,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 1010,
      "materialsText": "Bloodbeam Lumber×1, Slag Dust×1"
    }
  },
  {
    "id": 189,
    "name": "Bloodbeam Crook",
    "description": "Bloodbeam Crook. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/bloodbeam-crook.png",
    "slug": "bloodbeam-crook",
    "kind": "equipment",
    "craftLevel": 56,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 1170,
      "materialsText": "Bloodbeam Lumber×1, Slag Dust×1"
    },
    "stats": {
      "mab": 26,
      "mnd": 7,
      "mp": 20
    },
    "delayMs": 3600,
    "slot": "main",
    "jobRestrict": [
      "cleric"
    ],
    "weaponFamily": "staff",
    "rarity": "Uncommon"
  },
  {
    "id": 192,
    "name": "Bellwood Lumber",
    "description": "Bellwood Lumber — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/bellwood-lumber.png",
    "slug": "bellwood-lumber",
    "kind": "intermediate",
    "craftLevel": 65,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 1350,
      "materialsText": "Bellwood Log×2, Bark Strip×1, Bell Dust×1"
    }
  },
  {
    "id": 193,
    "name": "Bellwood Ferrule",
    "description": "Bellwood Ferrule — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/bellwood-ferrule.png",
    "slug": "bellwood-ferrule",
    "kind": "base",
    "craftLevel": 67,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 1390,
      "materialsText": "Bellwood Lumber×1, Bell Dust×1"
    }
  },
  {
    "id": 194,
    "name": "Bellwood Laminate",
    "description": "Bellwood Laminate — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/bellwood-laminate.png",
    "slug": "bellwood-laminate",
    "kind": "base",
    "craftLevel": 69,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 1430,
      "materialsText": "Bellwood Lumber×1, Bell Dust×1"
    }
  },
  {
    "id": 195,
    "name": "Bellwood Staff",
    "description": "Bellwood Staff. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/bellwood-staff.png",
    "slug": "bellwood-staff",
    "kind": "equipment",
    "craftLevel": 70,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 1450,
      "materialsText": "Bellwood Lumber×2, Silk Thread×1, Bell Dust×1"
    },
    "stats": {
      "mab": 36,
      "mnd": 8
    },
    "delayMs": 3600,
    "slot": "main",
    "twoHand": true,
    "jobRestrict": [
      "tim",
      "sorcerer",
      "druid"
    ],
    "weaponFamily": "staff",
    "rarity": "Uncommon"
  },
  {
    "id": 196,
    "name": "Bellwood Grip",
    "description": "Bellwood Grip. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/bellwood-grip.png",
    "slug": "bellwood-grip",
    "kind": "equipment",
    "craftLevel": 72,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 1490,
      "materialsText": "Bellwood Lumber×1, Fine Leather×1, Bell Dust×1"
    },
    "stats": {
      "acc": 6,
      "atk": 4,
      "str": 2
    },
    "slot": "grip",
    "rarity": "Uncommon"
  },
  {
    "id": 199,
    "name": "Bellwood Longbow",
    "description": "Bellwood Longbow. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/bellwood-longbow.png",
    "slug": "bellwood-longbow",
    "kind": "equipment",
    "craftLevel": 77,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 1590,
      "materialsText": "Bellwood Lumber×1, Bell Dust×1"
    },
    "stats": {
      "agi": 8,
      "acc": 11
    },
    "slot": "ranged",
    "rarity": "Uncommon"
  },
  {
    "id": 204,
    "name": "War Bow",
    "description": "War Bow. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/war-bow.png",
    "slug": "war-bow",
    "kind": "equipment",
    "craftLevel": 90,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 1850,
      "materialsText": "Bellwood Bow Stave×1, Bellwood Lumber×1, Horn×1, Throne Dust×1"
    },
    "stats": {
      "agi": 10,
      "acc": 14
    },
    "slot": "ranged",
    "rarity": "Common"
  },
  {
    "id": 205,
    "name": "Bellwood Bow Stave",
    "description": "Bellwood Bow Stave — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/bellwood-bow-stave.png",
    "slug": "bellwood-bow-stave",
    "kind": "intermediate",
    "craftLevel": 88,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 1810,
      "materialsText": "Bellwood Lumber×1, Throne Dust×1"
    }
  },
  {
    "id": 206,
    "name": "Chrono Staff",
    "description": "Chrono Staff. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/chrono-staff.png",
    "slug": "chrono-staff",
    "kind": "equipment",
    "craftLevel": 95,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 1950,
      "materialsText": "Bellwood Lumber×2, Bellwood Ferrule×1, Bellwood Laminate×1, Orichalcum Ingot×1, Throne Dust×1"
    },
    "stats": {
      "mab": 45,
      "int": 8,
      "mp": 40
    },
    "delayMs": 3600,
    "slot": "main",
    "twoHand": true,
    "jobRestrict": [
      "tim"
    ],
    "weaponFamily": "staff",
    "rarity": "Legendary"
  },
  {
    "id": 207,
    "name": "Mana Staff",
    "description": "Mana Staff. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/mana-staff.png",
    "slug": "mana-staff",
    "kind": "equipment",
    "craftLevel": 98,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 2010,
      "materialsText": "Bellwood Lumber×2, Diamond×1, Throne Dust×1"
    },
    "stats": {
      "mab": 47,
      "int": 11
    },
    "delayMs": 3600,
    "slot": "main",
    "twoHand": true,
    "jobRestrict": [
      "sorcerer"
    ],
    "weaponFamily": "staff",
    "rarity": "Legendary"
  },
  {
    "id": 208,
    "name": "Relic Staff Blank",
    "description": "Relic Staff Blank — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/relic-staff-blank.png",
    "slug": "relic-staff-blank",
    "kind": "base",
    "craftLevel": 100,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 2050,
      "materialsText": "Bellwood Lumber×2 or Petrified Lumber×2, Ancient Branch×1, Orichalcum Ingot×1, Throne Dust×2"
    }
  },
  {
    "id": 209,
    "name": "Leather",
    "description": "Leather — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/leather.png",
    "slug": "leather",
    "kind": "intermediate",
    "craftLevel": 1,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 70,
      "materialsText": "Desiccated Hide×2, Pale Dust×1"
    }
  },
  {
    "id": 210,
    "name": "Leather Bracer",
    "description": "Leather Bracer. Ruined gear dug from the ashes of Anvilhold's fallen craft halls.",
    "icon": "/icons/items/leather-bracer.png",
    "slug": "leather-bracer",
    "kind": "equipment",
    "craftLevel": 3,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 110,
      "materialsText": "Leather×1, Pale Dust×1"
    },
    "stats": {
      "def": 2,
      "dex": 1
    },
    "slot": "hands",
    "jobRestrict": [
      "battlemage",
      "rogue",
      "tim"
    ],
    "rarity": "Common"
  },
  {
    "id": 211,
    "name": "Leather Bandana",
    "description": "Leather Bandana. Ruined gear dug from the ashes of Anvilhold's fallen craft halls.",
    "icon": "/icons/items/leather-bandana.png",
    "slug": "leather-bandana",
    "kind": "equipment",
    "craftLevel": 4,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 130,
      "materialsText": "Leather×1, Pale Dust×1"
    },
    "stats": {
      "def": 2,
      "agi": 1,
      "mp": 10
    },
    "slot": "head",
    "jobRestrict": [
      "battlemage",
      "rogue",
      "tim"
    ],
    "rarity": "Common"
  },
  {
    "id": 212,
    "name": "Leather Gloves",
    "description": "Leather Gloves. Ruined gear dug from the ashes of Anvilhold's fallen craft halls.",
    "icon": "/icons/items/leather-gloves.png",
    "slug": "leather-gloves",
    "kind": "equipment",
    "craftLevel": 5,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 150,
      "materialsText": "Leather×1, Pale Dust×1"
    },
    "stats": {
      "def": 3,
      "dex": 1,
      "int": 1
    },
    "slot": "hands",
    "jobRestrict": [
      "battlemage",
      "rogue",
      "tim"
    ],
    "rarity": "Common"
  },
  {
    "id": 213,
    "name": "Leather Sandals",
    "description": "Leather Sandals. Ruined gear dug from the ashes of Anvilhold's fallen craft halls.",
    "icon": "/icons/items/leather-sandals.png",
    "slug": "leather-sandals",
    "kind": "equipment",
    "craftLevel": 6,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 170,
      "materialsText": "Leather×1, Pale Dust×1"
    },
    "stats": {
      "def": 3,
      "agi": 1,
      "mp": 10
    },
    "slot": "feet",
    "jobRestrict": [
      "battlemage",
      "rogue",
      "tim"
    ],
    "rarity": "Common"
  },
  {
    "id": 214,
    "name": "Leather Trousers",
    "description": "Leather Trousers. Ruined gear dug from the ashes of Anvilhold's fallen craft halls.",
    "icon": "/icons/items/leather-trousers.png",
    "slug": "leather-trousers",
    "kind": "equipment",
    "craftLevel": 8,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 210,
      "materialsText": "Leather×2, Pale Dust×1"
    },
    "stats": {
      "def": 4,
      "agi": 1,
      "mp": 10
    },
    "slot": "legs",
    "jobRestrict": [
      "battlemage",
      "rogue",
      "tim"
    ],
    "rarity": "Common"
  },
  {
    "id": 215,
    "name": "Leather Oil-Cure",
    "description": "Leather Oil-Cure — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/leather-oil-cure.png",
    "slug": "leather-oil-cure",
    "kind": "base",
    "craftLevel": 12,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 290,
      "materialsText": "Leather×1, Pale Dust×1"
    }
  },
  {
    "id": 216,
    "name": "Leather Emboss Kit",
    "description": "Leather Emboss Kit — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/leather-emboss-kit.png",
    "slug": "leather-emboss-kit",
    "kind": "base",
    "craftLevel": 14,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 330,
      "materialsText": "Leather×1, Pale Dust×1"
    }
  },
  {
    "id": 217,
    "name": "Grip Wrap",
    "description": "Grip Wrap. Ruined gear dug from the ashes of Anvilhold's fallen craft halls.",
    "icon": "/icons/items/grip-wrap.png",
    "slug": "grip-wrap",
    "kind": "equipment",
    "craftLevel": 15,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 350,
      "materialsText": "Leather×1, Leather Strip×2, Ash Dust×1"
    },
    "stats": {
      "acc": 3,
      "dex": 1
    },
    "slot": "grip",
    "rarity": "Common"
  },
  {
    "id": 218,
    "name": "Leather Hardened Vest",
    "description": "Leather Hardened Vest. Ruined gear dug from the ashes of Anvilhold's fallen craft halls.",
    "icon": "/icons/items/leather-hardened-vest.png",
    "slug": "leather-hardened-vest",
    "kind": "equipment",
    "craftLevel": 17,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 390,
      "materialsText": "Leather×1, Pale Dust×1"
    },
    "stats": {
      "def": 11,
      "agi": 9,
      "hp": 18
    },
    "slot": "body",
    "jobRestrict": [
      "battlemage",
      "rogue",
      "tim"
    ],
    "rarity": "Common"
  },
  {
    "id": 220,
    "name": "Darksteel Goldsmith Wire×6",
    "description": "Darksteel Goldsmith Wire×6 — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/darksteel-goldsmith-wire.png",
    "slug": "darksteel-goldsmith-wire",
    "kind": "base",
    "craftLevel": 81,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 1670,
      "materialsText": "Darksteel Ingot×1, Throne Dust×1"
    },
    "craftOutputQty": 6
  },
  {
    "id": 221,
    "name": "Shade Leather Bandana",
    "description": "Shade Leather Bandana. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/shade-leather-bandana.png",
    "slug": "shade-leather-bandana",
    "kind": "equipment",
    "craftLevel": 22,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 490,
      "materialsText": "Leather×2, Silk Thread×1, Ash Dust×1"
    },
    "stats": {
      "def": 6,
      "dex": 2,
      "agi": 2
    },
    "slot": "head",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Uncommon"
  },
  {
    "id": 222,
    "name": "Shade Leather Gloves",
    "description": "Shade Leather Gloves. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/shade-leather-gloves.png",
    "slug": "shade-leather-gloves",
    "kind": "equipment",
    "craftLevel": 24,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 530,
      "materialsText": "Leather×2, Silk Thread×1, Ash Dust×1"
    },
    "stats": {
      "def": 6,
      "dex": 2,
      "acc": 2
    },
    "slot": "hands",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Uncommon"
  },
  {
    "id": 223,
    "name": "Shade Leather Trousers",
    "description": "Shade Leather Trousers. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/shade-leather-trousers.png",
    "slug": "shade-leather-trousers",
    "kind": "equipment",
    "craftLevel": 26,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 570,
      "materialsText": "Leather×2, Silk Thread×1, Ash Dust×1"
    },
    "stats": {
      "def": 10,
      "agi": 3,
      "hp": 30
    },
    "slot": "legs",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Uncommon"
  },
  {
    "id": 224,
    "name": "Shade Leather Boots",
    "description": "Shade Leather Boots. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/shade-leather-boots.png",
    "slug": "shade-leather-boots",
    "kind": "equipment",
    "craftLevel": 28,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 610,
      "materialsText": "Leather×2, Silk Thread×1, Ash Dust×1"
    },
    "stats": {
      "def": 7,
      "agi": 4,
      "dex": 2
    },
    "slot": "feet",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Uncommon"
  },
  {
    "id": 225,
    "name": "Shade Leather Vest",
    "description": "Shade Leather Vest. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/shade-leather-vest.png",
    "slug": "shade-leather-vest",
    "kind": "equipment",
    "craftLevel": 30,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 650,
      "materialsText": "Leather×3, Silk Thread×1, Ash Dust×1"
    },
    "stats": {
      "def": 16,
      "agi": 15,
      "hp": 26
    },
    "slot": "body",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Uncommon"
  },
  {
    "id": 226,
    "name": "Mantle of the Last Company",
    "description": "Mantle of the Last Company. A leather wrap the Anvilhold sellswords wore when the halls still stood.",
    "icon": "/icons/items/mercenary-mantle.png",
    "slug": "mercenary-mantle",
    "kind": "equipment",
    "craftLevel": 32,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 690,
      "materialsText": "Leather×1, Climbing Cord×1, Ash Dust×1"
    },
    "stats": {
      "def": 16,
      "agi": 8,
      "mp": 20,
      "hp": 15
    },
    "slot": "body",
    "jobRestrict": [
      "rogue",
      "tim"
    ],
    "rarity": "Legendary"
  },
  {
    "id": 230,
    "name": "Fine Leather",
    "description": "Fine Leather — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/fine-leather.png",
    "slug": "fine-leather",
    "kind": "intermediate",
    "craftLevel": 42,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 890,
      "materialsText": "Soft Pelt×2, Slime Oil×1, Slag Dust×1"
    }
  },
  {
    "id": 232,
    "name": "Fine Leather Gorget",
    "description": "Fine Leather Gorget. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/fine-leather-gorget.png",
    "slug": "fine-leather-gorget",
    "kind": "equipment",
    "craftLevel": 45,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 950,
      "materialsText": "Fine Leather×1, Bone Chip×1, Slag Dust×1"
    },
    "stats": {
      "def": 11,
      "hp": 50,
      "mp": 50
    },
    "slot": "head",
    "rarity": "Uncommon"
  },
  {
    "id": 234,
    "name": "Fine Jerkin Helm",
    "description": "Fine Jerkin Helm. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/fine-jerkin-helm.png",
    "slug": "fine-jerkin-helm",
    "kind": "equipment",
    "craftLevel": 48,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1010,
      "materialsText": "Fine Leather×1, Slag Dust×1"
    },
    "stats": {
      "def": 11,
      "dex": 5,
      "acc": 5
    },
    "slot": "head",
    "jobRestrict": [
      "fighter",
      "rogue"
    ],
    "rarity": "Uncommon"
  },
  {
    "id": 235,
    "name": "Fine Jerkin",
    "description": "Fine Jerkin. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/fine-jerkin.png",
    "slug": "fine-jerkin",
    "kind": "equipment",
    "craftLevel": 50,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1050,
      "materialsText": "Fine Leather×3, Slag Dust×1"
    },
    "stats": {
      "def": 33,
      "str": 8,
      "agi": 6,
      "hp": 40
    },
    "slot": "body",
    "jobRestrict": [
      "fighter",
      "rogue"
    ],
    "rarity": "Uncommon"
  },
  {
    "id": 236,
    "name": "Fine Jerkin Gloves",
    "description": "Fine Jerkin Gloves. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/fine-jerkin-gloves.png",
    "slug": "fine-jerkin-gloves",
    "kind": "equipment",
    "craftLevel": 52,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1090,
      "materialsText": "Fine Leather×1, Slag Dust×1"
    },
    "stats": {
      "def": 12,
      "acc": 6,
      "dex": 6
    },
    "slot": "hands",
    "jobRestrict": [
      "fighter",
      "rogue"
    ],
    "rarity": "Uncommon"
  },
  {
    "id": 237,
    "name": "Fine Jerkin Trousers",
    "description": "Fine Jerkin Trousers. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/fine-jerkin-trousers.png",
    "slug": "fine-jerkin-trousers",
    "kind": "equipment",
    "craftLevel": 54,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1130,
      "materialsText": "Fine Leather×2, Slag Dust×1"
    },
    "stats": {
      "def": 17,
      "agi": 6,
      "hp": 60
    },
    "slot": "legs",
    "jobRestrict": [
      "fighter",
      "rogue"
    ],
    "rarity": "Uncommon"
  },
  {
    "id": 238,
    "name": "Fine Jerkin Boots",
    "description": "Fine Jerkin Boots. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/fine-jerkin-boots.png",
    "slug": "fine-jerkin-boots",
    "kind": "equipment",
    "craftLevel": 56,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1170,
      "materialsText": "Fine Leather×2, Slag Dust×1"
    },
    "stats": {
      "def": 13,
      "agi": 8,
      "hp": 40
    },
    "slot": "feet",
    "jobRestrict": [
      "fighter",
      "rogue"
    ],
    "rarity": "Uncommon"
  },
  {
    "id": 242,
    "name": "Scale Leather",
    "description": "Scale Leather — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/scale-leather.png",
    "slug": "scale-leather",
    "kind": "intermediate",
    "craftLevel": 65,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1350,
      "materialsText": "Scale Hide×2, Bell Dust×1"
    }
  },
  {
    "id": 244,
    "name": "Scale Leather Chaps",
    "description": "Scale Leather Chaps. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/scale-leather-chaps.png",
    "slug": "scale-leather-chaps",
    "kind": "equipment",
    "craftLevel": 69,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1430,
      "materialsText": "Scale Leather×1, Bell Dust×1"
    },
    "stats": {
      "def": 24,
      "agi": 9,
      "hp": 52
    },
    "slot": "legs",
    "jobRestrict": [
      "fighter",
      "rogue"
    ],
    "rarity": "Uncommon"
  },
  {
    "id": 245,
    "name": "Scale Mail Helm",
    "description": "Scale Mail Helm. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/scale-mail-helm.png",
    "slug": "scale-mail-helm",
    "kind": "equipment",
    "craftLevel": 70,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1450,
      "materialsText": "Scale Leather×1, Bell Dust×1"
    },
    "stats": {
      "def": 16,
      "dex": 8,
      "acc": 8
    },
    "slot": "head",
    "jobRestrict": [
      "knight",
      "rogue"
    ],
    "rarity": "Epic"
  },
  {
    "id": 246,
    "name": "Scale Mail Gloves",
    "description": "Scale Mail Gloves. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/scale-mail-gloves.png",
    "slug": "scale-mail-gloves",
    "kind": "equipment",
    "craftLevel": 72,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1490,
      "materialsText": "Scale Leather×1, Bell Dust×1"
    },
    "stats": {
      "def": 16,
      "acc": 8,
      "dex": 8
    },
    "slot": "hands",
    "jobRestrict": [
      "knight",
      "rogue"
    ],
    "rarity": "Epic"
  },
  {
    "id": 247,
    "name": "Scale Mail",
    "description": "Scale Mail. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/scale-mail.png",
    "slug": "scale-mail",
    "kind": "equipment",
    "craftLevel": 74,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1530,
      "materialsText": "Scale Leather×3, Bell Dust×1"
    },
    "stats": {
      "def": 45,
      "vit": 10,
      "agi": 8,
      "hp": 55
    },
    "slot": "body",
    "jobRestrict": [
      "knight",
      "rogue"
    ],
    "rarity": "Epic"
  },
  {
    "id": 248,
    "name": "Scale Mail Trousers",
    "description": "Scale Mail Trousers. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/scale-mail-trousers.png",
    "slug": "scale-mail-trousers",
    "kind": "equipment",
    "craftLevel": 76,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1570,
      "materialsText": "Scale Leather×2, Bell Dust×1"
    },
    "stats": {
      "def": 25,
      "agi": 8,
      "hp": 80
    },
    "slot": "legs",
    "jobRestrict": [
      "knight",
      "rogue"
    ],
    "rarity": "Epic"
  },
  {
    "id": 249,
    "name": "Scale Mail Boots",
    "description": "Scale Mail Boots. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/scale-mail-boots.png",
    "slug": "scale-mail-boots",
    "kind": "equipment",
    "craftLevel": 78,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1610,
      "materialsText": "Scale Leather×2, Bell Dust×1"
    },
    "stats": {
      "def": 17,
      "agi": 11,
      "hp": 50
    },
    "slot": "feet",
    "jobRestrict": [
      "knight",
      "rogue"
    ],
    "rarity": "Epic"
  },
  {
    "id": 251,
    "name": "Scale Leather Belt",
    "description": "Scale Leather Belt — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/scale-leather-belt.png",
    "slug": "scale-leather-belt",
    "kind": "base",
    "craftLevel": 82,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1690,
      "materialsText": "Scale Leather×1, Throne Dust×1"
    }
  },
  {
    "id": 253,
    "name": "Scale Leather Stud Kit",
    "description": "Scale Leather Stud Kit — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/scale-leather-stud-kit.png",
    "slug": "scale-leather-stud-kit",
    "kind": "base",
    "craftLevel": 86,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1770,
      "materialsText": "Scale Leather×1, Throne Dust×1"
    }
  },
  {
    "id": 258,
    "name": "Rogue's Vest",
    "description": "Rogue's Vest. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/rogues-vest.png",
    "slug": "rogues-vest",
    "kind": "equipment",
    "craftLevel": 95,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1950,
      "materialsText": "Scale Leather×3, Jadeite×1, Scale Leather Belt×1, Scale Leather Stud Kit×1, Throne Dust×1"
    },
    "stats": {
      "def": 42,
      "agi": 41,
      "hp": 65
    },
    "slot": "body",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Rare"
  },
  {
    "id": 262,
    "name": "Linen Cloth",
    "description": "Linen Cloth — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/linen-cloth.png",
    "slug": "linen-cloth",
    "kind": "intermediate",
    "craftLevel": 1,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 70,
      "materialsText": "Linen Thread×3 or Linen Scrap×4, Pale Dust×1"
    }
  },
  {
    "id": 263,
    "name": "Linen Capelet",
    "description": "Linen Capelet. Ruined gear dug from the ashes of Anvilhold's fallen craft halls.",
    "icon": "/icons/items/linen-capelet.png",
    "slug": "linen-capelet",
    "kind": "equipment",
    "craftLevel": 3,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 110,
      "materialsText": "Linen Cloth×1, Pale Dust×1"
    },
    "stats": {
      "def": 4,
      "int": 3,
      "mp": 10,
      "hp": 6
    },
    "slot": "body",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Common"
  },
  {
    "id": 264,
    "name": "Linen Helm",
    "description": "Linen Helm. Ruined gear dug from the ashes of Anvilhold's fallen craft halls.",
    "icon": "/icons/items/linen-helm.png",
    "slug": "linen-helm",
    "kind": "equipment",
    "craftLevel": 4,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 130,
      "materialsText": "Linen Cloth×1, Pale Dust×1"
    },
    "stats": {
      "def": 2,
      "int": 1,
      "mnd": 1,
      "mp": 10
    },
    "slot": "head",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Common"
  },
  {
    "id": 265,
    "name": "Linen Cuffs",
    "description": "Linen Cuffs. Ruined gear dug from the ashes of Anvilhold's fallen craft halls.",
    "icon": "/icons/items/linen-cuffs.png",
    "slug": "linen-cuffs",
    "kind": "equipment",
    "craftLevel": 5,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 150,
      "materialsText": "Linen Cloth×1, Pale Dust×1"
    },
    "stats": {
      "def": 3,
      "mab": 1,
      "mnd": 1
    },
    "slot": "hands",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Common"
  },
  {
    "id": 266,
    "name": "Linen Socks",
    "description": "Linen Socks. Ruined gear dug from the ashes of Anvilhold's fallen craft halls.",
    "icon": "/icons/items/linen-socks.png",
    "slug": "linen-socks",
    "kind": "equipment",
    "craftLevel": 6,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 170,
      "materialsText": "Linen Cloth×1, Pale Dust×1"
    },
    "stats": {
      "def": 3,
      "agi": 1,
      "mp": 10
    },
    "slot": "feet",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Common"
  },
  {
    "id": 267,
    "name": "Linen Slops",
    "description": "Linen Slops. Ruined gear dug from the ashes of Anvilhold's fallen craft halls.",
    "icon": "/icons/items/linen-slops.png",
    "slug": "linen-slops",
    "kind": "equipment",
    "craftLevel": 8,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 210,
      "materialsText": "Linen Cloth×2, Pale Dust×1"
    },
    "stats": {
      "def": 4,
      "mp": 10,
      "mnd": 1
    },
    "slot": "legs",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Common"
  },
  {
    "id": 268,
    "name": "Linen Undersleeves",
    "description": "Linen Undersleeves — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/linen-undersleeves.png",
    "slug": "linen-undersleeves",
    "kind": "base",
    "craftLevel": 12,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 290,
      "materialsText": "Linen Cloth×1, Pale Dust×1"
    }
  },
  {
    "id": 269,
    "name": "Linen Scroll Bind",
    "description": "Linen Scroll Bind — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/linen-scroll-bind.png",
    "slug": "linen-scroll-bind",
    "kind": "base",
    "craftLevel": 14,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 330,
      "materialsText": "Linen Cloth×1, Pale Dust×1"
    }
  },
  {
    "id": 270,
    "name": "Linen Hood Blank",
    "description": "Linen Hood Blank — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/linen-hood-blank.png",
    "slug": "linen-hood-blank",
    "kind": "base",
    "craftLevel": 16,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 370,
      "materialsText": "Linen Cloth×1, Pale Dust×1"
    }
  },
  {
    "id": 271,
    "name": "Linen Sanctified Patch",
    "description": "Linen Sanctified Patch — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/linen-sanctified-patch.png",
    "slug": "linen-sanctified-patch",
    "kind": "base",
    "craftLevel": 18,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 410,
      "materialsText": "Linen Cloth×1, Pale Dust×1"
    }
  },
  {
    "id": 273,
    "name": "Spell Parchment",
    "description": "Spell Parchment — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/spell-parchment.png",
    "slug": "spell-parchment",
    "kind": "intermediate",
    "craftLevel": 22,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 490,
      "materialsText": "Parchment×1, Ink Salt×1, Ash Dust×1"
    }
  },
  {
    "id": 274,
    "name": "Linen Gloves",
    "description": "Linen Gloves. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/linen-gloves.png",
    "slug": "linen-gloves",
    "kind": "equipment",
    "craftLevel": 24,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 530,
      "materialsText": "Linen Cloth×1, Ash Dust×1"
    },
    "stats": {
      "def": 6,
      "mab": 3,
      "mnd": 2
    },
    "slot": "hands",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Common"
  },
  {
    "id": 276,
    "name": "Shade Helm",
    "description": "Shade Helm. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/shade-helm.png",
    "slug": "shade-helm",
    "kind": "equipment",
    "craftLevel": 28,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 610,
      "materialsText": "Linen Cloth×1, Shade Cotton×1, Ash Dust×1"
    },
    "stats": {
      "def": 7,
      "int": 2,
      "mnd": 2,
      "mp": 20
    },
    "slot": "head",
    "jobRestrict": [
      "tim",
      "sorcerer",
      "cleric",
      "battlemage",
      "druid"
    ],
    "rarity": "Uncommon"
  },
  {
    "id": 277,
    "name": "Shade Robe",
    "description": "Shade Robe. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/shade-robe.png",
    "slug": "shade-robe",
    "kind": "equipment",
    "craftLevel": 30,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 650,
      "materialsText": "Linen Cloth×3, Shade Cotton Thread×1, Ash Dust×1"
    },
    "stats": {
      "def": 15,
      "int": 15,
      "mp": 33,
      "hp": 19
    },
    "slot": "body",
    "jobRestrict": [
      "tim",
      "sorcerer",
      "cleric",
      "battlemage",
      "druid"
    ],
    "rarity": "Uncommon"
  },
  {
    "id": 278,
    "name": "Shade Cuffs",
    "description": "Shade Cuffs. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/shade-cuffs.png",
    "slug": "shade-cuffs",
    "kind": "equipment",
    "craftLevel": 32,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 690,
      "materialsText": "Linen Cloth×1, Shade Cotton×1, Ash Dust×1"
    },
    "stats": {
      "def": 8,
      "mab": 4,
      "mnd": 4
    },
    "slot": "hands",
    "jobRestrict": [
      "tim",
      "sorcerer",
      "cleric",
      "battlemage",
      "druid"
    ],
    "rarity": "Uncommon"
  },
  {
    "id": 279,
    "name": "Shade Slops",
    "description": "Shade Slops. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/shade-slops.png",
    "slug": "shade-slops",
    "kind": "equipment",
    "craftLevel": 34,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 730,
      "materialsText": "Linen Cloth×2, Shade Cotton×1, Ash Dust×1"
    },
    "stats": {
      "def": 11,
      "mp": 40,
      "mnd": 4
    },
    "slot": "legs",
    "jobRestrict": [
      "tim",
      "sorcerer",
      "cleric",
      "battlemage",
      "druid"
    ],
    "rarity": "Uncommon"
  },
  {
    "id": 280,
    "name": "Shade Pumps",
    "description": "Shade Pumps. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/shade-pumps.png",
    "slug": "shade-pumps",
    "kind": "equipment",
    "craftLevel": 36,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 770,
      "materialsText": "Linen Cloth×1, Shade Cotton×1, Ash Dust×1"
    },
    "stats": {
      "def": 9,
      "agi": 3,
      "mp": 50
    },
    "slot": "feet",
    "jobRestrict": [
      "tim",
      "sorcerer",
      "cleric",
      "battlemage",
      "druid"
    ],
    "rarity": "Uncommon"
  },
  {
    "id": 282,
    "name": "Silk Cloth",
    "description": "Silk Cloth — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/silk-cloth.png",
    "slug": "silk-cloth",
    "kind": "intermediate",
    "craftLevel": 45,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 950,
      "materialsText": "Spun Silk×1, Slag Dust×1"
    }
  },
  {
    "id": 284,
    "name": "Silk Hat",
    "description": "Silk Hat. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/silk-hat.png",
    "slug": "silk-hat",
    "kind": "equipment",
    "craftLevel": 48,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1010,
      "materialsText": "Silk Cloth×1, Slag Dust×1"
    },
    "stats": {
      "def": 11,
      "int": 3,
      "mnd": 3,
      "mp": 30
    },
    "slot": "head",
    "jobRestrict": [
      "tim",
      "sorcerer",
      "cleric",
      "battlemage",
      "druid"
    ],
    "rarity": "Uncommon"
  },
  {
    "id": 285,
    "name": "Silk Coat",
    "description": "Silk Coat. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/silk-coat.png",
    "slug": "silk-coat",
    "kind": "equipment",
    "craftLevel": 50,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1050,
      "materialsText": "Silk Cloth×3, Slag Dust×1"
    },
    "stats": {
      "def": 23,
      "int": 23,
      "mp": 49,
      "hp": 27
    },
    "slot": "body",
    "jobRestrict": [
      "tim",
      "sorcerer",
      "cleric",
      "battlemage",
      "druid"
    ],
    "rarity": "Rare"
  },
  {
    "id": 286,
    "name": "Silk Cuffs",
    "description": "Silk Cuffs. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/silk-cuffs.png",
    "slug": "silk-cuffs",
    "kind": "equipment",
    "craftLevel": 52,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1090,
      "materialsText": "Silk Cloth×1, Slag Dust×1"
    },
    "stats": {
      "def": 12,
      "mab": 6,
      "mnd": 6
    },
    "slot": "hands",
    "jobRestrict": [
      "tim",
      "sorcerer",
      "cleric",
      "battlemage",
      "druid"
    ],
    "rarity": "Uncommon"
  },
  {
    "id": 287,
    "name": "Silk Slacks",
    "description": "Silk Slacks. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/silk-slacks.png",
    "slug": "silk-slacks",
    "kind": "equipment",
    "craftLevel": 54,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1130,
      "materialsText": "Silk Cloth×2, Slag Dust×1"
    },
    "stats": {
      "def": 17,
      "mp": 60,
      "mnd": 6
    },
    "slot": "legs",
    "jobRestrict": [
      "tim",
      "sorcerer",
      "cleric",
      "battlemage",
      "druid"
    ],
    "rarity": "Uncommon"
  },
  {
    "id": 288,
    "name": "Silk Pumps",
    "description": "Silk Pumps. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/silk-pumps.png",
    "slug": "silk-pumps",
    "kind": "equipment",
    "craftLevel": 56,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1170,
      "materialsText": "Silk Cloth×1, Slag Dust×1"
    },
    "stats": {
      "def": 13,
      "agi": 5,
      "mp": 70
    },
    "slot": "feet",
    "jobRestrict": [
      "tim",
      "sorcerer",
      "cleric",
      "battlemage",
      "druid"
    ],
    "rarity": "Uncommon"
  },
  {
    "id": 292,
    "name": "Silk Gloves",
    "description": "Silk Gloves. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/silk-gloves.png",
    "slug": "silk-gloves",
    "kind": "equipment",
    "craftLevel": 64,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1330,
      "materialsText": "Silk Cloth×1, Bell Dust×1"
    },
    "stats": {
      "def": 14,
      "mab": 7,
      "mnd": 7
    },
    "slot": "hands",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Uncommon"
  },
  {
    "id": 293,
    "name": "Velvet Cloth",
    "description": "Velvet Cloth — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/velvet-cloth.png",
    "slug": "velvet-cloth",
    "kind": "intermediate",
    "craftLevel": 65,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1350,
      "materialsText": "Velvet Thread×3, Silk Cloth×1, Bell Dust×1"
    }
  },
  {
    "id": 295,
    "name": "Velvet Shirt",
    "description": "Velvet Shirt. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/velvet-shirt.png",
    "slug": "velvet-shirt",
    "kind": "equipment",
    "craftLevel": 69,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1430,
      "materialsText": "Velvet Cloth×1, Bell Dust×1"
    },
    "stats": {
      "def": 28,
      "int": 26,
      "mp": 58,
      "hp": 30
    },
    "slot": "body",
    "jobRestrict": [
      "tim",
      "sorcerer"
    ],
    "rarity": "Rare"
  },
  {
    "id": 296,
    "name": "Velvet Hat",
    "description": "Velvet Hat. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/velvet-hat.png",
    "slug": "velvet-hat",
    "kind": "equipment",
    "craftLevel": 70,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1450,
      "materialsText": "Velvet Cloth×1, Bell Dust×1"
    },
    "stats": {
      "def": 16,
      "int": 8,
      "mp": 80
    },
    "slot": "head",
    "jobRestrict": [
      "tim",
      "sorcerer"
    ],
    "rarity": "Rare"
  },
  {
    "id": 297,
    "name": "Velvet Coat",
    "description": "Velvet Coat. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/velvet-coat.png",
    "slug": "velvet-coat",
    "kind": "equipment",
    "craftLevel": 72,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1490,
      "materialsText": "Velvet Cloth×3, Bell Dust×1"
    },
    "stats": {
      "def": 31,
      "int": 31,
      "mp": 65,
      "hp": 35
    },
    "slot": "body",
    "jobRestrict": [
      "tim",
      "sorcerer"
    ],
    "rarity": "Rare"
  },
  {
    "id": 298,
    "name": "Velvet Cuffs",
    "description": "Velvet Cuffs. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/velvet-cuffs.png",
    "slug": "velvet-cuffs",
    "kind": "equipment",
    "craftLevel": 74,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1530,
      "materialsText": "Velvet Cloth×1, Bell Dust×1"
    },
    "stats": {
      "def": 16,
      "mab": 9,
      "int": 6
    },
    "slot": "hands",
    "jobRestrict": [
      "tim",
      "sorcerer"
    ],
    "rarity": "Rare"
  },
  {
    "id": 299,
    "name": "Velvet Slacks",
    "description": "Velvet Slacks. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/velvet-slacks.png",
    "slug": "velvet-slacks",
    "kind": "equipment",
    "craftLevel": 76,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1570,
      "materialsText": "Velvet Cloth×2, Bell Dust×1"
    },
    "stats": {
      "def": 25,
      "mp": 80,
      "int": 8
    },
    "slot": "legs",
    "jobRestrict": [
      "tim",
      "sorcerer"
    ],
    "rarity": "Rare"
  },
  {
    "id": 300,
    "name": "Velvet Pumps",
    "description": "Velvet Pumps. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/velvet-pumps.png",
    "slug": "velvet-pumps",
    "kind": "equipment",
    "craftLevel": 78,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1610,
      "materialsText": "Velvet Cloth×1, Bell Dust×1"
    },
    "stats": {
      "def": 17,
      "agi": 6,
      "mp": 100
    },
    "slot": "feet",
    "jobRestrict": [
      "tim",
      "sorcerer"
    ],
    "rarity": "Rare"
  },
  {
    "id": 301,
    "name": "Bell Torque Band",
    "description": "Bell Torque Band. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/bell-torque-band.png",
    "slug": "bell-torque-band",
    "kind": "equipment",
    "craftLevel": 75,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 1550,
      "materialsText": "Mythril Ingot×1, Fine Leather×1, Bell Dust×1"
    },
    "stats": {
      "def": 17,
      "hp": 80,
      "mp": 80
    },
    "slot": "head",
    "rarity": "Uncommon"
  },
  {
    "id": 303,
    "name": "Velvet Gloves",
    "description": "Velvet Gloves. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/velvet-gloves.png",
    "slug": "velvet-gloves",
    "kind": "equipment",
    "craftLevel": 84,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1730,
      "materialsText": "Velvet Cloth×1, Throne Dust×1"
    },
    "stats": {
      "def": 18,
      "mab": 10,
      "int": 7
    },
    "slot": "hands",
    "jobRestrict": [
      "tim",
      "sorcerer"
    ],
    "rarity": "Rare"
  },
  {
    "id": 304,
    "name": "Copper Collar",
    "description": "Copper Collar. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/copper-collar.png",
    "slug": "copper-collar",
    "kind": "equipment",
    "craftLevel": 20,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 450,
      "materialsText": "Copper Ore×2, Leather×1, Ash Dust×1"
    },
    "stats": {
      "str": 2,
      "vit": 2,
      "hp": 10
    },
    "slot": "earring",
    "jobRestrict": "all",
    "rarity": "Common"
  },
  {
    "id": 306,
    "name": "Velvet Hose",
    "description": "Velvet Hose. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/velvet-hose.png",
    "slug": "velvet-hose",
    "kind": "equipment",
    "craftLevel": 90,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1850,
      "materialsText": "Velvet Cloth×1, Throne Dust×1"
    },
    "stats": {
      "def": 28,
      "mp": 95,
      "int": 9
    },
    "slot": "legs",
    "jobRestrict": [
      "tim",
      "sorcerer"
    ],
    "rarity": "Rare"
  },
  {
    "id": 307,
    "name": "Cleric's Bliaut",
    "description": "Cleric's Bliaut. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/clerics-bliaut.png",
    "slug": "clerics-bliaut",
    "kind": "equipment",
    "craftLevel": 92,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1890,
      "materialsText": "Velvet Cloth×2, Jadeite×1, Throne Dust×1"
    },
    "stats": {
      "def": 39,
      "int": 39,
      "mp": 81,
      "hp": 43
    },
    "slot": "body",
    "jobRestrict": [
      "cleric"
    ],
    "rarity": "Epic"
  },
  {
    "id": 309,
    "name": "Throneweave Robe",
    "description": "Throneweave Robe. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/throneweave-robe.png",
    "slug": "throneweave-robe",
    "kind": "equipment",
    "craftLevel": 95,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1950,
      "materialsText": "Velvet Cloth×3, Diamond×1, Throne Dust×1"
    },
    "stats": {
      "def": 41,
      "int": 41,
      "mp": 85,
      "hp": 45
    },
    "slot": "body",
    "jobRestrict": [
      "tim",
      "sorcerer"
    ],
    "rarity": "Legendary"
  },
  {
    "id": 313,
    "name": "Bone Ring",
    "description": "Bone Ring. Ruined gear dug from the ashes of Anvilhold's fallen craft halls.",
    "icon": "/icons/items/bone-ring.png",
    "slug": "bone-ring",
    "kind": "equipment",
    "craftLevel": 1,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 70,
      "materialsText": "Bone Chip×2, Pale Dust×1"
    },
    "stats": {
      "str": 1,
      "hp": 5
    },
    "slot": "ring",
    "rarity": "Common"
  },
  {
    "id": 314,
    "name": "Bone Earring",
    "description": "Bone Earring. Ruined gear dug from the ashes of Anvilhold's fallen craft halls.",
    "icon": "/icons/items/bone-earring.png",
    "slug": "bone-earring",
    "kind": "equipment",
    "craftLevel": 3,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 110,
      "materialsText": "Bone Chip×1, Pale Dust×1"
    },
    "stats": {
      "mnd": 1,
      "mp": 5
    },
    "slot": "earring",
    "rarity": "Common"
  },
  {
    "id": 315,
    "name": "Mythril Torque",
    "description": "Mythril Torque. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/mythril-torque.png",
    "slug": "mythril-torque",
    "kind": "equipment",
    "craftLevel": 45,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 950,
      "materialsText": "Mythril Ingot×1, Fine Leather×1, Slag Dust×1"
    },
    "stats": {
      "def": 11,
      "hp": 50,
      "mp": 50
    },
    "slot": "head",
    "jobRestrict": "all",
    "rarity": "Rare"
  },
  {
    "id": 316,
    "name": "Bone Knuckles",
    "description": "Bone Knuckles. Ruined gear dug from the ashes of Anvilhold's fallen craft halls.",
    "icon": "/icons/items/bone-knuckles.png",
    "slug": "bone-knuckles",
    "kind": "equipment",
    "craftLevel": 7,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 190,
      "materialsText": "Bone Chip×2, Pale Dust×1"
    },
    "stats": {
      "atk": 5,
      "str": 2
    },
    "delayMs": 1800,
    "slot": "main",
    "twoHand": true,
    "jobRestrict": [
      "fighter"
    ],
    "weaponFamily": "knuckles",
    "rarity": "Common"
  },
  {
    "id": 317,
    "name": "Bone Dagger",
    "description": "Bone Dagger. Ruined gear dug from the ashes of Anvilhold's fallen craft halls.",
    "icon": "/icons/items/bone-dagger.png",
    "slug": "bone-dagger",
    "kind": "equipment",
    "craftLevel": 8,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 210,
      "materialsText": "Bone Chip×2, Soft Pelt×1, Pale Dust×1"
    },
    "stats": {
      "atk": 4,
      "dex": 3
    },
    "delayMs": 1800,
    "slot": "main",
    "jobRestrict": [
      "rogue"
    ],
    "weaponFamily": "dagger",
    "rarity": "Common",
    "obtainedFrom": "Craft — Bone Chip (Pale Hollow)"
  },
  {
    "id": 318,
    "name": "Bone Greave Blank",
    "description": "Bone Greave Blank — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/bone-greave-blank.png",
    "slug": "bone-greave-blank",
    "kind": "base",
    "craftLevel": 10,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 250,
      "materialsText": "Bone Chip×2, Pale Dust×1"
    }
  },
  {
    "id": 319,
    "name": "Palace Gorget",
    "description": "Palace Gorget. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/palace-gorget.png",
    "slug": "palace-gorget",
    "kind": "equipment",
    "craftLevel": 92,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 1890,
      "materialsText": "Orichalcum Ingot×1, Diamond×1, Throne Dust×1"
    },
    "stats": {
      "def": 20,
      "hp": 100,
      "mp": 100
    },
    "slot": "head",
    "jobRestrict": [
      "knight",
      "cleric"
    ],
    "rarity": "Legendary"
  },
  {
    "id": 320,
    "name": "Bone Shell Buckle",
    "description": "Bone Shell Buckle — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/bone-shell-buckle.png",
    "slug": "bone-shell-buckle",
    "kind": "base",
    "craftLevel": 14,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 330,
      "materialsText": "Bone Chip×2, Pale Dust×1"
    }
  },
  {
    "id": 321,
    "name": "Bone Skull Charm",
    "description": "Bone Skull Charm — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/bone-skull-charm.png",
    "slug": "bone-skull-charm",
    "kind": "base",
    "craftLevel": 16,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 370,
      "materialsText": "Bone Chip×2, Pale Dust×1"
    }
  },
  {
    "id": 322,
    "name": "Bone Onyx Socket",
    "description": "Bone Onyx Socket — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/bone-onyx-socket.png",
    "slug": "bone-onyx-socket",
    "kind": "base",
    "craftLevel": 18,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 410,
      "materialsText": "Bone Chip×2, Pale Dust×1"
    }
  },
  {
    "id": 323,
    "name": "Fang Earring",
    "description": "Fang Earring. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/fang-earring.png",
    "slug": "fang-earring",
    "kind": "equipment",
    "craftLevel": 20,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 450,
      "materialsText": "Bone Chip×1, Horn×1, Ash Dust×1"
    },
    "stats": {
      "atk": 3,
      "acc": 2
    },
    "slot": "earring",
    "rarity": "Rare"
  },
  {
    "id": 324,
    "name": "Ash AGI Elixir",
    "description": "Ash AGI Elixir. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/ash-agi-elixir.png",
    "slug": "ash-agi-elixir",
    "kind": "consumable",
    "craftLevel": 34,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 730,
      "materialsText": "Distilled Ash×1, Ash Dust×1"
    },
    "stats": {
      "hp": 122,
      "mp": 122
    },
    "consume": {
      "hp": 122,
      "mp": 122
    }
  },
  {
    "id": 325,
    "name": "Bone Hilt",
    "description": "Bone Hilt — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/bone-hilt.png",
    "slug": "bone-hilt",
    "kind": "intermediate",
    "craftLevel": 24,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 530,
      "materialsText": "Bone Chip×1, Ash Dust×1"
    }
  },
  {
    "id": 326,
    "name": "Scarabrace Ring",
    "description": "Scarabrace Ring. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/scarabrace-ring.png",
    "slug": "scarabrace-ring",
    "kind": "equipment",
    "craftLevel": 25,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 550,
      "materialsText": "Skull Plate×1, Ash Dust×1"
    },
    "stats": {
      "dex": 3,
      "agi": 2
    },
    "slot": "ring",
    "rarity": "Rare"
  },
  {
    "id": 327,
    "name": "Bone Harness",
    "description": "Bone Harness. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/bone-harness.png",
    "slug": "bone-harness",
    "kind": "equipment",
    "craftLevel": 28,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 610,
      "materialsText": "Giant Femur×1, Desiccated Hide×1, Ash Dust×1"
    },
    "stats": {
      "def": 20,
      "str": 5,
      "dex": 3,
      "hp": 20
    },
    "slot": "body",
    "jobRestrict": [
      "fighter",
      "rogue"
    ],
    "rarity": "Common"
  },
  {
    "id": 328,
    "name": "Bone Helm",
    "description": "Bone Helm. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/bone-helm.png",
    "slug": "bone-helm",
    "kind": "equipment",
    "craftLevel": 30,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 650,
      "materialsText": "Skull Plate×1, Soft Pelt×1, Ash Dust×1"
    },
    "stats": {
      "def": 8,
      "dex": 4,
      "acc": 4
    },
    "slot": "head",
    "jobRestrict": [
      "fighter",
      "rogue"
    ],
    "rarity": "Common"
  },
  {
    "id": 329,
    "name": "Bone Inlay",
    "description": "Bone Inlay — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/bone-inlay.png",
    "slug": "bone-inlay",
    "kind": "base",
    "craftLevel": 32,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 690,
      "materialsText": "Bone Chip×2, Ash Dust×1"
    }
  },
  {
    "id": 330,
    "name": "Bone Trousers",
    "description": "Bone Trousers. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/bone-trousers.png",
    "slug": "bone-trousers",
    "kind": "equipment",
    "craftLevel": 35,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 750,
      "materialsText": "Giant Femur×1, Soft Pelt×1, Slag Dust×1"
    },
    "stats": {
      "def": 13,
      "agi": 4,
      "hp": 40
    },
    "slot": "legs",
    "jobRestrict": [
      "fighter",
      "rogue"
    ],
    "rarity": "Common"
  },
  {
    "id": 333,
    "name": "Horn Ring",
    "description": "Horn Ring. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/horn-ring.png",
    "slug": "horn-ring",
    "kind": "equipment",
    "craftLevel": 40,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 850,
      "materialsText": "Horn×2, Slag Dust×1"
    },
    "stats": {
      "atk": 4,
      "str": 2
    },
    "slot": "ring",
    "rarity": "Uncommon"
  },
  {
    "id": 334,
    "name": "Turtle Ring",
    "description": "Turtle Ring. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/turtle-ring.png",
    "slug": "turtle-ring",
    "kind": "equipment",
    "craftLevel": 45,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 950,
      "materialsText": "Stone Scale×2, Bone Chip×1, Slag Dust×1"
    },
    "stats": {
      "vit": 3,
      "def": 4,
      "hp": 15
    },
    "slot": "ring",
    "rarity": "Uncommon"
  },
  {
    "id": 335,
    "name": "Shell Shield",
    "description": "Shell Shield. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/shell-shield.png",
    "slug": "shell-shield",
    "kind": "equipment",
    "craftLevel": 48,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 1010,
      "materialsText": "Stone Scale×4, Slag Dust×1"
    },
    "stats": {
      "def": 22,
      "vit": 5
    },
    "slot": "sub",
    "rarity": "Uncommon"
  },
  {
    "id": 336,
    "name": "Mythril Bone Earring",
    "description": "Mythril Bone Earring. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/mythril-bone-earring.png",
    "slug": "mythril-bone-earring",
    "kind": "equipment",
    "craftLevel": 50,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 1050,
      "materialsText": "Mythril Ingot×1, Bone Chip×1, Slag Dust×1"
    },
    "stats": {
      "vit": 4,
      "hp": 25
    },
    "slot": "earring",
    "rarity": "Rare"
  },
  {
    "id": 337,
    "name": "Cowl of the First Pit",
    "description": "Cowl of the First Pit. Bone-hide wrap from the first sink that opened under Anvilhold.",
    "icon": "/icons/items/skull-bandana.png",
    "slug": "skull-bandana",
    "kind": "equipment",
    "craftLevel": 55,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 1150,
      "materialsText": "Skull Plate×1, Soft Pelt×1, Slag Dust×1"
    },
    "stats": {
      "def": 13,
      "dex": 6,
      "agi": 6
    },
    "slot": "head",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Legendary"
  },
  {
    "id": 341,
    "name": "Dark Onyx Ring",
    "description": "Dark Onyx Ring. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/dark-onyx-ring.png",
    "slug": "dark-onyx-ring",
    "kind": "equipment",
    "craftLevel": 70,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 1450,
      "materialsText": "Onyx×1, Bone Chip×1, Bell Dust×1"
    },
    "stats": {
      "str": 4,
      "atk": 5,
      "acc": 3
    },
    "slot": "ring",
    "rarity": "Uncommon"
  },
  {
    "id": 342,
    "name": "Slag Binding Agent",
    "description": "Slag Binding Agent. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/slag-binding-agent.png",
    "slug": "slag-binding-agent",
    "kind": "consumable",
    "craftLevel": 44,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 930,
      "materialsText": "Distilled Ash×1, Slag Dust×1"
    },
    "stats": {
      "hp": 47
    },
    "consume": {
      "hp": 47
    }
  },
  {
    "id": 344,
    "name": "Bone Bracer",
    "description": "Bone Bracer. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/bone-bracer.png",
    "slug": "bone-bracer",
    "kind": "equipment",
    "craftLevel": 88,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 1810,
      "materialsText": "Giant Femur×1, Throne Dust×1"
    },
    "stats": {
      "def": 19,
      "dex": 8,
      "acc": 8
    },
    "slot": "hands",
    "jobRestrict": [
      "fighter",
      "rogue"
    ],
    "rarity": "Common"
  },
  {
    "id": 345,
    "name": "Diamond Ring",
    "description": "Diamond Ring. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/diamond-ring.png",
    "slug": "diamond-ring",
    "kind": "equipment",
    "craftLevel": 90,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 1850,
      "materialsText": "Diamond×1, Orichalcum Ingot×1, Bone Inlay×2, Ash Bone Shell Buckle×1, Throne Dust×1"
    },
    "stats": {
      "str": 3,
      "dex": 3,
      "vit": 3,
      "agi": 3,
      "int": 3,
      "mnd": 3
    },
    "slot": "ring",
    "jobRestrict": "all",
    "rarity": "Rare"
  },
  {
    "id": 346,
    "name": "Royal Bone Sigil",
    "description": "Royal Bone Sigil. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/royal-bone-sigil.png",
    "slug": "royal-bone-sigil",
    "kind": "equipment",
    "craftLevel": 100,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 2050,
      "materialsText": "Diamond×1, Skull Plate×1, Throne Dust×1"
    },
    "stats": {
      "str": 5,
      "vit": 4,
      "atk": 6,
      "hp": 30
    },
    "slot": "ring",
    "rarity": "Legendary"
  },
  {
    "id": 347,
    "name": "Glass Bead",
    "description": "Glass Bead — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/glass-bead.png",
    "slug": "glass-bead",
    "kind": "intermediate",
    "craftLevel": 1,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 70,
      "materialsText": "River Sand×2, Potter's Clay×1 or Limestone×3, Pale Dust×1"
    }
  },
  {
    "id": 348,
    "name": "Goldsmith Earring",
    "description": "Goldsmith Earring. Ruined gear dug from the ashes of Anvilhold's fallen craft halls.",
    "icon": "/icons/items/goldsmith-earring.png",
    "slug": "goldsmith-earring",
    "kind": "equipment",
    "craftLevel": 3,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 110,
      "materialsText": "Copper Ore×1, Pale Dust×1"
    },
    "stats": {
      "int": 1,
      "mp": 5
    },
    "slot": "earring",
    "rarity": "Common"
  },
  {
    "id": 349,
    "name": "Copper Ring",
    "description": "Copper Ring. Ruined gear dug from the ashes of Anvilhold's fallen craft halls.",
    "icon": "/icons/items/copper-ring.png",
    "slug": "copper-ring",
    "kind": "equipment",
    "craftLevel": 5,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 150,
      "materialsText": "Copper Ore×2, Pale Dust×1"
    },
    "stats": {
      "acc": 2,
      "dex": 1
    },
    "slot": "ring",
    "rarity": "Common"
  },
  {
    "id": 350,
    "name": "Slag Burn Salve",
    "description": "Slag Burn Salve. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/slag-burn-salve.png",
    "slug": "slag-burn-salve",
    "kind": "consumable",
    "craftLevel": 47,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 990,
      "materialsText": "Distilled Ash×1, Slag Dust×1"
    },
    "stats": {
      "hp": 50
    },
    "consume": {
      "hp": 50
    }
  },
  {
    "id": 351,
    "name": "Slag STR Elixir",
    "description": "Slag STR Elixir. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/slag-str-elixir.png",
    "slug": "slag-str-elixir",
    "kind": "consumable",
    "craftLevel": 49,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 1030,
      "materialsText": "Distilled Ash×1, Slag Dust×1"
    },
    "stats": {
      "hp": 140,
      "mp": 140
    },
    "consume": {
      "hp": 140,
      "mp": 140
    }
  },
  {
    "id": 352,
    "name": "Goldsmith Signet Blank",
    "description": "Goldsmith Signet Blank — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/goldsmith-signet-blank.png",
    "slug": "goldsmith-signet-blank",
    "kind": "base",
    "craftLevel": 11,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 270,
      "materialsText": "Copper Ore×1, Pale Dust×1"
    }
  },
  {
    "id": 353,
    "name": "Goldsmith Chip Mount",
    "description": "Goldsmith Chip Mount — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/goldsmith-chip-mount.png",
    "slug": "goldsmith-chip-mount",
    "kind": "base",
    "craftLevel": 13,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 310,
      "materialsText": "Copper Ore×1 or Tile Shard×2, Pale Dust×1"
    }
  },
  {
    "id": 354,
    "name": "Circlet",
    "description": "Circlet. Ruined gear dug from the ashes of Anvilhold's fallen craft halls.",
    "icon": "/icons/items/circlet.png",
    "slug": "circlet",
    "kind": "equipment",
    "craftLevel": 15,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 350,
      "materialsText": "Bronze Ingot×1, Glass Bead×1, Copper Goldsmith Cabochon×1, Ash Dust×1"
    },
    "stats": {
      "def": 5,
      "hp": 20,
      "mp": 20
    },
    "slot": "head",
    "rarity": "Uncommon"
  },
  {
    "id": 355,
    "name": "Slag INT Elixir",
    "description": "Slag INT Elixir. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/slag-int-elixir.png",
    "slug": "slag-int-elixir",
    "kind": "consumable",
    "craftLevel": 52,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 1090,
      "materialsText": "Distilled Ash×1, Slag Dust×1"
    },
    "stats": {
      "hp": 146,
      "mp": 146
    },
    "consume": {
      "hp": 146,
      "mp": 146
    }
  },
  {
    "id": 356,
    "name": "Slag AGI Elixir",
    "description": "Slag AGI Elixir. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/slag-agi-elixir.png",
    "slug": "slag-agi-elixir",
    "kind": "consumable",
    "craftLevel": 54,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 1130,
      "materialsText": "Distilled Ash×1, Slag Dust×1"
    },
    "stats": {
      "hp": 146,
      "mp": 146
    },
    "consume": {
      "hp": 146,
      "mp": 146
    }
  },
  {
    "id": 357,
    "name": "Slag Cluster Shell",
    "description": "Slag Cluster Shell — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/slag-cluster-shell.png",
    "slug": "slag-cluster-shell",
    "kind": "base",
    "craftLevel": 57,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 1190,
      "materialsText": "Distilled Ash×1, Slag Dust×1"
    }
  },
  {
    "id": 358,
    "name": "Ash Ring",
    "description": "Ash Ring. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/ash-ring.png",
    "slug": "ash-ring",
    "kind": "equipment",
    "craftLevel": 25,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 550,
      "materialsText": "Tin Ore×2, Copper Ore×1, Ash Dust×1"
    },
    "stats": {
      "int": 3,
      "mab": 2
    },
    "slot": "ring",
    "rarity": "Common"
  },
  {
    "id": 359,
    "name": "Lapis Earring",
    "description": "Lapis Earring. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/lapis-earring.png",
    "slug": "lapis-earring",
    "kind": "equipment",
    "craftLevel": 30,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 650,
      "materialsText": "Lapis×1, Copper Ore×1, Ash Dust×1"
    },
    "stats": {
      "int": 3,
      "mp": 10
    },
    "slot": "earring",
    "rarity": "Uncommon"
  },
  {
    "id": 360,
    "name": "Bell Binding Agent",
    "description": "Bell Binding Agent. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/bell-binding-agent.png",
    "slug": "bell-binding-agent",
    "kind": "consumable",
    "craftLevel": 64,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 1330,
      "materialsText": "Distilled Ash×1, Bell Dust×1"
    },
    "stats": {
      "hp": 59
    },
    "consume": {
      "hp": 59
    }
  },
  {
    "id": 361,
    "name": "Bell Burn Salve",
    "description": "Bell Burn Salve. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/bell-burn-salve.png",
    "slug": "bell-burn-salve",
    "kind": "consumable",
    "craftLevel": 67,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 1390,
      "materialsText": "Distilled Ash×1, Bell Dust×1"
    },
    "stats": {
      "hp": 62
    },
    "consume": {
      "hp": 62
    }
  },
  {
    "id": 362,
    "name": "Bell STR Elixir",
    "description": "Bell STR Elixir. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/bell-str-elixir.png",
    "slug": "bell-str-elixir",
    "kind": "consumable",
    "craftLevel": 69,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 1430,
      "materialsText": "Distilled Ash×1, Bell Dust×1"
    },
    "stats": {
      "hp": 164,
      "mp": 164
    },
    "consume": {
      "hp": 164,
      "mp": 164
    }
  },
  {
    "id": 363,
    "name": "Bell INT Elixir",
    "description": "Bell INT Elixir. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/bell-int-elixir.png",
    "slug": "bell-int-elixir",
    "kind": "consumable",
    "craftLevel": 72,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 1490,
      "materialsText": "Distilled Ash×1, Bell Dust×1"
    },
    "stats": {
      "hp": 170,
      "mp": 170
    },
    "consume": {
      "hp": 170,
      "mp": 170
    }
  },
  {
    "id": 364,
    "name": "Bell AGI Elixir",
    "description": "Bell AGI Elixir. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/bell-agi-elixir.png",
    "slug": "bell-agi-elixir",
    "kind": "consumable",
    "craftLevel": 74,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 1530,
      "materialsText": "Distilled Ash×1, Bell Dust×1"
    },
    "stats": {
      "hp": 170,
      "mp": 170
    },
    "consume": {
      "hp": 170,
      "mp": 170
    }
  },
  {
    "id": 367,
    "name": "Mythril Ring",
    "description": "Mythril Ring. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/mythril-ring.png",
    "slug": "mythril-ring",
    "kind": "equipment",
    "craftLevel": 45,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 950,
      "materialsText": "Mythril Ingot×1, Slag Dust×1"
    },
    "stats": {
      "mnd": 3,
      "mp": 15,
      "mab": 2
    },
    "slot": "ring",
    "rarity": "Rare"
  },
  {
    "id": 368,
    "name": "Mythril Chain",
    "description": "Mythril Chain — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/mythril-chain.png",
    "slug": "mythril-chain",
    "kind": "intermediate",
    "craftLevel": 48,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 1010,
      "materialsText": "Mythril Ingot×1, Slag Dust×1"
    }
  },
  {
    "id": 369,
    "name": "Jadeite Earring",
    "description": "Jadeite Earring. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/jadeite-earring.png",
    "slug": "jadeite-earring",
    "kind": "equipment",
    "craftLevel": 50,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 1050,
      "materialsText": "Jadeite×1, Mythril Ingot×1, Slag Dust×1"
    },
    "stats": {
      "mnd": 4,
      "mab": 3
    },
    "slot": "earring",
    "rarity": "Epic"
  },
  {
    "id": 370,
    "name": "Onyx Earring",
    "description": "Onyx Earring. Tempered gear from Mayflower's forges, made by hands that still remember the makers' names.",
    "icon": "/icons/items/onyx-earring.png",
    "slug": "onyx-earring",
    "kind": "equipment",
    "craftLevel": 52,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 1090,
      "materialsText": "Onyx×1, Mythril Ingot×1, Slag Dust×1"
    },
    "stats": {
      "str": 3,
      "atk": 4
    },
    "slot": "earring",
    "rarity": "Uncommon"
  },
  {
    "id": 372,
    "name": "Goldsmith Filigree",
    "description": "Goldsmith Filigree — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/goldsmith-filigree.png",
    "slug": "goldsmith-filigree",
    "kind": "base",
    "craftLevel": 68,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 1410,
      "materialsText": "Mythril Ingot×1, Bell Dust×1"
    }
  },
  {
    "id": 373,
    "name": "Bell Ring",
    "description": "Bell Ring. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/bell-ring.png",
    "slug": "bell-ring",
    "kind": "equipment",
    "craftLevel": 70,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 1450,
      "materialsText": "Mythril Ingot×1, Bell Dust×1"
    },
    "stats": {
      "mnd": 4,
      "mab": 4,
      "mp": 20
    },
    "slot": "ring",
    "rarity": "Uncommon"
  },
  {
    "id": 374,
    "name": "Throne Binding Agent",
    "description": "Throne Binding Agent. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/throne-binding-agent.png",
    "slug": "throne-binding-agent",
    "kind": "consumable",
    "craftLevel": 84,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 1730,
      "materialsText": "Distilled Ash×1, Throne Dust×1"
    },
    "stats": {
      "hp": 71
    },
    "consume": {
      "hp": 71
    }
  },
  {
    "id": 376,
    "name": "Diamond Earring",
    "description": "Diamond Earring. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/diamond-earring.png",
    "slug": "diamond-earring",
    "kind": "equipment",
    "craftLevel": 90,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 1850,
      "materialsText": "Diamond×1, Orichalcum Ingot×1, Throne Dust×1"
    },
    "stats": {
      "int": 4,
      "mnd": 4,
      "mab": 4,
      "mp": 20
    },
    "slot": "earring",
    "rarity": "Epic"
  },
  {
    "id": 377,
    "name": "Palace Signet",
    "description": "Palace Signet. Throne-forged gear, wrought in the old Anvilhold manner the New Kings tried to burn away.",
    "icon": "/icons/items/palace-signet.png",
    "slug": "palace-signet",
    "kind": "equipment",
    "craftLevel": 100,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 2050,
      "materialsText": "Diamond×1, Ornamented Plate Accent×1, Throne Dust×1"
    },
    "stats": {
      "int": 5,
      "mnd": 4,
      "mab": 6,
      "mp": 30
    },
    "slot": "ring",
    "rarity": "Legendary"
  },
  {
    "id": 378,
    "name": "Distilled Ash",
    "description": "Distilled Ash — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/distilled-ash.png",
    "slug": "distilled-ash",
    "kind": "intermediate",
    "craftLevel": 20,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 450,
      "materialsText": "Ash Dust×2, Antidote Root×1"
    }
  },
  {
    "id": 379,
    "name": "Antidote",
    "description": "Antidote. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/antidote.png",
    "slug": "antidote",
    "kind": "consumable",
    "craftLevel": 3,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 110,
      "materialsText": "Antidote Root×1, Pale Dust×1"
    },
    "stats": {
      "hp": 23
    },
    "consume": {
      "hp": 23
    }
  },
  {
    "id": 380,
    "name": "Burn Salve",
    "description": "Burn Salve. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/burn-salve.png",
    "slug": "burn-salve",
    "kind": "consumable",
    "craftLevel": 7,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 190,
      "materialsText": "Distilled Pale×1, Pale Dust×1"
    },
    "stats": {
      "hp": 26
    },
    "consume": {
      "hp": 26
    }
  },
  {
    "id": 381,
    "name": "STR Elixir",
    "description": "STR Elixir. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/str-elixir.png",
    "slug": "str-elixir",
    "kind": "consumable",
    "craftLevel": 9,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 230,
      "materialsText": "Distilled Pale×1, Pale Dust×1"
    },
    "stats": {
      "hp": 92,
      "mp": 92
    },
    "consume": {
      "hp": 92,
      "mp": 92
    }
  },
  {
    "id": 382,
    "name": "VIT Elixir",
    "description": "VIT Elixir. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/vit-elixir.png",
    "slug": "vit-elixir",
    "kind": "consumable",
    "craftLevel": 11,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 270,
      "materialsText": "Distilled Pale×1, Pale Dust×1"
    },
    "stats": {
      "hp": 98,
      "mp": 98
    },
    "consume": {
      "hp": 98,
      "mp": 98
    }
  },
  {
    "id": 383,
    "name": "Poison Potion",
    "description": "Poison Potion. Desiccated grain medicine for wounds of the dead city.",
    "icon": "/icons/items/poison-potion.png",
    "slug": "poison-potion",
    "kind": "consumable",
    "craftLevel": 12,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 290,
      "materialsText": "Poison Sac×1, Ash Dust×1"
    },
    "stats": {
      "hp": 80
    },
    "consume": {
      "hp": 80
    }
  },
  {
    "id": 384,
    "name": "AGI Elixir",
    "description": "AGI Elixir. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/agi-elixir.png",
    "slug": "agi-elixir",
    "kind": "consumable",
    "craftLevel": 14,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 330,
      "materialsText": "Distilled Pale×1, Pale Dust×1"
    },
    "stats": {
      "hp": 98,
      "mp": 98
    },
    "consume": {
      "hp": 98,
      "mp": 98
    }
  },
  {
    "id": 385,
    "name": "Multi-Status Base",
    "description": "Multi-Status Base — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/multi-status-base.png",
    "slug": "multi-status-base",
    "kind": "base",
    "craftLevel": 16,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 370,
      "materialsText": "Distilled Pale×1, Pale Dust×1"
    }
  },
  {
    "id": 386,
    "name": "Ether",
    "description": "Ether. Distilled ash tonic that restores magic.",
    "icon": "/icons/items/ether.png",
    "slug": "ether",
    "kind": "consumable",
    "craftLevel": 20,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 450,
      "materialsText": "Distilled Ash×1, Ink Salt×1, Ash Dust×1"
    },
    "stats": {
      "mp": 80
    },
    "consume": {
      "mp": 80
    }
  },
  {
    "id": 387,
    "name": "Echo Drops",
    "description": "Echo Drops. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/echo-drops.png",
    "slug": "echo-drops",
    "kind": "consumable",
    "craftLevel": 20,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 450,
      "materialsText": "Echo Extract×1, Ash Dust×1"
    },
    "stats": {
      "hp": 35
    },
    "consume": {
      "hp": 35
    }
  },
  {
    "id": 388,
    "name": "Eye Drops",
    "description": "Eye Drops. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/eye-drops.png",
    "slug": "eye-drops",
    "kind": "consumable",
    "craftLevel": 22,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 490,
      "materialsText": "Distilled Ash×1, Lapis×1, Ash Dust×1"
    },
    "stats": {
      "hp": 35
    },
    "consume": {
      "hp": 35
    }
  },
  {
    "id": 389,
    "name": "Binding Agent",
    "description": "Binding Agent. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/binding-agent.png",
    "slug": "binding-agent",
    "kind": "consumable",
    "craftLevel": 24,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 530,
      "materialsText": "Distilled Ash×1, Ash Dust×1"
    },
    "stats": {
      "hp": 35
    },
    "consume": {
      "hp": 35
    }
  },
  {
    "id": 390,
    "name": "Focus Tincture",
    "description": "Focus Tincture. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/focus-tincture.png",
    "slug": "focus-tincture",
    "kind": "consumable",
    "craftLevel": 26,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 570,
      "materialsText": "Distilled Ash×1, Ash Dust×1"
    },
    "stats": {
      "hp": 38
    },
    "consume": {
      "hp": 38
    }
  },
  {
    "id": 391,
    "name": "Scroll: Cure",
    "description": "Scroll: Cure. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/scroll-cure.png",
    "slug": "scroll-cure",
    "kind": "consumable",
    "craftLevel": 28,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 610,
      "materialsText": "Spell Parchment×1, Pale Dust×1, Glass Bead×1"
    },
    "stats": {
      "hp": 38
    },
    "consume": {
      "hp": 38
    }
  },
  {
    "id": 392,
    "name": "DEX Elixir",
    "description": "DEX Elixir. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/dex-elixir.png",
    "slug": "dex-elixir",
    "kind": "consumable",
    "craftLevel": 30,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 650,
      "materialsText": "Distilled Ash×1, Ash Dust×1"
    },
    "stats": {
      "hp": 122,
      "mp": 122
    },
    "consume": {
      "hp": 122,
      "mp": 122
    }
  },
  {
    "id": 393,
    "name": "INT Elixir",
    "description": "INT Elixir. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/int-elixir.png",
    "slug": "int-elixir",
    "kind": "consumable",
    "craftLevel": 32,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 690,
      "materialsText": "Distilled Ash×1, Ash Dust×1"
    },
    "stats": {
      "hp": 122,
      "mp": 122
    },
    "consume": {
      "hp": 122,
      "mp": 122
    }
  },
  {
    "id": 394,
    "name": "Silent Oil",
    "description": "Silent Oil. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/silent-oil.png",
    "slug": "silent-oil",
    "kind": "consumable",
    "craftLevel": 35,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 750,
      "materialsText": "Slime Oil×1, Dead Fiber×1, Slag Dust×1"
    },
    "stats": {
      "hp": 44
    },
    "consume": {
      "hp": 44
    }
  },
  {
    "id": 396,
    "name": "Prism Powder",
    "description": "Prism Powder. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/prism-powder.png",
    "slug": "prism-powder",
    "kind": "consumable",
    "craftLevel": 38,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 810,
      "materialsText": "Distilled Ash×1, Glass Bead×1, Insect Wing×1, Slag Dust×1"
    },
    "stats": {
      "hp": 44
    },
    "consume": {
      "hp": 44
    }
  },
  {
    "id": 397,
    "name": "Enhancing Elixir",
    "description": "Enhancing Elixir. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/enhancing-elixir.png",
    "slug": "enhancing-elixir",
    "kind": "consumable",
    "craftLevel": 40,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 850,
      "materialsText": "Bitter Spice×1, Distilled Ash×1, Slag Dust×1"
    },
    "stats": {
      "hp": 47
    },
    "consume": {
      "hp": 47
    }
  },
  {
    "id": 398,
    "name": "Acid Bolt Compound",
    "description": "Acid Bolt Compound — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/acid-bolt-compound.png",
    "slug": "acid-bolt-compound",
    "kind": "intermediate",
    "craftLevel": 42,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 890,
      "materialsText": "Slime Oil×1, Iron Sand×1, Slag Dust×1"
    }
  },
  {
    "id": 399,
    "name": "Hi-Potion",
    "description": "Hi-Potion. Desiccated grain medicine for wounds of the dead city.",
    "icon": "/icons/items/hi-potion.png",
    "slug": "hi-potion",
    "kind": "consumable",
    "craftLevel": 45,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 950,
      "materialsText": "Echo Extract×1, Slime Oil×1, Slag Dust×1"
    },
    "stats": {
      "hp": 150
    },
    "consume": {
      "hp": 150
    }
  },
  {
    "id": 400,
    "name": "Scroll: Slow",
    "description": "Scroll: Slow. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/scroll-slow.png",
    "slug": "scroll-slow",
    "kind": "consumable",
    "craftLevel": 50,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 1050,
      "materialsText": "Spell Parchment×1, Slag Dust×1, Onyx×1"
    },
    "stats": {
      "hp": 53
    },
    "consume": {
      "hp": 53
    }
  },
  {
    "id": 401,
    "name": "Scroll: Fire",
    "description": "Scroll: Fire. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/scroll-fire.png",
    "slug": "scroll-fire",
    "kind": "consumable",
    "craftLevel": 55,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 1150,
      "materialsText": "Spell Parchment×1, Slag Dust×1, Sulfur Bit×1"
    },
    "stats": {
      "hp": 56
    },
    "consume": {
      "hp": 56
    }
  },
  {
    "id": 403,
    "name": "Scroll: Quicken",
    "description": "Scroll: Quicken. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/scroll-quicken.png",
    "slug": "scroll-quicken",
    "kind": "consumable",
    "craftLevel": 60,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 1250,
      "materialsText": "Spell Parchment×1, Bell Dust×1, Lapis×1"
    },
    "stats": {
      "hp": 59
    },
    "consume": {
      "hp": 59
    }
  },
  {
    "id": 405,
    "name": "Hi-Ether",
    "description": "Hi-Ether. Distilled ash tonic that restores magic.",
    "icon": "/icons/items/hi-ether.png",
    "slug": "hi-ether",
    "kind": "consumable",
    "craftLevel": 65,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 1350,
      "materialsText": "Echo Extract×1, Silk Thread×1, Bell Dust×1"
    },
    "stats": {
      "mp": 152
    },
    "consume": {
      "mp": 152
    }
  },
  {
    "id": 406,
    "name": "Remedy",
    "description": "Remedy. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/remedy.png",
    "slug": "remedy",
    "kind": "consumable",
    "craftLevel": 70,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 1450,
      "materialsText": "Antidote Root×1, Echo Extract×1, Bell Dust×1"
    },
    "stats": {
      "hp": 200
    },
    "consume": {
      "hp": 200
    }
  },
  {
    "id": 407,
    "name": "Enfeebling Tincture",
    "description": "Enfeebling Tincture. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/enfeebling-tincture.png",
    "slug": "enfeebling-tincture",
    "kind": "consumable",
    "craftLevel": 75,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 1550,
      "materialsText": "Poison Sac×1, Onyx×1, Bell Dust×1"
    },
    "stats": {
      "hp": 68
    },
    "consume": {
      "hp": 68
    }
  },
  {
    "id": 408,
    "name": "Fire Cluster",
    "description": "Fire Cluster. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/fire-cluster.png",
    "slug": "fire-cluster",
    "kind": "consumable",
    "craftLevel": 78,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 1610,
      "materialsText": "Sulfur Bit×2, Bell Dust×1"
    },
    "stats": {
      "hp": 68
    },
    "consume": {
      "hp": 68
    }
  },
  {
    "id": 409,
    "name": "Water Cluster",
    "description": "Water Cluster. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/water-cluster.png",
    "slug": "water-cluster",
    "kind": "consumable",
    "craftLevel": 80,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 1650,
      "materialsText": "Echo Extract×1, Bell Dust×1"
    },
    "stats": {
      "hp": 71
    },
    "consume": {
      "hp": 71
    }
  },
  {
    "id": 410,
    "name": "Throne Focus Tincture",
    "description": "Throne Focus Tincture. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/throne-focus-tincture.png",
    "slug": "throne-focus-tincture",
    "kind": "consumable",
    "craftLevel": 86,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 1770,
      "materialsText": "Distilled Ash×1, Throne Dust×1"
    },
    "stats": {
      "hp": 74
    },
    "consume": {
      "hp": 74
    }
  },
  {
    "id": 412,
    "name": "X-Potion",
    "description": "X-Potion. Desiccated grain medicine for wounds of the dead city.",
    "icon": "/icons/items/x-potion.png",
    "slug": "x-potion",
    "kind": "consumable",
    "craftLevel": 90,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 1850,
      "materialsText": "Echo Extract×2, Bell Koi×1, Throne Dust×1"
    },
    "stats": {
      "hp": 240
    },
    "consume": {
      "hp": 240
    }
  },
  {
    "id": 413,
    "name": "Throne INT Elixir",
    "description": "Throne INT Elixir. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/throne-int-elixir.png",
    "slug": "throne-int-elixir",
    "kind": "consumable",
    "craftLevel": 92,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 1890,
      "materialsText": "Distilled Ash×1, Throne Dust×1"
    },
    "stats": {
      "hp": 194,
      "mp": 194
    },
    "consume": {
      "hp": 194,
      "mp": 194
    }
  },
  {
    "id": 414,
    "name": "Throne AGI Elixir",
    "description": "Throne AGI Elixir. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/throne-agi-elixir.png",
    "slug": "throne-agi-elixir",
    "kind": "consumable",
    "craftLevel": 94,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 1930,
      "materialsText": "Distilled Ash×1, Throne Dust×1"
    },
    "stats": {
      "hp": 194,
      "mp": 194
    },
    "consume": {
      "hp": 194,
      "mp": 194
    }
  },
  {
    "id": 417,
    "name": "Throne Panacea",
    "description": "Throne Panacea. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/throne-panacea.png",
    "slug": "throne-panacea",
    "kind": "consumable",
    "craftLevel": 100,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 2050,
      "materialsText": "Remedy×1, Diamond×1, Slag Binding Agent×2, Slag Cluster Shell×1, Throne Dust×2"
    },
    "stats": {
      "hp": 260
    },
    "consume": {
      "hp": 260
    }
  },
  {
    "id": 418,
    "name": "Dried Ration",
    "description": "Dried Ration. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/dried-ration.png",
    "slug": "dried-ration",
    "kind": "consumable",
    "craftLevel": 1,
    "craftSkill": "cooking",
    "recipe": {
      "gold": 70,
      "materialsText": "Dried Ration Scrap×2, Pale Dust×1"
    },
    "stats": {
      "vit": 2,
      "def": 1,
      "hp": 8
    },
    "consume": {
      "hp": 29,
      "foodDurationSec": 1800
    }
  },
  {
    "id": 419,
    "name": "Spice Rub",
    "description": "Spice Rub — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/spice-rub.png",
    "slug": "spice-rub",
    "kind": "base",
    "craftLevel": 3,
    "craftSkill": "cooking",
    "recipe": {
      "gold": 110,
      "materialsText": "Rock Salt×1, Dustgrain×1, Pale Dust×1"
    }
  },
  {
    "id": 420,
    "name": "Dustbread",
    "description": "Dustbread. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/dustbread.png",
    "slug": "dustbread",
    "kind": "consumable",
    "craftLevel": 5,
    "craftSkill": "cooking",
    "recipe": {
      "gold": 150,
      "materialsText": "Dustgrain×2, Rock Salt×1, Pale Dust×1"
    },
    "stats": {
      "vit": 2,
      "def": 1,
      "hp": 11
    },
    "consume": {
      "hp": 33,
      "foodDurationSec": 1800
    }
  },
  {
    "id": 421,
    "name": "Smoked Minnow",
    "description": "Smoked Minnow — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/smoked-minnow.png",
    "slug": "smoked-minnow",
    "kind": "base",
    "craftLevel": 7,
    "craftSkill": "cooking",
    "recipe": {
      "gold": 190,
      "materialsText": "Fossil Minnow×2, Dustgrain×1, Pale Dust×1"
    }
  },
  {
    "id": 422,
    "name": "Fossil Grill",
    "description": "Fossil Grill. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/fossil-grill.png",
    "slug": "fossil-grill",
    "kind": "consumable",
    "craftLevel": 8,
    "craftSkill": "cooking",
    "recipe": {
      "gold": 210,
      "materialsText": "Fossil Minnow×2, Rock Salt×1, Pale Dust×1"
    },
    "stats": {
      "str": 2,
      "atk": 1,
      "vit": 1
    },
    "consume": {
      "hp": 24,
      "foodDurationSec": 1800
    }
  },
  {
    "id": 423,
    "name": "Crab Cake",
    "description": "Crab Cake — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/crab-cake.png",
    "slug": "crab-cake",
    "kind": "base",
    "craftLevel": 10,
    "craftSkill": "cooking",
    "recipe": {
      "gold": 250,
      "materialsText": "Clay Crab×1, Dustgrain×2, Pale Dust×1"
    }
  },
  {
    "id": 424,
    "name": "Hearty Ration",
    "description": "Hearty Ration — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/hearty-ration.png",
    "slug": "hearty-ration",
    "kind": "base",
    "craftLevel": 12,
    "craftSkill": "cooking",
    "recipe": {
      "gold": 290,
      "materialsText": "Dustgrain×2, Rock Salt×1, Pale Dust×1"
    }
  },
  {
    "id": 425,
    "name": "Grain Porridge",
    "description": "Grain Porridge — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/grain-porridge.png",
    "slug": "grain-porridge",
    "kind": "base",
    "craftLevel": 14,
    "craftSkill": "cooking",
    "recipe": {
      "gold": 330,
      "materialsText": "Dustgrain×2, Pale Dust×1"
    }
  },
  {
    "id": 427,
    "name": "Marina Stew",
    "description": "Marina Stew — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/marina-stew.png",
    "slug": "marina-stew",
    "kind": "base",
    "craftLevel": 18,
    "craftSkill": "cooking",
    "recipe": {
      "gold": 410,
      "materialsText": "Fossil Minnow×1, Clay Crab×1, Dustgrain×1, Pale Dust×1"
    }
  },
  {
    "id": 428,
    "name": "Claycrab Stew",
    "description": "Claycrab Stew. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/claycrab-stew.png",
    "slug": "claycrab-stew",
    "kind": "consumable",
    "craftLevel": 20,
    "craftSkill": "cooking",
    "recipe": {
      "gold": 450,
      "materialsText": "Clay Crab×1, Dustgrain×1, Ash Dust×1"
    },
    "stats": {
      "vit": 4,
      "hp": 22,
      "mnd": 2,
      "def": 2
    },
    "consume": {
      "hp": 35,
      "foodDurationSec": 1800
    }
  },
  {
    "id": 431,
    "name": "Stone Scale Soup",
    "description": "Stone Scale Soup. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/stone-scale-soup.png",
    "slug": "stone-scale-soup",
    "kind": "consumable",
    "craftLevel": 25,
    "craftSkill": "cooking",
    "recipe": {
      "gold": 550,
      "materialsText": "Stone Scale×2, Bitter Spice×1, Ash Dust×1"
    },
    "stats": {
      "vit": 4,
      "hp": 25,
      "mnd": 2,
      "def": 3
    },
    "consume": {
      "hp": 38,
      "foodDurationSec": 1800
    }
  },
  {
    "id": 439,
    "name": "Carp Steak",
    "description": "Carp Steak. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/carp-steak.png",
    "slug": "carp-steak",
    "kind": "consumable",
    "craftLevel": 40,
    "craftSkill": "cooking",
    "recipe": {
      "gold": 850,
      "materialsText": "Echo Carp×1, Rock Salt×1, Slag Dust×1"
    },
    "stats": {
      "str": 6,
      "atk": 4,
      "vit": 3
    },
    "consume": {
      "foodDurationSec": 1800,
      "hp": 56
    }
  },
  {
    "id": 440,
    "name": "Hardtack",
    "description": "Hardtack — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/hardtack.png",
    "slug": "hardtack",
    "kind": "base",
    "craftLevel": 42,
    "craftSkill": "cooking",
    "recipe": {
      "gold": 890,
      "materialsText": "Dustgrain×2, Rock Salt×1, Slag Dust×1"
    }
  },
  {
    "id": 442,
    "name": "Mage Biscuits",
    "description": "Mage Biscuits. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/mage-biscuits.png",
    "slug": "mage-biscuits",
    "kind": "consumable",
    "craftLevel": 45,
    "craftSkill": "cooking",
    "recipe": {
      "gold": 950,
      "materialsText": "Dustgrain×1, Distilled Ash×1, Lapis×1, Slag Dust×1"
    },
    "stats": {
      "int": 6,
      "mnd": 6,
      "mp": 27,
      "mab": 4
    },
    "consume": {
      "hp": 65,
      "foodDurationSec": 1800
    }
  },
  {
    "id": 444,
    "name": "Rogue Jerky",
    "description": "Rogue Jerky. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/rogue-jerky.png",
    "slug": "rogue-jerky",
    "kind": "consumable",
    "craftLevel": 48,
    "craftSkill": "cooking",
    "recipe": {
      "gold": 1010,
      "materialsText": "Stone Scale×1, Bitter Spice×1, Slag Dust×1"
    },
    "stats": {
      "dex": 6,
      "agi": 6,
      "acc": 5,
      "eva": 5
    },
    "consume": {
      "hp": 50,
      "foodDurationSec": 1800
    }
  },
  {
    "id": 450,
    "name": "Eel Skewer",
    "description": "Eel Skewer. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/eel-skewer.png",
    "slug": "eel-skewer",
    "kind": "consumable",
    "craftLevel": 60,
    "craftSkill": "cooking",
    "recipe": {
      "gold": 1250,
      "materialsText": "Glass Eel×1, Bitter Spice×1, Slag Dust×1"
    },
    "stats": {
      "dex": 8,
      "acc": 6,
      "agi": 4
    },
    "consume": {
      "hp": 59,
      "foodDurationSec": 1800
    }
  },
  {
    "id": 453,
    "name": "Koi Sashimi",
    "description": "Koi Sashimi. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/koi-sashimi.png",
    "slug": "koi-sashimi",
    "kind": "consumable",
    "craftLevel": 65,
    "craftSkill": "cooking",
    "recipe": {
      "gold": 1350,
      "materialsText": "Bell Koi×2, Bell Dust×1"
    },
    "stats": {
      "dex": 8,
      "acc": 6,
      "agi": 5
    },
    "consume": {
      "hp": 62,
      "foodDurationSec": 1800
    }
  },
  {
    "id": 456,
    "name": "Glass Eel Noodles",
    "description": "Glass Eel Noodles. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/glass-eel-noodles.png",
    "slug": "glass-eel-noodles",
    "kind": "consumable",
    "craftLevel": 70,
    "craftSkill": "cooking",
    "recipe": {
      "gold": 1450,
      "materialsText": "Glass Eel×1, Dustgrain×1, Bell Dust×1"
    },
    "stats": {
      "dex": 9,
      "vit": 5,
      "hp": 57,
      "acc": 6
    },
    "consume": {
      "hp": 65,
      "foodDurationSec": 1800
    }
  },
  {
    "id": 466,
    "name": "Throne Feast",
    "description": "Throne Feast. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/throne-feast.png",
    "slug": "throne-feast",
    "kind": "consumable",
    "craftLevel": 90,
    "craftSkill": "cooking",
    "recipe": {
      "gold": 1850,
      "materialsText": "Bell Koi×1, Echo Carp×1, Dustgrain×1, Throne Dust×1"
    },
    "stats": {
      "str": 6,
      "dex": 6,
      "vit": 6,
      "agi": 6,
      "int": 6,
      "mnd": 6,
      "hp": 70,
      "mp": 50,
      "atk": 4,
      "def": 4,
      "mab": 4
    },
    "consume": {
      "hp": 106,
      "mp": 106,
      "foodDurationSec": 1800
    }
  },
  {
    "id": 471,
    "name": "Coronation Banquet",
    "description": "Coronation Banquet. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/coronation-banquet.png",
    "slug": "coronation-banquet",
    "kind": "consumable",
    "craftLevel": 100,
    "craftSkill": "cooking",
    "recipe": {
      "gold": 2050,
      "materialsText": "Throne Feast×1, Diamond×1, Throne Dust×2"
    },
    "stats": {
      "str": 7,
      "dex": 7,
      "vit": 7,
      "agi": 7,
      "int": 7,
      "mnd": 7,
      "hp": 78,
      "mp": 55,
      "atk": 4,
      "def": 4,
      "mab": 4
    },
    "consume": {
      "hp": 114,
      "mp": 114,
      "foodDurationSec": 1800
    }
  },
  {
    "id": 472,
    "name": "Pale Bait×6",
    "description": "Pale Bait×6 for dry troughs and mooring pools. Attracts fossil fish.",
    "icon": "/icons/items/pale-bait.png",
    "slug": "pale-bait",
    "kind": "bait",
    "craftLevel": 2,
    "craftSkill": "cooking",
    "recipe": {
      "gold": 90,
      "materialsText": "Dustgrain×1, Pale Dust×1"
    },
    "consume": {
      "foodDurationSec": 0
    },
    "craftOutputQty": 6
  },
  {
    "id": 473,
    "name": "Minnow Bait×6",
    "description": "Minnow Bait×6 for dry troughs and mooring pools. Attracts fossil fish.",
    "icon": "/icons/items/minnow-bait.png",
    "slug": "minnow-bait",
    "kind": "bait",
    "craftLevel": 8,
    "craftSkill": "cooking",
    "recipe": {
      "gold": 210,
      "materialsText": "Fossil Minnow×1, Pale Dust×1"
    },
    "consume": {
      "foodDurationSec": 0
    },
    "craftOutputQty": 6
  },
  {
    "id": 474,
    "name": "Scale Bait×6",
    "description": "Scale Bait×6 for dry troughs and mooring pools. Attracts fossil fish.",
    "icon": "/icons/items/scale-bait.png",
    "slug": "scale-bait",
    "kind": "bait",
    "craftLevel": 14,
    "craftSkill": "cooking",
    "recipe": {
      "gold": 330,
      "materialsText": "Stone Scale×1, Pale Dust×1"
    },
    "consume": {
      "foodDurationSec": 0
    },
    "craftOutputQty": 6
  },
  {
    "id": 475,
    "name": "Ash Bait×6",
    "description": "Ash Bait×6 for dry troughs and mooring pools. Attracts fossil fish.",
    "icon": "/icons/items/ash-bait.png",
    "slug": "ash-bait",
    "kind": "bait",
    "craftLevel": 22,
    "craftSkill": "cooking",
    "recipe": {
      "gold": 490,
      "materialsText": "Dustgrain×1, Ash Dust×1"
    },
    "consume": {
      "foodDurationSec": 0
    },
    "craftOutputQty": 6
  },
  {
    "id": 476,
    "name": "Crab Bait×6",
    "description": "Crab Bait×6 for dry troughs and mooring pools. Attracts fossil fish.",
    "icon": "/icons/items/crab-bait.png",
    "slug": "crab-bait",
    "kind": "bait",
    "craftLevel": 28,
    "craftSkill": "cooking",
    "recipe": {
      "gold": 610,
      "materialsText": "Clay Crab×1, Ash Dust×1"
    },
    "consume": {
      "foodDurationSec": 0
    },
    "craftOutputQty": 6
  },
  {
    "id": 477,
    "name": "Rich Ash Bait×6",
    "description": "Rich Ash Bait×6 for dry troughs and mooring pools. Attracts fossil fish.",
    "icon": "/icons/items/rich-ash-bait.png",
    "slug": "rich-ash-bait",
    "kind": "bait",
    "craftLevel": 36,
    "craftSkill": "cooking",
    "recipe": {
      "gold": 770,
      "materialsText": "Dustgrain×1, Echo Extract×1, Ash Dust×1"
    },
    "consume": {
      "foodDurationSec": 0
    },
    "craftOutputQty": 6
  },
  {
    "id": 478,
    "name": "Slag Bait×6",
    "description": "Slag Bait×6 for dry troughs and mooring pools. Attracts fossil fish.",
    "icon": "/icons/items/slag-bait.png",
    "slug": "slag-bait",
    "kind": "bait",
    "craftLevel": 44,
    "craftSkill": "cooking",
    "recipe": {
      "gold": 930,
      "materialsText": "Dustgrain×1, Slag Dust×1"
    },
    "consume": {
      "foodDurationSec": 0
    },
    "craftOutputQty": 6
  },
  {
    "id": 479,
    "name": "Carp Bait×6",
    "description": "Carp Bait×6 for dry troughs and mooring pools. Attracts fossil fish.",
    "icon": "/icons/items/carp-bait.png",
    "slug": "carp-bait",
    "kind": "bait",
    "craftLevel": 52,
    "craftSkill": "cooking",
    "recipe": {
      "gold": 1090,
      "materialsText": "Echo Carp×1, Slag Dust×1"
    },
    "consume": {
      "foodDurationSec": 0
    },
    "craftOutputQty": 6
  },
  {
    "id": 480,
    "name": "Fine Slag Bait×6",
    "description": "Fine Slag Bait×6 for dry troughs and mooring pools. Attracts fossil fish.",
    "icon": "/icons/items/fine-slag-bait.png",
    "slug": "fine-slag-bait",
    "kind": "bait",
    "craftLevel": 60,
    "craftSkill": "cooking",
    "recipe": {
      "gold": 1250,
      "materialsText": "Dustgrain×1, Bitter Spice×1, Slag Dust×1"
    },
    "consume": {
      "foodDurationSec": 0
    },
    "craftOutputQty": 6
  },
  {
    "id": 481,
    "name": "Bell Bait×6",
    "description": "Bell Bait×6 for dry troughs and mooring pools. Attracts fossil fish.",
    "icon": "/icons/items/bell-bait.png",
    "slug": "bell-bait",
    "kind": "bait",
    "craftLevel": 68,
    "craftSkill": "cooking",
    "recipe": {
      "gold": 1410,
      "materialsText": "Dustgrain×1, Bell Dust×1"
    },
    "consume": {
      "foodDurationSec": 0
    },
    "craftOutputQty": 6
  },
  {
    "id": 482,
    "name": "Koi Bait×6",
    "description": "Koi Bait×6 for dry troughs and mooring pools. Attracts fossil fish.",
    "icon": "/icons/items/koi-bait.png",
    "slug": "koi-bait",
    "kind": "bait",
    "craftLevel": 76,
    "craftSkill": "cooking",
    "recipe": {
      "gold": 1570,
      "materialsText": "Bell Koi×1, Bell Dust×1"
    },
    "consume": {
      "foodDurationSec": 0
    },
    "craftOutputQty": 6
  },
  {
    "id": 483,
    "name": "Throne Bait×6",
    "description": "Throne Bait×6 for dry troughs and mooring pools. Attracts fossil fish.",
    "icon": "/icons/items/throne-bait.png",
    "slug": "throne-bait",
    "kind": "bait",
    "craftLevel": 84,
    "craftSkill": "cooking",
    "recipe": {
      "gold": 1730,
      "materialsText": "Dustgrain×1, Throne Dust×1"
    },
    "consume": {
      "foodDurationSec": 0
    },
    "craftOutputQty": 6
  },
  {
    "id": 484,
    "name": "Royal Bait×6",
    "description": "Royal Bait×6 for dry troughs and mooring pools. Attracts fossil fish.",
    "icon": "/icons/items/royal-bait.png",
    "slug": "royal-bait",
    "kind": "bait",
    "craftLevel": 92,
    "craftSkill": "cooking",
    "recipe": {
      "gold": 1890,
      "materialsText": "Dustgrain×1, Echo Extract×1, Throne Dust×1"
    },
    "consume": {
      "foodDurationSec": 0
    },
    "craftOutputQty": 6
  },
  {
    "id": 485,
    "name": "Coronation Bait×6",
    "description": "Coronation Bait×6 for dry troughs and mooring pools. Attracts fossil fish.",
    "icon": "/icons/items/coronation-bait.png",
    "slug": "coronation-bait",
    "kind": "bait",
    "craftLevel": 100,
    "craftSkill": "cooking",
    "recipe": {
      "gold": 2050,
      "materialsText": "Dustgrain×1, Diamond×1, Throne Dust×1"
    },
    "consume": {
      "foodDurationSec": 0
    },
    "craftOutputQty": 6
  },
  {
    "id": 486,
    "name": "Pale Flax",
    "description": "Pale Flax. Harvest — Pale Hollow scrubland (flax stands / fiber thickets).",
    "icon": "/icons/items/pale-flax.png",
    "slug": "pale-flax",
    "kind": "base",
    "obtainedFrom": "Harvest — Pale Hollow scrubland (flax stands / fiber thickets)"
  },
  {
    "id": 487,
    "name": "River Sand",
    "description": "River Sand. Harvest — Pale Hollow riverbank clay banks.",
    "icon": "/icons/items/river-sand.png",
    "slug": "river-sand",
    "kind": "base",
    "obtainedFrom": "Harvest — Pale Hollow riverbank clay banks"
  },
  {
    "id": 488,
    "name": "Velvet Fiber",
    "description": "Velvet Fiber. Drop — Bellmarsh scale/velvet foes.",
    "icon": "/icons/items/velvet-fiber.png",
    "slug": "velvet-fiber",
    "kind": "base",
    "obtainedFrom": "Drop — Bellmarsh scale/velvet foes"
  },
  {
    "id": 489,
    "name": "Distilled Pale",
    "description": "Distilled Pale — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/distilled-pale.png",
    "slug": "distilled-pale",
    "kind": "intermediate",
    "craftLevel": 1,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 70,
      "materialsText": "Pale Dust×2, Antidote Root×1"
    }
  },
  {
    "id": 1000,
    "name": "Copper Ore",
    "description": "Copper Ore. Mine — Pale Hollow ore vein.",
    "icon": "/icons/items/copper-ore.png",
    "slug": "copper-ore",
    "kind": "base",
    "obtainedFrom": "Mine / Drop — Pale Hollow"
  },
  {
    "id": 1001,
    "name": "Tin Ore",
    "description": "Tin Ore. Mine — Pale Hollow ore vein.",
    "icon": "/icons/items/tin-ore.png",
    "slug": "tin-ore",
    "kind": "base",
    "obtainedFrom": "Mine / Drop — Pale Hollow"
  },
  {
    "id": 1002,
    "name": "Iron Ore",
    "description": "Iron Ore. Mine — Ashlands ore vein.",
    "icon": "/icons/items/iron-ore.png",
    "slug": "iron-ore",
    "kind": "base",
    "obtainedFrom": "Mine — Ashlands ore vein"
  },
  {
    "id": 1003,
    "name": "Mythril Ore",
    "description": "Mythril Ore. Mine — Slagpits ore vein.",
    "icon": "/icons/items/mythril-ore.png",
    "slug": "mythril-ore",
    "kind": "base",
    "obtainedFrom": "Mine — Slagpits ore vein"
  },
  {
    "id": 1004,
    "name": "Darksteel Ore",
    "description": "Darksteel Ore. Mine — Bellmarsh ore vein.",
    "icon": "/icons/items/darksteel-ore.png",
    "slug": "darksteel-ore",
    "kind": "base",
    "obtainedFrom": "Mine — Bellmarsh ore vein"
  },
  {
    "id": 1005,
    "name": "Orichalcum Ore",
    "description": "Orichalcum Ore. Mine — Throne Approach ore vein.",
    "icon": "/icons/items/orichalcum-ore.png",
    "slug": "orichalcum-ore",
    "kind": "base",
    "obtainedFrom": "Mine — Throne Approach ore vein"
  },
  {
    "id": 1006,
    "name": "Iron Sand",
    "description": "Iron Sand. Harvest — Ashlands riverbed.",
    "icon": "/icons/items/iron-sand.png",
    "slug": "iron-sand",
    "kind": "base",
    "obtainedFrom": "Harvest — Ashlands riverbed"
  },
  {
    "id": 1007,
    "name": "Metal Scrap",
    "description": "Metal Scrap. Drop — construct/golem enemies, any zone.",
    "icon": "/icons/items/metal-scrap.png",
    "slug": "metal-scrap",
    "kind": "base",
    "obtainedFrom": "Drop — construct/golem enemies, any zone"
  },
  {
    "id": 1008,
    "name": "Cobble",
    "description": "Cobble. Harvest — Pale Hollow quarry.",
    "icon": "/icons/items/cobble.png",
    "slug": "cobble",
    "kind": "base",
    "obtainedFrom": "Harvest — Pale Hollow quarry"
  },
  {
    "id": 1009,
    "name": "Cracked Brick",
    "description": "Cracked Brick. Drop — ruin-dweller enemies, Pale Hollow.",
    "icon": "/icons/items/cracked-brick.png",
    "slug": "cracked-brick",
    "kind": "base",
    "obtainedFrom": "Drop — Ruin Dweller"
  },
  {
    "id": 1010,
    "name": "Limestone",
    "description": "Limestone. Mine — Pale Hollow quarry.",
    "icon": "/icons/items/limestone.png",
    "slug": "limestone",
    "kind": "base",
    "obtainedFrom": "Mine — Pale Hollow quarry"
  },
  {
    "id": 1011,
    "name": "Marble Chip",
    "description": "Marble Chip. Harvest — Throne Approach palace ruins.",
    "icon": "/icons/items/marble-chip.png",
    "slug": "marble-chip",
    "kind": "base",
    "obtainedFrom": "Harvest — Throne Approach palace ruins"
  },
  {
    "id": 1012,
    "name": "Column Fragment",
    "description": "Column Fragment. Drop — Throne Approach guardian enemies.",
    "icon": "/icons/items/column-fragment.png",
    "slug": "column-fragment",
    "kind": "base",
    "obtainedFrom": "Drop — Throne Approach guardian enemies"
  },
  {
    "id": 1013,
    "name": "Tile Shard",
    "description": "Tile Shard. Harvest — Throne Approach palace ruins.",
    "icon": "/icons/items/tile-shard.png",
    "slug": "tile-shard",
    "kind": "base",
    "obtainedFrom": "Harvest — Throne Approach palace ruins"
  },
  {
    "id": 1014,
    "name": "Potter's Clay",
    "description": "Potter's Clay. Harvest — Pale Hollow riverbank.",
    "icon": "/icons/items/potters-clay.png",
    "slug": "potters-clay",
    "kind": "base",
    "obtainedFrom": "Harvest — Pale Hollow riverbank"
  },
  {
    "id": 1015,
    "name": "Petrified Lumber",
    "description": "Petrified Lumber. Harvest — Ashlands deadwood grove.",
    "icon": "/icons/items/petrified-lumber.png",
    "slug": "petrified-lumber",
    "kind": "base",
    "obtainedFrom": "Harvest — Ashlands deadwood grove"
  },
  {
    "id": 1016,
    "name": "Ancient Branch",
    "description": "Ancient Branch. Harvest — Ashlands deadwood grove.",
    "icon": "/icons/items/ancient-branch.png",
    "slug": "ancient-branch",
    "kind": "base",
    "obtainedFrom": "Harvest — Ashlands deadwood grove"
  },
  {
    "id": 1017,
    "name": "Bark Strip",
    "description": "Bark Strip. Harvest — any forest zone.",
    "icon": "/icons/items/bark-strip.png",
    "slug": "bark-strip",
    "kind": "base",
    "obtainedFrom": "Gather — Pale Hollow Ashbeam Logs"
  },
  {
    "id": 1018,
    "name": "Ashbeam Log",
    "description": "Ashbeam Log. Harvest — Pale Hollow forest.",
    "icon": "/icons/items/ashbeam-log.png",
    "slug": "ashbeam-log",
    "kind": "base",
    "obtainedFrom": "Harvest — Pale Hollow forest"
  },
  {
    "id": 1019,
    "name": "Bloodbeam Log",
    "description": "Bloodbeam Log. Harvest — Slagpits forest.",
    "icon": "/icons/items/bloodbeam-log.png",
    "slug": "bloodbeam-log",
    "kind": "base",
    "obtainedFrom": "Harvest — Slagpits forest"
  },
  {
    "id": 1020,
    "name": "Bellwood Log",
    "description": "Bellwood Log. Harvest — Bellmarsh forest.",
    "icon": "/icons/items/bellwood-log.png",
    "slug": "bellwood-log",
    "kind": "base",
    "obtainedFrom": "Harvest — Bellmarsh forest"
  },
  {
    "id": 1021,
    "name": "Dead Fiber",
    "description": "Dead Fiber. Harvest — Pale Hollow scrubland.",
    "icon": "/icons/items/dead-fiber.png",
    "slug": "dead-fiber",
    "kind": "base",
    "obtainedFrom": "Harvest — Pale Hollow scrubland"
  },
  {
    "id": 1022,
    "name": "Climbing Cord",
    "description": "Climbing Cord. Harvest — Pale Hollow cliff vines.",
    "icon": "/icons/items/climbing-cord.png",
    "slug": "climbing-cord",
    "kind": "base",
    "obtainedFrom": "Harvest — Pale Hollow cliff vines"
  },
  {
    "id": 1023,
    "name": "Shade Cotton",
    "description": "Shade Cotton. Harvest — Ashlands scrubland.",
    "icon": "/icons/items/shade-cotton.png",
    "slug": "shade-cotton",
    "kind": "base",
    "obtainedFrom": "Harvest — Ashlands scrubland"
  },
  {
    "id": 1024,
    "name": "Linen Scrap",
    "description": "Linen Scrap. Drop — bandit/scavenger enemies, Pale Hollow.",
    "icon": "/icons/items/linen-scrap.png",
    "slug": "linen-scrap",
    "kind": "base",
    "obtainedFrom": "Drop — bandit/scavenger enemies, Pale Hollow"
  },
  {
    "id": 1025,
    "name": "Silk Thread",
    "description": "Silk Thread. Drop — spider/insect enemies, Slagpits.",
    "icon": "/icons/items/silk-thread.png",
    "slug": "silk-thread",
    "kind": "base",
    "obtainedFrom": "Drop — spider/insect enemies, Slagpits"
  },
  {
    "id": 1026,
    "name": "Velvet Dust",
    "description": "Velvet Dust. Drop — Bellmarsh enemies.",
    "icon": "/icons/items/velvet-dust.png",
    "slug": "velvet-dust",
    "kind": "base",
    "obtainedFrom": "Drop — Bellmarsh enemies"
  },
  {
    "id": 1027,
    "name": "Parchment",
    "description": "Parchment. Drop — scholar/cultist enemies, Ashlands.",
    "icon": "/icons/items/parchment.png",
    "slug": "parchment",
    "kind": "base",
    "obtainedFrom": "Drop — scholar/cultist enemies, Ashlands"
  },
  {
    "id": 1028,
    "name": "Desiccated Hide",
    "description": "Desiccated Hide. Drop — Pale Hollow beasts.",
    "icon": "/icons/items/desiccated-hide.png",
    "slug": "desiccated-hide",
    "kind": "base",
    "obtainedFrom": "Drop — Pale Hollow beasts"
  },
  {
    "id": 1029,
    "name": "Soft Pelt",
    "description": "Soft Pelt. Drop — Pale Hollow/Ashlands small beasts.",
    "icon": "/icons/items/soft-pelt.png",
    "slug": "soft-pelt",
    "kind": "base",
    "obtainedFrom": "Drop — Pale Hollow/Ashlands small beasts"
  },
  {
    "id": 1030,
    "name": "Scale Hide",
    "description": "Scale Hide. Drop — Bellmarsh reptilian enemies.",
    "icon": "/icons/items/scale-hide.png",
    "slug": "scale-hide",
    "kind": "base",
    "obtainedFrom": "Drop — Bellmarsh reptilian enemies"
  },
  {
    "id": 1031,
    "name": "Bone Chip",
    "description": "Bone Chip. Drop — Pale Hollow undead.",
    "icon": "/icons/items/bone-chip.png",
    "slug": "bone-chip",
    "kind": "base",
    "obtainedFrom": "Drop — Pale Hollow undead"
  },
  {
    "id": 1032,
    "name": "Giant Femur",
    "description": "Giant Femur. Drop — Ashlands large undead/beasts.",
    "icon": "/icons/items/giant-femur.png",
    "slug": "giant-femur",
    "kind": "base",
    "obtainedFrom": "Drop — Ashlands large undead/beasts"
  },
  {
    "id": 1033,
    "name": "Skull Plate",
    "description": "Skull Plate. Drop — Ashlands/Slagpits undead elites.",
    "icon": "/icons/items/skull-plate.png",
    "slug": "skull-plate",
    "kind": "base",
    "obtainedFrom": "Drop — Ashlands/Slagpits undead elites"
  },
  {
    "id": 1034,
    "name": "Horn",
    "description": "Horn. Drop — beast enemies, any zone.",
    "icon": "/icons/items/horn.png",
    "slug": "horn",
    "kind": "base",
    "obtainedFrom": "Drop — Pale Hollow beasts"
  },
  {
    "id": 1035,
    "name": "Bat Wing",
    "description": "Bat Wing. Drop — Bellmarsh cave bats.",
    "icon": "/icons/items/bat-wing.png",
    "slug": "bat-wing",
    "kind": "base",
    "obtainedFrom": "Drop — Bellmarsh cave bats"
  },
  {
    "id": 1036,
    "name": "Insect Wing",
    "description": "Insect Wing. Drop — Slagpits insects.",
    "icon": "/icons/items/insect-wing.png",
    "slug": "insect-wing",
    "kind": "base",
    "obtainedFrom": "Drop — Slagpits insects"
  },
  {
    "id": 1037,
    "name": "Lapis",
    "description": "Lapis. Mine — Ashlands gem vein.",
    "icon": "/icons/items/lapis.png",
    "slug": "lapis",
    "kind": "base",
    "obtainedFrom": "Mine — Ashlands gem vein"
  },
  {
    "id": 1038,
    "name": "Onyx",
    "description": "Onyx. Mine — Slagpits gem vein.",
    "icon": "/icons/items/onyx.png",
    "slug": "onyx",
    "kind": "base",
    "obtainedFrom": "Mine — Slagpits gem vein"
  },
  {
    "id": 1039,
    "name": "Jadeite",
    "description": "Jadeite. Mine — Bellmarsh gem vein.",
    "icon": "/icons/items/jadeite.png",
    "slug": "jadeite",
    "kind": "base",
    "obtainedFrom": "Mine — Bellmarsh gem vein"
  },
  {
    "id": 1040,
    "name": "Diamond",
    "description": "Diamond. Mine — Throne Approach gem vein.",
    "icon": "/icons/items/diamond.png",
    "slug": "diamond",
    "kind": "base",
    "obtainedFrom": "Mine — Throne Approach gem vein"
  },
  {
    "id": 1041,
    "name": "Slime Oil",
    "description": "Slime Oil. Drop — slime enemies, Pale Hollow/Slagpits.",
    "icon": "/icons/items/slime-oil.png",
    "slug": "slime-oil",
    "kind": "base",
    "obtainedFrom": "Drop — slime enemies, Pale Hollow/Slagpits"
  },
  {
    "id": 1042,
    "name": "Ink Salt",
    "description": "Ink Salt. Harvest — Ashlands salt flat.",
    "icon": "/icons/items/ink-salt.png",
    "slug": "ink-salt",
    "kind": "base",
    "obtainedFrom": "Harvest — Ashlands salt flat"
  },
  {
    "id": 1043,
    "name": "Sulfur Bit",
    "description": "Sulfur Bit. Mine — Slagpits.",
    "icon": "/icons/items/sulfur-bit.png",
    "slug": "sulfur-bit",
    "kind": "base",
    "obtainedFrom": "Mine — Slagpits"
  },
  {
    "id": 1044,
    "name": "Poison Sac",
    "description": "Poison Sac. Drop — venomous creatures, any zone.",
    "icon": "/icons/items/poison-sac.png",
    "slug": "poison-sac",
    "kind": "base",
    "obtainedFrom": "Drop — venomous creatures, any zone"
  },
  {
    "id": 1045,
    "name": "Antidote Root",
    "description": "Antidote Root. Harvest — Pale Hollow herb patch.",
    "icon": "/icons/items/antidote-root.png",
    "slug": "antidote-root",
    "kind": "base",
    "obtainedFrom": "Harvest — Pale Hollow herb patch"
  },
  {
    "id": 1046,
    "name": "Echo Extract",
    "description": "Echo Extract. Drop — Bellmarsh spectral enemies.",
    "icon": "/icons/items/echo-extract.png",
    "slug": "echo-extract",
    "kind": "base",
    "obtainedFrom": "Drop — Bellmarsh spectral enemies"
  },
  {
    "id": 1047,
    "name": "Fossil Minnow",
    "description": "Fossil Minnow. Fish — Pale Hollow waters.",
    "icon": "/icons/items/fossil-minnow.png",
    "slug": "fossil-minnow",
    "kind": "base",
    "obtainedFrom": "Fish — Pale Hollow waters"
  },
  {
    "id": 1048,
    "name": "Stone Scale",
    "description": "Stone Scale. Fish — Ashlands waters.",
    "icon": "/icons/items/stone-scale.png",
    "slug": "stone-scale",
    "kind": "base",
    "obtainedFrom": "Fish — Ashlands waters"
  },
  {
    "id": 1049,
    "name": "Clay Crab",
    "description": "Clay Crab. Fish/Harvest — Pale Hollow riverbank.",
    "icon": "/icons/items/clay-crab.png",
    "slug": "clay-crab",
    "kind": "base",
    "obtainedFrom": "Fish/Harvest — Pale Hollow riverbank"
  },
  {
    "id": 1050,
    "name": "Echo Carp",
    "description": "Echo Carp. Fish — Bellmarsh waters.",
    "icon": "/icons/items/echo-carp.png",
    "slug": "echo-carp",
    "kind": "base",
    "obtainedFrom": "Fish — Bellmarsh waters"
  },
  {
    "id": 1051,
    "name": "Bell Koi",
    "description": "Bell Koi. Fish — Bellmarsh waters, from its richest fishing pools.",
    "icon": "/icons/items/bell-koi.png",
    "slug": "bell-koi",
    "kind": "base",
    "obtainedFrom": "Fish — Bellmarsh waters, richest fishing pools"
  },
  {
    "id": 1052,
    "name": "Glass Eel",
    "description": "Glass Eel. Fish — Bellmarsh waters.",
    "icon": "/icons/items/glass-eel.png",
    "slug": "glass-eel",
    "kind": "base",
    "obtainedFrom": "Fish — Bellmarsh waters"
  },
  {
    "id": 1053,
    "name": "Dustgrain",
    "description": "Dustgrain. Harvest — Pale Hollow farmland.",
    "icon": "/icons/items/dustgrain.png",
    "slug": "dustgrain",
    "kind": "base",
    "obtainedFrom": "Harvest — Pale Hollow farmland"
  },
  {
    "id": 1054,
    "name": "Dried Ration Scrap",
    "description": "Dried Ration Scrap. Drop — bandit camp enemies.",
    "icon": "/icons/items/dried-ration-scrap.png",
    "slug": "dried-ration-scrap",
    "kind": "base",
    "obtainedFrom": "Drop — bandit camp enemies"
  },
  {
    "id": 1055,
    "name": "Rock Salt",
    "description": "Rock Salt. Mine — Ashlands.",
    "icon": "/icons/items/rock-salt.png",
    "slug": "rock-salt",
    "kind": "base",
    "obtainedFrom": "Mine — Pale Hollow limestone"
  },
  {
    "id": 1056,
    "name": "Bitter Spice",
    "description": "Bitter Spice. Harvest — Slagpits scrubland.",
    "icon": "/icons/items/bitter-spice.png",
    "slug": "bitter-spice",
    "kind": "base",
    "obtainedFrom": "Harvest — Slagpits scrubland"
  },
  {
    "id": 1057,
    "name": "Pale Dust",
    "description": "Pale Dust. Harvest/Drop — Pale Hollow, zone-wide.",
    "icon": "/icons/items/pale-dust.png",
    "slug": "pale-dust",
    "kind": "base",
    "obtainedFrom": "Harvest/Drop — Pale Hollow, zone-wide"
  },
  {
    "id": 1058,
    "name": "Ash Dust",
    "description": "Ash Dust. Harvest/Drop — Ashlands, zone-wide.",
    "icon": "/icons/items/ash-dust.png",
    "slug": "ash-dust",
    "kind": "base",
    "obtainedFrom": "Harvest/Drop — Ashlands, zone-wide"
  },
  {
    "id": 1059,
    "name": "Slag Dust",
    "description": "Slag Dust. Harvest/Drop — Slagpits, zone-wide.",
    "icon": "/icons/items/slag-dust.png",
    "slug": "slag-dust",
    "kind": "base",
    "obtainedFrom": "Harvest/Drop — Slagpits, zone-wide"
  },
  {
    "id": 1060,
    "name": "Bell Dust",
    "description": "Bell Dust. Harvest/Drop — Bellmarsh, zone-wide.",
    "icon": "/icons/items/bell-dust.png",
    "slug": "bell-dust",
    "kind": "base",
    "obtainedFrom": "Harvest/Drop — Bellmarsh, zone-wide"
  },
  {
    "id": 1061,
    "name": "Throne Dust",
    "description": "Throne Dust. Harvest/Drop — Throne Approach, zone-wide.",
    "icon": "/icons/items/throne-dust.png",
    "slug": "throne-dust",
    "kind": "base",
    "obtainedFrom": "Harvest/Drop — Throne Approach, zone-wide"
  },
  {
    "id": 1062,
    "name": "Chainmail",
    "description": "Chainmail. Drop — Ruin Dweller (1%), Pale Hollow.",
    "icon": "/icons/items/chainmail.png",
    "slug": "chainmail",
    "kind": "equipment",
    "craftLevel": 10,
    "craftSkill": "smithing",
    "stats": {
      "def": 10,
      "str": 2,
      "dex": 2,
      "hp": 15
    },
    "slot": "body",
    "jobRestrict": [
      "knight",
      "fighter",
      "battlemage",
      "rogue",
      "cleric"
    ],
    "rarity": "Common"
  },
  {
    "id": 1063,
    "name": "Heart Ring",
    "description": "Heart Ring. A rare goldsmith's work that steadies the pulse.",
    "icon": "/icons/items/heart-ring.png",
    "slug": "heart-ring",
    "kind": "equipment",
    "craftLevel": 12,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 290,
      "materialsText": "Copper Ore×2, Soft Pelt×1, Pale Dust×1"
    },
    "stats": {
      "regen": 1,
      "healPotency": 5,
      "atk": 6
    },
    "slot": "ring",
    "jobRestrict": "all",
    "rarity": "Rare",
    "obtainedFrom": "Craft — goldsmithing"
  },
  {
    "id": 1064,
    "name": "Decayed Sword",
    "description": "Decayed Sword. Ruined gear dug from the ashes of Anvilhold's fallen craft halls.",
    "icon": "/icons/items/decayed-sword.png",
    "slug": "decayed-sword",
    "kind": "equipment",
    "craftLevel": 2,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 250,
      "materialsText": "Dustgrain×5"
    },
    "stats": {
      "atk": 9
    },
    "delayMs": 2400,
    "slot": "main",
    "jobRestrict": [
      "knight",
      "fighter",
      "battlemage"
    ],
    "weaponFamily": "sword",
    "rarity": "Legendary"
  },
  {
    "id": 1065,
    "name": "Decayed Axe",
    "description": "Decayed Axe. Ruined gear dug from the ashes of Anvilhold's fallen craft halls.",
    "icon": "/icons/items/decayed-axe.png",
    "slug": "decayed-axe",
    "kind": "equipment",
    "craftLevel": 5,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 170,
      "materialsText": "Dustgrain×10"
    },
    "stats": {
      "atk": 10,
      "str": 2
    },
    "delayMs": 2600,
    "slot": "main",
    "jobRestrict": [
      "fighter"
    ],
    "weaponFamily": "axe",
    "rarity": "Epic"
  },
  {
    "id": 1066,
    "name": "Bronze Rivet×8",
    "description": "Bronze Rivet×8 — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/bronze-rivet.png",
    "slug": "bronze-rivet",
    "kind": "intermediate",
    "craftLevel": 2,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 90,
      "materialsText": "Bronze Ingot×1, Pale Dust×1"
    },
    "craftOutputQty": 8
  },
  {
    "id": 1067,
    "name": "Bronze Sheet",
    "description": "Bronze Sheet — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/bronze-sheet.png",
    "slug": "bronze-sheet",
    "kind": "intermediate",
    "craftLevel": 4,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 130,
      "materialsText": "Bronze Ingot×2, Pale Dust×1"
    }
  },
  {
    "id": 1068,
    "name": "Bronze Sabatons",
    "description": "Bronze Sabatons. Ruined gear dug from the ashes of Anvilhold's fallen craft halls.",
    "icon": "/icons/items/bronze-sabatons.png",
    "slug": "bronze-sabatons",
    "kind": "equipment",
    "craftLevel": 6,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 170,
      "materialsText": "Bronze Ingot×1, Pale Dust×1"
    },
    "stats": {
      "def": 4,
      "vit": 2,
      "hp": 10
    },
    "slot": "feet",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Common"
  },
  {
    "id": 1069,
    "name": "Iron Sabatons",
    "description": "Iron Sabatons. Ruined gear dug from the ashes of Anvilhold's fallen craft halls.",
    "icon": "/icons/items/iron-sabatons.png",
    "slug": "iron-sabatons",
    "kind": "equipment",
    "craftLevel": 25,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 550,
      "materialsText": "Iron Ingot×1, Ash Dust×1"
    },
    "stats": {
      "def": 8,
      "vit": 4,
      "agi": 3,
      "hp": 18
    },
    "slot": "feet",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Common"
  },
  {
    "id": 1070,
    "name": "Decayed Greaves",
    "description": "Decayed Greaves. Ruined gear dug from the ashes of Anvilhold's fallen craft halls.",
    "icon": "/icons/items/decayed-greaves.png",
    "slug": "decayed-greaves",
    "kind": "equipment",
    "craftLevel": 4,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 130,
      "materialsText": "Dustgrain×6"
    },
    "stats": {
      "def": 3,
      "vit": 2,
      "hp": 8
    },
    "slot": "feet",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Rare"
  },
  {
    "id": 1071,
    "name": "Battleweave Coat",
    "description": "Battleweave Coat. A silk fighting coat cut for blade and spell.",
    "icon": "/icons/items/battleweave-coat.png",
    "slug": "battleweave-coat",
    "kind": "equipment",
    "craftLevel": 61,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1270,
      "materialsText": "Silk Cloth×3, Velvet Thread×1, Slag Dust×1"
    },
    "stats": {
      "def": 28,
      "str": 8,
      "int": 14,
      "mab": 10,
      "mp": 50,
      "hp": 38
    },
    "slot": "body",
    "jobRestrict": [
      "battlemage"
    ],
    "rarity": "Rare"
  },
  {
    "id": 1072,
    "name": "Altarweave Coat",
    "description": "Altarweave Coat. A rare cleric coat with a gold stole, cut from altar cloth.",
    "icon": "/icons/items/altarweave-coat.png",
    "slug": "altarweave-coat",
    "kind": "equipment",
    "craftLevel": 72,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1490,
      "materialsText": "Velvet Cloth×3, Bell Dust×1"
    },
    "stats": {
      "def": 31,
      "mnd": 31,
      "mp": 70,
      "hp": 40
    },
    "slot": "body",
    "jobRestrict": [
      "cleric"
    ],
    "rarity": "Rare"
  },
  {
    "id": 1073,
    "name": "Iron Shield",
    "description": "Iron Shield. A round iron face for the off hand, the Mayflower stock pattern.",
    "icon": "/icons/items/iron-shield.png",
    "slug": "iron-shield",
    "kind": "equipment",
    "craftLevel": 31,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 670,
      "materialsText": "Iron Ingot×3, Cobble×2, Ash Dust×1"
    },
    "stats": {
      "def": 15,
      "vit": 3
    },
    "slot": "sub",
    "jobRestrict": [
      "knight",
      "battlemage",
      "cleric"
    ],
    "rarity": "Common"
  },
  {
    "id": 1074,
    "name": "Bloodbeam Crozier",
    "description": "Bloodbeam Crozier. An uncommon cleric staff with a hooked head, cut from bloodbeam lumber.",
    "icon": "/icons/items/bloodbeam-crozier.png",
    "slug": "bloodbeam-crozier",
    "kind": "equipment",
    "craftLevel": 57,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 1190,
      "materialsText": "Bloodbeam Lumber×2, Jadeite×1, Slag Dust×1"
    },
    "stats": {
      "mab": 27,
      "mnd": 6
    },
    "delayMs": 3600,
    "slot": "main",
    "jobRestrict": [
      "cleric"
    ],
    "weaponFamily": "staff",
    "rarity": "Uncommon"
  },
  {
    "id": 1075,
    "name": "Ashbeam Tome",
    "description": "Ashbeam Tome. A common support book bound in ashbeam-stained cloth.",
    "icon": "/icons/items/ashbeam-tome.png",
    "slug": "ashbeam-tome",
    "kind": "equipment",
    "craftLevel": 55,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1150,
      "materialsText": "Silk Cloth×2, Spell Parchment×2, Slag Dust×1"
    },
    "stats": {
      "mab": 26,
      "int": 5,
      "mnd": 3,
      "mp": 22
    },
    "delayMs": 2400,
    "slot": "main",
    "jobRestrict": [
      "tim"
    ],
    "weaponFamily": "staff",
    "rarity": "Common"
  },
  {
    "id": 1076,
    "name": "Bellwood Crozier",
    "description": "Bellwood Crozier. An uncommon two-hand cleric staff with a hooked head.",
    "icon": "/icons/items/bellwood-crozier.png",
    "slug": "bellwood-crozier",
    "kind": "equipment",
    "craftLevel": 70,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 1450,
      "materialsText": "Bellwood Lumber×2, Silk Thread×1, Bell Dust×1"
    },
    "stats": {
      "mab": 36,
      "mnd": 8
    },
    "delayMs": 3600,
    "slot": "main",
    "twoHand": true,
    "jobRestrict": [
      "cleric"
    ],
    "weaponFamily": "staff",
    "rarity": "Uncommon"
  },
  {
    "id": 1077,
    "name": "Battleweave Cuffs",
    "description": "Battleweave Cuffs. Rare battlemage wrist wraps cut from silk and velvet thread.",
    "icon": "/icons/items/battleweave-cuffs.png",
    "slug": "battleweave-cuffs",
    "kind": "equipment",
    "craftLevel": 63,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1310,
      "materialsText": "Silk Cloth×1, Velvet Thread×1, Slag Dust×1"
    },
    "stats": {
      "def": 14,
      "mab": 8,
      "str": 4,
      "int": 5
    },
    "slot": "hands",
    "jobRestrict": [
      "battlemage"
    ],
    "rarity": "Rare"
  },
  {
    "id": 1078,
    "name": "Darksteel Targe",
    "description": "Darksteel Targe. An epic small round for battlemage and cleric.",
    "icon": "/icons/items/darksteel-targe.png",
    "slug": "darksteel-targe",
    "kind": "equipment",
    "craftLevel": 75,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1550,
      "materialsText": "Darksteel Ingot×2, Mythril Nail×1, Bell Dust×1"
    },
    "stats": {
      "def": 26,
      "vit": 4,
      "mdb": 3
    },
    "slot": "sub",
    "jobRestrict": [
      "battlemage",
      "cleric"
    ],
    "rarity": "Epic"
  },
  {
    "id": 1079,
    "name": "Palace Shield",
    "description": "Palace Shield. A legendary pointed kite for the knight line.",
    "icon": "/icons/items/palace-shield.png",
    "slug": "palace-shield",
    "kind": "equipment",
    "craftLevel": 97,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1990,
      "materialsText": "Orichalcum Ingot×3, Marble Chip×1, Darksteel Nail×1, Throne Dust×1"
    },
    "stats": {
      "def": 40,
      "vit": 9
    },
    "slot": "sub",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Legendary"
  },
  {
    "id": 1080,
    "name": "Battleweave Slacks",
    "description": "Battleweave Slacks. Rare battlemage thigh panels with a steel seam.",
    "icon": "/icons/items/battleweave-slacks.png",
    "slug": "battleweave-slacks",
    "kind": "equipment",
    "craftLevel": 67,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1390,
      "materialsText": "Silk Cloth×2, Velvet Thread×1, Slag Dust×1"
    },
    "stats": {
      "def": 21,
      "mp": 70,
      "str": 5,
      "int": 6
    },
    "slot": "legs",
    "jobRestrict": [
      "battlemage"
    ],
    "rarity": "Rare"
  },
  {
    "id": 1081,
    "name": "Battleweave Pumps",
    "description": "Battleweave Pumps. Rare battlemage cloth shoes with a steel instep seam.",
    "icon": "/icons/items/battleweave-pumps.png",
    "slug": "battleweave-pumps",
    "kind": "equipment",
    "craftLevel": 71,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1470,
      "materialsText": "Silk Cloth×1, Velvet Thread×1, Slag Dust×1"
    },
    "stats": {
      "def": 15,
      "agi": 5,
      "str": 3,
      "mp": 80
    },
    "slot": "feet",
    "jobRestrict": [
      "battlemage"
    ],
    "rarity": "Rare"
  },
  {
    "id": 1082,
    "name": "Altarweave Cuffs",
    "description": "Altarweave Cuffs. Rare cleric wrist wraps with a gold stole bind.",
    "icon": "/icons/items/altarweave-cuffs.png",
    "slug": "altarweave-cuffs",
    "kind": "equipment",
    "craftLevel": 74,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1530,
      "materialsText": "Velvet Cloth×1, Bell Dust×1"
    },
    "stats": {
      "def": 16,
      "mab": 8,
      "mnd": 7
    },
    "slot": "hands",
    "jobRestrict": [
      "cleric"
    ],
    "rarity": "Rare"
  },
  {
    "id": 1083,
    "name": "Altarweave Slacks",
    "description": "Altarweave Slacks. Rare cleric thigh panels with a gold stole stripe.",
    "icon": "/icons/items/altarweave-slacks.png",
    "slug": "altarweave-slacks",
    "kind": "equipment",
    "craftLevel": 76,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1570,
      "materialsText": "Velvet Cloth×2, Bell Dust×1"
    },
    "stats": {
      "def": 25,
      "mp": 80,
      "mnd": 8
    },
    "slot": "legs",
    "jobRestrict": [
      "cleric"
    ],
    "rarity": "Rare"
  },
  {
    "id": 1084,
    "name": "Altarweave Pumps",
    "description": "Altarweave Pumps. Rare cleric cloth shoes with a gold instep bind.",
    "icon": "/icons/items/altarweave-pumps.png",
    "slug": "altarweave-pumps",
    "kind": "equipment",
    "craftLevel": 78,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1610,
      "materialsText": "Velvet Cloth×1, Bell Dust×1"
    },
    "stats": {
      "def": 17,
      "mnd": 4,
      "mp": 90
    },
    "slot": "feet",
    "jobRestrict": [
      "cleric"
    ],
    "rarity": "Rare"
  },
  {
    "id": 1085,
    "name": "Battleweave Raiment",
    "description": "Battleweave Raiment. Rare battlemage fighting coat, a heavier cut of the weave.",
    "icon": "/icons/items/battleweave-raiment.png",
    "slug": "battleweave-raiment",
    "kind": "equipment",
    "craftLevel": 93,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1910,
      "materialsText": "Velvet Cloth×3, Diamond×1, Throne Dust×1"
    },
    "stats": {
      "def": 38,
      "str": 12,
      "int": 22,
      "mab": 16,
      "mp": 72,
      "hp": 50
    },
    "slot": "body",
    "jobRestrict": [
      "battlemage"
    ],
    "rarity": "Rare"
  },
  {
    "id": 1086,
    "name": "Orichalcum Targe",
    "description": "Orichalcum Targe. An epic gold small round for battlemage and cleric.",
    "icon": "/icons/items/orichalcum-targe.png",
    "slug": "orichalcum-targe",
    "kind": "equipment",
    "craftLevel": 91,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1870,
      "materialsText": "Orichalcum Ingot×2, Marble Chip×1, Throne Dust×1"
    },
    "stats": {
      "def": 34,
      "vit": 6,
      "mdb": 5
    },
    "slot": "sub",
    "jobRestrict": [
      "battlemage",
      "cleric"
    ],
    "rarity": "Epic"
  },
  {
    "id": 1087,
    "name": "Throneweave Hat",
    "description": "Throneweave Hat. A legendary pointed hat for tim, sorcerer, and cleric.",
    "icon": "/icons/items/throneweave-hat.png",
    "slug": "throneweave-hat",
    "kind": "equipment",
    "craftLevel": 95,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1950,
      "materialsText": "Velvet Cloth×1, Diamond×1, Throne Dust×1"
    },
    "stats": {
      "def": 20,
      "int": 10,
      "mp": 100
    },
    "slot": "head",
    "jobRestrict": [
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Legendary"
  },
  {
    "id": 1088,
    "name": "Steel Sword",
    "description": "Steel Sword. An uncommon one-hand beside the steel greatsword.",
    "icon": "/icons/items/steel-sword.png",
    "slug": "steel-sword",
    "kind": "equipment",
    "craftLevel": 36,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 770,
      "materialsText": "Steel Ingot×2, Ashbeam Lumber×1, Slag Dust×1"
    },
    "stats": {
      "atk": 16,
      "str": 4,
      "int": 3
    },
    "delayMs": 2400,
    "slot": "main",
    "jobRestrict": [
      "knight",
      "fighter",
      "battlemage"
    ],
    "weaponFamily": "sword",
    "rarity": "Uncommon"
  },
  {
    "id": 1089,
    "name": "Steel Mail",
    "description": "Steel Mail. Uncommon knight and fighter plate, a steel cut of iron mail.",
    "icon": "/icons/items/steel-mail.png",
    "slug": "steel-mail",
    "kind": "equipment",
    "craftLevel": 37,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 790,
      "materialsText": "Steel Ingot×3, Slag Dust×1"
    },
    "stats": {
      "def": 26,
      "vit": 9,
      "hp": 37
    },
    "slot": "body",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Uncommon"
  },
  {
    "id": 1090,
    "name": "Orichalcum Mail",
    "description": "Orichalcum Mail. Epic fighter hauberk of gold scales.",
    "icon": "/icons/items/orichalcum-mail.png",
    "slug": "orichalcum-mail",
    "kind": "equipment",
    "craftLevel": 85,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1750,
      "materialsText": "Orichalcum Ingot×3, Darksteel Nail×1, Throne Dust×1"
    },
    "stats": {
      "def": 53,
      "vit": 18,
      "hp": 73
    },
    "slot": "body",
    "jobRestrict": [
      "fighter"
    ],
    "rarity": "Epic"
  },
  {
    "id": 1091,
    "name": "Rogue's Dagger",
    "description": "Rogue's Dagger. Rare rogue main, a steel short blade on a leather grip.",
    "icon": "/icons/items/rogues-dagger.png",
    "slug": "rogues-dagger",
    "kind": "equipment",
    "craftLevel": 61,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 1270,
      "materialsText": "Giant Femur×1, Fine Leather×1, Bone Hilt×1, Bell Dust×1"
    },
    "stats": {
      "atk": 34,
      "dex": 10
    },
    "delayMs": 1800,
    "slot": "main",
    "jobRestrict": [
      "rogue"
    ],
    "weaponFamily": "dagger",
    "rarity": "Rare"
  },
  {
    "id": 1092,
    "name": "Altarweave Hat",
    "description": "Altarweave Hat. Rare cleric pointed hat with a gold stole band.",
    "icon": "/icons/items/altarweave-hat.png",
    "slug": "altarweave-hat",
    "kind": "equipment",
    "craftLevel": 62,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1290,
      "materialsText": "Silk Cloth×1, Velvet Thread×1, Slag Dust×1"
    },
    "stats": {
      "def": 16,
      "mnd": 8,
      "mp": 80
    },
    "slot": "head",
    "jobRestrict": [
      "cleric"
    ],
    "rarity": "Rare"
  },
  {
    "id": 1093,
    "name": "Orichalcum War Helm",
    "description": "Orichalcum War Helm. Epic fighter helm, gold plate with a steel brow.",
    "icon": "/icons/items/orichalcum-war-helm.png",
    "slug": "orichalcum-war-helm",
    "kind": "equipment",
    "craftLevel": 81,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1670,
      "materialsText": "Orichalcum Ingot×1, Marble Chip×1, Throne Dust×1"
    },
    "stats": {
      "def": 18,
      "vit": 8,
      "hp": 88
    },
    "slot": "head",
    "jobRestrict": [
      "fighter"
    ],
    "rarity": "Epic"
  },
  {
    "id": 1094,
    "name": "Orichalcum War Gauntlets",
    "description": "Orichalcum War Gauntlets. Epic fighter hands, gold fingers with a steel rivet.",
    "icon": "/icons/items/orichalcum-war-gauntlets.png",
    "slug": "orichalcum-war-gauntlets",
    "kind": "equipment",
    "craftLevel": 83,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1710,
      "materialsText": "Orichalcum Ingot×1, Marble Chip×1, Throne Dust×1"
    },
    "stats": {
      "def": 18,
      "atk": 8,
      "vit": 8
    },
    "slot": "hands",
    "jobRestrict": [
      "fighter"
    ],
    "rarity": "Epic"
  },
  {
    "id": 1095,
    "name": "Orichalcum War Sabatons",
    "description": "Orichalcum War Sabatons. Epic fighter feet, gold vamp with steel rivets.",
    "icon": "/icons/items/orichalcum-war-sabatons.png",
    "slug": "orichalcum-war-sabatons",
    "kind": "equipment",
    "craftLevel": 84,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1730,
      "materialsText": "Orichalcum Ingot×2, Marble Chip×1, Throne Dust×1"
    },
    "stats": {
      "def": 19,
      "vit": 8,
      "agi": 8
    },
    "slot": "feet",
    "jobRestrict": [
      "fighter"
    ],
    "rarity": "Epic"
  },
  {
    "id": 1096,
    "name": "Rogue's Helm",
    "description": "Rogue's Helm. Rare rogue helm, scale checker with a gold brow.",
    "icon": "/icons/items/rogues-helm.png",
    "slug": "rogues-helm",
    "kind": "equipment",
    "craftLevel": 81,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1670,
      "materialsText": "Scale Leather×1, Bell Dust×1"
    },
    "stats": {
      "def": 17,
      "dex": 9,
      "acc": 8
    },
    "slot": "head",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Rare"
  },
  {
    "id": 1097,
    "name": "Rogue's Gloves",
    "description": "Rogue's Gloves. Rare rogue hands, steel fingers with gold scale discs.",
    "icon": "/icons/items/rogues-gloves.png",
    "slug": "rogues-gloves",
    "kind": "equipment",
    "craftLevel": 83,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1710,
      "materialsText": "Scale Leather×1, Bell Dust×1"
    },
    "stats": {
      "def": 17,
      "acc": 9,
      "dex": 8
    },
    "slot": "hands",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Rare"
  },
  {
    "id": 1098,
    "name": "Rogue's Boots",
    "description": "Rogue's Boots. Rare rogue feet, steel vamp with gold instep rivets.",
    "icon": "/icons/items/rogues-boots.png",
    "slug": "rogues-boots",
    "kind": "equipment",
    "craftLevel": 84,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1730,
      "materialsText": "Scale Leather×2, Bell Dust×1"
    },
    "stats": {
      "def": 18,
      "agi": 12,
      "hp": 55
    },
    "slot": "feet",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Rare"
  },
  {
    "id": 1099,
    "name": "Orichalcum Dagger",
    "description": "Orichalcum Dagger. Epic rogue main, a gold short blade on a leather grip.",
    "icon": "/icons/items/orichalcum-dagger.png",
    "slug": "orichalcum-dagger",
    "kind": "equipment",
    "craftLevel": 87,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1790,
      "materialsText": "Orichalcum Ingot×1, Fine Leather×1, Throne Dust×1"
    },
    "stats": {
      "atk": 40,
      "dex": 12
    },
    "delayMs": 1800,
    "slot": "main",
    "jobRestrict": [
      "rogue"
    ],
    "weaponFamily": "dagger",
    "rarity": "Epic"
  },
  {
    "id": 1100,
    "name": "Battleweave Hat",
    "description": "Battleweave Hat. Rare battlemage pointed hat with a steel brow.",
    "icon": "/icons/items/battleweave-hat.png",
    "slug": "battleweave-hat",
    "kind": "equipment",
    "craftLevel": 64,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1330,
      "materialsText": "Silk Cloth×1, Velvet Thread×1, Slag Dust×1"
    },
    "stats": {
      "def": 15,
      "int": 6,
      "str": 3,
      "mab": 6,
      "mp": 60
    },
    "slot": "head",
    "jobRestrict": [
      "battlemage"
    ],
    "rarity": "Rare"
  },
  {
    "id": 1101,
    "name": "Battleweave Hood",
    "description": "Battleweave Hood. Rare battlemage cowl, steel-trimmed cloth.",
    "icon": "/icons/items/battleweave-hood.png",
    "slug": "battleweave-hood",
    "kind": "equipment",
    "craftLevel": 81,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1670,
      "materialsText": "Velvet Cloth×1, Diamond×1, Throne Dust×1"
    },
    "stats": {
      "def": 18,
      "str": 6,
      "int": 8,
      "mp": 90
    },
    "slot": "head",
    "jobRestrict": [
      "battlemage"
    ],
    "rarity": "Rare"
  },
  {
    "id": 1102,
    "name": "Battleweave Gloves",
    "description": "Battleweave Gloves. Rare battlemage hands, steel-wrapped cuffs.",
    "icon": "/icons/items/battleweave-gloves.png",
    "slug": "battleweave-gloves",
    "kind": "equipment",
    "craftLevel": 82,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1690,
      "materialsText": "Velvet Cloth×1, Throne Dust×1"
    },
    "stats": {
      "def": 18,
      "mab": 10,
      "str": 5,
      "int": 7
    },
    "slot": "hands",
    "jobRestrict": [
      "battlemage"
    ],
    "rarity": "Rare"
  },
  {
    "id": 1103,
    "name": "Rogue's Trousers",
    "description": "Rogue's Trousers. Rare rogue legs, scale thighs with a gold hip band.",
    "icon": "/icons/items/rogues-trousers.png",
    "slug": "rogues-trousers",
    "kind": "equipment",
    "craftLevel": 85,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1750,
      "materialsText": "Scale Leather×2, Bell Dust×1"
    },
    "stats": {
      "def": 24,
      "agi": 14,
      "hp": 70
    },
    "slot": "legs",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Rare"
  },
  {
    "id": 1104,
    "name": "Battleweave Hose",
    "description": "Battleweave Hose. Rare battlemage legs, steel-seamed cloth.",
    "icon": "/icons/items/battleweave-hose.png",
    "slug": "battleweave-hose",
    "kind": "equipment",
    "craftLevel": 86,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1770,
      "materialsText": "Velvet Cloth×2, Throne Dust×1"
    },
    "stats": {
      "def": 27,
      "mp": 90,
      "str": 7,
      "int": 8
    },
    "slot": "legs",
    "jobRestrict": [
      "battlemage"
    ],
    "rarity": "Rare"
  },
  {
    "id": 1105,
    "name": "Battleweave Slippers",
    "description": "Battleweave Slippers. Rare battlemage feet, steel-seamed pumps.",
    "icon": "/icons/items/battleweave-slippers.png",
    "slug": "battleweave-slippers",
    "kind": "equipment",
    "craftLevel": 88,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1810,
      "materialsText": "Velvet Cloth×1, Throne Dust×1"
    },
    "stats": {
      "def": 19,
      "agi": 7,
      "str": 4,
      "mp": 100
    },
    "slot": "feet",
    "jobRestrict": [
      "battlemage"
    ],
    "rarity": "Rare"
  },
  {
    "id": 1106,
    "name": "Orichalcum War Cuisses",
    "description": "Orichalcum War Cuisses. Epic fighter thighs, gold-rimmed steel.",
    "icon": "/icons/items/orichalcum-war-cuisses.png",
    "slug": "orichalcum-war-cuisses",
    "kind": "equipment",
    "craftLevel": 89,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1830,
      "materialsText": "Orichalcum Ingot×2, Marble Chip×1, Throne Dust×1"
    },
    "stats": {
      "def": 27,
      "vit": 10,
      "hp": 96
    },
    "slot": "legs",
    "jobRestrict": [
      "fighter"
    ],
    "rarity": "Epic"
  },
  {
    "id": 1107,
    "name": "Throneweave Cuffs",
    "description": "Throneweave Cuffs. Legendary caster hands, gold wrap on dark cloth.",
    "icon": "/icons/items/throneweave-cuffs.png",
    "slug": "throneweave-cuffs",
    "kind": "equipment",
    "craftLevel": 91,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1870,
      "materialsText": "Velvet Cloth×1, Diamond×1, Throne Dust×1"
    },
    "stats": {
      "def": 20,
      "mab": 12,
      "int": 8
    },
    "slot": "hands",
    "jobRestrict": [
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Legendary"
  },
  {
    "id": 1108,
    "name": "Throneweave Slacks",
    "description": "Throneweave Slacks. Legendary caster legs, gold hip and knee.",
    "icon": "/icons/items/throneweave-slacks.png",
    "slug": "throneweave-slacks",
    "kind": "equipment",
    "craftLevel": 94,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1930,
      "materialsText": "Velvet Cloth×2, Diamond×1, Throne Dust×1"
    },
    "stats": {
      "def": 32,
      "mp": 100,
      "int": 10
    },
    "slot": "legs",
    "jobRestrict": [
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Legendary"
  },
  {
    "id": 1109,
    "name": "Throneweave Pumps",
    "description": "Throneweave Pumps. Legendary caster feet, gold-trimmed vamp.",
    "icon": "/icons/items/throneweave-pumps.png",
    "slug": "throneweave-pumps",
    "kind": "equipment",
    "craftLevel": 98,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 2010,
      "materialsText": "Velvet Cloth×1, Diamond×1, Throne Dust×1"
    },
    "stats": {
      "def": 21,
      "agi": 8,
      "mp": 120
    },
    "slot": "feet",
    "jobRestrict": [
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Legendary"
  },
  {
    "id": 1110,
    "name": "Steel Helm",
    "description": "Steel Helm. Uncommon knight and fighter helm, steel crown with a gold face rim.",
    "icon": "/icons/items/steel-helm.png",
    "slug": "steel-helm",
    "kind": "equipment",
    "craftLevel": 32,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 690,
      "materialsText": "Steel Ingot×1, Slag Dust×1"
    },
    "stats": {
      "def": 9,
      "str": 4,
      "acc": 4
    },
    "slot": "head",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Uncommon"
  },
  {
    "id": 1111,
    "name": "Steel Mittens",
    "description": "Steel Mittens. Uncommon knight and fighter hands, steel palms without gold rivets.",
    "icon": "/icons/items/steel-mittens.png",
    "slug": "steel-mittens",
    "kind": "equipment",
    "craftLevel": 33,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 710,
      "materialsText": "Steel Ingot×1, Slag Dust×1"
    },
    "stats": {
      "def": 9,
      "atk": 4,
      "acc": 4
    },
    "slot": "hands",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Uncommon"
  },
  {
    "id": 1112,
    "name": "Steel Shield",
    "description": "Steel Shield. Uncommon tank and hybrid off-hand, gold boss on a steel rim.",
    "icon": "/icons/items/steel-shield.png",
    "slug": "steel-shield",
    "kind": "equipment",
    "craftLevel": 39,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 830,
      "materialsText": "Steel Ingot×3, Steel Nail×1, Slag Dust×1"
    },
    "stats": {
      "def": 19,
      "vit": 4
    },
    "slot": "sub",
    "jobRestrict": [
      "knight",
      "battlemage",
      "cleric"
    ],
    "rarity": "Uncommon"
  },
  {
    "id": 1113,
    "name": "Steel Subligar",
    "description": "Steel Subligar. Uncommon knight and fighter thighs, steel hip and knee.",
    "icon": "/icons/items/steel-subligar.png",
    "slug": "steel-subligar",
    "kind": "equipment",
    "craftLevel": 41,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 870,
      "materialsText": "Steel Ingot×2, Slag Dust×1"
    },
    "stats": {
      "def": 13,
      "str": 5,
      "hp": 48
    },
    "slot": "legs",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Uncommon"
  },
  {
    "id": 1114,
    "name": "Steel Sabatons",
    "description": "Steel Sabatons. Uncommon knight and fighter feet, steel plate with an instep rivet.",
    "icon": "/icons/items/steel-sabatons.png",
    "slug": "steel-sabatons",
    "kind": "equipment",
    "craftLevel": 43,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 910,
      "materialsText": "Steel Ingot×2, Slag Dust×1"
    },
    "stats": {
      "def": 10,
      "vit": 5,
      "agi": 4,
      "hp": 24
    },
    "slot": "feet",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Uncommon"
  },
  {
    "id": 1115,
    "name": "Mythril Mail",
    "description": "Mythril Mail. Rare fighter plate, steel field with a pale medallion.",
    "icon": "/icons/items/mythril-mail.png",
    "slug": "mythril-mail",
    "kind": "equipment",
    "craftLevel": 45,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 950,
      "materialsText": "Mythril Ingot×3, Steel Nail×1, Slag Dust×1"
    },
    "stats": {
      "def": 34,
      "vit": 12,
      "hp": 48
    },
    "slot": "body",
    "jobRestrict": [
      "fighter"
    ],
    "rarity": "Rare"
  },
  {
    "id": 1116,
    "name": "Darksteel Greatsword",
    "description": "Darksteel Greatsword. Epic two-hander, a dust-dark blade on a long grip.",
    "icon": "/icons/items/darksteel-greatsword.png",
    "slug": "darksteel-greatsword",
    "kind": "equipment",
    "craftLevel": 67,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1390,
      "materialsText": "Darksteel Ingot×4, Bell Dust×1"
    },
    "stats": {
      "atk": 42,
      "str": 10
    },
    "delayMs": 3800,
    "slot": "main",
    "twoHand": true,
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "weaponFamily": "greatsword",
    "rarity": "Epic"
  },
  {
    "id": 1117,
    "name": "Orichalcum Greatsword",
    "description": "Orichalcum Greatsword. Epic two-hander, a gold blade on a long grip.",
    "icon": "/icons/items/orichalcum-greatsword.png",
    "slug": "orichalcum-greatsword",
    "kind": "equipment",
    "craftLevel": 90,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1850,
      "materialsText": "Orichalcum Ingot×4, Throne Dust×1"
    },
    "stats": {
      "atk": 48,
      "str": 11
    },
    "delayMs": 3800,
    "slot": "main",
    "twoHand": true,
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "weaponFamily": "greatsword",
    "rarity": "Epic"
  },
  {
    "id": 1118,
    "name": "Bronze Greatsword",
    "description": "Bronze Greatsword. Common knight and fighter two-hander, a long bronze blade.",
    "icon": "/icons/items/bronze-greatsword.png",
    "slug": "bronze-greatsword",
    "kind": "equipment",
    "craftLevel": 15,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 350,
      "materialsText": "Bronze Ingot×4, Pale Dust×1"
    },
    "stats": {
      "atk": 12,
      "str": 3
    },
    "delayMs": 3800,
    "slot": "main",
    "twoHand": true,
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "weaponFamily": "greatsword",
    "rarity": "Common"
  },
  {
    "id": 1119,
    "name": "Iron Axe",
    "description": "Iron Axe. Common fighter one-hander, a steel labrys on a short haft.",
    "icon": "/icons/items/iron-axe.png",
    "slug": "iron-axe",
    "kind": "equipment",
    "craftLevel": 21,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 470,
      "materialsText": "Iron Ingot×2, Ash Dust×1"
    },
    "stats": {
      "atk": 11,
      "str": 4
    },
    "delayMs": 2600,
    "slot": "main",
    "jobRestrict": [
      "fighter"
    ],
    "weaponFamily": "axe",
    "rarity": "Common"
  },
  {
    "id": 1120,
    "name": "Steel Great Axe",
    "description": "Steel Great Axe. Uncommon fighter two-hander, a long steel labrys.",
    "icon": "/icons/items/steel-great-axe.png",
    "slug": "steel-great-axe",
    "kind": "equipment",
    "craftLevel": 47,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 990,
      "materialsText": "Steel Ingot×4, Slag Dust×1"
    },
    "stats": {
      "atk": 24,
      "str": 6
    },
    "delayMs": 2600,
    "slot": "main",
    "twoHand": true,
    "jobRestrict": [
      "fighter"
    ],
    "weaponFamily": "axe",
    "rarity": "Uncommon"
  },
  {
    "id": 1121,
    "name": "Mythril Targe",
    "description": "Mythril Targe. Rare hybrid and healer off-hand, a pale trail field with a gold rim.",
    "icon": "/icons/items/mythril-targe.png",
    "slug": "mythril-targe",
    "kind": "equipment",
    "craftLevel": 53,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 1110,
      "materialsText": "Mythril Ingot×2, Steel Nail×1, Slag Dust×1"
    },
    "stats": {
      "def": 22,
      "vit": 4,
      "mdb": 2
    },
    "slot": "sub",
    "jobRestrict": [
      "battlemage",
      "cleric"
    ],
    "rarity": "Rare"
  },
  {
    "id": 1122,
    "name": "Mythril Great Axe",
    "description": "Mythril Great Axe. Rare fighter two-hander, a long pale labrys.",
    "icon": "/icons/items/mythril-great-axe.png",
    "slug": "mythril-great-axe",
    "kind": "equipment",
    "craftLevel": 55,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 1150,
      "materialsText": "Mythril Ingot×4, Slag Dust×1"
    },
    "stats": {
      "atk": 30,
      "str": 8
    },
    "delayMs": 2600,
    "slot": "main",
    "twoHand": true,
    "jobRestrict": [
      "fighter"
    ],
    "weaponFamily": "axe",
    "rarity": "Rare"
  },
  {
    "id": 1123,
    "name": "Mythril Dagger",
    "description": "Mythril Dagger. Rare rogue short blade, a pale edge on a leather grip.",
    "icon": "/icons/items/mythril-dagger.png",
    "slug": "mythril-dagger",
    "kind": "equipment",
    "craftLevel": 57,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 1190,
      "materialsText": "Mythril Ingot×1, Fine Leather×1, Slag Dust×1"
    },
    "stats": {
      "atk": 22,
      "dex": 7
    },
    "delayMs": 1800,
    "slot": "main",
    "jobRestrict": [
      "rogue"
    ],
    "weaponFamily": "dagger",
    "rarity": "Rare"
  },
  {
    "id": 1124,
    "name": "Darksteel Dagger",
    "description": "Darksteel Dagger. Epic rogue short blade, a dust-dark edge.",
    "icon": "/icons/items/darksteel-dagger.png",
    "slug": "darksteel-dagger",
    "kind": "equipment",
    "craftLevel": 63,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1310,
      "materialsText": "Darksteel Ingot×1, Fine Leather×1, Bell Dust×1"
    },
    "stats": {
      "atk": 36,
      "dex": 10
    },
    "delayMs": 1800,
    "slot": "main",
    "jobRestrict": [
      "rogue"
    ],
    "weaponFamily": "dagger",
    "rarity": "Epic"
  },
  {
    "id": 1125,
    "name": "Palace Sword",
    "description": "Palace Sword. Legendary knight hybrid one-hander, a gold blade.",
    "icon": "/icons/items/palace-sword.png",
    "slug": "palace-sword",
    "kind": "equipment",
    "craftLevel": 99,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 2030,
      "materialsText": "Orichalcum Ingot×2, Bellwood Lumber×1, Throne Dust×1"
    },
    "stats": {
      "atk": 46,
      "str": 12,
      "int": 8
    },
    "delayMs": 2400,
    "slot": "main",
    "jobRestrict": [
      "knight",
      "fighter",
      "battlemage"
    ],
    "weaponFamily": "sword",
    "rarity": "Legendary"
  },
  {
    "id": 1126,
    "name": "Bronze Dagger",
    "description": "Bronze Dagger. Common rogue short blade, a copper edge on a leather grip.",
    "icon": "/icons/items/bronze-dagger.png",
    "slug": "bronze-dagger",
    "kind": "equipment",
    "craftLevel": 13,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 310,
      "materialsText": "Bronze Ingot×1, Leather×1, Pale Dust×1"
    },
    "stats": {
      "atk": 8,
      "dex": 3
    },
    "delayMs": 1800,
    "slot": "main",
    "jobRestrict": [
      "rogue"
    ],
    "weaponFamily": "dagger",
    "rarity": "Common"
  },
  {
    "id": 1127,
    "name": "Bronze Great Axe",
    "description": "Bronze Great Axe. Common fighter two-hander, a long copper labrys.",
    "icon": "/icons/items/bronze-great-axe.png",
    "slug": "bronze-great-axe",
    "kind": "equipment",
    "craftLevel": 17,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 390,
      "materialsText": "Bronze Ingot×4, Pale Dust×1"
    },
    "stats": {
      "atk": 10,
      "str": 3
    },
    "delayMs": 2600,
    "slot": "main",
    "twoHand": true,
    "jobRestrict": [
      "fighter"
    ],
    "weaponFamily": "axe",
    "rarity": "Common"
  },
  {
    "id": 1128,
    "name": "Steel Dagger",
    "description": "Steel Dagger. Uncommon rogue short blade, a grey edge on a leather grip.",
    "icon": "/icons/items/steel-dagger.png",
    "slug": "steel-dagger",
    "kind": "equipment",
    "craftLevel": 56,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1170,
      "materialsText": "Steel Ingot×1, Fine Leather×1, Slag Dust×1"
    },
    "stats": {
      "atk": 16,
      "dex": 5
    },
    "delayMs": 1800,
    "slot": "main",
    "jobRestrict": [
      "rogue"
    ],
    "weaponFamily": "dagger",
    "rarity": "Uncommon"
  },
  {
    "id": 1129,
    "name": "Steel Axe",
    "description": "Steel Axe. Uncommon fighter one-hander, a gold-socket labrys on a short haft.",
    "icon": "/icons/items/steel-axe.png",
    "slug": "steel-axe",
    "kind": "equipment",
    "craftLevel": 59,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1230,
      "materialsText": "Steel Ingot×2, Slag Dust×1"
    },
    "stats": {
      "atk": 18,
      "str": 5
    },
    "delayMs": 2600,
    "slot": "main",
    "jobRestrict": [
      "fighter"
    ],
    "weaponFamily": "axe",
    "rarity": "Uncommon"
  },
  {
    "id": 1130,
    "name": "Mythril Axe",
    "description": "Mythril Axe. Rare fighter one-hander, a pale labrys on a short haft.",
    "icon": "/icons/items/mythril-axe.png",
    "slug": "mythril-axe",
    "kind": "equipment",
    "craftLevel": 61,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 1270,
      "materialsText": "Mythril Ingot×2, Slag Dust×1"
    },
    "stats": {
      "atk": 24,
      "str": 7
    },
    "delayMs": 2600,
    "slot": "main",
    "jobRestrict": [
      "fighter"
    ],
    "weaponFamily": "axe",
    "rarity": "Rare"
  },
  {
    "id": 1131,
    "name": "Darksteel Axe",
    "description": "Darksteel Axe. Epic fighter one-hander, a dust-dark labrys on a short haft.",
    "icon": "/icons/items/darksteel-axe.png",
    "slug": "darksteel-axe",
    "kind": "equipment",
    "craftLevel": 64,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1330,
      "materialsText": "Darksteel Ingot×2, Bell Dust×1"
    },
    "stats": {
      "atk": 30,
      "str": 8
    },
    "delayMs": 2600,
    "slot": "main",
    "jobRestrict": [
      "fighter"
    ],
    "weaponFamily": "axe",
    "rarity": "Epic"
  },
  {
    "id": 1132,
    "name": "Bone Gloves",
    "description": "Bone Gloves. Common fighter and rogue hands, ivory finger tubes on hide cuffs.",
    "icon": "/icons/items/bone-gloves.png",
    "slug": "bone-gloves",
    "kind": "equipment",
    "craftLevel": 29,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 630,
      "materialsText": "Bone Chip×2, Soft Pelt×1, Ash Dust×1"
    },
    "stats": {
      "def": 7,
      "dex": 3,
      "acc": 3
    },
    "slot": "hands",
    "jobRestrict": [
      "fighter",
      "rogue"
    ],
    "rarity": "Common"
  },
  {
    "id": 1133,
    "name": "Bone Boots",
    "description": "Bone Boots. Common fighter and rogue feet, ivory wraps on hide soles.",
    "icon": "/icons/items/bone-boots.png",
    "slug": "bone-boots",
    "kind": "equipment",
    "craftLevel": 33,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 710,
      "materialsText": "Bone Chip×2, Soft Pelt×1, Ash Dust×1"
    },
    "stats": {
      "def": 7,
      "agi": 3,
      "dex": 2,
      "hp": 16
    },
    "slot": "feet",
    "jobRestrict": [
      "fighter",
      "rogue"
    ],
    "rarity": "Common"
  },
  {
    "id": 1134,
    "name": "Orichalcum Axe",
    "description": "Orichalcum Axe. Epic fighter one-hander, a gold-trail labrys on a short haft.",
    "icon": "/icons/items/orichalcum-axe.png",
    "slug": "orichalcum-axe",
    "kind": "equipment",
    "craftLevel": 76,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1570,
      "materialsText": "Orichalcum Ingot×2, Throne Dust×1"
    },
    "stats": {
      "atk": 36,
      "str": 10
    },
    "delayMs": 2600,
    "slot": "main",
    "jobRestrict": [
      "fighter"
    ],
    "weaponFamily": "axe",
    "rarity": "Epic"
  },
  {
    "id": 1135,
    "name": "Orichalcum Great Axe",
    "description": "Orichalcum Great Axe. Epic fighter two-hander, a gold-trail labrys on a long haft.",
    "icon": "/icons/items/orichalcum-great-axe.png",
    "slug": "orichalcum-great-axe",
    "kind": "equipment",
    "craftLevel": 77,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1590,
      "materialsText": "Orichalcum Ingot×4, Throne Dust×1"
    },
    "stats": {
      "atk": 42,
      "str": 11
    },
    "delayMs": 2600,
    "slot": "main",
    "twoHand": true,
    "jobRestrict": [
      "fighter"
    ],
    "weaponFamily": "axe",
    "rarity": "Epic"
  },
  {
    "id": 1136,
    "name": "Orichalcum Shield",
    "description": "Orichalcum Shield. Epic knight round, a gold face on the darksteel shield mesh.",
    "icon": "/icons/items/orichalcum-shield.png",
    "slug": "orichalcum-shield",
    "kind": "equipment",
    "craftLevel": 78,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1610,
      "materialsText": "Orichalcum Ingot×3, Darksteel Nail×1, Throne Dust×1"
    },
    "stats": {
      "def": 36,
      "vit": 8
    },
    "slot": "sub",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Epic"
  },
  {
    "id": 1137,
    "name": "Palace Greatsword",
    "description": "Palace Greatsword. Legendary knight and fighter two-hander, a trail-gold long blade.",
    "icon": "/icons/items/palace-greatsword.png",
    "slug": "palace-greatsword",
    "kind": "equipment",
    "craftLevel": 96,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1970,
      "materialsText": "Orichalcum Ingot×4, Throne Dust×1"
    },
    "stats": {
      "atk": 54,
      "str": 13
    },
    "delayMs": 3800,
    "slot": "main",
    "twoHand": true,
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "weaponFamily": "greatsword",
    "rarity": "Legendary"
  },
  {
    "id": 1138,
    "name": "Palace Targe",
    "description": "Palace Targe. Legendary battlemage and cleric small round, a gold face.",
    "icon": "/icons/items/palace-targe.png",
    "slug": "palace-targe",
    "kind": "equipment",
    "craftLevel": 97,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1990,
      "materialsText": "Orichalcum Ingot×2, Marble Chip×1, Throne Dust×1"
    },
    "stats": {
      "def": 38,
      "vit": 8,
      "mdb": 6
    },
    "slot": "sub",
    "jobRestrict": [
      "battlemage",
      "cleric"
    ],
    "rarity": "Legendary"
  },
  {
    "id": 1139,
    "name": "Iron Nail×12",
    "description": "Iron Nail×12 — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/iron-nail.png",
    "slug": "iron-nail",
    "kind": "intermediate",
    "craftLevel": 19,
    "craftSkill": "smithing",
    "craftOutputQty": 12,
    "recipe": {
      "gold": 430,
      "materialsText": "Iron Ingot×1, Ash Dust×1"
    }
  },
  {
    "id": 1140,
    "name": "Slag DEX Elixir",
    "description": "Slag DEX Elixir. Supplies from Mayflower's stillrooms, fletchers' benches and cookfires.",
    "icon": "/icons/items/slag-dex-elixir.png",
    "slug": "slag-dex-elixir",
    "kind": "consumable",
    "craftLevel": 53,
    "craftSkill": "alchemy",
    "recipe": {
      "gold": 1110,
      "materialsText": "Distilled Ash×1, Slag Dust×1"
    },
    "stats": {
      "hp": 146,
      "mp": 146
    },
    "consume": {
      "hp": 146,
      "mp": 146
    }
  },
  {
    "id": 1141,
    "name": "Fine Leather Belt",
    "description": "Fine Leather Belt — worked stock from Mayflower's benches. Feed it into higher recipes.",
    "icon": "/icons/items/fine-leather-belt.png",
    "slug": "fine-leather-belt",
    "kind": "intermediate",
    "craftLevel": 61,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1270,
      "materialsText": "Fine Leather×1, Slag Dust×1"
    }
  },
  {
    "id": 1142,
    "name": "Dustweave Cap",
    "description": "Dustweave Cap. A pale flax cap the basin weavers dust with grain so the sun does not bite.",
    "icon": "/icons/items/dustweave-cap.png",
    "slug": "dustweave-cap",
    "kind": "equipment",
    "craftLevel": 21,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 470,
      "materialsText": "Linen Cloth×1, Dustgrain×2, Pale Dust×1"
    },
    "stats": {
      "def": 6,
      "int": 2,
      "mnd": 2,
      "mp": 18
    },
    "slot": "head",
    "rarity": "Uncommon",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ]
  },
  {
    "id": 1143,
    "name": "Dustweave Socks",
    "description": "Dustweave Socks. Soft feet-wraps for the ash-road, still smelling of Dustgrain.",
    "icon": "/icons/items/dustweave-socks.png",
    "slug": "dustweave-socks",
    "kind": "equipment",
    "craftLevel": 22,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 490,
      "materialsText": "Linen Cloth×1, Dustgrain×1, Pale Dust×1"
    },
    "stats": {
      "def": 6,
      "agi": 2,
      "mp": 20
    },
    "slot": "feet",
    "rarity": "Uncommon",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ]
  },
  {
    "id": 1144,
    "name": "Dustweave Robe",
    "description": "Dustweave Robe. An open-country robe the Pale Hollow weavers cut for first journeys past Emberwatch.",
    "icon": "/icons/items/dustweave-robe.png",
    "slug": "dustweave-robe",
    "kind": "equipment",
    "craftLevel": 23,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 510,
      "materialsText": "Linen Cloth×2, Dustgrain×2, Pale Dust×1"
    },
    "stats": {
      "def": 12,
      "int": 12,
      "mp": 26,
      "hp": 16
    },
    "slot": "body",
    "rarity": "Uncommon",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ]
  },
  {
    "id": 1145,
    "name": "Dustweave Slops",
    "description": "Dustweave Slops. Dustweave legs, loose enough to wade the Ash Pit shallows.",
    "icon": "/icons/items/dustweave-slops.png",
    "slug": "dustweave-slops",
    "kind": "equipment",
    "craftLevel": 24,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 530,
      "materialsText": "Linen Cloth×2, Dead Fiber×1, Pale Dust×1"
    },
    "stats": {
      "def": 8,
      "mp": 22,
      "mnd": 2
    },
    "slot": "legs",
    "rarity": "Uncommon",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ]
  },
  {
    "id": 1146,
    "name": "Dusthide Vest",
    "description": "Dusthide Vest. Desiccated hide beaten with grain until it takes a pale nap.",
    "icon": "/icons/items/dusthide-vest.png",
    "slug": "dusthide-vest",
    "kind": "equipment",
    "craftLevel": 22,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 490,
      "materialsText": "Leather×2, Dustgrain×1, Pale Dust×1"
    },
    "stats": {
      "def": 12,
      "agi": 10,
      "hp": 20
    },
    "slot": "body",
    "rarity": "Uncommon",
    "jobRestrict": [
      "rogue"
    ]
  },
  {
    "id": 1147,
    "name": "Dusthide Sandals",
    "description": "Dusthide Sandals. Open sandals for the basin's packed dirt, not the river walls.",
    "icon": "/icons/items/dusthide-sandals.png",
    "slug": "dusthide-sandals",
    "kind": "equipment",
    "craftLevel": 20,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 450,
      "materialsText": "Leather×1, Dustgrain×1, Pale Dust×1"
    },
    "stats": {
      "def": 5,
      "agi": 2,
      "mp": 14
    },
    "slot": "feet",
    "rarity": "Uncommon",
    "jobRestrict": [
      "rogue"
    ]
  },
  {
    "id": 1148,
    "name": "Seam-Glass Ring",
    "description": "Seam-Glass Ring. A pale bead set in a copper hoop; Mayflower goldsmiths sell them by the handful.",
    "icon": "/icons/items/seam-glass-ring.png",
    "slug": "seam-glass-ring",
    "kind": "equipment",
    "craftLevel": 21,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 470,
      "materialsText": "Glass Bead×2, Pale Dust×1"
    },
    "stats": {
      "acc": 3,
      "dex": 2
    },
    "slot": "ring",
    "rarity": "Uncommon"
  },
  {
    "id": 1149,
    "name": "Marrow Stud",
    "description": "Marrow Stud. A polished chip worn through the ear, the marrow line still visible.",
    "icon": "/icons/items/marrow-stud.png",
    "slug": "marrow-stud",
    "kind": "equipment",
    "craftLevel": 23,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 510,
      "materialsText": "Bone Chip×2, Pale Dust×1"
    },
    "stats": {
      "atk": 4,
      "acc": 3,
      "str": 1
    },
    "slot": "earring",
    "rarity": "Rare",
    "jobRestrict": [
      "fighter",
      "rogue"
    ]
  },
  {
    "id": 1150,
    "name": "Kettle Mitts",
    "description": "Kettle Mitts. Camp mitts from Kettle Hollow, ash-linen on the palms.",
    "icon": "/icons/items/kettle-mitts.png",
    "slug": "kettle-mitts",
    "kind": "equipment",
    "craftLevel": 26,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 570,
      "materialsText": "Shade Cotton Thread×2, Shade Cotton×1, Ash Dust×1"
    },
    "stats": {
      "def": 7,
      "mab": 3,
      "mnd": 3
    },
    "slot": "hands",
    "rarity": "Uncommon",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ]
  },
  {
    "id": 1151,
    "name": "Kettle Robe",
    "description": "Kettle Robe. The Forest Basin camp robe, cut short so it does not catch on briar.",
    "icon": "/icons/items/kettle-robe.png",
    "slug": "kettle-robe",
    "kind": "equipment",
    "craftLevel": 27,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 590,
      "materialsText": "Shade Cotton Thread×3, Shade Cotton×1, Ash Dust×1"
    },
    "stats": {
      "def": 14,
      "int": 14,
      "mp": 30,
      "hp": 18
    },
    "slot": "body",
    "rarity": "Uncommon",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ]
  },
  {
    "id": 1152,
    "name": "Briarhide Cap",
    "description": "Briarhide Cap. A low leather cap, thorn-scored, for the basin's understorey.",
    "icon": "/icons/items/briarhide-cap.png",
    "slug": "briarhide-cap",
    "kind": "equipment",
    "craftLevel": 25,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 550,
      "materialsText": "Leather×1, Climbing Cord×1, Ash Dust×1"
    },
    "stats": {
      "def": 7,
      "dex": 3,
      "agi": 2
    },
    "slot": "head",
    "rarity": "Uncommon",
    "jobRestrict": [
      "rogue"
    ]
  },
  {
    "id": 1153,
    "name": "Briarhide Gloves",
    "description": "Briarhide Gloves. Thorn-proof palms the basin scouts swear by.",
    "icon": "/icons/items/briarhide-gloves.png",
    "slug": "briarhide-gloves",
    "kind": "equipment",
    "craftLevel": 27,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 590,
      "materialsText": "Leather×2, Climbing Cord×1, Ash Dust×1"
    },
    "stats": {
      "def": 8,
      "dex": 3,
      "acc": 3
    },
    "slot": "hands",
    "rarity": "Rare",
    "jobRestrict": [
      "rogue"
    ]
  },
  {
    "id": 1154,
    "name": "Reedbone Earring",
    "description": "Reedbone Earring. A hollow reed-bone drop that hums when the Stillmere is near.",
    "icon": "/icons/items/reedbone-earring.png",
    "slug": "reedbone-earring",
    "kind": "equipment",
    "craftLevel": 26,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 570,
      "materialsText": "Bone Chip×1, Insect Wing×1, Ash Dust×1"
    },
    "stats": {
      "mnd": 3,
      "mp": 12,
      "mab": 2
    },
    "slot": "earring",
    "rarity": "Rare"
  },
  {
    "id": 1155,
    "name": "Hollow Signet",
    "description": "Hollow Signet. Ash-glass set with a chip of lapis, the Pale Hollow mark in miniature.",
    "icon": "/icons/items/hollow-signet.png",
    "slug": "hollow-signet",
    "kind": "equipment",
    "craftLevel": 28,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 610,
      "materialsText": "Glass Bead×1, Ash Dust×1, Lapis×1"
    },
    "stats": {
      "int": 3,
      "mab": 2,
      "mp": 8
    },
    "slot": "ring",
    "rarity": "Uncommon"
  },
  {
    "id": 1156,
    "name": "Last-Company Bandana",
    "description": "Last-Company Bandana. The sellswords' brow-cloth, still folded the way the Last Company wore it.",
    "icon": "/icons/items/last-company-bandana.png",
    "slug": "last-company-bandana",
    "kind": "equipment",
    "craftLevel": 29,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 630,
      "materialsText": "Leather×1, Climbing Cord×1, Ash Dust×1"
    },
    "stats": {
      "def": 9,
      "dex": 4,
      "agi": 4,
      "mp": 15
    },
    "slot": "head",
    "rarity": "Legendary",
    "jobRestrict": [
      "rogue",
      "tim"
    ]
  },
  {
    "id": 1157,
    "name": "Last-Company Gloves",
    "description": "Last-Company Gloves. Companion gloves to the Mantle of the Last Company.",
    "icon": "/icons/items/last-company-gloves.png",
    "slug": "last-company-gloves",
    "kind": "equipment",
    "craftLevel": 33,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 710,
      "materialsText": "Leather×2, Climbing Cord×1, Ash Dust×1"
    },
    "stats": {
      "def": 10,
      "dex": 4,
      "acc": 4,
      "agi": 2
    },
    "slot": "hands",
    "rarity": "Legendary",
    "jobRestrict": [
      "rogue",
      "tim"
    ]
  },
  {
    "id": 1158,
    "name": "Last-Company Boots",
    "description": "Last-Company Boots. Road boots that finished the Anvilhold sellsword kit.",
    "icon": "/icons/items/last-company-boots.png",
    "slug": "last-company-boots",
    "kind": "equipment",
    "craftLevel": 34,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 730,
      "materialsText": "Leather×2, Climbing Cord×1, Ash Dust×1"
    },
    "stats": {
      "def": 10,
      "agi": 6,
      "dex": 3,
      "hp": 20
    },
    "slot": "feet",
    "rarity": "Legendary",
    "jobRestrict": [
      "rogue",
      "tim"
    ]
  },
  {
    "id": 1159,
    "name": "Ash-Linen Cowl",
    "description": "Ash-Linen Cowl. A short cowl of ash-linen, the shade-cotton lining still pale.",
    "icon": "/icons/items/ash-linen-cowl.png",
    "slug": "ash-linen-cowl",
    "kind": "equipment",
    "craftLevel": 31,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 670,
      "materialsText": "Shade Cotton Thread×2, Shade Cotton×1, Ash Dust×1"
    },
    "stats": {
      "def": 8,
      "int": 3,
      "mnd": 3,
      "mp": 24
    },
    "slot": "head",
    "rarity": "Uncommon",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ]
  },
  {
    "id": 1160,
    "name": "Ivory Band",
    "description": "Ivory Band. A simple ivory hoop cut from a hilt blank.",
    "icon": "/icons/items/ivory-band.png",
    "slug": "ivory-band",
    "kind": "equipment",
    "craftLevel": 31,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 670,
      "materialsText": "Bone Hilt×1, Bone Chip×1, Ash Dust×1"
    },
    "stats": {
      "str": 2,
      "dex": 3,
      "hp": 10
    },
    "slot": "ring",
    "rarity": "Uncommon",
    "jobRestrict": [
      "fighter",
      "rogue"
    ]
  },
  {
    "id": 1161,
    "name": "Mayflower Ear-Drop",
    "description": "Mayflower Ear-Drop. A short goldsmith's drop Ilse's town hangs from one ear.",
    "icon": "/icons/items/mayflower-chain.png",
    "slug": "mayflower-chain",
    "kind": "equipment",
    "craftLevel": 33,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 710,
      "materialsText": "Glass Bead×1, Lapis×1, Ash Dust×1"
    },
    "stats": {
      "int": 4,
      "mab": 2,
      "mp": 14
    },
    "slot": "earring",
    "rarity": "Rare"
  },
  {
    "id": 1162,
    "name": "Scale Coif",
    "description": "Scale Coif. A hide coif sewn with the first scale scraps off the basin lizards.",
    "icon": "/icons/items/scale-coif.png",
    "slug": "scale-coif",
    "kind": "equipment",
    "craftLevel": 35,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 750,
      "materialsText": "Leather×1, Scale Hide×1, Ash Dust×1"
    },
    "stats": {
      "def": 9,
      "vit": 3,
      "hp": 22
    },
    "slot": "head",
    "rarity": "Uncommon",
    "jobRestrict": [
      "rogue",
      "fighter"
    ]
  },
  {
    "id": 1163,
    "name": "Ashbone Helm",
    "description": "Ashbone Helm. Skull plate bound with ashbeam splints, a Pale Hollow fighting helm.",
    "icon": "/icons/items/ashbone-helm.png",
    "slug": "ashbone-helm",
    "kind": "equipment",
    "craftLevel": 36,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 770,
      "materialsText": "Skull Plate×1, Ashbeam Log×1, Ash Dust×1"
    },
    "stats": {
      "def": 10,
      "dex": 4,
      "acc": 4
    },
    "slot": "head",
    "rarity": "Uncommon",
    "jobRestrict": [
      "fighter",
      "rogue"
    ]
  },
  {
    "id": 1164,
    "name": "Horncloth Hood",
    "description": "Horncloth Hood. A caster's hood, the brim stiffened with shaved horn.",
    "icon": "/icons/items/horncloth-hood.png",
    "slug": "horncloth-hood",
    "kind": "equipment",
    "craftLevel": 37,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 790,
      "materialsText": "Shade Cotton Thread×2, Horn×1, Ash Dust×1"
    },
    "stats": {
      "def": 10,
      "int": 4,
      "mnd": 3,
      "mp": 32
    },
    "slot": "head",
    "rarity": "Rare",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ]
  },
  {
    "id": 1165,
    "name": "Ashbone Gloves",
    "description": "Ashbone Gloves. Ivory finger tubes on hide, the ashbeam stain still in the grain.",
    "icon": "/icons/items/ashbone-gloves.png",
    "slug": "ashbone-gloves",
    "kind": "equipment",
    "craftLevel": 38,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 810,
      "materialsText": "Bone Chip×2, Soft Pelt×1, Ash Dust×1"
    },
    "stats": {
      "def": 9,
      "dex": 4,
      "acc": 4
    },
    "slot": "hands",
    "rarity": "Uncommon",
    "jobRestrict": [
      "fighter",
      "rogue"
    ]
  },
  {
    "id": 1166,
    "name": "Wyrmglass Ring",
    "description": "Wyrmglass Ring. Slag-fired glass that keeps a green cast, set as a caster's hoop.",
    "icon": "/icons/items/wyrmglass-ring.png",
    "slug": "wyrmglass-ring",
    "kind": "equipment",
    "craftLevel": 38,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 810,
      "materialsText": "Glass Bead×1, Slag Dust×1, Lapis×1"
    },
    "stats": {
      "mab": 4,
      "int": 3,
      "mp": 12
    },
    "slot": "ring",
    "rarity": "Rare"
  },
  {
    "id": 1167,
    "name": "Scale Gloves",
    "description": "Scale Gloves. Companion gloves to the Scale Harness, scale on the knuckles.",
    "icon": "/icons/items/scale-gloves.png",
    "slug": "scale-gloves",
    "kind": "equipment",
    "craftLevel": 39,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 830,
      "materialsText": "Leather×2, Scale Hide×1, Ash Dust×1"
    },
    "stats": {
      "def": 10,
      "acc": 4,
      "vit": 3
    },
    "slot": "hands",
    "rarity": "Uncommon",
    "jobRestrict": [
      "rogue",
      "fighter"
    ]
  },
  {
    "id": 1168,
    "name": "Horncloth Cuffs",
    "description": "Horncloth Cuffs. Horn-stiffened cuffs that sit over a caster's wrists.",
    "icon": "/icons/items/horncloth-cuffs.png",
    "slug": "horncloth-cuffs",
    "kind": "equipment",
    "craftLevel": 39,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 830,
      "materialsText": "Shade Cotton Thread×2, Horn×1, Ash Dust×1"
    },
    "stats": {
      "def": 10,
      "mab": 5,
      "mnd": 4
    },
    "slot": "hands",
    "rarity": "Rare",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ]
  },
  {
    "id": 1169,
    "name": "Ivory Studs",
    "description": "Ivory Studs. Goldsmith work with a bone face, sold on Tally Row.",
    "icon": "/icons/items/ivory-studs.png",
    "slug": "ivory-studs",
    "kind": "equipment",
    "craftLevel": 35,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 750,
      "materialsText": "Glass Bead×1, Bone Chip×1, Ash Dust×1"
    },
    "stats": {
      "vit": 2,
      "hp": 12
    },
    "slot": "earring",
    "rarity": "Uncommon"
  },
  {
    "id": 1170,
    "name": "Ashbone Harness",
    "description": "Ashbone Harness. A fighting harness of femur and plate, the ash still in the joins.",
    "icon": "/icons/items/ashbone-harness.png",
    "slug": "ashbone-harness",
    "kind": "equipment",
    "craftLevel": 40,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 850,
      "materialsText": "Giant Femur×1, Skull Plate×1, Ash Dust×1"
    },
    "stats": {
      "def": 28,
      "str": 8,
      "dex": 5,
      "hp": 32
    },
    "slot": "body",
    "rarity": "Epic",
    "jobRestrict": [
      "fighter",
      "rogue"
    ]
  },
  {
    "id": 1171,
    "name": "Coilbone Greaves",
    "description": "Coilbone Greaves. Greaves cut on the Coil, femur splints over hide soles.",
    "icon": "/icons/items/coilbone-greaves.png",
    "slug": "coilbone-greaves",
    "kind": "equipment",
    "craftLevel": 41,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 870,
      "materialsText": "Bone Chip×2, Soft Pelt×1, Slag Dust×1"
    },
    "stats": {
      "def": 11,
      "agi": 4,
      "vit": 3,
      "hp": 24
    },
    "slot": "feet",
    "rarity": "Rare",
    "jobRestrict": [
      "fighter",
      "rogue"
    ]
  },
  {
    "id": 1172,
    "name": "Mayflower Gloves",
    "description": "Mayflower Gloves. Turning Yard gloves, silk over linen, for Ilse's students.",
    "icon": "/icons/items/mayflower-gloves.png",
    "slug": "mayflower-gloves",
    "kind": "equipment",
    "craftLevel": 42,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 890,
      "materialsText": "Silk Thread×2, Linen Cloth×1, Slag Dust×1"
    },
    "stats": {
      "def": 11,
      "mab": 6,
      "mnd": 5
    },
    "slot": "hands",
    "rarity": "Rare",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ]
  },
  {
    "id": 1173,
    "name": "Mayflower Coif",
    "description": "Mayflower Coif. A close coif the Turning Yard issues with the rest of the town kit.",
    "icon": "/icons/items/mayflower-coif.png",
    "slug": "mayflower-coif",
    "kind": "equipment",
    "craftLevel": 43,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 910,
      "materialsText": "Silk Thread×2, Shade Cotton×1, Slag Dust×1"
    },
    "stats": {
      "def": 11,
      "int": 4,
      "mnd": 4,
      "mp": 36
    },
    "slot": "head",
    "rarity": "Rare",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ]
  },
  {
    "id": 1174,
    "name": "Mayflower Hose",
    "description": "Mayflower Hose. Town hose, silk-blend, cut for Mayflower's ramped streets.",
    "icon": "/icons/items/mayflower-hose.png",
    "slug": "mayflower-hose",
    "kind": "equipment",
    "craftLevel": 44,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 930,
      "materialsText": "Silk Thread×2, Linen Cloth×1, Slag Dust×1"
    },
    "stats": {
      "def": 14,
      "mp": 50,
      "mnd": 5
    },
    "slot": "legs",
    "rarity": "Rare",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ]
  },
  {
    "id": 1175,
    "name": "Mayflower Shoes",
    "description": "Mayflower Shoes. Soft shoes for the Turning Yard sand and the street stones after.",
    "icon": "/icons/items/mayflower-shoes.png",
    "slug": "mayflower-shoes",
    "kind": "equipment",
    "craftLevel": 46,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 970,
      "materialsText": "Silk Thread×2, Soft Pelt×1, Slag Dust×1"
    },
    "stats": {
      "def": 12,
      "agi": 4,
      "mp": 55
    },
    "slot": "feet",
    "rarity": "Rare",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ]
  },
  {
    "id": 1176,
    "name": "Scrivener's Earring",
    "description": "Scrivener's Earring. A mythril drop the scriveners of the scarp swore on.",
    "icon": "/icons/items/scriveners-earring.png",
    "slug": "scriveners-earring",
    "kind": "equipment",
    "craftLevel": 46,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 970,
      "materialsText": "Glass Bead×1, Parchment×1, Slag Dust×1"
    },
    "stats": {
      "mnd": 4,
      "int": 3,
      "mp": 16
    },
    "slot": "earring",
    "rarity": "Rare"
  },
  {
    "id": 1177,
    "name": "Seamhide Chaps",
    "description": "Seamhide Chaps. Open-sided chaps of fine leather for Seam Country's long grass.",
    "icon": "/icons/items/seamhide-chaps.png",
    "slug": "seamhide-chaps",
    "kind": "equipment",
    "craftLevel": 47,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 990,
      "materialsText": "Fine Leather×2, Slag Dust×1"
    },
    "stats": {
      "def": 16,
      "agi": 6,
      "hp": 48
    },
    "slot": "legs",
    "rarity": "Rare",
    "jobRestrict": [
      "rogue",
      "fighter"
    ]
  },
  {
    "id": 1178,
    "name": "Lockkeeper's Signet",
    "description": "Lockkeeper's Signet. The lock-wardens' seal in mythril and jadeite, keys still in the cut.",
    "icon": "/icons/items/lockkeeper-signet.png",
    "slug": "lockkeeper-signet",
    "kind": "equipment",
    "craftLevel": 49,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 1030,
      "materialsText": "Mythril Chain×1, Jadeite×1, Slag Dust×1"
    },
    "stats": {
      "mnd": 4,
      "vit": 3,
      "mp": 18,
      "def": 4
    },
    "slot": "ring",
    "rarity": "Epic"
  },
  {
    "id": 1179,
    "name": "Duskweave Hat",
    "description": "Duskweave Hat. A dusk-dyed hat between silk and velvet, for the long climb toward the White Caps.",
    "icon": "/icons/items/duskweave-hat.png",
    "slug": "duskweave-hat",
    "kind": "equipment",
    "craftLevel": 51,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1070,
      "materialsText": "Silk Cloth×1, Silk Thread×1, Slag Dust×1"
    },
    "stats": {
      "def": 13,
      "int": 5,
      "mnd": 4,
      "mp": 42
    },
    "slot": "head",
    "rarity": "Rare",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ]
  },
  {
    "id": 1180,
    "name": "Duskweave Coat",
    "description": "Duskweave Coat. The missing coat between silk and battleweave, dusk-dyed at Mayflower.",
    "icon": "/icons/items/duskweave-coat.png",
    "slug": "duskweave-coat",
    "kind": "equipment",
    "craftLevel": 53,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1110,
      "materialsText": "Silk Cloth×3, Bell Dust×1"
    },
    "stats": {
      "def": 26,
      "int": 26,
      "mp": 56,
      "hp": 32
    },
    "slot": "body",
    "rarity": "Epic",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ]
  },
  {
    "id": 1181,
    "name": "Stillmere Pearl",
    "description": "Stillmere Pearl. A still-water bead the goldsmiths swear came off the mere.",
    "icon": "/icons/items/stillmere-pearl.png",
    "slug": "stillmere-pearl",
    "kind": "equipment",
    "craftLevel": 54,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 1130,
      "materialsText": "Glass Bead×1, Jadeite×1, Slag Dust×1"
    },
    "stats": {
      "mab": 4,
      "mnd": 3,
      "mp": 16
    },
    "slot": "ring",
    "rarity": "Rare"
  },
  {
    "id": 1182,
    "name": "White-Caps Jack",
    "description": "White-Caps Jack. A climbing jack named for the White Caps stair, fine leather packed at the shoulders.",
    "icon": "/icons/items/white-caps-jack.png",
    "slug": "white-caps-jack",
    "kind": "equipment",
    "craftLevel": 55,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1150,
      "materialsText": "Fine Leather×3, Bell Dust×1"
    },
    "stats": {
      "def": 36,
      "str": 9,
      "agi": 8,
      "hp": 48
    },
    "slot": "body",
    "rarity": "Epic",
    "jobRestrict": [
      "rogue",
      "fighter"
    ]
  },
  {
    "id": 1183,
    "name": "White-Caps Gloves",
    "description": "White-Caps Gloves. Companion gloves to the White-Caps Jack.",
    "icon": "/icons/items/white-caps-gloves.png",
    "slug": "white-caps-gloves",
    "kind": "equipment",
    "craftLevel": 57,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1190,
      "materialsText": "Fine Leather×2, Bell Dust×1"
    },
    "stats": {
      "def": 14,
      "acc": 7,
      "dex": 6
    },
    "slot": "hands",
    "rarity": "Epic",
    "jobRestrict": [
      "rogue",
      "fighter"
    ]
  },
  {
    "id": 1184,
    "name": "Marrowforged Ring",
    "description": "Marrowforged Ring. A heavy ivory ring, marrow-dark in the core.",
    "icon": "/icons/items/marrowforged-ring.png",
    "slug": "marrowforged-ring",
    "kind": "equipment",
    "craftLevel": 58,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 1210,
      "materialsText": "Skull Plate×1, Giant Femur×1, Bell Dust×1"
    },
    "stats": {
      "str": 4,
      "atk": 5,
      "hp": 20
    },
    "slot": "ring",
    "rarity": "Epic",
    "jobRestrict": [
      "fighter",
      "rogue"
    ]
  },
  {
    "id": 1185,
    "name": "Duskweave Slacks",
    "description": "Duskweave Slacks. Dusk-dyed slacks that close the set under the coat.",
    "icon": "/icons/items/duskweave-slacks.png",
    "slug": "duskweave-slacks",
    "kind": "equipment",
    "craftLevel": 59,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1230,
      "materialsText": "Silk Cloth×2, Bell Dust×1"
    },
    "stats": {
      "def": 19,
      "mp": 68,
      "int": 6
    },
    "slot": "legs",
    "rarity": "Rare",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ]
  },
  {
    "id": 1186,
    "name": "Skull Harness",
    "description": "Skull Harness. Companion harness to the Skull Bandana, a fighting cage of plate and femur.",
    "icon": "/icons/items/skull-harness.png",
    "slug": "skull-harness",
    "kind": "equipment",
    "craftLevel": 60,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 1250,
      "materialsText": "Skull Plate×2, Giant Femur×1, Bell Dust×1"
    },
    "stats": {
      "def": 34,
      "str": 10,
      "dex": 7,
      "hp": 40
    },
    "slot": "body",
    "rarity": "Legendary",
    "jobRestrict": [
      "fighter",
      "rogue"
    ]
  },
  {
    "id": 1187,
    "name": "Chalkreed Cuffs",
    "description": "Chalkreed Cuffs. Reed-wrapped cuffs chalked at the pool so the flax does not slip the wrist.",
    "icon": "/icons/items/chalkreed-cuffs.png",
    "slug": "chalkreed-cuffs",
    "kind": "equipment",
    "craftLevel": 20,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 450,
      "materialsText": "Linen Cloth×1, Pale Dust×1"
    },
    "stats": {
      "def": 5,
      "mnd": 2,
      "mp": 16
    },
    "slot": "hands",
    "rarity": "Uncommon",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ]
  },
  {
    "id": 1188,
    "name": "Pitstraw Chaps",
    "description": "Pitstraw Chaps. Straw-stuffed chaps for the Ash Pit's packed rims, not the river walls.",
    "icon": "/icons/items/pitstraw-chaps.png",
    "slug": "pitstraw-chaps",
    "kind": "equipment",
    "craftLevel": 21,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 470,
      "materialsText": "Leather×2, Pale Dust×1"
    },
    "stats": {
      "def": 7,
      "agi": 3,
      "hp": 18
    },
    "slot": "legs",
    "rarity": "Uncommon",
    "jobRestrict": [
      "rogue"
    ]
  },
  {
    "id": 1189,
    "name": "Chalk Bead",
    "description": "Chalk Bead. A pale glass drop dusted with chalk, sold at the pool for a handful of copper.",
    "icon": "/icons/items/chalk-bead.png",
    "slug": "chalk-bead",
    "kind": "equipment",
    "craftLevel": 22,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 490,
      "materialsText": "Glass Bead×2, Pale Dust×1"
    },
    "stats": {
      "mnd": 2,
      "mp": 10
    },
    "slot": "earring",
    "rarity": "Uncommon"
  },
  {
    "id": 1190,
    "name": "Riverbone Mitts",
    "description": "Riverbone Mitts. River-smoothed chips bound for the palm, still cool from the ford.",
    "icon": "/icons/items/riverbone-mitts.png",
    "slug": "riverbone-mitts",
    "kind": "equipment",
    "craftLevel": 22,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 490,
      "materialsText": "Bone Chip×2, Pale Dust×1"
    },
    "stats": {
      "def": 6,
      "atk": 2,
      "acc": 2
    },
    "slot": "hands",
    "rarity": "Uncommon",
    "jobRestrict": [
      "fighter",
      "rogue"
    ]
  },
  {
    "id": 1191,
    "name": "Pitstraw Gloves",
    "description": "Pitstraw Gloves. Thin pit-hide gloves, straw at the cuff so grit does not work under the nails.",
    "icon": "/icons/items/pitstraw-gloves.png",
    "slug": "pitstraw-gloves",
    "kind": "equipment",
    "craftLevel": 23,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 510,
      "materialsText": "Leather×1, Pale Dust×1"
    },
    "stats": {
      "def": 6,
      "dex": 2,
      "agi": 2
    },
    "slot": "hands",
    "rarity": "Uncommon",
    "jobRestrict": [
      "rogue"
    ]
  },
  {
    "id": 1192,
    "name": "Sand-Bone Ring",
    "description": "Sand-Bone Ring. A sanded knuckle-bone hoop, pale as the ford's bars.",
    "icon": "/icons/items/sand-bone-ring.png",
    "slug": "sand-bone-ring",
    "kind": "equipment",
    "craftLevel": 24,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 530,
      "materialsText": "Bone Chip×1, Pale Dust×1"
    },
    "stats": {
      "str": 2,
      "hp": 8
    },
    "slot": "ring",
    "rarity": "Uncommon",
    "jobRestrict": [
      "fighter",
      "rogue"
    ]
  },
  {
    "id": 1193,
    "name": "Fordcamp Slops",
    "description": "Fordcamp Slops. Camp slops cut short so they do not drag the ford's silt.",
    "icon": "/icons/items/fordcamp-slops.png",
    "slug": "fordcamp-slops",
    "kind": "equipment",
    "craftLevel": 25,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 550,
      "materialsText": "Shade Cotton Thread×2, Ash Dust×1"
    },
    "stats": {
      "def": 8,
      "mp": 24,
      "mnd": 2
    },
    "slot": "legs",
    "rarity": "Uncommon",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ]
  },
  {
    "id": 1194,
    "name": "Thornreed Vest",
    "description": "Thornreed Vest. A reed-ribbed vest, thorn-scored from the basin's understorey.",
    "icon": "/icons/items/thornreed-vest.png",
    "slug": "thornreed-vest",
    "kind": "equipment",
    "craftLevel": 26,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 570,
      "materialsText": "Leather×2, Climbing Cord×1, Ash Dust×1"
    },
    "stats": {
      "def": 14,
      "agi": 10,
      "hp": 22
    },
    "slot": "body",
    "rarity": "Uncommon",
    "jobRestrict": [
      "rogue"
    ]
  },
  {
    "id": 1195,
    "name": "Camp-Glass Ring",
    "description": "Camp-Glass Ring. Ash-glass from a ford camp fire, set in a thin hoop.",
    "icon": "/icons/items/camp-glass-ring.png",
    "slug": "camp-glass-ring",
    "kind": "equipment",
    "craftLevel": 26,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 570,
      "materialsText": "Glass Bead×1, Ash Dust×1"
    },
    "stats": {
      "acc": 3,
      "dex": 2
    },
    "slot": "ring",
    "rarity": "Uncommon"
  },
  {
    "id": 1196,
    "name": "Reed Greaves",
    "description": "Reed Greaves. Hollow reed-bone greaves that whisper when the Stillmere wind is up.",
    "icon": "/icons/items/reed-greaves.png",
    "slug": "reed-greaves",
    "kind": "equipment",
    "craftLevel": 27,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 590,
      "materialsText": "Bone Chip×2, Insect Wing×1, Ash Dust×1"
    },
    "stats": {
      "def": 9,
      "agi": 3,
      "hp": 16
    },
    "slot": "feet",
    "rarity": "Rare",
    "jobRestrict": [
      "fighter",
      "rogue"
    ]
  },
  {
    "id": 1197,
    "name": "Camp Signet",
    "description": "Camp Signet. A lapis chip in camp-glass, the ford's mark in miniature.",
    "icon": "/icons/items/camp-signet.png",
    "slug": "camp-signet",
    "kind": "equipment",
    "craftLevel": 27,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 590,
      "materialsText": "Glass Bead×1, Lapis×1, Ash Dust×1"
    },
    "stats": {
      "int": 3,
      "mp": 10
    },
    "slot": "ring",
    "rarity": "Uncommon"
  },
  {
    "id": 1198,
    "name": "Cinderflax Slops",
    "description": "Cinderflax Slops. Flax slops smoked over cinder so the ash-road does not show every stain.",
    "icon": "/icons/items/cinderflax-slops.png",
    "slug": "cinderflax-slops",
    "kind": "equipment",
    "craftLevel": 29,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 630,
      "materialsText": "Shade Cotton Thread×2, Shade Cotton×1, Ash Dust×1"
    },
    "stats": {
      "def": 10,
      "mp": 28,
      "mnd": 3
    },
    "slot": "legs",
    "rarity": "Uncommon",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ]
  },
  {
    "id": 1199,
    "name": "Coilhide Chaps",
    "description": "Coilhide Chaps. Hide cut on the coil, wrapped so a briar cannot take the calf.",
    "icon": "/icons/items/coilhide-chaps.png",
    "slug": "coilhide-chaps",
    "kind": "equipment",
    "craftLevel": 31,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 670,
      "materialsText": "Leather×2, Climbing Cord×1, Ash Dust×1"
    },
    "stats": {
      "def": 11,
      "agi": 4,
      "hp": 24
    },
    "slot": "legs",
    "rarity": "Uncommon",
    "jobRestrict": [
      "rogue"
    ]
  },
  {
    "id": 1200,
    "name": "Marrow Hoop",
    "description": "Marrow Hoop. A glass hoop with a marrow-dark core, quiet on the finger.",
    "icon": "/icons/items/marrow-hoop.png",
    "slug": "marrow-hoop",
    "kind": "equipment",
    "craftLevel": 32,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 690,
      "materialsText": "Glass Bead×1, Lapis×1, Ash Dust×1"
    },
    "stats": {
      "mnd": 3,
      "mp": 12
    },
    "slot": "ring",
    "rarity": "Uncommon"
  },
  {
    "id": 1201,
    "name": "Ash-Rib Trousers",
    "description": "Ash-Rib Trousers. Rib-staves smoked in ash, bound as trousers for the pit road.",
    "icon": "/icons/items/ash-rib-trousers.png",
    "slug": "ash-rib-trousers",
    "kind": "equipment",
    "craftLevel": 32,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 690,
      "materialsText": "Bone Chip×2, Horn×1, Ash Dust×1"
    },
    "stats": {
      "def": 12,
      "str": 3,
      "hp": 22
    },
    "slot": "legs",
    "rarity": "Uncommon",
    "jobRestrict": [
      "fighter",
      "rogue"
    ]
  },
  {
    "id": 1202,
    "name": "Cinderflax Cuffs",
    "description": "Cinderflax Cuffs. Cinder-smoked cuffs that keep spell-heat off the wrist.",
    "icon": "/icons/items/cinderflax-cuffs.png",
    "slug": "cinderflax-cuffs",
    "kind": "equipment",
    "craftLevel": 33,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 710,
      "materialsText": "Shade Cotton Thread×2, Ash Dust×1"
    },
    "stats": {
      "def": 8,
      "mab": 3,
      "mnd": 3
    },
    "slot": "hands",
    "rarity": "Uncommon",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ]
  },
  {
    "id": 1203,
    "name": "Ford Bead",
    "description": "Ford Bead. A dark glass drop from the ford's night fires.",
    "icon": "/icons/items/ford-bead.png",
    "slug": "ford-bead",
    "kind": "equipment",
    "craftLevel": 34,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 730,
      "materialsText": "Glass Bead×1, Ash Dust×1"
    },
    "stats": {
      "acc": 3,
      "dex": 2
    },
    "slot": "earring",
    "rarity": "Uncommon"
  },
  {
    "id": 1204,
    "name": "Wicklinen Robe",
    "description": "Wicklinen Robe. A horn-trimmed robe, wick-dyed so the hem reads as lamp-soot after dusk.",
    "icon": "/icons/items/wicklinen-robe.png",
    "slug": "wicklinen-robe",
    "kind": "equipment",
    "craftLevel": 35,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 750,
      "materialsText": "Shade Cotton Thread×3, Horn×1, Ash Dust×1"
    },
    "stats": {
      "def": 18,
      "int": 16,
      "mp": 36,
      "hp": 20
    },
    "slot": "body",
    "rarity": "Rare",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ]
  },
  {
    "id": 1205,
    "name": "Slaghide Boots",
    "description": "Slaghide Boots. Scale-laced boots for slag-road grit, still flexible at the ankle.",
    "icon": "/icons/items/slaghide-boots.png",
    "slug": "slaghide-boots",
    "kind": "equipment",
    "craftLevel": 36,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 770,
      "materialsText": "Leather×1, Scale Hide×1, Ash Dust×1"
    },
    "stats": {
      "def": 10,
      "agi": 3,
      "hp": 18
    },
    "slot": "feet",
    "rarity": "Uncommon",
    "jobRestrict": [
      "rogue"
    ]
  },
  {
    "id": 1206,
    "name": "Slaghide Chaps",
    "description": "Slaghide Chaps. Scale-hide chaps that shed sparks on the slag benches.",
    "icon": "/icons/items/slaghide-chaps.png",
    "slug": "slaghide-chaps",
    "kind": "equipment",
    "craftLevel": 37,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 790,
      "materialsText": "Leather×2, Scale Hide×1, Ash Dust×1"
    },
    "stats": {
      "def": 13,
      "agi": 5,
      "hp": 28
    },
    "slot": "legs",
    "rarity": "Uncommon",
    "jobRestrict": [
      "rogue"
    ]
  },
  {
    "id": 1207,
    "name": "Wicklinen Slops",
    "description": "Wicklinen Slops. Wick-dyed slops, horn-threaded at the hem, for long watches.",
    "icon": "/icons/items/wicklinen-slops.png",
    "slug": "wicklinen-slops",
    "kind": "equipment",
    "craftLevel": 38,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 810,
      "materialsText": "Shade Cotton Thread×2, Horn×1, Ash Dust×1"
    },
    "stats": {
      "def": 13,
      "mp": 40,
      "int": 4
    },
    "slot": "legs",
    "rarity": "Rare",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ]
  },
  {
    "id": 1208,
    "name": "Slag Loop",
    "description": "Slag Loop. Onyx set in slag-glass, a loop the slag-road goldsmiths keep for themselves.",
    "icon": "/icons/items/slag-loop.png",
    "slug": "slag-loop",
    "kind": "equipment",
    "craftLevel": 39,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 830,
      "materialsText": "Glass Bead×1, Onyx×1, Ash Dust×1"
    },
    "stats": {
      "acc": 4,
      "dex": 3,
      "atk": 2
    },
    "slot": "ring",
    "rarity": "Rare"
  },
  {
    "id": 1209,
    "name": "Ember-Glass Ring",
    "description": "Ember-Glass Ring. Ember-tinted glass from Emberwatch, still warm to the look.",
    "icon": "/icons/items/ember-glass-ring.png",
    "slug": "ember-glass-ring",
    "kind": "equipment",
    "craftLevel": 40,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 850,
      "materialsText": "Glass Bead×2, Ash Dust×1"
    },
    "stats": {
      "mab": 3,
      "int": 2,
      "mp": 12
    },
    "slot": "ring",
    "rarity": "Uncommon"
  },
  {
    "id": 1210,
    "name": "Scarp Cowl",
    "description": "Scarp Cowl. A scarp-cut cowl that keeps wind off the face on the high benches.",
    "icon": "/icons/items/scarp-cowl.png",
    "slug": "scarp-cowl",
    "kind": "equipment",
    "craftLevel": 41,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 870,
      "materialsText": "Shade Cotton Thread×2, Slag Dust×1"
    },
    "stats": {
      "def": 12,
      "int": 5,
      "mnd": 4,
      "mp": 36
    },
    "slot": "head",
    "rarity": "Rare",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ]
  },
  {
    "id": 1211,
    "name": "Driftpelt Gloves",
    "description": "Driftpelt Gloves. Pelt gloves from the drift-meadows, palm-soft and wrist-tight.",
    "icon": "/icons/items/driftpelt-gloves.png",
    "slug": "driftpelt-gloves",
    "kind": "equipment",
    "craftLevel": 42,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 890,
      "materialsText": "Fine Leather×1, Slag Dust×1"
    },
    "stats": {
      "def": 11,
      "dex": 5,
      "acc": 4
    },
    "slot": "hands",
    "rarity": "Rare",
    "jobRestrict": [
      "rogue",
      "fighter"
    ]
  },
  {
    "id": 1212,
    "name": "Marshbone Harness",
    "description": "Marshbone Harness. A marsh-bleached rib cage, plate at the breast, for fighters who wade.",
    "icon": "/icons/items/marshbone-harness.png",
    "slug": "marshbone-harness",
    "kind": "equipment",
    "craftLevel": 43,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 910,
      "materialsText": "Skull Plate×1, Bone Chip×2, Slag Dust×1"
    },
    "stats": {
      "def": 22,
      "str": 6,
      "dex": 4,
      "hp": 28
    },
    "slot": "body",
    "rarity": "Rare",
    "jobRestrict": [
      "fighter",
      "rogue"
    ]
  },
  {
    "id": 1213,
    "name": "Driftpelt Boots",
    "description": "Driftpelt Boots. Quiet drift-meadow boots, the pelt still holding rain.",
    "icon": "/icons/items/driftpelt-boots.png",
    "slug": "driftpelt-boots",
    "kind": "equipment",
    "craftLevel": 44,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 930,
      "materialsText": "Fine Leather×1, Slag Dust×1"
    },
    "stats": {
      "def": 12,
      "agi": 5,
      "hp": 22
    },
    "slot": "feet",
    "rarity": "Rare",
    "jobRestrict": [
      "rogue",
      "fighter"
    ]
  },
  {
    "id": 1214,
    "name": "Scarp Cuffs",
    "description": "Scarp Cuffs. Silk-threaded cuffs cut for the scarp wind, not the yard.",
    "icon": "/icons/items/scarp-cuffs.png",
    "slug": "scarp-cuffs",
    "kind": "equipment",
    "craftLevel": 45,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 950,
      "materialsText": "Silk Thread×2, Slag Dust×1"
    },
    "stats": {
      "def": 11,
      "mab": 4,
      "mnd": 4
    },
    "slot": "hands",
    "rarity": "Rare",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ]
  },
  {
    "id": 1215,
    "name": "Marshbone Gloves",
    "description": "Marshbone Gloves. Marsh-bleached knuckle plates, lashed for a wet grip.",
    "icon": "/icons/items/marshbone-gloves.png",
    "slug": "marshbone-gloves",
    "kind": "equipment",
    "craftLevel": 46,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 970,
      "materialsText": "Bone Chip×2, Skull Plate×1, Slag Dust×1"
    },
    "stats": {
      "def": 12,
      "atk": 4,
      "acc": 4
    },
    "slot": "hands",
    "rarity": "Rare",
    "jobRestrict": [
      "fighter",
      "rogue"
    ]
  },
  {
    "id": 1216,
    "name": "Tally Loop",
    "description": "Tally Loop. A lapis loop the Tally Row scribes wear while they count the yard.",
    "icon": "/icons/items/tally-loop.png",
    "slug": "tally-loop",
    "kind": "equipment",
    "craftLevel": 47,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 990,
      "materialsText": "Glass Bead×1, Lapis×1, Slag Dust×1"
    },
    "stats": {
      "acc": 5,
      "dex": 3,
      "hp": 12
    },
    "slot": "ring",
    "rarity": "Rare"
  },
  {
    "id": 1217,
    "name": "Scarp Hose",
    "description": "Scarp Hose. Silk hose for the scarp benches, hemmed so they do not catch stone.",
    "icon": "/icons/items/scarp-hose.png",
    "slug": "scarp-hose",
    "kind": "equipment",
    "craftLevel": 47,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 990,
      "materialsText": "Silk Cloth×2, Slag Dust×1"
    },
    "stats": {
      "def": 16,
      "mp": 52,
      "int": 5
    },
    "slot": "legs",
    "rarity": "Rare",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ]
  },
  {
    "id": 1218,
    "name": "Saltjack Cap",
    "description": "Saltjack Cap. A salt-stiff cap from the White Caps shore, brim cut against spray.",
    "icon": "/icons/items/saltjack-cap.png",
    "slug": "saltjack-cap",
    "kind": "equipment",
    "craftLevel": 51,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1070,
      "materialsText": "Fine Leather×1, Bell Dust×1"
    },
    "stats": {
      "def": 16,
      "dex": 6,
      "agi": 5
    },
    "slot": "head",
    "rarity": "Epic",
    "jobRestrict": [
      "rogue",
      "fighter"
    ]
  },
  {
    "id": 1219,
    "name": "Ember Studs",
    "description": "Ember Studs. Paired ember-glass studs, small enough to forget until the light hits.",
    "icon": "/icons/items/ember-studs.png",
    "slug": "ember-studs",
    "kind": "equipment",
    "craftLevel": 51,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 1070,
      "materialsText": "Glass Bead×1, Onyx×1, Bell Dust×1"
    },
    "stats": {
      "mab": 3,
      "int": 2
    },
    "slot": "earring",
    "rarity": "Uncommon"
  },
  {
    "id": 1220,
    "name": "Saltjack Boots",
    "description": "Saltjack Boots. Shore boots, salt-cured, for the spray-line paths above the mere.",
    "icon": "/icons/items/saltjack-boots.png",
    "slug": "saltjack-boots",
    "kind": "equipment",
    "craftLevel": 53,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1110,
      "materialsText": "Fine Leather×1, Bell Dust×1"
    },
    "stats": {
      "def": 16,
      "agi": 6,
      "hp": 28
    },
    "slot": "feet",
    "rarity": "Epic",
    "jobRestrict": [
      "rogue",
      "fighter"
    ]
  },
  {
    "id": 1221,
    "name": "Mere Loop",
    "description": "Mere Loop. A still-water loop, lapis pale as the mere at first light.",
    "icon": "/icons/items/mere-loop.png",
    "slug": "mere-loop",
    "kind": "equipment",
    "craftLevel": 55,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 1150,
      "materialsText": "Glass Bead×1, Lapis×1, Bell Dust×1"
    },
    "stats": {
      "mnd": 5,
      "mp": 20,
      "mab": 3
    },
    "slot": "ring",
    "rarity": "Rare"
  },
  {
    "id": 1222,
    "name": "Crownbone Gloves",
    "description": "Crownbone Gloves. Knuckle plates from a crown of femur, the marrow line still gold-dark.",
    "icon": "/icons/items/crownbone-gloves.png",
    "slug": "crownbone-gloves",
    "kind": "equipment",
    "craftLevel": 56,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 1170,
      "materialsText": "Skull Plate×1, Giant Femur×1, Bell Dust×1"
    },
    "stats": {
      "def": 16,
      "str": 6,
      "atk": 6,
      "acc": 5
    },
    "slot": "hands",
    "rarity": "Legendary",
    "jobRestrict": [
      "fighter",
      "rogue"
    ]
  },
  {
    "id": 1223,
    "name": "Nighweave Gloves",
    "description": "Nighweave Gloves. Night-dyed silk gloves, thin enough to feel a page, thick enough for cold.",
    "icon": "/icons/items/nighweave-gloves.png",
    "slug": "nighweave-gloves",
    "kind": "equipment",
    "craftLevel": 57,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1190,
      "materialsText": "Silk Cloth×1, Silk Thread×1, Bell Dust×1"
    },
    "stats": {
      "def": 13,
      "mab": 5,
      "int": 5
    },
    "slot": "hands",
    "rarity": "Rare",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ]
  },
  {
    "id": 1224,
    "name": "Nighweave Pumps",
    "description": "Nighweave Pumps. Night-dyed pumps that make no sound on the yard's boards.",
    "icon": "/icons/items/nighweave-pumps.png",
    "slug": "nighweave-pumps",
    "kind": "equipment",
    "craftLevel": 58,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1210,
      "materialsText": "Silk Cloth×1, Bell Dust×1"
    },
    "stats": {
      "def": 14,
      "mp": 48,
      "agi": 3
    },
    "slot": "feet",
    "rarity": "Rare",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ]
  },
  {
    "id": 1225,
    "name": "Crownbone Greaves",
    "description": "Crownbone Greaves. Shin cages of crown-femur, heavy enough to plant a stance.",
    "icon": "/icons/items/crownbone-greaves.png",
    "slug": "crownbone-greaves",
    "kind": "equipment",
    "craftLevel": 59,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 1230,
      "materialsText": "Skull Plate×1, Giant Femur×1, Bell Dust×1"
    },
    "stats": {
      "def": 18,
      "str": 6,
      "agi": 4,
      "hp": 32
    },
    "slot": "feet",
    "rarity": "Legendary",
    "jobRestrict": [
      "fighter",
      "rogue"
    ]
  },
  {
    "id": 1226,
    "name": "Saltjack Chaps",
    "description": "Saltjack Chaps. Salt-cured chaps that close the shore kit, still supple at the knee.",
    "icon": "/icons/items/saltjack-chaps.png",
    "slug": "saltjack-chaps",
    "kind": "equipment",
    "craftLevel": 60,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1250,
      "materialsText": "Fine Leather×2, Bell Dust×1"
    },
    "stats": {
      "def": 22,
      "agi": 8,
      "hp": 40
    },
    "slot": "legs",
    "rarity": "Epic",
    "jobRestrict": [
      "rogue",
      "fighter"
    ]
  },
  {
    "id": 1227,
    "name": "Orichalcum Helm",
    "description": "Orichalcum Helm. Epic knight helm, gold plate with a closed visor.",
    "icon": "/icons/items/orichalcum-helm.png",
    "slug": "orichalcum-helm",
    "kind": "equipment",
    "craftLevel": 82,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1690,
      "materialsText": "Orichalcum Ingot×1, Marble Chip×1, Throne Dust×1"
    },
    "stats": {
      "def": 18,
      "vit": 8,
      "hp": 80
    },
    "slot": "head",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Epic"
  },
  {
    "id": 1228,
    "name": "Orichalcum Breastplate",
    "description": "Orichalcum Breastplate. Epic knight body, gold plate over a darksteel rib.",
    "icon": "/icons/items/orichalcum-breastplate.png",
    "slug": "orichalcum-breastplate",
    "kind": "equipment",
    "craftLevel": 84,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1730,
      "materialsText": "Orichalcum Ingot×3, Darksteel Nail×1, Throne Dust×1"
    },
    "stats": {
      "def": 52,
      "vit": 18,
      "hp": 72
    },
    "slot": "body",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Epic"
  },
  {
    "id": 1229,
    "name": "Orichalcum Mittens",
    "description": "Orichalcum Mittens. Epic knight hands, gold fingers with a steel rivet.",
    "icon": "/icons/items/orichalcum-mittens.png",
    "slug": "orichalcum-mittens",
    "kind": "equipment",
    "craftLevel": 83,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1710,
      "materialsText": "Orichalcum Ingot×1, Marble Chip×1, Throne Dust×1"
    },
    "stats": {
      "def": 18,
      "vit": 8,
      "acc": 8
    },
    "slot": "hands",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Epic"
  },
  {
    "id": 1230,
    "name": "Orichalcum Cuisses",
    "description": "Orichalcum Cuisses. Epic knight legs, gold plate over the thigh.",
    "icon": "/icons/items/orichalcum-cuisses.png",
    "slug": "orichalcum-cuisses",
    "kind": "equipment",
    "craftLevel": 85,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1750,
      "materialsText": "Orichalcum Ingot×2, Marble Chip×1, Throne Dust×1"
    },
    "stats": {
      "def": 26,
      "vit": 9,
      "hp": 88
    },
    "slot": "legs",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Epic"
  },
  {
    "id": 1231,
    "name": "Orichalcum Sabatons",
    "description": "Orichalcum Sabatons. Epic knight feet, gold vamp with steel rivets.",
    "icon": "/icons/items/orichalcum-sabatons.png",
    "slug": "orichalcum-sabatons",
    "kind": "equipment",
    "craftLevel": 86,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1770,
      "materialsText": "Orichalcum Ingot×2, Marble Chip×1, Throne Dust×1"
    },
    "stats": {
      "def": 18,
      "vit": 8,
      "agi": 7
    },
    "slot": "feet",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Epic"
  },
  {
    "id": 1232,
    "name": "Iron Mace",
    "description": "Iron Mace. A parish club of iron, heavier than the ashbeam stock.",
    "icon": "/icons/items/iron-mace.png",
    "slug": "iron-mace",
    "kind": "equipment",
    "craftLevel": 28,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 610,
      "materialsText": "Iron Ingot×2, Ashbeam Lumber×1, Ash Dust×1"
    },
    "stats": {
      "atk": 25,
      "mnd": 7
    },
    "delayMs": 2400,
    "slot": "main",
    "jobRestrict": [
      "cleric"
    ],
    "weaponFamily": "club",
    "rarity": "Common"
  },
  {
    "id": 1233,
    "name": "Mythril Mace",
    "description": "Mythril Mace. A pale-metal club for the Mayflower chapel.",
    "icon": "/icons/items/mythril-mace.png",
    "slug": "mythril-mace",
    "kind": "equipment",
    "craftLevel": 54,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 1130,
      "materialsText": "Mythril Ingot×2, Bloodbeam Lumber×1, Slag Dust×1"
    },
    "stats": {
      "atk": 32,
      "mnd": 9
    },
    "delayMs": 2400,
    "slot": "main",
    "jobRestrict": [
      "cleric"
    ],
    "weaponFamily": "club",
    "rarity": "Rare"
  },
  {
    "id": 1234,
    "name": "Orichalcum Mace",
    "description": "Orichalcum Mace. The gold head fitted to a bellwood haft.",
    "icon": "/icons/items/orichalcum-mace.png",
    "slug": "orichalcum-mace",
    "kind": "equipment",
    "craftLevel": 86,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1770,
      "materialsText": "Orichalcum Mace Head×1, Bellwood Lumber×1, Throne Dust×1"
    },
    "stats": {
      "atk": 40,
      "mnd": 11
    },
    "delayMs": 2400,
    "slot": "main",
    "jobRestrict": [
      "cleric"
    ],
    "weaponFamily": "club",
    "rarity": "Epic"
  },
  {
    "id": 1235,
    "name": "Palace Cudgel",
    "description": "Palace Cudgel. Legendary cleric club, a gold head on a dark haft.",
    "icon": "/icons/items/palace-cudgel.png",
    "slug": "palace-cudgel",
    "kind": "equipment",
    "craftLevel": 96,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1970,
      "materialsText": "Orichalcum Ingot×2, Bellwood Lumber×1, Throne Dust×1"
    },
    "stats": {
      "atk": 44,
      "mnd": 12
    },
    "delayMs": 2400,
    "slot": "main",
    "jobRestrict": [
      "cleric"
    ],
    "weaponFamily": "club",
    "rarity": "Legendary"
  },
  {
    "id": 1236,
    "name": "Ringweave Cowl",
    "description": "Ringweave Cowl. A druid's cowl, the hem worked with henge-ring stitch.",
    "icon": "/icons/items/ringweave-cowl.png",
    "slug": "ringweave-cowl",
    "kind": "equipment",
    "craftLevel": 66,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1370,
      "materialsText": "Velvet Cloth×1, Bell Dust×1"
    },
    "stats": {
      "def": 15,
      "mnd": 6,
      "mp": 70
    },
    "slot": "head",
    "jobRestrict": [
      "druid"
    ],
    "rarity": "Rare"
  },
  {
    "id": 1237,
    "name": "Ringweave Robe",
    "description": "Ringweave Robe. Rare druid body cloth, MND-cut between silk and velvet.",
    "icon": "/icons/items/ringweave-robe.png",
    "slug": "ringweave-robe",
    "kind": "equipment",
    "craftLevel": 68,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1410,
      "materialsText": "Velvet Cloth×3, Bell Dust×1"
    },
    "stats": {
      "def": 28,
      "mnd": 22,
      "mp": 58,
      "hp": 30
    },
    "slot": "body",
    "jobRestrict": [
      "druid"
    ],
    "rarity": "Rare"
  },
  {
    "id": 1238,
    "name": "Ringweave Wraps",
    "description": "Ringweave Wraps. Druid hands, a wrap of ring-stitched velvet.",
    "icon": "/icons/items/ringweave-wraps.png",
    "slug": "ringweave-wraps",
    "kind": "equipment",
    "craftLevel": 70,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1450,
      "materialsText": "Velvet Cloth×1, Bell Dust×1"
    },
    "stats": {
      "def": 15,
      "mab": 7,
      "mnd": 6
    },
    "slot": "hands",
    "jobRestrict": [
      "druid"
    ],
    "rarity": "Rare"
  },
  {
    "id": 1239,
    "name": "Ringweave Slops",
    "description": "Ringweave Slops. Druid legs, the same ring stitch down the seam.",
    "icon": "/icons/items/ringweave-slops.png",
    "slug": "ringweave-slops",
    "kind": "equipment",
    "craftLevel": 72,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1490,
      "materialsText": "Velvet Cloth×2, Bell Dust×1"
    },
    "stats": {
      "def": 22,
      "mp": 70,
      "mnd": 7
    },
    "slot": "legs",
    "jobRestrict": [
      "druid"
    ],
    "rarity": "Rare"
  },
  {
    "id": 1240,
    "name": "Ringweave Sandals",
    "description": "Ringweave Sandals. Druid feet, a soft sole under ringweave straps.",
    "icon": "/icons/items/ringweave-sandals.png",
    "slug": "ringweave-sandals",
    "kind": "equipment",
    "craftLevel": 74,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1530,
      "materialsText": "Velvet Cloth×1, Bell Dust×1"
    },
    "stats": {
      "def": 16,
      "agi": 5,
      "mp": 80
    },
    "slot": "feet",
    "jobRestrict": [
      "druid"
    ],
    "rarity": "Rare"
  },
  {
    "id": 1241,
    "name": "Orichalcum War Sword",
    "description": "Orichalcum War Sword. Epic fighter one-hander, a gold blade with a steel fuller.",
    "icon": "/icons/items/orichalcum-war-sword.png",
    "slug": "orichalcum-war-sword",
    "kind": "equipment",
    "craftLevel": 82,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1690,
      "materialsText": "Orichalcum Ingot×2, Bellwood Lumber×1, Throne Dust×1"
    },
    "stats": {
      "atk": 40,
      "str": 11
    },
    "delayMs": 2400,
    "slot": "main",
    "jobRestrict": [
      "fighter"
    ],
    "weaponFamily": "sword",
    "rarity": "Epic"
  },
  {
    "id": 1242,
    "name": "Bronze Shortsword",
    "description": "Bronze Shortsword. A rogue's short blade, copper edge on a leather grip.",
    "icon": "/icons/items/bronze-shortsword.png",
    "slug": "bronze-shortsword",
    "kind": "equipment",
    "craftLevel": 11,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 270,
      "materialsText": "Bronze Ingot×2, Ashbeam Lumber×1, Pale Dust×1"
    },
    "stats": {
      "atk": 7,
      "dex": 3,
      "str": 1
    },
    "delayMs": 2400,
    "slot": "main",
    "jobRestrict": [
      "rogue"
    ],
    "weaponFamily": "sword",
    "rarity": "Common"
  },
  {
    "id": 1243,
    "name": "Steel Shortsword",
    "description": "Steel Shortsword. Uncommon rogue one-hander, a short steel blade.",
    "icon": "/icons/items/steel-shortsword.png",
    "slug": "steel-shortsword",
    "kind": "equipment",
    "craftLevel": 38,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 810,
      "materialsText": "Steel Ingot×2, Ashbeam Lumber×1, Slag Dust×1"
    },
    "stats": {
      "atk": 17,
      "dex": 5,
      "str": 2
    },
    "delayMs": 2400,
    "slot": "main",
    "jobRestrict": [
      "rogue"
    ],
    "weaponFamily": "sword",
    "rarity": "Uncommon"
  },
  {
    "id": 1244,
    "name": "Mythril Shortsword",
    "description": "Mythril Shortsword. Rare rogue one-hander, a pale short blade.",
    "icon": "/icons/items/mythril-shortsword.png",
    "slug": "mythril-shortsword",
    "kind": "equipment",
    "craftLevel": 55,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 1150,
      "materialsText": "Mythril Ingot×2, Bloodbeam Lumber×1, Slag Dust×1"
    },
    "stats": {
      "atk": 25,
      "dex": 8,
      "str": 3
    },
    "delayMs": 2400,
    "slot": "main",
    "jobRestrict": [
      "rogue"
    ],
    "weaponFamily": "sword",
    "rarity": "Rare"
  },
  {
    "id": 1245,
    "name": "Bronze Kris",
    "description": "Bronze Kris. A battle-mage's wavy short blade, copper on leather.",
    "icon": "/icons/items/bronze-kris.png",
    "slug": "bronze-kris",
    "kind": "equipment",
    "craftLevel": 14,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 330,
      "materialsText": "Bronze Ingot×1, Leather×1, Pale Dust×1"
    },
    "stats": {
      "atk": 8,
      "int": 2,
      "dex": 2
    },
    "delayMs": 1800,
    "slot": "main",
    "jobRestrict": [
      "battlemage"
    ],
    "weaponFamily": "dagger",
    "rarity": "Common"
  },
  {
    "id": 1246,
    "name": "Mythril Kris",
    "description": "Mythril Kris. Rare battle-mage dagger, a pale wavy edge.",
    "icon": "/icons/items/mythril-kris.png",
    "slug": "mythril-kris",
    "kind": "equipment",
    "craftLevel": 51,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 1070,
      "materialsText": "Mythril Ingot×1, Fine Leather×1, Slag Dust×1"
    },
    "stats": {
      "atk": 22,
      "int": 5,
      "dex": 4
    },
    "delayMs": 1800,
    "slot": "main",
    "jobRestrict": [
      "battlemage"
    ],
    "weaponFamily": "dagger",
    "rarity": "Rare"
  },
  {
    "id": 1247,
    "name": "Ashbone Trousers",
    "description": "Ashbone Trousers. Femur splints on hide, the ash still in the grain.",
    "icon": "/icons/items/ashbone-trousers.png",
    "slug": "ashbone-trousers",
    "kind": "equipment",
    "craftLevel": 41,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 870,
      "materialsText": "Giant Femur×1, Soft Pelt×1, Slag Dust×1"
    },
    "stats": {
      "def": 14,
      "agi": 5,
      "hp": 42
    },
    "slot": "legs",
    "jobRestrict": [
      "fighter",
      "rogue"
    ],
    "rarity": "Uncommon"
  },
  {
    "id": 1248,
    "name": "Ashbone Boots",
    "description": "Ashbone Boots. Hide soles under femur caps, stained from the ashbeam.",
    "icon": "/icons/items/ashbone-boots.png",
    "slug": "ashbone-boots",
    "kind": "equipment",
    "craftLevel": 42,
    "craftSkill": "bonecraft",
    "recipe": {
      "gold": 890,
      "materialsText": "Bone Chip×2, Soft Pelt×1, Slag Dust×1"
    },
    "stats": {
      "def": 11,
      "agi": 4,
      "dex": 3,
      "hp": 22
    },
    "slot": "feet",
    "jobRestrict": [
      "fighter",
      "rogue"
    ],
    "rarity": "Uncommon"
  },
  {
    "id": 1249,
    "name": "Duskweave Cuffs",
    "description": "Duskweave Cuffs. Companion cuffs to the Duskweave Coat.",
    "icon": "/icons/items/duskweave-cuffs.png",
    "slug": "duskweave-cuffs",
    "kind": "equipment",
    "craftLevel": 55,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1150,
      "materialsText": "Silk Cloth×1, Bell Dust×1"
    },
    "stats": {
      "def": 13,
      "mab": 7,
      "mnd": 5
    },
    "slot": "hands",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Rare"
  },
  {
    "id": 1250,
    "name": "Duskweave Pumps",
    "description": "Duskweave Pumps. Soft soles dyed with the duskweave coat.",
    "icon": "/icons/items/duskweave-pumps.png",
    "slug": "duskweave-pumps",
    "kind": "equipment",
    "craftLevel": 57,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1190,
      "materialsText": "Silk Cloth×1, Bell Dust×1"
    },
    "stats": {
      "def": 14,
      "agi": 5,
      "mp": 72
    },
    "slot": "feet",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Rare"
  },
  {
    "id": 1251,
    "name": "Last-Company Trousers",
    "description": "Last-Company Trousers. Sellsword legs that finish the Anvilhold kit.",
    "icon": "/icons/items/last-company-trousers.png",
    "slug": "last-company-trousers",
    "kind": "equipment",
    "craftLevel": 31,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 670,
      "materialsText": "Leather×2, Climbing Cord×1, Ash Dust×1"
    },
    "stats": {
      "def": 14,
      "agi": 5,
      "dex": 4,
      "hp": 28
    },
    "slot": "legs",
    "jobRestrict": [
      "rogue",
      "tim"
    ],
    "rarity": "Legendary"
  },
  {
    "id": 1252,
    "name": "Horncloth Robe",
    "description": "Horncloth Robe. Caster body cloth, the weave stiffened with shaved horn.",
    "icon": "/icons/items/horncloth-robe.png",
    "slug": "horncloth-robe",
    "kind": "equipment",
    "craftLevel": 40,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 850,
      "materialsText": "Shade Cotton Thread×3, Horn×1, Ash Dust×1"
    },
    "stats": {
      "def": 20,
      "int": 18,
      "mp": 40,
      "hp": 22
    },
    "slot": "body",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Rare"
  },
  {
    "id": 1253,
    "name": "Horncloth Slops",
    "description": "Horncloth Slops. Companion legs to the Horncloth Hood.",
    "icon": "/icons/items/horncloth-slops.png",
    "slug": "horncloth-slops",
    "kind": "equipment",
    "craftLevel": 41,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 870,
      "materialsText": "Shade Cotton Thread×2, Horn×1, Ash Dust×1"
    },
    "stats": {
      "def": 14,
      "mp": 44,
      "mnd": 4
    },
    "slot": "legs",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Rare"
  },
  {
    "id": 1254,
    "name": "Horncloth Socks",
    "description": "Horncloth Socks. Soft feet, a horn bead at each ankle.",
    "icon": "/icons/items/horncloth-socks.png",
    "slug": "horncloth-socks",
    "kind": "equipment",
    "craftLevel": 43,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 910,
      "materialsText": "Shade Cotton Thread×1, Horn×1, Ash Dust×1"
    },
    "stats": {
      "def": 11,
      "agi": 3,
      "mp": 48
    },
    "slot": "feet",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Rare"
  },
  {
    "name": "Seedcloth Cowl",
    "description": "Seedcloth Cowl. Cut for Reach benches at this rank.",
    "icon": "/icons/items/seedcloth-cowl.png",
    "slug": "seedcloth-cowl",
    "kind": "equipment",
    "craftLevel": 1,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 70,
      "materialsText": "Linen Cloth×2, Pale Dust×1"
    },
    "stats": {
      "def": 5,
      "mnd": 2,
      "mp": 12
    },
    "slot": "head",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Uncommon",
    "id": 1255
  },
  {
    "name": "Palecloth Cowl",
    "description": "Palecloth Cowl. Cut for Reach benches at this rank.",
    "icon": "/icons/items/palecloth-cowl.png",
    "slug": "palecloth-cowl",
    "kind": "equipment",
    "craftLevel": 2,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 90,
      "materialsText": "Linen Cloth×2, Pale Dust×1"
    },
    "stats": {
      "def": 5,
      "mnd": 2,
      "mp": 12
    },
    "slot": "head",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Uncommon",
    "id": 1256
  },
  {
    "name": "Flaxcord Cowl",
    "description": "Flaxcord Cowl. Cut for Reach benches at this rank.",
    "icon": "/icons/items/flaxcord-cowl.png",
    "slug": "flaxcord-cowl",
    "kind": "equipment",
    "craftLevel": 3,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 110,
      "materialsText": "Linen Cloth×2, Pale Dust×1"
    },
    "stats": {
      "def": 5,
      "mnd": 2,
      "mp": 12
    },
    "slot": "head",
    "jobRestrict": [
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Uncommon",
    "id": 1257
  },
  {
    "name": "Rivetmail Helm",
    "description": "Rivetmail Helm. Cut for Reach benches at this rank.",
    "icon": "/icons/items/rivetmail-helm.png",
    "slug": "rivetmail-helm",
    "kind": "equipment",
    "craftLevel": 4,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 130,
      "materialsText": "Bronze Ingot×2, Pale Dust×1"
    },
    "stats": {
      "def": 8,
      "vit": 2,
      "hp": 16
    },
    "slot": "head",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Uncommon",
    "id": 1258
  },
  {
    "name": "Copperbind Helm",
    "description": "Copperbind Helm. Cut for Reach benches at this rank.",
    "icon": "/icons/items/copperbind-helm.png",
    "slug": "copperbind-helm",
    "kind": "equipment",
    "craftLevel": 5,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 150,
      "materialsText": "Bronze Ingot×2, Pale Dust×1"
    },
    "stats": {
      "def": 8,
      "vit": 2,
      "hp": 16
    },
    "slot": "head",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Common",
    "id": 1259
  },
  {
    "name": "Pitcord Cap",
    "description": "Pitcord Cap. Cut for Reach benches at this rank.",
    "icon": "/icons/items/pitcord-cap.png",
    "slug": "pitcord-cap",
    "kind": "equipment",
    "craftLevel": 6,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 170,
      "materialsText": "Leather×2, Pale Dust×1"
    },
    "stats": {
      "def": 6,
      "agi": 2,
      "dex": 2
    },
    "slot": "head",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Uncommon",
    "id": 1260
  },
  {
    "name": "Dustcord Cap",
    "description": "Dustcord Cap. Cut for Reach benches at this rank.",
    "icon": "/icons/items/dustcord-cap.png",
    "slug": "dustcord-cap",
    "kind": "equipment",
    "craftLevel": 7,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 190,
      "materialsText": "Leather×2, Pale Dust×1"
    },
    "stats": {
      "def": 6,
      "agi": 2,
      "dex": 2
    },
    "slot": "head",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Uncommon",
    "id": 1261
  },
  {
    "name": "Ashcord Cap",
    "description": "Ashcord Cap. Cut for Reach benches at this rank.",
    "icon": "/icons/items/ashcord-cap.png",
    "slug": "ashcord-cap",
    "kind": "equipment",
    "craftLevel": 8,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 210,
      "materialsText": "Leather×2, Pale Dust×1"
    },
    "stats": {
      "def": 6,
      "agi": 2,
      "dex": 2
    },
    "slot": "head",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Uncommon",
    "id": 1262
  },
  {
    "name": "Seedcloth Robe",
    "description": "Seedcloth Robe. Cut for Reach benches at this rank.",
    "icon": "/icons/items/seedcloth-robe.png",
    "slug": "seedcloth-robe",
    "kind": "equipment",
    "craftLevel": 1,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 70,
      "materialsText": "Linen Cloth×3, Pale Dust×1"
    },
    "stats": {
      "def": 10,
      "mnd": 2,
      "mp": 12,
      "hp": 12,
      "int": 2
    },
    "slot": "body",
    "jobRestrict": [
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Uncommon",
    "id": 1263
  },
  {
    "name": "Palecloth Robe",
    "description": "Palecloth Robe. Cut for Reach benches at this rank.",
    "icon": "/icons/items/palecloth-robe.png",
    "slug": "palecloth-robe",
    "kind": "equipment",
    "craftLevel": 2,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 90,
      "materialsText": "Linen Cloth×3, Pale Dust×1"
    },
    "stats": {
      "def": 11,
      "mnd": 2,
      "mp": 12,
      "hp": 12,
      "int": 2
    },
    "slot": "body",
    "jobRestrict": [
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Uncommon",
    "id": 1264
  },
  {
    "name": "Flaxcord Robe",
    "description": "Flaxcord Robe. Cut for Reach benches at this rank.",
    "icon": "/icons/items/flaxcord-robe.png",
    "slug": "flaxcord-robe",
    "kind": "equipment",
    "craftLevel": 3,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 110,
      "materialsText": "Linen Cloth×3, Pale Dust×1"
    },
    "stats": {
      "def": 11,
      "mnd": 2,
      "mp": 12,
      "hp": 12,
      "int": 2
    },
    "slot": "body",
    "jobRestrict": [
      "sorcerer",
      "druid"
    ],
    "rarity": "Uncommon",
    "id": 1265
  },
  {
    "name": "Rivetmail Mail",
    "description": "Rivetmail Mail. Cut for Reach benches at this rank.",
    "icon": "/icons/items/rivetmail-mail.png",
    "slug": "rivetmail-mail",
    "kind": "equipment",
    "craftLevel": 4,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 130,
      "materialsText": "Bronze Ingot×3, Pale Dust×1"
    },
    "stats": {
      "def": 14,
      "vit": 2,
      "hp": 16
    },
    "slot": "body",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Uncommon",
    "id": 1266
  },
  {
    "name": "Copperbind Mail",
    "description": "Copperbind Mail. Cut for Reach benches at this rank.",
    "icon": "/icons/items/copperbind-mail.png",
    "slug": "copperbind-mail",
    "kind": "equipment",
    "craftLevel": 5,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 150,
      "materialsText": "Bronze Ingot×3, Pale Dust×1"
    },
    "stats": {
      "def": 14,
      "vit": 2,
      "hp": 16
    },
    "slot": "body",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Common",
    "id": 1267
  },
  {
    "name": "Ironbind Mail",
    "description": "Ironbind Mail. Cut for Reach benches at this rank.",
    "icon": "/icons/items/ironbind-mail.png",
    "slug": "ironbind-mail",
    "kind": "equipment",
    "craftLevel": 6,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 170,
      "materialsText": "Bronze Ingot×3, Pale Dust×1"
    },
    "stats": {
      "def": 15,
      "vit": 2,
      "hp": 16
    },
    "slot": "body",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Common",
    "id": 1268
  },
  {
    "name": "Pitcord Vest",
    "description": "Pitcord Vest. Cut for Reach benches at this rank.",
    "icon": "/icons/items/pitcord-vest.png",
    "slug": "pitcord-vest",
    "kind": "equipment",
    "craftLevel": 7,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 190,
      "materialsText": "Leather×3, Pale Dust×1"
    },
    "stats": {
      "def": 13,
      "agi": 2,
      "dex": 2,
      "hp": 14
    },
    "slot": "body",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Uncommon",
    "id": 1269
  },
  {
    "name": "Dustcord Vest",
    "description": "Dustcord Vest. Cut for Reach benches at this rank.",
    "icon": "/icons/items/dustcord-vest.png",
    "slug": "dustcord-vest",
    "kind": "equipment",
    "craftLevel": 8,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 210,
      "materialsText": "Leather×3, Pale Dust×1"
    },
    "stats": {
      "def": 13,
      "agi": 2,
      "dex": 2,
      "hp": 14
    },
    "slot": "body",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Uncommon",
    "id": 1270
  },
  {
    "name": "Seedcloth Cuffs",
    "description": "Seedcloth Cuffs. Cut for Reach benches at this rank.",
    "icon": "/icons/items/seedcloth-cuffs.png",
    "slug": "seedcloth-cuffs",
    "kind": "equipment",
    "craftLevel": 1,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 70,
      "materialsText": "Linen Cloth×2, Pale Dust×1"
    },
    "stats": {
      "def": 5,
      "mnd": 2,
      "mab": 2
    },
    "slot": "hands",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Uncommon",
    "id": 1271
  },
  {
    "name": "Palecloth Cuffs",
    "description": "Palecloth Cuffs. Cut for Reach benches at this rank.",
    "icon": "/icons/items/palecloth-cuffs.png",
    "slug": "palecloth-cuffs",
    "kind": "equipment",
    "craftLevel": 2,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 90,
      "materialsText": "Linen Cloth×2, Pale Dust×1"
    },
    "stats": {
      "def": 5,
      "mnd": 2,
      "mab": 2
    },
    "slot": "hands",
    "jobRestrict": [
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Uncommon",
    "id": 1272
  },
  {
    "name": "Flaxcord Cuffs",
    "description": "Flaxcord Cuffs. Cut for Reach benches at this rank.",
    "icon": "/icons/items/flaxcord-cuffs.png",
    "slug": "flaxcord-cuffs",
    "kind": "equipment",
    "craftLevel": 3,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 110,
      "materialsText": "Linen Cloth×2, Pale Dust×1"
    },
    "stats": {
      "def": 5,
      "mnd": 2,
      "mab": 2
    },
    "slot": "hands",
    "jobRestrict": [
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Uncommon",
    "id": 1273
  },
  {
    "name": "Rivetmail Mittens",
    "description": "Rivetmail Mittens. Cut for Reach benches at this rank.",
    "icon": "/icons/items/rivetmail-mittens.png",
    "slug": "rivetmail-mittens",
    "kind": "equipment",
    "craftLevel": 4,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 130,
      "materialsText": "Bronze Ingot×2, Pale Dust×1"
    },
    "stats": {
      "def": 8,
      "vit": 2,
      "acc": 2
    },
    "slot": "hands",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Uncommon",
    "id": 1274
  },
  {
    "name": "Copperbind Mittens",
    "description": "Copperbind Mittens. Cut for Reach benches at this rank.",
    "icon": "/icons/items/copperbind-mittens.png",
    "slug": "copperbind-mittens",
    "kind": "equipment",
    "craftLevel": 5,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 150,
      "materialsText": "Bronze Ingot×2, Pale Dust×1"
    },
    "stats": {
      "def": 8,
      "vit": 2,
      "acc": 2
    },
    "slot": "hands",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Common",
    "id": 1275
  },
  {
    "name": "Ironbind Mittens",
    "description": "Ironbind Mittens. Cut for Reach benches at this rank.",
    "icon": "/icons/items/ironbind-mittens.png",
    "slug": "ironbind-mittens",
    "kind": "equipment",
    "craftLevel": 6,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 170,
      "materialsText": "Bronze Ingot×2, Pale Dust×1"
    },
    "stats": {
      "def": 8,
      "vit": 2,
      "acc": 2
    },
    "slot": "hands",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Common",
    "id": 1276
  },
  {
    "name": "Ashbind Mittens",
    "description": "Ashbind Mittens. Cut for Reach benches at this rank.",
    "icon": "/icons/items/ashbind-mittens.png",
    "slug": "ashbind-mittens",
    "kind": "equipment",
    "craftLevel": 7,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 190,
      "materialsText": "Bronze Ingot×2, Pale Dust×1"
    },
    "stats": {
      "def": 8,
      "vit": 2,
      "acc": 2
    },
    "slot": "hands",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Uncommon",
    "id": 1277
  },
  {
    "name": "Pitcord Gloves",
    "description": "Pitcord Gloves. Cut for Reach benches at this rank.",
    "icon": "/icons/items/pitcord-gloves.png",
    "slug": "pitcord-gloves",
    "kind": "equipment",
    "craftLevel": 8,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 210,
      "materialsText": "Leather×2, Pale Dust×1"
    },
    "stats": {
      "def": 6,
      "agi": 2,
      "dex": 2
    },
    "slot": "hands",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Uncommon",
    "id": 1278
  },
  {
    "name": "Dustcord Gloves",
    "description": "Dustcord Gloves. Cut for Reach benches at this rank.",
    "icon": "/icons/items/dustcord-gloves.png",
    "slug": "dustcord-gloves",
    "kind": "equipment",
    "craftLevel": 9,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 230,
      "materialsText": "Leather×2, Pale Dust×1"
    },
    "stats": {
      "def": 6,
      "agi": 2,
      "dex": 2
    },
    "slot": "hands",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Uncommon",
    "id": 1279
  },
  {
    "name": "Ashcord Gloves",
    "description": "Ashcord Gloves. Cut for Reach benches at this rank.",
    "icon": "/icons/items/ashcord-gloves.png",
    "slug": "ashcord-gloves",
    "kind": "equipment",
    "craftLevel": 10,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 250,
      "materialsText": "Leather×2, Pale Dust×1"
    },
    "stats": {
      "def": 6,
      "agi": 2,
      "dex": 2
    },
    "slot": "hands",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Uncommon",
    "id": 1280
  },
  {
    "name": "Seedcloth Slops",
    "description": "Seedcloth Slops. Cut for Reach benches at this rank.",
    "icon": "/icons/items/seedcloth-slops.png",
    "slug": "seedcloth-slops",
    "kind": "equipment",
    "craftLevel": 1,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 70,
      "materialsText": "Linen Cloth×2, Pale Dust×1"
    },
    "stats": {
      "def": 7,
      "mnd": 2,
      "mp": 12
    },
    "slot": "legs",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Uncommon",
    "id": 1281
  },
  {
    "name": "Palecloth Slops",
    "description": "Palecloth Slops. Cut for Reach benches at this rank.",
    "icon": "/icons/items/palecloth-slops.png",
    "slug": "palecloth-slops",
    "kind": "equipment",
    "craftLevel": 2,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 90,
      "materialsText": "Linen Cloth×2, Pale Dust×1"
    },
    "stats": {
      "def": 7,
      "mnd": 2,
      "mp": 12
    },
    "slot": "legs",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Uncommon",
    "id": 1282
  },
  {
    "name": "Flaxcord Slops",
    "description": "Flaxcord Slops. Cut for Reach benches at this rank.",
    "icon": "/icons/items/flaxcord-slops.png",
    "slug": "flaxcord-slops",
    "kind": "equipment",
    "craftLevel": 3,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 110,
      "materialsText": "Linen Cloth×2, Pale Dust×1"
    },
    "stats": {
      "def": 8,
      "mnd": 2,
      "mp": 12
    },
    "slot": "legs",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Uncommon",
    "id": 1283
  },
  {
    "name": "Wickreed Slops",
    "description": "Wickreed Slops. Cut for Reach benches at this rank.",
    "icon": "/icons/items/wickreed-slops.png",
    "slug": "wickreed-slops",
    "kind": "equipment",
    "craftLevel": 4,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 130,
      "materialsText": "Linen Cloth×2, Pale Dust×1"
    },
    "stats": {
      "def": 8,
      "mnd": 2,
      "mp": 12
    },
    "slot": "legs",
    "jobRestrict": [
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Uncommon",
    "id": 1284
  },
  {
    "name": "Rivetmail Cuisses",
    "description": "Rivetmail Cuisses. Cut for Reach benches at this rank.",
    "icon": "/icons/items/rivetmail-cuisses.png",
    "slug": "rivetmail-cuisses",
    "kind": "equipment",
    "craftLevel": 5,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 150,
      "materialsText": "Bronze Ingot×2, Pale Dust×1"
    },
    "stats": {
      "def": 10,
      "vit": 2,
      "hp": 16
    },
    "slot": "legs",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Uncommon",
    "id": 1285
  },
  {
    "name": "Copperbind Cuisses",
    "description": "Copperbind Cuisses. Cut for Reach benches at this rank.",
    "icon": "/icons/items/copperbind-cuisses.png",
    "slug": "copperbind-cuisses",
    "kind": "equipment",
    "craftLevel": 6,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 170,
      "materialsText": "Bronze Ingot×2, Pale Dust×1"
    },
    "stats": {
      "def": 10,
      "vit": 2,
      "hp": 16
    },
    "slot": "legs",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Common",
    "id": 1286
  },
  {
    "name": "Ironbind Cuisses",
    "description": "Ironbind Cuisses. Cut for Reach benches at this rank.",
    "icon": "/icons/items/ironbind-cuisses.png",
    "slug": "ironbind-cuisses",
    "kind": "equipment",
    "craftLevel": 7,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 190,
      "materialsText": "Bronze Ingot×2, Pale Dust×1"
    },
    "stats": {
      "def": 11,
      "vit": 2,
      "hp": 16
    },
    "slot": "legs",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Common",
    "id": 1287
  },
  {
    "name": "Pitcord Trousers",
    "description": "Pitcord Trousers. Cut for Reach benches at this rank.",
    "icon": "/icons/items/pitcord-trousers.png",
    "slug": "pitcord-trousers",
    "kind": "equipment",
    "craftLevel": 8,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 210,
      "materialsText": "Leather×2, Pale Dust×1"
    },
    "stats": {
      "def": 9,
      "agi": 2,
      "hp": 16
    },
    "slot": "legs",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Uncommon",
    "id": 1288
  },
  {
    "name": "Dustcord Trousers",
    "description": "Dustcord Trousers. Cut for Reach benches at this rank.",
    "icon": "/icons/items/dustcord-trousers.png",
    "slug": "dustcord-trousers",
    "kind": "equipment",
    "craftLevel": 9,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 230,
      "materialsText": "Leather×2, Pale Dust×1"
    },
    "stats": {
      "def": 9,
      "agi": 2,
      "hp": 16
    },
    "slot": "legs",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Uncommon",
    "id": 1289
  },
  {
    "name": "Ashcord Trousers",
    "description": "Ashcord Trousers. Cut for Reach benches at this rank.",
    "icon": "/icons/items/ashcord-trousers.png",
    "slug": "ashcord-trousers",
    "kind": "equipment",
    "craftLevel": 10,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 250,
      "materialsText": "Leather×2, Pale Dust×1"
    },
    "stats": {
      "def": 9,
      "agi": 2,
      "hp": 16
    },
    "slot": "legs",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Uncommon",
    "id": 1290
  },
  {
    "name": "Seedhide Trousers",
    "description": "Seedhide Trousers. Cut for Reach benches at this rank.",
    "icon": "/icons/items/seedhide-trousers.png",
    "slug": "seedhide-trousers",
    "kind": "equipment",
    "craftLevel": 11,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 270,
      "materialsText": "Leather×2, Pale Dust×1"
    },
    "stats": {
      "def": 9,
      "agi": 2,
      "hp": 16
    },
    "slot": "legs",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Uncommon",
    "id": 1291
  },
  {
    "name": "Seedcloth Sandals",
    "description": "Seedcloth Sandals. Cut for Reach benches at this rank.",
    "icon": "/icons/items/seedcloth-sandals.png",
    "slug": "seedcloth-sandals",
    "kind": "equipment",
    "craftLevel": 1,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 70,
      "materialsText": "Linen Cloth×2, Pale Dust×1"
    },
    "stats": {
      "def": 5,
      "mp": 12,
      "agi": 2
    },
    "slot": "feet",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Uncommon",
    "id": 1292
  },
  {
    "name": "Palecloth Sandals",
    "description": "Palecloth Sandals. Cut for Reach benches at this rank.",
    "icon": "/icons/items/palecloth-sandals.png",
    "slug": "palecloth-sandals",
    "kind": "equipment",
    "craftLevel": 2,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 90,
      "materialsText": "Linen Cloth×2, Pale Dust×1"
    },
    "stats": {
      "def": 5,
      "mp": 12,
      "agi": 2
    },
    "slot": "feet",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Uncommon",
    "id": 1293
  },
  {
    "name": "Flaxcord Sandals",
    "description": "Flaxcord Sandals. Cut for Reach benches at this rank.",
    "icon": "/icons/items/flaxcord-sandals.png",
    "slug": "flaxcord-sandals",
    "kind": "equipment",
    "craftLevel": 3,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 110,
      "materialsText": "Linen Cloth×2, Pale Dust×1"
    },
    "stats": {
      "def": 5,
      "mp": 12,
      "agi": 2
    },
    "slot": "feet",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Uncommon",
    "id": 1294
  },
  {
    "name": "Wickreed Sandals",
    "description": "Wickreed Sandals. Cut for Reach benches at this rank.",
    "icon": "/icons/items/wickreed-sandals.png",
    "slug": "wickreed-sandals",
    "kind": "equipment",
    "craftLevel": 4,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 130,
      "materialsText": "Linen Cloth×2, Pale Dust×1"
    },
    "stats": {
      "def": 6,
      "mp": 12,
      "agi": 2
    },
    "slot": "feet",
    "jobRestrict": [
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Uncommon",
    "id": 1295
  },
  {
    "name": "Rivetmail Sabatons",
    "description": "Rivetmail Sabatons. Cut for Reach benches at this rank.",
    "icon": "/icons/items/rivetmail-sabatons.png",
    "slug": "rivetmail-sabatons",
    "kind": "equipment",
    "craftLevel": 5,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 150,
      "materialsText": "Bronze Ingot×2, Pale Dust×1"
    },
    "stats": {
      "def": 8,
      "vit": 2,
      "hp": 16,
      "agi": 2
    },
    "slot": "feet",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Uncommon",
    "id": 1296
  },
  {
    "name": "Copperbind Sabatons",
    "description": "Copperbind Sabatons. Cut for Reach benches at this rank.",
    "icon": "/icons/items/copperbind-sabatons.png",
    "slug": "copperbind-sabatons",
    "kind": "equipment",
    "craftLevel": 6,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 170,
      "materialsText": "Bronze Ingot×2, Pale Dust×1"
    },
    "stats": {
      "def": 8,
      "vit": 2,
      "hp": 16,
      "agi": 2
    },
    "slot": "feet",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Common",
    "id": 1297
  },
  {
    "name": "Ironbind Sabatons",
    "description": "Ironbind Sabatons. Cut for Reach benches at this rank.",
    "icon": "/icons/items/ironbind-sabatons.png",
    "slug": "ironbind-sabatons",
    "kind": "equipment",
    "craftLevel": 7,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 190,
      "materialsText": "Bronze Ingot×2, Pale Dust×1"
    },
    "stats": {
      "def": 8,
      "vit": 2,
      "hp": 16,
      "agi": 2
    },
    "slot": "feet",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Common",
    "id": 1298
  },
  {
    "name": "Pitcord Boots",
    "description": "Pitcord Boots. Cut for Reach benches at this rank.",
    "icon": "/icons/items/pitcord-boots.png",
    "slug": "pitcord-boots",
    "kind": "equipment",
    "craftLevel": 8,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 210,
      "materialsText": "Leather×2, Pale Dust×1"
    },
    "stats": {
      "def": 6,
      "agi": 2,
      "dex": 2
    },
    "slot": "feet",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Uncommon",
    "id": 1299
  },
  {
    "name": "Dustcord Boots",
    "description": "Dustcord Boots. Cut for Reach benches at this rank.",
    "icon": "/icons/items/dustcord-boots.png",
    "slug": "dustcord-boots",
    "kind": "equipment",
    "craftLevel": 9,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 230,
      "materialsText": "Leather×2, Pale Dust×1"
    },
    "stats": {
      "def": 6,
      "agi": 2,
      "dex": 2
    },
    "slot": "feet",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Uncommon",
    "id": 1300
  },
  {
    "name": "Ashcord Boots",
    "description": "Ashcord Boots. Cut for Reach benches at this rank.",
    "icon": "/icons/items/ashcord-boots.png",
    "slug": "ashcord-boots",
    "kind": "equipment",
    "craftLevel": 10,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 250,
      "materialsText": "Leather×2, Pale Dust×1"
    },
    "stats": {
      "def": 7,
      "agi": 2,
      "dex": 2
    },
    "slot": "feet",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Uncommon",
    "id": 1301
  },
  {
    "name": "Seedwood Staff",
    "description": "Seedwood Staff. A staff for this rank's line.",
    "icon": "/icons/items/seedwood-staff.png",
    "slug": "seedwood-staff",
    "kind": "equipment",
    "craftLevel": 1,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 70,
      "materialsText": "Ashbeam Lumber×2, Pale Dust×1"
    },
    "stats": {
      "mnd": 2,
      "int": 2,
      "mp": 10
    },
    "delayMs": 2400,
    "slot": "main",
    "jobRestrict": [
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "weaponFamily": "staff",
    "rarity": "Uncommon",
    "id": 1302
  },
  {
    "name": "Paleoak Staff",
    "description": "Paleoak Staff. A staff for this rank's line.",
    "icon": "/icons/items/paleoak-staff.png",
    "slug": "paleoak-staff",
    "kind": "equipment",
    "craftLevel": 2,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 90,
      "materialsText": "Ashbeam Lumber×2, Pale Dust×1"
    },
    "stats": {
      "mnd": 2,
      "int": 2,
      "mp": 10
    },
    "delayMs": 2400,
    "slot": "main",
    "jobRestrict": [
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "weaponFamily": "staff",
    "rarity": "Uncommon",
    "id": 1303
  },
  {
    "name": "Rivetsteel Staff",
    "description": "Rivetsteel Staff. A staff for this rank's line.",
    "icon": "/icons/items/rivetsteel-staff.png",
    "slug": "rivetsteel-staff",
    "kind": "equipment",
    "craftLevel": 3,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 110,
      "materialsText": "Ashbeam Lumber×2, Pale Dust×1"
    },
    "stats": {
      "mnd": 2,
      "int": 2,
      "mp": 10
    },
    "delayMs": 2400,
    "slot": "main",
    "jobRestrict": [
      "tim",
      "sorcerer",
      "druid"
    ],
    "weaponFamily": "staff",
    "rarity": "Uncommon",
    "id": 1304
  },
  {
    "name": "Pitiron Sword",
    "description": "Pitiron Sword. A sword for this rank's line.",
    "icon": "/icons/items/pitiron-sword.png",
    "slug": "pitiron-sword",
    "kind": "equipment",
    "craftLevel": 4,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 130,
      "materialsText": "Bronze Ingot×2, Pale Dust×1"
    },
    "stats": {
      "atk": 7,
      "str": 2
    },
    "delayMs": 2400,
    "slot": "main",
    "jobRestrict": [
      "knight",
      "battlemage"
    ],
    "weaponFamily": "sword",
    "rarity": "Uncommon",
    "id": 1305
  },
  {
    "name": "Seedguard",
    "description": "Seedguard. A round for any job that will buckle it on.",
    "icon": "/icons/items/seedguard.png",
    "slug": "seedguard",
    "kind": "equipment",
    "craftLevel": 1,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 70,
      "materialsText": "Bronze Ingot×2, Pale Dust×1"
    },
    "stats": {
      "def": 6,
      "vit": 1
    },
    "slot": "sub",
    "jobRestrict": [
      "knight",
      "rogue",
      "cleric",
      "sorcerer",
      "fighter",
      "battlemage",
      "tim",
      "druid"
    ],
    "rarity": "Uncommon",
    "id": 1306
  },
  {
    "name": "Paletarge",
    "description": "Paletarge. A round for any job that will buckle it on.",
    "icon": "/icons/items/paletarge.png",
    "slug": "paletarge",
    "kind": "equipment",
    "craftLevel": 2,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 90,
      "materialsText": "Bronze Ingot×2, Pale Dust×1"
    },
    "stats": {
      "def": 6,
      "vit": 1
    },
    "slot": "sub",
    "jobRestrict": [
      "knight",
      "rogue",
      "cleric",
      "sorcerer",
      "fighter",
      "battlemage",
      "tim",
      "druid"
    ],
    "rarity": "Uncommon",
    "id": 1307
  },
  {
    "name": "Rivettarge",
    "description": "Rivettarge. A round for any job that will buckle it on.",
    "icon": "/icons/items/rivettarge.png",
    "slug": "rivettarge",
    "kind": "equipment",
    "craftLevel": 3,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 110,
      "materialsText": "Bronze Ingot×2, Pale Dust×1"
    },
    "stats": {
      "def": 7,
      "vit": 1
    },
    "slot": "sub",
    "jobRestrict": [
      "knight",
      "rogue",
      "cleric",
      "sorcerer",
      "fighter",
      "battlemage",
      "tim",
      "druid"
    ],
    "rarity": "Uncommon",
    "id": 1308
  },
  {
    "name": "Pitguard",
    "description": "Pitguard. A round for any job that will buckle it on.",
    "icon": "/icons/items/pitguard.png",
    "slug": "pitguard",
    "kind": "equipment",
    "craftLevel": 4,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 130,
      "materialsText": "Bronze Ingot×2, Pale Dust×1"
    },
    "stats": {
      "def": 7,
      "vit": 1
    },
    "slot": "sub",
    "jobRestrict": [
      "rogue",
      "sorcerer",
      "fighter",
      "tim",
      "druid"
    ],
    "rarity": "Uncommon",
    "id": 1309
  },
  {
    "name": "Forgecloth Cowl",
    "description": "Forgecloth Cowl. Cut for Reach benches at this rank.",
    "icon": "/icons/items/forgecloth-cowl.png",
    "slug": "forgecloth-cowl",
    "kind": "equipment",
    "craftLevel": 21,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 470,
      "materialsText": "Linen Cloth×2, Ash Dust×1"
    },
    "stats": {
      "def": 8,
      "mnd": 3,
      "mp": 23
    },
    "slot": "head",
    "jobRestrict": [
      "battlemage",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Uncommon",
    "id": 1310
  },
  {
    "name": "Forgeplate Helm",
    "description": "Forgeplate Helm. Cut for Reach benches at this rank.",
    "icon": "/icons/items/forgeplate-helm.png",
    "slug": "forgeplate-helm",
    "kind": "equipment",
    "craftLevel": 22,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 490,
      "materialsText": "Iron Ingot×2, Ash Dust×1"
    },
    "stats": {
      "def": 11,
      "vit": 2,
      "hp": 18
    },
    "slot": "head",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Uncommon",
    "id": 1311
  },
  {
    "name": "Fordplate Helm",
    "description": "Fordplate Helm. Cut for Reach benches at this rank.",
    "icon": "/icons/items/fordplate-helm.png",
    "slug": "fordplate-helm",
    "kind": "equipment",
    "craftLevel": 23,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 510,
      "materialsText": "Iron Ingot×2, Ash Dust×1"
    },
    "stats": {
      "def": 11,
      "vit": 2,
      "hp": 18
    },
    "slot": "head",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Uncommon",
    "id": 1312
  },
  {
    "name": "Kilnplate Helm",
    "description": "Kilnplate Helm. Cut for Reach benches at this rank.",
    "icon": "/icons/items/kilnplate-helm.png",
    "slug": "kilnplate-helm",
    "kind": "equipment",
    "craftLevel": 24,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 530,
      "materialsText": "Iron Ingot×2, Ash Dust×1"
    },
    "stats": {
      "def": 11,
      "vit": 2,
      "hp": 19
    },
    "slot": "head",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Uncommon",
    "id": 1313
  },
  {
    "name": "Forgeplate Mail",
    "description": "Forgeplate Mail. Cut for Reach benches at this rank.",
    "icon": "/icons/items/forgeplate-mail.png",
    "slug": "forgeplate-mail",
    "kind": "equipment",
    "craftLevel": 21,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 470,
      "materialsText": "Iron Ingot×3, Ash Dust×1"
    },
    "stats": {
      "def": 21,
      "vit": 2,
      "hp": 17
    },
    "slot": "body",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Uncommon",
    "id": 1314
  },
  {
    "name": "Fordplate Mail",
    "description": "Fordplate Mail. Cut for Reach benches at this rank.",
    "icon": "/icons/items/fordplate-mail.png",
    "slug": "fordplate-mail",
    "kind": "equipment",
    "craftLevel": 22,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 490,
      "materialsText": "Iron Ingot×3, Ash Dust×1"
    },
    "stats": {
      "def": 21,
      "vit": 2,
      "hp": 18
    },
    "slot": "body",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Uncommon",
    "id": 1315
  },
  {
    "name": "Forgeplate Mittens",
    "description": "Forgeplate Mittens. Cut for Reach benches at this rank.",
    "icon": "/icons/items/forgeplate-mittens.png",
    "slug": "forgeplate-mittens",
    "kind": "equipment",
    "craftLevel": 21,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 470,
      "materialsText": "Iron Ingot×2, Ash Dust×1"
    },
    "stats": {
      "def": 10,
      "vit": 2,
      "acc": 2
    },
    "slot": "hands",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Uncommon",
    "id": 1316
  },
  {
    "name": "Fordplate Mittens",
    "description": "Fordplate Mittens. Cut for Reach benches at this rank.",
    "icon": "/icons/items/fordplate-mittens.png",
    "slug": "fordplate-mittens",
    "kind": "equipment",
    "craftLevel": 22,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 490,
      "materialsText": "Iron Ingot×2, Ash Dust×1"
    },
    "stats": {
      "def": 10,
      "vit": 2,
      "acc": 2
    },
    "slot": "hands",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Uncommon",
    "id": 1317
  },
  {
    "name": "Kilnplate Mittens",
    "description": "Kilnplate Mittens. Cut for Reach benches at this rank.",
    "icon": "/icons/items/kilnplate-mittens.png",
    "slug": "kilnplate-mittens",
    "kind": "equipment",
    "craftLevel": 23,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 510,
      "materialsText": "Iron Ingot×2, Ash Dust×1"
    },
    "stats": {
      "def": 10,
      "vit": 2,
      "acc": 2
    },
    "slot": "hands",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Uncommon",
    "id": 1318
  },
  {
    "name": "Forgeplate Cuisses",
    "description": "Forgeplate Cuisses. Cut for Reach benches at this rank.",
    "icon": "/icons/items/forgeplate-cuisses.png",
    "slug": "forgeplate-cuisses",
    "kind": "equipment",
    "craftLevel": 21,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 470,
      "materialsText": "Iron Ingot×2, Ash Dust×1"
    },
    "stats": {
      "def": 14,
      "vit": 2,
      "hp": 17
    },
    "slot": "legs",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Uncommon",
    "id": 1319
  },
  {
    "name": "Fordplate Cuisses",
    "description": "Fordplate Cuisses. Cut for Reach benches at this rank.",
    "icon": "/icons/items/fordplate-cuisses.png",
    "slug": "fordplate-cuisses",
    "kind": "equipment",
    "craftLevel": 22,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 490,
      "materialsText": "Iron Ingot×2, Ash Dust×1"
    },
    "stats": {
      "def": 14,
      "vit": 2,
      "hp": 18
    },
    "slot": "legs",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Uncommon",
    "id": 1320
  },
  {
    "name": "Kilnplate Cuisses",
    "description": "Kilnplate Cuisses. Cut for Reach benches at this rank.",
    "icon": "/icons/items/kilnplate-cuisses.png",
    "slug": "kilnplate-cuisses",
    "kind": "equipment",
    "craftLevel": 23,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 510,
      "materialsText": "Iron Ingot×2, Ash Dust×1"
    },
    "stats": {
      "def": 14,
      "vit": 2,
      "hp": 18
    },
    "slot": "legs",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Uncommon",
    "id": 1321
  },
  {
    "name": "Forgecloth Sandals",
    "description": "Forgecloth Sandals. Cut for Reach benches at this rank.",
    "icon": "/icons/items/forgecloth-sandals.png",
    "slug": "forgecloth-sandals",
    "kind": "equipment",
    "craftLevel": 21,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 470,
      "materialsText": "Linen Cloth×2, Ash Dust×1"
    },
    "stats": {
      "def": 8,
      "mp": 23,
      "agi": 2
    },
    "slot": "feet",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Uncommon",
    "id": 1322
  },
  {
    "name": "Fordcloth Sandals",
    "description": "Fordcloth Sandals. Cut for Reach benches at this rank.",
    "icon": "/icons/items/fordcloth-sandals.png",
    "slug": "fordcloth-sandals",
    "kind": "equipment",
    "craftLevel": 22,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 490,
      "materialsText": "Linen Cloth×2, Ash Dust×1"
    },
    "stats": {
      "def": 9,
      "mp": 24,
      "agi": 2
    },
    "slot": "feet",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Uncommon",
    "id": 1323
  },
  {
    "name": "Kilnflax Sandals",
    "description": "Kilnflax Sandals. Cut for Reach benches at this rank.",
    "icon": "/icons/items/kilnflax-sandals.png",
    "slug": "kilnflax-sandals",
    "kind": "equipment",
    "craftLevel": 23,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 510,
      "materialsText": "Linen Cloth×2, Ash Dust×1"
    },
    "stats": {
      "def": 9,
      "mp": 25,
      "agi": 2
    },
    "slot": "feet",
    "jobRestrict": [
      "battlemage",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Uncommon",
    "id": 1324
  },
  {
    "name": "Forgeplate Sabatons",
    "description": "Forgeplate Sabatons. Cut for Reach benches at this rank.",
    "icon": "/icons/items/forgeplate-sabatons.png",
    "slug": "forgeplate-sabatons",
    "kind": "equipment",
    "craftLevel": 24,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 530,
      "materialsText": "Iron Ingot×2, Ash Dust×1"
    },
    "stats": {
      "def": 11,
      "vit": 2,
      "hp": 19,
      "agi": 2
    },
    "slot": "feet",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Uncommon",
    "id": 1325
  },
  {
    "name": "Fordplate Sabatons",
    "description": "Fordplate Sabatons. Cut for Reach benches at this rank.",
    "icon": "/icons/items/fordplate-sabatons.png",
    "slug": "fordplate-sabatons",
    "kind": "equipment",
    "craftLevel": 25,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 550,
      "materialsText": "Iron Ingot×2, Ash Dust×1"
    },
    "stats": {
      "def": 11,
      "vit": 2,
      "hp": 20,
      "agi": 2
    },
    "slot": "feet",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Uncommon",
    "id": 1326
  },
  {
    "name": "Kilnplate Sabatons",
    "description": "Kilnplate Sabatons. Cut for Reach benches at this rank.",
    "icon": "/icons/items/kilnplate-sabatons.png",
    "slug": "kilnplate-sabatons",
    "kind": "equipment",
    "craftLevel": 26,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 570,
      "materialsText": "Iron Ingot×2, Ash Dust×1"
    },
    "stats": {
      "def": 11,
      "vit": 3,
      "hp": 21,
      "agi": 2
    },
    "slot": "feet",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Uncommon",
    "id": 1327
  },
  {
    "name": "Steelbind Sabatons",
    "description": "Steelbind Sabatons. Cut for Reach benches at this rank.",
    "icon": "/icons/items/steelbind-sabatons.png",
    "slug": "steelbind-sabatons",
    "kind": "equipment",
    "craftLevel": 27,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 590,
      "materialsText": "Iron Ingot×2, Ash Dust×1"
    },
    "stats": {
      "def": 11,
      "vit": 3,
      "hp": 22,
      "agi": 2
    },
    "slot": "feet",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Uncommon",
    "id": 1328
  },
  {
    "name": "Forgeoak Staff",
    "description": "Forgeoak Staff. A staff for this rank's line.",
    "icon": "/icons/items/forgeoak-staff.png",
    "slug": "forgeoak-staff",
    "kind": "equipment",
    "craftLevel": 21,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 470,
      "materialsText": "Ashbeam Lumber×2, Ash Dust×1"
    },
    "stats": {
      "mnd": 4,
      "int": 2,
      "mp": 19
    },
    "delayMs": 2400,
    "slot": "main",
    "jobRestrict": [
      "tim",
      "sorcerer",
      "druid"
    ],
    "weaponFamily": "staff",
    "rarity": "Uncommon",
    "id": 1329
  },
  {
    "name": "Fordoak Club",
    "description": "Fordoak Club. A club for this rank's line.",
    "icon": "/icons/items/fordoak-club.png",
    "slug": "fordoak-club",
    "kind": "equipment",
    "craftLevel": 22,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 490,
      "materialsText": "Iron Ingot×2, Ash Dust×1"
    },
    "stats": {
      "atk": 17,
      "mnd": 2
    },
    "delayMs": 2400,
    "slot": "main",
    "jobRestrict": [
      "battlemage",
      "knight",
      "druid"
    ],
    "weaponFamily": "club",
    "rarity": "Uncommon",
    "id": 1330
  },
  {
    "name": "Kilnoak Staff",
    "description": "Kilnoak Staff. A staff for this rank's line.",
    "icon": "/icons/items/kilnoak-staff.png",
    "slug": "kilnoak-staff",
    "kind": "equipment",
    "craftLevel": 23,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 510,
      "materialsText": "Ashbeam Lumber×2, Ash Dust×1"
    },
    "stats": {
      "mnd": 4,
      "int": 2,
      "mp": 21
    },
    "delayMs": 2400,
    "slot": "main",
    "jobRestrict": [
      "tim"
    ],
    "weaponFamily": "staff",
    "rarity": "Uncommon",
    "id": 1331
  },
  {
    "name": "Reedsteel Dagger",
    "description": "Reedsteel Dagger. A dagger for this rank's line.",
    "icon": "/icons/items/reedsteel-dagger.png",
    "slug": "reedsteel-dagger",
    "kind": "equipment",
    "craftLevel": 24,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 530,
      "materialsText": "Iron Ingot×2, Ash Dust×1"
    },
    "stats": {
      "atk": 13,
      "dex": 3
    },
    "delayMs": 1800,
    "slot": "main",
    "jobRestrict": [
      "rogue"
    ],
    "weaponFamily": "dagger",
    "rarity": "Uncommon",
    "id": 1332
  },
  {
    "name": "Forgeoak Kris",
    "description": "Forgeoak Kris. A dagger for this rank's line.",
    "icon": "/icons/items/forgeoak-kris.png",
    "slug": "forgeoak-kris",
    "kind": "equipment",
    "craftLevel": 25,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 550,
      "materialsText": "Iron Ingot×2, Ash Dust×1"
    },
    "stats": {
      "atk": 14,
      "dex": 3
    },
    "delayMs": 1800,
    "slot": "main",
    "jobRestrict": [
      "rogue"
    ],
    "weaponFamily": "dagger",
    "rarity": "Uncommon",
    "id": 1333
  },
  {
    "name": "Fordoak Kris",
    "description": "Fordoak Kris. A dagger for this rank's line.",
    "icon": "/icons/items/fordoak-kris.png",
    "slug": "fordoak-kris",
    "kind": "equipment",
    "craftLevel": 26,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 570,
      "materialsText": "Iron Ingot×2, Ash Dust×1"
    },
    "stats": {
      "atk": 14,
      "dex": 3
    },
    "delayMs": 1800,
    "slot": "main",
    "jobRestrict": [
      "rogue"
    ],
    "weaponFamily": "dagger",
    "rarity": "Uncommon",
    "id": 1334
  },
  {
    "name": "Forgetarge",
    "description": "Forgetarge. A round for any job that will buckle it on.",
    "icon": "/icons/items/forgetarge.png",
    "slug": "forgetarge",
    "kind": "equipment",
    "craftLevel": 21,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 470,
      "materialsText": "Iron Ingot×2, Ash Dust×1"
    },
    "stats": {
      "def": 10,
      "vit": 1
    },
    "slot": "sub",
    "jobRestrict": [
      "knight",
      "rogue",
      "cleric",
      "sorcerer",
      "fighter",
      "battlemage",
      "tim",
      "druid"
    ],
    "rarity": "Uncommon",
    "id": 1335
  },
  {
    "name": "Fordtarge",
    "description": "Fordtarge. A round for any job that will buckle it on.",
    "icon": "/icons/items/fordtarge.png",
    "slug": "fordtarge",
    "kind": "equipment",
    "craftLevel": 22,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 490,
      "materialsText": "Iron Ingot×2, Ash Dust×1"
    },
    "stats": {
      "def": 10,
      "vit": 1
    },
    "slot": "sub",
    "jobRestrict": [
      "knight",
      "rogue",
      "cleric",
      "sorcerer",
      "fighter",
      "battlemage",
      "tim",
      "druid"
    ],
    "rarity": "Uncommon",
    "id": 1336
  },
  {
    "name": "Kilntarge",
    "description": "Kilntarge. A round for any job that will buckle it on.",
    "icon": "/icons/items/kilntarge.png",
    "slug": "kilntarge",
    "kind": "equipment",
    "craftLevel": 23,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 510,
      "materialsText": "Iron Ingot×2, Ash Dust×1"
    },
    "stats": {
      "def": 11,
      "vit": 1
    },
    "slot": "sub",
    "jobRestrict": [
      "rogue",
      "cleric",
      "sorcerer",
      "fighter",
      "battlemage",
      "tim",
      "druid"
    ],
    "rarity": "Uncommon",
    "id": 1337
  },
  {
    "name": "Reedtarge",
    "description": "Reedtarge. A round for any job that will buckle it on.",
    "icon": "/icons/items/reedtarge.png",
    "slug": "reedtarge",
    "kind": "equipment",
    "craftLevel": 24,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 530,
      "materialsText": "Iron Ingot×2, Ash Dust×1"
    },
    "stats": {
      "def": 11,
      "vit": 1
    },
    "slot": "sub",
    "jobRestrict": [
      "rogue",
      "sorcerer",
      "fighter",
      "tim",
      "druid"
    ],
    "rarity": "Uncommon",
    "id": 1338
  },
  {
    "name": "Forgeguard",
    "description": "Forgeguard. A round for any job that will buckle it on.",
    "icon": "/icons/items/forgeguard.png",
    "slug": "forgeguard",
    "kind": "equipment",
    "craftLevel": 25,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 550,
      "materialsText": "Iron Ingot×2, Ash Dust×1"
    },
    "stats": {
      "def": 11,
      "vit": 1
    },
    "slot": "sub",
    "jobRestrict": [
      "rogue",
      "sorcerer",
      "fighter",
      "tim",
      "druid"
    ],
    "rarity": "Uncommon",
    "id": 1339
  },
  {
    "name": "Glenplate Helm",
    "description": "Glenplate Helm. Cut for Reach benches at this rank.",
    "icon": "/icons/items/glenplate-helm.png",
    "slug": "glenplate-helm",
    "kind": "equipment",
    "craftLevel": 41,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 870,
      "materialsText": "Mythril Ingot×2, Slag Dust×1"
    },
    "stats": {
      "def": 14,
      "vit": 4,
      "hp": 33
    },
    "slot": "head",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Rare",
    "id": 1340
  },
  {
    "name": "Quillplate Helm",
    "description": "Quillplate Helm. Cut for Reach benches at this rank.",
    "icon": "/icons/items/quillplate-helm.png",
    "slug": "quillplate-helm",
    "kind": "equipment",
    "craftLevel": 42,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 890,
      "materialsText": "Mythril Ingot×2, Slag Dust×1"
    },
    "stats": {
      "def": 14,
      "vit": 4,
      "hp": 34
    },
    "slot": "head",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Rare",
    "id": 1341
  },
  {
    "name": "Glenhide Cap",
    "description": "Glenhide Cap. Cut for Reach benches at this rank.",
    "icon": "/icons/items/glenhide-cap.png",
    "slug": "glenhide-cap",
    "kind": "equipment",
    "craftLevel": 43,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 910,
      "materialsText": "Fine Leather×1, Slag Dust×1"
    },
    "stats": {
      "def": 12,
      "agi": 4,
      "dex": 3
    },
    "slot": "head",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Rare",
    "id": 1342
  },
  {
    "name": "Glenweave Robe",
    "description": "Glenweave Robe. Cut for Reach benches at this rank.",
    "icon": "/icons/items/glenweave-robe.png",
    "slug": "glenweave-robe",
    "kind": "equipment",
    "craftLevel": 41,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 870,
      "materialsText": "Silk Cloth×3, Slag Dust×1"
    },
    "stats": {
      "def": 27,
      "mnd": 5,
      "mp": 45,
      "hp": 18,
      "int": 4
    },
    "slot": "body",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Rare",
    "id": 1343
  },
  {
    "name": "Quillweave Robe",
    "description": "Quillweave Robe. Cut for Reach benches at this rank.",
    "icon": "/icons/items/quillweave-robe.png",
    "slug": "quillweave-robe",
    "kind": "equipment",
    "craftLevel": 42,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 890,
      "materialsText": "Silk Cloth×3, Slag Dust×1"
    },
    "stats": {
      "def": 28,
      "mnd": 5,
      "mp": 46,
      "hp": 19,
      "int": 4
    },
    "slot": "body",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Rare",
    "id": 1344
  },
  {
    "name": "Merecloth Robe",
    "description": "Merecloth Robe. Cut for Reach benches at this rank.",
    "icon": "/icons/items/merecloth-robe.png",
    "slug": "merecloth-robe",
    "kind": "equipment",
    "craftLevel": 43,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 910,
      "materialsText": "Silk Cloth×3, Slag Dust×1"
    },
    "stats": {
      "def": 28,
      "mnd": 5,
      "mp": 47,
      "hp": 19,
      "int": 4
    },
    "slot": "body",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Rare",
    "id": 1345
  },
  {
    "name": "Glenplate Mail",
    "description": "Glenplate Mail. Cut for Reach benches at this rank.",
    "icon": "/icons/items/glenplate-mail.png",
    "slug": "glenplate-mail",
    "kind": "equipment",
    "craftLevel": 44,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 930,
      "materialsText": "Mythril Ingot×3, Slag Dust×1"
    },
    "stats": {
      "def": 30,
      "vit": 4,
      "hp": 35
    },
    "slot": "body",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Rare",
    "id": 1346
  },
  {
    "name": "Quillplate Mail",
    "description": "Quillplate Mail. Cut for Reach benches at this rank.",
    "icon": "/icons/items/quillplate-mail.png",
    "slug": "quillplate-mail",
    "kind": "equipment",
    "craftLevel": 45,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 950,
      "materialsText": "Mythril Ingot×3, Slag Dust×1"
    },
    "stats": {
      "def": 31,
      "vit": 4,
      "hp": 36
    },
    "slot": "body",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Rare",
    "id": 1347
  },
  {
    "name": "Mereplate Mail",
    "description": "Mereplate Mail. Cut for Reach benches at this rank.",
    "icon": "/icons/items/mereplate-mail.png",
    "slug": "mereplate-mail",
    "kind": "equipment",
    "craftLevel": 46,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 970,
      "materialsText": "Mythril Ingot×3, Slag Dust×1"
    },
    "stats": {
      "def": 31,
      "vit": 5,
      "hp": 37
    },
    "slot": "body",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Rare",
    "id": 1348
  },
  {
    "name": "Mythrilbind Mail",
    "description": "Mythrilbind Mail. Cut for Reach benches at this rank.",
    "icon": "/icons/items/mythrilbind-mail.png",
    "slug": "mythrilbind-mail",
    "kind": "equipment",
    "craftLevel": 47,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 990,
      "materialsText": "Mythril Ingot×3, Slag Dust×1"
    },
    "stats": {
      "def": 32,
      "vit": 5,
      "hp": 38
    },
    "slot": "body",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Rare",
    "id": 1349
  },
  {
    "name": "Glenhide Vest",
    "description": "Glenhide Vest. Cut for Reach benches at this rank.",
    "icon": "/icons/items/glenhide-vest.png",
    "slug": "glenhide-vest",
    "kind": "equipment",
    "craftLevel": 48,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1010,
      "materialsText": "Fine Leather×3, Slag Dust×1"
    },
    "stats": {
      "def": 30,
      "agi": 5,
      "dex": 4,
      "hp": 24
    },
    "slot": "body",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Rare",
    "id": 1350
  },
  {
    "name": "Glenplate Mittens",
    "description": "Glenplate Mittens. Cut for Reach benches at this rank.",
    "icon": "/icons/items/glenplate-mittens.png",
    "slug": "glenplate-mittens",
    "kind": "equipment",
    "craftLevel": 41,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 870,
      "materialsText": "Mythril Ingot×2, Slag Dust×1"
    },
    "stats": {
      "def": 13,
      "vit": 4,
      "acc": 3
    },
    "slot": "hands",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Rare",
    "id": 1351
  },
  {
    "name": "Quillplate Mittens",
    "description": "Quillplate Mittens. Cut for Reach benches at this rank.",
    "icon": "/icons/items/quillplate-mittens.png",
    "slug": "quillplate-mittens",
    "kind": "equipment",
    "craftLevel": 42,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 890,
      "materialsText": "Mythril Ingot×2, Slag Dust×1"
    },
    "stats": {
      "def": 13,
      "vit": 4,
      "acc": 3
    },
    "slot": "hands",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Rare",
    "id": 1352
  },
  {
    "name": "Mereplate Mittens",
    "description": "Mereplate Mittens. Cut for Reach benches at this rank.",
    "icon": "/icons/items/mereplate-mittens.png",
    "slug": "mereplate-mittens",
    "kind": "equipment",
    "craftLevel": 43,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 910,
      "materialsText": "Mythril Ingot×2, Slag Dust×1"
    },
    "stats": {
      "def": 13,
      "vit": 4,
      "acc": 3
    },
    "slot": "hands",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Rare",
    "id": 1353
  },
  {
    "name": "Mythrilbind Mittens",
    "description": "Mythrilbind Mittens. Cut for Reach benches at this rank.",
    "icon": "/icons/items/mythrilbind-mittens.png",
    "slug": "mythrilbind-mittens",
    "kind": "equipment",
    "craftLevel": 44,
    "craftSkill": "goldsmithing",
    "recipe": {
      "gold": 930,
      "materialsText": "Mythril Ingot×2, Slag Dust×1"
    },
    "stats": {
      "def": 14,
      "vit": 4,
      "acc": 4
    },
    "slot": "hands",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Rare",
    "id": 1354
  },
  {
    "name": "Glenplate Cuisses",
    "description": "Glenplate Cuisses. Cut for Reach benches at this rank.",
    "icon": "/icons/items/glenplate-cuisses.png",
    "slug": "glenplate-cuisses",
    "kind": "equipment",
    "craftLevel": 41,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 870,
      "materialsText": "Mythril Ingot×2, Slag Dust×1"
    },
    "stats": {
      "def": 18,
      "vit": 4,
      "hp": 33
    },
    "slot": "legs",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Rare",
    "id": 1355
  },
  {
    "name": "Quillplate Cuisses",
    "description": "Quillplate Cuisses. Cut for Reach benches at this rank.",
    "icon": "/icons/items/quillplate-cuisses.png",
    "slug": "quillplate-cuisses",
    "kind": "equipment",
    "craftLevel": 42,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 890,
      "materialsText": "Mythril Ingot×2, Slag Dust×1"
    },
    "stats": {
      "def": 18,
      "vit": 4,
      "hp": 34
    },
    "slot": "legs",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Rare",
    "id": 1356
  },
  {
    "name": "Mereplate Cuisses",
    "description": "Mereplate Cuisses. Cut for Reach benches at this rank.",
    "icon": "/icons/items/mereplate-cuisses.png",
    "slug": "mereplate-cuisses",
    "kind": "equipment",
    "craftLevel": 43,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 910,
      "materialsText": "Mythril Ingot×2, Slag Dust×1"
    },
    "stats": {
      "def": 18,
      "vit": 4,
      "hp": 34
    },
    "slot": "legs",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Rare",
    "id": 1357
  },
  {
    "name": "Glenhide Trousers",
    "description": "Glenhide Trousers. Cut for Reach benches at this rank.",
    "icon": "/icons/items/glenhide-trousers.png",
    "slug": "glenhide-trousers",
    "kind": "equipment",
    "craftLevel": 44,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 930,
      "materialsText": "Fine Leather×1, Slag Dust×1"
    },
    "stats": {
      "def": 17,
      "agi": 4,
      "hp": 26
    },
    "slot": "legs",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Rare",
    "id": 1358
  },
  {
    "name": "Glenplate Sabatons",
    "description": "Glenplate Sabatons. Cut for Reach benches at this rank.",
    "icon": "/icons/items/glenplate-sabatons.png",
    "slug": "glenplate-sabatons",
    "kind": "equipment",
    "craftLevel": 41,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 870,
      "materialsText": "Mythril Ingot×2, Slag Dust×1"
    },
    "stats": {
      "def": 14,
      "vit": 4,
      "hp": 33,
      "agi": 2
    },
    "slot": "feet",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Rare",
    "id": 1359
  },
  {
    "name": "Quillplate Sabatons",
    "description": "Quillplate Sabatons. Cut for Reach benches at this rank.",
    "icon": "/icons/items/quillplate-sabatons.png",
    "slug": "quillplate-sabatons",
    "kind": "equipment",
    "craftLevel": 42,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 890,
      "materialsText": "Mythril Ingot×2, Slag Dust×1"
    },
    "stats": {
      "def": 14,
      "vit": 4,
      "hp": 34,
      "agi": 3
    },
    "slot": "feet",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Rare",
    "id": 1360
  },
  {
    "name": "Mereplate Sabatons",
    "description": "Mereplate Sabatons. Cut for Reach benches at this rank.",
    "icon": "/icons/items/mereplate-sabatons.png",
    "slug": "mereplate-sabatons",
    "kind": "equipment",
    "craftLevel": 43,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 910,
      "materialsText": "Mythril Ingot×2, Slag Dust×1"
    },
    "stats": {
      "def": 14,
      "vit": 4,
      "hp": 34,
      "agi": 3
    },
    "slot": "feet",
    "jobRestrict": [
      "knight"
    ],
    "rarity": "Rare",
    "id": 1361
  },
  {
    "name": "Glenoak Staff",
    "description": "Glenoak Staff. A staff for this rank's line.",
    "icon": "/icons/items/glenoak-staff.png",
    "slug": "glenoak-staff",
    "kind": "equipment",
    "craftLevel": 41,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 870,
      "materialsText": "Bloodbeam Lumber×2, Slag Dust×1"
    },
    "stats": {
      "mnd": 6,
      "int": 3,
      "mp": 37
    },
    "delayMs": 2400,
    "slot": "main",
    "jobRestrict": [
      "tim",
      "sorcerer",
      "druid"
    ],
    "weaponFamily": "staff",
    "rarity": "Rare",
    "id": 1362
  },
  {
    "name": "Quillsteel Club",
    "description": "Quillsteel Club. A club for this rank's line.",
    "icon": "/icons/items/quillsteel-club.png",
    "slug": "quillsteel-club",
    "kind": "equipment",
    "craftLevel": 42,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 890,
      "materialsText": "Mythril Ingot×2, Slag Dust×1"
    },
    "stats": {
      "atk": 23,
      "mnd": 3
    },
    "delayMs": 2400,
    "slot": "main",
    "jobRestrict": [
      "battlemage",
      "knight",
      "druid"
    ],
    "weaponFamily": "club",
    "rarity": "Rare",
    "id": 1363
  },
  {
    "name": "Meresteel Club",
    "description": "Meresteel Club. A club for this rank's line.",
    "icon": "/icons/items/meresteel-club.png",
    "slug": "meresteel-club",
    "kind": "equipment",
    "craftLevel": 43,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 910,
      "materialsText": "Mythril Ingot×2, Slag Dust×1"
    },
    "stats": {
      "atk": 24,
      "mnd": 3
    },
    "delayMs": 2400,
    "slot": "main",
    "jobRestrict": [
      "battlemage",
      "knight",
      "druid"
    ],
    "weaponFamily": "club",
    "rarity": "Rare",
    "id": 1364
  },
  {
    "name": "Gleniron Staff",
    "description": "Gleniron Staff. A staff for this rank's line.",
    "icon": "/icons/items/gleniron-staff.png",
    "slug": "gleniron-staff",
    "kind": "equipment",
    "craftLevel": 44,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 930,
      "materialsText": "Bloodbeam Lumber×2, Slag Dust×1"
    },
    "stats": {
      "mnd": 6,
      "int": 4,
      "mp": 40
    },
    "delayMs": 2400,
    "slot": "main",
    "jobRestrict": [
      "tim"
    ],
    "weaponFamily": "staff",
    "rarity": "Rare",
    "id": 1365
  },
  {
    "name": "Glentarge",
    "description": "Glentarge. A round for any job that will buckle it on.",
    "icon": "/icons/items/glentarge.png",
    "slug": "glentarge",
    "kind": "equipment",
    "craftLevel": 41,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 870,
      "materialsText": "Mythril Ingot×2, Slag Dust×1"
    },
    "stats": {
      "def": 14,
      "vit": 2
    },
    "slot": "sub",
    "jobRestrict": [
      "knight",
      "rogue",
      "cleric",
      "sorcerer",
      "fighter",
      "battlemage",
      "tim",
      "druid"
    ],
    "rarity": "Rare",
    "id": 1366
  },
  {
    "name": "Quilltarge",
    "description": "Quilltarge. A round for any job that will buckle it on.",
    "icon": "/icons/items/quilltarge.png",
    "slug": "quilltarge",
    "kind": "equipment",
    "craftLevel": 42,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 890,
      "materialsText": "Mythril Ingot×2, Slag Dust×1"
    },
    "stats": {
      "def": 14,
      "vit": 2
    },
    "slot": "sub",
    "jobRestrict": [
      "knight",
      "rogue",
      "cleric",
      "sorcerer",
      "fighter",
      "battlemage",
      "tim",
      "druid"
    ],
    "rarity": "Rare",
    "id": 1367
  },
  {
    "name": "Meretarge",
    "description": "Meretarge. A round for any job that will buckle it on.",
    "icon": "/icons/items/meretarge.png",
    "slug": "meretarge",
    "kind": "equipment",
    "craftLevel": 43,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 910,
      "materialsText": "Mythril Ingot×2, Slag Dust×1"
    },
    "stats": {
      "def": 15,
      "vit": 2
    },
    "slot": "sub",
    "jobRestrict": [
      "knight",
      "rogue",
      "cleric",
      "sorcerer",
      "fighter",
      "battlemage",
      "tim",
      "druid"
    ],
    "rarity": "Rare",
    "id": 1368
  },
  {
    "name": "Glenguard",
    "description": "Glenguard. A round for any job that will buckle it on.",
    "icon": "/icons/items/glenguard.png",
    "slug": "glenguard",
    "kind": "equipment",
    "craftLevel": 44,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 930,
      "materialsText": "Mythril Ingot×2, Slag Dust×1"
    },
    "stats": {
      "def": 15,
      "vit": 2
    },
    "slot": "sub",
    "jobRestrict": [
      "rogue",
      "sorcerer",
      "fighter",
      "tim",
      "druid"
    ],
    "rarity": "Rare",
    "id": 1369
  },
  {
    "name": "Coilweave Cowl",
    "description": "Coilweave Cowl. Cut for Reach benches at this rank.",
    "icon": "/icons/items/coilweave-cowl.png",
    "slug": "coilweave-cowl",
    "kind": "equipment",
    "craftLevel": 61,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1270,
      "materialsText": "Velvet Cloth×1, Bell Dust×1"
    },
    "stats": {
      "def": 15,
      "mnd": 7,
      "mp": 67
    },
    "slot": "head",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Rare",
    "id": 1370
  },
  {
    "name": "Hexflax Cowl",
    "description": "Hexflax Cowl. Cut for Reach benches at this rank.",
    "icon": "/icons/items/hexflax-cowl.png",
    "slug": "hexflax-cowl",
    "kind": "equipment",
    "craftLevel": 62,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1290,
      "materialsText": "Velvet Cloth×1, Bell Dust×1"
    },
    "stats": {
      "def": 15,
      "mnd": 7,
      "mp": 68
    },
    "slot": "head",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Rare",
    "id": 1371
  },
  {
    "name": "Spellbraid Cowl",
    "description": "Spellbraid Cowl. Cut for Reach benches at this rank.",
    "icon": "/icons/items/spellbraid-cowl.png",
    "slug": "spellbraid-cowl",
    "kind": "equipment",
    "craftLevel": 63,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1310,
      "materialsText": "Velvet Cloth×1, Bell Dust×1"
    },
    "stats": {
      "def": 15,
      "mnd": 8,
      "mp": 69
    },
    "slot": "head",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Rare",
    "id": 1372
  },
  {
    "name": "Runeplate Helm",
    "description": "Runeplate Helm. Cut for Reach benches at this rank.",
    "icon": "/icons/items/runeplate-helm.png",
    "slug": "runeplate-helm",
    "kind": "equipment",
    "craftLevel": 64,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1330,
      "materialsText": "Darksteel Ingot×2, Bell Dust×1"
    },
    "stats": {
      "def": 17,
      "vit": 6,
      "hp": 51
    },
    "slot": "head",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Rare",
    "id": 1373
  },
  {
    "name": "Hexplate Helm",
    "description": "Hexplate Helm. Cut for Reach benches at this rank.",
    "icon": "/icons/items/hexplate-helm.png",
    "slug": "hexplate-helm",
    "kind": "equipment",
    "craftLevel": 65,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1350,
      "materialsText": "Darksteel Ingot×2, Bell Dust×1"
    },
    "stats": {
      "def": 17,
      "vit": 6,
      "hp": 52
    },
    "slot": "head",
    "jobRestrict": [
      "fighter"
    ],
    "rarity": "Epic",
    "id": 1374
  },
  {
    "name": "Hexhide Cap",
    "description": "Hexhide Cap. Cut for Reach benches at this rank.",
    "icon": "/icons/items/hexhide-cap.png",
    "slug": "hexhide-cap",
    "kind": "equipment",
    "craftLevel": 66,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1370,
      "materialsText": "Fine Leather×2, Bell Dust×1"
    },
    "stats": {
      "def": 16,
      "agi": 7,
      "dex": 5
    },
    "slot": "head",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Rare",
    "id": 1375
  },
  {
    "name": "Spellhide Cap",
    "description": "Spellhide Cap. Cut for Reach benches at this rank.",
    "icon": "/icons/items/spellhide-cap.png",
    "slug": "spellhide-cap",
    "kind": "equipment",
    "craftLevel": 67,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1390,
      "materialsText": "Fine Leather×2, Bell Dust×1"
    },
    "stats": {
      "def": 16,
      "agi": 7,
      "dex": 5
    },
    "slot": "head",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Rare",
    "id": 1376
  },
  {
    "name": "Braidhide Cap",
    "description": "Braidhide Cap. Cut for Reach benches at this rank.",
    "icon": "/icons/items/braidhide-cap.png",
    "slug": "braidhide-cap",
    "kind": "equipment",
    "craftLevel": 68,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1410,
      "materialsText": "Fine Leather×2, Bell Dust×1"
    },
    "stats": {
      "def": 16,
      "agi": 7,
      "dex": 5
    },
    "slot": "head",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Rare",
    "id": 1377
  },
  {
    "name": "Coilweave Robe",
    "description": "Coilweave Robe. Cut for Reach benches at this rank.",
    "icon": "/icons/items/coilweave-robe.png",
    "slug": "coilweave-robe",
    "kind": "equipment",
    "craftLevel": 61,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1270,
      "materialsText": "Velvet Cloth×3, Bell Dust×1"
    },
    "stats": {
      "def": 36,
      "mnd": 7,
      "mp": 67,
      "hp": 27,
      "int": 6
    },
    "slot": "body",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Rare",
    "id": 1378
  },
  {
    "name": "Hexflax Robe",
    "description": "Hexflax Robe. Cut for Reach benches at this rank.",
    "icon": "/icons/items/hexflax-robe.png",
    "slug": "hexflax-robe",
    "kind": "equipment",
    "craftLevel": 62,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1290,
      "materialsText": "Velvet Cloth×3, Bell Dust×1"
    },
    "stats": {
      "def": 36,
      "mnd": 7,
      "mp": 68,
      "hp": 28,
      "int": 6
    },
    "slot": "body",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Rare",
    "id": 1379
  },
  {
    "name": "Spellbraid Robe",
    "description": "Spellbraid Robe. Cut for Reach benches at this rank.",
    "icon": "/icons/items/spellbraid-robe.png",
    "slug": "spellbraid-robe",
    "kind": "equipment",
    "craftLevel": 63,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1310,
      "materialsText": "Velvet Cloth×3, Bell Dust×1"
    },
    "stats": {
      "def": 36,
      "mnd": 8,
      "mp": 69,
      "hp": 28,
      "int": 6
    },
    "slot": "body",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Rare",
    "id": 1380
  },
  {
    "name": "Runeoak Robe",
    "description": "Runeoak Robe. Cut for Reach benches at this rank.",
    "icon": "/icons/items/runeoak-robe.png",
    "slug": "runeoak-robe",
    "kind": "equipment",
    "craftLevel": 64,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1330,
      "materialsText": "Velvet Cloth×3, Bell Dust×1"
    },
    "stats": {
      "def": 37,
      "mnd": 8,
      "mp": 70,
      "hp": 29,
      "int": 6
    },
    "slot": "body",
    "jobRestrict": [
      "battlemage",
      "cleric",
      "druid"
    ],
    "rarity": "Rare",
    "id": 1381
  },
  {
    "name": "Runeplate Mail",
    "description": "Runeplate Mail. Cut for Reach benches at this rank.",
    "icon": "/icons/items/runeplate-mail.png",
    "slug": "runeplate-mail",
    "kind": "equipment",
    "craftLevel": 65,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1350,
      "materialsText": "Darksteel Ingot×3, Bell Dust×1"
    },
    "stats": {
      "def": 39,
      "vit": 6,
      "hp": 52
    },
    "slot": "body",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Rare",
    "id": 1382
  },
  {
    "name": "Hexplate Mail",
    "description": "Hexplate Mail. Cut for Reach benches at this rank.",
    "icon": "/icons/items/hexplate-mail.png",
    "slug": "hexplate-mail",
    "kind": "equipment",
    "craftLevel": 66,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1370,
      "materialsText": "Darksteel Ingot×3, Bell Dust×1"
    },
    "stats": {
      "def": 40,
      "vit": 7,
      "hp": 53
    },
    "slot": "body",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Epic",
    "id": 1383
  },
  {
    "name": "Coilplate Mail",
    "description": "Coilplate Mail. Cut for Reach benches at this rank.",
    "icon": "/icons/items/coilplate-mail.png",
    "slug": "coilplate-mail",
    "kind": "equipment",
    "craftLevel": 67,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1390,
      "materialsText": "Darksteel Ingot×3, Bell Dust×1"
    },
    "stats": {
      "def": 40,
      "vit": 7,
      "hp": 54
    },
    "slot": "body",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Rare",
    "id": 1384
  },
  {
    "name": "Spellplate Mail",
    "description": "Spellplate Mail. Cut for Reach benches at this rank.",
    "icon": "/icons/items/spellplate-mail.png",
    "slug": "spellplate-mail",
    "kind": "equipment",
    "craftLevel": 68,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1410,
      "materialsText": "Darksteel Ingot×3, Bell Dust×1"
    },
    "stats": {
      "def": 41,
      "vit": 7,
      "hp": 54
    },
    "slot": "body",
    "jobRestrict": [
      "fighter"
    ],
    "rarity": "Rare",
    "id": 1385
  },
  {
    "name": "Hexhide Vest",
    "description": "Hexhide Vest. Cut for Reach benches at this rank.",
    "icon": "/icons/items/hexhide-vest.png",
    "slug": "hexhide-vest",
    "kind": "equipment",
    "craftLevel": 69,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1430,
      "materialsText": "Fine Leather×3, Bell Dust×1"
    },
    "stats": {
      "def": 39,
      "agi": 7,
      "dex": 6,
      "hp": 34
    },
    "slot": "body",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Rare",
    "id": 1386
  },
  {
    "name": "Spellhide Vest",
    "description": "Spellhide Vest. Cut for Reach benches at this rank.",
    "icon": "/icons/items/spellhide-vest.png",
    "slug": "spellhide-vest",
    "kind": "equipment",
    "craftLevel": 70,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1450,
      "materialsText": "Fine Leather×3, Bell Dust×1"
    },
    "stats": {
      "def": 39,
      "agi": 7,
      "dex": 6,
      "hp": 35
    },
    "slot": "body",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Rare",
    "id": 1387
  },
  {
    "name": "Braidhide Vest",
    "description": "Braidhide Vest. Cut for Reach benches at this rank.",
    "icon": "/icons/items/braidhide-vest.png",
    "slug": "braidhide-vest",
    "kind": "equipment",
    "craftLevel": 71,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1470,
      "materialsText": "Fine Leather×3, Bell Dust×1"
    },
    "stats": {
      "def": 40,
      "agi": 7,
      "dex": 6,
      "hp": 36
    },
    "slot": "body",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Rare",
    "id": 1388
  },
  {
    "name": "Runehide Vest",
    "description": "Runehide Vest. Cut for Reach benches at this rank.",
    "icon": "/icons/items/runehide-vest.png",
    "slug": "runehide-vest",
    "kind": "equipment",
    "craftLevel": 72,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1490,
      "materialsText": "Fine Leather×3, Bell Dust×1"
    },
    "stats": {
      "def": 40,
      "agi": 7,
      "dex": 6,
      "hp": 36
    },
    "slot": "body",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Rare",
    "id": 1389
  },
  {
    "name": "Coilweave Cuffs",
    "description": "Coilweave Cuffs. Cut for Reach benches at this rank.",
    "icon": "/icons/items/coilweave-cuffs.png",
    "slug": "coilweave-cuffs",
    "kind": "equipment",
    "craftLevel": 61,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1270,
      "materialsText": "Velvet Cloth×1, Bell Dust×1"
    },
    "stats": {
      "def": 14,
      "mnd": 7,
      "mab": 6
    },
    "slot": "hands",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Rare",
    "id": 1390
  },
  {
    "name": "Hexflax Cuffs",
    "description": "Hexflax Cuffs. Cut for Reach benches at this rank.",
    "icon": "/icons/items/hexflax-cuffs.png",
    "slug": "hexflax-cuffs",
    "kind": "equipment",
    "craftLevel": 62,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1290,
      "materialsText": "Velvet Cloth×1, Bell Dust×1"
    },
    "stats": {
      "def": 14,
      "mnd": 7,
      "mab": 6
    },
    "slot": "hands",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Rare",
    "id": 1391
  },
  {
    "name": "Spellbraid Cuffs",
    "description": "Spellbraid Cuffs. Cut for Reach benches at this rank.",
    "icon": "/icons/items/spellbraid-cuffs.png",
    "slug": "spellbraid-cuffs",
    "kind": "equipment",
    "craftLevel": 63,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1310,
      "materialsText": "Velvet Cloth×1, Bell Dust×1"
    },
    "stats": {
      "def": 14,
      "mnd": 8,
      "mab": 6
    },
    "slot": "hands",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Rare",
    "id": 1392
  },
  {
    "name": "Runeplate Mittens",
    "description": "Runeplate Mittens. Cut for Reach benches at this rank.",
    "icon": "/icons/items/runeplate-mittens.png",
    "slug": "runeplate-mittens",
    "kind": "equipment",
    "craftLevel": 64,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1330,
      "materialsText": "Darksteel Ingot×2, Bell Dust×1"
    },
    "stats": {
      "def": 17,
      "vit": 6,
      "acc": 5
    },
    "slot": "hands",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Rare",
    "id": 1393
  },
  {
    "name": "Hexplate Mittens",
    "description": "Hexplate Mittens. Cut for Reach benches at this rank.",
    "icon": "/icons/items/hexplate-mittens.png",
    "slug": "hexplate-mittens",
    "kind": "equipment",
    "craftLevel": 65,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1350,
      "materialsText": "Darksteel Ingot×2, Bell Dust×1"
    },
    "stats": {
      "def": 17,
      "vit": 6,
      "acc": 5
    },
    "slot": "hands",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Epic",
    "id": 1394
  },
  {
    "name": "Coilplate Mittens",
    "description": "Coilplate Mittens. Cut for Reach benches at this rank.",
    "icon": "/icons/items/coilplate-mittens.png",
    "slug": "coilplate-mittens",
    "kind": "equipment",
    "craftLevel": 66,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1370,
      "materialsText": "Darksteel Ingot×2, Bell Dust×1"
    },
    "stats": {
      "def": 17,
      "vit": 7,
      "acc": 5
    },
    "slot": "hands",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Rare",
    "id": 1395
  },
  {
    "name": "Spellplate Mittens",
    "description": "Spellplate Mittens. Cut for Reach benches at this rank.",
    "icon": "/icons/items/spellplate-mittens.png",
    "slug": "spellplate-mittens",
    "kind": "equipment",
    "craftLevel": 67,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1390,
      "materialsText": "Darksteel Ingot×2, Bell Dust×1"
    },
    "stats": {
      "def": 17,
      "vit": 7,
      "acc": 5
    },
    "slot": "hands",
    "jobRestrict": [
      "fighter"
    ],
    "rarity": "Rare",
    "id": 1396
  },
  {
    "name": "Hexhide Gloves",
    "description": "Hexhide Gloves. Cut for Reach benches at this rank.",
    "icon": "/icons/items/hexhide-gloves.png",
    "slug": "hexhide-gloves",
    "kind": "equipment",
    "craftLevel": 68,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1410,
      "materialsText": "Fine Leather×2, Bell Dust×1"
    },
    "stats": {
      "def": 15,
      "agi": 7,
      "dex": 5
    },
    "slot": "hands",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Rare",
    "id": 1397
  },
  {
    "name": "Spellhide Gloves",
    "description": "Spellhide Gloves. Cut for Reach benches at this rank.",
    "icon": "/icons/items/spellhide-gloves.png",
    "slug": "spellhide-gloves",
    "kind": "equipment",
    "craftLevel": 69,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1430,
      "materialsText": "Fine Leather×2, Bell Dust×1"
    },
    "stats": {
      "def": 15,
      "agi": 7,
      "dex": 6
    },
    "slot": "hands",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Rare",
    "id": 1398
  },
  {
    "name": "Braidhide Gloves",
    "description": "Braidhide Gloves. Cut for Reach benches at this rank.",
    "icon": "/icons/items/braidhide-gloves.png",
    "slug": "braidhide-gloves",
    "kind": "equipment",
    "craftLevel": 70,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1450,
      "materialsText": "Fine Leather×2, Bell Dust×1"
    },
    "stats": {
      "def": 16,
      "agi": 7,
      "dex": 6
    },
    "slot": "hands",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Rare",
    "id": 1399
  },
  {
    "name": "Runehide Gloves",
    "description": "Runehide Gloves. Cut for Reach benches at this rank.",
    "icon": "/icons/items/runehide-gloves.png",
    "slug": "runehide-gloves",
    "kind": "equipment",
    "craftLevel": 71,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1470,
      "materialsText": "Fine Leather×2, Bell Dust×1"
    },
    "stats": {
      "def": 16,
      "agi": 7,
      "dex": 6
    },
    "slot": "hands",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Rare",
    "id": 1400
  },
  {
    "name": "Coilweave Slops",
    "description": "Coilweave Slops. Cut for Reach benches at this rank.",
    "icon": "/icons/items/coilweave-slops.png",
    "slug": "coilweave-slops",
    "kind": "equipment",
    "craftLevel": 61,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1270,
      "materialsText": "Velvet Cloth×1, Bell Dust×1"
    },
    "stats": {
      "def": 20,
      "mnd": 7,
      "mp": 67
    },
    "slot": "legs",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Rare",
    "id": 1401
  },
  {
    "name": "Hexflax Slops",
    "description": "Hexflax Slops. Cut for Reach benches at this rank.",
    "icon": "/icons/items/hexflax-slops.png",
    "slug": "hexflax-slops",
    "kind": "equipment",
    "craftLevel": 62,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1290,
      "materialsText": "Velvet Cloth×1, Bell Dust×1"
    },
    "stats": {
      "def": 21,
      "mnd": 7,
      "mp": 68
    },
    "slot": "legs",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Rare",
    "id": 1402
  },
  {
    "name": "Spellbraid Slops",
    "description": "Spellbraid Slops. Cut for Reach benches at this rank.",
    "icon": "/icons/items/spellbraid-slops.png",
    "slug": "spellbraid-slops",
    "kind": "equipment",
    "craftLevel": 63,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1310,
      "materialsText": "Velvet Cloth×1, Bell Dust×1"
    },
    "stats": {
      "def": 21,
      "mnd": 8,
      "mp": 69
    },
    "slot": "legs",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Rare",
    "id": 1403
  },
  {
    "name": "Runeoak Slops",
    "description": "Runeoak Slops. Cut for Reach benches at this rank.",
    "icon": "/icons/items/runeoak-slops.png",
    "slug": "runeoak-slops",
    "kind": "equipment",
    "craftLevel": 64,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1330,
      "materialsText": "Velvet Cloth×1, Bell Dust×1"
    },
    "stats": {
      "def": 21,
      "mnd": 8,
      "mp": 70
    },
    "slot": "legs",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Rare",
    "id": 1404
  },
  {
    "name": "Runeplate Cuisses",
    "description": "Runeplate Cuisses. Cut for Reach benches at this rank.",
    "icon": "/icons/items/runeplate-cuisses.png",
    "slug": "runeplate-cuisses",
    "kind": "equipment",
    "craftLevel": 65,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1350,
      "materialsText": "Darksteel Ingot×2, Bell Dust×1"
    },
    "stats": {
      "def": 23,
      "vit": 6,
      "hp": 52
    },
    "slot": "legs",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Rare",
    "id": 1405
  },
  {
    "name": "Hexplate Cuisses",
    "description": "Hexplate Cuisses. Cut for Reach benches at this rank.",
    "icon": "/icons/items/hexplate-cuisses.png",
    "slug": "hexplate-cuisses",
    "kind": "equipment",
    "craftLevel": 66,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1370,
      "materialsText": "Darksteel Ingot×2, Bell Dust×1"
    },
    "stats": {
      "def": 24,
      "vit": 7,
      "hp": 53
    },
    "slot": "legs",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Epic",
    "id": 1406
  },
  {
    "name": "Coilplate Cuisses",
    "description": "Coilplate Cuisses. Cut for Reach benches at this rank.",
    "icon": "/icons/items/coilplate-cuisses.png",
    "slug": "coilplate-cuisses",
    "kind": "equipment",
    "craftLevel": 67,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1390,
      "materialsText": "Darksteel Ingot×2, Bell Dust×1"
    },
    "stats": {
      "def": 24,
      "vit": 7,
      "hp": 54
    },
    "slot": "legs",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Rare",
    "id": 1407
  },
  {
    "name": "Hexhide Trousers",
    "description": "Hexhide Trousers. Cut for Reach benches at this rank.",
    "icon": "/icons/items/hexhide-trousers.png",
    "slug": "hexhide-trousers",
    "kind": "equipment",
    "craftLevel": 68,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1410,
      "materialsText": "Fine Leather×2, Bell Dust×1"
    },
    "stats": {
      "def": 22,
      "agi": 7,
      "hp": 41
    },
    "slot": "legs",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Rare",
    "id": 1408
  },
  {
    "name": "Spellhide Trousers",
    "description": "Spellhide Trousers. Cut for Reach benches at this rank.",
    "icon": "/icons/items/spellhide-trousers.png",
    "slug": "spellhide-trousers",
    "kind": "equipment",
    "craftLevel": 69,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1430,
      "materialsText": "Fine Leather×2, Bell Dust×1"
    },
    "stats": {
      "def": 22,
      "agi": 7,
      "hp": 41
    },
    "slot": "legs",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Rare",
    "id": 1409
  },
  {
    "name": "Braidhide Trousers",
    "description": "Braidhide Trousers. Cut for Reach benches at this rank.",
    "icon": "/icons/items/braidhide-trousers.png",
    "slug": "braidhide-trousers",
    "kind": "equipment",
    "craftLevel": 70,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1450,
      "materialsText": "Fine Leather×2, Bell Dust×1"
    },
    "stats": {
      "def": 22,
      "agi": 7,
      "hp": 42
    },
    "slot": "legs",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Rare",
    "id": 1410
  },
  {
    "name": "Coilweave Sandals",
    "description": "Coilweave Sandals. Cut for Reach benches at this rank.",
    "icon": "/icons/items/coilweave-sandals.png",
    "slug": "coilweave-sandals",
    "kind": "equipment",
    "craftLevel": 61,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1270,
      "materialsText": "Velvet Cloth×1, Bell Dust×1"
    },
    "stats": {
      "def": 15,
      "mp": 67,
      "agi": 4
    },
    "slot": "feet",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Rare",
    "id": 1411
  },
  {
    "name": "Hexflax Sandals",
    "description": "Hexflax Sandals. Cut for Reach benches at this rank.",
    "icon": "/icons/items/hexflax-sandals.png",
    "slug": "hexflax-sandals",
    "kind": "equipment",
    "craftLevel": 62,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1290,
      "materialsText": "Velvet Cloth×1, Bell Dust×1"
    },
    "stats": {
      "def": 15,
      "mp": 68,
      "agi": 4
    },
    "slot": "feet",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Rare",
    "id": 1412
  },
  {
    "name": "Spellbraid Sandals",
    "description": "Spellbraid Sandals. Cut for Reach benches at this rank.",
    "icon": "/icons/items/spellbraid-sandals.png",
    "slug": "spellbraid-sandals",
    "kind": "equipment",
    "craftLevel": 63,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1310,
      "materialsText": "Velvet Cloth×1, Bell Dust×1"
    },
    "stats": {
      "def": 15,
      "mp": 69,
      "agi": 4
    },
    "slot": "feet",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Rare",
    "id": 1413
  },
  {
    "name": "Runeoak Sandals",
    "description": "Runeoak Sandals. Cut for Reach benches at this rank.",
    "icon": "/icons/items/runeoak-sandals.png",
    "slug": "runeoak-sandals",
    "kind": "equipment",
    "craftLevel": 64,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1330,
      "materialsText": "Velvet Cloth×1, Bell Dust×1"
    },
    "stats": {
      "def": 15,
      "mp": 70,
      "agi": 4
    },
    "slot": "feet",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Rare",
    "id": 1414
  },
  {
    "name": "Runeplate Sabatons",
    "description": "Runeplate Sabatons. Cut for Reach benches at this rank.",
    "icon": "/icons/items/runeplate-sabatons.png",
    "slug": "runeplate-sabatons",
    "kind": "equipment",
    "craftLevel": 65,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1350,
      "materialsText": "Darksteel Ingot×2, Bell Dust×1"
    },
    "stats": {
      "def": 17,
      "vit": 6,
      "hp": 52,
      "agi": 4
    },
    "slot": "feet",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Rare",
    "id": 1415
  },
  {
    "name": "Hexplate Sabatons",
    "description": "Hexplate Sabatons. Cut for Reach benches at this rank.",
    "icon": "/icons/items/hexplate-sabatons.png",
    "slug": "hexplate-sabatons",
    "kind": "equipment",
    "craftLevel": 66,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1370,
      "materialsText": "Darksteel Ingot×2, Bell Dust×1"
    },
    "stats": {
      "def": 18,
      "vit": 7,
      "hp": 53,
      "agi": 4
    },
    "slot": "feet",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Epic",
    "id": 1416
  },
  {
    "name": "Coilplate Sabatons",
    "description": "Coilplate Sabatons. Cut for Reach benches at this rank.",
    "icon": "/icons/items/coilplate-sabatons.png",
    "slug": "coilplate-sabatons",
    "kind": "equipment",
    "craftLevel": 67,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1390,
      "materialsText": "Darksteel Ingot×2, Bell Dust×1"
    },
    "stats": {
      "def": 18,
      "vit": 7,
      "hp": 54,
      "agi": 4
    },
    "slot": "feet",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Rare",
    "id": 1417
  },
  {
    "name": "Spellplate Sabatons",
    "description": "Spellplate Sabatons. Cut for Reach benches at this rank.",
    "icon": "/icons/items/spellplate-sabatons.png",
    "slug": "spellplate-sabatons",
    "kind": "equipment",
    "craftLevel": 68,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1410,
      "materialsText": "Darksteel Ingot×2, Bell Dust×1"
    },
    "stats": {
      "def": 18,
      "vit": 7,
      "hp": 54,
      "agi": 4
    },
    "slot": "feet",
    "jobRestrict": [
      "fighter"
    ],
    "rarity": "Rare",
    "id": 1418
  },
  {
    "name": "Hexhide Boots",
    "description": "Hexhide Boots. Cut for Reach benches at this rank.",
    "icon": "/icons/items/hexhide-boots.png",
    "slug": "hexhide-boots",
    "kind": "equipment",
    "craftLevel": 69,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1430,
      "materialsText": "Fine Leather×2, Bell Dust×1"
    },
    "stats": {
      "def": 16,
      "agi": 7,
      "dex": 6
    },
    "slot": "feet",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Rare",
    "id": 1419
  },
  {
    "name": "Spellhide Boots",
    "description": "Spellhide Boots. Cut for Reach benches at this rank.",
    "icon": "/icons/items/spellhide-boots.png",
    "slug": "spellhide-boots",
    "kind": "equipment",
    "craftLevel": 70,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1450,
      "materialsText": "Fine Leather×2, Bell Dust×1"
    },
    "stats": {
      "def": 16,
      "agi": 7,
      "dex": 6
    },
    "slot": "feet",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Rare",
    "id": 1420
  },
  {
    "name": "Braidhide Boots",
    "description": "Braidhide Boots. Cut for Reach benches at this rank.",
    "icon": "/icons/items/braidhide-boots.png",
    "slug": "braidhide-boots",
    "kind": "equipment",
    "craftLevel": 71,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1470,
      "materialsText": "Fine Leather×2, Bell Dust×1"
    },
    "stats": {
      "def": 16,
      "agi": 7,
      "dex": 6
    },
    "slot": "feet",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Rare",
    "id": 1421
  },
  {
    "name": "Runehide Boots",
    "description": "Runehide Boots. Cut for Reach benches at this rank.",
    "icon": "/icons/items/runehide-boots.png",
    "slug": "runehide-boots",
    "kind": "equipment",
    "craftLevel": 72,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1490,
      "materialsText": "Fine Leather×2, Bell Dust×1"
    },
    "stats": {
      "def": 17,
      "agi": 7,
      "dex": 6
    },
    "slot": "feet",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Rare",
    "id": 1422
  },
  {
    "name": "Runeoak Club",
    "description": "Runeoak Club. A club for this rank's line.",
    "icon": "/icons/items/runeoak-club.png",
    "slug": "runeoak-club",
    "kind": "equipment",
    "craftLevel": 61,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1270,
      "materialsText": "Darksteel Ingot×2, Bell Dust×1"
    },
    "stats": {
      "atk": 30,
      "mnd": 5
    },
    "delayMs": 2400,
    "slot": "main",
    "jobRestrict": [
      "cleric",
      "battlemage",
      "knight",
      "druid"
    ],
    "weaponFamily": "club",
    "rarity": "Rare",
    "id": 1423
  },
  {
    "name": "Hexoak Club",
    "description": "Hexoak Club. A club for this rank's line.",
    "icon": "/icons/items/hexoak-club.png",
    "slug": "hexoak-club",
    "kind": "equipment",
    "craftLevel": 62,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1290,
      "materialsText": "Darksteel Ingot×2, Bell Dust×1"
    },
    "stats": {
      "atk": 30,
      "mnd": 5
    },
    "delayMs": 2400,
    "slot": "main",
    "jobRestrict": [
      "cleric",
      "battlemage",
      "knight",
      "druid"
    ],
    "weaponFamily": "club",
    "rarity": "Rare",
    "id": 1424
  },
  {
    "name": "Spellsteel Staff",
    "description": "Spellsteel Staff. A staff for this rank's line.",
    "icon": "/icons/items/spellsteel-staff.png",
    "slug": "spellsteel-staff",
    "kind": "equipment",
    "craftLevel": 63,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 1310,
      "materialsText": "Bellwood Lumber×2, Bell Dust×1"
    },
    "stats": {
      "mnd": 8,
      "int": 5,
      "mp": 57
    },
    "delayMs": 2400,
    "slot": "main",
    "jobRestrict": [
      "tim",
      "cleric"
    ],
    "weaponFamily": "staff",
    "rarity": "Rare",
    "id": 1425
  },
  {
    "name": "Coilsteel Dagger",
    "description": "Coilsteel Dagger. A dagger for this rank's line.",
    "icon": "/icons/items/coilsteel-dagger.png",
    "slug": "coilsteel-dagger",
    "kind": "equipment",
    "craftLevel": 64,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1330,
      "materialsText": "Darksteel Ingot×2, Bell Dust×1"
    },
    "stats": {
      "atk": 28,
      "dex": 8
    },
    "delayMs": 1800,
    "slot": "main",
    "jobRestrict": [
      "rogue",
      "battlemage"
    ],
    "weaponFamily": "dagger",
    "rarity": "Rare",
    "id": 1426
  },
  {
    "name": "Runeoak Rod",
    "description": "Runeoak Rod. A staff for this rank's line.",
    "icon": "/icons/items/runeoak-rod.png",
    "slug": "runeoak-rod",
    "kind": "equipment",
    "craftLevel": 65,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 1350,
      "materialsText": "Bellwood Lumber×2, Bell Dust×1"
    },
    "stats": {
      "mnd": 8,
      "int": 5,
      "mp": 58
    },
    "delayMs": 2400,
    "slot": "main",
    "jobRestrict": [
      "tim"
    ],
    "weaponFamily": "staff",
    "rarity": "Rare",
    "id": 1427
  },
  {
    "name": "Hexoak Kris",
    "description": "Hexoak Kris. A dagger for this rank's line.",
    "icon": "/icons/items/hexoak-kris.png",
    "slug": "hexoak-kris",
    "kind": "equipment",
    "craftLevel": 66,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1370,
      "materialsText": "Darksteel Ingot×2, Bell Dust×1"
    },
    "stats": {
      "atk": 29,
      "dex": 8
    },
    "delayMs": 1800,
    "slot": "main",
    "jobRestrict": [
      "rogue"
    ],
    "weaponFamily": "dagger",
    "rarity": "Rare",
    "id": 1428
  },
  {
    "name": "Runetarge",
    "description": "Runetarge. A round for any job that will buckle it on.",
    "icon": "/icons/items/runetarge.png",
    "slug": "runetarge",
    "kind": "equipment",
    "craftLevel": 61,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1270,
      "materialsText": "Darksteel Ingot×2, Bell Dust×1"
    },
    "stats": {
      "def": 18,
      "vit": 3
    },
    "slot": "sub",
    "jobRestrict": [
      "knight",
      "rogue",
      "cleric",
      "sorcerer",
      "fighter",
      "battlemage",
      "tim",
      "druid"
    ],
    "rarity": "Rare",
    "id": 1429
  },
  {
    "name": "Hextarge",
    "description": "Hextarge. A round for any job that will buckle it on.",
    "icon": "/icons/items/hextarge.png",
    "slug": "hextarge",
    "kind": "equipment",
    "craftLevel": 62,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1290,
      "materialsText": "Darksteel Ingot×2, Bell Dust×1"
    },
    "stats": {
      "def": 18,
      "vit": 3
    },
    "slot": "sub",
    "jobRestrict": [
      "knight",
      "rogue",
      "cleric",
      "sorcerer",
      "fighter",
      "battlemage",
      "tim",
      "druid"
    ],
    "rarity": "Rare",
    "id": 1430
  },
  {
    "name": "Spelltarge",
    "description": "Spelltarge. A round for any job that will buckle it on.",
    "icon": "/icons/items/spelltarge.png",
    "slug": "spelltarge",
    "kind": "equipment",
    "craftLevel": 63,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1310,
      "materialsText": "Darksteel Ingot×2, Bell Dust×1"
    },
    "stats": {
      "def": 19,
      "vit": 3
    },
    "slot": "sub",
    "jobRestrict": [
      "knight",
      "rogue",
      "cleric",
      "sorcerer",
      "fighter",
      "battlemage",
      "tim",
      "druid"
    ],
    "rarity": "Rare",
    "id": 1431
  },
  {
    "name": "Coiltarge",
    "description": "Coiltarge. A round for any job that will buckle it on.",
    "icon": "/icons/items/coiltarge.png",
    "slug": "coiltarge",
    "kind": "equipment",
    "craftLevel": 64,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1330,
      "materialsText": "Darksteel Ingot×2, Bell Dust×1"
    },
    "stats": {
      "def": 19,
      "vit": 3
    },
    "slot": "sub",
    "jobRestrict": [
      "rogue",
      "cleric",
      "sorcerer",
      "fighter",
      "battlemage",
      "tim",
      "druid"
    ],
    "rarity": "Rare",
    "id": 1432
  },
  {
    "name": "Runeguard",
    "description": "Runeguard. A round for any job that will buckle it on.",
    "icon": "/icons/items/runeguard.png",
    "slug": "runeguard",
    "kind": "equipment",
    "craftLevel": 65,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1350,
      "materialsText": "Darksteel Ingot×2, Bell Dust×1"
    },
    "stats": {
      "def": 19,
      "vit": 3
    },
    "slot": "sub",
    "jobRestrict": [
      "rogue",
      "sorcerer",
      "fighter",
      "tim",
      "druid"
    ],
    "rarity": "Rare",
    "id": 1433
  },
  {
    "name": "Voidbraid Cowl",
    "description": "Voidbraid Cowl. Cut for Reach benches at this rank.",
    "icon": "/icons/items/voidbraid-cowl.png",
    "slug": "voidbraid-cowl",
    "kind": "equipment",
    "craftLevel": 81,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1670,
      "materialsText": "Velvet Cloth×1, Throne Dust×1"
    },
    "stats": {
      "def": 18,
      "mnd": 10,
      "mp": 89
    },
    "slot": "head",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Epic",
    "id": 1434
  },
  {
    "name": "Aetherweave Cowl",
    "description": "Aetherweave Cowl. Cut for Reach benches at this rank.",
    "icon": "/icons/items/aetherweave-cowl.png",
    "slug": "aetherweave-cowl",
    "kind": "equipment",
    "craftLevel": 82,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1690,
      "materialsText": "Velvet Cloth×1, Throne Dust×1"
    },
    "stats": {
      "def": 18,
      "mnd": 10,
      "mp": 90
    },
    "slot": "head",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Epic",
    "id": 1435
  },
  {
    "name": "Hexweave Cowl",
    "description": "Hexweave Cowl. Cut for Reach benches at this rank.",
    "icon": "/icons/items/hexweave-cowl.png",
    "slug": "hexweave-cowl",
    "kind": "equipment",
    "craftLevel": 83,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1710,
      "materialsText": "Velvet Cloth×1, Throne Dust×1"
    },
    "stats": {
      "def": 18,
      "mnd": 10,
      "mp": 91
    },
    "slot": "head",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Epic",
    "id": 1436
  },
  {
    "name": "Stormbraid Cowl",
    "description": "Stormbraid Cowl. Cut for Reach benches at this rank.",
    "icon": "/icons/items/stormbraid-cowl.png",
    "slug": "stormbraid-cowl",
    "kind": "equipment",
    "craftLevel": 84,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1730,
      "materialsText": "Velvet Cloth×1, Throne Dust×1"
    },
    "stats": {
      "def": 18,
      "mnd": 10,
      "mp": 92
    },
    "slot": "head",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "druid"
    ],
    "rarity": "Epic",
    "id": 1437
  },
  {
    "name": "Voidplate Helm",
    "description": "Voidplate Helm. Cut for Reach benches at this rank.",
    "icon": "/icons/items/voidplate-helm.png",
    "slug": "voidplate-helm",
    "kind": "equipment",
    "craftLevel": 85,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1750,
      "materialsText": "Orichalcum Ingot×2, Throne Dust×1"
    },
    "stats": {
      "def": 21,
      "vit": 8,
      "hp": 68
    },
    "slot": "head",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Epic",
    "id": 1438
  },
  {
    "name": "Aetherplate Helm",
    "description": "Aetherplate Helm. Cut for Reach benches at this rank.",
    "icon": "/icons/items/aetherplate-helm.png",
    "slug": "aetherplate-helm",
    "kind": "equipment",
    "craftLevel": 86,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1770,
      "materialsText": "Orichalcum Ingot×2, Throne Dust×1"
    },
    "stats": {
      "def": 21,
      "vit": 9,
      "hp": 69
    },
    "slot": "head",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Epic",
    "id": 1439
  },
  {
    "name": "Stormplate Helm",
    "description": "Stormplate Helm. Cut for Reach benches at this rank.",
    "icon": "/icons/items/stormplate-helm.png",
    "slug": "stormplate-helm",
    "kind": "equipment",
    "craftLevel": 87,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1790,
      "materialsText": "Orichalcum Ingot×2, Throne Dust×1"
    },
    "stats": {
      "def": 21,
      "vit": 9,
      "hp": 70
    },
    "slot": "head",
    "jobRestrict": [
      "fighter"
    ],
    "rarity": "Epic",
    "id": 1440
  },
  {
    "name": "Crownplate Helm",
    "description": "Crownplate Helm. Cut for Reach benches at this rank.",
    "icon": "/icons/items/crownplate-helm.png",
    "slug": "crownplate-helm",
    "kind": "equipment",
    "craftLevel": 88,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1810,
      "materialsText": "Orichalcum Ingot×2, Throne Dust×1"
    },
    "stats": {
      "def": 21,
      "vit": 9,
      "hp": 70
    },
    "slot": "head",
    "jobRestrict": [
      "fighter"
    ],
    "rarity": "Legendary",
    "id": 1441
  },
  {
    "name": "Voidhide Cap",
    "description": "Voidhide Cap. Cut for Reach benches at this rank.",
    "icon": "/icons/items/voidhide-cap.png",
    "slug": "voidhide-cap",
    "kind": "equipment",
    "craftLevel": 89,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1830,
      "materialsText": "Fine Leather×2, Throne Dust×1"
    },
    "stats": {
      "def": 19,
      "agi": 9,
      "dex": 7
    },
    "slot": "head",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Epic",
    "id": 1442
  },
  {
    "name": "Stormhide Cap",
    "description": "Stormhide Cap. Cut for Reach benches at this rank.",
    "icon": "/icons/items/stormhide-cap.png",
    "slug": "stormhide-cap",
    "kind": "equipment",
    "craftLevel": 90,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1850,
      "materialsText": "Fine Leather×2, Throne Dust×1"
    },
    "stats": {
      "def": 19,
      "agi": 9,
      "dex": 7
    },
    "slot": "head",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Epic",
    "id": 1443
  },
  {
    "name": "Aetherhide Cap",
    "description": "Aetherhide Cap. Cut for Reach benches at this rank.",
    "icon": "/icons/items/aetherhide-cap.png",
    "slug": "aetherhide-cap",
    "kind": "equipment",
    "craftLevel": 91,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1870,
      "materialsText": "Fine Leather×2, Throne Dust×1"
    },
    "stats": {
      "def": 20,
      "agi": 9,
      "dex": 7
    },
    "slot": "head",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Epic",
    "id": 1444
  },
  {
    "name": "Nighthide Cap",
    "description": "Nighthide Cap. Cut for Reach benches at this rank.",
    "icon": "/icons/items/nighthide-cap.png",
    "slug": "nighthide-cap",
    "kind": "equipment",
    "craftLevel": 92,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1890,
      "materialsText": "Fine Leather×2, Throne Dust×1"
    },
    "stats": {
      "def": 20,
      "agi": 9,
      "dex": 7
    },
    "slot": "head",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Epic",
    "id": 1445
  },
  {
    "name": "Voidbraid Robe",
    "description": "Voidbraid Robe. Cut for Reach benches at this rank.",
    "icon": "/icons/items/voidbraid-robe.png",
    "slug": "voidbraid-robe",
    "kind": "equipment",
    "craftLevel": 81,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1670,
      "materialsText": "Velvet Cloth×3, Diamond×1, Throne Dust×1"
    },
    "stats": {
      "def": 44,
      "mnd": 10,
      "mp": 89,
      "hp": 36,
      "int": 8
    },
    "slot": "body",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Epic",
    "id": 1446
  },
  {
    "name": "Aetherweave Robe",
    "description": "Aetherweave Robe. Cut for Reach benches at this rank.",
    "icon": "/icons/items/aetherweave-robe.png",
    "slug": "aetherweave-robe",
    "kind": "equipment",
    "craftLevel": 82,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1690,
      "materialsText": "Velvet Cloth×3, Diamond×1, Throne Dust×1"
    },
    "stats": {
      "def": 44,
      "mnd": 10,
      "mp": 90,
      "hp": 37,
      "int": 8
    },
    "slot": "body",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Epic",
    "id": 1447
  },
  {
    "name": "Hexweave Robe",
    "description": "Hexweave Robe. Cut for Reach benches at this rank.",
    "icon": "/icons/items/hexweave-robe.png",
    "slug": "hexweave-robe",
    "kind": "equipment",
    "craftLevel": 83,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1710,
      "materialsText": "Velvet Cloth×3, Diamond×1, Throne Dust×1"
    },
    "stats": {
      "def": 45,
      "mnd": 10,
      "mp": 91,
      "hp": 37,
      "int": 8
    },
    "slot": "body",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Epic",
    "id": 1448
  },
  {
    "name": "Stormbraid Robe",
    "description": "Stormbraid Robe. Cut for Reach benches at this rank.",
    "icon": "/icons/items/stormbraid-robe.png",
    "slug": "stormbraid-robe",
    "kind": "equipment",
    "craftLevel": 84,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1730,
      "materialsText": "Velvet Cloth×3, Diamond×1, Throne Dust×1"
    },
    "stats": {
      "def": 45,
      "mnd": 10,
      "mp": 92,
      "hp": 38,
      "int": 8
    },
    "slot": "body",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Epic",
    "id": 1449
  },
  {
    "name": "Nightweave Robe",
    "description": "Nightweave Robe. Cut for Reach benches at this rank.",
    "icon": "/icons/items/nightweave-robe.png",
    "slug": "nightweave-robe",
    "kind": "equipment",
    "craftLevel": 85,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1750,
      "materialsText": "Velvet Cloth×3, Diamond×1, Throne Dust×1"
    },
    "stats": {
      "def": 46,
      "mnd": 10,
      "mp": 94,
      "hp": 38,
      "int": 8
    },
    "slot": "body",
    "jobRestrict": [
      "druid"
    ],
    "rarity": "Epic",
    "id": 1450
  },
  {
    "name": "Voidplate Mail",
    "description": "Voidplate Mail. Cut for Reach benches at this rank.",
    "icon": "/icons/items/voidplate-mail.png",
    "slug": "voidplate-mail",
    "kind": "equipment",
    "craftLevel": 86,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1770,
      "materialsText": "Orichalcum Ingot×3, Throne Dust×1"
    },
    "stats": {
      "def": 48,
      "vit": 9,
      "hp": 69
    },
    "slot": "body",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Epic",
    "id": 1451
  },
  {
    "name": "Aetherplate Mail",
    "description": "Aetherplate Mail. Cut for Reach benches at this rank.",
    "icon": "/icons/items/aetherplate-mail.png",
    "slug": "aetherplate-mail",
    "kind": "equipment",
    "craftLevel": 87,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1790,
      "materialsText": "Orichalcum Ingot×3, Throne Dust×1"
    },
    "stats": {
      "def": 49,
      "vit": 9,
      "hp": 70
    },
    "slot": "body",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Epic",
    "id": 1452
  },
  {
    "name": "Stormplate Mail",
    "description": "Stormplate Mail. Cut for Reach benches at this rank.",
    "icon": "/icons/items/stormplate-mail.png",
    "slug": "stormplate-mail",
    "kind": "equipment",
    "craftLevel": 88,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1810,
      "materialsText": "Orichalcum Ingot×3, Throne Dust×1"
    },
    "stats": {
      "def": 49,
      "vit": 9,
      "hp": 70
    },
    "slot": "body",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Epic",
    "id": 1453
  },
  {
    "name": "Crownplate Mail",
    "description": "Crownplate Mail. Cut for Reach benches at this rank.",
    "icon": "/icons/items/crownplate-mail.png",
    "slug": "crownplate-mail",
    "kind": "equipment",
    "craftLevel": 89,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1830,
      "materialsText": "Orichalcum Ingot×3, Throne Dust×1"
    },
    "stats": {
      "def": 49,
      "vit": 9,
      "hp": 71
    },
    "slot": "body",
    "jobRestrict": [
      "fighter"
    ],
    "rarity": "Legendary",
    "id": 1454
  },
  {
    "name": "Voidhide Vest",
    "description": "Voidhide Vest. Cut for Reach benches at this rank.",
    "icon": "/icons/items/voidhide-vest.png",
    "slug": "voidhide-vest",
    "kind": "equipment",
    "craftLevel": 90,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1850,
      "materialsText": "Fine Leather×3, Throne Dust×1"
    },
    "stats": {
      "def": 48,
      "agi": 9,
      "dex": 7,
      "hp": 45
    },
    "slot": "body",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Epic",
    "id": 1455
  },
  {
    "name": "Stormhide Vest",
    "description": "Stormhide Vest. Cut for Reach benches at this rank.",
    "icon": "/icons/items/stormhide-vest.png",
    "slug": "stormhide-vest",
    "kind": "equipment",
    "craftLevel": 91,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1870,
      "materialsText": "Fine Leather×3, Throne Dust×1"
    },
    "stats": {
      "def": 48,
      "agi": 9,
      "dex": 7,
      "hp": 46
    },
    "slot": "body",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Epic",
    "id": 1456
  },
  {
    "name": "Aetherhide Vest",
    "description": "Aetherhide Vest. Cut for Reach benches at this rank.",
    "icon": "/icons/items/aetherhide-vest.png",
    "slug": "aetherhide-vest",
    "kind": "equipment",
    "craftLevel": 92,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1890,
      "materialsText": "Fine Leather×3, Throne Dust×1"
    },
    "stats": {
      "def": 49,
      "agi": 9,
      "dex": 7,
      "hp": 46
    },
    "slot": "body",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Epic",
    "id": 1457
  },
  {
    "name": "Nighthide Vest",
    "description": "Nighthide Vest. Cut for Reach benches at this rank.",
    "icon": "/icons/items/nighthide-vest.png",
    "slug": "nighthide-vest",
    "kind": "equipment",
    "craftLevel": 93,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1910,
      "materialsText": "Fine Leather×3, Throne Dust×1"
    },
    "stats": {
      "def": 49,
      "agi": 9,
      "dex": 7,
      "hp": 46
    },
    "slot": "body",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Epic",
    "id": 1458
  },
  {
    "name": "Voidbraid Cuffs",
    "description": "Voidbraid Cuffs. Cut for Reach benches at this rank.",
    "icon": "/icons/items/voidbraid-cuffs.png",
    "slug": "voidbraid-cuffs",
    "kind": "equipment",
    "craftLevel": 81,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1670,
      "materialsText": "Velvet Cloth×1, Throne Dust×1"
    },
    "stats": {
      "def": 17,
      "mnd": 10,
      "mab": 8
    },
    "slot": "hands",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Epic",
    "id": 1459
  },
  {
    "name": "Aetherweave Cuffs",
    "description": "Aetherweave Cuffs. Cut for Reach benches at this rank.",
    "icon": "/icons/items/aetherweave-cuffs.png",
    "slug": "aetherweave-cuffs",
    "kind": "equipment",
    "craftLevel": 82,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1690,
      "materialsText": "Velvet Cloth×1, Throne Dust×1"
    },
    "stats": {
      "def": 17,
      "mnd": 10,
      "mab": 8
    },
    "slot": "hands",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Epic",
    "id": 1460
  },
  {
    "name": "Hexweave Cuffs",
    "description": "Hexweave Cuffs. Cut for Reach benches at this rank.",
    "icon": "/icons/items/hexweave-cuffs.png",
    "slug": "hexweave-cuffs",
    "kind": "equipment",
    "craftLevel": 83,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1710,
      "materialsText": "Velvet Cloth×1, Throne Dust×1"
    },
    "stats": {
      "def": 17,
      "mnd": 10,
      "mab": 8
    },
    "slot": "hands",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Epic",
    "id": 1461
  },
  {
    "name": "Stormbraid Cuffs",
    "description": "Stormbraid Cuffs. Cut for Reach benches at this rank.",
    "icon": "/icons/items/stormbraid-cuffs.png",
    "slug": "stormbraid-cuffs",
    "kind": "equipment",
    "craftLevel": 84,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1730,
      "materialsText": "Velvet Cloth×1, Throne Dust×1"
    },
    "stats": {
      "def": 18,
      "mnd": 10,
      "mab": 8
    },
    "slot": "hands",
    "jobRestrict": [
      "battlemage",
      "cleric",
      "druid"
    ],
    "rarity": "Epic",
    "id": 1462
  },
  {
    "name": "Voidplate Mittens",
    "description": "Voidplate Mittens. Cut for Reach benches at this rank.",
    "icon": "/icons/items/voidplate-mittens.png",
    "slug": "voidplate-mittens",
    "kind": "equipment",
    "craftLevel": 85,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1750,
      "materialsText": "Orichalcum Ingot×2, Throne Dust×1"
    },
    "stats": {
      "def": 20,
      "vit": 8,
      "acc": 7
    },
    "slot": "hands",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Epic",
    "id": 1463
  },
  {
    "name": "Aetherplate Mittens",
    "description": "Aetherplate Mittens. Cut for Reach benches at this rank.",
    "icon": "/icons/items/aetherplate-mittens.png",
    "slug": "aetherplate-mittens",
    "kind": "equipment",
    "craftLevel": 86,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1770,
      "materialsText": "Orichalcum Ingot×2, Throne Dust×1"
    },
    "stats": {
      "def": 20,
      "vit": 9,
      "acc": 7
    },
    "slot": "hands",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Epic",
    "id": 1464
  },
  {
    "name": "Stormplate Mittens",
    "description": "Stormplate Mittens. Cut for Reach benches at this rank.",
    "icon": "/icons/items/stormplate-mittens.png",
    "slug": "stormplate-mittens",
    "kind": "equipment",
    "craftLevel": 87,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1790,
      "materialsText": "Orichalcum Ingot×2, Throne Dust×1"
    },
    "stats": {
      "def": 20,
      "vit": 9,
      "acc": 7
    },
    "slot": "hands",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Epic",
    "id": 1465
  },
  {
    "name": "Voidhide Gloves",
    "description": "Voidhide Gloves. Cut for Reach benches at this rank.",
    "icon": "/icons/items/voidhide-gloves.png",
    "slug": "voidhide-gloves",
    "kind": "equipment",
    "craftLevel": 88,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1810,
      "materialsText": "Fine Leather×2, Throne Dust×1"
    },
    "stats": {
      "def": 18,
      "agi": 9,
      "dex": 7
    },
    "slot": "hands",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Epic",
    "id": 1466
  },
  {
    "name": "Stormhide Gloves",
    "description": "Stormhide Gloves. Cut for Reach benches at this rank.",
    "icon": "/icons/items/stormhide-gloves.png",
    "slug": "stormhide-gloves",
    "kind": "equipment",
    "craftLevel": 89,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1830,
      "materialsText": "Fine Leather×2, Throne Dust×1"
    },
    "stats": {
      "def": 18,
      "agi": 9,
      "dex": 7
    },
    "slot": "hands",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Epic",
    "id": 1467
  },
  {
    "name": "Aetherhide Gloves",
    "description": "Aetherhide Gloves. Cut for Reach benches at this rank.",
    "icon": "/icons/items/aetherhide-gloves.png",
    "slug": "aetherhide-gloves",
    "kind": "equipment",
    "craftLevel": 90,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1850,
      "materialsText": "Fine Leather×2, Throne Dust×1"
    },
    "stats": {
      "def": 18,
      "agi": 9,
      "dex": 7
    },
    "slot": "hands",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Epic",
    "id": 1468
  },
  {
    "name": "Voidbraid Slops",
    "description": "Voidbraid Slops. Cut for Reach benches at this rank.",
    "icon": "/icons/items/voidbraid-slops.png",
    "slug": "voidbraid-slops",
    "kind": "equipment",
    "craftLevel": 81,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1670,
      "materialsText": "Velvet Cloth×1, Throne Dust×1"
    },
    "stats": {
      "def": 25,
      "mnd": 10,
      "mp": 89
    },
    "slot": "legs",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Epic",
    "id": 1469
  },
  {
    "name": "Aetherweave Slops",
    "description": "Aetherweave Slops. Cut for Reach benches at this rank.",
    "icon": "/icons/items/aetherweave-slops.png",
    "slug": "aetherweave-slops",
    "kind": "equipment",
    "craftLevel": 82,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1690,
      "materialsText": "Velvet Cloth×1, Throne Dust×1"
    },
    "stats": {
      "def": 25,
      "mnd": 10,
      "mp": 90
    },
    "slot": "legs",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Epic",
    "id": 1470
  },
  {
    "name": "Hexweave Slops",
    "description": "Hexweave Slops. Cut for Reach benches at this rank.",
    "icon": "/icons/items/hexweave-slops.png",
    "slug": "hexweave-slops",
    "kind": "equipment",
    "craftLevel": 83,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1710,
      "materialsText": "Velvet Cloth×1, Throne Dust×1"
    },
    "stats": {
      "def": 25,
      "mnd": 10,
      "mp": 91
    },
    "slot": "legs",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Epic",
    "id": 1471
  },
  {
    "name": "Stormbraid Slops",
    "description": "Stormbraid Slops. Cut for Reach benches at this rank.",
    "icon": "/icons/items/stormbraid-slops.png",
    "slug": "stormbraid-slops",
    "kind": "equipment",
    "craftLevel": 84,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1730,
      "materialsText": "Velvet Cloth×1, Throne Dust×1"
    },
    "stats": {
      "def": 25,
      "mnd": 10,
      "mp": 92
    },
    "slot": "legs",
    "jobRestrict": [
      "battlemage",
      "cleric",
      "druid"
    ],
    "rarity": "Epic",
    "id": 1472
  },
  {
    "name": "Voidplate Cuisses",
    "description": "Voidplate Cuisses. Cut for Reach benches at this rank.",
    "icon": "/icons/items/voidplate-cuisses.png",
    "slug": "voidplate-cuisses",
    "kind": "equipment",
    "craftLevel": 85,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1750,
      "materialsText": "Orichalcum Ingot×2, Throne Dust×1"
    },
    "stats": {
      "def": 28,
      "vit": 8,
      "hp": 68
    },
    "slot": "legs",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Epic",
    "id": 1473
  },
  {
    "name": "Aetherplate Cuisses",
    "description": "Aetherplate Cuisses. Cut for Reach benches at this rank.",
    "icon": "/icons/items/aetherplate-cuisses.png",
    "slug": "aetherplate-cuisses",
    "kind": "equipment",
    "craftLevel": 86,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1770,
      "materialsText": "Orichalcum Ingot×2, Throne Dust×1"
    },
    "stats": {
      "def": 28,
      "vit": 9,
      "hp": 69
    },
    "slot": "legs",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Epic",
    "id": 1474
  },
  {
    "name": "Stormplate Cuisses",
    "description": "Stormplate Cuisses. Cut for Reach benches at this rank.",
    "icon": "/icons/items/stormplate-cuisses.png",
    "slug": "stormplate-cuisses",
    "kind": "equipment",
    "craftLevel": 87,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1790,
      "materialsText": "Orichalcum Ingot×2, Throne Dust×1"
    },
    "stats": {
      "def": 28,
      "vit": 9,
      "hp": 70
    },
    "slot": "legs",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Epic",
    "id": 1475
  },
  {
    "name": "Crownplate Cuisses",
    "description": "Crownplate Cuisses. Cut for Reach benches at this rank.",
    "icon": "/icons/items/crownplate-cuisses.png",
    "slug": "crownplate-cuisses",
    "kind": "equipment",
    "craftLevel": 88,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1810,
      "materialsText": "Orichalcum Ingot×2, Throne Dust×1"
    },
    "stats": {
      "def": 28,
      "vit": 9,
      "hp": 70
    },
    "slot": "legs",
    "jobRestrict": [
      "fighter"
    ],
    "rarity": "Legendary",
    "id": 1476
  },
  {
    "name": "Voidhide Trousers",
    "description": "Voidhide Trousers. Cut for Reach benches at this rank.",
    "icon": "/icons/items/voidhide-trousers.png",
    "slug": "voidhide-trousers",
    "kind": "equipment",
    "craftLevel": 89,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1830,
      "materialsText": "Fine Leather×2, Throne Dust×1"
    },
    "stats": {
      "def": 27,
      "agi": 9,
      "hp": 53
    },
    "slot": "legs",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Epic",
    "id": 1477
  },
  {
    "name": "Stormhide Trousers",
    "description": "Stormhide Trousers. Cut for Reach benches at this rank.",
    "icon": "/icons/items/stormhide-trousers.png",
    "slug": "stormhide-trousers",
    "kind": "equipment",
    "craftLevel": 90,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1850,
      "materialsText": "Fine Leather×2, Throne Dust×1"
    },
    "stats": {
      "def": 27,
      "agi": 9,
      "hp": 54
    },
    "slot": "legs",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Epic",
    "id": 1478
  },
  {
    "name": "Aetherhide Trousers",
    "description": "Aetherhide Trousers. Cut for Reach benches at this rank.",
    "icon": "/icons/items/aetherhide-trousers.png",
    "slug": "aetherhide-trousers",
    "kind": "equipment",
    "craftLevel": 91,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1870,
      "materialsText": "Fine Leather×2, Throne Dust×1"
    },
    "stats": {
      "def": 27,
      "agi": 9,
      "hp": 55
    },
    "slot": "legs",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Epic",
    "id": 1479
  },
  {
    "name": "Nighthide Trousers",
    "description": "Nighthide Trousers. Cut for Reach benches at this rank.",
    "icon": "/icons/items/nighthide-trousers.png",
    "slug": "nighthide-trousers",
    "kind": "equipment",
    "craftLevel": 92,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1890,
      "materialsText": "Fine Leather×2, Throne Dust×1"
    },
    "stats": {
      "def": 27,
      "agi": 9,
      "hp": 55
    },
    "slot": "legs",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Epic",
    "id": 1480
  },
  {
    "name": "Voidbraid Sandals",
    "description": "Voidbraid Sandals. Cut for Reach benches at this rank.",
    "icon": "/icons/items/voidbraid-sandals.png",
    "slug": "voidbraid-sandals",
    "kind": "equipment",
    "craftLevel": 81,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1670,
      "materialsText": "Velvet Cloth×1, Throne Dust×1"
    },
    "stats": {
      "def": 18,
      "mp": 89,
      "agi": 5
    },
    "slot": "feet",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Epic",
    "id": 1481
  },
  {
    "name": "Aetherweave Sandals",
    "description": "Aetherweave Sandals. Cut for Reach benches at this rank.",
    "icon": "/icons/items/aetherweave-sandals.png",
    "slug": "aetherweave-sandals",
    "kind": "equipment",
    "craftLevel": 82,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1690,
      "materialsText": "Velvet Cloth×1, Throne Dust×1"
    },
    "stats": {
      "def": 18,
      "mp": 90,
      "agi": 5
    },
    "slot": "feet",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Epic",
    "id": 1482
  },
  {
    "name": "Hexweave Sandals",
    "description": "Hexweave Sandals. Cut for Reach benches at this rank.",
    "icon": "/icons/items/hexweave-sandals.png",
    "slug": "hexweave-sandals",
    "kind": "equipment",
    "craftLevel": 83,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1710,
      "materialsText": "Velvet Cloth×1, Throne Dust×1"
    },
    "stats": {
      "def": 18,
      "mp": 91,
      "agi": 5
    },
    "slot": "feet",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Epic",
    "id": 1483
  },
  {
    "name": "Stormbraid Sandals",
    "description": "Stormbraid Sandals. Cut for Reach benches at this rank.",
    "icon": "/icons/items/stormbraid-sandals.png",
    "slug": "stormbraid-sandals",
    "kind": "equipment",
    "craftLevel": 84,
    "craftSkill": "clothcraft",
    "recipe": {
      "gold": 1730,
      "materialsText": "Velvet Cloth×1, Throne Dust×1"
    },
    "stats": {
      "def": 18,
      "mp": 92,
      "agi": 5
    },
    "slot": "feet",
    "jobRestrict": [
      "battlemage",
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "rarity": "Epic",
    "id": 1484
  },
  {
    "name": "Voidplate Sabatons",
    "description": "Voidplate Sabatons. Cut for Reach benches at this rank.",
    "icon": "/icons/items/voidplate-sabatons.png",
    "slug": "voidplate-sabatons",
    "kind": "equipment",
    "craftLevel": 85,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1750,
      "materialsText": "Orichalcum Ingot×2, Throne Dust×1"
    },
    "stats": {
      "def": 21,
      "vit": 8,
      "hp": 68,
      "agi": 5
    },
    "slot": "feet",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Epic",
    "id": 1485
  },
  {
    "name": "Aetherplate Sabatons",
    "description": "Aetherplate Sabatons. Cut for Reach benches at this rank.",
    "icon": "/icons/items/aetherplate-sabatons.png",
    "slug": "aetherplate-sabatons",
    "kind": "equipment",
    "craftLevel": 86,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1770,
      "materialsText": "Orichalcum Ingot×2, Throne Dust×1"
    },
    "stats": {
      "def": 21,
      "vit": 9,
      "hp": 69,
      "agi": 5
    },
    "slot": "feet",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Epic",
    "id": 1486
  },
  {
    "name": "Stormplate Sabatons",
    "description": "Stormplate Sabatons. Cut for Reach benches at this rank.",
    "icon": "/icons/items/stormplate-sabatons.png",
    "slug": "stormplate-sabatons",
    "kind": "equipment",
    "craftLevel": 87,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1790,
      "materialsText": "Orichalcum Ingot×2, Throne Dust×1"
    },
    "stats": {
      "def": 21,
      "vit": 9,
      "hp": 70,
      "agi": 5
    },
    "slot": "feet",
    "jobRestrict": [
      "knight",
      "fighter"
    ],
    "rarity": "Epic",
    "id": 1487
  },
  {
    "name": "Crownplate Sabatons",
    "description": "Crownplate Sabatons. Cut for Reach benches at this rank.",
    "icon": "/icons/items/crownplate-sabatons.png",
    "slug": "crownplate-sabatons",
    "kind": "equipment",
    "craftLevel": 88,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1810,
      "materialsText": "Orichalcum Ingot×2, Throne Dust×1"
    },
    "stats": {
      "def": 21,
      "vit": 9,
      "hp": 70,
      "agi": 5
    },
    "slot": "feet",
    "jobRestrict": [
      "fighter"
    ],
    "rarity": "Legendary",
    "id": 1488
  },
  {
    "name": "Voidhide Boots",
    "description": "Voidhide Boots. Cut for Reach benches at this rank.",
    "icon": "/icons/items/voidhide-boots.png",
    "slug": "voidhide-boots",
    "kind": "equipment",
    "craftLevel": 89,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1830,
      "materialsText": "Fine Leather×2, Throne Dust×1"
    },
    "stats": {
      "def": 19,
      "agi": 9,
      "dex": 7
    },
    "slot": "feet",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Epic",
    "id": 1489
  },
  {
    "name": "Stormhide Boots",
    "description": "Stormhide Boots. Cut for Reach benches at this rank.",
    "icon": "/icons/items/stormhide-boots.png",
    "slug": "stormhide-boots",
    "kind": "equipment",
    "craftLevel": 90,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1850,
      "materialsText": "Fine Leather×2, Throne Dust×1"
    },
    "stats": {
      "def": 19,
      "agi": 9,
      "dex": 7
    },
    "slot": "feet",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Epic",
    "id": 1490
  },
  {
    "name": "Aetherhide Boots",
    "description": "Aetherhide Boots. Cut for Reach benches at this rank.",
    "icon": "/icons/items/aetherhide-boots.png",
    "slug": "aetherhide-boots",
    "kind": "equipment",
    "craftLevel": 91,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1870,
      "materialsText": "Fine Leather×2, Throne Dust×1"
    },
    "stats": {
      "def": 20,
      "agi": 9,
      "dex": 7
    },
    "slot": "feet",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Epic",
    "id": 1491
  },
  {
    "name": "Nighthide Boots",
    "description": "Nighthide Boots. Cut for Reach benches at this rank.",
    "icon": "/icons/items/nighthide-boots.png",
    "slug": "nighthide-boots",
    "kind": "equipment",
    "craftLevel": 92,
    "craftSkill": "leathercraft",
    "recipe": {
      "gold": 1890,
      "materialsText": "Fine Leather×2, Throne Dust×1"
    },
    "stats": {
      "def": 20,
      "agi": 9,
      "dex": 7
    },
    "slot": "feet",
    "jobRestrict": [
      "rogue"
    ],
    "rarity": "Epic",
    "id": 1492
  },
  {
    "name": "Voidoak Staff",
    "description": "Voidoak Staff. A staff for this rank's line.",
    "icon": "/icons/items/voidoak-staff.png",
    "slug": "voidoak-staff",
    "kind": "equipment",
    "craftLevel": 81,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 1670,
      "materialsText": "Bellwood Lumber×2, Throne Dust×1"
    },
    "stats": {
      "mnd": 10,
      "int": 6,
      "mp": 73
    },
    "delayMs": 2400,
    "slot": "main",
    "jobRestrict": [
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "weaponFamily": "staff",
    "rarity": "Epic",
    "id": 1493
  },
  {
    "name": "Aetheroak Staff",
    "description": "Aetheroak Staff. A staff for this rank's line.",
    "icon": "/icons/items/aetheroak-staff.png",
    "slug": "aetheroak-staff",
    "kind": "equipment",
    "craftLevel": 82,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 1690,
      "materialsText": "Bellwood Lumber×2, Throne Dust×1"
    },
    "stats": {
      "mnd": 10,
      "int": 7,
      "mp": 74
    },
    "delayMs": 2400,
    "slot": "main",
    "jobRestrict": [
      "tim",
      "sorcerer",
      "cleric",
      "druid"
    ],
    "weaponFamily": "staff",
    "rarity": "Epic",
    "id": 1494
  },
  {
    "name": "Stormsteel Staff",
    "description": "Stormsteel Staff. A staff for this rank's line.",
    "icon": "/icons/items/stormsteel-staff.png",
    "slug": "stormsteel-staff",
    "kind": "equipment",
    "craftLevel": 83,
    "craftSkill": "woodworking",
    "recipe": {
      "gold": 1710,
      "materialsText": "Bellwood Lumber×2, Throne Dust×1"
    },
    "stats": {
      "mnd": 10,
      "int": 7,
      "mp": 75
    },
    "delayMs": 2400,
    "slot": "main",
    "jobRestrict": [
      "tim",
      "sorcerer",
      "druid"
    ],
    "weaponFamily": "staff",
    "rarity": "Epic",
    "id": 1495
  },
  {
    "name": "Crownsteel Club",
    "description": "Crownsteel Club. A club for this rank's line.",
    "icon": "/icons/items/crownsteel-club.png",
    "slug": "crownsteel-club",
    "kind": "equipment",
    "craftLevel": 84,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1730,
      "materialsText": "Orichalcum Ingot×2, Throne Dust×1"
    },
    "stats": {
      "atk": 37,
      "mnd": 7
    },
    "delayMs": 2400,
    "slot": "main",
    "jobRestrict": [
      "battlemage",
      "knight",
      "druid"
    ],
    "weaponFamily": "club",
    "rarity": "Legendary",
    "id": 1496
  },
  {
    "name": "Voidoak Kris",
    "description": "Voidoak Kris. A dagger for this rank's line.",
    "icon": "/icons/items/voidoak-kris.png",
    "slug": "voidoak-kris",
    "kind": "equipment",
    "craftLevel": 85,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1750,
      "materialsText": "Orichalcum Ingot×2, Throne Dust×1"
    },
    "stats": {
      "atk": 36,
      "dex": 10
    },
    "delayMs": 1800,
    "slot": "main",
    "jobRestrict": [
      "rogue",
      "battlemage"
    ],
    "weaponFamily": "dagger",
    "rarity": "Epic",
    "id": 1497
  },
  {
    "name": "Aetheroak Kris",
    "description": "Aetheroak Kris. A dagger for this rank's line.",
    "icon": "/icons/items/aetheroak-kris.png",
    "slug": "aetheroak-kris",
    "kind": "equipment",
    "craftLevel": 86,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1770,
      "materialsText": "Orichalcum Ingot×2, Throne Dust×1"
    },
    "stats": {
      "atk": 37,
      "dex": 10
    },
    "delayMs": 1800,
    "slot": "main",
    "jobRestrict": [
      "rogue",
      "battlemage"
    ],
    "weaponFamily": "dagger",
    "rarity": "Epic",
    "id": 1498
  },
  {
    "name": "Stormsteel Kris",
    "description": "Stormsteel Kris. A dagger for this rank's line.",
    "icon": "/icons/items/stormsteel-kris.png",
    "slug": "stormsteel-kris",
    "kind": "equipment",
    "craftLevel": 87,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1790,
      "materialsText": "Orichalcum Ingot×2, Throne Dust×1"
    },
    "stats": {
      "atk": 37,
      "dex": 10
    },
    "delayMs": 1800,
    "slot": "main",
    "jobRestrict": [
      "rogue"
    ],
    "weaponFamily": "dagger",
    "rarity": "Epic",
    "id": 1499
  },
  {
    "name": "Crownsteel Kris",
    "description": "Crownsteel Kris. A dagger for this rank's line.",
    "icon": "/icons/items/crownsteel-kris.png",
    "slug": "crownsteel-kris",
    "kind": "equipment",
    "craftLevel": 88,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1810,
      "materialsText": "Orichalcum Ingot×2, Throne Dust×1"
    },
    "stats": {
      "atk": 37,
      "dex": 11
    },
    "delayMs": 1800,
    "slot": "main",
    "jobRestrict": [
      "rogue"
    ],
    "weaponFamily": "dagger",
    "rarity": "Legendary",
    "id": 1500
  },
  {
    "name": "Voidtarge",
    "description": "Voidtarge. A round for any job that will buckle it on.",
    "icon": "/icons/items/voidtarge.png",
    "slug": "voidtarge",
    "kind": "equipment",
    "craftLevel": 81,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1670,
      "materialsText": "Orichalcum Ingot×2, Throne Dust×1"
    },
    "stats": {
      "def": 22,
      "vit": 4
    },
    "slot": "sub",
    "jobRestrict": [
      "knight",
      "rogue",
      "cleric",
      "sorcerer",
      "fighter",
      "battlemage",
      "tim",
      "druid"
    ],
    "rarity": "Epic",
    "id": 1501
  },
  {
    "name": "Aethertarge",
    "description": "Aethertarge. A round for any job that will buckle it on.",
    "icon": "/icons/items/aethertarge.png",
    "slug": "aethertarge",
    "kind": "equipment",
    "craftLevel": 82,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1690,
      "materialsText": "Orichalcum Ingot×2, Throne Dust×1"
    },
    "stats": {
      "def": 22,
      "vit": 4
    },
    "slot": "sub",
    "jobRestrict": [
      "knight",
      "rogue",
      "cleric",
      "sorcerer",
      "fighter",
      "battlemage",
      "tim",
      "druid"
    ],
    "rarity": "Epic",
    "id": 1502
  },
  {
    "name": "Stormtarge",
    "description": "Stormtarge. A round for any job that will buckle it on.",
    "icon": "/icons/items/stormtarge.png",
    "slug": "stormtarge",
    "kind": "equipment",
    "craftLevel": 83,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1710,
      "materialsText": "Orichalcum Ingot×2, Throne Dust×1"
    },
    "stats": {
      "def": 23,
      "vit": 4
    },
    "slot": "sub",
    "jobRestrict": [
      "knight",
      "rogue",
      "cleric",
      "sorcerer",
      "fighter",
      "battlemage",
      "tim",
      "druid"
    ],
    "rarity": "Epic",
    "id": 1503
  },
  {
    "name": "Crowntarge",
    "description": "Crowntarge. A round for any job that will buckle it on.",
    "icon": "/icons/items/crowntarge.png",
    "slug": "crowntarge",
    "kind": "equipment",
    "craftLevel": 84,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1730,
      "materialsText": "Orichalcum Ingot×2, Throne Dust×1"
    },
    "stats": {
      "def": 23,
      "vit": 4
    },
    "slot": "sub",
    "jobRestrict": [
      "knight",
      "rogue",
      "sorcerer",
      "fighter",
      "tim",
      "druid"
    ],
    "rarity": "Legendary",
    "id": 1504
  },
  {
    "name": "Voidguard",
    "description": "Voidguard. A round for any job that will buckle it on.",
    "icon": "/icons/items/voidguard.png",
    "slug": "voidguard",
    "kind": "equipment",
    "craftLevel": 85,
    "craftSkill": "smithing",
    "recipe": {
      "gold": 1750,
      "materialsText": "Orichalcum Ingot×2, Throne Dust×1"
    },
    "stats": {
      "def": 23,
      "vit": 4
    },
    "slot": "sub",
    "jobRestrict": [
      "rogue",
      "sorcerer",
      "fighter",
      "tim",
      "druid"
    ],
    "rarity": "Epic",
    "id": 1505
  }
] as ItemDef[];

export const CATALOG_BY_ID: Record<number, ItemDef> = Object.fromEntries(
  CATALOG.map((i) => [i.id, i]),
) as Record<number, ItemDef>;

export const CATALOG_BY_SLUG: Record<string, ItemDef> = Object.fromEntries(
  CATALOG.map((i) => [i.slug, i]),
) as Record<string, ItemDef>;
