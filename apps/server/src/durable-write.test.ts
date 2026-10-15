import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import test from "node:test";
import { join } from "node:path";
import { durableWrite } from "./durable-write";

test("durableWrite replaces file contents", () => {
  const dir = mkdtempSync(join(tmpdir(), "lok-durable-"));
  const path = join(dir, "nested", "out.json");
  durableWrite(path, '{"a":1}');
  durableWrite(path, '{"b":2}');
  assert.equal(readFileSync(path, "utf8"), '{"b":2}');
});

test("durableWrite retries EPERM and EBUSY on rename", () => {
  const dir = mkdtempSync(join(tmpdir(), "lok-durable-retry-"));
  const path = join(dir, "out.json");
  writeFileSync(path, "old");
  const codes = ["EPERM", "EBUSY"];
  let calls = 0;
  durableWrite(path, "new", {
    rename: (from, to) => {
      calls += 1;
      const code = codes.shift();
      if (code) {
        const err = new Error(code) as NodeJS.ErrnoException;
        err.code = code;
        throw err;
      }
      renameSync(from, to);
    },
  });
  assert.equal(calls, 3);
  assert.equal(readFileSync(path, "utf8"), "new");
});

test("durableWrite does not retry a non-rename error and leaves the previous file", () => {
  const dir = mkdtempSync(join(tmpdir(), "lok-durable-fail-"));
  const path = join(dir, "out.json");
  writeFileSync(path, "old");
  let calls = 0;
  assert.throws(() => {
    durableWrite(path, "new", {
      rename: () => {
        calls += 1;
        const err = new Error("io") as NodeJS.ErrnoException;
        err.code = "EIO";
        throw err;
      },
    });
  });
  assert.equal(calls, 1);
  assert.equal(readFileSync(path, "utf8"), "old");
});
