import puppeteer from "puppeteer-core";
import create from "./create.mjs";
const b = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: "new", args: ["--no-sandbox"] });
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 800 });
p.on("pageerror", e => console.log("ERR", e.message));
await p.goto("http://localhost:5174/", { waitUntil: "load" });
await p.waitForSelector("form.boot-panel", { timeout: 60000 });
await create(p);
const sent = [];
await p.exposeFunction("__rec", (m) => sent.push(m));
await p.evaluate(() => { const ws = WebSocket.prototype.send; WebSocket.prototype.send = function (d) { try { const m = JSON.parse(d); if (m.type !== "move" && m.type !== "ping") window.__rec(m.type + " " + d.slice(0, 120)); } catch {} return ws.call(this, d); }; });
const click = (t) => p.evaluate((t) => { const el = [...document.querySelectorAll("button")].find(b => b.textContent?.trim() === t); el?.click(); return !!el; }, t);
const btns = () => p.evaluate(() => [...document.querySelectorAll("button")].map(b => b.textContent?.trim()).filter(Boolean).join(" | "));
const logs = () => p.evaluate(() => window.__useGame.getState().logs.slice(-4).join(" // "));
const wait = (ms) => new Promise(r => setTimeout(r, ms));
await click("Max Lv"); await wait(1500);
// Crafting: pick first recipe, try to craft
await click("Crafting"); await wait(600);
await p.evaluate(() => { const g = [...document.querySelectorAll("button")].filter(b => b.textContent?.trim() === "gold"); g[0]?.click(); });
await wait(500);
console.log("craft btns:", (await btns()).match(/Craft[^|]*/g));
await p.evaluate(() => { const el = [...document.querySelectorAll("button")].find(b => /^Craft\b/.test(b.textContent?.trim() ?? "")); el?.click(); });
await wait(900); await p.screenshot({ path: "/workspace/ba-research/screens/m4-panel-craft.png" });
await click("Close"); await wait(300);
// Skills: click an available node in the tree (svg/canvas)
await click("Skills"); await wait(800);
const nb = await p.evaluate(() => { const r = document.querySelector(".st-node.reachable")?.getBoundingClientRect(); return r ? [r.x + r.width / 2, r.y + r.height / 2] : null; });
if (nb) { await p.mouse.click(nb[0], nb[1]); await wait(400); await p.mouse.click(nb[0], nb[1], { clickCount: 2 }); }
const nodeInfo = await p.evaluate(() => { const el = null; if (el) { return ""; } return [...document.querySelectorAll("[class*=node]")].slice(0,5).map(e => (e.className?.baseVal ?? e.className)).join(";"); });
console.log("node:", nodeInfo); await wait(600);
await p.evaluate(() => document.querySelector(".skill-tree-unlock")?.click()); await wait(800);
console.log("skill btns:", (await btns()).match(/(Learn|Allocate|Spend|Confirm)[^|]*/g));
await p.evaluate(() => { const el = [...document.querySelectorAll("button")].find(b => /^(Learn|Allocate|Spend|Confirm)/.test(b.textContent?.trim() ?? "")); el?.click(); });
await wait(900); await p.screenshot({ path: "/workspace/ba-research/screens/m4-panel-skills.png" });
await click("Close"); await wait(300);
// Trainer / Job master via NPC click
const npcs = await p.evaluate(() => window.__useGame.getState().snapshot.units.filter(u => u.kind === "npc").map(u => [u.id, u.npcRole]));
console.log("npcs", JSON.stringify(npcs));
for (const role of ["spell_trainer", "job_master"]) {
  const id = npcs.find(n => n[1] === role)?.[0];
  if (!id) continue;
  const pos = await p.evaluate((id) => { const s = window.__stick; const a = s.r.anchor(id); const c = s.canvas.getBoundingClientRect(); const [x, y] = s.fromFramebuffer(s.canvas, a[0], (a[1] + a[2]) / 2); return [c.left + x, c.top + y]; }, id);
  await p.mouse.click(pos[0], pos[1]); await wait(1500);
  console.log(role, "btns:", (await btns()).slice(0, 400));
  const acted = await p.evaluate((role) => { const bs = [...document.querySelectorAll("button")].filter(b => !b.disabled && role === "job_master" ? /^Cleric$/ : /^(Learn|Buy)\b/i.test(b.textContent?.trim() ?? "")); bs[0]?.click(); return bs.slice(0,3).map(b => b.textContent?.trim()); }, role);
  console.log(role, "acted:", acted); await wait(1200);
  await p.screenshot({ path: `/workspace/ba-research/screens/m4-panel-${role}.png` });
  await p.keyboard.press("Escape"); await click("Close"); await wait(400);
}
console.log("SENT", sent); console.log("LOGS", await logs());
await b.close();
