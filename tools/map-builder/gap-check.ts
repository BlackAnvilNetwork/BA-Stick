// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Walk every trail at 1 m; a metre is "at something" when a POI, place, warp ring
// or bridge is within REACH m. Reports the longest stretch with nothing.
import { FB_POIS, FB_PLACES, FB_WARP_SITES, FB_BRIDGES, FB_TRAIL_DEFS } from "@bellgrave/config";

const REACH = Number(process.env.REACH ?? 15);
const spots = [
  ...FB_POIS.map((p) => ({ n: p.name, x: p.x, z: p.z })),
  ...FB_PLACES.map((p) => ({ n: p.name, x: p.x, z: p.z })),
  ...FB_WARP_SITES.map((p) => ({ n: p.name, x: p.x, z: p.z })),
  ...FB_BRIDGES.map((b) => ({ n: b.name, x: (b.a.x + b.b.x) / 2, z: (b.a.z + b.b.z) / 2 })),
];
let worst = 0;
for (const t of FB_TRAIL_DEFS) {
  let run = 0, len = 0, max = 0, at = "";
  const p = t.points;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i]!, b = p[i + 1]!;
    const n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.z - a.z)));
    for (let s = 0; s < n; s++) {
      const x = a.x + ((b.x - a.x) * s) / n, z = a.z + ((b.z - a.z) * s) / n;
      len += Math.hypot(b.x - a.x, b.z - a.z) / n;
      if (spots.some((q) => Math.hypot(q.x - x, q.z - z) <= REACH)) run = 0;
      else if (++run > max) { max = run; at = `${x.toFixed(0)},${z.toFixed(0)}`; }
    }
  }
  worst = Math.max(worst, max);
  console.log(`${t.id.padEnd(14)} ${len.toFixed(0).padStart(4)} m  longest empty ${max} m (ends ${at})`);
}
console.log(`POIs ${FB_POIS.length} + places ${FB_PLACES.length} + rings ${FB_WARP_SITES.length} + bridges ${FB_BRIDGES.length} = ${spots.length}; worst gap ${worst} m`);
