import { Box3, Material, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, Texture, Vector3 } from "three";
import { describe, expect, it, vi } from "vitest";
import { isProcgenMasonryMaterial } from "./procgen-masonry-material";
import { isProceduralModelPath, resolveProceduralModel } from "./procedural-model-resolver";
import { createSpireKit, SPIRE_MODEL_PATH } from "./spire-kit";
import { SpireModel } from "./spire-model";

vi.mock("../utils/contact-shadow", () => ({
  getContactShadowResources: () => ({ geometry: new PlaneGeometry(), material: new MeshBasicMaterial() }),
}));

function collectMeshes(root: ReturnType<typeof createSpireKit>["scene"]): Mesh[] {
  const meshes: Mesh[] = [];
  root.traverse((node) => {
    if (node instanceof Mesh) meshes.push(node);
  });
  return meshes;
}

describe("procedural dimensional spire kit", () => {
  it("builds a three-draw spire with zero textures and exact part contracts", () => {
    const kit = createSpireKit();
    const meshes = collectMeshes(kit.scene);
    expect(SPIRE_MODEL_PATH).toBe("procedural:spire");
    expect(isProceduralModelPath(SPIRE_MODEL_PATH)).toBe(true);
    expect(resolveProceduralModel(SPIRE_MODEL_PATH)).not.toBeNull();
    expect(meshes).toHaveLength(3);

    const outcrop = meshes.find((mesh) => mesh.userData.spirePart === "outcrop");
    const spire = meshes.find((mesh) => mesh.userData.spirePart === "spire");
    const portal = meshes.find((mesh) => mesh.userData.spirePart === "portal");
    expect(outcrop).toBeDefined();
    expect(spire).toBeDefined();
    expect(portal).toBeDefined();

    expect(outcrop!.name.startsWith("OUTCROP")).toBe(true);
    expect(isProcgenMasonryMaterial(outcrop!.material as Material)).toBe(true);
    expect(isProcgenMasonryMaterial(spire!.material as Material)).toBe(true);
    expect(portal!.userData.trueSphereRadius).toBe(0.3);

    for (const mesh of meshes) {
      const material = mesh.material as unknown as Record<string, unknown>;
      for (const value of Object.values(material)) {
        expect(value instanceof Texture).toBe(false);
      }
      expect(mesh.scale.toArray()).toEqual([1, 1, 1]);
    }
  });

  it("keeps the rooted outcrop grounded, the shard above the portal, and mineral veins emitting", () => {
    const kit = createSpireKit();
    kit.scene.updateMatrixWorld(true);
    const meshes = collectMeshes(kit.scene);
    const outcrop = meshes.find((mesh) => mesh.userData.spirePart === "outcrop")!;
    const spire = meshes.find((mesh) => mesh.userData.spirePart === "spire")!;
    const portal = meshes.find((mesh) => mesh.userData.spirePart === "portal")!;

    const outcropBounds = new Box3().setFromObject(outcrop);
    expect(outcropBounds.min.y).toBeCloseTo(-0.006, 3);
    expect(outcropBounds.max.y).toBeGreaterThan(0.1);
    expect(outcropBounds.max.y).toBeLessThan(0.18);
    expect(outcropBounds.max.x - outcropBounds.min.x).toBeGreaterThan(1.1);
    expect(outcropBounds.max.x - outcropBounds.min.x).toBeLessThan(1.3);

    const spireBounds = new Box3().setFromObject(spire);
    expect(spireBounds.min.y).toBeGreaterThan(0.53 + 0.3 + 0.08);
    expect(spireBounds.max.y).toBeCloseTo(3.959, 3);

    const portalCenter = new Vector3().setFromMatrixPosition(portal.matrixWorld);
    expect(portalCenter.y).toBeCloseTo(0.53, 4);

    const veinAttr = spire.geometry.getAttribute("aSpireVein");
    expect(veinAttr).toBeDefined();
    let glowingVertices = 0;
    let stoneVertices = 0;
    for (let i = 0; i < veinAttr.count; i++) {
      const energy = veinAttr.getX(i) + veinAttr.getY(i) + veinAttr.getZ(i);
      if (energy > 0.1) glowingVertices++;
      else stoneVertices++;
    }
    expect(glowingVertices).toBeGreaterThan(20);
    expect(stoneVertices).toBeGreaterThan(glowingVertices);

    const outcropPos = outcrop.geometry.getAttribute("position");
    const outcropNorm = outcrop.geometry.getAttribute("normal");
    let signedVolume = 0;
    const index = outcrop.geometry.getIndex()!;
    const a = new Vector3();
    const b = new Vector3();
    const c = new Vector3();
    const cross = new Vector3();
    for (let i = 0; i < index.count; i += 3) {
      a.fromBufferAttribute(outcropPos, index.getX(i));
      b.fromBufferAttribute(outcropPos, index.getX(i + 1));
      c.fromBufferAttribute(outcropPos, index.getX(i + 2));
      signedVolume += a.dot(cross.crossVectors(b, c)) / 6;
    }
    expect(signedVolume).toBeGreaterThan(0);
    let upwardTopVertices = 0;
    for (let i = 0; i < outcropPos.count; i++) {
      if (outcropPos.getY(i) > 0.04 && outcropNorm.getY(i) > 0.5) upwardTopVertices++;
    }
    expect(upwardTopVertices).toBeGreaterThan(19);
  });

  it("provides a seamless eight-second hover loop compatible with SpireModel active and dormant placements", () => {
    const kit = createSpireKit();
    expect(kit.animations).toHaveLength(1);
    const [clip] = kit.animations;
    expect(clip.name).toBe("Spire_Loop");
    expect(clip.duration).toBe(8);
    expect(clip.tracks).toHaveLength(1);
    const values = clip.tracks[0].values;
    expect(Math.abs(values[0] - values[values.length - 1])).toBeLessThan(1e-6);

    const model = new SpireModel(kit, 2);
    expect(model.instancedMeshes).toHaveLength(2);
    expect(model.labelHeight).toBeCloseTo(3.959 + 0.25, 2);

    model.placeSpire(0, new Matrix4().makeTranslation(2, 0, 3), false);
    model.placeSpire(1, new Matrix4().makeTranslation(-2, 0, 3), true);
    model.setCount(2);
    model.updateAnimations(1.25);

    const orbTransform = new Matrix4();
    expect(model.getOrbTransform(0, orbTransform)).toBe(true);
    expect(new Vector3().setFromMatrixPosition(orbTransform).y).toBeCloseTo(0.53, 4);

    const portalGroups = model.group.children.filter((child) => child.name === "Spire dimensional portal");
    expect(portalGroups).toHaveLength(1);

    model.setOrbScale(0, 0.25);
    model.setOrbScale(0, 1);
    const meshes = collectMeshes(kit.scene);
    const geometrySpies = meshes.map((mesh) => vi.spyOn(mesh.geometry, "dispose"));
    const materialSpies = meshes.map((mesh) => vi.spyOn(mesh.material as Material, "dispose"));
    model.dispose();
    model.dispose();
    for (const spy of geometrySpies) expect(spy).toHaveBeenCalledOnce();
    for (const spy of materialSpies) expect(spy).toHaveBeenCalledOnce();
  });
});
