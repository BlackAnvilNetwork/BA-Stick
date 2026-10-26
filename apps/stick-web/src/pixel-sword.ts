/** Short blade, no crossguard — same hand-plane draw as ba_iron_dagger. */
export const PIXEL_DAGGER_GEAR_IDS = new Set([
  "ba_iron_dagger",
  "ba_bone_dagger",
  "ba_neolithic_dagger",
  "ba_fang_dagger",
]);

export const PIXEL_SWORD_GEAR_IDS = new Set([
  "ba_iron_sword",
  ...PIXEL_DAGGER_GEAR_IDS,
  "ba_iron_greatsword",
  "ba_steel_greatsword",
  "ba_mythril_greatsword",
  "ba_bronze_sword",
  "ba_darksteel_blade",
  "ba_mythril_sword",
  "ba_orichalcum_sword",
  "ba_decayed_sword",
]);

const PIXEL_GREATSWORD_GEAR_IDS = new Set([
  "ba_iron_greatsword",
  "ba_steel_greatsword",
  "ba_mythril_greatsword",
]);

export type SwordArt =
  | "iron"
  | "steel"
  | "bronze"
  | "darksteel"
  | "mythril"
  | "orichalcum"
  | "bone"
  | "neolithic"
  | "fang"
  | "decayed";

export function swordArtForGearId(id: string): SwordArt | null {
  switch (id) {
    case "ba_steel_greatsword":
      return "steel";
    case "ba_bronze_sword":
      return "bronze";
    case "ba_darksteel_blade":
      return "darksteel";
    case "ba_mythril_sword":
    case "ba_mythril_greatsword":
      return "mythril";
    case "ba_orichalcum_sword":
      return "orichalcum";
    case "ba_bone_dagger":
      return "bone";
    case "ba_neolithic_dagger":
      return "neolithic";
    case "ba_fang_dagger":
      return "fang";
    case "ba_decayed_sword":
      return "decayed";
    case "ba_iron_sword":
    case "ba_iron_dagger":
    case "ba_iron_greatsword":
      return "iron";
    default:
      return null;
  }
}

export type SwordArtColors = {
  blade: string;
  edge: string;
  plate: string;
  /** When set, gear-viewer draws the grip capsule in this color (not steel). */
  grip?: string;
  guard?: string;
};

export const SWORD_ART_COLORS: Record<SwordArt, SwordArtColors> = {
  iron: { blade: "#e8e2d0", edge: "#d9a441", plate: "#d9a441" },
  steel: { blade: "#9aa6b8", edge: "#18161f", plate: "#9aa6b8" },
  bronze: { blade: "#b8924a", edge: "#8a7030", plate: "#b8924a" },
  darksteel: { blade: "#7d7486", edge: "#18161f", plate: "#7d7486" },
  mythril: { blade: "#5fc4e8", edge: "#336a86", plate: "#5fc4e8" },
  orichalcum: { blade: "#e8eaef", edge: "#9aa6b8", plate: "#e8eaef" },
  bone: { blade: "#d8cfb4", edge: "#9a9283", plate: "#d8cfb4" },
  neolithic: { blade: "#9a9283", edge: "#6e675e", plate: "#9a9283" },
  fang: { blade: "#e8dcc0", edge: "#b33939", plate: "#e8dcc0" },
  decayed: {
    blade: "#18161f",
    edge: "#18161f",
    plate: "#18161f",
    grip: "#18161f",
    guard: "#18161f",
  },
};

/** Capsule ramp color in gear-viewer (`strokeShape` material). */
export function swordMeshMaterial(gearId: string, gearMaterial?: string): string | undefined {
  if (swordArtForGearId(gearId) === "decayed") return "decayed";
  return gearMaterial;
}

/** Hand-frame layout for pixel sword draw (matches `figure.rs`). */
export type SwordLayout = {
  gripStart: number;
  gripEnd: number;
  guardY: number;
  guardHalf: number;
  plateHalf: number;
  bladeStart: number;
  bladeEnd: number;
  bladeHalf: number;
  point: number;
  crossguard: boolean;
};

const LAYOUT_1H: SwordLayout = {
  gripStart: -0.14,
  gripEnd: 0.04,
  guardY: 0.08,
  guardHalf: 0.11,
  plateHalf: 0.042,
  bladeStart: 0.12,
  bladeEnd: 0.86,
  bladeHalf: 0.04,
  point: 0.74,
  crossguard: true,
};

const LAYOUT_DAGGER: SwordLayout = (() => {
  const bladeLen = (LAYOUT_1H.bladeEnd - LAYOUT_1H.bladeStart) * 0.52;
  const bladeStart = LAYOUT_1H.gripEnd + 0.02;
  return {
    gripStart: LAYOUT_1H.gripStart,
    gripEnd: LAYOUT_1H.gripEnd,
    guardY: LAYOUT_1H.guardY,
    guardHalf: 0,
    plateHalf: 0,
    bladeStart,
    bladeEnd: bladeStart + bladeLen,
    bladeHalf: LAYOUT_1H.bladeHalf * 0.9,
    point: bladeStart + bladeLen * 0.84,
    crossguard: false,
  };
})();

function layoutGreatFrom1h(base: SwordLayout): SwordLayout {
  const gripLen = (base.gripEnd - base.gripStart) * 1.5;
  const bladeLen = (base.bladeEnd - base.bladeStart) * 1.5;
  return {
    gripStart: base.gripEnd - gripLen,
    gripEnd: base.gripEnd,
    guardY: base.guardY,
    guardHalf: base.guardHalf,
    plateHalf: base.plateHalf,
    bladeStart: base.bladeStart,
    bladeEnd: base.bladeStart + bladeLen,
    bladeHalf: base.bladeHalf * 2,
    point: base.bladeStart + (base.point - base.bladeStart) * 1.5,
    crossguard: true,
  };
}

const LAYOUT_GREAT = layoutGreatFrom1h(LAYOUT_1H);

export function swordLayoutForGearId(id: string): SwordLayout {
  if (PIXEL_GREATSWORD_GEAR_IDS.has(id)) return LAYOUT_GREAT;
  if (PIXEL_DAGGER_GEAR_IDS.has(id)) return LAYOUT_DAGGER;
  return LAYOUT_1H;
}

/** Bounds samples for gear-viewer framing (+y along blade). */
export function pixelSwordBounds(id: string): Array<[number, number, number]> {
  const lay = swordLayoutForGearId(id);
  const pts: Array<[number, number, number]> = [
    [0, lay.gripStart, 0],
    [0, lay.bladeEnd, 0],
  ];
  if (lay.crossguard) {
    pts.push([-lay.guardHalf, lay.guardY, 0], [lay.guardHalf, lay.guardY, 0]);
  }
  return pts;
}
