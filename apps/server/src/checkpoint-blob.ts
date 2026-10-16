/**
 * Package one certified checkpoint as EIP-4844 blob bytes.
 *
 * A blob is 4096 field elements of 32 bytes. The first byte of each element
 * stays zero so the element sits under the BLS modulus, and the other 31
 * bytes carry the checkpoint. The blob is the publish path. This module does
 * not broadcast it, and it does not build a KZG proof. Gnosis mainnet (100)
 * and Chiado (10200) are refused.
 *
 * The anchor stores two values: a 48-byte commitment of the blob, and
 * keccak256 of the checkpoint bytes. The commitment is
 * `keccak256(domain || blob)` plus the first 16 bytes of
 * `keccak256(domain || blob || 0x01)`, with domain
 * `bellgrave-checkpoint-blob-v1`. Validators keep the checkpoint bytes.
 * Dropping the blob does not delete that copy. A 20 Hz batch is not a
 * checkpoint and is not packaged here.
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { concatBytes, keccak256 } from "viem";

const ANVIL_CHAIN_ID = 31337;
const FIELD_ELEMENTS = 4096;
const FIELD_BYTES = 32;
const PAYLOAD_PER_FIELD = 31;
const HEADER_BYTES = 5;
const DOMAIN = new TextEncoder().encode("bellgrave-checkpoint-blob-v1");

export const BLOB_BYTES = FIELD_ELEMENTS * FIELD_BYTES;
export const BLOB_COMMITMENT_BYTES = 48;
export const MAX_CHECKPOINT_BYTES = FIELD_ELEMENTS * PAYLOAD_PER_FIELD - HEADER_BYTES;

export type CertifiedCheckpoint = {
  kind: "checkpoint";
  bytes: Uint8Array;
  certificate: Uint8Array;
};

export type PackagedCheckpoint = {
  bytes: Uint8Array;
  blob: Uint8Array;
  commitment: Uint8Array;
  checkpointKeccak: Uint8Array;
};

export type CheckpointBlobPoster = (posted: {
  commitment: Uint8Array;
  checkpointKeccak: Uint8Array;
}) => Promise<boolean>;

type AnchoredCheckpointBlob = {
  commitment: Uint8Array;
  checkpointKeccak: Uint8Array;
};

const recorded = new Map<string, AnchoredCheckpointBlob>();

export function resetCheckpointBlobsForTests(): void {
  recorded.clear();
}

export function checkpointKeccak(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(keccak256(bytes, "bytes"));
}

/** 48-byte commitment of the packaged blob. Not a KZG opening. */
export function blobCommitment(blob: Uint8Array): Uint8Array {
  const first = new Uint8Array(keccak256(concatBytes([DOMAIN, blob]), "bytes"));
  const second = new Uint8Array(keccak256(concatBytes([DOMAIN, blob, Uint8Array.of(1)]), "bytes"));
  const out = new Uint8Array(BLOB_COMMITMENT_BYTES);
  out.set(first, 0);
  out.set(second.subarray(0, 16), 32);
  return out;
}

/**
 * Package a certified checkpoint. An empty body, an empty certificate, a
 * body that does not fit in one blob, or anything that is not a checkpoint
 * produces no blob.
 */
export function packageCertifiedCheckpoint(checkpoint: CertifiedCheckpoint): PackagedCheckpoint | null {
  if (checkpoint.kind !== "checkpoint") return null;
  if (!(checkpoint.bytes instanceof Uint8Array) || checkpoint.bytes.length === 0) return null;
  if (!(checkpoint.certificate instanceof Uint8Array) || checkpoint.certificate.length === 0) return null;
  if (checkpoint.bytes.length > MAX_CHECKPOINT_BYTES) return null;
  const blob = blobFromCheckpoint(checkpoint.bytes);
  return {
    bytes: checkpoint.bytes.slice(),
    blob,
    commitment: blobCommitment(blob),
    checkpointKeccak: checkpointKeccak(checkpoint.bytes),
  };
}

/** Recover the checkpoint bytes from a blob this module packaged. */
export function checkpointBytesFromBlob(blob: Uint8Array): Uint8Array | null {
  if (blob.length !== BLOB_BYTES) return null;
  const payload = new Uint8Array(FIELD_ELEMENTS * PAYLOAD_PER_FIELD);
  for (let i = 0; i < FIELD_ELEMENTS; i += 1) {
    const field = i * FIELD_BYTES;
    if (blob[field] !== 0) return null;
    payload.set(blob.subarray(field + 1, field + FIELD_BYTES), i * PAYLOAD_PER_FIELD);
  }
  if (payload[0] !== 0) return null;
  const length = new DataView(payload.buffer, payload.byteOffset, payload.byteLength).getUint32(1, false);
  if (length === 0 || length > MAX_CHECKPOINT_BYTES) return null;
  const end = HEADER_BYTES + length;
  for (let i = end; i < payload.length; i += 1) {
    if (payload[i] !== 0) return null;
  }
  return payload.slice(HEADER_BYTES, end);
}

export function anchoredCheckpointBlob(checkpointKeccakBytes: Uint8Array): AnchoredCheckpointBlob | null {
  const row = recorded.get(hexKey(checkpointKeccakBytes));
  if (!row) return null;
  return {
    commitment: row.commitment.slice(),
    checkpointKeccak: row.checkpointKeccak.slice(),
  };
}

/**
 * Record the blob commitment and the keccak of the checkpoint bytes.
 * A refused chain or a refused poster records nothing. No transaction is sent
 * unless `poster` does that itself. This module does not.
 */
export async function postCertifiedCheckpoint(
  checkpoint: CertifiedCheckpoint,
  opts?: { env?: NodeJS.ProcessEnv; poster?: CheckpointBlobPoster; dataDir?: string },
): Promise<boolean> {
  const packed = packageCertifiedCheckpoint(checkpoint);
  if (!packed) return false;
  const env = opts?.env ?? process.env;
  if (chainRefused(env)) return false;
  const key = hexKey(packed.checkpointKeccak);
  const existing = recorded.get(key);
  if (existing) {
    if (!bytesEqual(existing.commitment, packed.commitment)) return false;
    if (opts?.dataDir) retain(opts.dataDir, packed);
    return true;
  }
  let ok = true;
  if (opts?.poster) {
    try {
      ok = await opts.poster({
        commitment: packed.commitment,
        checkpointKeccak: packed.checkpointKeccak,
      });
    } catch {
      ok = false;
    }
  }
  if (!ok) return false;
  recorded.set(key, {
    commitment: packed.commitment.slice(),
    checkpointKeccak: packed.checkpointKeccak.slice(),
  });
  if (opts?.dataDir) retain(opts.dataDir, packed);
  return true;
}

export function keepCheckpointBytes(dir: string, bytes: Uint8Array): void {
  const path = checkpointFile(dir, checkpointKeccak(bytes));
  mkdirSync(join(dir, "checkpoints"), { recursive: true });
  writeFileSync(path, bytes);
}

export function readKeptCheckpoint(dir: string, checkpointKeccakBytes: Uint8Array): Uint8Array {
  return new Uint8Array(readFileSync(checkpointFile(dir, checkpointKeccakBytes)));
}

export function writePublishedBlob(dir: string, blob: Uint8Array, checkpointKeccakBytes: Uint8Array): void {
  mkdirSync(join(dir, "blobs"), { recursive: true });
  writeFileSync(blobFile(dir, checkpointKeccakBytes), blob);
}

export function losePublishedBlob(dir: string, checkpointKeccakBytes: Uint8Array): void {
  const path = blobFile(dir, checkpointKeccakBytes);
  if (existsSync(path)) unlinkSync(path);
}

export function publishedBlobExists(dir: string, checkpointKeccakBytes: Uint8Array): boolean {
  return existsSync(blobFile(dir, checkpointKeccakBytes));
}

function retain(dir: string, packed: PackagedCheckpoint): void {
  keepCheckpointBytes(dir, packed.bytes);
  writePublishedBlob(dir, packed.blob, packed.checkpointKeccak);
}

function blobFromCheckpoint(bytes: Uint8Array): Uint8Array {
  const payload = new Uint8Array(FIELD_ELEMENTS * PAYLOAD_PER_FIELD);
  payload[0] = 0;
  new DataView(payload.buffer).setUint32(1, bytes.length, false);
  payload.set(bytes, HEADER_BYTES);
  const blob = new Uint8Array(BLOB_BYTES);
  for (let i = 0; i < FIELD_ELEMENTS; i += 1) {
    const src = i * PAYLOAD_PER_FIELD;
    blob.set(payload.subarray(src, src + PAYLOAD_PER_FIELD), i * FIELD_BYTES + 1);
  }
  return blob;
}

function checkpointFile(dir: string, checkpointKeccakBytes: Uint8Array): string {
  return join(dir, "checkpoints", hexKey(checkpointKeccakBytes));
}

function blobFile(dir: string, checkpointKeccakBytes: Uint8Array): string {
  return join(dir, "blobs", hexKey(checkpointKeccakBytes));
}

function hexKey(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

function chainRefused(env: NodeJS.ProcessEnv): boolean {
  const named = env.LOK_CHAIN_ID?.trim() ?? "";
  if (named === "100" || named === "10200") return true;
  if (named !== "" && named !== String(ANVIL_CHAIN_ID)) return true;
  const rpc = env.LOK_CHAIN_RPC?.trim() ?? "";
  return /gnosischain|chiado|gnosis\.gateway/i.test(rpc);
}
