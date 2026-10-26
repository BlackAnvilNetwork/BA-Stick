type Props = { gearId: string };

/** Live in-game gear draw (gear-viewer) — stick figure hidden via `gearOnly`. */
export function WikiGearPreview({ gearId }: Props) {
  const q = encodeURIComponent(gearId);
  const src = `./gear-viewer.html?embed=1&gearOnly=1&gear=${q}#${q}`;
  return (
    <div className="wiki-gear-preview">
      {/* key forces a reload when hopping between two gear items (hash-only src updates can stick). */}
      <iframe key={gearId} title={`${gearId} preview`} src={src} />
    </div>
  );
}
