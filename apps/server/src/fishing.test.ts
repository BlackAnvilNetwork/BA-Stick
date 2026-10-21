import assert from "node:assert/strict";
import test from "node:test";
import { CATALOG_BY_SLUG } from "@bellgrave/items";
import { cheapestBait, fishGatherRefusal, isFishingRod } from "./fishing";

const rod = CATALOG_BY_SLUG["ashbeam-fishing-rod"]!.id;
const staff = CATALOG_BY_SLUG["sovereigns-staff"]!.id;
const pale = CATALOG_BY_SLUG["pale-bait"]!.id;
const minnow = CATALOG_BY_SLUG["minnow-bait"]!.id;

test("a fishing rod is main-hand gear whose slug ends in -fishing-rod", () => {
  assert.equal(isFishingRod(rod), true);
  assert.equal(isFishingRod(staff), false);
  assert.equal(isFishingRod(null), false);
  assert.equal(isFishingRod(pale), false);
});

test("fish nodes require a rod and spend the cheapest bait", () => {
  assert.equal(fishGatherRefusal("harvest", null, []), null);
  assert.equal(fishGatherRefusal("fish", staff, [{ tokenId: pale, amount: 2 }]), "Equip a fishing rod to fish.");
  assert.equal(fishGatherRefusal("fish", rod, []), "You need bait to fish.");
  assert.equal(fishGatherRefusal("fish", rod, [{ tokenId: pale, amount: 0 }]), "You need bait to fish.");
  assert.equal(fishGatherRefusal("fish", rod, [{ tokenId: pale, amount: 1 }]), null);

  const pick = cheapestBait([
    { tokenId: minnow, amount: 4 },
    { tokenId: pale, amount: 1 },
  ]);
  assert.equal(pick?.tokenId, pale);
  assert.equal(pick?.label, "Pale Bait");
});
