import { afterEach, describe, expect, it } from "vitest";
import { PerspectiveCamera } from "three";
import { FrustumManager } from "../utils/frustum-manager";
import { getVisibilityManager } from "../utils/centralized-visibility-manager";
import { createHexagonSceneLifecycleFixture } from "./hexagon-scene-lifecycle-fixture";

type ControlListener = () => void;

function createControlsHarness() {
  const listeners = new Map<string, Set<ControlListener>>();

  return {
    controls: {
      addEventListener(event: string, handler: ControlListener) {
        if (!listeners.has(event)) {
          listeners.set(event, new Set());
        }
        listeners.get(event)?.add(handler);
      },
      removeEventListener(event: string, handler: ControlListener) {
        listeners.get(event)?.delete(handler);
      },
    },
    listenerCount(event: string) {
      return listeners.get(event)?.size ?? 0;
    },
  };
}

describe("HexagonScene lifecycle", () => {
  afterEach(() => {
    getVisibilityManager().dispose();
  });

  it("disposes frustum and visibility managers during scene teardown", () => {
    const fixture = createHexagonSceneLifecycleFixture();

    fixture.destroy();

    expect(fixture.disposeCalls.frustumManager).toBe(1);
    expect(fixture.disposeCalls.visibilityManager).toBe(1);
  });

  it("detaches the previous visibility listener before reinitializing shared controls", () => {
    const firstHarness = createControlsHarness();
    const secondHarness = createControlsHarness();
    const camera = new PerspectiveCamera();
    const visibilityManager = getVisibilityManager();
    const frustumManager = new FrustumManager(camera, firstHarness.controls as never);

    visibilityManager.initialize(camera, firstHarness.controls as never);
    expect(firstHarness.listenerCount("change")).toBe(2);

    visibilityManager.initialize(camera, secondHarness.controls as never);

    expect(firstHarness.listenerCount("change")).toBe(1);
    expect(secondHarness.listenerCount("change")).toBe(1);

    frustumManager.dispose();
    visibilityManager.dispose();

    expect(firstHarness.listenerCount("change")).toBe(0);
    expect(secondHarness.listenerCount("change")).toBe(0);
  });
});
