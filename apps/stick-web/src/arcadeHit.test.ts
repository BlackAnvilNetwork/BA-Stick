import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { clearVirtualStick, markVirtualStickReleased, setVirtualStickCaptured } from "@bellgrave/ui/moveInput";
import { arcadeBlocksGroundClick } from "./arcadeHit";

afterEach(() => {
  clearVirtualStick();
});

test("captured analog blocks a canvas ground click", () => {
  setVirtualStickCaptured(true);
  assert.equal(arcadeBlocksGroundClick(200, 200), true);
});

test("just-released analog still blocks the follow-up canvas pointerdown", () => {
  markVirtualStickReleased();
  assert.equal(arcadeBlocksGroundClick(200, 200), true);
});

test("open center is not blocked when analog is idle", () => {
  const prev = globalThis.document;
  Object.defineProperty(globalThis, "document", {
    value: { querySelector: () => null },
    configurable: true,
  });
  try {
    assert.equal(arcadeBlocksGroundClick(200, 200), false);
  } finally {
    if (prev === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (globalThis as { document?: unknown }).document;
    } else {
      Object.defineProperty(globalThis, "document", { value: prev, configurable: true });
    }
  }
});

test("arcade overlay left-thumb park blocks a missed stick tap", () => {
  const prevDoc = globalThis.document;
  const prevWin = globalThis.window;
  Object.defineProperty(globalThis, "document", {
    value: { querySelector: (sel: string) => (sel === "[data-arcade-overlay]" ? {} : null) },
    configurable: true,
  });
  Object.defineProperty(globalThis, "window", {
    value: { innerWidth: 390, innerHeight: 844 },
    configurable: true,
  });
  try {
    assert.equal(arcadeBlocksGroundClick(40, 700), true);
    assert.equal(arcadeBlocksGroundClick(200, 200), false);
  } finally {
    if (prevDoc === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (globalThis as { document?: unknown }).document;
    } else {
      Object.defineProperty(globalThis, "document", { value: prevDoc, configurable: true });
    }
    if (prevWin === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (globalThis as { window?: unknown }).window;
    } else {
      Object.defineProperty(globalThis, "window", { value: prevWin, configurable: true });
    }
  }
});
