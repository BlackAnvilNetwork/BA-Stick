//! Read `{height, root}` lines and run the three-replica allowlist.
//!
//! A caller that only writes a line does not wait for the commit reply.
//! A missing peer, fewer than the majority, a refused line, or no `Effect::Decide`
//! leaves that batch provisional.

use std::io::{self, BufRead, Write};

use lok_order::AllowlistOrderer;
use serde::Deserialize;

#[derive(Deserialize)]
struct Submit {
    #[serde(default)]
    op: Option<String>,
    height: Option<u64>,
    root: Option<String>,
    id: Option<String>,
}

fn decode_root(hex: &str) -> Option<[u8; 32]> {
    let hex = hex.trim().trim_start_matches("0x");
    if hex.len() != 64 {
        return None;
    }
    let mut out = [0u8; 32];
    for i in 0..32 {
        out[i] = u8::from_str_radix(&hex[i * 2..i * 2 + 2], 16).ok()?;
    }
    Some(out)
}

fn write_status(stdout: &mut impl Write, orderer: &AllowlistOrderer) {
    let _ = writeln!(stdout, "{}", orderer.status_json());
    let _ = stdout.flush();
}

fn main() {
    let mut orderer = AllowlistOrderer::generate();
    let stdin = io::stdin();
    let mut stdout = io::stdout();
    write_status(&mut stdout, &orderer);
    for line in stdin.lock().lines() {
        let line = match line {
            Ok(line) => line,
            Err(err) => {
                eprintln!("lok-order read: {err}");
                break;
            }
        };
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let submit: Submit = match serde_json::from_str(trimmed) {
            Ok(submit) => submit,
            Err(err) => {
                eprintln!("lok-order refused: {err}");
                continue;
            }
        };
        match submit.op.as_deref() {
            Some("kill-leader") => {
                orderer.kill_leader();
                write_status(&mut stdout, &orderer);
            }
            Some("keep") => {
                let Some(id) = submit.id.as_deref() else {
                    eprintln!("lok-order refused: keep needs an id");
                    continue;
                };
                orderer.record_certified_inputs(&[id]);
                write_status(&mut stdout, &orderer);
            }
            Some("accept-input") => {
                let Some(id) = submit.id.as_deref() else {
                    eprintln!("lok-order refused: accept-input needs an id");
                    continue;
                };
                orderer.accept_input(id);
                write_status(&mut stdout, &orderer);
            }
            Some("propose") => {
                let (Some(height), Some(root_hex)) = (submit.height, submit.root.as_deref()) else {
                    eprintln!("lok-order refused: propose needs a height and a root");
                    continue;
                };
                let Some(root) = decode_root(root_hex) else {
                    eprintln!("lok-order refused: root must be 32 bytes");
                    continue;
                };
                if let Err(err) = orderer.propose_only(height, root) {
                    write_status(&mut stdout, &orderer);
                    eprintln!("lok-order provisional: {err}");
                } else {
                    write_status(&mut stdout, &orderer);
                }
            }
            Some(other) => {
                eprintln!("lok-order refused: unknown op {other}");
            }
            None => {
                let (Some(height), Some(root_hex)) = (submit.height, submit.root.as_deref()) else {
                    eprintln!("lok-order refused: commit needs a height and a root");
                    continue;
                };
                let Some(root) = decode_root(root_hex) else {
                    eprintln!("lok-order refused: root must be 32 bytes");
                    continue;
                };
                match orderer.commit(height, root) {
                    Ok(_) => write_status(&mut stdout, &orderer),
                    Err(err) => {
                        write_status(&mut stdout, &orderer);
                        eprintln!("lok-order provisional: {err}");
                    }
                }
            }
        }
    }
}
