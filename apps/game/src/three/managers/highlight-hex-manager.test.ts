// @vitest-environment jsdom
import { vi } from "vitest";
import { describe, expect, it } from "vitest";
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
const gsap = (await import("gsap")).default;

// A hex sits at (col, 0, row), so a drawn instance reads back as the hex it marks.
const gridSpace = {
  positionForHex: (hex: { col: number; row: number }) => new THREE.Vector3(hex.col, 0, hex.row),
  positionForHexInto: (col: number, row: number, out: THREE.Vector3) => out.set(col, 0, row),
  hexForPosition: (point: { x: number; z: number }) => ({ col: point.x, row: point.z }),
};

const ROUTE_RENDER_ORDER = 5;
const FRONTIER_RENDER_ORDER = 7;

const step = (col: number, row: number, actionType = "Move") => ({
  hex: { col, row },
  actionType,
  kind: actionType === "Explore" ? ("frontier" as const) : ("route" as const),
  isEndpoint: actionType === "Explore",
  isSharedRoute: false,
  pathDepth: 1,
});

const drawnHexes = (scene: THREE.Scene, renderOrder = ROUTE_RENDER_ORDER) => {
  const mesh = scene.children.find(
    (child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh && child.renderOrder === renderOrder,
  )!;
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  return Array.from({ length: mesh.count }, (_, index) => {
    mesh.getMatrixAt(index, matrix);
    matrix.decompose(position, new THREE.Quaternion(), scale);
    return `${position.x},${position.z}@${scale.x.toFixed(2)}`;
  }).sort();
};

let animationClock = gsap.ticker.time;
const finishRollIn = () => gsap.updateRoot((animationClock += 10));

describe("HighlightHexManager material ownership", () => {
  it("keeps instanced highlight material state isolated per manager", () => {
    const first = new HighlightHexManager(new THREE.Scene());
    const second = new HighlightHexManager(new THREE.Scene());

    first.updateHighlightPulse(0.2);
    second.updateHighlightPulse(0.8);

    const firstRouteMaterial = (first as any).routeLayer.material as THREE.MeshBasicMaterial;
    const secondRouteMaterial = (second as any).routeLayer.material as THREE.MeshBasicMaterial;
    const firstEndpointMaterial = (first as any).endpointLayer.material as THREE.MeshBasicMaterial;
    const secondEndpointMaterial = (second as any).endpointLayer.material as THREE.MeshBasicMaterial;

    expect(firstRouteMaterial).not.toBe(secondRouteMaterial);
    expect(firstEndpointMaterial).not.toBe(secondEndpointMaterial);
    expect(firstRouteMaterial.opacity).not.toBe(secondRouteMaterial.opacity);
    expect(firstEndpointMaterial.opacity).not.toBe(secondEndpointMaterial.opacity);
  });
});

describe("HighlightHexManager drawing a selection", () => {
  const select = (descriptors: ReturnType<typeof step>[]) => {
    const scene = new THREE.Scene();
    const manager = new HighlightHexManager(scene, gridSpace);
    manager.highlightHexes(descriptors as never);
    finishRollIn();
    return { scene, manager };
  };

  it("rolls a new selection's hexes in from nothing", () => {
    const scene = new THREE.Scene();
    const manager = new HighlightHexManager(scene, gridSpace);

    manager.highlightHexes([step(1, 0), step(2, 0)] as never);
    expect(drawnHexes(scene)).toEqual(["1,0@0.01", "2,0@0.01"]);

    finishRollIn();
    expect(drawnHexes(scene)).toEqual(["1,0@0.92", "2,0@0.92"]);
  });

  it("leaves an unchanged selection on screen when it is published again", () => {
    const { scene, manager } = select([step(1, 0), step(2, 0), step(3, 0, "Explore")]);

    manager.highlightHexes([step(3, 0, "Explore"), step(2, 0), step(1, 0)] as never);

    expect(drawnHexes(scene)).toEqual(["1,0@0.92", "2,0@0.92", "3,0@0.98"]);
    expect(drawnHexes(scene, FRONTIER_RENDER_ORDER)).toEqual(["3,0@0.74"]);
  });

  it("changes a selection in place: kept hexes stay, a gone hex leaves, a new hex rolls in", () => {
    const { scene, manager } = select([step(1, 0), step(2, 0)]);

    manager.highlightHexes([step(2, 0), step(3, 0)] as never);
    expect(drawnHexes(scene)).toEqual(["2,0@0.92", "3,0@0.01"]);

    finishRollIn();
    expect(drawnHexes(scene)).toEqual(["2,0@0.92", "3,0@0.92"]);
  });

  it("restyles a kept hex whose order changed without rolling it in again", () => {
    const { scene, manager } = select([step(1, 0), step(2, 0)]);

    manager.highlightHexes([step(1, 0), step(2, 0, "Explore")] as never);

    expect(drawnHexes(scene)).toEqual(["1,0@0.92", "2,0@0.98"]);
    expect(drawnHexes(scene, FRONTIER_RENDER_ORDER)).toEqual(["2,0@0.74"]);
  });

  it("rescales drawn hexes in place when the zoom band changes", () => {
    const { scene, manager } = select([step(1, 0), step(2, 0)]);

    manager.setCameraView(3);

    expect(drawnHexes(scene)).toEqual(["1,0@0.98", "2,0@0.98"]);
  });

  it("clears every hex when the selection ends", () => {
    const { scene, manager } = select([step(1, 0), step(2, 0, "Explore")]);

    manager.highlightHexes([]);

    expect(drawnHexes(scene)).toEqual([]);
    expect(drawnHexes(scene, FRONTIER_RENDER_ORDER)).toEqual([]);
  });
});
