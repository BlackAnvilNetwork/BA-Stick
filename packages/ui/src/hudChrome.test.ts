import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { chromeDockStyle } from "./hudChrome";

test("overlay hamburger at the top drops the Commands dock below the button", () => {
  const style = chromeDockStyle({ top: 6, right: 382, bottom: 34 }, { width: 390, height: 844 });
  assert.equal(style.bottom, "auto");
  assert.match(style.top, /^4[0-9]px$/);
  assert.ok(Number.parseFloat(style.maxHeight) < 844);
  assert.ok(Number.parseFloat(style.maxHeight) > 700);
});

test("desktop hotbar hamburger still pops the dock above the button", () => {
  const style = chromeDockStyle({ top: 480, right: 1000, bottom: 522 }, { width: 1024, height: 533 });
  assert.equal(style.top, "auto");
  assert.ok(Number.parseFloat(style.bottom) > 8);
});

test("dock right is clamped into the visualViewport", () => {
  const style = chromeDockStyle(
    { top: 8, right: 400, bottom: 36 },
    { width: 390, height: 844, offsetLeft: 0, offsetTop: 0 },
    196,
  );
  const right = Number.parseFloat(style.right);
  assert.ok(right >= 8);
  assert.ok(right + 196 <= 390);
});

test("Hud places the Commands dock with chromeDockStyle and visualViewport", () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "Hud.tsx"), "utf8");
  assert.match(src, /chromeDockStyle/);
  assert.match(src, /readChromeViewport/);
  assert.match(src, /visualViewport/);
  assert.doesNotMatch(src, /innerHeight - b\.top \+ 10/);
});
