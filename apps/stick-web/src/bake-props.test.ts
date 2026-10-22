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
