import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { postReplicaBond, resetBondedAdmissionForTests } from "./bonded-admission";
import { resetGuildSafesForTests } from "./guild-safes";
import { bringBondedMarkOnline } from "./mark-boot";
import { resetRootAnchorForTests } from "./root-anchor";
import { SUPPORT_ANVIL_K0 } from "./support-anvil";

const CONTRACTS = {
  LOK_SAFE_SINGLETON: "0x" + "11".repeat(20),
  LOK_SAFE_PROXY_FACTORY: "0x" + "22".repeat(20),
  LOK_SAFE_FALLBACK_HANDLER: "0x" + "33".repeat(20),
  LOK_SAFE_MULTISEND: "0x" + "44".repeat(20),
  LOK_SAFE_MULTISEND_CALL_ONLY: "0x" + "55".repeat(20),
};

function reset(): void {
  resetGuildSafesForTests();
  resetBondedAdmissionForTests();
  resetRootAnchorForTests();
}

async function stubRpc(): Promise<{ rpc: string; methods: string[]; close: () => Promise<void> }> {
  const methods: string[] = [];
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const parsed = JSON.parse(Buffer.concat(chunks).toString() || "{}") as { method?: string; id?: number };
      methods.push(parsed.method ?? "");
      const result = parsed.method === "eth_chainId" ? "0x1" : "0x";
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ jsonrpc: "2.0", id: parsed.id ?? 1, result }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const bound = server.address();
  if (!bound || typeof bound === "string") throw new Error("stub rpc did not bind");
  return {
    rpc: "http://127.0.0.1:" + bound.port,
    methods,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

test("a replica does not bring a Mark online", async () => {
  reset();
  const rpc = await stubRpc();
  try {
    assert.equal(postReplicaBond("operator-a", "replica", 1n).joined, true);
    const result = await bringBondedMarkOnline({
      LOK_REPLICA: "1",
      LOK_MARK_OPERATOR_ID: "operator-a",
      LOK_MARK_OPERATOR_KEY: SUPPORT_ANVIL_K0,
      LOK_CHAIN_RPC: rpc.rpc,
      ...CONTRACTS,
    });
    assert.deepEqual(result, { ok: true, skipped: true });
    assert.deepEqual(rpc.methods, []);
  } finally {
    await rpc.close();
    reset();
  }
});

test("the listing key is not a Mark and a missing bond does not deploy", async () => {
  reset();
  const rpc = await stubRpc();
  try {
    const listing = await bringBondedMarkOnline({
      LOK_MARK_OPERATOR_ID: "operator-a",
      LOK_MARK_OPERATOR_KEY: SUPPORT_ANVIL_K0,
      LOK_LISTING_KEY: SUPPORT_ANVIL_K0,
      LOK_CHAIN_RPC: rpc.rpc,
      ...CONTRACTS,
    });
    assert.equal(listing.ok, false);
    if (!listing.ok) assert.equal(listing.error, "The listing key is not a Mark");
    assert.equal(postReplicaBond("operator-a", "replica", 1n).joined, true);
    const unbonded = await bringBondedMarkOnline({
      LOK_MARK_OPERATOR_ID: "operator-b",
      LOK_MARK_OPERATOR_KEY: SUPPORT_ANVIL_K0,
      LOK_CHAIN_RPC: rpc.rpc,
      ...CONTRACTS,
    });
    assert.deepEqual(unbonded, { ok: true, skipped: true });
    assert.deepEqual(rpc.methods, []);
  } finally {
    await rpc.close();
    reset();
  }
});

test("a bonded operator calls markComesOnline and this path still refuses a non-anvil chain", async () => {
  reset();
  const rpc = await stubRpc();
  try {
    assert.equal(postReplicaBond("operator-a", "replica", 1n).joined, true);
    const result = await bringBondedMarkOnline({
      LOK_MARK_OPERATOR_ID: "operator-a",
      LOK_MARK_OPERATOR_KEY: SUPPORT_ANVIL_K0,
      LOK_CHAIN_RPC: rpc.rpc,
      ...CONTRACTS,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /refuses chain/);
    assert.equal(rpc.methods.includes("eth_sendTransaction"), false);
    assert.equal(rpc.methods.includes("eth_sendRawTransaction"), false);
    const source = readFileSync(new URL("./mark-boot.ts", import.meta.url), "utf8");
    const body = source.slice(source.indexOf("export async function bringBondedMarkOnline"));
    assert.ok(body.indexOf("replicaFlagEnabled") < body.indexOf("LOK_MARK_OPERATOR_KEY"));
    assert.equal(body.includes("openGuild"), false);
    assert.equal(source.includes("LOK_OWNER_KEY"), false);
    assert.equal(source.includes("PRIVATE_KEY"), false);
    const index = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    const boot = index.slice(index.indexOf("recordPostedSlashableBonds(process.env)"), index.indexOf("LokWorld.open"));
    assert.match(boot, /void bringBondedMarkOnline\(process\.env\)/);
    assert.equal(boot.includes("openGuild"), false);
  } finally {
    await rpc.close();
    reset();
  }
});
