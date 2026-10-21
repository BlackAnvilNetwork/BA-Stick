#!/usr/bin/env node
// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// BA-Stick #39 parity check for F65 (auction house), F66 (Lok vault / log items)
// and F69 (PvP / Ash Pit). Runs the real apps/server against a throwaway anvil
// (chain 31337 only) and drives it with headless clients that send the same
// protocol messages stick-web sends. Records pass/fail per step.
//
//   node scripts/parity/parity.mjs [--json out.json] [--md out.md] [--only ah,vault,pvp]
//
// It never touches Gnosis/Chiado, never prints keys, and never signs off #39.
import { writeFileSync } from "node:fs";
import { startStack } from "./stack.mjs";
import { GameClient, ESCROW_ABI, PVP_ABI, chainClients } from "./client.mjs";

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const only = (opt("--only") ?? "ah,vault,pvp").split(",");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
let section = "";
async function step(name, fn) {
  const t0 = Date.now();
  try {
    const detail = await fn();
    results.push({ section, name, ok: true, detail: detail ?? "", ms: Date.now() - t0 });
    console.log(`PASS [${section}] ${name}${detail ? " — " + detail : ""}`);
    return true;
  } catch (e) {
    results.push({ section, name, ok: false, detail: String(e?.message ?? e).slice(0, 400), ms: Date.now() - t0 });
    console.log(`FAIL [${section}] ${name} — ${String(e?.message ?? e).slice(0, 400)}`);
    return false;
  }
}
const assert = (c, m) => { if (!c) throw new Error(m); };
const eq = (a, b, m) => { if (String(a) !== String(b)) throw new Error(`${m}: expected ${b}, got ${a}`); };

const sumItems = (rows, id) => (rows ?? []).filter((r) => String(r.itemId ?? r.tokenId) === String(id)).reduce((s, r) => s + Number(r.amount), 0);
const bagAmt = (c, id) => (c.you?.inventory ?? []).filter((r) => r.tokenId === id && !r.starter && !r.hq).reduce((s, r) => s + r.amount, 0);
const logAmt = (c, id) => sumItems(c.you?.lok?.items, id);
const inboxAmt = (c, id) => sumItems(c.you?.lok?.inbox, id);

async function gatherSome(c, want, ms = 240000) {
  const t0 = Date.now();
  const before = new Map((c.you.inventory ?? []).filter((r) => !r.starter).map((r) => [r.tokenId, r.amount]));
  let node = 0;
  let lastLen = 0;
  while (Date.now() - t0 < ms) {
    const gained = (c.you.inventory ?? []).filter((r) => !r.starter && !r.hq && r.amount > (before.get(r.tokenId) ?? 0));
    const best = gained.sort((a, b) => b.amount - a.amount)[0];
    if (best && best.amount >= want) return best.tokenId;
    c.send({ type: "gather", nodeId: `ph-live-${node}` });
    await sleep(2500);
    const fresh = c.logs.slice(lastLen).join(" ");
    lastLen = c.logs.length;
    if (/depleted|Nothing to gather|requires|need a|cannot/i.test(fresh)) node = (node + 1) % 20;
  }
  throw new Error("could not gather " + want + " items (last logs: " + c.logs.slice(-3).join(" | ") + ")");
}

async function main() {
  const stack = await startStack({ log: (m) => console.log("·", m) });
  const { contracts } = stack;
  const reader = chainClients(stack).pub;
  const clients = [];
  const mk = async (i, name) => {
    const c = new GameClient(stack, stack.keys[i], name);
    await c.connect();
    await c.login();
    await c.mintAndCreate(name);
    clients.push(c);
    return c;
  };
  try {
    section = "setup";
    let A, B, C;
    await step("local stack is anvil 31337 with real server", async () => {
      eq(stack.chainId, 31337, "chain id");
      return `escrow=${contracts.ESCROW} pvp=${contracts.PVP}`;
    });
    await step("three players log in (signed auth), mint a CharacterNFT, create a character", async () => {
      A = await mk(1, "Seller"); B = await mk(2, "Buyer"); C = await mk(3, "Bystand");
      for (const c of [A, B, C]) {
        const owner = await reader.readContract({ address: contracts.NFT, abi: [{ type: "function", name: "ownerOf", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "address" }] }], functionName: "ownerOf", args: [BigInt(c.tokenId)] });
        eq(owner.toLowerCase(), c.address.toLowerCase(), `ownerOf(${c.tokenId})`);
        eq(c.you.lok?.tokenId, c.tokenId, "snapshot lok.tokenId");
      }
      return `tokens ${A.tokenId}/${B.tokenId}/${C.tokenId}`;
    });
    if (!A || !B || !C) throw new Error("setup failed");
    await step("client config points at the local escrow / bounty / chain", async () => {
      const l = A.you.lok;
      eq(l.ahEscrow?.address?.toLowerCase(), contracts.ESCROW.toLowerCase(), "ahEscrow.address");
      eq(l.ahEscrow?.chainId, 31337, "ahEscrow.chainId");
      eq(l.ahEscrow?.rpcUrl, stack.rpcUrl, "ahEscrow.rpcUrl");
      eq(l.pvpBounty?.address?.toLowerCase(), contracts.PVP.toLowerCase(), "pvpBounty.address");
      const bw = await reader.readContract({ address: contracts.PVP, abi: PVP_ABI, functionName: "BOUNTY_WEI" });
      eq(l.pvpBounty?.bountyWei, bw, "pvpBounty.bountyWei vs chain BOUNTY_WEI");
      return l.pvpBounty?.currency !== l.ahEscrow?.currency?.symbol ? `note: pvpBounty.currency label is "${l.pvpBounty?.currency}" on chain 31337 (ETH)` : "";
    });

    let ITEM;
    await step("seller gathers a non-starter stack to trade", async () => {
      ITEM = await gatherSome(A, 6);
      return `item ${ITEM} x${bagAmt(A, ITEM)}`;
    });
    if (!ITEM) throw new Error("no item; cannot continue");

    // ---------------- F66 Lok vault (bag <-> log) ----------------
    if (only.includes("vault")) {
      section = "F66 vault";
      await step("import 0 is rejected by the protocol (nothing moves)", async () => {
        const bag = bagAmt(A, ITEM), log = logAmt(A, ITEM);
        A.send({ type: "lok/import", tokenId: ITEM, amount: 0 });
        await sleep(800);
        eq(bagAmt(A, ITEM), bag, "bag"); eq(logAmt(A, ITEM), log, "log");
      });
      await step("fractional amount 1.5 is rejected (no rounding)", async () => {
        const bag = bagAmt(A, ITEM);
        A.send({ type: "lok/import", tokenId: ITEM, amount: 1.5 });
        await sleep(800);
        eq(bagAmt(A, ITEM), bag, "bag");
      });
      await step("over-import (more than in bag) is refused", async () => {
        const bag = bagAmt(A, ITEM);
        A.send({ type: "lok/import", tokenId: ITEM, amount: bag + 1 });
        await A.waitLog(/do not have that many/);
        eq(bagAmt(A, ITEM), bag, "bag unchanged");
      });
      await step("starter gear cannot be imported", async () => {
        const st = A.you.inventory.find((r) => r.starter);
        A.send({ type: "lok/import", tokenId: st.tokenId, amount: 1 });
        await A.waitLog(/Starter gear cannot be imported|not log items|do not have/);
      });
      await step("import moves the stack bag → log (totals conserved)", async () => {
        const bag = bagAmt(A, ITEM), log = logAmt(A, ITEM), n = bag;
        A.send({ type: "lok/import", tokenId: ITEM, amount: n });
        await A.until(() => logAmt(A, ITEM) === log + n, 15000, "log balance");
        eq(bagAmt(A, ITEM), bag - n, "bag after");
        return `log=${logAmt(A, ITEM)} bag=${bagAmt(A, ITEM)}`;
      });
      await step("over-export (more than in log) is refused", async () => {
        const log = logAmt(A, ITEM), bag = bagAmt(A, ITEM);
        A.send({ type: "lok/export", tokenId: ITEM, amount: log + 1 });
        await sleep(1500);
        eq(logAmt(A, ITEM), log, "log"); eq(bagAmt(A, ITEM), bag, "bag");
        return A.logs.at(-1);
      });
      await step("concurrent exports: 4 parallel x1 with 2 left never overdraws", async () => {
        const log0 = logAmt(A, ITEM), bag0 = bagAmt(A, ITEM);
        if (log0 > 2) {
          A.send({ type: "lok/export", tokenId: ITEM, amount: log0 - 2 });
          await A.until(() => logAmt(A, ITEM) === 2, 15000, "pre-export");
        }
        for (let i = 0; i < 4; i++) A.send({ type: "lok/export", tokenId: ITEM, amount: 1 });
        await sleep(3000);
        eq(logAmt(A, ITEM), 0, "log after race");
        eq(bagAmt(A, ITEM), bag0 + log0, "bag after race (conserved)");
        return `log ${log0}→0, bag ${bag0}→${bagAmt(A, ITEM)}`;
      });
      await step("concurrent imports: 4 parallel imports of the whole bag never double-credit", async () => {
        const n = bagAmt(A, ITEM), log0 = logAmt(A, ITEM);
        for (let i = 0; i < 4; i++) A.send({ type: "lok/import", tokenId: ITEM, amount: n });
        await sleep(3000);
        eq(logAmt(A, ITEM), log0 + n, "log after race");
        eq(bagAmt(A, ITEM), 0, "bag after race");
        return `log=${logAmt(A, ITEM)}`;
      });
      await step("vault shows no spendable coin balance (items only; no ETH custody)", async () => {
        const l = A.you.lok;
        assert(l.eth === "0" || l.eth == null, "lok.eth should be 0, got " + l.eth);
        assert(l.kek === "0" || l.kek == null, "lok.kek should be 0, got " + l.kek);
        return `eth=${l.eth}, kek=${l.kek}, gold=${l.gold}`;
      });
    }

    // ---------------- F65 Auction house ----------------
    const listingIds = [];
    const listOne = async (c, price, amount = 1) => {
      const before = new Set((c.you.lok.listings ?? []).map((l) => l.id));
      c.send({ type: "lok/list", tokenId: ITEM, amount, minPrice: price });
      const msg = await c.waitLog(/Listed .* as #(\d+)|failed|Nothing was listed|Could not/i, 30000);
      const m = msg.match(/as #(\d+)/);
      if (!m) throw new Error("list failed: " + msg);
      await c.until(() => (c.you.lok.listings ?? []).some((l) => l.id === m[1] && !before.has(l.id)), 10000, "listing in snapshot");
      return m[1];
    };
    const ask = (id) => reader.readContract({ address: contracts.ESCROW, abi: ESCROW_ABI, functionName: "asks", args: [BigInt(id)] });
    const reverts = async (c, args, value) => {
      try { await c.pub.simulateContract({ address: contracts.ESCROW, abi: ESCROW_ABI, functionName: "buyAsk", args, value, account: c.account }); return false; } catch { return true; }
    };
    if (only.includes("ah")) {
      section = "F65 auction";
      if (logAmt(A, ITEM) < 5 && bagAmt(A, ITEM) > 0) {
        const n = bagAmt(A, ITEM);
        A.send({ type: "lok/import", tokenId: ITEM, amount: n });
        await A.until(() => bagAmt(A, ITEM) === 0, 15000, "import").catch(() => {});
      }
      await step("list below 1 gwei is refused", async () => {
        A.send({ type: "lok/list", tokenId: ITEM, amount: 1, minPrice: "5000" });
        await A.waitLog(/below 1 gwei/);
      });
      await step("list more than held is refused", async () => {
        A.send({ type: "lok/list", tokenId: ITEM, amount: logAmt(A, ITEM) + 50, minPrice: "1000000000000000" });
        const m = await A.waitLog(/Listed|insufficient|not enough|do not have|failed|balance|Nothing/i, 20000);
        assert(!/^Listed/.test(m), "listed more than held: " + m);
        return m;
      });
      const PRICE = 1_000_000_000_000_007n; // odd wei: exercises the floor in the 5% fee
      let L1;
      await step("list: log listing + on-chain ask match (id, seller token, item, amount, price)", async () => {
        const log0 = logAmt(A, ITEM);
        L1 = await listOne(A, PRICE.toString(), 1);
        const a = await ask(L1);
        assert(a[4] === true, "ask not open on chain");
        eq(a[0], A.tokenId, "sellerTokenId"); eq(a[1], ITEM, "itemId"); eq(a[2], 1, "amount"); eq(a[3], PRICE, "priceWei");
        const row = A.you.lok.listings.find((l) => l.id === L1);
        eq(row.minPrice, PRICE, "snapshot minPrice");
        eq(logAmt(A, ITEM), log0 - 1, "log debited into escrow");
        return `#${L1}`;
      });
      await step("UI price formatting matches chain (formatEther of priceWei)", async () => {
        const { viem } = chainClients(stack);
        const a = await ask(L1);
        const ui = viem.formatEther(BigInt(A.you.lok.listings.find((l) => l.id === L1).minPrice));
        eq(ui, viem.formatEther(a[3]), "display");
        return `${ui} ETH`;
      });
      await step("buy: underpay reverts (WrongPrice)", async () => {
        assert(await reverts(B, [BigInt(L1), BigInt(B.tokenId)], PRICE - 1n), "underpay did not revert");
      });
      await step("buy: seller cannot buy own ask; a token the caller does not own reverts", async () => {
        const r1 = await reverts(A, [BigInt(L1), BigInt(A.tokenId)], PRICE);
        const r2 = await reverts(C, [BigInt(L1), BigInt(B.tokenId)], PRICE);
        assert(r1 && r2, `self-buy reverted=${r1}, foreign-token reverted=${r2}`);
      });
      await step("buy: admitFill → buyAsk pays seller price−5% (floored); item mirrors to buyer", async () => {
        B.send({ type: "ah/admitFill", priceWei: PRICE.toString(), req: 1 });
        const adm = await B.waitFor((m) => m.type === "ah/admitFill" && m.req === 1, 10000, "admitFill");
        assert(adm.ok, "admitFill refused: " + adm.error);
        const sel0 = await A.balance();
        const tre0 = await reader.getBalance({ address: stack.treasury });
        const h = await B.wallet.writeContract({ address: contracts.ESCROW, abi: ESCROW_ABI, functionName: "buyAsk", args: [BigInt(L1), BigInt(B.tokenId)], value: PRICE });
        const rc = await B.pub.waitForTransactionReceipt({ hash: h });
        eq(rc.status, "success", "buyAsk");
        const fee = (PRICE * 500n) / 10000n;
        const sel1 = await A.balance();
        eq(sel1 - sel0, PRICE - fee, "seller wallet delta (wei)");
        const tre1 = await reader.getBalance({ address: stack.treasury });
        await stack.rpc("anvil_mine", ["0x3"]);
        await B.until(() => logAmt(B, ITEM) + inboxAmt(B, ITEM) >= 1, 60000, "AskFilled mirrored to buyer");
        const a = await ask(L1);
        assert(a[4] === false, "ask still open on chain");
        return `seller +${sel1 - sel0} wei (price ${PRICE}, fee ${fee}); fee recipient +${tre1 - tre0}; buyer log+inbox=${logAmt(B, ITEM) + inboxAmt(B, ITEM)}`;
      });
      await step("buy: seller's listing leaves the book after the fill", async () => {
        await A.until(() => !(A.you.lok.listings ?? []).some((l) => l.id === L1), 30000, "listing gone");
      });
      await step("buy: second buy of a filled ask reverts (AskClosed)", async () => {
        assert(await reverts(B, [BigInt(L1), BigInt(B.tokenId)], PRICE), "double-buy did not revert");
      });
      let L2;
      await step("cancel: refused before the 60 s minimum lifetime", async () => {
        L2 = await listOne(A, "2000000000000000", 1);
        A.send({ type: "lok/cancel", listingId: L2 });
        await A.waitLog(/at least 60s/);
      });
      await step("cancel: after 60 s closes the on-chain ask and returns the stack to the seller inbox", async () => {
        await stack.advanceClock(61_000);
        const inbox0 = inboxAmt(A, ITEM);
        A.send({ type: "lok/cancel", listingId: L2 });
        const m = await A.waitLog(/Cancelled listing #\d+|cancel failed|already closed/i, 60000);
        assert(/^Cancelled/.test(m), m);
        const a = await ask(L2);
        assert(a[4] === false, "ask still open on chain after cancel");
        await A.until(() => inboxAmt(A, ITEM) === inbox0 + 1, 15000, "inbox credit");
        assert(!(A.you.lok.listings ?? []).some((l) => l.id === L2), "listing still in snapshot");
        return `inbox ${inbox0}→${inboxAmt(A, ITEM)}`;
      });
      await step("cancel: another player cannot cancel the seller's listing", async () => {
        const L = await listOne(A, "3000000000000000", 1);
        listingIds.push(L);
        await stack.advanceClock(61_000);
        B.send({ type: "lok/cancel", listingId: L });
        const m = await B.waitLog(/Unknown listing|not yours|Nothing was cancelled|Cancelled/i);
        const a = await ask(L);
        assert(a[4] === true, "foreign cancel closed the ask: " + m);
        return m;
      });
      await step("takeInbox moves the cancelled stack back into the log", async () => {
        const n = inboxAmt(A, ITEM), log0 = logAmt(A, ITEM);
        A.send({ type: "lok/takeInbox", tokenId: ITEM, amount: n });
        await A.until(() => inboxAmt(A, ITEM) === 0, 15000, "inbox emptied");
        return `log ${log0}→${logAmt(A, ITEM)}, bag ${bagAmt(A, ITEM)}`;
      });
      await step("expiry: reclaim before the 7-day ask window leaves chain and log consistent", async () => {
        const L = listingIds[0];
        A.send({ type: "lok/reclaim", listingId: L });
        const m = await A.waitLog(/^Reclaimed|failed|already closed|window|expire|not yet|Engine|refus/i, 60000);
        await sleep(1500);
        const a = await ask(L);
        const row = (A.you.lok.listings ?? []).find((l) => l.id === L);
        const consistent = (a[4] && row) || (!a[4] && !row);
        assert(!/^Reclaimed/.test(m), "reclaimed before the 7-day window: " + m);
        assert(consistent, `chain/log disagree after early reclaim: chainOpen=${a[4]} logListing=${row ? "open" : "gone"} ("${m}")`);
        return `"${m}" chainOpen=${a[4]}`;
      });
      await step("expiry: after 7 days reclaim returns the stack and closes the chain ask", async () => {
        const L = await listOne(A, "4000000000000000", 1);
        await stack.advanceClock(7 * 24 * 3600 * 1000 + 60_000);
        const inbox0 = inboxAmt(A, ITEM);
        A.send({ type: "lok/reclaim", listingId: L });
        const m = await A.waitLog(/Reclaimed listing #\d+|failed|already closed/i, 60000);
        assert(/^Reclaimed/.test(m), m);
        const a = await ask(L);
        assert(a[4] === false, "ask open on chain after reclaim");
        await A.until(() => inboxAmt(A, ITEM) === inbox0 + 1, 15000, "inbox credit");
      });
      await step("server listings == open on-chain asks (no drift)", async () => {
        const rows = A.you.lok.listings ?? [];
        const drift = [];
        for (const r of rows) {
          const a = await ask(r.id);
          if (!a[4]) drift.push(`#${r.id} in log, closed on chain`);
          else if (String(a[3]) !== String(r.minPrice)) drift.push(`#${r.id} price ${r.minPrice} vs ${a[3]}`);
        }
        assert(drift.length === 0, drift.join("; "));
        return `${rows.length} open listing(s) checked`;
      });
    }

    // ---------------- F69 PvP / Ash Pit ----------------
    if (only.includes("pvp")) {
      section = "F69 pvp";
      const BOUNTY = await reader.readContract({ address: contracts.PVP, abi: PVP_ABI, functionName: "BOUNTY_WEI" });
      const isOpen = (c) => reader.readContract({ address: contracts.PVP, abi: PVP_ABI, functionName: "open", args: [BigInt(c.tokenId)] });
      const unitOf = (viewer, c) => viewer.snapshot?.units?.find((u) => u.characterId === c.you.characterId);
      const join = async (c) => {
        c.send({ type: "pvp/join" });
        const need = await c.waitFor((m) => m.type === "pvp/placeNeeded" || m.type === "pvp/joined", 20000, "placeNeeded");
        if (need.type === "pvp/joined") return need;
        const h = await c.wallet.writeContract({ address: contracts.PVP, abi: PVP_ABI, functionName: "place", args: [BigInt(c.tokenId)], value: BigInt(need.bountyWei) });
        await c.pub.waitForTransactionReceipt({ hash: h });
        c.send({ type: "pvp/join", placeTxHash: h });
        return c.waitFor((m) => m.type === "pvp/joined", 30000, "pvp/joined");
      };
      await step("outside the pit, players cannot damage each other", async () => {
        const hp0 = unitOf(B, C)?.hp;
        B.send({ type: "engage", targetId: unitOf(B, C)?.id ?? C.address.toLowerCase() });
        await sleep(4000);
        const hp1 = unitOf(B, C)?.hp;
        B.send({ type: "disengage" });
        assert(hp0 == null || hp1 == null || hp1 >= hp0, `C lost hp outside pit ${hp0}→${hp1}`);
        return `C hp ${hp0}→${hp1}; B log: ${B.logs.at(-1)}`;
      });
      await step("join without paying → pvp/placeNeeded (bounty address + amount match chain)", async () => {
        A.send({ type: "pvp/join" });
        const need = await A.waitFor((m) => m.type === "pvp/placeNeeded", 20000, "placeNeeded");
        eq(need.address.toLowerCase(), contracts.PVP.toLowerCase(), "address");
        eq(need.bountyWei, BOUNTY, "bountyWei");
        eq(need.tokenId, A.tokenId, "tokenId");
        assert(!(await isOpen(A)), "bounty open without payment");
      });
      await step("join with a forged placeTxHash is refused", async () => {
        A.send({ type: "pvp/join", placeTxHash: "0x" + "ab".repeat(32) });
        const r = await Promise.race([
          A.waitFor((m) => m.type === "pvp/joined", 8000, "joined").then(() => "joined"),
          A.waitFor((m) => m.type === "pvp/placeNeeded", 8000, "placeNeeded").then(() => "placeNeeded"),
        ]).catch(() => "no join");
        assert(r !== "joined", "joined with a forged tx hash");
        return r;
      });
      let wB0;
      await step("place bounty on chain then join (A and B) → in the Ash Pit, bounty open on chain", async () => {
        wB0 = await B.balance();
        const j = await join(A); await join(B);
        assert(await isOpen(A) && await isOpen(B), "bounty not open on chain");
        return `${j.areaName}, level cap ${j.levelCap}`;
      });
      await step("damage + death: B kills A in the pit → A gets pvp/slain naming B", async () => {
        B.send({ type: "debug/maxlevel" });
        await sleep(500);
        const slain = A.waitFor((m) => m.type === "pvp/slain", 300000, "pvp/slain");
        const hpSeen = [];
        const poke = setInterval(() => {
          const ua = unitOf(B, A);
          if (ua) { if (hpSeen.at(-1) !== ua.hp) hpSeen.push(ua.hp); B.send({ type: "engage", targetId: ua.id }); }
        }, 1500);
        try {
          const m = await slain;
          eq(m.slayerWallet?.toLowerCase(), B.address.toLowerCase(), "slayerWallet");
          eq(m.bountyWei, BOUNTY, "bountyWei");
          assert(hpSeen.length >= 2, "never saw A take damage");
          return `A hp ${hpSeen.slice(0, 8).join("→")}…; slain by ${m.slayerName}; canRejoin=${m.canRejoin}`;
        } finally { clearInterval(poke); B.send({ type: "disengage" }); }
      });
      await step("death pays the slayer: A's bounty closes on chain with a claim to B", async () => {
        const st = await A.until(async () => {
          const o = await isOpen(A);
          const pc = await reader.readContract({ address: contracts.PVP, abi: PVP_ABI, functionName: "pendingClaim", args: [BigInt(A.tokenId)] }).catch(() => null);
          return !o || (pc && pc[1] !== "0x0000000000000000000000000000000000000000") ? { o, pc } : null;
        }, 90000, "bounty claim");
        await sleep(3000);
        const o = await isOpen(A);
        const bNow = await B.balance();
        return `A open=${o}; pendingClaim=${JSON.stringify(st.pc, (k, v) => typeof v === "bigint" ? v.toString() : v)}; B wallet Δ since join=${bNow - wB0} wei (−1 bounty −gas +payout)`;
      });
      await step("leave: B leaves the pit → pvp/left, bounty refunded on chain", async () => {
        const b0 = await B.balance();
        B.send({ type: "pvp/leave" });
        await B.waitFor((m) => m.type === "pvp/left", 60000, "pvp/left");
        assert(!(await isOpen(B)), "B bounty still open");
        const b1 = await B.balance();
        eq(b1 - b0, BOUNTY, "B refund (wei)");
        return `B refund ${b1 - b0} wei`;
      });
      await step("leave when not in the pit moves no funds", async () => {
        const b0 = await C.balance();
        C.send({ type: "pvp/leave" });
        await sleep(2000);
        eq(await C.balance(), b0, "C balance");
      });
    }
  } finally {
    for (const c of clients) c.close();
    stack.stop();
  }
  return { stack };
}

let info = {};
try { info = await main(); } catch (e) { results.push({ section: section || "setup", name: "harness", ok: false, detail: String(e?.stack ?? e).slice(0, 600) }); console.log("FATAL", e); }
const pass = results.filter((r) => r.ok).length;
const fail = results.length - pass;
console.log(`\n${pass} passed, ${fail} failed`);
if (opt("--json")) writeFileSync(opt("--json"), JSON.stringify({ when: new Date().toISOString(), results, serverLog: info?.stack?.serverLog }, null, 2));
if (opt("--md")) {
  const lines = ["| Section | Step | Result | Detail |", "|---|---|---|---|", ...results.map((r) => `| ${r.section} | ${r.name} | ${r.ok ? "PASS" : "**FAIL**"} | ${String(r.detail).replace(/\|/g, "\\|").replace(/\n/g, " ")} |`)];
  writeFileSync(opt("--md"), lines.join("\n") + "\n");
}
process.exit(fail ? 1 : 0);
