//! SP1 guest for this genesis.
//!
//! Reads an engine log, replays it with the lok engine, and commits each
//! keccak state hash. The public bytes are `State::root`. RISC Zero is not a
//! prover here, and this guest does not pin a verifying key.

#![no_main]
sp1_zkvm::entrypoint!(main);

pub fn main() {
    let text = sp1_zkvm::io::read::<String>();
    let roots = lok_sp1_executor::state_roots(&text).expect("replay");
    for root in &roots {
        sp1_zkvm::io::commit_slice(root);
    }
}
