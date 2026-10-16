/**
 * Publish one certified checkpoint as an EIP-4844 blob on local anvil.
 *
 * The orderer stdout path calls `noteCheckpointLine`. A line that carries
 * checkpoint bytes is posted as a blob transaction. A 20 Hz batch line is
 * not, and the tick does not call this module.
 *
 * `cast send --blob --path` publishes the checkpoint. Cast packs the file
 * into one blob and puts the 48-byte KZG commitment in the sidecar. The
 * transaction calls `RootAnchor.postCheckpointBlob`. The anchor stores that
 * commitment and keccak256 of the checkpoint bytes. It does not store the
 * bytes.
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
const BURN = "0x0000000000000000000000000000000000000001";

export const BLOB_BYTES = FIELD_ELEMENTS * FIELD_BYTES;
export const BLOB_COMMITMENT_BYTES = 48;
/** One length word, then 31 payload bytes in each of the other field elements. */
export const MAX_CHECKPOINT_BYTES = (FIELD_ELEMENTS - 1) * PAYLOAD_PER_FIELD;

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
let lastPostError = "";

export function resetCheckpointBlobsForTests(): void {
  blobTxAttempts = 0;
  lastPostError = "";
}

/** How many times this process started a local blob transaction. */
export function blobTxAttemptCount(): number {
  return blobTxAttempts;
}

/** Why the last local blob post returned false. Empty after a success. */
export function lastCheckpointPostError(): string {
  return lastPostError;
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

/**
 * Recover checkpoint bytes from the blob `cast send --blob --path` submits.
 * The first field element is a big-endian length. Each later element carries
 * 31 payload bytes. The anchor does not store this blob.
 */
export function checkpointBytesFromBlob(blob: Uint8Array): Uint8Array | null {
  if (blob.length !== BLOB_BYTES) return null;
  for (let field = 0; field < FIELD_ELEMENTS; field += 1) {
    if (blob[field * FIELD_BYTES] !== 0) return null;
  }
  const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
  const length = Number(view.getBigUint64(1, false));
  if (!Number.isInteger(length) || length <= 0 || length > MAX_CHECKPOINT_BYTES) return null;
  for (let i = 9; i < FIELD_BYTES; i += 1) {
    if (blob[i] !== 0) return null;
  }
  const out = new Uint8Array(length);
  let pos = 0;
  let field = 1;
  while (pos < length) {
    const take = Math.min(PAYLOAD_PER_FIELD, length - pos);
    const start = field * FIELD_BYTES;
    out.set(blob.subarray(start + 1, start + 1 + take), pos);
    for (let i = 1 + take; i < FIELD_BYTES; i += 1) {
      if (blob[start + i] !== 0) return null;
    }
    pos += take;
    field += 1;
  }
  for (let rest = field; rest < FIELD_ELEMENTS; rest += 1) {
    const start = rest * FIELD_BYTES;
    for (let i = 1; i < FIELD_BYTES; i += 1) {
      if (blob[start + i] !== 0) return null;
    }
  }
  return out;
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

function failPost(reason: string): { ok: false } {
  lastPostError = reason;
  return { ok: false };
}

async function postBlobToLocalAnvil(
  bytes: Uint8Array,
  env: NodeJS.ProcessEnv,
): Promise<{ ok: true; blob: Uint8Array; checkpointKeccak: Uint8Array } | { ok: false }> {
  lastPostError = "";
  const address = env.LOK_ROOT_ANCHOR?.trim() ?? "";
  const rpc = env.LOK_CHAIN_RPC?.trim() ?? "";
  const key = env.LOK_ANCHOR_POSTER_KEY?.trim() ?? "";
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return failPost("root anchor address is missing");
  if (!localAnvilRpc(rpc) || posterKeyRefused(env) || !/^0x[0-9a-fA-F]{64}$/.test(key)) {
    return failPost("local anvil poster is not configured");
  }
  if (!resolveCastBin()) return failPost("cast was not found");
  const transport = http(rpc);
  const pub = createPublicClient({ transport });
  let chainId: number;
  try {
    chainId = await pub.getChainId();
  } catch (err) {
    return failPost(`anvil chain id was not available: ${commandFailure(err)}`);
  }
  if (chainId !== ANVIL_CHAIN_ID) return failPost(`anvil chain id ${chainId}`);

  const checkpointKeccakBytes = checkpointKeccak(bytes);
  const dir = mkdtempSync(join(tmpdir(), "lok-checkpoint-blob-"));
  const file = join(dir, "checkpoint.bin");
  try {
    writeFileSync(file, bytes);
    const raw = castHex(["mktx", ...castBlobArgs(key, rpc, file), BURN], rpc);
    const probed = parseBlobTx(raw);
    if (!probed) return failPost(`cast mktx sidecar was not a one-blob transaction (${describeSidecar(raw)})`);
    const commitment = probed.commitment;
    if (!bytesEqual(versionedBlobHash(commitment), probed.versionedHash)) {
      return failPost("sidecar commitment does not match the transaction versioned hash");
    }
    if (!bytesEqual(blobFromCheckpoint(bytes), probed.blob)) {
      return failPost("cast packed a blob that is not the checkpoint bytes");
    }
    const recovered = checkpointBytesFromBlob(probed.blob);
    if (!recovered || !bytesEqual(recovered, bytes)) {
      return failPost("checkpoint bytes could not be read back from the blob");
    }
    const already = await readAnchor(pub, address as Hex, checkpointKeccakBytes);
    if (already && bytesEqual(already.commitment, commitment)) {
      return { ok: true, blob: probed.blob, checkpointKeccak: checkpointKeccakBytes };
    }
    if (already) return failPost("anchor already stores a different commitment for this checkpoint");
    blobTxAttempts += 1;
    const sent = castSendReceipt(
      [
        "send",
        ...castBlobArgs(key, rpc, file),
        address,
        "postCheckpointBlob(bytes,bytes32)",
        hexOf(commitment),
        hexOf(checkpointKeccakBytes),
      ],
      rpc,
    );
    const receipt = await pub.waitForTransactionReceipt({ hash: sent.hash });
    if (receipt.status !== "success") return failPost(`blob transaction receipt status ${receipt.status}`);
    const tx = await pub.getTransaction({ hash: sent.hash });
    if (tx.type !== "eip4844") return failPost(`blob transaction type ${String(tx.type)}`);
    const blobHash = tx.blobVersionedHashes?.[0];
    if (!blobHash || !bytesEqual(toBytes(blobHash), probed.versionedHash)) {
      return failPost("included transaction blobhash does not match the sidecar commitment");
    }
    const stored = await readAnchor(pub, address as Hex, checkpointKeccakBytes);
    if (!stored || !bytesEqual(stored.commitment, commitment)) {
      return failPost("anchor did not store the sidecar commitment");
    }
    if (!bytesEqual(stored.checkpointKeccak, checkpointKeccakBytes)) {
      return failPost("anchor did not store the checkpoint keccak");
    }
    return { ok: true, blob: probed.blob, checkpointKeccak: checkpointKeccakBytes };
  } catch (err) {
    const detail = commandFailure(err);
    lastPostError = detail;
    console.error("[checkpoint-blob] local blob post failed", detail);
    return { ok: false };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function castBlobArgs(key: string, rpc: string, file: string): string[] {
  return [
    "--private-key",
    key,
    "--rpc-url",
    rpc,
    "--gas-limit",
    "500000",
    "--gas-price",
    "20000000000",
    "--priority-gas-price",
    "1000000000",
    "--blob-gas-price",
    "2000000000",
    "--blob",
    "--path",
    file,
  ];
}

function castSendReceipt(args: string[], rpc: string): { hash: Hex } {
  const bin = resolveCastBin();
  if (!bin) throw new Error("cast not found");
  const out = execFileSync(bin, args, {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
    timeout: 60_000,
    env: { ...process.env, ETH_RPC_URL: rpc },
  });
  const fields = new Map<string, string>();
  for (const line of out.split(/\r?\n/)) {
    const match = /^([A-Za-z][A-Za-z0-9]*)\s+(\S+)/.exec(line.trim());
    if (match) fields.set(match[1].toLowerCase(), match[2]);
  }
  const hash = fields.get("transactionhash");
  if (!hash?.startsWith("0x") || hash.length !== 66) {
    throw new Error(`cast send returned no transaction hash\n${redact(out)}`);
  }
  const status = fields.get("status") ?? "";
  if (status !== "1" && status !== "0x1" && status.toLowerCase() !== "success") {
    throw new Error(`cast send blob transaction was not successful\n${redact(out)}`);
  }
  return { hash: hash as Hex };
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
  if (!line) throw new Error(`cast returned no hex\n${redact(out)}`);
  return line;
}

function commandFailure(err: unknown): string {
  if (!(err instanceof Error)) return redact(String(err));
  const extra = err as Error & { stderr?: string | Buffer; stdout?: string | Buffer };
  const stderr = textOf(extra.stderr);
  const stdout = textOf(extra.stdout);
  return redact(
    [err.message, stderr ? `stderr:\n${stderr}` : "", stdout ? `stdout:\n${stdout}` : ""].filter(Boolean).join("\n"),
  );
}

function textOf(value: string | Buffer | undefined): string {
  if (!value) return "";
  const text = typeof value === "string" ? value : value.toString("utf8");
  return text.length > 4000 ? `${text.slice(0, 4000)}\n…` : text;
}

function redact(text: string): string {
  return text.replace(/(--private-key\s+)0x[0-9a-fA-F]+/g, "$1[redacted]");
}

function describeSidecar(rawHex: string): string {
  try {
    const hex = rawHex.trim();
    if (!hex.startsWith("0x03")) return `prefix ${hex.slice(0, 8)}`;
    const buf = Buffer.from(hex.slice(2), "hex");
    const outer = decodeRlp(buf, 1);
    if (!outer.list) return "outer is not a list";
    const parts = outer.v.map((item) => (item.list ? `list(${item.v.length})` : `bytes(${item.v.length})`));
    return `outer ${outer.v.length}: ${parts.join(", ")}`;
  } catch (err) {
    return err instanceof Error ? err.message : "undecodable";
  }
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

/**
 * The KZG commitment and blob from a `cast mktx --blob` transaction.
 * Cast 1.5 packs `[tx, blobs, commitments, proofs]`. Cast stable packs the
 * EIP-7594 sidecar in that same list with a version byte before the blobs.
 * The stored commitment is the 48-byte value whose versioned hash is blobhash(0).
 */
export function blobSidecarFromCastTx(rawHex: string): BlobSidecar | null {
  return parseBlobTx(rawHex);
}

function parseBlobTx(rawHex: string): BlobSidecar | null {
  const hex = rawHex.trim();
  if (!/^0x03[0-9a-fA-F]*$/.test(hex) || hex.length % 2 !== 0) return null;
  const buf = Buffer.from(hex.slice(2), "hex");
  if (buf.length === 0 || buf[0] !== 0x03) return null;
  let outer: Rlp;
  try {
    outer = decodeRlp(buf, 1);
  } catch {
    return null;
  }
  if (!outer.list || outer.o !== buf.length) return null;
  const versionedHash = versionedHashFromBody(outer.v[0]);
  const blob = singletonBytes(outer, BLOB_BYTES);
  if (!versionedHash || !blob) return null;
  const commitment = outer.v
    .map((item) => (item.list && item.v.length === 1 ? byteItem(item.v[0]) : null))
    .find(
      (candidate) =>
        !!candidate &&
        candidate.length === BLOB_COMMITMENT_BYTES &&
        bytesEqual(versionedBlobHash(candidate), versionedHash),
    );
  if (!commitment) return null;
  return { commitment, blob, versionedHash };
}

function versionedHashFromBody(body: Rlp | undefined): Uint8Array | null {
  if (!body?.list) return null;
  const direct = body.v[10];
  if (direct?.list && direct.v.length === 1) {
    const hash = byteItem(direct.v[0]);
    if (hash?.length === 32) return hash;
  }
  for (const item of body.v) {
    if (!item.list || item.v.length !== 1) continue;
    const hash = byteItem(item.v[0]);
    if (hash?.length === 32 && hash[0] === 0x01) return hash;
  }
  return null;
}

function singletonBytes(outer: Rlp, length: number): Uint8Array | null {
  if (!outer.list) return null;
  for (const item of outer.v) {
    if (!item.list || item.v.length !== 1) continue;
    const bytes = byteItem(item.v[0]);
    if (bytes?.length === length) return bytes;
  }
  return null;
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

/** Same 31-byte packing `cast send --blob --path` uses for one blob. */
function blobFromCheckpoint(bytes: Uint8Array): Uint8Array {
  const blob = new Uint8Array(BLOB_BYTES);
  new DataView(blob.buffer).setBigUint64(1, BigInt(bytes.length), false);
  let pos = 0;
  let field = 1;
  while (pos < bytes.length) {
    const take = Math.min(PAYLOAD_PER_FIELD, bytes.length - pos);
    blob.set(bytes.subarray(pos, pos + take), field * FIELD_BYTES + 1);
    pos += take;
    field += 1;
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
