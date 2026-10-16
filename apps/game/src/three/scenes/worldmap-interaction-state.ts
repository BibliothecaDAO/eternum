import { useUIStore } from "@/hooks/store/use-ui-store";

import { dropNextOrder } from "./worldmap-next-order";

type WorldmapEntityActions = ReturnType<typeof useUIStore.getState>["entityActions"];

export function getLiveWorldmapEntityActions(): WorldmapEntityActions {
  return useUIStore.getState().entityActions;
}

/** Clears the map's selection; a next order queued for the army that was selected leaves with it, traced. */
export function resetWorldmapEntityActions(): void {
  dropNextOrder("not-selected");
  useUIStore.getState().deselectEntity();
  useUIStore.setState((state) => ({
    entityActions: { ...state.entityActions, hoveredHex: null, actionPaths: new Map() },
  }));
}
