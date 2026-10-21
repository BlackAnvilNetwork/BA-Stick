/**
 * A Mark Safe and a Guild Wallet are predicted with the Protocol Kit, then
 * deployed on that same address. The local anvil account pays. Nothing is
 * broadcast, and no deployer key is written onto a replica.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import Safe from "@safe-global/protocol-kit";
import { createPublicClient, createWalletClient, encodeFunctionResult, http, parseEther, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { postReplicaBond, resetBondedAdmissionForTests, votingReplica } from "./bonded-admission";
import {
  acceptGuildJoin,
  bondSafeAddress,
  guildMarkSafe,
  guildMembers,
  joinGuild,
  openGuild,
  resetGuildRegistryForTests,
} from "./guild-registry";
import {
  ADMIN_SAFE_MIN_THRESHOLD,
  GUILD_WALLET_THRESHOLD,
  LISTING_SAFE_THRESHOLD,
  MARK_SAFE_THRESHOLD,
  anvilContractNetworks,
  guildWallet,
  guildWalletOwner,
  keptAdminSafeThreshold,
  markComesOnline,
  openGuildWallet,
  predictGuildWallet,
  predictMarkSafe,
  saltNonceForGuildWallet,
  saltNonceForOperator,
  type LocalSafeContracts,
} from "./guild-safes";
import { PINNED_GNOSIS_LISTING_ADDRESS } from "./production-boot";
import { postedSlashableBond, resetRootAnchorForTests } from "./root-anchor";
import { resolveAnvilBin, startThrowawayAnvil, SUPPORT_ANVIL_K0 } from "./support-anvil";

/**
 * Anvil's published default account 1. checkpoint-blob.test.ts already uses
 * this public account. It is not a production key.
 */
const ANVIL_MEMBER_KEY =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex;

/** Anvil's published account 2. Address only. It stands in for a session key. */
const SESSION_KEY_ADDRESS = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));

function reset(): void {
  resetGuildRegistryForTests();
  resetBondedAdmissionForTests();
  resetRootAnchorForTests();
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
    throw new Error("Safe contract did not deploy on anvil");
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

describe("mark and guild safes", { concurrency: false }, () => {
  test("the salt is the chain id plus the operator id, or the guild id plus the character id", () => {
    reset();
    try {
      const mark = saltNonceForOperator("operator-a");
      assert.equal(mark, saltNonceForOperator("operator-a", 31337));
      assert.notEqual(mark, saltNonceForOperator("operator-a", 100));
      assert.notEqual(mark, saltNonceForOperator("operator-b"));
      assert.equal(saltNonceForOperator("  operator-a  "), mark);
      assert.equal(saltNonceForOperator(""), null);
      const guild = saltNonceForGuildWallet("guild:operator-a", "character-1");
      assert.notEqual(guild, saltNonceForGuildWallet("guild:operator-a", "character-1", 100));
      assert.equal(guild, saltNonceForGuildWallet("guild:operator-a", "character-1"));
      assert.notEqual(guild, saltNonceForGuildWallet("guild:operator-b", "character-1"));
      assert.notEqual(guild, saltNonceForGuildWallet("guild:operator-a", "character-2"));
      assert.notEqual(saltNonceForGuildWallet("ab", "c"), saltNonceForGuildWallet("a", "bc"));
      assert.equal(MARK_SAFE_THRESHOLD, 1);
      assert.equal(GUILD_WALLET_THRESHOLD, 1);
      assert.equal(LISTING_SAFE_THRESHOLD, 1);
      assert.equal(ADMIN_SAFE_MIN_THRESHOLD, 2);
      assert.equal(keptAdminSafeThreshold(1), null);
      assert.equal(keptAdminSafeThreshold(2), 2);

      const member = privateKeyToAccount(ANVIL_MEMBER_KEY).address;
      assert.equal(guildWalletOwner("character-1", member), member);
      assert.equal(guildWalletOwner("character-1"), null);
      assert.equal(guildWalletOwner(member), member);
      assert.equal(guildWalletOwner(member, "not-an-account"), member);

      const deploy = readFileSync(join(HERE, "../../../contracts/lok-log/script/Deploy.s.sol"), "utf8");
      assert.match(deploy, /if \(threshold < 2\) revert BadConfig\("admin Safe threshold < 2"\);/);
      const source = readFileSync(new URL("./guild-safes.ts", import.meta.url), "utf8");
      assert.equal(source.includes("gnosis-dryrun.json"), false);
      assert.equal(source.includes(SUPPORT_ANVIL_K0), false);
      assert.equal(source.includes(ANVIL_MEMBER_KEY), false);
      const accept = readFileSync(new URL("./guild-registry.ts", import.meta.url), "utf8");
      const body = accept.slice(accept.indexOf("export async function acceptGuildJoin"), accept.indexOf("export function guildMarkSafe"));
      assert.equal(body.includes("fetch("), false);
      assert.equal(body.includes("chainBoundXdaiSend"), false);
    } finally {
      reset();
    }
  });

  test("Gnosis chain 100 predicts with its own salt and a second open sends nothing", async () => {
    reset();
    const proxyBytecode = artifactBytecode(
      "@safe-global/safe-smart-account/build/artifacts/contracts/proxies/SafeProxy.sol/SafeProxy.json",
    );
    const proxyCreationCodeResult = encodeFunctionResult({
      abi: [
        {
          name: "proxyCreationCode",
          type: "function",
          stateMutability: "pure",
          inputs: [],
          outputs: [{ type: "bytes" }],
        },
      ],
      functionName: "proxyCreationCode",
      result: proxyBytecode,
    });
    const methods: string[] = [];
    const server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        const parsed = JSON.parse(Buffer.concat(chunks).toString() || "{}") as { method?: string; id?: number };
        const method = parsed.method ?? "";
        methods.push(method);
        const broadcast = method === "eth_sendTransaction" || method === "eth_sendRawTransaction";
        let result: string | null = "0x";
        if (method === "eth_chainId") result = "0x64";
        else if (method === "eth_getCode") result = "0x" + "ab".repeat(32);
        else if (method === "eth_call") result = proxyCreationCodeResult;
        else if (method === "eth_getTransactionCount" || method === "eth_blockNumber") result = "0x1";
        res.setHeader("content-type", "application/json");
        res.end(
          JSON.stringify(
            broadcast
              ? { jsonrpc: "2.0", id: parsed.id ?? 1, error: { code: -32000, message: "broadcast" } }
              : { jsonrpc: "2.0", id: parsed.id ?? 1, result },
          ),
        );
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const bound = server.address();
    if (!bound || typeof bound === "string") throw new Error("stub rpc did not bind");
    const rpc = "http://127.0.0.1:" + bound.port;
    const stub = ("0x" + "11".repeat(20)) as Hex;
    const contracts: LocalSafeContracts = {
      safeSingletonAddress: stub,
      safeProxyFactoryAddress: stub,
      fallbackHandlerAddress: stub,
      multiSendAddress: stub,
      multiSendCallOnlyAddress: stub,
    };
    try {
      const predicted = await predictMarkSafe({
        rpc,
        operatorId: "operator-a",
        operatorKey: SUPPORT_ANVIL_K0,
        contracts,
      });
      assert.equal(predicted.ok, true, predicted.ok ? "" : predicted.error + " methods=" + methods.join(","));
      if (!predicted.ok) return;
      const again = await markComesOnline({
        rpc,
        operatorId: "operator-a",
        operatorKey: SUPPORT_ANVIL_K0,
        contracts,
      });
      assert.equal(again.ok, true, again.ok ? "" : again.error + " methods=" + methods.join(","));
      if (!again.ok) return;
      assert.equal(again.deployed, false);
      assert.equal(again.address.toLowerCase(), predicted.address.toLowerCase());
      assert.equal(methods.includes("eth_sendTransaction"), false);
      assert.equal(methods.includes("eth_sendRawTransaction"), false);
      assert.equal(keptAdminSafeThreshold(1), null);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      reset();
    }
  });

  test("accept predicts a Guild Wallet and refuses the Mark, the listing key, and the session key", async () => {
    reset();
    try {
      const amount = 1n;
      assert.equal(postReplicaBond("operator-a", "replica", amount).joined, true);
      assert.equal(postReplicaBond("operator-b", "replica", 2n).joined, true);
      const first = openGuild("operator-a", "operator-a");
      const second = openGuild("operator-b", "operator-b");
      assert.equal(first.opened, true);
      assert.equal(second.opened, true);
      const guildId = first.guild?.id ?? "";
      const otherId = second.guild?.id ?? "";
      const member = privateKeyToAccount(ANVIL_MEMBER_KEY).address;
      const mark = privateKeyToAccount(SUPPORT_ANVIL_K0).address;

      assert.equal(joinGuild(guildId, "character-1").requested, true);
      assert.deepEqual(await acceptGuildJoin(guildId, "character-1", "operator-a"), { accepted: true, feeWei: 0n });
      assert.equal(guildWallet(guildId, "character-1"), null);
      assert.equal(guildMembers(guildId)[0]?.feeWei, 0n);
      assert.equal(postedSlashableBond("operator-a"), amount);
      assert.equal(postedSlashableBond("character-1"), 0n);
      assert.equal(votingReplica("character-1"), null);
      assert.equal(votingReplica(SUPPORT_ANVIL_K0), null);
      assert.equal(votingReplica(ANVIL_MEMBER_KEY), null);

      assert.equal(joinGuild(guildId, "character-2").requested, true);
      assert.deepEqual(
        await acceptGuildJoin(guildId, "character-2", "operator-a", { memberAccount: member, mark, session: SESSION_KEY_ADDRESS }),
        { accepted: true, feeWei: 0n },
      );
      const wallet = guildWallet(guildId, "character-2");
      assert.equal(wallet?.owner, member);
      assert.equal(wallet?.threshold, 1);
      assert.equal(typeof wallet?.saltNonce, "string");
      assert.notEqual(wallet?.saltNonce, saltNonceForGuildWallet(otherId, "character-2"));

      assert.equal(joinGuild(otherId, "character-2").requested, true);
      assert.deepEqual(await acceptGuildJoin(otherId, "character-2", "operator-b", { memberAccount: member }), {
        accepted: true,
        feeWei: 0n,
      });
      const other = guildWallet(otherId, "character-2");
      assert.notEqual(other?.saltNonce, wallet?.saltNonce);
      assert.equal(other?.owner, member);

      assert.equal(joinGuild(guildId, mark).requested, true);
      assert.deepEqual(await acceptGuildJoin(guildId, mark, "operator-a", { mark }), { accepted: true, feeWei: 0n });
      assert.equal(guildWallet(guildId, mark), null);

      assert.equal(joinGuild(guildId, PINNED_GNOSIS_LISTING_ADDRESS).requested, true);
      assert.deepEqual(await acceptGuildJoin(guildId, PINNED_GNOSIS_LISTING_ADDRESS, "operator-a"), {
        accepted: true,
        feeWei: 0n,
      });
      assert.equal(guildWallet(guildId, PINNED_GNOSIS_LISTING_ADDRESS), null);

      assert.equal(joinGuild(guildId, SESSION_KEY_ADDRESS).requested, true);
      assert.deepEqual(
        await acceptGuildJoin(guildId, SESSION_KEY_ADDRESS, "operator-a", { session: SESSION_KEY_ADDRESS }),
        { accepted: true, feeWei: 0n },
      );
      assert.equal(guildWallet(guildId, SESSION_KEY_ADDRESS), null);

      assert.equal(joinGuild(guildId, "0x70997970C51812dc3A010C7d01b50e0d17dc79C8").requested, true);
      assert.deepEqual(await acceptGuildJoin(guildId, "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", "operator-a"), {
        accepted: true,
        feeWei: 0n,
      });
      assert.equal(guildWallet(guildId, "0x70997970C51812dc3A010C7d01b50e0d17dc79C8")?.owner, member);
      assert.equal(guildMarkSafe(guildId), null);
      assert.equal(bondSafeAddress("operator-a"), null);
      assert.equal(postedSlashableBond("operator-a"), amount);
    } finally {
      reset();
    }
  });

  test(
    "anvil predicts a Safe, deploys it, and the address matches",
    { skip: !resolveAnvilBin(), timeout: 180_000 },
    async () => {
      reset();
      const anvil = await startThrowawayAnvil();
      const operator = privateKeyToAccount(SUPPORT_ANVIL_K0);
      const member = privateKeyToAccount(ANVIL_MEMBER_KEY);
      const client = createPublicClient({ chain: foundry, transport: http(anvil.rpc) });
      try {
        const amount = 1n;
        assert.equal(postReplicaBond("operator-a", "replica", amount).joined, true);
        const openedGuild = openGuild("operator-a", "operator-a");
        assert.equal(openedGuild.opened, true);
        const guildId = openedGuild.guild?.id ?? "";
        const contracts = await deploySafeContracts(anvil.rpc);

        const chiado = await predictMarkSafe({
          rpc: "https://rpc.chiadochain.net",
          operatorId: "operator-a",
          operatorKey: SUPPORT_ANVIL_K0,
          contracts,
        });
        assert.equal(chiado.ok, false);
        if (!chiado.ok) assert.match(chiado.error, /refuses|chain id was not available/);

        const beforePredict = await client.getTransactionCount({ address: operator.address });
        const predicted = await predictMarkSafe({
          rpc: anvil.rpc,
          operatorId: "operator-a",
          operatorKey: SUPPORT_ANVIL_K0,
          contracts,
        });
        assert.equal(predicted.ok, true);
        if (!predicted.ok) return;
        assert.equal(await client.getTransactionCount({ address: operator.address }), beforePredict);
        assert.equal(guildMarkSafe(guildId)?.toLowerCase(), predicted.address.toLowerCase());
        assert.equal(bondSafeAddress("operator-a")?.toLowerCase(), predicted.address.toLowerCase());
        assert.equal(postedSlashableBond("operator-a"), amount);
        const empty = await client.getCode({ address: predicted.address });
        assert.equal(!empty || empty === "0x", true);

        const funder = createWalletClient({ account: operator, chain: foundry, transport: http(anvil.rpc) });
        const gift = parseEther("1");
        const funded = await funder.sendTransaction({ to: predicted.address, value: gift });
        await client.waitForTransactionReceipt({ hash: funded });
        const balanceBefore = await client.getBalance({ address: predicted.address });
        assert.equal(balanceBefore, gift);

        const online = await markComesOnline({
          rpc: anvil.rpc,
          operatorId: "operator-a",
          operatorKey: SUPPORT_ANVIL_K0,
          contracts,
        });
        assert.equal(online.ok, true);
        if (!online.ok) return;
        assert.equal(online.deployed, true);
        assert.equal(online.address.toLowerCase(), predicted.address.toLowerCase());
        assert.equal(online.payer?.toLowerCase(), operator.address.toLowerCase());
        assert.equal(await client.getBalance({ address: predicted.address }), balanceBefore);
        const code = await client.getCode({ address: online.address });
        assert.equal(typeof code === "string" && code !== "0x", true);

        const markKit = await Safe.init({
          provider: anvil.rpc,
          signer: SUPPORT_ANVIL_K0,
          safeAddress: online.address,
          isL1SafeSingleton: true,
          contractNetworks: anvilContractNetworks(contracts),
        });
        const markOwners = (await markKit.getOwners()).map((owner) => owner.toLowerCase());
        assert.deepEqual(markOwners, [operator.address.toLowerCase()]);
        assert.equal(await markKit.getThreshold(), MARK_SAFE_THRESHOLD);
        assert.equal(markOwners.includes(member.address.toLowerCase()), false);

        const nonce = await client.getTransactionCount({ address: operator.address });
        const reopened = await markComesOnline({
          rpc: anvil.rpc,
          operatorId: "operator-a",
          operatorKey: SUPPORT_ANVIL_K0,
          contracts,
        });
        assert.equal(reopened.ok, true);
        if (!reopened.ok) return;
        assert.equal(reopened.deployed, false);
        assert.equal(reopened.address.toLowerCase(), predicted.address.toLowerCase());
        assert.equal(await client.getTransactionCount({ address: operator.address }), nonce);
        assert.equal(postedSlashableBond("operator-a"), amount);
        assert.equal(votingReplica(SUPPORT_ANVIL_K0), null);
        assert.equal(votingReplica(operator.address), null);

        assert.equal(joinGuild(guildId, "character-1").requested, true);
        assert.deepEqual(
          await acceptGuildJoin(guildId, "character-1", "operator-a", {
            memberAccount: member.address,
            mark: operator.address,
            session: SESSION_KEY_ADDRESS,
            rpc: anvil.rpc,
            contracts,
          }),
          { accepted: true, feeWei: 0n },
        );
        const acceptedWallet = guildWallet(guildId, "character-1");
        assert.equal(acceptedWallet?.owner, member.address);
        assert.equal(typeof acceptedWallet?.address, "string");
        const predictedWallet = await predictGuildWallet({
          rpc: anvil.rpc,
          guildId,
          characterId: "character-1",
          contracts,
        });
        assert.equal(predictedWallet.ok, true);
        if (!predictedWallet.ok) return;
        assert.equal(predictedWallet.address.toLowerCase(), acceptedWallet?.address?.toLowerCase());
        assert.notEqual(predictedWallet.address.toLowerCase(), predicted.address.toLowerCase());
        const walletGift = await funder.sendTransaction({ to: predictedWallet.address, value: gift });
        await client.waitForTransactionReceipt({ hash: walletGift });
        const walletBalance = await client.getBalance({ address: predictedWallet.address });
        assert.equal(walletBalance, gift);

        const refusedOpen = await openGuildWallet({
          rpc: anvil.rpc,
          guildId,
          characterId: "character-1",
          memberKey: SUPPORT_ANVIL_K0,
          contracts,
        });
        assert.equal(refusedOpen.ok, false);
        const stillEmpty = await client.getCode({ address: predictedWallet.address });
        assert.equal(!stillEmpty || stillEmpty === "0x", true);

        const opened = await openGuildWallet({
          rpc: anvil.rpc,
          guildId,
          characterId: "character-1",
          memberKey: ANVIL_MEMBER_KEY,
          contracts,
        });
        assert.equal(opened.ok, true);
        if (!opened.ok) return;
        assert.equal(opened.deployed, true);
        assert.equal(opened.address.toLowerCase(), predictedWallet.address.toLowerCase());
        assert.equal(opened.payer?.toLowerCase(), member.address.toLowerCase());
        assert.equal(await client.getBalance({ address: predictedWallet.address }), walletBalance);

        const guildKit = await Safe.init({
          provider: anvil.rpc,
          signer: ANVIL_MEMBER_KEY,
          safeAddress: opened.address,
          isL1SafeSingleton: true,
          contractNetworks: anvilContractNetworks(contracts),
        });
        const guildOwners = (await guildKit.getOwners()).map((owner) => owner.toLowerCase());
        assert.deepEqual(guildOwners, [member.address.toLowerCase()]);
        assert.equal(await guildKit.getThreshold(), GUILD_WALLET_THRESHOLD);
        assert.equal(guildOwners.includes(operator.address.toLowerCase()), false);
        assert.equal(guildOwners.includes(PINNED_GNOSIS_LISTING_ADDRESS.toLowerCase()), false);
        assert.equal(guildOwners.includes(SESSION_KEY_ADDRESS.toLowerCase()), false);

        const memberNonce = await client.getTransactionCount({ address: member.address });
        const openedAgain = await openGuildWallet({
          rpc: anvil.rpc,
          guildId,
          characterId: "character-1",
          memberKey: ANVIL_MEMBER_KEY,
          contracts,
        });
        assert.equal(openedAgain.ok, true);
        if (!openedAgain.ok) return;
        assert.equal(openedAgain.deployed, false);
        assert.equal(openedAgain.address.toLowerCase(), predictedWallet.address.toLowerCase());
        assert.equal(await client.getTransactionCount({ address: member.address }), memberNonce);
        assert.equal(postedSlashableBond("operator-a"), amount);
        assert.equal(postedSlashableBond("character-1"), 0n);
        assert.equal(votingReplica(ANVIL_MEMBER_KEY), null);
        assert.equal(guildMembers(guildId)[0]?.feeWei, 0n);
      } finally {
        anvil.stop();
        reset();
      }
    },
  );
});
