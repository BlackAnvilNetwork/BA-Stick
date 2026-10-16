//! Sibling proofs over `(tokenId, characterRoot)`.

use lok_engine::{
    character_root_leaf, keccak256, verify_character_root, CharacterRootTree, U256, World,
};

fn word(byte: u8) -> [u8; 32] {
    [byte; 32]
}

fn token(id: u64) -> U256 {
    U256::from_u64(id)
}

#[test]
fn empty_tree_root_is_32_zero_bytes() {
    let tree = CharacterRootTree::from_pairs([]);
    assert!(tree.is_empty());
    assert_eq!(tree.root(), [0u8; 32]);
    assert_ne!(tree.root(), keccak256(&[]), "empty state map is a different commitment");
    assert!(tree.prove(&token(1)).is_none());
}

#[test]
fn two_characters_with_different_roots_have_a_stable_root() {
    let mut world = World::new();
    world.append_spawn(token(2), 1).unwrap();
    world.append_spawn(token(1), 3).unwrap();
    let snaps = world.snapshots();
    assert_eq!(snaps.len(), 2);
    assert_ne!(snaps[0].state_root, snaps[1].state_root);

    let forward: Vec<_> = snaps.iter().map(|snap| (snap.token_id, snap.state_root)).collect();
    let mut reverse = forward.clone();
    reverse.reverse();

    let ordered = CharacterRootTree::from_pairs(forward.iter().copied());
    let flipped_order = CharacterRootTree::from_pairs(reverse.iter().copied());
    assert_eq!(ordered.root(), flipped_order.root());
    assert_ne!(ordered.root(), [0u8; 32]);

    let (first_id, first_root) = forward[0];
    let (second_id, second_root) = forward[1];
    assert!(first_id < second_id, "snapshots walk token id order");
    let expected = {
        let left = character_root_leaf(&first_id, &first_root);
        let right = character_root_leaf(&second_id, &second_root);
        let mut raw = [0u8; 64];
        raw[..32].copy_from_slice(&left);
        raw[32..].copy_from_slice(&right);
        keccak256(&raw)
    };
    assert_eq!(ordered.root(), expected);

    let swapped = CharacterRootTree::from_pairs([(first_id, second_root), (second_id, first_root)]);
    assert_ne!(swapped.root(), ordered.root());
}

#[test]
fn a_missing_token_is_not_a_proof() {
    let tree = CharacterRootTree::from_pairs([(token(1), word(0x11)), (token(2), word(0x22))]);
    assert!(tree.prove(&token(9)).is_none());
    assert!(tree.character_root(&token(9)).is_none());
}

#[test]
fn sibling_proof_verifies_and_a_flipped_leaf_fails() {
    let pairs = [(token(1), word(0x11)), (token(4), word(0x44)), (token(7), word(0x77))];
    let tree = CharacterRootTree::from_pairs(pairs);
    let root = tree.root();
    assert_ne!(root, [0u8; 32]);

    let left = character_root_leaf(&token(1), &word(0x11));
    let mid = character_root_leaf(&token(4), &word(0x44));
    let last = character_root_leaf(&token(7), &word(0x77));
    let branch = keccak256(&concat(left, mid));
    let duplicated = keccak256(&concat(last, last));
    assert_eq!(root, keccak256(&concat(branch, duplicated)));

    for (id, character_root) in pairs {
        let proof = tree.prove(&id).expect("present token has a proof");
        assert!(verify_character_root(&root, &id, &character_root, &proof));
        let mut flipped = character_root;
        flipped[31] ^= 0x01;
        assert!(!verify_character_root(&root, &id, &flipped, &proof));
    }
}

#[test]
fn a_proof_for_the_wrong_token_fails() {
    let root_a = word(0x11);
    let root_b = word(0x22);
    let tree = CharacterRootTree::from_pairs([(token(1), root_a), (token(2), root_b)]);
    let root = tree.root();
    let proof_a = tree.prove(&token(1)).expect("token 1");
    assert!(verify_character_root(&root, &token(1), &root_a, &proof_a));
    assert!(!verify_character_root(&root, &token(2), &root_b, &proof_a));
    assert!(!verify_character_root(&root, &token(2), &root_a, &proof_a));
}

fn concat(left: [u8; 32], right: [u8; 32]) -> [u8; 64] {
    let mut raw = [0u8; 64];
    raw[..32].copy_from_slice(&left);
    raw[32..].copy_from_slice(&right);
    raw
}
