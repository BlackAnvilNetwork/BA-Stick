//! SP1 executor for the lok engine.
//!
//! The guest ELF is `lok-sp1-program`. It runs `World::apply` from
//! `contracts/lok-log/engine` and commits that character's `State::root`.
//! The root is keccak, the hash the engine already uses.
//!
//! Execution is not on the 20 Hz tick. Play, movement, combat, and loot do
//! not call this crate. It does not generate a proof, broadcast to Gnosis
//! or Chiado, or read a randomness beacon.
//!
//! A RISC Zero program, proof, or verifier id is rejected before the SP1
//! client starts, so that id does not execute.

use lok_engine::{Input, World, U256};
use sp1_sdk::{include_elf, Elf, Prover, ProverClient, SP1Stdin};

const ENGINE_ELF: Elf = include_elf!("lok_sp1_program");

/// One spawn the guest and the native engine both apply.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SpawnFixture {
    pub token_id: [u8; 32],
    pub starting_job: u8,
}

/// Who submitted work for this genesis.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ZkVm {
    /// Succinct SP1. The only zkVM this genesis executes.
    Sp1,
    /// RISC Zero image id or verifier control id.
    RiscZeroVerifier([u8; 32]),
    /// RISC Zero guest program.
    RiscZeroProgram(Vec<u8>),
    /// RISC Zero receipt or proof.
    RiscZeroProof(Vec<u8>),
}

#[derive(Debug, PartialEq, Eq)]
pub enum ExecError {
    /// RISC Zero is not accepted on this genesis. The engine was not run.
    RiscZeroNotAccepted,
    Execute(String),
}

/// The spawn used by the executor test: token 1, starting job 3.
pub fn spawn_fixture() -> SpawnFixture {
    let mut token_id = [0u8; 32];
    token_id[31] = 1;
    SpawnFixture {
        token_id,
        starting_job: 3,
    }
}

/// Keccak `State::root` after the native engine applies `fixture`.
pub fn native_spawn_state_root(fixture: SpawnFixture) -> [u8; 32] {
    apply_spawn(fixture).snapshots()[0].state_root
}

/// Run `fixture` on SP1, or reject a RISC Zero id without executing.
pub async fn execute_state_root(id: &ZkVm, fixture: SpawnFixture) -> Result<[u8; 32], ExecError> {
    match id {
        ZkVm::RiscZeroVerifier(_) | ZkVm::RiscZeroProgram(_) | ZkVm::RiscZeroProof(_) => {
            Err(ExecError::RiscZeroNotAccepted)
        }
        ZkVm::Sp1 => execute_sp1(fixture).await,
    }
}

fn apply_spawn(fixture: SpawnFixture) -> World {
    let mut world = World::new();
    world
        .apply(Input::Spawn {
            token_id: U256(fixture.token_id),
            starting_job: fixture.starting_job,
        })
        .expect("spawn");
    world
}

async fn execute_sp1(fixture: SpawnFixture) -> Result<[u8; 32], ExecError> {
    let mut stdin = SP1Stdin::new();
    stdin.write(&fixture.token_id);
    stdin.write(&fixture.starting_job);

    let client = ProverClient::from_env().await;
    let (mut public_values, _report) = client
        .execute(ENGINE_ELF, stdin)
        .await
        .map_err(|err| ExecError::Execute(err.to_string()))?;
    Ok(public_values.read::<[u8; 32]>())
}
