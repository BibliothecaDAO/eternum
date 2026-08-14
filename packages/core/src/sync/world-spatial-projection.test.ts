import { TileOccupier } from "@bibliothecadao/types";
import { Type, createWorld, defineComponent, removeComponent, setComponent } from "@dojoengine/recs";
import { describe, expect, it, vi } from "vitest";
import { WorldSpatialProjection } from "./world-spatial-projection";

const encodeTile = (input: { alt?: boolean; col: number; row: number; occupierId: number; occupierType: number }) =>
  (BigInt(input.alt ? 1 : 0) << 127n) |
  (BigInt(input.col) << 81n) |
  (BigInt(input.row) << 49n) |
  (BigInt(input.occupierId) << 9n) |
  (BigInt(input.occupierType) << 1n);

const createHarness = () => {
  const world = createWorld();
  const tileOpt = defineComponent(world, {
    game_id: Type.Number,
    alt: Type.Boolean,
    col: Type.Number,
    row: Type.Number,
    data: Type.BigInt,
  });
  const writeTile = (
    entityId: string,
    input: { alt?: boolean; col: number; row: number; occupierId: number; occupierType?: number },
    skipUpdateStream = false,
  ) => {
    setComponent(
      tileOpt,
      entityId,
      {
        game_id: 13,
        alt: input.alt ?? false,
        col: input.col,
        row: input.row,
        data: encodeTile({ ...input, occupierType: input.occupierType ?? TileOccupier.Chest }),
      },
      { skipUpdateStream },
    );
  };

  return { projection: new WorldSpatialProjection({ tileOptComponent: tileOpt, bucketSize: 8 }), tileOpt, writeTile };
};

describe("WorldSpatialProjection", () => {
  it("rebuilds a surface-chest index from RECS and excludes non-renderable tiles", () => {
    const { projection, writeTile } = createHarness();
    writeTile("chest", { col: 100, row: 200, occupierId: 7 });
    writeTile("ethereal-chest", { alt: true, col: 100, row: 200, occupierId: 8 });
    writeTile("plain-tile", { col: 101, row: 200, occupierId: 0, occupierType: TileOccupier.None });

    projection.start();

    expect(projection.getChests()).toEqual([{ kind: "chest", entityId: 7, hexCoords: { col: 100, row: 200 } }]);
    expect(projection.getChestsAtHex({ col: 100, row: 200 }).map(({ entityId }) => entityId)).toEqual([7]);
    expect(
      projection
        .getChestsInBounds({ minCol: 96, maxCol: 100, minRow: 196, maxRow: 204 })
        .map(({ entityId }) => entityId),
    ).toEqual([7]);
  });

  it.each(["destination-first", "origin-first"] as const)(
    "converges to the current RECS position when the %s update lands first",
    (updateOrder) => {
      const { projection, tileOpt, writeTile } = createHarness();
      writeTile("destination", { col: 20, row: 21, occupierId: 0, occupierType: TileOccupier.None });
      writeTile("origin", { col: 10, row: 11, occupierId: 7 });
      projection.start();

      if (updateOrder === "destination-first") {
        writeTile("destination", { col: 20, row: 21, occupierId: 7 });
        removeComponent(tileOpt, "origin");
      } else {
        removeComponent(tileOpt, "origin");
        writeTile("destination", { col: 20, row: 21, occupierId: 7 });
      }

      expect(projection.getChest(7)?.hexCoords).toEqual({ col: 20, row: 21 });
      expect(projection.getChestsAtHex({ col: 10, row: 11 })).toEqual([]);
      expect(projection.getChestsAtHex({ col: 20, row: 21 }).map(({ entityId }) => entityId)).toEqual([7]);
    },
  );

  it("restores missed updates and deletions from a full rebuild", () => {
    const { projection, tileOpt, writeTile } = createHarness();
    writeTile("chest", { col: 10, row: 11, occupierId: 7 });
    projection.start();

    removeComponent(tileOpt, "chest", { skipUpdateStream: true });
    expect(projection.getChest(7)).toBeDefined();

    projection.rebuild();

    expect(projection.getChest(7)).toBeUndefined();
  });

  it("publishes one complete change and detaches cleanly", () => {
    const { projection, writeTile } = createHarness();
    const listener = vi.fn();
    projection.start();
    const unsubscribe = projection.subscribe(listener);

    writeTile("chest", { col: 10, row: 11, occupierId: 7 });

    expect(listener).toHaveBeenCalledWith([
      { entityId: 7, current: { kind: "chest", entityId: 7, hexCoords: { col: 10, row: 11 } } },
    ]);

    unsubscribe();
    writeTile("second", { col: 12, row: 13, occupierId: 8 });
    expect(listener).toHaveBeenCalledOnce();

    projection.dispose();
    writeTile("third", { col: 14, row: 15, occupierId: 9 });
    expect(projection.getChests()).toEqual([]);
  });
});
