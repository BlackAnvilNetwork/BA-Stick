/**
 * Web light client check for one of the player's own characters.
 *
 * The order is mandatory. A commit certificate is accepted only when it
 * carries enough valid replica precommits. That certificate's next root is
 * the batch character-root tree: keccak over `(tokenId, characterRoot)`,
 * with an empty tree of 32 zero bytes. Only after that certified root
 * contains this character does the client accept one state leaf under the
 * character root. A failed certificate does not accept the root. A failed
 * root does not accept the leaf.
 *
 * The certificate bytes are the layout `lok-order` stores for the root
 * anchor: height `u64` LE, round `i64` LE, the 32-byte next root, a `u32`
 * LE signature count, then each signer as a 32-byte address and a 64-byte
 * Ed25519 signature. The address is the signer's public key. The signed
 * message is a precommit, the same `lok-order-vote-v1` bytes as
 * `vote_bytes` in `contracts/lok-order`.
 */
import { ed25519 } from "@noble/curves/ed25519.js";
import { concatBytes, keccak256 } from "viem";

/** Sibling on the path from a leaf to a root. */
export type Sibling = {
  hash: Uint8Array;
  /** The sibling is the left child. The proven node is on the right. */
  left: boolean;
};

/** Inclusion of one character root in the certified batch root. */
export type CharacterRootClaim = {
  tokenId: bigint;
  characterRoot: Uint8Array;
  siblings: readonly Sibling[];
};

/**
 * One leaf of that character's state tree (`commit_map` in `state.rs`).
 * `tag` is `key_tag`. Scalar keys use 32 zero bytes of key data.
 */
export type StateLeafClaim = {
  tag: number;
  keyData: Uint8Array;
  value: Uint8Array;
  siblings: readonly Sibling[];
};

export type WebLightView = {
  certificate: Uint8Array;
  /** Ed25519 public keys. Each replica's certificate address is this key. */
  replicas: readonly Uint8Array[];
  /** How many distinct valid replica signatures the certificate must carry. */
  threshold: number;
  character: CharacterRootClaim;
  leaf: StateLeafClaim;
};

export type WebLightResult =
  | {
      ok: true;
      /** Certified batch next root. */
      root: Uint8Array;
      characterRoot: Uint8Array;
      /** Keccak of the one accepted state leaf. */
      leaf: Uint8Array;
    }
  | { ok: false; stage: "certificate" | "characterRoot" | "leaf" };

const EMPTY_CHARACTER_TREE = new Uint8Array(32);
const VOTE_PREFIX = new TextEncoder().encode("lok-order-vote-v1");

/**
 * Certificate, then the character root inside that certified root, then one
 * leaf. Later fields are not read when an earlier stage fails.
 */
export function checkWebLightClient(view: WebLightView): WebLightResult {
  const certified = acceptCertificate(view.certificate, view.replicas, view.threshold);
  if (!certified) return { ok: false, stage: "certificate" };

  const characterRoot = acceptCharacterRoot(certified, view.character);
  if (!characterRoot) return { ok: false, stage: "characterRoot" };

  const leaf = acceptStateLeaf(characterRoot, view.leaf);
  if (!leaf) return { ok: false, stage: "leaf" };

  return { ok: true, root: certified, characterRoot, leaf };
}

function acceptCertificate(
  certificate: Uint8Array,
  replicas: readonly Uint8Array[],
  threshold: number,
): Uint8Array | null {
  const set = replicaSet(replicas);
  if (!set) return null;
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > set.size) return null;
  const parsed = parseCertificate(certificate);
  if (!parsed) return null;

  const seen = new Set<string>();
  let valid = 0;
  for (const signer of parsed.signers) {
    const id = hex(signer.address);
    if (seen.has(id)) continue;
    const publicKey = set.get(id);
    if (!publicKey) continue;
    seen.add(id);
    const message = precommitBytes(parsed.height, parsed.round, parsed.root, signer.address);
    if (ed25519Ok(signer.signature, message, publicKey)) valid += 1;
  }
  if (valid < threshold) return null;
  return copyBytes(parsed.root);
}

function acceptCharacterRoot(certifiedRoot: Uint8Array, claim: CharacterRootClaim): Uint8Array | null {
  if (sameBytes(certifiedRoot, EMPTY_CHARACTER_TREE)) return null;
  if (typeof claim.tokenId !== "bigint") return null;
  if (!(claim.characterRoot instanceof Uint8Array) || claim.characterRoot.length !== 32) return null;
  const leaf = characterRootLeaf(claim.tokenId, claim.characterRoot);
  if (!leaf) return null;
  const got = fold(leaf, claim.siblings);
  if (!got || !sameBytes(got, certifiedRoot)) return null;
  return copyBytes(claim.characterRoot);
}

function acceptStateLeaf(characterRoot: Uint8Array, claim: StateLeafClaim): Uint8Array | null {
  if (!(claim.keyData instanceof Uint8Array) || !(claim.value instanceof Uint8Array)) return null;
  const leaf = stateLeaf(claim.tag, claim.keyData, claim.value);
  if (!leaf) return null;
  const got = fold(leaf, claim.siblings);
  if (!got || !sameBytes(got, characterRoot)) return null;
  return leaf;
}

type ParsedCertificate = {
  height: bigint;
  round: bigint;
  root: Uint8Array;
  signers: { address: Uint8Array; signature: Uint8Array }[];
};

function parseCertificate(certificate: Uint8Array): ParsedCertificate | null {
  if (!(certificate instanceof Uint8Array) || certificate.length < 52) return null;
  const view = dataView(certificate);
  let height: bigint;
  let round: bigint;
  try {
    height = view.getBigUint64(0, true);
    round = view.getBigInt64(8, true);
  } catch {
    return null;
  }
  const count = view.getUint32(48, true);
  const rest = certificate.length - 52;
  if (rest !== count * 96) return null;
  const root = certificate.subarray(16, 48);
  const signers = [];
  for (let i = 0; i < count; i++) {
    const at = 52 + i * 96;
    const address = certificate.subarray(at, at + 32);
    const signature = certificate.subarray(at + 32, at + 96);
    if (address.length !== 32 || signature.length !== 64) return null;
    signers.push({ address, signature });
  }
  return { height, round, root, signers };
}

function replicaSet(replicas: readonly Uint8Array[]): Map<string, Uint8Array> | null {
  if (!Array.isArray(replicas) || replicas.length === 0) return null;
  const set = new Map<string, Uint8Array>();
  for (const key of replicas) {
    if (!(key instanceof Uint8Array) || key.length !== 32) return null;
    set.set(hex(key), key);
  }
  return set.size > 0 ? set : null;
}

/** Precommit bytes for the certified root. Height and round are big-endian. */
function precommitBytes(height: bigint, round: bigint, root: Uint8Array, address: Uint8Array): Uint8Array {
  const out = new Uint8Array(VOTE_PREFIX.length + 1 + 8 + 8 + 1 + 32 + 32);
  out.set(VOTE_PREFIX, 0);
  let at = VOTE_PREFIX.length;
  out[at] = 2;
  at += 1;
  const view = new DataView(out.buffer);
  view.setBigUint64(at, height, false);
  at += 8;
  view.setBigInt64(at, round, false);
  at += 8;
  out[at] = 1;
  at += 1;
  out.set(root, at);
  at += 32;
  out.set(address, at);
  return out;
}

function ed25519Ok(signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array): boolean {
  if (signature.length !== 64 || publicKey.length !== 32) return false;
  try {
    return ed25519.verify(signature, message, publicKey) === true;
  } catch {
    return false;
  }
}

/** `keccak256(abi.encode(uint256 tokenId, bytes32 characterRoot))`. */
function characterRootLeaf(tokenId: bigint, characterRoot: Uint8Array): Uint8Array | null {
  const id = u256(tokenId);
  if (!id) return null;
  return keccak(concatBytes([id, characterRoot]));
}

/** `keccak256(abi word tag || key data || value)`, matching `state.rs` `leaf`. */
function stateLeaf(tag: number, keyData: Uint8Array, value: Uint8Array): Uint8Array | null {
  if (!Number.isInteger(tag) || tag < 0 || tag > 255) return null;
  if (keyData.length !== 32 || value.length !== 32) return null;
  const tagWord = u256(BigInt(tag));
  if (!tagWord) return null;
  return keccak(concatBytes([tagWord, keyData, value]));
}

function fold(leafHash: Uint8Array, siblings: readonly Sibling[]): Uint8Array | null {
  if (leafHash.length !== 32 || !Array.isArray(siblings)) return null;
  let hash = leafHash;
  for (const sibling of siblings) {
    if (!(sibling.hash instanceof Uint8Array) || sibling.hash.length !== 32) return null;
    if (typeof sibling.left !== "boolean") return null;
    hash = sibling.left ? pair(sibling.hash, hash) : pair(hash, sibling.hash);
  }
  return hash;
}

function pair(left: Uint8Array, right: Uint8Array): Uint8Array {
  return keccak(concatBytes([left, right]));
}

function keccak(data: Uint8Array): Uint8Array {
  return new Uint8Array(keccak256(data, "bytes"));
}

function u256(value: bigint): Uint8Array | null {
  if (value < 0n || value >= 1n << 256n) return null;
  const out = new Uint8Array(32);
  const hexWord = value.toString(16).padStart(64, "0");
  for (let i = 0; i < 32; i++) out[i] = Number.parseInt(hexWord.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function dataView(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function copyBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes);
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i]! ^ right[i]!;
  return diff === 0;
}

function hex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out;
}
