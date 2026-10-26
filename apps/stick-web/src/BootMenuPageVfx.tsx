import { useEffect, useRef } from "react";
import { FORGE_BLOT, FORGE_VFX } from "./boot-menu-theme";

const W = 320;
const H = 180;

type Mote = { x: number; y: number; vx: number; vy: number; life: number; max: number; rgb: string; size: number };

function hash(n: number): number {
  const s = Math.sin(n * 12.9898) * 43758.547;
  return s - Math.floor(s);
}

/** Thin additive layer — spawns from WASM blot anchors, slow drift upward. */
export function BootMenuPageVfx() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    canvas.width = W;
    canvas.height = H;

    const motes: Mote[] = [];

    let alive = true;
    let raf = 0;
    let t = 0;

    const spawn = () => {
      const pick = hash(t * 19);
      const anchor =
        pick > 0.62
          ? FORGE_BLOT.portal
          : pick > 0.28
            ? FORGE_BLOT.leftArch
            : FORGE_BLOT.mesa;
      const spreadX = anchor === FORGE_BLOT.portal ? 0.22 : 0.12;
      const spreadY = anchor === FORGE_BLOT.mesa ? 0.08 : 0.18;
      motes.push({
        x: anchor.x * W + (hash(t * 23) - 0.5) * W * spreadX,
        y: anchor.y * H + (hash(t * 5) - 0.5) * H * spreadY,
        vx: (hash(t * 29) - 0.5) * 6,
        vy: anchor === FORGE_BLOT.mesa ? -4 - hash(t * 7) * 4 : 5 + hash(t * 31) * 8,
        life: 0,
        max: 2.4 + hash(t * 13) * 2.2,
        rgb: hash(t * 37) > 0.5 ? FORGE_VFX.moteBright : FORGE_VFX.moteDim,
        size: hash(t * 3) > 0.8 ? 2 : 1,
      });
    };

    let last = performance.now();
    const frame = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;

      ctx.clearRect(0, 0, W, H);

      if (motes.length < 36 && hash(t * 2.1) > 0.55) spawn();

      ctx.globalCompositeOperation = "lighter";
      for (let i = motes.length - 1; i >= 0; i--) {
        const m = motes[i];
        m.life += dt;
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        const a = 1 - m.life / m.max;
        if (a <= 0) {
          motes.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = a * 0.55;
        ctx.fillStyle = m.rgb;
        ctx.fillRect(Math.round(m.x), Math.round(m.y), m.size, m.size);
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className="boot-menu-page-vfx"
      width={W}
      height={H}
      aria-hidden
    />
  );
}
