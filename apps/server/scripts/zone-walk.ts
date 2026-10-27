/** Local-only zone line walk: ws://127.0.0.1 only. Throwaway key, never printed. */
import WebSocket from "ws";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createWalletClient, createPublicClient, http, parseAbi, parseEventLogs } from "viem";
import { foundry } from "viem/chains";
import { JOB_IDS } from "@bellgrave/combat";
import { ZONE_LINKS, ZONE_FIELDS, ZONES, PH_ASH_ROAD } from "@bellgrave/config";
const url = process.argv[2] ?? "ws://127.0.0.1:8899";
if (!/^ws:\/\/(127\.0\.0\.1|localhost)/.test(url)) throw new Error("local only");
const acct = privateKeyToAccount(generatePrivateKey());
const ws = new WebSocket(url, { headers: { Origin: "http://127.0.0.1:5173" } });
let last: any = null; const logs: string[] = [];
const send = (m: any) => ws.send(JSON.stringify(m));
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const FACTORY = process.env.ZW_FACTORY as `0x${string}`;
const abi = parseAbi(["function mintFee() view returns (uint256)", "function createCharacterFor(uint8,uint256) payable returns (uint256)", "function nft() view returns (address)", "function nextTokenId() view returns (uint256)", "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"]);
const pub = createPublicClient({ chain: foundry, transport: http("http://127.0.0.1:8545") });
if ((await pub.getChainId()) !== 31337) throw new Error("not anvil");
async function mint(): Promise<string> {
  const w = createWalletClient({ account: acct, chain: foundry, transport: http("http://127.0.0.1:8545") });
  const fee = await pub.readContract({ address: FACTORY, abi, functionName: "mintFee" });
  const nft = await pub.readContract({ address: FACTORY, abi, functionName: "nft" });
  const next = (await pub.readContract({ address: nft, abi, functionName: "nextTokenId" })) + 1n;
  const h = await w.writeContract({ address: FACTORY, abi, functionName: "createCharacterFor", args: [1, next], value: fee });
  const r = await pub.waitForTransactionReceipt({ hash: h });
  await pub.request({ method: "anvil_mine" as any, params: ["0x10"] as any }); // local confirmations
  const ev = parseEventLogs({ abi, logs: r.logs, eventName: "Transfer" })[0];
  return String(ev.args.tokenId);
}
if (ws.readyState === 1) send({ type: "auth/hello", wallet: acct.address }); else ws.on("open", () => send({ type: "auth/hello", wallet: acct.address }));
let ready!: () => void; const readyP = new Promise<void>((r) => (ready = r));
ws.on("message", async (b) => {
  const m = JSON.parse(String(b)); if (process.env.ZW_DEBUG && m.type !== "pong") console.log("<", m.type, JSON.stringify(m).slice(0, 160));
  if (m.type === "auth/challenge") send({ type: "auth", wallet: acct.address, nonce: m.nonce, message: m.message, signature: await acct.signMessage({ message: m.message }) });
  else if (m.type === "auth/ok") { const id = m.characters?.[0]?.id; if (m.hasCharacter && id) send({ type: "char/enter", characterId: id }); else { send({ type: "dev/faucet" }); await wait(2500); const tokenId = await mint(); send({ type: "char/create", name: "Zw" + Date.now().toString(36).slice(-5), job: "knight", gender: "male", tokenId }); } }
  else if (m.type === "snapshot") { last = m; ready(); }
  else if (m.type === "log") logs.push(m.message);
  else if (m.type === "error") logs.push("ERR " + m.message);
});
await Promise.race([readyP, wait(45000).then(() => { throw new Error("no snapshot: " + logs.join(" | ")); })]);
const mePos = () => { const u = (last?.units ?? []).find((u: any) => u.id === last?.you?.wallet || u.kind === "player"); return u ? `${u.x.toFixed(1)},${u.z.toFixed(1)}` : "?"; };
const meZone = () => last?.you?.zoneId ?? last?.zoneId;
console.log("start zone:", meZone(), "snapshot keys:", Object.keys(last).join(","));
let fail = 0; let started = false;
const order = [...ZONE_LINKS.filter((l, k) => k % 2 === 0), ...ZONE_LINKS.filter((l, k) => k % 2 === 1).reverse()];
// Start just south of the Ash Road (Pale Hollow), the only placement shortcut the protocol allows.
send({ type: "char/enter", zone: (process.env.ZW_FROM as any) ?? "pale_hollow", x: Number(process.env.ZW_X ?? 0), z: Number(process.env.ZW_Z ?? 456) }); await wait(800);
for (const l of order) {
  if (meZone() !== l.from && process.env.ZW_FROM && l.from !== process.env.ZW_FROM && !started) continue;
  started = true;
  if (meZone() !== l.from) { console.log(`SKIP ${l.id}: in ${meZone()}`); fail++; continue; }
  const gate = l.from === "pale_hollow" ? PH_ASH_ROAD : ZONE_FIELDS[l.from].gates.find((g) => g.id === l.gate)!;
  const gx = (gate.minX + gate.maxX) / 2, gz = (gate.minZ + gate.maxZ) / 2;
  const t0 = Date.now();
  while (meZone() === l.from && Date.now() - t0 < 120_000) { send({ type: "move", x: gx, z: gz }); await wait(1500); if (process.env.ZW_DEBUG) console.log("  pos", mePos()); }
  await wait(600);
  const z = meZone(); const you = last.you;
  const units = (last.units ?? []) as any[];
  const mobs = units.filter((u) => u.kind === "mob").length, npcs = units.filter((u) => u.kind === "npc").length;
  const ok = z === l.to; if (!ok) fail++;
  console.log(`${ok ? "OK  " : "FAIL"} ${ZONES[l.from].name} -> ${ZONES[l.to].name} in ${((Date.now() - t0) / 1000).toFixed(0)}s at (${mePos()}) want (${l.spawn.x},${l.spawn.z}); mobs ${mobs}, npcs ${npcs}`);
}
console.log("tail logs:", logs.slice(-4).join(" | ")); ws.close(); process.exit(fail ? 1 : 0);
