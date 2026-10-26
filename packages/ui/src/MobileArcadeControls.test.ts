import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, before, test } from "node:test";
import { MobileArcadeControls } from "./MobileArcadeControls";
import {
  UI_SETTINGS_KEY,
  applyUiSettings,
  layoutUsesArcadeControls,
  loadUiSettings,
  persistAndApplyUiSettings,
  readAppliedUiLayout,
} from "./uiSettings";

const store = new Map<string, string>();

before(() => {
  const localStorageMock = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: localStorageMock,
    configurable: true,
  });
  const root = { dataset: {} as Record<string, string>, style: { setProperty() {} } };
  Object.defineProperty(globalThis, "document", {
    value: { documentElement: root },
    configurable: true,
  });
});

afterEach(() => {
  store.clear();
  (document.documentElement.dataset as Record<string, string>).uiLayout = "";
});

test("layoutUsesArcadeControls is true only for mobile", () => {
  assert.equal(layoutUsesArcadeControls("mobile"), true);
  assert.equal(layoutUsesArcadeControls("regular"), false);
});

test("Mobile layout persists and stays applied after reload", () => {
  persistAndApplyUiSettings({ color: "cyan", font: "source", layout: "mobile", view: "iso", cam: "numpad", pixel: "crisp", minimap: true });
  assert.equal(loadUiSettings().layout, "mobile");
  assert.equal(document.documentElement.dataset.uiLayout, "mobile");
  assert.equal(readAppliedUiLayout(), "mobile");
  // Simulate a remount reading storage again (desktop refresh / Hud re-enter play).
  applyUiSettings(loadUiSettings());
  assert.equal(readAppliedUiLayout(), "mobile");
  assert.equal(layoutUsesArcadeControls(readAppliedUiLayout()), true);
  assert.ok(localStorage.getItem(UI_SETTINGS_KEY)?.includes('"layout":"mobile"'));
});

test("MobileArcadeControls markup stays mounted (visible shell for desktop)", () => {
  const html = renderToStaticMarkup(
    createElement(MobileArcadeControls, {
      potions: 2,
      onCastSlot: () => {},
      onCastRest: () => {},
      onPotion: () => {},
    }),
  );
  assert.match(html, /data-arcade-controls="1"/);
  assert.match(html, /data-arcade-stick="move"/);
  assert.match(html, /data-arcade-stick="action"/);
  assert.match(html, /aria-label="Mobile arcade controls"/);
  assert.match(html, /arcade-face-cluster/);
  // Face keys 1–8 + R + Q present
  for (const n of ["1", "2", "3", "4", "5", "6", "7", "8"]) {
    assert.match(html, new RegExp(`>${n}<`));
  }
  assert.match(html, />R</);
  assert.match(html, />Q</);
});
