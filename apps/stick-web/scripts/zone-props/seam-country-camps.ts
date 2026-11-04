// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

/**
 * Seam Country camp props (packages/config/src/seam-country-field.ts).
 * Each camp gets a small kit laid out in its own frame (forward = camp yaw,
 * where the giver stands). Scatter within the camp clearing is removed so the
 * kit reads. Props only land on walkable ground and never on a giver.
 */
import { ZONE_FIELDS } from "../../../../packages/config/src/zone-fields";
import { seamCountryCamps, seamCountryNpcs, type SeamCountryCamp } from "../../../../packages/config/src/seam-country-field";
import { K, type Prop } from "../bake-props";

/** Scatter (vegetation, loose rock) cleared inside this radius of a camp. */
export const CAMP_SCATTER_CLEAR = 4.5;
const SCATTER_KINDS = new Set<number>([
  K.pine, K.spruce, K.cypress, K.ashMed, K.ashTall,
  K.longGrass, K.tallPatch, K.fern, K.tuft, K.bush, K.rock, K.stalk, K.reed, K.scrub, K.bloom, K.sapling,
  K.stone, K.pebble, K.moss,
]);

type Piece = readonly [kind: number, side: number, fwd: number, yaw?: number, s?: number, w?: number, h?: number, d?: number];

const CRATE = [0.5, 0.4, 0.35, 0] as const;

const KITS: Record<SeamCountryCamp["kit"], readonly Piece[]> = {
  lean_to: [
    [K.leanTo, 0, -1.6, 0],
    [K.firePit, 0.9, 0.6],
    [K.bedroll, -1.4, -0.2, 0.4],
    [K.firewood, 1.7, -1.1],
    [K.crate, -1.6, 1.2, 0.3, ...CRATE],
  ],
  crown: [
    [K.tent, 0, -1.9, 0],
    [K.banner, 1.9, -0.7],
    [K.weaponRack, -1.9, -0.6, 0.2],
    [K.firePit, 0, 0.5],
    [K.crate, 1.5, 1.4, -0.3, ...CRATE],
    [K.barrel, -1.4, 1.5],
  ],
  bandit: [
    [K.tent, -1.0, -1.7, 0.3],
    [K.firePit, 0, 0.3],
    [K.crate, 1.6, -0.9, 0.5, ...CRATE],
    [K.barrel, 2.0, 0.6],
    [K.bedroll, -1.9, 0.5, -0.5],
    [K.firewood, 0.6, -2.2],
  ],
  cult: [
    [K.cairn, 0, -1.9],
    [K.firePit, 0, 0.3],
    [K.banner, -1.7, -1.0],
    [K.stone, 1.7, -0.9, 0.3, 0.8],
    [K.stone, -1.5, 1.4, 1.1, 0.7],
    [K.bedroll, 1.7, 1.3, 0.6],
  ],
  ferry: [
    [K.stall, 0, -1.8, 0],
    [K.crate, 1.6, -0.7, 0.2, ...CRATE],
    [K.crate, 1.9, 0.3, -0.4, ...CRATE],
    [K.barrel, -1.7, -0.6],
    [K.barrel, -1.9, 0.5],
    [K.banner, -0.9, -2.6],
  ],
  fold: [
    [K.firePit, 0, 0.4],
    [K.tent, -1.7, -1.5, 0.4],
    [K.stall, 1.7, -1.5, -0.3],
    [K.firewood, 0, -2.1],
    [K.banner, 2.1, 0.6],
  ],
};

/** Camp kit props for one Seam Country zone. */
export function seamCampProps(zoneId: string): Prop[] {
  const f = ZONE_FIELDS[zoneId];
  if (!f) return [];
  const camps = seamCountryCamps().filter((c) => c.zoneId === zoneId);
  const npcs = seamCountryNpcs().filter((n) => n.zoneId === zoneId);
  const out: Prop[] = [];
  for (const c of camps) {
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
    const rx = Math.cos(c.yaw), rz = -Math.sin(c.yaw);
    const placed: { x: number; z: number }[] = [];
    for (const [kind, side, fwd, yaw = 0, s = 1, w = 0, h = 0, d = 0] of KITS[c.kit]) {
      // Authored spot first, then mirrored, pulled in, and swung round the fire,
      // so a camp on a bank or ledge keeps its kit on dry ground.
      const tries: [number, number][] = [
        [side, fwd], [-side, fwd], [side * 0.7, fwd * 0.7], [-side * 0.7, fwd * 0.7],
        [fwd, side], [-fwd, side], [fwd, -side], [-fwd, -side],
      ];
      for (const [sd, fw] of tries) {
        const x = c.x + rx * sd + fx * fw;
        const z = c.z + rz * sd + fz * fw;
        if (!f.walkable(x, z) || f.openWater(x, z)) continue;
        if (npcs.some((n) => Math.hypot(n.x - x, n.z - z) < 1.2)) continue;
        if (placed.some((q) => Math.hypot(q.x - x, q.z - z) < 0.9)) continue;
        placed.push({ x, z });
        out.push({ kind, v: 0, x, z, y: f.stand(x, z), yaw: c.yaw + yaw, s, w, h, d });
        break;
      }
    }
  }
  return out;
}

/** Zone props with camp clearings swept of scatter and camp kits appended. */
export function withSeamCamps(zoneId: string, props: Prop[]): Prop[] {
  const camps = seamCountryCamps().filter((c) => c.zoneId === zoneId);
  if (camps.length === 0) return props;
  const kept = props.filter(
    (p) => !SCATTER_KINDS.has(p.kind) || camps.every((c) => Math.hypot(c.x - p.x, c.z - p.z) >= CAMP_SCATTER_CLEAR),
  );
  return [...kept, ...seamCampProps(zoneId)];
}
