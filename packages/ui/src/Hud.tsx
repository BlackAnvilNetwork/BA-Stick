import { FigurePreview } from "./FigurePreview";
import {
  JOBS,
  JOB_IDS,
  mintableStartingJobs,
  SUBJOB_UNLOCK_LEVEL,
  abilityCategory,
  abilityIconUrl,
  abilityLabel,
  abilityMp,
  resolveAbilityTargetId,
  isHostileTabUnit,
  TAB_HOSTILE_RANGE,
  enemyTargetLabel,
  abilityRecastMs,
  abilityTooltip,
  categoryTabsDual,
  DRUID_FORM_LABEL,
  isAbilityId,
  isDruidForm,
  isJobId,
  type DruidForm,
  isTimAbilityId,
  xpToNextLevel,
  type AbilityId as CombatAbilityId,
  type JobId,
} from "@bellgrave/combat";
import { isStoredLocalBurnerWallet } from "@bellgrave/client-core/burner-identity";
import { clearPendingMint, mintCharacterWithWallet } from "@bellgrave/client-core/character-mint";
import { readPendingMint } from "@bellgrave/client-core/pending-mint";
import { ITEM, normalizeCharacterName, characterNameKey, explorerTxUrl } from "@bellgrave/config";
import { getItem } from "@bellgrave/items";
import { CHAT_MAX_LEN, parseChatCommand, type AbilityId, type UnitSnapshot } from "@bellgrave/protocol";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { AbilityIcon } from "./AbilityIcon";
import { chromaKeyIconUrl } from "./chroma-icons";
import { CraftingPanel } from "./CraftingPanel";
import { ExplorerPanel } from "./ExplorerPanel";
import { LokPanel } from "./LokPanel";
import { PartyPanel } from "./PartyPanel";
import { QuestLogPanel } from "./QuestLogPanel";
import { EquipPanel } from "./EquipPanel";
import { SkillTreePanel } from "./SkillTreePanel";
import {
  UI_COLOR_OPTIONS,
  UI_FONT_OPTIONS,
  UI_FONT_STACKS,
  UI_LAYOUT_OPTIONS,
  UI_SETTINGS_KEY,
  UI_PIXEL_OPTIONS,
  UI_CAM_OPTIONS,
  UI_VIEW_OPTIONS,
  UI_SETTINGS_EVENT,
  layoutUsesArcadeControls,
  loadUiSettings,
  persistAndApplyUiSettings,
  type UiColorId,
  type UiFontId,
  type UiLayoutId,
  type UiSettings,
} from "./uiSettings";
import { MobileArcadeControls } from "./MobileArcadeControls";
import { AshPitPanel, AshPitSlainBanner } from "./AshPitPanel";
import { clearVirtualStick } from "./moveInput";
import {
  HOTBAR_DRAG_MIME,
  HOTBAR_ROW_LEN,
  HOTBAR_SLOT_COUNT,
  HOTBAR_SLOT_MIME,
  assignHotbarSlot,
  clearHotbarSlot,
  loadHotbar,
  saveHotbar,
  swapHotbarSlots,
  type HotbarSlots,
} from "./hotbar";
import { useAppKit, useAppKitAccount, useAppKitState } from "@reown/appkit/react";
import { appKitConfigured } from "@bellgrave/client-core/appkit-config";
import { hasPersistedAuthForWallet } from "@bellgrave/client-core/auth-session";
import {
  checkCharacterNameAvailable,
  isAuthInFlight,
  isServerAuthed,
  kickLeftoverBurnerToAuth,
  loginWithWalletConnect,
  characterEnterMessage,
  logoutToMenu,
  send,
  walletConnectLoginAvailable,
} from "@bellgrave/client-core/net";
import { enterZoneMusic } from "./zoneMusic";
import { MENU_MUSIC } from "@bellgrave/config";
import { useGame } from "@bellgrave/client-core/state";
import {
  appKitModalView,
  applyStayOpenToggle,
  createSubmitLabel,
  hideBootScreen,
  playEscapeLayer,
  shouldAcceptWalletConnectClick,
  shouldAutoLoginAppKit,
  shouldDisableWalletControl,
  shouldForceWalletLogin,
  shouldHideWalletControlWhileModal,
  shouldKickLeftoverBurnerToAuth,
  shouldResetPlayOverlays,
  shouldRunCreateMint,
  shouldSendMintWallet,
  shouldSkipCreateNameCheck,
  walletControlLabel,
} from "./hud-leftovers";
// NpcInteractMenu mounts world-anchored under the NPC in WorldScene.

const OOC_MAP_MS = 20_000;
const TP_MAX = 3000;

function persistUiPatch(patch: Partial<UiSettings>): UiSettings {
  const next = { ...loadUiSettings(), ...patch };
  persistAndApplyUiSettings(next);
  return next;
}

const HOTBAR_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"] as const;
const HOTBAR_SHIFT_KEYS = ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S0"] as const;
const HOTBAR_ALT_KEYS = ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A0"] as const;

/** Framed hotbar art is 1024×533. Wells are inner pixels: slots 1–10, Rest, Potion. */
const HUD_FRAME = { w: 1024, h: 533 } as const;
const HUD_WELLS: readonly (readonly [number, number, number, number])[] = [
  [144, 422, 195, 476],
  [206, 422, 257, 476],
  [268, 422, 319, 476],
  [329, 422, 381, 476],
  [391, 422, 444, 476],
  [453, 422, 506, 476],
  [515, 422, 568, 476],
  [578, 422, 628, 476],
  [639, 422, 690, 476],
  [699, 422, 748, 476],
  [761, 422, 811, 476],
  [823, 422, 875, 476],
];
/** Menu medallion, just right of Potion on the 1024×533 plate. */
const HUD_MENU_WELL = [890, 422, 942, 476] as const;
const MENU_HOLD_MS = 480;

function hudWellStyle(index: number): {
  left: string;
  top: string;
  width: string;
  height: string;
} {
  const [x0, y0, x1, y1] = HUD_WELLS[index]!;
  return {
    left: `${(x0 / HUD_FRAME.w) * 100}%`,
    top: `${(y0 / HUD_FRAME.h) * 100}%`,
    width: `${((x1 - x0) / HUD_FRAME.w) * 100}%`,
    height: `${((y1 - y0) / HUD_FRAME.h) * 100}%`,
  };
}

/** Live slots for keybinds (updated by Hud). */
let liveHotbarSlots: HotbarSlots = Array.from({ length: HOTBAR_SLOT_COUNT }, () => null);

/** Map Digit* key codes → hotbar index (0–9), works with Shift held. */
export function hotbarIndexFromCode(code: string): number | null {
  const m = /^Digit([0-9])$/.exec(code);
  if (!m) return null;
  const d = m[1]!;
  return d === "0" ? 9 : Number(d) - 1;
}

function unitDruidForm(job: JobId | undefined, buffs: { druidForm?: number } | undefined): DruidForm {
  if (job !== "druid") return 0;
  const n = buffs?.druidForm ?? 0;
  return isDruidForm(n) ? n : 0;
}

function abilityTargetId(id: AbilityId, selected: string | null): string | undefined {
  if (!isAbilityId(id)) return undefined;
  const g = useGame.getState();
  const snap = g.snapshot;
  const wallet = g.wallet;
  if (!snap || !wallet) return undefined;
  const me = snap.units.find((u) => u.id.toLowerCase() === wallet.toLowerCase() && u.kind === "player");
  const combatTargetId = me?.targetId ?? null;
  return resolveAbilityTargetId(id, selected, wallet, combatTargetId, snap.units);
}

function hudAbilityTip(id: CombatAbilityId): { title: string; body: string; meta: string } {
  const raw = abilityTooltip(id);
  if (typeof raw === "object" && raw !== null && "title" in raw) {
    return raw;
  }
  const label = abilityLabel(id);
  const metaBits: string[] = [];
  const mp = abilityMp(id);
  const recast = abilityRecastMs(id);
  if (mp > 0) metaBits.push(`MP ${mp}`);
  if (recast > 0) {
    const s = recast / 1000;
    metaBits.push(s >= 60 ? `Recast ${Math.round(s / 60)}m` : `Recast ${s}s`);
  }
  const body = typeof raw === "string" ? raw : label;
  return { title: label, body, meta: metaBits.join(" · ") };
}

function abilityBuffActive(id: CombatAbilityId, me: UnitSnapshot, now: number): boolean {
  const b = me.buffs;
  if (id === "flux") return b.flux;
  if (id === "aether") return b.aether;
  if (id === "rest") return me.anim === "rest";
  if (id === "bulwark") return b.bulwarkUntil > now;
  if (id === "sentinel") return b.sentinelUntil > now;
  if (id === "cover") return b.coverUntil > now;
  if (id === "fealty") return b.fealtyUntil > now;
  if (id === "rampart") return b.rampartUntil > now;
  if (id === "guardian") return b.guardianUntil > now;
  if (id.startsWith("kn_protect")) return b.protectUntil > now;
  if (id.startsWith("kn_shell")) return b.shellUntil > now;
  if (id === "ghost_step") return b.ghostStepUntil > now;
  if (id === "backblade") return b.backbladeUntil > now;
  if (id === "kill_edge") return b.killEdgeUntil > now;
  if (id === "shadow_pass") return b.shadowPassUntil > now;
  if (id === "dust_runner") return b.moveUntil > now && b.movePct >= 0.5;
  if (id === "solace_rite") return b.solaceRite;
  if (id === "misery_rite") return b.miseryRite;
  if (id === "divine_seal") return b.divineSealReady;
  if (id === "asylum") return b.asylumUntil > now;
  if (
    id === "cl_cure" ||
    id === "cl_cure_ii" ||
    id === "cl_cure_iii" ||
    id === "cl_cure_iv" ||
    id === "cl_cure_v" ||
    id === "cl_curaga" ||
    id === "cl_curaga_ii" ||
    id === "cl_curaga_iii"
  ) {
    return b.healAbsorbUntil > now;
  }
  if (id === "cl_regen" || id === "cl_regen_ii" || id === "cl_regen_iii") {
    return b.regenUntil > now;
  }
  if (id === "killing_storm") return b.killingStormUntil > now;
  if (id === "berserk") return b.berserkUntil > now;
  if (id === "warcry") return b.warcryUntil > now;
  if (id === "defender") return b.defenderUntil > now;
  if (id === "aggressor") return b.aggressorUntil > now;
  if (id === "restraint") return b.restraintUntil > now;
  if (id === "blood_rage") return b.bloodRageUntil > now;
  if (id === "brazen_rush") return b.brazenRushUntil > now;
  if (id === "arcane_flood") return b.arcaneFloodUntil > now;
  if (id === "elemental_seal") return b.elementalSealUntil > now;
  if (id === "mana_wall") return b.manaWallUntil > now;
  if (id === "manawell") return b.manawellReady;
  if (id === "cascade") return b.cascadeUntil > now;
  if (id === "focal_neve") return b.focalNeveUntil > now;
  if (id === "spellblade") return b.spellbladeUntil > now;
  if (id === "focus_weave") return b.focusWeave;
  if (id === "bm_flame_edge" || id === "bm_frost_edge" || id === "bm_thunder_edge") {
    return b.enSpellUntil > now;
  }
  if (id.startsWith("bm_protect") || id === "bm_protect") return b.protectUntil > now;
  if (id.startsWith("bm_shell") || id === "bm_shell") return b.shellUntil > now;
  if (id === "bm_phalanx") return b.phalanxUntil > now;
  if (id === "bm_stoneskin") return b.stoneskinUntil > now;
  if (id === "bm_refresh" || id === "bm_refresh_ii" || id === "bm_refreshga") {
    return b.refreshUntil > now;
  }
  if (id === "bm_haste") return b.hasteUntil > now;
  if (
    id === "quicken" ||
    id === "quicken_ii" ||
    id === "tempo" ||
    id === "tempo_ii" ||
    id === "allegro" ||
    id === "allegro_ii" ||
    id === "haste" ||
    id === "hastega" ||
    id === "overclock"
  ) {
    return b.hasteUntil > now;
  }
  return false;
}

function jobHasHotbar(job: JobId): boolean {
  return JOBS[job]?.playable === true;
}

/** Every playable job gets the ability book + hotbar drag UX (same as TIM). */
function jobHasSpellbook(job: JobId): boolean {
  return JOBS[job]?.playable === true;
}

function dualHasSpellbook(main: JobId, sub: JobId | null | undefined): boolean {
  return jobHasSpellbook(main) || (sub != null && jobHasSpellbook(sub));
}

function castAbility(id: AbilityId) {
  const selected = useGame.getState().selectedTarget;
  send({ type: "ability", id, targetId: abilityTargetId(id, selected) });
}

function logClass(line: string): string {
  const l = line.toLowerCase();
  if (
    l.includes("flux") ||
    l.includes("aether") ||
    l.includes("quicken") ||
    l.includes("tempo") ||
    l.includes("allegro") ||
    l.includes("haste") ||
    l.includes("slow") ||
    l.includes("gravity") ||
    l.includes("cure") ||
    l.includes("rest") ||
    l.includes("metronome") ||
    l.includes("seal") ||
    l.includes("distortion") ||
    l.includes("petrif") ||
    l.includes("earth + time") ||
    l.includes("bulwark") ||
    l.includes("provoke") ||
    l.includes("flash") ||
    l.includes("sentinel") ||
    l.includes("rampart") ||
    l.includes("banish") ||
    l.includes("holy") ||
    l.includes("shield bash")
  ) {
    return "hud-log-line magic";
  }
  if (l.includes("hit") || l.includes("engaged") || l.includes("defeated") || l.includes("critical")) {
    return "hud-log-line combat";
  }
  if (
    l.includes("level up") ||
    l.includes("restored") ||
    l.includes("claimed") ||
    l.includes("welcome") ||
    l.includes("job changed") ||
    l.includes("+")
  ) {
    return "hud-log-line good";
  }
  if (l.includes("error") || l.includes("not enough") || l.includes("fall") || l.includes("hits you")) {
    return "hud-log-line bad";
  }
  return "hud-log-line system";
}

function SkillButton({
  id,
  keyLabel,
  now,
  recasts,
  me,
  tipPlacement = "above",
  draggable = true,
  hotbarIndex,
  onHotbarDrop,
  appearance = "default",
}: {
  id: CombatAbilityId;
  keyLabel?: string;
  now: number;
  recasts: Partial<Record<AbilityId, number>>;
  me: UnitSnapshot;
  tipPlacement?: "above" | "left";
  /** Spellbook / hotbar drag source. */
  draggable?: boolean;
  /** When set, this button is a hotbar slot (drop target + optional rearrange). */
  hotbarIndex?: number;
  onHotbarDrop?: (slotIndex: number, abilityId: CombatAbilityId | null, fromSlot: number | null) => void;
  /** `well` is an icon in the framed bar. `mark` is a clear hit target over baked art (Rest). */
  appearance?: "default" | "well" | "mark";
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const tip = hudAbilityTip(id);
  const until = recasts[id] ?? 0;
  const cdLeftMs = Math.max(0, until - now);
  const onCd = cdLeftMs > 0;
  const cdSec = Math.ceil(cdLeftMs / 1000);
  const totalMs = abilityRecastMs(id);
  const cdPct = onCd && totalMs > 0 ? Math.min(1, cdLeftMs / totalMs) : 0;
  const fluxOn = id === "flux" && me.buffs.flux;
  const aetherOn = id === "aether" && me.buffs.aether;
  const restOn = id === "rest" && me.anim === "rest";
  const hasteOn = abilityBuffActive(id, me, now) && isTimAbilityId(id) && id !== "flux" && id !== "aether";
  const knightBuffOn = abilityBuffActive(id, me, now) && !isTimAbilityId(id);
  const active = fluxOn || aetherOn || restOn || hasteOn || knightBuffOn;

  const onDragStart = (e: DragEvent) => {
    if (!draggable) return;
    e.dataTransfer.setData(HOTBAR_DRAG_MIME, id);
    e.dataTransfer.effectAllowed = hotbarIndex != null ? "move" : "copy";
    if (hotbarIndex != null) {
      e.dataTransfer.setData(HOTBAR_SLOT_MIME, String(hotbarIndex));
    }
  };

  const onDragOver = (e: DragEvent) => {
    if (hotbarIndex == null || !onHotbarDrop) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = e.dataTransfer.types.includes(HOTBAR_SLOT_MIME) ? "move" : "copy";
  };

  const onDrop = (e: DragEvent) => {
    if (hotbarIndex == null || !onHotbarDrop) return;
    e.preventDefault();
    e.stopPropagation();
    const fromRaw = e.dataTransfer.getData(HOTBAR_SLOT_MIME);
    const fromSlot = fromRaw !== "" ? Number(fromRaw) : null;
    const ability = e.dataTransfer.getData(HOTBAR_DRAG_MIME);
    if (fromSlot != null && !Number.isNaN(fromSlot)) {
      onHotbarDrop(hotbarIndex, null, fromSlot);
      return;
    }
    if (isAbilityId(ability)) onHotbarDrop(hotbarIndex, ability, null);
  };

  const dismissTip = () => {
    wrapRef.current?.classList.add("tip-dismissed");
    const ae = document.activeElement;
    if (ae instanceof HTMLElement) ae.blur();
  };
  const clearTipDismiss = () => {
    wrapRef.current?.classList.remove("tip-dismissed");
  };

  return (
    <div
      ref={wrapRef}
      className={`skill-wrap tip-${tipPlacement}`}
      onPointerLeave={clearTipDismiss}
      onPointerEnter={clearTipDismiss}
    >
      <button
        type="button"
        draggable={draggable && id !== "rest"}
        className={[
          "skill-slot",
          active ? "active" : "",
          fluxOn ? "flux-on" : "",
          aetherOn ? "aether-on" : "",
          hasteOn ? "quicken-on" : "",
          onCd ? "on-cd" : "",
          hotbarIndex != null ? "hotbar-slot" : "",
          appearance === "well" ? "frame-well" : "",
          appearance === "mark" ? "frame-mark" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label={`${tip.title}. ${tip.body}${hotbarIndex != null ? " Drag to rearrange." : ""}`}
        onClick={() => {
          castAbility(id);
          dismissTip();
        }}
        onContextMenu={
          hotbarIndex != null && onHotbarDrop
            ? (e) => {
                e.preventDefault();
                onHotbarDrop(hotbarIndex, null, -1); // -1 = clear
                dismissTip();
              }
            : undefined
        }
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {appearance === "default" && keyLabel != null && <span className="skill-key">{keyLabel}</span>}
        {appearance !== "mark" && <AbilityIcon id={id} />}
        {appearance === "default" && <span className="skill-name">{abilityLabel(id)}</span>}
        {onCd && (
          <span className="skill-cd" style={{ ["--cd" as string]: String(cdPct) }} aria-label={`${cdSec}s cooldown`}>
            <span className="skill-cd-veil" />
            <span className="skill-cd-num">{cdSec}</span>
          </span>
        )}
      </button>
      <div className="skill-tip" role="tooltip">
        <div className="skill-tip-title">{tip.title}</div>
        <div className="skill-tip-body">{tip.body}</div>
        <div className="skill-tip-meta">{tip.meta}</div>
        {hotbarIndex != null && (
          <div className="skill-tip-meta" style={{ marginTop: 4 }}>
            Drag to move · Right-click to clear
          </div>
        )}
        {onCd && <div className="skill-tip-cd">Ready in {cdSec}s</div>}
      </div>
    </div>
  );
}

/** Build a floating skill-slot element used as the HTML5 drag image. */
function makeSkillDragGhost(id: CombatAbilityId): HTMLElement {
  const ghost = document.createElement("div");
  ghost.className = "skill-slot skill-drag-ghost";
  const img = document.createElement("img");
  img.className = "skill-icon";
  img.src = abilityIconUrl(id);
  img.alt = "";
  img.draggable = false;
  void chromaKeyIconUrl(abilityIconUrl(id)).then((url) => {
    img.src = url;
  });
  const name = document.createElement("span");
  name.className = "skill-name";
  name.textContent = abilityLabel(id);
  ghost.appendChild(img);
  ghost.appendChild(name);
  ghost.style.position = "absolute";
  ghost.style.top = "-1000px";
  ghost.style.left = "-1000px";
  ghost.style.pointerEvents = "none";
  ghost.style.zIndex = "9999";
  document.body.appendChild(ghost);
  return ghost;
}

/** Spellbook list row — list in the book; drag preview is a hotbar-style button. */
function SpellbookRow({
  id,
  now,
  recasts,
  me,
}: {
  id: CombatAbilityId;
  now: number;
  recasts: Partial<Record<AbilityId, number>>;
  me: UnitSnapshot;
}) {
  const tip = hudAbilityTip(id);
  const until = recasts[id] ?? 0;
  const cdLeftMs = Math.max(0, until - now);
  const onCd = cdLeftMs > 0;
  const cdSec = Math.ceil(cdLeftMs / 1000);
  const fluxOn = id === "flux" && me.buffs.flux;
  const aetherOn = id === "aether" && me.buffs.aether;
  const restOn = id === "rest" && me.anim === "rest";
  const hasteOn = abilityBuffActive(id, me, now) && isTimAbilityId(id) && id !== "flux" && id !== "aether";
  const knightBuffOn = abilityBuffActive(id, me, now) && !isTimAbilityId(id);
  const active = fluxOn || aetherOn || restOn || hasteOn || knightBuffOn;
  const ghostRef = useRef<HTMLElement | null>(null);

  const onDragStart = (e: DragEvent) => {
    if (id === "rest") {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData(HOTBAR_DRAG_MIME, id);
    e.dataTransfer.effectAllowed = "copy";
    const ghost = makeSkillDragGhost(id);
    ghostRef.current = ghost;
    e.dataTransfer.setDragImage(ghost, 34, 34);
  };

  const onDragEnd = () => {
    ghostRef.current?.remove();
    ghostRef.current = null;
  };

  return (
    <button
      type="button"
      draggable={id !== "rest"}
      className={[
        "spellbook-row",
        active ? "active" : "",
        fluxOn ? "flux-on" : "",
        aetherOn ? "aether-on" : "",
        onCd ? "on-cd" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={`${tip.title}. ${tip.body}. Drag onto hotbar.`}
      title={`${tip.body}\n${tip.meta}`}
      onClick={() => castAbility(id)}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <span className="spellbook-row-glyph">
        <AbilityIcon id={id} />
      </span>
      <span className="spellbook-row-main">
        <span className="spellbook-row-name">{abilityLabel(id)}</span>
        <span className="spellbook-row-blurb">{tip.body}</span>
      </span>
      <span className="spellbook-row-meta">
        {onCd ? <span className="spellbook-row-cd">{cdSec}s</span> : null}
        <span className="spellbook-row-stats">{tip.meta}</span>
      </span>
    </button>
  );
}

function EmptyHotbarSlot({
  keyLabel,
  slotIndex,
  onHotbarDrop,
  appearance = "default",
}: {
  keyLabel: string;
  slotIndex: number;
  onHotbarDrop: (slotIndex: number, abilityId: CombatAbilityId | null, fromSlot: number | null) => void;
  /** `well` leaves the baked numeral visible. */
  appearance?: "default" | "well";
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const dismissTip = () => {
    wrapRef.current?.classList.add("tip-dismissed");
    const ae = document.activeElement;
    if (ae instanceof HTMLElement) ae.blur();
  };
  const clearTipDismiss = () => {
    wrapRef.current?.classList.remove("tip-dismissed");
  };

  return (
    <div
      ref={wrapRef}
      className="skill-wrap tip-above"
      onPointerLeave={clearTipDismiss}
      onPointerEnter={clearTipDismiss}
    >
      <button
        type="button"
        className={`skill-slot hotbar-slot empty${appearance === "well" ? " frame-well" : ""}`}
        aria-label={`Empty hotbar slot ${keyLabel}. Drop an ability here.`}
        onClick={dismissTip}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = e.dataTransfer.types.includes(HOTBAR_SLOT_MIME) ? "move" : "copy";
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const fromRaw = e.dataTransfer.getData(HOTBAR_SLOT_MIME);
          const fromSlot = fromRaw !== "" ? Number(fromRaw) : null;
          const ability = e.dataTransfer.getData(HOTBAR_DRAG_MIME);
          if (fromSlot != null && !Number.isNaN(fromSlot)) {
            onHotbarDrop(slotIndex, null, fromSlot);
            dismissTip();
            return;
          }
          if (isAbilityId(ability)) onHotbarDrop(slotIndex, ability, null);
          dismissTip();
        }}
      >
        {appearance === "default" && (
          <>
            <span className="skill-key">{keyLabel}</span>
            <span className="skill-glyph empty-glyph">·</span>
          </>
        )}
      </button>
      <div className="skill-tip" role="tooltip">
        <div className="skill-tip-title">Empty slot</div>
        <div className="skill-tip-body">Drag an ability from the spellbook (or another hotbar slot) onto here.</div>
        <div className="skill-tip-meta">Key {keyLabel}</div>
      </div>
    </div>
  );
}

export function Hud() {
  const snapshot = useGame((s) => s.snapshot);
  const logs = useGame((s) => s.logs);
  const chats = useGame((s) => s.chats);
  const phase = useGame((s) => s.phase);
  const wallet = useGame((s) => s.wallet);
  const selectedTarget = useGame((s) => s.selectedTarget);
  const npcDialog = useGame((s) => s.npcDialog);
  /** Prefer id lookup — avoid `s.me()` in selector (new call every select). */
  const me = useGame((s) => {
    const w = s.wallet;
    const snap = s.snapshot;
    if (!w || !snap) return null;
    return snap.units.find((u) => u.id.toLowerCase() === w.toLowerCase() && u.kind === "player") ?? null;
  });
  const [bagOpen, setBagOpen] = useState(false);
  const [craftOpen, setCraftOpen] = useState(false);
  const [lokOpen, setLokOpen] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const [treeOpen, setTreeOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [partyOpen, setPartyOpen] = useState(false);
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [questOpen, setQuestOpen] = useState(false);
  const closeQuestLog = useCallback(() => setQuestOpen(false), []);
  const closeCraftPanel = useCallback(() => setCraftOpen(false), []);
  const [ashPitOpen, setAshPitOpen] = useState(false);
  const [uiSettings, setUiSettings] = useState<UiSettings>(() => loadUiSettings());
  useEffect(() => {
    const sync = () => setUiSettings(loadUiSettings());
    window.addEventListener(UI_SETTINGS_EVENT, sync);
    return () => window.removeEventListener(UI_SETTINGS_EVENT, sync);
  }, []);
  const [menuFocus, setMenuFocus] = useState<string>("character");
  const [bookTab, setBookTab] = useState<string>("time");
  const [now, setNow] = useState(() => Date.now());
  const [hotbarSlots, setHotbarSlots] = useState<HotbarSlots>(() =>
    Array.from({ length: HOTBAR_SLOT_COUNT }, () => null),
  );
  const logEnd = useRef<HTMLDivElement>(null);
  const chatEnd = useRef<HTMLDivElement>(null);
  const chatInput = useRef<HTMLInputElement>(null);
  const [chatDraft, setChatDraft] = useState("");
  const chatDraftRef = useRef(chatDraft);
  chatDraftRef.current = chatDraft;
  const [leftPane, setLeftPane] = useState<"log" | "map">(() =>
    loadUiSettings().minimap ? "map" : "log",
  );
  const leftPaneIntent = useRef<"auto" | "log" | "map">("auto");
  const lastMinimapSetting = useRef(loadUiSettings().minimap);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuLocked, setMenuLocked] = useState(false);

  useEffect(() => {
    if (!shouldResetPlayOverlays(phase)) return;
    setBagOpen(false);
    setCraftOpen(false);
    setLokOpen(false);
    setBookOpen(false);
    setTreeOpen(false);
    setSettingsOpen(false);
    setPartyOpen(false);
    setExplorerOpen(false);
    setQuestOpen(false);
    setAshPitOpen(false);
    setMenuOpen(false);
    setMenuLocked(false);
  }, [phase]);
  const menuHoldTimer = useRef<number | null>(null);
  const menuHoldFired = useRef(false);
  const lastCombatAt = useRef(Date.now());
  const inCombatRef = useRef(false);

  const clearMenuHold = useCallback(() => {
    if (menuHoldTimer.current == null) return;
    window.clearTimeout(menuHoldTimer.current);
    menuHoldTimer.current = null;
  }, []);

  const onMenuPointerDown = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    menuHoldFired.current = false;
    clearMenuHold();
    e.currentTarget.setPointerCapture(e.pointerId);
    menuHoldTimer.current = window.setTimeout(() => {
      menuHoldFired.current = true;
      setMenuLocked((v) => {
        const next = !v;
        if (next) setMenuOpen(false);
        return next;
      });
      menuHoldTimer.current = null;
    }, MENU_HOLD_MS);
  }, [clearMenuHold]);

  const onMenuPointerUp = useCallback(() => {
    clearMenuHold();
  }, [clearMenuHold]);

  const onMenuClick = useCallback(() => {
    const held = menuHoldFired.current;
    menuHoldFired.current = false;
    if (held || menuLocked) return;
    setMenuOpen((v) => !v);
  }, [menuLocked]);

  useEffect(() => () => clearMenuHold(), [clearMenuHold]);

  useEffect(() => {
    if (!menuOpen) return;
    const place = () => {
      const chrome = document.querySelector(".hud-chrome") as HTMLElement | null;
      const btn = document.querySelector(".hud-menu-btn") as HTMLElement | null;
      if (!chrome || !btn) return;
      const b = btn.getBoundingClientRect();
      chrome.style.right = `${Math.max(8, window.innerWidth - b.right)}px`;
      chrome.style.bottom = `${Math.max(8, window.innerHeight - b.top + 10)}px`;
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if ((e.target as HTMLElement | null)?.closest(".hud-menu-dock, .hud-menu-btn")) return;
      setMenuOpen(false);
    };
    window.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [menuOpen]);

  useEffect(() => {
    const onMinimap = () => {
      const next = loadUiSettings().minimap;
      if (next === lastMinimapSetting.current) return;
      lastMinimapSetting.current = next;
      if (inCombatRef.current) return;
      leftPaneIntent.current = "auto";
      setLeftPane(next ? "map" : "log");
    };
    window.addEventListener(UI_SETTINGS_EVENT, onMinimap);
    return () => window.removeEventListener(UI_SETTINGS_EVENT, onMinimap);
  }, []);

  const craftStayOpen = useRef(false);
  const lokStayOpen = useRef(false);

  useEffect(() => {
    const onToggle = () => setBagOpen((v) => !v);
    const onBook = () => setBookOpen((v) => !v);
    const onCraft = () => {
      setCraftOpen((open) => {
        const r = applyStayOpenToggle(open, craftStayOpen.current);
        craftStayOpen.current = r.stayOpen;
        return r.open;
      });
    };
    const onLok = () => {
      setLokOpen((open) => {
        const r = applyStayOpenToggle(open, lokStayOpen.current);
        lokStayOpen.current = r.stayOpen;
        return r.open;
      });
    };
    const onQuest = () => setQuestOpen((v) => !v);
    window.addEventListener("bellgrave:toggle-bag", onToggle);
    window.addEventListener("bellgrave:toggle-spellbook", onBook);
    window.addEventListener("bellgrave:toggle-craft", onCraft);
    window.addEventListener("bellgrave:toggle-lok", onLok);
    window.addEventListener("bellgrave:toggle-questlog", onQuest);
    return () => {
      window.removeEventListener("bellgrave:toggle-bag", onToggle);
      window.removeEventListener("bellgrave:toggle-spellbook", onBook);
      window.removeEventListener("bellgrave:toggle-craft", onCraft);
      window.removeEventListener("bellgrave:toggle-lok", onLok);
      window.removeEventListener("bellgrave:toggle-questlog", onQuest);
    };
  }, []);

  useEffect(() => {
    if (npcDialog?.craftOpen) {
      setCraftOpen(true);
      craftStayOpen.current = true;
    }
  }, [npcDialog?.craftOpen, npcDialog?.npcId]);

  useEffect(() => {
    if (npcDialog?.lokOpen) {
      setLokOpen(true);
      lokStayOpen.current = true;
    }
  }, [npcDialog?.lokOpen, npcDialog?.npcId]);

  useEffect(() => {
    logEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats]);

  useEffect(() => {
    const onFocus = (e: Event) => {
      const seed = (e as CustomEvent<{ seed?: string }>).detail?.seed;
      const el = chatInput.current;
      if (!el) return;
      el.focus();
      if (seed && !chatDraftRef.current.trim()) setChatDraft(seed);
    };
    window.addEventListener("bellgrave:focus-chat", onFocus);
    return () => window.removeEventListener("bellgrave:focus-chat", onFocus);
  }, []);

  useEffect(() => {
    if (phase !== "play") return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (!layoutUsesArcadeControls(uiSettings.layout)) clearVirtualStick();
  }, [uiSettings.layout]);

  useEffect(() => {
    if (phase !== "play") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const layer = playEscapeLayer({
        settings: settingsOpen,
        commands: menuOpen,
        bag: bagOpen,
        craft: craftOpen,
        spellbook: bookOpen,
        party: partyOpen,
        skills: treeOpen,
        exchange: lokOpen,
        quest: questOpen,
        explorer: explorerOpen,
        ashPit: ashPitOpen,
      });
      if (layer === "npc" || layer === "disengage") return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (layer === "settings") setSettingsOpen(false);
      else if (layer === "commands") setMenuOpen(false);
      else if (layer === "bag") setBagOpen(false);
      else if (layer === "craft") setCraftOpen(false);
      else if (layer === "spellbook") setBookOpen(false);
      else if (layer === "party") setPartyOpen(false);
      else if (layer === "skills") setTreeOpen(false);
      else if (layer === "exchange") setLokOpen(false);
      else if (layer === "quest") setQuestOpen(false);
      else if (layer === "explorer") setExplorerOpen(false);
      else if (layer === "ashPit") setAshPitOpen(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [
    phase,
    settingsOpen,
    menuOpen,
    bagOpen,
    craftOpen,
    bookOpen,
    partyOpen,
    treeOpen,
    lokOpen,
    questOpen,
    explorerOpen,
    ashPitOpen,
  ]);

  // Re-sync from localStorage when entering play / when another tab changes settings.
  // Keeps Mobile sticks visible after remounts and across refresh.
  useEffect(() => {
    if (phase !== "play") return;
    const cur = loadUiSettings();
    setUiSettings(cur);
    leftPaneIntent.current = "auto";
    setLeftPane(cur.minimap ? "map" : "log");
    const onStorage = (e: StorageEvent) => {
      if (e.key === UI_SETTINGS_KEY || e.key === null) {
        const next = loadUiSettings();
        setUiSettings(next);
        setLeftPane(next.minimap ? "map" : "log");
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [phase]);

  const bookIds = useMemo(() => {
    if (!snapshot || !dualHasSpellbook(snapshot.you.job, snapshot.you.subjob)) {
      return [] as CombatAbilityId[];
    }
    return (snapshot.you.unlocked as CombatAbilityId[]).filter((id) => isAbilityId(id));
  }, [snapshot]);

  // Load / refresh custom hotbar when wallet, job, subjob, or unlock set changes.
  // Do NOT depend on full `snapshot` — it changes every WS tick and would thrash setState.
  const unlockKey = bookIds.join(",");
  const jobKey = snapshot?.you.job ?? "";
  const subKey = snapshot?.you.subjob ?? "";
  const formKey = String(me && snapshot?.you.job === "druid" ? unitDruidForm(snapshot.you.job, me.buffs) : 0);
  useEffect(() => {
    if (!jobKey || !jobHasHotbar(jobKey)) {
      setHotbarSlots((prev) => {
        if (prev.every((s) => s == null)) return prev;
        const empty = Array.from({ length: HOTBAR_SLOT_COUNT }, () => null) as HotbarSlots;
        liveHotbarSlots = empty;
        return empty;
      });
      return;
    }
    const snap = useGame.getState().snapshot;
    if (!snap) return;
    const unlocked = snap.you.unlocked as CombatAbilityId[];
    const sub = snap.you.subjob && isJobId(snap.you.subjob) ? snap.you.subjob : null;
    const self = snap.units.find((u) => u.id.toLowerCase() === (wallet ?? "").toLowerCase() && u.kind === "player");
    const form = unitDruidForm(snap.you.job, self?.buffs);
    const next = loadHotbar(wallet, snap.you.job, unlocked, sub, form);
    setHotbarSlots((prev) => {
      if (prev.length === next.length && prev.every((v, i) => v === next[i])) return prev;
      liveHotbarSlots = next;
      return next;
    });
  }, [wallet, jobKey, unlockKey, subKey, formKey]);

  useEffect(() => {
    liveHotbarSlots = hotbarSlots;
  }, [hotbarSlots]);

  const handleHotbarDrop = (
    slotIndex: number,
    abilityId: CombatAbilityId | null,
    fromSlot: number | null,
  ) => {
    if (!snapshot || !jobHasHotbar(snapshot.you.job)) return;
    const sub =
      snapshot.you.subjob && isJobId(snapshot.you.subjob) ? snapshot.you.subjob : null;
    setHotbarSlots((prev) => {
      let next: HotbarSlots;
      if (fromSlot === -1) {
        next = clearHotbarSlot(prev, slotIndex);
      } else if (fromSlot != null) {
        next = swapHotbarSlots(prev, fromSlot, slotIndex);
      } else if (abilityId) {
        next = assignHotbarSlot(prev, slotIndex, abilityId);
      } else {
        return prev;
      }
      const form = unitDruidForm(snapshot.you.job, me?.buffs);
      saveHotbar(wallet, snapshot.you.job, next, sub, form);
      liveHotbarSlots = next;
      return next;
    });
  };

  const hotbarRow1 = hotbarSlots.slice(0, HOTBAR_ROW_LEN);
  const hotbarRow2 = hotbarSlots.slice(HOTBAR_ROW_LEN, HOTBAR_ROW_LEN * 2);
  const hotbarRow3 = hotbarSlots.slice(HOTBAR_ROW_LEN * 2, HOTBAR_SLOT_COUNT);
  const restUnlocked = (snapshot?.you.unlocked ?? []).includes("rest");

  const bookByCategory = useMemo(() => {
    const map = new Map<string, CombatAbilityId[]>();
    for (const id of bookIds) {
      const cat = abilityCategory(id);
      const list = map.get(cat);
      if (list) list.push(id);
      else map.set(cat, [id]);
    }
    return map;
  }, [bookIds]);

  const bookTabs = useMemo(() => {
    if (!snapshot) return [];
    const sub =
      snapshot.you.subjob && isJobId(snapshot.you.subjob) ? snapshot.you.subjob : null;
    const tabs = categoryTabsDual(snapshot.you.job, sub);
    return tabs.filter((t) => (bookByCategory.get(t.id)?.length ?? 0) > 0);
  }, [bookByCategory, snapshot]);

  const activeBookTab =
    bookTabs.find((t) => t.id === bookTab)?.id ?? bookTabs[0]?.id ?? "time";
  const tabIds = bookByCategory.get(activeBookTab) ?? [];

  const questLogEntries = useMemo(() => {
    const raw = snapshot?.you.questLog;
    return Array.isArray(raw) ? raw : [];
  }, [snapshot?.tick, snapshot?.you.questLog]);

  const focusEnemy = useMemo(() => {
    if (!snapshot || !selectedTarget || !wallet) return null;
    const u = snapshot.units.find((x) => x.id === selectedTarget);
    if (!u || !isHostileTabUnit(u, wallet)) return null;
    return u;
  }, [snapshot, selectedTarget, wallet]);

  const inCombat = Boolean(
    me?.targetId ||
      (wallet &&
        me &&
        snapshot?.units.some((u) => {
          if (!isHostileTabUnit(u, wallet) || !u.targetId) return false;
          if (u.targetId.toLowerCase() !== wallet.toLowerCase()) return false;
          const dx = u.x - me.x;
          const dz = u.z - me.z;
          return dx * dx + dz * dz <= TAB_HOSTILE_RANGE * TAB_HOSTILE_RANGE;
        })),
  );
  inCombatRef.current = inCombat;
  useEffect(() => {
    if (inCombat) {
      lastCombatAt.current = Date.now();
      setLeftPane("log");
    }
  }, [inCombat]);

  useEffect(() => {
    if (inCombat) return;
    const id = window.setTimeout(() => {
      if (leftPaneIntent.current === "log") {
        setLeftPane("log");
        return;
      }
      if (leftPaneIntent.current === "map") {
        setLeftPane("map");
        return;
      }
      setLeftPane(loadUiSettings().minimap ? "map" : "log");
    }, OOC_MAP_MS);
    return () => window.clearTimeout(id);
  }, [inCombat]);

  if (phase !== "play" || !snapshot || !me) return null;
  const you = snapshot.you;
  const xpNeed = xpToNextLevel(you.level);
  const xpHave = Math.max(0, you.xp);
  const meters = (
    <div className="hud-meter-stack">
      <HudMeter kind="tp" label="TP" value={me.tp} max={TP_MAX} />
      <HudMeter kind="xp" label="XP" value={xpHave} max={xpNeed} />
    </div>
  );
  const menuButton = (
    <button
      type="button"
      className={`hud-menu-btn${menuOpen ? " open" : ""}${menuLocked ? " locked" : ""}`}
      style={{
        left: `${(HUD_MENU_WELL[0] / HUD_FRAME.w) * 100}%`,
        top: `${(HUD_MENU_WELL[1] / HUD_FRAME.h) * 100}%`,
        width: `${((HUD_MENU_WELL[2] - HUD_MENU_WELL[0]) / HUD_FRAME.w) * 100}%`,
        height: `${((HUD_MENU_WELL[3] - HUD_MENU_WELL[1]) / HUD_FRAME.h) * 100}%`,
      }}
      aria-label={
        menuLocked
          ? "Commands menu locked. Hold to unlock."
          : menuOpen
            ? "Close commands menu. Hold to lock closed."
            : "Commands menu. Hold to lock closed."
      }
      aria-expanded={menuOpen}
      aria-pressed={menuLocked}
      onPointerDown={onMenuPointerDown}
      onPointerUp={onMenuPointerUp}
      onPointerCancel={clearMenuHold}
      onClick={onMenuClick}
    >
      <span className="hud-menu-bars" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </button>
  );
  const potions = you.inventory.reduce((n, i) => n + (i.tokenId === ITEM.POTION ? i.amount : 0), 0);
  const recasts = you.recasts ?? {};

  const mobileLayout = layoutUsesArcadeControls(uiSettings.layout);

  const focusHpPct =
    focusEnemy && focusEnemy.maxHp > 0
      ? Math.max(0, Math.min(100, (focusEnemy.hp / focusEnemy.maxHp) * 100))
      : 0;

  return (
    <div
      className={`hud-root${mobileLayout ? " hud-layout-mobile" : ""}`}
      data-ui-layout={uiSettings.layout}
    >
      {focusEnemy && (
        <div className="target-focus-plate" role="status" aria-live="polite">
          <div className="target-focus-name">{enemyTargetLabel(focusEnemy)}</div>
          <div className="target-focus-bar">
            <i style={{ width: `${focusHpPct}%` }} />
          </div>
          <div className="target-focus-num">
            {focusEnemy.hp}/{focusEnemy.maxHp}
          </div>
        </div>
      )}
      {menuOpen && (
      <div className="hud-chrome">
        <div className="hud-menu-dock" role="menu" aria-label="Commands" onKeyDownCapture={(e) => {
          if (e.key === "Tab") {
            e.preventDefault();
            e.stopPropagation();
          }
        }}>
          <div className="hud-commands-kicker">Black Anvil</div>
          <button
            type="button"
            className="hud-commands-header"
            aria-expanded={true}
            onClick={() => setMenuOpen(false)}
          >
            Commands
            <span className="hud-commands-caret" aria-hidden="true">×</span>
          </button>
          {dualHasSpellbook(you.job, you.subjob) && (
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              className={`hud-cmd-btn${menuFocus === "spellbook" ? " selected" : ""}`}
              onMouseEnter={() => setMenuFocus("spellbook")}
              onFocus={() => setMenuFocus("spellbook")}
              onClick={() => {
                setMenuFocus("spellbook");
                setBookOpen((v) => !v);
              }}
            >
              Spellbook
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className={`hud-cmd-btn${menuFocus === "character" ? " selected" : ""}`}
            onMouseEnter={() => setMenuFocus("character")}
            onFocus={() => setMenuFocus("character")}
            onClick={() => {
              setMenuFocus("character");
              setBagOpen((v) => !v);
            }}
          >
            Character
          </button>
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className={`hud-cmd-btn${menuFocus === "crafting" ? " selected" : ""}`}
            onMouseEnter={() => setMenuFocus("crafting")}
            onFocus={() => setMenuFocus("crafting")}
            onClick={() => {
              setMenuFocus("crafting");
              setCraftOpen((v) => !v);
            }}
          >
            Crafting
          </button>
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className={`hud-cmd-btn${menuFocus === "questlog" ? " selected" : ""}`}
            onMouseEnter={() => setMenuFocus("questlog")}
            onFocus={() => setMenuFocus("questlog")}
            onClick={() => {
              setMenuFocus("questlog");
              setQuestOpen((v) => !v);
            }}
          >
            Quest log
          </button>
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className={`hud-cmd-btn${menuFocus === "skills" ? " selected" : ""}`}
            title="Master skill tree — 1 point per level + 100 from post-max EXP"
            onMouseEnter={() => setMenuFocus("skills")}
            onFocus={() => setMenuFocus("skills")}
            onClick={() => {
              setMenuFocus("skills");
              setTreeOpen((v) => !v);
            }}
          >
            Skills
          </button>
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className={`hud-cmd-btn${menuFocus === "party" ? " selected" : ""}`}
            onMouseEnter={() => setMenuFocus("party")}
            onFocus={() => setMenuFocus("party")}
            onClick={() => {
              setMenuFocus("party");
              setPartyOpen((v) => !v);
            }}
          >
            Party
          </button>
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className={`hud-cmd-btn${menuFocus === "ashpit" ? " selected" : ""}${
              you.pvp?.bountyOpen ? " ash-pit-marked" : ""
            }`}
            title="Ash Pit — PvP bounty arena (L30)"
            onMouseEnter={() => setMenuFocus("ashpit")}
            onFocus={() => setMenuFocus("ashpit")}
            onClick={() => {
              setMenuFocus("ashpit");
              setAshPitOpen((v) => !v);
            }}
          >
            Ash Pit{you.pvp?.bountyOpen ? " · ★" : ""}
          </button>
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className={`hud-cmd-btn${menuFocus === "explorer" ? " selected" : ""}`}
            onMouseEnter={() => setMenuFocus("explorer")}
            onFocus={() => setMenuFocus("explorer")}
            onClick={() => {
              setMenuFocus("explorer");
              setExplorerOpen((v) => !v);
            }}
          >
            Explorer
          </button>
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className={`hud-cmd-btn${menuFocus === "settings" ? " selected" : ""}`}
            onMouseEnter={() => setMenuFocus("settings")}
            onFocus={() => setMenuFocus("settings")}
            onClick={() => {
              setMenuFocus("settings");
              setSettingsOpen((v) => !v);
            }}
          >
            Settings
          </button>
          {import.meta.env.DEV && (
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className={`hud-cmd-btn hud-cmd-status${menuFocus === "maxlv" ? " selected" : ""}`}
            title="Dev: set level 75 and learn all Time Mage spells"
            onMouseEnter={() => setMenuFocus("maxlv")}
            onFocus={() => setMenuFocus("maxlv")}
            onClick={() => {
              setMenuFocus("maxlv");
              send({ type: "debug/maxlevel" });
            }}
          >
            Max Lv
          </button>
          )}
        </div>
      </div>
      )}

      {bagOpen && <EquipPanel you={you} me={me} onClose={() => setBagOpen(false)} />}
      {craftOpen && <CraftingPanel onClose={closeCraftPanel} />}
      {lokOpen && <LokPanel you={you} onClose={() => setLokOpen(false)} />}
      {treeOpen && <SkillTreePanel onClose={() => setTreeOpen(false)} />}
      {!partyOpen && snapshot?.partyInvite && (
        <div className="party-invite-toast" role="status">
          <span>
            <strong>{snapshot.partyInvite.fromName}</strong> invited you to a party.
          </span>
          <button type="button" className="hud-cmd-btn selected" onClick={() => send({ type: "party/accept" })}>
            Accept
          </button>
          <button type="button" className="hud-cmd-btn" onClick={() => send({ type: "party/decline" })}>
            Decline
          </button>
          <button type="button" className="hud-cmd-btn" onClick={() => setPartyOpen(true)}>
            Party
          </button>
        </div>
      )}
      {explorerOpen && <ExplorerPanel onClose={() => setExplorerOpen(false)} />}
      {ashPitOpen && <AshPitPanel onClose={() => setAshPitOpen(false)} />}
      <AshPitSlainBanner />
      {partyOpen && wallet && (
        <PartyPanel
          party={snapshot?.party ?? null}
          invite={snapshot?.partyInvite ?? null}
          selectedTarget={selectedTarget}
          myWallet={wallet}
          onClose={() => setPartyOpen(false)}
        />
      )}
      {settingsOpen && (
        <div className="settings-panel">
          <div className="settings-panel-head">
            <div>
              <div className="settings-kicker">Hud appearance</div>
              <div className="settings-panel-title">Settings</div>
              <div className="settings-panel-sub">Color, font &amp; layout for the HUD</div>
            </div>
            <button type="button" className="cmd-close-btn" onClick={() => setSettingsOpen(false)}>
              Close
            </button>
          </div>
          <div className="settings-section settings-card">
            <div className="settings-section-label">Layout</div>
            <div className="settings-panel-sub" style={{ marginBottom: 8 }}>
              Mobile adds arcade sticks and moves hotkeys nearby for touch play.
            </div>
            <div className="cmd-seg" role="listbox" aria-label="UI layout">
              {UI_LAYOUT_OPTIONS.map((opt) => {
                const active = uiSettings.layout === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={active ? "on" : undefined}
                    title={opt.hint}
                    onClick={() => {
                      const next = persistUiPatch({ layout: opt.id as UiLayoutId });
                      setUiSettings(next);
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
          {document.documentElement.dataset.renderer === "stick" && (
            <div className="settings-section settings-card">
              <div className="settings-section-label">View</div>
              <div className="settings-option-grid" role="listbox" aria-label="Camera view">
                {UI_VIEW_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    role="option"
                    aria-selected={uiSettings.view === opt.id}
                    className={`settings-option${uiSettings.view === opt.id ? " active" : ""}`}
                    onClick={() => {
                      const next = persistUiPatch({ view: opt.id });
                      setUiSettings(next);
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
                <button
                  type="button"
                  role="option"
                  aria-selected={uiSettings.minimap}
                  className={`settings-option${uiSettings.minimap ? " active" : ""}`}
                  title="Toggle with M"
                  onClick={() => {
                    const next = persistUiPatch({ minimap: !loadUiSettings().minimap });
                    setUiSettings(next);
                    lastMinimapSetting.current = next.minimap;
                    leftPaneIntent.current = "auto";
                    setLeftPane(next.minimap ? "map" : "log");
                  }}
                >
                  Minimap (M)
                </button>
              </div>
              <div className="settings-section-label" style={{ marginTop: 10 }}>Camera look</div>
              <div className="settings-panel-sub" style={{ marginBottom: 8 }}>
                Numpad 4/6 turn and 8/2 pitch. Mouse uses right-drag. V or numpad 5 cycles the view. M is the minimap.
              </div>
              <div className="cmd-seg" role="listbox" aria-label="Camera control">
                {UI_CAM_OPTIONS.map((opt) => {
                  const active = uiSettings.cam === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={active ? "on" : undefined}
                      onClick={() => {
                      const next = persistUiPatch({ cam: opt.id });
                      setUiSettings(next);
                    }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <div className="settings-option-grid" role="listbox" aria-label="Pixel scaling">
                {UI_PIXEL_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    role="option"
                    aria-selected={uiSettings.pixel === opt.id}
                    className={`settings-option${uiSettings.pixel === opt.id ? " active" : ""}`}
                    onClick={() => {
                      const next = persistUiPatch({ pixel: opt.id });
                      setUiSettings(next);
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="settings-section settings-card">
            <div className="settings-section-label">Color</div>
            <div className="settings-option-grid" role="listbox" aria-label="UI color">
              {UI_COLOR_OPTIONS.map((opt) => {
                const active = uiSettings.color === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`settings-option${active ? " active" : ""}`}
                    onClick={() => {
                      const next = persistUiPatch({ color: opt.id as UiColorId });
                      setUiSettings(next);
                    }}
                  >
                    <span className="settings-swatch" style={{ background: opt.swatch }} />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="settings-section settings-card">
            <div className="settings-section-label">Font</div>
            <div className="settings-option-grid" role="listbox" aria-label="UI font">
              {UI_FONT_OPTIONS.map((opt) => {
                const active = uiSettings.font === opt.id;
                const fontFamily = UI_FONT_STACKS[opt.id];
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`settings-option${active ? " active" : ""}`}
                    style={{ fontFamily }}
                    onClick={() => {
                      const next = persistUiPatch({ font: opt.id as UiFontId });
                      setUiSettings(next);
                    }}
                  >
                    {opt.label}
                    <span className="settings-font-sample" style={{ fontFamily }}>
                      {opt.sample}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="settings-section settings-card settings-session">
            <div className="settings-section-label">Session</div>
            <button
              type="button"
              className="settings-logout"
              onClick={() => {
                logoutToMenu();
                enterZoneMusic(MENU_MUSIC);
              }}
            >
              Logout to menu
            </button>
          </div>
        </div>
      )}

      {bookOpen && dualHasSpellbook(you.job, you.subjob) && (
        <div className="spellbook-panel">
          <div className="spellbook-head">
            <div>
              <div className="cmd-kicker">Abilities</div>
              <div>Spellbook</div>
              <div className="spellbook-sub">
                {bookIds.length} unlocked
                {you.job === "druid"
                  ? ` · ${JOBS[you.job]?.name} · ${DRUID_FORM_LABEL[unitDruidForm(you.job, me?.buffs)]}`
                  : you.subjob && you.subLevel > 0
                  ? ` · ${JOBS[you.job]?.name} + ${JOBS[you.subjob]?.name} L${you.subLevel}`
                  : ""}{" "}
                · drag onto hotbar
              </div>
            </div>
            <div className="spellbook-head-actions">
              {bookIds.includes("map_undo" as CombatAbilityId) && (
                <button
                  type="button"
                  className="cmd-close-btn spellbook-undo-btn"
                  onClick={() => castAbility("map_undo" as CombatAbilityId)}
                >
                  Undo
                </button>
              )}
              <button type="button" className="cmd-close-btn" onClick={() => setBookOpen(false)}>
                Close
              </button>
            </div>
          </div>
          {bookTabs.length > 0 && (
            <div className="spellbook-tabs" role="tablist" aria-label="Ability categories">
              {bookTabs.map((t) => {
                const count = bookByCategory.get(t.id)?.length ?? 0;
                const selected = t.id === activeBookTab;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    className={`spellbook-tab${selected ? " active" : ""}`}
                    onClick={() => setBookTab(t.id)}
                  >
                    {t.label}
                    <span className="spellbook-tab-count">{count}</span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="spellbook-list mmo-scroll" role="tabpanel">
            {bookIds.length === 0 && (
              <p className="spellbook-empty">
                No abilities yet — buy from the Trainer (west tent).
              </p>
            )}
            {tabIds.map((id) => (
              <SpellbookRow key={id} id={id} now={now} recasts={recasts} me={me} />
            ))}
          </div>
        </div>
      )}

      {questOpen && <QuestLogPanel entries={questLogEntries} onClose={closeQuestLog} />}

      <div style={{ flex: 1 }} />

      <div className="hud-bottom">
        <div className={`hud-log-frame hud-combat-log${leftPane === "map" ? " hud-pane-map" : ""}`}>
          <div className="hud-log-head">
            <span>{leftPane === "map" ? "Minimap" : "Combat Log"}</span>
            <div className="hud-pane-toggle" role="tablist" aria-label="Combat log or minimap">
              <button
                type="button"
                role="tab"
                aria-selected={leftPane === "log"}
                className={leftPane === "log" ? "active" : ""}
                onClick={() => {
                  lastCombatAt.current = Date.now();
                  leftPaneIntent.current = "log";
                  setLeftPane("log");
                }}
              >
                Log
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={leftPane === "map"}
                className={leftPane === "map" ? "active" : ""}
                onClick={() => {
                  leftPaneIntent.current = "map";
                  setLeftPane("map");
                  const next = persistUiPatch({ minimap: true });
                  lastMinimapSetting.current = next.minimap;
                }}
              >
                Map
              </button>
            </div>
          </div>
          {leftPane === "log" ? (
            <div className="hud-log-body mmo-scroll">
              {logs.map((l, i) => (
                <div key={`${i}-${l.slice(0, 24)}`} className={logClass(l)}>
                  {l}
                </div>
              ))}
              <div ref={logEnd} />
            </div>
          ) : (
            <div className="hud-minimap-well" aria-hidden>
              <canvas className="hud-minimap-canvas" />
            </div>
          )}
        </div>
        {mobileLayout ? (
          <div className="hud-action-mobile">
            <div className="hud-mobile-top">
              {meters}
              <button
                type="button"
                className={`hud-menu-btn hud-menu-btn-flow${menuOpen ? " open" : ""}${menuLocked ? " locked" : ""}`}
                aria-label={
                  menuLocked
                    ? "Commands menu locked. Hold to unlock."
                    : menuOpen
                      ? "Close commands menu. Hold to lock closed."
                      : "Commands menu. Hold to lock closed."
                }
                aria-expanded={menuOpen}
                aria-pressed={menuLocked}
                onPointerDown={onMenuPointerDown}
                onPointerUp={onMenuPointerUp}
                onPointerCancel={clearMenuHold}
                onClick={onMenuClick}
              >
                <span className="hud-menu-bars" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              </button>
            </div>
            <MobileArcadeControls
              potions={potions}
              onCastSlot={(index) => {
                const id = hotbarAbilityAt(index, 0);
                if (id) castAbility(id);
              }}
              onCastRest={() => {
                if (restUnlocked) castAbility("rest");
              }}
              onPotion={() => send({ type: "item/use", tokenId: ITEM.POTION })}
            />
          </div>
        ) : (
          <div className="hud-action-plate">
            {meters}
            <img className="hud-action-frame" src="/ui/hud/hotbar.png" alt="" draggable={false} />
            <CrescentFill kind="hp" src="/ui/hud/health.png" value={me.hp} max={me.maxHp} />
            <CrescentFill kind="mp" src="/ui/hud/mana.png" value={me.mp} max={me.maxMp} />
            <div
              className="hud-crescent-read hp"
              role="meter"
              aria-label="Health"
              aria-valuemin={0}
              aria-valuemax={me.maxHp}
              aria-valuenow={me.hp}
            >
              <span className="hud-crescent-k">HP</span>
              <span className="hud-crescent-n">{me.hp}</span>
              <span className="hud-crescent-m">/ {me.maxHp}</span>
            </div>
            <div
              className="hud-crescent-read mp"
              role="meter"
              aria-label="Mana"
              aria-valuemin={0}
              aria-valuemax={me.maxMp}
              aria-valuenow={me.mp}
            >
              <span className="hud-crescent-k">MP</span>
              <span className="hud-crescent-n">{me.mp}</span>
              <span className="hud-crescent-m">/ {me.maxMp}</span>
            </div>
            <div className="hud-aux-rows">
              <div className="hud-aux-row" aria-label="Alt hotbar">
                {hotbarRow3.map((id, i) => {
                  const slotIndex = HOTBAR_ROW_LEN * 2 + i;
                  return id ? (
                    <SkillButton
                      key={`r2-${i}`}
                      id={id}
                      keyLabel={HOTBAR_ALT_KEYS[i]}
                      now={now}
                      recasts={recasts}
                      me={me}
                      hotbarIndex={slotIndex}
                      onHotbarDrop={handleHotbarDrop}
                    />
                  ) : (
                    <EmptyHotbarSlot
                      key={`r2-${i}`}
                      keyLabel={HOTBAR_ALT_KEYS[i]!}
                      slotIndex={slotIndex}
                      onHotbarDrop={handleHotbarDrop}
                    />
                  );
                })}
              </div>
              <div className="hud-aux-row" aria-label="Shift hotbar">
                {hotbarRow2.map((id, i) => {
                  const slotIndex = HOTBAR_ROW_LEN + i;
                  return id ? (
                    <SkillButton
                      key={`r1-${i}`}
                      id={id}
                      keyLabel={HOTBAR_SHIFT_KEYS[i]}
                      now={now}
                      recasts={recasts}
                      me={me}
                      hotbarIndex={slotIndex}
                      onHotbarDrop={handleHotbarDrop}
                    />
                  ) : (
                    <EmptyHotbarSlot
                      key={`r1-${i}`}
                      keyLabel={HOTBAR_SHIFT_KEYS[i]!}
                      slotIndex={slotIndex}
                      onHotbarDrop={handleHotbarDrop}
                    />
                  );
                })}
              </div>
            </div>
            {hotbarRow1.map((id, i) => (
              <div key={`r0-${i}`} className="hud-action-well" style={hudWellStyle(i)}>
                {id ? (
                  <SkillButton
                    id={id}
                    keyLabel={HOTBAR_KEYS[i]}
                    now={now}
                    recasts={recasts}
                    me={me}
                    hotbarIndex={i}
                    onHotbarDrop={handleHotbarDrop}
                    appearance="well"
                  />
                ) : (
                  <EmptyHotbarSlot
                    keyLabel={HOTBAR_KEYS[i]!}
                    slotIndex={i}
                    onHotbarDrop={handleHotbarDrop}
                    appearance="well"
                  />
                )}
              </div>
            ))}
            <div className="hud-action-well" style={hudWellStyle(10)}>
              {restUnlocked ? (
                <SkillButton
                  id="rest"
                  keyLabel="R"
                  now={now}
                  recasts={recasts}
                  me={me}
                  draggable={false}
                  appearance="mark"
                />
              ) : (
                <div className="frame-locked" title="Rest is locked" />
              )}
            </div>
            <div className="hud-action-well" style={hudWellStyle(11)}>
              <div
                className="skill-wrap tip-above"
                onPointerLeave={(e) => e.currentTarget.classList.remove("tip-dismissed")}
                onPointerEnter={(e) => e.currentTarget.classList.remove("tip-dismissed")}
              >
                <button
                  type="button"
                  className="skill-slot frame-mark frame-potion"
                  aria-label={`Potion. Restore HP. Key Q. ${potions} left.`}
                  onClick={(e) => {
                    send({ type: "item/use", tokenId: ITEM.POTION });
                    e.currentTarget.closest(".skill-wrap")?.classList.add("tip-dismissed");
                    e.currentTarget.blur();
                  }}
                >
                  <span className="frame-potion-count">{potions}</span>
                </button>
                <div className="skill-tip" role="tooltip">
                  <div className="skill-tip-title">Potion</div>
                  <div className="skill-tip-body">
                    Drink to restore {getItem(ITEM.POTION)?.consume?.hp ?? 70} HP. Keep a stack for emergencies.
                  </div>
                  <div className="skill-tip-meta">Item · Key Q · ×{potions}</div>
                </div>
              </div>
            </div>
            {menuButton}
          </div>
        )}
        <div className="hud-log-frame hud-chat-log">
          <div className="hud-log-head">
            <span>Chat</span>
            <span className="hud-log-hints">Enter · /p party</span>
          </div>
          <div className="hud-log-body mmo-scroll">
            {chats.length === 0 && (
              <div className="hud-log-line system">No one has spoken nearby.</div>
            )}
            {chats.map((c) => (
              <div
                key={`${c.t}-${c.fromId}-${c.text.slice(0, 16)}`}
                className={`hud-log-line hud-chat-line ${c.channel}`}
              >
                {c.channel === "party" ? (
                  <span className="hud-chat-chan">[Party] </span>
                ) : null}
                <span className="hud-chat-name">{c.fromName}</span>
                <span className="hud-chat-sep">: </span>
                <span className="hud-chat-text">{c.text}</span>
              </div>
            ))}
            <div ref={chatEnd} />
          </div>
          <form
            className="hud-chat-compose"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              const parsed = parseChatCommand(chatDraft);
              if (!parsed) return;
              send({ type: "chat", text: parsed.text, channel: parsed.channel });
              setChatDraft("");
            }}
          >
            <input
              ref={chatInput}
              className="hud-chat-input"
              type="text"
              maxLength={CHAT_MAX_LEN}
              value={chatDraft}
              placeholder="Say…"
              aria-label="Chat message"
              autoComplete="off"
              onChange={(e) => setChatDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Escape") return;
                e.preventDefault();
                e.stopPropagation();
                chatInput.current?.blur();
              }}
            />
            <button type="submit" className="hud-chat-send">
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const CRES_TOP = 0.105066;
const CRES_SPAN = 0.592871;
const HUD_W = 1024;
const HUD_H = 533;

function liquidSurfacePoints(p: number, phase: number, amp: number, tilt: number) {
  const top = CRES_TOP * HUD_H;
  const span = CRES_SPAN * HUD_H;
  const bottom = top + span;
  const cut = top + span * (1 - Math.max(0, Math.min(1, p)));
  const n = 22;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    let y =
      cut +
      Math.sin(t * Math.PI * 5.5 + phase) * amp +
      Math.sin(t * Math.PI * 11 + phase * 1.3) * amp * 0.42 +
      Math.sin(t * Math.PI * 17 + phase * 0.7) * amp * 0.16 +
      (t - 0.5) * tilt;
    y = Math.min(bottom - 0.5, Math.max(top + 0.5, y));
    pts.push({ x: t * HUD_W, y });
  }
  return { pts, bottom };
}

function smoothThrough(pts: { x: number; y: number }[]) {
  if (pts.length === 0) return "";
  const p0 = pts[0]!;
  let d = `M${p0.x.toFixed(2)},${p0.y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i === 0 ? 0 : i - 1]!;
    const b = pts[i]!;
    const c = pts[i + 1]!;
    const e = pts[i + 2] ?? c;
    const c1x = b.x + (c.x - a.x) / 6;
    const c1y = b.y + (c.y - a.y) / 6;
    const c2x = c.x - (e.x - b.x) / 6;
    const c2y = c.y - (e.y - b.y) / 6;
    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${c.x.toFixed(2)},${c.y.toFixed(2)}`;
  }
  return d;
}

function liquidSurfacePath(p: number, phase: number, amp: number, tilt: number) {
  const { pts, bottom } = liquidSurfacePoints(p, phase, amp, tilt);
  return `M0,${bottom.toFixed(2)} ${smoothThrough(pts).replace(/^M/, "L")} L${HUD_W},${bottom.toFixed(2)} Z`;
}

function liquidSurfaceStroke(p: number, phase: number, amp: number, tilt: number) {
  return smoothThrough(liquidSurfacePoints(p, phase, amp, tilt).pts);
}

function CrescentFill({
  kind,
  src,
  value,
  max,
}: {
  kind: "hp" | "mp";
  src: string;
  value: number;
  max: number;
}) {
  const target = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sheet = useRef<HTMLImageElement | null>(null);
  const sim = useRef({ p: target, v: 0, target, phase: kind === "mp" ? 1.7 : 0, last: 0, raf: 0 });
  const paintRef = useRef<() => void>(() => {});
  const kickRef = useRef<() => void>(() => {});

  useEffect(() => {
    sim.current.target = target;
    if (prefersReducedMotion()) {
      sim.current.p = target;
      sim.current.v = 0;
      paintRef.current();
    } else {
      kickRef.current();
    }
  }, [target]);

  useEffect(() => {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      sheet.current = img;
      paintRef.current();
    };
    if (img.complete) {
      sheet.current = img;
      paintRef.current();
    }
  }, [src]);

  useEffect(() => {
    const s = sim.current;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const paint = () => {
      const canvas = canvasRef.current;
      const bmp = sheet.current;
      if (!canvas || !bmp) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const quiet = mq.matches;
      const amp = quiet ? 0 : 11 + Math.min(14, Math.abs(s.v) * 70);
      const tilt = quiet ? 0 : s.v * 28;
      const fill = liquidSurfacePath(s.p, s.phase, amp, tilt);
      ctx.clearRect(0, 0, HUD_W, HUD_H);
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.clip(new Path2D(fill));
      ctx.drawImage(bmp, 0, 0, HUD_W, HUD_H);
      ctx.globalCompositeOperation = "source-atop";
      ctx.strokeStyle = kind === "hp" ? "rgba(220, 255, 230, 0.32)" : "rgba(220, 244, 255, 0.32)";
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke(new Path2D(liquidSurfaceStroke(s.p, s.phase, amp, tilt)));
      ctx.restore();
      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(bmp, 0, 0, HUD_W, HUD_H);
      ctx.globalCompositeOperation = "source-over";
      canvas.classList.toggle("slosh", !quiet && Math.abs(s.v) > 0.012);
    };
    paintRef.current = paint;
    const stop = () => {
      if (s.raf) cancelAnimationFrame(s.raf);
      s.raf = 0;
    };
    const step = (now: number) => {
      const dt = s.last ? Math.min(0.033, (now - s.last) / 1000) : 1 / 60;
      s.last = now;
      if (mq.matches) {
        s.p = s.target;
        s.v = 0;
        paint();
        s.raf = 0;
        return;
      }
      s.v += (s.target - s.p) * 20 * dt - s.v * 8.4 * dt;
      s.p += s.v * dt;
      s.phase += dt * (1.55 + Math.min(3.2, Math.abs(s.v) * 7));
      paint();
      if (Math.abs(s.v) < 0.0008 && Math.abs(s.p - s.target) < 0.002) {
        s.v = 0;
        s.p = s.target;
        s.raf = 0;
        return;
      }
      s.raf = requestAnimationFrame(step);
    };
    const kick = () => {
      if (s.raf) return;
      s.last = 0;
      s.raf = requestAnimationFrame(step);
    };
    kickRef.current = kick;
    paint();
    if (!mq.matches) kick();
    const onMotion = () => {
      stop();
      s.last = 0;
      if (mq.matches) {
        s.p = s.target;
        s.v = 0;
        paint();
      } else {
        kick();
      }
    };
    mq.addEventListener("change", onMotion);
    return () => {
      stop();
      mq.removeEventListener("change", onMotion);
      paintRef.current = () => {};
    };
  }, [kind]);

  return (
    <canvas
      ref={canvasRef}
      className={`hud-action-fill ${kind}`}
      width={HUD_W}
      height={HUD_H}
      aria-hidden
    />
  );
}

function HudMeter({
  kind,
  label,
  value,
  max,
}: {
  kind: "tp" | "xp";
  label: string;
  value: number;
  max: number;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const read = kind === "tp" ? `${Math.round(pct)}%` : `${value} / ${max}`;
  const [tick, setTick] = useState(false);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    setTick(true);
    const id = window.setTimeout(() => setTick(false), 420);
    return () => window.clearTimeout(id);
  }, [value]);
  return (
    <div
      className={`hud-meter ${kind}${tick ? " tick" : ""}`}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <span className="hud-meter-k">{label}</span>
      <div className="hud-meter-track">
        <i style={{ width: `${pct}%` }} />
      </div>
      <span className="hud-meter-n">{read}</span>
    </div>
  );
}

function WalletConnectButton() {
  // AppKit hooks require createAppKit (appkit-config). When unset, fall back without hooks.
  if (appKitConfigured()) return <AppKitConnectButton />;
  return <FallbackConnectButton />;
}

/**
 * Docs path (https://docs.reown.com/appkit/overview): useAppKit().open.
 * Disconnected → Connect. Connected → Account (switch / disconnect).
 * Game hello runs once per address after AppKit reports connected.
 */
function AppKitConnectButton() {
  const pushLog = useGame((s) => s.pushLog);
  const sessionWallet = useGame((s) => s.wallet);
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { open: modalOpen } = useAppKitState();
  const [busy, setBusy] = useState(false);
  const [clickTick, setClickTick] = useState(0);
  const userClicked = useRef(false);
  const startedFor = useRef<string | null>(null);

  useEffect(() => {
    if (address && startedFor.current && startedFor.current !== address.toLowerCase()) {
      startedFor.current = null;
    }
    const sameWallet =
      !!address && !!sessionWallet && sessionWallet.toLowerCase() === address.toLowerCase();
    const liveNonBurner = !!address && !isStoredLocalBurnerWallet(address);
    const accountSwitch = !!sessionWallet && liveNonBurner && !sameWallet;
    if (
      !shouldAutoLoginAppKit({
        connected: isConnected,
        address,
        persisted: !!address && hasPersistedAuthForWallet(address),
        userClicked: userClicked.current,
        alreadyAuthed: isServerAuthed() && sameWallet,
        startedFor: startedFor.current,
        authInFlight: isAuthInFlight(),
        leftoverReplace:
          !!sessionWallet && isStoredLocalBurnerWallet(sessionWallet) && liveNonBurner,
        unsignedLive: !sessionWallet && liveNonBurner,
        accountSwitch,
      })
    ) {
      return;
    }
    const addr = address!.toLowerCase();
    const force = shouldForceWalletLogin(userClicked.current) || accountSwitch;
    startedFor.current = addr;
    userClicked.current = false;
    setBusy(true);
    void loginWithWalletConnect({
      appKitAlreadyOpen: true,
      ...(force ? { force: true } : {}),
    }).then((res) => {
      setBusy(false);
      if (!res.ok) {
        startedFor.current = null;
        pushLog("Wallet: " + res.error);
      } else pushLog("Wallet: " + walletControlLabel({ busy: false, connected: true, address: res.address }));
    });
  }, [isConnected, address, clickTick, pushLog, sessionWallet]);

  // User dismissed the modal without connecting.
  useEffect(() => {
    if (busy && !modalOpen && !isConnected && !startedFor.current) {
      setBusy(false);
      userClicked.current = false;
    }
  }, [busy, modalOpen, isConnected]);

  const view = appKitModalView(isConnected);
  if (shouldHideWalletControlWhileModal(modalOpen)) return null;
  return (
    <button
      type="button"
      data-wallet-control="appkit"
      className={["boot-primary", "boot-wallet", isConnected ? "is-connected" : ""]
        .filter(Boolean)
        .join(" ")}
      disabled={shouldDisableWalletControl(busy, isConnected)}
      onClick={() => {
        if (isConnected) {
          void open({ view: "Account" }).catch((err: unknown) => {
            pushLog("Wallet: " + (err instanceof Error ? err.message : String(err)));
          });
          return;
        }
        if (!shouldAcceptWalletConnectClick(busy)) return;
        userClicked.current = true;
        setBusy(true);
        setClickTick((n) => n + 1);
        void open({ view }).catch((err: unknown) => {
          setBusy(false);
          userClicked.current = false;
          pushLog("Wallet: " + (err instanceof Error ? err.message : String(err)));
        });
      }}
    >
      {walletControlLabel({ busy, connected: isConnected, address })}
    </button>
  );
}

function FallbackConnectButton() {
  const pushLog = useGame((s) => s.pushLog);
  const [busy, setBusy] = useState(false);
  if (!walletConnectLoginAvailable()) {
    return (
      <button
        type="button"
        className="boot-primary boot-wallet"
        data-wallet-control="unavailable"
        disabled
        style={{ opacity: 0.75 }}
        title="Set VITE_WALLETCONNECT_PROJECT_ID (Reown) in apps/stick-web/.env.local, or install a browser wallet"
      >
        Connect Wallet (set Reown project ID or install MetaMask)
      </button>
    );
  }
  return (
    <button
      type="button"
      className="boot-primary boot-wallet"
      data-wallet-control="fallback"
      disabled={busy}
      onClick={() => {
        if (!shouldAcceptWalletConnectClick(busy)) return;
        setBusy(true);
        void loginWithWalletConnect({ force: true }).then((res) => {
          setBusy(false);
          if (!res.ok) pushLog("Wallet: " + res.error);
          else pushLog("Wallet: " + res.address.slice(0, 6) + "…" + res.address.slice(-4));
        });
      }}
    >
      {busy ? "Opening wallet…" : "Connect Wallet"}
    </button>
  );
}

export function BootScreens() {
  const phase = useGame((s) => s.phase);
  const connected = useGame((s) => s.connected);
  const hasCharacter = useGame((s) => s.hasCharacter);
  const characterPreview = useGame((s) => s.characterPreview);
  const sessionWallet = useGame((s) => s.wallet);
  const leftover = !!sessionWallet && isStoredLocalBurnerWallet(sessionWallet);

  useEffect(() => {
    if (shouldKickLeftoverBurnerToAuth(sessionWallet, leftover)) {
      kickLeftoverBurnerToAuth();
    }
  }, [sessionWallet, leftover]);

  if (hideBootScreen(phase)) return null;

  const stayOnAuth = leftover || !connected || phase === "boot" || phase === "auth";

  return (
    <div className="boot-screen">
      <div className="boot-frame">
        <div className="boot-card">
          <h1 className="boot-brand">
            <img
              className="boot-brand-banner"
              src="/ui/black-anvil/slices/a1-title-banner.png"
              alt="Black Anvil"
            />
            <span className="boot-brand-fallback">Black Anvil</span>
          </h1>
          <WalletConnectButton />
          {stayOnAuth ? (
            <p className="boot-sub">
              {!connected
                ? "Connecting to server…"
                : leftover || phase === "auth"
                  ? "Connect a wallet to sign in."
                  : "Signing in…"}
            </p>
          ) : phase === "create" ? (
            <CreatePanel />
          ) : phase === "select" || hasCharacter ? (
            <SelectPanel preview={characterPreview} />
          ) : (
            <CreatePanel />
          )}
        </div>
      </div>
    </div>
  );
}

function appearanceLabel(g: string | undefined): string {
  if (g === "female") return "Female";
  if (g === "pepeka") return "Pepeka";
  return "Male";
}

function appearancePortrait(g: string | undefined): string {
  if (g === "female") return "/ui/boot/boot-portrait-female.png";
  if (g === "pepeka") return "/ui/boot/boot-portrait-pepeka.png";
  return "/ui/boot/boot-portrait-male.png";
}

function SelectPanel({
  preview,
}: {
  preview: {
    id?: string;
    name: string;
    job: JobId;
    level: number;
    gender?: "male" | "female" | "pepeka";
    tokenId?: string;
  } | null;
}) {
  const characters = useGame((s) => s.characters);
  const selectedCharId = useGame((s) => s.selectedCharId);
  const list =
    characters.length > 0
      ? characters
      : preview
        ? [
            {
              id: preview.id ?? "active",
              name: preview.name,
              job: preview.job,
              level: preview.level,
              gender: ("gender" in preview && preview.gender) || "male",
            },
          ]
        : [];
  const selected = list.find((c) => c.id === selectedCharId) ?? list[0] ?? null;

  return (
    <div className="boot-panel">
      <p className="boot-sub">Choose your adventurer</p>
      {list.length > 0 ? (
        <div className="boot-roster">
          {list.map((c) => {
            const jobName = JOBS[c.job]?.name ?? c.job;
            const active = selected?.id === c.id;
            const g = "gender" in c ? c.gender : "male";
            return (
              <button
                key={c.id}
                type="button"
                className={["boot-char-slot", active ? "selected" : ""].filter(Boolean).join(" ")}
                onClick={() => {
                  useGame.getState().setSelectedCharId(c.id);
                  useGame.getState().setCharacterPreview(c);
                }}
              >
                <img className="boot-char-portrait" src={appearancePortrait(g)} alt="" width={72} height={72} />
                <div className="boot-char-meta">
                  <div className="boot-char-name">
                    <span>{c.name}</span>
                    <span className="boot-char-level">Lv.{c.level}</span>
                  </div>
                  <div className="boot-char-detail">
                    {jobName} · {appearanceLabel(g)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="boot-sub">Reading characters from your wallet…</p>
      )}
      <button
        type="button"
        className="boot-primary"
        disabled={!selected}
        onClick={() => {
          useGame.getState().setPendingCreateEnter(false);
          useGame.getState().setPhase("play");
          send(characterEnterMessage(selected?.id));
        }}
      >
        Enter Black Anvil
      </button>
      <button
        type="button"
        className="boot-secondary"
        onClick={() => {
          useGame.getState().setPendingCreateEnter(false);
          useGame.getState().clearSnapshot();
          useGame.getState().setPhase("create");
        }}
      >
        Create new character
      </button>
    </div>
  );
}

type Appearance = "male" | "female" | "pepeka";

function CreatePanel() {
  const [job, setJob] = useState<JobId>("time_mage");
  const [gender, setGender] = useState<Appearance>("male");
  const [creating, setCreating] = useState(false);
  const characters = useGame((s) => s.characters);
  const pushLog = useGame((s) => s.pushLog);
  const mintCfg = useGame((s) => s.characterMint ?? s.snapshot?.you?.lok?.characterMint ?? null);
  const playableJobs = mintableStartingJobs(mintCfg?.startingJobs);
  const mintTimer = useRef<number | null>(null);
  const leftCreate = useRef(false);

  const cancelCreateMint = useCallback(() => {
    leftCreate.current = true;
    if (mintTimer.current != null) {
      window.clearTimeout(mintTimer.current);
      mintTimer.current = null;
    }
    useGame.getState().setPendingCreateEnter(false);
    setCreating(false);
  }, []);

  useEffect(() => {
    leftCreate.current = false;
    return () => {
      leftCreate.current = true;
      if (mintTimer.current != null) {
        window.clearTimeout(mintTimer.current);
        mintTimer.current = null;
      }
    };
  }, []);

  return (
    <form
      className="boot-panel"
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (creating) return;
        const fd = new FormData(e.currentTarget);
        const rawName = String(fd.get("name") || "Chrona");
        // M-C: same name rules as the server, before any payment.
        const named = normalizeCharacterName(rawName);
        if (!named.ok) {
          pushLog(named.error);
          return;
        }
        const name = named.name;
        if (characters.some((c) => characterNameKey(c.name) === named.key)) {
          pushLog("That name is already on your roster. Pick another.");
          return;
        }
        const jobIndex = JOB_IDS.indexOf(job);
        useGame.getState().setPendingCreateEnter(true);
        setCreating(true);

        const finish = (extra?: {
          tokenId?: string;
          mintWallet?: string;
          mintNonce?: string;
          mintExpiry?: number;
          mintSignature?: string;
          mintChainId?: number;
          mintCharId?: string;
        }) => {
          send({
            type: "char/create",
            name,
            job,
            gender,
            ...(extra?.tokenId ? { tokenId: extra.tokenId } : {}),
            ...(extra?.mintWallet ? { mintWallet: extra.mintWallet } : {}),
            ...(extra?.mintNonce ? { mintNonce: extra.mintNonce } : {}),
            ...(extra?.mintExpiry != null ? { mintExpiry: extra.mintExpiry } : {}),
            ...(extra?.mintSignature ? { mintSignature: extra.mintSignature } : {}),
            ...(extra?.mintChainId != null ? { mintChainId: extra.mintChainId } : {}),
            ...(extra?.mintCharId ? { mintCharId: extra.mintCharId } : {}),
          });
          setCreating(false);
        };

        if (!isServerAuthed()) {
          pushLog("Sign in before creating a character.");
          useGame.getState().setPendingCreateEnter(false);
          setCreating(false);
          return;
        }
        if (isStoredLocalBurnerWallet(useGame.getState().wallet ?? "")) {
          kickLeftoverBurnerToAuth();
          useGame.getState().setPendingCreateEnter(false);
          setCreating(false);
          return;
        }
        const pendingMint = readPendingMint(useGame.getState().wallet);
        void (
          shouldSkipCreateNameCheck(!!pendingMint)
            ? Promise.resolve({ ok: true as const })
            : checkCharacterNameAvailable(name)
        ).then((avail) => {
          if (!shouldRunCreateMint(leftCreate.current)) return;
          if (!avail.ok) {
            pushLog(avail.error);
            useGame.getState().setPendingCreateEnter(false);
            setCreating(false);
            return;
          }

          if (!mintCfg) {
            finish();
            return;
          }

          // Mint-first: pay native settlement fee, then create the log char bound to that NFT id.
          const gameWallet = useGame.getState().wallet;
          if (!gameWallet) {
            pushLog("Authenticate before creating a character.");
            useGame.getState().setPendingCreateEnter(false);
            setCreating(false);
            return;
          }
          if (mintCfg.devFaucet) send({ type: "dev/faucet" });
          mintTimer.current = window.setTimeout(() => {
            mintTimer.current = null;
            if (!shouldRunCreateMint(leftCreate.current)) return;
            void mintCharacterWithWallet({
              mint: mintCfg,
              job: jobIndex < 0 ? 0 : jobIndex,
              gameWallet,
              charId: name,
              allowReuse: true,
            }).then((res) => {
              if (!shouldRunCreateMint(leftCreate.current)) return;
              if (!res.ok) {
                pushLog("Character mint: " + res.error);
                useGame.getState().setPendingCreateEnter(false);
                setCreating(false);
                return;
              }
              {
                const unit = mintCfg.currency?.symbol ?? "xDAI";
                const txLink =
                  !res.reused && res.hash && res.hash !== "reuse"
                    ? explorerTxUrl(mintCfg.chainId, res.hash)
                    : "";
                pushLog(
                  (res.reused
                    ? "Reusing already-paid NFT #"
                    : "Paid character mint fee (native " +
                        unit +
                        "). Creating log identity for NFT #") +
                    res.tokenId +
                    "…" +
                    (txLink ? " " + txLink : ""),
                );
              }
              finish({
                tokenId: res.tokenId,
                ...(shouldSendMintWallet(res.payer, gameWallet)
                  ? { mintWallet: res.payer }
                  : {}),
                ...(res.mintSignature
                  ? {
                      mintNonce: res.mintNonce,
                      mintExpiry: res.mintExpiry,
                      mintSignature: res.mintSignature,
                      mintChainId: mintCfg.chainId,
                      mintCharId: res.charId,
                    }
                  : {}),
              });
              // M-F: also clear if the roster later shows this token (auth refresh / late snapshot).
              window.setTimeout(() => {
                const roster = useGame.getState().characters;
                if (
                  roster.some(
                    (c) => c.tokenId === res.tokenId || characterNameKey(c.name) === named.key,
                  )
                ) {
                  clearPendingMint(gameWallet);
                }
              }, 1500);
            });
          }, mintCfg.devFaucet ? 800 : 0);
        });
      }}
    >
      <p className="boot-sub">Create your adventurer</p>
      {mintCfg ? (
        <p className="boot-sub">
          Character NFT mint fee: {(Number(mintCfg.mintFee) / 1e18).toFixed(4)}{" "}
          {mintCfg.currency?.symbol ??
            (mintCfg.chainId === 100 || mintCfg.chainId === 10200 ? "xDAI" : "ETH")}
          . Paid from this wallet. If you already minted, Create binds that NFT and
          does not charge again
          {mintCfg.devFaucet ? ". Local faucet can fund the burner on anvil 31337." : ""}.
        </p>
      ) : null}
      <label className="boot-label">
        Character name
        <input name="name" defaultValue="Chrona" maxLength={16} className="boot-input" />
      </label>

      <div className="boot-section">
        <div className="boot-label">Appearance</div>
        <div className="boot-appearances" role="group" aria-label="Appearance">
          {(
            [
              { id: "male" as const, label: "Male", src: "/ui/boot/boot-portrait-male.png" },
              { id: "female" as const, label: "Female", src: "/ui/boot/boot-portrait-female.png" },
              { id: "pepeka" as const, label: "Pepeka", src: "/ui/boot/boot-portrait-pepeka.png" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={["boot-appearance", gender === opt.id ? "selected" : ""]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setGender(opt.id)}
            >
              <img src={opt.src} alt="" width={96} height={96} />
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      <FigurePreview job={job} gender={gender} size={160} className="boot-live-figure" />

      <label className="boot-label">
        Main job
        <div className="boot-job-scroll">
          <select
            className="boot-job-select"
            value={job}
            onChange={(e) => setJob(e.target.value as JobId)}
            aria-label="Main job"
          >
            {playableJobs.map((j) => (
              <option key={j} value={j}>
                {JOBS[j].name}
              </option>
            ))}
          </select>
        </div>
      </label>
      <p className="boot-hint">
        Lv.{SUBJOB_UNLOCK_LEVEL}+ unlocks a support job (half main level). Your sprite stays main.
        {JOBS.druid.playable && !playableJobs.includes("druid")
          ? " Druid is live at the Job Master; new Druid mints wait on factory job 7."
          : ""}
      </p>
      <button type="submit" className="boot-primary">
        {createSubmitLabel(JOBS[job]?.name ?? "Adventurer", !!mintCfg)}
      </button>
      {characters.length > 0 && (
        <button
          type="button"
          className="boot-secondary"
          onClick={() => {
            cancelCreateMint();
            useGame.getState().setPhase("select");
          }}
        >
          Back to character select
        </button>
      )}
    </form>
  );
}

/** Exported for App keybinds — row 0 = 1–0, row 1 = Shift+1–0, row 2 = Alt+1–0. */
export function hotbarAbilityAt(index: number, row = 0): AbilityId | null {
  return liveHotbarSlots[row * HOTBAR_ROW_LEN + index] ?? null;
}

export { castAbility, HOTBAR_KEYS };
