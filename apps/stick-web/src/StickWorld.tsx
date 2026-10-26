import { useEffect, useRef } from "react";
import { onSend, send } from "@bellgrave/client-core/net";
import { VfxDirector, playSteps } from "./vfx";
import { gearArgs } from "./gear";
import { getItem } from "@bellgrave/items";
import { useGame } from "@bellgrave/client-core/state";
import { clampPaleHollow, fieldById, fieldClampMove, paleHollowClampMove, PH_WEATHER_KIND_ID, zoneOrigin } from "@bellgrave/config";
import type { UnitSnapshot } from "@bellgrave/protocol";
import { NpcInteractMenu } from "@bellgrave/ui/NpcInteractMenu";
import { clearKeyboardMove, setKeyboardMoveKey } from "@bellgrave/ui/moveInput";
import { FB_H, FB_W, bakedZoneFor, createRenderer, fetchProps, fetchZone, fbScale, fromFramebuffer, placeAllZones, toFramebuffer } from "./renderer";
import { staticAt } from "./statics";
import { CombatFloaters } from "./floaters";
import { GatherIcons, loadIconAtlas, type IconAtlas } from "./gather";
import { craftActFor, gatherActFor, presentCraft, presentGather, syncUnits, type CraftAct, type GatherAct } from "./units";
import { engageHeadingGoal, getMoveKeys, headingEase, headingStep, headingTarget, headingToward, moveKeyFromCode, shouldResend, wasdTarget } from "./input";
import { atmosphereFor, isCoarsePointer, keylightFor } from "./mobile";
import { CastClock, sameId, unitFx } from "./fx";
import { routeUnitClick } from "./clicks";
import { Labels, labelFor } from "./labels";
import { AnimEdges } from "./sfx";
import { ZONE_FADE_MS, ZoneTracker } from "./zones";
import { ResonanceClock, buffVfx, statusIcons } from "./buffs";
import { STATUS_ICON_FB, StatusColumns } from "./statusColumn";
import { applyMapData } from "./minimap";
import type { StickRenderer } from "ba-stick-render";
import { camModeFromDataset, cameraKey, lookAxes, type LookHeld } from "./camera";
import { cycleView, toggleCamControl } from "@bellgrave/ui/uiSettings";

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
  const mapBtn = useRef<HTMLButtonElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  const npcOpen = useGame((s) => s.npcDialog?.npcId ?? null);

  useEffect(() => {
    const canvas = ref.current!;
    let raf = 0;
    let alive = true;
    let renderer: StickRenderer | null = null;
    const cleanups: Array<() => void> = [];
    void createRenderer(canvas).then((r) => {
      if (!alive) {
        r.free();
        return;
      }
      renderer = r;
      // Dev/test hook for headless checks (fb→client mapping lives in renderer.ts).
      if (import.meta.env.DEV) Object.assign(window, { __stick: { r, canvas, fromFramebuffer, send } });
      void placeAllZones(r);
      // Phones: atmosphere pass costs ~1/3 of the frame; drop it to hold 30+ fps (#18).
      if (!atmosphereFor(isCoarsePointer(), location.search)) r.setAtmosphere(false);
      // L2 key light: on by default on desktop, off on touch; `?keylight=0` kills it.
      r.setKeylight(keylightFor(isCoarsePointer(), location.search));
      // Iso / 3D camera follows the View setting (#19); the engine eases the blend.
      const root = document.documentElement;
      const syncView = () => {
        r.setCamMode(camModeFromDataset(root.dataset.uiView));
        const mapOn = root.dataset.uiMinimap !== "off";
        r.setMinimap(mapOn); // M key / Settings (persisted)
        if (!mapOn) r.setMinimapFull(false);
      };
      syncView();
      const viewObs = new MutationObserver(syncView);
      viewObs.observe(root, { attributes: true, attributeFilter: ["data-ui-view", "data-ui-minimap"] });
      cleanups.push(() => viewObs.disconnect());
      let zoneLoaded: string | null = null;
      let zoneRetryAt = 0;
      const loadTerrain = (want: string) => {
        void Promise.all([fetchZone(want), fetchProps(want)])
          .then(([b, p]) => {
            if (!alive || zoneLoaded !== want) return;
            r.loadZone(b);
            if (p) r.loadProps(p);
            applyMapData(r, want);
          })
          .catch((err: unknown) => {
            // Was an unhandled rejection: the zone stayed flat until a reload.
            if (!alive || zoneLoaded !== want) return;
            console.warn("zone load failed, retrying in 2 s", err);
            zoneRetryAt = performance.now() + 2000;
          });
      };
      const zones = new ZoneTracker();
      const origin = { x: 0, z: 0 };
      let activeZone = "pale_hollow";
      let lastSnap: unknown = null;
      let lastGearKey = "";
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
      const resonance = new ResonanceClock();
      const statusCols = new StatusColumns(labelsRef.current!);
      let wasdAccum = 0;
      // Third/first person: client-side WASD heading (A/D turn, W/S walk it).
      // Iso keeps screen-relative WASD and never sets it.
      let heading: number | null = null;
      let headingGoal: number | null = null;
      let lastWasd: { keys: string; heading: number; at: number; x: number; z: number } | null = null;
      const view3d = () => camModeFromDataset(root.dataset.uiView) !== "iso";
      let last = performance.now();

      const myUnit = () => {
        const g = useGame.getState();
        return g.wallet ? g.snapshot?.units.find((u) => sameId(u.id, g.wallet) && u.kind === "player") : undefined;
      };
      const pick = (sx: number, sy: number): [number, number] => {
        const p = r.pickWorld(sx, sy);
        return [p[0] - origin.x, p[1] - origin.z];
      };
      /** Ground under a pixel, or null when a 3D pick hits the sky. */
      const pickHit = (sx: number, sy: number): [number, number] | null => {
        const p = r.pickGround(sx, sy);
        return p.length < 2 ? null : [p[0] - origin.x, p[1] - origin.z];
      };
      /** Click-to-move. In 3D the heading turns toward the click. */
      const moveTo = (sx: number, sy: number) => {
        const hit = pickHit(sx, sy);
        if (!hit) return;
        const c = clampHere(hit[0], hit[1]);
        const me = myUnit();
        if (heading !== null && me) headingGoal = headingToward(me, c.x, c.z);
        lastWasd = null;
        send({ type: "move", x: c.x, z: c.z });
      };
      const clampHere = (x: number, z: number) => {
        const field = fieldById(activeZone);
        return field ? field.clamp(x, z) : clampPaleHollow(x, z);
      };
      const unitAt = (e: { clientX: number; clientY: number }): UnitSnapshot | undefined => {
        const [sx, sy] = toFramebuffer(canvas, e.clientX, e.clientY);
        const id = r.pickUnit(sx, sy, myUnit()?.id);
        return id ? useGame.getState().snapshot?.units.find((u) => u.id === id) : undefined;
      };

      const look: LookHeld = { left: false, right: false, up: false, down: false };
      let gatherAct: GatherAct | null = null;
      let craftAct: CraftAct | null = null;
      const onCraftAct = (ev: Event) => {
        const skill = (ev as CustomEvent<{ skill?: string }>).detail?.skill;
        craftAct = craftActFor(skill, Date.now());
      };
      window.addEventListener("bellgrave:craft-act", onCraftAct);
      let drag: { x: number; y: number; turned: boolean; sx: number; sy: number } | null = null;
      const mouseLook = () => document.documentElement.dataset.uiCam === "mouse" && document.documentElement.dataset.uiView !== "iso";
      const onPointer = (e: PointerEvent) => {
        if (e.button !== 0 && e.button !== 2) return;
        const g = useGame.getState();
        if (g.phase !== "play" || !myUnit()) return;
        const [sx, sy] = toFramebuffer(canvas, e.clientX, e.clientY);
        if (sx < 0 || sy < 0 || sx >= FB_W || sy >= FB_H) return; // FB_W/FB_H are one past the last pixel
        if (e.button === 0 && r.minimapButton(sx, sy)) {
          r.setMinimapFull(!r.minimapFull());
          return;
        }
        if (r.minimapPanel(sx, sy)) return;
        // Right-drag looks around in mouse mode. A click without a drag still moves.
        if (e.button === 2 && mouseLook()) {
          drag = { x: e.clientX, y: e.clientY, turned: false, sx, sy };
          return;
        }
        const hit = e.button === 0 ? unitAt(e) : undefined;
        if (hit && !sameId(hit.id, g.wallet)) {
          const res = routeUnitClick(hit, g.wallet);
          if (res.select !== undefined) g.setSelectedTarget(res.select);
          if (res.send?.type === "gather") gatherAct = gatherActFor(hit, Date.now());
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
        moveTo(sx, sy);
      };
      const onMove = (e: PointerEvent) => {
        if (drag && (e.buttons & 2)) {
          const dx = e.clientX - drag.x;
          const dy = e.clientY - drag.y;
          if (drag.turned || Math.abs(dx) + Math.abs(dy) > 3) {
            const scale = fbScale(canvas) || 1;
            r.addLook(dx / scale, dy / scale);
            drag.x = e.clientX;
            drag.y = e.clientY;
            drag.turned = true;
          }
          return;
        }
        const [sx, sy] = toFramebuffer(canvas, e.clientX, e.clientY);
        if (r.minimapButton(sx, sy)) {
          hovered = null;
          canvas.style.cursor = "pointer";
          return;
        }
        const u = unitAt(e);
        hovered = u && !sameId(u.id, useGame.getState().wallet) ? u.id : null;
        canvas.style.cursor = hovered ? "pointer" : "";
      };
      const onPointerUp = (e: PointerEvent) => {
        if (e.button !== 2 || !drag) return;
        const pending = drag;
        drag = null;
        if (pending.turned) return;
        moveTo(pending.sx, pending.sy);
      };
      const onContext = (e: MouseEvent) => e.preventDefault();
      const typing = (e: KeyboardEvent) => {
        const t = e.target as HTMLElement | null;
        return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      };
      const down = (e: KeyboardEvent) => {
        const move = moveKeyFromCode(e.code);
        if (move && !typing(e)) {
          setKeyboardMoveKey(move, true);
          e.preventDefault();
        }
        if (typing(e) || e.repeat) return;
        if (followed) {
          if (e.code === "Semicolon") {
            r.cycleHairStyle(1);
            e.preventDefault();
            return;
          }
          if (e.code === "Quote") {
            r.cycleHairColor(1);
            e.preventDefault();
            return;
          }
          if (e.code === "KeyL") {
            r.cycleBodyColor(1);
            e.preventDefault();
            return;
          }
        }
        if (e.key === "Escape" && r.minimapFull()) {
          r.setMinimapFull(false);
          e.preventDefault();
          e.stopImmediatePropagation();
          return;
        }
        const cam = cameraKey(e.code);
        if (cam === "cycle") cycleView();
        else if (cam === "toggle") toggleCamControl();
        else if (cam === "left") look.left = true;
        else if (cam === "right") look.right = true;
        else if (cam === "up") look.up = true;
        else if (cam === "down") look.down = true;
      };
      const up = (e: KeyboardEvent) => {
        const move = moveKeyFromCode(e.code);
        if (move) setKeyboardMoveKey(move, false);
        const cam = cameraKey(e.code);
        if (cam === "left") look.left = false;
        else if (cam === "right") look.right = false;
        else if (cam === "up") look.up = false;
        else if (cam === "down") look.down = false;
      };
      const onMapBtn = (e: PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        r.setMinimapFull(!r.minimapFull());
      };
      mapBtn.current?.addEventListener("pointerdown", onMapBtn);
      canvas.addEventListener("pointerdown", onPointer);
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("contextmenu", onContext);
      window.addEventListener("keydown", down, true);
      window.addEventListener("keyup", up, true);
      window.addEventListener("pointerup", onPointerUp);
      const onBlur = () => {
        clearKeyboardMove();
        look.left = false;
        look.right = false;
        look.up = false;
        look.down = false;
        drag = null;
      };
      window.addEventListener("blur", onBlur);
      cleanups.push(() => {
        mapBtn.current?.removeEventListener("pointerdown", onMapBtn);
        canvas.removeEventListener("pointerdown", onPointer);
        canvas.removeEventListener("pointermove", onMove);
        canvas.removeEventListener("contextmenu", onContext);
        window.removeEventListener("keydown", down, true);
        window.removeEventListener("keyup", up, true);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("blur", onBlur);
        window.removeEventListener("bellgrave:craft-act", onCraftAct);
        clearKeyboardMove();
        labels.clear();
        icons.clear();
        statusCols.clear();
      });

      const frame = (now: number) => {
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        const g = useGame.getState();
        const snap = g.snapshot;
        const zid = snap?.you.zoneId ?? null;
        if (zid) {
          const o = zoneOrigin(zid);
          origin.x = o.x;
          origin.z = o.z;
          activeZone = zid;
        }
        const zc = zones.update(zid);
        if (zc.changed && zid) {
          r.setMapOrigin(origin.x, origin.z);
          // Keep every zone's terrain. Drop figures so a hand-off snaps
          // instead of sliding across the gap between zones.
          for (const id of known) r.removeUnit(id);
          known.clear();
          lastSnap = null;
          lastGearKey = "";
          followed = undefined;
          floats.reset();
          if (!zc.first) fade(fadeRef.current);
          const want = bakedZoneFor(zid);
          if (want !== zoneLoaded) {
            zoneLoaded = want;
            zoneRetryAt = 0;
            if (!want) r.clearZone();
            else loadTerrain(want);
          }
        } else if (zoneRetryAt > 0 && now >= zoneRetryAt && zoneLoaded) {
          // A failed terrain fetch retries without touching units.
          zoneRetryAt = 0;
          loadTerrain(zoneLoaded);
        }
        if (snap && snap !== lastSnap) {
          lastSnap = snap;
          const nowMs = Date.now();
          const wallet = g.wallet;
          const units = snap.units.map((u) => {
            if (!wallet || !sameId(u.id, wallet) || u.kind !== "player") return u;
            let unit = u;
            const gNext = presentGather(unit, gatherAct, nowMs);
            gatherAct = gNext.act;
            unit = gNext.unit;
            const cNext = presentCraft(unit, craftAct, nowMs);
            craftAct = cNext.act;
            return cNext.unit;
          });
          syncUnits(
            {
              upsertUnit: (id, x, y, z, facing, anim, preset) => r.upsertUnit(id, x + origin.x, y, z + origin.z, facing, anim, preset),
              removeUnit: (id) => r.removeUnit(id),
            },
            units,
            known,
            nowMs,
          );
          casts.forget(known);
          for (const fx of vfx.scan(snap.units, myUnit()?.id, Date.now())) if (known.has(fx.from)) playSteps(r, fx.steps, fx.from, fx.to);
          resonance.forget(known);
          for (const ev of floats.scan(snap.units, myUnit(), snap.log ?? [], Date.now())) if (known.has(ev.id)) r.addFloater(ev.id, ev.kind, ev.value);
          const me0 = myUnit();
          for (const ev of edges.scan(snap.units, me0, Date.now())) {
            if (ev.kind === "enemySwing") playEnemySwing(ev.volume);
            else if (ev.kind === "jobSwing") playJobSwing(ev.job, ev.volume);
            else playTemporalDistortion(ev.until);
          }
        }
        const me = myUnit();
        if (me && snap?.you) {
          const g = gearArgs(snap.you.equip, getItem);
          const gearKey = g.join(",");
          if (gearKey !== lastGearKey) {
            lastGearKey = gearKey;
            r.setGear(me.id, ...g);
          }
        }
        if (me?.id !== followed) {
          followed = me?.id;
          r.follow(followed);
        }
        const axes = lookAxes(look, document.documentElement.dataset.uiCam, document.documentElement.dataset.uiView);
        r.setLook(axes.yaw, axes.pitch);
        const keys = getMoveKeys();
        if (!view3d()) {
          if (heading !== null) {
            heading = null;
            headingGoal = null;
            lastWasd = null;
            r.setHeading(undefined);
          }
        } else if (me) {
          heading = heading ?? me.facing;
          if (keys.a || keys.d || keys.w || keys.s) headingGoal = null;
          // Engaged / auto-attacking: turn smoothly toward the server facing
          // (which already points at the target, as in iso).
          headingGoal = engageHeadingGoal(me, keys) ?? headingGoal;
          if (headingGoal !== null) {
            const e = headingEase(heading, headingGoal, dt);
            heading = e.heading;
            if (e.done) headingGoal = null;
          }
          heading = headingStep(keys, heading, dt);
          r.setHeading(heading);
        }
        wasdAccum += dt;
        if (me && wasdAccum >= WASD_INTERVAL) {
          wasdAccum = 0;
          const moveClamp = (ax: number, az: number, bx: number, bz: number) => fieldClampMove(activeZone, ax, az, bx, bz) ?? paleHollowClampMove(ax, az, bx, bz);
          if (heading === null) {
            const t = wasdTarget(keys, me, pick, [FB_W / 2, FB_H / 2], moveClamp);
            if (t) send({ type: "move", x: t.x, z: t.z });
          } else {
            const keyStr = `${keys.w ? "w" : ""}${keys.s ? "s" : ""}`;
            const t = headingTarget(keys, me, heading, moveClamp);
            const at = performance.now();
            if (t && shouldResend(lastWasd, { keys: keyStr, heading, at }, me)) {
              send({ type: "move", x: t.x, z: t.z });
              lastWasd = { keys: keyStr, heading, at, x: t.x, z: t.z };
            } else if (!t && lastWasd) {
              // W/S released: stop where we are instead of finishing the step.
              send({ type: "move", x: me.x, z: me.z });
              lastWasd = null;
            }
          }
        }
        if (activeZone === "pale_hollow" && snap?.weather) {
          r.setWeather(PH_WEATHER_KIND_ID[snap.weather.kind], snap.weather.snowCover);
        } else {
          r.setWeather(0, 0);
        }
        r.tick(dt);
        // Effects + labels
        const wall = Date.now();
        const ctxBase = {
          now: wall,
          wallet: g.wallet ?? null,
          selected: g.selectedTarget,
          hovered,
          combatTargetId: me?.targetId ?? null,
        };
        const shown = new Map<string, { text: string; cls: string; x: number; y: number }>();
        for (const u of snap?.units ?? []) {
          if (!known.has(u.id)) continue;
          const fx = unitFx(u, { ...ctxBase, cast: casts.progress(u, wall) });
          r.setFx(u.id, fx.hp, fx.cast, fx.aoe, fx.flags, fx.fade, fx.levelUp, fx.weaponEdge);
          const bv = buffVfx(u, wall, resonance);
          r.setBuffs(u.id, bv.mask, bv.td, bv.burst);
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
        // Status icon column beside the torso (#34, old UnitStatusIcons)
        const sc = new Map<string, { icons: ReturnType<typeof statusIcons>; x: number; y: number; scale: number }>();
        const pxScale = fbScale(canvas);
        for (const u of snap?.units ?? []) {
          if (!known.has(u.id)) continue;
          const ic = statusIcons(u, wall);
          if (ic.length === 0) continue;
          const a = r.anchor(u.id);
          if (a.length !== 3) continue;
          const [cx, cy] = fromFramebuffer(canvas, a[0] + (u.kind === "mob" ? 12 : 10), a[1] + (a[2] - a[1]) * 0.15);
          sc.set(u.id, { icons: ic.slice(0, 6), x: cx, y: cy, scale: pxScale });
        }
        statusCols.update(sc);
        // Yield icons over gather nodes (#30)
        const gi = new Map<string, { slug?: string; x: number; y: number; scale: number; ready: boolean }>();
        const scale = pxScale;
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
        const mapButton = mapBtn.current;
        if (mapButton) {
          const shown = document.documentElement.dataset.uiMinimap !== "off";
          if (!shown) mapButton.style.visibility = "hidden";
          else {
            const full = r.minimapFull();
            const ox = full ? 6 : FB_W - 148 - 6;
            const oy = 6;
            const [x0, y0] = fromFramebuffer(canvas, ox + 2, oy + 1);
            const [x2, y2] = fromFramebuffer(canvas, ox + 12, oy + 10);
            let x = x0;
            let y = y0;
            // The expanded map's corner sits under the character panel. Keep the
            // shrink control on the map's top edge, just past that panel.
            if (full) {
              const dock = document.querySelector(".hud-vitals-dock");
              if (dock) {
                const dockR = dock.getBoundingClientRect();
                const canvasR = canvas.getBoundingClientRect();
                x = dockR.right - canvasR.left + 8;
                y = dockR.top - canvasR.top;
              }
            }
            mapButton.style.visibility = "visible";
            mapButton.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
            mapButton.style.width = `${Math.max(26, Math.round(x2 - x0))}px`;
            mapButton.style.height = `${Math.max(26, Math.round(y2 - y0))}px`;
            const flag = full ? "1" : "0";
            if (mapButton.dataset.full !== flag) {
              mapButton.dataset.full = flag;
              mapButton.setAttribute("aria-label", full ? "Shrink map" : "Expand map");
            }
          }
        }
        r.draw();
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    });
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      renderer?.free();
      renderer = null;
      for (const c of cleanups) c();
    };
  }, []);

  return (
    <>
      <canvas ref={ref} className="stick-canvas" />
      <button ref={mapBtn} type="button" className="stick-map-full" aria-label="Expand map">
        <span className="map-full-mark" />
      </button>
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
