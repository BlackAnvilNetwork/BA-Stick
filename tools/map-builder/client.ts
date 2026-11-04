// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Headless map-builder character. Logs in to a LOCAL Bellgrave server the same
 * way stick-web does (wallet challenge + signature), creates a character, and
 * casts the spellbook Map-tab abilities through the normal `ability` message.
 * The server must run with MAP_BUILDER_DEV=1 (or list this wallet/name).
 */
import WebSocket from "ws";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createPublicClient, createWalletClient, http } from "viem";

const FACTORY_ABI = [
  { type: "function", name: "createCharacterFor", stateMutability: "payable", inputs: [{ type: "uint8" }, { type: "uint256" }], outputs: [{ type: "uint256" }] },
] as const;
const NFT_ABI = [
  { type: "function", name: "nextTokenId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class BuilderClient {
  ws!: WebSocket;
  account = privateKeyToAccount(generatePrivateKey());
  logs: string[] = [];
  snapshot: any = null;
  patched = 0;
  parseBig = true;
  listeners: ((m: any) => void)[] = [];
  constructor(readonly url: string, readonly name: string) {}

  async connect(): Promise<void> {
    this.ws = new WebSocket(this.url, { headers: { origin: "http://localhost:5173" } });
    await new Promise<void>((res, rej) => {
      this.ws.once("open", () => res());
      this.ws.once("error", rej);
    });
    this.ws.on("message", (raw) => {
      // Builder bots skip big zone patches unless they are the observer.
      if (!this.parseBig && (raw as Buffer).length > 4096 && (raw as Buffer).subarray(0, 64).toString().includes("zone/")) return;
      let m: any;
      try {
        m = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (m.type === "snapshot") this.snapshot = m;
      else if (m.type === "log") this.logs.push(m.message);
      else if (m.type === "error") this.logs.push("ERROR: " + m.message);
      else if (m.type === "zone/patch") this.patched += m.cells.length;
      this.onMsg?.(m);
      for (const l of this.listeners) l(m);
    });
    const challenge = await this.next((m) => m.type === "auth/challenge" || m.type === "error", () =>
      this.send({ type: "auth/hello", wallet: this.account.address }),
    );
    if (challenge.type === "error") throw new Error(challenge.message);
    const signature = await this.account.signMessage({ message: challenge.message });
    const ok = await this.next((m) => m.type === "auth/ok" || m.type === "error", () =>
      this.send({ type: "auth", wallet: this.account.address, signature, nonce: challenge.nonce, message: challenge.message }),
    );
    if (ok.type === "error") throw new Error(ok.message);
    let tokenId: string | undefined;
    const mint = ok.characterMint;
    if (mint) tokenId = await this.mintLocal(mint);
    this.send({ type: "char/create", name: this.name, job: "fighter", gender: "male", ...(tokenId ? { tokenId } : {}) });
    const t0 = Date.now();
    while (!this.snapshot?.you?.characterId) {
      if (Date.now() - t0 > 20000) throw new Error(`${this.name}: no snapshot (${this.logs.slice(-3).join(" | ")})`);
      await sleep(100);
    }
  }

  /** Local dev chain only: ask the server faucet for gas, then mint like stick-web does. */
  private async mintLocal(mint: any): Promise<string> {
    const rpc: string = mint.rpcUrl ?? mint.rpc ?? "http://127.0.0.1:8545";
    if (!/127\.0\.0\.1|localhost/.test(rpc)) throw new Error("refusing to mint on a non-local chain: " + rpc);
    const chain = { id: mint.chainId, name: "local", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [rpc] } } } as const;
    const pub = createPublicClient({ chain, transport: http(rpc) });
    const wallet = createWalletClient({ account: this.account, chain, transport: http(rpc) });
    this.send({ type: "dev/faucet" });
    const t0 = Date.now();
    while ((await pub.getBalance({ address: this.account.address })) < BigInt(mint.mintFee) * 2n) {
      if (Date.now() - t0 > 20000) throw new Error(`${this.name}: faucet never paid`);
      await sleep(300);
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      const next = (await pub.readContract({ address: mint.nft, abi: NFT_ABI, functionName: "nextTokenId" })) as bigint;
      const expected = next + 1n;
      try {
        const hash = await wallet.writeContract({ address: mint.factory, abi: FACTORY_ABI, functionName: "createCharacterFor", args: [0, expected], value: BigInt(mint.mintFee) });
        const rc = await pub.waitForTransactionReceipt({ hash });
        if (rc.status === "success") return expected.toString();
      } catch {
        /* another builder took that id; retry */
      }
      await sleep(200 + Math.random() * 400);
    }
    throw new Error(`${this.name}: mint failed`);
  }

  private onMsg?: (m: any) => void;
  private next(pred: (m: any) => boolean, kick: () => void, ms = 15000): Promise<any> {
    return new Promise((res, rej) => {
      const timer = setTimeout(() => rej(new Error(`${this.name}: timeout`)), ms);
      this.onMsg = (m) => {
        if (pred(m)) {
          clearTimeout(timer);
          this.onMsg = undefined;
          res(m);
        }
      };
      kick();
    });
  }

  send(m: Record<string, unknown>) {
    this.ws.send(JSON.stringify(m));
  }

  /** Cast a Map-tab spell exactly as the hotbar does. */
  cast(id: string, targetId?: string) {
    this.send(targetId ? { type: "ability", id, targetId } : { type: "ability", id });
  }

  get zone(): string | undefined {
    return this.snapshot?.you?.zoneId ?? this.snapshot?.zoneId;
  }

  close() {
    this.ws.close();
  }
}
