/**
 * Single forge-menu look: matches ba-stick-render palette slots COAL (130) / EMBER (131)
 * and Black Anvil UI bronze. Use for page VFX + CSS custom properties.
 */
/** Boot forge photo (`public/ui/boot/forge-backdrop.png`) — keep pixels at native res. */
export const FORGE_BACKDROP_SRC = "/ui/boot/forge-backdrop.png" as const;

export const FORGE = {
  ember: "#ffc060",
  coal: "#d07030",
  rock: "#9a9283",
  rockDark: "#6e675e",
  void: "#060408",
  haze: "#5a2818",
  bronze: "#b8924a",
  bronzeHi: "#e0c070",
  bronzeDim: "#8a7030",
} as const;

/** Additive overlay pixels — same hues as engine motes, not separate oranges. */
export const FORGE_VFX = {
  moteBright: FORGE.ember,
  moteDim: FORGE.coal,
  moteAsh: FORGE.rockDark,
  pulse: FORGE.coal,
} as const;

/** Normalized blot anchors — keep HTML motes aligned with WASM `boot_forge_blots`. */
export const FORGE_BLOT = {
  portal: { x: 0.72, y: 0.35 },
  leftArch: { x: 0.24, y: 0.42 },
  mesa: { x: 0.26, y: 0.82 },
} as const;
