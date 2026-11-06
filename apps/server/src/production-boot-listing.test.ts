import assert from "node:assert/strict";
import { test } from "node:test";
import {
  gnosisListingSignerOk,
  PINNED_GNOSIS_LISTING_ADDRESS,
  PINNED_GNOSIS_LISTING_SAFE,
} from "./production-boot";

const LISTING_OWNER = "0x18E23a52c3579fe8AA37Eb25b72F55EA32825174";

test("a Listing Safe owner passes boot when the Safe holds the roles", () => {
  const pinned = gnosisListingSignerOk({
    chainIsGnosis: true,
    keyAddress: PINNED_GNOSIS_LISTING_ADDRESS,
    keyHasListingRole: true,
    keyHasOperatorRole: true,
  });
  assert.equal(pinned.ok, true);

  const stranger = gnosisListingSignerOk({
    chainIsGnosis: true,
    keyAddress: LISTING_OWNER,
    keyHasListingRole: false,
    keyHasOperatorRole: false,
  });
  assert.equal(stranger.ok, false);

  const owner = gnosisListingSignerOk({
    chainIsGnosis: true,
    keyAddress: LISTING_OWNER,
    keyHasListingRole: false,
    keyHasOperatorRole: false,
    listingSafe: PINNED_GNOSIS_LISTING_SAFE,
    safeHasListingRole: true,
    safeHasOperatorRole: true,
    safeOwners: [LISTING_OWNER],
  });
  assert.equal(owner.ok, true);

  const wrongSafe = gnosisListingSignerOk({
    chainIsGnosis: true,
    keyAddress: LISTING_OWNER,
    keyHasListingRole: false,
    keyHasOperatorRole: false,
    listingSafe: "0x1111111111111111111111111111111111111111",
    safeHasListingRole: true,
    safeHasOperatorRole: true,
    safeOwners: [LISTING_OWNER],
  });
  assert.equal(wrongSafe.ok, false);
});
