/**
 * Boot menu forge — small baked zone (menu-only, not on world layout).
 * Biomes paint the tileset; runtime generative pass adds embers on heat cells.
 */

export const BOOT_FORGE_MENU_BOUNDS = {
  minX: -22,
  maxX: 22,
  minZ: -4,
  maxZ: 28,
} as const;

export const BOOT_FORGE_MENU_ID = "boot_forge" as const;

/** Menu fighter — left third, on hero mesa (matches prior boot_forge). */
export const BOOT_FORGE_MENU_HERO = {
  x: -0.85,
  y: 0.62,
  z: 1.42,
  facing: 0.52,
} as const;

type Disc = { x: number; z: number; r: number };

const WALK_DISCS: readonly Disc[] = [
  { x: BOOT_FORGE_MENU_HERO.x, z: BOOT_FORGE_MENU_HERO.z, r: 4.2 },
  { x: 0.5, z: 4.2, r: 5.5 },
];

const LAVA_DISCS: readonly Disc[] = [
  { x: 2.0, z: 10.5, r: 5.5 },
  { x: 8.0, z: 11.0, r: 4.0 },
  { x: -5.5, z: 14.5, r: 3.2 },
];

const ARCH_DISCS: readonly Disc[] = [
  { x: 7.5, z: 11.5, r: 5.5 },
  { x: -6.0, z: 15.0, r: 4.5 },
];

const RIDGE_PEAKS: readonly { x: number; z: number; r: number; h: number }[] = [
  { x: -14, z: 18, r: 10, h: 9 },
  { x: 14, z: 16, r: 11, h: 10 },
  { x: 0, z: 22, r: 12, h: 8.5 },
  { x: 10, z: 8, r: 8, h: 7.5 },
  { x: -8, z: 12, r: 7, h: 7 },
];

function inDisc(x: number, z: number, d: Disc): boolean {
  return (x - d.x) ** 2 + (z - d.z) ** 2 <= d.r * d.r;
}

function inAnyDisc(x: number, z: number, discs: readonly Disc[]): boolean {
  return discs.some((d) => inDisc(x, z, d));
}

function ridgeLift(x: number, z: number): number {
  let h = 0;
  for (const p of RIDGE_PEAKS) {
    const d = Math.hypot(x - p.x, z - p.z);
    if (d >= p.r) continue;
    const t = 1 - d / p.r;
    h = Math.max(h, p.h * t * t);
  }
  return h;
}

export function bootForgeMenuWalkable(x: number, z: number): boolean {
  return inAnyDisc(x, z, WALK_DISCS);
}

export function bootForgeMenuBiome(x: number, z: number): string {
  if (!bootForgeMenuWalkable(x, z) && ridgeLift(x, z) > 4.5) return "mountain";
  if (inAnyDisc(x, z, LAVA_DISCS)) return "ore_seam";
  if (inAnyDisc(x, z, ARCH_DISCS)) return "vine_cliff";
  if (bootForgeMenuWalkable(x, z)) return "quarry";
  if (ridgeLift(x, z) > 1.2) return "crypt";
  return "mountain";
}

export function bootForgeMenuStandHeight(x: number, z: number): number {
  const base = 0.32;
  const ridge = ridgeLift(x, z);
  const hero = BOOT_FORGE_MENU_HERO;
  const hr = Math.hypot(x - hero.x, z - hero.z);
  const mesa = hr < 3.6 ? 0.28 * (1 - hr / 3.6) ** 2 : 0;
  const lava = inAnyDisc(x, z, LAVA_DISCS) ? 0.06 : 0;
  return base + ridge * 0.08 + mesa + lava;
}

export function bootForgeMenuWaterSurfaceY(_x: number, _z: number): number | null {
  return null;
}

export function bootForgeMenuInOpenWater(_x: number, _z: number): boolean {
  return false;
}

export function bootForgeMenuOnBridge(_x: number, _z: number): boolean {
  return false;
}

export function bootForgeMenuTrails(): { surface: string; points: { x: number; z: number }[] }[] {
  return [];
}
