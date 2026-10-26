import {
  BOOT_FORGE_MENU_BOUNDS,
  BOOT_FORGE_MENU_HERO,
  bootForgeMenuBiome,
  bootForgeMenuStandHeight,
} from "@bellgrave/config";
import { K, hash2, type Prop } from "../bake-props";

export function bootForgeMenuProps(): Prop[] {
  const props: Prop[] = [];
  const { minX, maxX, minZ, maxZ } = BOOT_FORGE_MENU_BOUNDS;
  const hx = BOOT_FORGE_MENU_HERO.x;
  const hz = BOOT_FORGE_MENU_HERO.z;
  const hy = bootForgeMenuStandHeight(hx, hz);

  props.push({
    kind: K.weaponRack,
    v: 1,
    x: hx - 1.15,
    z: hz + 0.85,
    y: hy + 0.05,
    yaw: -0.12,
    s: 1,
    w: 0,
    h: 0,
    d: 0,
  });
  props.push({
    kind: K.weaponRack,
    v: 2,
    x: hx + 1.35,
    z: hz + 0.85,
    y: hy + 0.05,
    yaw: 0.12,
    s: 1,
    w: 0,
    h: 0,
    d: 0,
  });

  for (let j = 0; j < 80; j++) {
    for (let i = 0; i < 80; i++) {
      const x = minX + (i / 79) * (maxX - minX);
      const z = minZ + (j / 79) * (maxZ - minZ);
      const h = hash2(i + 900, j + 900);
      const bio = bootForgeMenuBiome(x, z);
      if (bio === "ore_seam" && h > 0.92) {
        props.push({
          kind: K.firePit,
          v: 0,
          x,
          z,
          y: bootForgeMenuStandHeight(x, z),
          yaw: h * 6.28,
          s: 0.85,
          w: 0,
          h: 0,
          d: 0,
        });
      } else if (bio === "quarry" && h > 0.88) {
        props.push({
          kind: K.rock,
          v: (h * 4) | 0,
          x,
          z,
          y: bootForgeMenuStandHeight(x, z),
          yaw: h * 6.28,
          s: 0.6 + h * 0.5,
          w: 0,
          h: 0,
          d: 0,
        });
      }
    }
  }

  for (const [px, pz, ph] of [
    [7.5, 11.5, 8.5],
    [-6, 15, 7.8],
    [0, 20, 9],
  ] as const) {
    props.push({
      kind: K.peak,
      v: 0,
      x: px,
      z: pz,
      y: 0,
      yaw: 0,
      s: Math.max(0.7, ph / 8),
      w: 0,
      h: ph,
      d: 0,
    });
  }

  return props;
}
