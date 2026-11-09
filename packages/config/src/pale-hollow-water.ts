/**
 * Pale Hollow river spines for generative water (`WFL1`).
 * Main stem + tributary only — the Ash Pit lake stays still (no outlet spine).
 */
import {
  PH_LAKE,
  PH_RIVER_MAIN,
  PH_RIVER_TRIB,
  paleHollowLakeDist,
  paleHollowRiverCenterX,
  paleHollowTributaryCenterX,
  paleHollowWaterSurfaceY,
} from "./pale-hollow";
import { encodeWaterLayout } from "./water-layout";

const SPINE_STEP = 4;

function inLake(x: number, z: number): boolean {
  return paleHollowLakeDist(x, z) <= PH_LAKE.r;
}

/** Sample a z-run centerline. Skip lake cells so strokes stay in the river mask. */
function sampleSpine(centerX: (z: number) => number, z0: number, z1: number): number[] {
  const segs: number[] = [];
  const zs: number[] = [];
  for (let z = z0; z < z1; z += SPINE_STEP) zs.push(z);
  if (zs.length === 0 || zs[zs.length - 1] !== z1) zs.push(z1);
  let prev: { x: number; z: number; y: number } | null = null;
  for (const z of zs) {
    const x = centerX(z);
    if (inLake(x, z)) {
      prev = null;
      continue;
    }
    const y = paleHollowWaterSurfaceY(x, z);
    if (y == null) {
      prev = null;
      continue;
    }
    if (prev) segs.push(prev.x, prev.z, prev.y, x, z, y);
    prev = { x, z, y };
  }
  return segs;
}

/** Packed river spines for the renderer. No falls — PH has none authored. */
export function encodePhWaterLayout(): Uint8Array {
  const segs = [
    ...sampleSpine(paleHollowRiverCenterX, PH_RIVER_MAIN.z0, PH_RIVER_MAIN.z1),
    ...sampleSpine(paleHollowTributaryCenterX, PH_RIVER_TRIB.z0, PH_RIVER_TRIB.z1),
  ];
  return encodeWaterLayout(segs);
}
