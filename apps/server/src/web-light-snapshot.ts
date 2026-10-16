/**
 * The light-client field on a live snapshot.
 *
 * `certificate` is the lok-order commit certificate: height `u64` LE, round
 * `i64` LE, 32-byte next root, `u32` LE signature count, then each signer as
 * a 32-byte address and a 64-byte Ed25519 signature. Replica public keys are
 * not written here. The character-root inclusion and one state leaf travel
 * beside that certificate.
 */
import type { WebLightClientMessage, WebLightSibling } from "@bellgrave/protocol";

export type LightSibling = { hash: Uint8Array; left: boolean };

export type SnapshotLightProof = {
  tokenId: bigint;
  characterRoot: Uint8Array;
  characterSiblings: readonly LightSibling[];
  tag: number;
  keyData: Uint8Array;
  value: Uint8Array;
  leafSiblings: readonly LightSibling[];
};

const HEADER_BYTES = 52;

/** Encode one lok-order commit certificate. The caller supplies the signatures. */
export function encodeCommitCertificate(input: {
  height: number;
  round: number;
  nextRoot: Uint8Array;
  signers: readonly { address: Uint8Array; signature: Uint8Array }[];
}): Uint8Array {
  const count = input.signers.length;
  const out = new Uint8Array(HEADER_BYTES + count * 96);
  const view = new DataView(out.buffer);
  view.setBigUint64(0, BigInt(input.height), true);
  view.setBigInt64(8, BigInt(input.round), true);
  out.set(input.nextRoot, 16);
  view.setUint32(48, count, true);
  input.signers.forEach((signer, index) => {
    const at = HEADER_BYTES + index * 96;
    out.set(signer.address, at);
    out.set(signer.signature, at + 32);
  });
  return out;
}

/**
 * Field `snapshotFor` attaches. A missing orderer certificate is empty bytes,
 * so the client still runs the check and stays provisional.
 */
export function snapshotLightClient(input: {
  commitCertificateHex?: string | null;
  certifiedRootHex?: string | null;
  tokenId?: string | null;
  proof?: SnapshotLightProof | null;
}): WebLightClientMessage {
  const certificate = parseHex(input.commitCertificateHex) ?? new Uint8Array();
  const claimed = parseHex(input.certifiedRootHex);
  const claimedRoot = claimed?.length === 32 ? claimed : new Uint8Array(32);
  const proof = input.proof ?? emptyProof(input.tokenId);
  return {
    certificate: hex(certificate),
    claimedRoot: hex(claimedRoot),
    tokenId: proof.tokenId.toString(10),
    characterRoot: hex(proof.characterRoot),
    characterSiblings: proof.characterSiblings.map(wireSibling),
    tag: proof.tag,
    keyData: hex(proof.keyData),
    value: hex(proof.value),
    leafSiblings: proof.leafSiblings.map(wireSibling),
  };
}

function emptyProof(tokenId: string | null | undefined): SnapshotLightProof {
  const zeros = new Uint8Array(32);
  return {
    tokenId: tokenId && /^(0|[1-9][0-9]*)$/.test(tokenId) ? BigInt(tokenId) : 0n,
    characterRoot: zeros,
    characterSiblings: [],
    tag: 0,
    keyData: zeros,
    value: zeros,
    leafSiblings: [],
  };
}

function wireSibling(sibling: LightSibling): WebLightSibling {
  return { hash: hex(sibling.hash), left: sibling.left };
}

function parseHex(value: string | null | undefined): Uint8Array | null {
  if (!value) return null;
  const raw = value.trim().replace(/^0x/i, "");
  if (raw.length === 0 || raw.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(raw)) return null;
  const out = new Uint8Array(raw.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(raw.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function hex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out;
}
