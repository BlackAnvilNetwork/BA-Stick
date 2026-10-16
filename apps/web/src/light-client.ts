/**
 * Web light client for one character.
 *
 * The order is fixed. First the epoch leader's BLS12-381 certificate must
 * name this batch's next root. Then the character-root proof must recompute
 * to that root. Then one state leaf must recompute to that character root.
 * A failed step is the result. Later steps are not checked.
 *
 * The certificate is the layout in `apps/server/src/batch-envelope.ts`:
 * a 48-byte G1 public key and a 96-byte G2 signature. The signed message is
 * keccak256 of `bellgrave-batch-v1`, the commitments and roots, big-endian
 * epoch and height, then UTF-8 world id and protocol version. Verification
 * hashes that digest with `bls.hash` before `verify`, the same as
 * `leaderSignatureOk`. This file does not import the server.
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
import { bls12_381 } from "@noble/curves/bls12-381.js";
import { concatBytes, keccak256 } from "viem";

const LEADER_DOMAIN = new TextEncoder().encode("bellgrave-batch-v1");
const LEADER_KEY_BYTES = 48;
const LEADER_SIG_BYTES = 96;
const bls = bls12_381.longSignatures;

/** Sibling on the path from a leaf to a root. */
export type Sibling = {
  hash: Uint8Array;
  /** The sibling is the left child. The proven node is on the right. */
  left: boolean;
};

/** Epoch leader certificate. `nextRoot` is the batch character-root tree. */
export type LightCertificate = {
  leaderPublicKey: Uint8Array;
  /** 96-byte G2 signature. Absent, or any other length, fails the certificate. */
  signature?: Uint8Array;
  inputsCommitment: Uint8Array;
  parentRoot: Uint8Array;
  nextRoot: Uint8Array;
  rulesetHash: Uint8Array;
  epochSeed: Uint8Array;
  rollCommitment: Uint8Array;
  epoch: number;
  height: number;
  worldId: string;
  protocolVersion: string;
};

/** Inclusion of one `(tokenId, characterRoot)` leaf under the certified next root. */
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
 * Certificate, then the character root named by that certificate, then one leaf.
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
  const signature = certificate.signature;
  const publicKey = certificate.leaderPublicKey;
  if (!(signature instanceof Uint8Array) || signature.length !== LEADER_SIG_BYTES) return null;
  if (!(publicKey instanceof Uint8Array) || publicKey.length !== LEADER_KEY_BYTES) return null;
  const message = leaderSigningMessage(certificate);
  if (!message) return null;
  try {
    const hashed = bls.hash(message);
    if (!bls.verify(signature, hashed, publicKey)) return null;
  } catch {
    return null;
  }
  return copyBytes(certificate.nextRoot);
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

/**
 * Keccak256 of the bytes the epoch leader signs.
 * Domain, then inputsCommitment, parentRoot, nextRoot, rulesetHash,
 * epochSeed, rollCommitment, big-endian epoch, big-endian height,
 * then UTF-8 worldId and protocolVersion.
 */
function leaderSigningMessage(certificate: LightCertificate): Uint8Array | null {
  const inputsCommitment = hash32(certificate.inputsCommitment);
  const parentRoot = hash32(certificate.parentRoot);
  const nextRoot = hash32(certificate.nextRoot);
  const rulesetHash = hash32(certificate.rulesetHash);
  const epochSeed = hash32(certificate.epochSeed);
  const rollCommitment = hash32(certificate.rollCommitment);
  const epoch = u64be(certificate.epoch);
  const height = u64be(certificate.height);
  if (
    !inputsCommitment ||
    !parentRoot ||
    !nextRoot ||
    !rulesetHash ||
    !epochSeed ||
    !rollCommitment ||
    !epoch ||
    !height ||
    typeof certificate.worldId !== "string" ||
    typeof certificate.protocolVersion !== "string"
  ) {
    return null;
  }
  return new Uint8Array(
    keccak256(
      concatBytes([
        LEADER_DOMAIN,
        inputsCommitment,
        parentRoot,
        nextRoot,
        rulesetHash,
        epochSeed,
        rollCommitment,
        epoch,
        height,
        new TextEncoder().encode(certificate.worldId),
        new TextEncoder().encode(certificate.protocolVersion),
      ]),
      "bytes",
    ),
  );
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

function u64be(value: number): Uint8Array | null {
  if (!Number.isSafeInteger(value) || value < 0) return null;
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigUint64(0, BigInt(value), false);
  return out;
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

function unsignedPayload(): WebLightPayload {
  const missing = new Uint8Array(0);
  return {
    certificate: {
      leaderPublicKey: missing,
      inputsCommitment: missing,
      parentRoot: missing,
      nextRoot: missing,
      rulesetHash: missing,
      epochSeed: missing,
      rollCommitment: missing,
      epoch: 0,
      height: 0,
      worldId: "",
      protocolVersion: "",
    },
    character: { tokenId: 0n, characterRoot: missing, siblings: [] },
    leaf: { tag: 0, keyData: missing, value: missing, siblings: [] },
  };
}

function decodeLightClient(wire: unknown): WebLightPayload | null {
  if (!wire || typeof wire !== "object") return null;
  const row = wire as Record<string, unknown>;
  if (isBytePayload(row)) return row as WebLightPayload;
  const leaderPublicKey = readBytes(row.leaderPublicKey);
  const inputsCommitment = readBytes(row.inputsCommitment);
  const parentRoot = readBytes(row.parentRoot);
  const nextRoot = readBytes(row.nextRoot);
  const rulesetHash = readBytes(row.rulesetHash);
  const epochSeed = readBytes(row.epochSeed);
  const rollCommitment = readBytes(row.rollCommitment);
  const characterRoot = readBytes(row.characterRoot);
  const keyData = readBytes(row.keyData);
  const value = readBytes(row.value);
  const tokenId = readTokenId(row.tokenId);
  const characterSiblings = readSiblings(row.characterSiblings);
  const leafSiblings = readSiblings(row.leafSiblings);
  if (
    !leaderPublicKey ||
    !inputsCommitment ||
    !parentRoot ||
    !nextRoot ||
    !rulesetHash ||
    !epochSeed ||
    !rollCommitment ||
    !characterRoot ||
    !keyData ||
    !value ||
    tokenId === null ||
    !characterSiblings ||
    !leafSiblings ||
    typeof row.epoch !== "number" ||
    typeof row.height !== "number" ||
    typeof row.worldId !== "string" ||
    typeof row.protocolVersion !== "string" ||
    typeof row.tag !== "number"
  ) {
    return null;
  }
  const signature = row.signature == null ? undefined : (readBytes(row.signature) ?? undefined);
  if (row.signature != null && !signature) return null;
  return {
    certificate: {
      leaderPublicKey,
      signature,
      inputsCommitment,
      parentRoot,
      nextRoot,
      rulesetHash,
      epochSeed,
      rollCommitment,
      epoch: row.epoch,
      height: row.height,
      worldId: row.worldId,
      protocolVersion: row.protocolVersion,
    },
    character: { tokenId, characterRoot, siblings: characterSiblings },
    leaf: { tag: row.tag, keyData, value, siblings: leafSiblings },
  };
}

function isBytePayload(row: Record<string, unknown>): boolean {
  const certificate = row.certificate;
  if (!certificate || typeof certificate !== "object") return false;
  return (certificate as { nextRoot?: unknown }).nextRoot instanceof Uint8Array;
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
