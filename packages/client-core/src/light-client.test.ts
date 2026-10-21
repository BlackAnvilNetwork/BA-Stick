/**
 * Signs replica precommits in process and checks one character against that
 * certified root. Keys are generated here. No env secret is read, and nothing
 * is posted. A batch-envelope leader signature is not a commit certificate.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { SnapshotMessage } from "@bellgrave/protocol";
import { bls12_381 } from "@noble/curves/bls12-381.js";
import { ed25519 } from "@noble/curves/ed25519.js";
import { concatBytes, keccak256 } from "viem";
import {
  encodeCommitCertificate,
  snapshotLightClient,
  type SnapshotLightProof,
} from "../../../apps/server/src/web-light-snapshot.ts";
import { useGame } from "./state";
import {
  checkWebLightClient,
  commitThreshold,
  lightClientFromSnapshot,
  setReplicaAllowlist,
  type CharacterRootClaim,
  type LightCertificate,
  type ReplicaPrecommit,
  type Sibling,
  type StateLeafClaim,
  type WebLightPayload,
} from "./light-client";

const bls = bls12_381.longSignatures;
const leader = bls.keygen();
const leaderKey = new Uint8Array(leader.publicKey.toBytes());
const leaderSecret = new Uint8Array(leader.secretKey);

const replicas = [ed25519.keygen(), ed25519.keygen(), ed25519.keygen()];
const replicaKeys = replicas.map((key) => new Uint8Array(key.publicKey));

const ZEROS = new Uint8Array(32);
const HEIGHT = 5;
const ROUND = 0;

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
  assert.equal(commitThreshold(3), 2);

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

test("a valid leader signature with no replica certificate stops at the certificate", () => {
  const world = passingWorld();
  const leaderOnly = leaderEnvelope(world.certificate.root);
  let characterReads = 0;
  let leafReads = 0;
  const rejected = checkWebLightClient({
    certificate: leaderOnly as unknown as LightCertificate,
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
  assert.equal(leaderOnly.signature.length, 96);
});

test("one replica signature is short of the majority and does not read the character root", () => {
  const world = passingWorld();
  let characterReads = 0;
  let leafReads = 0;
  const rejected = checkWebLightClient({
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
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.stage, "certificate");
  assert.equal(characterReads, 0);
  assert.equal(leafReads, 0);

  const lowered = checkWebLightClient({
    certificate: { ...commitOver(world.certificate.root, [0]), threshold: 1 },
    character: world.character,
    leaf: world.leaf,
  });
  assert.equal(lowered.ok, false);
  if (!lowered.ok) assert.equal(lowered.stage, "certificate");
});

test("a bad replica signature stops at the certificate and does not read the character root", () => {
  const world = passingWorld();
  const signatures = world.certificate.signatures.map((entry) => ({
    publicKey: entry.publicKey,
    signature: new Uint8Array(entry.signature),
  }));
  signatures[0]!.signature[signatures[0]!.signature.length - 1]! ^= 0x01;
  let characterReads = 0;
  let leafReads = 0;
  const rejected = checkWebLightClient({
    certificate: { ...world.certificate, signatures },
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
    certificate: { ...world.certificate, signatures: [] },
    character: world.character,
    leaf: world.leaf,
  });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.stage, "certificate");

  const short = checkWebLightClient({
    certificate: {
      ...world.certificate,
      signatures: [{ publicKey: replicaKeys[0]!, signature: signatures[0]!.signature.slice(0, 63) }],
    },
    character: world.character,
    leaf: world.leaf,
  });
  assert.equal(short.ok, false);
  if (!short.ok) assert.equal(short.stage, "certificate");
});

test("a precommit over a different root stops at the certificate", () => {
  const world = passingWorld();
  const otherRoot = new Uint8Array(32).fill(0xab);
  let characterReads = 0;
  const rejected = checkWebLightClient({
    certificate: { ...commitOver(otherRoot), root: world.certificate.root },
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

test("a one-replica set commits with its own precommit", () => {
  const world = passingWorld();
  const alone = ed25519.keygen();
  const publicKey = new Uint8Array(alone.publicKey);
  const certificate: LightCertificate = {
    replicas: [publicKey],
    threshold: 1,
    height: HEIGHT,
    round: ROUND,
    root: world.certificate.root,
    signatures: [precommit(alone.secretKey, publicKey, world.certificate.root)],
  };
  assert.equal(commitThreshold(1), 1);
  const ok = checkWebLightClient({
    certificate,
    character: world.character,
    leaf: world.leaf,
  });
  assert.equal(ok.ok, true);
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

test("a flipped state leaf fails after the certificate and character root", () => {
  const world = passingWorld();
  const value = new Uint8Array(world.leaf.value);
  value[value.length - 1] ^= 0x01;
  const rejected = checkWebLightClient({
    certificate: world.certificate,
    character: world.character,
    leaf: { ...world.leaf, value },
  });
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.stage, "leaf");
});

test("the web client keeps a leader snapshot provisional and commits only a passing proof", () => {
  const world = passingWorld();
  useGame.setState({
    wallet: null,
    snapshot: null,
    light: { leaderView: "provisional", committed: null },
  });
  useGame.getState().setSnapshot({
    type: "snapshot",
    tick: 8,
    you: {},
    units: [],
    log: [],
    party: null,
    partyInvite: null,
  } as unknown as SnapshotMessage);
  assert.equal(useGame.getState().light.leaderView, "provisional");
  assert.equal(useGame.getState().light.committed, null);

  const bad = passingWorld();
  const value = new Uint8Array(bad.leaf.value);
  value[value.length - 1] ^= 0x01;
  useGame.getState().setSnapshot({
    type: "snapshot",
    tick: 9,
    you: {},
    units: [],
    log: [],
    party: null,
    partyInvite: null,
    lightClient: { ...bad, leaf: { ...bad.leaf, value } },
  } as unknown as SnapshotMessage);
  assert.equal(useGame.getState().light.leaderView, "provisional");
  assert.equal(useGame.getState().light.committed, null);

  useGame.getState().setSnapshot({
    type: "snapshot",
    tick: 10,
    you: {},
    units: [],
    log: [],
    party: null,
    partyInvite: null,
    lightClient: world,
  } as unknown as SnapshotMessage);
  assert.equal(useGame.getState().light.leaderView, "provisional");
  assert.equal(useGame.getState().light.committed?.ok, true);
  assert.equal(useGame.getState().snapshot?.type, "snapshot");

  useGame.getState().setSnapshot({
    type: "snapshot",
    tick: 11,
    you: {},
    units: [],
    log: [],
    party: null,
    partyInvite: null,
  } as unknown as SnapshotMessage);
  assert.equal(useGame.getState().light.leaderView, "provisional");
  assert.equal(useGame.getState().light.committed, null);

  useGame.getState().setSnapshot({
    type: "snapshot",
    tick: 12,
    you: {},
    units: [],
    log: [],
    party: null,
    partyInvite: null,
    lightClient: world,
  } as unknown as SnapshotMessage);
  assert.equal(useGame.getState().light.committed?.ok, true);
  useGame.getState().setSnapshot({
    type: "snapshot",
    tick: 13,
    you: {},
    units: [],
    log: [],
    party: null,
    partyInvite: null,
    lightClient: { ...bad, leaf: { ...bad.leaf, value } },
  } as unknown as SnapshotMessage);
  assert.equal(useGame.getState().light.leaderView, "provisional");
  assert.equal(useGame.getState().light.committed, null);

  const leaderOnly = leaderEnvelope(world.certificate.root);
  useGame.getState().setSnapshot({
    type: "snapshot",
    tick: 14,
    you: {},
    units: [],
    log: [],
    party: null,
    partyInvite: null,
    lightClient: {
      certificate: leaderOnly,
      character: world.character,
      leaf: world.leaf,
    },
  } as unknown as SnapshotMessage);
  assert.equal(useGame.getState().light.committed, null);

  useGame.getState().setSnapshot({
    type: "snapshot",
    tick: 15,
    you: {},
    units: [],
    log: [],
    party: null,
    partyInvite: null,
    lightClient: {
      certificate: commitOver(world.certificate.root, [0]),
      character: world.character,
      leaf: world.leaf,
    },
  } as unknown as SnapshotMessage);
  assert.equal(useGame.getState().light.committed, null);

  useGame.getState().setSnapshot({
    type: "snapshot",
    tick: 16,
    you: {},
    units: [],
    log: [],
    party: null,
    partyInvite: null,
    lightClient: world,
  } as unknown as SnapshotMessage);
  assert.equal(useGame.getState().light.committed?.ok, true);
  const sibling = world.character.siblings[0];
  assert.ok(sibling);
  const flipped: Sibling = { hash: new Uint8Array(sibling.hash), left: sibling.left };
  flipped.hash[0]! ^= 0x01;
  useGame.getState().setSnapshot({
    type: "snapshot",
    tick: 17,
    you: {},
    units: [],
    log: [],
    party: null,
    partyInvite: null,
    lightClient: {
      certificate: world.certificate,
      character: { ...world.character, siblings: [flipped] },
      leaf: world.leaf,
    },
  } as unknown as SnapshotMessage);
  assert.equal(useGame.getState().light.committed, null);
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

function signed(root: Uint8Array): LightCertificate {
  return commitOver(root);
}

/** Two of the three replicas, unless `signers` says otherwise. */
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

/** Independent of the checker. Same byte layout as `vote_bytes` for a precommit. */
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

/**
 * Epoch-leader batch envelope. This signature is valid and is still not a
 * replica commit certificate.
 */
function leaderEnvelope(nextRoot: Uint8Array): {
  leaderPublicKey: Uint8Array;
  signature: Uint8Array;
  nextRoot: Uint8Array;
  inputsCommitment: Uint8Array;
  parentRoot: Uint8Array;
  rulesetHash: Uint8Array;
  epochSeed: Uint8Array;
  rollCommitment: Uint8Array;
  epoch: number;
  height: number;
  worldId: string;
  protocolVersion: string;
} {
  const certificate = {
    leaderPublicKey: leaderKey,
    inputsCommitment: filled(0x11),
    parentRoot: filled(0x22),
    nextRoot,
    rulesetHash: filled(0x33),
    epochSeed: filled(0x44),
    rollCommitment: filled(0x55),
    epoch: 2,
    height: HEIGHT,
    worldId: "bellgrave",
    protocolVersion: "1",
  };
  const epoch = new Uint8Array(8);
  const height = new Uint8Array(8);
  new DataView(epoch.buffer).setBigUint64(0, BigInt(certificate.epoch), false);
  new DataView(height.buffer).setBigUint64(0, BigInt(certificate.height), false);
  const message = new Uint8Array(
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
  return {
    ...certificate,
    signature: new Uint8Array(bls.sign(bls.hash(message), leaderSecret).toBytes()),
  };
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

test("a good certificate, character root, and leaf on a live snapshot pass", () => {
  setReplicaAllowlist(replicaKeys);
  assert.equal(commitThreshold(3), 2);
  assert.equal(commitThreshold(1), 1);
  const world = passingWorld();
  const lightClient = liveWire(world);
  assert.equal("leaderPublicKey" in lightClient, false);
  assert.equal("replicas" in lightClient, false);
  assert.equal(lightClient.certificate.length > 52 * 2, true);
  assert.equal(lightClient.characterSiblings.length, 1);
  assert.equal(lightClient.leafSiblings.length, 1);
  const encoded = bytesOf(lightClient.certificate);
  assert.equal(encoded[0], HEIGHT);
  assert.equal(encoded[7], 0);
  assert.equal(encoded.length, 52 + 2 * 96);

  useGame.setState({ wallet: null, snapshot: null, light: { leaderView: "provisional", committed: null } });
  useGame.getState().setSnapshot(snap(10, lightClient));
  assert.equal(useGame.getState().light.leaderView, "provisional");
  assert.equal(useGame.getState().light.committed?.ok, true);
  const verdict = checkWebLightClient(lightClientFromSnapshot(snap(10, lightClient)));
  assert.equal(verdict.ok, true);
});

test("one configured replica commits with its own signature", () => {
  const world = passingWorld();
  const alone = ed25519.keygen();
  const publicKey = new Uint8Array(alone.publicKey);
  setReplicaAllowlist([publicKey]);
  const certificate = encodeCommitCertificate({
    height: HEIGHT,
    round: ROUND,
    nextRoot: world.certificate.root,
    signers: [
      {
        address: publicKey,
        signature: ed25519.sign(specPrecommit(HEIGHT, ROUND, world.certificate.root, publicKey), alone.secretKey),
      },
    ],
  });
  useGame.getState().setSnapshot(snap(2, liveWire(world, certificate)));
  assert.equal(useGame.getState().light.committed?.ok, true);
  assert.equal(useGame.getState().light.leaderView, "provisional");
});

test("keys in the proof do not count, and one of three is short", () => {
  setReplicaAllowlist(replicaKeys);
  const world = passingWorld();
  const one = commitOver(world.certificate.root, [0]);
  let characterReads = 0;
  let leafReads = 0;
  const rejected = checkWebLightClient({
    certificate: blobOf(one),
    claimedRoot: world.certificate.root,
    get character() {
      characterReads += 1;
      return world.character;
    },
    get leaf() {
      leafReads += 1;
      return world.leaf;
    },
  } as unknown as WebLightPayload);
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.stage, "certificate");
  assert.equal(characterReads, 0);
  assert.equal(leafReads, 0);

  const outsider = ed25519.keygen();
  const outsiderKey = new Uint8Array(outsider.publicKey);
  const forged = encodeCommitCertificate({
    height: HEIGHT,
    round: ROUND,
    nextRoot: world.certificate.root,
    signers: [
      {
        address: outsiderKey,
        signature: ed25519.sign(
          specPrecommit(HEIGHT, ROUND, world.certificate.root, outsiderKey),
          outsider.secretKey,
        ),
      },
    ],
  });
  const wire = snapshotLightClient({
    commitCertificateHex: hexOf(forged),
    certifiedRootHex: hexOf(world.certificate.root),
    tokenId: world.character.tokenId.toString(10),
    proof: proofOf(world),
  });
  const stuffed = { ...wire, leaderPublicKey: hexOf(outsiderKey), replicas: [hexOf(outsiderKey)] };
  const verdict = checkWebLightClient(lightClientFromSnapshot(snap(3, stuffed)));
  assert.equal(verdict.ok, false);
  if (!verdict.ok) assert.equal(verdict.stage, "certificate");

  setReplicaAllowlist([]);
  const ignored = checkWebLightClient(lightClientFromSnapshot(snap(4, liveWire(passingWorld()))));
  assert.equal(ignored.ok, false);
  if (!ignored.ok) assert.equal(ignored.stage, "certificate");
});

test("a bad certificate, a flipped sibling, and a flipped leaf each fail and clear the committed view", () => {
  setReplicaAllowlist(replicaKeys);
  const world = passingWorld();
  useGame.setState({ wallet: null, snapshot: null, light: { leaderView: "provisional", committed: null } });

  useGame.getState().setSnapshot(snap(8));
  assert.equal(useGame.getState().light.leaderView, "provisional");
  assert.equal(useGame.getState().light.committed, null);
  const skipped = checkWebLightClient(lightClientFromSnapshot(snap(8)));
  assert.equal(skipped.ok, false);
  if (!skipped.ok) assert.equal(skipped.stage, "certificate");

  useGame.getState().setSnapshot(snap(9, liveWire(world)));
  assert.equal(useGame.getState().light.committed?.ok, true);

  useGame.getState().setSnapshot(snap(10));
  assert.equal(useGame.getState().light.committed, null);
  assert.equal(useGame.getState().light.leaderView, "provisional");

  useGame.getState().setSnapshot(snap(11, liveWire(world)));
  assert.equal(useGame.getState().light.committed?.ok, true);
  const badCert = liveWire(world);
  const flippedCert = bytesOf(badCert.certificate);
  flippedCert[flippedCert.length - 1]! ^= 0x01;
  badCert.certificate = hexOf(flippedCert);
  let characterReads = 0;
  const certFail = checkWebLightClient({
    ...lightClientFromSnapshot(snap(12, badCert)),
    get character() {
      characterReads += 1;
      return world.character;
    },
  });
  assert.equal(certFail.ok, false);
  if (!certFail.ok) assert.equal(certFail.stage, "certificate");
  assert.equal(characterReads, 0);
  useGame.getState().setSnapshot(snap(12, badCert));
  assert.equal(useGame.getState().light.committed, null);

  useGame.getState().setSnapshot(snap(13, liveWire(world)));
  assert.equal(useGame.getState().light.committed?.ok, true);
  const flippedSibling = liveWire(world);
  const sibling = flippedSibling.characterSiblings[0]!;
  const siblingBytes = bytesOf(sibling.hash);
  siblingBytes[0]! ^= 0x01;
  sibling.hash = hexOf(siblingBytes);
  let leafReads = 0;
  const siblingFail = checkWebLightClient({
    ...lightClientFromSnapshot(snap(14, flippedSibling)),
    get leaf() {
      leafReads += 1;
      return world.leaf;
    },
  });
  assert.equal(siblingFail.ok, false);
  if (!siblingFail.ok) assert.equal(siblingFail.stage, "character_root");
  assert.equal(leafReads, 0);
  useGame.getState().setSnapshot(snap(14, flippedSibling));
  assert.equal(useGame.getState().light.committed, null);
  assert.equal(useGame.getState().light.leaderView, "provisional");

  useGame.getState().setSnapshot(snap(15, liveWire(world)));
  assert.equal(useGame.getState().light.committed?.ok, true);
  const flippedLeaf = liveWire(world);
  const leafValue = bytesOf(flippedLeaf.value);
  leafValue[leafValue.length - 1]! ^= 0x01;
  flippedLeaf.value = hexOf(leafValue);
  const leafFail = checkWebLightClient(lightClientFromSnapshot(snap(16, flippedLeaf)));
  assert.equal(leafFail.ok, false);
  if (!leafFail.ok) assert.equal(leafFail.stage, "leaf");
  useGame.getState().setSnapshot(snap(16, flippedLeaf));
  assert.equal(useGame.getState().light.committed, null);
});

test("the orderer snapshot with no certificate stays provisional and clears a committed view", () => {
  setReplicaAllowlist(replicaKeys);
  const world = passingWorld();
  useGame.setState({ wallet: null, snapshot: null, light: { leaderView: "provisional", committed: null } });
  useGame.getState().setSnapshot(snap(20, liveWire(world)));
  assert.equal(useGame.getState().light.committed?.ok, true);

  const empty = snapshotLightClient({
    commitCertificateHex: null,
    certifiedRootHex: null,
    tokenId: "2",
  });
  assert.equal(empty.certificate, "");
  assert.equal(empty.characterSiblings.length, 0);
  assert.equal(empty.tag, 0);
  useGame.getState().setSnapshot(snap(21, empty));
  assert.equal(useGame.getState().light.leaderView, "provisional");
  assert.equal(useGame.getState().light.committed, null);
  const verdict = checkWebLightClient(lightClientFromSnapshot(snap(21, empty)));
  assert.equal(verdict.ok, false);
  if (!verdict.ok) assert.equal(verdict.stage, "certificate");
});

test("a claimed root the signatures did not cover is not committed", () => {
  setReplicaAllowlist(replicaKeys);
  const world = passingWorld();
  useGame.setState({ wallet: null, snapshot: null, light: { leaderView: "provisional", committed: null } });
  useGame.getState().setSnapshot(snap(30, liveWire(world)));
  assert.equal(useGame.getState().light.committed?.ok, true);

  const wire = liveWire(world);
  const claimed = bytesOf(wire.claimedRoot);
  claimed[0]! ^= 0xff;
  wire.claimedRoot = hexOf(claimed);
  let characterReads = 0;
  const verdict = checkWebLightClient({
    ...lightClientFromSnapshot(snap(31, wire)),
    get character() {
      characterReads += 1;
      return world.character;
    },
  });
  assert.equal(verdict.ok, false);
  if (!verdict.ok) assert.equal(verdict.stage, "certificate");
  assert.equal(characterReads, 0);
  useGame.getState().setSnapshot(snap(31, wire));
  assert.equal(useGame.getState().light.committed, null);
  assert.equal(useGame.getState().light.leaderView, "provisional");
});

test("a live snapshot of an empty character-root tree stops at the character root", () => {
  setReplicaAllowlist(replicaKeys);
  const emptyCharacter = new Uint8Array(32);
  const emptyState = keccak(new Uint8Array());
  const certificate = encodeCommitCertificate({
    height: HEIGHT,
    round: ROUND,
    nextRoot: emptyCharacter,
    signers: [0, 1].map((index) => ({
      address: replicaKeys[index]!,
      signature: ed25519.sign(
        specPrecommit(HEIGHT, ROUND, emptyCharacter, replicaKeys[index]!),
        replicas[index]!.secretKey,
      ),
    })),
  });
  const rejected = checkWebLightClient({
    certificate,
    claimedRoot: emptyCharacter,
    character: { tokenId: 1n, characterRoot: emptyState, siblings: [] },
    leaf: { tag: 0, keyData: ZEROS, value: word(1n), siblings: [] },
  } as unknown as WebLightPayload);
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.stage, "character_root");
});

function proofOf(world: WebLightPayload): SnapshotLightProof {
  return {
    tokenId: world.character.tokenId,
    characterRoot: world.character.characterRoot,
    characterSiblings: world.character.siblings,
    tag: world.leaf.tag,
    keyData: world.leaf.keyData,
    value: world.leaf.value,
    leafSiblings: world.leaf.siblings,
  };
}

function blobOf(certificate: LightCertificate): Uint8Array {
  return encodeCommitCertificate({
    height: certificate.height,
    round: certificate.round,
    nextRoot: certificate.root,
    signers: certificate.signatures.map((entry) => ({
      address: entry.publicKey,
      signature: entry.signature,
    })),
  });
}

function liveWire(world: WebLightPayload, certificate = blobOf(world.certificate)) {
  return snapshotLightClient({
    commitCertificateHex: hexOf(certificate),
    certifiedRootHex: hexOf(world.certificate.root),
    tokenId: world.character.tokenId.toString(10),
    proof: proofOf(world),
  });
}

function snap(tick: number, lightClient?: SnapshotMessage["lightClient"]): SnapshotMessage {
  return {
    type: "snapshot",
    tick,
    you: {} as SnapshotMessage["you"],
    units: [],
    log: [],
    party: null,
    partyInvite: null,
    ...(lightClient ? { lightClient } : {}),
  };
}

function hexOf(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out;
}

function bytesOf(value: string): Uint8Array {
  const out = new Uint8Array(value.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  return out;
}
