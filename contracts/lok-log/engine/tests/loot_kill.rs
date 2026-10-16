//! A new loot drop names a kill already on that character's log.
//! ItemDrop stays ClosedMint. A line below the sequence cutoff still replays.

use lok_engine::{
    entry_hash, genesis_root, load_world, set_loot_kill_min_seq, CharacterLogDocument, EngineError,
    Input, ReplayStop, U256, World, WorldDocument, LoggedEntry, HISTORICAL_LOOT_KILL_MIN_SEQ_LEGACY,
};

fn n(v: u64) -> U256 {
    U256::from_u64(v)
}

struct LootCutoffGuard;
impl Drop for LootCutoffGuard {
    fn drop(&mut self) {
        set_loot_kill_min_seq(HISTORICAL_LOOT_KILL_MIN_SEQ_LEGACY);
    }
}

fn kill(world: &mut World, token: U256) -> u64 {
    let event = world
        .apply(Input::Kill {
            token_id: token,
            mob_id: "hare".into(),
        })
        .expect("kill appends");
    event.links.iter().find(|link| link.token_id == token).expect("kill link").index
}

#[test]
fn a_new_drop_names_a_real_kill_and_does_not_mint() {
    let mut world = World::new();
    world.append_spawn(n(1), 0).unwrap();
    let kill_index = kill(&mut world, n(1));
    world
        .apply(Input::LootDrop {
            token_id: n(1),
            item_id: n(7),
            amount: n(2),
            kill_index: Some(kill_index),
        })
        .unwrap();
    assert_eq!(world.dropped(&n(1), &n(7)), Some(n(2)));
    assert_eq!(world.item_balance(&n(1), &n(7)), Some(U256::ZERO));
    assert_eq!(world.gold_balance(&n(1)), Some(U256::ZERO));

    let again = load_world(&world.to_document()).expect("kill and drop replay");
    assert_eq!(again.dropped(&n(1), &n(7)), Some(n(2)));
    assert_eq!(again.item_balance(&n(1), &n(7)), Some(U256::ZERO));
    assert_eq!(again.head(), world.head());
}

#[test]
fn a_new_drop_without_a_kill_is_refused() {
    let mut world = World::new();
    world.append_spawn(n(1), 0).unwrap();
    let len = world.len();
    let head = world.head();
    assert_eq!(
        world
            .apply(Input::LootDrop {
                token_id: n(1),
                item_id: n(7),
                amount: n(1),
                kill_index: None,
            })
            .unwrap_err(),
        EngineError::MissingKill
    );
    assert_eq!(
        world
            .apply(Input::LootDrop {
                token_id: n(1),
                item_id: n(7),
                amount: n(1),
                kill_index: Some(0),
            })
            .unwrap_err(),
        EngineError::MissingKill
    );
    assert_eq!(world.len(), len);
    assert_eq!(world.head(), head);
    assert_eq!(world.dropped(&n(1), &n(7)), Some(U256::ZERO));
    assert_eq!(world.item_balance(&n(1), &n(7)), Some(U256::ZERO));
}

#[test]
fn item_drop_stays_closed_mint() {
    let mut world = World::new();
    world.append_spawn(n(1), 0).unwrap();
    let _kill_index = kill(&mut world, n(1));
    let len = world.len();
    assert_eq!(
        world
            .apply(Input::ItemDrop {
                token_id: n(1),
                item_id: n(7),
                amount: n(1),
            })
            .unwrap_err(),
        EngineError::ClosedMint
    );
    assert_eq!(world.len(), len);
    assert_eq!(world.item_balance(&n(1), &n(7)), Some(U256::ZERO));
    assert_eq!(world.dropped(&n(1), &n(7)), Some(U256::ZERO));
}

#[test]
fn an_old_log_line_without_a_kill_still_replays() {
    set_loot_kill_min_seq(HISTORICAL_LOOT_KILL_MIN_SEQ_LEGACY);
    let _restore = LootCutoffGuard;

    let spawn = Input::Spawn {
        token_id: n(1),
        starting_job: 0,
    };
    let drop = Input::LootDrop {
        token_id: n(1),
        item_id: n(7),
        amount: n(2),
        kill_index: None,
    };
    let h0 = entry_hash(&genesis_root(&n(1), 0), 0, &spawn, &[0u8; 32]);
    let h1 = entry_hash(&h0, 1, &drop, &[0u8; 32]);
    let doc = WorldDocument {
        characters: vec![CharacterLogDocument {
            token_id: n(1),
            starting_job: 0,
            entries: vec![
                LoggedEntry {
                    hash: h0,
                    input: spawn,
                    seq: 0,
                    ruleset_hash: [0u8; 32],
                },
                LoggedEntry {
                    hash: h1,
                    input: drop,
                    seq: 10,
                    ruleset_hash: [0u8; 32],
                },
            ],
        }],
    };
    let loaded = load_world(&doc).expect("pre-cutoff loot drop replays");
    assert_eq!(loaded.dropped(&n(1), &n(7)), Some(n(2)));
    assert_eq!(loaded.item_balance(&n(1), &n(7)), Some(U256::ZERO));

    let late = Input::LootDrop {
        token_id: n(2),
        item_id: n(7),
        amount: n(1),
        kill_index: None,
    };
    let spawn2 = Input::Spawn {
        token_id: n(2),
        starting_job: 0,
    };
    let g0 = entry_hash(&genesis_root(&n(2), 0), 0, &spawn2, &[0u8; 32]);
    let g1 = entry_hash(&g0, 1, &late, &[0u8; 32]);
    let post = WorldDocument {
        characters: vec![CharacterLogDocument {
            token_id: n(2),
            starting_job: 0,
            entries: vec![
                LoggedEntry {
                    hash: g0,
                    input: spawn2,
                    seq: 0,
                    ruleset_hash: [0u8; 32],
                },
                LoggedEntry {
                    hash: g1,
                    input: late,
                    seq: HISTORICAL_LOOT_KILL_MIN_SEQ_LEGACY,
                    ruleset_hash: [0u8; 32],
                },
            ],
        }],
    };
    match load_world(&post) {
        Err(ReplayStop::Rejected {
            reason: EngineError::MissingKill,
            ..
        }) => {}
        other => panic!("post-cutoff loot drop without a kill must fail: {other:?}"),
    }
}
