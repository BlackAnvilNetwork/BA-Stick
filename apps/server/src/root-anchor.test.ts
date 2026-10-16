/**
 * A certified root is anchored only after a successful post.
 * A status line that names a height does not invent one.
 * Chain-bound sends stay in process until that root is posted.
 * The tick helper still returns without waiting.
 */
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import { createPublicClient, http, toHex, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { openAskOnchain } from "./ah-escrow-tx";
import { LokWorld } from "./lok-world";
import { serverMintCharacterFor } from "./lok-vault";
import { buildOpsStatus } from "./ops-health";
import { emptyReplicaHealth, observeOrdererLine, submitOnSimTick } from "./order-submit";
import { chainPvpCancel, chainPvpClaim } from "./pvp-bounty-tx";
import { provisionalChainLink } from "./seal-tick-batch";
import {
  ANCHOR_WAIT,
  anchoredHeight,
  beginChainWithdrawal,
  chainBoundSendGate,
  inGameWaitsForAnchor,
  noteCertifiedBatch,
  postCertifiedBatch,
  resetRootAnchorForTests,
  type CertifiedBatch,
} from "./root-anchor";
import {
  runForgeScriptBroadcast,
  startThrowawayAnvil,
  supportAnvilAvailable,
  type ThrowawayAnvil,
} from "./support-anvil";

const root = new Uint8Array(32);
root[0] = 0xab;
const certificate = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
const batch: CertifiedBatch = { height: 4, nextRoot: root, certificate };

function statusHeight(): number | null {
  const dir = mkdtempSync(join(tmpdir(), "lok-anchor-"));
  return buildOpsStatus({
    lokReady: () => true,
    startedAtMs: Date.now(),
    dataDir: dir,
    env: { NETWORK: "anvil", LOK_CHAIN_ID: "31337" },
  }).lastAnchoredHeight;
}

describe("root anchor", { concurrency: false }, () => {
test("nothing is anchored until a post succeeds", async () => {
  resetRootAnchorForTests();
  try {
    assert.equal(anchoredHeight(), null);
    assert.equal(statusHeight(), null);
    assert.equal(chainBoundSendGate().ok, false);

    noteCertifiedBatch(batch);
    assert.equal(anchoredHeight(), null);
    assert.equal(statusHeight(), null);
    const failed = await postCertifiedBatch(batch, {
      env: { LOK_CHAIN_ID: "31337" },
      poster: async () => false,
    });
    assert.equal(failed, false);
    assert.equal(anchoredHeight(), null);
    assert.equal(chainBoundSendGate().ok, false);
  } finally {
    resetRootAnchorForTests();
  }
});

test("a status line that claims an anchor does not post one", () => {
  resetRootAnchorForTests();
  try {
    const line = JSON.stringify({
      lastCertifiedHeight: 3,
      lastAnchoredHeight: 9,
      root: "ab".repeat(32),
      commitCertificate: "abcd",
      clockSkew: 0,
      peers: [],
    });
    const health = observeOrdererLine(line, emptyReplicaHealth(), {});
    assert.equal(health.lastAnchoredHeight, null);
    assert.equal(health.lastCertifiedHeight, 3);
    assert.equal(anchoredHeight(), null);
    assert.equal(statusHeight(), null);
    assert.equal(chainBoundSendGate().ok, false);
  } finally {
    resetRootAnchorForTests();
  }
});

test("a successful post sets /status lastAnchoredHeight", async () => {
  resetRootAnchorForTests();
  try {
    noteCertifiedBatch(batch);
    let posted = 0;
    const ok = await postCertifiedBatch(batch, {
      env: { LOK_CHAIN_ID: "31337" },
      poster: async (seen) => {
        posted += 1;
        assert.equal(seen.height, 4);
        assert.equal(seen.nextRoot[0], 0xab);
        assert.equal(seen.certificate.length, 4);
        return true;
      },
    });
    assert.equal(ok, true);
    assert.equal(posted, 1);
    assert.equal(anchoredHeight(), 4);
    assert.equal(statusHeight(), 4);
    assert.equal(chainBoundSendGate().ok, true);

    const next = new Uint8Array(32);
    next[0] = 0xcd;
    noteCertifiedBatch({ height: 5, nextRoot: next, certificate });
    assert.equal(chainBoundSendGate().ok, false);
    assert.equal(anchoredHeight(), 4);
  } finally {
    resetRootAnchorForTests();
  }
});

test("Gnosis and Chiado chain ids do not post", async () => {
  resetRootAnchorForTests();
  try {
    for (const chainId of ["100", "10200"]) {
      let calls = 0;
      const ok = await postCertifiedBatch(batch, {
        env: {
          LOK_CHAIN_ID: chainId,
          LOK_ROOT_ANCHOR: "0x" + "11".repeat(20),
          LOK_CHAIN_RPC: "http://127.0.0.1:9",
        },
        poster: async () => {
          calls += 1;
          return true;
        },
      });
      assert.equal(ok, false);
      assert.equal(calls, 0);
    }
    assert.equal(anchoredHeight(), null);
  } finally {
    resetRootAnchorForTests();
  }
});

test("chain-bound sends do not go out before the root is anchored", async () => {
  resetRootAnchorForTests();
  try {
    const mint = await serverMintCharacterFor("1", 1, "0x" + "ab".repeat(20), {
      LOK_DEV_SERVER_MINT: "1",
      LOK_CHAIN_RPC: "http://127.0.0.1:1",
      LOK_FACTORY: "0x" + "11".repeat(20),
      LOK_NFT: "0x" + "22".repeat(20),
      LOK_OWNER_KEY: "0x" + "33".repeat(32),
    });
    assert.equal(mint.ok, false);
    if (!mint.ok) assert.equal(mint.error, ANCHOR_WAIT);

    const ask = await openAskOnchain({
      listingId: "1",
      sellerTokenId: "1",
      itemId: "1",
      amount: "1",
      priceWei: "1",
      env: { LOK_CHAIN_RPC: "http://127.0.0.1:1", LOK_LISTING_KEY: "0x" + "44".repeat(32) },
    });
    assert.equal(ask.ok, false);
    if (!ask.ok) assert.equal(ask.error, ANCHOR_WAIT);

    const cancel = await chainPvpCancel("1", {
      LOK_CHAIN_RPC: "http://127.0.0.1:1",
      LOK_PVP_BOUNTY: "0x" + "55".repeat(20),
      LOK_LISTING_KEY: "0x" + "44".repeat(32),
    });
    assert.equal(cancel.ok, false);
    if (!cancel.ok) assert.equal(cancel.error, ANCHOR_WAIT);

    assert.equal(chainBoundSendGate().ok, false);
    const withdrawal = beginChainWithdrawal();
    assert.equal(withdrawal.ok, false);
    if (!withdrawal.ok) assert.equal(withdrawal.error, ANCHOR_WAIT);
    assert.equal(inGameWaitsForAnchor("play"), false);
    assert.equal(inGameWaitsForAnchor("movement"), false);
    assert.equal(inGameWaitsForAnchor("combat"), false);

    const claim = await chainPvpClaim("1", "2", "0x" + "ab".repeat(20), {
      LOK_CHAIN_RPC: "http://127.0.0.1:1",
      LOK_PVP_BOUNTY: "0x" + "55".repeat(20),
      LOK_LISTING_KEY: "0x" + "44".repeat(32),
    });
    assert.equal(claim.ok, false);
    if (!claim.ok) assert.equal(claim.error, ANCHOR_WAIT);
  } finally {
    resetRootAnchorForTests();
  }
});

test("owner, private, and listing keys do not post", async () => {
  resetRootAnchorForTests();
  try {
    const shared = "0x" + "11".repeat(32);
    const poster = "0x" + "22".repeat(32);
    const base = {
      LOK_CHAIN_ID: "31337",
      LOK_CHAIN_RPC: "http://127.0.0.1:9",
      LOK_ROOT_ANCHOR: "0x" + "33".repeat(20),
      LOK_ANCHOR_POSTER_KEY: shared,
    };
    for (const extra of [
      { LOK_OWNER_KEY: shared },
      { PRIVATE_KEY: shared },
      { LOK_LISTING_KEY: shared },
    ]) {
      const ok = await postCertifiedBatch(batch, { env: { ...base, ...extra } });
      assert.equal(ok, false);
    }
    const remote = await postCertifiedBatch(batch, {
      env: {
        LOK_CHAIN_ID: "31337",
        LOK_CHAIN_RPC: "http://example.com:8545",
        LOK_ROOT_ANCHOR: "0x" + "33".repeat(20),
        LOK_ANCHOR_POSTER_KEY: poster,
        LOK_OWNER_KEY: shared,
        PRIVATE_KEY: "0x" + "44".repeat(32),
        LOK_LISTING_KEY: "0x" + "55".repeat(32),
      },
    });
    assert.equal(remote, false);
    assert.equal(anchoredHeight(), null);
    assert.equal(statusHeight(), null);
  } finally {
    resetRootAnchorForTests();
  }
});

test("the sim tick does not wait for an anchor", () => {
  resetRootAnchorForTests();
  try {
    const nextRoot = new Uint8Array(32);
    nextRoot[0] = 0x11;
    const tick = submitOnSimTick(null, { ok: true, height: 1, nextRoot });
    assert.equal(tick.tickFailed, false);
    assert.equal(tick.status, "provisional");
    assert.equal(anchoredHeight(), null);
  } finally {
    resetRootAnchorForTests();
  }
});

/** Anvil account 1. Not the owner key, the private key, or the listing key. */
const ANCHOR_POSTER_KEY =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex;

function tickIndexInputs(index: number): Uint8Array {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigUint64(0, BigInt(index), false);
  return out;
}

test(
  "anvil stores the certified character root and /status reports that height",
  { skip: !supportAnvilAvailable, timeout: 180_000 },
  async () => {
    resetRootAnchorForTests();
    let anvil: ThrowawayAnvil | undefined;
    try {
      anvil = await startThrowawayAnvil();
      const poster = privateKeyToAccount(ANCHOR_POSTER_KEY);
      const out = runForgeScriptBroadcast(
        [
          "script",
          "script/RootAnchorFixture.s.sol:RootAnchorFixture",
          "--rpc-url",
          anvil.rpc,
          "--private-key",
          ANCHOR_POSTER_KEY,
          "-vv",
        ],
        {
          env: {
            LOK_OWNER_KEY: "",
            PRIVATE_KEY: "",
            LOK_LISTING_KEY: "",
          },
        },
      );
      const deployed = /ANCHOR\s+(0x[a-fA-F0-9]{40})/.exec(out);
      assert.ok(deployed, out.slice(-800));
      const address = deployed[1] as Hex;

      const dir = mkdtempSync(join(tmpdir(), "lok-anchor-world-"));
      const lok = LokWorld.open(dir, undefined, {});
      const spawned = lok.spawn("char-a", "Ada", 0);
      assert.equal(spawned.ok, true);
      const characterRoot = lok.characterRootTreeRoot();
      const provisional = provisionalChainLink(new Uint8Array(32), tickIndexInputs(2));
      assert.equal(characterRoot.length, 32);
      assert.notDeepEqual(characterRoot, new Uint8Array(32));
      assert.notDeepEqual(characterRoot, provisional);

      const certified: CertifiedBatch = {
        height: 4,
        nextRoot: characterRoot,
        certificate,
      };
      noteCertifiedBatch(certified);
      assert.equal(anchoredHeight(), null);
      assert.equal(statusHeight(), null);
      assert.equal(chainBoundSendGate().ok, false);
      assert.equal(inGameWaitsForAnchor("movement"), false);
      const tick = submitOnSimTick(null, { ok: true, height: 4, nextRoot: characterRoot });
      assert.equal(tick.tickFailed, false);
      assert.equal(anchoredHeight(), null);

      const chain = {
        id: 31337,
        name: "anvil",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: { default: { http: [anvil.rpc] } },
      };
      const pub = createPublicClient({ chain, transport: http(anvil.rpc) });
      const nonceBefore = await pub.getTransactionCount({ address: poster.address });
      const forbidden = await postCertifiedBatch(certified, {
        env: {
          LOK_CHAIN_ID: "31337",
          LOK_CHAIN_RPC: anvil.rpc,
          LOK_ROOT_ANCHOR: address,
          LOK_ANCHOR_POSTER_KEY: "0x" + "11".repeat(32),
          LOK_OWNER_KEY: "0x" + "11".repeat(32),
          PRIVATE_KEY: "0x" + "22".repeat(32),
          LOK_LISTING_KEY: "0x" + "33".repeat(32),
        },
      });
      assert.equal(forbidden, false);
      assert.equal(anchoredHeight(), null);
      assert.equal(await pub.getTransactionCount({ address: poster.address }), nonceBefore);

      const posted = await postCertifiedBatch(certified, {
        env: {
          LOK_CHAIN_ID: "31337",
          LOK_CHAIN_RPC: anvil.rpc,
          LOK_ROOT_ANCHOR: address,
          LOK_ANCHOR_POSTER_KEY: ANCHOR_POSTER_KEY,
          LOK_OWNER_KEY: "0x" + "11".repeat(32),
          PRIVATE_KEY: "0x" + "22".repeat(32),
          LOK_LISTING_KEY: "0x" + "33".repeat(32),
        },
      });
      assert.equal(posted, true);
      assert.equal(anchoredHeight(), 4);
      assert.equal(statusHeight(), 4);
      assert.equal(chainBoundSendGate().ok, true);
      const withdrawal = beginChainWithdrawal();
      assert.equal(withdrawal.ok, true);
      if (withdrawal.ok) assert.equal(withdrawal.submitted, false);
      assert.equal(await pub.getTransactionCount({ address: poster.address }), nonceBefore + 1);

      const abi = [
        {
          type: "function",
          name: "isAnchored",
          stateMutability: "view",
          inputs: [
            { name: "height", type: "uint64" },
            { name: "nextRoot", type: "bytes32" },
          ],
          outputs: [{ type: "bool" }],
        },
      ] as const;
      assert.equal(
        await pub.readContract({
          address,
          abi,
          functionName: "isAnchored",
          args: [4n, toHex(characterRoot)],
        }),
        true,
      );
      assert.equal(
        await pub.readContract({
          address,
          abi,
          functionName: "isAnchored",
          args: [4n, toHex(provisional)],
        }),
        false,
      );

      const ask = await openAskOnchain({
        listingId: "1",
        sellerTokenId: "1",
        itemId: "1",
        amount: "1",
        priceWei: "1",
        env: { LOK_CHAIN_RPC: anvil.rpc },
      });
      assert.equal(ask.ok, false);
      if (!ask.ok) assert.notEqual(ask.error, ANCHOR_WAIT);
      assert.equal(await pub.getTransactionCount({ address: poster.address }), nonceBefore + 1);
    } finally {
      anvil?.stop();
      resetRootAnchorForTests();
    }
  },
);
});
