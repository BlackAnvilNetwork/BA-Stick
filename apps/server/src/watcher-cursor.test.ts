import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { readWatcherCursor, writeWatcherCursor } from "./watcher-cursor";

describe("watcher cursor binding", () => {
  it("accepts matching chainId + address", () => {
    const dir = mkdtempSync(join(tmpdir(), "lok-cur-"));
    const path = join(dir, "c.json");
    writeWatcherCursor({
      path,
      cursor: 99n,
      chainId: 100,
      address: "0xAbcDef0000000000000000000000000000000001",
    });
    assert.equal(
      readWatcherCursor({
        path,
        expectedChainId: 100,
        expectedAddress: "0xabcdef0000000000000000000000000000000001",
      }),
      99n,
    );
  });

  it("resets when chainId or address mismatches", () => {
    const dir = mkdtempSync(join(tmpdir(), "lok-cur-"));
    const path = join(dir, "c.json");
    writeWatcherCursor({
      path,
      cursor: 50n,
      chainId: 100,
      address: "0x1111111111111111111111111111111111111111",
    });
    const reasons: string[] = [];
    assert.equal(
      readWatcherCursor({
        path,
        expectedChainId: 10200,
        expectedAddress: "0x1111111111111111111111111111111111111111",
        onMismatch: (r) => reasons.push(r),
      }),
      0n,
    );
    assert.ok(reasons.some((r) => /chainId/.test(r)));

    assert.equal(
      readWatcherCursor({
        path,
        expectedChainId: 100,
        expectedAddress: "0x2222222222222222222222222222222222222222",
        onMismatch: (r) => reasons.push(r),
      }),
      0n,
    );
    assert.ok(reasons.some((r) => /address/.test(r)));
  });
});
