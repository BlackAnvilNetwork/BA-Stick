/**
 * Travel between zones. A gate rect in the source sends the player to
 * `spawn` in the destination. The spawn sits outside the destination's
 * return gate.
 *
 * North is +z. Facing 0 looks toward +z. Facing Math.PI looks toward -z.
 *
 * Session 9949e9b6-e0cc-461b-bf58-bc721c310dec: Pale Hollow's only zone line
 * is `pale-to-hollow` (gate `ash-road` -> hollow_road at (0, 22)). Do not add
 * a second pale_hollow destination. hollow_road is the ground between Pale
 * Hollow and Forest Basin. The later rows (spur_road, ring_ward, islet_fords,
 * green_reach, coil_pass, coil_ridge) are already wired. Do not move them.
 * travelAt / applyTravel in zone-fields.ts perform the hand-off.
 */

export type ZoneLink = {
  id: string;
  from: string;
  gate: string;
  to: string;
  spawn: { x: number; z: number; facing: number };
};

export type GateHit = {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  blocked?: boolean;
};

/** The gate the player is standing in, if that gate leaves the zone. */
export function linkUnder(
  zoneId: string,
  x: number,
  z: number,
  gates: readonly GateHit[],
): ZoneLink | undefined {
  for (const g of gates) {
    if (g.blocked) continue;
    if (x < g.minX || x > g.maxX || z < g.minZ || z > g.maxZ) continue;
    const link = zoneLink(zoneId, g.id);
    if (link) return link;
  }
  return undefined;
}

export const ZONE_LINKS: readonly ZoneLink[] = [
  { id: "pale-to-hollow", from: "pale_hollow", gate: "ash-road", to: "hollow_road", spawn: { x: 0, z: 22, facing: 0 } },
  { id: "hollow-to-pale", from: "hollow_road", gate: "south-lip", to: "pale_hollow", spawn: { x: 0, z: 456, facing: Math.PI } },
  { id: "hollow-to-basin", from: "hollow_road", gate: "north-lip", to: "forest_basin", spawn: { x: 8, z: -126, facing: 0 } },
  { id: "basin-to-hollow", from: "forest_basin", gate: "south-lip", to: "hollow_road", spawn: { x: 0, z: 138, facing: Math.PI } },
  { id: "basin-to-spur", from: "forest_basin", gate: "southeast-gap", to: "spur_road", spawn: { x: 0, z: 18, facing: 0 } },
  { id: "spur-to-basin", from: "spur_road", gate: "south-lip", to: "forest_basin", spawn: { x: 124, z: -96, facing: Math.PI } },
  { id: "spur-to-ring", from: "spur_road", gate: "north-lip", to: "ring_ward", spawn: { x: 0, z: 68, facing: 0 } },
  { id: "ring-to-spur", from: "ring_ward", gate: "north-gap", to: "spur_road", spawn: { x: 0, z: 182, facing: Math.PI } },
  { id: "ring-to-fords", from: "ring_ward", gate: "wharf-gap", to: "islet_fords", spawn: { x: 24, z: 0, facing: 0 } },
  { id: "fords-to-ring", from: "islet_fords", gate: "west-lip", to: "ring_ward", spawn: { x: 48, z: -58, facing: Math.PI } },
  { id: "fords-to-reach", from: "islet_fords", gate: "east-lip", to: "green_reach", spawn: { x: -70, z: 8, facing: 0 } },
  { id: "reach-to-fords", from: "green_reach", gate: "claw-lip", to: "islet_fords", spawn: { x: 166, z: -2, facing: Math.PI } },
  { id: "reach-to-pass", from: "green_reach", gate: "north-lip", to: "coil_pass", spawn: { x: 0, z: 22, facing: 0 } },
  { id: "pass-to-reach", from: "coil_pass", gate: "south-lip", to: "green_reach", spawn: { x: -10, z: 68, facing: Math.PI } },
  { id: "pass-to-ridge", from: "coil_pass", gate: "north-lip", to: "coil_ridge", spawn: { x: 0, z: -120, facing: 0 } },
  { id: "ridge-to-pass", from: "coil_ridge", gate: "tongue-lip", to: "coil_pass", spawn: { x: 0, z: 156, facing: Math.PI } },
];

export function zoneLink(from: string, gate: string): ZoneLink | undefined {
  return ZONE_LINKS.find((l) => l.from === from && l.gate === gate);
}

export function linksFrom(zoneId: string): readonly ZoneLink[] {
  return ZONE_LINKS.filter((l) => l.from === zoneId);
}
