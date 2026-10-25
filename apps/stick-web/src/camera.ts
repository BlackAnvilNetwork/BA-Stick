/**
 * Client camera keys (#88). Gameplay stays on the ground plane: these only
 * change the view. M stays the minimap and is not a camera key.
 */
export type CameraKey = "cycle" | "toggle" | "left" | "right" | "up" | "down";

export function cameraKey(code: string): CameraKey | null {
  switch (code) {
    case "KeyV":
    case "Numpad5":
      return "cycle";
    case "NumpadDecimal":
      return "toggle";
    case "Numpad4":
      return "left";
    case "Numpad6":
      return "right";
    case "Numpad8":
      return "up";
    case "Numpad2":
      return "down";
    default:
      return null;
  }
}

export type LookHeld = { left: boolean; right: boolean; up: boolean; down: boolean };

/** Numpad look while a 3D mode is active. Mouse mode keeps the axes at rest. */
export function lookAxes(held: LookHeld, control: string | undefined, view: string | undefined): { yaw: number; pitch: number } {
  if (control === "mouse" || !view || view === "iso") return { yaw: 0, pitch: 0 };
  return {
    yaw: (held.right ? 1 : 0) - (held.left ? 1 : 0),
    pitch: (held.down ? 1 : 0) - (held.up ? 1 : 0),
  };
}

/** Renderer mode string from the settings dataset. Legacy `3d` is third person. */
export function camModeFromDataset(view: string | undefined): "iso" | "tp" | "fp" {
  if (view === "fp" || view === "first") return "fp";
  if (view === "tp" || view === "3d" || view === "third") return "tp";
  return "iso";
}
