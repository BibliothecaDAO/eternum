import { Box3, PerspectiveCamera, Sphere, Vector3 } from "three";
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

function makeBounds(x: number = 0, z: number = 0): { box: Box3; sphere: Sphere } {
  const box = new Box3(new Vector3(x - 1, 0, z - 1), new Vector3(x + 1, 1, z + 1));
  const sphere = new Sphere(new Vector3(x, 0.5, z), 1.5);
  return { box, sphere };
}

function createInitializedManager(maxRegisteredChunks: number = 50): CentralizedVisibilityManager {
  const camera = new PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.set(0, 5, 12);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  const controls = new MockControls();
  const manager = new CentralizedVisibilityManager({ maxRegisteredChunks });
  manager.initialize(camera, controls as never);
  return manager;
}

describe("CentralizedVisibilityManager registration order (Set-based)", () => {
  it("unregisterChunk removes a key via O(1) Set.delete", () => {
    const manager = createInitializedManager(1000);

    // Register many chunks
    const N = 1000;
    for (let i = 0; i < N; i++) {
      manager.registerChunk(`chunk_${i}`, makeBounds(i * 3));
    }

    // Unregister all — should complete quickly (O(1) per delete)
    const start = performance.now();
    for (let i = 0; i < N; i++) {
      manager.unregisterChunk(`chunk_${i}`);
    }
    const elapsed = performance.now() - start;

    // All chunks should be gone
    expect(manager.getRegisteredChunks().length).toBe(0);

    // Sanity: total time for 1000 O(1) deletes should be well under 100ms
    // (even on slow CI, 1000 Set.delete calls are sub-millisecond)
    expect(elapsed).toBeLessThan(100);

    manager.dispose();
  });

  it("registerChunk preserves insertion order", () => {
    const manager = createInitializedManager();

    manager.registerChunk("A", makeBounds(0));
    manager.registerChunk("B", makeBounds(3));
    manager.registerChunk("C", makeBounds(6));

    const registered = manager.getRegisteredChunks();
    // getRegisteredChunks uses chunkBounds (Map), which preserves insertion order
    expect(registered).toEqual(["A", "B", "C"]);

    manager.dispose();
  });

  it("enforceChunkLimit evicts the oldest registered chunk (FIFO)", () => {
    const manager = createInitializedManager(3);

    manager.registerChunk("A", makeBounds(0));
    manager.registerChunk("B", makeBounds(3));
    manager.registerChunk("C", makeBounds(6));

    // Registering a 4th chunk should evict "A" (the oldest)
    manager.registerChunk("D", makeBounds(9));

    expect(manager.hasChunk("A")).toBe(false);
    expect(manager.hasChunk("B")).toBe(true);
    expect(manager.hasChunk("C")).toBe(true);
    expect(manager.hasChunk("D")).toBe(true);

    manager.dispose();
  });

  it("duplicate registration does not create duplicate entries or break eviction", () => {
    const manager = createInitializedManager(3);

    manager.registerChunk("A", makeBounds(0));
    manager.registerChunk("B", makeBounds(3));
    // Re-register "A" — should not add a duplicate
    manager.registerChunk("A", makeBounds(0));
    manager.registerChunk("C", makeBounds(6));

    // With cap=3, all three should still be present (no spurious eviction from duplicates)
    expect(manager.hasChunk("A")).toBe(true);
    expect(manager.hasChunk("B")).toBe(true);
    expect(manager.hasChunk("C")).toBe(true);

    manager.dispose();
  });

  it("hasChunk works correctly after registration order changes", () => {
    const manager = createInitializedManager();

    manager.registerChunk("X", makeBounds(0));
    expect(manager.hasChunk("X")).toBe(true);

    manager.unregisterChunk("X");
    expect(manager.hasChunk("X")).toBe(false);

    // Re-register
    manager.registerChunk("X", makeBounds(0));
    expect(manager.hasChunk("X")).toBe(true);

    manager.dispose();
  });

  it("enforceChunkLimit evicts multiple oldest chunks when over capacity", () => {
    const manager = createInitializedManager(2);

    manager.registerChunk("A", makeBounds(0));
    manager.registerChunk("B", makeBounds(3));

    // Register two more — should evict A and B
    manager.registerChunk("C", makeBounds(6));
    manager.registerChunk("D", makeBounds(9));

    expect(manager.hasChunk("A")).toBe(false);
    expect(manager.hasChunk("B")).toBe(false);
    expect(manager.hasChunk("C")).toBe(true);
    expect(manager.hasChunk("D")).toBe(true);

    manager.dispose();
  });

  it("unregisterChunk on non-existent key is a no-op", () => {
    const manager = createInitializedManager();

    manager.registerChunk("A", makeBounds(0));
    // Should not throw
    manager.unregisterChunk("nonexistent");

    expect(manager.hasChunk("A")).toBe(true);
    expect(manager.getRegisteredChunks().length).toBe(1);

    manager.dispose();
  });
});
