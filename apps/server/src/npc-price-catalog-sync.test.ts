/**
 * L4: keep Rust npc_price_data.rs in sync with the TS catalog formula.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { npcSellUnitGold } from "@bellgrave/items";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const rustPath = join(root, "contracts/lok-log/engine/src/npc_price_data.rs");

function parseRustPriceTable(src: string): Map<number, number> {
  const out = new Map<number, number>();
  const re = /^\s*\((\d+),\s*(\d+)\),?\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    out.set(Number(m[1]), Number(m[2]));
  }
  return out;
}

describe("npc price catalog sync (L4)", () => {
  it("npc_price_data.rs matches npcSellUnitGold for every catalog id", () => {
    const rust = parseRustPriceTable(readFileSync(rustPath, "utf8"));
    assert.ok(rust.size >= 100, "expected a full price table, got " + rust.size);

    const mismatches: string[] = [];
    const missingInTs: number[] = [];
    for (const [id, rustUnit] of rust) {
      const ts = npcSellUnitGold(id);
      if (ts == null) {
        missingInTs.push(id);
        continue;
      }
      if (ts !== rustUnit) {
        mismatches.push("id " + id + ": rust=" + rustUnit + " ts=" + ts);
      }
    }
    assert.equal(
      missingInTs.length,
      0,
      "catalog missing ids present in rust: " + missingInTs.slice(0, 10).join(", "),
    );
    assert.equal(
      mismatches.length,
      0,
      "price drift (regenerate with gen-npc-prices.mjs):\n" + mismatches.slice(0, 20).join("\n"),
    );
  });
});
