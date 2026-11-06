/**
 * Listing calls go out as the owner key, or through the Listing Safe when
 * LOK_LISTING_SAFE is set. The Safe is msg.sender. The owner pays gas.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, test } from "node:test";
import { createPublicClient, createWalletClient, encodeFunctionData, getAddress, http, keccak256, toBytes, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { markComesOnline, resetGuildSafesForTests, type LocalSafeContracts } from "./guild-safes";
import { ethSignSafeSignature, listingSafeAddress, sendListingRoleCall } from "./listing-safe-exec";
import { resolveAnvilBin, startThrowawayAnvil, SUPPORT_ANVIL_K0 } from "./support-anvil";

const require = createRequire(import.meta.url);
const PING_ABI = [
  {
    type: "function",
    name: "ping",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
] as const;

function recorderRuntime(): Hex {
  const selector = keccak256(toBytes("ping()")).slice(2, 10);
  return ("0x63" + selector + "60003560e01c1460145760006000fd5b3360005500") as Hex;
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

async function callerOf(rpc: string, recorder: `0x${string}`): Promise<string> {
  const client = createPublicClient({ chain: foundry, transport: http(rpc) });
  const slot = await client.getStorageAt({ address: recorder, slot: "0x0" });
  return getAddress("0x" + (slot ?? "0x" + "0".repeat(64)).slice(-40));
}

test("listing safe address is optional and the eth_sign v is adjusted", () => {
  assert.equal(listingSafeAddress({}), null);
  assert.equal(listingSafeAddress({ LOK_LISTING_SAFE: "0x0000000000000000000000000000000000000000" }), null);
  assert.equal(
    listingSafeAddress({ LOK_LISTING_SAFE: "0xe10520c6122c01edd91403d98da9578c0ce5002b" }),
    "0xe10520c6122C01edD91403d98Da9578C0CE5002B",
  );
  const account = privateKeyToAccount(SUPPORT_ANVIL_K0);
  return account.signMessage({ message: { raw: keccak256(toBytes("listing-safe")) } }).then((signature) => {
    const adjusted = ethSignSafeSignature(signature);
    const v = Number.parseInt(signature.slice(-2), 16);
    assert.equal(Number.parseInt(adjusted.slice(-2), 16), v + 4);
    assert.equal(adjusted.slice(0, -2), signature.slice(0, -2));
  });
});

describe("listing role call", { concurrency: false }, () => {
  test(
    "the Safe is msg.sender when LOK_LISTING_SAFE is set",
    { skip: !resolveAnvilBin(), timeout: 180_000 },
    async () => {
      resetGuildSafesForTests();
      const anvil = await startThrowawayAnvil();
      const account = privateKeyToAccount(SUPPORT_ANVIL_K0);
      const wallet = createWalletClient({ account, chain: foundry, transport: http(anvil.rpc) });
      const pub = createPublicClient({ chain: foundry, transport: http(anvil.rpc) });
      const direct = "0x0000000000000000000000000000000000005111" as const;
      const throughSafe = "0x0000000000000000000000000000000000005112" as const;
      const runtime = recorderRuntime();
      try {
        await pub.request({ method: "anvil_setCode", params: [direct, runtime] });
        await pub.request({ method: "anvil_setCode", params: [throughSafe, runtime] });
        const directHash = await sendListingRoleCall({
          env: {},
          wallet,
          pub,
          account,
          chain: foundry,
          address: direct,
          abi: PING_ABI,
          functionName: "ping",
          args: [],
        });
        assert.equal((await pub.waitForTransactionReceipt({ hash: directHash })).status, "success");
        assert.equal(await callerOf(anvil.rpc, direct), account.address);
        assert.equal(runtime.slice(4, 12), encodeFunctionData({ abi: PING_ABI, functionName: "ping", args: [] }).slice(2));

        const contracts = await deploySafeContracts(anvil.rpc);
        const opened = await markComesOnline({
          rpc: anvil.rpc,
          operatorId: "listing-safe-exec",
          operatorKey: SUPPORT_ANVIL_K0,
          contracts,
        });
        assert.equal(opened.ok, true);
        if (!opened.ok) return;
        const safeHash = await sendListingRoleCall({
          env: { LOK_LISTING_SAFE: opened.address },
          wallet,
          pub,
          account,
          chain: foundry,
          address: throughSafe,
          abi: PING_ABI,
          functionName: "ping",
          args: [],
        });
        const receipt = await pub.waitForTransactionReceipt({ hash: safeHash });
        assert.equal(receipt.status, "success");
        assert.equal(receipt.to?.toLowerCase(), opened.address.toLowerCase());
        assert.equal(await callerOf(anvil.rpc, throughSafe), opened.address);
        assert.notEqual(await callerOf(anvil.rpc, throughSafe), account.address);
      } finally {
        resetGuildSafesForTests();
        anvil.stop();
      }
    },
  );
});
