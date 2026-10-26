// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

// The deployment form reads the map's tiles and the clock; neither is this test's business.
vi.mock("@/hooks/use-world-spatial-tiles", () => ({ useWorldSpatialTiles: () => [] }));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({
  useCurrentDefaultTick: () => 1,
  useCurrentArmiesTick: () => 1,
  useCurrentBlockTimestamp: () => 350,
}));
vi.mock("@/utils/can-issue-orders", () => ({
  canIssueOrders: () => true,
  actNowRefusal: () => null,
  refusedBeforePlay: () => false,
}));

import { GameProvider } from "@/hooks/context/game-context";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { disposeGameSyncSession } from "@/sync/active-game-client";
import { useArmyCreation } from "@/ui/features/military/components/unified-army-creation-modal/use-army-creation";
import { getRealmInfo, setBuildingCount } from "@bibliothecadao/eternum";
import { readBlitzRealmSuggestions } from "@bibliothecadao/eternum/automation";
import type { GameClientSetup, NativeFactStore } from "@bibliothecadao/eternum/game-client";
import {
  BiomeType,
  BiomeTypeToId,
  BuildingType,
  RESOURCE_PRECISION,
  ResourcesIds,
  TroopTier,
  TroopType,
} from "@bibliothecadao/types";
import { nativeTilePackingConstants } from "../../../../../../../../contracts/l3/world-native/schema/client.gen";

import { BLITZ_REALM_ID, installBlitzBuildRealm } from "../../../debug/kit-lab/blitz-build-fixture";
import { installLabGame, PLAYER } from "../../../debug/kit-lab/fixture-game";
import { useSuggestionActions } from "./use-suggestion-actions";

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

/** The realm's steps, by the game's own reader over the facts it holds, at `tick`, its automation set as `trains`. */
const readSteps = (store: NativeFactStore, trains = false, tick = 1) =>
  readBlitzRealmSuggestions({
    store,
    realmId: BLITZ_REALM_ID,
    realmName: "Egonal",
    isBlitzActive: true,
    tiles: { isHexOccupied: () => false },
    tick,
    automationTrains: () => trains,
  });

/** The realm's next step in words: its action and its reason. */
const nextStep = (store: NativeFactStore, trains = false, tick = 1) =>
  readSteps(store, trains, tick).map(({ action, reason }) => `${action} · ${reason}`);

/** One troop's balance at the realm, in whole troops. */
const holdTroops = (store: NativeFactStore, resource: ResourcesIds, count: number) =>
  store.applyFacts([
    {
      model: "ResourceBalance",
      key: `0xb5${resource}`,
      value: {
        game_id: 1,
        entity_id: BLITZ_REALM_ID,
        resource_type: resource,
        balance: String(BigInt(count) * BigInt(RESOURCE_PRECISION)),
      },
    },
  ] as never);

/** A paid batch of `count` Paladins from the realm's barracks, one a second from `from`, with room to store them. */
const trainPaladins = (store: NativeFactStore, count: number, from: number) =>
  store.applyFacts([
    {
      model: "ResourceProduction",
      key: `0xc5${ResourcesIds.Paladin}`,
      value: {
        game_id: 1,
        entity_id: BLITZ_REALM_ID,
        resource_type: ResourcesIds.Paladin,
        building_count: 1,
        production_rate: String(RESOURCE_PRECISION),
        output_amount_left: String(BigInt(count) * BigInt(RESOURCE_PRECISION)),
        last_settled_at: from,
      },
    },
    {
      model: "ResourceWeight",
      key: "0x6",
      value: { game_id: 1, entity_id: BLITZ_REALM_ID, capacity: String((1n << 128n) - 1n), weight: "0" },
    },
  ] as never);

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
  ] as never);
  holdTroops(store, ResourcesIds.Paladin, paladins);
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

  it("trains again once a paid batch has run out short of a full army, with no later write of its row", () => {
    const store = blitzRealm();
    cityWithBarracks(store, 400);
    trainPaladins(store, 100, 400);
    // The batch runs from 400 to 500: in training until then, nothing to take.
    expect(nextStep(store, false, 450)).toEqual([]);
    // Run out at 500 with 500 on hand, short of 7,500: nothing trains them now.
    for (const at of [1_000, 10_000]) {
      expect(nextStep(store, false, at)).toEqual([
        "train-troops · Paladin T1: 500 of 7,500 for a full army, and none in training.",
      ]);
    }
  });

  it("opens the deployment on the troop it names, a full army of it, though the realm holds another troop too", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const store = blitzRealm();
    cityWithBarracks(store, 7_500);
    holdTroops(store, ResourcesIds.Crossbowman, 1);
    const [deploy] = readSteps(store);
    expect(deploy?.action).toBe("deploy-army");
    // The deployment form as Military opens it on the order the step gave.
    const Form = () => {
      const target = useUIStore((state) => state.pendingMilitaryAction)!;
      const form = useArmyCreation({
        structureId: target.structureId,
        isExplorer: target.isExplorer,
        initialTroops: target.troops,
      });
      return <output>{JSON.stringify({ troop: form.selectedTroopCombo, count: form.troopCount })}</output>;
    };
    const Step = () => {
      const { handleSuggestionClick } = useSuggestionActions();
      const opened = useUIStore((state) => state.pendingMilitaryAction) !== null;
      return (
        <>
          <button onClick={() => void handleSuggestionClick(deploy as never)}>Deploy</button>
          {opened && <Form />}
        </>
      );
    };
    useUIStore.setState({ pendingMilitaryAction: null });
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () =>
      root.render(
        <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: PLAYER } as never}>
          <Step />
        </GameProvider>,
      ),
    );
    await act(async () => host.querySelector("button")!.click());
    expect(JSON.parse(host.querySelector("output")!.textContent!)).toEqual({
      troop: { type: TroopType.Paladin, tier: TroopTier.T1 },
      count: 7_500,
    });
    await act(async () => root.unmount());
    useUIStore.setState({ pendingMilitaryAction: null });
  });
});
