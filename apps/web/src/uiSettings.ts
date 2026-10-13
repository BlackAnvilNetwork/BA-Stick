/**
 * HUD / UI appearance preferences (color, font, layout). Persists in localStorage.
 */

export const UI_SETTINGS_KEY = "bellgrave.uiSettings";

export type UiColorId = "cyan" | "gold" | "navy" | "ember" | "teal" | "crimson";
export type UiFontId = "source" | "cinzel" | "trebuchet" | "verdana" | "georgia";
/** Regular = desktop HUD; Mobile = arcade sticks + hotkeys clustered for touch. */
export type UiLayoutId = "regular" | "mobile";

export type UiSettings = {
  color: UiColorId;
  font: UiFontId;
  layout: UiLayoutId;
};

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

const DEFAULTS: UiSettings = { color: "gold", font: "cinzel", layout: "regular" };

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
  root.style.setProperty("--ui-font", UI_FONT_STACKS[settings.font]);
}

export function persistAndApplyUiSettings(settings: UiSettings): void {
  saveUiSettings(settings);
  applyUiSettings(settings);
}
