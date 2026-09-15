// @vitest-environment jsdom
import { Group, Scene, Vector3 } from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TileOccupier } from "@bibliothecadao/types";
import type { WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";
import { FLAT_TERRAIN_SURFACE, type TerrainSurface } from "../terrain/terrain-surface";

const harness = vi.hoisted(() => ({ alt: false, onLayer: () => {}, load: vi.fn(), models: [] as any[] }));
vi.mock("@/three/map-layer", () => ({ activeMapLayer: () => harness.alt }));
vi.mock("@/hooks/store/use-ui-store", () => ({
  useUIStore: {
    subscribe: (_selector: unknown, listener: () => void) => {
      harness.onLayer = listener;
      return vi.fn();
    },
  },
}));
vi.mock("../utils/utils", () => ({
  gltfLoader: { loadAsync: harness.load },
  getWorldPositionForHex: () => new Vector3(),
}));
vi.mock("../structures/spire-model", () => ({
  SpireModel: class {
    group = new Group();
    labelHeight = 4.25;
    setCount = vi.fn();
    setMatrixAt = vi.fn();
    needsUpdate = vi.fn();
    dispose = vi.fn();
    updateAnimations = vi.fn();
    constructor() {
      harness.models.push(this);
    }
  },
}));
import { SpireManager } from "./spire-manager";

function setup(surface: boolean, ethereal: boolean, terrain: TerrainSurface = FLAT_TERRAIN_SURFACE) {
  const unsubscribe = vi.fn();
  const projection = {
    subscribeTiles: () => unsubscribe,
    getTiles: (alt: boolean) =>
      (alt ? ethereal : surface)
        ? [
            {
              occupierType: TileOccupier.Spire,
              hexCoords: { alt, col: 2147483647, row: 2147483647 },
            },
          ]
        : [],
  } as unknown as WorldSpatialProjection;
  const labels = new Group();
  return { manager: new SpireManager(new Scene(), projection, labels, terrain), labels, unsubscribe };
}

beforeEach(() => {
  harness.alt = false;
  harness.models = [];
  harness.load.mockReset();
});

describe("spire presentation lifecycle", () => {
  it("grounds an already loaded spire and its label when its terrain page arrives", async () => {
    let height = 0;
    harness.load.mockResolvedValue({});
    const { manager, labels } = setup(true, true, {
      sampleSurface: () => ({ biome: null, height, normal: [0, 1, 0] }),
    });
    await vi.waitFor(() => expect(labels.children).toHaveLength(1));
    const label = labels.children[0];
    const writes = harness.models[0].setMatrixAt.mock.calls.length;
    height = 0.12;
    manager.refreshTerrainPlacement();
    expect(labels.children[0]).toBe(label);
    expect(label.position.y).toBeCloseTo(4.37);
    expect(harness.models[0].setMatrixAt.mock.lastCall[1].elements[13]).toBeCloseTo(0.12);
    manager.refreshTerrainPlacement();
    expect(harness.models[0].setMatrixAt).toHaveBeenCalledTimes(writes + 1);
    expect(harness.load).toHaveBeenCalledTimes(1);
    manager.destroy();
  });
  it("does not request an asset when the game has no spires", () => {
    const { manager, labels } = setup(false, false);
    expect(harness.load).not.toHaveBeenCalled();
    expect(labels.children).toHaveLength(0);
    manager.destroy();
  });
  it("uses the current layer when loading finishes and reuses the model on return", async () => {
    let resolve!: (value: object) => void;
    harness.load.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { manager, labels } = setup(true, false);
    harness.alt = true;
    harness.onLayer();
    resolve({});
    await vi.waitFor(() => expect(harness.models).toHaveLength(1));
    expect(labels.children).toHaveLength(0);
    expect(harness.models[0].setMatrixAt).not.toHaveBeenCalled();
    harness.alt = false;
    harness.onLayer();
    expect(labels.children).toHaveLength(1);
    expect(labels.children[0].position.y).toBe(4.25);
    expect(harness.models[0].setCount).toHaveBeenLastCalledWith(1);
    expect(harness.load).toHaveBeenCalledTimes(1);
    manager.destroy();
    expect(labels.children).toHaveLength(0);
    expect(harness.models[0].dispose).toHaveBeenCalledOnce();
  });
  it("does not attach a model after the scene is destroyed during loading", async () => {
    let resolve!: (value: object) => void;
    harness.load.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { manager, labels, unsubscribe } = setup(true, true);
    manager.destroy();
    resolve({});
    await new Promise((done) => setTimeout(done, 0));
    expect(harness.models).toHaveLength(0);
    expect(labels.children).toHaveLength(0);
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
