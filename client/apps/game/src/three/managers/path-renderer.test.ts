import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { PathRenderer } from "./path-renderer";
import { resolvePathReadabilityPolicy } from "../scenes/path-readability-policy";

// In the node test environment, requestAnimationFrame / cancelAnimationFrame
// are not available.  Provide lightweight stubs so the dirty-flag scheduling
// path inside PathRenderer works correctly.
let rafCallbacks: Array<{ id: number; fn: FrameRequestCallback }> = [];
let nextRafId = 1;

function stubRaf(fn: FrameRequestCallback): number {
  const id = nextRafId++;
  rafCallbacks.push({ id, fn });
  return id;
}

function stubCaf(id: number): void {
  rafCallbacks = rafCallbacks.filter((entry) => entry.id !== id);
}

/** Flush all pending rAF callbacks (simulates one animation frame). */
function flushRaf(): void {
  const pending = rafCallbacks.splice(0);
  pending.forEach((entry) => entry.fn(performance.now()));
}

beforeEach(() => {
  rafCallbacks = [];
  nextRafId = 1;
  globalThis.requestAnimationFrame = stubRaf as typeof globalThis.requestAnimationFrame;
  globalThis.cancelAnimationFrame = stubCaf;
});

afterEach(() => {
  // Clean up global stubs — avoid leaking between test files.
  delete (globalThis as Record<string, unknown>).requestAnimationFrame;
  delete (globalThis as Record<string, unknown>).cancelAnimationFrame;
});

/**
 * Helper: create a PathRenderer with one path and flush the deferred rebuild
 * so that batchObjects are populated.
 */
function createPathRendererFixture() {
  const scene = new THREE.Scene();
  const subject = new PathRenderer();
  subject.initialize(scene);
  subject.createPath(
    1,
    [new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(2, 0, 0)],
    new THREE.Color(0.2, 0.8, 1.0),
  );

  // Flush the deferred rebuild so batch objects are created.
  subject.update(0);

  const internals = subject as unknown as {
    batchObjects: Array<{ line: THREE.LineSegments }>;
    mesh: THREE.Group;
  };

  return {
    scene,
    subject,
    container: internals.mesh,
    pathObject: internals.batchObjects[0]!.line,
  };
}

describe("PathRenderer lifecycle", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("uses stock line materials for WebGPU-compatible path rendering", () => {
    const fixture = createPathRendererFixture();

    expect(fixture.container).toBeInstanceOf(THREE.Group);
    expect(fixture.pathObject).toBeInstanceOf(THREE.LineSegments);
    expect(fixture.pathObject.material).toBeInstanceOf(THREE.LineBasicMaterial);
    expect(fixture.pathObject.material).not.toBeInstanceOf(THREE.ShaderMaterial);
    expect((fixture.pathObject.material as THREE.LineBasicMaterial).opacity).toBe(
      resolvePathReadabilityPolicy({
        displayState: "selected",
        view: "medium",
      }).opacity,
    );
    expect(fixture.container.children).toHaveLength(1);
    expect(fixture.scene.children).toContain(fixture.container);
  });

  it("rebuilds multiple active paths through a bounded number of line batches", () => {
    const scene = new THREE.Scene();
    const subject = new PathRenderer({ maxSegments: 4 });
    subject.initialize(scene);

    subject.createPath(1, [new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(2, 0, 0)], new THREE.Color("#fff"), "moving");
    subject.createPath(2, [new THREE.Vector3(3, 0, 0), new THREE.Vector3(4, 0, 0), new THREE.Vector3(5, 0, 0)], new THREE.Color("#fff"), "moving");
    subject.createPath(3, [new THREE.Vector3(6, 0, 0), new THREE.Vector3(7, 0, 0)], new THREE.Color("#fff"), "selected");

    // Flush the deferred rebuild.
    subject.update(0);

    const internals = subject as unknown as {
      batchObjects: Array<{ entityIds: Set<number> }>;
    };

    expect(internals.batchObjects).toHaveLength(2);
    expect([...internals.batchObjects[0]!.entityIds]).toEqual([1, 2]);
    expect([...internals.batchObjects[1]!.entityIds]).toEqual([3]);
  });

  it("disposes owned line resources and detaches the scene container", () => {
    const fixture = createPathRendererFixture();
    const material = fixture.pathObject.material as THREE.LineBasicMaterial;
    const geometryDisposeSpy = vi.spyOn(fixture.pathObject.geometry, "dispose");
    const materialDisposeSpy = vi.spyOn(material, "dispose");

    fixture.subject.dispose();

    expect(geometryDisposeSpy).toHaveBeenCalledTimes(1);
    expect(materialDisposeSpy).toHaveBeenCalledTimes(1);
    expect(fixture.scene.children).not.toContain(fixture.container);
  });

  it("is idempotent and skips duplicate dispose work", () => {
    const fixture = createPathRendererFixture();
    const material = fixture.pathObject.material as THREE.LineBasicMaterial;
    const materialDisposeSpy = vi.spyOn(material, "dispose");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    fixture.subject.dispose();
    fixture.subject.dispose();

    expect(materialDisposeSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith("PathRenderer already disposed, skipping cleanup");
  });
});

describe("PathRenderer deferred batch rebuild (Stage 1)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("coalesces multiple setPathDisplayState calls into a single rebuild", () => {
    const scene = new THREE.Scene();
    const subject = new PathRenderer();
    subject.initialize(scene);

    // Create two paths and flush so batches exist.
    subject.createPath(1, [new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0)], new THREE.Color("#f00"), "moving");
    subject.createPath(2, [new THREE.Vector3(2, 0, 0), new THREE.Vector3(3, 0, 0)], new THREE.Color("#0f0"), "moving");
    subject.update(0);

    // Spy on the private rebuildPathBatches to count calls.
    const rebuildSpy = vi.spyOn(subject as unknown as { rebuildPathBatches: () => void }, "rebuildPathBatches");

    // Two state changes in the same synchronous block.
    subject.setPathDisplayState(1, "selected");
    subject.setPathDisplayState(2, "selected");

    // No rebuild yet — deferred.
    expect(rebuildSpy).not.toHaveBeenCalled();

    // Flush via update().
    subject.update(0);

    // Exactly one rebuild.
    expect(rebuildSpy).toHaveBeenCalledTimes(1);
  });

  it("coalesces createPath followed by setPathDisplayState into a single rebuild", () => {
    const scene = new THREE.Scene();
    const subject = new PathRenderer();
    subject.initialize(scene);

    const rebuildSpy = vi.spyOn(subject as unknown as { rebuildPathBatches: () => void }, "rebuildPathBatches");

    subject.createPath(1, [new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0)], new THREE.Color("#f00"), "moving");
    subject.setPathDisplayState(1, "selected");

    // Nothing rebuilt synchronously.
    expect(rebuildSpy).not.toHaveBeenCalled();

    // Flush.
    subject.update(0);

    expect(rebuildSpy).toHaveBeenCalledTimes(1);
  });

  it("defers rebuild to the next frame via rAF when update() is not called", () => {
    const scene = new THREE.Scene();
    const subject = new PathRenderer();
    subject.initialize(scene);

    subject.createPath(1, [new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0)], new THREE.Color("#f00"));

    const internals = subject as unknown as {
      batchObjects: Array<{ entityIds: Set<number> }>;
      _batchesDirty: boolean;
    };

    // Before rAF fires, batches are empty and flag is set.
    expect(internals.batchObjects).toHaveLength(0);
    expect(internals._batchesDirty).toBe(true);

    // Simulate the next animation frame.
    flushRaf();

    // After rAF, batches are populated and flag is cleared.
    expect(internals.batchObjects.length).toBeGreaterThan(0);
    expect(internals._batchesDirty).toBe(false);
  });

  it("removePath triggers a deferred rebuild", () => {
    const scene = new THREE.Scene();
    const subject = new PathRenderer();
    subject.initialize(scene);

    subject.createPath(1, [new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0)], new THREE.Color("#f00"));
    subject.update(0);

    const internals = subject as unknown as {
      batchObjects: Array<{ entityIds: Set<number> }>;
      _batchesDirty: boolean;
    };

    expect(internals.batchObjects).toHaveLength(1);

    subject.removePath(1);

    // Dirty but not yet rebuilt.
    expect(internals._batchesDirty).toBe(true);
    expect(internals.batchObjects).toHaveLength(1); // still old batches

    subject.update(0);

    expect(internals._batchesDirty).toBe(false);
    expect(internals.batchObjects).toHaveLength(0);
  });

  it("dirty flag is reset after rebuild", () => {
    const scene = new THREE.Scene();
    const subject = new PathRenderer();
    subject.initialize(scene);

    subject.createPath(1, [new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0)], new THREE.Color("#f00"));

    const internals = subject as unknown as { _batchesDirty: boolean };

    expect(internals._batchesDirty).toBe(true);

    subject.update(0);

    expect(internals._batchesDirty).toBe(false);

    // A subsequent update with no changes should not trigger a rebuild.
    const rebuildSpy = vi.spyOn(subject as unknown as { rebuildPathBatches: () => void }, "rebuildPathBatches");
    subject.update(0);
    expect(rebuildSpy).not.toHaveBeenCalled();
  });

  it("dispose cancels any pending deferred rebuild without errors", () => {
    const scene = new THREE.Scene();
    const subject = new PathRenderer();
    subject.initialize(scene);

    subject.createPath(1, [new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0)], new THREE.Color("#f00"));

    const internals = subject as unknown as {
      _batchesDirty: boolean;
      _rebuildFrameHandle: number | null;
    };

    // A rAF should be scheduled.
    expect(internals._rebuildFrameHandle).not.toBeNull();

    // Dispose should cancel it cleanly.
    subject.dispose();

    expect(internals._batchesDirty).toBe(false);
    expect(internals._rebuildFrameHandle).toBeNull();

    // Flushing rAF after dispose should be a no-op (callback was cancelled).
    expect(() => flushRaf()).not.toThrow();
  });

  it("getStats returns correct values after deferred rebuild", () => {
    const scene = new THREE.Scene();
    const subject = new PathRenderer();
    subject.initialize(scene);

    subject.createPath(1, [new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(2, 0, 0)], new THREE.Color("#f00"));

    // Before flush, stats should reflect active paths but zero batches.
    const statsBefore = subject.getStats();
    expect(statsBefore.activePaths).toBe(1);
    expect(statsBefore.batches).toBe(0);

    subject.update(0);

    const statsAfter = subject.getStats();
    expect(statsAfter.activePaths).toBe(1);
    expect(statsAfter.batches).toBe(1);
    expect(statsAfter.totalSegments).toBe(2);
  });
});
