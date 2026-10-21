import { useEffect, useRef } from "react";
import { playSteps, stepsFor } from "./vfx";
import { createRenderer, fetchProps, fetchZone, fromFramebuffer } from "./renderer";
import { crowdUnits, demoUnits, rosterUnits } from "./demo";

/**
 * Offline renderer demo (no server). `?demo&t=1.2` fast-forwards.
 * `?demo&zone=pale_hollow&x=0&z=30` places the demo cast in a baked zone at (x, z).
 * `?demo&crowd=200` adds a walking crowd (perf target, #19); `&view=3d` starts in 3D.
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
    void Promise.all([createRenderer(ref.current!), zone ? fetchZone(zone) : null, zone ? fetchProps(zone) : null]).then(([r, bytes, props]) => {
      if (!alive) return;
      if (bytes) r.loadZone(bytes);
      if (props) r.loadProps(props);
      r.setCamera(ox, oz);
      if (q.get("view") === "3d") r.setView3d(true);
      const crowd = crowdUnits(Math.max(0, Math.min(1000, Number(q.get("crowd") ?? "0") || 0)));
      const t0 = Number(q.get("t") ?? "0") || 0;
      let t = 0;
      const step = (dt: number) => {
        t += dt;
        for (const u of (q.has("roster") ? rosterUnits : demoUnits)(t)) r.upsertUnit(u.id, u.x + ox, r.zoneHeight(u.x + ox, u.z + oz), u.z + oz, u.facing, u.anim, u.preset);
        for (const u of crowd(t)) r.upsertUnit(u.id, u.x + ox, r.zoneHeight(u.x + ox, u.z + oz), u.z + oz, u.facing, u.anim, u.preset);
        if (q.has("roster")) {
          // Effect showcase: Cinder Burst telegraph (server MOB_CINDER_RADIUS = 5.2),
          // a selected hostile, HP bars, a level-up column and a shiny.
          const cyc = (t % 2.4) / 2.4;
          r.setFx("mob:shard_wight", 0.7, cyc, 5.2, 8, 1, -1);
          r.setFx("mob:seam_golem", 0.35, -1, 0, 1 | 8, 1, -1);
          r.setFx("mob:ashbeam_boar", 1, -1, 0, 4 | 8, 1, -1);
          r.setFx("mob:dust_hare", 0.9, -1, 0, 2 | 8, 1, -1);
          r.setFx("npc:guide", -1, -1, 0, 0, 1, (t % 2.4) / 2.4);
          // Floating numbers (#45): damage, crit, heal, miss, damage to self.
          const ft = Math.floor(t / 0.6), pt = Math.floor((t - dt) / 0.6);
          if (ft !== pt) {
            const k = ((ft % 5) + 5) % 5;
            const who = ["mob:dust_hare", "mob:ashbeam_boar", "npc:guide", "mob:pale_slime", "mob:seam_golem"][k]!;
            r.addFloater(who, [0, 3, 2, 4, 1][k]!, [7, 42, 15, 0, 12][k]!);
          }
          r.setFx("mob:pale_slime", -1, -1, 0, 8, Math.max(0, 1 - (t % 3) / 2.5), -1);
        }
        r.tick(dt);
      };
      for (let s = 0; s < t0 * 60; s++) step(1 / 60);
      let last = performance.now();
      const frame = (now: number) => {
        step(Math.max(0, Math.min(0.1, (now - last) / 1000)));
        last = now;
        r.draw();
        raf = requestAnimationFrame(frame);
      };
      r.draw();
      (window as unknown as { __drawMs: () => number }).__drawMs = () => {
        const a = performance.now();
        r.draw();
        return performance.now() - a;
      };
      (window as unknown as { __stickReady: boolean }).__stickReady = true;
      (window as unknown as { __stick: unknown }).__stick = { r, canvas: ref.current, fromFramebuffer, playAbility: (id: string, from: string, to?: string) => playSteps(r, stepsFor(id), from, to) };
      raf = requestAnimationFrame(frame);
    });
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, []);
  return <canvas ref={ref} className="stick-canvas" />;
}
