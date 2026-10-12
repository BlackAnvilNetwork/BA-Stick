//! NPC buyback unit prices (gold). Shared formula with `packages/items` / server.
//!
//! Sell amount must equal `unit * qty`. A replayer can reject an over-paid sell.

use crate::u256::U256;

/// Gold paid per item when sold to the Provisioner NPC.
///
/// Catalog `recipe.gold` is uniformly 1000 today, so prices are derived from
/// item-id bands (kind/tier) instead of craft cost. Keep in sync with
/// `npcSellUnitGold` in `packages/items/src/npc-sell.ts`.
pub fn npc_sell_unit_price(item_id: u64) -> Option<u64> {
    if item_id == 0 {
        return None;
    }
    // Base materials (catalog ~486–1061, also lower mats mixed in 1–100 range for some).
    // Prefer kind-like bands used across the catalog:
    // - filler/bait-ish mid ids → low
    // - intermediate → mid
    // - equipment → higher by tier
    let unit = match item_id {
        // Early equipment / weapons / armor (ids 1–99): mid gear
        1..=99 => 40 + (item_id % 20),
        // Consumables / small gear (100–299)
        100..=299 => 25 + (item_id % 15),
        // Mid crafted / intermediates (300–485)
        300..=485 => 35 + (item_id % 25),
        // Base materials (486–1061)
        486..=1061 => 2 + (item_id % 5),
        // Anything else catalogued later
        _ => 10 + (item_id % 30),
    };
    Some(unit.max(1))
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
    fn prices_are_positive_and_stable() {
        assert_eq!(npc_sell_unit_price(0), None);
        assert!(npc_sell_unit_price(1).unwrap() >= 1);
        assert_eq!(npc_sell_unit_price(500), Some(2 + (500 % 5)));
        assert_eq!(
            npc_sell_total(&U256::from_u64(500), &U256::from_u64(3)),
            Some(U256::from_u64((2 + (500 % 5)) * 3))
        );
    }
}
