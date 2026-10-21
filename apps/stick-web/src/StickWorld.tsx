import { useEffect, useRef } from "react";
import { onSend, send } from "@bellgrave/client-core/net";
import { VfxDirector, playSteps } from "./vfx";
import { gearArgs } from "./gear";
import { getItem } from "@bellgrave/items";
import { useGame } from "@bellgrave/client-core/state";
import { clampPaleHollow } from "@bellgrave/config";
import type { UnitSnapshot } from "@bellgrave/protocol";
import { NpcInteractMenu } from "@bellgrave/ui/NpcInteractMenu";
import { clearKeyboardMove, setKeyboardMoveKey, type MoveKeys } from "@bellgrave/ui/moveInput";
import { FB_H, FB_W, bakedZoneFor, createRenderer, fetchProps, fetchZone, fbScale, fromFramebuffer, toFramebuffer } from "./renderer";
import { staticAt } from "./statics";
import { CombatFloaters } from "./floaters";
import { GatherIcons, loadIconAtlas, type IconAtlas } from "./gather";
import { syncUnits } from "./units";
import { getMoveKeys, wasdTarget } from "./input";
import { atmosphereFor, isCoarsePointer } from "./mobile";
import { CastClock, sameId, unitFx } from "./fx";
import { routeUnitClick } from "./clicks";
import { Labels, labelFor } from "./labels";
import { AnimEdges } from "./sfx";
import { ZONE_FADE_MS, ZoneTracker } from "./zones";

/** Black fade-in after a zone change (#31). */
function fade(el: HTMLDivElement | null) {
  if (!el) return;
  el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ZONE_FADE_MS, easing: "ease-out" });
}
import { playEnemySwing, playJobSwing, playTemporalDistortion } from "@bellgrave/ui/combatSfx";

/** Seconds between WASD move sends (legacy client: 0.05). */
const WASD_INTERVAL = 0.05;

/**
 * The world canvas: baked zone (#7), snapshot units as stick figures (#8, #10),
 * click/WASD movement (#9), targeting + click routing (#35), effects (#12 bars,
 * #32 death/cast/level-up, #33 telegraphs) and world-anchored HTML (#27).
 */
export function StickWorld() {
  const ref = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  const npcOpen = useGame((s) => s.npcDialog?.npcId ?? null);

  useEffect(() => {
    const canvas = ref.current!;
    let raf = 0;
    let alive = true;
    const cleanups: Array<() => void> = [];
    void createRenderer(canvas).then((r) => {
      if (!alive) return;
      // Dev/test hook for headless checks (fb→client mapping lives in renderer.ts).
      if (import.meta.env.DEV) Object.assign(window, { __stick: { r, canvas, fromFramebuffer, send } });
      // Phones: atmosphere pass costs ~1/3 of the frame; drop it to hold 30+ fps (#18).
      if (!atmosphereFor(isCoarsePointer(), location.search)) r.setAtmosphere(false);
      let zoneLoaded: string | null = null;
      const zones = new ZoneTracker();
      let lastSnap: unknown = null;
      let followed: string | undefined;
      let hovered: string | null = null;
      const known = new Set<string>();
      const casts = new CastClock();
      const floats = new CombatFloaters();
      const vfx = new VfxDirector();
      cleanups.push(
        onSend((m) => {
          if (m.type !== "ability") return;
          const me = myUnit();
          const steps = me && vfx.request(m.id, m.targetId ?? me.targetId, Date.now());
          if (me && steps) playSteps(r, steps, me.id, m.targetId ?? me.targetId);
        }),
      );
      const icons = new GatherIcons(labelsRef.current!, `${import.meta.env.BASE_URL}zones/icons.png`);
      let atlas: IconAtlas | null = null;
      void loadIconAtlas(import.meta.env.BASE_URL).then((a) => (atlas = a));
      const edges = new AnimEdges();
      const labels = new Labels(labelsRef.current!);
      let wasdAccum = 0;
      let last = performance.now();

      const myUnit = () => {
        const g = useGame.getState();
        return g.wallet ? g.snapshot?.units.find((u) => sameId(u.id, g.wallet) && u.kind === "player") : undefined;
      };
      const pick = (sx: number, sy: number): [number, number] => {
        const p = r.pickWorld(sx, sy);
        return [p[0], p[1]];
      };
      const unitAt = (e: { clientX: number; clientY: number }): UnitSnapshot | undefined => {
        const [sx, sy] = toFramebuffer(canvas, e.clientX, e.clientY);
        const id = r.pickUnit(sx, sy, myUnit()?.id);
        return id ? useGame.getState().snapshot?.units.find((u) => u.id === id) : undefined;
      };

      const onPointer = (e: PointerEvent) => {
        if (e.button !== 0 && e.button !== 2) return;
        const g = useGame.getState();
        if (g.phase !== "play" || !myUnit()) return;
        const [sx, sy] = toFramebuffer(canvas, e.clientX, e.clientY);
        if (sx < 0 || sy < 0 || sx > FB_W || sy > FB_H) return;
        const hit = e.button === 0 ? unitAt(e) : undefined;
        if (hit && !sameId(hit.id, g.wallet)) {
          const res = routeUnitClick(hit, g.wallet);
          if (res.select !== undefined) g.setSelectedTarget(res.select);
          if (res.send) send(res.send);
          return;
        }
        if (e.button === 0) {
          const hitStatic = staticAt(zones.current, sx, sy, (x, y, z) => {
            const p = r.worldToScreen(x, y, z);
            return [p[0], p[1]];
          }, (x, z) => r.zoneHeight(x, z));
          if (hitStatic) {
            send(hitStatic.send);
            return;
          }
        }
        const [x, z] = pick(sx, sy);
        const c = clampPaleHollow(x, z);
        send({ type: "move", x: c.x, z: c.z });
      };
      const onMove = (e: PointerEvent) => {
        const u = unitAt(e);
        hovered = u && !sameId(u.id, useGame.getState().wallet) ? u.id : null;
        canvas.style.cursor = hovered ? "pointer" : "";
      };
      const onContext = (e: MouseEvent) => e.preventDefault();
      const isMoveKey = (k: string): k is keyof MoveKeys => k === "w" || k === "a" || k === "s" || k === "d";
      const typing = (e: KeyboardEvent) => {
        const t = e.target as HTMLElement | null;
        return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      };
      const down = (e: KeyboardEvent) => {
        const k = e.key.toLowerCase();
        if (isMoveKey(k) && !typing(e)) {
          setKeyboardMoveKey(k, true);
          e.preventDefault();
        }
      };
      const up = (e: KeyboardEvent) => {
        const k = e.key.toLowerCase();
        if (isMoveKey(k)) setKeyboardMoveKey(k, false);
      };
      canvas.addEventListener("pointerdown", onPointer);
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("contextmenu", onContext);
      window.addEventListener("keydown", down);
      window.addEventListener("keyup", up);
      window.addEventListener("blur", clearKeyboardMove);
      cleanups.push(() => {
        canvas.removeEventListener("pointerdown", onPointer);
        canvas.removeEventListener("pointermove", onMove);
        canvas.removeEventListener("contextmenu", onContext);
        window.removeEventListener("keydown", down);
        window.removeEventListener("keyup", up);
        window.removeEventListener("blur", clearKeyboardMove);
        clearKeyboardMove();
        labels.clear();
        icons.clear();
      });

      const frame = (now: number) => {
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        const g = useGame.getState();
        const snap = g.snapshot;
        const zid = snap?.you.zoneId ?? null;
        const zc = zones.update(zid);
        if (zc.changed && zid) {
          const first = zc.first;
          // Zone change: drop every unit from the old zone, fade, load terrain.
          for (const id of known) r.removeUnit(id);
          known.clear();
          lastSnap = null;
          floats.reset();
          if (!first) fade(fadeRef.current);
          const want = bakedZoneFor(zid);
          if (want !== zoneLoaded) {
            zoneLoaded = want;
            if (!want) r.clearZone();
            else
              void Promise.all([fetchZone(want), fetchProps(want)]).then(([b, p]) => {
                if (!alive || zoneLoaded !== want) return;
                r.loadZone(b);
                if (p) r.loadProps(p);
              });
          }
        }
        if (snap && snap !== lastSnap) {
          lastSnap = snap;
          syncUnits(r, snap.units, known, Date.now());
          const me = myUnit();
          if (me) r.setGear(me.id, ...gearArgs(snap.you.equip, getItem));
          casts.forget(known);
          for (const fx of vfx.scan(snap.units, myUnit()?.id, Date.now())) if (known.has(fx.from)) playSteps(r, fx.steps, fx.from, fx.to);
          for (const ev of floats.scan(snap.units, myUnit(), snap.log ?? [], Date.now())) if (known.has(ev.id)) r.addFloater(ev.id, ev.kind, ev.value);
          const me0 = myUnit();
          for (const ev of edges.scan(snap.units, me0, Date.now())) {
            if (ev.kind === "enemySwing") playEnemySwing(ev.volume);
            else if (ev.kind === "jobSwing") playJobSwing(ev.job, ev.volume);
            else playTemporalDistortion(ev.until);
          }
        }
        const me = myUnit();
        if (me?.id !== followed) {
          followed = me?.id;
          r.follow(followed);
        }
        wasdAccum += dt;
        if (me && wasdAccum >= WASD_INTERVAL) {
          wasdAccum = 0;
          const t = wasdTarget(getMoveKeys(), me, pick, [FB_W / 2, FB_H / 2]);
          if (t) send({ type: "move", x: t.x, z: t.z });
        }
        r.tick(dt);
        // Effects + labels
        const wall = Date.now();
        const ctxBase = { now: wall, wallet: g.wallet ?? null, selected: g.selectedTarget, hovered };
        const shown = new Map<string, { text: string; cls: string; x: number; y: number }>();
        for (const u of snap?.units ?? []) {
          if (!known.has(u.id)) continue;
          const fx = unitFx(u, { ...ctxBase, cast: casts.progress(u, wall) });
          r.setFx(u.id, fx.hp, fx.cast, fx.aoe, fx.flags, fx.fade, fx.levelUp);
          const label = labelFor(u, ctxBase);
          if (label && fx.fade > 0.3) {
            const a = r.anchor(u.id);
            if (a.length === 3) {
              const [cx, cy] = fromFramebuffer(canvas, a[0], a[1]);
              shown.set(u.id, { ...label, x: cx, y: cy });
            }
          }
        }
        labels.update(shown);
        // Yield icons over gather nodes (#30)
        const gi = new Map<string, { slug?: string; x: number; y: number; scale: number; ready: boolean }>();
        const scale = fbScale(canvas);
        for (const u of snap?.units ?? []) {
          if (!u.gatherNode || !known.has(u.id)) continue;
          const a = r.anchor(u.id);
          if (a.length !== 3) continue;
          const [cx, cy] = fromFramebuffer(canvas, a[0], a[1]);
          gi.set(u.id, { slug: u.gatherYield, x: cx, y: cy, scale, ready: u.hp > 0 });
        }
        icons.update(atlas, gi, wall / 1000);
        // NPC menu anchored under the NPC's feet (#27)
        const npcId = g.npcDialog?.npcId;
        const menu = menuRef.current;
        if (menu && npcId) {
          const a = r.anchor(npcId);
          if (a.length === 3) {
            const [cx, cy] = fromFramebuffer(canvas, a[0], a[2]);
            menu.style.transform = `translate(${Math.round(cx)}px, ${Math.round(cy) + 6}px) translate(-50%, 0)`;
            menu.style.visibility = "visible";
          } else menu.style.visibility = "hidden";
        }
        r.draw();
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    });
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      for (const c of cleanups) c();
    };
  }, []);

  return (
    <>
      <canvas ref={ref} className="stick-canvas" />
      <div ref={labelsRef} className="stick-labels" aria-hidden />
      <div ref={fadeRef} className="stick-fade" aria-hidden />
      {npcOpen && (
        <div ref={menuRef} className="stick-npc-menu" style={{ visibility: "hidden" }}>
          <NpcInteractMenu />
        </div>
      )}
    </>
  );
}
