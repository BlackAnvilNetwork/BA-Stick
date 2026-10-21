import assert from "node:assert/strict";
import { test } from "node:test";
import { chainFungibleId, chainUniqueId } from "./chain-ids";

/** Pinned in contracts/lok-log/test/Golden.t.sol for iron_ore / iron_sword#42. */
const GOLDEN_FUNGIBLE_ID =
  89658009947691115780873220689577698189678099276092329480841579491160997392175n;
const GOLDEN_UNIQUE_ID =
  16326979768789847505458237212507241523594462770995321419559994427250918491098n;

test("chainFungibleId matches ItemIds.fungible(iron_ore) golden", () => {
  assert.equal(chainFungibleId("iron_ore"), GOLDEN_FUNGIBLE_ID);
});

test("chainUniqueId matches ItemIds.unique(iron_sword, 42) golden", () => {
  assert.equal(chainUniqueId("iron_sword", 42), GOLDEN_UNIQUE_ID);
});

test("catalog kebab slugs are stable and distinct from underscore goldens", () => {
  const pale = chainFungibleId("pale-dust");
  const oreKebab = chainFungibleId("iron-ore");
  assert.notEqual(pale, oreKebab);
  assert.notEqual(oreKebab, GOLDEN_FUNGIBLE_ID);
  assert.equal(chainFungibleId("pale-dust"), pale);
});
