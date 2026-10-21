// usage: node bench.mjs <tag>  -> draw-ms p50 for hub + crowd + screenshots
import puppeteer from "puppeteer-core";
const tag = process.argv[2] ?? "x";
const b = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: "new", args: ["--no-sandbox"] });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const shots = {
  hub: "zone=pale_hollow&x=0&z=2",
  crowd: "zone=pale_hollow&x=0&z=2&crowd=200",
  field: "zone=pale_hollow&x=-30&z=10",
  edge: "zone=pale_hollow&x=20&z=-20",
};
const out = {};
for (const [k, q] of Object.entries(shots)) {
  const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 });
  p.on("pageerror", e => console.log("pageerror", e.message));
  await p.goto(`http://localhost:5174/?demo&t=2&${q}`);
  await p.waitForFunction(() => window.__stickReady, { timeout: 60000 }); await sleep(1500);
  if (k === "hub" || k === "crowd") {
    const ms = await p.evaluate(() => { const a = []; for (let i = 0; i < 25; i++) window.__drawMs(); for (let i = 0; i < 150; i++) a.push(window.__drawMs()); a.sort((x, y) => x - y); return [a[75], a[142]]; });
    out[k] = ms.map(v => v.toFixed(2));
  }
  await p.screenshot({ path: `/workspace/ba-research/polish/shots/${tag}-${k}.png` });
  await p.close();
}
console.log(tag, JSON.stringify(out));
await b.close();
