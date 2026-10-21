//! The one-validator set is a Malachite `ValidatorSet`. Removing that trait,
//! or the consensus run, fails this file.

use informalsystems_malachitebft_core_types::{ThresholdParams, Validator, ValidatorSet};
use informalsystems_malachitebft_signing_ed25519::Ed25519;
use lok_order::{genesis_validator_set, GenesisOrderer};
use rand::rngs::OsRng;

#[test]
fn genesis_of_one_is_a_malachite_validator_set() {
    let key = Ed25519::generate_keypair(OsRng);
    let (set, address) = genesis_validator_set(&key);
    assert_eq!(ValidatorSet::count(&set), 1);
    assert!(ValidatorSet::get_by_index(&set, 1).is_none());
    let validator = ValidatorSet::get_by_address(&set, &address).expect("the genesis key");
    assert_eq!(Validator::voting_power(validator), 1);
    assert_eq!(ValidatorSet::total_voting_power(&set), 1);

    let quorum = ThresholdParams::default().quorum;
    assert!(quorum.is_met(1, ValidatorSet::total_voting_power(&set)));
    assert_eq!(quorum.min_expected(ValidatorSet::total_voting_power(&set)), 1);
    assert!(!quorum.is_met(0, 1));
}

#[test]
fn one_validator_commits_the_proposed_root() {
    let mut orderer = GenesisOrderer::generate();
    let root = [0x11u8; 32];
    let committed = orderer.commit(0, root).expect("threshold 1 commits");
    assert_eq!(committed.height, 0);
    assert_eq!(committed.root, root);
    assert_eq!(committed.signatures, 1);

    let next = [0x22u8; 32];
    let again = orderer.commit(1, next).expect("the next height commits");
    assert_eq!(again.height, 1);
    assert_eq!(again.root, next);
    assert_eq!(again.signatures, 1);
    assert_ne!(again.root, root);
}
