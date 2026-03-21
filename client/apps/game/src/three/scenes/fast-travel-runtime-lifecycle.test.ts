import { describe, expect, it, vi } from "vitest";

import { resetFastTravelRuntimeState } from "./fast-travel-runtime-lifecycle";

describe("fast-travel runtime lifecycle", () => {
  it("clears fast-travel runtime state and cancels pending refresh work", () => {
    const clearTravelVisualGroups = vi.fn();
    const interactiveHexManager = { clearHexes: vi.fn() };
    const selectionPulseManager = { hideSelection: vi.fn() };
    const selectedHexManager = { resetPosition: vi.fn() };
    const pathRenderer = {
      removePath: vi.fn(),
      setSelectedPath: vi.fn(),
    };
    const clearTimeoutSpy = vi.fn();

    const result = resetFastTravelRuntimeState({
      currentHydratedChunk: { key: "hydrated" },
      currentRenderState: { key: "render" },
      currentEntityAnchors: [{ kind: "army", entityId: "army-1" }],
      sceneArmies: [{ entityId: "army-1" }],
      sceneSpires: [{ entityId: "spire-1" }],
      selectedArmyEntityId: "army-1",
      previewTargetHexKey: "10,10",
      currentChunk: "12,12",
      chunkRefreshTimeout: 77,
      clearTravelVisualGroups,
      interactiveHexManager,
      selectionPulseManager,
      selectedHexManager,
      pathRenderer,
      clearTimeout: clearTimeoutSpy,
      resolvePathEntityId: () => 404,
    });

    expect(clearTravelVisualGroups).toHaveBeenCalledTimes(1);
    expect(interactiveHexManager.clearHexes).toHaveBeenCalledTimes(1);
    expect(selectionPulseManager.hideSelection).toHaveBeenCalledTimes(1);
    expect(selectedHexManager.resetPosition).toHaveBeenCalledTimes(1);
    expect(pathRenderer.removePath).toHaveBeenCalledWith(404);
    expect(pathRenderer.setSelectedPath).toHaveBeenCalledWith(null);
    expect(clearTimeoutSpy).toHaveBeenCalledWith(77);
    expect(result).toEqual({
      currentHydratedChunk: null,
      currentRenderState: null,
      currentEntityAnchors: [],
      sceneArmies: [],
      sceneSpires: [],
      selectedArmyEntityId: null,
      previewTargetHexKey: null,
      currentChunk: "null",
      chunkRefreshTimeout: null,
      pendingChunkRefreshForce: false,
    });
  });
});
