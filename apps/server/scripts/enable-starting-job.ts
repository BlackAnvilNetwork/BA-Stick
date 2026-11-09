/**
 * Enable a starting job on the live Gnosis CharacterFactory via the Admin Safe.
 *
 * Reads the ignition worktree env (admin owner keys never printed).
 * Threshold-2 Safe: both owners sign; whoever has gas sends execTransaction.
 *
 *   CONFIRM_BROADCAST=1 pnpm --filter @bellgrave/server exec tsx scripts/enable-starting-job.ts
 *
 * Optional: JOB=7 FACTORY=0x… ADMIN=0x… GNOSIS_ENV=path RPC_URL=…
 */
import { existsSync, readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, encodeFunctionData, getAddress, http, isAddress, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { gnosis } from "viem/chains";
import { ethSignSafeSignature } from "../src/listing-safe-exec";

const DEFAULT_ENV = "C:\\Users\\raxac\\wt\\ban-ignition\\contracts\\lok-log\\.env.gnosis";
const DEFAULT_FACTORY = "0x4083Fe6C57c88abf8a422ebCF73EEa8320192cFD";
const DEFAULT_ADMIN = "0x9f263957539A09DcF7a29C1B8c9d37f2ccEA6c34";
const DEFAULT_RPC = "https://rpc.gnosischain.com";
const FALLBACK_RPC = "https://gnosis-rpc.publicnode.com";

const FACTORY_ABI = [
  {
    type: "function",
    name: "isStartingJob",
    stateMutability: "view",
    inputs: [{ name: "job", type: "uint8" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "setStartingJob",
    stateMutability: "nonpayable",
    inputs: [
      { name: "job", type: "uint8" },
      { name: "ok", type: "bool" },
    ],
    outputs: [],
  },
] as const;

const SAFE_ABI = [
  {
    type: "function",
    name: "getOwners",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    type: "function",
    name: "getThreshold",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "nonce",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getTransactionHash",
    stateMutability: "view",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" },
      { name: "operation", type: "uint8" },
      { name: "safeTxGas", type: "uint256" },
      { name: "baseGas", type: "uint256" },
      { name: "gasPrice", type: "uint256" },
      { name: "gasToken", type: "address" },
      { name: "refundReceiver", type: "address" },
      { name: "_nonce", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "execTransaction",
    stateMutability: "payable",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" },
      { name: "operation", type: "uint8" },
      { name: "safeTxGas", type: "uint256" },
      { name: "baseGas", type: "uint256" },
      { name: "gasPrice", type: "uint256" },
      { name: "gasToken", type: "address" },
      { name: "refundReceiver", type: "address" },
      { name: "signatures", type: "bytes" },
    ],
    outputs: [{ name: "success", type: "bool" }],
  },
] as const;

function envValue(text: string, name: string): string {
  const match = text.match(new RegExp("^" + name + "=(.*)$", "m"));
  return match?.[1]?.trim() ?? "";
}

function hexKey(value: string): Hex | null {
  const key = value.trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) return null;
  return key as Hex;
}

function loadEnv(): string {
  const path = process.env.GNOSIS_ENV?.trim() || DEFAULT_ENV;
  if (!existsSync(path)) throw new Error("ignition env missing: " + path);
  return readFileSync(path, "utf8");
}

function loadKeys(text: string): { label: string; key: Hex }[] {
  const named = [
    ["ADMIN_OWNER_KEY_1", hexKey(envValue(text, "ADMIN_OWNER_KEY_1"))],
    ["ADMIN_OWNER_KEY_2", hexKey(envValue(text, "ADMIN_OWNER_KEY_2"))],
    ["LISTING_OWNER_KEY", hexKey(envValue(text, "LISTING_OWNER_KEY"))],
    ["PRIVATE_KEY", hexKey(envValue(text, "PRIVATE_KEY"))],
  ] as const;
  const out: { label: string; key: Hex }[] = [];
  for (const [label, key] of named) {
    if (key) out.push({ label, key });
  }
  return out;
}

async function startingJobs(pub: ReturnType<typeof createPublicClient>, factory: `0x${string}`): Promise<number[]> {
  const jobs: number[] = [];
  for (let job = 0; job <= 15; job++) {
    const ok = await pub.readContract({
      address: factory,
      abi: FACTORY_ABI,
      functionName: "isStartingJob",
      args: [job],
    });
    if (ok) jobs.push(job);
  }
  return jobs;
}

async function main(): Promise<void> {
  const job = Number(process.env.JOB ?? "7");
  if (!Number.isInteger(job) || job < 0 || job > 255) throw new Error("JOB must be a uint8");
  const factory = getAddress(process.env.FACTORY?.trim() || DEFAULT_FACTORY);
  const admin = getAddress(process.env.ADMIN?.trim() || DEFAULT_ADMIN);
  const rpc = process.env.RPC_URL?.trim() || DEFAULT_RPC;
  const text = loadEnv();
  const wallets = loadKeys(text);
  const pub = createPublicClient({
    chain: gnosis,
    transport: http(rpc, { timeout: 30_000 }),
  });
  const owners = (await pub.readContract({
    address: admin,
    abi: SAFE_ABI,
    functionName: "getOwners",
  })).map((o) => getAddress(o));
  const threshold = await pub.readContract({
    address: admin,
    abi: SAFE_ABI,
    functionName: "getThreshold",
  });
  const nonce = await pub.readContract({
    address: admin,
    abi: SAFE_ABI,
    functionName: "nonce",
  });
  const before = await startingJobs(pub, factory);
  const ownerWallets = wallets.filter((w) => owners.includes(getAddress(privateKeyToAccount(w.key).address)));
  const signerAddrs = ownerWallets.map((w) => getAddress(privateKeyToAccount(w.key).address));
  const balances: Record<string, string> = {};
  for (const w of wallets) {
    const addr = getAddress(privateKeyToAccount(w.key).address);
    const wei = await pub.getBalance({ address: addr });
    balances[w.label] = addr.slice(0, 6) + "…" + addr.slice(-4) + " " + (Number(wei) / 1e18).toFixed(4) + " xDAI";
  }
  console.log("[enable-job] factory", factory);
  console.log("[enable-job] admin Safe", admin, "threshold", threshold.toString(), "nonce", nonce.toString());
  console.log("[enable-job] Safe owners", owners.join(", "));
  console.log("[enable-job] startingJobs", before.join(","));
  console.log("[enable-job] env signers that are Safe owners", signerAddrs.join(", ") || "(none)");
  console.log("[enable-job] balances", JSON.stringify(balances));

  if (before.includes(job)) {
    console.log("[enable-job] job", job, "already on. Nothing to send.");
    return;
  }
  if (ownerWallets.length < Number(threshold)) {
    throw new Error("need " + threshold + " Admin Safe owner keys; env has " + ownerWallets.length);
  }

  const data = encodeFunctionData({
    abi: FACTORY_ABI,
    functionName: "setStartingJob",
    args: [job, true],
  });
  const zero = "0x0000000000000000000000000000000000000000" as const;
  const safeTxHash = await pub.readContract({
    address: admin,
    abi: SAFE_ABI,
    functionName: "getTransactionHash",
    args: [factory, 0n, data, 0, 0n, 0n, 0n, zero, zero, nonce],
  });
  const signed = await Promise.all(
    ownerWallets.map(async (w) => {
      const account = privateKeyToAccount(w.key);
      const sig = ethSignSafeSignature(await account.signMessage({ message: { raw: safeTxHash } }));
      return { address: getAddress(account.address), signature: sig };
    }),
  );
  signed.sort((a, b) => (a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1));
  const signatures = ("0x" + signed.map((s) => s.signature.slice(2)).join("")) as Hex;

  const payer =
    wallets.find((w) => {
      // prefer a funded wallet; anyone can submit execTransaction
      return true;
    }) ?? ownerWallets[0]!;
  let payWallet = payer;
  let best = 0n;
  for (const w of wallets) {
    const addr = getAddress(privateKeyToAccount(w.key).address);
    const wei = await pub.getBalance({ address: addr });
    if (wei > best) {
      best = wei;
      payWallet = w;
    }
  }
  if (best < 10n ** 15n) throw new Error("no ignition wallet has ≥0.001 xDAI for gas");

  if (process.env.CONFIRM_BROADCAST !== "1") {
    console.log("[enable-job] dry-run only. set CONFIRM_BROADCAST=1 to send setStartingJob(" + job + ", true)");
    console.log("[enable-job] gas payer would be", payWallet.label);
    return;
  }

  const account = privateKeyToAccount(payWallet.key);
  const wallet = createWalletClient({
    account,
    chain: gnosis,
    transport: http(rpc, { timeout: 60_000 }),
  });
  console.log("[enable-job] sending via", payWallet.label, getAddress(account.address));
  const hash = await wallet.writeContract({
    address: admin,
    abi: SAFE_ABI,
    functionName: "execTransaction",
    args: [factory, 0n, data, 0, 0n, 0n, 0n, zero, zero, signatures],
    account,
    chain: gnosis,
  });
  console.log("[enable-job] tx", hash);
  const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 180_000 });
  console.log("[enable-job] status", receipt.status, "block", receipt.blockNumber.toString());
  if (receipt.status !== "success") throw new Error("execTransaction reverted");

  const afterRpc = createPublicClient({
    chain: gnosis,
    transport: http(FALLBACK_RPC, { timeout: 30_000 }),
  });
  const after = await startingJobs(afterRpc, factory);
  console.log("[enable-job] startingJobs now", after.join(","));
  if (!after.includes(job)) throw new Error("job " + job + " still off after confirm");
}

main().catch((err) => {
  console.error("[enable-job] " + (err instanceof Error ? err.message : String(err)));
  process.exit(1);
});
