import { useGame } from "@bellgrave/client-core/state";
import { shouldKeepBootWiki } from "@bellgrave/ui/hud-leftovers";
import { useEffect, useState } from "react";
import { WikiPage } from "./WikiPage";

/** Bottom-corner wiki entry on boot / auth / character screens. */
export function BootWikiButton() {
  const phase = useGame((s) => s.phase);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!shouldKeepBootWiki(phase)) setOpen(false);
  }, [phase]);

  if (phase === "play") return null;

  return (
    <>
      <button type="button" className="boot-wiki-corner" onClick={() => setOpen(true)} aria-label="Open wiki">
        Wiki
      </button>
      {open ? <WikiPage onClose={() => setOpen(false)} /> : null}
    </>
  );
}
