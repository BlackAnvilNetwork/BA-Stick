import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyEquipment } from "@bellgrave/items";
import { gearHealPotency, gearRegen } from "./gear-combat";

describe("regen / healPotency gear hooks", () => {
  it("reads Heart Ring regen and healPotency", () => {
    const equip = { ...emptyEquipment(), ring: 1063 };
    assert.equal(gearRegen({ equip }), 1);
    assert.equal(gearHealPotency({ equip }), 5);
  });

  it("sums across slots", () => {
    const equip = { ...emptyEquipment(), ring: 1063 };
    assert.equal(gearRegen({ equip }), 1);
  });
});
