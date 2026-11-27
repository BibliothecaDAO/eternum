import { Box3, Material, Matrix4, Mesh, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { ChestPresentation } from "../rewards/chest-presentation";
import { RewardTileModel } from "../rewards/reward-tile-model";
import { isProcgenMasonryMaterial } from "./procgen-masonry-material";
import { isProceduralModelPath, resolveProceduralModel } from "./procedural-model-resolver";
import {
  PROCEDURAL_CHEST_PATH,
  PROCEDURAL_RIFT_PATH,
  REWARD_CHEST_HEIGHT,
  REWARD_RIFT_HEIGHT,
  createArcaneChestKit,
  createEssenceRiftKit,
  isProceduralRewardTilePath,
  resolveProceduralRewardTileKit,
} from "./reward-tile-kit";

const HEX_APOTHEM = Math.sqrt(3) / 2;

function collectMeshes(root: { traverse: (cb: (obj: unknown) => void) => void }): Mesh[] {
  const meshes: Mesh[] = [];
  root.traverse((obj) => {
    if (obj instanceof Mesh) meshes.push(obj);
  });
  return meshes;
}

function firstMaterial(mesh: Mesh): Material {
  return Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
}

function assertInsideUnitHex(root: { traverse: (cb: (obj: unknown) => void) => void }): void {
  const point = new Vector3();
  for (const mesh of collectMeshes(root)) {
    mesh.updateMatrixWorld(true);
    const pos = mesh.geometry.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      point.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      expect(Math.abs(point.x)).toBeLessThanOrEqual(HEX_APOTHEM + 0.02);
      expect(Math.abs(point.x) + Math.sqrt(3) * Math.abs(point.z)).toBeLessThanOrEqual(2 * HEX_APOTHEM + 0.04);
    }
  }
}

describe("procedural reward tile kits", () => {
  it("resolves both reward tile paths through the unified procedural kit registry with <= 3 draws and zero textures", () => {
    expect(isProceduralRewardTilePath(PROCEDURAL_RIFT_PATH)).toBe(true);
    expect(isProceduralRewardTilePath(PROCEDURAL_CHEST_PATH)).toBe(true);
    expect(isProceduralRewardTilePath("/models/reward-tiles/rift.glb")).toBe(false);
    expect(isProceduralModelPath(PROCEDURAL_RIFT_PATH)).toBe(true);
    expect(isProceduralModelPath(PROCEDURAL_CHEST_PATH)).toBe(true);
    expect(resolveProceduralRewardTileKit("/models/other.glb")).toBeNull();
    expect(resolveProceduralModel("/models/other.glb")).toBeNull();

    const rift = resolveProceduralModel(PROCEDURAL_RIFT_PATH)!;
    const chest = resolveProceduralModel(PROCEDURAL_CHEST_PATH)!;
    const riftMeshes = collectMeshes(rift.scene);
    const chestMeshes = collectMeshes(chest.scene);

    expect(riftMeshes.length).toBe(2);
    expect(chestMeshes.length).toBe(1);
    expect(riftMeshes.length + chestMeshes.length).toBeLessThanOrEqual(3);

    for (const mesh of [...riftMeshes, ...chestMeshes]) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        for (const value of Object.values(mat)) {
          expect(Boolean(value && typeof value === "object" && "isTexture" in value)).toBe(false);
        }
      }
    }

    expect(riftMeshes.some((mesh) => isProcgenMasonryMaterial(firstMaterial(mesh)))).toBe(true);
    expect(chestMeshes.some((mesh) => isProcgenMasonryMaterial(firstMaterial(mesh)))).toBe(true);
  });

  it("grounds both kits inside the unit hex and clears overhead plates", () => {
    const rift = createEssenceRiftKit();
    rift.scene.updateMatrixWorld(true);
    const riftBox = new Box3().setFromObject(rift.scene);
    expect(riftBox.min.y).toBeGreaterThanOrEqual(-0.01);
    expect(riftBox.min.y).toBeLessThanOrEqual(0.01);
    expect(riftBox.max.y).toBeGreaterThan(0.32);
    expect(riftBox.max.y).toBeLessThanOrEqual(REWARD_RIFT_HEIGHT + 0.05);
    assertInsideUnitHex(rift.scene);

    const chest = createArcaneChestKit();
    chest.scene.updateMatrixWorld(true);
    const chestBox = new Box3().setFromObject(chest.scene);
    expect(chestBox.min.y).toBeGreaterThanOrEqual(-0.01);
    expect(chestBox.min.y).toBeLessThanOrEqual(0.01);
    expect(chestBox.max.y).toBeGreaterThan(0.75);
    expect(chestBox.max.y).toBeLessThanOrEqual(REWARD_CHEST_HEIGHT + 0.05);
    assertInsideUnitHex(chest.scene);
  });

  it("integrates Essence Rift with RewardTileModel night presentation and Arcane Chest with ChestPresentation", () => {
    const riftModel = new RewardTileModel(createEssenceRiftKit(), 4);
    expect(riftModel.instancedMeshes.length).toBe(2);
    riftModel.setMatrixAt(0, new Matrix4());
    riftModel.setCount(1);
    riftModel.updatePresentation(1);
    const vortex = riftModel.instancedMeshes.find((mesh) => mesh.name === "essence-rift:vortex")!;
    const nightUniform = (vortex.material as { userData?: { nightAmount?: { value: number } } }).userData?.nightAmount;
    expect(nightUniform?.value).toBe(1);
    riftModel.updatePresentation(0);
    expect(nightUniform?.value).toBe(0);
    riftModel.dispose();

    const chest = createArcaneChestKit();
    const body = chest.scene.getObjectByName("ChestBody")!;
    const bodyMesh = collectMeshes(body)[0];
    const originalMaterial = firstMaterial(bodyMesh);
    const presentation = new ChestPresentation(chest.scene);
    const cameraPos = new Vector3(-1.8, 1.55, 2.1);
    presentation.faceCamera(cameraPos);

    expect(firstMaterial(bodyMesh)).toBe(originalMaterial);
    expect(body.scale.x).toBeCloseTo(0.7, 5);
    expect(body.parent).not.toBe(chest.scene);
    expect(body.parent!.rotation.y).toBeCloseTo(Math.atan2(cameraPos.x, cameraPos.z), 5);
    presentation.dispose();
  });
});
