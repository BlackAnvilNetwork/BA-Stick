/**
 * Hunt-fix: listing tx gate, receipt timeout, pending openAsk nonce, replace wait.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  LISTING_RECEIPT_TIMEOUT_MS,
  resolvePendingOpenAsk,
} from "./ah-escrow-tx";
import { OpenAskPendingStore, resetOpenAskPendingForTests } from "./open-ask-pending";

const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "ah-escrow-tx.ts"), "utf8");

const unusedAsk = {
  sellerTokenId: "1",
  itemId: "10",
  amount: "1",
  priceWei: "500",
  open: false,
  used: false,
};

describe("ah-escrow-tx listing hunt fixes", () => {
  it("openAsk re-checks chainBoundSendGate inside withOwnerKeyQueue", () => {
    const start = SRC.indexOf("export async function openAskOnchain");
    const end = SRC.indexOf("export async function cancelAskOnchain");
    const openFn = SRC.slice(start, end);
    const queueIdx = openFn.indexOf("withOwnerKeyQueue");
    const gateIdx = openFn.lastIndexOf("chainBoundSendGate");
    assert.ok(queueIdx >= 0, "openAskOnchain must use withOwnerKeyQueue");
    assert.ok(gateIdx > queueIdx, "gate must run after the queue starts");
    assert.ok(
      openFn.indexOf("chainBoundSendGate") > queueIdx,
      "no pre-queue-only gate for openAsk",
    );
    const beforeQueue = openFn.slice(0, queueIdx);
    assert.equal(
      beforeQueue.includes("chainBoundSendGate"),
      false,
      "openAsk must not admit before the listing queue",
    );
  });

  it("in-queue waitReceipt always applies a timeout", () => {
    assert.ok(LISTING_RECEIPT_TIMEOUT_MS >= 30_000);
    assert.ok(LISTING_RECEIPT_TIMEOUT_MS <= 180_000);
    assert.match(SRC, /timeoutMs = LISTING_RECEIPT_TIMEOUT_MS/);
    assert.match(SRC, /timeout: timeoutMs/);
    const waitFn = SRC.slice(SRC.indexOf("async function waitReceipt"), SRC.indexOf("function cancelConfirmations"));
    assert.equal(waitFn.includes("timeoutMs != null"), false);
    assert.match(waitFn, /timeout: timeoutMs/);
  });

  it("replacePendingOpenAsk waits instead of fee-bumping a wait result", () => {
    const start = SRC.indexOf("export async function replacePendingOpenAsk");
    const end = SRC.indexOf("export async function openAskOnchain");
    const replaceFn = SRC.slice(start, end);
    assert.match(replaceFn, /resolved\.action === "wait"/);
    const waitIdx = replaceFn.indexOf('resolved.action === "wait"');
    const bumpIdx = replaceFn.indexOf("sendTransaction");
    assert.ok(waitIdx >= 0 && bumpIdx > waitIdx);
    const waitBlock = replaceFn.slice(waitIdx, bumpIdx);
    assert.match(waitBlock, /ok: false/);
    assert.equal(waitBlock.includes("sendTransaction"), false);
  });

  it("a later mined LISTING nonce does not clear a still-pending openAsk as neverOpened", async () => {
    resetOpenAskPendingForTests();
    const dir = mkdtempSync(join(tmpdir(), "open-ask-nonce-"));
    const store = new OpenAskPendingStore(join(dir, "open-ask-pending.json"));
    const hash = ("0x" + "ab".repeat(32)) as `0x${string}`;
    store.set({
      listingId: "7",
      sellerTokenId: "1",
      hash,
      nonce: "3",
      broadcastAt: new Date().toISOString(),
    });
    resetOpenAskPendingForTests();
    const resolved = await resolvePendingOpenAsk({
      listingId: "7",
      dataDir: dir,
      listingAddress: "0x1111111111111111111111111111111111111111",
      pub: {
        getTransactionReceipt: async () => {
          throw new Error("receipt not found");
        },
        getTransactionCount: async () => 9n,
      },
      readAsk: async () => ({ ok: true, ask: unusedAsk }),
    });
    assert.equal(resolved.action, "wait");
    resetOpenAskPendingForTests();
    const again = new OpenAskPendingStore(join(dir, "open-ask-pending.json"));
    assert.equal(again.has("7"), true, "pending row must stay until the original openAsk is found");
  });

  it("same-nonce mempool openAsk is pending, not neverOpened", async () => {
    resetOpenAskPendingForTests();
    const dir = mkdtempSync(join(tmpdir(), "open-ask-pending-"));
    const store = new OpenAskPendingStore(join(dir, "open-ask-pending.json"));
    store.set({
      listingId: "8",
      sellerTokenId: "1",
      hash: "0x" + "cd".repeat(32),
      nonce: "4",
      broadcastAt: new Date().toISOString(),
    });
    resetOpenAskPendingForTests();
    const resolved = await resolvePendingOpenAsk({
      listingId: "8",
      dataDir: dir,
      listingAddress: "0x1111111111111111111111111111111111111111",
      pub: {
        getTransactionReceipt: async () => {
          throw new Error("receipt not found");
        },
        getTransactionCount: async () => 4n,
      },
      readAsk: async () => ({ ok: true, ask: unusedAsk }),
    });
    assert.equal(resolved.action, "pending");
  });
});
