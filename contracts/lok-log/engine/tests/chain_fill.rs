//! ChainFill: AhEscrow-paid ask mirrored as items-only (no Kek move).

use lok_engine::{fungible_id, replay_world, EngineError, U256, World};

fn n(v: u64) -> U256 {
    U256::from_u64(v)
}

fn next_inbound(world: &World, token: U256) -> u64 {
    world.inbound_applied(&token).unwrap_or(0).saturating_add(1)
}

fn import_item(world: &mut World, token: U256, item: U256, amount: U256) {
    let nonce = next_inbound(world, token);
    world.append_import_item(token, item, amount, nonce).unwrap();
}

fn tx(byte: u8) -> [u8; 32] {
    let mut h = [0u8; 32];
    h[31] = byte;
    h
}

#[test]
fn chain_fill_moves_item_without_touching_kek() {
    let dust = fungible_id("pale_dust");
    let mut world = World::new();
    world.append_spawn(n(1), 3).unwrap();
    world.append_spawn(n(2), 1).unwrap();
    import_item(&mut world, n(1), dust, n(2));
    let t0 = 1_700_000_000u64;
    world
        .append_ask(n(10), n(1), dust, n(1), n(500), t0)
        .unwrap();

    assert_eq!(world.kek_balance(&n(1)), Some(n(0)));
    assert_eq!(world.kek_balance(&n(2)), Some(n(0)));

    world
        .append_chain_fill(n(10), n(2), n(500), dust, n(1), n(1), tx(1), 0)
        .unwrap();
    assert!(world.listing(&n(10)).is_none());
    assert_eq!(world.inbox_balance(&n(2), &dust), Some(n(1)));
    assert_eq!(world.kek_balance(&n(1)), Some(n(0)), "seller Kek unchanged");
    assert_eq!(world.kek_balance(&n(2)), Some(n(0)), "buyer Kek unchanged");

    let report = replay_world(&world.to_document()).expect("replay");
    assert_eq!(report.head, world.head());
    assert_eq!(report.entries, world.len());
}

#[test]
fn chain_fill_rejects_wrong_price_self_buy_and_mismatch() {
    let dust = fungible_id("pale_dust");
    let mut world = World::new();
    world.append_spawn(n(1), 3).unwrap();
    world.append_spawn(n(2), 1).unwrap();
    import_item(&mut world, n(1), dust, n(1));
    let t0 = 1_700_000_000u64;
    world
        .append_ask(n(10), n(1), dust, n(1), n(100), t0)
        .unwrap();

    assert_eq!(
        world
            .append_chain_fill(n(10), n(2), n(99), dust, n(1), n(1), tx(1), 0)
            .unwrap_err(),
        EngineError::OverAsk
    );
    assert_eq!(
        world
            .append_chain_fill(n(10), n(1), n(100), dust, n(1), n(1), tx(2), 0)
            .unwrap_err(),
        EngineError::SelfTransfer
    );
    assert_eq!(
        world
            .append_chain_fill(n(10), n(2), n(100), dust, n(2), n(1), tx(3), 0)
            .unwrap_err(),
        EngineError::FillMismatch
    );
    assert_eq!(
        world
            .append_chain_fill(n(10), n(2), n(100), dust, n(1), n(9), tx(4), 0)
            .unwrap_err(),
        EngineError::FillMismatch
    );
    assert!(world.listing(&n(10)).is_some());
}
