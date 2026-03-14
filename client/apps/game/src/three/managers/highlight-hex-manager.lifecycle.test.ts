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
  it("routes descriptors into layered render buckets", () => {
    const manager = new HighlightHexManager(new THREE.Scene());

    manager.highlightHexes([
      {
        hex: { col: 0, row: 0 },
        actionType: ActionType.Move,
        kind: "route",
        isEndpoint: false,
        isSharedRoute: false,
        pathDepth: 1,
      },
      {
        hex: { col: 1, row: 0 },
        actionType: ActionType.Move,
        kind: "destination",
        isEndpoint: true,
        isSharedRoute: false,
        pathDepth: 1,
      },
      {
        hex: { col: 2, row: 0 },
        actionType: ActionType.Explore,
        kind: "frontier",
        isEndpoint: true,
        isSharedRoute: false,
        pathDepth: 1,
      },
    ]);

    expect((manager as any).routeLayer.mesh.count).toBe(3);
    expect((manager as any).endpointLayer.mesh.count).toBe(1);
    expect((manager as any).frontierLayer.mesh.count).toBe(1);
  });

  it("uses stock materials for owned highlight visuals", () => {
    const manager = new HighlightHexManager(new THREE.Scene());

    manager.highlightHexes([
      {
        hex: { col: 0, row: 0 },
        actionType: ActionType.Move,
        kind: "destination",
        isEndpoint: true,
        isSharedRoute: false,
        pathDepth: 1,
      },
    ]);

    const instancedMaterials = [
      (manager as any).routeLayer.material,
      (manager as any).endpointLayer.material,
      (manager as any).frontierLayer.material,
    ] as THREE.Material[];
    const launchGlowMaterials = ((manager as any).activeLaunchGlows as Array<{ material: THREE.Material }>).map(
      (entry) => entry.material,
    );

    expect(instancedMaterials.every((material) => material instanceof THREE.MeshBasicMaterial)).toBe(true);
    expect(launchGlowMaterials).not.toHaveLength(0);
    expect(launchGlowMaterials.every((material) => material instanceof THREE.MeshBasicMaterial)).toBe(true);
    expect([...instancedMaterials, ...launchGlowMaterials].some((material) => material instanceof THREE.ShaderMaterial)).toBe(false);
  });

  it("keeps layered scene ownership stable across repeated updates and clears", () => {
    const scene = new THREE.Scene();
    const manager = new HighlightHexManager(scene);

    manager.highlightHexes([
      {
        hex: { col: 0, row: 0 },
        actionType: ActionType.Move,
        kind: "route",
        isEndpoint: false,
        isSharedRoute: false,
        pathDepth: 1,
      },
    ]);
    manager.highlightHexes([
      {
        hex: { col: 1, row: 0 },
        actionType: ActionType.Move,
        kind: "destination",
        isEndpoint: true,
        isSharedRoute: false,
        pathDepth: 1,
      },
      {
        hex: { col: 2, row: 0 },
        actionType: ActionType.Explore,
        kind: "frontier",
        isEndpoint: true,
        isSharedRoute: false,
        pathDepth: 1,
      },
    ]);

    const layeredMeshes = scene.children.filter((child) => child instanceof THREE.InstancedMesh);
    expect(layeredMeshes).toHaveLength(3);
    expect((manager as any).routeLayer.mesh.count).toBe(2);
    expect((manager as any).endpointLayer.mesh.count).toBe(1);
    expect((manager as any).frontierLayer.mesh.count).toBe(1);

    manager.highlightHexes([]);

    expect((manager as any).routeLayer.mesh.count).toBe(0);
    expect((manager as any).endpointLayer.mesh.count).toBe(0);
    expect((manager as any).frontierLayer.mesh.count).toBe(0);
  });

  it("caps oversized descriptor sets and exposes debug counts for diagnostics", () => {
    const manager = new HighlightHexManager(new THREE.Scene());

    manager.highlightHexes(
      Array.from({ length: 640 }, (_, index) => ({
        hex: { col: index, row: 0 },
        actionType: ActionType.Move,
        kind: "route" as const,
        isEndpoint: false,
        isSharedRoute: false,
        pathDepth: 1,
      })),
    );

    expect((manager as any).routeLayer.mesh.count).toBe(500);
    expect(manager.getDebugState()).toEqual({
      cameraView: 2,
      routeCount: 500,
      endpointCount: 0,
      frontierCount: 0,
    });
  });

  it("retunes active highlight layers when the camera view changes", () => {
    const manager = new HighlightHexManager(new THREE.Scene());

    manager.highlightHexes([
      {
        hex: { col: 0, row: 0 },
        actionType: ActionType.Explore,
        kind: "frontier",
        isEndpoint: true,
        isSharedRoute: false,
        pathDepth: 1,
      },
    ]);

    manager.setCameraView(3);

    expect(manager.getDebugState().cameraView).toBe(3);
    expect((manager as any).frontierLayer.material.opacity).toBeGreaterThan((manager as any).routeLayer.material.opacity);
    expect((manager as any).frontierLayer.mesh.count).toBe(1);
  });

  it("removes its owned scene objects on dispose", () => {
    const scene = new THREE.Scene();
    const manager = new HighlightHexManager(scene);

    manager.highlightHexes([
      {
        hex: { col: 0, row: 0 },
        actionType: ActionType.Move,
        kind: "destination",
        isEndpoint: true,
        isSharedRoute: false,
        pathDepth: 1,
      },
    ]);

    const routeMesh = (manager as any).routeLayer.mesh as THREE.InstancedMesh;
    const endpointMesh = (manager as any).endpointLayer.mesh as THREE.InstancedMesh;
    const frontierMesh = (manager as any).frontierLayer.mesh as THREE.InstancedMesh;

    expect(scene.children).toContain(routeMesh);
    expect(scene.children).toContain(endpointMesh);
    expect(scene.children).toContain(frontierMesh);
    expect(scene.children.length).toBeGreaterThan(3);

    manager.dispose();

    expect(scene.children).not.toContain(routeMesh);
    expect(scene.children).not.toContain(endpointMesh);
    expect(scene.children).not.toContain(frontierMesh);
    expect(scene.children).toHaveLength(0);
  });
});
