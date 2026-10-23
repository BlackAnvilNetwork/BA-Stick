/**
 * Pale Hollow field for the enlarged basin: 225 spawns, a roof only where
 * the ground already has a job, and a short kill quest at each roof.
 * Spacing is deterministic. Linked packs keep one neighbor inside 12 m.
 */
import {
  PH_ASH_ROAD,
  PH_CAMP_SHIFT_X,
  PH_CAMP_SHIFT_Z,
  PH_QUARRY_CUT,
  PH_SEAM_TUNNEL,
  PH_TIMBER_BRIDGE,
  PH_YARDS,
  paleHollowBiome,
  paleHollowInHubApron,
  paleHollowInOpenWater,
  paleHollowLakeDist,
  paleHollowOnBridge,
  paleHollowWalkable,
  PH_LAKE,
  paleHollowTributaryCenterX,
  type PaleHollowArchetype,
  type PaleHollowMobDef,
  type PaleHollowMobJob,
} from "./pale-hollow";

export type PaleHollowFieldNpc = {
  id: string;
  name: string;
  x: number;
  z: number;
  facing: number;
  role: "quest_giver";
  yardId: string;
};

export type PaleHollowQuestDef = {
  id: string;
  npcId: string;
  title: string;
  offer: string;
  progress: string;
  done: string;
  gold: number;
  need: number;
  mobIds: readonly string[];
};

export type PaleHollowQuestState = {
  zoneId: "pale_hollow";
  active: { id: string; kills: number } | null;
  done: string[];
};

const MIN_GAP = 6.5;

function hash(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function inRect(
  x: number,
  z: number,
  r: { minX: number; maxX: number; minZ: number; maxZ: number },
): boolean {
  return x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;
}

function yardBlocked(x: number, z: number): boolean {
  for (const y of PH_YARDS) {
    if (Math.hypot(x - y.x, z - y.z) < 8) return true;
  }
  return false;
}

function legal(x: number, z: number): boolean {
  if (!paleHollowWalkable(x, z) || paleHollowInOpenWater(x, z)) return false;
  if (paleHollowInHubApron(x, z) || paleHollowOnBridge(x, z)) return false;
  if (paleHollowLakeDist(x, z) < PH_LAKE.r) return false;
  if (inRect(x, z, PH_TIMBER_BRIDGE) || inRect(x, z, PH_QUARRY_CUT)) return false;
  if (inRect(x, z, PH_SEAM_TUNNEL) || inRect(x, z, PH_ASH_ROAD)) return false;
  if (yardBlocked(x, z)) return false;
  const b = paleHollowBiome(x, z);
  if (b === "river" || b === "bridge" || b === "mountain" || b === "hub_indoor" || b === "ash_road") return false;
  return true;
}

function grid(
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  step: number,
  ok: (x: number, z: number) => boolean,
): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [];
  for (let z = z0; z <= z1; z += step) {
    for (let x = x0; x <= x1; x += step) {
      if (ok(x, z) && legal(x, z)) out.push({ x, z });
    }
  }
  return out;
}

function chain(
  origin: { x: number; z: number },
  step: { x: number; z: number },
  n: number,
): { x: number; z: number }[] {
  const got: { x: number; z: number }[] = [];
  for (let i = 0; i < n; i++) {
    let spot: { x: number; z: number } | null = null;
    for (let dz = -3; dz <= 3 && !spot; dz++) {
      for (let dx = -3; dx <= 3 && !spot; dx++) {
        const p = { x: origin.x + step.x * i + dx, z: origin.z + step.z * i + dz };
        if (!legal(p.x, p.z) || !far(p, placed, MIN_GAP) || !far(p, got, 8)) continue;
        const prev = got[got.length - 1];
        if (prev && (Math.hypot(p.x - prev.x, p.z - prev.z) > 12 || Math.hypot(p.x - prev.x, p.z - prev.z) < 8)) continue;
        spot = p;
      }
    }
    if (!spot) throw new Error(`chain missed ${i} at ${origin.x},${origin.z}`);
    got.push(spot);
  }
  placed.push(...got);
  return got;
}

function far(p: { x: number; z: number }, placed: { x: number; z: number }[], gap: number): boolean {
  for (const q of placed) {
    if (Math.hypot(p.x - q.x, p.z - q.z) < gap) return false;
  }
  return true;
}

function take(
  pool: { x: number; z: number }[],
  n: number,
  gap: number,
  placed: { x: number; z: number }[],
  salt: number,
): { x: number; z: number }[] {
  const got: { x: number; z: number }[] = [];
  let g = gap;
  while (got.length < n && g >= MIN_GAP) {
    const order = pool
      .map((p, i) => ({ p, k: hash(p.x + salt, p.z + g) + i * 1e-6 }))
      .sort((a, b) => a.k - b.k);
    for (const row of order) {
      if (got.length >= n) break;
      if (!far(row.p, placed, MIN_GAP) || !far(row.p, got, g)) continue;
      got.push(row.p);
    }
    g -= 1;
  }
  if (got.length < n) {
    throw new Error(`placed ${got.length} of ${n} at salt ${salt}`);
  }
  placed.push(...got);
  return got;
}

function takePairs(
  pool: { x: number; z: number }[],
  pairs: number,
  neighbor: number,
  campGap: number,
  placed: { x: number; z: number }[],
  salt: number,
): { x: number; z: number }[] {
  const got: { x: number; z: number }[] = [];
  const used = new Set<string>();
  const key = (p: { x: number; z: number }) => `${p.x},${p.z}`;
  let gap = campGap;
  while (got.length < pairs * 2 && gap >= 8) {
    const order = pool
      .map((p) => ({ p, k: hash(p.x + salt, p.z + gap) }))
      .sort((a, b) => a.k - b.k);
    for (const row of order) {
      if (got.length >= pairs * 2) break;
      if (used.has(key(row.p)) || !far(row.p, placed, MIN_GAP) || !far(row.p, got, gap)) continue;
      let mate: { x: number; z: number } | null = null;
      let best = Infinity;
      for (const q of pool) {
        if (q === row.p || used.has(key(q))) continue;
        const d = Math.hypot(q.x - row.p.x, q.z - row.p.z);
        if (d < 8 || d > neighbor) continue;
        if (!far(q, placed, MIN_GAP) || !far(q, got, MIN_GAP)) continue;
        const prefer = Math.abs(d - 10);
        if (prefer < best) {
          best = prefer;
          mate = q;
        }
      }
      if (!mate) continue;
      used.add(key(row.p));
      used.add(key(mate));
      got.push(row.p, mate);
    }
    gap -= 2;
  }
  if (got.length < pairs * 2) {
    throw new Error(`pairs ${got.length} of ${pairs * 2} at salt ${salt}`);
  }
  placed.push(...got);
  return got;
}

type Band = {
  id: string;
  name: string;
  archetype: PaleHollowArchetype;
  levels: number[];
  hp: number[];
  aggro: PaleHollowMobDef["aggro"];
  aggroRange: number;
  linkRange?: number;
  drops: string[];
  rare?: boolean;
  job?: PaleHollowMobJob;
};

function stamp(band: Band, spots: { x: number; z: number }[], prefix: string): PaleHollowMobDef[] {
  return spots.map((s, i) => {
    const level = band.levels[i % band.levels.length]!;
    const hp = band.hp[i % band.hp.length]!;
    const row: PaleHollowMobDef = {
      id: `${prefix}-${i + 1}`,
      name: band.name,
      x: s.x,
      z: s.z,
      level,
      archetype: band.archetype,
      aggro: band.aggro,
      aggroRange: band.aggroRange,
      hp,
      drops: band.drops,
    };
    if (band.linkRange) row.linkRange = band.linkRange;
    if (band.rare) row.rareDrops = [{ slug: "chainmail", chance: 0.01 }];
    if (band.job && i % 7 === 0) row.job = band.job;
    return row;
  });
}

const placed: { x: number; z: number }[] = [];

const banks = grid(-20, 90, 40, 230, 3, (x, z) => paleHollowBiome(x, z) === "riverbank");
const slimes = take(banks, 20, 16, placed, 2);

const westGrove = grid(-155, -70, 155, 245, 3, (x, z) => {
  return paleHollowBiome(x, z) === "ashbeam" && Math.hypot(x + 120, z - 200) < 48;
});
const scavs = takePairs(westGrove, 10, 12, 28, placed, 4);

const boarGround = grid(-150, 150, 150, 320, 4, (x, z) => paleHollowBiome(x, z) === "ashbeam");
const boars = take(boarGround, 15, 18, placed, 5);

const lookouts = chain({ x: 8, z: 104 }, { x: 0, z: 9 }, 5);
const rim = grid(50, 96, 48, 120, 2, (x, z) => {
  return paleHollowBiome(x, z) === "quarry" && x > paleHollowTributaryCenterX(z) + 8;
});
const adders = take(rim, 15, 6.5, placed, 7);

const bowl = grid(-12, 70, 48, 136, 3, (x, z) => {
  return paleHollowBiome(x, z) === "quarry" && x < paleHollowTributaryCenterX(z) - 6;
});
const dwellers = takePairs(bowl, 10, 12, 12, placed, 6);

const seam = grid(26, 48, 392, 430, 2, (x, z) => paleHollowBiome(x, z) === "ore_seam" && x >= 26);
const golems = take(seam, 10, 10, placed, 9);

const crypt = grid(-42, 2, 412, 452, 2, (x, z) => paleHollowBiome(x, z) === "crypt");
const wights = takePairs(crypt, 7, 12, 12, placed, 10);
const wightExtra = take(crypt, 1, 8, placed, 11);

const lip = grid(-36, 36, 456, 466, 2, (x, z) => paleHollowBiome(x, z) === "scrub");
const roadDwellers = takePairs(lip, 5, 12, 24, placed, 12);

const farm = grid(-140, 30, 30, 108, 3, (x, z) => paleHollowBiome(x, z) === "farm");
const rows = take(farm, 20, 16, placed, 3);

const spur = grid(20, 170, 40, 186, 4, (x, z) => paleHollowBiome(x, z) === "grass");
const meadow = grid(40, 140, 40, 128, 4, (x, z) => paleHollowBiome(x, z) === "meadow");
const skirt = take([...spur, ...meadow], 75, 14, placed, 1);

export const PH_ALL_MOBS: PaleHollowMobDef[] = [
  ...stamp(
    { id: "hare", name: "Dust Hare", archetype: "dust_hare", levels: [1, 1, 2], hp: [45, 45, 55], aggro: "safe", aggroRange: 0, drops: ["soft-pelt", "pale-dust", "desiccated-hide"], job: "rogue" },
    skirt,
    "ph-hare",
  ),
  ...stamp(
    { id: "slime", name: "Pale Slime", archetype: "pale_slime", levels: [3, 4, 5], hp: [80, 95, 110], aggro: "proximity", aggroRange: 4, drops: ["slime-oil", "pale-dust"], job: "sorcerer" },
    slimes,
    "ph-slime",
  ),
  ...stamp(
    { id: "row", name: "Dust Hare", archetype: "dust_hare", levels: [5, 6], hp: [70, 75], aggro: "safe", aggroRange: 0, drops: ["soft-pelt", "desiccated-hide"] },
    rows,
    "ph-row",
  ),
  ...stamp(
    { id: "scav", name: "Hollow Scavenger", archetype: "hollow_scavenger", levels: [6, 7], hp: [140, 160], aggro: "sight", aggroRange: 9, linkRange: 7, drops: ["linen-scrap", "pale-dust"] },
    scavs,
    "ph-scav",
  ),
  ...stamp(
    { id: "boar", name: "Ashbeam Boar", archetype: "ashbeam_boar", levels: [8, 9], hp: [200, 220], aggro: "sound", aggroRange: 7, drops: ["soft-pelt", "horn", "desiccated-hide"] },
    boars,
    "ph-boar",
  ),
  ...stamp(
    { id: "dwell", name: "Ruin Dweller", archetype: "ruin_dweller", levels: [11, 12, 13], hp: [260, 290, 310], aggro: "sight", aggroRange: 10, linkRange: 8, drops: ["cracked-brick", "pale-dust"], rare: true },
    dwellers,
    "ph-dwell",
  ),
  ...stamp(
    { id: "adder", name: "Cliff Adder", archetype: "cliff_adder", levels: [12, 13, 14], hp: [180, 190, 210], aggro: "proximity", aggroRange: 3.2, drops: ["soft-pelt", "pale-dust", "desiccated-hide"] },
    adders,
    "ph-adder",
  ),
  ...stamp(
    { id: "look", name: "Hollow Scavenger", archetype: "hollow_scavenger", levels: [12], hp: [240], aggro: "sight", aggroRange: 9, linkRange: 6, drops: ["linen-scrap"], job: "fighter" },
    lookouts,
    "ph-look",
  ),
  ...stamp(
    { id: "golem", name: "Seam Golem", archetype: "seam_golem", levels: [16, 17], hp: [420, 460], aggro: "sight", aggroRange: 8, drops: ["copper-ore", "cracked-brick"] },
    golems,
    "ph-golem",
  ),
  ...stamp(
    { id: "wight", name: "Shard Wight", archetype: "shard_wight", levels: [16, 17, 18], hp: [340, 360, 380], aggro: "sight", aggroRange: 9, linkRange: 6, drops: ["bone-chip", "pale-dust"], job: "sorcerer" },
    [...wights, ...wightExtra],
    "ph-wight",
  ),
  ...stamp(
    { id: "lip", name: "Ruin Dweller", archetype: "ruin_dweller", levels: [15, 16], hp: [320, 340], aggro: "sight", aggroRange: 10, linkRange: 7, drops: ["cracked-brick", "linen-scrap"], rare: true, job: "knight" },
    roadDwellers,
    "ph-lip",
  ),
];

export const PH_SEGMENT_A_MOBS = PH_ALL_MOBS.filter((m) => m.level <= 4);
export const PH_SEGMENT_B_MOBS = PH_ALL_MOBS.filter((m) => m.level >= 5 && m.level <= 9);
export const PH_SEGMENT_C_MOBS = PH_ALL_MOBS.filter((m) => m.level >= 10 && m.level <= 14);
export const PH_SEGMENT_D_MOBS = PH_ALL_MOBS.filter((m) => m.level >= 15);

const YARD_NPC: Record<string, { id: string; name: string; title: string; offer: string; progress: string; done: string; gold: number; need: number; prefix: string }> = {
  span: { id: "npc-ph-span", name: "Span Keeper", title: "Slick Landing", offer: "The slimes on this bank slick the only crossing off the spur. Clear the two nearest the landing.", progress: "The landing is still slick.", done: "The planks are dry. Take this.", gold: 40, need: 2, prefix: "ph-slime" },
  terrace: { id: "npc-ph-terrace", name: "Terrace Keeper", title: "Out of the Rows", offer: "The hares are in the grain. Four of them, the ones in this yard's shadow.", progress: "They are still in the rows.", done: "The rows are clear.", gold: 50, need: 4, prefix: "ph-row" },
  clay: { id: "npc-ph-clay", name: "Clay Ward", title: "Off the Clay", offer: "Two slimes sit on the clay I have to dig. Move them.", progress: "The pit is still occupied.", done: "I can work the bank again.", gold: 60, need: 2, prefix: "ph-slime" },
  grove: { id: "npc-ph-grove", name: "Grove Cutter", title: "Taken Stacks", offer: "Scavengers took the nearest log stack. Four of them. The rest of the grove can wait.", progress: "The stack is still theirs.", done: "The logs are mine again.", gold: 80, need: 4, prefix: "ph-scav" },
  hunter: { id: "npc-ph-hunter", name: "Grove Hunter", title: "The Wallow", offer: "Three boars wallow beside this lean-to. I need those three, not the whole grove.", progress: "I can still hear them.", done: "The grass is quiet.", gold: 100, need: 3, prefix: "ph-boar" },
  cut: { id: "npc-ph-cut", name: "Cut Foreman", title: "Off the Shelves", offer: "Four dwellers stand on the shelves by the shed. Clear those.", progress: "The face is still watched.", done: "We can cut stone again.", gold: 140, need: 4, prefix: "ph-dwell" },
  rim: { id: "npc-ph-rim", name: "Cord Cutter", title: "At the Cord", offer: "Three adders lie in the cord on this rim. I cannot reach past them.", progress: "The cord is still guarded.", done: "The vines are free.", gold: 150, need: 3, prefix: "ph-adder" },
  seam: { id: "npc-ph-seam", name: "Seam Ward", title: "The Night Shift", offer: "Two golems stand on the dry seam by the shack. The lake took the rest of the vein.", progress: "They have not moved.", done: "The shift is ours.", gold: 180, need: 2, prefix: "ph-golem" },
  watch: { id: "npc-ph-watch", name: "Crypt Watch", title: "Shut the Mouth", offer: "Three wights stand nearest this fire. Put them down and the mouth stays shut.", progress: "The mouth is still open.", done: "The fire can stay low.", gold: 200, need: 3, prefix: "ph-wight" },
  cairn: { id: "npc-ph-cairn", name: "Road Warden", title: "On the Lip", offer: "Two dwellers have walked up to the cairn. Turn them before the road.", progress: "They are still on the lip.", done: "The road is clear.", gold: 220, need: 2, prefix: "ph-lip" },
};

function nearest(prefix: string, x: number, z: number, n: number): string[] {
  return PH_ALL_MOBS
    .filter((m) => m.id.startsWith(prefix + "-"))
    .map((m) => ({ id: m.id, d: Math.hypot(m.x - x, m.z - z) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
    .map((m) => m.id);
}

const herald = { x: 0.4 + PH_CAMP_SHIFT_X, z: 5 + PH_CAMP_SHIFT_Z };

export const PH_FIELD_NPCS: readonly PaleHollowFieldNpc[] = PH_YARDS.map((y) => {
  const spec = YARD_NPC[y.id]!;
  return { id: spec.id, name: spec.name, x: y.x + 2.2, z: y.z + 1.4, facing: y.yaw, role: "quest_giver" as const, yardId: y.id };
});

export const PH_QUESTS: readonly PaleHollowQuestDef[] = [
  {
    id: "ph-skirt",
    npcId: "npc-ph-herald",
    title: "Skirt of the Camp",
    offer: "Hares have moved onto the grass south of the dwellings. Bring down six of the nearest.",
    progress: "The skirt is still full of hares.",
    done: "The grass by the camp is clear.",
    gold: 25,
    need: 6,
    mobIds: nearest("ph-hare", herald.x, herald.z, 6),
  },
  ...PH_YARDS.map((y) => {
    const spec = YARD_NPC[y.id]!;
    return {
      id: `ph-${y.id}`,
      npcId: spec.id,
      title: spec.title,
      offer: spec.offer,
      progress: spec.progress,
      done: spec.done,
      gold: spec.gold,
      need: spec.need,
      mobIds: nearest(spec.prefix, y.x, y.z, spec.need),
    };
  }),
];

export function emptyPaleHollowQuests(): PaleHollowQuestState {
  return { zoneId: "pale_hollow", active: null, done: [] };
}

export function paleHollowQuestByNpc(npcId: string): PaleHollowQuestDef | undefined {
  return PH_QUESTS.find((q) => q.npcId === npcId);
}

export function paleHollowQuestCredit(state: PaleHollowQuestState, mobId: string): PaleHollowQuestState {
  const active = state.active;
  if (!active) return state;
  const quest = PH_QUESTS.find((q) => q.id === active.id);
  if (!quest || !quest.mobIds.includes(mobId) || active.kills >= quest.need) return state;
  return { ...state, active: { id: active.id, kills: active.kills + 1 } };
}

export function paleHollowQuestTalk(
  state: PaleHollowQuestState,
  npcId: string,
): { state: PaleHollowQuestState; title: string; body: string; gold: number } {
  const quest = paleHollowQuestByNpc(npcId);
  if (!quest) return { state, title: "…", body: "…", gold: 0 };
  if (state.done.includes(quest.id)) {
    return { state, title: quest.title, body: quest.done, gold: 0 };
  }
  const active = state.active;
  if (!active || active.id !== quest.id) {
    if (active) {
      return { state, title: quest.title, body: "Finish the task you already carry.", gold: 0 };
    }
    return {
      state: { ...state, active: { id: quest.id, kills: 0 } },
      title: quest.title,
      body: quest.offer,
      gold: 0,
    };
  }
  if (active.kills < quest.need) {
    return { state, title: quest.title, body: `${quest.progress} ${active.kills}/${quest.need}.`, gold: 0 };
  }
  return {
    state: { zoneId: "pale_hollow", active: null, done: [...state.done, quest.id] },
    title: quest.title,
    body: quest.done,
    gold: quest.gold,
  };
}
