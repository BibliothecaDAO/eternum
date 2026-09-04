import { BUILDINGS_GROUPS } from "@/three/constants";
import { BuildingType } from "@bibliothecadao/types";
import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { BuildingPreview } from "./building-preview";

vi.mock("@/three/sound/hover-sound", () => ({
  HoverSound: class {
    play() {}
  },
}));

function createTemplate(): {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
  model: THREE.Group;
} {
  const geometry = new THREE.BufferGeometry();
  const material = new THREE.MeshStandardMaterial({ color: "#ffffff" });
  const model = new THREE.Group();
  model.add(new THREE.Mesh(geometry, material));
  return { geometry, material, model };
}

describe("BuildingPreview", () => {
  it("loads lazily, dedupes by source, and only owns cloned materials", async () => {
    const scene = new THREE.Scene();
    const template = createTemplate();
    const load = vi.fn().mockResolvedValue(template.model);
    const preview = new BuildingPreview(scene, () => ({ cacheKey: "building/shared.glb", load }));
    const sourceGeometryDispose = vi.spyOn(template.geometry, "dispose");

    expect(load).not.toHaveBeenCalled();

    preview.setPreviewBuilding({ type: BuildingType.WorkersHut });
    await vi.waitFor(() => expect(scene.children).toHaveLength(1));

    const firstModel = scene.children[0] as THREE.Group;
    const firstMesh = firstModel.children[0] as THREE.Mesh;
    const clonedMaterial = firstMesh.material as THREE.MeshStandardMaterial;
    const clonedMaterialDispose = vi.spyOn(clonedMaterial, "dispose");

    expect(load).toHaveBeenCalledTimes(1);
    expect(firstMesh.geometry).toBe(template.geometry);
    expect(clonedMaterial).not.toBe(template.material);

    preview.clearPreviewBuilding();
    preview.setPreviewBuilding({ type: BuildingType.WorkersHut });
    await vi.waitFor(() => expect(scene.children).toHaveLength(1));
    expect(load).toHaveBeenCalledTimes(1);

    preview.dispose();

    expect(clonedMaterialDispose).toHaveBeenCalledTimes(1);
    expect(sourceGeometryDispose).not.toHaveBeenCalled();
  });

  it("does not attach a stale model after the selection changes", async () => {
    const scene = new THREE.Scene();
    const workers = createTemplate();
    const storehouse = createTemplate();
    let resolveWorkers: ((model: THREE.Group) => void) | undefined;
    const workersLoad = new Promise<THREE.Group>((resolve) => {
      resolveWorkers = resolve;
    });
    const preview = new BuildingPreview(scene, (group, building) => {
      expect(group).toBe(BUILDINGS_GROUPS.BUILDINGS);
      return building === BuildingType.WorkersHut
        ? { cacheKey: "workers.glb", load: () => workersLoad }
        : { cacheKey: "storehouse.glb", load: () => Promise.resolve(storehouse.model) };
    });

    preview.setPreviewBuilding({ type: BuildingType.WorkersHut });
    preview.setPreviewBuilding({ type: BuildingType.Storehouse });
    await vi.waitFor(() => expect(scene.children).toHaveLength(1));

    resolveWorkers!(workers.model);
    await Promise.resolve();
    await Promise.resolve();

    expect(scene.children).toHaveLength(1);
    expect(((scene.children[0] as THREE.Group).children[0] as THREE.Mesh).geometry).toBe(storehouse.geometry);
    preview.dispose();
  });

  it("releases a late material clone when teardown wins the load race", async () => {
    const scene = new THREE.Scene();
    const template = createTemplate();
    let finishLoad: ((model: THREE.Group) => void) | undefined;
    const load = new Promise<THREE.Group>((resolve) => {
      finishLoad = resolve;
    });
    const preview = new BuildingPreview(scene, () => ({ cacheKey: "late.glb", load: () => load }));
    const cloneSpy = vi.spyOn(template.material, "clone");
    const disposeSpy = vi.spyOn(THREE.MeshStandardMaterial.prototype, "dispose");

    preview.setPreviewBuilding({ type: BuildingType.WorkersHut });
    preview.dispose();
    finishLoad!(template.model);
    await vi.waitFor(() => expect(cloneSpy).toHaveBeenCalledTimes(1));

    expect(scene.children).toHaveLength(0);
    expect(disposeSpy).toHaveBeenCalledTimes(1);
  });
});
