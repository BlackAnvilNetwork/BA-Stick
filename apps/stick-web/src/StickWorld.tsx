import { useEffect, useRef } from "react";
import { onSend, send } from "@bellgrave/client-core/net";
import { VfxDirector, playSteps, stepsFor } from "./vfx";
import { gearArgs } from "./gear";
import { getItem } from "@bellgrave/items";
import { useGame } from "@bellgrave/client-core/state";
import { DASH_COOLDOWN_MS, DASH_DISTANCE, dashDurationMs, fieldById, fieldClampMove, fieldGateAt, fieldStandHeight, PALE_HOLLOW_BOUNDS, paleHollowClampMove, paleHollowStandHeight, PH_WEATHER_KIND_ID, paleHollowDayPhaseAt, planDash, PLAYER_SPEED, zoneMoveMul, zoneOrigin, zoneUsesDayClock } from "@bellgrave/config";
import type { UnitSnapshot } from "@bellgrave/protocol";
import { NpcInteractMenu } from "@bellgrave/ui/NpcInteractMenu";
import { clearKeyboardMove, clearVirtualStick, setKeyboardMoveKey } from "@bellgrave/ui/moveInput";
import { FB_H, FB_W, bakedZoneFor, createRenderer, fbScale, fetchProps, fetchWaterLayout, fetchZone, fromFramebuffer, fromFramebufferFit, placeAllZones, readCanvasFit, toFramebuffer, toFramebufferFit } from "./renderer";
import { fitScale } from "./fit";
import { staticAt } from "./statics";
import { CombatFloaters } from "./floaters";
import { GatherIcons, loadIconAtlas, type IconAtlas } from "./gather";
import { animFor, craftActFor, gatherActFor, presetFor, presentCraft, presentGather, syncUnits, type CraftAct, type GatherAct } from "./units";
import { arcadeBlocksGroundClick } from "./arcadeHit";
import { analogScreenTarget, blendToward, engageHeadingGoal, getKeyboardMoveKeys, getMoveKeys, getStickAxes, headingEase, headingStep, headingTarget, headingToward, isoScreenPick, moveKeyFromCode, playOverlayBlocksDash, shouldResend, stopTarget, wasdTarget, virtualStickHeld, virtualStickReleasedRecently, WASD_STEP, DASH_KEY_CODE, DASH_PRED_HOLD, DashClock, dashDirection, STOP_LEAD } from "./input";
import { atmosphereFor, isCoarsePointer, keylightFor } from "./mobile";
import { applyWorldLighting, applyZoneMood, lightsFor } from "./lighting";
import { applyWorldAtmosphere } from "./atmosphere";
import { CastClock, sameId, unitFx } from "./fx";
import { routeUnitClick } from "./clicks";
import { Labels, labelFor } from "./labels";
import { AnimEdges } from "./sfx";
import { ZONE_FADE_MS, ZoneTracker } from "./zones";
import { ResonanceClock, buffVfx, statusIcons } from "./buffs";
import { StatusColumns } from "./statusColumn";
import { applyMapData, blitMinimapToWell, clampMinimapDock, DOCK_REMEASURE_FRAMES, minimapBlitKey, minimapDockClientRect, minimapEngineDock, shouldBlitMinimap, shouldDrawHudMinimap, shouldRemeasureMinimapDock, sameMinimapDock, type MinimapBlitKey } from "./minimap";
import type { StickRenderer } from "ba-stick-render";
import { camModeFromDataset, cameraKey, lookAxes, type LookHeld } from "./camera";
import { cycleView, toggleCamControl, vistaReach } from "@bellgrave/ui/uiSettings";

/** Black fade-in after a zone change (#31). */
function fade(el: HTMLDivElement | null) {
  if (!el) return;
  el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ZONE_FADE_MS, easing: "ease-out" });
}
import { playEnemySwing, playJobSwing, playQuestAccept, playQuestComplete, playTemporalDistortion } from "@bellgrave/ui/combatSfx";

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
      // Lighting overhaul: moods, mood areas and map lights once the terrain is placed.
      void placeAllZones(r).then(() => {
        if (!alive) return;
        const zoneId = useGame.getState().snapshot?.you.zoneId;
        applyWorldLighting(r, zoneId);
        applyWorldAtmosphere(r, zoneId);
      });
      r.setLights(lightsFor(location.search));
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
        const draw = Number(root.dataset.uiDrawDistance);
        r.setDrawDistance(Number.isFinite(draw) ? draw : 0.55);
        const atmo = Number(root.dataset.uiAtmosphere);
        r.setAtmosphereAmount(Number.isFinite(atmo) ? atmo : 0.45);
      };
      syncView();
      const viewObs = new MutationObserver(syncView);
      viewObs.observe(root, { attributes: true, attributeFilter: ["data-ui-view", "data-ui-minimap", "data-ui-draw-distance", "data-ui-atmosphere"] });
      cleanups.push(() => viewObs.disconnect());
      let zoneLoaded: string | null = null;
      let zoneRetryAt = 0;
      let lastMapLabels: boolean | null = null;
      const origin = { x: 0, z: 0 };
      const loadTerrain = (want: string) => {
        void Promise.all([fetchZone(want), fetchProps(want), fetchWaterLayout(want)])
          .then(([b, p, wfl]) => {
            if (!alive || zoneLoaded !== want) return;
            r.placeZone(b, origin.x, origin.z);
            if (p) r.placeProps(p, origin.x, origin.z);
            if (wfl) r.setWaterLayout(wfl, origin.x, origin.z);
            applyMapData(r, want, { labels: r.minimapFull() });
            lastMapLabels = r.minimapFull();
          })
          .catch((err: unknown) => {
            // Was an unhandled rejection: the zone stayed flat until a reload.
            if (!alive || zoneLoaded !== want) return;
            console.warn("zone load failed, retrying in 2 s", err);
            zoneRetryAt = performance.now() + 2000;
          });
      };
      const zones = new ZoneTracker();
      let activeZone = "pale_hollow";
      let lastSnap: unknown = null;
      const lastGearById = new Map<string, string>();
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
      let lastWasd: { keys: string; heading: number; at: number; x: number; z: number; full?: boolean } | null = null;
      let seenAnim: string | null = null;
      const view3d = () => camModeFromDataset(root.dataset.uiView) !== "iso";
      // One yaw for walking AND dashing. First person moves along the look (cam yaw includes
      // the look bias); third person along the client heading. Uses camModeFromDataset so a
      // legacy "first" setting is first person here too, as it is for the camera.
      const moveYaw = (): number =>
        camModeFromDataset(root.dataset.uiView) === "fp" ? r.camYaw() : (heading ?? 0);
      // General dash (every class): predicted here, validated by the server.
      const dashClock = new DashClock(DASH_COOLDOWN_MS);
      let localDash: { x: number; z: number; until: number } | null = null;
      let walkAhead: { x: number; z: number } | null = null;
      let clickHoldKeys: string | null = null;
      let lastHudGroundAt = 0;
      const dashPredStarted = new Set<string>();
      let cursorFb: [number, number] | null = null;
      let minimapWell: HTMLElement | null = null;
      let minimapLogFrame: HTMLElement | null = null;
      let lastWellDock: [number, number, number, number] | null = null;
      let lastBlitKey: MinimapBlitKey | null = null;
      let lastMapPane = false;
      let lastDrawMode: ReturnType<typeof shouldDrawHudMinimap> | null = null;
      let dockAge = DOCK_REMEASURE_FRAMES;
      let hudMinimapCanvas: HTMLCanvasElement | null = null;
      const clampMoveHere = (ax: number, az: number, bx: number, bz: number) =>
        fieldClampMove(activeZone, ax, az, bx, bz) ?? paleHollowClampMove(ax, az, bx, bz);
      const tryDash = () => {
        const me = myUnit();
        const now = performance.now();
        const wall = Date.now();
        if (!me || me.hp <= 0 || me.anim === "dead" || !dashClock.ready(now)) return;
        if (playOverlayBlocksDash() || useGame.getState().npcDialog) return;
        if (me.buffs.stunUntil > wall || me.buffs.sleepUntil > wall || me.buffs.petrifyUntil > wall) return;
        if (me.buffs.bindUntil > wall) return;
        if (me.anim === "cast" && wall < me.animUntil) return;
        if (me.gatherTool && wall < me.animUntil) return;
        const keys = getMoveKeys();
        const analog = getStickAxes();
        const isoKey =
          heading === null
            ? analog
              ? analogScreenTarget(analog, me, isoScreenPick, [FB_W / 2, FB_H / 2], clampMoveHere)
              : wasdTarget(keys, me, isoScreenPick, [FB_W / 2, FB_H / 2], clampMoveHere)
            : null;
        const cursor =
          heading === null && cursorFb && !isCoarsePointer() && !analog
            ? pickHit(cursorFb[0], cursorFb[1])
            : null;
        const dir = dashDirection(keys, me, heading === null ? null : moveYaw(), isoKey, cursor, analog);
        // The server sends its exact move speed (haste, flux, druid form, tree bonuses, zone...).
        // Re-deriving it here drifted from `playerMoveSpeed`; the buff maths below is only the
        // fallback for a server that does not send `speed` yet.
        const slow =
          wall < me.buffs.moveUntil && me.buffs.movePct !== 0
            ? Math.max(0.2, 1 + me.buffs.movePct)
            : wall < me.buffs.slowUntil
              ? 0.78
              : 1;
        const grav = wall < me.buffs.gravityUntil ? Math.max(0.2, 1 - me.buffs.gravityPct) : 1;
        const para = wall < me.buffs.paraUntil ? 0.55 : 1;
        const formMul = me.job === "druid" && me.buffs.druidForm === 4 ? 1.5 : me.job === "druid" && me.buffs.druidForm === 1 ? 0.9 : 1;
        const mul = me.speed != null && me.speed > 0 ? me.speed / PLAYER_SPEED : zoneMoveMul(activeZone, me.x, me.z) * slow * grav * para * formMul;
        const plan = planDash(me, dir, clampMoveHere, wall, undefined, DASH_DISTANCE * mul);
        if (!plan.ok) return;
        // Analog / HUD dash must not resume a leaked click-to-move (that walks backward
        // after the lunge). Do not send a 4.5 m WASD step first — that becomes dashResume.
        const hudClick = lastHudGroundAt > 0 && now - lastHudGroundAt < DASH_PRED_HOLD;
        send({ type: "dash", dx: dir.dx, dz: dir.dz, resume: !(virtualStickHeld() || analog) && !hudClick });
        dashClock.start(now);
        useGame.getState().setDashLastAt(Date.now());
        const secs = (plan.run.end - plan.run.start) / 1000;
        localDash = { x: plan.run.tx, z: plan.run.tz, until: now + Math.max(secs * 1000 + 120, DASH_PRED_HOLD) };
        dashPredStarted.add(me.id);
        r.predictDash(me.id, plan.run.tx + origin.x, plan.run.tz + origin.z, secs);
        lastWasd = null;
        walkAhead = null;
      };
      let last = performance.now();

      const myUnit = () => {
        const g = useGame.getState();
        return g.wallet ? g.snapshot?.units.find((u) => sameId(u.id, g.wallet) && u.kind === "player") : undefined;
      };
      /** Ground under a pixel, or null when a 3D pick hits the sky. */
      const pickHit = (sx: number, sy: number): [number, number] | null => {
        const p = r.pickGround(sx, sy);
        return p.length < 2 ? null : [p[0] - origin.x, p[1] - origin.z];
      };
      /** Click-to-move. In 3D the heading turns toward the click. */
      const moveTo = (sx: number, sy: number) => {
        const me = myUnit();
        if (!me || me.hp <= 0 || me.anim === "dead") return;
        const wall = Date.now();
        if (me.buffs.stunUntil > wall || me.buffs.sleepUntil > wall || me.buffs.petrifyUntil > wall || me.buffs.bindUntil > wall) return;
        if (me.anim === "cast" && wall < me.animUntil) return;
        const hit = pickHit(sx, sy);
        if (!hit) {
          if (view3d()) useGame.getState().pushLog("Look at the ground.", { local: true });
          return;
        }
        const field = fieldById(activeZone);
        const bounds = field?.bounds ?? PALE_HOLLOW_BOUNDS;
        let destX = hit[0];
        let destZ = hit[1];
        const outside =
          destX < bounds.minX || destX > bounds.maxX || destZ < bounds.minZ || destZ > bounds.maxZ;
        if (outside) {
          const gate = fieldGateAt(activeZone, me.x, me.z);
          if (gate) {
            destX = (gate.minX + gate.maxX) / 2;
            destZ = (gate.minZ + gate.maxZ) / 2;
          } else {
            destX = Math.max(bounds.minX, Math.min(bounds.maxX, destX));
            destZ = Math.max(bounds.minZ, Math.min(bounds.maxZ, destZ));
          }
        }
        const drawT = Number(root.dataset.uiDrawDistance);
        const reach = vistaReach(Number.isFinite(drawT) ? drawT : 0.55);
        const maxPick = view3d() ? reach.far : reach.isoProp;
        const span = Math.hypot(destX - me.x, destZ - me.z);
        if (span > maxPick && span > 1e-6) {
          destX = me.x + ((destX - me.x) / span) * maxPick;
          destZ = me.z + ((destZ - me.z) / span) * maxPick;
        }
        const c = clampMoveHere(me.x, me.z, destX, destZ);
        const missed = Math.hypot(c.x - destX, c.z - destZ);
        if (missed > 0.8) {
          const wet = field ? field.openWater(destX, destZ) : false;
          useGame.getState().pushLog(wet ? "No path across the water." : "That way is blocked.", { local: true });
        }
        const gateDest = fieldGateAt(activeZone, destX, destZ);
        const goal = gateDest && gateDest.destZone
          ? { x: (gateDest.minX + gateDest.maxX) / 2, z: (gateDest.minZ + gateDest.maxZ) / 2 }
          : c;
        if (heading !== null) headingGoal = headingToward(me, goal.x, goal.z);
        // Click-to-move while kneeling: predict walk so the rest pose does not linger
        // until the snapshot. keys "click" is not a WASD hold — do not send a stop.
        if (me.anim === "rest") {
          const dir = headingToward(me, goal.x, goal.z) ?? me.facing;
          lastWasd = {
            keys: "click",
            heading: dir,
            at: performance.now(),
            x: goal.x,
            z: goal.z,
            full: Math.hypot(goal.x - me.x, goal.z - me.z) > WASD_STEP - 0.3,
          };
          walkAhead = { x: me.x, z: me.z };
        } else {
          lastWasd = null;
        }
        const keys = getKeyboardMoveKeys();
        clickHoldKeys = `${keys.w ? "w" : ""}${keys.a ? "a" : ""}${keys.s ? "s" : ""}${keys.d ? "d" : ""}`;
        send({ type: "move", x: goal.x, z: goal.z });
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
      const onArcadeDash = () => {
        tryDash();
      };
      window.addEventListener("bellgrave:dash", onArcadeDash);
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
        const analogHeld = virtualStickHeld() || virtualStickReleasedRecently();
        const hudAdj = arcadeBlocksGroundClick(e.clientX, e.clientY);
        if (hudAdj) lastHudGroundAt = performance.now();
        if (analogHeld) return;
        const hit = e.button === 0 && !hudAdj ? unitAt(e) : undefined;
        if (hit && !sameId(hit.id, g.wallet)) {
          const res = routeUnitClick(hit, g.wallet);
          if (!res.ground) {
            if (res.select !== undefined) g.setSelectedTarget(res.select);
            if (res.send?.type === "gather") gatherAct = gatherActFor(hit, Date.now());
            if (res.send) send(res.send);
            if (res.select !== undefined || res.send) return;
            if (hit.kind === "npc" || (hit.kind === "mob" && hit.hp > 0)) return;
          }
        }
        if (e.button === 0) {
          if (hudAdj) return;
          const hitStatic = staticAt(zones.current, sx, sy, (x, y, z) => {
            const p = r.worldToScreen(x, y, z);
            return [p[0], p[1], p[2] ?? 1];
          }, (x, z) => r.zoneHeight(x, z));
          if (hitStatic) {
            send(hitStatic.send);
            return;
          }
        }
        if (hudAdj) return;
        const kb = getKeyboardMoveKeys();
        if (kb.w || kb.a || kb.s || kb.d) return;
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
        cursorFb = [
          Math.max(0, Math.min(FB_W - 1, sx)),
          Math.max(0, Math.min(FB_H - 1, sy)),
        ];
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
        // macOS sends no keyup for a key released while Cmd is held, so Cmd+S / Cmd+D would leave
        // S / D stuck down. Browser shortcuts (Ctrl/Cmd/Alt + key) are not movement.
        if (e.key === "Meta") clearKeyboardMove();
        const move = moveKeyFromCode(e.code);
        if (move && !typing(e) && !e.ctrlKey && !e.metaKey && !e.altKey) {
          setKeyboardMoveKey(move, true);
          e.preventDefault();
        }
        if (typing(e) || e.repeat) return;
        if (e.code === DASH_KEY_CODE) {
          e.preventDefault();
          tryDash();
          return;
        }
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
      const mapBtnEl = mapBtn.current;
      const onLeave = () => {
        cursorFb = null;
      };
      mapBtnEl?.addEventListener("pointerdown", onMapBtn);
      canvas.addEventListener("pointerdown", onPointer);
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerleave", onLeave);
      canvas.addEventListener("contextmenu", onContext);
      window.addEventListener("keydown", down, true);
      window.addEventListener("keyup", up, true);
      window.addEventListener("pointerup", onPointerUp);
      const onBlur = () => {
        const self = myUnit();
        if (self && lastWasd) {
          const p = stopTarget(self, lastWasd);
          send({ type: "move", x: p.x, z: p.z });
        }
        lastWasd = null;
        walkAhead = null;
        clickHoldKeys = null;
        clearKeyboardMove();
        clearVirtualStick();
        look.left = false;
        look.right = false;
        look.up = false;
        look.down = false;
        drag = null;
      };
      window.addEventListener("blur", onBlur);
      const onQuestCue = (ev: Event) => {
        const kind = (ev as CustomEvent<"accept" | "complete">).detail;
        const self = myUnit();
        if (!self || (kind !== "accept" && kind !== "complete")) return;
        playSteps(r, stepsFor(kind === "complete" ? "quest_complete" : "quest_accept"), self.id, self.id);
        if (kind === "complete") playQuestComplete();
        else playQuestAccept();
      };
      window.addEventListener("bellgrave:quest-cue", onQuestCue);
      cleanups.push(() => {
        mapBtnEl?.removeEventListener("pointerdown", onMapBtn);
        canvas.removeEventListener("pointerdown", onPointer);
        canvas.removeEventListener("pointermove", onMove);
        canvas.removeEventListener("pointerleave", onLeave);
        canvas.removeEventListener("contextmenu", onContext);
        window.removeEventListener("keydown", down, true);
        window.removeEventListener("keyup", up, true);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("blur", onBlur);
        window.removeEventListener("bellgrave:quest-cue", onQuestCue);
        window.removeEventListener("bellgrave:craft-act", onCraftAct);
        window.removeEventListener("bellgrave:dash", onArcadeDash);
        clearKeyboardMove();
        clearVirtualStick();
        labels.clear();
        icons.clear();
        statusCols.clear();
      });

      const frame = (now: number) => {
        // rAF's timestamp can precede the performance.now() that seeded `last`: never go negative.
        const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
        last = now;
        const g = useGame.getState();
        const snap = g.snapshot;
        const zid = snap?.you.zoneId ?? null;
        const zc = zones.update(zid);
        if (zc.changed && zid) {
          // Cut to black before origin/follow snap so the hand-off does not flash.
          if (!zc.first) fade(fadeRef.current);
          const o = zoneOrigin(zid);
          origin.x = o.x;
          origin.z = o.z;
          activeZone = zid;
          localDash = null;
          lastWasd = null;
          walkAhead = null;
          clickHoldKeys = null;
          headingGoal = null;
          dashPredStarted.clear();
          const self = myUnit();
          if (self) r.cancelDash(self.id);
          look.left = false;
          look.right = false;
          look.up = false;
          look.down = false;
          r.setLook(0, 0);
          r.setMapOrigin(origin.x, origin.z);
          // Keep every zone's terrain. Drop figures so a hand-off snaps
          // instead of sliding across the gap between zones.
          for (const id of known) r.removeUnit(id);
          known.clear();
          lastSnap = null;
          lastGearById.clear();
          followed = undefined;
          floats.reset();
          applyZoneMood(r, zid, zc.first);
          applyWorldAtmosphere(r, zid);
          const want = bakedZoneFor(zid);
          if (want !== zoneLoaded) {
            zoneLoaded = want;
            zoneRetryAt = 0;
            if (!want) r.clearZone();
            else loadTerrain(want);
          }
        } else if (zid) {
          const o = zoneOrigin(zid);
          origin.x = o.x;
          origin.z = o.z;
          activeZone = zid;
        }
        if (!zc.changed && zoneRetryAt > 0 && now >= zoneRetryAt && zoneLoaded) {
          // A failed terrain fetch retries without touching units.
          zoneRetryAt = 0;
          loadTerrain(zoneLoaded);
        }
        if (snap) {
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
            if (localDash && performance.now() < localDash.until && !cNext.unit.dashTo) {
              return { ...cNext.unit, dashTo: { x: localDash.x, z: localDash.z }, x: localDash.x, z: localDash.z };
            }
            return cNext.unit;
          });
          // Every frame: form preset (`druid:stickbear`) and anim clocks must
          // reach upsertUnit even when Zustand keeps the same snapshot object.
          syncUnits(
            {
              upsertUnit: (id, x, y, z, facing, anim, preset) => {
                // Predicted local pose is the last write. Snapshot upserts here
                // yank the follow camera backward (hold W / analog rubber-band).
                if (
                  wallet &&
                  sameId(id, wallet) &&
                  (lastWasd || walkAhead || (localDash && performance.now() < localDash.until))
                ) {
                  return;
                }
                const wx = x + origin.x;
                const wz = z + origin.z;
                // Live server y can be the blank-pad floor while this client
                // draws the sculpted bake. Sitting under the mesh looks upside
                // down (sky / inside of the heightfield). Snap to the bake.
                const ground = r.zoneHeight(wx, wz);
                const fy =
                  zoneLoaded && Number.isFinite(ground) && Math.abs(ground - y) > 1.25 ? ground : y;
                r.upsertUnit(id, wx, fy, wz, facing, anim, preset);
              },
              removeUnit: (id) => r.removeUnit(id),
            },
            units,
            known,
            nowMs,
          );
          if (snap !== lastSnap) {
            lastSnap = snap;
            casts.forget(known);
            for (const fx of vfx.scan(snap.units, myUnit()?.id, Date.now())) if (known.has(fx.from)) playSteps(r, fx.steps, fx.from, fx.to);
            resonance.forget(known);
            for (const ev of floats.scan(snap.units, myUnit(), snap.log ?? [], Date.now())) if (known.has(ev.id)) r.addFloater(ev.id, ev.kind, ev.value);
            const me0 = myUnit();
            for (const ev of edges.scan(snap.units, me0, Date.now())) {
              if (ev.kind === "enemySwing") playEnemySwing(ev.volume);
              else if (ev.kind === "jobSwing") playJobSwing(ev.job, ev.volume, ev.weaponFamily);
              else playTemporalDistortion(ev.until);
            }
          }
        }
        const me = myUnit();
        if (me?.anim === "rest" && seenAnim !== "rest") {
          lastWasd = null;
          walkAhead = null;
        }
        if (me) seenAnim = me.anim;
        if (snap) {
          for (const u of snap.units) {
            if (u.kind !== "player") continue;
            const equip = u.equip ?? (u.id === me?.id ? snap.you.equip : undefined);
            if (!equip) continue;
            const g = gearArgs(equip, getItem);
            const gearKey = g.join(",");
            if (lastGearById.get(u.id) === gearKey) continue;
            lastGearById.set(u.id, gearKey);
            r.setGear(u.id, ...g);
          }
        }
        if (snap) {
          for (const u of snap.units) {
            if (!u.dashTo) {
              dashPredStarted.delete(u.id);
              continue;
            }
            const near = Math.hypot(u.dashTo.x - u.x, u.dashTo.z - u.z) < 0.4;
            if (near) {
              dashPredStarted.delete(u.id);
              continue;
            }
            if (dashPredStarted.has(u.id)) continue;
            dashPredStarted.add(u.id);
            const travelled = Math.hypot(u.dashTo.x - u.x, u.dashTo.z - u.z);
            r.predictDash(u.id, u.dashTo.x + origin.x, u.dashTo.z + origin.z, dashDurationMs(travelled) / 1000);
          }
        }
        if (me && dashClock.refused(performance.now(), !!me.dashTo)) {
          r.cancelDash(me.id);
          localDash = null;
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
          if (clickHoldKeys === null) headingGoal = engageHeadingGoal(me, keys) ?? headingGoal;
          if (headingGoal !== null) {
            const e = headingEase(heading, headingGoal, dt);
            heading = e.heading;
            if (e.done) headingGoal = null;
          }
          if (!getStickAxes()) heading = headingStep(keys, heading, dt);
          r.setHeading(heading);
        }
        wasdAccum += dt;
        const dashLive = !!(localDash && performance.now() < localDash.until) || !!me?.dashTo;
        const wallNow = Date.now();
        const moveLocked = !me || me.hp <= 0 || me.anim === "dead"
          || wallNow < me.buffs.stunUntil || wallNow < me.buffs.sleepUntil || wallNow < me.buffs.petrifyUntil || wallNow < me.buffs.bindUntil
          || (me.anim === "cast" && wallNow < me.animUntil)
          || !!(me.gatherTool && wallNow < me.animUntil);
        const chatFocused = !!document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA" || (document.activeElement as HTMLElement).isContentEditable);
        if (me && wasdAccum >= WASD_INTERVAL) {
          wasdAccum -= WASD_INTERVAL;
          const moveClamp = (ax: number, az: number, bx: number, bz: number) => fieldClampMove(activeZone, ax, az, bx, bz) ?? paleHollowClampMove(ax, az, bx, bz);
          const stick = getStickAxes();
          // FP: walk the look (cam yaw includes yaw_bias), not the stick facing.
          const face = moveYaw();
          const keyStr = stick
            ? `${stick.ny > 0.1 ? "w" : ""}${stick.ny < -0.1 ? "s" : ""}${stick.nx > 0.1 ? "d" : ""}${stick.nx < -0.1 ? "a" : ""}`
            : heading === null
              ? `${keys.w ? "w" : ""}${keys.a ? "a" : ""}${keys.s ? "s" : ""}${keys.d ? "d" : ""}`
              : `${keys.w ? "w" : ""}${keys.s ? "s" : ""}`;
          const keysDown = keys.w || keys.a || keys.s || keys.d || !!stick || virtualStickHeld();
          // Held W / analog always wins over a leaked ground click. Never skip WASD
          // because leftover keys matched — that walked iso-south ("backward") on W hold.
          clickHoldKeys = null;
          const skipWasd = dashLive || moveLocked || chatFocused;
          if (!skipWasd) {
            const feet = walkAhead ?? me;
            const t = heading === null
              ? stick
                ? analogScreenTarget(stick, feet, isoScreenPick, [FB_W / 2, FB_H / 2], moveClamp)
                : wasdTarget(keys, feet, isoScreenPick, [FB_W / 2, FB_H / 2], moveClamp)
              : headingTarget(
                keys,
                feet,
                face,
                moveClamp,
                stick ? -stick.nx : 0,
                stick ? stick.ny : undefined,
              );
            const at = performance.now();
            const dir = t ? Math.atan2(t.x - feet.x, t.z - feet.z) : (heading ?? 0);
            if (t && shouldResend(lastWasd, { keys: keyStr, heading: dir, at }, feet)) {
              send({ type: "move", x: t.x, z: t.z });
              lastWasd = { keys: keyStr, heading: dir, at, x: t.x, z: t.z, full: Math.hypot(t.x - feet.x, t.z - feet.z) > WASD_STEP - 0.3 };
            } else if (!t && lastWasd && !keysDown) {
              if (lastWasd.keys !== "" && lastWasd.keys !== "click") {
                const p = stopTarget(feet, lastWasd);
                send({ type: "move", x: p.x, z: p.z });
                lastWasd = { keys: "", heading: lastWasd.heading, at, x: p.x, z: p.z };
              } else {
                const dist = Math.hypot(lastWasd.x - feet.x, lastWasd.z - feet.z);
                if (dist <= STOP_LEAD * 2) lastWasd = null;
              }
            }
          } else if (moveLocked && lastWasd) {
            lastWasd = null;
            walkAhead = null;
          }
        }
        if (me && lastWasd && !dashLive && !moveLocked) {
          if (!walkAhead) walkAhead = { x: me.x, z: me.z };
          const remain = Math.hypot(lastWasd.x - walkAhead.x, lastWasd.z - walkAhead.z);
          if (remain < STOP_LEAD) {
            walkAhead = { x: lastWasd.x, z: lastWasd.z };
          } else {
            const step = (me.speed != null && me.speed > 0 ? me.speed : PLAYER_SPEED * zoneMoveMul(activeZone, walkAhead.x, walkAhead.z)) * dt;
            const k = Math.min(1, step / remain);
            const nx = walkAhead.x + (lastWasd.x - walkAhead.x) * k;
            const nz = walkAhead.z + (lastWasd.z - walkAhead.z) * k;
            walkAhead = clampMoveHere(walkAhead.x, walkAhead.z, nx, nz);
          }
          const wx = walkAhead.x + origin.x;
          const wz = walkAhead.z + origin.z;
          // Same rule as syncUnits: the server's stand height (bridge decks, ramps), unless this
          // client's baked terrain disagrees by more than a step. Raw terrain height put a walking
          // player under a bridge deck until they stopped.
          const ground = r.zoneHeight(wx, wz);
          const stand = fieldStandHeight(activeZone, walkAhead.x, walkAhead.z) ?? paleHollowStandHeight(walkAhead.x, walkAhead.z);
          const fy = zoneLoaded && Number.isFinite(ground) && Math.abs(ground - stand) > 1.25 ? ground : stand;
          const poseRemain = Math.hypot(lastWasd.x - walkAhead.x, lastWasd.z - walkAhead.z);
          const moving = lastWasd.keys !== "";
          const faceYaw = moving && poseRemain > STOP_LEAD
            ? Math.atan2(lastWasd.x - walkAhead.x, lastWasd.z - walkAhead.z)
            : me.facing;
          r.upsertUnit(me.id, wx, fy, wz, faceYaw, moving ? "walk" : poseRemain < STOP_LEAD ? "idle" : animFor(me, wallNow), presetFor(me));
        } else if (me && walkAhead && !dashLive && !moveLocked) {
          // Seal/journal hitch leaves the snapshot a step behind. Ease back instead of snapping.
          const pace = (me.speed != null && me.speed > 0 ? me.speed : PLAYER_SPEED) * 3 * dt;
          const blended = blendToward(walkAhead, me, pace);
          walkAhead = blended.done ? null : { x: blended.x, z: blended.z };
          if (walkAhead) {
            const wx = walkAhead.x + origin.x;
            const wz = walkAhead.z + origin.z;
            const ground = r.zoneHeight(wx, wz);
            const stand = fieldStandHeight(activeZone, walkAhead.x, walkAhead.z) ?? paleHollowStandHeight(walkAhead.x, walkAhead.z);
            const fy = zoneLoaded && Number.isFinite(ground) && Math.abs(ground - stand) > 1.25 ? ground : stand;
            r.upsertUnit(me.id, wx, fy, wz, me.facing, animFor(me, wallNow), presetFor(me));
          }
        }
        if (activeZone === "pale_hollow" && snap?.weather) {
          r.setWeather(PH_WEATHER_KIND_ID[snap.weather.kind], snap.weather.snowCover);
          r.setWeatherHaze(true);
        } else {
          r.setWeather(0, 0);
          r.setWeatherHaze(activeZone === "pale_hollow");
        }
        // Outdoor / night>0 zones share the wall clock. night:0 indoor stays frozen.
        r.setTimeOfDay(zoneUsesDayClock(activeZone) ? paleHollowDayPhaseAt(Date.now()) : 0.35);
        r.tick(dt);
        const fit = readCanvasFit(canvas);
        const pxScale = fitScale(fit.width, fit.height, fit.cover);
        // Effects + labels
        const wall = Date.now();
        const ctxBase = {
          now: wall,
          wallet: g.wallet ?? null,
          selected: g.selectedTarget,
          hovered,
          combatTargetId: me?.targetId ?? null,
        };
        const shown = new Map<string, { text: string; cls: string; x: number; y: number; hp?: number; maxHp?: number }>();
        for (const u of snap?.units ?? []) {
          if (!known.has(u.id)) continue;
          const fx = unitFx(u, { ...ctxBase, cast: casts.progress(u, wall) });
          r.setFx(u.id, fx.hp, fx.cast, fx.aoe, fx.flags, fx.fade, fx.levelUp, fx.weaponEdge);
          const bv = buffVfx(u, wall, resonance);
          r.setBuffs(u.id, bv.mask, bv.td, bv.burst);
          const label = labelFor(u, ctxBase);
          if (label && fx.fade > 0.3) {
            const a = r.anchor(u.id);
            if (a && a.length === 3) {
              const [cx, cy] = fromFramebufferFit(fit, a[0], a[1]);
              shown.set(u.id, { ...label, x: cx, y: cy });
            }
          }
        }
        labels.update(shown);
        // Status icon column beside the torso (#34, old UnitStatusIcons)
        const sc = new Map<string, { icons: ReturnType<typeof statusIcons>; x: number; y: number; scale: number }>();
        for (const u of snap?.units ?? []) {
          if (!known.has(u.id)) continue;
          const ic = statusIcons(u, wall);
          if (ic.length === 0) continue;
          const a = r.anchor(u.id);
          if (!a || a.length !== 3) continue;
          const [cx, cy] = fromFramebufferFit(fit, a[0] + (u.kind === "mob" ? 12 : 10), a[1] + (a[2] - a[1]) * 0.15);
          sc.set(u.id, { icons: ic.slice(0, 6), x: cx, y: cy, scale: pxScale });
        }
        statusCols.update(sc);
        // Yield icons over gather nodes (#30)
        const gi = new Map<string, { slug?: string; x: number; y: number; scale: number; ready: boolean }>();
        const scale = pxScale;
        for (const u of snap?.units ?? []) {
          if (!u.gatherNode || !known.has(u.id)) continue;
          const a = r.anchor(u.id);
          if (!a || a.length !== 3) continue;
          const [cx, cy] = fromFramebufferFit(fit, a[0], a[1]);
          gi.set(u.id, { slug: u.gatherYield, x: cx, y: cy, scale, ready: u.hp > 0 });
        }
        icons.update(atlas, gi, wall / 1000);
        // NPC menu anchored under the NPC's feet (#27)
        const npcId = g.npcDialog?.npcId;
        const menu = menuRef.current;
        if (menu && npcId) {
          const a = r.anchor(npcId);
          if (a && a.length === 3) {
            const [cx, cy] = fromFramebufferFit(fit, a[0], a[2]);
            menu.style.transform = `translate(${Math.round(cx)}px, ${Math.round(cy) + 6}px) translate(-50%, 0)`;
            menu.style.visibility = "visible";
          } else menu.style.visibility = "hidden";
        }
        const mapButton = mapBtn.current;
        if (minimapLogFrame && !minimapLogFrame.isConnected) minimapLogFrame = null;
        if (!minimapLogFrame) minimapLogFrame = document.querySelector(".hud-combat-log");
        if (minimapWell && !minimapWell.isConnected) minimapWell = null;
        const mapPane = Boolean(minimapLogFrame?.classList.contains("hud-pane-map"));
        const paneJustOpened = mapPane && !lastMapPane;
        lastMapPane = mapPane;
        if (!mapPane) {
          minimapWell = null;
          hudMinimapCanvas = null;
        } else if (!minimapWell) {
          minimapWell =
            minimapLogFrame?.querySelector(".hud-minimap-well") ??
            document.querySelector(".hud-minimap-well");
          hudMinimapCanvas = null;
        }
        const well = minimapWell;
        const settingOn = document.documentElement.dataset.uiMinimap !== "off";
        const fullMap = r.minimapFull();
        const mobileHud = document.documentElement.dataset.uiLayout === "mobile";
        document.documentElement.dataset.uiMapFull = fullMap ? "1" : "";
        const draw = shouldDrawHudMinimap({
          mapPane,
          hasWell: Boolean(well),
          settingOn,
          full: fullMap,
        });
        r.setMinimap(draw !== "hide");
        const wantLabels = draw === "full";
        if (zoneLoaded && lastMapLabels !== wantLabels) {
          applyMapData(r, zoneLoaded, { labels: wantLabels });
          lastMapLabels = wantLabels;
        }
        if (draw !== lastDrawMode) {
          if (draw !== "dock") {
            r.setMinimapDock(0, 0, 0, 0);
            lastWellDock = null;
            lastBlitKey = null;
          }
          lastDrawMode = draw;
        }
        dockAge += 1;
        if (draw === "dock" && well && shouldRemeasureMinimapDock(dockAge, paneJustOpened || !lastWellDock)) {
          dockAge = 0;
          const box = minimapDockClientRect(well, minimapLogFrame);
          const [x0, y0] = toFramebufferFit(fit, box.left, box.top);
          const [x1, y1] = toFramebufferFit(fit, box.right, box.bottom);
          const wellDock = clampMinimapDock(x0, y0, x1, y1, FB_W, FB_H);
          const dock = minimapEngineDock({ mobile: mobileHud, wellDock });
          if (dock && !sameMinimapDock(lastWellDock, dock)) {
            lastWellDock = dock;
            r.setMinimapDock(dock[0], dock[1], dock[2], dock[3]);
            lastBlitKey = null;
          } else if (!dock) {
            lastWellDock = null;
            r.setMinimapDock(0, 0, 0, 0);
          }
        }
        if (mapButton) {
          if (draw === "hide") mapButton.style.visibility = "hidden";
          else {
            const full = fullMap;
            if (!full && !well) {
              mapButton.style.visibility = "hidden";
            } else if (full) {
              mapButton.style.visibility = "visible";
              mapButton.style.transform = "";
              mapButton.style.width = "";
              mapButton.style.height = "";
              if (mapButton.dataset.full !== "1") {
                mapButton.dataset.full = "1";
                mapButton.setAttribute("aria-label", "Shrink map");
              }
            } else {
              const ox = lastWellDock ? lastWellDock[0] : 6;
              const oy = lastWellDock ? lastWellDock[1] : 6;
              const [cx0, cy0] = fromFramebufferFit(fit, ox + 2, oy + 1);
              const [cx2, cy2] = fromFramebufferFit(fit, ox + 12, oy + 10);
              mapButton.style.visibility = "visible";
              mapButton.style.transform = `translate(${Math.round(cx0)}px, ${Math.round(cy0)}px)`;
              mapButton.style.width = `${Math.max(26, Math.round(cx2 - cx0))}px`;
              mapButton.style.height = `${Math.max(26, Math.round(cy2 - cy0))}px`;
              if (mapButton.dataset.full !== "0") {
                mapButton.dataset.full = "0";
                mapButton.setAttribute("aria-label", "Expand map");
              }
            }
          }
        }
        r.draw();
        if (draw === "dock" && lastWellDock && well) {
          if (!hudMinimapCanvas || !hudMinimapCanvas.isConnected) {
            hudMinimapCanvas = well.querySelector("canvas");
          }
          const nearby = (snap?.units ?? []).reduce((n, u) => {
            if (!me) return n;
            return Math.abs(u.x - me.x) < 70 && Math.abs(u.z - me.z) < 70 ? n + 1 : n;
          }, 0);
          const nextKey = minimapBlitKey(
            lastWellDock,
            r.minimapBakes(),
            me?.x ?? 0,
            me?.z ?? 0,
            me?.facing ?? 0,
            nearby,
          );
          if (hudMinimapCanvas && (dockAge === 0 || shouldBlitMinimap(lastBlitKey, nextKey))) {
            if (blitMinimapToWell(canvas, hudMinimapCanvas, lastWellDock)) lastBlitKey = nextKey;
          }
        }
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
