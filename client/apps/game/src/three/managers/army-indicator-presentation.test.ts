import { describe, expect, it, vi } from "vitest";

import {
  syncArmyIndicatorPresentationState,
  syncMovingArmyIndicatorPresentationState,
} from "./army-indicator-presentation";

describe("syncArmyIndicatorPresentationState", () => {
  it("caches the model y offset and updates the indicator with the resolved color", () => {
    const indicatorMetadataCache = new Map();
    const updateIndicator = vi.fn();

    syncArmyIndicatorPresentationState({
      entityId: 7,
      color: "#abc123",
      modelType: 4 as never,
      position: { x: 1, y: 2, z: 3 },
      indicatorMetadataCache,
      setIndicatorColor: (color) => ({ resolvedColor: color }),
      updateIndicator,
    });

    expect(indicatorMetadataCache.get(7)).toBeTypeOf("number");
    expect(updateIndicator).toHaveBeenCalledWith({
      entityId: 7,
      position: { x: 1, y: 2, z: 3 },
      color: { resolvedColor: "#abc123" },
      yOffset: indicatorMetadataCache.get(7),
    });
  });
});

describe("syncMovingArmyIndicatorPresentationState", () => {
  it("reuses cached y offset when a moving army indicator refreshes", () => {
    const indicatorMetadataCache = new Map([[9, 3.75]]);
    const updateIndicator = vi.fn();

    syncMovingArmyIndicatorPresentationState({
      entityId: 9,
      color: "#00ff00",
      position: { x: 4, y: 5, z: 6 },
      indicatorMetadataCache,
      setIndicatorColor: (color) => ({ resolvedColor: color }),
      updateIndicator,
    });

    expect(updateIndicator).toHaveBeenCalledWith({
      entityId: 9,
      position: { x: 4, y: 5, z: 6 },
      color: { resolvedColor: "#00ff00" },
      yOffset: 3.75,
    });
  });

  it("falls back to the default moving y offset when no cache entry exists", () => {
    const updateIndicator = vi.fn();

    syncMovingArmyIndicatorPresentationState({
      entityId: 11,
      color: "#ff00ff",
      position: { x: 7, y: 8, z: 9 },
      indicatorMetadataCache: new Map(),
      setIndicatorColor: (color) => ({ resolvedColor: color }),
      updateIndicator,
    });

    expect(updateIndicator).toHaveBeenCalledWith({
      entityId: 11,
      position: { x: 7, y: 8, z: 9 },
      color: { resolvedColor: "#ff00ff" },
      yOffset: 2.5,
    });
  });
});
