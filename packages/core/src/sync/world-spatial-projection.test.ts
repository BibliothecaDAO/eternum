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

  it("indexes real structures by entity and reserved hyperstructures by coordinate", () => {
    const { projection, writeTile } = createHarness();
    writeTile("realm", {
      col: 100,
      row: 200,
      occupierId: 7,
      occupierType: TileOccupier.RealmWonderLevel2,
    });
    writeTile("reserved-a", {
      col: 101,
      row: 200,
      occupierId: 0,
      occupierType: TileOccupier.ReservedHyperstructure,
    });
    writeTile("reserved-b", {
      col: 102,
      row: 200,
      occupierId: 0,
      occupierType: TileOccupier.ReservedHyperstructure,
    });
    writeTile("ethereal-bank", {
      alt: true,
      col: 103,
      row: 200,
      occupierId: 8,
      occupierType: TileOccupier.Bank,
    });

    projection.start();

    expect(projection.getStructure(7)).toEqual({
      kind: "structure",
      spatialId: "entity:7",
      entityId: 7,
      reserved: false,
      hexCoords: { col: 100, row: 200 },
      occupierType: TileOccupier.RealmWonderLevel2,
    });
    expect(projection.getStructuresAtHex({ col: 101, row: 200 })).toEqual([
      {
        kind: "structure",
        spatialId: "reserved:101:200",
        entityId: null,
        reserved: true,
        hexCoords: { col: 101, row: 200 },
        occupierType: TileOccupier.ReservedHyperstructure,
      },
    ]);
    expect(
      projection
        .getStructuresInBounds({ minCol: 100, maxCol: 102, minRow: 200, maxRow: 200 })
        .map(({ spatialId }) => spatialId),
    ).toEqual(["entity:7", "reserved:101:200", "reserved:102:200"]);
    expect(projection.getStructures()).toHaveLength(3);
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
      {
        kind: "chest",
        entityId: 7,
        current: { kind: "chest", entityId: 7, hexCoords: { col: 10, row: 11 } },
      },
    ]);

    unsubscribe();
    writeTile("second", { col: 12, row: 13, occupierId: 8 });
    expect(listener).toHaveBeenCalledOnce();

    projection.dispose();
    writeTile("third", { col: 14, row: 15, occupierId: 9 });
    expect(projection.getChests()).toEqual([]);
  });

  it("publishes structure variant, move, and reserved-site removal changes", () => {
    const { projection, tileOpt, writeTile } = createHarness();
    writeTile("realm", {
      col: 10,
      row: 11,
      occupierId: 7,
      occupierType: TileOccupier.RealmRegularLevel1,
    });
    writeTile("reserved", {
      col: 12,
      row: 13,
      occupierId: 0,
      occupierType: TileOccupier.ReservedHyperstructure,
    });
    projection.start();
    const listener = vi.fn();
    projection.subscribeStructures(listener);

    writeTile("realm", {
      col: 20,
      row: 21,
      occupierId: 7,
      occupierType: TileOccupier.RealmWonderLevel2,
    });
    removeComponent(tileOpt, "reserved");

    expect(listener).toHaveBeenNthCalledWith(1, [
      {
        kind: "structure",
        spatialId: "entity:7",
        previous: expect.objectContaining({
          entityId: 7,
          hexCoords: { col: 10, row: 11 },
          occupierType: TileOccupier.RealmRegularLevel1,
        }),
        current: expect.objectContaining({
          entityId: 7,
          hexCoords: { col: 20, row: 21 },
          occupierType: TileOccupier.RealmWonderLevel2,
        }),
      },
    ]);
    expect(listener).toHaveBeenNthCalledWith(2, [
      {
        kind: "structure",
        spatialId: "reserved:12:13",
        previous: expect.objectContaining({ reserved: true, hexCoords: { col: 12, row: 13 } }),
      },
    ]);
  });

  it("replaces a reserved construction site with its new hyperstructure immediately", () => {
    const { projection, writeTile } = createHarness();
    writeTile("construction-site", {
      col: 12,
      row: 13,
      occupierId: 0,
      occupierType: TileOccupier.ReservedHyperstructure,
    });
    projection.start();
    const listener = vi.fn();
    projection.subscribeStructures(listener);

    writeTile("construction-site", {
      col: 12,
      row: 13,
      occupierId: 77,
      occupierType: TileOccupier.HyperstructureLevel1,
    });

    expect(projection.getStructuresAtHex({ col: 12, row: 13 })).toEqual([
      expect.objectContaining({ spatialId: "entity:77", entityId: 77, reserved: false }),
    ]);
    expect(listener).toHaveBeenCalledWith([
      expect.objectContaining({ spatialId: "reserved:12:13", current: undefined }),
      expect.objectContaining({ spatialId: "entity:77", previous: undefined }),
    ]);
  });

  it("adds a newly provisioned realm from its live TileOpt update", () => {
    const { projection, writeTile } = createHarness();
    projection.start();

    writeTile("new-realm", {
      col: 30,
      row: 31,
      occupierId: 88,
      occupierType: TileOccupier.RealmRegularLevel1,
    });

    expect(projection.getStructure(88)).toMatchObject({
      entityId: 88,
      hexCoords: { col: 30, row: 31 },
      occupierType: TileOccupier.RealmRegularLevel1,
    });
  });

  it("updates a changed structure incrementally without rescanning TileOpt", () => {
    const { projection, tileOpt, writeTile } = createHarness();
    writeTile("realm", {
      col: 10,
      row: 11,
      occupierId: 7,
      occupierType: TileOccupier.RealmRegularLevel1,
    });
    const entitiesSpy = vi.spyOn(tileOpt, "entities");
    projection.start();

    writeTile("realm", {
      col: 20,
      row: 21,
      occupierId: 7,
      occupierType: TileOccupier.RealmWonderLevel2,
    });

    expect(entitiesSpy).toHaveBeenCalledTimes(1);
    expect(projection.getStructure(7)).toMatchObject({
      hexCoords: { col: 20, row: 21 },
      occupierType: TileOccupier.RealmWonderLevel2,
    });
  });
});
