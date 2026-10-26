import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PH_DAY_CYCLE_MS,
  paleHollowDayPhaseAt,
  PH_WEATHER_CYCLE_MS,
  PH_WEATHER_SEED_XOR,
  PH_WEATHER_WEIGHTS,
  paleHollowWeatherKindAt,
  rollPaleHollowWeather,
} from "./pale-hollow-weather.ts";

describe("pale hollow weather", () => {
  it("weights sum to 100", () => {
    const sum = PH_WEATHER_WEIGHTS.reduce((a, r) => a + r.weight, 0);
    assert.equal(sum, 100);
  });

  it("roll is stable for a seed", () => {
    assert.equal(rollPaleHollowWeather(42), rollPaleHollowWeather(42));
  });

  it("covers every kind over seeds", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) seen.add(rollPaleHollowWeather(i));
    for (const row of PH_WEATHER_WEIGHTS) assert.equal(seen.has(row.kind), true, row.kind);
  });

  it("cycle seed xor avoids always opening on snow", () => {
    assert.notEqual(rollPaleHollowWeather(0), rollPaleHollowWeather(PH_WEATHER_SEED_XOR >>> 0));
    const kinds = new Set<string>();
    for (let c = 0; c < 24; c++) {
      kinds.add(paleHollowWeatherKindAt(c * PH_WEATHER_CYCLE_MS));
    }
    assert.equal(kinds.has("snow"), true);
    assert.notEqual(kinds.size, 1, "wall-clock cycles should not repeat one kind forever");
  });

  it("day phase wraps once per day cycle", () => {
    assert.equal(paleHollowDayPhaseAt(0), 0);
    assert.equal(paleHollowDayPhaseAt(PH_DAY_CYCLE_MS / 2), 0.5);
    assert.equal(paleHollowDayPhaseAt(PH_DAY_CYCLE_MS * 3 + PH_DAY_CYCLE_MS / 4), 0.25);
    assert.equal(PH_DAY_CYCLE_MS % PH_WEATHER_CYCLE_MS, 0);
  });
});
