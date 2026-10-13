import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chainFungibleId } from "./chain-ids";
import {
  EXPORTABLE_BASE_SLUGS,
  catalogIdToChainFungibleId,
  exportableFungibles,
  itemsSeedSlugsCsv,
} from "./exportable-slugs";
import { CATALOG_BY_SLUG } from "./catalog.generated";

describe("exportable slugs", () => {
  it("lists every kind=base catalog slug once", () => {
    assert.ok(EXPORTABLE_BASE_SLUGS.length >= 60);
    assert.ok(EXPORTABLE_BASE_SLUGS.includes("pale-dust"));
    assert.ok(EXPORTABLE_BASE_SLUGS.includes("iron-ore"));
    assert.equal(new Set(EXPORTABLE_BASE_SLUGS).size, EXPORTABLE_BASE_SLUGS.length);
    for (const slug of EXPORTABLE_BASE_SLUGS) {
      assert.equal(CATALOG_BY_SLUG[slug]?.kind, "base");
    }
  });

  it("itemsSeedSlugsCsv is forge-ready", () => {
    const csv = itemsSeedSlugsCsv();
    assert.ok(csv.startsWith("ancient-branch,"));
    assert.ok(csv.includes("pale-dust"));
    assert.ok(!csv.includes(" "));
  });

  it("exportableFungibles matches chainFungibleId", () => {
    const row = exportableFungibles(["pale-dust"])[0]!;
    assert.equal(row.chainId, chainFungibleId("pale-dust"));
    assert.ok(row.chainIdHex.startsWith("0x"));
  });

  it("catalogIdToChainFungibleId maps pale-dust catalog row", () => {
    const id = CATALOG_BY_SLUG["pale-dust"]!.id;
    assert.equal(catalogIdToChainFungibleId(id), chainFungibleId("pale-dust"));
    assert.equal(catalogIdToChainFungibleId(-1), null);
  });
});
