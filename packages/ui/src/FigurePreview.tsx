import { createContext, useContext, type ComponentType } from "react";
import type { Equipment } from "@bellgrave/items";

export type FigurePreviewProps = {
  /** Protocol job id (e.g. "time_mage"). */
  job: string;
  gender?: "male" | "female" | "pepeka";
  /** Equipped catalog ids (paperdoll preview). */
  equip?: Partial<Equipment> | null;
  /** CSS px height. */
  size?: number;
  className?: string;
};

/**
 * Live character preview slot (#37). Clients that can render a figure
 * provide a component; without a provider the `fallback` (e.g. the static
 * boot portrait) is shown, so the old client is unchanged.
 */
export const FigurePreviewContext = createContext<ComponentType<FigurePreviewProps> | null>(null);

export function FigurePreview(props: FigurePreviewProps & { fallback?: React.ReactNode }) {
  const Impl = useContext(FigurePreviewContext);
  if (!Impl) return <>{props.fallback ?? null}</>;
  return <Impl {...props} />;
}
