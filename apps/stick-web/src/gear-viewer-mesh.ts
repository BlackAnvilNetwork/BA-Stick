import type { GearDef } from "./gear-ron.ts";

/** Viewer-only: same `.ron` capsules as another gear; pixel art still keyed by `gear.id`. */
export const VIEWER_MESH_ALIAS: Record<string, string> = {
  ba_decayed_sword: "ba_iron_sword",
  ba_decayed_axe: "ba_bronze_axe",
};

export function applyViewerMeshAlias(
  gear: GearDef,
  meshForId: (id: string) => GearDef | undefined,
): GearDef {
  const srcId = VIEWER_MESH_ALIAS[gear.id];
  if (!srcId) return gear;
  const mesh = meshForId(srcId);
  if (!mesh) return gear;
  return {
    ...mesh,
    id: gear.id,
    material: gear.material ?? mesh.material,
  };
}
