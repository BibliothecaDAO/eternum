import { WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { configManager } from "@bibliothecadao/eternum";
import { hash } from "starknet";
import explorerFixture from "../../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
import { afterEach, describe, expect, it, vi } from "vitest";

import { subscribeWorldmapTileChanges } from "./worldmap-exploration-projection";

const disposers: Array<() => void> = [];
afterEach(() => disposers.splice(0).forEach((dispose) => dispose()));

describe("worldmap exploration projection", () => {
  it("pairs a new tile with its army origin even though tile notifications precede army notifications", () => {
    const harness = createHarness();
    harness.writeArmy(1, 11, 7);
    harness.projection.flush();
    const onTileChange = vi.fn();
    subscribeWorldmapTileChanges(harness.projection, onTileChange, () => false);
    harness.writeTile(12, 7);
    harness.writeArmy(1, 12, 7);
    expect(onTileChange).not.toHaveBeenCalled();
    harness.projection.flush();
    expect(onTileChange).toHaveBeenCalledTimes(1);
    expect(onTileChange).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "tile", previous: undefined, current: expect.anything() }),
      { alt: false, col: 11, row: 7 },
    );
  });

  it("does not attach a discovery origin to an existing tile update or a later return", () => {
    const harness = createHarness();
    harness.writeTile(12, 7);
    harness.writeArmy(1, 11, 7);
    harness.projection.flush();
    const onTileChange = vi.fn();
    subscribeWorldmapTileChanges(harness.projection, onTileChange, () => false);
    harness.writeTile(12, 7, 3);
    harness.writeArmy(1, 12, 7);
    harness.projection.flush();
    expect(onTileChange).toHaveBeenCalledTimes(1);
    expect(onTileChange).toHaveBeenCalledWith(expect.anything(), undefined);
    onTileChange.mockClear();
    harness.writeArmy(1, 11, 7);
    harness.projection.flush();
    harness.writeArmy(1, 12, 7);
    harness.projection.flush();
    expect(onTileChange).toHaveBeenCalledTimes(2);
    for (const [, origin] of onTileChange.mock.calls) expect(origin).toBeUndefined();
  });

  it("leaves the origin unspecified for snapshot creation without a previous army position", () => {
    const harness = createHarness();
    const onTileChange = vi.fn();
    subscribeWorldmapTileChanges(harness.projection, onTileChange, () => false);
    harness.writeTile(12, 7);
    harness.writeArmy(1, 12, 7);
    harness.projection.flush();
    expect(onTileChange).toHaveBeenCalledTimes(1);
    expect(onTileChange).toHaveBeenCalledWith(expect.anything(), undefined);
  });

  it("stops delivering tile changes when the scene unsubscribes", () => {
    const harness = createHarness();
    const onTileChange = vi.fn();
    const unsubscribe = subscribeWorldmapTileChanges(harness.projection, onTileChange, () => false);
    unsubscribe();
    harness.writeTile(12, 7);
    harness.projection.flush();
    expect(onTileChange).not.toHaveBeenCalled();
  });
});

function createHarness() {
  configManager.setActiveGame(13, 1);
  const store = new NativeFactStore();
  const projection = new WorldSpatialProjection({ store });
  const write = (keys: number[], model: string, row: Record<string, unknown>) =>
    store.applyFacts([{ model: model, key: hash.computePoseidonHashOnElements(keys), value: row }]);
  projection.start();
  disposers.push(() => projection.dispose());
  return {
    projection,
    writeArmy: (entityId: number, col: number, row: number) => {
      const previous = store.entityOccupancy(13, entityId);
      store.applyFacts([
        ...(previous
          ? [
              {
                model: "TileOccupancy",
                key: hash.computePoseidonHashOnElements([13, 0, previous.col, previous.row]),
                value: null,
              },
            ]
          : []),
        {
          model: "ExplorerTroops",
          key: hash.computePoseidonHashOnElements([13, entityId]),
          value: {
            ...explorerFixture.expected.value,
            game_id: 13,
            explorer_id: entityId,
            troops: { ...explorerFixture.expected.value.troops, count: 100n },
          },
        },
        {
          model: "TileOccupancy",
          key: hash.computePoseidonHashOnElements([13, 0, col, row]),
          value: {
            game_id: 13,
            alt: false,
            col,
            row,
            entity_id: entityId,
            category: 15,
            is_structure: false,
          },
        },
      ]);
    },
    writeTile: (col: number, row: number, biome = 2) =>
      write([13, 0, col, row], "TileOpt", {
        game_id: 13,
        alt: false,
        col,
        row,
        data: BigInt(biome) << 41n,
      }),
  };
}
