/**
 * HUD / UI appearance preferences (color, font, layout). Persists in localStorage.
 */

export const UI_SETTINGS_KEY = "bellgrave.uiSettings";

export type UiColorId = "cyan" | "gold" | "navy" | "ember" | "teal" | "crimson";
export type UiFontId = "source" | "cinzel" | "trebuchet" | "verdana" | "georgia";
/** Regular = desktop HUD; Mobile = arcade sticks + hotkeys clustered for touch. */
export type UiLayoutId = "regular" | "mobile";

/** World camera (stick client): fixed iso or 3D perspective blend. */
export type UiViewId = "iso" | "3d";
/** Canvas upscaling: crisp pixels or smoothed. */
export type UiPixelId = "crisp" | "smooth";

export type UiSettings = {
  color: UiColorId;
  font: UiFontId;
  layout: UiLayoutId;
  view: UiViewId;
  pixel: UiPixelId;
  /** Minimap overlay on/off (M key or Settings). */
  minimap: boolean;
};

export const UI_VIEW_OPTIONS: { id: UiViewId; label: string }[] = [
  { id: "iso", label: "Isometric" },
  { id: "3d", label: "3D" },
];
export const UI_PIXEL_OPTIONS: { id: UiPixelId; label: string }[] = [
  { id: "crisp", label: "Crisp pixels" },
  { id: "smooth", label: "Smooth" },
];

export const UI_LAYOUT_OPTIONS: { id: UiLayoutId; label: string; hint: string }[] = [
  { id: "regular", label: "Regular", hint: "Current desktop HUD & hotbar" },
  { id: "mobile", label: "Mobile", hint: "Arcade sticks + hotkeys nearby" },
];

export const UI_COLOR_OPTIONS: { id: UiColorId; label: string; swatch: string }[] = [
  { id: "cyan", label: "Launcher Cyan", swatch: "#5ad8ec" },
  { id: "gold", label: "Black Anvil Bronze", swatch: "#b8924a" },
  { id: "navy", label: "Commands Navy", swatch: "#5a7ab8" },
  { id: "ember", label: "Ember", swatch: "#d4783a" },
  { id: "teal", label: "Aether Teal", swatch: "#3ecfbf" },
  { id: "crimson", label: "Crimson", swatch: "#c45a4a" },
];

/** CSS font stacks matching styles.css html[data-ui-font] selectors. */
export const UI_FONT_STACKS: Record<UiFontId, string> = {
  source: '"Source Sans 3", "Segoe UI", sans-serif',
  cinzel: '"Cinzel", Georgia, serif',
  trebuchet: '"Trebuchet MS", "Segoe UI", sans-serif',
  verdana: "Verdana, Geneva, sans-serif",
  georgia: 'Georgia, "Times New Roman", serif',
};

export const UI_FONT_OPTIONS: { id: UiFontId; label: string; sample: string }[] = [
  { id: "source", label: "Source Sans", sample: "Aa Bb 123" },
  { id: "cinzel", label: "Cinzel", sample: "Aa Bb 123" },
  { id: "trebuchet", label: "Trebuchet", sample: "Aa Bb 123" },
  { id: "verdana", label: "Verdana", sample: "Aa Bb 123" },
  { id: "georgia", label: "Georgia", sample: "Aa Bb 123" },
];

const DEFAULTS: UiSettings = { color: "gold", font: "cinzel", layout: "regular", view: "iso", pixel: "crisp", minimap: true };

function isColor(v: unknown): v is UiColorId {
  return typeof v === "string" && UI_COLOR_OPTIONS.some((o) => o.id === v);
}

function isFont(v: unknown): v is UiFontId {
  return typeof v === "string" && UI_FONT_OPTIONS.some((o) => o.id === v);
}

function isLayout(v: unknown): v is UiLayoutId {
  return v === "regular" || v === "mobile";
}

export function loadUiSettings(): UiSettings {
  try {
    const raw = localStorage.getItem(UI_SETTINGS_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<UiSettings>;
    return {
      color: isColor(parsed.color) ? parsed.color : DEFAULTS.color,
      font: isFont(parsed.font) ? parsed.font : DEFAULTS.font,
      layout: isLayout(parsed.layout) ? parsed.layout : DEFAULTS.layout,
      view: parsed.view === "3d" || parsed.view === "iso" ? parsed.view : DEFAULTS.view,
      pixel: parsed.pixel === "smooth" || parsed.pixel === "crisp" ? parsed.pixel : DEFAULTS.pixel,
      minimap: typeof parsed.minimap === "boolean" ? parsed.minimap : DEFAULTS.minimap,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveUiSettings(next: UiSettings): void {
  localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify(next));
}

/** Apply preferences to <html> so CSS variables / font stacks take effect. */
export function applyUiSettings(settings: UiSettings): void {
  const root = document.documentElement;
  root.dataset.uiColor = settings.color;
  root.dataset.uiFont = settings.font;
  root.dataset.uiLayout = settings.layout;
  root.dataset.uiView = settings.view;
  root.dataset.uiPixel = settings.pixel;
  root.dataset.uiMinimap = settings.minimap ? "on" : "off";
  root.style.setProperty("--ui-font", UI_FONT_STACKS[settings.font]);
}

export function persistAndApplyUiSettings(settings: UiSettings): void {
  saveUiSettings(settings);
  applyUiSettings(settings);
}

/** Fired on window after a setting changes outside the Settings panel (e.g. a hotkey). */
export const UI_SETTINGS_EVENT = "bellgrave:ui-settings";

/** Toggle the minimap (M key): persist, apply, and notify open panels. */
export function toggleMinimap(): UiSettings {
  const next = { ...loadUiSettings(), minimap: !loadUiSettings().minimap };
  persistAndApplyUiSettings(next);
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new CustomEvent(UI_SETTINGS_EVENT));
  }
  return next;
}

/** True when Settings → Layout is Mobile (arcade sticks + clustered hotkeys). */
export function layoutUsesArcadeControls(layout: UiLayoutId): boolean {
  return layout === "mobile";
}

/** Read the live layout from <html data-ui-layout> (falls back to persisted settings). */
export function readAppliedUiLayout(): UiLayoutId {
  if (typeof document !== "undefined") {
    const fromDom = document.documentElement.dataset.uiLayout;
    if (fromDom === "regular" || fromDom === "mobile") return fromDom;
  }
  return loadUiSettings().layout;
}
