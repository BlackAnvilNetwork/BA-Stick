/**
 * Support review of acd4d6f. N2: delivered fills must replay from the log, not the side file.
 */
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { ASK_FILLED_TOPIC, applyAskFilled, decodeAskFilled, fillKeyOf, scanAskFilled } from "./ah-escrow";
import {
  AskFilledQuarantine,
  MirroredFills,
  askFilledMirroredPath,
  askFilledQuarantinePath,
} from "./lok-ask-filled-quarantine";
import { LokWorld } from "./lok-world";

const pad = (n: bigint) => n.toString(16).padStart(64, "0");
const addrPad = (a: string) => a.slice(2).toLowerCase().padStart(64, "0");

describe("support acd4d6f: AskFilled mirror crash window", () => {
  it("a fill journaled before lok-ask-filled-mirrored.json was written is not quarantined on restart", async () => {
    const dir = mkdtempSync(join(tmpdir(), "lok-ah-crash-"));
    const lok = LokWorld.open(dir, undefined, {});
    const s = lok.spawn("seller", "Seller", 1);
    const b = lok.spawn("buyer", "Buyer", 2);
    assert.ok(s.ok && b.ok);
    const seller = (s as { tokenId: string }).tokenId;
    const buyer = (b as { tokenId: string }).tokenId;
    lok.noteCustodyInbound({ kind: "importItem", tokenId: seller, nonce: "1", itemId: "111", amount: "1" });
    assert.equal(lok.importItem(seller, "111", "1", "1").ok, true);
    const ask = lok.ask(seller, "111", "1", "500", 1_700_000_000);
    assert.ok(ask.ok && ask.listingId);
    const log = {
      topics: [ASK_FILLED_TOPIC, "0x" + pad(BigInt(ask.listingId!)), "0x" + addrPad("0x00000000000000000000000000000000000000bb"), "0x" + pad(BigInt(buyer))],
      data: "0x" + addrPad("0x00000000000000000000000000000000000000aa") + pad(500n) + pad(111n) + pad(1n),
      blockNumber: "0x5",
      logIndex: "0x0",
      transactionHash: "0x" + "c3".padStart(64, "0"),
    };
    // Watcher tick: chainFill is appended + journaled, then the process dies before
    // MirroredFills.add() persists the key (ah-escrow.ts:152-154). Model that by
    // applying without the mirrored set.
    const first = applyAskFilled(lok, decodeAskFilled(log)!, fillKeyOf(log), { log });
    assert.equal(first.ok, true);
    // Restart: cursor file still points before block 5, mirrored file has no key.
    const quarantine = new AskFilledQuarantine(askFilledQuarantinePath(dir));
    const mirrored = new MirroredFills(askFilledMirroredPath(dir));
    await scanAskFilled({
      cursor: 0n,
      escrow: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
      quarantine,
      rpcCall: async (m) => (m === "eth_blockNumber" ? "0x20" : [log]),
      apply: (fill, key, l) => applyAskFilled(lok, fill, key, { mirrored, log: l }),
    });
    assert.equal(
      quarantine.list().length,
      0,
      "a delivered fill was quarantined as 'paid buyer owed refund' (" + quarantine.list().map((e) => e.reason).join(",") + ")",
    );
  });
});