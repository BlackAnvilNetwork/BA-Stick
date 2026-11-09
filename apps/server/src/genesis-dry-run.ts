/**
 * Replay a copy of a journal and report the published root.
 * The source directory is only read. The copy is the directory LokWorld opens,
 * so a snapshot write cannot land on the live world.
 */
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bytesToHex } from "viem";
import { LOCAL_RULESET_HASH } from "./lok-vault";
import { LokWorld } from "./lok-world";
import { publishedWorldRoot } from "./published-root";

const COPY_FILES = ["lok-world.jsonl", "lok-world.json", "lok-bind.json"] as const;

export type GenesisDryRun = {
  sourceDir: string;
  copyDir: string;
  entries: number;
  merkleRoot: `0x${string}`;
  rulesetHash: `0x${string}`;
  publishedRoot: `0x${string}`;
};

export function dryRunGenesis(sourceDir: string, copyDir: string): GenesisDryRun {
  mkdirSync(copyDir, { recursive: true });
  let copied = 0;
  for (const name of COPY_FILES) {
    const from = join(sourceDir, name);
    if (!existsSync(from)) continue;
    cpSync(from, join(copyDir, name));
    copied += 1;
  }
  if (copied === 0) throw new Error("No journal files in " + sourceDir);
  const world = LokWorld.open(copyDir);
  const merkle = bytesToHex(world.characterRootTreeRoot());
  const ruleset = LOCAL_RULESET_HASH as `0x${string}`;
  const published = publishedWorldRoot(merkle, ruleset);
  const report: GenesisDryRun = {
    sourceDir,
    copyDir,
    entries: world.length,
    merkleRoot: merkle,
    rulesetHash: ruleset,
    publishedRoot: published,
  };
  writeFileSync(join(copyDir, "genesis-dry-run.json"), JSON.stringify(report, null, 2) + "\n");
  return report;
}
