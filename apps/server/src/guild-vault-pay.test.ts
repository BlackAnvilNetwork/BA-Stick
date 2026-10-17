/**
 * A 10,000 wei sale puts 250 in the guild vault. After the anchor and the
 * one-day delay, the Mark Safe receives 125 and four predicted Guild Wallets
 * share the other 125. The wallets are not deployed yet. Dust stays in the vault.
 * Gnosis and Chiado are refused. Zero posted bonds refuse the send.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, encodeAbiParameters, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { postReplicaBond, resetBondedAdmissionForTests } from "./bonded-admission";
import { allowEpochSettlementForTests } from "./epoch-cap-fixture";
import {
  acceptGuildJoin,
  guildMarkSafe,
  joinGuild,
  openGuild,
  resetGuildRegistryForTests,
} from "./guild-registry";
import {
  certifyGuildBatch,
  CHALLENGE_DELAY_MS,
  creditGuildVault,
  noteGuildBatch,
  resetGuildScoreForTests,
  settleGuildPayouts,
} from "./guild-score";
import {
  guildWallet,
  predictMarkSafe,
  resetGuildSafesForTests,
  type LocalSafeContracts,
} from "./guild-safes";
import { payGuildVault } from "./guild-vault-pay";
import { postCertifiedBatch, resetRootAnchorForTests, setChallengeClockForTests } from "./root-anchor";
import { resolveAnvilBin, resolveForgeBin, startThrowawayAnvil, SUPPORT_ANVIL_K0 } from "./support-anvil";

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const LOK = join(HERE, "../../../contracts/lok-log");
const MARK = "11".repeat(32);

const MEMBER_KEYS = [
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
  "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
] as const;

function reset(): void {
  resetGuildScoreForTests();
  resetGuildRegistryForTests();
  resetGuildSafesForTests();
  resetBondedAdmissionForTests();
  resetRootAnchorForTests();
}

function certificate(signerHex: string): Uint8Array {
  const out = new Uint8Array(52 + 96);
  new DataView(out.buffer).setUint32(48, 1, true);
  out.set(Buffer.from(signerHex, "hex"), 52);
  return out;
}

function artifactBytecode(path: string): Hex {
  const artifact = require(path) as { bytecode: string };
  return artifact.bytecode as Hex;
}

async function deployCreate(rpc: string, data: Hex): Promise<`0x${string}`> {
  const account = privateKeyToAccount(SUPPORT_ANVIL_K0);
  const wallet = createWalletClient({ account, chain: foundry, transport: http(rpc) });
  const client = createPublicClient({ chain: foundry, transport: http(rpc) });
  const hash = await wallet.sendTransaction({ data });
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success" || !receipt.contractAddress) {
    throw new Error("contract did not deploy on anvil");
  }
  return receipt.contractAddress;
}

async function deploySafeContracts(rpc: string): Promise<LocalSafeContracts> {
  const root = "@safe-global/safe-smart-account/build/artifacts/contracts/";
  return {
    safeSingletonAddress: await deployCreate(rpc, artifactBytecode(root + "Safe.sol/Safe.json")),
    safeProxyFactoryAddress: await deployCreate(
      rpc,
      artifactBytecode(root + "proxies/SafeProxyFactory.sol/SafeProxyFactory.json"),
    ),
    fallbackHandlerAddress: await deployCreate(
      rpc,
      artifactBytecode(root + "handler/CompatibilityFallbackHandler.sol/CompatibilityFallbackHandler.json"),
    ),
    multiSendAddress: await deployCreate(rpc, artifactBytecode(root + "libraries/MultiSend.sol/MultiSend.json")),
    multiSendCallOnlyAddress: await deployCreate(
      rpc,
      artifactBytecode(root + "libraries/MultiSendCallOnly.sol/MultiSendCallOnly.json"),
    ),
  };
}

function guildVaultBytecode(): Hex {
  const forge = resolveForgeBin();
  if (!forge) throw new Error("forge not found");
  execFileSync(forge, ["build", "--silent"], { cwd: LOK, stdio: "pipe" });
  const artifact = JSON.parse(readFileSync(join(LOK, "out/GuildVault.sol/GuildVault.json"), "utf8")) as {
    bytecode: { object: Hex };
  };
  return artifact.bytecode.object;
}

describe("guild vault payout", { concurrency: false }, () => {
  test("gnosis and chiado are refused", async () => {
    const share = {
      guildId: "guild:test",
      to: "0x00000000000000000000000000000000000000a1" as `0x${string}`,
      role: "mark" as const,
      wei: 1n,
    };
    const gnosis = await payGuildVault({
      rpc: "https://rpc.gnosischain.com",
      vault: "0x0000000000000000000000000000000000000001",
      payerKey: SUPPORT_ANVIL_K0,
      shares: [share],
    });
    assert.equal(gnosis.ok, false);
    const chiado = await payGuildVault({
      rpc: "https://rpc.chiadochain.net",
      vault: "0x0000000000000000000000000000000000000001",
      payerKey: SUPPORT_ANVIL_K0,
      shares: [share],
    });
    assert.equal(chiado.ok, false);
  });

  test(
    "anvil pays the predicted Mark Safe and four undeployed Guild Wallets",
    { skip: !resolveAnvilBin(), timeout: 180_000 },
    async () => {
      reset();
      const anvil = await startThrowawayAnvil();
      const operator = privateKeyToAccount(SUPPORT_ANVIL_K0);
      const members = MEMBER_KEYS.map((key, index) => ({
        key,
        characterId: "character-" + String(index + 1),
        account: privateKeyToAccount(key),
      }));
      const client = createPublicClient({ chain: foundry, transport: http(anvil.rpc) });
      try {
        assert.equal(postReplicaBond(MARK, "replica", 10n).joined, true);
        const opened = openGuild(MARK, MARK);
        assert.equal(opened.opened, true);
        const guildId = opened.guild?.id ?? "";
        const contracts = await deploySafeContracts(anvil.rpc);
        const predicted = await predictMarkSafe({
          rpc: anvil.rpc,
          operatorId: MARK,
          operatorKey: SUPPORT_ANVIL_K0,
          contracts,
        });
        assert.equal(predicted.ok, true);
        if (!predicted.ok) return;
        for (const member of members) {
          assert.equal(joinGuild(guildId, member.characterId).requested, true);
          assert.deepEqual(
            await acceptGuildJoin(guildId, member.characterId, MARK, {
              memberAccount: member.account.address,
              mark: operator.address,
              rpc: anvil.rpc,
              contracts,
            }),
            { accepted: true, feeWei: 0n },
          );
          const wallet = guildWallet(guildId, member.characterId);
          assert.equal(typeof wallet?.address, "string");
          const code = await client.getCode({ address: wallet?.address ?? predicted.address });
          assert.equal(!code || code === "0x", true);
        }
        assert.equal(joinGuild(guildId, "still-requesting").requested, true);

        creditGuildVault(10_000n);
        noteGuildBatch({
          epoch: 0,
          height: 4,
          events: [{ characterId: members[0]?.characterId ?? "", kind: "combat" }],
        });
        certifyGuildBatch(4, certificate(MARK));
        const anchorAt = 1_700_000_000_000;
        setChallengeClockForTests(() => anchorAt);
        const posted = await postCertifiedBatch(
          { height: 4, nextRoot: new Uint8Array(32).fill(4), certificate: certificate(MARK) },
          { env: { LOK_CHAIN_ID: "31337" }, poster: async () => true },
        );
        assert.equal(posted, true);
        const settled = settleGuildPayouts(anchorAt + CHALLENGE_DELAY_MS);
        assert.equal(settled.ok, true);
        assert.equal(settled.shares[0]?.to.toLowerCase(), guildMarkSafe(guildId)?.toLowerCase());
        assert.equal(settled.shares[0]?.wei, 125n);
        assert.equal(settled.shares.filter((share) => share.role === "member").length, 4);
        assert.equal(settled.vaultWei, 1n);
        const memberShares = settled.shares.filter((share) => share.role === "member");
        assert.equal(memberShares.every((share) => share.wei === 31n), true);
        assert.equal(
          memberShares.reduce((sum, share) => sum + share.wei, 0n),
          124n,
        );

        const args = encodeAbiParameters(
          [{ type: "address" }, { type: "address" }],
          [operator.address, operator.address],
        );
        const vault = await deployCreate(anvil.rpc, (guildVaultBytecode() + args.slice(2)) as Hex);
        const funder = createWalletClient({ account: operator, chain: foundry, transport: http(anvil.rpc) });
        const funded = await funder.sendTransaction({ to: vault, value: 250n });
        await client.waitForTransactionReceipt({ hash: funded });
        assert.equal(await client.getBalance({ address: vault }), 250n);

        await allowEpochSettlementForTests(0n);
        const blocked = await payGuildVault({
          rpc: anvil.rpc,
          vault,
          payerKey: SUPPORT_ANVIL_K0,
          shares: settled.shares,
        });
        assert.equal(blocked.ok, false);
        assert.equal(await client.getBalance({ address: predicted.address }), 0n);
        assert.equal(await client.getBalance({ address: vault }), 250n);

        await allowEpochSettlementForTests(2_490n);
        const paid = await payGuildVault({
          rpc: anvil.rpc,
          vault,
          payerKey: SUPPORT_ANVIL_K0,
          shares: settled.shares,
        });
        assert.equal(paid.ok, true);
        if (!paid.ok) return;
        assert.equal(paid.sentWei, 249n);
        assert.equal(await client.getBalance({ address: predicted.address }), 125n);
        for (const share of memberShares) {
          assert.equal(await client.getBalance({ address: share.to }), 31n);
          const code = await client.getCode({ address: share.to });
          assert.equal(!code || code === "0x", true);
        }
        assert.equal(await client.getBalance({ address: vault }), 1n);

        const again = await payGuildVault({
          rpc: anvil.rpc,
          vault,
          payerKey: SUPPORT_ANVIL_K0,
          shares: settled.shares,
        });
        assert.equal(again.ok, false);
        assert.equal(await client.getBalance({ address: vault }), 1n);
      } finally {
        anvil.stop();
        reset();
      }
    },
  );
});
