import puppeteer from "puppeteer-core";
import create from "./create.mjs";
const b = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: "new", args: ["--no-sandbox"] });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 });
const errs = []; p.on("pageerror", e => errs.push(e.message));
p.on("response", r => r.status() >= 400 && errs.push(r.status() + " " + r.url()));
await p.goto("http://localhost:5174/", { waitUntil: "load" });
await p.waitForSelector("form.boot-panel", { timeout: 60000 });
await p.screenshot({ path: "/workspace/ba-research/screens/final-boot.png" });
await create(p); await sleep(3000);
const D = "/workspace/ba-research/screens/final-";
await p.screenshot({ path: D + "world.png" });
const click = (re) => p.evaluate((src) => { const el = [...document.querySelectorAll("button")].find(b => new RegExp(src).test(b.textContent?.trim() ?? "")); el?.click(); return !!el; }, re);
for (const [btn, name] of [["^Character$", "character"], ["^Crafting$", "crafting"], ["^Skills$", "skills"], ["^Spellbook$", "spellbook"]]) {
  console.log(name, await click(btn)); await sleep(900);
  await p.screenshot({ path: D + name + ".png" }); await click("^Close$"); await sleep(300);
}
await click("^Settings$"); await sleep(400); await click("^3D$"); await click("^Close$"); await sleep(1500);
await p.screenshot({ path: D + "world-3d.png" });
await click("^Settings$"); await sleep(400); await click("^Isometric$"); await click("^Close$");
console.log("logs", JSON.stringify(await p.evaluate(() => window.__useGame.getState().logs.slice(-3))));
console.log("errors", JSON.stringify(errs.filter(e => !/favicon/.test(e)).slice(0, 8)));
await b.close();
