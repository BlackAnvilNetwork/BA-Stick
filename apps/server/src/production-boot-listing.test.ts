import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertProductionEnvShape,
  gnosisListingSignerOk,
  PINNED_GNOSIS_LISTING_ADDRESS,
  PINNED_GNOSIS_LISTING_SAFE,
} from "./production-boot";

/** Official Listing Safe owner (docs/gnosis-launch.md ignition stack). */
const LISTING_OWNER = "0x18E23a52c3579fe8AA37Eb25b72F55EA32825174";

const chiadoShape = {
  LOK_CHAIN_ID: "10200",
  LOK_NFT: "0x" + "11".repeat(20),
  LOK_FACTORY: "0x" + "22".repeat(20),
  LOK_AH_ESCROW: "0x" + "33".repeat(20),
  LOK_LISTING_KEY: "0x" + "44".repeat(32),
  LOK_OPS_STATUS_TOKEN: "test-token",
  LOK_PVP_BOUNTY: "0x" + "55".repeat(20),
} as const;

const gnosisShape = {
  NETWORK: "gnosis",
  LOK_CHAIN_ID: "100",
  LOK_NFT: "0x" + "11".repeat(20),
  LOK_FACTORY: "0x" + "22".repeat(20),
  LOK_AH_ESCROW: "0x" + "33".repeat(20),
  LOK_CHAIN_RPC: "https://rpc.gnosischain.com",
  LOK_LISTING_KEY: "0x" + "44".repeat(32),
  LOK_LISTING_SAFE: PINNED_GNOSIS_LISTING_SAFE,
  LOK_OPS_STATUS_TOKEN: "test-token",
  LOK_PVP_BOUNTY: "0x" + "55".repeat(20),
} as const;

test("gnosisListingSignerOk refuses the abandoned EOA pin when LOK_LISTING_SAFE is unset", () => {
  const pinned = gnosisListingSignerOk({
    chainIsGnosis: true,
    keyAddress: PINNED_GNOSIS_LISTING_ADDRESS,
    keyHasListingRole: true,
    keyHasOperatorRole: true,
  });
  assert.equal(pinned.ok, false);
  if (!pinned.ok) assert.match(pinned.error, /LOK_LISTING_SAFE|abandoned EOA/);

  const stranger = gnosisListingSignerOk({
    chainIsGnosis: true,
    keyAddress: LISTING_OWNER,
    keyHasListingRole: false,
    keyHasOperatorRole: false,
  });
  assert.equal(stranger.ok, false);
});

test("a Listing Safe owner passes boot when the official Safe holds the roles", () => {
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

  const notOwner = gnosisListingSignerOk({
    chainIsGnosis: true,
    keyAddress: PINNED_GNOSIS_LISTING_ADDRESS,
    keyHasListingRole: true,
    keyHasOperatorRole: true,
    listingSafe: PINNED_GNOSIS_LISTING_SAFE,
    safeHasListingRole: true,
    safeHasOperatorRole: true,
    safeOwners: [LISTING_OWNER],
  });
  assert.equal(notOwner.ok, false);
});

test("assertProductionEnvShape requires LOK_LISTING_SAFE on Gnosis", () => {
  const missing = assertProductionEnvShape({
    ...gnosisShape,
    LOK_LISTING_SAFE: "",
  });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.match(missing.error, /LOK_LISTING_SAFE/);

  const wrong = assertProductionEnvShape({
    ...gnosisShape,
    LOK_LISTING_SAFE: "0x1111111111111111111111111111111111111111",
  });
  assert.equal(wrong.ok, false);
  if (!wrong.ok) assert.match(wrong.error, /pinned official Listing Safe/);

  const ok = assertProductionEnvShape(gnosisShape);
  assert.equal(ok.ok, true);
});

test("assertProductionEnvShape rejects a non-64-hex LOK_LISTING_KEY", () => {
  const garbage = assertProductionEnvShape({
    ...gnosisShape,
    LOK_LISTING_KEY: "not-a-key",
  });
  assert.equal(garbage.ok, false);
  if (!garbage.ok) assert.match(garbage.error, /64-hex/);

  const short = assertProductionEnvShape({
    ...chiadoShape,
    LOK_CHAIN_RPC: "https://rpc.chiado.gnosis.gateway.fm",
    LOK_LISTING_KEY: "0x" + "44".repeat(16),
  });
  assert.equal(short.ok, false);
  if (!short.ok) assert.match(short.error, /64-hex/);
});

test("assertProductionEnvShape accepts LOK_CHAIN_RPC_URLS without LOK_CHAIN_RPC", () => {
  const r = assertProductionEnvShape({
    ...chiadoShape,
    LOK_CHAIN_RPC_URLS: "https://rpc.chiado.gnosis.gateway.fm, https://gnosis-chiado-rpc.publicnode.com",
  });
  assert.equal(r.ok, true);
});
