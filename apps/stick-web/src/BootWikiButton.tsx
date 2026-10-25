import { useGame } from "@bellgrave/client-core/state";
import { useState } from "react";
import { WikiPage } from "./WikiPage";

/** Bottom-corner wiki entry on boot / auth / character screens. */
export function BootWikiButton() {
  const phase = useGame((s) => s.phase);
  const [open, setOpen] = useState(false);

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
