import { test } from "node:test";
import assert from "node:assert/strict";
import { PALE_HOLLOW_BOUNDS, PH_ROAD_NAMES, paleHollowTrails } from "@bellgrave/config";
import {
  blitMinimapToWell,
  clampMinimapDock,
  mapDataFor,
  minimapBlitKey,
  minimapDockClientRect,
  sameMinimapDock,
  shouldBlitMinimap,
  shouldDrawHudMinimap,
  shouldRemeasureMinimapDock,
  minimapEngineDock,
  MINIMAP_BLIT_DOCK,
  MINIMAP_LEGACY_FALLBACK,
  applyMapData,
} from "./minimap";

test("named Pale Hollow roads appear on the minimap", () => {
  const d = mapDataFor("pale_hollow")!;
  const namedInConfig = new Set(Object.keys(PH_ROAD_NAMES));
  assert.equal(d.roads.length, paleHollowTrails().length);
  const named = paleHollowTrails().filter((t, i) => d.roads[i]!.name !== "").map((t) => t.id);
  assert.deepEqual(new Set(named), namedInConfig);
});

test("minimap labels sit inside the playable bounds", () => {
  const d = mapDataFor("pale_hollow")!;
  assert.ok(d.labels.length >= 10);
  for (const l of d.labels) {
    assert.ok(l.x >= PALE_HOLLOW_BOUNDS.minX && l.x <= PALE_HOLLOW_BOUNDS.maxX && l.z >= PALE_HOLLOW_BOUNDS.minZ && l.z <= PALE_HOLLOW_BOUNDS.maxZ, l.text);
  }
  assert.equal(mapDataFor(null), null);
});

test("HUD minimap docks in the Map well and hides on Log", () => {
  assert.equal(shouldDrawHudMinimap({ mapPane: true, hasWell: true, settingOn: true, full: false }), "dock");
  assert.equal(shouldDrawHudMinimap({ mapPane: true, hasWell: true, settingOn: false, full: false }), "dock");
  assert.equal(shouldDrawHudMinimap({ mapPane: true, hasWell: false, settingOn: true, full: false }), "hide");
  assert.equal(shouldDrawHudMinimap({ mapPane: false, hasWell: false, settingOn: true, full: false }), "hide");
  assert.equal(shouldDrawHudMinimap({ mapPane: false, hasWell: true, settingOn: true, full: false }), "hide");
  assert.equal(shouldDrawHudMinimap({ mapPane: true, hasWell: true, settingOn: true, full: true }), "full");
});

test("minimap dock clips to the framebuffer instead of hanging off it", () => {
  assert.deepEqual(clampMinimapDock(-10, 300, 120, 400, 640, 360), [0, 300, 130, 60]);
  assert.equal(clampMinimapDock(10, 350, 40, 358, 640, 360), null);
  const collapsed = { getBoundingClientRect: () => ({ left: 8, top: 80, right: 200, bottom: 80, width: 192, height: 0 }) };
  const frame = {
    getBoundingClientRect: () => ({ left: 8, top: 40, right: 200, bottom: 240, width: 192, height: 200 }),
    querySelector: () => ({ getBoundingClientRect: () => ({ bottom: 64 }) }),
  };
  assert.deepEqual(minimapDockClientRect(collapsed as never, frame as never), {
    left: 8,
    top: 64,
    right: 200,
    bottom: 240,
  });
});

test("HUD well blit skips a collapsed dock", () => {
  assert.equal(
    blitMinimapToWell({} as CanvasImageSource, { width: 0, height: 0 } as HTMLCanvasElement, [0, 0, 8, 8]),
    false,
  );
});

test("mobile never uses the leftover MOVE fallback dock", () => {
  assert.deepEqual(minimapEngineDock({ mobile: true, wellDock: null }), MINIMAP_BLIT_DOCK);
  assert.deepEqual(minimapEngineDock({ mobile: true, wellDock: [10, 20, 30, 40] }), MINIMAP_BLIT_DOCK);
  assert.deepEqual(minimapEngineDock({ mobile: false, wellDock: null }), MINIMAP_LEGACY_FALLBACK);
  assert.notDeepEqual(MINIMAP_BLIT_DOCK, MINIMAP_LEGACY_FALLBACK);
});

test("peek applyMapData can omit labels", () => {
  const titles: string[] = [];
  const labels: string[] = [];
  const r = {
    clearMapData() {},
    setMapTitle(t: string) { titles.push(t); },
    addMapRoad() {},
    addMapLabel(text: string) { labels.push(text); },
  };
  applyMapData(r, "pale_hollow", { labels: false });
  assert.equal(titles.at(-1), "");
  assert.equal(labels.length, 0);
  applyMapData(r, "pale_hollow", { labels: true });
  assert.ok((titles.at(-1) ?? "").length > 0);
  assert.ok(labels.length >= 10);
});

test("dock remasure waits, blit skips an unchanged panel", () => {
  assert.equal(shouldRemeasureMinimapDock(0, true), true);
  assert.equal(shouldRemeasureMinimapDock(3, false), false);
  assert.equal(shouldRemeasureMinimapDock(12, false), true);
  assert.equal(sameMinimapDock([8, 248, 148, 104], [8, 248, 148, 104]), true);
  assert.equal(sameMinimapDock([8, 248, 148, 104], [8, 248, 148, 105]), false);
  const dock: [number, number, number, number] = [8, 248, 148, 104];
  const a = minimapBlitKey(dock, 1, 10.2, 4.4, 0, 3);
  const b = minimapBlitKey(dock, 1, 10.4, 4.1, 0.01, 3);
  assert.equal(shouldBlitMinimap(null, a), true);
  assert.equal(shouldBlitMinimap(a, b), false);
  const walked = minimapBlitKey(dock, 1, 12, 4.4, 0, 3);
  assert.equal(shouldBlitMinimap(a, walked), true);
});
