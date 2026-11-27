import { aspects } from "@bibliothecadao/types";
import { BoxGeometry, Color, Group, Mesh, MeshStandardMaterial } from "three";
import type MaterialReferenceNode from "three/src/nodes/accessors/MaterialReferenceNode.js";
import type Node from "three/src/nodes/core/Node.js";
import { describe, expect, it } from "vitest";
import { FrostedStandardNodeMaterial } from "../effects/game-map-material-library";
import InstancedModel from "../managers/instanced-model";
import { createHyperstructureKit } from "./hyperstructure-kit";
import { HyperstructureModel } from "./hyperstructure-model";
import {
  HYPERSTRUCTURE_CHANNEL_GLOW,
  PROCGEN_ASPECT_GLOW_STYLES,
  createProcgenGlowMaterial,
} from "./procgen-glow-material";
import { createAspectWonderKit, createSeasonOneRealmKit } from "./realm-kit";

describe("shared procedural glow node material", () => {
  it("builds a textureless FrostedStandardNodeMaterial with one shared program cache key across all presets", () => {
    const materials = [
      ...aspects.map(({ id }) =>
        createProcgenGlowMaterial({
          emissive: "#ff8844",
          emissiveIntensity: 1.4,
          ...PROCGEN_ASPECT_GLOW_STYLES[id],
        }),
      ),
      createProcgenGlowMaterial(HYPERSTRUCTURE_CHANNEL_GLOW),
    ];

    const sharedKey = materials[0]!.customProgramCacheKey();
    expect(sharedKey).toBe("eternum-procgen-glow-v1");

    for (const material of materials) {
      expect(material).toBeInstanceOf(FrostedStandardNodeMaterial);
      expect(material.vertexColors).toBe(true);
      expect(material.flatShading).toBe(false);
      expect(material.map).toBeNull();
      expect(material.emissiveNode).not.toBeNull();
      expect(material.customProgramCacheKey()).toBe(sharedKey);
      material.dispose();
    }
  });

  it("is preserved directly by InstancedModel without MaterialPool flattening", () => {
    const scene = new Group();
    const material = createProcgenGlowMaterial(HYPERSTRUCTURE_CHANNEL_GLOW);
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), material);
    mesh.name = "glow";
    scene.add(mesh);

    const model = new InstancedModel({ scene, animations: [] }, 2, false, "Realm");
    expect(model.instancedMeshes[0]!.material).toBe(material);
    expect(model.instancedMeshes[0]!.material).toBeInstanceOf(FrostedStandardNodeMaterial);
    model.dispose();
  });

  it("wires one shared TSL glow pipeline across Season 1 realms, Aspect Wonders, and Hyperstructure channels", () => {
    const keys = new Set<string>();

    for (const { id: aspect } of aspects) {
      for (const kit of [createSeasonOneRealmKit(aspect, 3), createAspectWonderKit(aspect, 3)]) {
        const glowMesh = kit.scene.children.find((child) => child.name.endsWith(":glow")) as Mesh | undefined;
        expect(glowMesh).toBeDefined();
        const mat = glowMesh!.material as FrostedStandardNodeMaterial;
        expect(mat).toBeInstanceOf(FrostedStandardNodeMaterial);
        expect(mat.flatShading).toBe(false);
        expect(mat.emissiveNode).not.toBeNull();
        keys.add(mat.customProgramCacheKey());
        for (const child of kit.scene.children) {
          if (child instanceof Mesh) {
            child.geometry.dispose();
            (child.material as MeshStandardMaterial).dispose();
          }
        }
      }
    }

    const hsKit = createHyperstructureKit();
    const channels = hsKit.scene.getObjectByName("channels") as Mesh;
    expect(channels.material).toBeInstanceOf(FrostedStandardNodeMaterial);
    keys.add((channels.material as FrostedStandardNodeMaterial).customProgramCacheKey());
    for (const child of hsKit.scene.children) {
      if (child instanceof Mesh) child.geometry.dispose();
    }

    const hsModel = new HyperstructureModel(2);
    const hsChannels = hsModel.instancedMeshes.find((mesh) => mesh.name === "channels")!;
    expect(hsChannels.material).toBeInstanceOf(FrostedStandardNodeMaterial);
    hsModel.dispose();

    expect(keys.size).toBe(1);
  });

  it("resolves distinct per-material emissive and style properties dynamically through MaterialReferenceNodes", () => {
    const prowess = createProcgenGlowMaterial({
      emissive: "#d88a24",
      emissiveIntensity: 1.35,
      ...PROCGEN_ASPECT_GLOW_STYLES[1],
    });
    const channels = createProcgenGlowMaterial(HYPERSTRUCTURE_CHANNEL_GLOW);

    expect(prowess.customProgramCacheKey()).toBe(channels.customProgramCacheKey());
    expect(prowess.emissiveNode).toBe(channels.emissiveNode);

    const refs = new Map<string, MaterialReferenceNode>();
    const visit = (node: unknown, seen: Set<unknown>): void => {
      if (!node || typeof node !== "object" || seen.has(node)) return;
      seen.add(node);
      const candidate = node as Partial<MaterialReferenceNode> & { traverse?: (cb: (child: Node) => void) => void };
      if (candidate.isMaterialReferenceNode && typeof candidate.property === "string") {
        refs.set(candidate.property, candidate as MaterialReferenceNode);
      }
      if (typeof candidate.traverse === "function") {
        candidate.traverse((child) => {
          const ref = child as Partial<MaterialReferenceNode>;
          if (ref.isMaterialReferenceNode && typeof ref.property === "string") {
            refs.set(ref.property, ref as MaterialReferenceNode);
          }
        });
      }
    };
    visit(prowess.emissiveNode, new Set());

    const expectedProps = [
      "emissive",
      "emissiveIntensity",
      "glowPulseSpeed",
      "glowPulseDepth",
      "glowFissureWeight",
      "glowFissureHotColor",
      "glowFoldLightWeight",
    ];
    for (const prop of expectedProps) {
      const ref = refs.get(prop);
      expect(ref).toBeDefined();
      expect(ref!.object).toBeNull();
    }

    const readFor = (material: FrostedStandardNodeMaterial, prop: string): unknown => {
      const ref = refs.get(prop)!;
      ref.updateReference({ material } as never);
      return (ref.reference as unknown as Record<string, unknown>)[prop];
    };

    expect((readFor(prowess, "emissive") as Color).getHexString()).toBe("d88a24");
    expect((readFor(channels, "emissive") as Color).getHexString()).toBe("258d87");
    expect(readFor(prowess, "emissiveIntensity")).toBe(1.35);
    expect(readFor(channels, "emissiveIntensity")).toBe(HYPERSTRUCTURE_CHANNEL_GLOW.emissiveIntensity);
    expect(readFor(prowess, "glowPulseSpeed")).toBe(PROCGEN_ASPECT_GLOW_STYLES[1].pulseSpeed);
    expect(readFor(channels, "glowPulseSpeed")).toBe(HYPERSTRUCTURE_CHANNEL_GLOW.pulseSpeed);
    expect(readFor(prowess, "glowFissureWeight")).toBe(PROCGEN_ASPECT_GLOW_STYLES[1].fissureWeight);
    expect(readFor(channels, "glowFissureWeight")).toBe(HYPERSTRUCTURE_CHANNEL_GLOW.fissureWeight);
    expect((readFor(prowess, "glowFissureHotColor") as Color).getHexString()).toBe("ffe2b0");
    expect((readFor(channels, "glowFissureHotColor") as Color).getHexString()).toBe("c8fff8");
    expect(readFor(prowess, "glowFoldLightWeight")).toBe(PROCGEN_ASPECT_GLOW_STYLES[1].foldLightWeight);
    expect(readFor(channels, "glowFoldLightWeight")).toBe(HYPERSTRUCTURE_CHANNEL_GLOW.foldLightWeight);

    prowess.dispose();
    channels.dispose();
  });
});
