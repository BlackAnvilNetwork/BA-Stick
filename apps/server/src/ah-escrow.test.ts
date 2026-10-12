import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { keccak256, stringToHex } from "viem";
import { ASK_FILLED_TOPIC, applyAskFilled, decodeAskFilled } from "./ah-escrow";
import { LokWorld } from "./lok-world";

describe("AhEscrow AskFilled mirror", () => {
  it("topic0 matches the canonical event signature", () => {
    const topic = keccak256(stringToHex("AskFilled(uint256,address,uint256,address,uint256,uint256,uint256)"));
    assert.equal(ASK_FILLED_TOPIC.toLowerCase(), topic.toLowerCase());
  });

  it("decodeAskFilled reads indexed topics and data words", () => {
    const listingId = 7n;
    const buyer = "0x00000000000000000000000000000000000000bb";
    const buyerToken = 2n;
    const sellerPayout = "0x00000000000000000000000000000000000000aa";
    const price = 20_000_000_000_000_000n;
    const itemId = 111n;
    const amount = 3n;
    const pad = (n: bigint) => n.toString(16).padStart(64, "0");
    const addrPad = (a: string) => a.slice(2).toLowerCase().padStart(64, "0");
    const log = {
      topics: [
        ASK_FILLED_TOPIC,
        "0x" + pad(listingId),
        "0x" + addrPad(buyer),
        "0x" + pad(buyerToken),
      ],
      data: "0x" + addrPad(sellerPayout) + pad(price) + pad(itemId) + pad(amount),
    };
    const decoded = decodeAskFilled(log);
    assert.ok(decoded);
    assert.equal(decoded!.listingId, "7");
    assert.equal(decoded!.buyer.toLowerCase(), buyer.toLowerCase());
    assert.equal(decoded!.buyerTokenId, "2");
    assert.equal(decoded!.sellerPayout.toLowerCase(), sellerPayout.toLowerCase());
    assert.equal(decoded!.priceWei, price.toString());
    assert.equal(decoded!.itemId, "111");
    assert.equal(decoded!.amount, "3");
  });

  it("applyAskFilled moves inbox items without changing kek", () => {
    const dir = mkdtempSync(join(tmpdir(), "lok-ah-escrow-"));
    const lok = LokWorld.open(dir, undefined, {});
    const seller = lok.spawn("seller", "Seller", 1);
    const buyer = lok.spawn("buyer", "Buyer", 2);
    assert.equal(seller.ok, true);
    assert.equal(buyer.ok, true);
    if (!seller.ok || !buyer.ok) return;
    lok.noteCustodyInbound({
      kind: "importItem",
      tokenId: seller.tokenId,
      nonce: "1",
      itemId: "111",
      amount: "1",
    });
    assert.equal(lok.importItem(seller.tokenId, "111", "1", "1").ok, true);
    const ask = lok.ask(seller.tokenId, "111", "1", "500", 1_700_000_000);
    assert.equal(ask.ok, true);
    assert.ok(ask.listingId);

    const fill = {
      listingId: ask.listingId!,
      buyer: "0x00000000000000000000000000000000000000bb",
      buyerTokenId: buyer.tokenId,
      sellerPayout: "0x00000000000000000000000000000000000000aa",
      priceWei: "500",
      itemId: "111",
      amount: "1",
    };
    const beforeSellerKek = lok.kekOf(seller.tokenId);
    const beforeBuyerKek = lok.kekOf(buyer.tokenId);
    const applied = applyAskFilled(lok, fill, "0xabc-0");
    assert.equal(applied.ok, true, applied.ok ? "" : applied.error);
    assert.equal(lok.kekOf(seller.tokenId), beforeSellerKek);
    assert.equal(lok.kekOf(buyer.tokenId), beforeBuyerKek);
    const inbox = lok.view(buyer.tokenId).inbox ?? [];
    const stack = inbox.find((row) => String(row.tokenId) === "111");
    assert.ok(stack);
    assert.equal(stack!.amount, "1");
    assert.equal(
      lok.view(seller.tokenId).listings.some((l) => l.id === ask.listingId),
      false,
    );
  });
});
