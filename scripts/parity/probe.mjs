import { startStack } from "./stack.mjs";
import { GameClient } from "./client.mjs";
const s = await startStack({ log: console.log });
try {
  const a = new GameClient(s, s.keys[1], "A");
  await a.connect(); const ok = await a.login(); console.log("authok", JSON.stringify(ok.characterMint));
  await a.mintAndCreate("Parsa");
  const y = a.snapshot.you;
  console.log(Object.keys(a.snapshot)); console.log(Object.keys(y));
  console.log(JSON.stringify({inv:y.inventory, lok:y.lok, x:y.x,z:y.z}).slice(0,3000));
  console.log(JSON.stringify(a.snapshot.nodes ?? a.snapshot.gather ?? null).slice(0,1500));
  console.log(a.logs.slice(-10));
} catch (e) { console.error(e); console.log(require?.("fs")) } finally { console.log("log:", s.serverLog); s.stop(); process.exit(0); }
