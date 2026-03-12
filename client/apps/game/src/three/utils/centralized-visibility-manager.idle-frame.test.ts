import { PerspectiveCamera } from "three";
import { describe, expect, it } from "vitest";

import { CentralizedVisibilityManager } from "./centralized-visibility-manager";

class MockControls {
  private listeners = new Map<string, Set<() => void>>();

  addEventListener(type: string, listener: () => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)?.add(listener);
  }

  removeEventListener(type: string, listener: () => void) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event: { type: string }) {
    this.listeners.get(event.type)?.forEach((listener) => listener());
  }
}

describe("CentralizedVisibilityManager idle frames", () => {
  it.fails("does not recompute or notify listeners across idle frames", () => {
    const camera = new PerspectiveCamera(60, 1, 0.1, 1000);
    camera.position.set(0, 5, 12);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);

    const controls = new MockControls();
    const manager = new CentralizedVisibilityManager();
    manager.initialize(camera, controls as never);

    let notifications = 0;
    manager.onChange(() => {
      notifications += 1;
    });

    manager.beginFrame();
    manager.beginFrame();
    manager.beginFrame();

    expect(notifications).toBe(1);
    expect(manager.getStats().frameId).toBe(3);

    manager.dispose();
  });
});
