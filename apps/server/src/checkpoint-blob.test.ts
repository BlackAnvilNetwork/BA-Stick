/**
 * A certified checkpoint is published as an EIP-4844 blob on local anvil.
 * The anchor stores the KZG commitment and the keccak of the checkpoint bytes.
 * A 20 Hz batch is not a blob. The validator copy stays after the blob is gone.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import { createHash } from "node:crypto";
import { createPublicClient, http, keccak256, toBytes, toHex, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  BLOB_BYTES,
  BLOB_COMMITMENT_BYTES,
  MAX_CHECKPOINT_BYTES,
  blobTxAttemptCount,
  checkpointBytesFromBlob,
  checkpointFromOrdererLine,
  checkpointKeccak,
  losePublishedBlob,
  packageCertifiedCheckpoint,
  publishCheckpointFromLine,
  publishedBlobExists,
  readKeptCheckpoint,
  resetCheckpointBlobsForTests,
  versionedBlobHash,
  type CertifiedCheckpoint,
} from "./checkpoint-blob";
import { submitOnSimTick } from "./order-submit";
import { postCertifiedBatch, resetRootAnchorForTests, type CertifiedBatch } from "./root-anchor";
import {
  resolveCastBin,
  runForgeScriptBroadcast,
  startThrowawayAnvil,
  supportAnvilAvailable,
  type ThrowawayAnvil,
} from "./support-anvil";

const certificate = new Uint8Array([0x01, 0x02, 0x03, 0x04]);

/** Anvil account 1. Not the owner key, the private key, or the listing key. */
const ANCHOR_POSTER_KEY =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex;

function checkpoint(bytes: Uint8Array): CertifiedCheckpoint {
  return { kind: "checkpoint", bytes, certificate };
}

function checkpointLine(bytes: Uint8Array): string {
  return JSON.stringify({
    checkpoint: Buffer.from(bytes).toString("hex"),
    certificate: Buffer.from(certificate).toString("hex"),
  });
}

describe("checkpoint blobs", { concurrency: false }, () => {
  test("a certified checkpoint is packaged as one blob", () => {
    resetCheckpointBlobsForTests();
    const bytes = new Uint8Array([0x00, 0x00, 0x10, 0xff, 0x01]);
    const packed = packageCertifiedCheckpoint(checkpoint(bytes));
    assert.ok(packed);
    assert.equal(packed.blob.length, BLOB_BYTES);
    assert.equal(packed.checkpointKeccak.length, 32);
    assert.deepEqual(packed.checkpointKeccak, new Uint8Array(keccak256(bytes, "bytes")));
    for (let i = 0; i < BLOB_BYTES; i += 32) assert.equal(packed.blob[i], 0);
    assert.deepEqual(checkpointBytesFromBlob(packed.blob), bytes);
    assert.equal(blobTxAttemptCount(), 0);
  });

  test("an uncertified or oversized body produces no blob", async () => {
    resetCheckpointBlobsForTests();
    const bare = await publishCheckpointFromLine(
      JSON.stringify({ checkpoint: "01", certificate: "" }),
      { env: { LOK_CHAIN_ID: "31337" } },
    );
    const empty = await publishCheckpointFromLine(
      JSON.stringify({ checkpoint: "", certificate: "01" }),
      { env: { LOK_CHAIN_ID: "31337" } },
    );
    const huge = new Uint8Array(MAX_CHECKPOINT_BYTES + 1);
    huge[0] = 1;
    const oversized = await publishCheckpointFromLine(checkpointLine(huge), {
      env: { LOK_CHAIN_ID: "31337" },
    });
    assert.equal(bare, false);
    assert.equal(empty, false);
    assert.equal(oversized, false);
    assert.equal(blobTxAttemptCount(), 0);
    assert.equal(packageCertifiedCheckpoint(checkpoint(huge)), null);
  });

  test("Gnosis and Chiado do not receive a checkpoint blob", async () => {
    resetCheckpointBlobsForTests();
    const bytes = new Uint8Array([0x09]);
    for (const chainId of ["100", "10200"]) {
      const ok = await publishCheckpointFromLine(checkpointLine(bytes), {
        env: {
          LOK_CHAIN_ID: chainId,
          LOK_CHAIN_RPC: "http://127.0.0.1:9",
          LOK_ROOT_ANCHOR: "0x" + "11".repeat(20),
          LOK_ANCHOR_POSTER_KEY: ANCHOR_POSTER_KEY,
        },
      });
      assert.equal(ok, false);
    }
    for (const rpc of ["https://rpc.gnosischain.com", "https://rpc.chiadochain.net"]) {
      const remote = await publishCheckpointFromLine(checkpointLine(bytes), {
        env: {
          LOK_CHAIN_ID: "31337",
          LOK_CHAIN_RPC: rpc,
          LOK_ROOT_ANCHOR: "0x" + "11".repeat(20),
          LOK_ANCHOR_POSTER_KEY: ANCHOR_POSTER_KEY,
        },
      });
      assert.equal(remote, false);
    }
    assert.equal(blobTxAttemptCount(), 0);
  });

  test("owner, private, and listing keys do not publish a blob", async () => {
    resetCheckpointBlobsForTests();
    const shared = "0x" + "11".repeat(32);
    const base = {
      LOK_CHAIN_ID: "31337",
      LOK_CHAIN_RPC: "http://127.0.0.1:9",
      LOK_ROOT_ANCHOR: "0x" + "33".repeat(20),
      LOK_ANCHOR_POSTER_KEY: shared,
    };
    for (const extra of [
      { LOK_OWNER_KEY: shared },
      { PRIVATE_KEY: shared },
      { LOK_LISTING_KEY: shared },
    ]) {
      const ok = await publishCheckpointFromLine(checkpointLine(new Uint8Array([0x01])), {
        env: { ...base, ...extra },
      });
      assert.equal(ok, false);
    }
    assert.equal(blobTxAttemptCount(), 0);
  });

  test("a 20 Hz batch submission does not produce a blob", async () => {
    resetCheckpointBlobsForTests();
    resetRootAnchorForTests();
    try {
      const nextRoot = new Uint8Array(32);
      nextRoot[0] = 0x11;
      const tick = submitOnSimTick(null, { ok: true, height: 1, nextRoot });
      assert.equal(tick.tickFailed, false);
      assert.equal(tick.status, "provisional");
      assert.equal(tick.blob, null);

      const batchLine = JSON.stringify({
        lastCertifiedHeight: 1,
        root: Buffer.from(nextRoot).toString("hex"),
        commitCertificate: Buffer.from(certificate).toString("hex"),
        peers: [],
      });
      assert.equal(checkpointFromOrdererLine(batchLine), null);
      const published = await publishCheckpointFromLine(batchLine, { env: { LOK_CHAIN_ID: "31337" } });
      assert.equal(published, false);

      const asBatch = packageCertifiedCheckpoint({
        kind: "batch",
        bytes: nextRoot,
        certificate,
      } as unknown as CertifiedCheckpoint);
      assert.equal(asBatch, null);

      const batch: CertifiedBatch = { height: 1, nextRoot, certificate };
      const anchored = await postCertifiedBatch(batch, {
        env: { LOK_CHAIN_ID: "31337" },
        poster: async () => true,
      });
      assert.equal(anchored, true);
      assert.equal(blobTxAttemptCount(), 0);
    } finally {
      resetRootAnchorForTests();
      resetCheckpointBlobsForTests();
    }
  });

  test(
    "local anvil stores the KZG commitment and the checkpoint keccak",
    { skip: !supportAnvilAvailable || !resolveCastBin(), timeout: 180_000 },
    async () => {
      resetCheckpointBlobsForTests();
      resetRootAnchorForTests();
      let anvil: ThrowawayAnvil | undefined;
      try {
        anvil = await startThrowawayAnvil();
        const poster = privateKeyToAccount(ANCHOR_POSTER_KEY);
        const out = runForgeScriptBroadcast(
          [
            "script",
            "script/RootAnchorFixture.s.sol:RootAnchorFixture",
            "--rpc-url",
            anvil.rpc,
            "--private-key",
            ANCHOR_POSTER_KEY,
            "-vv",
          ],
          {
            env: {
              LOK_OWNER_KEY: "",
              PRIVATE_KEY: "",
              LOK_LISTING_KEY: "",
            },
          },
        );
        const deployed = /ANCHOR\s+(0x[a-fA-F0-9]{40})/.exec(out);
        assert.ok(deployed, out.slice(-800));
        const address = deployed[1] as Hex;
        const bytes = new TextEncoder().encode("certified-checkpoint");
        const keccak = checkpointKeccak(bytes);
        const dir = mkdtempSync(join(tmpdir(), "lok-checkpoint-kept-"));
        const env = {
          LOK_CHAIN_ID: "31337",
          LOK_CHAIN_RPC: anvil.rpc,
          LOK_ROOT_ANCHOR: address,
          LOK_ANCHOR_POSTER_KEY: ANCHOR_POSTER_KEY,
          LOK_OWNER_KEY: "0x" + "11".repeat(32),
          PRIVATE_KEY: "0x" + "22".repeat(32),
          LOK_LISTING_KEY: "0x" + "33".repeat(32),
        };
        const pub = createPublicClient({ transport: http(anvil.rpc) });
        const nonceBefore = await pub.getTransactionCount({ address: poster.address });
        const abi = [
          {
            type: "function",
            name: "checkpointBlob",
            stateMutability: "view",
            inputs: [{ name: "checkpointKeccak", type: "bytes32" }],
            outputs: [
              { name: "commitment", type: "bytes" },
              { name: "storedKeccak", type: "bytes32" },
            ],
          },
        ] as const;

        const tickRoot = new Uint8Array(32);
        tickRoot[0] = 0x44;
        const tick = submitOnSimTick(null, { ok: true, height: 2, nextRoot: tickRoot });
        assert.equal(tick.blob, null);
        assert.equal(await pub.getTransactionCount({ address: poster.address }), nonceBefore);

        const batchOk = await postCertifiedBatch(
          { height: 7, nextRoot: tickRoot, certificate },
          { env },
        );
        assert.equal(batchOk, true);
        assert.equal(await pub.getTransactionCount({ address: poster.address }), nonceBefore + 1);
        const batchBlock = await pub.getBlock({ blockTag: "latest", includeTransactions: true });
        const batchTx = batchBlock.transactions.find(
          (item) => item.from.toLowerCase() === poster.address.toLowerCase(),
        );
        assert.ok(batchTx);
        assert.equal(batchTx.type, "eip1559");
        assert.equal(batchTx.blobVersionedHashes, undefined);
        await assert.rejects(
          pub.readContract({
            address,
            abi,
            functionName: "checkpointBlob",
            args: [toHex(checkpointKeccak(tickRoot))],
          }),
        );

        const posted = await publishCheckpointFromLine(checkpointLine(bytes), { env, dataDir: dir });
        assert.equal(posted, true);
        assert.equal(blobTxAttemptCount(), 1);
        assert.equal(await pub.getTransactionCount({ address: poster.address }), nonceBefore + 2);

        const block = await pub.getBlock({ blockTag: "latest", includeTransactions: true });
        const tx = block.transactions.find((item) => item.from.toLowerCase() === poster.address.toLowerCase());
        assert.ok(tx);
        assert.equal(tx.type, "eip4844");
        assert.equal(tx.blobVersionedHashes?.length, 1);

        const [commitment, storedKeccak] = await pub.readContract({
          address,
          abi,
          functionName: "checkpointBlob",
          args: [toHex(keccak)],
        });
        const commitmentBytes = toBytes(commitment);
        assert.equal(commitmentBytes.length, BLOB_COMMITMENT_BYTES);
        assert.deepEqual(toBytes(storedKeccak), keccak);
        assert.deepEqual(keccak, new Uint8Array(keccak256(bytes, "bytes")));
        const versioned = versionedBlobHash(commitmentBytes);
        assert.equal(versioned[0], 0x01);
        assert.equal(tx.blobVersionedHashes?.[0]?.toLowerCase(), toHex(versioned));
        const digest = createHash("sha256").update(commitmentBytes).digest();
        for (let i = 1; i < 32; i += 1) assert.equal(versioned[i], digest[i]);

        assert.equal(publishedBlobExists(dir, keccak), true);
        const publishedPath = join(dir, "blobs", Buffer.from(keccak).toString("hex"));
        assert.deepEqual(checkpointBytesFromBlob(new Uint8Array(readFileSync(publishedPath))), bytes);
        assert.deepEqual(readKeptCheckpoint(dir, keccak), bytes);
        losePublishedBlob(dir, keccak);
        assert.equal(publishedBlobExists(dir, keccak), false);
        assert.equal(existsSync(join(dir, "checkpoints", Buffer.from(keccak).toString("hex"))), true);
        assert.deepEqual(readKeptCheckpoint(dir, keccak), bytes);
        const [stillCommitment, stillKeccak] = await pub.readContract({
          address,
          abi,
          functionName: "checkpointBlob",
          args: [toHex(keccak)],
        });
        assert.deepEqual(toBytes(stillCommitment), commitmentBytes);
        assert.deepEqual(toBytes(stillKeccak), keccak);

        const repeat = await publishCheckpointFromLine(checkpointLine(bytes), { env, dataDir: dir });
        assert.equal(repeat, true);
        assert.equal(await pub.getTransactionCount({ address: poster.address }), nonceBefore + 2);

        const mismatchFile = join(dir, "mismatch.bin");
        writeFileSync(mismatchFile, new Uint8Array([0x05]));
        const castBin = resolveCastBin();
        assert.ok(castBin);
        const badKeccak = checkpointKeccak(new Uint8Array([0x05]));
        let rejected = false;
        try {
          const out = execFileSync(
            castBin,
            [
              "send",
              "--private-key",
              ANCHOR_POSTER_KEY,
              "--rpc-url",
              anvil.rpc,
              "--gas-limit",
              "500000",
              "--blob",
              "--path",
              mismatchFile,
              address,
              "postCheckpointBlob(bytes,bytes32)",
              "0x" + "11".repeat(48),
              toHex(badKeccak),
            ],
            { encoding: "utf8", windowsHide: true, timeout: 60_000 },
          );
          rejected = /status\s+(0x0|0)(\s|$)/.test(out);
        } catch {
          rejected = true;
        }
        assert.equal(rejected, true);
        const [unchanged] = await pub.readContract({
          address,
          abi,
          functionName: "checkpointBlob",
          args: [toHex(keccak)],
        });
        assert.deepEqual(toBytes(unchanged), commitmentBytes);
        await assert.rejects(
          pub.readContract({
            address,
            abi,
            functionName: "checkpointBlob",
            args: [toHex(badKeccak)],
          }),
        );

        const attempts = blobTxAttemptCount();
        const gnosis = await publishCheckpointFromLine(checkpointLine(new Uint8Array([0x05])), {
          env: { ...env, LOK_CHAIN_ID: "100" },
        });
        assert.equal(gnosis, false);
        assert.equal(blobTxAttemptCount(), attempts);
      } finally {
        anvil?.stop();
        resetRootAnchorForTests();
        resetCheckpointBlobsForTests();
      }
    },
  );
});
