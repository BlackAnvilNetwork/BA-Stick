//! NPC buyback unit prices (gold). Derived from the item catalog (kind / craftLevel /
//! recipe.gold). Keep in sync via `scripts/gen-npc-prices.mjs` and
//! `packages/items/src/npc-sell.ts`.

use crate::npc_price_data::NPC_SELL_UNITS;
use crate::u256::U256;

/// Gold paid per item when sold to the Provisioner NPC.
pub fn npc_sell_unit_price(item_id: u64) -> Option<u64> {
    if item_id == 0 {
        return None;
    }
    let mut lo = 0usize;
    let mut hi = NPC_SELL_UNITS.len();
    while lo < hi {
        let mid = (lo + hi) / 2;
        let (id, unit) = NPC_SELL_UNITS[mid];
        if id == item_id {
            return Some(unit.max(1));
        }
        if id < item_id {
            lo = mid + 1;
        } else {
            hi = mid;
        }
    }
    None
}

fn as_u64(raw: &U256) -> Option<u64> {
    if raw.0[..24].iter().any(|&b| b != 0) {
        return None;
    }
    Some(u64::from_be_bytes(raw.0[24..].try_into().ok()?))
}

pub fn npc_sell_total(item_id: &U256, qty: &U256) -> Option<U256> {
    let id = as_u64(item_id)?;
    let unit = npc_sell_unit_price(id)?;
    let q = as_u64(qty)?;
    let total = (unit as u128).checked_mul(q as u128)?;
    if total > u64::MAX as u128 {
        return None;
    }
    Some(U256::from_u64(total as u64))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn catalog_prices_by_kind() {
        assert_eq!(npc_sell_unit_price(0), None);
        // equipment id 1
        assert!(npc_sell_unit_price(1).unwrap() >= 15);
        // consumable id 3 — unit tracks recipe gold / 50 (Potion L5 → 150g → 3)
        assert_eq!(npc_sell_unit_price(3), Some(3));
        // filler-ish mid catalog — must not be 40+ band arithmetic
        // base material 486 (Pale Flax)
        assert_eq!(npc_sell_unit_price(486), Some(2));
        assert_eq!(
            npc_sell_total(&U256::from_u64(486), &U256::from_u64(3)),
            Some(U256::from_u64(6))
        );
    }
}
