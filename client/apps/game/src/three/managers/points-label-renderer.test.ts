import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { PointsLabelRenderer } from "./points-label-renderer";

describe("PointsLabelRenderer", () => {
  it("disposes geometry, material, and its sprite texture during teardown", () => {
    const scene = new THREE.Scene();
    const texture = new THREE.Texture();
    const subject = new PointsLabelRenderer(scene, texture);
    const ownedResources = subject as unknown as {
      geometry: { dispose(): void };
      material: { dispose(): void };
    };
    const geometryDisposeSpy = vi.spyOn(ownedResources.geometry, "dispose");
    const materialDisposeSpy = vi.spyOn(ownedResources.material, "dispose");
    const textureDisposeSpy = vi.spyOn(texture, "dispose");

    subject.dispose();

    expect(geometryDisposeSpy).toHaveBeenCalledTimes(1);
    expect(materialDisposeSpy).toHaveBeenCalledTimes(1);
    expect(textureDisposeSpy).toHaveBeenCalledTimes(1);
  });

  it("defers shared texture disposal until the last renderer releases it", () => {
    const scene = new THREE.Scene();
    const sharedTexture = new THREE.Texture();
    const first = new PointsLabelRenderer(scene, sharedTexture);
    const second = new PointsLabelRenderer(scene, sharedTexture);
    const textureDisposeSpy = vi.spyOn(sharedTexture, "dispose");

    first.dispose();
    expect(textureDisposeSpy).toHaveBeenCalledTimes(0);

    second.dispose();
    expect(textureDisposeSpy).toHaveBeenCalledTimes(1);
  });

  it("batches many removals behind one frustum refresh", () => {
    const scene = new THREE.Scene();
    const texture = new THREE.Texture();
    const renderer = new PointsLabelRenderer(scene, texture);
    const refreshSpy = vi.spyOn(renderer as any, "refreshFrustumVisibility");

    renderer.setPoint({ entityId: 1, position: new THREE.Vector3(0, 0, 0) });
    renderer.setPoint({ entityId: 2, position: new THREE.Vector3(1, 0, 0) });
    refreshSpy.mockClear();

    renderer.removeMany([1, 2]);

    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it("batches many additions behind one frustum refresh", () => {
    const scene = new THREE.Scene();
    const texture = new THREE.Texture();
    const renderer = new PointsLabelRenderer(scene, texture);
    const refreshSpy = vi.spyOn(renderer as any, "refreshFrustumVisibility");

    renderer.setMany([
      { entityId: 1, position: new THREE.Vector3(0, 0, 0) },
      { entityId: 2, position: new THREE.Vector3(1, 0, 0) },
      { entityId: 3, position: new THREE.Vector3(2, 0, 0) },
    ]);

    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });
});
