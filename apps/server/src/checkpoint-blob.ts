/**
 * Publish one certified checkpoint as an EIP-4844 blob on local anvil.
 *
 * The orderer stdout path calls `noteCheckpointLine`. A line that carries
 * checkpoint bytes is posted as a blob transaction. A 20 Hz batch line is
 * not, and the tick does not call this module.
 *
 * `cast` builds the blob and its 48-byte KZG commitment. The transaction
 * calls `RootAnchor.postCheckpointBlob`. The anchor stores that commitment
 * and keccak256 of the checkpoint bytes. It does not store the bytes.
 * Gnosis mainnet (100) and Chiado (10200) are refused. Validators keep the
 * checkpoint bytes after the blob file is deleted.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createPublicClient,
  http,
  keccak256,
  parseAbi,
  toBytes,
  type Hex,
} from "viem";
import { posterKeyRefused } from "./root-anchor";
import { resolveCastBin } from "./support-anvil";

const ANVIL_CHAIN_ID = 31337;
const FIELD_ELEMENTS = 4096;
const FIELD_BYTES = 32;
const PAYLOAD_PER_FIELD = 31;
const HEADER_BYTES = 5;
const BURN = "0x0000000000000000000000000000000000000001";

export const BLOB_BYTES = FIELD_ELEMENTS * FIELD_BYTES;
export const BLOB_COMMITMENT_BYTES = 48;
export const MAX_CHECKPOINT_BYTES = FIELD_ELEMENTS * PAYLOAD_PER_FIELD - HEADER_BYTES;

const ANCHOR_ABI = parseAbi([
  "function postCheckpointBlob(bytes commitment, bytes32 checkpointKeccak)",
  "function checkpointBlob(bytes32 checkpointKeccak) view returns (bytes commitment, bytes32 storedKeccak)",
]);

export type CertifiedCheckpoint = {
  kind: "checkpoint";
  bytes: Uint8Array;
  certificate: Uint8Array;
};

export type PackagedCheckpoint = {
  bytes: Uint8Array;
  blob: Uint8Array;
  checkpointKeccak: Uint8Array;
};

type Rlp = { list: true; v: Rlp[]; o: number } | { list: false; v: Uint8Array; o: number };

type BlobSidecar = {
  commitment: Uint8Array;
  blob: Uint8Array;
  versionedHash: Uint8Array;
};

let blobTxAttempts = 0;

export function resetCheckpointBlobsForTests(): void {
  blobTxAttempts = 0;
}

/** How many times this process started a local blob transaction. */
export function blobTxAttemptCount(): number {
  return blobTxAttempts;
}

export function checkpointKeccak(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(keccak256(bytes, "bytes"));
}

/** EIP-4844 versioned hash: `0x01 || sha256(commitment)[1:]`. */
export function versionedBlobHash(commitment: Uint8Array): Uint8Array {
  const digest = new Uint8Array(createHash("sha256").update(commitment).digest());
  digest[0] = 0x01;
  return digest;
}

/**
 * Package a certified checkpoint into one blob's field elements.
 * An empty body, an empty certificate, a body that does not fit in one blob,
 * or anything that is not a checkpoint produces no blob. This does not publish.
 */
export function packageCertifiedCheckpoint(checkpoint: CertifiedCheckpoint): PackagedCheckpoint | null {
  if (!validCheckpoint(checkpoint)) return null;
  return {
    bytes: checkpoint.bytes.slice(),
    blob: blobFromCheckpoint(checkpoint.bytes),
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

/**
 * The orderer stdout path. A checkpoint line is published. A batch line is not.
 * The 20 Hz tick does not call this.
 */
export function noteCheckpointLine(line: string, env: NodeJS.ProcessEnv = process.env): void {
  const dir = env.LOK_DATA_DIR?.trim();
  void publishCheckpointFromLine(line, { env, dataDir: dir || undefined }).catch(() => undefined);
}

/** Publish the checkpoint on one orderer line. A batch line publishes nothing. */
export function publishCheckpointFromLine(
  line: string,
  opts?: { env?: NodeJS.ProcessEnv; dataDir?: string },
): Promise<boolean> {
  const checkpoint = checkpointFromOrdererLine(line);
  if (!checkpoint) return Promise.resolve(false);
  return postCertifiedCheckpoint(checkpoint, opts);
}

/**
 * Send the checkpoint as an EIP-4844 blob to the local root anchor.
 * Success means the anchor read back the KZG commitment and the keccak.
 */
export async function postCertifiedCheckpoint(
  checkpoint: CertifiedCheckpoint,
  opts?: { env?: NodeJS.ProcessEnv; dataDir?: string },
): Promise<boolean> {
  if (!validCheckpoint(checkpoint)) return false;
  const env = opts?.env ?? process.env;
  if (chainRefused(env)) return false;
  const posted = await postBlobToLocalAnvil(checkpoint.bytes, env);
  if (!posted.ok) return false;
  if (opts?.dataDir) {
    keepCheckpointBytes(opts.dataDir, checkpoint.bytes);
    writePublishedBlob(opts.dataDir, posted.blob, posted.checkpointKeccak);
  }
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

export function checkpointFromOrdererLine(line: string): CertifiedCheckpoint | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.root === "string" || Array.isArray(obj.peers) || typeof obj.height === "number") return null;
  if (typeof obj.checkpoint !== "string" || typeof obj.certificate !== "string") return null;
  const bytes = hexBytes(obj.checkpoint);
  const certificate = hexBytes(obj.certificate);
  if (!bytes || bytes.length === 0 || !certificate || certificate.length === 0) return null;
  return { kind: "checkpoint", bytes, certificate };
}

async function postBlobToLocalAnvil(
  bytes: Uint8Array,
  env: NodeJS.ProcessEnv,
): Promise<{ ok: true; blob: Uint8Array; checkpointKeccak: Uint8Array } | { ok: false }> {
  const address = env.LOK_ROOT_ANCHOR?.trim() ?? "";
  const rpc = env.LOK_CHAIN_RPC?.trim() ?? "";
  const key = env.LOK_ANCHOR_POSTER_KEY?.trim() ?? "";
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return { ok: false };
  if (!localAnvilRpc(rpc) || posterKeyRefused(env) || !/^0x[0-9a-fA-F]{64}$/.test(key)) return { ok: false };
  if (!resolveCastBin()) return { ok: false };
  const transport = http(rpc);
  const pub = createPublicClient({ transport });
  let chainId: number;
  try {
    chainId = await pub.getChainId();
  } catch {
    return { ok: false };
  }
  if (chainId !== ANVIL_CHAIN_ID) return { ok: false };

  const checkpointKeccakBytes = checkpointKeccak(bytes);
  const dir = mkdtempSync(join(tmpdir(), "lok-checkpoint-blob-"));
  const file = join(dir, "checkpoint.bin");
  try {
    writeFileSync(file, bytes);
    blobTxAttempts += 1;
    const probed = parseBlobTx(castHex(["mktx", ...castBlobArgs(key, rpc, file), BURN], rpc));
    if (!probed) return { ok: false };
    const commitment = probed.commitment;
    if (!bytesEqual(versionedBlobHash(commitment), probed.versionedHash)) return { ok: false };
    const already = await readAnchor(pub, address as Hex, checkpointKeccakBytes);
    if (already && bytesEqual(already.commitment, commitment)) {
      return { ok: true, blob: probed.blob, checkpointKeccak: checkpointKeccakBytes };
    }
    if (already) return { ok: false };
    const raw = castHex(
      [
        "mktx",
        ...castBlobArgs(key, rpc, file),
        address,
        "postCheckpointBlob(bytes,bytes32)",
        hexOf(commitment),
        hexOf(checkpointKeccakBytes),
      ],
      rpc,
    );
    const signed = parseBlobTx(raw);
    if (!signed || !bytesEqual(signed.commitment, commitment)) return { ok: false };
    const hash = await sendRawTransaction(rpc, raw);
    const receipt = await pub.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") return { ok: false };
    const tx = await pub.getTransaction({ hash });
    if (tx.type !== "eip4844") return { ok: false };
    const blobHash = tx.blobVersionedHashes?.[0];
    if (!blobHash || !bytesEqual(toBytes(blobHash), signed.versionedHash)) return { ok: false };
    const stored = await readAnchor(pub, address as Hex, checkpointKeccakBytes);
    if (!stored || !bytesEqual(stored.commitment, commitment)) return { ok: false };
    if (!bytesEqual(stored.checkpointKeccak, checkpointKeccakBytes)) return { ok: false };
    return { ok: true, blob: signed.blob, checkpointKeccak: checkpointKeccakBytes };
  } catch (err) {
    console.error("[checkpoint-blob] local blob post failed", err instanceof Error ? err.message : err);
    return { ok: false };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** The signed blob transaction is larger than a Windows command line. Send it over RPC. */
async function sendRawTransaction(rpc: string, raw: string): Promise<Hex> {
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_sendRawTransaction",
      params: [raw],
    }),
  });
  const body = (await res.json()) as { result?: string; error?: { message?: string } };
  if (!body.result || !body.result.startsWith("0x")) {
    throw new Error(body.error?.message || "anvil rejected the blob transaction");
  }
  return body.result as Hex;
}

function castBlobArgs(key: string, rpc: string, file: string): string[] {
  return ["--private-key", key, "--rpc-url", rpc, "--gas-limit", "500000", "--blob", "--path", file];
}

function castHex(args: string[], rpc: string): string {
  const bin = resolveCastBin();
  if (!bin) throw new Error("cast not found");
  const out = execFileSync(bin, args, {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
    timeout: 30_000,
    env: { ...process.env, ETH_RPC_URL: rpc },
  });
  const line = out
    .split(/\r?\n/)
    .map((part) => part.trim())
    .reverse()
    .find((part) => part.startsWith("0x"));
  if (!line) throw new Error("cast returned no hex");
  return line;
}

async function readAnchor(
  pub: ReturnType<typeof createPublicClient>,
  address: Hex,
  checkpointKeccakBytes: Uint8Array,
): Promise<{ commitment: Uint8Array; checkpointKeccak: Uint8Array } | null> {
  try {
    const [commitment, storedKeccak] = await pub.readContract({
      address,
      abi: ANCHOR_ABI,
      functionName: "checkpointBlob",
      args: [hexOf(checkpointKeccakBytes)],
    });
    return { commitment: toBytes(commitment), checkpointKeccak: toBytes(storedKeccak) };
  } catch {
    return null;
  }
}

function parseBlobTx(rawHex: string): BlobSidecar | null {
  const hex = rawHex.trim();
  if (!hex.startsWith("0x03")) return null;
  const buf = Buffer.from(hex.slice(2), "hex");
  if (buf.length === 0 || buf[0] !== 0x03) return null;
  const outer = decodeRlp(buf, 1);
  if (!outer.list || outer.v.length !== 4) return null;
  const body = outer.v[0];
  const blobs = outer.v[1];
  const commitments = outer.v[2];
  if (!body?.list || !blobs?.list || !commitments?.list) return null;
  const hashItem = body.v[10];
  if (!hashItem?.list) return null;
  const commitment = byteItem(commitments.v[0]);
  const blob = byteItem(blobs.v[0]);
  const versionedHash = byteItem(hashItem.v[0]);
  if (!commitment || commitment.length !== BLOB_COMMITMENT_BYTES) return null;
  if (!blob || blob.length !== BLOB_BYTES) return null;
  if (!versionedHash || versionedHash.length !== 32) return null;
  if (commitments.v.length !== 1 || blobs.v.length !== 1 || hashItem.v.length !== 1) return null;
  return { commitment, blob, versionedHash };
}

function byteItem(item: Rlp | undefined): Uint8Array | null {
  if (!item || item.list) return null;
  return item.v;
}

function decodeRlp(buf: Uint8Array, offset: number): Rlp {
  const prefix = buf[offset];
  if (prefix === undefined) throw new Error("truncated rlp");
  if (prefix <= 0x7f) return { list: false, v: buf.subarray(offset, offset + 1), o: offset + 1 };
  if (prefix <= 0xb7) {
    const length = prefix - 0x80;
    const start = offset + 1;
    return { list: false, v: buf.subarray(start, start + length), o: start + length };
  }
  if (prefix <= 0xbf) {
    const lengthOfLength = prefix - 0xb7;
    const length = readLength(buf, offset + 1, lengthOfLength);
    const start = offset + 1 + lengthOfLength;
    return { list: false, v: buf.subarray(start, start + length), o: start + length };
  }
  if (prefix <= 0xf7) {
    const length = prefix - 0xc0;
    return decodeList(buf, offset + 1, offset + 1 + length);
  }
  const lengthOfLength = prefix - 0xf7;
  const length = readLength(buf, offset + 1, lengthOfLength);
  const start = offset + 1 + lengthOfLength;
  return decodeList(buf, start, start + length);
}

function decodeList(buf: Uint8Array, start: number, end: number): Rlp {
  const items: Rlp[] = [];
  let offset = start;
  while (offset < end) {
    const next = decodeRlp(buf, offset);
    items.push(next);
    offset = next.o;
  }
  return { list: true, v: items, o: end };
}

function readLength(buf: Uint8Array, offset: number, lengthOfLength: number): number {
  let length = 0;
  for (let i = 0; i < lengthOfLength; i += 1) length = length * 256 + (buf[offset + i] ?? 0);
  return length;
}

function validCheckpoint(checkpoint: CertifiedCheckpoint): boolean {
  return (
    checkpoint.kind === "checkpoint" &&
    checkpoint.bytes instanceof Uint8Array &&
    checkpoint.bytes.length > 0 &&
    checkpoint.bytes.length <= MAX_CHECKPOINT_BYTES &&
    checkpoint.certificate instanceof Uint8Array &&
    checkpoint.certificate.length > 0
  );
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

function hexOf(bytes: Uint8Array): Hex {
  return `0x${Buffer.from(bytes).toString("hex")}`;
}

function hexBytes(hex: string): Uint8Array | null {
  const raw = hex.trim().replace(/^0x/i, "");
  if (raw.length === 0 || raw.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(raw)) return null;
  return Buffer.from(raw, "hex");
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

function localAnvilRpc(rpc: string): boolean {
  return /^https?:\/\/(127\.0\.0\.1|localhost):\d+\/?$/i.test(rpc.trim());
}
