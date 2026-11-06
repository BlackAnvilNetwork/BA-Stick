import { PH_STORAGE_CHEST } from "@bellgrave/config";
import type { ClientMessage } from "@bellgrave/protocol";

/** Clickable static props (not snapshot units), matching the old client's handlers. */
export type StaticTarget = { id: string; zoneId: string; x: number; z: number; halfW: number; heightPx: number; send: ClientMessage };

export const STATICS: readonly StaticTarget[] = [
  // StorageChestProp onClick → npc/interact with the chest id.
  { id: PH_STORAGE_CHEST.id, zoneId: "pale_hollow", x: PH_STORAGE_CHEST.x, z: PH_STORAGE_CHEST.z, halfW: 16, heightPx: 34, send: { type: "npc/interact", npcId: PH_STORAGE_CHEST.id } },
];

/** First static target under a framebuffer pixel, if any. */
export function staticAt(
  zoneId: string | null,
  sx: number,
  sy: number,
  toScreen: (x: number, y: number, z: number) => [number, number] | [number, number, number],
  height: (x: number, z: number) => number,
): StaticTarget | undefined {
  return STATICS.find((t) => {
    if (t.zoneId !== zoneId) return false;
    const y0 = height(t.x, t.z);
    const feet = toScreen(t.x, y0, t.z);
    const up = toScreen(t.x, y0 + 1, t.z);
    if ((feet[2] ?? 1) <= 0 || (up[2] ?? 1) <= 0) return false;
    const [px, py] = feet;
    const [, pyUp] = up;
    const lift = Math.abs(py - pyUp);
    const s = lift < 1e-3 ? 1 : Math.max(0.15, lift / 44);
    return Math.abs(sx - px) <= t.halfW * s && sy <= py + 6 * s && sy >= py - t.heightPx * s;
  });
}
