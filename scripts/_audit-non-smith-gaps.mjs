import { readFileSync } from "node:fs";

const cat = JSON.parse(readFileSync(new URL("../packages/items/src/catalog.json", import.meta.url), "utf8"));
const eq = cat.filter(
  (i) =>
    i.kind === "equipment" &&
    ["clothcraft", "leathercraft", "bonecraft", "goldsmithing"].includes(i.craftSkill),
);
const bands = [
  [20, 24],
  [25, 28],
  [29, 34],
  [35, 40],
  [41, 50],
  [51, 60],
];
const slots = ["head", "body", "hands", "legs", "feet", "ring", "earring", "sub"];
console.log("max id", Math.max(...cat.map((i) => i.id)));
console.log("non-smith equip", eq.length);
for (const [a, b] of bands) {
  const items = eq.filter((i) => (i.craftLevel ?? 0) >= a && (i.craftLevel ?? 0) <= b);
  console.log("\n=== " + a + "-" + b + " (" + items.length + ") ===");
  for (const s of slots) {
    const rows = items
      .filter((i) => i.slot === s)
      .map((i) => i.id + " " + i.slug + " L" + i.craftLevel + " " + i.craftSkill + " " + i.rarity);
    console.log(" " + s + ": " + (rows.join(" | ") || "(none)"));
  }
}
for (const sk of ["clothcraft", "leathercraft", "bonecraft", "goldsmithing"]) {
  const lvls = new Set(eq.filter((i) => i.craftSkill === sk).map((i) => i.craftLevel));
  const missing = [];
  for (let L = 20; L <= 60; L++) if (!lvls.has(L)) missing.push(L);
  console.log("\n" + sk + " missing 20-60:", missing.join(","));
}
