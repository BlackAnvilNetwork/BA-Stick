//! Read `{height, root}` lines and run the one-validator orderer.
//!
//! A caller that only writes a line does not wait for the commit reply.
//! A missing binary, a refused line, or no commit leaves that batch provisional.

use std::io::{self, BufRead, Write};

use lok_order::GenesisOrderer;
use serde::Deserialize;

#[derive(Deserialize)]
struct Submit {
    height: u64,
    root: String,
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

fn main() {
    let mut orderer = GenesisOrderer::generate();
    let stdin = io::stdin();
    let mut stdout = io::stdout();
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
        let Some(root) = decode_root(&submit.root) else {
            eprintln!("lok-order refused: root must be 32 bytes");
            continue;
        };
        match orderer.commit(submit.height, root) {
            Ok(committed) => {
                let mut hex = String::with_capacity(64);
                for byte in committed.root {
                    hex.push_str(&format!("{byte:02x}"));
                }
                let _ = writeln!(
                    stdout,
                    "{{\"committed\":true,\"height\":{},\"root\":\"{hex}\",\"signatures\":{}}}",
                    committed.height, committed.signatures
                );
                let _ = stdout.flush();
            }
            Err(err) => eprintln!("lok-order provisional: {err}"),
        }
    }
}
