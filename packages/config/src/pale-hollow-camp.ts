/**
 * Emberwatch: the scouts' first camp in Pale Hollow, where newcomers arrive. Mayflower lies a long,
 * walk away, about 280 m north-east over the Timber Bridge to the Scout Gate. It is found by exploring.
 * Terrain data only. Spawn, respawn and warp unlocks live in warp-unlocks.ts, and main's values win;
 * pale-hollow-camp.test.ts keeps the two in agreement.
 */
export const PH_START_CAMP = { name: "Emberwatch", x: -55, z: 300 } as const;

/** Where a new arrival stands: beside the fire, facing east toward the hollow. */
export const PH_START_SPAWN = { x: PH_START_CAMP.x + 2, z: PH_START_CAMP.z - 3, facing: Math.PI / 2 } as const;

/** The Herald keeps the camp. */
export const PH_START_HERALD = { x: PH_START_CAMP.x + 4.5, z: PH_START_CAMP.z + 1.5 } as const;

/** Warp circles (data only, no mechanic here). Mayflower's ring stands inside the Scout Gate. */
export const PH_WARP_CIRCLES: readonly { id: string; name: string; x: number; z: number; r: number }[] = [
  { id: "warp-mayflower", name: "Mayflower Ring", x: 174, z: 191.5, r: 2.6 },
];

export type CampProp = { kind: string; x: number; z: number; yaw?: number; s?: number; w?: number; h?: number; d?: number; dy?: number; v?: number };

/** Humble on purpose: a fire, three tents, bedrolls, a woodpile and a timber lookout. */
export function startCampProps(): CampProp[] {
  const { x, z } = PH_START_CAMP, P: CampProp[] = [];
  P.push({ kind: "firePit", x, z });
  for (const [a, r] of [[-2.4, 6.5], [-1.2, 7], [2.6, 6.8]] as const) P.push({ kind: "tent", x: x + Math.cos(a) * r, z: z + Math.sin(a) * r, yaw: a + Math.PI / 2 });
  for (const a of [0.6, 1.5, 3.6]) P.push({ kind: "bedroll", x: x + Math.cos(a) * 3, z: z + Math.sin(a) * 3, yaw: a });
  P.push({ kind: "firewood", x: x - 3.2, z: z + 1.8 }, { kind: "crate", x: x + 6.5, z: z + 3.6, yaw: 0.3 }, { kind: "barrel", x: x + 7.4, z: z + 2.4 });
  P.push({ kind: "leanTo", x: x - 5, z: z + 5.5, yaw: -0.4 });
  // Lookout: four posts and a platform, a banner on top, watching east.
  const lx = x + 9, lz = z - 7;
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P.push({ kind: "wallBlock", x: lx + dx, z: lz + dz, w: 0.25, d: 0.25, h: 4.2 });
  P.push({ kind: "wallBlock", x: lx, z: lz, w: 2.6, d: 2.6, h: 0.25, dy: 4.2 }, { kind: "banner", x: lx + 1, z: lz + 1, dy: 4.45 });
  return P;
}

/** Seven standing stones around the Mayflower Ring. */
export function warpCircleProps(): CampProp[] {
  const P: CampProp[] = [];
  for (const c of PH_WARP_CIRCLES) for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    P.push({ kind: "stone", x: c.x + Math.cos(a) * c.r, z: c.z + Math.sin(a) * c.r, yaw: a, s: 0.8 });
  }
  return P;
}
