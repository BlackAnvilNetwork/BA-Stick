/**
 * Signs a BLS12-381 epoch-leader certificate in process and checks one
 * character against that next root. The key is generated here. No env secret
 * is read, and nothing is posted.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { bls12_381 } from "@noble/curves/bls12-381.js";
import { concatBytes, keccak256 } from "viem";
import {
  checkWebLightClient,
  type CharacterRootClaim,
  type LightCertificate,
  type Sibling,
  type StateLeafClaim,
  type WebLightPayload,
} from "./light-client";

const bls = bls12_381.longSignatures;
const leader = bls.keygen();
const leaderKey = new Uint8Array(leader.publicKey.toBytes());
const leaderSecret = new Uint8Array(leader.secretKey);

const ZEROS = new Uint8Array(32);

/**
 * `Key` order from `state.rs`. Declaration order, then the inner id for
 * keyed variants. Tag 8 is retired and is not a key.
 */
const KEY_RANK: Record<number, number> = {
  0: 0,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  9: 8,
  10: 9,
  11: 10,
  12: 11,
  13: 12,
  14: 13,
  15: 14,
  16: 15,
  17: 16,
  18: 17,
  19: 18,
};

type StateEntry = { tag: number; keyData: Uint8Array; value: Uint8Array };

test("a one-leaf character and a two-leaf character both pass certificate, character root, and leaf", () => {
  const one = stateTree([{ tag: 0, keyData: ZEROS, value: word(1n) }]);
  assert.equal(one.leaves.length, 1);
  assert.deepEqual(one.root, one.leaves[0]);

  const token = { tag: 0, keyData: ZEROS, value: word(7n) };
  const itemLow = { tag: 9, keyData: word(1n), value: word(9n) };
  const itemHigh = { tag: 9, keyData: word(2n), value: word(4n) };
  const ordered = stateTree([itemHigh, itemLow, token]);
  assert.equal(ordered.sorted[0]?.tag, 0);
  assert.deepEqual(ordered.sorted[1]?.keyData, word(1n));
  assert.deepEqual(ordered.sorted[2]?.keyData, word(2n));
  const oddPair = keccak(concatBytes([ordered.leaves[0]!, ordered.leaves[1]!]));
  const oddPad = keccak(concatBytes([ordered.leaves[2]!, ordered.leaves[2]!]));
  assert.deepEqual(ordered.root, keccak(concatBytes([oddPair, oddPad])));
  assert.equal(ordered.proof(2)[0]?.left, false);
  assert.deepEqual(ordered.proof(2)[0]?.hash, ordered.leaves[2]);

  const two = stateTree([itemLow, token]);
  assert.equal(two.leaves.length, 2);
  assert.deepEqual(two.root, keccak(concatBytes([two.leaves[0]!, two.leaves[1]!])));

  const characters = characterTree([
    { tokenId: 1n, characterRoot: one.root },
    { tokenId: 2n, characterRoot: two.root },
  ]);
  assert.equal(characters.leaves.length, 2);
  assert.deepEqual(characters.root, keccak(concatBytes([characters.leaves[0]!, characters.leaves[1]!])));

  const certificate = signed(characters.root);
  const oneOk = checkWebLightClient({
    certificate,
    character: {
      tokenId: 1n,
      characterRoot: one.root,
      siblings: characters.proof(0),
    },
    leaf: { tag: 0, keyData: ZEROS, value: word(1n), siblings: [] },
  });
  assert.equal(oneOk.ok, true);
  if (oneOk.ok) {
    assert.deepEqual(oneOk.nextRoot, characters.root);
    assert.deepEqual(oneOk.characterRoot, one.root);
    assert.deepEqual(oneOk.leaf, one.leaves[0]);
  }

  const levelIndex = 1;
  const twoOk = checkWebLightClient({
    certificate,
    character: {
      tokenId: 2n,
      characterRoot: two.root,
      siblings: characters.proof(1),
    },
    leaf: {
      tag: itemLow.tag,
      keyData: itemLow.keyData,
      value: itemLow.value,
      siblings: two.proof(levelIndex),
    },
  });
  assert.equal(twoOk.ok, true);
  if (twoOk.ok) {
    assert.deepEqual(twoOk.characterRoot, two.root);
    assert.deepEqual(twoOk.leaf, two.leaves[levelIndex]);
  }
});

test("a bad signature stops at the certificate and does not read the character root", () => {
  const world = passingWorld();
  const bad = new Uint8Array(world.certificate.signature!);
  bad[bad.length - 1]! ^= 0x01;
  let characterReads = 0;
  let leafReads = 0;
  const rejected = checkWebLightClient({
    certificate: { ...world.certificate, signature: bad },
    get character() {
      characterReads += 1;
      return world.character;
    },
    get leaf() {
      leafReads += 1;
      return world.leaf;
    },
  });
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.stage, "certificate");
  assert.equal(characterReads, 0);
  assert.equal(leafReads, 0);

  const missing = checkWebLightClient({
    certificate: { ...world.certificate, signature: undefined },
    character: world.character,
    leaf: world.leaf,
  });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.stage, "certificate");

  const short = checkWebLightClient({
    certificate: { ...world.certificate, signature: bad.slice(0, 95) },
    character: world.character,
    leaf: world.leaf,
  });
  assert.equal(short.ok, false);
  if (!short.ok) assert.equal(short.stage, "certificate");
});

test("a signature over a different nextRoot stops at the certificate", () => {
  const world = passingWorld();
  const otherRoot = new Uint8Array(32).fill(0xab);
  const signature = sign({ ...world.certificate, nextRoot: otherRoot });
  let characterReads = 0;
  const rejected = checkWebLightClient({
    certificate: { ...world.certificate, signature },
    get character() {
      characterReads += 1;
      return world.character;
    },
    leaf: world.leaf,
  });
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.stage, "certificate");
  assert.equal(characterReads, 0);
  assert.equal(checkWebLightClient(world).ok, true);
});

test("a bad character-root sibling stops at character_root even when the leaf would match", () => {
  const world = passingWorld();
  const sibling = world.character.siblings[0];
  assert.ok(sibling);
  const flipped: Sibling = { hash: new Uint8Array(sibling.hash), left: sibling.left };
  flipped.hash[0]! ^= 0x01;
  let leafReads = 0;
  const rejected = checkWebLightClient({
    certificate: world.certificate,
    character: { ...world.character, siblings: [flipped] },
    get leaf() {
      leafReads += 1;
      return world.leaf;
    },
  });
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.stage, "character_root");
  assert.equal(leafReads, 0);
});

test("a bad leaf sibling stops at leaf after a valid certificate and character root", () => {
  const world = passingWorld();
  const sibling = world.leaf.siblings[0];
  assert.ok(sibling);
  const flipped: Sibling = { hash: new Uint8Array(sibling.hash), left: sibling.left };
  flipped.hash[0]! ^= 0x01;
  const rejected = checkWebLightClient({
    certificate: world.certificate,
    character: world.character,
    leaf: { ...world.leaf, siblings: [flipped] },
  });
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.stage, "leaf");
});

test("an empty character-root tree is 32 zero bytes and an empty state root is keccak of empty bytes", () => {
  const emptyCharacter = new Uint8Array(32);
  const emptyState = keccak(new Uint8Array());
  assert.notDeepEqual(emptyState, emptyCharacter);

  const certificate = signed(emptyCharacter);
  const claim: CharacterRootClaim = {
    tokenId: 1n,
    characterRoot: emptyState,
    siblings: [],
  };
  const rejected = checkWebLightClient({
    certificate,
    character: claim,
    leaf: { tag: 0, keyData: ZEROS, value: word(1n), siblings: [] },
  });
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.stage, "character_root");

  const alone = characterTree([{ tokenId: 4n, characterRoot: emptyState }]);
  const leaf: StateLeafClaim = { tag: 0, keyData: ZEROS, value: word(1n), siblings: [] };
  const stateRejected = checkWebLightClient({
    certificate: signed(alone.root),
    character: { tokenId: 4n, characterRoot: emptyState, siblings: [] },
    leaf,
  });
  assert.equal(stateRejected.ok, false);
  if (!stateRejected.ok) assert.equal(stateRejected.stage, "leaf");
});

/** Two-leaf character under a two-character batch, so both pair hashes are real. */
function passingWorld(): WebLightPayload {
  const token = { tag: 0, keyData: ZEROS, value: word(7n) };
  const item = { tag: 9, keyData: word(1n), value: word(3n) };
  const state = stateTree([item, token]);
  assert.deepEqual(state.root, keccak(concatBytes([state.leaves[0]!, state.leaves[1]!])));
  const other = stateTree([{ tag: 0, keyData: ZEROS, value: word(1n) }]);
  const characters = characterTree([
    { tokenId: 1n, characterRoot: other.root },
    { tokenId: 2n, characterRoot: state.root },
  ]);
  return {
    certificate: signed(characters.root),
    character: {
      tokenId: 2n,
      characterRoot: state.root,
      siblings: characters.proof(1),
    },
    leaf: {
      tag: item.tag,
      keyData: item.keyData,
      value: item.value,
      siblings: state.proof(1),
    },
  };
}

function signed(nextRoot: Uint8Array): LightCertificate {
  const certificate = envelope(nextRoot);
  return { ...certificate, signature: sign(certificate) };
}

function envelope(nextRoot: Uint8Array): LightCertificate {
  return {
    leaderPublicKey: leaderKey,
    inputsCommitment: filled(0x11),
    parentRoot: filled(0x22),
    nextRoot,
    rulesetHash: filled(0x33),
    epochSeed: filled(0x44),
    rollCommitment: filled(0x55),
    epoch: 2,
    height: 5,
    worldId: "bellgrave",
    protocolVersion: "1",
  };
}

/** Independent of the checker. Same byte layout as `leaderSigningMessage`. */
function specSigningMessage(certificate: LightCertificate): Uint8Array {
  const epoch = new Uint8Array(8);
  const height = new Uint8Array(8);
  new DataView(epoch.buffer).setBigUint64(0, BigInt(certificate.epoch), false);
  new DataView(height.buffer).setBigUint64(0, BigInt(certificate.height), false);
  return new Uint8Array(
    keccak256(
      concatBytes([
        new TextEncoder().encode("bellgrave-batch-v1"),
        certificate.inputsCommitment,
        certificate.parentRoot,
        certificate.nextRoot,
        certificate.rulesetHash,
        certificate.epochSeed,
        certificate.rollCommitment,
        epoch,
        height,
        new TextEncoder().encode(certificate.worldId),
        new TextEncoder().encode(certificate.protocolVersion),
      ]),
      "bytes",
    ),
  );
}

function sign(certificate: LightCertificate, secret: Uint8Array = leaderSecret): Uint8Array {
  return new Uint8Array(bls.sign(bls.hash(specSigningMessage(certificate)), secret).toBytes());
}

function stateTree(entries: StateEntry[]): {
  root: Uint8Array;
  leaves: Uint8Array[];
  sorted: StateEntry[];
  proof: (index: number) => Sibling[];
} {
  const sorted = [...entries].sort(compareKey);
  const leaves = sorted.map(stateLeaf);
  if (leaves.length === 0) {
    return { root: keccak(new Uint8Array()), leaves, sorted, proof: () => [] };
  }
  const layers = merkle(leaves);
  return {
    root: layers[layers.length - 1]![0]!,
    leaves,
    sorted,
    proof: (index) => proof(layers, index),
  };
}

function characterTree(rows: { tokenId: bigint; characterRoot: Uint8Array }[]): {
  root: Uint8Array;
  leaves: Uint8Array[];
  proof: (index: number) => Sibling[];
} {
  const sorted = [...rows].sort((a, b) => (a.tokenId < b.tokenId ? -1 : a.tokenId > b.tokenId ? 1 : 0));
  if (sorted.length === 0) {
    return { root: new Uint8Array(32), leaves: [], proof: () => [] };
  }
  const leaves = sorted.map((row) => keccak(concatBytes([word(row.tokenId), row.characterRoot])));
  const layers = merkle(leaves);
  return {
    root: layers[layers.length - 1]![0]!,
    leaves,
    proof: (index) => proof(layers, index),
  };
}

/** `Buf::u8(tag) || key data || value`, then keccak256. Same preimage as `leaf`. */
function stateLeaf(entry: StateEntry): Uint8Array {
  const tag = new Uint8Array(32);
  tag[31] = entry.tag;
  return keccak(concatBytes([tag, entry.keyData, entry.value]));
}

function compareKey(a: StateEntry, b: StateEntry): number {
  const rank = (KEY_RANK[a.tag] ?? 100) - (KEY_RANK[b.tag] ?? 100);
  if (rank !== 0) return rank;
  for (let i = 0; i < 32; i++) {
    const diff = a.keyData[i]! - b.keyData[i]!;
    if (diff !== 0) return diff;
  }
  return 0;
}

function merkle(leaves: Uint8Array[]): Uint8Array[][] {
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

function proof(layers: Uint8Array[][], index: number): Sibling[] {
  const siblings: Sibling[] = [];
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

function word(value: bigint): Uint8Array {
  const out = new Uint8Array(32);
  let rest = value;
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(rest & 0xffn);
    rest >>= 8n;
  }
  return out;
}

function filled(byte: number): Uint8Array {
  return new Uint8Array(32).fill(byte);
}

function keccak(data: Uint8Array): Uint8Array {
  return new Uint8Array(keccak256(data, "bytes"));
}
