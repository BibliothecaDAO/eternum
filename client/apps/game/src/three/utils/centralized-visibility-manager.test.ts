import { EventDispatcher, PerspectiveCamera } from "three";
import type { MapControls } from "three/examples/jsm/controls/MapControls.js";
import { describe, expect, it } from "vitest";
import { CentralizedVisibilityManager } from "./centralized-visibility-manager";

function createInitializedVisibilityManager() {
  const manager = new CentralizedVisibilityManager();
  const camera = new PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.set(0, 10, 10);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  const controls = new EventDispatcher() as MapControls;
  manager.initialize(camera, controls);

  return { manager, controls };
}

describe("CentralizedVisibilityManager", () => {
  it("does not notify listeners again for a clean frame", () => {
    const { manager } = createInitializedVisibilityManager();
    let listenerCalls = 0;

    manager.onChange(() => {
      listenerCalls += 1;
    });

    manager.beginFrame();
    manager.beginFrame();

    expect(listenerCalls).toBe(1);
    expect(manager.getStats().frameId).toBe(2);
  });

  it("recomputes after controls change marks visibility dirty", () => {
    const { manager, controls } = createInitializedVisibilityManager();
    let listenerCalls = 0;

    manager.onChange(() => {
      listenerCalls += 1;
    });

    manager.beginFrame();
    controls.dispatchEvent({ type: "change" });
    manager.beginFrame();

    expect(listenerCalls).toBe(2);
  });
});
