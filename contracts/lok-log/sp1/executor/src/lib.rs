//! Execution the SP1 guest commits.
//!
//! `state_roots` replays a lok-engine log and returns each character's
//! `State::root`. That root is the keccak256 Merkle tree the contracts already
//! use. An empty world is `keccak256("")`. The guest commits those bytes.
//! It does not hash with Poseidon. The verifying key is pinned beside the
//! wasm digest, not in this crate.

use lok_engine::{
    commit_entries, parse_any_log, replay, replay_world, AnyLog, Key, ReplayStop, U256,
};

/// Replay `text` with the lok engine and return the keccak state hash of each character.
///
/// A character log yields that character's `State::root`. A world document yields
/// one root per character, in replay order. An empty world yields `keccak256("")`.
pub fn state_roots(text: &str) -> Result<Vec<[u8; 32]>, String> {
    match parse_any_log(text).map_err(|err| err)? {
        AnyLog::Character(doc) => {
            let report = replay(&doc).map_err(stop_message)?;
            Ok(vec![report.state_root])
        }
        AnyLog::World(doc) => {
            let report = replay_world(&doc).map_err(stop_message)?;
            if report.characters.is_empty() {
                Ok(vec![commit_entries(Vec::<(Key, U256)>::new())])
            } else {
                Ok(report
                    .characters
                    .into_iter()
                    .map(|character| character.state_root)
                    .collect())
            }
        }
    }
}

fn stop_message(stop: ReplayStop) -> String {
    match stop {
        ReplayStop::BadHash { index, .. } => format!("bad hash at {index}"),
        ReplayStop::Rejected { index, reason } => format!("rejected at {index}: {reason}"),
    }
}
