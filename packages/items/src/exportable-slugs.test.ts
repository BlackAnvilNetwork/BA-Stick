import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chainFungibleId } from "./chain-ids";
import {
  ALL_BASE_SLUGS,
  EXPORTABLE_BASE_SLUGS,
  LIVE_BASE_SLUGS,
  catalogIdToChainFungibleId,
  exportableFungibles,
  isLaunchExportableEquipment,
  isLaunchExportableFungible,
  itemsSeedSlugsCsv,
} from "./exportable-slugs";
import { CATALOG_BY_ID, CATALOG_BY_SLUG } from "./catalog.generated";

describe("exportable slugs", () => {
  it("launch seed is the 24 Pale Hollow live bases (incl. desiccated-hide)", () => {
    assert.equal(LIVE_BASE_SLUGS.length, 24);
    assert.equal(EXPORTABLE_BASE_SLUGS, LIVE_BASE_SLUGS);
    assert.ok(LIVE_BASE_SLUGS.includes("pale-dust"));
    assert.ok(LIVE_BASE_SLUGS.includes("desiccated-hide"));
    assert.ok(!LIVE_BASE_SLUGS.includes("iron-ore"));
    assert.ok(ALL_BASE_SLUGS.includes("iron-ore"));
    assert.ok(ALL_BASE_SLUGS.length > LIVE_BASE_SLUGS.length);
    for (const slug of LIVE_BASE_SLUGS) {
      assert.equal(CATALOG_BY_SLUG[slug]?.kind, "base");
    }
  });

  it("itemsSeedSlugsCsv is forge-ready live seed", () => {
    const csv = itemsSeedSlugsCsv();
    assert.ok(csv.startsWith("antidote-root,"));
    assert.ok(csv.includes("desiccated-hide"));
    assert.ok(csv.includes("pale-dust"));
    assert.ok(!csv.includes("iron-ore"));
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

  it("launch export policy: live bases yes, equipment no", () => {
    const dust = CATALOG_BY_SLUG["pale-dust"]!.id;
    const staff = CATALOG_BY_SLUG["ashbeam-staff"]!.id;
    assert.equal(isLaunchExportableFungible(dust), true);
    assert.equal(isLaunchExportableFungible(staff), false);
    assert.equal(isLaunchExportableEquipment(staff), false);
    assert.equal(CATALOG_BY_ID[1063]?.slug, "heart-ring");
  });
});
