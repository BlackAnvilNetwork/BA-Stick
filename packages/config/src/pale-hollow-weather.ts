/**
 * Pale Hollow ambient weather — one state for the whole zone, rolled on a timer.
 * Weights are percent chances on each roll (sum 100).
 */
export type PaleHollowWeatherKind = "clear" | "rain" | "fog" | "snow";

export const PH_WEATHER_WEIGHTS: readonly { kind: PaleHollowWeatherKind; weight: number }[] = [
  { kind: "snow", weight: 30 },
  { kind: "rain", weight: 25 },
  { kind: "fog", weight: 25 },
  { kind: "clear", weight: 20 },
];

/** How long each weather spell lasts before a new roll. */
export const PH_WEATHER_CYCLE_MS = 18 * 60 * 1000;

/** Seconds of snow weather to reach full ground/tree cover (0..1). */
export const PH_SNOW_ACCUM_SEC = 240;

/** Seconds to melt snow cover after leaving snow weather. */
export const PH_SNOW_MELT_SEC = 50;

/** Mixed into the wall-clock cycle index so restarts do not always open on snow. */
export const PH_WEATHER_SEED_XOR = 0x9e3779b9;

/** Spell index shared by every server instance at the same wall time. */
export function paleHollowWeatherCycleIndex(nowMs: number): number {
  return Math.floor(nowMs / PH_WEATHER_CYCLE_MS);
}

/**
 * One game day = four weather spells (72 min). Same wall clock the server
 * rolls weather on, so every client sees the same time of day.
 */
export const PH_DAY_CYCLE_MS = 4 * PH_WEATHER_CYCLE_MS;

/** Time of day 0..1 at `nowMs`: 0 midnight, 0.25 sunrise, 0.5 noon, 0.75 sunset. */
export function paleHollowDayPhaseAt(nowMs: number): number {
  const p = (nowMs % PH_DAY_CYCLE_MS) / PH_DAY_CYCLE_MS;
  return p < 0 ? p + 1 : p;
}

/** Kind for the spell active at `nowMs` (deterministic from the cycle index). */
export function paleHollowWeatherKindAt(nowMs: number): PaleHollowWeatherKind {
  const idx = paleHollowWeatherCycleIndex(nowMs);
  return rollPaleHollowWeather((idx ^ PH_WEATHER_SEED_XOR) >>> 0);
}

/** Deterministic roll from an integer seed (server cycle index). */
export function rollPaleHollowWeather(seed: number): PaleHollowWeatherKind {
  let t = seed >>> 0;
  t = Math.imul(t ^ (t >>> 16), 0x7feb352d);
  t = Math.imul(t ^ (t >>> 15), 0x846ca68b);
  t = (t ^ (t >>> 16)) >>> 0;
  const pick = t % 100;
  let acc = 0;
  for (const row of PH_WEATHER_WEIGHTS) {
    acc += row.weight;
    if (pick < acc) return row.kind;
  }
  return "clear";
}

export type PaleHollowWeatherSnapshot = {
  kind: PaleHollowWeatherKind;
  /** 0..1 snow on ground and conifers; grows in snow, melts otherwise. */
  snowCover: number;
};

/** Renderer wasm `setWeather(kind, snowCover)` kind argument. */
export const PH_WEATHER_KIND_ID: Record<PaleHollowWeatherKind, number> = {
  clear: 0,
  rain: 1,
  fog: 2,
  snow: 3,
};
