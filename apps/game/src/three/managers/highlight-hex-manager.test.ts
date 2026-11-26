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
        CreateArmy: "CreateArmy",
      },
      FELT_CENTER: 0,
      SEASON_ONE_DRAWN_LEVELS: [0, 1],
      hasSeasonOneRealmSkinAt: (level: number | null | undefined) => level === 0 || level === 1,
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
const { FLAT_TERRAIN_SURFACE } = await import("@/three/terrain/terrain-surface");
const gsap = (await import("gsap")).default;

// A hex sits at (col, 0, row), so a drawn instance reads back as the hex it marks.
const gridSpace = {
  positionForHex: (hex: { col: number; row: number }) => new THREE.Vector3(hex.col, 0, hex.row),
  positionForHexInto: (col: number, row: number, out: THREE.Vector3) => out.set(col, 0, row),
  hexForPosition: (point: { x: number; z: number }) => ({ col: point.x, row: point.z }),
};

const step = (col: number, row: number, actionType = "Move") => ({
  hex: { col, row },
  actionType,
  kind: actionType === "Explore" ? ("frontier" as const) : ("route" as const),
  isEndpoint: actionType === "Explore",
  isSharedRoute: false,
  pathDepth: 1,
});

const drawnHexes = (manager: InstanceType<typeof HighlightHexManager>, layer = "route") =>
  manager
    .getDebugState()
    .plates.filter((plate) => plate.layer === layer)
    .map((plate) => `${plate.x},${plate.z}@${plate.scale.toFixed(2)}`)
    .sort();

let animationClock = gsap.ticker.time;
const finishRollIn = () => gsap.updateRoot((animationClock += 10));

describe("HighlightHexManager material ownership", () => {
  it("keeps instanced highlight material state isolated per manager", () => {
    const first = new HighlightHexManager(new THREE.Scene(), FLAT_TERRAIN_SURFACE);
    const second = new HighlightHexManager(new THREE.Scene(), FLAT_TERRAIN_SURFACE);

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
    const manager = new HighlightHexManager(scene, FLAT_TERRAIN_SURFACE, gridSpace);
    manager.highlightHexes(descriptors as never);
    finishRollIn();
    return { scene, manager };
  };

  it("rolls a new selection's hexes in from nothing", () => {
    const manager = new HighlightHexManager(new THREE.Scene(), FLAT_TERRAIN_SURFACE, gridSpace);

    manager.highlightHexes([step(1, 0), step(2, 0)] as never);
    expect(drawnHexes(manager)).toEqual(["1,0@0.01", "2,0@0.01"]);

    finishRollIn();
    expect(drawnHexes(manager)).toEqual(["1,0@0.92", "2,0@0.92"]);
  });

  it("leaves an unchanged selection on screen when it is published again", () => {
    const { manager } = select([step(1, 0), step(2, 0), step(3, 0, "Explore")]);

    manager.highlightHexes([step(3, 0, "Explore"), step(2, 0), step(1, 0)] as never);

    expect(drawnHexes(manager)).toEqual(["1,0@0.92", "2,0@0.92", "3,0@0.98"]);
    expect(drawnHexes(manager, "frontier")).toEqual(["3,0@0.74"]);
  });

  it("changes a selection in place: kept hexes stay, a gone hex leaves, a new hex rolls in", () => {
    const { manager } = select([step(1, 0), step(2, 0)]);

    manager.highlightHexes([step(2, 0), step(3, 0)] as never);
    expect(drawnHexes(manager)).toEqual(["2,0@0.92", "3,0@0.01"]);

    finishRollIn();
    expect(drawnHexes(manager)).toEqual(["2,0@0.92", "3,0@0.92"]);
  });

  it("restyles a kept hex whose order changed without rolling it in again", () => {
    const { manager } = select([step(1, 0), step(2, 0)]);

    manager.highlightHexes([step(1, 0), step(2, 0, "Explore")] as never);

    expect(drawnHexes(manager)).toEqual(["1,0@0.92", "2,0@0.98"]);
    expect(drawnHexes(manager, "frontier")).toEqual(["2,0@0.74"]);
  });

  it("rescales drawn hexes in place when the zoom band changes", () => {
    const { manager } = select([step(1, 0), step(2, 0)]);

    manager.setCameraView(3);

    expect(drawnHexes(manager)).toEqual(["1,0@0.98", "2,0@0.98"]);
  });

  it("clears every hex when the selection ends", () => {
    const { manager } = select([step(1, 0), step(2, 0, "Explore")]);

    manager.highlightHexes([]);

    expect(drawnHexes(manager)).toEqual([]);
    expect(drawnHexes(manager, "frontier")).toEqual([]);
  });
});

describe("HighlightHexManager laying a lit hex on the ground", () => {
  const groundOf = (placed: (x: number) => number, drawn: (x: number) => number = placed) => ({
    sampleSurface: (x: number) => ({ biome: null, height: drawn(x), normal: [0, 1, 0] as const }),
    sampleHeight: (x: number) => placed(x),
  });

  const heightsAround = (scene: THREE.Scene, col: number) =>
    new Set(
      scene.children
        .filter((child): child is THREE.Mesh => child instanceof THREE.Mesh)
        .flatMap((mesh) => {
          const positions = mesh.geometry.getAttribute("position");
          return positions
            ? Array.from({ length: positions.count }, (_, vertex) => vertex)
                .filter((vertex) => Math.abs(positions.getX(vertex) - col) < 0.5)
                .map((vertex) => Math.round(positions.getY(vertex) * 1000))
            : [];
        }),
    );

  const light = (ground: ReturnType<typeof groundOf>, descriptors: ReturnType<typeof step>[]) => {
    const scene = new THREE.Scene();
    const manager = new HighlightHexManager(scene, ground, gridSpace);
    manager.highlightHexes(descriptors as never);
    finishRollIn();
    return { scene, manager };
  };

  it("lays each lit hex flat on its own tile's ground, a water tile's below a land tile's", () => {
    const waterAtTwo = (x: number) => (Math.round(x) === 2 ? -0.055 : 0);
    const { scene } = light(groundOf(waterAtTwo), [step(1, 0)]);
    const { scene: water } = light(groundOf(waterAtTwo), [step(2, 0)]);

    expect([...heightsAround(scene, 1)]).toEqual([30]);
    expect([...heightsAround(water, 2)]).toEqual([-25]);
  });

  it("reports a plate the drawn ground rises above as buried, so the playtest's check can fail", () => {
    const { manager } = light(
      groundOf(
        () => 0,
        () => 0.2,
      ),
      [step(4, 0, "Explore")],
    );

    expect(Math.min(...manager.getDebugState().plates.map((plate) => plate.lowest))).toBeLessThan(0);
  });

  it("reports how far over the drawn ground each plate lies, for the playtest's ground check", () => {
    const { manager } = light(
      groundOf(() => 0),
      [step(4, 0, "Explore")],
    );

    for (const plate of manager.getDebugState().plates) {
      expect(plate.lowest).toBeGreaterThan(0);
      expect(plate.highest).toBeLessThanOrEqual(0.06);
    }
  });
});

describe("HighlightHexManager lighting a plot for a building", () => {
  const build = (col: number) => ({
    ...step(col, 0),
    actionType: "Build",
    kind: "destination" as const,
    isEndpoint: true,
  });

  it("draws it in the plot palette its scene set", () => {
    const scene = new THREE.Scene();
    const manager = new HighlightHexManager(scene, FLAT_TERRAIN_SURFACE, gridSpace);

    manager.setLitPlotPalette({ routeColor: 0x336699, endpointColor: 0x88aacc });
    manager.highlightHexes([build(2)] as never);
    finishRollIn();
    const endpoint = scene.children.find(
      (child): child is THREE.Mesh => child instanceof THREE.Mesh && child.renderOrder === 6 && child.visible,
    )!;
    const drawn = new THREE.Color().fromBufferAttribute(endpoint.geometry.getAttribute("color"), 0);
    expect(drawn.getHex()).toBe(new THREE.Color(0x88aacc).lerp(new THREE.Color(0xffffff), 0.12).getHex());
  });
});

describe("HighlightHexManager teach highlight", () => {
  const TEACH_RENDER_ORDER = 8;

  const teachMesh = (scene: THREE.Scene) =>
    scene.children.find(
      (child): child is THREE.Mesh => child instanceof THREE.Mesh && child.renderOrder === TEACH_RENDER_ORDER,
    )!;

  it("lights one static non-pulsing hex with the teach colour, coexists with action highlights, and clears on null", () => {
    const terrain = {
      sampleSurface: () => ({ biome: null, height: 0.1, normal: [0, 1, 0] as const }),
      sampleHeight: () => 0.1,
    };
    const scene = new THREE.Scene();
    const manager = new HighlightHexManager(scene, terrain, gridSpace);

    manager.setTeachHex({ col: 4, row: 7 });
    const mesh = teachMesh(scene);
    const material = mesh.material as THREE.MeshBasicMaterial;
    expect(drawnHexes(manager, "teach")).toEqual(["4,7@0.56", "4,7@0.96"]);
    expect(material.depthWrite).toBe(false);
    expect(material.opacity).toBeCloseTo(0.28, 5);

    const colors = mesh.geometry.getAttribute("color");
    const perCopy = colors.count / 2;
    expect(new THREE.Color().fromBufferAttribute(colors, 0).getHex()).toBe(0xfff5d6);
    expect(new THREE.Color().fromBufferAttribute(colors, perCopy).getHex()).toBe(0xfffdf5);

    manager.updateHighlightPulse(0.8);
    expect(material.opacity).toBeCloseTo(0.28, 5);

    manager.highlightHexes([step(1, 0)] as never);
    finishRollIn();
    expect(drawnHexes(manager)).toEqual(["1,0@0.92"]);
    expect(drawnHexes(manager, "teach")).toEqual(["4,7@0.56", "4,7@0.96"]);

    manager.highlightHexes([]);
    expect(drawnHexes(manager)).toEqual([]);
    expect(drawnHexes(manager, "teach")).toEqual(["4,7@0.56", "4,7@0.96"]);

    const positions = teachMesh(scene).geometry.getAttribute("position");
    for (let vertex = 0; vertex < positions.count; vertex++) expect(positions.getY(vertex)).toBeGreaterThan(0.1);
    expect(manager.getDebugState().teachCount).toBe(2);

    manager.highlightHexes([step(2, 0)] as never);
    finishRollIn();
    manager.setTeachHex(null);
    expect(drawnHexes(manager, "teach")).toEqual([]);
    expect(drawnHexes(manager)).toEqual(["2,0@0.92"]);
    expect(manager.getDebugState().teachCount).toBe(0);

    manager.dispose();
  });
});
