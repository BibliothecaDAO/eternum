// @vitest-environment jsdom
import { Group, Scene, Vector3 } from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TileOccupier } from "@bibliothecadao/types";
import type { WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";

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

function setup(surface: boolean, ethereal: boolean) {
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
  return { manager: new SpireManager(new Scene(), projection, labels), labels, unsubscribe };
}

beforeEach(() => {
  harness.alt = false;
  harness.models = [];
  harness.load.mockReset();
});

describe("spire presentation lifecycle", () => {
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
