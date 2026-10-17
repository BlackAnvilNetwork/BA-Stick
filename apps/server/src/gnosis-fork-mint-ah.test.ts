/**
 * Gnosis mainnet fork e2e: 1 xDAI character mint + AhEscrow openAsk/buyAsk.
 * Broadcasts only hit local `anvil --fork-url` — never public chain 100.
 *
 * Uses fresh EOAs (not anvil default keys): well-known anvil addresses already
 * have contract code on Gnosis mainnet whose receive() drains native payouts.
 *
 * Skip when foundry missing. Override RPC with GNOSIS_RPC_URL / FORK_URL.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  type Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { explorerTxUrl, settlementCurrency } from "@bellgrave/config";
import {
  deployGnosisForkMintAhFixture,
  gnosisForkAvailable,
  gnosisForkRpcReachable,
  startGnosisForkAnvil,
  type GnosisForkAnvil,
  type GnosisForkMintAh,
} from "./support-anvil";

let forkRpcOk = false;
if (gnosisForkAvailable) {
  forkRpcOk = await gnosisForkRpcReachable();
  if (!forkRpcOk) {
    console.warn(
      "[gnosis-fork-mint-ah] public fork RPC unreachable — skipping suite (not a failure)",
    );
  }
}

const ABI = parseAbi([
  "function mintFee() view returns (uint256)",
  "function createCharacterFor(uint8 startingJob, uint256 expectedTokenId) payable returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function nextTokenId() view returns (uint256)",
  "function openAsk(uint256 listingId, uint256 sellerTokenId, uint256 itemId, uint256 amount, uint256 priceWei)",
  "function buyAsk(uint256 listingId, uint256 buyerTokenId) payable",
  "function asks(uint256 listingId) view returns (uint256 sellerTokenId, uint256 itemId, uint256 amount, uint256 priceWei, bool open, bool used)",
]);

async function rpcCall(rpc: string, method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = (await res.json()) as { result?: unknown; error?: { message?: string } };
  if (body.error) throw new Error(body.error.message ?? method);
  return body.result;
}

async function fundEoa(rpc: string, address: string, wei = 10n ** 22n): Promise<void> {
  await rpcCall(rpc, "anvil_setBalance", [address, "0x" + wei.toString(16)]);
}

describe("gnosis fork: 1 xDAI mint + AH list/buy", {
  skip: !gnosisForkAvailable || !forkRpcOk,
}, () => {
  let fork: GnosisForkAnvil | undefined;
  let deployed: GnosisForkMintAh | undefined;
  let adminPk: Hex;
  let sellerPk: Hex;
  let buyerPk: Hex;
  let chain: {
    id: number;
    name: string;
    nativeCurrency: { name: string; symbol: string; decimals: number };
    rpcUrls: { default: { http: string[] } };
  };

  before(async () => {
    fork = await startGnosisForkAnvil();
    // Fresh keys — anvil defaults collide with live Gnosis contracts.
    adminPk = generatePrivateKey();
    sellerPk = generatePrivateKey();
    buyerPk = generatePrivateKey();
    const admin = privateKeyToAccount(adminPk);
    const seller = privateKeyToAccount(sellerPk);
    const buyer = privateKeyToAccount(buyerPk);
    await fundEoa(fork.rpc, admin.address);
    await fundEoa(fork.rpc, seller.address);
    await fundEoa(fork.rpc, buyer.address);
    deployed = deployGnosisForkMintAhFixture(fork.rpc, adminPk);
    const cur = settlementCurrency(100);
    chain = {
      id: 100,
      name: cur.name,
      nativeCurrency: { name: cur.name, symbol: cur.symbol, decimals: cur.decimals },
      rpcUrls: { default: { http: [fork.rpc] } },
    };
  });

  after(() => {
    fork?.stop();
  });

  it("fork tip reports chain id 100 and xDAI settlement labels", async () => {
    assert.ok(fork && deployed);
    const pub = createPublicClient({ chain, transport: http(fork.rpc) });
    const id = await pub.getChainId();
    assert.equal(id, 100);
    assert.equal(settlementCurrency(100).symbol, "xDAI");
    assert.equal(settlementCurrency(100).exampleAskHuman, "1");
    const fee = await pub.readContract({
      address: deployed.factory as Hex,
      abi: ABI,
      functionName: "mintFee",
    });
    assert.equal(fee, 10n ** 18n, "factory mint fee is 1 xDAI");
    assert.equal(deployed.mintFeeWei, 10n ** 18n);
  });

  it("mints two characters at 1 xDAI, lists, and buys on AhEscrow", async () => {
    assert.ok(fork && deployed);
    const admin = privateKeyToAccount(adminPk);
    const seller = privateKeyToAccount(sellerPk);
    const buyer = privateKeyToAccount(buyerPk);
    const pub = createPublicClient({ chain, transport: http(fork.rpc) });
    const sellerW = createWalletClient({ account: seller, chain, transport: http(fork.rpc) });
    const buyerW = createWalletClient({ account: buyer, chain, transport: http(fork.rpc) });
    const lister = createWalletClient({ account: admin, chain, transport: http(fork.rpc) });

    const fee = deployed.mintFeeWei;
    const nextBefore = await pub.readContract({
      address: deployed.nft as Hex,
      abi: ABI,
      functionName: "nextTokenId",
    });

    const sellerExpected = nextBefore + 1n;
    const mintSeller = await sellerW.writeContract({
      address: deployed.factory as Hex,
      abi: ABI,
      functionName: "createCharacterFor",
      args: [0, sellerExpected],
      value: fee,
    });
    await pub.waitForTransactionReceipt({ hash: mintSeller });
    const sellerToken = sellerExpected.toString();
    assert.equal(
      (
        await pub.readContract({
          address: deployed.nft as Hex,
          abi: ABI,
          functionName: "ownerOf",
          args: [BigInt(sellerToken)],
        })
      ).toLowerCase(),
      seller.address.toLowerCase(),
    );
    const explorerMint = explorerTxUrl(100, mintSeller);
    assert.match(explorerMint, /^https:\/\/gnosisscan\.io\/tx\/0x/);

    const buyerExpected = nextBefore + 2n;
    const mintBuyer = await buyerW.writeContract({
      address: deployed.factory as Hex,
      abi: ABI,
      functionName: "createCharacterFor",
      args: [1, buyerExpected],
      value: fee,
    });
    await pub.waitForTransactionReceipt({ hash: mintBuyer });
    const buyerToken = buyerExpected.toString();
    assert.equal(
      (
        await pub.readContract({
          address: deployed.nft as Hex,
          abi: ABI,
          functionName: "ownerOf",
          args: [BigInt(buyerToken)],
        })
      ).toLowerCase(),
      buyer.address.toLowerCase(),
    );

    const listingId = 900001n;
    const priceWei = 10n ** 18n; // 1 xDAI ask
    const openHash = await lister.writeContract({
      address: deployed.escrow as Hex,
      abi: ABI,
      functionName: "openAsk",
      args: [listingId, BigInt(sellerToken), 111n, 1n, priceWei],
    });
    await pub.waitForTransactionReceipt({ hash: openHash });

    const ask = await pub.readContract({
      address: deployed.escrow as Hex,
      abi: ABI,
      functionName: "asks",
      args: [listingId],
    });
    assert.equal(ask[4], true, "ask open");
    assert.equal(ask[3], priceWei);

    const sellerBalBefore = await pub.getBalance({ address: seller.address });
    const buyHash = await buyerW.writeContract({
      address: deployed.escrow as Hex,
      abi: ABI,
      functionName: "buyAsk",
      args: [listingId, BigInt(buyerToken)],
      value: priceWei,
    });
    await pub.waitForTransactionReceipt({ hash: buyHash });

    const askAfter = await pub.readContract({
      address: deployed.escrow as Hex,
      abi: ABI,
      functionName: "asks",
      args: [listingId],
    });
    assert.equal(askAfter[4], false, "ask closed after buy");
    assert.equal(askAfter[5], true, "ask used");

    const sellerBalAfter = await pub.getBalance({ address: seller.address });
    // 5% fee → seller receives 0.95 xDAI
    const expectedNet = priceWei - (priceWei * 500n) / 10_000n;
    assert.equal(sellerBalAfter - sellerBalBefore, expectedNet);

    assert.match(explorerTxUrl(100, buyHash), /^https:\/\/gnosisscan\.io\/tx\/0x/);
  });
});
