import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BoxGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NoColorSpace,
  PlaneGeometry,
  SRGBColorSpace,
  Texture,
  Vector2,
} from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { FrostedStandardNodeMaterial } from "../effects/game-map-material-library";
import { createPooledInstancedMaterial, releasePooledInstancedMaterial } from "../managers/army-model-materials";
import InstancedModel from "../managers/instanced-model";
import { FrontierModel } from "../structures/frontier-model";
import { MaterialPool } from "../utils/material-pool";
import {
  createTripoModelMaterial,
  isTripoModelMaterial,
  isTripoModelMesh,
  isTripoTroopMaterial,
} from "./tripo-model-material";
import spec from "./tripo-model-material.json";
import { resolveTripoPbr } from "./tripo-pbr-rules.mjs";

vi.mock("../utils/contact-shadow", () => ({
  disposeContactShadowResources: vi.fn(),
  getContactShadowResources: () => ({
    geometry: new PlaneGeometry(1, 1),
    material: new MeshBasicMaterial({ color: 0x000000 }),
  }),
}));

describe("Tripo unified model material setup", () => {
  afterEach(() => {
    MaterialPool.getInstance().dispose();
  });

  it("enforces colour spaces, PBR bounds, doubleSided and bloom-safe emissive rules", () => {
    const baseMap = new Texture();
    baseMap.colorSpace = NoColorSpace;
    const emissiveMap = new Texture();
    emissiveMap.colorSpace = NoColorSpace;
    const normalMap = new Texture();
    normalMap.colorSpace = SRGBColorSpace;
    const aoMap = new Texture();
    aoMap.colorSpace = SRGBColorSpace;
    const roughnessMap = new Texture();
    roughnessMap.colorSpace = SRGBColorSpace;
    const metalnessMap = new Texture();
    metalnessMap.colorSpace = SRGBColorSpace;

    const structuralSource = new MeshStandardMaterial({
      map: baseMap,
      roughness: 0.9,
      metalness: 0,
      emissive: new Color(0x040404),
      emissiveIntensity: 1,
    });
    const structural = createTripoModelMaterial(structuralSource);

    expect(structural).toBeInstanceOf(FrostedStandardNodeMaterial);
    expect(isTripoModelMaterial(structural)).toBe(true);
    expect(baseMap.colorSpace).toBe(SRGBColorSpace);
    expect(structural.side).toBe(DoubleSide);
    expect(structural.roughness).toBe(spec.roughness.default);
    expect(structural.metalness).toBe(spec.metalness.default);
    expect(
      resolveTripoPbr(
        {
          roughness: 0.9,
          metalness: 0,
          hasRoughnessMap: false,
          hasMetalnessMap: false,
          hasNormalMap: false,
          normalScaleX: 1,
          normalScaleY: 1,
          hasEmissiveMap: false,
          emissivePeak: 0.01,
          emissiveIntensity: 1,
        },
        spec,
      ),
    ).toMatchObject({
      doubleSided: spec.doubleSided,
      roughness: spec.roughness.default,
      metalness: spec.metalness.default,
      hasEmissiveAccent: false,
      emissiveIntensity: 0,
    });
    expect(structural.emissive.getHex()).toBe(0x000000);
    expect(structural.emissiveIntensity).toBe(0);
    expect(structural.colorNode).not.toBeNull();
    expect(structural.aoNode).not.toBeNull();
    expect(structural.roughnessNode).not.toBeNull();
    expect(structural.metalnessNode).not.toBeNull();
    expect(structural.normalNode).not.toBeNull();
    structural.dispose();

    const authoredSource = new MeshStandardMaterial({
      map: baseMap,
      normalMap,
      normalScale: new Vector2(1.6, 1.6),
      aoMap,
      roughnessMap,
      metalnessMap,
      roughness: 0.1,
      metalness: 0.95,
      emissiveMap,
      emissive: new Color(0xff6622),
      emissiveIntensity: 8,
    });
    const authored = createTripoModelMaterial(authoredSource);

    expect(emissiveMap.colorSpace).toBe(SRGBColorSpace);
    expect(normalMap.colorSpace).toBe(NoColorSpace);
    expect(aoMap.colorSpace).toBe(NoColorSpace);
    expect(roughnessMap.colorSpace).toBe(NoColorSpace);
    expect(metalnessMap.colorSpace).toBe(NoColorSpace);
    expect(authored.roughness).toBe(spec.roughness.min);
    expect(authored.metalness).toBe(spec.metalness.max);
    expect(authored.normalScale.x).toBe(spec.normal.scale);
    expect(authored.normalScale.y).toBe(spec.normal.scale);
    expect(authored.aoMapIntensity).toBe(spec.ambientOcclusion.mapIntensity);
    expect(authored.emissiveIntensity).toBe(spec.emissive.maxIntensity);
    expect(authored.normalNode).toBeNull();
    expect(authored.roughnessNode).toBeNull();
    expect(authored.metalnessNode).toBeNull();
    authored.dispose();
  });

  it("routes shipped Tripo meshes through the unified material in InstancedModel while leaving legacy meshes pooled", () => {
    const tripoMesh = new Mesh(
      new BoxGeometry(0.5, 0.5, 0.5),
      new MeshStandardMaterial({ map: new Texture(), roughness: 0.9, metalness: 0 }),
    );
    tripoMesh.userData.assetKind = "building";
    expect(isTripoModelMesh(tripoMesh)).toBe(true);

    const tripoScene = new Group();
    tripoScene.add(tripoMesh);
    const tripoModel = new InstancedModel({ scene: tripoScene, animations: [] }, 4, false, "Storeroom");
    const resolvedTripo = tripoModel.instancedMeshes[0].material as FrostedStandardNodeMaterial;
    expect(resolvedTripo).toBeInstanceOf(FrostedStandardNodeMaterial);
    expect(isTripoModelMaterial(resolvedTripo)).toBe(true);
    expect(MaterialPool.getInstance().isManagedMaterial(resolvedTripo)).toBe(false);
    tripoModel.dispose();

    const legacyMesh = new Mesh(new BoxGeometry(0.5, 0.5, 0.5), new MeshStandardMaterial({ roughness: 0.85 }));
    expect(isTripoModelMesh(legacyMesh)).toBe(false);
    const legacyScene = new Group();
    legacyScene.add(legacyMesh);
    const legacyModel = new InstancedModel({ scene: legacyScene, animations: [] }, 4, false, "Legacy");
    const resolvedLegacy = legacyModel.instancedMeshes[0].material as MeshStandardMaterial;
    expect(MaterialPool.getInstance().isManagedMaterial(resolvedLegacy)).toBe(true);
    legacyModel.dispose();
  });

  it("composes FrontierModel phoenix glow onto a Tripo beast in rest pose without dropping Tripo shading nodes", () => {
    const mesh = new Mesh(
      new BoxGeometry(0.5, 0.5, 0.5),
      new MeshStandardMaterial({ map: new Texture(), roughness: 0.9, metalness: 0 }),
    );
    mesh.userData.assetKind = "beast";
    const scene = new Group();
    scene.add(mesh);

    const beast = new FrontierModel({ scene, animations: [] } as unknown as GLTF, 4, "troll");
    const material = beast.instancedMeshes[0].material as FrostedStandardNodeMaterial;
    expect(isTripoModelMaterial(material)).toBe(true);
    expect(material.colorNode).not.toBeNull();
    expect(material.aoNode).not.toBeNull();
    expect(material.roughnessNode).not.toBeNull();
    expect(material.normalNode).not.toBeNull();
    expect(material.positionNode).toBeNull();
    expect(material.emissiveNode).not.toBeNull();
    beast.dispose();
  });

  it("keeps Tripo troop materials lit with selective ownership cloth tinting and disposes them cleanly", () => {
    const source = new MeshStandardMaterial({ map: new Texture(), roughness: 0.9, metalness: 0 });
    source.userData.tripoMaterial = true;
    source.userData.ownershipCloth = true;

    const { material, usesInstanceColor } = createPooledInstancedMaterial(source);
    expect(material).toBeInstanceOf(FrostedStandardNodeMaterial);
    expect(isTripoModelMaterial(material as FrostedStandardNodeMaterial)).toBe(true);
    expect(isTripoTroopMaterial(material as FrostedStandardNodeMaterial)).toBe(true);
    expect(usesInstanceColor).toBe(true);

    const disposeSpy = vi.fn();
    (material as FrostedStandardNodeMaterial).addEventListener("dispose", disposeSpy);
    releasePooledInstancedMaterial(material);
    expect(disposeSpy).toHaveBeenCalledTimes(1);
  });
});
