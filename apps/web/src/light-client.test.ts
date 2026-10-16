/**
 * Local fixture. Signs an Ed25519 commit certificate in process and checks
 * one character against that root. Nothing is posted to Gnosis.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { ed25519 } from "@noble/curves/ed25519.js";
import { concatBytes, keccak256 } from "viem";
import { checkWebLightClient, type Sibling, type StateLeafClaim, type WebLightView } from "./light-client";

const height = 4n;
const round = 0n;

test("walks a valid certificate, character root, and leaf, and does not look at the leaf when the certificate is bad", () => {
  const replicas = [secret(), secret(), secret()];
  const fixture = characterFixture();
  const certificate = encodeCertificate(
    height,
    round,
    fixture.batchRoot,
    replicas.slice(0, 2).map((replica) => sign(replica, fixture.batchRoot)),
  );

  let lookedAtLeaf = 0;
  const accepted = checkWebLightClient({
    certificate,
    replicas: replicas.map((replica) => replica.publicKey),
    threshold: 2,
    character: fixture.character,
    get leaf(): StateLeafClaim {
      lookedAtLeaf += 1;
      return fixture.leaf;
    },
  });

  assert.equal(lookedAtLeaf, 1);
  assert.equal(accepted.ok, true);
  if (accepted.ok) {
    assert.deepEqual(accepted.root, fixture.batchRoot);
    assert.deepEqual(accepted.characterRoot, fixture.characterRoot);
    assert.deepEqual(accepted.leaf, fixture.levelLeaf);
  }

  const bad = new Uint8Array(certificate);
  bad[bad.length - 1] ^= 0x01;
  let lookedAfterBadCertificate = 0;
  const rejected = checkWebLightClient({
    certificate: bad,
    replicas: replicas.map((replica) => replica.publicKey),
    threshold: 2,
    character: fixture.character,
    get leaf(): StateLeafClaim {
      lookedAfterBadCertificate += 1;
      return fixture.leaf;
    },
  });
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.stage, "certificate");
  assert.equal(lookedAfterBadCertificate, 0);
});

test("a character root that misses the certified root does not accept the leaf", () => {
  const replicas = [secret(), secret(), secret()];
  const fixture = characterFixture();
  const certificate = encodeCertificate(
    height,
    round,
    fixture.batchRoot,
    replicas.slice(0, 2).map((replica) => sign(replica, fixture.batchRoot)),
  );
  const flipped: Sibling = {
    hash: new Uint8Array(fixture.character.siblings[0]!.hash),
    left: fixture.character.siblings[0]!.left,
  };
  flipped.hash[0] ^= 0x01;

  let lookedAtLeaf = 0;
  const rejected = checkWebLightClient({
    certificate,
    replicas: replicas.map((replica) => replica.publicKey),
    threshold: 2,
    character: { ...fixture.character, siblings: [flipped] },
    get leaf(): StateLeafClaim {
      lookedAtLeaf += 1;
      return fixture.leaf;
    },
  });
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.stage, "characterRoot");
  assert.equal(lookedAtLeaf, 0);
});

test("the empty character-root tree is 32 zero bytes and does not accept a leaf", () => {
  const empty = new Uint8Array(32);
  const emptyState = new Uint8Array(keccak256(new Uint8Array(), "bytes"));
  assert.notDeepEqual(emptyState, empty);

  const replicas = [secret(), secret(), secret()];
  const fixture = characterFixture();
  const certificate = encodeCertificate(
    height,
    round,
    empty,
    replicas.slice(0, 2).map((replica) => sign(replica, empty)),
  );

  let lookedAtLeaf = 0;
  const rejected = checkWebLightClient({
    certificate,
    replicas: replicas.map((replica) => replica.publicKey),
    threshold: 2,
    character: fixture.character,
    get leaf(): StateLeafClaim {
      lookedAtLeaf += 1;
      return fixture.leaf;
    },
  });
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.stage, "characterRoot");
  assert.equal(lookedAtLeaf, 0);
});

type Replica = { secretKey: Uint8Array; publicKey: Uint8Array };

function secret(): Replica {
  const secretKey = ed25519.utils.randomSecretKey();
  return { secretKey, publicKey: ed25519.getPublicKey(secretKey) };
}

function sign(replica: Replica, root: Uint8Array): { address: Uint8Array; signature: Uint8Array } {
  return {
    address: replica.publicKey,
    signature: ed25519.sign(precommitMessage(height, round, root, replica.publicKey), replica.secretKey),
  };
}

function characterFixture(): {
  batchRoot: Uint8Array;
  characterRoot: Uint8Array;
  levelLeaf: Uint8Array;
  character: WebLightView["character"];
  leaf: StateLeafClaim;
} {
  const tokenLeaf = keccak(concatBytes([word(0n), word(0n), word(1n)]));
  const levelLeaf = keccak(concatBytes([word(1n), word(0n), word(1n)]));
  const characterRoot = keccak(concatBytes([tokenLeaf, levelLeaf]));
  const otherRoot = new Uint8Array(32).fill(0x22);
  const ours = keccak(concatBytes([word(1n), characterRoot]));
  const other = keccak(concatBytes([word(2n), otherRoot]));
  const batchRoot = keccak(concatBytes([ours, other]));
  return {
    batchRoot,
    characterRoot,
    levelLeaf,
    character: {
      tokenId: 1n,
      characterRoot,
      siblings: [{ hash: other, left: false }],
    },
    leaf: {
      tag: 1,
      keyData: word(0n),
      value: word(1n),
      siblings: [{ hash: tokenLeaf, left: true }],
    },
  };
}

/** Independent of the checker. Height and round are big-endian, matching `vote_bytes`. */
function precommitMessage(h: bigint, r: bigint, root: Uint8Array, address: Uint8Array): Uint8Array {
  const prefix = new TextEncoder().encode("lok-order-vote-v1");
  assert.equal(prefix.length, 17);
  const out = new Uint8Array(99);
  out.set(prefix, 0);
  out[17] = 2;
  const view = new DataView(out.buffer);
  view.setBigUint64(18, h, false);
  view.setBigInt64(26, r, false);
  out[34] = 1;
  out.set(root, 35);
  out.set(address, 67);
  return out;
}

/** Independent of the checker. Height and round are little-endian, matching `lok-order`. */
function encodeCertificate(
  h: bigint,
  r: bigint,
  root: Uint8Array,
  signatures: { address: Uint8Array; signature: Uint8Array }[],
): Uint8Array {
  const out = new Uint8Array(52 + signatures.length * 96);
  const view = new DataView(out.buffer);
  view.setBigUint64(0, h, true);
  view.setBigInt64(8, r, true);
  out.set(root, 16);
  view.setUint32(48, signatures.length, true);
  let at = 52;
  for (const signer of signatures) {
    assert.equal(signer.address.length, 32);
    assert.equal(signer.signature.length, 64);
    out.set(signer.address, at);
    out.set(signer.signature, at + 32);
    at += 96;
  }
  return out;
}

function word(value: bigint): Uint8Array {
  const out = new Uint8Array(32);
  const hexWord = value.toString(16).padStart(64, "0");
  for (let i = 0; i < 32; i++) out[i] = Number.parseInt(hexWord.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function keccak(data: Uint8Array): Uint8Array {
  return new Uint8Array(keccak256(data, "bytes"));
}
