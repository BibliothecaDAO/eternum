import { LeftView } from "@/types";

/** Only these navigation views mount a workspace over the map. */
export function resolveLeftViewSurface(view: LeftView): "build" | "military" | null {
  if (view === LeftView.ConstructionView) return "build";
  if (view === LeftView.MilitaryView) return "military";
  return null;
}
