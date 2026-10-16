/**
 * A certified checkpoint is packaged as blob bytes. A 20 Hz batch is not.
 * The anchor records the blob commitment and the keccak of the checkpoint
 * bytes. The validator copy stays after the blob is gone.
 */
import assert from "node:assert/strict";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import { keccak256 } from "viem";
import {
  BLOB_BYTES,
  BLOB_COMMITMENT_BYTES,
  MAX_CHECKPOINT_BYTES,
  anchoredCheckpointBlob,
  checkpointBytesFromBlob,
  checkpointKeccak,
  losePublishedBlob,
  packageCertifiedCheckpoint,
  postCertifiedCheckpoint,
  publishedBlobExists,
  readKeptCheckpoint,
  resetCheckpointBlobsForTests,
  type CertifiedCheckpoint,
} from "./checkpoint-blob";
import { submitOnSimTick } from "./order-submit";
import { postCertifiedBatch, resetRootAnchorForTests, type CertifiedBatch } from "./root-anchor";

const certificate = new Uint8Array([0x01, 0x02, 0x03, 0x04]);

function checkpoint(bytes: Uint8Array): CertifiedCheckpoint {
  return { kind: "checkpoint", bytes, certificate };
}

describe("checkpoint blobs", { concurrency: false }, () => {
  test("a certified checkpoint is packaged as one blob", () => {
    resetCheckpointBlobsForTests();
    const bytes = new Uint8Array([0x00, 0x00, 0x10, 0xff, 0x01]);
    const packed = packageCertifiedCheckpoint(checkpoint(bytes));
    assert.ok(packed);
    assert.equal(packed.blob.length, BLOB_BYTES);
    assert.equal(packed.commitment.length, BLOB_COMMITMENT_BYTES);
    assert.equal(packed.checkpointKeccak.length, 32);
    assert.deepEqual(packed.checkpointKeccak, new Uint8Array(keccak256(bytes, "bytes")));
    for (let i = 0; i < BLOB_BYTES; i += 32) assert.equal(packed.blob[i], 0);
    assert.deepEqual(checkpointBytesFromBlob(packed.blob), bytes);

    const again = packageCertifiedCheckpoint(checkpoint(bytes));
    assert.ok(again);
    assert.deepEqual(again.commitment, packed.commitment);
    assert.deepEqual(again.checkpointKeccak, packed.checkpointKeccak);

    const changed = packageCertifiedCheckpoint(checkpoint(new Uint8Array([0x02])));
    assert.ok(changed);
    assert.notDeepEqual(changed.commitment, packed.commitment);
    assert.notDeepEqual(changed.checkpointKeccak, packed.checkpointKeccak);
  });

  test("an uncertified or oversized body produces no blob", async () => {
    resetCheckpointBlobsForTests();
    let calls = 0;
    const poster = async () => {
      calls += 1;
      return true;
    };
    const bare = await postCertifiedCheckpoint(
      { kind: "checkpoint", bytes: new Uint8Array([1]), certificate: new Uint8Array() },
      { env: { LOK_CHAIN_ID: "31337" }, poster },
    );
    const empty = await postCertifiedCheckpoint(
      { kind: "checkpoint", bytes: new Uint8Array(), certificate },
      { env: { LOK_CHAIN_ID: "31337" }, poster },
    );
    const huge = new Uint8Array(MAX_CHECKPOINT_BYTES + 1);
    huge[0] = 1;
    const oversized = await postCertifiedCheckpoint(checkpoint(huge), {
      env: { LOK_CHAIN_ID: "31337" },
      poster,
    });
    assert.equal(bare, false);
    assert.equal(empty, false);
    assert.equal(oversized, false);
    assert.equal(calls, 0);
    assert.equal(packageCertifiedCheckpoint(checkpoint(huge)), null);
  });

  test("the anchor records the commitment and the keccak", async () => {
    resetCheckpointBlobsForTests();
    const bytes = new TextEncoder().encode("certified-checkpoint");
    const packed = packageCertifiedCheckpoint(checkpoint(bytes));
    assert.ok(packed);
    let seenCommitment: Uint8Array<ArrayBufferLike> = new Uint8Array();
    let seenKeccak: Uint8Array<ArrayBufferLike> = new Uint8Array();
    const ok = await postCertifiedCheckpoint(checkpoint(bytes), {
      env: { LOK_CHAIN_ID: "31337" },
      poster: async (posted) => {
        seenCommitment = posted.commitment;
        seenKeccak = posted.checkpointKeccak;
        assert.equal(posted.commitment.length, BLOB_COMMITMENT_BYTES);
        assert.deepEqual(posted.checkpointKeccak, packed.checkpointKeccak);
        return true;
      },
    });
    assert.equal(ok, true);
    assert.deepEqual(seenCommitment, packed.commitment);
    assert.deepEqual(seenKeccak, packed.checkpointKeccak);
    const stored = anchoredCheckpointBlob(packed.checkpointKeccak);
    assert.ok(stored);
    assert.deepEqual(stored.commitment, packed.commitment);
    assert.deepEqual(stored.checkpointKeccak, packed.checkpointKeccak);

    let second = 0;
    const repeat = await postCertifiedCheckpoint(checkpoint(bytes), {
      env: { LOK_CHAIN_ID: "31337" },
      poster: async () => {
        second += 1;
        return true;
      },
    });
    assert.equal(repeat, true);
    assert.equal(second, 0);
  });

  test("a failed post does not record the checkpoint", async () => {
    resetCheckpointBlobsForTests();
    const bytes = new Uint8Array([0x07, 0x08]);
    const packed = packageCertifiedCheckpoint(checkpoint(bytes));
    assert.ok(packed);
    const failed = await postCertifiedCheckpoint(checkpoint(bytes), {
      env: { LOK_CHAIN_ID: "31337" },
      poster: async () => false,
    });
    assert.equal(failed, false);
    assert.equal(anchoredCheckpointBlob(packed.checkpointKeccak), null);
  });

  test("Gnosis and Chiado do not receive a checkpoint blob", async () => {
    resetCheckpointBlobsForTests();
    const bytes = new Uint8Array([0x09]);
    for (const chainId of ["100", "10200"]) {
      let calls = 0;
      const ok = await postCertifiedCheckpoint(checkpoint(bytes), {
        env: {
          LOK_CHAIN_ID: chainId,
          LOK_CHAIN_RPC: "http://127.0.0.1:9",
        },
        poster: async () => {
          calls += 1;
          return true;
        },
      });
      assert.equal(ok, false);
      assert.equal(calls, 0);
    }
    const remote = await postCertifiedCheckpoint(checkpoint(bytes), {
      env: { LOK_CHAIN_ID: "31337", LOK_CHAIN_RPC: "https://rpc.gnosischain.com" },
      poster: async () => true,
    });
    assert.equal(remote, false);
    const packed = packageCertifiedCheckpoint(checkpoint(bytes));
    assert.ok(packed);
    assert.equal(anchoredCheckpointBlob(packed.checkpointKeccak), null);
  });

  test("the validator keeps the checkpoint bytes after the blob is gone", async () => {
    resetCheckpointBlobsForTests();
    const bytes = new Uint8Array([0x11, 0x00, 0x22, 0x33, 0x00]);
    const packed = packageCertifiedCheckpoint(checkpoint(bytes));
    assert.ok(packed);
    const dir = mkdtempSync(join(tmpdir(), "lok-checkpoint-blob-"));
    const posted = await postCertifiedCheckpoint(checkpoint(bytes), {
      env: { LOK_CHAIN_ID: "31337" },
      poster: async () => true,
      dataDir: dir,
    });
    assert.equal(posted, true);
    assert.equal(publishedBlobExists(dir, packed.checkpointKeccak), true);
    assert.deepEqual(readKeptCheckpoint(dir, packed.checkpointKeccak), bytes);

    losePublishedBlob(dir, packed.checkpointKeccak);
    assert.equal(publishedBlobExists(dir, packed.checkpointKeccak), false);
    assert.equal(existsSync(join(dir, "checkpoints", Buffer.from(packed.checkpointKeccak).toString("hex"))), true);
    assert.deepEqual(readKeptCheckpoint(dir, packed.checkpointKeccak), bytes);
    const stored = anchoredCheckpointBlob(packed.checkpointKeccak);
    assert.ok(stored);
    assert.deepEqual(stored.commitment, packed.commitment);
    assert.deepEqual(stored.checkpointKeccak, checkpointKeccak(bytes));
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
      assert.equal(anchoredCheckpointBlob(checkpointKeccak(nextRoot)), null);
      assert.equal(anchoredCheckpointBlob(checkpointKeccak(certificate)), null);
    } finally {
      resetRootAnchorForTests();
      resetCheckpointBlobsForTests();
    }
  });
});
