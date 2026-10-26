/** Stops every boot-menu RAF / WASM loop (called when entering play). */
type BootMenuStop = () => void;

const stops = new Set<BootMenuStop>();

export function registerBootMenuLoop(stop: BootMenuStop): () => void {
  stops.add(stop);
  return () => {
    stops.delete(stop);
  };
}

export function stopBootMenuFx(): void {
  for (const stop of stops) {
    try {
      stop();
    } catch {
      /* ignore double-free */
    }
  }
  stops.clear();
}
