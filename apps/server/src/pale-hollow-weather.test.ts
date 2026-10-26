import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PH_SNOW_ACCUM_SEC, PH_SNOW_MELT_SEC, PH_WEATHER_CYCLE_MS } from "@bellgrave/config";
import { paleHollowWeatherSnapshotAt } from "./pale-hollow-weather";

describe("pale hollow weather snapshot", () => {
  it("snow cover grows from zero at spell start", () => {
    const t0 = 5 * PH_WEATHER_CYCLE_MS;
    const snap = paleHollowWeatherSnapshotAt(t0);
    if (snap.kind !== "snow") return;
    const half = paleHollowWeatherSnapshotAt(t0 + (PH_SNOW_ACCUM_SEC * 1000) / 2);
    assert.equal(half.kind, "snow");
    assert.ok(half.snowCover > 0.4 && half.snowCover < 0.6);
  });

  it("melts after snow when the next spell is not snow", () => {
    for (let idx = 1; idx < 40; idx++) {
      const start = idx * PH_WEATHER_CYCLE_MS;
      const prev = paleHollowWeatherSnapshotAt(start - 1);
      const now = paleHollowWeatherSnapshotAt(start);
      if (prev.kind === "snow" && now.kind !== "snow") {
        const mid = paleHollowWeatherSnapshotAt(start + (PH_SNOW_MELT_SEC * 1000) / 2);
        assert.ok(mid.snowCover > 0.4 && mid.snowCover < 0.6, "mid-melt cover");
        const end = paleHollowWeatherSnapshotAt(start + PH_SNOW_MELT_SEC * 1000);
        assert.equal(end.snowCover, 0);
        return;
      }
    }
    assert.fail("no snow→non-snow transition in first 40 spells");
  });
});
