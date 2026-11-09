import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { dryRunGenesis } from "./genesis-dry-run";
import { LokWorld } from "./lok-world";

test("a dry run replays a copy and does not require the source to stay writable", () => {
  const source = mkdtempSync(join(tmpdir(), "lok-genesis-src-"));
  const copy = mkdtempSync(join(tmpdir(), "lok-genesis-copy-"));
  const world = LokWorld.open(source);
  const spawned = world.ensureMintedSpawn("3", 4, "0x1111111111111111111111111111111111111111");
  assert.equal(spawned.ok, true);
  const report = dryRunGenesis(source, copy);
  assert.equal(report.entries >= 1, true);
  assert.equal(report.merkleRoot.startsWith("0x"), true);
  assert.equal(report.publishedRoot.startsWith("0x"), true);
  assert.notEqual(report.publishedRoot, report.merkleRoot);
  assert.equal(report.copyDir, copy);
});
