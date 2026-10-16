//! Kill the current leader of the three-replica allowlist.
//!
//! The certified prefix stays. A proposal the dead leader published, and that
//! a majority had not decided, is not certified. The other two commit the next
//! batch. A directory lookup returns the new leader, and the session reconnects.
//! The player-visible result is the old leader address and the new leader address.

use lok_order::{AllowlistOrderer, PlayerSession};

fn mentions_halt(text: &str) -> bool {
    let lower = text.to_ascii_lowercase();
    lower.contains("paused") || lower.contains("combat stopped")
}

#[test]
fn killing_the_leader_costs_only_a_reconnect() {
    let mut orderer = AllowlistOrderer::generate();
    let prefix_root = [0x11u8; 32];
    let prefix = orderer
        .commit(0, prefix_root)
        .expect("the allowlist certifies the prefix");
    assert_eq!(prefix.height, 0);
    assert_eq!(prefix.root, prefix_root);
    assert!(prefix.signatures >= 2);
    assert_eq!(orderer.certified_prefix().len(), 1);
    assert_eq!(orderer.certified_prefix()[0].root, prefix_root);
    orderer.record_certified_inputs(&["keep"]);
    orderer.accept_input("drop");

    let open = orderer.open_height();
    let old_leader = orderer.lookup_leader();
    assert_eq!(old_leader, orderer.leader_at(open));
    assert_ne!(old_leader, orderer.seed_roller_at(open));
    let mut session = PlayerSession::connect(old_leader);

    let proposed_root = [0x22u8; 32];
    let proposed = orderer
        .propose_only(open, proposed_root)
        .expect("the leader publishes a proposal");
    assert_eq!(proposed.height, open);
    assert_eq!(proposed.root, proposed_root);
    assert_eq!(proposed.proposer, old_leader);
    assert_eq!(orderer.certified_prefix().len(), 1);
    assert!(orderer
        .certified_prefix()
        .iter()
        .all(|commit| commit.root != proposed_root));
    assert_eq!(
        orderer.uncertified().map(|item| item.root),
        Some(proposed_root)
    );
    assert_ne!(orderer.last_commit().expect("prefix").root, proposed_root);
    assert!(orderer.in_flight().is_empty(), "drop sits on the provisional batch");
    orderer.accept_input("late");
    assert_eq!(orderer.in_flight(), ["late"]);

    let dead = orderer.kill_leader();
    assert_eq!(dead, old_leader);
    let peers = orderer.peers();
    assert_eq!(peers.len(), 3);
    assert_eq!(peers.iter().filter(|peer| !peer.present).count(), 1);
    assert!(peers
        .iter()
        .any(|peer| peer.address == dead && !peer.present));
    let living: Vec<_> = peers
        .iter()
        .filter(|peer| peer.present)
        .map(|peer| peer.address)
        .collect();
    assert_eq!(living.len(), 2);
    assert!(!living.contains(&dead));

    let next_root = [0x33u8; 32];
    let committed = orderer
        .commit(orderer.open_height(), next_root)
        .expect("two validators still commit");
    assert_eq!(committed.height, open);
    assert_eq!(committed.root, next_root);
    assert_ne!(committed.root, proposed_root);
    assert_eq!(committed.signatures, 2);
    assert_ne!(committed.proposer, dead);
    assert!(living.contains(&committed.proposer));

    let prefix_after = orderer.certified_prefix();
    assert_eq!(prefix_after.len(), 2);
    assert_eq!(prefix_after[0].root, prefix_root);
    assert_eq!(prefix_after[0].height, 0);
    assert_eq!(prefix_after[1].root, next_root);
    assert!(prefix_after
        .iter()
        .all(|commit| commit.root != proposed_root));
    assert_eq!(
        orderer.uncertified().map(|item| item.root),
        Some(proposed_root)
    );

    let new_leader = orderer.lookup_leader();
    assert_eq!(new_leader, committed.proposer);
    assert_ne!(new_leader, dead);
    let other_living = living
        .iter()
        .copied()
        .find(|address| *address != new_leader)
        .expect("the other survivor");
    assert_ne!(other_living, dead);
    assert_eq!(orderer.epoch(), 1);
    assert!(orderer.logical_time() > 0, "timeouts advance on a step counter");
    assert_eq!(
        orderer.epoch_seed_roller(),
        other_living,
        "after the kill the roller is the other living replica"
    );
    assert_eq!(orderer.dropped_inputs(), ["drop", "late"]);
    assert!(orderer.in_flight().is_empty());
    assert!(!orderer.replay_input("drop"));
    assert!(!orderer.replay_input("late"));
    assert!(orderer.dropped_inputs().iter().all(|id| id != "keep"));
    assert!(orderer.replay_input("fresh"));
    assert_eq!(orderer.in_flight(), ["fresh"]);
    let quorum = lok_order::majority_threshold().quorum;
    assert!(quorum.is_met(2, 3), "two of three is a majority");
    assert!(!quorum.is_met(1, 3));
    assert!(living.contains(&new_leader));
    assert_eq!(
        peers
            .iter()
            .filter(|peer| peer.present)
            .filter(|peer| peer.address == new_leader)
            .count(),
        1
    );

    let visible = session.reconnect(new_leader);
    assert_eq!(session.leader, new_leader);
    assert_eq!(visible.old_leader, dead);
    assert_eq!(visible.new_leader, new_leader);
    assert_eq!(visible.to_string(), format!("{old_leader} {new_leader}"));

    let status = orderer.status_json();
    let parsed: serde_json::Value = serde_json::from_str(&status).expect("status json");
    assert!(parsed.get("paused").is_none());
    assert!(parsed.get("worldPaused").is_none());
    assert!(parsed.get("combatStopped").is_none());
    assert_eq!(parsed["directoryLeader"], new_leader.to_string());
    assert_eq!(parsed["leader"], committed.proposer.to_string());
    assert_eq!(parsed["leader"], parsed["directoryLeader"]);
    assert_ne!(parsed["leader"].as_str().unwrap(), dead.to_string());
    assert_eq!(parsed["seedRoller"], other_living.to_string());
    assert_ne!(parsed["seedRoller"], parsed["leader"]);
    assert_ne!(parsed["seedRoller"].as_str().unwrap(), dead.to_string());
    assert_eq!(parsed["epoch"], 1);
    assert!(parsed["logicalTime"].as_u64().unwrap_or(0) > 0);
    assert_eq!(parsed["dropped"], serde_json::json!(["drop", "late"]));
    assert_eq!(parsed["inFlight"], serde_json::json!(["fresh"]));
    assert!(parsed["lastAnchoredHeight"].is_null());
    assert_eq!(parsed["clockSkew"], 0);
    assert_eq!(parsed["lastCertifiedHeight"], open);

    let report = format!(
        "{visible} {status} {prefix:?} {proposed:?} {committed:?} {dead} {new_leader}"
    );
    assert!(!mentions_halt(&report), "{report}");
}
