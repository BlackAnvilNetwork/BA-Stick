import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { findNewestOwnedToken, ownedScanLastId } from "./character-mint";

test("findNewestOwnedToken returns the newest id the owner still holds", async () => {
  const owners: Record<string, string> = {
    "3": "0x0c8f70df8a57b08c0f1a5f516b5277b8a1e9620b",
    "5": "0x0c8f70df8a57b08c0f1a5f516b5277b8a1e9620b",
    "4": "0x8f92aaee7705cd24967ebac10702f444a5b0978e",
  };
  const found = await findNewestOwnedToken({
    owner: "0x0c8F70DF8a57b08C0F1A5F516B5277b8a1e9620b",
    lastId: 5n,
    ownerOf: async (id) => {
      const held = owners[id.toString()];
      if (!held) throw new Error("missing");
      return held;
    },
  });
  assert.equal(found, "5");
});

test("findNewestOwnedToken skips missing ids and other owners", async () => {
  const found = await findNewestOwnedToken({
    owner: "0x0c8F70DF8a57b08C0F1A5F516B5277b8a1e9620b",
    lastId: 4n,
    ownerOf: async (id) => {
      if (id === 2n) return "0x0c8F70DF8a57b08C0F1A5F516B5277b8a1e9620b";
      throw new Error("missing");
    },
  });
  assert.equal(found, "2");
});

test("findNewestOwnedToken is empty when the wallet holds nothing", async () => {
  const found = await findNewestOwnedToken({
    owner: "0x0c8F70DF8a57b08C0F1A5F516B5277b8a1e9620b",
    lastId: 4n,
    ownerOf: async () => "0x8f92aaee7705cd24967ebac10702f444a5b0978e",
  });
  assert.equal(found, null);
});

test("ownedScanLastId prefers the higher of chain last id and suggested next id", () => {
  assert.equal(ownedScanLastId(5n, "6"), 6n);
  assert.equal(ownedScanLastId(5n, "4"), 5n);
  assert.equal(ownedScanLastId(0n, "5"), 5n);
  assert.equal(ownedScanLastId(5n), 5n);
});

test("mint reuse scans the session wallet and AppKit pays before injected", () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const mint = readFileSync(join(dir, "character-mint.ts"), "utf8");
  const wallet = readFileSync(join(dir, "wallet.ts"), "utf8");
  const kit = readFileSync(join(dir, "appkit-config.ts"), "utf8");
  assert.match(mint, /readPendingMint\(game, payer\)/);
  assert.match(mint, /ownedScanLastId\(chainLast, opts\.mint\.suggestedTokenId\)/);
  assert.match(mint, /owner: game,/);
  assert.doesNotMatch(mint, /lastId >= 1n && payer === game/);
  assert.match(wallet, /sessionFromRestoredAppKit\(/);
  assert.match(kit, /connectMethodsOrder: \["wallet"\]/);
  assert.match(kit, /enableWalletGuide: true/);
});
