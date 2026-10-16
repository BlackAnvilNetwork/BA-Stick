//! SP1 guest. One spawn, then the character's keccak `State::root`.
//!
//! The hash is `lok_engine`'s keccak256 (tiny-keccak). This program does not
//! hash with Poseidon or with a RISC Zero digest.

#![no_main]
sp1_zkvm::entrypoint!(main);

use lok_engine::{Input, World, U256};

pub fn main() {
    let token_id = sp1_zkvm::io::read::<[u8; 32]>();
    let starting_job = sp1_zkvm::io::read::<u8>();

    let mut world = World::new();
    world
        .apply(Input::Spawn {
            token_id: U256(token_id),
            starting_job,
        })
        .expect("spawn");

    let root = world.snapshots()[0].state_root;
    sp1_zkvm::io::commit(&root);
}
