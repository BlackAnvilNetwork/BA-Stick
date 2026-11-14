# Anvilhold distant overview shot

**After every castle pass**, capture this same framed overview and save it as:

- Latest: `docs/maps/anvilhold-castle/distant-overview.png`
- Archive: `docs/maps/anvilhold-castle/passes/<UTC-stamp>-distant.png`
- Artifacts copy: `/opt/cursor/artifacts/anvilhold-distant-overview.png`

## Locked camera (do not freestyle)

| Setting | Value |
|---------|--------|
| URL | `http://localhost:3000/?demo&zone=ashen_bastion&x=0&z=2158&nomap&t=0.2` |
| Mode | `iso` |
| Focus (world) | `setCamera(0, 2158)` — courtyard centre (`origin_z` 2140 + 18) |
| Zoom | `setZoom(0.15)` |
| Draw distance | `setDrawDistance(1)` |
| Atmosphere | `setAtmosphereAmount(0)` + `setAtmosphere(false)` if present |
| Units | Remove demo cast (`player:knight` / mage / rogue / `npc:vendor` / `mob:guard`); cancel RAF |
| Meshes | Keep zone BAM loaded (`placeAllZones` / `loadMeshes`); empty bank only if draw freezes |

## Capture recipe (Playwright / agent)

1. Ensure Vite is on **:3000** and `public/zones/ashen_bastion.baz` + `.bam` exist.
2. Navigate to the URL above (cache-bust query ok).
3. Wait for `window.__stickReady`, then ~3s for `placeAllZones`.
4. Evaluate:

```js
async () => {
  const r = window.__stick.r;
  const origin = { x: 0, z: 2140 };
  const bam = new Uint8Array(await (await fetch("/zones/ashen_bastion.bam", { cache: "no-store" })).arrayBuffer());
  if (r.placeMeshes) r.placeMeshes(bam, origin.x, origin.z);
  else if (r.loadMeshes) r.loadMeshes(bam, origin.x, origin.z);
  const id = requestAnimationFrame(() => {});
  for (let i = 0; i <= id + 120; i++) cancelAnimationFrame(i);
  const units = ["player:knight","player:mage","player:rogue","npc:vendor","mob:guard"];
  units.forEach((u) => r.removeUnit(u));
  r.setCamMode("iso");
  r.setDrawDistance(1);
  r.setAtmosphereAmount(0);
  if (r.setAtmosphere) r.setAtmosphere(false);
  if (r.setKeylight) r.setKeylight(true);
  r.setZoom(0.15);
  r.setCamera(0, 2158);
  for (let i = 0; i < 18; i++) {
    units.forEach((u) => r.removeUnit(u));
    r.tick(1 / 30);
  }
  units.forEach((u) => r.removeUnit(u));
  r.draw();
  return { keepY: r.zoneHeight(0, 2180), bamBytes: bam.length };
}
```

5. Screenshot viewport → paths above (`scale: css`, png).
6. Show the latest `distant-overview.png` in the agent reply.

## Notes

- Heightfield alone still reads the curtain footprint; SDF BAM should stay loaded so walls/houses appear when draw budget allows.
- Do not change zoom/camera between passes — compare apples to apples against `01-current-heightfield.png` and `04-target-full-build.png`.
