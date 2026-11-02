import { FB_EDIT_CELL, FOREST_BASIN_BOUNDS, zoneOrigin } from "@bellgrave/config";
import type { StickRenderer } from "ba-stick-render";

export type ZonePatchCell = {
  i: number;
  j: number;
  heightCm?: number;
  biome?: number;
  flags?: number;
};

function worldOfCell(i: number, j: number): { x: number; z: number } {
  const { minX, minZ } = FOREST_BASIN_BOUNDS;
  return { x: minX + i * FB_EDIT_CELL, z: minZ + j * FB_EDIT_CELL };
}

/** Apply server terrain edits to the placed Forest Basin bake (world coordinates). */
export function applyForestBasinPatches(r: StickRenderer, cells: readonly ZonePatchCell[]): void {
  const origin = zoneOrigin("forest_basin");
  const patch = (r as StickRenderer & { patchZoneCell?: (x: number, z: number, biome: number, flags: number, height: number) => boolean })
    .patchZoneCell;
  if (typeof patch !== "function") {
    console.warn("map-builder: renderer missing patchZoneCell — rebuild ba-stick-render wasm");
    return;
  }
  for (const c of cells) {
    const local = worldOfCell(c.i, c.j);
    const wx = local.x + origin.x;
    const wz = local.z + origin.z;
    const height = (c.heightCm ?? 200) / 100;
    patch.call(r, wx, wz, c.biome ?? 13, c.flags ?? 0, height);
  }
}
