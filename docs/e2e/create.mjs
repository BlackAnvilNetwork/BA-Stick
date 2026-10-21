export default async function (p) {
  await p.waitForSelector("form.boot-panel input[name=name]");
  await p.$eval("form.boot-panel input[name=name]", (el) => { el.value = ""; });
  await p.type("form.boot-panel input[name=name]", "Stick" + Math.floor(Math.random() * 900 + 100));
  const btns = await p.$$("form.boot-panel button[type=submit], form.boot-panel button:not([type])");
  console.log("buttons", btns.length);
  await btns[btns.length - 1].click();
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const ph = await p.evaluate(() => document.querySelector(".stick-canvas") ? "play" : "boot");
    if (ph === "play") { console.log("entered play after", i / 2, "s"); break; }
  }
  await new Promise((r) => setTimeout(r, 3000));
  console.log("LOGS", JSON.stringify(await p.evaluate(() => { const g = window.__useGame.getState(); return { phase: g.phase, logs: g.logs.slice(-8) }; })));
}
