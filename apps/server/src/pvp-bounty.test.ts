import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { describe, it } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PVP_BOUNTY_WEI } from "@bellgrave/config";
import { encodeAbiParameters, encodeEventTopics, type Log, type TransactionReceipt } from "viem";
import {
  pvpBountyAddress,
  pvpBountyClientConfig,
  pvpSyntheticReceiptsAllowed,
} from "./pvp-bounty";
import {
  PVP_BOUNTY_ABI,
  PVP_CLAIM_DELAY_CAP_SEC,
  chainPvpClaim,
  configurePvpClaimResume,
  executeClaimReceipt,
  loadPendingPvpClaims,
  mirrorPvpLog,
  pvpClaimWaitMs,
  readCharacterOwnerResult,
  rememberPendingPvpClaim,
  resetPvpClaimResumeForTests,
} from "./pvp-bounty-tx";
import { CHALLENGE_DELAY_MS } from "./root-anchor";

describe("pvp bounty env gate", () => {
  it("allows synthetic on anvil / default chain without deploy", () => {
    assert.equal(pvpSyntheticReceiptsAllowed({ LOK_CHAIN_ID: "31337" }), true);
    assert.equal(pvpSyntheticReceiptsAllowed({}), true);
  });

  it("refuses synthetic when LOK_PVP_BOUNTY is wired (live escrow)", () => {
    const addr = "0x" + "ab".repeat(20);
    assert.equal(
      pvpSyntheticReceiptsAllowed({ LOK_CHAIN_ID: "31337", LOK_PVP_BOUNTY: addr }),
      false,
    );
    const cfg = pvpBountyClientConfig({
      LOK_CHAIN_ID: "31337",
      LOK_PVP_BOUNTY: addr,
      LOK_CHAIN_RPC: "http://127.0.0.1:8545",
    });
    assert.ok(cfg);
    assert.equal(cfg!.synthetic, false);
    assert.equal(cfg!.address, addr.toLowerCase());
    assert.equal(cfg!.bountyWei, "1000000000000000000");
    assert.equal(cfg!.currency, "xDAI");
  });

  it("refuses synthetic on Gnosis / Chiado", () => {
    assert.equal(pvpSyntheticReceiptsAllowed({ LOK_CHAIN_ID: "100" }), false);
    assert.equal(pvpSyntheticReceiptsAllowed({ LOK_CHAIN_ID: "10200" }), false);
  });

  it("honors LOK_PVP_SYNTHETIC override", () => {
    assert.equal(pvpSyntheticReceiptsAllowed({ LOK_CHAIN_ID: "100", LOK_PVP_SYNTHETIC: "1" }), true);
    assert.equal(pvpSyntheticReceiptsAllowed({ LOK_CHAIN_ID: "31337", LOK_PVP_SYNTHETIC: "0" }), false);
    assert.equal(
      pvpSyntheticReceiptsAllowed({
        LOK_CHAIN_ID: "31337",
        LOK_PVP_BOUNTY: "0x" + "cd".repeat(20),
        LOK_PVP_SYNTHETIC: "1",
      }),
      true,
    );
  });

  it("keeps the anchor day and the bounty claim delay on separate clocks", () => {
    assert.equal(CHALLENGE_DELAY_MS, 24 * 60 * 60 * 1000);
    assert.notEqual(CHALLENGE_DELAY_MS, 60 * 1000);
    const root = dirname(fileURLToPath(import.meta.url));
    const bounty = readFileSync(join(root, "../../../contracts/lok-log/src/PvpBounty.sol"), "utf8");
    const tx = readFileSync(join(root, "pvp-bounty-tx.ts"), "utf8");
    assert.equal(bounty.includes("RootAnchor"), false);
    assert.equal(bounty.includes("CHALLENGE_DELAY"), false);
    assert.match(bounty, /uint256 ready = block\.timestamp \+ claimDelay;/);
    assert.match(bounty, /if \(block\.timestamp < pending\.readyAt\) revert TooEarly\(\);/);
    const cancelFn = bounty.slice(bounty.indexOf("function cancel"), bounty.indexOf("function proposeClaim"));
    assert.equal(cancelFn.includes("claimDelay"), false);
    assert.match(tx, /const gate = chainBoundSendGate\(\);/);
    assert.match(tx, /functionName: "claimDelay"/);
    assert.match(tx, /const waitMs = Number\(delay\) \* 1000 \+ 1500;/);
  });

  it("parses LOK_PVP_BOUNTY", () => {
    assert.equal(pvpBountyAddress({}), null);
    assert.equal(
      pvpBountyAddress({ LOK_PVP_BOUNTY: "0x" + "ab".repeat(20) }),
      ("0x" + "ab".repeat(20)).toLowerCase(),
    );
  });
});

function bountyTxSource(): string {
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), "pvp-bounty-tx.ts"), "utf8");
}

function claimFnSource(): string {
  const tx = bountyTxSource();
  return tx.slice(tx.indexOf("export async function chainPvpClaim"), tx.indexOf("export async function receiptFromPlaceTx"));
}

function executeFnSource(): string {
  const tx = bountyTxSource();
  return tx.slice(tx.indexOf("async function executePvpClaim"), tx.indexOf("export async function chainPvpClaim"));
}

describe("pvp bounty claim fixes", () => {
  it("does not hold the owner-key queue across claimDelay sleep", () => {
    const claim = claimFnSource();
    const firstQueue = claim.indexOf("withOwnerKeyQueue");
    const sleepAt = claim.indexOf("await sleep(proposed.waitMs)");
    const executeAt = claim.indexOf("executePvpClaim");
    assert.ok(firstQueue >= 0 && sleepAt > firstQueue && executeAt > sleepAt);
    assert.equal((claim.match(/withOwnerKeyQueue/g) ?? []).length, 1);
    assert.match(executeFnSource(), /withOwnerKeyQueue/);
    assert.doesNotMatch(executeFnSource(), /await sleep/);
  });

  it("refuses a too-long claimDelay before proposeClaim", () => {
    const over = pvpClaimWaitMs(PVP_CLAIM_DELAY_CAP_SEC + 1n);
    assert.equal(over.ok, false);
    if (!over.ok) assert.match(over.error, /too long to wait in-process/);
    const ok = pvpClaimWaitMs(PVP_CLAIM_DELAY_CAP_SEC);
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.waitMs, Number(PVP_CLAIM_DELAY_CAP_SEC) * 1000 + 1500);

    const claim = claimFnSource();
    const waitAt = claim.indexOf("pvpClaimWaitMs(delay)");
    const proposeAt = claim.indexOf('functionName: "proposeClaim"');
    assert.ok(waitAt >= 0 && proposeAt > waitAt);
  });

  it("does not treat a failed ownerOf as a sold slayer NFT", async () => {
    const missing = await readCharacterOwnerResult("1", {});
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.reason, "unconfigured");

    const failed = await readCharacterOwnerResult("1", {
      LOK_NFT: "0x" + "ab".repeat(20),
      LOK_CHAIN_RPC: "http://127.0.0.1:1",
    });
    assert.equal(failed.ok, false);
    if (!failed.ok) assert.equal(failed.reason, "read_failed");

    const claim = await chainPvpClaim("1", "2", "0x" + "cd".repeat(20), {
      LOK_NFT: "0x" + "ab".repeat(20),
      LOK_CHAIN_RPC: "http://127.0.0.1:1",
    });
    assert.equal(claim.ok, false);
    if (!claim.ok) {
      assert.match(claim.error, /Could not verify slayer ownership|Waiting for/);
      assert.doesNotMatch(claim.error, /no longer owns/);
    }

    const src = claimFnSource();
    assert.match(src, /Could not verify slayer ownership/);
    assert.match(src, /no longer owns that character/);
    const verifyAt = src.indexOf("Could not verify slayer ownership");
    const soldAt = src.indexOf("no longer owns that character");
    assert.ok(verifyAt >= 0 && soldAt > verifyAt);
  });

  it("releases the epoch charge when execute receipt wait throws", () => {
    const execute = executeFnSource();
    assert.match(execute, /release\(\);\s*throw err;/);
    assert.doesNotMatch(execute, /if \(!claimSent\) release/);
  });

  it("treats a successful execute without BountyClaimed as paid", () => {
    const hash = ("0x" + "11".repeat(32)) as `0x${string}`;
    const receipt = executeClaimReceipt({
      transactionHash: hash,
      logs: [],
    } as unknown as TransactionReceipt);
    assert.equal(receipt.txHash, hash);
    assert.equal(receipt.logIndex, 0);
    assert.doesNotMatch(executeFnSource(), /missing BountyClaimed/);
  });

  it("regates after claimDelay and still executes if ClaimProposed is missing", () => {
    const claim = claimFnSource();
    assert.match(claim, /await sleep\(proposed\.waitMs\)/);
    assert.match(claim, /return await executePvpClaim/);
    assert.doesNotMatch(claim, /missing ClaimProposed/);
    assert.match(executeFnSource(), /const gate = chainBoundSendGate\(\);/);
    assert.match(bountyTxSource(), /rememberPendingPvpClaim/);
    assert.match(bountyTxSource(), /scheduleClaimResume/);
  });

  it("persists ClaimProposed so execute can resume after restart", () => {
    const dir = mkdtempSync(join(tmpdir(), "pvp-pending-"));
    try {
      configurePvpClaimResume({ dataDir: dir });
      rememberPendingPvpClaim({
        victimTokenId: "9",
        slayerTokenId: "8",
        payout: "0x" + "ab".repeat(20),
        readyAt: 1_800_000_000,
      });
      resetPvpClaimResumeForTests();
      configurePvpClaimResume({ dataDir: dir });
      const loaded = loadPendingPvpClaims();
      assert.equal(loaded.length, 1);
      assert.equal(loaded[0]?.victimTokenId, "9");
      assert.equal(loaded[0]?.readyAt, 1_800_000_000);
    } finally {
      resetPvpClaimResumeForTests();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("mirrors BountyClaimed even when amountWei is not PVP_BOUNTY_WEI", () => {
    const amountWei = 2n * BigInt(PVP_BOUNTY_WEI);
    const log = {
      topics: encodeEventTopics({
        abi: PVP_BOUNTY_ABI,
        eventName: "BountyClaimed",
        args: {
          victimTokenId: 3n,
          slayerTokenId: 4n,
          slayerPayout: ("0x" + "ab".repeat(20)) as `0x${string}`,
        },
      }),
      data: encodeAbiParameters([{ type: "uint256" }], [amountWei]),
      address: ("0x" + "cd".repeat(20)) as `0x${string}`,
      transactionHash: ("0x" + "22".repeat(32)) as `0x${string}`,
      logIndex: 7,
    } as Log;
    let killed: { victim: string; amountWei: string } | null = null;
    mirrorPvpLog(
      {
        pvpBountyOf: () => ({ areaId: "ash_pit" }),
        pvpBountyOpen: () => ({ ok: true }),
        pvpBountyCancel: () => ({ ok: true }),
        pvpKill: (victim, _slayer, _area, amountWei) => {
          killed = { victim, amountWei };
          return { ok: true };
        },
      },
      log,
    );
    assert.ok(killed);
    assert.equal(killed.victim, "3");
    assert.equal(killed.amountWei, (2n * BigInt(PVP_BOUNTY_WEI)).toString());
    assert.notEqual(killed.amountWei, PVP_BOUNTY_WEI);
  });

  it("records ClaimProposed so a restart can resume execute", () => {
    const dir = mkdtempSync(join(tmpdir(), "pvp-proposed-"));
    try {
      configurePvpClaimResume({ dataDir: dir });
      mirrorPvpLog(
        {
          pvpBountyOf: () => ({ areaId: "ash_pit" }),
          pvpBountyOpen: () => ({ ok: true }),
          pvpBountyCancel: () => ({ ok: true }),
          pvpKill: () => ({ ok: true }),
        },
        {
          topics: encodeEventTopics({
            abi: PVP_BOUNTY_ABI,
            eventName: "ClaimProposed",
            args: {
              victimTokenId: 5n,
              slayerTokenId: 6n,
              payout: ("0x" + "ef".repeat(20)) as `0x${string}`,
            },
          }),
          data: encodeAbiParameters([{ type: "uint64" }], [1_900_000_000n]),
          address: ("0x" + "cd".repeat(20)) as `0x${string}`,
          transactionHash: ("0x" + "33".repeat(32)) as `0x${string}`,
          logIndex: 1,
        } as Log,
      );
      const loaded = loadPendingPvpClaims();
      assert.equal(loaded.length, 1);
      assert.equal(loaded[0]?.victimTokenId, "5");
      assert.equal(loaded[0]?.slayerTokenId, "6");
      assert.equal(loaded[0]?.readyAt, 1_900_000_000);
    } finally {
      resetPvpClaimResumeForTests();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
