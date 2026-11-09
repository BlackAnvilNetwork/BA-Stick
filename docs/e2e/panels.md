# Panel parity check (#16)

`panels.mjs` runs headless Chrome against stick-web on the local server (anvil dev config). It records every outgoing websocket message and the server log, and saves panel screenshots.

| Action | Message sent from stick-web | Server reply (log) |
|---|---|---|
| Equip / unequip (Character → Paperdoll) | `equip` | slot updated (see #37 preview) |
| Skill tree unlock | `skill/unlock {nodeId:"time_mage_1"}` | "Skill: Chrona Repose — Rest restores more. (74 points left)" |
| Spell trainer | `npc/interact` → trainer list | "Nothing available" at L1; all learned after Max Lv |
| Job Master → Change Main / Change Alt | `job/change` then `job/subjob` | main sprite stays; alt is L10+ support |
| Crafting | panel lists recipes with material/gold gating | Craft click only when `nearCrafter` (Brann in the Eightfold); skip otherwise |
| Spellbook | toggles, abilities listed per category | n/a |

The panels are the shared `@bellgrave/ui` components, the same ones the legacy client uses. stick-web sends the same protocol messages through the same `client-core/net`, so the rules are identical by construction.
