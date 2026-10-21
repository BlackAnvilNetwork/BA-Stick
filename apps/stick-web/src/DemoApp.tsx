import { useEffect, useRef } from "react";
import { createRenderer, fetchZone } from "./renderer";
import { demoUnits } from "./demo";

/**
 * Offline renderer demo (no server). `?demo&t=1.2` fast-forwards.
 * `?demo&zone=pale_hollow&x=0&z=30` places the demo cast in a baked zone at (x, z).
 */
export function DemoApp() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    let alive = true;
    const q = new URLSearchParams(location.search);
    const zone = q.get("zone");
    const ox = Number(q.get("x") ?? "0") || 0;
    const oz = Number(q.get("z") ?? "0") || 0;
    void Promise.all([createRenderer(ref.current!), zone ? fetchZone(zone) : null]).then(([r, bytes]) => {
      if (!alive) return;
      if (bytes) r.loadZone(bytes);
      r.setCamera(ox, oz);
      const t0 = Number(q.get("t") ?? "0") || 0;
      let t = 0;
      const step = (dt: number) => {
        t += dt;
        for (const u of demoUnits(t)) r.upsertUnit(u.id, u.x + ox, r.zoneHeight(u.x + ox, u.z + oz), u.z + oz, u.facing, u.anim, u.preset);
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
