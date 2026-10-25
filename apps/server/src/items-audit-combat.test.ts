import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyEquipment } from "@bellgrave/items";
import { gearHealPotency, gearRegen, meleeAtkBonus, withHealPotency } from "./gear-combat";

describe("regen / healPotency gear hooks", () => {
  it("reads Heart Ring regen and healPotency", () => {
    const equip = { ...emptyEquipment(), ring: 1063 };
    assert.equal(gearRegen({ equip }), 1);
    assert.equal(gearHealPotency({ equip }), 5);
    assert.equal(withHealPotency({ equip }, 100), 105);
  });

  it("sums two ring slots", () => {
    const equip = { ...emptyEquipment(), ring: 1063, ring2: 1063 };
    assert.equal(gearRegen({ equip }), 2);
    assert.equal(gearHealPotency({ equip }), 10);
  });
});

describe("melee Atk bonus", () => {
  it("casters keep 10 base Atk plus gear Atk", () => {
    // Ashbeam Staff (1) has no atk; Bronze Mittens (105) +1
    const staffOnly = { ...emptyEquipment(), main: 1 };
    assert.equal(meleeAtkBonus({ equip: staffOnly }), 10);
    const staffMittens = { ...emptyEquipment(), main: 1, hands: 105 };
    assert.equal(meleeAtkBonus({ equip: staffMittens }), 11);
    // Horn Ring (333) +4 → 14
    const staffHorn = { ...emptyEquipment(), main: 1, ring: 333 };
    assert.equal(meleeAtkBonus({ equip: staffHorn }), 14);
  });

  it("weapon Atk stacks with gear; bows do not", () => {
    // Iron Sword (4) has atk; Heart Ring (1063) +6
    const sword = { ...emptyEquipment(), main: 4 };
    const swordAtk = meleeAtkBonus({ equip: sword });
    assert.ok(swordAtk >= 10);
    const withHeart = { ...emptyEquipment(), main: 4, ring: 1063 };
    assert.equal(meleeAtkBonus({ equip: withHeart }), swordAtk + 6);
    // Composite bow in ranged must not add (bows have no atk anyway)
    const withBow = { ...emptyEquipment(), main: 4, ranged: 186, ring: 1063 };
    assert.equal(meleeAtkBonus({ equip: withBow }), swordAtk + 6);
  });
});
