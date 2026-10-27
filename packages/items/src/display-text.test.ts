import assert from "node:assert/strict";
import { test } from "node:test";
import { CATALOG } from "./catalog.generated";

const LEGACY = /\b(kek|bellgrave|coldhearth|legend of kek)\b/i;
const BANNED = /\b(ledgers?|crypto\w*|blockchain\w*|networks?|nodes?|tokens?|wallets?|consensus|immutab\w*|on-chain)\b/i;
// "chain" is only allowed as a physical chain (Mythril Chain, chainmail, chainstair).
const CHAIN = /chain(?!stair|mail)/i;
const CHAIN_OK = /^Mythril Chain\b/;

test("item names and descriptions carry no legacy or crypto wording", () => {
  for (const item of CATALOG) {
    for (const line of [item.name, item.description ?? ""]) {
      assert.doesNotMatch(line, LEGACY, `${item.id}: ${line}`);
      assert.doesNotMatch(line, BANNED, `${item.id}: ${line}`);
      if (!CHAIN_OK.test(line)) assert.doesNotMatch(line, CHAIN, `${item.id}: ${line}`);
    }
  }
});

