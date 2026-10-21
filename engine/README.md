# engine/

- `stick-engine/` is a **git subtree** of BlackAnvilNetwork/stick-engine. Don't edit it here (see CONTRIBUTING.md).
- `ba-stick-render/` is the Black Anvil renderer crate. It holds a `Scene` of server units (id, x/y/z, facing, `anim`, rig preset) drawn as procedural stick figures, plus a wasm `StickRenderer` for the browser.

```bash
cargo test --manifest-path engine/Cargo.toml   # native unit tests
./engine/build-wasm.sh                         # -> engine/ba-stick-render/pkg (ESM, --target web)
```

## JS API (`StickRenderer`)
| Method | Purpose |
|---|---|
| `new StickRenderer(canvas, w, h)` | attach to a canvas; framebuffer `w×h` (default 640×360) |
| `setCamera(x, z)` / `follow(id \| undefined)` | camera position or follow a unit |
| `upsertUnit(id, x, y, z, facing, anim, preset)` | `anim`: idle/walk/run/melee/cast/rest/dead; `preset`: job id, `npc:<role>`, `mob:<archetype>`, optional `/female` or `/pepeka` |
| `removeUnit(id)` / `unitCount()` | |
| `tick(dt)` | interpolation and animation |
| `draw()` | render and blit |
| `pickWorld(sx, sy)` → `[x, z]`, `pickUnit(sx, sy)` → id | picking in framebuffer pixels |
