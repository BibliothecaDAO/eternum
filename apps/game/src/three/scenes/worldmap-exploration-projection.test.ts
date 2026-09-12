import { WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";
import { Type, createWorld, defineComponent, setComponent, type Entity } from "@dojoengine/recs";
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
    expect(onTileChange).not.toHaveBeenCalled();
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

  it("does not invent an origin when different armies arrive on the same new tile", () => {
    const harness = createHarness();
    harness.writeArmy(1, 11, 7);
    harness.writeArmy(2, 12, 6);
    harness.projection.flush();
    const onTileChange = vi.fn();
    subscribeWorldmapTileChanges(harness.projection, onTileChange, () => false);
    harness.writeTile(12, 7);
    harness.writeArmy(1, 12, 7);
    harness.writeArmy(2, 12, 7);
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
  const world = createWorld();
  const tileOpt = defineComponent(world, {
    game_id: Type.Number,
    alt: Type.Boolean,
    col: Type.Number,
    row: Type.Number,
    data: Type.BigInt,
  });
  const explorerTroops = defineComponent(world, {
    explorer_id: Type.Number,
    troops: { category: Type.String, tier: Type.String, count: Type.BigInt },
    coord: { alt: Type.Boolean, x: Type.Number, y: Type.Number },
  });
  const projection = new WorldSpatialProjection({ tileOptComponent: tileOpt, explorerTroopsComponent: explorerTroops });
  projection.start();
  disposers.push(() => projection.dispose());
  return {
    projection,
    writeArmy: (entityId: number, col: number, row: number) =>
      setComponent(explorerTroops, String(entityId) as Entity, {
        explorer_id: entityId,
        troops: { category: "Knight", tier: "T1", count: 100n },
        coord: { alt: false, x: col, y: row },
      }),
    writeTile: (col: number, row: number, biome = 2) =>
      setComponent(tileOpt, `${col},${row}` as Entity, {
        game_id: 13,
        alt: false,
        col,
        row,
        data: (BigInt(col) << 81n) | (BigInt(row) << 49n) | (BigInt(biome) << 41n),
      }),
  };
}
