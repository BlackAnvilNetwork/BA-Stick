import assert from "node:assert/strict";
import test from "node:test";
import { guardedKekMove, withPlayerCharge } from "./kek-guard";

test("a second overlapping craft does not double-charge", async () => {
  let gold = 2000;
  let mats = 1;
  let items = 0;
  let charges = 0;
  const craft = () =>
    withPlayerCharge(
      "hero",
      () => mats >= 1,
      () => {
        if (mats < 1) return null;
        mats -= 1;
        return () => {
          mats += 1;
        };
      },
      async () => {
        await Promise.resolve();
        if (gold < 1000) return { ok: false as const, error: "short" };
        gold -= 1000;
        charges += 1;
        return { ok: true as const };
      },
      () => {
        items += 1;
      },
    );
  const [first, second] = await Promise.all([craft(), craft()]);
  assert.equal(items, 1);
  assert.equal(charges, 1);
  assert.equal(gold, 1000);
  assert.equal([first, second].filter((row) => row.ok).length, 1);
});

test("a second overlapping buy does not double-charge or learn twice", async () => {
  let gold = 1000;
  const learned: string[] = [];
  let charges = 0;
  const buy = () =>
    withPlayerCharge(
      "hero-buy",
      () => !learned.includes("fire"),
      () => {
        if (learned.includes("fire")) return null;
        learned.push("fire");
        return () => {
          learned.pop();
        };
      },
      async () => {
        await Promise.resolve();
        if (gold < 500) return { ok: false as const, error: "short" };
        gold -= 500;
        charges += 1;
        return { ok: true as const };
      },
      () => {
        if (!learned.includes("fire")) learned.push("fire");
      },
    );
  const [first, second] = await Promise.all([buy(), buy()]);
  assert.equal(learned.length, 1);
  assert.equal(learned[0], "fire");
  assert.equal(charges, 1);
  assert.equal(gold, 500);
  assert.equal([first, second].filter((row) => row.ok).length, 1);
});

test("a failed craft spend rolls the reserved materials back", async () => {
  let mats = 1;
  let gold = 1000;
  const result = await withPlayerCharge(
    "hero-undo",
    () => mats >= 1,
    () => {
      mats -= 1;
      return () => {
        mats += 1;
      };
    },
    async () => ({ ok: false as const, error: "short" }),
    () => {
      gold -= 1000;
    },
  );
  assert.equal(result.ok, false);
  assert.equal(mats, 1);
  assert.equal(gold, 1000);
});

test("guardedKekMove serializes two moves on the same token", async () => {
  let balance = 100;
  const order: number[] = [];
  const first = guardedKekMove("t1", async () => {
    await Promise.resolve();
    balance -= 40;
    order.push(1);
    return balance;
  });
  const second = guardedKekMove("t1", async () => {
    balance -= 25;
    order.push(2);
    return balance;
  });
  const [a, b] = await Promise.all([first, second]);
  assert.deepEqual(order, [1, 2]);
  assert.equal(a, 60);
  assert.equal(b, 35);
  assert.equal(balance, 35);
});
