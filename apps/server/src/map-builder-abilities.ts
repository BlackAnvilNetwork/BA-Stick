import {
  BAZ_BIOME,
  applyForestBasinBiome,
  applyForestBasinFlat,
  applyForestBasinRaise,
  applyForestBasinSmooth,
  applyForestBasinWalk,
  effectiveForestBasinHeight,
  undoForestBasinEdit,
  type ForestBasinPatchCell,
} from "@bellgrave/config";
import {
  MAP_BUILDER_ABILITIES,
  isMapBuilderAbilityId,
  parseGroundTarget,
  type MapBuilderAbilityId,
} from "@bellgrave/combat";
import type { AbilityId } from "@bellgrave/protocol";
import { saveForestBasinEditsToDisk } from "./forest-basin-builder-persist";

export type MapBuilderPlayer = {
  zoneId: string;
  x: number;
  z: number;
  y: number;
  recasts: Partial<Record<string, number>>;
};

export type MapBuilderHooks = {
  pushLog: (p: MapBuilderPlayer, msg: string) => void;
  broadcastPatch: (cells: ForestBasinPatchCell[]) => void;
};

export function resolveMapBuilderAbility(
  p: MapBuilderPlayer,
  id: MapBuilderAbilityId,
  targetId: string | undefined,
  now: number,
  hooks: MapBuilderHooks,
): void {
  if (p.zoneId !== "forest_basin") {
    hooks.pushLog(p, "Map tools only work in Forest Basin.");
    return;
  }
  const def = MAP_BUILDER_ABILITIES[id];
  const readyAt = p.recasts[id] ?? 0;
  if (def.recastMs > 0 && now < readyAt) {
    hooks.pushLog(p, `${def.label} is not ready yet.`);
    return;
  }
  if (id === "map_undo") {
    const cells = undoForestBasinEdit();
    if (!cells?.length) {
      hooks.pushLog(p, "Nothing to undo.");
      return;
    }
    saveForestBasinEditsToDisk();
    hooks.broadcastPatch(cells);
    hooks.pushLog(p, `Undid last stroke (${cells.length} cells).`);
    return;
  }
  const ground = parseGroundTarget(targetId);
  if (!ground) {
    hooks.pushLog(p, "Aim at the ground and cast again.");
    return;
  }
  const brush = ground.radius ?? def.brush ?? 4;
  const step = ground.strength ?? 0.5;
  let cells: ForestBasinPatchCell[] = [];
  switch (id) {
    case "map_raise":
      cells = applyForestBasinRaise(ground.x, ground.z, brush, step);
      break;
    case "map_lower":
      cells = applyForestBasinRaise(ground.x, ground.z, brush, -step);
      break;
    case "map_flat":
      cells = applyForestBasinFlat(ground.x, ground.z, brush, effectiveForestBasinHeight(p.x, p.z));
      break;
    case "map_smooth":
      cells = applyForestBasinSmooth(ground.x, ground.z, brush, ground.strength ?? 1);
      break;
    case "map_biome_grass":
      cells = applyForestBasinBiome(ground.x, ground.z, brush, BAZ_BIOME.grass, false);
      break;
    case "map_biome_meadow":
      cells = applyForestBasinBiome(ground.x, ground.z, brush, BAZ_BIOME.meadow, false);
      break;
    case "map_biome_mountain":
      cells = applyForestBasinBiome(ground.x, ground.z, brush, BAZ_BIOME.mountain, true);
      break;
    case "map_walk":
      cells = applyForestBasinWalk(ground.x, ground.z, brush, true);
      break;
    case "map_block":
      cells = applyForestBasinWalk(ground.x, ground.z, brush, false);
      break;
    default:
      return;
  }
  if (cells.length === 0) {
    hooks.pushLog(p, "Nothing to change there.");
    return;
  }
  p.recasts[id] = now + def.recastMs;
  saveForestBasinEditsToDisk();
  hooks.broadcastPatch(cells);
  hooks.pushLog(p, `${def.label} applied (${cells.length} cells).`);
}

export function isMapBuilderAbility(id: AbilityId): id is MapBuilderAbilityId {
  return isMapBuilderAbilityId(id);
}
