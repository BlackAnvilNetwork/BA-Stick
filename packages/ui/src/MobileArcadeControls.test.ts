import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, before, test } from "node:test";
import { HOTBAR_SLOT_COUNT } from "./hotbar";
import { ARCADE_FACE_COUNT, ARCADE_VISIBLE_FACES, MobileArcadeControls } from "./MobileArcadeControls";
import {
  UI_SETTINGS_KEY,
  applyUiSettings,
  layoutUsesArcadeControls,
  loadUiSettings,
  persistAndApplyUiSettings,
  readAppliedUiLayout,
} from "./uiSettings";

const here = dirname(fileURLToPath(import.meta.url));
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
  persistAndApplyUiSettings({ color: "cyan", font: "source", layout: "mobile", view: "iso", cam: "numpad", pixel: "crisp", minimap: true, drawDistance: 0.55, atmosphere: 0.45 });
  assert.equal(loadUiSettings().layout, "mobile");
  assert.equal(document.documentElement.dataset.uiLayout, "mobile");
  assert.equal(readAppliedUiLayout(), "mobile");
  applyUiSettings(loadUiSettings());
  assert.equal(readAppliedUiLayout(), "mobile");
  assert.equal(layoutUsesArcadeControls(readAppliedUiLayout()), true);
  assert.ok(localStorage.getItem(UI_SETTINGS_KEY)?.includes('"layout":"mobile"'));
});

test("MobileArcadeControls overlay: move stick + compact icon cluster, no Skills stick or keypad", () => {
  const html = renderToStaticMarkup(
    createElement(MobileArcadeControls, {
      potions: 2,
      hotbarFaces: ["flux", null, null, null, null, null, null, null],
      restUnlocked: true,
      page: 0,
      onCastSlot: () => {},
      onCastRest: () => {},
      onPotion: () => {},
      onPage: () => {},
    }),
  );
  assert.match(html, /data-arcade-controls="1"/);
  assert.match(html, /data-arcade-overlay="1"/);
  assert.match(html, /data-arcade-stick="move"/);
  assert.doesNotMatch(html, /data-arcade-stick="action"/);
  assert.match(html, /aria-label="Mobile arcade controls"/);
  assert.match(html, /arcade-face-cluster/);
  assert.match(html, /arcade-face-utils/);
  assert.match(html, /arcade-face-grid/);
  assert.match(html, /data-arcade-slot="0"/);
  assert.match(html, /arcade-face-empty/);
  assert.match(html, /arcade-face-key/);
  assert.match(html, /skill-glyph|skill-icon/);
  assert.doesNotMatch(html, />R</);
  assert.doesNotMatch(html, />Q</);
  assert.doesNotMatch(html, />␣</);
  assert.match(html, /data-arcade-dash="1"/);
  assert.match(html, /data-arcade-potion="1"/);
  assert.match(html, /data-arcade-rest="1"/);
  assert.match(html, /data-arcade-pager="1"/);
  assert.match(html, /arcade-pager-chip/);
  for (let i = 0; i < ARCADE_VISIBLE_FACES; i++) {
    assert.match(html, new RegExp(`data-arcade-slot="${i}"`));
  }
  assert.doesNotMatch(html, /data-arcade-slot="7"/);
});

test("live hotbar is 3×10 (30 slots); overlay shows 6 of 8 faces", () => {
  assert.equal(HOTBAR_SLOT_COUNT, 30);
  assert.equal(ARCADE_FACE_COUNT, 8);
  assert.equal(ARCADE_VISIBLE_FACES, 6);
});

test("arcade overlay is hosted on hud-root, not inside hud-action-plate", () => {
  const hud = readFileSync(join(here, "Hud.tsx"), "utf8");
  assert.match(hud, /\{mobileLayout && \(\s*<MobileArcadeControls/);
  const actionMobileStart = hud.indexOf('className="hud-action-mobile"');
  const actionPlateStart = hud.indexOf('className="hud-action-plate"');
  const arcadeMount = hud.lastIndexOf("<MobileArcadeControls");
  assert.ok(actionMobileStart >= 0 && actionPlateStart >= 0 && arcadeMount >= 0);
  assert.ok(arcadeMount > actionPlateStart, "overlay must outlive the hotbar ternary");
  const actionMobile = hud.slice(actionMobileStart, actionPlateStart);
  assert.doesNotMatch(actionMobile, /<MobileArcadeControls/);
  const actionPlate = hud.slice(actionPlateStart, arcadeMount);
  assert.doesNotMatch(actionPlate, /<MobileArcadeControls/);
});

test("overlay CSS pins arcade shell and peek map; no 38px / order-3 wrap", () => {
  const css = readFileSync(join(here, "styles.css"), "utf8");
  assert.match(css, /\.arcade-controls \{[\s\S]*?position:\s*absolute/);
  assert.match(css, /\.arcade-controls \{[\s\S]*?pointer-events:\s*none/);
  assert.match(css, /\.arcade-controls \{[\s\S]*?min-height:\s*0/);
  assert.match(css, /\.arcade-stick-move \{[\s\S]*?pointer-events:\s*auto/);
  assert.match(css, /\.arcade-face-cluster \{[\s\S]*?pointer-events:\s*none/);
  assert.match(css, /\.arcade-face-btn \{[\s\S]*?pointer-events:\s*auto/);
  assert.match(css, /minmax\(44px/);
  assert.doesNotMatch(css, /minmax\(38px/);
  assert.doesNotMatch(css, /\.arcade-face-cluster \{[\s\S]*?order:\s*3/);
  assert.match(css, /html\[data-ui-layout="mobile"\][\s\S]*?\.hud-minimap-well \{[\s\S]*?min-height:\s*96px/);
  assert.match(css, /html\[data-ui-layout="mobile"\][\s\S]*?\.hud-minimap-canvas \{[\s\S]*?object-fit:\s*contain/);
  assert.match(css, /\.hud-chrome \{[\s\S]*?z-index:\s*45/);
  assert.match(css, /html\[data-ui-layout="mobile"\] \.settings-panel \{[\s\S]*?bottom:\s*max\(8px/);
  assert.match(css, /html\[data-ui-layout="mobile"\][\s\S]*?\.hud-combat-log\.hud-pane-map \{[\s\S]*?height:\s*132px/);
  assert.match(css, /hud-chat-collapsed/);
  assert.doesNotMatch(css, /hud-combat-log\.hud-pane-map \{[\s\S]*?height:\s*168px/);
});
