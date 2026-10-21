use lok_engine::keccak256;
use lok_sp1_executor::{
    execute_state_root, native_spawn_state_root, spawn_fixture, ExecError, ZkVm,
};

#[tokio::test]
async fn sp1_state_root_matches_native_keccak() {
    let fixture = spawn_fixture();
    let native = native_spawn_state_root(fixture);
    let executed = execute_state_root(&ZkVm::Sp1, fixture)
        .await
        .expect("sp1 execute");

    assert_eq!(executed, native);
    assert_ne!(native, [0u8; 32]);
    assert_ne!(native, keccak256(&[]));
}

#[tokio::test]
async fn risc_zero_id_is_rejected() {
    let fixture = spawn_fixture();
    let mut verifier_id = [0u8; 32];
    verifier_id[..5].copy_from_slice(b"RISC0");
    verifier_id[5] = 1;
    let rejected = [
        ZkVm::RiscZeroVerifier(verifier_id),
        ZkVm::RiscZeroProgram(b"risc0-program".to_vec()),
        ZkVm::RiscZeroProof(b"risc0-proof".to_vec()),
    ];

    for id in &rejected {
        let err = execute_state_root(id, fixture)
            .await
            .expect_err("risc zero must not execute");
        assert_eq!(err, ExecError::RiscZeroNotAccepted);
    }
}
