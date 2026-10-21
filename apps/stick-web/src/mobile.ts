import type { UiSettings } from "@bellgrave/ui/uiSettings";

/**
 * First visit on a touch-first device (no saved settings) starts in the
 * arcade layout: joystick + face-button hotbar. A saved choice always wins.
 */
export function initialUiSettings(saved: string | null, loaded: UiSettings, coarsePointer: boolean): UiSettings {
  if (saved == null && coarsePointer) return { ...loaded, layout: "mobile" };
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
