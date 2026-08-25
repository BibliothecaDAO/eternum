import { beforeEach, describe, expect, it } from "vitest";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { getLiveWorldmapEntityActions, resetWorldmapEntityActions } from "./worldmap-interaction-state";

describe("worldmap interaction state", () => {
  beforeEach(() => {
    resetWorldmapEntityActions();
  });

  it("shows that cached UI store snapshots keep stale entity action state", () => {
    const cachedState = useUIStore.getState();

    useUIStore.getState().updateEntityActionSelectedEntityId(77);
    useUIStore.getState().updateEntityActionActionPaths(new Map([["1,1", []]]));

    expect(cachedState.entityActions.selectedEntityId).toBeNull();
    expect(cachedState.entityActions.actionPaths.size).toBe(0);
  });

  it("reads live entity action state through the worldmap helper", () => {
    useUIStore.getState().updateEntityActionSelectedEntityId(77);
    useUIStore.getState().updateEntityActionHoveredHex({ col: 5, row: 9 });
    useUIStore.getState().updateEntityActionActionPaths(new Map([["1,1", []]]));

    expect(getLiveWorldmapEntityActions()).toEqual({
      hoveredHex: { col: 5, row: 9 },
      actionPaths: new Map([["1,1", []]]),
      selectedEntityId: 77,
    });
  });

  it("resets hovered hex, selected entity, and action paths together", () => {
    useUIStore.getState().updateEntityActionSelectedEntityId(77);
    useUIStore.getState().updateEntityActionHoveredHex({ col: 5, row: 9 });
    useUIStore.getState().updateEntityActionActionPaths(new Map([["1,1", []]]));

    resetWorldmapEntityActions();

    expect(getLiveWorldmapEntityActions()).toEqual({
      hoveredHex: null,
      actionPaths: new Map(),
      selectedEntityId: null,
    });
  });
});
