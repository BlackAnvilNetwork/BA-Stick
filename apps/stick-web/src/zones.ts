import { ZONES, type ZoneId } from "@bellgrave/config";

/** How stick-web renders a server zone. */
export type ZoneRender = {
  id: string;
  name: string;
  /** Baked terrain under public/zones/<baked>.baz, or null for the flat floor. */
  baked: string | null;
};

/**
 * Zone registry keyed by `you.zoneId`. Every `ZONES` entry resolves; only zones
 * the server actually serves get baked terrain. The rest fall back to the flat floor.
 */
const BAKED: Partial<Record<ZoneId, string>> = {
  pale_hollow: "pale_hollow",
  hollow_road: "hollow_road",
  forest_basin: "forest_basin",
  spur_road: "spur_road",
  ring_ward: "ring_ward",
  islet_fords: "islet_fords",
  green_reach: "green_reach",
  coil_pass: "coil_pass",
  coil_ridge: "coil_ridge",
};

export function zoneRender(zoneId: string | undefined): ZoneRender {
  const id = zoneId || "pale_hollow";
  const def = (ZONES as Record<string, { name: string } | undefined>)[id];
  return { id, name: def?.name ?? id, baked: BAKED[id as ZoneId] ?? null };
}

/** Fade length for zone changes (ms). */
export const ZONE_FADE_MS = 450;

/** Detects `you.zoneId` changes; `first` is the initial zone (no fade). */
export class ZoneTracker {
  current: string | null = null;
  update(zoneId: string | null | undefined): { changed: boolean; first: boolean } {
    if (!zoneId || zoneId === this.current) return { changed: false, first: false };
    const first = this.current === null;
    this.current = zoneId;
    return { changed: true, first };
  }
}
