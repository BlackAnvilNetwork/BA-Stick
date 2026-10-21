import { useEffect, useRef } from "react";
import { createRenderer } from "./renderer";
import { demoUnits } from "./demo";

/** Offline renderer demo (no server). `?demo&t=1.2` fast-forwards. */
export function DemoApp() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    let alive = true;
    void createRenderer(ref.current!).then((r) => {
      if (!alive) return;
      const t0 = Number(new URLSearchParams(location.search).get("t") ?? "0") || 0;
      let t = 0;
      const step = (dt: number) => {
        t += dt;
        for (const u of demoUnits(t)) r.upsertUnit(u.id, u.x, 0, u.z, u.facing, u.anim, u.preset);
        r.tick(dt);
      };
      for (let s = 0; s < t0 * 60; s++) step(1 / 60);
      let last = performance.now();
      const frame = (now: number) => {
        step(Math.min(0.1, (now - last) / 1000));
        last = now;
        r.draw();
        raf = requestAnimationFrame(frame);
      };
      r.draw();
      (window as unknown as { __stickReady: boolean }).__stickReady = true;
      raf = requestAnimationFrame(frame);
    });
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, []);
  return <canvas ref={ref} className="stick-canvas" />;
}
