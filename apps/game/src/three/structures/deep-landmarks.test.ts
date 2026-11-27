import { ASPECT_HEX } from "@/tokens";
import { Color, type Material, MeshStandardMaterial, PlaneGeometry } from "three";
import { describe, expect, it, vi } from "vitest";
import { DEEP_EMPTY_GEM, DeepLandmarkModel, loadDeepLandmark } from "./deep-landmarks";
import { isProcgenMasonryMaterial } from "./procgen-masonry-material";

vi.mock("../utils/contact-shadow", () => ({
  getContactShadowResources: () => ({ geometry: new PlaneGeometry(1, 1), material: new MeshStandardMaterial() }),
}));

describe("deep landmark holder colours", () => {
  it("builds all four procedural Deep sites without gltfLoader, lights held socket gems from the Aspect palette, and dims dormant masonry", async () => {
    const activeScene = await loadDeepLandmark("foundation", 1);
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

    const coreScene = await loadDeepLandmark("core", 1);
    const core = new DeepLandmarkModel(coreScene, 2, "Essence core", 1);
    expect(core.instancedMeshes.some((mesh) => isProcgenMasonryMaterial(mesh.material as Material))).toBe(true);
    expect(core.instancedMeshes.some((mesh) => mesh.geometry.getAttribute("landmarkGlow"))).toBe(true);

    const mineScene = await loadDeepLandmark("mine", 1);
    const mine = new DeepLandmarkModel(mineScene, 2, "Ethereal mine", 1);
    expect(mine.instancedMeshes.some((mesh) => isProcgenMasonryMaterial(mesh.material as Material))).toBe(true);
    expect(mine.instancedMeshes.some((mesh) => mesh.geometry.getAttribute("landmarkGlow"))).toBe(true);

    const altarScene = await loadDeepLandmark("altar", 1);
    const altar = new DeepLandmarkModel(altarScene, 2, "Bane altar", 1);
    expect(altar.instancedMeshes.some((mesh) => isProcgenMasonryMaterial(mesh.material as Material))).toBe(true);
    expect(altar.instancedMeshes.some((mesh) => mesh.geometry.getAttribute("landmarkGlow"))).toBe(true);

    active.dispose();
    active.dispose();
    dormant.dispose();
    core.dispose();
    mine.dispose();
    altar.dispose();
  });
});
