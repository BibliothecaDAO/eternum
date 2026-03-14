// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";

vi.mock("@bibliothecadao/eternum", () => {
  const scalar = new Proxy(
    {},
    {
      get: (_, key) => key,
    },
  );

  return new Proxy(
    {
      ActionType: {
        Explore: "Explore",
        Move: "Move",
        Attack: "Attack",
        Help: "Help",
        Build: "Build",
        Quest: "Quest",
        Chest: "Chest",
        CreateArmy: "CreateArmy",
      },
      FELT_CENTER: 0,
    } as Record<string, unknown>,
    {
      get: (target, prop) => (prop in target ? target[prop as string] : scalar),
      has: () => true,
    },
  );
});

vi.mock("@bibliothecadao/types", () => {
  const enumProxy = new Proxy(
    {},
    {
      get: (_, key) => key,
    },
  );

  return new Proxy(
    {
      TroopTier: { T1: "T1", T2: "T2", T3: "T3" },
      TroopType: { Knight: "Knight", Crossbowman: "Crossbowman", Paladin: "Paladin" },
      StructureType: { Realm: "Realm", Hyperstructure: "Hyperstructure", Bank: "Bank", FragmentMine: "FragmentMine" },
      ResourcesIds: { StaminaRelic1: 1, Copper: 2, ColdIron: 3 },
      BiomeType: enumProxy,
      BuildingType: enumProxy,
      RealmLevelNames: enumProxy,
      RealmLevels: enumProxy,
      ResourceMiningTypes: enumProxy,
    } as Record<string, unknown>,
    {
      get: (target, prop) => (prop in target ? target[prop as string] : enumProxy),
      has: () => true,
    },
  );
});

Object.defineProperty(navigator, "getBattery", {
  configurable: true,
  value: vi.fn(async () => ({ charging: true })),
});

Object.defineProperty(URL, "createObjectURL", {
  configurable: true,
  value: vi.fn(() => "blob:mock"),
});

const { HighlightHexManager } = await import("./highlight-hex-manager");
const { ActionType } = await import("@bibliothecadao/eternum");

describe("HighlightHexManager lifecycle", () => {
  it("uses stock materials for owned highlight visuals", () => {
    const manager = new HighlightHexManager(new THREE.Scene());

    manager.highlightHexes([
      {
        hex: { col: 0, row: 0 },
        actionType: ActionType.Move,
      },
    ]);

    const instancedMaterial = (manager as any).material;
    const launchGlowMaterials = ((manager as any).activeLaunchGlows as Array<{ material: THREE.Material }>).map(
      (entry) => entry.material,
    );

    expect(instancedMaterial).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect(launchGlowMaterials).not.toHaveLength(0);
    expect(launchGlowMaterials.every((material) => material instanceof THREE.MeshBasicMaterial)).toBe(true);
    expect([instancedMaterial, ...launchGlowMaterials].some((material) => material instanceof THREE.ShaderMaterial)).toBe(
      false,
    );
  });

  it("removes its owned scene objects on dispose", () => {
    const scene = new THREE.Scene();
    const manager = new HighlightHexManager(scene);

    manager.highlightHexes([
      {
        hex: { col: 0, row: 0 },
        actionType: ActionType.Move,
      },
    ]);

    const instancedMesh = (manager as any).instancedMesh as THREE.InstancedMesh;

    expect(scene.children).toContain(instancedMesh);
    expect(scene.children.length).toBeGreaterThan(1);

    manager.dispose();

    expect(scene.children).not.toContain(instancedMesh);
    expect(scene.children).toHaveLength(0);
  });
});
