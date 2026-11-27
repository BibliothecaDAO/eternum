import { ASPECT_HEX } from "@/tokens";
import { BoxGeometry, Color, Group, type Material, Mesh, MeshStandardMaterial, PlaneGeometry } from "three";
import { describe, expect, it, vi } from "vitest";
import { DEEP_EMPTY_GEM, DEEP_SITE_SOURCES, DeepLandmarkModel, loadDeepLandmark } from "./deep-landmarks";
import { isProcgenMasonryMaterial } from "./procgen-masonry-material";

const { loadModel } = vi.hoisted(() => ({
  loadModel: vi.fn(async () => {
    const scene = new Group();
    const body = new Mesh(new BoxGeometry(1, 1.2, 1), new MeshStandardMaterial({ name: "stone" }));
    body.name = "archive_body";
    const gem = new Mesh(new BoxGeometry(0.2, 0.2, 0.2), new MeshStandardMaterial({ name: "deep_gem_mat" }));
    gem.name = "deep_gem";
    scene.add(body, gem);
    return { scene };
  }),
}));

vi.mock("../utils/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/utils")>()),
  gltfLoader: { loadAsync: loadModel },
}));
vi.mock("../utils/contact-shadow", () => ({
  getContactShadowResources: () => ({ geometry: new PlaneGeometry(1, 1), material: new MeshStandardMaterial() }),
}));

describe("deep landmark holder colours", () => {
  it("builds procedural Hyperstructure archive without gltfLoader, lights held socket gems from the Aspect palette, dims dormant masonry, and still loads remaining GLB sites", async () => {
    loadModel.mockClear();
    const activeScene = await loadDeepLandmark("foundation", 1);
    expect(loadModel).not.toHaveBeenCalled();
    const active = new DeepLandmarkModel(activeScene, 4, "Hyperstructure archive", 1);
    expect(active.instancedMeshes.some((mesh) => isProcgenMasonryMaterial(mesh.material as Material))).toBe(true);
    const glowMeshes = active.instancedMeshes.filter((mesh) => mesh.geometry.getAttribute("landmarkGlow"));
    expect(glowMeshes.length).toBe(1);
    active.setHolderColorAt(0, ASPECT_HEX[1]);
    active.setHolderColorAt(1, null);
    const attr = glowMeshes[0]!.geometry.getAttribute("landmarkGlow");
    const lit = glowMeshes[0]!.geometry.getAttribute("landmarkLit");
    const prowess = new Color(ASPECT_HEX[1]);
    const empty = new Color(DEEP_EMPTY_GEM);
    expect([attr.getX(0), attr.getY(0), attr.getZ(0)]).toEqual([
      Math.fround(prowess.r),
      Math.fround(prowess.g),
      Math.fround(prowess.b),
    ]);
    expect(lit.getX(0)).toBe(1);
    expect([attr.getX(1), attr.getY(1), attr.getZ(1)]).toEqual([
      Math.fround(empty.r),
      Math.fround(empty.g),
      Math.fround(empty.b),
    ]);
    expect(lit.getX(1)).toBe(0);
    const dormantScene = await loadDeepLandmark("foundation", 0);
    const dormant = new DeepLandmarkModel(dormantScene, 2, "Hyperstructure archive", 0);
    expect(dormant.instancedMeshes.some((mesh) => mesh.geometry.getAttribute("landmarkGlow"))).toBe(false);
    const dormantMasonry = dormant.instancedMeshes.find((mesh) => isProcgenMasonryMaterial(mesh.material as Material));
    expect(dormantMasonry).toBeDefined();
    expect((dormantMasonry!.material as MeshStandardMaterial).color.r).toBeCloseTo(0.58, 2);

    const glbCoreScene = await loadDeepLandmark("core", 1);
    expect(loadModel).toHaveBeenCalledWith(DEEP_SITE_SOURCES.core.glb);
    const glbCore = new DeepLandmarkModel(glbCoreScene, 2, "Essence core", 1);
    expect(glbCore.instancedMeshes.some((mesh) => mesh.geometry.getAttribute("landmarkGlow"))).toBe(true);

    active.dispose();
    active.dispose();
    dormant.dispose();
    glbCore.dispose();
  });
});
