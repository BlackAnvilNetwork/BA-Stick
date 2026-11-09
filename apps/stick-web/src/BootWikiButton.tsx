import { useGame } from "@bellgrave/client-core/state";
import { shouldKeepBootWiki } from "@bellgrave/ui/hud-leftovers";
import { useEffect, useState } from "react";
import { WikiPage } from "./WikiPage";

/** Bottom-corner wiki on boot / auth / roster; Commands Wiki in play. */
export function BootWikiButton() {
  const phase = useGame((s) => s.phase);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!shouldKeepBootWiki(phase) && phase !== "play") setOpen(false);
  }, [phase]);

  useEffect(() => {
    const onToggle = () => setOpen((v) => !v);
    window.addEventListener("bellgrave:toggle-wiki", onToggle);
    return () => window.removeEventListener("bellgrave:toggle-wiki", onToggle);
  }, []);

  const bootCorner = shouldKeepBootWiki(phase);

  return (
    <>
      {bootCorner ? (
        <button type="button" className="boot-wiki-corner" onClick={() => setOpen(true)} aria-label="Open wiki">
          Wiki
        </button>
      ) : null}
      {open ? <WikiPage onClose={() => setOpen(false)} /> : null}
    </>
  );
}
