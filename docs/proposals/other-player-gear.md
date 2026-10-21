# Proposal: other players' gear in snapshots (#14)

**Status:** proposal only. The protocol and server are unchanged.

Today only `you.equip` is sent, so stick-web can dress the local figure (`apps/stick-web/src/gear.ts`), but every other player is drawn with their job's default look.

## Proposed additive field

```ts
// UnitSnapshot (players only), optional, so old clients ignore it
gearLook?: [main: number, body: number, head: number, legs: number]; // catalog ids, 0 = empty
```

- **Size:** 4 small ints per player. It changes only on equip, so it can be delta-skipped.
- **Privacy:** only visual slots. Rings, earrings and other stat-only slots are never sent.
- **Client:** `gearArgs({ main, body, head, legs }, getItem)` → `r.setGear(id, ...)`. That is the same path as the local player, so looks are seed-identical for everyone.
- **Gameplay:** none. The renderer's look is cosmetic, and the server stays authoritative.
