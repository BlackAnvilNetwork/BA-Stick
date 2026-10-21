//! Keccak Merkle tree over `(tokenId, characterRoot)`.
//!
//! Leaves are sorted by token id. One token has one leaf; a later pair for the
//! same token replaces the earlier character root. A leaf is
//! `keccak256(abi.encode(uint256 tokenId, bytes32 characterRoot))`. Internal
//! nodes are `keccak256(left || right)`. An odd level duplicates its last node,
//! the same pairing the character state tree uses. An empty tree's root is 32
//! zero bytes, not `keccak256("")`.
//!
//! `prove` returns `None` when the token is absent. That absence is not a proof.
//! The live sealer commits this root as the batch `nextRoot`.

use std::collections::BTreeMap;

use crate::abi::{keccak256, Buf};
use crate::u256::U256;

/// One step from the leaf toward the root.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Sibling {
    pub hash: [u8; 32],
    /// The sibling is the left child. The proven node is on the right.
    pub left: bool,
}

/// Sibling path for one token. Empty when that token is the only leaf.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CharacterRootProof {
    pub siblings: Vec<Sibling>,
}

/// Sorted `(tokenId, characterRoot)` leaves and their inclusion proofs.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CharacterRootTree {
    leaves: Vec<(U256, [u8; 32])>,
}

impl CharacterRootTree {
    pub fn from_pairs(pairs: impl IntoIterator<Item = (U256, [u8; 32])>) -> Self {
        let map: BTreeMap<U256, [u8; 32]> = pairs.into_iter().collect();
        Self { leaves: map.into_iter().collect() }
    }

    pub fn is_empty(&self) -> bool {
        self.leaves.is_empty()
    }

    pub fn len(&self) -> usize {
        self.leaves.len()
    }

    /// Character state root stored for `token_id`, if that token is a leaf.
    pub fn character_root(&self, token_id: &U256) -> Option<[u8; 32]> {
        self.leaves
            .binary_search_by_key(token_id, |(id, _)| *id)
            .ok()
            .map(|index| self.leaves[index].1)
    }

    /// 32 zero bytes when there are no leaves.
    pub fn root(&self) -> [u8; 32] {
        if self.leaves.is_empty() {
            return [0u8; 32];
        }
        let hashes = self.leaf_hashes();
        let layers = fold_layers(&hashes);
        *layers.last().and_then(|level| level.first()).expect("non-empty tree has a root")
    }

    /// Inclusion proof for one token. `None` when the token is not in the tree.
    pub fn prove(&self, token_id: &U256) -> Option<CharacterRootProof> {
        let index = self.leaves.binary_search_by_key(token_id, |(id, _)| *id).ok()?;
        let layers = fold_layers(&self.leaf_hashes());
        let mut siblings = Vec::new();
        let mut at = index;
        for level in &layers[..layers.len() - 1] {
            let (sibling, left) = if at % 2 == 0 {
                let sibling = if at + 1 < level.len() { level[at + 1] } else { level[at] };
                (sibling, false)
            } else {
                (level[at - 1], true)
            };
            siblings.push(Sibling { hash: sibling, left });
            at /= 2;
        }
        Some(CharacterRootProof { siblings })
    }

    fn leaf_hashes(&self) -> Vec<[u8; 32]> {
        self.leaves
            .iter()
            .map(|(token_id, character_root)| character_root_leaf(token_id, character_root))
            .collect()
    }
}

/// `keccak256(abi.encode(uint256 tokenId, bytes32 characterRoot))`.
pub fn character_root_leaf(token_id: &U256, character_root: &[u8; 32]) -> [u8; 32] {
    let mut buf = Buf::new();
    buf.u256(token_id);
    buf.b256(character_root);
    keccak256(&buf.bytes)
}

/// Recompute the tree root from one leaf and its siblings.
pub fn verify_character_root(
    root: &[u8; 32],
    token_id: &U256,
    character_root: &[u8; 32],
    proof: &CharacterRootProof,
) -> bool {
    let mut hash = character_root_leaf(token_id, character_root);
    for sibling in &proof.siblings {
        hash = if sibling.left {
            hash_pair(&sibling.hash, &hash)
        } else {
            hash_pair(&hash, &sibling.hash)
        };
    }
    &hash == root
}

fn hash_pair(left: &[u8; 32], right: &[u8; 32]) -> [u8; 32] {
    let mut raw = [0u8; 64];
    raw[..32].copy_from_slice(left);
    raw[32..].copy_from_slice(right);
    keccak256(&raw)
}

/// Pair `keccak256(left || right)`, duplicating the last node of an odd level.
fn fold_layers(leaves: &[[u8; 32]]) -> Vec<Vec<[u8; 32]>> {
    let mut layers = vec![leaves.to_vec()];
    while layers.last().map(|level| level.len()).unwrap_or(0) > 1 {
        let current = layers.last().expect("level");
        let mut padded = current.clone();
        if padded.len() % 2 == 1 {
            let last = *padded.last().expect("odd level");
            padded.push(last);
        }
        let mut next = Vec::with_capacity(padded.len() / 2);
        for pair in padded.chunks(2) {
            next.push(hash_pair(&pair[0], &pair[1]));
        }
        layers.push(next);
    }
    layers
}
