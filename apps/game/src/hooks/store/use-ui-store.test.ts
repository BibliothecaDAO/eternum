// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useUIStore } from "./use-ui-store";

const resetCycleProgressState = () => {
  useUIStore.setState({
    cycleProgress: 0,
    debugCycleProgressOverride: null,
  });
};

describe("useUIStore cycle progress debug override", () => {
  beforeEach(() => {
    resetCycleProgressState();
  });

  afterEach(() => {
    resetCycleProgressState();
  });

  it("updates live cycle progress with clamped values", () => {
    useUIStore.getState().setCycleProgress(140);

    expect(useUIStore.getState().cycleProgress).toBe(100);
  });

  it("sets a clamped debug override and applies it to cycle progress", () => {
    useUIStore.getState().setDebugCycleProgressOverride(42);

    expect(useUIStore.getState().debugCycleProgressOverride).toBe(42);
    expect(useUIStore.getState().cycleProgress).toBe(42);

    useUIStore.getState().setDebugCycleProgressOverride(-1);

    expect(useUIStore.getState().debugCycleProgressOverride).toBe(0);
    expect(useUIStore.getState().cycleProgress).toBe(0);
  });

  it("clears the debug override without changing the current visible progress", () => {
    useUIStore.getState().setDebugCycleProgressOverride(37);
    useUIStore.getState().setDebugCycleProgressOverride(null);

    expect(useUIStore.getState().debugCycleProgressOverride).toBeNull();
    expect(useUIStore.getState().cycleProgress).toBe(37);
  });
});

describe("army deployment suggestion intent", () => {
  it("notifies only on deployment intent changes and clears after consumption", () => {
    const selected: Array<number | null> = [];
    const unsubscribe = useUIStore.subscribe(
      (state) => state.suggestedArmyDeploymentStructureId,
      (structureId) => selected.push(structureId),
    );
    try {
      useUIStore.getState().setSuggestedArmyDeploymentStructureId(42);
      useUIStore.getState().setPendingMilitaryAction({ structureId: 7, isExplorer: true });
      useUIStore.getState().setSuggestedArmyDeploymentStructureId(null);
      expect(selected).toEqual([42, null]);
      expect(useUIStore.getState().pendingMilitaryAction?.structureId).toBe(7);
    } finally {
      unsubscribe();
      useUIStore.getState().setSuggestedArmyDeploymentStructureId(null);
      useUIStore.getState().setPendingMilitaryAction(null);
    }
  });
});
