import { test } from "node:test";
import assert from "node:assert/strict";
import { paleHollowWaterSurfaceY } from "@bellgrave/config";
import { paleHollowProps, RIVER_WALL_FREEBOARD } from "../scripts/bake-props";

// The far bank wall must hide the river: where the water surface stood above a
// standard wall's coping, open water showed over the wall as blue "teeth".
test("every bank-wall coping clears the water just inside it", () => {
  const walls = paleHollowProps().filter((p) => p.kind === 47);
  assert.ok(walls.length > 500);
  let worst = Infinity;
  for (const p of walls) {
    const top = p.y + p.h + p.d;
    const nx = Math.cos(p.yaw), nz = -Math.sin(p.yaw);
    for (const k of [-1, 1]) for (const d of [0.4, 0.8]) {
      const wy = paleHollowWaterSurfaceY(p.x + nx * d * k, p.z + nz * d * k);
      if (wy != null) worst = Math.min(worst, top - wy);
    }
  }
  assert.ok(worst >= RIVER_WALL_FREEBOARD - 1e-4, `lowest coping is only ${worst.toFixed(3)} m above the water`);
});

// Bridges: one height source. The server walks units at paleHollowStandHeight;
// the client draws the deck from the baked bridge prop. The fixture pins both
// (engine/ba-stick-render checks its mesh against it).
test("bridge walk heights: checked-in fixture matches config, and the server stands on the deck", async () => {
  const { bridgeProfileSamples } = await import("../scripts/bake-props");
  const fixture = (await import("./content/bridge-profile.json", { with: { type: "json" } })).default;
  const now = bridgeProfileSamples();
  assert.equal(now.length, fixture.length);
  now.forEach((b, i) => {
    const f = fixture[i]!;
    assert.equal(b.id, f.id);
    assert.equal(b.prop.v, f.prop.v, `${b.id} ramp`);
    for (const k of ["y", "s", "h", "d"] as const) assert.ok(Math.abs(b.prop[k] - f.prop[k]) < 1e-9, `${b.id} prop.${k}`);
    b.samples.forEach((s, j) => {
      assert.ok(Math.abs(s.y - f.samples[j]!.y) < 1e-9, `${b.id} t=${s.t} deck`);
      assert.ok(Math.abs(s.stand - s.y) < 1e-9, `${b.id} t=${s.t}: server stand ${s.stand} vs deck ${s.y}`);
    });
  });
});

test("bridges are trapezoids: straight ramps up, a flat deck, ramps down", async () => {
  const { paleHollowBridgeProfile } = await import("@bellgrave/config");
  for (const r of [0.155, 0.3]) {
    assert.equal(paleHollowBridgeProfile(0, r), 0);
    assert.equal(paleHollowBridgeProfile(1, r), 0);
    assert.equal(paleHollowBridgeProfile(r, r), 1);
    assert.equal(paleHollowBridgeProfile(0.5, r), 1);
    assert.equal(paleHollowBridgeProfile(1 - r, r), 1);
    assert.ok(Math.abs(paleHollowBridgeProfile(r / 2, r) - 0.5) < 1e-12);
  }
});
