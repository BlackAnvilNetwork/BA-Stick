/**
 * H2: reconcile must not treat filled asks as cancelled.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ASK_CANCELLED_TOPIC,
  classifyClosedAsk,
  reconcileOpenAsksFromChain,
} from "./ah-escrow-reconcile";
import { ASK_FILLED_TOPIC } from "./ah-escrow";
import { AskFilledQuarantine } from "./lok-ask-filled-quarantine";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const pad = (n: bigint) => n.toString(16).padStart(64, "0");

describe("ah-escrow reconcile (H2)", () => {
  it("classifyClosedAsk never cancels on open=false alone", async () => {
    const decision = await classifyClosedAsk({
      listingId: "3",
      escrow: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
      quarantined: false,
      onchain: { open: false, used: true },
      rpcCall: async () => [],
    });
    assert.equal(decision.action, "skip");
    assert.match(decision.reason, /neither AskFilled nor AskCancelled/i);
  });

  it("AskFilled → wait-fill (do not return item to seller)", async () => {
    const listingId = "1";
    const decision = await classifyClosedAsk({
      listingId,
      escrow: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
      quarantined: false,
      onchain: { open: false, used: true },
      rpcCall: async (_m, params) => {
        const filter = params[0] as { topics?: string[] };
        if (filter.topics?.[0]?.toLowerCase() === ASK_FILLED_TOPIC.toLowerCase()) {
          return [{ topics: [ASK_FILLED_TOPIC, "0x" + pad(1n)] }];
        }
        return [];
      },
    });
    assert.equal(decision.action, "wait-fill");
  });

  it("AskCancelled → cancel-log", async () => {
    const decision = await classifyClosedAsk({
      listingId: "2",
      escrow: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
      quarantined: false,
      onchain: { open: false, used: true },
      rpcCall: async (_m, params) => {
        const filter = params[0] as { topics?: string[] };
        if (filter.topics?.[0]?.toLowerCase() === ASK_CANCELLED_TOPIC.toLowerCase()) {
          return [{ topics: [ASK_CANCELLED_TOPIC, "0x" + pad(2n)] }];
        }
        return [];
      },
    });
    assert.equal(decision.action, "cancel-log");
  });

  it("quarantined listings are never cancelled back to the seller", async () => {
    const decision = await classifyClosedAsk({
      listingId: "9",
      escrow: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
      quarantined: true,
      onchain: { open: false, used: true },
      rpcCall: async () => {
        throw new Error("should not scan logs when quarantined");
      },
    });
    assert.equal(decision.action, "skip");
  });

  it("reconcileOpenAsksFromChain cancels only AskCancelled listings", async () => {
    const dir = mkdtempSync(join(tmpdir(), "lok-reconcile-"));
    const cancelled: string[] = [];
    const world = {
      openBookListings: () => [
        { id: "1", seller: "1", itemId: "10", amount: "1", highBidder: null, highBid: "0", book: true },
        { id: "2", seller: "1", itemId: "11", amount: "1", highBidder: null, highBid: "0", book: true },
      ],
      cancelAsk: (id: string) => {
        cancelled.push(id);
        return { ok: true as const };
      },
    };
    const quarantine = new AskFilledQuarantine(join(dir, "q.json"));
    const escrow = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";
    const result = await reconcileOpenAsksFromChain(world, {
      env: {
        LOK_AH_ESCROW: escrow,
        LOK_CHAIN_RPC: "http://127.0.0.1:1",
      },
      quarantine,
      dataDir: dir,
      readAsk: async () => ({ ok: true, ask: { open: false, used: true } }),
      rpcCall: async (_m, params) => {
        const filter = params[0] as { topics?: string[] };
        const topic0 = filter.topics?.[0]?.toLowerCase() ?? "";
        const topic1 = filter.topics?.[1]?.toLowerCase() ?? "";
        if (topic0 === ASK_FILLED_TOPIC.toLowerCase() && topic1.endsWith("1")) {
          return [{ topics: [ASK_FILLED_TOPIC, "0x" + pad(1n)] }];
        }
        if (topic0 === ASK_CANCELLED_TOPIC.toLowerCase() && topic1.endsWith("2")) {
          return [{ topics: [ASK_CANCELLED_TOPIC, "0x" + pad(2n)] }];
        }
        return [];
      },
    });
    assert.deepEqual(result.waitingFill, ["1"]);
    assert.deepEqual(result.cancelled, ["2"]);
    assert.deepEqual(cancelled, ["2"]);
  });
});
