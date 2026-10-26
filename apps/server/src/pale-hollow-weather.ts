import {
  PH_SNOW_ACCUM_SEC,
  PH_SNOW_MELT_SEC,
  PH_WEATHER_CYCLE_MS,
  paleHollowWeatherCycleIndex,
  paleHollowWeatherKindAt,
  type PaleHollowWeatherSnapshot,
} from "@bellgrave/config";

/**
 * Weather is a pure function of the wall clock: every instance, restart and late joiner
 * computes the same kind and the same snow cover, with no accumulated state to lose.
 *
 * Relies on a spell being longer than both PH_SNOW_ACCUM_SEC and PH_SNOW_MELT_SEC, so a
 * snow spell always ends at cover 1 and any other spell always ends at 0. That means only the
 * previous spell matters. Enforced below so a config change can't silently break it.
 */
const SPELL_SEC = PH_WEATHER_CYCLE_MS / 1000;
if (SPELL_SEC <= Math.max(PH_SNOW_ACCUM_SEC, PH_SNOW_MELT_SEC)) {
  throw new Error("PH_WEATHER_CYCLE_MS must exceed the snow accumulate and melt times");
}

export function paleHollowWeatherSnapshotAt(nowMs: number): PaleHollowWeatherSnapshot {
  const idx = paleHollowWeatherCycleIndex(nowMs);
  const kind = paleHollowWeatherKindAt(nowMs);
  const prevSnow = paleHollowWeatherKindAt((idx - 1) * PH_WEATHER_CYCLE_MS) === "snow";
  const elapsedSec = (nowMs - idx * PH_WEATHER_CYCLE_MS) / 1000;

  let cover = 0;
  if (kind === "snow") {
    cover = prevSnow ? 1 : Math.min(1, elapsedSec / PH_SNOW_ACCUM_SEC);
  } else if (prevSnow) {
    cover = Math.max(0, 1 - elapsedSec / PH_SNOW_MELT_SEC);
  }
  return { kind, snowCover: Math.round(cover * 1000) / 1000 };
}

export function paleHollowWeatherSnapshot(): PaleHollowWeatherSnapshot {
  return paleHollowWeatherSnapshotAt(Date.now());
}

/** Kept so existing callers still compile; there is no per-tick state to advance. */
export function tickPaleHollowWeather(_dtSec: number): void {}

/** Kept for existing tests; nothing to reset. Drive time with paleHollowWeatherSnapshotAt(). */
export function resetPaleHollowWeatherForTest(_now?: number): void {}
