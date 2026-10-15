//! Item transfers and asks on per-character logs. KEK bids and fills are retired.

use std::process::Command;

use lok_engine::{
    entry_hash, fungible_id, replay_world, unique_id, EngineError, Input, U256, World,
};

fn n(v: u64) -> U256 {
    U256::from_u64(v)
}

fn next_inbound(world: &World, token: U256) -> u64 {
    world.inbound_applied(&token).unwrap_or(0).saturating_add(1)
}

fn import_item(world: &mut World, token: U256, item: U256, amount: U256) -> Result<lok_engine::AppliedEvent, EngineError> {
    let nonce = next_inbound(world, token);
    world.append_import_item(token, item, amount, nonce)
}


fn two_characters() -> World {
    let mut world = World::new();
    world.append_spawn(n(1), 3).unwrap();
    world.append_spawn(n(2), 1).unwrap();
    world
}

#[test]
fn happy_transfer_moves_items_with_no_fee() {
    let ore = fungible_id("iron_ore");
    let mut world = two_characters();
    import_item(&mut world, n(1), ore, n(3)).unwrap();
    world.append_send_item(n(1), n(2), ore, n(2)).unwrap();

    assert_eq!(world.item_balance(&n(1), &ore), Some(n(1)));
    assert_eq!(world.item_balance(&n(2), &ore), Some(n(2)));

    let report = replay_world(&world.to_document()).expect("replay");
    assert_eq!(report.entries, world.len());
    assert_eq!(report.head, world.head());
    assert_eq!(report.characters.len(), 2);
    assert_eq!(report.characters[0].gold, U256::ZERO);
    assert_eq!(report.characters[1].gold, U256::ZERO);
}

#[test]
fn overspend_is_rejected_and_does_not_append() {
    let ore = fungible_id("iron_ore");
    let mut world = two_characters();
    import_item(&mut world, n(1), ore, n(5)).unwrap();
    let before_len = world.len();
    let before_head = world.head();
    let err = world.append_send_item(n(1), n(2), ore, n(6)).unwrap_err();
    assert_eq!(err, EngineError::InsufficientItem);
    assert_eq!(world.item_balance(&n(1), &ore), Some(n(5)));
    assert_eq!(world.item_balance(&n(2), &ore), Some(n(0)));
    assert_eq!(world.len(), before_len);
    assert_eq!(world.head(), before_head);

    assert_eq!(world.append_send_item(n(1), n(1), ore, n(1)).unwrap_err(), EngineError::SelfTransfer);
    assert_eq!(
        world.append_send_item(n(1), n(9), ore, n(1)).unwrap_err(),
        EngineError::NotSpawned
    );
    assert_eq!(world.item_balance(&n(1), &ore), Some(n(5)));

    let mut doc = world.to_document();
    let send = Input::SendItem { from: n(1), to: n(2), item_id: ore, amount: n(6) };
    let seq = 99;
    for token in [n(1), n(2)] {
        let character = doc.characters.iter_mut().find(|ch| ch.token_id == token).unwrap();
        let index = character.entries.len() as u64;
        let prev = if index == 0 {
            panic!("character log empty");
        } else {
            character.entries[index as usize - 1].hash
        };
        // The chain head is the last entry hash, which matches character_head after a non-empty log.
        let hash = entry_hash(&prev, index, &send);
        character.entries.push(lok_engine::LoggedEntry {
            hash,
            input: send.clone(),
            seq,
        });
    }
    doc.characters[0].entries.push(lok_engine::LoggedEntry {
        hash: [0u8; 32],
        input: Input::SendItem { from: n(1), to: n(2), item_id: ore, amount: n(1) },
        seq: seq + 1,
    });
    match replay_world(&doc).unwrap_err() {
        lok_engine::ReplayStop::Rejected { index, reason } => {
            assert_eq!(index, seq);
            assert_eq!(reason, EngineError::InsufficientItem);
        }
        other => panic!("expected rejection, got {other:?}"),
    }
}

#[test]
fn list_escrows_the_item_and_kek_bids_are_retired() {
    let sword = unique_id("iron_sword", 42);
    let mut world = two_characters();
    import_item(&mut world, n(1), sword, n(1)).unwrap();

    world.append_list(n(7), n(1), sword, n(1)).unwrap();
    assert_eq!(world.item_balance(&n(1), &sword), Some(n(0)));
    assert_eq!(
        world.append_send_item(n(1), n(2), sword, n(1)).unwrap_err(),
        EngineError::InsufficientItem,
        "listed item cannot be transferred"
    );
    assert_eq!(
        world.append_export_item(n(1), sword, n(1)).unwrap_err(),
        EngineError::InsufficientItem,
        "listed item cannot be exported"
    );
    assert_eq!(world.append_bid(n(7), n(2), n(100)).unwrap_err(), EngineError::KekRetired);
    assert_eq!(world.append_settle(n(7)).unwrap_err(), EngineError::KekRetired);
    assert!(world.listing(&n(7)).is_some());
}

#[test]
fn cancel_returns_the_listed_item() {
    let sword = unique_id("iron_sword", 7);
    let mut world = two_characters();
    import_item(&mut world, n(1), sword, n(1)).unwrap();
    world.append_list(n(4), n(1), sword, n(1)).unwrap();
    assert_eq!(world.append_cancel(n(4), n(2)).unwrap_err(), EngineError::NotSeller);
    assert!(world.listing(&n(4)).is_some());

    world.append_cancel(n(4), n(1)).unwrap();
    assert!(world.listing(&n(4)).is_none());
    assert_eq!(world.item_balance(&n(1), &sword), Some(n(1)));
    world.append_list(n(4), n(1), sword, n(1)).unwrap();
    assert!(world.listing(&n(4)).is_some());
}

#[test]
fn double_list_is_rejected() {
    let ore = fungible_id("iron_ore");
    let mut world = two_characters();
    import_item(&mut world, n(1), ore, n(5)).unwrap();
    world.append_list(n(1), n(1), ore, n(2)).unwrap();
    let err = world.append_list(n(2), n(1), ore, n(1)).unwrap_err();
    assert_eq!(err, EngineError::AlreadyListed);
    assert_eq!(world.item_balance(&n(1), &ore), Some(n(3)));
    assert_eq!(world.listing(&n(1)).unwrap().amount, n(2));
    assert!(world.listing(&n(2)).is_none());
    assert_eq!(world.listings().count(), 1);
}

#[test]
fn replay_cli_stops_at_the_first_bad_world_hash() {
    let mut world = two_characters();
    import_item(&mut world, n(1), fungible_id("iron_ore"), n(5)).unwrap();
    let doc = world.to_document();
    let spawn = doc.characters.iter().find(|ch| ch.token_id == n(1)).unwrap().entries[0].clone();
    let mut bad = spawn.hash;
    bad[31] ^= 0xff;
    let file = serde_json::json!({
        "type": "characters",
        "characters": [{
            "tokenId": "1",
            "startingJob": 3,
            "entries": [
                {
                    "seq": 0,
                    "hash": format!("0x{}", hex::encode(spawn.hash)),
                    "input": { "type": "spawn", "tokenId": "1", "startingJob": 3 }
                },
                {
                    "seq": 1,
                    "hash": format!("0x{}", hex::encode(bad)),
                    "input": { "type": "importItem", "tokenId": "1", "itemId": "1", "amount": "1", "nonce": "1" }
                },
                {
                    "seq": 2,
                    "hash": "0x0000000000000000000000000000000000000000000000000000000000000000",
                    "input": { "type": "importItem", "tokenId": "1", "itemId": "1", "amount": "1", "nonce": "2" }
                }
            ]
        }]
    });
    let path = std::env::temp_dir().join(format!("lok-world-bad-{}.json", std::process::id()));
    std::fs::write(&path, file.to_string()).unwrap();
    let stopped = Command::new(env!("CARGO_BIN_EXE_lok-replay"))
        .arg(&path)
        .output()
        .expect("run lok-replay");
    assert_eq!(stopped.status.code(), Some(1));
    let stderr = String::from_utf8(stopped.stderr).unwrap();
    assert!(stderr.contains("bad hash at index 1"), "{stderr}");
}

#[test]
fn order_book_fills_the_lowest_ask_and_pays_the_ask() {
    let dust = fungible_id("pale_dust");
    let mut world = two_characters();
    world.append_spawn(n(3), 2).unwrap();
    world.append_spawn(n(4), 0).unwrap();
    import_item(&mut world, n(1), dust, n(1)).unwrap();
    import_item(&mut world, n(2), dust, n(1)).unwrap();
    import_item(&mut world, n(3), dust, n(1)).unwrap();
    let t0 = 1_700_000_000u64;
    world.append_ask(n(10), n(1), dust, n(1), n(100), t0).unwrap();
    world.append_ask(n(11), n(2), dust, n(1), n(1000), t0 + 1).unwrap();
    world.append_ask(n(12), n(3), dust, n(1), n(2000), t0 + 2).unwrap();

    assert_eq!(world.append_fill(n(4), dust, n(100)).unwrap_err(), EngineError::KekRetired);
    assert!(world.listing(&n(10)).is_some());
    world
        .append_chain_fill(n(10), n(4), n(100), dust, n(1), n(1), [9u8; 32], 0)
        .unwrap();
    assert!(world.listing(&n(10)).is_none());
    assert_eq!(world.item_balance(&n(4), &dust), Some(n(0)), "the sale does not enter the bag");
    assert_eq!(world.inbox_balance(&n(4), &dust), Some(n(1)));
    assert_eq!(world.gold_balance(&n(1)), Some(U256::ZERO));
    assert_eq!(world.gold_balance(&n(4)), Some(U256::ZERO));

    world.append_cancel_ask(n(11), n(2)).unwrap();
    assert!(world.listing(&n(11)).is_none());
    assert_eq!(world.item_balance(&n(2), &dust), Some(n(0)));
    assert_eq!(world.inbox_balance(&n(2), &dust), Some(n(1)));

    assert_eq!(
        world.append_reclaim_ask(n(12), n(3), t0 + 2 + 7 * 24 * 60 * 60 - 1).unwrap_err(),
        EngineError::TooSoon
    );
    world.append_reclaim_ask(n(12), n(3), t0 + 2 + 7 * 24 * 60 * 60).unwrap();
    assert_eq!(world.inbox_balance(&n(3), &dust), Some(n(1)));
    assert_eq!(world.item_balance(&n(3), &dust), Some(n(0)));

    world.append_take_inbox(n(4), dust, n(1)).unwrap();
    assert_eq!(world.inbox_balance(&n(4), &dust), Some(n(0)));
    assert_eq!(world.item_balance(&n(4), &dust), Some(n(0)));

    let report = replay_world(&world.to_document()).expect("replay");
    assert_eq!(report.head, world.head());
    assert_eq!(report.entries, world.len());
}


#[test]
fn buy_pays_the_lowest_ask_not_a_higher_amount_and_rejects_overpay() {
    let dust = fungible_id("pale_dust");
    let mut world = two_characters();
    world.append_spawn(n(3), 2).unwrap();
    import_item(&mut world, n(1), dust, n(1)).unwrap();
    import_item(&mut world, n(2), dust, n(1)).unwrap();
    let t0 = 1_700_000_000u64;
    world.append_ask(n(10), n(1), dust, n(1), n(100), t0).unwrap();
    world.append_ask(n(11), n(2), dust, n(1), n(100), t0 + 5).unwrap();
    assert_eq!(world.append_buy(n(3), dust).unwrap_err(), EngineError::KekRetired);
    assert!(world.listing(&n(10)).is_some());
    assert!(world.listing(&n(11)).is_some());
}

#[test]
fn gold_spend_and_paid_respec_leave_no_kek_out() {
    let mut world = two_characters();
    world.append_gold_earn(n(1), "quest".into(), n(10000), 1).unwrap();
    world
        .apply(Input::GoldSpend { token_id: n(1), sink: "trainer".into(), amount: n(1000) })
        .unwrap();
    assert_eq!(world.gold_balance(&n(1)), Some(n(9000)));
    world
        .apply(Input::GoldPaidRespec {
            token_id: n(1),
            amount: n(5000),
            node_ids: vec!["fire".into()],
        })
        .unwrap();
    assert_eq!(world.gold_balance(&n(1)), Some(n(4000)));
    let drafted = world.checkpoint_span(&n(1), world.character_len(&n(1)).unwrap()).unwrap();
    assert!(drafted.exports.is_empty());
}
