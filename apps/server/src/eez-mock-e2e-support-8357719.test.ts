/**
 * Support review of 8357719: local EEZ mock sync buy end to end on a throwaway anvil.
 * Needs LOK_SUPPORT_RPC + LOK_SUPPORT_ESCROW (AhEscrow, LISTING_ROLE to anvil key 0)
 * + LOK_SUPPORT_EEZ_MOCK (MockEezSyncBuy pointing at that escrow). Skips otherwise.
 */
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { applyAskFilled, scanAskFilled } from "./ah-escrow";
import { planEezSyncBuy } from "./eez-sync";
import { AskFilledQuarantine, MirroredFills, askFilledMirroredPath, askFilledQuarantinePath } from "./lok-ask-filled-quarantine";
import { LokWorld } from "./lok-world";

const RPC = process.env.LOK_SUPPORT_RPC ?? "";
const ESCROW = (process.env.LOK_SUPPORT_ESCROW ?? "") as Hex;
const MOCK = (process.env.LOK_SUPPORT_EEZ_MOCK ?? "") as Hex;
const K0 = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex;
const K5 = "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba" as Hex;
const chain = { id: 31337, name: "anvil", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } };
const ESC_ABI = [
  { type: "function", name: "openAsk", stateMutability: "nonpayable", inputs: [{ name: "a", type: "uint256" }, { name: "b", type: "uint256" }, { name: "c", type: "address" }, { name: "d", type: "uint256" }, { name: "e", type: "uint256" }, { name: "f", type: "uint256" }], outputs: [] },
] as const;
const MOCK_ABI = [
  { type: "function", name: "syncBuy", stateMutability: "payable", inputs: [{ name: "listingId", type: "uint256" }, { name: "buyerTokenId", type: "uint256" }], outputs: [] },
] as const;
const P = 1_000_000_000_000_000n;

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const body = (await res.json()) as { result?: unknown; error?: { message?: string } };
  if (body.error) throw new Error(body.error.message);
  return body.result;
}

describe("support 8357719: EEZ mock sync buy (throwaway anvil)", { skip: !RPC || !ESCROW || !MOCK }, () => {
  it("one item per paid ask, seller paid in the same tx, failures atomic; excess refund reaches the buyer", async () => {
    const dir = mkdtempSync(join(tmpdir(), "lok-eez-e2e-"));
    const lok = LokWorld.open(dir, undefined, {});
    const s = lok.spawn("seller", "Seller", 1) as { ok: boolean; tokenId: string };
    const b = lok.spawn("buyer", "Buyer", 2) as { ok: boolean; tokenId: string };
    lok.noteCustodyInbound({ kind: "importItem", tokenId: s.tokenId, nonce: "1", itemId: "111", amount: "3" });
    assert.equal(lok.importItem(s.tokenId, "111", "3", "1").ok, true);
    const ids = [0, 1, 2].map(() => BigInt(lok.ask(s.tokenId, "111", "1", P.toString(), 1_700_000_000).listingId!));
    const env = { LOK_EEZ_SYNC_BUY: "1", LOK_EEZ_ZONE_ID: "local-31337", LOK_EEZ_MOCK_SYNC_BUY: MOCK, LOK_AH_ESCROW: ESCROW, LOK_CHAIN_RPC: RPC } as NodeJS.ProcessEnv;
    const plan = planEezSyncBuy({ listingId: String(ids[0]), priceWei: P.toString(), buyerTokenId: b.tokenId, homeChainId: 31337 }, env);
    assert.equal(plan.ok, true, JSON.stringify(plan));

    const pub = createPublicClient({ chain, transport: http(RPC) });
    const lister = createWalletClient({ account: privateKeyToAccount(K0), chain, transport: http(RPC) });
    const buyer = privateKeyToAccount(K5);
    const bw = createWalletClient({ account: buyer, chain, transport: http(RPC) });
    const payout = ("0x" + (Date.now().toString(16) + "0".repeat(40)).slice(0, 40)) as Hex;
    const start = BigInt(String(await rpc("eth_blockNumber", [])));
    for (const id of ids) {
      await pub.waitForTransactionReceipt({ hash: await lister.writeContract({ address: ESCROW, abi: ESC_ABI, functionName: "openAsk", args: [id, BigInt(s.tokenId), payout, 111n, 1n, P] }) });
    }
    const bal = async () => ({ buyer: await pub.getBalance({ address: buyer.address }), seller: await pub.getBalance({ address: payout }), mock: await pub.getBalance({ address: MOCK }) });
    const spend = async (id: bigint, value: bigint) => {
      const before = await bal();
      let status = "reverted", gas = 0n;
      try {
        const hash = await bw.writeContract({ address: MOCK, abi: MOCK_ABI, functionName: "syncBuy", args: [id, BigInt(b.tokenId)], value, gas: 300_000n });
        const rc = await pub.waitForTransactionReceipt({ hash });
        status = rc.status; gas = rc.gasUsed * rc.effectiveGasPrice;
      } catch { /* reverted in estimate/send */ }
      const after = await bal();
      return { status, buyerNet: before.buyer - after.buyer - gas, seller: after.seller - before.seller, mock: after.mock - before.mock };
    };
    const exact = await spend(ids[0], P);
    const again = await spend(ids[0], P);
    const short = await spend(ids[2], P - 1n);
    const excess = await spend(ids[1], P + P / 2n);
    await rpc("anvil_mine", ["0x3"]);
    const quarantine = new AskFilledQuarantine(askFilledQuarantinePath(dir));
    const mirrored = new MirroredFills(askFilledMirroredPath(dir));
    await scanAskFilled({ cursor: start, escrow: ESCROW, quarantine, rpcCall: rpc, apply: (f, k, l) => applyAskFilled(lok, f, k, { mirrored, log: l }) });
    const inbox = (lok.view(b.tokenId) as { inbox: { tokenId: number; amount: string }[] }).inbox;
    console.log(JSON.stringify({ exact, again, short, excess, inbox, quarantined: quarantine.list().length, open: lok.openBookListings().map((r) => r.id) }, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
    assert.equal(exact.status, "success"); assert.equal(exact.seller, P); assert.equal(exact.buyerNet, P);
    assert.equal(again.status, "reverted"); assert.equal(again.seller, 0n); assert.equal(again.buyerNet, 0n);
    assert.equal(short.status, "reverted"); assert.equal(short.seller, 0n); assert.equal(short.buyerNet, 0n);
    assert.equal(inbox.reduce((n, r) => n + Number(r.amount), 0), 2, "exactly one item per paid ask");
    assert.equal(quarantine.list().length, 0);
    assert.deepEqual(lok.openBookListings().map((r) => r.id), [String(ids[2])]);
    assert.equal(excess.status, "success"); assert.equal(excess.seller, P);
    assert.equal(excess.buyerNet, P, "SUPPORT-FAIL: excess " + excess.mock + " wei stays on MockEezSyncBuy (no refund, no sweep)");
  });
});
