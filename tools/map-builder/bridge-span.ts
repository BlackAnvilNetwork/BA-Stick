// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Bridge spans from the folded terrain: walk each bridge axis out from mid-span until
// the ground is dry and up at bank height, then add a short overlap onto the bank.
// Prints the a/b/yA/yB to write into FB_BRIDGES (forest-basin-features.ts).
import { FB_BRIDGES, fbDesignWater, forestBasinGroundY } from "@bellgrave/config";

const OVERLAP = 2;
for (const b of FB_BRIDGES) {
  const mx = (b.a.x + b.b.x) / 2, mz = (b.a.z + b.b.z) / 2;
  const L = Math.hypot(b.b.x - b.a.x, b.b.z - b.a.z);
  const ux = (b.b.x - b.a.x) / L, uz = (b.b.z - b.a.z) / L;
  // a dry gorge (no water under the span) is measured by its drop instead
  let wetSpan = false;
  for (let t = -L / 2; t <= L / 2; t += 0.5) if (fbDesignWater(mx + ux * t, mz + uz * t)) wetSpan = true;
  const ends: { x: number; z: number; y: number }[] = [];
  for (const dir of [-1, 1]) {
    let edge = 0;
    for (let t = 0; t < 40; t += 0.25) {
      // gap = water, or a drop more than 1.5 m under the deck's bank line (the gorge)
      const x = mx + dir * ux * t, z = mz + dir * uz * t;
      let gap = false;
      for (const off of [-b.halfWidth, 0, b.halfWidth]) {
        const xx = x + uz * off, zz = z - ux * off;
        const w = fbDesignWater(xx, zz);
        if ((w && (off === 0 || w.depth > 0.5)) || (!wetSpan && forestBasinGroundY(xx, zz) < b.deckY - 1.8)) gap = true;
      }
      if (gap) edge = t;
      else if (t - edge > 2) break;
    }
    const t = edge + OVERLAP;
    const x = mx + dir * ux * t, z = mz + dir * uz * t;
    ends.push({ x: +x.toFixed(1), z: +z.toFixed(1), y: +forestBasinGroundY(x, z).toFixed(2) });
  }
  const [a, c] = ends as [{ x: number; z: number; y: number }, { x: number; z: number; y: number }];
  console.log(`${b.id}: a {x:${a.x},z:${a.z}} yA ${a.y}  b {x:${c.x},z:${c.z}} yB ${c.y}  span ${Math.hypot(c.x - a.x, c.z - a.z).toFixed(1)} (was ${L.toFixed(1)})`);
}
