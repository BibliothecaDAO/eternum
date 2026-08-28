import { Vector3 } from "three";
import { describe, expect, it, vi } from "vitest";

import { isAnimationPositionVisible } from "./animation-visibility";

describe("animation visibility", () => {
  it("keeps positions visible without a culling context", () => {
    expect(isAnimationPositionVisible(new Vector3(100, 0, 100), undefined)).toBe(true);
  });

  it("requires both frustum and distance visibility", () => {
    const position = new Vector3(3, 0, 4);
    const visibilityManager = { isPointVisible: vi.fn(() => true) };

    expect(
      isAnimationPositionVisible(position, {
        cameraPosition: new Vector3(),
        maxDistance: 5,
        visibilityManager: visibilityManager as never,
      }),
    ).toBe(true);
    expect(
      isAnimationPositionVisible(position, {
        cameraPosition: new Vector3(),
        maxDistance: 4.99,
        visibilityManager: visibilityManager as never,
      }),
    ).toBe(false);

    visibilityManager.isPointVisible.mockReturnValue(false);
    expect(
      isAnimationPositionVisible(position, {
        cameraPosition: new Vector3(),
        maxDistance: 10,
        visibilityManager: visibilityManager as never,
      }),
    ).toBe(false);
  });

  it("uses the legacy frustum only when the centralized manager is unavailable", () => {
    const centralized = { isPointVisible: vi.fn(() => true) };
    const legacy = { isPointVisible: vi.fn(() => false) };

    expect(
      isAnimationPositionVisible(new Vector3(), {
        frustumManager: legacy as never,
        visibilityManager: centralized as never,
      }),
    ).toBe(true);
    expect(centralized.isPointVisible).toHaveBeenCalledOnce();
    expect(legacy.isPointVisible).not.toHaveBeenCalled();
  });
});
