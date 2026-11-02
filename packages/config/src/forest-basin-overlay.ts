/**
 * Live Forest Basin terrain edits (server-authoritative; optional client mirror for rendering).
 */
import { BAZ_BIOME, BAZ_FLAG } from "./zone-biomes";
import {
  FOREST_BASIN_BOUNDS,
  forestBasinBiome,
  forestBasinStandHeight,
  forestBasinWalkable,
} from "./forest-basin";

export const FB_EDIT_CELL = 0.5;

export type ForestBasinCellEdit = {
  /** Height in centimetres (matches BAZ1 int16). */
  heightCm?: number;
  biome?: number;
  /** When set, overrides walkability via blocked flag. */
  blocked?: boolean;
};

export type ForestBasinPatchCell = {
  i: number;
  j: number;
  heightCm?: number;
  biome?: number;
  flags?: number;
};

let edits = new Map<number, ForestBasinCellEdit>();

function gridSize(): { w: number; h: number } {
  const { minX, maxX, minZ, maxZ } = FOREST_BASIN_BOUNDS;
  const w = Math.ceil((maxX - minX) / FB_EDIT_CELL) + 1;
  const h = Math.ceil((maxZ - minZ) / FB_EDIT_CELL) + 1;
  return { w, h };
}

export function forestBasinCellOf(x: number, z: number): { i: number; j: number } | null {
  const { minX, maxX, minZ, maxZ } = FOREST_BASIN_BOUNDS;
  if (x < minX || x > maxX || z < minZ || z > maxZ) return null;
  const i = Math.floor((x - minX) / FB_EDIT_CELL);
  const j = Math.floor((z - minZ) / FB_EDIT_CELL);
  const { w, h } = gridSize();
  if (i < 0 || j < 0 || i >= w || j >= h) return null;
  return { i, j };
}

function key(i: number, j: number): number {
  const { w } = gridSize();
  return j * w + i;
}

export function forestBasinWorldOfCell(i: number, j: number): { x: number; z: number } {
  const { minX, minZ } = FOREST_BASIN_BOUNDS;
  return { x: minX + i * FB_EDIT_CELL, z: minZ + j * FB_EDIT_CELL };
}

export type ForestBasinUndoCell = {
  i: number;
  j: number;
  /** `null` = no overlay entry before that stroke. */
  prior: ForestBasinCellEdit | null;
};

const undoStack: ForestBasinUndoCell[][] = [];
const UNDO_MAX = 64;

function cloneEdit(e: ForestBasinCellEdit | undefined): ForestBasinCellEdit | null {
  if (!e) return null;
  return { ...e };
}

function isEditEmpty(e: ForestBasinCellEdit): boolean {
  return e.heightCm == null && e.biome == null && e.blocked == null;
}

function pruneEmptyEdits(cells: { i: number; j: number }[]): void {
  for (const { i, j } of cells) {
    const k = key(i, j);
    const e = edits.get(k);
    if (e && isEditEmpty(e)) edits.delete(k);
  }
}

function pushUndoStep(cells: { i: number; j: number }[]): void {
  const step = cells.map(({ i, j }) => ({ i, j, prior: cloneEdit(edits.get(key(i, j))) }));
  undoStack.push(step);
  while (undoStack.length > UNDO_MAX) undoStack.shift();
}

export function forestBasinCanUndo(): boolean {
  return undoStack.length > 0;
}

export function clearForestBasinUndoHistory(): void {
  undoStack.length = 0;
}

export function undoForestBasinEdit(): ForestBasinPatchCell[] | null {
  const step = undoStack.pop();
  if (!step) return null;
  for (const { i, j, prior } of step) {
    const k = key(i, j);
    if (!prior || isEditEmpty(prior)) edits.delete(k);
    else edits.set(k, { ...prior });
  }
  return step.map(({ i, j }) => patchCellToMessage(i, j));
}

export function resetForestBasinOverlay(from?: Map<number, ForestBasinCellEdit>): void {
  edits = from ? new Map(from) : new Map();
  clearForestBasinUndoHistory();
}

export function forestBasinOverlayEdits(): ReadonlyMap<number, ForestBasinCellEdit> {
  return edits;
}

export function loadForestBasinOverlay(serialized: Record<string, ForestBasinCellEdit>): void {
  edits = new Map();
  for (const [k, v] of Object.entries(serialized)) {
    const n = Number(k);
    if (Number.isFinite(n)) edits.set(n, v);
  }
  clearForestBasinUndoHistory();
}

export function serializeForestBasinOverlay(): Record<string, ForestBasinCellEdit> {
  const out: Record<string, ForestBasinCellEdit> = {};
  for (const [k, v] of edits) out[String(k)] = v;
  return out;
}

function editAt(i: number, j: number): ForestBasinCellEdit {
  const k = key(i, j);
  let e = edits.get(k);
  if (!e) {
    e = {};
    edits.set(k, e);
  }
  return e;
}

export function effectiveForestBasinHeight(x: number, z: number): number {
  const c = forestBasinCellOf(x, z);
  if (c) {
    const e = edits.get(key(c.i, c.j));
    if (e?.heightCm != null) return e.heightCm / 100;
  }
  return forestBasinStandHeight(x, z);
}

export function effectiveForestBasinWalkable(x: number, z: number): boolean {
  const c = forestBasinCellOf(x, z);
  if (c) {
    const e = edits.get(key(c.i, c.j));
    if (e?.blocked === true) return false;
    if (e?.blocked === false) return true;
  }
  return forestBasinWalkable(x, z);
}

export function effectiveForestBasinBiome(x: number, z: number): ReturnType<typeof forestBasinBiome> {
  const c = forestBasinCellOf(x, z);
  if (c) {
    const e = edits.get(key(c.i, c.j));
    if (e?.biome === BAZ_BIOME.mountain) return "mountain";
    if (e?.biome === BAZ_BIOME.grass) return "grass";
    if (e?.biome === BAZ_BIOME.meadow) return "meadow";
  }
  return forestBasinBiome(x, z);
}

export function forestBasinBakeFlags(x: number, z: number): number {
  let flags = 0;
  if (!effectiveForestBasinWalkable(x, z)) flags |= BAZ_FLAG.blocked;
  return flags;
}

export function forestBasinBakeBiomeByte(x: number, z: number): number {
  const c = forestBasinCellOf(x, z);
  if (c) {
    const e = edits.get(key(c.i, c.j));
    if (e?.biome != null) return e.biome;
  }
  const b = effectiveForestBasinBiome(x, z);
  if (b === "mountain") return BAZ_BIOME.mountain;
  if (b === "meadow") return BAZ_BIOME.meadow;
  return BAZ_BIOME.grass;
}

export function forestBasinHeightCm(x: number, z: number): number {
  return Math.round(effectiveForestBasinHeight(x, z) * 100);
}

/** Iterate cells in a circular brush (centre world x,z). */
export function forestBasinBrushCells(cx: number, cz: number, radius: number): { i: number; j: number }[] {
  const out: { i: number; j: number }[] = [];
  const r = Math.max(0.5, radius);
  const { minX, minZ } = FOREST_BASIN_BOUNDS;
  const i0 = Math.floor((cx - r - minX) / FB_EDIT_CELL);
  const i1 = Math.floor((cx + r - minX) / FB_EDIT_CELL);
  const j0 = Math.floor((cz - r - minZ) / FB_EDIT_CELL);
  const j1 = Math.floor((cz + r - minZ) / FB_EDIT_CELL);
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const { x, z } = forestBasinWorldOfCell(i, j);
      if (Math.hypot(x - cx, z - cz) <= r + FB_EDIT_CELL * 0.5) out.push({ i, j });
    }
  }
  return out;
}

export function patchCellToMessage(i: number, j: number): ForestBasinPatchCell {
  const { x, z } = forestBasinWorldOfCell(i, j);
  return {
    i,
    j,
    heightCm: forestBasinHeightCm(x, z),
    biome: forestBasinBakeBiomeByte(x, z),
    flags: forestBasinBakeFlags(x, z),
  };
}

export function allForestBasinPatchCells(): ForestBasinPatchCell[] {
  const out: ForestBasinPatchCell[] = [];
  for (const [k] of edits) {
    const { w } = gridSize();
    const i = k % w;
    const j = Math.floor(k / w);
    out.push(patchCellToMessage(i, j));
  }
  return out;
}

export function applyForestBasinRaise(cx: number, cz: number, radius: number, deltaM: number): ForestBasinPatchCell[] {
  const cells = forestBasinBrushCells(cx, cz, radius);
  pushUndoStep(cells);
  for (const { i, j } of cells) {
    const { x, z } = forestBasinWorldOfCell(i, j);
    const e = editAt(i, j);
    const base = e.heightCm != null ? e.heightCm / 100 : forestBasinStandHeight(x, z);
    e.heightCm = Math.round((base + deltaM) * 100);
  }
  pruneEmptyEdits(cells);
  return cells.map(({ i, j }) => patchCellToMessage(i, j));
}

export function applyForestBasinFlat(cx: number, cz: number, radius: number, heightM: number): ForestBasinPatchCell[] {
  const cells = forestBasinBrushCells(cx, cz, radius);
  pushUndoStep(cells);
  const cm = Math.round(heightM * 100);
  for (const { i, j } of cells) editAt(i, j).heightCm = cm;
  pruneEmptyEdits(cells);
  return cells.map(({ i, j }) => patchCellToMessage(i, j));
}

export function applyForestBasinSmooth(cx: number, cz: number, radius: number): ForestBasinPatchCell[] {
  const cells = forestBasinBrushCells(cx, cz, radius);
  pushUndoStep(cells);
  const heights: number[] = [];
  for (const { i, j } of cells) {
    const { x, z } = forestBasinWorldOfCell(i, j);
    heights.push(effectiveForestBasinHeight(x, z));
  }
  const avg = heights.reduce((a, b) => a + b, 0) / Math.max(1, heights.length);
  for (const { i, j } of cells) editAt(i, j).heightCm = Math.round(avg * 100);
  pruneEmptyEdits(cells);
  return cells.map(({ i, j }) => patchCellToMessage(i, j));
}

export function applyForestBasinBiome(cx: number, cz: number, radius: number, biome: number, blocked?: boolean): ForestBasinPatchCell[] {
  const cells = forestBasinBrushCells(cx, cz, radius);
  pushUndoStep(cells);
  for (const { i, j } of cells) {
    const e = editAt(i, j);
    e.biome = biome;
    if (blocked != null) e.blocked = blocked;
  }
  pruneEmptyEdits(cells);
  return cells.map(({ i, j }) => patchCellToMessage(i, j));
}

export function applyForestBasinWalk(cx: number, cz: number, radius: number, walk: boolean): ForestBasinPatchCell[] {
  const cells = forestBasinBrushCells(cx, cz, radius);
  pushUndoStep(cells);
  for (const { i, j } of cells) editAt(i, j).blocked = !walk;
  pruneEmptyEdits(cells);
  return cells.map(({ i, j }) => patchCellToMessage(i, j));
}
