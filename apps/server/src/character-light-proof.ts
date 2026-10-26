/**
 * Character-root inclusion and one state leaf, in the engine's keccak pairing.
 *
 * Leaves and siblings follow `character_root.rs` and `state.rs` `commit_map`.
 * An empty character-root tree is 32 zero bytes. An empty state map is
 * keccak256 of empty bytes. Odd levels duplicate the last node.
 * `left` means the sibling is the left child.
 */
import { concatBytes, keccak256 } from "viem";

export type LightSibling = { hash: Uint8Array; left: boolean };

export type LightAmount = { itemId: string; amount: string };
export type LightHarvest = { materialId: string; amount: string };
export type LightCraftSkill = { skillId: string; level: number };
export type LightGoldSource = { source: string; amount: string };

/** One character's committed map, as the engine projects it. */
export type LightCharacter = {
  tokenId: string;
  startingJob: number;
  level: number;
  gold: string;
  items: LightAmount[];
  abilities: string[];
  crafts: LightAmount[];
  harvests: LightHarvest[];
  drops: LightAmount[];
  craftSkills: LightCraftSkill[];
  /** Absent until the first accepted earn. Decimal day id. */
  goldDay?: string;
  goldEarnedDay?: string;
  goldEarned?: LightGoldSource[];
  goldCraftRefundable?: string;
};

export type CharacterLightProof = {
  treeRoot: Uint8Array;
  tokenId: bigint;
  characterRoot: Uint8Array;
  characterSiblings: LightSibling[];
  tag: number;
  keyData: Uint8Array;
  value: Uint8Array;
  leafSiblings: LightSibling[];
};

type StateEntry = { rank: number; keyData: Uint8Array; value: Uint8Array; tag: number };

const ZEROS = new Uint8Array(32);

/**
 * Inclusion of `tokenId` under the character-root tree, plus that character's
 * token-id state leaf. `null` when the token is not in the tree.
 */
export function proveCharacter(characters: readonly LightCharacter[], tokenId: string): CharacterLightProof | null {
  const rows = characters
    .map((character) => {
      const state = stateEntries(character);
      return {
        tokenId: BigInt(character.tokenId),
        characterRoot: commitState(state),
        leaf: tokenLeaf(state),
      };
    })
    .sort((a, b) => (a.tokenId < b.tokenId ? -1 : a.tokenId > b.tokenId ? 1 : 0));
  if (rows.length === 0) return null;
  const want = BigInt(tokenId);
  const index = rows.findIndex((row) => row.tokenId === want);
  if (index < 0) return null;
  const leaves = rows.map((row) => keccak(concatBytes([word(row.tokenId), row.characterRoot])));
  const layers = merkle(leaves);
  const row = rows[index]!;
  if (!row.leaf) return null;
  return {
    treeRoot: layers.length === 0 ? new Uint8Array(32) : layers[layers.length - 1]![0]!,
    tokenId: row.tokenId,
    characterRoot: row.characterRoot,
    characterSiblings: siblingsOf(layers, index),
    tag: row.leaf.tag,
    keyData: row.leaf.keyData,
    value: row.leaf.value,
    leafSiblings: row.leaf.siblings,
  };
}

type ProofTree = {
  rows: { tokenId: bigint; characterRoot: Uint8Array; state: StateEntry[] }[];
  layers: Uint8Array[][];
  leaves: Map<bigint, ReturnType<typeof tokenLeaf>>;
};

let proofEpoch = Number.NaN;
let proofTree: ProofTree | null = null;

/** Drop the cached tree. Tests that reuse a log length call this. */
export function resetCharacterProofCache(): void {
  proofEpoch = Number.NaN;
  proofTree = null;
}

/**
 * Same bytes as `proveCharacter`, built once per log length.
 * A walk does not append a log event, so the next snapshot reuses the tree.
 */
export function proveCharacterCached(
  logLength: number,
  characters: readonly LightCharacter[],
  tokenId: string,
): CharacterLightProof | null {
  if (!proofTree || proofEpoch !== logLength) {
    const rows = characters
      .map((character) => {
        const state = stateEntries(character);
        return { tokenId: BigInt(character.tokenId), characterRoot: commitState(state), state };
      })
      .sort((a, b) => (a.tokenId < b.tokenId ? -1 : a.tokenId > b.tokenId ? 1 : 0));
    const leaves = rows.map((row) => keccak(concatBytes([word(row.tokenId), row.characterRoot])));
    proofTree = { rows, layers: merkle(leaves), leaves: new Map() };
    proofEpoch = logLength;
  }
  const tree = proofTree;
  const want = BigInt(tokenId);
  const index = tree.rows.findIndex((row) => row.tokenId === want);
  if (index < 0) return null;
  const row = tree.rows[index]!;
  let leaf = tree.leaves.get(want);
  if (leaf === undefined) {
    leaf = tokenLeaf(row.state);
    tree.leaves.set(want, leaf);
  }
  if (!leaf) return null;
  const rootLayer = tree.layers[tree.layers.length - 1];
  return {
    treeRoot: !rootLayer || rootLayer.length === 0 ? new Uint8Array(32) : rootLayer[0]!,
    tokenId: row.tokenId,
    characterRoot: row.characterRoot,
    characterSiblings: siblingsOf(tree.layers, index),
    tag: leaf.tag,
    keyData: leaf.keyData,
    value: leaf.value,
    leafSiblings: leaf.siblings,
  };
}

/** 32 zero bytes when there are no characters. */
export function characterTreeRoot(characters: readonly LightCharacter[]): Uint8Array {
  if (characters.length === 0) return new Uint8Array(32);
  const proved = proveCharacter(characters, characters[0]!.tokenId);
  return proved ? proved.treeRoot : new Uint8Array(32);
}

function tokenLeaf(entries: StateEntry[]): {
  tag: number;
  keyData: Uint8Array;
  value: Uint8Array;
  siblings: LightSibling[];
} | null {
  const index = entries.findIndex((entry) => entry.tag === 0);
  if (index < 0) return null;
  const leaves = entries.map(stateLeaf);
  const layers = merkle(leaves);
  const entry = entries[index]!;
  return {
    tag: entry.tag,
    keyData: entry.keyData,
    value: entry.value,
    siblings: siblingsOf(layers, index),
  };
}

function stateEntries(character: LightCharacter): StateEntry[] {
  const token = word(BigInt(character.tokenId));
  const entries: StateEntry[] = [
    scalar(0, 0, token),
    scalar(1, 1, word(BigInt(character.level))),
    scalar(2, 2, word(BigInt(character.startingJob))),
    scalar(3, 3, ZEROS),
    scalar(4, 4, ZEROS),
    scalar(5, 5, ZEROS),
    scalar(6, 6, ZEROS),
    scalar(7, 7, ZEROS),
  ];
  for (const row of character.items) pushAmount(entries, 8, 9, row);
  for (const ability of character.abilities) {
    entries.push({ rank: 9, tag: 10, keyData: keccak(utf8(ability)), value: word(1n) });
  }
  for (const row of character.crafts) pushAmount(entries, 10, 11, row);
  for (const row of character.harvests) {
    if (!positive(row.amount)) continue;
    entries.push({ rank: 11, tag: 12, keyData: keccak(utf8(row.materialId)), value: word(BigInt(row.amount)) });
  }
  for (const row of character.craftSkills) {
    entries.push({ rank: 12, tag: 13, keyData: keccak(utf8(row.skillId)), value: word(BigInt(row.level)) });
  }
  for (const row of character.drops) pushAmount(entries, 13, 14, row);
  if (positive(character.gold)) entries.push(scalar(14, 15, word(BigInt(character.gold))));
  if (positive(character.goldDay)) entries.push(scalar(15, 16, word(BigInt(character.goldDay!))));
  if (positive(character.goldEarnedDay)) entries.push(scalar(16, 17, word(BigInt(character.goldEarnedDay!))));
  for (const row of character.goldEarned ?? []) {
    if (!positive(row.amount)) continue;
    entries.push({ rank: 17, tag: 18, keyData: keccak(utf8(row.source)), value: word(BigInt(row.amount)) });
  }
  if (positive(character.goldCraftRefundable)) {
    entries.push(scalar(18, 19, word(BigInt(character.goldCraftRefundable!))));
  }
  entries.sort(compareEntry);
  return entries;
}

function pushAmount(entries: StateEntry[], rank: number, tag: number, row: LightAmount) {
  if (!positive(row.amount) || !positive(row.itemId)) return;
  entries.push({ rank, tag, keyData: word(BigInt(row.itemId)), value: word(BigInt(row.amount)) });
}

function scalar(rank: number, tag: number, value: Uint8Array): StateEntry {
  return { rank, tag, keyData: ZEROS, value };
}

function compareEntry(a: StateEntry, b: StateEntry): number {
  if (a.rank !== b.rank) return a.rank - b.rank;
  return compareBytes(a.keyData, b.keyData);
}

function compareBytes(a: Uint8Array, b: Uint8Array): number {
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function commitState(entries: StateEntry[]): Uint8Array {
  if (entries.length === 0) return keccak(new Uint8Array());
  const layers = merkle(entries.map(stateLeaf));
  return layers[layers.length - 1]![0]!;
}

function stateLeaf(entry: StateEntry): Uint8Array {
  const tag = new Uint8Array(32);
  tag[31] = entry.tag;
  return keccak(concatBytes([tag, entry.keyData, entry.value]));
}

function merkle(leaves: Uint8Array[]): Uint8Array[][] {
  if (leaves.length === 0) return [];
  const layers: Uint8Array[][] = [leaves];
  while (layers[layers.length - 1]!.length > 1) {
    const current = layers[layers.length - 1]!;
    const padded = current.slice();
    if (padded.length % 2 === 1) padded.push(padded[padded.length - 1]!);
    const next: Uint8Array[] = [];
    for (let i = 0; i < padded.length; i += 2) next.push(keccak(concatBytes([padded[i]!, padded[i + 1]!])));
    layers.push(next);
  }
  return layers;
}

function siblingsOf(layers: Uint8Array[][], index: number): LightSibling[] {
  const siblings: LightSibling[] = [];
  let at = index;
  for (const level of layers.slice(0, -1)) {
    if (at % 2 === 0) {
      const hash = at + 1 < level.length ? level[at + 1]! : level[at]!;
      siblings.push({ hash, left: false });
    } else {
      siblings.push({ hash: level[at - 1]!, left: true });
    }
    at = Math.floor(at / 2);
  }
  return siblings;
}

function positive(value: string | undefined): boolean {
  return !!value && /^[1-9][0-9]*$/.test(value);
}

function word(value: bigint): Uint8Array {
  const out = new Uint8Array(32);
  let rest = value;
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(rest & 0xffn);
    rest >>= 8n;
  }
  return out;
}

function utf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function keccak(data: Uint8Array): Uint8Array {
  return new Uint8Array(keccak256(data, "bytes"));
}

type LiveCharacter = {
  tokenId: string;
  gold?: string;
  level?: number;
  abilities?: string[];
  crafts?: LightAmount[];
  craftSkills?: LightCraftSkill[];
  harvests?: LightHarvest[];
  drops?: LightAmount[];
  items: LightAmount[];
};

/**
 * Project the engine document and the live state JSON into proof inputs.
 * `startingJob` comes from the document. Gold-day counters are replayed from
 * accepted gold events, because the state JSON only carries the balance.
 */
export function projectLightCharacters(
  docText: string,
  live: readonly LiveCharacter[],
  fallbackJob: ReadonlyMap<string, number>,
): LightCharacter[] {
  const doc = parseDoc(docText);
  return live.map((row) => {
    const logged = doc.get(row.tokenId);
    const counters = goldCounters(logged?.entries ?? []);
    const startingJob = logged?.startingJob ?? fallbackJob.get(row.tokenId) ?? 0;
    return {
      tokenId: row.tokenId,
      startingJob,
      level: row.level ?? 1,
      gold: row.gold && row.gold !== "0" ? row.gold : "0",
      items: row.items ?? [],
      abilities: row.abilities ?? [],
      crafts: row.crafts ?? [],
      harvests: row.harvests ?? [],
      drops: row.drops ?? [],
      craftSkills: row.craftSkills ?? [],
      goldDay: counters.day > 0n ? counters.day.toString(10) : undefined,
      goldEarnedDay: counters.earnedDay > 0n ? counters.earnedDay.toString(10) : undefined,
      goldEarned: [...counters.sources.entries()]
        .filter(([, amount]) => amount > 0n)
        .map(([source, amount]) => ({ source, amount: amount.toString(10) })),
      goldCraftRefundable: counters.refundable > 0n ? counters.refundable.toString(10) : undefined,
    };
  });
}

type DocEntry = { type?: string; source?: string; sink?: string; amount?: string; day?: number };

function parseDoc(text: string): Map<string, { startingJob?: number; entries: DocEntry[] }> {
  const out = new Map<string, { startingJob?: number; entries: DocEntry[] }>();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return out;
  }
  const characters = (parsed as { characters?: unknown }).characters;
  if (!Array.isArray(characters)) return out;
  for (const row of characters) {
    if (!row || typeof row !== "object") continue;
    const body = row as { tokenId?: unknown; startingJob?: unknown; entries?: unknown };
    if (typeof body.tokenId !== "string") continue;
    const entries: DocEntry[] = [];
    if (Array.isArray(body.entries)) {
      for (const entry of body.entries) {
        if (!entry || typeof entry !== "object") continue;
        const input = (entry as { input?: unknown }).input;
        if (!input || typeof input !== "object") continue;
        entries.push(input as DocEntry);
      }
    }
    out.set(body.tokenId, {
      startingJob: typeof body.startingJob === "number" ? body.startingJob : undefined,
      entries,
    });
  }
  return out;
}

function goldCounters(entries: readonly DocEntry[]): {
  day: bigint;
  earnedDay: bigint;
  sources: Map<string, bigint>;
  refundable: bigint;
} {
  const counters = { day: 0n, earnedDay: 0n, sources: new Map<string, bigint>(), refundable: 0n };
  for (const entry of entries) {
    const amount = decimal(entry.amount);
    if (entry.type === "goldEarn" && typeof entry.source === "string" && amount > 0n) {
      const day = BigInt(entry.day ?? 0);
      if (entry.source === "craft_refund") {
        rollDay(counters, day);
        counters.refundable = counters.refundable > amount ? counters.refundable - amount : 0n;
      } else {
        rollDay(counters, day);
        counters.sources.set(entry.source, (counters.sources.get(entry.source) ?? 0n) + amount);
        counters.earnedDay += amount;
      }
    } else if (entry.type === "goldSpend" && entry.sink === "craft" && amount > 0n) {
      counters.refundable += amount;
    } else if (entry.type === "goldSell" && amount > 0n) {
      rollDay(counters, BigInt(entry.day ?? 0));
      counters.sources.set("npc_sell", (counters.sources.get("npc_sell") ?? 0n) + amount);
      counters.earnedDay += amount;
    }
  }
  return counters;
}

function rollDay(
  counters: { day: bigint; earnedDay: bigint; sources: Map<string, bigint> },
  day: bigint,
) {
  if (day <= 0n) return;
  if (counters.day === 0n || day > counters.day) {
    counters.earnedDay = 0n;
    counters.sources.clear();
    counters.day = day;
  }
}

function decimal(value: string | undefined): bigint {
  if (!value || !/^[0-9]+$/.test(value)) return 0n;
  return BigInt(value);
}
