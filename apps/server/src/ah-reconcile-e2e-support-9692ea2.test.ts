/**
 * Support review of 9692ea2: H2 end to end on a real (throwaway) anvil.
 * Self-starts anvil + AhEscrowFixture when foundry/libs are present.
 * Honors LOK_SUPPORT_RPC + LOK_SUPPORT_ESCROW when set. Never touches :8545.
 */
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { applyAskFilled, scanAskFilled } from "./ah-escrow";
import { reconcileOpenAsksFromChain } from "./ah-escrow-reconcile";
import {
  AskFilledQuarantine,
  MirroredFills,
  askFilledMirroredPath,
  askFilledQuarantinePath,
} from "./lok-ask-filled-quarantine";
import { LokWorld } from "./lok-world";
import {
  deployAhEscrowFixture,
  startThrowawayAnvil,
  supportAnvilAvailable,
  type ThrowawayAnvil,
} from "./support-anvil";

const ENV_RPC = process.env.LOK_SUPPORT_RPC ?? "";
const ENV_ESCROW = (process.env.LOK_SUPPORT_ESCROW ?? "") as Hex;
const K0 = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex;
const K4 = "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a" as Hex;
const ABI = [
  {
    type: "function",
    name: "openAsk",
    stateMutability: "nonpayable",
    inputs: [
      { name: "listingId", type: "uint256" },
      { name: "sellerTokenId", type: "uint256" },
      { name: "itemId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "priceWei", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "characterNft",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "setOwner",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "owner_", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "cancelAsk",
    stateMutability: "nonpayable",
    inputs: [{ name: "a", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "buyAsk",
    stateMutability: "payable",
    inputs: [
      { name: "a", type: "uint256" },
      { name: "b", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

const canRun = !!(ENV_RPC && ENV_ESCROW) || supportAnvilAvailable;

describe("support 9692ea2: AskFilled while the server was down", { skip: !canRun }, () => {
  let owned: ThrowawayAnvil | undefined;
  let RPC = ENV_RPC;
  let ESCROW = ENV_ESCROW;

  before(async () => {
    if (RPC && ESCROW) return;
    owned = await startThrowawayAnvil();
    RPC = owned.rpc;
    ESCROW = deployAhEscrowFixture(RPC) as Hex;
  });

  after(() => {
    owned?.stop();
  });

  it("a fill made while down goes to the buyer and is never returned to the seller; a cancel made while down returns to the seller", async () => {
    const chain = {
      id: 31337,
      name: "anvil",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [RPC] } },
    };
    async function rpc(method: string, params: unknown[]): Promise<unknown> {
      const res = await fetch(RPC, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const body = (await res.json()) as { result?: unknown; error?: { message?: string } };
      if (body.error) throw new Error(body.error.message);
      return body.result;
    }

    const dir = mkdtempSync(join(tmpdir(), "lok-h2-e2e-"));
    const lok = LokWorld.open(dir, undefined, {});
    const s = lok.spawn("seller", "Seller", 1);
    const b = lok.spawn("buyer", "Buyer", 2);
    assert.ok(s.ok && b.ok);
    const seller = (s as { tokenId: string }).tokenId;
    const buyer = (b as { tokenId: string }).tokenId;
    lok.noteCustodyInbound({ kind: "importItem", tokenId: seller, nonce: "1", itemId: "111", amount: "2" });
    assert.equal(lok.importItem(seller, "111", "2", "1").ok, true);
    const askA = lok.ask(seller, "111", "1", "1000000000000000", 1_700_000_000);
    const askB = lok.ask(seller, "111", "1", "1000000000000000", 1_700_000_000);
    assert.ok(askA.ok && askB.ok);
    const idA = BigInt(askA.listingId!);
    const idB = BigInt(askB.listingId!);
    const pub = createPublicClient({ chain, transport: http(RPC) });
    const lister = createWalletClient({ account: privateKeyToAccount(K0), chain, transport: http(RPC) });
    const buyerW = createWalletClient({ account: privateKeyToAccount(K4), chain, transport: http(RPC) });
    const nft = (await pub.readContract({
      address: ESCROW,
      abi: ABI,
      functionName: "characterNft",
    })) as Hex;
    await pub.waitForTransactionReceipt({
      hash: await lister.writeContract({
        address: nft,
        abi: ABI,
        functionName: "setOwner",
        args: [BigInt(seller), "0x00000000000000000000000000000000000000aa"],
      }),
    });
    const startBlock = BigInt(String(await rpc("eth_blockNumber", [])));
    for (const id of [idA, idB]) {
      const h = await lister.writeContract({
        address: ESCROW,
        abi: ABI,
        functionName: "openAsk",
        args: [id, BigInt(seller), 111n, 1n, 1_000_000_000_000_000n],
      });
      await pub.waitForTransactionReceipt({ hash: h });
    }
    const hb = await buyerW.writeContract({
      address: ESCROW,
      abi: ABI,
      functionName: "buyAsk",
      args: [idA, BigInt(buyer)],
      value: 1_000_000_000_000_000n,
    });
    await pub.waitForTransactionReceipt({ hash: hb });
    const hc = await lister.writeContract({ address: ESCROW, abi: ABI, functionName: "cancelAsk", args: [idB] });
    await pub.waitForTransactionReceipt({ hash: hc });
    await rpc("anvil_mine", ["0x3"]);

    const env = { LOK_AH_ESCROW: ESCROW, LOK_CHAIN_RPC: RPC, LOK_CHAIN_ID: "31337" } as NodeJS.ProcessEnv;
    const quarantine = new AskFilledQuarantine(askFilledQuarantinePath(dir));
    const rec = await reconcileOpenAsksFromChain(lok, { env, dataDir: dir, quarantine });
    const mirrored = new MirroredFills(askFilledMirroredPath(dir));
    await scanAskFilled({
      cursor: startBlock,
      escrow: ESCROW,
      quarantine,
      rpcCall: rpc,
      apply: (f, k, l) => applyAskFilled(lok, f, k, { mirrored, log: l }),
    });
    assert.deepEqual(rec.cancelled, [String(idB)], "only the cancelled ask goes back to the seller");
    assert.deepEqual(rec.waitingFill, [String(idA)], "the filled ask waits for AskFilled");
    assert.equal(quarantine.list().length, 0, "the fill was not quarantined");
    assert.equal(lok.chainFillKeys().size, 1, "the fill was mirrored to the buyer");
    assert.equal(lok.openBookListings().length, 0, "no listing left open");
  });
});
