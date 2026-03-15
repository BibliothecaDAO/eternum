import { beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { PathRenderer } from "./path-renderer";
import { resolvePathReadabilityPolicy } from "../scenes/path-readability-policy";

function createPathRendererFixture() {
  const scene = new THREE.Scene();
  const subject = new PathRenderer();
  subject.initialize(scene);
  subject.createPath(
    1,
    [new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(2, 0, 0)],
    new THREE.Color(0.2, 0.8, 1.0),
  );

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
