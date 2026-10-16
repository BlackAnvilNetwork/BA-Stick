/**
 * Support review of 7cf9ee2: N2 across a real process restart (fresh LokWorld, no mirrored file).
 */
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { ASK_FILLED_TOPIC, applyAskFilled, decodeAskFilled, fillKeyOf, scanAskFilled } from "./ah-escrow";
import { allowEpochSettlementForTests } from "./epoch-cap-fixture";
import {
  AskFilledQuarantine,
  MirroredFills,
  askFilledMirroredPath,
  askFilledQuarantinePath,
} from "./lok-ask-filled-quarantine";
import { LokWorld } from "./lok-world";

const pad = (n: bigint) => n.toString(16).padStart(64, "0");
const addrPad = (a: string) => a.slice(2).toLowerCase().padStart(64, "0");

describe("support 7cf9ee2: AskFilled delivered set survives restart", () => {
  it("a reopened LokWorld knows the journaled fill and the rescan replays it", async () => {
    await allowEpochSettlementForTests(10n ** 24n);
    const dir = mkdtempSync(join(tmpdir(), "lok-ah-restart-"));
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
      data:
        "0x" +
        addrPad("0x00000000000000000000000000000000000000aa") +
        pad(500n) +
        pad(5n) +
        pad(111n) +
        pad(1n),
      blockNumber: "0x5",
      logIndex: "0x3",
      transactionHash: "0x" + "d4".padStart(64, "0"),
    };
    assert.equal(applyAskFilled(lok, decodeAskFilled(log)!, fillKeyOf(log), { log }).ok, true);

    const again = LokWorld.open(dir, undefined, {});
    assert.equal(again.hasChainFill(fillKeyOf(log)), true, "restarted world must see the ChainFill key from the log");
    const quarantine = new AskFilledQuarantine(askFilledQuarantinePath(dir));
    const mirrored = new MirroredFills(askFilledMirroredPath(dir));
    let kind = "";
    await scanAskFilled({
      cursor: 0n,
      escrow: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
      quarantine,
      rpcCall: async (m) => (m === "eth_blockNumber" ? "0x20" : [log]),
      apply: (fill, key, l) => {
        const r = applyAskFilled(again, fill, key, { mirrored, log: l });
        kind = r.kind;
        return r;
      },
    });
    assert.equal(kind, "replay");
    assert.equal(quarantine.list().length, 0);
  });
});
