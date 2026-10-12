import assert from "node:assert/strict";
import test from "node:test";
import { ownerKeyQueueTail, withOwnerKeyQueue } from "./owner-tx-queue";

test("withOwnerKeyQueue serializes concurrent work for one key", async () => {
  const order: number[] = [];
  let gate!: () => void;
  const held = new Promise<void>((resolve) => {
    gate = resolve;
  });

  const first = withOwnerKeyQueue(async () => {
    order.push(1);
    await held;
    order.push(2);
    return "a";
  });
  const second = withOwnerKeyQueue(async () => {
    order.push(3);
    return "b";
  });

  // Second must not run until first releases the queue.
  await Promise.resolve();
  assert.deepEqual(order, [1]);
  gate();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(a, "a");
  assert.equal(b, "b");
  assert.deepEqual(order, [1, 2, 3]);
  await ownerKeyQueueTail();
});
