import type { UiSettings } from "@bellgrave/ui/uiSettings";

function savedHasLayout(saved: string | null): boolean {
  if (saved == null || saved === "") return false;
  try {
    const parsed = JSON.parse(saved) as { layout?: unknown };
    return parsed != null && typeof parsed === "object" && "layout" in parsed;
  } catch {
    return false;
  }
}

/**
 * First visit on a touch-first *narrow* device (no saved layout) starts in
 * the mobile touch overlay. iPad landscape (coarse but wide) stays Regular.
 * An explicit saved layout wins; an empty `{}` blob does not trap Regular.
 */
export function initialUiSettings(
  saved: string | null,
  loaded: UiSettings,
  coarsePointer: boolean,
  viewportWidth = 0,
): UiSettings {
  const narrow = viewportWidth > 0 ? viewportWidth < 820 : true;
  if (!savedHasLayout(saved) && coarsePointer && narrow) return { ...loaded, layout: "mobile" };
  return loaded;
}

export function isCoarsePointer(): boolean {
  return typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
}

/** Atmosphere default: on for desktop, off for touch devices. `?atmo=1|0` overrides. */
export function atmosphereFor(coarsePointer: boolean, search: string): boolean {
  const q = new URLSearchParams(search).get("atmo");
  if (q === "1") return true;
  if (q === "0") return false;
  return !coarsePointer;
}

/**
 * L2 key light default (round 3 polish): on wherever atmosphere is on
 * (desktop), off on touch. `?keylight` / `?keylight=1` forces it on,
 * `?keylight=0` is the kill switch.
 */
export function keylightFor(coarsePointer: boolean, search: string): boolean {
  const q = new URLSearchParams(search);
  if (q.has("keylight")) return q.get("keylight") !== "0";
  return atmosphereFor(coarsePointer, search);
}
