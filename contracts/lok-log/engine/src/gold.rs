//! In-game gold: log-only balance, daily earn caps, no vault and no Send.
//!
//! Placeholder caps until the E5 budget sheet lands. Sources are printable labels
//! (same rules as ability ids). `npc_sell` is the GoldSell earn source.

use crate::state::{label_key, Key, State};
use crate::u256::U256;

/// Total gold a character may earn in one server day (all sources).
pub const GOLD_DAILY_TOTAL_CAP: u64 = 50_000;

/// Largest accepted server day id (UTC days since 1970-01-01; ~year 2243).
///
/// The day is server-stamped and not verifiable by a replayer. A higher day
/// rolls the daily earn counters, so caps only bind an honest server clock (see
/// CONTRACTS.md, "Gold day is server-trusted"). This ceiling only stops a single
/// huge day from parking `GoldDay` near `u64::MAX` and locking every later earn
/// on that character behind `StaleDay`.
pub const GOLD_MAX_DAY: u64 = 100_000;

/// Earn source used by `GoldSell`.
pub const GOLD_SOURCE_NPC_SELL: &str = "npc_sell";

/// Restores a craft fee after the log refuses the Craft. Not a faucet:
/// it can only return gold previously spent on the `craft` sink, and it does
/// not count against per-source or daily earn caps.
pub const GOLD_SOURCE_CRAFT_REFUND: &str = "craft_refund";

/// Gold spend sink the server uses for crafting. Only this sink is refundable.
pub const GOLD_SINK_CRAFT: &str = "craft";

const LABEL_MAX: usize = 128;

/// Per-source daily earn cap. Unknown sources get the default.
/// `craft_refund` is not an earn; [`credit_earn`] bounds it by unrefunded craft spends.
pub fn gold_source_cap(source: &str) -> u64 {
    match source {
        "quest" => 20_000,
        "drop" => 15_000,
        "harvest" => 15_000,
        GOLD_SOURCE_NPC_SELL => 10_000,
        _ => 5_000,
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum GoldError {
    ZeroAmount,
    Overflow,
    InsufficientGold,
    InsufficientItem,
    EarnCap,
    StaleDay,
    BadDay,
    BadId,
    /// NPC sell amount does not match the engine price table.
    BadPrice,
}

fn parse_source(raw: &str) -> Result<&str, GoldError> {
    if raw.is_empty() || raw.len() > LABEL_MAX {
        return Err(GoldError::BadId);
    }
    if !raw.bytes().all(|b| (0x20..=0x7e).contains(&b)) {
        return Err(GoldError::BadId);
    }
    Ok(raw)
}

fn day_u64(raw: &U256) -> u64 {
    u64::from_be_bytes(raw.0[24..].try_into().expect("8 bytes"))
}

/// Credit gold from a faucet. `day` is a server-stamped day id (non-zero).
/// A higher day rolls counters; a lower day is rejected; a day above
/// [`GOLD_MAX_DAY`] is rejected as `BadDay`.
pub fn credit_earn(state: &mut State, source: &str, amount: U256, day: u64) -> Result<(), GoldError> {
    parse_source(source)?;
    if day == 0 || day > GOLD_MAX_DAY {
        return Err(GoldError::BadDay);
    }
    if amount == U256::ZERO {
        return Err(GoldError::ZeroAmount);
    }

    // A craft refund restores a prior craft spend. It skips earn caps, and it
    // cannot credit gold that was never spent on the craft sink.
    if source == GOLD_SOURCE_CRAFT_REFUND {
        let have = state.get(&Key::GoldCraftRefundable);
        let left = have.checked_sub(amount).ok_or(GoldError::EarnCap)?;
        let next_bal = state.get(&Key::Gold).checked_add(amount).ok_or(GoldError::Overflow)?;
        roll_day(state, day)?;
        state.set_gold_craft_refundable(left);
        state.set_gold(next_bal);
        return Ok(());
    }

    roll_day(state, day)?;

    let source_key = label_key(source);
    let source_cap = U256::from_u64(gold_source_cap(source));
    let total_cap = U256::from_u64(GOLD_DAILY_TOTAL_CAP);

    let earned_source = state.get(&Key::GoldEarnedSource(source_key));
    let next_source = earned_source.checked_add(amount).ok_or(GoldError::Overflow)?;
    if next_source > source_cap {
        return Err(GoldError::EarnCap);
    }

    let earned_day = state.get(&Key::GoldEarnedDay);
    let next_day = earned_day.checked_add(amount).ok_or(GoldError::Overflow)?;
    if next_day > total_cap {
        return Err(GoldError::EarnCap);
    }

    let next_bal = state.get(&Key::Gold).checked_add(amount).ok_or(GoldError::Overflow)?;
    state.set_gold(next_bal);
    state.set_gold_earned_day(next_day);
    state.set_gold_earned_source(source_key, next_source);
    Ok(())
}

fn roll_day(state: &mut State, day: u64) -> Result<(), GoldError> {
    let current_day = day_u64(&state.get(&Key::GoldDay));
    if current_day == 0 || day > current_day {
        state.clear_gold_earn_counters();
        state.set_gold_day(day);
    } else if day < current_day {
        return Err(GoldError::StaleDay);
    }
    Ok(())
}

/// Debit spendable gold. A `craft` sink increases the refundable counter so a
/// later `craft_refund` can restore that amount and nothing more.
pub fn debit_spend_for(state: &mut State, sink: &str, amount: U256) -> Result<(), GoldError> {
    parse_source(sink)?;
    if sink == GOLD_SINK_CRAFT {
        state
            .get(&Key::GoldCraftRefundable)
            .checked_add(amount)
            .ok_or(GoldError::Overflow)?;
    }
    debit_spend(state, amount)?;
    if sink == GOLD_SINK_CRAFT {
        let next = state
            .get(&Key::GoldCraftRefundable)
            .checked_add(amount)
            .ok_or(GoldError::Overflow)?;
        state.set_gold_craft_refundable(next);
    }
    Ok(())
}

pub fn debit_spend(state: &mut State, amount: U256) -> Result<(), GoldError> {
    if amount == U256::ZERO {
        return Err(GoldError::ZeroAmount);
    }
    let next = state
        .get(&Key::Gold)
        .checked_sub(amount)
        .ok_or(GoldError::InsufficientGold)?;
    state.set_gold(next);
    Ok(())
}

/// Burn `qty` of `item_id` and credit `amount` gold under the npc_sell earn cap for `day`.
///
/// `amount` must equal the engine NPC price table (`npc_sell_unit_price * qty`).
/// A replayer rejects an over- or under-paid sell as `BadPrice`.
pub fn sell_item(
    state: &mut State,
    item_id: U256,
    qty: U256,
    amount: U256,
    day: u64,
) -> Result<(), GoldError> {
    if item_id == U256::ZERO {
        return Err(GoldError::BadId);
    }
    // Check the day before burning the item, so a bad day never half-applies.
    if day == 0 || day > GOLD_MAX_DAY {
        return Err(GoldError::BadDay);
    }
    if qty == U256::ZERO || amount == U256::ZERO {
        return Err(GoldError::ZeroAmount);
    }
    let expected = crate::npc_price::npc_sell_total(&item_id, &qty).ok_or(GoldError::BadPrice)?;
    if amount != expected {
        return Err(GoldError::BadPrice);
    }
    let next_item = state
        .get(&Key::Item(item_id))
        .checked_sub(qty)
        .ok_or(GoldError::InsufficientItem)?;
    state.set_item(item_id, next_item);
    credit_earn(state, GOLD_SOURCE_NPC_SELL, amount, day)
}
