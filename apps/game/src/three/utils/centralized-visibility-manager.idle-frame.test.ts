import { Box3, PerspectiveCamera, Sphere, Vector3, WebGLCoordinateSystem, WebGPUCoordinateSystem } from "three";
import { describe, expect, it, vi } from "vitest";

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
  it("does not recompute or notify listeners across idle frames", () => {
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
  it.each([WebGLCoordinateSystem, WebGPUCoordinateSystem])(
    "coalesces camera events and invalidates cached visibility for coordinate system %s",
    (coordinateSystem) => {
      const camera = new PerspectiveCamera(60, 1, 1, 100);
      camera.coordinateSystem = coordinateSystem;
      camera.updateProjectionMatrix();
      const controls = new MockControls();
      const manager = new CentralizedVisibilityManager();
      manager.initialize(camera, controls as never);
      const changed = vi.fn();
      manager.onChange(changed);
      manager.beginFrame();
      const point = new Vector3(0, 0, -5);
      expect(manager.isPointVisible(point)).toBe(true);
      // Between the eye and near plane must stay culled on both backends.
      expect(manager.isPointVisible(new Vector3(0, 0, -0.75))).toBe(false);
      camera.position.x = 100;
      for (let i = 0; i < 5; i++) controls.dispatchEvent({ type: "change" });
      expect(changed).toHaveBeenCalledTimes(1);
      manager.beginFrame();
      expect(changed).toHaveBeenCalledTimes(2);
      expect(manager.isPointVisible(point)).toBe(false);
      manager.dispose();
    },
  );

  it("does not reuse cached visibility or chunk registration after disposal", () => {
    const camera = new PerspectiveCamera(60, 1, 1, 100);
    const controls = new MockControls();
    const manager = new CentralizedVisibilityManager({ maxRegisteredChunks: 1 });
    manager.initialize(camera, controls as never);
    const point = new Vector3(0, 0, -5);
    const box = new Box3(point.clone().addScalar(-1), point.clone().addScalar(1));
    manager.registerChunk("old", { box, sphere: new Sphere(point.clone(), 1) });
    manager.beginFrame();
    expect(manager.isPointVisible(point)).toBe(true);
    manager.dispose();
    camera.position.x = 100;
    manager.initialize(camera, controls as never);
    manager.registerChunk("new", { box, sphere: new Sphere(point.clone(), 1) });
    manager.beginFrame();
    expect(manager.getRegisteredChunks()).toEqual(["new"]);
    expect(manager.isPointVisible(point)).toBe(false);
    manager.dispose();
  });
});
