//! Replay a hash-chained lok log. Stops at the first bad hash.
//! A `characters` document is one chain per character, merged by `seq`.
//!
//! `--expect-root <root>` checks a single-character log's `state_root`.
//! `--expect-root <tokenId>=<root>` checks that character in a characters
//! document. There is no aggregate world root; `head` is the chain head.

use std::env;
use std::fs;
use std::process::ExitCode;

use lok_engine::{
    parse_any_log, parse_b256, replay, replay_world, AnyLog, CharacterSnapshot, ReplayStop, U256,
};

const USAGE: &str = "\
usage: lok-replay <log.json> [--expect-root <root> | --expect-root <tokenId>=<root> ...]
  <root> is 32-byte hex, with or without 0x.
  A bare --expect-root compares the single-character log's state_root.
  A single-character log may instead take one --expect-root <tokenId>=<root> for its own token.
  A characters document has one state_root per character and no world root.
  Repeat --expect-root <tokenId>=<root> for every character (decimal token id, or 0x hex).
  Exit 0 on match, 1 on a root or hash mismatch, 2 on a bad argument or parse error.";

#[derive(Clone, Copy)]
enum Expect {
    Bare([u8; 32]),
    Named(U256, [u8; 32]),
}

struct Cli {
    path: String,
    expect: Vec<Expect>,
}

fn hex32(bytes: &[u8; 32]) -> String {
    format!("0x{}", hex::encode(bytes))
}

fn main() -> ExitCode {
    let args: Vec<String> = env::args().skip(1).collect();
    if args.is_empty() || args.iter().any(|arg| arg == "-h" || arg == "--help") {
        eprintln!("{USAGE}");
        return ExitCode::from(2);
    }
    let cli = match parse_args(&args) {
        Ok(cli) => cli,
        Err(err) => {
            eprintln!("error: {err}");
            eprintln!("{USAGE}");
            return ExitCode::from(2);
        }
    };
    let text = match fs::read_to_string(&cli.path) {
        Ok(text) => text,
        Err(err) => {
            eprintln!("error: read {}: {err}", cli.path);
            return ExitCode::from(2);
        }
    };
    let doc = match parse_any_log(&text) {
        Ok(doc) => doc,
        Err(err) => {
            eprintln!("error: {err}");
            return ExitCode::from(2);
        }
    };
    match doc {
        AnyLog::Character(doc) => match replay(&doc) {
            Ok(report) => {
                println!(
                    "ok entries={} head={} state_root={} summary={}",
                    report.entries,
                    hex32(&report.head),
                    hex32(&report.state_root),
                    report.summary.to_hex()
                );
                check_character(doc.token_id, report.state_root, &cli.expect)
            }
            Err(stop) => stop_code(stop),
        },
        AnyLog::World(doc) => match replay_world(&doc) {
            Ok(report) => {
                println!(
                    "ok world entries={} head={} characters={}",
                    report.entries,
                    hex32(&report.head),
                    report.characters.len()
                );
                for character in &report.characters {
                    println!(
                        "token={} state_root={} summary={} gold={}",
                        character.token_id,
                        hex32(&character.state_root),
                        character.summary.to_hex(),
                        character.gold
                    );
                }
                check_world(&report.characters, &cli.expect)
            }
            Err(stop) => stop_code(stop),
        },
    }
}

fn parse_args(args: &[String]) -> Result<Cli, String> {
    let mut path = None;
    let mut expect = Vec::new();
    let mut i = 0;
    while i < args.len() {
        let arg = &args[i];
        if arg == "--expect-root" {
            i += 1;
            let value = args.get(i).ok_or("missing value for --expect-root")?;
            expect.push(parse_expect(value)?);
        } else if let Some(value) = arg.strip_prefix("--expect-root=") {
            if value.is_empty() {
                return Err("missing value for --expect-root".to_string());
            }
            expect.push(parse_expect(value)?);
        } else if arg.starts_with('-') {
            return Err(format!("unknown argument {arg}"));
        } else if path.is_some() {
            return Err("expected a single log path".to_string());
        } else {
            path = Some(arg.clone());
        }
        i += 1;
    }
    let mut seen = Vec::new();
    let mut bare = 0usize;
    for item in &expect {
        match item {
            Expect::Bare(_) => bare += 1,
            Expect::Named(id, _) => {
                if seen.contains(id) {
                    return Err(format!("duplicate --expect-root for token {id}"));
                }
                seen.push(*id);
            }
        }
    }
    if bare > 1 {
        return Err("only one bare --expect-root is allowed".to_string());
    }
    if bare > 0 && !seen.is_empty() {
        return Err("bare --expect-root cannot be combined with <tokenId>=<root>".to_string());
    }
    Ok(Cli {
        path: path.ok_or("missing log path")?,
        expect,
    })
}

fn parse_expect(value: &str) -> Result<Expect, String> {
    match value.split_once('=') {
        Some((token, root)) => {
            if token.is_empty() || root.is_empty() {
                return Err(format!("bad --expect-root {value}"));
            }
            Ok(Expect::Named(parse_token_id(token)?, parse_root(root)?))
        }
        None => Ok(Expect::Bare(parse_root(value)?)),
    }
}

fn parse_root(value: &str) -> Result<[u8; 32], String> {
    parse_b256(value).map_err(|_| format!("bad root {value}: expected 32-byte hex"))
}

fn parse_token_id(value: &str) -> Result<U256, String> {
    if let Some(hexbody) = value.strip_prefix("0x").or_else(|| value.strip_prefix("0X")) {
        if hexbody.is_empty()
            || hexbody.len() > 64
            || !hexbody.bytes().all(|b| b.is_ascii_hexdigit())
        {
            return Err(format!("bad token id {value}"));
        }
        let padded = format!("{:0>64}", hexbody);
        let word = parse_b256(&padded).map_err(|_| format!("bad token id {value}"))?;
        return Ok(U256(word));
    }
    U256::parse_dec(value).map_err(|_| format!("bad token id {value}"))
}

fn check_character(token_id: U256, state_root: [u8; 32], expect: &[Expect]) -> ExitCode {
    if expect.is_empty() {
        return ExitCode::SUCCESS;
    }
    if expect.len() != 1 {
        eprintln!("error: a single-character log takes one --expect-root");
        eprintln!("{USAGE}");
        return ExitCode::from(2);
    }
    match expect[0] {
        Expect::Bare(want) => compare_root(token_id, want, state_root),
        Expect::Named(id, want) => {
            if id != token_id {
                eprintln!("state_root mismatch for token {id}");
                eprintln!("  log token: {token_id}");
                return ExitCode::from(1);
            }
            compare_root(token_id, want, state_root)
        }
    }
}

fn check_world(characters: &[CharacterSnapshot], expect: &[Expect]) -> ExitCode {
    if expect.is_empty() {
        return ExitCode::SUCCESS;
    }
    if expect.iter().any(|item| matches!(item, Expect::Bare(_))) {
        eprintln!(
            "error: a characters document has no single state_root; \
             use --expect-root <tokenId>=<root> for each character"
        );
        eprintln!("{USAGE}");
        return ExitCode::from(2);
    }
    for item in expect {
        let Expect::Named(id, want) = *item else {
            continue;
        };
        match characters.iter().find(|character| character.token_id == id) {
            None => {
                eprintln!("state_root mismatch for token {id}");
                eprintln!("  expected: {}", hex32(&want));
                eprintln!("  computed: (no character)");
                return ExitCode::from(1);
            }
            Some(character) if character.state_root != want => {
                return compare_root(id, want, character.state_root);
            }
            Some(_) => {}
        }
    }
    for character in characters {
        let named = expect.iter().any(|item| {
            matches!(item, Expect::Named(id, _) if *id == character.token_id)
        });
        if !named {
            eprintln!("state_root mismatch for token {}", character.token_id);
            eprintln!("  expected: (not provided)");
            eprintln!("  computed: {}", hex32(&character.state_root));
            return ExitCode::from(1);
        }
    }
    ExitCode::SUCCESS
}

fn compare_root(token_id: U256, expected: [u8; 32], computed: [u8; 32]) -> ExitCode {
    if expected == computed {
        return ExitCode::SUCCESS;
    }
    eprintln!("state_root mismatch for token {token_id}");
    eprintln!("  expected: {}", hex32(&expected));
    eprintln!("  computed: {}", hex32(&computed));
    ExitCode::from(1)
}

fn stop_code(stop: ReplayStop) -> ExitCode {
    match stop {
        ReplayStop::BadHash { index, expected, computed } => {
            eprintln!("bad hash at index {index}");
            eprintln!("  expected: {}", hex32(&expected));
            eprintln!("  computed: {}", hex32(&computed));
            ExitCode::from(1)
        }
        ReplayStop::Rejected { index, reason } => {
            eprintln!("rejected at index {index}: {reason}");
            ExitCode::from(2)
        }
    }
}
