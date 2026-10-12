import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  bumpPendingCancel,
  cancelOpenAsksForCharacter,
  decodeErc721Transfer,
  enqueuePendingCancel,
  ERC721_TRANSFER_TOPIC,
  NFT_TRANSFER_CONFIRMATIONS,
  PENDING_CANCEL_MAX_ATTEMPTS,
  readPendingCancels,
  retryPendingCancels,
  scanNftTransfers,
  writePendingCancels,
  type PendingCancel,
} from "./nft-transfer-ask-cancel";

function padAddr(addr: string): string {
  return "0x" + addr.replace(/^0x/, "").toLowerCase().padStart(64, "0");
}

function padId(id: bigint): string {
  return "0x" + id.toString(16).padStart(64, "0");
}

describe("decodeErc721Transfer", () => {
  it("decodes a Transfer log", () => {
    const from = "0x00000000000000000000000000000000000000aa";
    const to = "0x00000000000000000000000000000000000000bb";
    const xfer = decodeErc721Transfer({
      topics: [ERC721_TRANSFER_TOPIC, padAddr(from), padAddr(to), padId(7n)],
    });
    assert.ok(xfer);
    assert.equal(xfer!.from, from);
    assert.equal(xfer!.to, to);
    assert.equal(xfer!.tokenId, "7");
  });

  it("rejects non-Transfer topics", () => {
    assert.equal(
      decodeErc721Transfer({
        topics: ["0x" + "11".repeat(32), padAddr("0x1"), padAddr("0x2"), padId(1n)],
      }),
      null,
    );
  });
});

describe("cancelOpenAsksForCharacter", () => {
  it("cancels open book asks for the transferred character", async () => {
    const cancelledLog: string[] = [];
    const onchain: string[] = [];
    const lok = {
      openBookListings: () => [
        { id: "1", seller: "7", itemId: "1", amount: "1", highBidder: null, highBid: "0", book: true },
        { id: "2", seller: "8", itemId: "1", amount: "1", highBidder: null, highBid: "0", book: true },
        { id: "3", seller: "7", itemId: "2", amount: "1", highBidder: null, highBid: "0", book: true },
      ],
      cancelAsk: (listingId: string, seller: string) => {
        cancelledLog.push(listingId + ":" + seller);
        return { ok: true as const };
      },
    };
    const res = await cancelOpenAsksForCharacter(lok, "7", {
      cancelOnchain: async (listingId) => {
        onchain.push(listingId);
        return { ok: true };
      },
    });
    assert.deepEqual(res.cancelled.sort(), ["1", "3"]);
    assert.deepEqual(onchain.sort(), ["1", "3"]);
    assert.deepEqual(cancelledLog.sort(), ["1:7", "3:7"]);
    assert.deepEqual(res.skipped, []);
    assert.deepEqual(res.pending, []);
  });

  it("queues failed on-chain cancels for retry (does not drop them)", async () => {
    const lok = {
      openBookListings: () => [
        { id: "9", seller: "7", itemId: "1", amount: "1", highBidder: null, highBid: "0", book: true },
      ],
      cancelAsk: () => {
        throw new Error("should not cancel log when on-chain failed");
      },
    };
    const res = await cancelOpenAsksForCharacter(lok, "7", {
      cancelOnchain: async () => ({ ok: false, error: "rpc down" }),
    });
    assert.deepEqual(res.cancelled, []);
    assert.deepEqual(res.skipped, []);
    assert.deepEqual(res.pending, [{ listingId: "9", sellerTokenId: "7" }]);
  });

  it("leaves AskFilled (wait-fill) asks for the AskFilled watcher", async () => {
    const lok = {
      openBookListings: () => [
        { id: "9", seller: "7", itemId: "1", amount: "1", highBidder: null, highBid: "0", book: true },
      ],
      cancelAsk: () => {
        throw new Error("should not cancel log when wait-fill");
      },
    };
    const res = await cancelOpenAsksForCharacter(lok, "7", {
      cancelOnchain: async () => ({ ok: true, alreadyClosed: true }),
      classifyClosed: async () => ({ action: "wait-fill" as const }),
    });
    assert.deepEqual(res.cancelled, []);
    assert.deepEqual(res.skipped, ["9"]);
    assert.deepEqual(res.pending, []);
  });

  it("log-cancels when alreadyClosed and AskCancelled is present (crash recovery)", async () => {
    const cancelledLog: string[] = [];
    const lok = {
      openBookListings: () => [
        { id: "9", seller: "7", itemId: "1", amount: "1", highBidder: null, highBid: "0", book: true },
      ],
      cancelAsk: (listingId: string, seller: string) => {
        cancelledLog.push(listingId + ":" + seller);
        return { ok: true as const };
      },
    };
    const res = await cancelOpenAsksForCharacter(lok, "7", {
      cancelOnchain: async () => ({ ok: true, alreadyClosed: true }),
      classifyClosed: async () => ({ action: "cancel-log" as const }),
    });
    assert.deepEqual(res.cancelled, ["9"]);
    assert.deepEqual(cancelledLog, ["9:7"]);
    assert.deepEqual(res.pending, []);
  });
});

describe("pending cancel persist + retry", () => {
  it("round-trips pending cancels on disk", () => {
    const dir = mkdtempSync(join(tmpdir(), "lok-nft-pending-"));
    const path = join(dir, "pending.json");
    writePendingCancels(path, [
      { listingId: "1", sellerTokenId: "7" },
      { listingId: "1", sellerTokenId: "7" },
      { listingId: "2", sellerTokenId: "8" },
    ]);
    assert.deepEqual(readPendingCancels(path), [
      { listingId: "1", sellerTokenId: "7" },
      { listingId: "2", sellerTokenId: "8" },
    ]);
  });

  it("retries pending until on-chain cancel succeeds", async () => {
    let attempts = 0;
    const open = new Map([
      ["9", { id: "9", seller: "7", itemId: "1", amount: "1", highBidder: null, highBid: "0", book: true }],
    ]);
    const lok = {
      openBookListings: () => [...open.values()],
      cancelAsk: (listingId: string) => {
        open.delete(listingId);
        return { ok: true as const };
      },
    };
    const first = await retryPendingCancels(lok, [{ listingId: "9", sellerTokenId: "7" }], {
      now: 1_000,
      cancelOnchain: async () => {
        attempts += 1;
        return attempts === 1 ? { ok: false, error: "busy" } : { ok: true };
      },
    });
    assert.equal(attempts, 1);
    assert.equal(first.remaining.length, 1);
    assert.equal(first.remaining[0]!.listingId, "9");
    assert.equal(first.remaining[0]!.attempts, 1);
    assert.ok((first.remaining[0]!.nextRetryAtMs ?? 0) > 1_000);
    assert.equal(open.has("9"), true);

    // Still deferred — not due yet.
    const deferred = await retryPendingCancels(lok, first.remaining, {
      now: 1_001,
      cancelOnchain: async () => {
        throw new Error("should not retry before nextRetryAtMs");
      },
    });
    assert.equal(deferred.remaining.length, 1);
    assert.equal(attempts, 1);

    const second = await retryPendingCancels(lok, first.remaining, {
      now: first.remaining[0]!.nextRetryAtMs!,
      cancelOnchain: async () => {
        attempts += 1;
        return { ok: true };
      },
    });
    assert.equal(attempts, 2);
    assert.deepEqual(second.remaining, []);
    assert.deepEqual(second.cancelled, ["9"]);
    assert.equal(open.has("9"), false);
  });

  it("backs off ambiguous cancels and drops after the attempt cap", async () => {
    const open = new Map([
      ["9", { id: "9", seller: "7", itemId: "1", amount: "1", highBidder: null, highBid: "0", book: true }],
    ]);
    const lok = {
      openBookListings: () => [...open.values()],
      cancelAsk: () => {
        throw new Error("should not cancel when ambiguous");
      },
    };
    let remaining: PendingCancel[] = [{ listingId: "9", sellerTokenId: "7", ambiguous: true }];
    let now = 0;
    for (let i = 0; i < PENDING_CANCEL_MAX_ATTEMPTS; i++) {
      const res = await retryPendingCancels(lok, remaining, {
        now,
        cancelOnchain: async () => ({ ok: true, alreadyClosed: true }),
        classifyClosed: async () => ({ action: "skip" as const }),
      });
      assert.equal(res.remaining.length, 1);
      assert.equal(res.remaining[0]!.attempts, i + 1);
      assert.equal(res.remaining[0]!.ambiguous, true);
      remaining = res.remaining;
      now = remaining[0]!.nextRetryAtMs!;
    }
    const capped = await retryPendingCancels(lok, remaining, {
      now,
      cancelOnchain: async () => ({ ok: true, alreadyClosed: true }),
      classifyClosed: async () => ({ action: "skip" as const }),
    });
    assert.deepEqual(capped.remaining, []);
    assert.deepEqual(capped.dropped, ["9"]);
  });

  it("enqueuePendingCancel merges into the watcher pending file", () => {
    const dir = mkdtempSync(join(tmpdir(), "lok-nft-enqueue-"));
    const path = join(dir, "pending.json");
    writePendingCancels(path, [{ listingId: "1", sellerTokenId: "7" }]);
    enqueuePendingCancel({ listingId: "2", sellerTokenId: "8" }, { pendingPath: path });
    const rows = readPendingCancels(path);
    assert.equal(rows.length, 2);
    assert.ok(rows.some((r) => r.listingId === "2" && (r.attempts ?? 0) >= 1));
  });

  it("bumpPendingCancel returns null past the cap", () => {
    assert.equal(
      bumpPendingCancel({ listingId: "1", sellerTokenId: "7", attempts: PENDING_CANCEL_MAX_ATTEMPTS }),
      null,
    );
  });
});

describe("scanNftTransfers", () => {
  it("skips self-transfers and respects confirmation depth", async () => {
    const seen: string[] = [];
    const from = "0x00000000000000000000000000000000000000aa";
    const to = "0x00000000000000000000000000000000000000bb";
    const selfLog = {
      topics: [ERC721_TRANSFER_TOPIC, padAddr(from), padAddr(from), padId(1n)],
      blockNumber: "0x64",
    };
    const realLog = {
      topics: [ERC721_TRANSFER_TOPIC, padAddr(from), padAddr(to), padId(2n)],
      blockNumber: "0x64",
    };
    // latest=0x66 → safeHead = 0x66 - 2 = 0x64
    const next = await scanNftTransfers({
      cursor: 0x63n,
      nft: "0x00000000000000000000000000000000000000ff",
      confirmations: NFT_TRANSFER_CONFIRMATIONS,
      rpcCall: async (method) => {
        if (method === "eth_blockNumber") return "0x66";
        if (method === "eth_getLogs") return [selfLog, realLog];
        throw new Error(method);
      },
      onTransfer: async (xfer) => {
        seen.push(xfer.tokenId);
      },
    });
    assert.deepEqual(seen, ["2"]);
    assert.equal(next.cursor, 0x64n);
  });

  it("does not advance past unconfirmed tip blocks", async () => {
    const next = await scanNftTransfers({
      cursor: 100n,
      nft: "0x00000000000000000000000000000000000000ff",
      confirmations: 2n,
      rpcCall: async (method) => {
        if (method === "eth_blockNumber") return "0x66"; // 102
        throw new Error("should not getLogs when cursor past safeHead");
      },
      onTransfer: async () => {
        throw new Error("no transfers");
      },
    });
    // safeHead = 100; cursor 100 → from=101 > safeHead → unchanged
    assert.equal(next.cursor, 100n);
  });
});
