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
    mesh: THREE.Group;
    pathObjects: Map<number, THREE.LineSegments>;
  };

  return {
    scene,
    subject,
    container: internals.mesh,
    pathObject: internals.pathObjects.get(1)!,
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
    expect(fixture.scene.children).toContain(fixture.container);
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
