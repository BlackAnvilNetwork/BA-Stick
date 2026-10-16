//! `lok-replay --expect-root` exits 0 on a matching state root and non-zero when a byte flips.

use std::process::Command;

use lok_engine::{Engine, Input, Outcome, U256, World};

fn hex32(bytes: &[u8; 32]) -> String {
    format!("0x{}", hex::encode(bytes))
}

fn flip_last(root: [u8; 32]) -> [u8; 32] {
    let mut flipped = root;
    flipped[31] ^= 0x01;
    flipped
}

fn temp_log(name: &str) -> std::path::PathBuf {
    std::env::temp_dir().join(format!("lok-expect-{name}-{}.json", std::process::id()))
}

fn run(args: &[std::ffi::OsString]) -> std::process::Output {
    Command::new(env!("CARGO_BIN_EXE_lok-replay"))
        .args(args)
        .output()
        .expect("run lok-replay")
}

fn spawn_log(token: u64, job: u8) -> (std::path::PathBuf, [u8; 32]) {
    let token_id = U256::from_u64(token);
    let spawn = Input::Spawn { token_id, starting_job: job };
    let mut engine = Engine::open(token_id, job);
    let Outcome::Applied { entry_hash, state_root, .. } = engine.apply(spawn).unwrap();
    let path = temp_log(&format!("char-{token}"));
    let doc = serde_json::json!({
        "tokenId": token.to_string(),
        "startingJob": job,
        "entries": [{
            "hash": hex32(&entry_hash),
            "input": { "type": "spawn", "tokenId": token.to_string(), "startingJob": job }
        }]
    });
    std::fs::write(&path, doc.to_string()).unwrap();
    (path, state_root)
}

fn write_world(name: &str, world: &World) -> (std::path::PathBuf, Vec<(U256, [u8; 32])>) {
    let doc = world.to_document();
    let roots: Vec<(U256, [u8; 32])> = world
        .snapshots()
        .into_iter()
        .map(|snap| (snap.token_id, snap.state_root))
        .collect();
    let characters: Vec<serde_json::Value> = doc
        .characters
        .iter()
        .map(|character| {
            let entries: Vec<serde_json::Value> = character
                .entries
                .iter()
                .map(|entry| {
                    let Input::Spawn { token_id, starting_job } = &entry.input else {
                        panic!("fixture only serializes spawn, got {:?}", entry.input);
                    };
                    serde_json::json!({
                        "seq": entry.seq,
                        "hash": hex32(&entry.hash),
                        "input": {
                            "type": "spawn",
                            "tokenId": token_id.to_dec(),
                            "startingJob": starting_job,
                        }
                    })
                })
                .collect();
            serde_json::json!({
                "tokenId": character.token_id.to_dec(),
                "startingJob": character.starting_job,
                "entries": entries,
            })
        })
        .collect();
    let path = temp_log(name);
    let file = serde_json::json!({
        "type": "characters",
        "characters": characters,
    });
    std::fs::write(&path, file.to_string()).unwrap();
    (path, roots)
}

#[test]
fn replay_cli_expect_root_match_and_flipped_byte() {
    let (path, state_root) = spawn_log(1, 3);
    let root = hex32(&state_root);
    let bare = root.strip_prefix("0x").unwrap().to_string();

    let plain = run(&[path.as_os_str().to_os_string()]);
    assert!(plain.status.success(), "stderr {}", String::from_utf8_lossy(&plain.stderr));
    let stdout = String::from_utf8(plain.stdout.clone()).unwrap();
    assert!(stdout.contains(&format!("state_root={root}")), "{stdout}");

    let matched = run(&[
        path.as_os_str().to_os_string(),
        "--expect-root".into(),
        root.clone().into(),
    ]);
    assert!(
        matched.status.success(),
        "stderr {}",
        String::from_utf8_lossy(&matched.stderr)
    );
    assert_eq!(matched.stdout, plain.stdout, "a match keeps the unflagged replay line");

    let unprefixed = run(&[
        path.as_os_str().to_os_string(),
        format!("--expect-root={bare}").into(),
    ]);
    assert!(
        unprefixed.status.success(),
        "stderr {}",
        String::from_utf8_lossy(&unprefixed.stderr)
    );

    let named = run(&[
        path.as_os_str().to_os_string(),
        "--expect-root".into(),
        format!("1={root}").into(),
    ]);
    assert!(named.status.success(), "stderr {}", String::from_utf8_lossy(&named.stderr));

    let flipped = hex32(&flip_last(state_root));
    let mismatch = run(&[
        path.as_os_str().to_os_string(),
        "--expect-root".into(),
        flipped.into(),
    ]);
    assert_eq!(mismatch.status.code(), Some(1), "stderr {}", String::from_utf8_lossy(&mismatch.stderr));
    let stderr = String::from_utf8(mismatch.stderr).unwrap();
    assert!(stderr.contains("state_root mismatch"), "{stderr}");
}

#[test]
fn replay_cli_expect_root_checks_each_character() {
    let mut world = World::new();
    world.append_spawn(U256::from_u64(1), 3).unwrap();
    world.append_spawn(U256::from_u64(2), 1).unwrap();
    let (path, roots) = write_world("world", &world);
    assert_eq!(roots.len(), 2);

    let mut args = vec![path.as_os_str().to_os_string()];
    for (token, root) in &roots {
        args.push("--expect-root".into());
        args.push(format!("{token}={}", hex32(root)).into());
    }
    let matched = run(&args);
    assert!(
        matched.status.success(),
        "stdout {}\nstderr {}",
        String::from_utf8_lossy(&matched.stdout),
        String::from_utf8_lossy(&matched.stderr)
    );
    let stdout = String::from_utf8(matched.stdout).unwrap();
    for (token, root) in &roots {
        assert!(stdout.contains(&format!("token={token} state_root={}", hex32(root))), "{stdout}");
    }

    let flipped = hex32(&flip_last(roots[0].1));
    let mismatch = run(&[
        path.as_os_str().to_os_string(),
        "--expect-root".into(),
        format!("{}={flipped}", roots[0].0).into(),
        "--expect-root".into(),
        format!("{}={}", roots[1].0, hex32(&roots[1].1)).into(),
    ]);
    assert_ne!(mismatch.status.code(), Some(0));
    assert_eq!(mismatch.status.code(), Some(1));

    let partial = run(&[
        path.as_os_str().to_os_string(),
        "--expect-root".into(),
        format!("{}={}", roots[0].0, hex32(&roots[0].1)).into(),
    ]);
    assert_eq!(partial.status.code(), Some(1), "every character root is required");

    let bare = run(&[
        path.as_os_str().to_os_string(),
        "--expect-root".into(),
        hex32(&roots[0].1).into(),
    ]);
    assert_eq!(bare.status.code(), Some(2), "a bare root is not a world root");
}

#[test]
fn replay_cli_expect_root_rejects_a_bad_argument() {
    let (path, _) = spawn_log(7, 0);
    let bad = run(&[
        path.as_os_str().to_os_string(),
        "--expect-root".into(),
        "0xzz".into(),
    ]);
    assert_eq!(bad.status.code(), Some(2));
    let stderr = String::from_utf8(bad.stderr).unwrap();
    assert!(stderr.contains("usage: lok-replay"), "{stderr}");
}
