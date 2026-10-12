import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cancelOpenAsksForCharacter,
  decodeErc721Transfer,
  ERC721_TRANSFER_TOPIC,
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
  });

  it("leaves already-closed (likely filled) asks for the AskFilled watcher", async () => {
    const lok = {
      openBookListings: () => [
        { id: "9", seller: "7", itemId: "1", amount: "1", highBidder: null, highBid: "0", book: true },
      ],
      cancelAsk: () => {
        throw new Error("should not cancel log when already closed on-chain");
      },
    };
    const res = await cancelOpenAsksForCharacter(lok, "7", {
      cancelOnchain: async () => ({ ok: true, alreadyClosed: true }),
    });
    assert.deepEqual(res.cancelled, []);
    assert.deepEqual(res.skipped, ["9"]);
  });
});
