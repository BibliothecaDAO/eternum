// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { disposeGameSyncSession } from "@/sync/active-game-client";
import { getRealmInfo, setBuildingCount } from "@bibliothecadao/eternum";
import { readBlitzRealmSuggestions } from "@bibliothecadao/eternum/automation";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { BiomeType, BiomeTypeToId, BuildingType, RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { nativeTilePackingConstants } from "../../../../../../../../contracts/l3/world-native/schema/client.gen";

import { BLITZ_REALM_ID, installBlitzBuildRealm } from "../../../debug/kit-lab/blitz-build-fixture";
import { installLabGame } from "../../../debug/kit-lab/fixture-game";

afterEach(() => disposeGameSyncSession());

/** Grassland, where Paladins fight 30% better: the realm's troop is the Paladin. */
const GRASSLAND = BigInt(BiomeTypeToId[BiomeType.Grassland]) * BigInt(nativeTilePackingConstants.BIOME_SCALE);

/** A row as the store holds it, ready to write back: bigints as the strings a fact carries. */
const wire = (row: unknown) =>
  JSON.parse(JSON.stringify(row, (_, field) => (typeof field === "bigint" ? field.toString() : field)));

/** The lab's Blitz realm, stocked to build, as the game holds it. */
const blitzRealm = () => {
  const store = installLabGame(2, false);
  installBlitzBuildRealm(store, true);
  return store;
};

/** The realm's next step, by the game's own reader over the facts it holds, with its automation set as `trains`. */
const nextStep = (store: NativeFactStore, trains = false) =>
  readBlitzRealmSuggestions({
    store,
    realmId: BLITZ_REALM_ID,
    realmName: "Egonal",
    isBlitzActive: true,
    tiles: { isHexOccupied: () => false },
    tick: 1,
    automationTrains: () => trains,
  }).map(({ action, reason }) => `${action} · ${reason}`);

/** The realm's population: `current` used of its buildings' room (6) and the game's base room (6). */
const housePopulation = (store: NativeFactStore, current: number) => {
  const buildings = store.require("StructureBuildings", { game_id: 1, entity_id: BLITZ_REALM_ID });
  store.applyFacts([
    { model: "StructureBuildings", key: "0xb7", value: { ...wire(buildings), population: { current, max: 6 } } },
  ] as never);
};

/**
 * The realm a City on grassland with the default order's City buildings up to its Paladin barracks, and `paladins` on
 * hand; written again, each row keeps its key.
 */
const cityWithBarracks = (store: NativeFactStore, paladins: number) => {
  const built: [BuildingType, number][] = [
    [BuildingType.ResourceWheat, 4],
    [BuildingType.ResourceWood, 2],
    [BuildingType.ResourceCoal, 2],
    [BuildingType.ResourceCopper, 2],
    [BuildingType.ResourcePaladinT1, 1],
  ];
  const counts = built.reduce((packed, [type, count]) => setBuildingCount(type, packed, count), [0n, 0n, 0n]);
  const realm = store.require("Structure", { game_id: 1, entity_id: BLITZ_REALM_ID });
  const buildings = store.require("StructureBuildings", { game_id: 1, entity_id: BLITZ_REALM_ID });
  const position = getRealmInfo(BLITZ_REALM_ID, store, () => null)!.position;
  store.applyFacts([
    { model: "Structure", key: "0x7", value: { ...wire(realm), base: { ...wire(realm.base), level: 1 } } },
    {
      model: "StructureBuildings",
      key: "0xb7",
      value: {
        ...wire(buildings),
        packed_counts_1: String(counts[0]),
        packed_counts_2: String(counts[1]),
        packed_counts_3: String(counts[2]),
      },
    },
    {
      model: "TileOpt",
      key: "0xb8",
      value: { game_id: 1, alt: false, col: position.x, row: position.y, data: GRASSLAND.toString() },
    },
    {
      model: "ResourceBalance",
      key: `0xb5${ResourcesIds.Paladin}`,
      value: {
        game_id: 1,
        entity_id: BLITZ_REALM_ID,
        resource_type: ResourcesIds.Paladin,
        balance: String(BigInt(paladins) * BigInt(RESOURCE_PRECISION)),
      },
    },
  ] as never);
};

describe("a Blitz realm's next step, read from the game's facts", () => {
  it("builds the next farm at population 9 of 12, and a worker hut only once the farm has no room", () => {
    const store = blitzRealm();
    housePopulation(store, 9);
    expect(nextStep(store)).toEqual(["build-wheat · Wheat farms: 0 of 2 built."]);
    housePopulation(store, 12);
    expect(nextStep(store)).toEqual([
      "build-worker-hut · Wheat farms: 0 of 2 built. Population 12 of 12: a worker hut makes room.",
    ]);
  });

  it("trains the realm's own troop after its barracks, waits while it trains, and deploys a full army", () => {
    const store = blitzRealm();
    cityWithBarracks(store, 400);
    expect(nextStep(store)).toEqual(["train-troops · Paladin T1: 400 of 7,500 for a full army, and none in training."]);
    // Its automation trains them: nothing to take while they come.
    expect(nextStep(store, true)).toEqual([]);
    // A full army at a City of this game is 7,500 Paladins.
    cityWithBarracks(store, 7_500);
    expect(nextStep(store, true)).toEqual(["deploy-army · Paladin T1: 7,500 on hand, a full army of 7,500."]);
  });
});
