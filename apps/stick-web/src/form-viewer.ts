import { loadRenderer } from "./renderer";

const canvas = document.querySelector<HTMLCanvasElement>("#view")!;
const yawEl = document.querySelector<HTMLInputElement>("#yaw")!;
const yawRead = document.querySelector("#yaw-read")!;
const walkBtn = document.querySelector<HTMLButtonElement>("#walk")!;
const restBtn = document.querySelector<HTMLButtonElement>("#rest")!;
const formBtns = [...document.querySelectorAll<HTMLButtonElement>("button[data-form]")];

let walk = false;
let rest = false;
let dragging = false;
let lastX = 0;
let preset = "druid:stickbear";

void loadRenderer().then(async () => {
  const { StickRenderer } = await import("ba-stick-render");
  const r = new StickRenderer(canvas, 120, 160);
  r.setBackdrop(true);
  r.setAtmosphere(false);
  r.setCamera(0, 0);

  let last = performance.now();
  let yaw = (Number(yawEl.value) * Math.PI) / 180;
  const frame = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    r.upsertUnit("p", 0, 0, 0, yaw, rest ? "rest" : walk ? "walk" : "idle", preset);
    r.tick(dt);
    r.draw();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  yawEl.addEventListener("input", () => {
    yawRead.textContent = `${yawEl.value}°`;
    yaw = (Number(yawEl.value) * Math.PI) / 180;
  });
  walkBtn.addEventListener("click", () => {
    walk = !walk;
    if (walk) rest = false;
    walkBtn.classList.toggle("on", walk);
    restBtn.classList.toggle("on", rest);
  });
  restBtn.addEventListener("click", () => {
    rest = !rest;
    if (rest) walk = false;
    restBtn.classList.toggle("on", rest);
    walkBtn.classList.toggle("on", walk);
  });
  for (const btn of formBtns) {
    btn.addEventListener("click", () => {
      preset = btn.dataset.form ?? preset;
      for (const b of formBtns) b.classList.toggle("on", b === btn);
    });
  }

  canvas.addEventListener("pointerdown", (e) => {
    dragging = true;
    lastX = e.clientX;
    canvas.classList.add("dragging");
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const deg = Number(yawEl.value) + (e.clientX - lastX) * 0.4;
    const wrapped = ((deg % 360) + 360) % 360;
    yawEl.value = String(Math.round(wrapped));
    yawEl.dispatchEvent(new Event("input"));
    lastX = e.clientX;
  });
  canvas.addEventListener("pointerup", () => {
    dragging = false;
    canvas.classList.remove("dragging");
  });
});
