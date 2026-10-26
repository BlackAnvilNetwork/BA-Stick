/**
 * Where each zone sits in the one shared world. Pale Hollow stays on its own
 * coordinates, so the Shard Dwellings do not move. Every later zone is stacked
 * north of the one before it. Their rectangles touch and do not cover each other.
 * The server still stores a position in zone-local metres. The client adds the
 * origin when it draws, and subtracts it before it sends a move.
 */

import { CP_BOUNDS } from "./coil-pass";
import { CR_BOUNDS } from "./coil-ridge";
import { FOREST_BASIN_BOUNDS } from "./forest-basin";
import { GR_BOUNDS } from "./green-reach";
import { HR_BOUNDS } from "./hollow-road";
import { IF_BOUNDS } from "./islet-fords";
import { PALE_HOLLOW_BOUNDS } from "./pale-hollow";
import { RW_BOUNDS } from "./ring-ward";
import { SR_BOUNDS } from "./spur-road";

export type ZoneOrigin = { x: number; z: number };

type Band = { id: string; minX: number; maxX: number; minZ: number; maxZ: number };

const BANDS: readonly Band[] = [
  { id: "pale_hollow", ...PALE_HOLLOW_BOUNDS },
  { id: "hollow_road", ...HR_BOUNDS },
  { id: "forest_basin", ...FOREST_BASIN_BOUNDS },
  { id: "spur_road", ...SR_BOUNDS },
  { id: "ring_ward", ...RW_BOUNDS },
  { id: "islet_fords", ...IF_BOUNDS },
  { id: "green_reach", ...GR_BOUNDS },
  { id: "coil_pass", ...CP_BOUNDS },
  { id: "coil_ridge", ...CR_BOUNDS },
];

function stack(): Record<string, ZoneOrigin> {
  const out: Record<string, ZoneOrigin> = {};
  let cursor = 0;
  for (const b of BANDS) {
    const oz = b.id === "pale_hollow" ? 0 : cursor - b.minZ;
    out[b.id] = { x: 0, z: oz };
    cursor = b.maxZ + oz;
  }
  return out;
}

/** World origin added to a zone's local x/z. Unknown ids stay at the origin. */
export const ZONE_ORIGINS: Readonly<Record<string, ZoneOrigin>> = stack();

export function zoneOrigin(id: string | null | undefined): ZoneOrigin {
  if (!id) return { x: 0, z: 0 };
  return ZONE_ORIGINS[id] ?? { x: 0, z: 0 };
}

/** Axis-aligned bounds of a zone after its origin is applied. */
export function zoneWorldBounds(id: string): Band | undefined {
  const b = BANDS.find((band) => band.id === id);
  const o = ZONE_ORIGINS[id];
  if (!b || !o) return undefined;
  return { id, minX: b.minX + o.x, maxX: b.maxX + o.x, minZ: b.minZ + o.z, maxZ: b.maxZ + o.z };
}

export const WORLD_ZONE_IDS: readonly string[] = BANDS.map((b) => b.id);
