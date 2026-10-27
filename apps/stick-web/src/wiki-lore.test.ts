import { test } from "node:test";
import assert from "node:assert/strict";
import { LORE_PAGES } from "./wiki-lore";

const text = LORE_PAGES.flatMap((p) => [p.title, ...p.lines]).join("\n");

test("lore has no slugs or legacy names", () => {
  assert.doesNotMatch(text, /KEK|Bellgrave|[a-z]+_[a-z]+|\bf\d\d\b/);
});

test("lore keeps spoilers out", () => {
  for (const w of ["Hesk", "Revision", "Correction", "Claimant", "Cultist", "Carried Marks", "Seven-Stone", "Anvilhold", "Seat-Keeper", "guild"]) {
    assert.ok(!text.includes(w), w);
  }
});

test("lore has no ledger, crypto or bookkeeping vocabulary", () => {
  const banned = /\b(ledgers?|crypto\w*|block\w*|networks?|nodes?|tokens?|wallets?|mint\w*|validat\w*|consensus|immutab\w*|ink\w*|scriptorium|scriveners?)\b/i;
  const chain = /chain(?!stair|mail)/i;
  for (const line of text.split("\n")) {
    assert.doesNotMatch(line, banned, line);
    assert.doesNotMatch(line, chain, line);
  }
});
