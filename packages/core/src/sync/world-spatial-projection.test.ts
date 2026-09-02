import { TileOccupier } from "@bibliothecadao/types";
import { Type, createWorld, defineComponent, removeComponent, setComponent } from "@dojoengine/recs";
import { describe, expect, it, vi } from "vitest";
import { WorldSpatialProjection } from "./world-spatial-projection";

const encodeTile = (input: {
  alt?: boolean;
  biome?: number;
  col: number;
  row: number;
  occupierId: number;
  occupierType: number;
  occupierIsStructure?: boolean;
  rewardExtracted?: boolean;
}) =>
  (BigInt(input.alt ? 1 : 0) << 127n) |
  (BigInt(input.rewardExtracted ? 1 : 0) << 113n) |
  (BigInt(input.col) << 81n) |
  (BigInt(input.row) << 49n) |
  (BigInt(input.biome ?? 0) << 41n) |
  (BigInt(input.occupierId) << 9n) |
  (BigInt(input.occupierType) << 1n) |
  BigInt(input.occupierIsStructure ? 1 : 0);

const createHarness = () => {
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
    troops: {
      category: Type.String,
      tier: Type.String,
      count: Type.BigInt,
    },
    coord: {
      alt: Type.Boolean,
      x: Type.Number,
      y: Type.Number,
    },
  });
  const writeTile = (
    entityId: string,
    input: {
      alt?: boolean;
      biome?: number;
      col: number;
      row: number;
      occupierId: number;
      occupierType?: number;
      occupierIsStructure?: boolean;
      rewardExtracted?: boolean;
    },
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
  const writeArmy = (
    entityId: string,
    input: {
      explorerId: number;
      col: number;
      row: number;
      alt?: boolean;
      count?: bigint;
      category?: string;
      tier?: string;
    },
    skipUpdateStream = false,
  ) => {
    setComponent(
      explorerTroops,
      entityId,
      {
        explorer_id: input.explorerId,
        troops: {
          category: input.category ?? "Knight",
          tier: input.tier ?? "T1",
          count: input.count ?? 100n,
        },
        coord: { alt: input.alt ?? false, x: input.col, y: input.row },
      },
      { skipUpdateStream },
    );
  };

  return {
    projection: new WorldSpatialProjection({
      tileOptComponent: tileOpt,
      explorerTroopsComponent: explorerTroops,
      bucketSize: 8,
    }),
    explorerTroops,
    tileOpt,
    writeArmy,
    writeTile,
  };
};

describe("WorldSpatialProjection", () => {
  it("indexes live surface tiles for map-wide spatial reads", () => {
    const { projection, writeTile } = createHarness();
    writeTile("surface", {
      biome: 4,
      col: 100,
      row: 200,
      occupierId: 7,
      occupierType: TileOccupier.RealmRegularLevel1,
      occupierIsStructure: true,
      rewardExtracted: true,
    });
    writeTile("ethereal", { alt: true, col: 101, row: 200, occupierId: 8 });

    projection.start();

    expect(projection.getTiles()).toEqual([
      {
        kind: "tile",
        spatialId: "tile:100:200",
        hexCoords: { col: 100, row: 200 },
        biome: 4,
        occupierId: 7,
        occupierType: TileOccupier.RealmRegularLevel1,
        occupierIsStructure: true,
        rewardExtracted: true,
      },
    ]);
    expect(projection.getTileAtHex({ col: 100, row: 200 })?.occupierId).toBe(7);
    expect(projection.getTilesInBounds({ minCol: 96, maxCol: 104, minRow: 196, maxRow: 204 })).toHaveLength(1);
  });

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

  it("indexes live surface armies from ExplorerTroops only", () => {
    const { projection, writeArmy, writeTile } = createHarness();
    writeArmy("live-army", { explorerId: 7, col: 100, row: 200, category: "Paladin", tier: "T2" });
    writeArmy("dead-army", { explorerId: 8, col: 101, row: 200, count: 0n });
    writeArmy("alt-army", { explorerId: 9, col: 102, row: 200, alt: true });
    writeTile("stale-explorer-tile", {
      col: 103,
      row: 200,
      occupierId: 10,
      occupierType: TileOccupier.ExplorerKnightT1Regular,
    });

    projection.start();

    expect(projection.getArmies()).toEqual([
      {
        kind: "army",
        entityId: 7,
        hexCoords: { col: 100, row: 200 },
        troopCategory: "Paladin",
        troopTier: "T2",
      },
    ]);
    expect(projection.getArmiesAtHex({ col: 100, row: 200 }).map(({ entityId }) => entityId)).toEqual([7]);
    expect(
      projection
        .getArmiesInBounds({ minCol: 96, maxCol: 104, minRow: 196, maxRow: 204 })
        .map(({ entityId }) => entityId),
    ).toEqual([7]);
    expect(projection.getArmy(10)).toBeUndefined();
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

  it("does not return an offscreen deletion when its bounds are queried later", () => {
    const { projection, tileOpt, writeTile } = createHarness();
    writeTile("offscreen-chest", { col: 200, row: 201, occupierId: 7 });
    projection.start();

    removeComponent(tileOpt, "offscreen-chest");

    expect(projection.getChestsInBounds({ minCol: 196, maxCol: 204, minRow: 196, maxRow: 204 })).toEqual([]);
  });

  it("publishes one complete change and detaches cleanly", () => {
    const { projection, writeTile } = createHarness();
    const listener = vi.fn();
    projection.start();
    const unsubscribe = projection.subscribe(listener);

    writeTile("chest", { col: 10, row: 11, occupierId: 7 });
    projection.flush();

    expect(listener).toHaveBeenCalledWith([
      expect.objectContaining({
        kind: "tile",
        spatialId: "tile:10:11",
        current: expect.objectContaining({
          kind: "tile",
          spatialId: "tile:10:11",
          hexCoords: { col: 10, row: 11 },
        }),
      }),
      expect.objectContaining({
        kind: "chest",
        entityId: 7,
        current: { kind: "chest", entityId: 7, hexCoords: { col: 10, row: 11 } },
      }),
    ]);

    unsubscribe();
    writeTile("second", { col: 12, row: 13, occupierId: 8 });
    projection.flush();
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
    projection.flush();

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith([
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
      {
        kind: "structure",
        spatialId: "reserved:12:13",
        previous: expect.objectContaining({ reserved: true, hexCoords: { col: 12, row: 13 } }),
      },
    ]);
  });

  it("publishes army create, move, variant, and removal changes incrementally", () => {
    const { projection, explorerTroops, writeArmy } = createHarness();
    projection.start();
    const listener = vi.fn();
    projection.subscribeArmies(listener);

    writeArmy("army", { explorerId: 7, col: 10, row: 11 });
    projection.flush();
    writeArmy("army", { explorerId: 7, col: 20, row: 21, category: "Crossbowman", tier: "T3" });
    projection.flush();
    removeComponent(explorerTroops, "army");
    projection.flush();

    expect(listener).toHaveBeenNthCalledWith(1, [
      {
        kind: "army",
        entityId: 7,
        current: expect.objectContaining({ hexCoords: { col: 10, row: 11 }, troopCategory: "Knight", troopTier: "T1" }),
      },
    ]);
    expect(listener).toHaveBeenNthCalledWith(2, [
      {
        kind: "army",
        entityId: 7,
        previous: expect.objectContaining({ hexCoords: { col: 10, row: 11 } }),
        current: expect.objectContaining({
          hexCoords: { col: 20, row: 21 },
          troopCategory: "Crossbowman",
          troopTier: "T3",
        }),
      },
    ]);
    expect(listener).toHaveBeenNthCalledWith(3, [
      {
        kind: "army",
        entityId: 7,
        previous: expect.objectContaining({ hexCoords: { col: 20, row: 21 } }),
      },
    ]);
  });

  it("returns an offscreen army at its destination only after it moves", () => {
    const { projection, writeArmy } = createHarness();
    writeArmy("army", { explorerId: 7, col: 100, row: 101 });
    projection.start();

    writeArmy("army", { explorerId: 7, col: 200, row: 201 });

    expect(projection.getArmiesInBounds({ minCol: 96, maxCol: 104, minRow: 96, maxRow: 104 })).toEqual([]);
    expect(projection.getArmiesInBounds({ minCol: 196, maxCol: 204, minRow: 196, maxRow: 204 })).toEqual([
      expect.objectContaining({ entityId: 7, hexCoords: { col: 200, row: 201 } }),
    ]);
  });

  it("removes the previous projection key when an ExplorerTroops identity changes", () => {
    const { projection, writeArmy } = createHarness();
    writeArmy("army", { explorerId: 7, col: 10, row: 11 });
    projection.start();

    writeArmy("army", { explorerId: 8, col: 20, row: 21 });

    expect(projection.getArmy(7)).toBeUndefined();
    expect(projection.getArmy(8)).toMatchObject({ entityId: 8, hexCoords: { col: 20, row: 21 } });
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
    projection.flush();
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

  it("restores missed army updates and deletions from a full rebuild", () => {
    const { projection, explorerTroops, writeArmy } = createHarness();
    writeArmy("army", { explorerId: 7, col: 10, row: 11 });
    projection.start();

    removeComponent(explorerTroops, "army", { skipUpdateStream: true });
    expect(projection.getArmy(7)).toBeDefined();

    projection.rebuild();

    expect(projection.getArmy(7)).toBeUndefined();
  });

  it("publishes each kind once and the combined change once per flush", () => {
    const { projection, writeArmy, writeTile } = createHarness();
    projection.start();
    const tileListener = vi.fn();
    const chestListener = vi.fn();
    const structureListener = vi.fn();
    const armyListener = vi.fn();
    const listener = vi.fn();
    projection.subscribeTiles(tileListener);
    projection.subscribeChests(chestListener);
    projection.subscribeStructures(structureListener);
    projection.subscribeArmies(armyListener);
    projection.subscribe(listener);

    writeTile("tile-a", { col: 10, row: 11, occupierId: 0, occupierType: TileOccupier.None });
    writeTile("tile-b", { col: 12, row: 13, occupierId: 0, occupierType: TileOccupier.None });
    writeTile("tile-c", { col: 14, row: 15, occupierId: 0, occupierType: TileOccupier.None });
    writeArmy("army-a", { explorerId: 7, col: 20, row: 21 });
    writeArmy("army-b", { explorerId: 8, col: 22, row: 23 });
    expect(listener).not.toHaveBeenCalled();

    projection.flush();

    expect(tileListener).toHaveBeenCalledOnce();
    expect(tileListener).toHaveBeenCalledWith([
      expect.objectContaining({ spatialId: "tile:10:11" }),
      expect.objectContaining({ spatialId: "tile:12:13" }),
      expect.objectContaining({ spatialId: "tile:14:15" }),
    ]);
    expect(armyListener).toHaveBeenCalledOnce();
    expect(armyListener).toHaveBeenCalledWith([
      expect.objectContaining({ entityId: 7 }),
      expect.objectContaining({ entityId: 8 }),
    ]);
    expect(chestListener).not.toHaveBeenCalled();
    expect(structureListener).not.toHaveBeenCalled();
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith([
      expect.objectContaining({ kind: "tile", spatialId: "tile:10:11" }),
      expect.objectContaining({ kind: "tile", spatialId: "tile:12:13" }),
      expect.objectContaining({ kind: "tile", spatialId: "tile:14:15" }),
      expect.objectContaining({ kind: "army", entityId: 7 }),
      expect.objectContaining({ kind: "army", entityId: 8 }),
    ]);
    expect(tileListener.mock.invocationCallOrder[0]).toBeLessThan(armyListener.mock.invocationCallOrder[0]);
    expect(armyListener.mock.invocationCallOrder[0]).toBeLessThan(listener.mock.invocationCallOrder[0]);
  });

  it("publishes nothing for rows that end the slice where they started", () => {
    const { projection, explorerTroops, tileOpt, writeArmy, writeTile } = createHarness();
    writeArmy("returning-army", { explorerId: 9, col: 30, row: 31 });
    projection.start();
    const listener = vi.fn();
    projection.subscribe(listener);

    writeTile("chest", { col: 10, row: 11, occupierId: 7 });
    removeComponent(tileOpt, "chest");
    writeArmy("army", { explorerId: 8, col: 20, row: 21 });
    removeComponent(explorerTroops, "army");
    writeArmy("returning-army", { explorerId: 9, col: 40, row: 41 });
    writeArmy("returning-army", { explorerId: 9, col: 30, row: 31 });
    projection.flush();

    expect(listener).not.toHaveBeenCalled();
    expect(projection.getChests()).toEqual([]);
    expect(projection.getArmies().map(({ entityId }) => entityId)).toEqual([9]);
  });

  it("publishes one net change for a row moved twice inside one slice", () => {
    const { projection, writeArmy } = createHarness();
    writeArmy("army", { explorerId: 7, col: 10, row: 11 });
    projection.start();
    const listener = vi.fn();
    projection.subscribeArmies(listener);

    writeArmy("army", { explorerId: 7, col: 20, row: 21 });
    writeArmy("army", { explorerId: 7, col: 30, row: 31 });
    projection.flush();

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith([
      {
        kind: "army",
        entityId: 7,
        previous: expect.objectContaining({ hexCoords: { col: 10, row: 11 } }),
        current: expect.objectContaining({ hexCoords: { col: 30, row: 31 } }),
      },
    ]);
  });

  it("reads the latest position between writes before the slice is flushed", () => {
    const { projection, writeArmy } = createHarness();
    writeArmy("army", { explorerId: 7, col: 10, row: 11 });
    projection.start();
    const listener = vi.fn();
    projection.subscribeArmies(listener);

    writeArmy("army", { explorerId: 7, col: 20, row: 21 });
    expect(projection.getArmy(7)?.hexCoords).toEqual({ col: 20, row: 21 });
    expect(projection.getArmiesAtHex({ col: 10, row: 11 })).toEqual([]);
    writeArmy("army", { explorerId: 7, col: 30, row: 31 });
    expect(
      projection.getArmiesInBounds({ minCol: 24, maxCol: 32, minRow: 24, maxRow: 32 }).map(({ entityId }) => entityId),
    ).toEqual([7]);
    expect(listener).not.toHaveBeenCalled();

    projection.flush();

    expect(listener).toHaveBeenCalledOnce();
  });

  it("notifies listeners from a rebuild without an explicit flush", () => {
    const { projection, writeTile } = createHarness();
    projection.start();
    const listener = vi.fn();
    projection.subscribeChests(listener);

    writeTile("live-chest", { col: 10, row: 11, occupierId: 7 });
    writeTile("missed-chest", { col: 12, row: 13, occupierId: 8 }, true);
    projection.rebuild();

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith([
      expect.objectContaining({ entityId: 7, current: expect.objectContaining({ hexCoords: { col: 10, row: 11 } }) }),
      expect.objectContaining({ entityId: 8, current: expect.objectContaining({ hexCoords: { col: 12, row: 13 } }) }),
    ]);
  });

  it("drops pending changes on dispose", () => {
    const { projection, writeTile } = createHarness();
    projection.start();
    writeTile("chest", { col: 10, row: 11, occupierId: 7 });

    projection.dispose();
    const listener = vi.fn();
    projection.subscribe(listener);
    projection.flush();

    expect(listener).not.toHaveBeenCalled();
  });
});
