/**
 * The phone verifies one character by calling the web light check. Keys are
 * generated here. No env secret is read, and nothing is posted.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { ed25519 } from "@noble/curves/ed25519.js";
import { concatBytes, keccak256 } from "viem";
import type { LightCertificate, ReplicaPrecommit, Sibling, WebLightPayload } from "./light-client";
import { createMobileLightClient, mobileEntry, mobileLimitedValidatorEligible } from "./mobile-light-client";

const replicas = [ed25519.keygen(), ed25519.keygen(), ed25519.keygen()];
const replicaKeys = replicas.map((key) => new Uint8Array(key.publicKey));

const ZEROS = new Uint8Array(32);
const HEIGHT = 5;
const ROUND = 0;

const KEY_RANK: Record<number, number> = {
  0: 0,
  9: 8,
};

type StateEntry = { tag: number; keyData: Uint8Array; value: Uint8Array };

test("a two-of-three certificate then the character root then one leaf is stored", () => {
  const phone = createMobileLightClient();
  const world = passingWorld();
  const reads: string[] = [];
  const view = phone.accept({
    get certificate() {
      reads.push("certificate");
      return world.certificate;
    },
    get character() {
      reads.push("character_root");
      return world.character;
    },
    get leaf() {
      reads.push("leaf");
      return world.leaf;
    },
  });
  assert.deepEqual(reads, ["certificate", "character_root", "leaf"]);
  assert.equal(world.certificate.signatures.length, 2);
  assert.equal(world.certificate.threshold, 2);
  assert.equal(view.committed?.ok, true);
  if (view.committed?.ok) {
    assert.deepEqual(view.committed.nextRoot, world.certificate.root);
    assert.deepEqual(view.committed.characterRoot, world.character.characterRoot);
    assert.deepEqual(view.committed.leaf, world.leafHash);
  }
  assert.equal(phone.view().committed?.ok, true);
});

test("a one-of-three certificate is not stored as the committed view", () => {
  const phone = createMobileLightClient();
  const world = passingWorld();
  phone.accept(world);
  assert.equal(phone.view().committed?.ok, true);

  let characterReads = 0;
  let leafReads = 0;
  const view = phone.accept({
    certificate: commitOver(world.certificate.root, [0]),
    get character() {
      characterReads += 1;
      return world.character;
    },
    get leaf() {
      leafReads += 1;
      return world.leaf;
    },
  });
  assert.equal(view.committed, null);
  assert.equal(phone.view().committed, null);
  assert.equal(characterReads, 0);
  assert.equal(leafReads, 0);
  assert.equal(commitOver(world.certificate.root, [0]).signatures.length, 1);
});

test("the default phone is not a replica and does not tick", () => {
  let ticks = 0;
  const startWorldTick = () => {
    ticks += 1;
  };
  const entry = mobileEntry(startWorldTick);
  const phone = createMobileLightClient(startWorldTick);
  assert.equal(entry.replica, false);
  assert.equal(entry.ticksWorld, false);
  assert.deepEqual(entry, { tier: "light", ticksWorld: false, leads: false, replica: false });
  assert.deepEqual(phone.entry, entry);
  assert.equal(ticks, 0);
  phone.accept(passingWorld());
  assert.equal(ticks, 0);
});

test("unplugged or metered is not eligible", () => {
  assert.equal(mobileLimitedValidatorEligible({ pluggedIn: false, unmetered: true }), false);
  assert.equal(mobileLimitedValidatorEligible({ pluggedIn: true, unmetered: false }), false);
  assert.equal(mobileLimitedValidatorEligible({ pluggedIn: false, unmetered: false }), false);
});

test("plugged-in and unmetered is eligible and still does not tick from mobileEntry", () => {
  let ticks = 0;
  const startWorldTick = () => {
    ticks += 1;
  };
  const power = { pluggedIn: true, unmetered: true };
  assert.equal(mobileLimitedValidatorEligible(power), true);
  const entry = mobileEntry(startWorldTick);
  assert.deepEqual(entry, { tier: "light", ticksWorld: false, leads: false, replica: false });
  assert.equal(ticks, 0);
});

test("a failed character root does not store the leaf", () => {
  const phone = createMobileLightClient();
  const world = passingWorld();
  phone.accept(world);
  assert.equal(phone.view().committed?.ok, true);

  const sibling = world.character.siblings[0];
  assert.ok(sibling);
  const flipped: Sibling = { hash: new Uint8Array(sibling.hash), left: sibling.left };
  flipped.hash[0]! ^= 0x01;
  let leafReads = 0;
  const view = phone.accept({
    certificate: world.certificate,
    character: { ...world.character, siblings: [flipped] },
    get leaf() {
      leafReads += 1;
      return world.leaf;
    },
  });
  assert.equal(view.committed, null);
  assert.equal(phone.view().committed, null);
  assert.equal(leafReads, 0);
});

test("an empty character-root tree stays 32 zero bytes and does not store the leaf", () => {
  const phone = createMobileLightClient();
  const emptyCharacter = new Uint8Array(32);
  const emptyState = keccak(new Uint8Array());
  assert.equal(emptyCharacter.length, 32);
  assert.equal(emptyCharacter.every((byte) => byte === 0), true);
  assert.notDeepEqual(emptyState, emptyCharacter);

  let leafReads = 0;
  const view = phone.accept({
    certificate: commitOver(emptyCharacter),
    character: { tokenId: 1n, characterRoot: emptyState, siblings: [] },
    get leaf() {
      leafReads += 1;
      return { tag: 0, keyData: ZEROS, value: word(1n), siblings: [] };
    },
  });
  assert.equal(view.committed, null);
  assert.equal(leafReads, 0);
  assert.equal(phone.view().committed, null);
});

function passingWorld(): WebLightPayload & { leafHash: Uint8Array } {
  const token = { tag: 0, keyData: ZEROS, value: word(7n) };
  const item = { tag: 9, keyData: word(1n), value: word(3n) };
  const state = stateTree([item, token]);
  const other = stateTree([{ tag: 0, keyData: ZEROS, value: word(1n) }]);
  const characters = characterTree([
    { tokenId: 1n, characterRoot: other.root },
    { tokenId: 2n, characterRoot: state.root },
  ]);
  const leafIndex = 1;
  return {
    certificate: commitOver(characters.root),
    character: {
      tokenId: 2n,
      characterRoot: state.root,
      siblings: characters.proof(1),
    },
    leaf: {
      tag: item.tag,
      keyData: item.keyData,
      value: item.value,
      siblings: state.proof(leafIndex),
    },
    leafHash: state.leaves[leafIndex]!,
  };
}

function commitOver(root: Uint8Array, signers: readonly number[] = [0, 1]): LightCertificate {
  return {
    replicas: replicaKeys,
    threshold: 2,
    height: HEIGHT,
    round: ROUND,
    root,
    signatures: signers.map((index) => {
      const key = replicas[index]!;
      return precommit(key.secretKey, replicaKeys[index]!, root);
    }),
  };
}

function precommit(secretKey: Uint8Array, publicKey: Uint8Array, root: Uint8Array): ReplicaPrecommit {
  return {
    publicKey,
    signature: ed25519.sign(specPrecommit(HEIGHT, ROUND, root, publicKey), secretKey),
  };
}

function specPrecommit(height: number, round: number, root: Uint8Array, address: Uint8Array): Uint8Array {
  const heightBytes = new Uint8Array(8);
  const roundBytes = new Uint8Array(8);
  new DataView(heightBytes.buffer).setBigUint64(0, BigInt(height), false);
  new DataView(roundBytes.buffer).setBigInt64(0, BigInt(round), false);
  return concatBytes([
    new TextEncoder().encode("lok-order-vote-v1"),
    new Uint8Array([2]),
    heightBytes,
    roundBytes,
    new Uint8Array([1]),
    root,
    address,
  ]);
}

function stateTree(entries: StateEntry[]): {
  root: Uint8Array;
  leaves: Uint8Array[];
  proof: (index: number) => Sibling[];
} {
  const sorted = [...entries].sort(compareKey);
  const leaves = sorted.map(stateLeaf);
  const layers = merkle(leaves);
  return {
    root: layers[layers.length - 1]![0]!,
    leaves,
    proof: (index) => proof(layers, index),
  };
}

function characterTree(rows: { tokenId: bigint; characterRoot: Uint8Array }[]): {
  root: Uint8Array;
  proof: (index: number) => Sibling[];
} {
  const sorted = [...rows].sort((a, b) => (a.tokenId < b.tokenId ? -1 : a.tokenId > b.tokenId ? 1 : 0));
  const leaves = sorted.map((row) => keccak(concatBytes([word(row.tokenId), row.characterRoot])));
  const layers = merkle(leaves);
  return {
    root: layers[layers.length - 1]![0]!,
    proof: (index) => proof(layers, index),
  };
}

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

function keccak(data: Uint8Array): Uint8Array {
  return new Uint8Array(keccak256(data, "bytes"));
}
