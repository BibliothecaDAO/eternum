import { useUIStore } from "@/hooks/store/use-ui-store";

type WorldmapEntityActions = ReturnType<typeof useUIStore.getState>["entityActions"];

export function getLiveWorldmapEntityActions(): WorldmapEntityActions {
  return useUIStore.getState().entityActions;
}

export function resetWorldmapEntityActions(): void {
  useUIStore.setState((state) => ({
    entityActions: {
      ...state.entityActions,
      hoveredHex: null,
      actionPaths: new Map(),
      selectedEntityId: null,
    },
  }));
}
