import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "index.ts"), "utf8");
const client = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../stick-web/src/StickWorld.tsx"),
  "utf8",
);

test("assignRoute and click-to-move stand you up on the move, not the next tick", () => {
  assert.match(src, /function interruptRestForMove\(p: Player\)/);
  assert.match(src, /function assignRoute\(p: Player, x: number, z: number\) \{\s*interruptRestForMove\(p\);/s);
  assert.match(src, /p\.lastMoveInputAt = t;\s*interruptRestForMove\(p\);\s*assignRoute\(p, msg\.x, msg\.z\);/s);
  assert.match(src, /if \(Math\.hypot\(straight\.x - gx, straight\.z - gz\) < 0\.45\) \{\s*interruptRestForMove\(p\);\s*p\.moveTo = straight;/s);
  assert.match(
    src.slice(src.indexOf("function interruptRestForMove"), src.indexOf("function downPlayer")),
    /send\(p\.ws, snapshotFor\(p\)\);/,
  );
  assert.match(client, /keys: "click"/);
  assert.match(client, /lastWasd\.keys !== "click"/);
});
