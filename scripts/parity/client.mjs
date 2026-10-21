// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Minimal headless game client for the parity harness. Speaks the same
// @bellgrave/protocol messages stick-web sends, and signs with a local anvil key.
import { requireServer } from "./stack.mjs";
const WebSocket = requireServer("ws");
const viem = requireServer("viem");
const { privateKeyToAccount } = requireServer("viem/accounts");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const NFT_ABI = [
  { type: "function", name: "ownerOf", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "address" }] },
  { type: "function", name: "nextTokenId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
];
export const FACTORY_ABI = [
  { type: "function", name: "createCharacterFor", stateMutability: "payable", inputs: [{ type: "uint8" }, { type: "uint256" }], outputs: [{ type: "uint256" }] },
];
export const ESCROW_ABI = [
  { type: "function", name: "asks", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [
    { name: "sellerTokenId", type: "uint256" }, { name: "itemId", type: "uint256" }, { name: "amount", type: "uint256" },
    { name: "priceWei", type: "uint256" }, { name: "open", type: "bool" }, { name: "used", type: "bool" }] },
  { type: "function", name: "buyAsk", stateMutability: "payable", inputs: [{ type: "uint256" }, { type: "uint256" }], outputs: [] },
];
export const PVP_ABI = [
  { type: "function", name: "open", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "payerOf", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "address" }] },
  { type: "function", name: "BOUNTY_WEI", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "place", stateMutability: "payable", inputs: [{ type: "uint256" }], outputs: [] },
  { type: "function", name: "pendingClaim", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [
    { type: "uint256" }, { type: "address" }, { type: "uint64" }] },
];

export function chainClients(stack, key) {
  const chain = { id: 31337, name: "anvil", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [stack.rpcUrl] } } };
  const pub = viem.createPublicClient({ chain, transport: viem.http(stack.rpcUrl) });
  const account = key ? privateKeyToAccount(key) : undefined;
  const wallet = account ? viem.createWalletClient({ account, chain, transport: viem.http(stack.rpcUrl) }) : undefined;
  return { pub, wallet, account, chain, viem };
}

export class GameClient {
  constructor(stack, key, label) {
    this.stack = stack;
    this.label = label;
    Object.assign(this, chainClients(stack, key));
    this.address = this.account.address;
    this.msgs = [];
    this.logs = [];
    this.snapshot = null;
    this.waiters = [];
  }
  async connect() {
    this.ws = new WebSocket(this.stack.wsUrl, { headers: { origin: "http://localhost:5173" } });
    await new Promise((res, rej) => { this.ws.once("open", res); this.ws.once("error", rej); });
    this.ws.on("message", (raw) => {
      let m; try { m = JSON.parse(String(raw)); } catch { return; }
      if (m.type === "snapshot") this.snapshot = m;
      else this.msgs.push(m);
      if (m.type === "log") this.logs.push(m.message);
      if (m.type === "snapshot" && Array.isArray(m.log)) for (const l of m.log) if (!this.logs.includes(l)) this.logs.push(l);
      if (m.type === "error") this.logs.push("ERROR: " + m.message);
      for (const w of [...this.waiters]) if (w.pred(m)) { this.waiters.splice(this.waiters.indexOf(w), 1); w.res(m); }
    });
  }
  send(m) { this.ws.send(JSON.stringify(m)); }
  waitFor(pred, ms = 15000, what = "message") {
    return new Promise((res, rej) => {
      const w = { pred, res };
      this.waiters.push(w);
      setTimeout(() => { const i = this.waiters.indexOf(w); if (i >= 0) { this.waiters.splice(i, 1); rej(new Error(`${this.label}: timeout waiting for ${what}`)); } }, ms);
    });
  }
  async waitLog(re, ms = 20000) {
    const start = this.logs.length;
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const hit = this.logs.slice(Math.max(0, start - 3)).find((l) => re.test(l));
      if (hit) return hit;
      await sleep(100);
    }
    throw new Error(`${this.label}: no log matching ${re} (last: ${this.logs.slice(-3).join(" | ")})`);
  }
  async until(fn, ms = 20000, what = "condition") {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      try { const v = await fn(); if (v) return v; } catch {}
      await sleep(150);
    }
    throw new Error(`${this.label}: timeout waiting for ${what}`);
  }
  async login() {
    this.send({ type: "auth/hello", wallet: this.address });
    const ch = await this.waitFor((m) => m.type === "auth/challenge" || m.type === "error", 10000, "auth/challenge");
    if (ch.type === "error") throw new Error(ch.message);
    const signature = await this.account.signMessage({ message: ch.message });
    this.send({ type: "auth", wallet: this.address, signature, nonce: ch.nonce, message: ch.message });
    const ok = await this.waitFor((m) => m.type === "auth/ok" || m.type === "error", 15000, "auth/ok");
    if (ok.type === "error") throw new Error(ok.message);
    this.authOk = ok;
    return ok;
  }
  async mintAndCreate(name, job = "fighter", jobIndex = 0) {
    const mint = this.authOk.characterMint;
    if (!mint) throw new Error("server sent no characterMint config");
    const next = await this.pub.readContract({ address: mint.nft, abi: NFT_ABI, functionName: "nextTokenId" });
    const expected = next + 1n;
    const hash = await this.wallet.writeContract({ address: mint.factory, abi: FACTORY_ABI, functionName: "createCharacterFor", args: [jobIndex, expected], value: BigInt(mint.mintFee) });
    const rc = await this.pub.waitForTransactionReceipt({ hash });
    if (rc.status !== "success") throw new Error("mint reverted");
    this.tokenId = expected.toString();
    this.send({ type: "char/create", name, job, gender: "male", tokenId: this.tokenId });
    await this.until(() => this.snapshot?.you?.characterId, 30000, "first snapshot after char/create");
    return this.tokenId;
  }
  get you() { return this.snapshot?.you; }
  balance() { return this.pub.getBalance({ address: this.address }); }
  close() { try { this.ws.close(); } catch {} }
}
