import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  loadForestBasinOverlay,
  serializeForestBasinOverlay,
  type ForestBasinCellEdit,
} from "@bellgrave/config";

const DEFAULT_PATH = join(process.cwd(), "data", "forest-basin-edits.json");

function path(): string {
  return process.env.FOREST_BASIN_EDITS_PATH?.trim() || DEFAULT_PATH;
}

export function loadForestBasinEditsFromDisk(): void {
  const p = path();
  if (!existsSync(p)) return;
  try {
    const raw = JSON.parse(readFileSync(p, "utf8")) as Record<string, ForestBasinCellEdit>;
    loadForestBasinOverlay(raw);
  } catch (err) {
    console.warn("forest basin edits: could not load", err);
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Debounced: a scripted builder casts many strokes a second, and the overlay
 * can hold hundreds of thousands of cells. Write at most once a second.
 */
export function saveForestBasinEditsToDisk(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveForestBasinEditsNow();
  }, 1000);
  saveTimer.unref?.();
}

export function saveForestBasinEditsNow(): void {
  const p = path();
  try {
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify(serializeForestBasinOverlay()), "utf8");
  } catch (err) {
    console.warn("forest basin edits: could not save", err);
  }
}
