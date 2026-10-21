import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: "new", args: ["--no-sandbox"] });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
for (const view of ["iso", "3d"]) {
  const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 });
  p.on("pageerror", e => console.log("pageerror", e.message));
  await p.goto(`http://localhost:5174/?demo&zone=pale_hollow&x=0&z=30&crowd=200&view=${view}`);
  await p.waitForFunction(() => window.__stickReady, { timeout: 60000 }); await sleep(2000);
  const r = await p.evaluate(() => new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 4000) requestAnimationFrame(f); else { const ms = []; for (let i = 0; i < 30; i++) ms.push(window.__drawMs()); ms.sort((a, b) => a - b); res({ fps: (n / 4).toFixed(1), drawP50: ms[15].toFixed(1), drawP95: ms[28].toFixed(1) }); } }; requestAnimationFrame(f); }));
  console.log(view, JSON.stringify(r));
  await p.screenshot({ path: `/workspace/ba-research/screens/m5-crowd-${view}.png` });
}
await b.close();
