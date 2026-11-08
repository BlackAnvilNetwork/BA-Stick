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
  saveUiSettings({ color: "gold", font: "cinzel", layout: "mobile", view: "iso", cam: "numpad", pixel: "crisp", minimap: true, drawDistance: 0.55, atmosphere: 0.45 });
  assert.equal(loadUiSettings().layout, "mobile");
  localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify({ layout: "tablet", color: "gold" }));
  const s = loadUiSettings();
  assert.equal(s.layout, "regular");
  assert.equal(s.color, "gold");
});

test("applyUiSettings sets data-ui-layout", () => {
  const next: UiSettings = { color: "ember", font: "verdana", layout: "mobile", view: "iso", cam: "numpad", pixel: "crisp", minimap: true, drawDistance: 0.55, atmosphere: 0.45 };
  applyUiSettings(next);
  assert.equal(document.documentElement.dataset.uiLayout, "mobile");
  assert.equal(document.documentElement.dataset.uiColor, "ember");
});

test("persistAndApply keeps Mobile layout for non-touch / remount", () => {
  persistAndApplyUiSettings({ color: "cyan", font: "source", layout: "mobile", view: "iso", cam: "numpad", pixel: "crisp", minimap: true, drawDistance: 0.55, atmosphere: 0.45 });
  assert.equal(layoutUsesArcadeControls(loadUiSettings().layout), true);
  assert.equal(readAppliedUiLayout(), "mobile");
  // Switching away then back must not drop persistence.
  persistAndApplyUiSettings({ color: "cyan", font: "source", layout: "regular", view: "iso", cam: "numpad", pixel: "crisp", minimap: true, drawDistance: 0.55, atmosphere: 0.45 });
  assert.equal(readAppliedUiLayout(), "regular");
  persistAndApplyUiSettings({ color: "cyan", font: "source", layout: "mobile", view: "iso", cam: "numpad", pixel: "crisp", minimap: true, drawDistance: 0.55, atmosphere: 0.45 });
  assert.equal(loadUiSettings().layout, "mobile");
  assert.equal(readAppliedUiLayout(), "mobile");
});

test("view and pixel default and persist", () => {
  localStorage.removeItem(UI_SETTINGS_KEY);
  assert.equal(loadUiSettings().view, "iso");
  assert.equal(loadUiSettings().pixel, "crisp");
  persistAndApplyUiSettings({ ...loadUiSettings(), view: "tp", pixel: "smooth" });
  assert.equal(loadUiSettings().view, "tp");
  assert.equal(document.documentElement.dataset.uiView, "tp");
  assert.equal(document.documentElement.dataset.uiCam, "numpad");
  assert.equal(document.documentElement.dataset.uiPixel, "smooth");
  localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify({ view: "3d", cam: "mouse" }));
  assert.equal(loadUiSettings().view, "tp");
  assert.equal(loadUiSettings().cam, "mouse");
});

test("camera cycles iso, third, first and does not use the minimap key", async () => {
  const { cycleView, toggleCamControl } = await import("./uiSettings");
  assert.equal(loadUiSettings().view, "iso");
  assert.equal(loadUiSettings().cam, "numpad");
  assert.equal(cycleView().view, "tp");
  assert.equal(cycleView().view, "fp");
  assert.equal(cycleView().view, "iso");
  assert.equal(toggleCamControl().cam, "mouse");
  assert.equal(loadUiSettings().minimap, true);
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

test("draw distance and atmosphere default, persist, and match presets", async () => {
  const { matchVistaPreset, VISTA_PRESETS, clampUnit } = await import("./uiSettings");
  localStorage.removeItem(UI_SETTINGS_KEY);
  assert.equal(loadUiSettings().drawDistance, 0.55);
  assert.equal(loadUiSettings().atmosphere, 0.45);
  assert.equal(matchVistaPreset(loadUiSettings()), "default");
  persistAndApplyUiSettings({ ...loadUiSettings(), drawDistance: 1, atmosphere: 0.18 });
  assert.equal(loadUiSettings().drawDistance, 1);
  assert.equal(loadUiSettings().atmosphere, 0.18);
  assert.equal(matchVistaPreset(loadUiSettings()), "clear");
  assert.equal(document.documentElement.dataset.uiDrawDistance, "1");
  persistAndApplyUiSettings({ ...loadUiSettings(), atmosphere: 0.5 });
  assert.equal(matchVistaPreset(loadUiSettings()), "custom");
  const classic = VISTA_PRESETS.find((p) => p.id === "classic")!;
  persistAndApplyUiSettings({ ...loadUiSettings(), drawDistance: classic.drawDistance, atmosphere: classic.atmosphere });
  assert.equal(matchVistaPreset(loadUiSettings()), "classic");
  assert.equal(clampUnit(2, 0.45), 1);
  assert.equal(clampUnit(-1, 0.45), 0);
  localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify({ color: "gold" }));
  assert.equal(loadUiSettings().drawDistance, 0.55);
  assert.equal(loadUiSettings().atmosphere, 0.45);
});

test("vista presets wrap with short labels and phone haze copy exists", async () => {
  const { VISTA_PRESETS, PHONE_HAZE_COPY, vistaReach, pointerIsCoarse } = await import("./uiSettings");
  assert.equal(VISTA_PRESETS[0].label, "Classic");
  assert.equal(VISTA_PRESETS[2].label, "Clear");
  assert.match(PHONE_HAZE_COPY, /Haze is off/);
  assert.equal(vistaReach(0.55).far, 60);
  assert.equal(vistaReach(0.55).isoProp, 56);
  assert.equal(typeof pointerIsCoarse(), "boolean");
});
