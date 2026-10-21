import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeTextAtomic } from "./lok-vault";

test("writeTextAtomic replaces file contents atomically", () => {
  const dir = mkdtempSync(join(tmpdir(), "lok-write-"));
  const path = join(dir, "out.json");
  writeTextAtomic(path, '{"a":1}');
  writeTextAtomic(path, '{"b":2}');
  assert.equal(readFileSync(path, "utf8"), '{"b":2}');
});
