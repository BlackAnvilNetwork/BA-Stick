import assert from "node:assert/strict";
import { test } from "node:test";
import {
  collectOwnedCharacterNfts,
  isAutoTokenSuffixedName,
  ownedNftBindName,
  ownedNftScanLastId,
  pickUnboundOwnedNfts,
} from "./owned-nfts";

const OWNER = "0x0c8f70df8a57b08c0f1a5f516b5277b8a1e9620b";

test("ownedNftScanLastId covers last minted and suggested next", () => {
  assert.equal(ownedNftScanLastId(5n, "6"), 6n);
  assert.equal(ownedNftScanLastId(5n), 5n);
  assert.equal(ownedNftScanLastId(0n, "5"), 5n);
});

test("collectOwnedCharacterNfts returns this wallet's tokens oldest-first", async () => {
  const owners: Record<string, string> = {
    "3": OWNER,
    "5": OWNER,
    "4": "0x8f92aaee7705cd24967ebac10702f444a5b0978e",
  };
  const found = await collectOwnedCharacterNfts({
    owner: "0x0c8F70DF8a57b08C0F1A5F516B5277b8a1e9620b",
    lastId: 5n,
    ownerOf: async (id) => {
      const held = owners[id.toString()];
      if (!held) throw new Error("missing");
      return held;
    },
    summary: async (id) => {
      if (id === 5n) return (7n << 16n) | 1n;
      if (id === 3n) return (1n << 16n) | 4n;
      return 0n;
    },
  });
  assert.deepEqual(found, [
    { tokenId: "3", job: 1, level: 4 },
    { tokenId: "5", job: 7, level: 1 },
  ]);
});

test("pickUnboundOwnedNfts drops tokens already on the log", () => {
  const owned = [
    { tokenId: "4", job: 0, level: 1 },
    { tokenId: "5", job: 7, level: 1 },
  ];
  assert.deepEqual(pickUnboundOwnedNfts(owned, new Set(["4"])), [
    { tokenId: "5", job: 7, level: 1 },
  ]);
});

test("ownedNftBindName uses the job name and never the token id", () => {
  assert.equal(ownedNftBindName("Druid", () => false), "Druid");
  assert.equal(
    ownedNftBindName("Druid", (name) => name === "Druid"),
    "New Druid",
  );
  assert.equal(isAutoTokenSuffixedName("Druid 5", "Druid", "5"), true);
  assert.equal(isAutoTokenSuffixedName("Druid", "Druid", "5"), false);
});
