/**
 * Support review of 9692ea2: H2 end to end on a real (throwaway) anvil.
 * A fill and a cancel happen while the server is "down"; then boot runs the
 * reconcile and the AskFilled scan in the same order as index.ts.
 * Needs LOK_SUPPORT_RPC (anvil, default keys) and LOK_SUPPORT_ESCROW (AhEscrow with
 * LISTING_ROLE granted to anvil key 0). Skips otherwise.
 */
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { applyAskFilled, scanAskFilled } from "./ah-escrow";
import { reconcileOpenAsksFromChain } from "./ah-escrow-reconcile";
import { AskFilledQuarantine, MirroredFills, askFilledMirroredPath, askFilledQuarantinePath } from "./lok-ask-filled-quarantine";
import { LokWorld } from "./lok-world";

const RPC = process.env.LOK_SUPPORT_RPC ?? "";
const ESCROW = (process.env.LOK_SUPPORT_ESCROW ?? "") as Hex;
const K0 = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex;
const K4 = "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a" as Hex;
const chain = { id: 31337, name: "anvil", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } };
const ABI = [
  { type: "function", name: "openAsk", stateMutability: "nonpayable", inputs: [{ name: "a", type: "uint256" }, { name: "b", type: "uint256" }, { name: "c", type: "address" }, { name: "d", type: "uint256" }, { name: "e", type: "uint256" }, { name: "f", type: "uint256" }], outputs: [] },
  { type: "function", name: "cancelAsk", stateMutability: "nonpayable", inputs: [{ name: "a", type: "uint256" }], outputs: [] },
  { type: "function", name: "buyAsk", stateMutability: "payable", inputs: [{ name: "a", type: "uint256" }, { name: "b", type: "uint256" }], outputs: [] },
] as const;

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const body = (await res.json()) as { result?: unknown; error?: { message?: string } };
  if (body.error) throw new Error(body.error.message);
  return body.result;
}

const itemCount = (view: unknown, itemId: string) => {
  const s = JSON.stringify(view);
  return (s.match(new RegExp('"(itemId|tokenId|id)":"?' + itemId + '"?', "g")) ?? []).length;
};

describe("support 9692ea2: AskFilled while the server was down", { skip: !RPC || !ESCROW }, () => {
  it("a fill made while down goes to the buyer and is never returned to the seller; a cancel made while down returns to the seller", async () => {
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
    const idA = BigInt(askA.listingId!), idB = BigInt(askB.listingId!);
    // fresh ids on this escrow: offset so repeated runs don't collide with used ids
    const pub = createPublicClient({ chain, transport: http(RPC) });
    const lister = createWalletClient({ account: privateKeyToAccount(K0), chain, transport: http(RPC) });
    const buyerW = createWalletClient({ account: privateKeyToAccount(K4), chain, transport: http(RPC) });
    const startBlock = BigInt(String(await rpc("eth_blockNumber", [])));
    for (const id of [idA, idB]) {
      const h = await lister.writeContract({ address: ESCROW, abi: ABI, functionName: "openAsk", args: [id, BigInt(seller), "0x00000000000000000000000000000000000000aa", 111n, 1n, 1_000_000_000_000_000n] });
      await pub.waitForTransactionReceipt({ hash: h });
    }
    // --- server down ---
    const hb = await buyerW.writeContract({ address: ESCROW, abi: ABI, functionName: "buyAsk", args: [idA, BigInt(buyer)], value: 1_000_000_000_000_000n });
    await pub.waitForTransactionReceipt({ hash: hb });
    const hc = await lister.writeContract({ address: ESCROW, abi: ABI, functionName: "cancelAsk", args: [idB] });
    await pub.waitForTransactionReceipt({ hash: hc });
    await rpc("anvil_mine", ["0x3"]);
    // --- boot: same order as index.ts (reconcile fired, then watcher tick) ---
    // readAskOnchain is read-only (no LOK_LISTING_KEY required).
    const env = { LOK_AH_ESCROW: ESCROW, LOK_CHAIN_RPC: RPC, LOK_CHAIN_ID: "31337" } as NodeJS.ProcessEnv;
    const quarantine = new AskFilledQuarantine(askFilledQuarantinePath(dir));
    const rec = await reconcileOpenAsksFromChain(lok, { env, dataDir: dir, quarantine });
    const mirrored = new MirroredFills(askFilledMirroredPath(dir));
    await scanAskFilled({ cursor: startBlock, escrow: ESCROW, quarantine, rpcCall: rpc, apply: (f, k, l) => applyAskFilled(lok, f, k, { mirrored, log: l }) });
    console.log("reconcile", JSON.stringify(rec), "quarantine", quarantine.list().length, "chainFills", lok.chainFillKeys().size);
    console.log("seller", JSON.stringify(lok.view(seller)).slice(0, 600));
    console.log("buyer", JSON.stringify(lok.view(buyer)).slice(0, 600));
    assert.deepEqual(rec.cancelled, [String(idB)], "only the cancelled ask goes back to the seller");
    assert.deepEqual(rec.waitingFill, [String(idA)], "the filled ask waits for AskFilled");
    assert.equal(quarantine.list().length, 0, "the fill was not quarantined");
    assert.equal(lok.chainFillKeys().size, 1, "the fill was mirrored to the buyer");
    assert.equal(lok.openBookListings().length, 0, "no listing left open");
  });
});
