import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  NO_WORLD_COPY,
  assessWorldBoot,
  directoryHasJournal,
  expectedWorldIdentity,
  journalCoversIssuedTokens,
  mayAdoptOwnedToken,
  worldGenesisHash,
} from "./world-identity";

const NFT = "0x6165040e7fe20ae5aac935898b9712818a3491cd";
const OTHER = "0x48afec17a56c5bd32abdbcad57f16d3859b1289f";

describe("world identity", () => {
  it("a different contract is a different world", () => {
    assert.notEqual(worldGenesisHash(100, NFT), worldGenesisHash(100, OTHER));
    assert.notEqual(worldGenesisHash(100, NFT), worldGenesisHash(31337, NFT));
  });

  it("an empty directory refuses to spawn, adopt, or tick when the contract already has a world", () => {
    const boot = assessWorldBoot({
      onDisk: null,
      journalEmpty: true,
      chainId: 100,
      nft: NFT,
      chainWorldExists: true,
    });
    assert.equal(boot.ok, false);
    assert.equal(boot.spawn, false);
    assert.equal(boot.adopt, false);
    assert.equal(boot.tick, false);
    assert.equal(boot.loginError, NO_WORLD_COPY);
    assert.equal(boot.writeIdentity, null);
  });

  it("an empty directory may be genesis only when this contract has no world", () => {
    const boot = assessWorldBoot({
      onDisk: null,
      journalEmpty: true,
      chainId: 100,
      nft: NFT,
      chainWorldExists: false,
    });
    assert.equal(boot.ok, true);
    assert.equal(boot.tick, true);
    assert.equal(boot.stampLegacy, false);
    assert.equal(boot.writeIdentity?.genesisHash, worldGenesisHash(100, NFT));
    assert.equal(boot.writeIdentity?.nft, NFT);
  });

  it("refuses a directory whose identity is another contract", () => {
    const boot = assessWorldBoot({
      onDisk: expectedWorldIdentity(100, OTHER),
      journalEmpty: false,
      chainId: 100,
      nft: NFT,
      chainWorldExists: true,
    });
    assert.equal(boot.ok, false);
    assert.equal(boot.spawn, false);
    assert.equal(boot.adopt, false);
    assert.equal(boot.tick, false);
    assert.match(boot.loginError, /Refusing to run/);
  });

  it("stamps a legacy journal instead of calling it genesis", () => {
    const boot = assessWorldBoot({
      onDisk: null,
      journalEmpty: false,
      chainId: 100,
      nft: NFT,
      chainWorldExists: true,
    });
    assert.equal(boot.ok, true);
    assert.equal(boot.stampLegacy, true);
    assert.equal(boot.writeIdentity?.genesisHash, expectedWorldIdentity(100, NFT).genesisHash);
  });

  it("adoption never spawns a token the journal or bind already has, or any token when behind", () => {
    const journal = new Set(["3"]);
    const bind = new Set(["4"]);
    assert.equal(mayAdoptOwnedToken({ tokenId: "3", journalTokenIds: journal, bindTokenIds: bind, caughtUp: true }), false);
    assert.equal(mayAdoptOwnedToken({ tokenId: "4", journalTokenIds: journal, bindTokenIds: bind, caughtUp: true }), false);
    assert.equal(mayAdoptOwnedToken({ tokenId: "5", journalTokenIds: journal, bindTokenIds: bind, caughtUp: false }), false);
    assert.equal(mayAdoptOwnedToken({ tokenId: "5", journalTokenIds: journal, bindTokenIds: new Set(), caughtUp: true }), false);
  });

  it("a gap below the chain head means the journal is not caught up", () => {
    assert.equal(journalCoversIssuedTokens(new Set(["1", "2", "3"]), 3n), true);
    assert.equal(journalCoversIssuedTokens(new Set(["1", "2"]), 5n), false);
    assert.equal(journalCoversIssuedTokens(new Set(), 0n), true);
    assert.equal(journalCoversIssuedTokens(new Set(), 1n), false);
  });

  it("directoryHasJournal sees a journal line and an empty dir", () => {
    const dir = mkdtempSync(join(tmpdir(), "lok-world-"));
    assert.equal(directoryHasJournal(dir), false);
    writeFileSync(join(dir, "lok-world.jsonl"), "{\"seq\":1,\"cmd\":{\"op\":\"spawn\"}}\n");
    assert.equal(directoryHasJournal(dir), true);
  });
});
