import assert from "node:assert/strict";
import { afterEach, before, test } from "node:test";
import {
  UI_SETTINGS_KEY,
  applyUiSettings,
  layoutUsesArcadeControls,
  loadUiSettings,
  persistAndApplyUiSettings,
  readAppliedUiLayout,
  saveUiSettings,
  type UiSettings,
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
  (document.documentElement.dataset as Record<string, string>).uiColor = "";
  (document.documentElement.dataset as Record<string, string>).uiFont = "";
});

test("loadUiSettings defaults layout to regular", () => {
  const s = loadUiSettings();
  assert.equal(s.layout, "regular");
  assert.equal(s.color, "gold");
});

test("loadUiSettings accepts mobile layout and rejects junk", () => {
  saveUiSettings({ color: "gold", font: "cinzel", layout: "mobile", view: "iso", pixel: "crisp" });
  assert.equal(loadUiSettings().layout, "mobile");
  localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify({ layout: "tablet", color: "gold" }));
  const s = loadUiSettings();
  assert.equal(s.layout, "regular");
  assert.equal(s.color, "gold");
});

test("applyUiSettings sets data-ui-layout", () => {
  const next: UiSettings = { color: "ember", font: "verdana", layout: "mobile", view: "iso", pixel: "crisp" };
  applyUiSettings(next);
  assert.equal(document.documentElement.dataset.uiLayout, "mobile");
  assert.equal(document.documentElement.dataset.uiColor, "ember");
});

test("persistAndApply keeps Mobile layout for non-touch / remount", () => {
  persistAndApplyUiSettings({ color: "cyan", font: "source", layout: "mobile", view: "iso", pixel: "crisp" });
  assert.equal(layoutUsesArcadeControls(loadUiSettings().layout), true);
  assert.equal(readAppliedUiLayout(), "mobile");
  // Switching away then back must not drop persistence.
  persistAndApplyUiSettings({ color: "cyan", font: "source", layout: "regular", view: "iso", pixel: "crisp" });
  assert.equal(readAppliedUiLayout(), "regular");
  persistAndApplyUiSettings({ color: "cyan", font: "source", layout: "mobile", view: "iso", pixel: "crisp" });
  assert.equal(loadUiSettings().layout, "mobile");
  assert.equal(readAppliedUiLayout(), "mobile");
});

test("view and pixel default and persist", () => {
  localStorage.removeItem(UI_SETTINGS_KEY);
  assert.equal(loadUiSettings().view, "iso");
  assert.equal(loadUiSettings().pixel, "crisp");
  persistAndApplyUiSettings({ ...loadUiSettings(), view: "3d", pixel: "smooth" });
  assert.equal(loadUiSettings().view, "3d");
  assert.equal(document.documentElement.dataset.uiView, "3d");
  assert.equal(document.documentElement.dataset.uiPixel, "smooth");
});

test("minimap defaults on, toggles, and persists", async () => {
  const { toggleMinimap } = await import("./uiSettings");
  assert.equal(loadUiSettings().minimap, true);
  assert.equal(toggleMinimap().minimap, false);
  assert.equal(loadUiSettings().minimap, false);
  assert.equal((document.documentElement.dataset as Record<string, string>).uiMinimap, "off");
  assert.equal(toggleMinimap().minimap, true);
  assert.equal(JSON.parse(store.get(UI_SETTINGS_KEY)!).minimap, true);
});
