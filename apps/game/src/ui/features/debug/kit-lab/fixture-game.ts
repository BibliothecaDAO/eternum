import { useAccountStore } from "@/hooks/store/use-account-store";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { frontierDay } from "@/ui/features/frontier/deploy/deploy-fixture";
import { buildStoryEventPresentation } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { type BuildingType, getProducedResource, RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";

import release from "../../../../../../../contracts/l3/world-native/schema/release-definition.json";
import { GAME_FAMILIES } from "../../../../../../../config/source/common/native-preset-modes";
import type { GameType } from "../../../../../../../config/source/common/types";

/** The panels lab's and the style sheet's fixture game: the deploy fixture's realm, its player, and Events rows. */

/** The fixture's player, who holds its realm (entity 7) and has no army in the field. */
/** The lab game's chain: a shard at an address that answers nothing, so every history read fails as an offline one. */
export const LAB_CHAIN = "0x1ab";

export const labGameProfile = () => ({ chainId: LAB_CHAIN, gameId: 1, name: "Lab" });

export const PLAYER = "0x111";

/**
 * The deploy fixture's game, made the one this page plays before anything draws: what the HUD reads that the fixture
 * leaves out, its clock, its player and its realm.
 */
export const installFixtureGame = (base: () => { store: NativeFactStore } = frontierDay) => {
  const { store } = base();
  // What the HUD reads that the deploy fixture leaves out: the game's upgrade limits.
  store.applyFacts([
    { model: "UpgradeLimits", key: "0x9", value: { game_id: 1, realm_max: 3, village_max: 3 } },
  ] as never);
  useChainTimeStore.getState().anchor({ timestamp: 350_000 });
  useAccountStore.setState({ account: { address: PLAYER } as never });
  useUIStore.setState({ structureEntityId: 7 });
  return store;
};

/**
 * What a Build card reads of the game's rules: the preset's building rules, and for each resource the given buildings
 * make that has no recipe yet, the fixture's recipe of one Labor for one unit, so a card's details have one to write.
 */
export const installBuildingRules = (store: NativeFactStore, buildings: readonly BuildingType[]) => {
  const made = [...new Set(buildings.flatMap((building) => getProducedResource(building) ?? []))].filter(
    (resource) => !store.get("ProductionRecipe", { game_id: 1, resource_type: resource }),
  );
  store.applyFacts([
    ...release.definition.structures.buildings.map(({ category, rule }) => ({
      model: "BuildingRule",
      key: `0x6${category}`,
      value: { ...rule, category, game_id: 1 },
    })),
    ...made.map((resource) => ({
      model: "ProductionRecipe",
      key: `0x7${resource}`,
      value: {
        game_id: 1,
        resource_type: resource,
        simple_output: "1000000000",
        complex_output: "1000000000",
        simple_inputs: [{ resource_type: ResourcesIds.Labor, amount: "1000000000" }],
        complex_inputs: [],
      },
    })),
  ] as never);
};

/** A story of the player's, worded by the game's one story formatter as the Log and Events both read it. */
const story = (store: NativeFactStore, id: string, kind: string, payload: Record<string, unknown>) =>
  ({
    id,
    event_id: id,
    story: kind,
    owner: PLAYER,
    participants: [PLAYER],
    tx_hash: `0x${id}`,
    timestamp: "350",
    timestampMs: 350_000,
    storyPayload: payload,
    presentation: buildStoryEventPresentation(
      {
        storyType: kind,
        storyPayload: payload,
        ownerAddress: PLAYER,
        viewerAddress: PLAYER,
        timestamp: 350_000,
      } as never,
      store,
      (address) => (BigInt(address) === BigInt(PLAYER) ? "clientlane" : null),
    ),
  }) as unknown as ProcessedStoryEvent;

export const eventStories = (store: NativeFactStore): ProcessedStoryEvent[] => {
  return [
    story(store, "found", "ExplorationReward", {
      explorer_id: 70,
      receiver: 7,
      coord: { x: 2147483650, y: 2147483652 },
      resource_type: ResourcesIds.Essence,
      amount: "200000000000",
    }),
    story(store, "fight", "BattleEvent", {
      attacker_id: 70,
      defender_id: 900,
      attacker: { player: PLAYER, category: "Paladin", tier: "T1", before: "1000000000000", after: "0", roll: 0 },
      defender: {
        player: "0x0",
        category: "Knight",
        tier: "T2",
        before: "5066000000000",
        after: "4800000000000",
        roll: 0,
      },
    }),
  ];
};

export const installLabGame = (
  mode: GameType,
  finished: boolean,
  day: () => { store: NativeFactStore } = frontierDay,
): NativeFactStore => {
  const store = installFixtureGame(day);
  const registry = store.require("GameRegistry", { game_id: 1 });
  store.applyFacts([
    {
      model: "GameRegistry",
      key: "0x3",
      value: { ...registry, family: GAME_FAMILIES[mode], ...(finished ? { end_at: "300" } : {}) },
    },
    {
      model: "StructureBuildings",
      key: "0xb7",
      value: {
        game_id: 1,
        entity_id: "7",
        packed_counts_1: "0",
        packed_counts_2: "0",
        packed_counts_3: "0",
        population: { current: 2, max: 6 },
      },
    },
    ...release.definition.structures.buildings.map(({ category, rule }) => ({
      model: "BuildingRule",
      key: `0x6${category}`,
      value: { ...rule, category, game_id: 1 },
    })),
    ...[1, 2, 3].map((level) => ({
      model: "UpgradeRecipe",
      key: `0xc${level}`,
      value: {
        game_id: 1,
        level,
        costs: [
          { resource_type: ResourcesIds.Labor, amount: String(BigInt(level * 3_000) * BigInt(RESOURCE_PRECISION)) },
          { resource_type: ResourcesIds.Wheat, amount: String(BigInt(level * 2_000) * BigInt(RESOURCE_PRECISION)) },
        ],
      },
    })),
  ] as never);
  return store;
};
