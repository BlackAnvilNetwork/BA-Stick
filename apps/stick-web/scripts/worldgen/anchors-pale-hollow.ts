/**
 * Pale Hollow gameplay anchors and contracts, read live from @bellgrave/config.
 * The generator shapes land AROUND these; it never moves them.
 */
import {
  ASH_PIT, PALE_HOLLOW_BOUNDS, PH_ALL_MOBS, PH_ALL_NODES, PH_ASH_ROAD, PH_BRIDGE_SITES, PH_FIELD_NPCS,
  PH_HUB, PH_HUB_NPCS, PH_HUB_SPAWN, PH_OUTDOOR_SPAWN, PH_QUARRY_CUT, PH_SEAM_TUNNEL,
  PH_STORAGE_CHEST, PH_TIMBER_BRIDGE, PH_TRAINER, PH_YARDS, ZONE_LINKS, paleHollowBridgeGeom, paleHollowHubApronRect,
  MAYFLOWER_BBOX, MAYFLOWER_SCREEN, PH_START_CAMP,
} from "@bellgrave/config";
// PH_LAKE is not re-exported by the package index; read it from source (read-only).
import { PH_LAKE } from "../../../../packages/config/src/pale-hollow";

export type Pt = { id: string; kind: string; x: number; z: number };
export type Pad = { id: string; kind: "rect" | "disk"; x0: number; z0: number; x1: number; z1: number; r: number; soft: number };

export function paleHollowAnchors() {
  const points: Pt[] = [];
  points.push({ id: "spawn-hub", kind: "spawn", x: PH_HUB_SPAWN.x, z: PH_HUB_SPAWN.z });
  points.push({ id: "spawn-start-camp", kind: "spawn", x: PH_START_CAMP.x, z: PH_START_CAMP.z });
  points.push({ id: "spawn-outdoor", kind: "spawn", x: PH_OUTDOOR_SPAWN.x, z: PH_OUTDOOR_SPAWN.z });
  for (const n of PH_HUB_NPCS) points.push({ id: n.id, kind: "npc", x: n.x, z: n.z });
  points.push({ id: PH_STORAGE_CHEST.id, kind: "npc", x: PH_STORAGE_CHEST.x, z: PH_STORAGE_CHEST.z });
  points.push({ id: PH_TRAINER.id, kind: "npc", x: PH_TRAINER.x, z: PH_TRAINER.z });
  for (const n of PH_FIELD_NPCS) points.push({ id: n.id, kind: "npc", x: n.x, z: n.z });
  for (const n of PH_ALL_NODES) points.push({ id: n.id, kind: n.kind === "fish" ? "fish" : "node", x: n.x, z: n.z });
  for (const m of PH_ALL_MOBS) points.push({ id: m.id, kind: "mob", x: m.x, z: m.z });
  points.push({ id: "ash-pit-spawn", kind: "pvp", x: ASH_PIT.spawn.x, z: ASH_PIT.spawn.z });
  for (const l of ZONE_LINKS) if (l.to === "pale_hollow") points.push({ id: `link:${l.id}`, kind: "link", x: l.spawn.x, z: l.spawn.z });
  const gates = [
    { id: "timber-bridge", ...PH_TIMBER_BRIDGE },
    { id: "quarry-cut", ...PH_QUARRY_CUT },
    { id: "seam-tunnel", ...PH_SEAM_TUNNEL },
    { id: "ash-road", ...PH_ASH_ROAD },
  ];
  for (const g of gates) points.push({ id: `gate:${g.id}`, kind: "gate", x: (g.minX + g.maxX) / 2, z: Math.min(g.maxZ, PALE_HOLLOW_BOUNDS.maxZ - 6, (g.minZ + g.maxZ) / 2) });
  const bridges = PH_BRIDGE_SITES.map((s) => {
    const g = paleHollowBridgeGeom(s);
    const ends = [-1, 1].map((k) => ({ x: g.x + g.spanDir.x * (g.spanHalf + 1.5) * k, z: g.zWorld + g.spanDir.z * (g.spanHalf + 1.5) * k }));
    return { id: s.id, river: s.river, x: g.x, z: g.zWorld, spanHalf: g.spanHalf, waterY: g.waterY, ends };
  });
  for (const b of bridges) b.ends.forEach((e, i) => points.push({ id: `bridge:${b.id}:${i ? "R" : "L"}`, kind: "bridge-end", ...e }));

  // Pads: land is held at legacy height here (hub floor, yards, bridge banks, arena, gates).
  const hub = paleHollowHubApronRect();
  const pads: Pad[] = [
    { id: "hub-apron", kind: "rect", x0: hub.minX, z0: hub.minZ, x1: hub.maxX, z1: hub.maxZ, r: 0, soft: 22 },
    { id: "ash-pit", kind: "rect", x0: ASH_PIT.bounds.minX, z0: ASH_PIT.bounds.minZ, x1: ASH_PIT.bounds.maxX, z1: ASH_PIT.bounds.maxZ, r: 0, soft: 12 },
    ...gates.map((g) => ({ id: `gate:${g.id}`, kind: "rect" as const, x0: g.minX, z0: g.minZ, x1: g.maxX, z1: Math.min(g.maxZ, PALE_HOLLOW_BOUNDS.maxZ), r: 0, soft: 16 })),
    ...PH_YARDS.map((y) => ({ id: `yard:${y.id}`, kind: "disk" as const, x0: y.x, z0: y.z, x1: y.x, z1: y.z, r: 10, soft: 18 })),
    // Mayflower: the terraced town and the Mayhill screen keep their authored ground exactly.
    { id: "mayflower", kind: "rect", x0: MAYFLOWER_BBOX.minX, z0: MAYFLOWER_BBOX.minZ, x1: MAYFLOWER_BBOX.maxX, z1: MAYFLOWER_BBOX.maxZ, r: 0, soft: 10 },
    { id: "mayflower:mayhill", kind: "disk", x0: MAYFLOWER_SCREEN.x, z0: MAYFLOWER_SCREEN.z, x1: MAYFLOWER_SCREEN.x, z1: MAYFLOWER_SCREEN.z, r: MAYFLOWER_SCREEN.r, soft: 10 },
    // Emberwatch start camp: level ground for the fire and tents.
    { id: "camp:emberwatch", kind: "disk", x0: PH_START_CAMP.x, z0: PH_START_CAMP.z, x1: PH_START_CAMP.x, z1: PH_START_CAMP.z, r: 14, soft: 14 },
    ...bridges.map((b) => ({ id: `bridge:${b.id}`, kind: "disk" as const, x0: b.x, z0: b.z, x1: b.x, z1: b.z, r: b.spanHalf + 5, soft: 12 })),
  ];
  return { points, pads, bridges, lake: PH_LAKE, hub: PH_HUB, yards: PH_YARDS };
}

/** 0 outside, 1 fully inside (core), smooth falloff over `soft`. */
export function padWeight(p: Pad, x: number, z: number): number {
  let d: number;
  if (p.kind === "rect") d = Math.max(0, p.x0 - x, x - p.x1, p.z0 - z, z - p.z1);
  else d = Math.max(0, Math.hypot(x - p.x0, z - p.z0) - p.r);
  if (d >= p.soft) return 0;
  const t = 1 - d / p.soft;
  return t * t * (3 - 2 * t);
}
