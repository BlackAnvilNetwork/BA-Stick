# Known and deferred world-check items

These show up in the anchor check and in New Bot's validation guard. They are expected
on `feat/world-mayflower` / `feat/seam-country` and are **not** to be fixed in those PRs.

## Forest Basin (the Hush Wood) — deferred to #139

Forest Basin is deliberately left exactly as `main` has it. Macks's map builder (#139)
blanks that basin and rebuilds it with the spell-book world tools, so the world pass does
not restore the older Hush Wood content (commit d2a9bcf).

Expected consequences, all deferred to #139:

- **Frozen-terrain drift.** The basin's walk/height/biome grids differ from the frozen
  run-13 bake (about 57,000 walkable cells now blocked). Guard: "N1 Hush Wood terrain revert".
- **Blocked gates.** The North Pass and the West, North-west and South-west Gaps report
  `WARN gate blocked` in `tools/check-anchors.ts` (labelled as known).
- **Hush Wood POIs withdrawn.** Its six POIs are not in `world-pois.ts`; the Drowned Spoke
  fragment stays in `UNPLACED_FRAGMENTS`.
- **Hush Ring warp circle (−6, −112) is an orphan.** No branch code references it; it only
  appears in the stale generated bake / `validation.json`, where its disc is mostly
  unwalkable. Do not wire it until the basin is rebuilt in #139.

Re-check all of the above after #139 lands.
