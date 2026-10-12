/**
 * F1: player-paid mint must bind to the intended log token (createCharacterFor).
 * Spins a throwaway anvil + MintFixture; does not touch the shared :8545 anvil.
 */
import assert from "node:assert/strict";
import { spawn, type ChildProcess, execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { linkCharacterNft } from "./lok-vault";
import { forgeLibsPresent, resolveAnvilBin, resolveForgeBin } from "./support-anvil";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const LOK = join(ROOT, "contracts", "lok-log");

const ANVIL_BIN = resolveAnvilBin();
const FORGE_BIN = resolveForgeBin();
/** Skip cleanly when foundry libs are not checked out (no hard fail). */
const SKIP_MINT_ANVIL = !ANVIL_BIN || !FORGE_BIN || !forgeLibsPresent(LOK);
// anvil default keys 0 (deployer), 2 (A), 3 (B)
const DEPLOYER = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex;
const A_KEY = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" as Hex;
const B_KEY = "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6" as Hex;

const CREATE_FOR = [
  {
    type: "function",
    name: "createCharacterFor",
    stateMutability: "payable",
    inputs: [
      { name: "startingJob", type: "uint8" },
      { name: "expectedTokenId", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;
const CREATE = [
  {
    type: "function",
    name: "createCharacter",
    stateMutability: "payable",
    inputs: [{ name: "startingJob", type: "uint8" }],
    outputs: [{ type: "uint256" }],
  },
] as const;
const FEE = [
  { type: "function", name: "mintFee", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;
const OWNER = [
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
] as const;

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const addr = s.address();
      if (!addr || typeof addr === "string") {
        s.close();
        reject(new Error("no port"));
        return;
      }
      const port = addr.port;
      s.close(() => resolve(port));
    });
  });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitRpc(rpc: string, tries = 40): Promise<void> {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
      });
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await sleep(250);
  }
  throw new Error("anvil did not start");
}

describe("support 7cf9ee2: player-paid character mint (throwaway anvil)", {
  skip: SKIP_MINT_ANVIL,
}, () => {
  let anvil: ChildProcess | undefined;
  let rpc = "";
  let factory = "";
  let nft = "";

  before(async () => {
    const port = await freePort();
    rpc = "http://127.0.0.1:" + port;
    anvil = spawn(ANVIL_BIN!, ["--port", String(port), "--chain-id", "31337"], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    await waitRpc(rpc);

    const out = execFileSync(
      FORGE_BIN!,
      [
        "script",
        "script/MintFixture.s.sol:MintFixture",
        "--rpc-url",
        rpc,
        "--private-key",
        DEPLOYER,
        "--broadcast",
        "-vv",
      ],
      { cwd: LOK, encoding: "utf8", env: { ...process.env, FOUNDRY_DISABLE_NIGHTLY_WARNING: "1" } },
    );
    const nftMatch = /NFT\s+(0x[a-fA-F0-9]{40})/.exec(out);
    const factoryMatch = /FACTORY\s+(0x[a-fA-F0-9]{40})/.exec(out);
    assert.ok(nftMatch && factoryMatch, "MintFixture must print NFT and FACTORY\n" + out.slice(-800));
    nft = nftMatch[1]!;
    factory = factoryMatch[1]!;
  });

  after(() => {
    anvil?.kill("SIGTERM");
  });

  it("createCharacterFor binds payment to the expected token; wrong id reverts", async () => {
    const chain = {
      id: 31337,
      name: "anvil",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [rpc] } },
    };
    const pub = createPublicClient({ chain, transport: http(rpc) });
    const a = privateKeyToAccount(A_KEY);
    const b = privateKeyToAccount(B_KEY);
    const fee = await pub.readContract({
      address: factory as Hex,
      abi: FEE,
      functionName: "mintFee",
    });
    const wa = createWalletClient({ account: a, chain, transport: http(rpc) });
    const wb = createWalletClient({ account: b, chain, transport: http(rpc) });

    // A mints token 1 for themselves.
    const h1 = await wa.writeContract({
      address: factory as Hex,
      abi: CREATE_FOR,
      functionName: "createCharacterFor",
      args: [0, 1n],
      value: fee,
    });
    await pub.waitForTransactionReceipt({ hash: h1 });

    // B cannot claim token 1 (already minted) or skip to token 3.
    await assert.rejects(
      wb.writeContract({
        address: factory as Hex,
        abi: CREATE_FOR,
        functionName: "createCharacterFor",
        args: [0, 3n],
        value: fee,
      }),
    );

    // B mints exactly token 2.
    const h2 = await wb.writeContract({
      address: factory as Hex,
      abi: CREATE_FOR,
      functionName: "createCharacterFor",
      args: [0, 2n],
      value: fee,
    });
    await pub.waitForTransactionReceipt({ hash: h2 });

    const owner1 = (
      await pub.readContract({ address: nft as Hex, abi: OWNER, functionName: "ownerOf", args: [1n] })
    ).toLowerCase();
    const owner2 = (
      await pub.readContract({ address: nft as Hex, abi: OWNER, functionName: "ownerOf", args: [2n] })
    ).toLowerCase();
    assert.equal(owner1, a.address.toLowerCase());
    assert.equal(owner2, b.address.toLowerCase());

    const env = {
      LOK_CHAIN_RPC: rpc,
      LOK_FACTORY: factory,
      LOK_NFT: nft,
    } as NodeJS.ProcessEnv;
    const linkA = await linkCharacterNft("1", 0, a.address, env);
    const linkB = await linkCharacterNft("2", 0, b.address, env);
    assert.equal(linkA.ok, true);
    assert.equal(linkB.ok, true);
  });

  it("legacy createCharacter is disabled (L-6)", async () => {
    const chain = {
      id: 31337,
      name: "anvil",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [rpc] } },
    };
    const pub = createPublicClient({ chain, transport: http(rpc) });
    const a = privateKeyToAccount(A_KEY);
    const fee = await pub.readContract({
      address: factory as Hex,
      abi: FEE,
      functionName: "mintFee",
    });
    const wa = createWalletClient({ account: a, chain, transport: http(rpc) });
    await assert.rejects(
      () =>
        wa.writeContract({
          address: factory as Hex,
          abi: CREATE,
          functionName: "createCharacter",
          args: [0],
          value: fee,
        }),
      /CreateCharacterDisabled|0x7462bebc|reverted/i,
    );
  });
});
