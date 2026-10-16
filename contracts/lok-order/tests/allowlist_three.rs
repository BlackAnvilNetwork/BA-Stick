//! Three allowlisted validators. Removing the Malachite crates fails this file:
//! the threshold, `Effect::Decide`, and `ConsensusMsg` are Malachite types.

use informalsystems_malachitebft_core_consensus::{ConsensusMsg, Effect};
use informalsystems_malachitebft_core_types::{ThresholdParam, ThresholdParams, ValidatorSet};
use lok_order::{AllowlistOrderer, GenesisOrderer, OrderCtx, OrderError};

/// A commit is `Effect::Decide`. This function fails to compile without that variant.
fn commit_is_decide(effect: Effect<OrderCtx>) -> bool {
    matches!(effect, Effect::Decide(_, _, _))
}

/// Replicas exchange Malachite consensus messages (a vote or a proposal).
fn message_is_consensus(msg: ConsensusMsg<OrderCtx>) -> bool {
    matches!(msg, ConsensusMsg::Vote(_) | ConsensusMsg::Proposal(_))
}

#[test]
fn one_signer_does_not_decide_and_two_signers_do() {
    let _uses_malachite_effect: fn(Effect<OrderCtx>) -> bool = commit_is_decide;
    let _uses_consensus_msg: fn(ConsensusMsg<OrderCtx>) -> bool = message_is_consensus;

    let thresholds = ThresholdParams {
        quorum: ThresholdParam::new(1, 2),
        honest: ThresholdParam::F_PLUS_ONE,
    };
    assert_eq!(lok_order::majority_threshold(), thresholds);
    assert!(!thresholds.quorum.is_met(1, 3), "one signer is short of a majority");
    assert!(thresholds.quorum.is_met(2, 3), "two signers are a majority of three");
    assert_eq!(thresholds.quorum.min_expected(3), 2);

    let root = [0x5au8; 32];
    let mut one = AllowlistOrderer::with_signers([true, false, false]);
    assert_eq!(ValidatorSet::count(one.validator_set()), 3);
    match one.commit(0, root) {
        Err(OrderError::NoDecision { height }) => assert_eq!(height, 0),
        other => panic!("one signer must not Decide, got {other:?}"),
    }
    assert!(one.last_commit().is_none());
    let one_status: serde_json::Value =
        serde_json::from_str(&one.status_json()).expect("status json");
    assert!(one_status["lastCertifiedHeight"].is_null());
    assert!(one_status["lastAnchoredHeight"].is_null());
    assert_eq!(one_status["clockSkew"], 0);
    assert_eq!(one_status["peers"].as_array().map(Vec::len), Some(3));

    let mut two = AllowlistOrderer::with_signers([true, true, false]);
    let committed = two
        .commit(0, root)
        .expect("two signers Decide the same root");
    assert_eq!(committed.height, 0);
    assert_eq!(committed.root, root);
    assert!(committed.signatures >= 2);
    assert_eq!(two.last_commit().map(|commit| commit.root), Some(root));

    let status: serde_json::Value = serde_json::from_str(&two.status_json()).expect("status json");
    assert_eq!(status["lastCertifiedHeight"], 0);
    assert!(status["lastAnchoredHeight"].is_null());
    assert_eq!(status["clockSkew"], 0);
    let peers = status["peers"].as_array().expect("peers");
    assert_eq!(peers.len(), 3);
    let heard = peers.iter().filter(|peer| peer["heard"] == true).count();
    assert!(heard >= 2, "the two signers were heard");
    assert_ne!(status["seedRoller"], status["leader"]);
}

#[test]
fn seed_roller_is_not_the_leader_when_three_replicas_are_configured() {
    let orderer = AllowlistOrderer::generate();
    assert_eq!(ValidatorSet::count(orderer.validator_set()), 3);
    for height in 0..3 {
        let leader = orderer.leader_at(height);
        let roller = orderer.seed_roller_at(height);
        assert_ne!(
            roller, leader,
            "seed roller must not be the leader at height {height}"
        );
        assert!(orderer.peers().iter().any(|peer| peer.address == roller));
        assert!(orderer.peers().iter().any(|peer| peer.address == leader));
    }
    let status: serde_json::Value =
        serde_json::from_str(&orderer.status_json()).expect("status json");
    assert_ne!(status["seedRoller"].as_str(), status["leader"].as_str());
    assert!(status["lastAnchoredHeight"].is_null());
    assert_eq!(status["clockSkew"], 0);
}

#[test]
fn one_replica_roller_may_be_the_leader() {
    let orderer = GenesisOrderer::generate();
    assert_eq!(ValidatorSet::count(orderer.validator_set()), 1);
    assert_eq!(orderer.seed_roller(), orderer.address());
}

#[test]
fn three_present_replicas_decide_without_an_anchor() {
    let mut orderer = AllowlistOrderer::generate();
    let root = [0x07u8; 32];
    let committed = orderer.commit(0, root).expect("the allowlist decides");
    assert_eq!(committed.root, root);
    assert!(committed.signatures >= 2);
    assert!(orderer.last_anchored_height().is_none());
    assert_eq!(orderer.clock_skew(), 0);
    let heard = orderer.peers().iter().filter(|peer| peer.heard).count();
    assert_eq!(heard, 3);
}
