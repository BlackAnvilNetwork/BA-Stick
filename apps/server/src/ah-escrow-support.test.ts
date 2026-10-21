/**
 * Support review regressions for AskFilled watcher (was SUPPORT-FAIL on 312fa29).
 */
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { ASK_FILLED_TOPIC, applyAskFilled, scanAskFilled } from "./ah-escrow";
import { AskFilledQuarantine, MirroredFills, askFilledMirroredPath, askFilledQuarantinePath } from "./lok-ask-filled-quarantine";
import { LokWorld } from "./lok-world";

const pad = (n: bigint) => n.toString(16).padStart(64, "0");
const addrPad = (a: string) => a.slice(2).toLowerCase().padStart(64, "0");
const BUYER_ADDR = "0x00000000000000000000000000000000000000bb";
const SELLER_ADDR = "0x00000000000000000000000000000000000000aa";

function askFilledLog(o: { listingId: string; buyerTokenId: string; price: string; block: number; tx: string }) {
  return {
    topics: [ASK_FILLED_TOPIC, "0x" + pad(BigInt(o.listingId)), "0x" + addrPad(BUYER_ADDR), "0x" + pad(BigInt(o.buyerTokenId))],
    data:
      "0x" +
      addrPad(SELLER_ADDR) +
      pad(BigInt(o.price)) +
      pad(BigInt(o.price) / 100n) +
      pad(111n) +
      pad(1n),
    blockNumber: "0x" + o.block.toString(16),
    logIndex: "0x0",
    transactionHash: "0x" + o.tx.padStart(64, "0"),
  };
}

function world() {
  const dir = mkdtempSync(join(tmpdir(), "lok-ah-support-"));
  const lok = LokWorld.open(dir, undefined, {});
  const seller = lok.spawn("seller", "Seller", 1);
  const buyer = lok.spawn("buyer", "Buyer", 2);
  assert.ok(seller.ok && buyer.ok);
  const s = (seller as { tokenId: string }).tokenId;
  const b = (buyer as { tokenId: string }).tokenId;
  let nonce = 0;
  const list = (price: string) => {
    nonce += 1;
    lok.noteCustodyInbound({ kind: "importItem", tokenId: s, nonce: String(nonce), itemId: "111", amount: "1" });
    assert.equal(lok.importItem(s, "111", "1", String(nonce)).ok, true);
    const ask = lok.ask(s, "111", "1", price, 1_700_000_000);
    assert.ok(ask.ok && ask.listingId);
    return ask.listingId!;
  };
  return { lok, seller: s, buyer: b, list, dir };
}

function scan(lok: LokWorld, dir: string, logs: unknown[], head = 0x20) {
  const quarantine = new AskFilledQuarantine(askFilledQuarantinePath(dir));
  const mirrored = new MirroredFills(askFilledMirroredPath(dir));
  return scanAskFilled({
    cursor: 0n,
    escrow: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
    quarantine,
    rpcCall: async (method) => {
      if (method === "eth_blockNumber") return "0x" + head.toString(16);
      if (method === "eth_getLogs") return logs;
      throw new Error("unexpected " + method);
    },
    apply: (fill, key, log) => applyAskFilled(lok, fill, key, { mirrored, log }),
  }).then((next) => ({ next, quarantine, mirrored }));
}

const inboxQty = (lok: LokWorld, token: string) =>
  (lok.view(token).inbox ?? []).filter((r) => String(r.tokenId) === "111").reduce((n, r) => n + Number(r.amount), 0);

describe("support: AskFilled watcher vs log state", { concurrency: false }, () => {
  it("a re-scanned (already mirrored) fill is skipped, not applied twice", async () => {
    const { lok, buyer, list, dir } = world();
    const id = list("500");
    const log = askFilledLog({ listingId: id, buyerTokenId: buyer, price: "500", block: 5, tx: "a1" });
    await scan(lok, dir, [log]);
    const second = await scan(lok, dir, [log]);
    assert.equal(inboxQty(lok, buyer), 1);
    assert.equal(second.next.cursor, 0x20n - 2n + 1n);
  });

  it("a paid fill for a listing already cancelled on the log is quarantined, not silently dropped", async () => {
    const { lok, seller, buyer, list, dir } = world();
    const id = list("500");
    assert.equal(lok.cancelAsk(id, seller).ok, true);
    const log = askFilledLog({ listingId: id, buyerTokenId: buyer, price: "500", block: 5, tx: "b1" });
    const { next, quarantine } = await scan(lok, dir, [log]);
    assert.equal(next.cursor, 0x20n - 2n + 1n, "cursor advances past quarantined fill");
    assert.equal(quarantine.list().length, 1);
    assert.equal(quarantine.list()[0]!.reason, "unknown-listing");
    assert.equal(inboxQty(lok, buyer), 0);
  });

  it("one fill naming an unspawned buyer token must not block later fills", async () => {
    const { lok, buyer, list, dir } = world();
    const bad = list("500");
    const good = list("700");
    const logs = [
      askFilledLog({ listingId: bad, buyerTokenId: "999999", price: "500", block: 5, tx: "c1" }),
      askFilledLog({ listingId: good, buyerTokenId: buyer, price: "700", block: 6, tx: "c2" }),
    ];
    const { quarantine } = await scan(lok, dir, logs);
    assert.equal(inboxQty(lok, buyer), 1, "a later honest fill was mirrored");
    assert.ok(quarantine.list().some((e) => e.reason === "not-spawned"));
  });

  it("a seller buying their own ask must not block later fills", async () => {
    const { lok, seller, buyer, list, dir } = world();
    const own = list("1");
    const good = list("700");
    const logs = [
      askFilledLog({ listingId: own, buyerTokenId: seller, price: "1", block: 5, tx: "d1" }),
      askFilledLog({ listingId: good, buyerTokenId: buyer, price: "700", block: 6, tx: "d2" }),
    ];
    const { quarantine } = await scan(lok, dir, logs);
    assert.equal(inboxQty(lok, buyer), 1, "self-buy quarantined; later fill mirrored");
    assert.ok(quarantine.list().some((e) => e.reason === "self-transfer"));
  });
});
