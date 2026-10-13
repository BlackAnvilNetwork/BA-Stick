//! E1 gold ledger: earn, daily caps, spend, day rollover, NPC sell.

use lok_engine::{
    gold_source_cap, Engine, EngineError, Gate, Input, Key, World, GOLD_DAILY_TOTAL_CAP,
    GOLD_MAX_DAY, GOLD_SOURCE_NPC_SELL, U256,
};

fn n(v: u64) -> U256 {
    U256::from_u64(v)
}

fn spawn(engine: &mut Engine, token: U256, job: u8) {
    engine
        .apply(Input::Spawn {
            token_id: token,
            starting_job: job,
        })
        .unwrap();
}

#[test]
fn gold_earn_spend_and_insufficient() {
    let token = n(1);
    let mut engine = Engine::open(token, 1);
    spawn(&mut engine, token, 1);

    engine
        .apply(Input::GoldEarn {
            token_id: token,
            source: "quest".into(),
            amount: n(100),
            day: 10,
        })
        .unwrap();
    assert_eq!(engine.state().get(&Key::Gold), n(100));

    engine
        .apply(Input::GoldSpend {
            token_id: token,
            sink: "trainer".into(),
            amount: n(40),
        })
        .unwrap();
    assert_eq!(engine.state().get(&Key::Gold), n(60));

    assert_eq!(
        engine
            .apply(Input::GoldSpend {
                token_id: token,
                sink: "craft".into(),
                amount: n(61),
            })
            .unwrap_err(),
        EngineError::InsufficientGold
    );
    assert_eq!(engine.state().get(&Key::Gold), n(60));
}

#[test]
fn gold_source_cap_and_total_cap() {
    let token = n(2);
    let mut engine = Engine::open(token, 1);
    spawn(&mut engine, token, 1);

    let quest_cap = gold_source_cap("quest");
    engine
        .apply(Input::GoldEarn {
            token_id: token,
            source: "quest".into(),
            amount: n(quest_cap),
            day: 1,
        })
        .unwrap();
    assert_eq!(
        engine
            .apply(Input::GoldEarn {
                token_id: token,
                source: "quest".into(),
                amount: n(1),
                day: 1,
            })
            .unwrap_err(),
        EngineError::EarnCap
    );

    // Fill the rest of the daily total via other sources (each has its own cap).
    let drop_cap = gold_source_cap("drop");
    let harvest_cap = gold_source_cap("harvest");
    engine
        .apply(Input::GoldEarn {
            token_id: token,
            source: "drop".into(),
            amount: n(drop_cap),
            day: 1,
        })
        .unwrap();
    let after_drop = quest_cap + drop_cap;
    let harvest_amt = GOLD_DAILY_TOTAL_CAP - after_drop;
    assert!(harvest_amt <= harvest_cap);
    engine
        .apply(Input::GoldEarn {
            token_id: token,
            source: "harvest".into(),
            amount: n(harvest_amt),
            day: 1,
        })
        .unwrap();
    assert_eq!(
        engine
            .apply(Input::GoldEarn {
                token_id: token,
                source: "misc".into(),
                amount: n(1),
                day: 1,
            })
            .unwrap_err(),
        EngineError::EarnCap
    );
    assert_eq!(engine.state().get(&Key::Gold), n(GOLD_DAILY_TOTAL_CAP));
}

#[test]
fn gold_day_rollover_resets_caps_stale_day_rejected() {
    let token = n(3);
    let mut engine = Engine::open(token, 1);
    spawn(&mut engine, token, 1);

    let quest_cap = gold_source_cap("quest");
    engine
        .apply(Input::GoldEarn {
            token_id: token,
            source: "quest".into(),
            amount: n(quest_cap),
            day: 5,
        })
        .unwrap();
    assert_eq!(
        engine
            .apply(Input::GoldEarn {
                token_id: token,
                source: "quest".into(),
                amount: n(1),
                day: 4,
            })
            .unwrap_err(),
        EngineError::StaleDay
    );

    engine
        .apply(Input::GoldEarn {
            token_id: token,
            source: "quest".into(),
            amount: n(50),
            day: 6,
        })
        .unwrap();
    assert_eq!(engine.state().get(&Key::Gold), n(quest_cap + 50));
    assert_eq!(engine.state().get(&Key::GoldDay), n(6));
    assert_eq!(engine.state().get(&Key::GoldEarnedDay), n(50));
}

#[test]
fn gold_sell_burns_item_and_credits_under_npc_sell_cap() {
    let token = n(4);
    let mut engine = Engine::open(token, 1);
    spawn(&mut engine, token, 1);
    let item = n(99);
    engine
        .apply(Input::BagImport {
            token_id: token,
            item_id: item,
            amount: n(3),
        })
        .unwrap();

    // Catalog id 99 is filler → unit 1 (npc_price_data from catalog).
    let unit = 1u64;
    engine
        .apply(Input::GoldSell {
            token_id: token,
            item_id: item,
            qty: n(2),
            amount: n(unit * 2),
            day: 1,
        })
        .unwrap();
    assert_eq!(engine.state().get(&Key::Item(item)), n(1));
    assert_eq!(engine.state().get(&Key::Gold), n(unit * 2));

    // Wrong price is rejected without burning.
    assert_eq!(
        engine
            .apply(Input::GoldSell {
                token_id: token,
                item_id: item,
                qty: n(1),
                amount: n(unit + 1),
                day: 1,
            })
            .unwrap_err(),
        EngineError::BadPrice
    );
    assert_eq!(engine.state().get(&Key::Item(item)), n(1));

    // Hit the npc_sell daily cap with a correctly priced large sell.
    let sell_cap = gold_source_cap(GOLD_SOURCE_NPC_SELL);
    let over_qty = sell_cap + 1; // unit=1 → 10001 > 10_000
    engine
        .apply(Input::BagImport {
            token_id: token,
            item_id: item,
            amount: n(over_qty),
        })
        .unwrap();
    assert_eq!(
        engine
            .apply(Input::GoldSell {
                token_id: token,
                item_id: item,
                qty: n(over_qty),
                amount: n(unit * over_qty),
                day: 1,
            })
            .unwrap_err(),
        EngineError::EarnCap
    );
    // Engine rolls back the whole apply.
    assert_eq!(engine.state().get(&Key::Item(item)), n(1 + over_qty));
    assert_eq!(engine.state().get(&Key::Gold), n(unit * 2));
}

#[test]
fn gate_gold_round_trip_replays() {
    let mut gate = Gate::open("").unwrap();
    assert!(cmd_ok(&mut gate, r#"{"op":"spawn","tokenId":"1","startingJob":2}"#));
    assert!(cmd_ok(
        &mut gate,
        r#"{"op":"goldEarn","tokenId":"1","source":"quest","amount":"200","day":7}"#
    ));
    assert!(cmd_ok(
        &mut gate,
        r#"{"op":"goldSpend","tokenId":"1","sink":"trainer","amount":"50"}"#
    ));
    let doc = gate.document_json();
    let mut again = Gate::open(&doc).unwrap();
    let state: serde_json::Value =
        serde_json::from_str(&again.apply_command(r#"{"op":"state"}"#)).unwrap();
    assert_eq!(state["state"]["characters"][0]["gold"], "150");
}

#[test]
fn world_gold_balance_after_earn() {
    let mut world = World::new();
    world.append_spawn(n(1), 2).unwrap();
    world
        .append_gold_earn(n(1), "quest".into(), n(200), 7)
        .unwrap();
    world
        .append_gold_spend(n(1), "trainer".into(), n(50))
        .unwrap();
    assert_eq!(world.gold_balance(&n(1)), Some(n(150)));
}

#[test]
fn bad_day_zero_rejected() {
    let token = n(5);
    let mut engine = Engine::open(token, 1);
    spawn(&mut engine, token, 1);
    assert_eq!(
        engine
            .apply(Input::GoldEarn {
                token_id: token,
                source: "quest".into(),
                amount: n(1),
                day: 0,
            })
            .unwrap_err(),
        EngineError::BadDay
    );
}

#[test]
fn day_above_max_rejected_and_does_not_lock_later_earns() {
    let token = n(6);
    let mut engine = Engine::open(token, 1);
    spawn(&mut engine, token, 1);
    for day in [GOLD_MAX_DAY + 1, u64::MAX] {
        assert_eq!(
            engine
                .apply(Input::GoldEarn {
                    token_id: token,
                    source: "quest".into(),
                    amount: n(1),
                    day,
                })
                .unwrap_err(),
            EngineError::BadDay
        );
        assert_eq!(
            engine
                .apply(Input::GoldSell {
                    token_id: token,
                    item_id: n(42),
                    qty: n(1),
                    amount: n(1),
                    day,
                })
                .unwrap_err(),
            EngineError::BadDay
        );
    }
    // The rejected huge day did not move GoldDay, so a normal day still earns.
    engine
        .apply(Input::GoldEarn {
            token_id: token,
            source: "quest".into(),
            amount: n(7),
            day: 20_737,
        })
        .unwrap();
    assert_eq!(engine.state().get(&Key::Gold), n(7));
    // The ceiling itself is accepted.
    engine
        .apply(Input::GoldEarn {
            token_id: token,
            source: "quest".into(),
            amount: n(1),
            day: GOLD_MAX_DAY,
        })
        .unwrap();
}

fn cmd_ok(gate: &mut Gate, cmd: &str) -> bool {
    serde_json::from_str::<serde_json::Value>(&gate.apply_command(cmd))
        .unwrap()["ok"]
        .as_bool()
        .unwrap()
}
