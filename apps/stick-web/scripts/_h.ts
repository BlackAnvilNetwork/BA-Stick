import { PH_BRIDGE_SITES, paleHollowBridgeGeom, paleHollowStandHeight } from "@bellgrave/config";
for (const s of PH_BRIDGE_SITES) { const g = paleHollowBridgeGeom(s); console.log(s.id, "L", g.leftY.toFixed(2), "R", g.rightY.toFixed(2), "arch", g.arch.toFixed(2), "deck", g.deckY.toFixed(2), "water", g.waterY.toFixed(2), "span", g.span.toFixed(1), "slope", (g.arch / (g.span * 0.3)).toFixed(2)); }
