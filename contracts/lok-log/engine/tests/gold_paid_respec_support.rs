//! Support review (acd4d6f): GoldPaidRespec had no engine test. These pin atomicity and replay.

use lok_engine::{replay_world, EngineError, Input, U256, World};

fn n(v: u64) -> U256 {
    U256::from_u64(v)
}

fn setup() -> World {
    let mut world = World::new();
    world.append_spawn(n(1), 1).unwrap();
    world
        .apply(Input::LearnAbility { token_id: n(1), ability_id: "node_a".into() })
        .unwrap();
    world
}

#[test]
fn gold_paid_respec_short_gold_changes_nothing() {
    let mut world = setup();
    world.append_gold_earn(n(1), "quest".into(), n(50), 10).unwrap();
    let before_len = world.to_document();
    let err = world
        .apply(Input::GoldPaidRespec { token_id: n(1), amount: n(100), node_ids: vec!["node_a".into()] })
        .unwrap_err();
    assert_eq!(err, EngineError::InsufficientGold);
    assert_eq!(world.gold_balance(&n(1)), Some(n(50)));
    assert!(world.abilities_of(&n(1)).iter().any(|a| a == "node_a"), "tree must stay intact");
    assert_eq!(
        format!("{:?}", world.to_document()),
        format!("{:?}", before_len),
        "a refused respec appends nothing"
    );
}

#[test]
fn gold_paid_respec_debits_and_clears_in_one_entry_and_replays() {
    let mut world = setup();
    world.append_gold_earn(n(1), "quest".into(), n(150), 10).unwrap();
    world.append_gold_paid_respec(n(1), n(100), vec!["node_a".into()]).unwrap();
    assert_eq!(world.gold_balance(&n(1)), Some(n(50)));
    assert!(!world.abilities_of(&n(1)).iter().any(|a| a == "node_a"));
    replay_world(&world.to_document()).expect("GoldPaidRespec replays");
}