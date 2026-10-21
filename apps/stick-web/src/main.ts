import init, { StickRenderer } from "ba-stick-render";
import { demoUnits } from "./demo";

const W = 640;
const H = 360;

async function main() {
  await init();
  const canvas = document.getElementById("screen") as HTMLCanvasElement;
  const r = new StickRenderer(canvas, W, H);
  r.setCamera(0, 0);

  // `?t=1.5` fast-forwards the demo (deterministic screenshots).
  const t0 = Number(new URLSearchParams(location.search).get("t") ?? "0") || 0;
  let t = 0;
  const step = (dt: number) => {
    t += dt;
    for (const u of demoUnits(t)) r.upsertUnit(u.id, u.x, 0, u.z, u.facing, u.anim, u.preset);
    r.tick(dt);
  };
  for (let s = 0; s < t0 * 60; s++) step(1 / 60);

  canvas.addEventListener("pointerdown", (e) => {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / W, rect.height / H);
    const sx = (e.clientX - rect.left - (rect.width - W * scale) / 2) / scale;
    const sy = (e.clientY - rect.top - (rect.height - H * scale) / 2) / scale;
    const hit = r.pickUnit(sx, sy);
    const [x, z] = r.pickWorld(sx, sy);
    console.log("pick", hit ?? "ground", x.toFixed(2), z.toFixed(2));
  });

  let last = performance.now();
  const frame = (now: number) => {
    step(Math.min(0.1, (now - last) / 1000));
    last = now;
    r.draw();
    requestAnimationFrame(frame);
  };
  r.draw();
  (window as unknown as { __stickReady: boolean }).__stickReady = true;
  requestAnimationFrame(frame);
}

main().catch((e) => {
  console.error(e);
  document.body.insertAdjacentHTML("beforeend", `<pre style="color:#f66">${String(e)}</pre>`);
});
