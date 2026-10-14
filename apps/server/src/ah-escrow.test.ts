import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { keccak256, stringToHex } from "viem";
import {
  ASK_FILLED_TOPIC,
  ahEscrowClientConfig,
  applyAskFilled,
  classifyAskFilledFailure,
  decodeAskFilled,
  fillKeyOf,
  scanAskFilled,
} from "./ah-escrow";
import { LokWorld } from "./lok-world";

describe("AhEscrow AskFilled mirror", () => {
  it("topic0 matches the canonical event signature", () => {
    const topic = keccak256(
      stringToHex("AskFilled(uint256,address,uint256,address,uint256,uint256,uint256,uint256)"),
    );
    assert.equal(ASK_FILLED_TOPIC.toLowerCase(), topic.toLowerCase());
  });

  it("decodeAskFilled reads indexed topics and data words (incl. feeWei)", () => {
    const listingId = 7n;
    const buyer = "0x00000000000000000000000000000000000000bb";
    const buyerToken = 2n;
    const sellerPayout = "0x00000000000000000000000000000000000000aa";
    const price = 20_000_000_000_000_000n;
    const fee = 200_000_000_000_000n;
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
      data: "0x" + addrPad(sellerPayout) + pad(price) + pad(fee) + pad(itemId) + pad(amount),
    };
    const decoded = decodeAskFilled(log);
    assert.ok(decoded);
    assert.equal(decoded!.listingId, "7");
    assert.equal(decoded!.buyer.toLowerCase(), buyer.toLowerCase());
    assert.equal(decoded!.buyerTokenId, "2");
    assert.equal(decoded!.sellerPayout.toLowerCase(), sellerPayout.toLowerCase());
    assert.equal(decoded!.priceWei, price.toString());
    assert.equal(decoded!.feeWei, fee.toString());
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
      feeWei: "5",
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

  it("classifyAskFilledFailure treats all non-replay errors as quarantine", () => {
    assert.equal(classifyAskFilledFailure("unknown listing"), "quarantine");
    assert.equal(classifyAskFilledFailure("buyer would pay more than the ask"), "quarantine");
    assert.equal(classifyAskFilledFailure("rpc timeout"), "quarantine");
    assert.equal(classifyAskFilledFailure("some random engine error"), "quarantine");
  });

  it("ahEscrowClientConfig needs address + http rpc + chain id", async () => {
    const { setCachedSettlementChainId } = await import("./settlement-chain");
    setCachedSettlementChainId(null);
    assert.equal(ahEscrowClientConfig({}), null);
    assert.deepEqual(
      ahEscrowClientConfig({
        LOK_AH_ESCROW: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
        LOK_CHAIN_RPC: "http://127.0.0.1:8545",
        LOK_CHAIN_ID: "31337",
      }),
      {
        address: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
        rpcUrl: "http://127.0.0.1:8545",
        chainId: 31337,
        feeBps: 100,
        currency: {
          chainId: 31337,
          symbol: "ETH",
          name: "Ether",
          decimals: 18,
          defaultMintFeeWei: "1000000000000000",
          exampleAskHuman: "0.001",
        },
      },
    );
    assert.equal(
      ahEscrowClientConfig({
        LOK_AH_ESCROW: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
        LOK_CHAIN_RPC: "https://rpc.chiado.gnosis.gateway.fm",
        LOK_CHAIN_ID: "10200",
      })?.currency.symbol,
      "xDAI",
    );
  });

  it("scanAskFilled applies confirmed logs and advances the cursor", async () => {
    const pad = (n: bigint) => n.toString(16).padStart(64, "0");
    const addrPad = (a: string) => a.slice(2).toLowerCase().padStart(64, "0");
    const listingId = 9n;
    const buyer = "0x00000000000000000000000000000000000000bb";
    const buyerToken = 2n;
    const sellerPayout = "0x00000000000000000000000000000000000000aa";
    const price = 500n;
    const fee = 5n;
    const itemId = 111n;
    const amount = 1n;
    const log = {
      topics: [
        ASK_FILLED_TOPIC,
        "0x" + pad(listingId),
        "0x" + addrPad(buyer),
        "0x" + pad(buyerToken),
      ],
      data: "0x" + addrPad(sellerPayout) + pad(price) + pad(fee) + pad(itemId) + pad(amount),
      blockNumber: "0x5",
      logIndex: "0x0",
      transactionHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    };
    const applied: string[] = [];
    const next = await scanAskFilled({
      cursor: 0n,
      escrow: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
      rpcCall: async (method) => {
        if (method === "eth_blockNumber") return "0x8";
        if (method === "eth_getLogs") return [log];
        throw new Error("unexpected " + method);
      },
      apply: (fill, fillKey) => {
        applied.push(fill.listingId + ":" + fillKey);
        assert.equal(fillKey, fillKeyOf(log));
        return { ok: true, kind: "applied" };
      },
    });
    // safeHead = 8 - 2 = 6; cursor advances to 7
    assert.equal(next.cursor, 7n);
    assert.deepEqual(applied, ["9:" + fillKeyOf(log)]);
  });
});
