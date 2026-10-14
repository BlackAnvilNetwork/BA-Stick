import assert from "node:assert/strict";
import test from "node:test";
import { buildLoadFleet } from "./load-fleet";

test("load fleet builds N distinct play-bot specs", () => {
  const fleet = buildLoadFleet(8);
  assert.equal(fleet.length, 8);
  assert.equal(new Set(fleet.map((bot) => bot.id)).size, 8);
  assert.equal(fleet[0]?.job, "sorcerer");
  assert.equal(fleet[5]?.job, "sorcerer");
  assert.throws(() => buildLoadFleet(0), /--bots/);
});
