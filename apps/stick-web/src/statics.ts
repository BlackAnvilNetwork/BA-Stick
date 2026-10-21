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
  toScreen: (x: number, y: number, z: number) => [number, number],
  height: (x: number, z: number) => number,
): StaticTarget | undefined {
  return STATICS.find((t) => {
    if (t.zoneId !== zoneId) return false;
    const [px, py] = toScreen(t.x, height(t.x, t.z), t.z);
    return Math.abs(sx - px) <= t.halfW && sy <= py + 6 && sy >= py - t.heightPx;
  });
}
