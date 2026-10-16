/**
 * Web light client for one character.
 *
 * The order is fixed. First the replica commit certificate must carry enough
 * valid precommits over the certified root. Then the character-root proof must
 * recompute to that root. Then one state leaf must recompute to that character
 * root. A failed step is the result. Later steps are not checked.
 *
 * A commit certificate is the replica precommit bundle, not the epoch leader's
 * batch-envelope signature. The leader signs `bellgrave-batch-v1`. Replicas
 * sign `lok-order-vote-v1` precommits. That leader signature is not read here.
 *
 * The signed precommit matches `vote_bytes` in `contracts/lok-order`: the
 * domain, vote type 2, big-endian height, big-endian round, a value tag, the
 * 32-byte root, and the 32-byte signer address. The address is the Ed25519
 * public key. Each replica has voting power one. The threshold is the strict
 * majority from `majority_threshold`: `1 + floor(n / 2)`. One replica still
 * needs one signature. Two of three are enough. One of three is not.
 *
 * The character-root leaf matches `character_root.rs`: keccak256 of the
 * 32-byte token id concatenated with the 32-byte character root. Internal
 * nodes are keccak256(left || right). An empty character-root tree is 32
 * zero bytes. `sibling.left` means the sibling is the left child.
 *
 * The state leaf matches `state.rs` `leaf`: `Buf::u8` writes the key tag as
 * a 32-byte ABI word, then the 32-byte key data, then the 32-byte value.
 * An empty state root is keccak256 of empty bytes. A one-entry map's root
 * is that single leaf.
 */
import { ed25519 } from "@noble/curves/ed25519.js";
import { concatBytes, keccak256 } from "viem";

const VOTE_DOMAIN = new TextEncoder().encode("lok-order-vote-v1");
const PRECOMMIT = 2;
const REPLICA_KEY_BYTES = 32;
const REPLICA_SIG_BYTES = 64;

/** Sibling on the path from a leaf to a root. */
export type Sibling = {
  hash: Uint8Array;
  /** The sibling is the left child. The proven node is on the right. */
  left: boolean;
};

/** One replica precommit of the certified root. */
export type ReplicaPrecommit = {
  /** 32-byte Ed25519 public key. This is the replica address. */
  publicKey: Uint8Array;
  /** 64-byte Ed25519 signature over the precommit of `root`. */
  signature: Uint8Array;
};

/**
 * Replica commit certificate. `root` is the batch character-root tree.
 * `threshold` must be the strict majority of `replicas`.
 */
export type LightCertificate = {
  replicas: readonly Uint8Array[];
  threshold: number;
  height: number;
  round: number;
  root: Uint8Array;
  signatures: readonly ReplicaPrecommit[];
};

/** Inclusion of one `(tokenId, characterRoot)` leaf under the certified root. */
export type CharacterRootClaim = {
  tokenId: bigint;
  characterRoot: Uint8Array;
  siblings: readonly Sibling[];
};

/**
 * One character-state leaf under that character root.
 * `tag` is `key_tag` from `state.rs`. Scalar keys use 32 zero bytes of key data.
 */
export type StateLeafClaim = {
  tag: number;
  keyData: Uint8Array;
  value: Uint8Array;
  siblings: readonly Sibling[];
};

export type WebLightPayload = {
  certificate: LightCertificate;
  character: CharacterRootClaim;
  leaf: StateLeafClaim;
};

export type WebLightStage = "certificate" | "character_root" | "leaf";

export type WebLightResult =
  | {
      ok: true;
      nextRoot: Uint8Array;
      characterRoot: Uint8Array;
      leaf: Uint8Array;
    }
  | { ok: false; stage: WebLightStage };

/**
 * Strict majority of a replica set, matching `majority_threshold`.
 * A set of one needs one signature. A set of three needs two.
 */
export function commitThreshold(replicaCount: number): number | null {
  if (!Number.isSafeInteger(replicaCount) || replicaCount < 1) return null;
  return 1 + Math.floor(replicaCount / 2);
}

/**
 * Certificate, then the character root inside that certified root, then one leaf.
 * Character and leaf fields are not read when an earlier stage fails.
 */
export function checkWebLightClient(payload: WebLightPayload): WebLightResult {
  const nextRoot = acceptCertificate(payload.certificate);
  if (!nextRoot) return { ok: false, stage: "certificate" };

  const characterRoot = acceptCharacterRoot(nextRoot, payload.character);
  if (!characterRoot) return { ok: false, stage: "character_root" };

  const leaf = acceptStateLeaf(characterRoot, payload.leaf);
  if (!leaf) return { ok: false, stage: "leaf" };

  return { ok: true, nextRoot, characterRoot, leaf };
}

/**
 * Payload attached to a snapshot, if the server sent one.
 * A snapshot with no `lightClient` field returns null. The HUD stays as it was.
 * A present payload that cannot be read still goes through the checker and
 * fails at the certificate.
 */
export function lightClientFromSnapshot(snapshot: object): WebLightPayload | null {
  if (!("lightClient" in snapshot)) return null;
  const wire = (snapshot as { lightClient?: unknown }).lightClient;
  if (wire == null) return null;
  return decodeLightClient(wire) ?? unsignedPayload();
}

function acceptCertificate(certificate: LightCertificate): Uint8Array | null {
  if (!certificate || typeof certificate !== "object") return null;
  const replicas = uniqueReplicas(certificate.replicas);
  if (!replicas) return null;
  const need = commitThreshold(replicas.size);
  if (need === null || certificate.threshold !== need) return null;
  if (!Number.isSafeInteger(certificate.height) || certificate.height < 0) return null;
  if (!Number.isSafeInteger(certificate.round) || certificate.round < 0) return null;
  const root = hash32(certificate.root);
  if (!root || !Array.isArray(certificate.signatures)) return null;

  const counted = new Set<string>();
  for (const entry of certificate.signatures) {
    if (!entry || typeof entry !== "object") return null;
    const publicKey = entry.publicKey;
    const signature = entry.signature;
    if (!(publicKey instanceof Uint8Array) || publicKey.length !== REPLICA_KEY_BYTES) return null;
    if (!(signature instanceof Uint8Array) || signature.length !== REPLICA_SIG_BYTES) return null;
    const id = bytesId(publicKey);
    if (!replicas.has(id) || counted.has(id)) continue;
    if (!precommitOk(publicKey, signature, certificate.height, certificate.round, root)) continue;
    counted.add(id);
  }
  if (counted.size < need) return null;
  return copyBytes(root);
}

function uniqueReplicas(replicas: readonly Uint8Array[]): Map<string, Uint8Array> | null {
  if (!Array.isArray(replicas) || replicas.length === 0) return null;
  const keys = new Map<string, Uint8Array>();
  for (const key of replicas) {
    if (!(key instanceof Uint8Array) || key.length !== REPLICA_KEY_BYTES) return null;
    const id = bytesId(key);
    if (keys.has(id)) return null;
    keys.set(id, key);
  }
  return keys;
}

function precommitOk(
  publicKey: Uint8Array,
  signature: Uint8Array,
  height: number,
  round: number,
  root: Uint8Array,
): boolean {
  try {
    return ed25519.verify(signature, precommitMessage(height, round, root, publicKey), publicKey);
  } catch {
    return false;
  }
}

/** Bytes a replica signs for a precommit of `root`. Same layout as `vote_bytes`. */
function precommitMessage(
  height: number,
  round: number,
  root: Uint8Array,
  address: Uint8Array,
): Uint8Array {
  const heightBytes = new Uint8Array(8);
  const roundBytes = new Uint8Array(8);
  new DataView(heightBytes.buffer).setBigUint64(0, BigInt(height), false);
  new DataView(roundBytes.buffer).setBigInt64(0, BigInt(round), false);
  return concatBytes([
    VOTE_DOMAIN,
    new Uint8Array([PRECOMMIT]),
    heightBytes,
    roundBytes,
    new Uint8Array([1]),
    root,
    address,
  ]);
}

function acceptCharacterRoot(nextRoot: Uint8Array, claim: CharacterRootClaim): Uint8Array | null {
  if (!claim || typeof claim !== "object") return null;
  if (typeof claim.tokenId !== "bigint") return null;
  if (claim.tokenId < 0n || claim.tokenId >= 1n << 256n) return null;
  if (!(claim.characterRoot instanceof Uint8Array) || claim.characterRoot.length !== 32) return null;
  const leaf = keccak(concatBytes([u256(claim.tokenId), claim.characterRoot]));
  const got = fold(leaf, claim.siblings);
  if (!got || !sameBytes(got, nextRoot)) return null;
  return copyBytes(claim.characterRoot);
}

function acceptStateLeaf(characterRoot: Uint8Array, claim: StateLeafClaim): Uint8Array | null {
  if (!claim || typeof claim !== "object") return null;
  if (!Number.isInteger(claim.tag) || claim.tag < 0 || claim.tag > 255) return null;
  if (!(claim.keyData instanceof Uint8Array) || claim.keyData.length !== 32) return null;
  if (!(claim.value instanceof Uint8Array) || claim.value.length !== 32) return null;
  const tag = new Uint8Array(32);
  tag[31] = claim.tag;
  const leaf = keccak(concatBytes([tag, claim.keyData, claim.value]));
  const got = fold(leaf, claim.siblings);
  if (!got || !sameBytes(got, characterRoot)) return null;
  return leaf;
}

function fold(start: Uint8Array, siblings: readonly Sibling[]): Uint8Array | null {
  if (start.length !== 32 || !Array.isArray(siblings)) return null;
  let hash = start;
  for (const sibling of siblings) {
    if (!sibling || typeof sibling !== "object") return null;
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

function hash32(bytes: Uint8Array): Uint8Array | null {
  if (!(bytes instanceof Uint8Array) || bytes.length !== 32) return null;
  return bytes;
}

function u256(value: bigint): Uint8Array {
  const out = new Uint8Array(32);
  let rest = value;
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(rest & 0xffn);
    rest >>= 8n;
  }
  return out;
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

function bytesId(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out;
}

function unsignedPayload(): WebLightPayload {
  const missing = new Uint8Array(0);
  return {
    certificate: {
      replicas: [],
      threshold: 0,
      height: 0,
      round: 0,
      root: missing,
      signatures: [],
    },
    character: { tokenId: 0n, characterRoot: missing, siblings: [] },
    leaf: { tag: 0, keyData: missing, value: missing, siblings: [] },
  };
}

function decodeLightClient(wire: unknown): WebLightPayload | null {
  if (!wire || typeof wire !== "object") return null;
  const row = wire as Record<string, unknown>;
  if (isBytePayload(row)) return row as WebLightPayload;
  const replicas = readKeyList(row.replicas);
  const signatures = readPrecommits(row.signatures);
  const root = readBytes(row.root);
  const characterRoot = readBytes(row.characterRoot);
  const keyData = readBytes(row.keyData);
  const value = readBytes(row.value);
  const tokenId = readTokenId(row.tokenId);
  const characterSiblings = readSiblings(row.characterSiblings);
  const leafSiblings = readSiblings(row.leafSiblings);
  if (
    !replicas ||
    !signatures ||
    !root ||
    !characterRoot ||
    !keyData ||
    !value ||
    tokenId === null ||
    !characterSiblings ||
    !leafSiblings ||
    typeof row.threshold !== "number" ||
    typeof row.height !== "number" ||
    typeof row.round !== "number" ||
    typeof row.tag !== "number"
  ) {
    return null;
  }
  return {
    certificate: {
      replicas,
      threshold: row.threshold,
      height: row.height,
      round: row.round,
      root,
      signatures,
    },
    character: { tokenId, characterRoot, siblings: characterSiblings },
    leaf: { tag: row.tag, keyData, value, siblings: leafSiblings },
  };
}

function isBytePayload(row: Record<string, unknown>): boolean {
  const certificate = row.certificate;
  if (!certificate || typeof certificate !== "object") return false;
  return (certificate as { root?: unknown }).root instanceof Uint8Array;
}

function readKeyList(value: unknown): Uint8Array[] | null {
  if (!Array.isArray(value)) return null;
  const keys: Uint8Array[] = [];
  for (const item of value) {
    const key = readBytes(item);
    if (!key) return null;
    keys.push(key);
  }
  return keys;
}

function readPrecommits(value: unknown): ReplicaPrecommit[] | null {
  if (!Array.isArray(value)) return null;
  const signatures: ReplicaPrecommit[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const row = item as { publicKey?: unknown; signature?: unknown };
    const publicKey = readBytes(row.publicKey);
    const signature = readBytes(row.signature);
    if (!publicKey || !signature) return null;
    signatures.push({ publicKey, signature });
  }
  return signatures;
}

function readSiblings(value: unknown): Sibling[] | null {
  if (!Array.isArray(value)) return null;
  const siblings: Sibling[] = [];
  for (const step of value) {
    if (!step || typeof step !== "object") return null;
    const row = step as { hash?: unknown; left?: unknown };
    const hash = readBytes(row.hash);
    if (!hash || typeof row.left !== "boolean") return null;
    siblings.push({ hash, left: row.left });
  }
  return siblings;
}

function readTokenId(value: unknown): bigint | null {
  if (typeof value === "bigint") return value;
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value)) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function readBytes(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) return value;
  if (typeof value !== "string") return null;
  const raw = value.startsWith("0x") || value.startsWith("0X") ? value.slice(2) : value;
  if (raw.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(raw)) return null;
  const out = new Uint8Array(raw.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(raw.slice(i * 2, i * 2 + 2), 16);
  return out;
}
