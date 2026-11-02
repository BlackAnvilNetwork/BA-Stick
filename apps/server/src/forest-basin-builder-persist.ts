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

export function saveForestBasinEditsToDisk(): void {
  const p = path();
  try {
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify(serializeForestBasinOverlay(), null, 2), "utf8");
  } catch (err) {
    console.warn("forest basin edits: could not save", err);
  }
}
