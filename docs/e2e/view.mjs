import puppeteer from "puppeteer-core";
import create from "./create.mjs";
const b = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: "new", args: ["--no-sandbox"] });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const url = process.argv[2];
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 });
p.on("pageerror", e => console.log("pageerror", e.message));
await p.goto(url, { waitUntil: "load" });
await p.waitForSelector("form.boot-panel", { timeout: 60000 });
await create(p); await sleep(2500);
console.log("phase", await p.evaluate(() => document.querySelector(".stick-canvas") ? "canvas" : "none"), await p.evaluate(() => [...document.querySelectorAll(".hud-log, [class*=log]")].map(e => e.textContent).join(" ").slice(0, 160)));
const click = (re) => p.evaluate((src) => { const el = [...document.querySelectorAll("button")].find(b => new RegExp(src).test(b.textContent?.trim() ?? "")); el?.click(); return !!el; }, re);
if (process.argv[3]) {
  await p.screenshot({ path: "/workspace/ba-research/screens/m5-view-iso.png" });
  console.log("settings", await click("^Settings$")); await sleep(500);
  console.log("btns", await p.evaluate(() => [...document.querySelectorAll("button")].map(b => b.textContent.trim()).join("|").slice(-600)), await p.evaluate(() => document.documentElement.dataset.renderer));
  console.log("3d", await click("^3D$")); await sleep(300);
  await p.screenshot({ path: "/workspace/ba-research/screens/m5-view-settings.png" });
  await click("^Close$"); await sleep(1200);
  console.log("dataset", await p.evaluate(() => document.documentElement.dataset.uiView));
  await p.screenshot({ path: "/workspace/ba-research/screens/m5-view-3d.png" });
}
await b.close();
