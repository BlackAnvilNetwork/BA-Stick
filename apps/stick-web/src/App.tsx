import { useEffect } from "react";
import { ITEM, MENU_MUSIC, musicForZone } from "@bellgrave/config";
import { FigurePreviewContext } from "@bellgrave/ui/FigurePreview";
import { StickPreview } from "./StickPreview";
import { BootScreens, Hud, castAbility, hotbarAbilityAt, hotbarIndexFromCode } from "@bellgrave/ui/Hud";
import { connectSocket, send } from "@bellgrave/client-core/net";
import { useGame } from "@bellgrave/client-core/state";
import { enterZoneMusic, unlockZoneMusic } from "@bellgrave/ui/zoneMusic";
import { unlockCombatSfx } from "@bellgrave/ui/combatSfx";
import { toggleMinimap } from "@bellgrave/ui/uiSettings";
import { clearKeyboardMove } from "@bellgrave/ui/moveInput";
import { StickWorld } from "./StickWorld";
import { BootMenuBackdrop } from "./BootMenuBackdrop";
import { BootMenuHero } from "./BootMenuHero";
import { stopBootMenuFx } from "./boot-menu-runtime";
import { BootWikiButton } from "./BootWikiButton";

/** The @bellgrave/ui shell around the Stick Engine canvas. */
export function App() {
  const phase = useGame((s) => s.phase);
  const zoneId = useGame((s) => s.snapshot?.you.zoneId);

  useEffect(() => {
    connectSocket();
  }, []);

  const bootMenuBackdropMode =
    phase === "play" ? "off" : phase === "boot" || phase === "auth" ? "live" : "static";
  const bootMenuShell = bootMenuBackdropMode !== "off";
  const bootMenuHeroActive = phase === "select";

  useEffect(() => {
    if (phase === "play") stopBootMenuFx();
  }, [phase]);

  useEffect(() => {
    if (phase !== "play") {
      clearKeyboardMove();
      enterZoneMusic(MENU_MUSIC);
      return;
    }
    enterZoneMusic(musicForZone(zoneId));
  }, [phase, zoneId]);

  useEffect(() => {
    const unlock = () => {
      unlockZoneMusic();
      unlockCombatSfx();
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (useGame.getState().phase !== "play") return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const keyIdx = hotbarIndexFromCode(e.code);
      if (keyIdx != null) {
        e.preventDefault();
        const id = hotbarAbilityAt(keyIdx, e.shiftKey ? 1 : 0);
        if (id) castAbility(id);
        return;
      }
      if (e.key === "q" || e.key === "Q") send({ type: "item/use", tokenId: ITEM.POTION });
      if (e.key === "r" || e.key === "R") castAbility("rest");
      if (e.key === "b" || e.key === "B") window.dispatchEvent(new CustomEvent("bellgrave:toggle-bag"));
      if (e.key === "k" || e.key === "K") window.dispatchEvent(new CustomEvent("bellgrave:toggle-spellbook"));
      if (e.key === "c" || e.key === "C") window.dispatchEvent(new CustomEvent("bellgrave:toggle-craft"));
      if (e.code === "KeyM" && !e.ctrlKey && !e.metaKey && !e.altKey) toggleMinimap();
      if (e.key === "Escape") {
        if (useGame.getState().npcDialog) useGame.getState().setNpcDialog(null);
        else send({ type: "disengage" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      className={bootMenuShell ? "boot-forge-shell" : undefined}
      style={{ width: "100%", height: "100%", position: "relative" }}
    >
      {bootMenuShell && (
        <>
          <BootMenuBackdrop mode={bootMenuBackdropMode} />
          <BootMenuHero active={bootMenuHeroActive} />
        </>
      )}
      {phase === "play" && <StickWorld />}
      <div className="world-html-root" aria-hidden />
      <FigurePreviewContext.Provider value={StickPreview}>
        <BootScreens />
        <BootWikiButton />
        <Hud />
      </FigurePreviewContext.Provider>
    </div>
  );
}
