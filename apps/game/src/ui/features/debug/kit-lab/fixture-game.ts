import { useAccountStore } from "@/hooks/store/use-account-store";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { frontierDay } from "@/ui/features/frontier/deploy/deploy-fixture";
import { buildStoryEventPresentation, configManager } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import {
  type BuildingType,
  getProducedResource,
  relicChestRelics,
  RESOURCE_PRECISION,
  ResourcesIds,
} from "@bibliothecadao/types";

import preset from "../../../../../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";

/** The panels lab's and the style sheet's fixture game: the deploy fixture's realm, its player, and Events rows. */

/** The fixture's player, who holds its realm (entity 7) and has no army in the field. */
/** The lab game's chain: a shard at an address that answers nothing, so every history read fails as an offline one. */
export const LAB_CHAIN = "0x1ab";

/** The lab game as the page plays it (setActiveGame): its chain, game 1 there, its preset. */
export const labGameProfile = (preset: number) => ({ chainId: LAB_CHAIN, gameId: 1, presetId: preset, name: "Lab" });

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
    ...preset.buildings.map(({ category, rule }) => ({
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

/** What a newcomer's first minutes tell in Events: a find of Essence, a crate opened, a fight lost. */
export const eventStories = (store: NativeFactStore): ProcessedStoryEvent[] => {
  const chest = { pack: "War", lucky: false } as const;
  const scaledPoints = (points: number) => BigInt(points) * 1_000_000n;
  return [
    story(store, "found", "ExplorationReward", {
      explorer_id: 70,
      receiver: 7,
      coord: { x: 2147483650, y: 2147483652 },
      resource_type: ResourcesIds.Essence,
      amount: "200000000000",
    }),
    story(store, "crate", "RelicChestOpened", {
      explorer_id: 70,
      coord: { x: 2147483651, y: 2147483652 },
      chest,
      relics: relicChestRelics(chest),
      points: scaledPoints(configManager.getVictoryPointGrants().openRelicCrate),
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

/**
 * The fixture game as the mode plays it (its preset), ended a while ago for a finished game, with what the whole HUD
 * reads that the fixture leaves out: the realm's buildings and population, the preset's building rules, and the realm's
 * upgrade recipes (labor and wheat, more each level). Its day is the deploy fixture's, or the one given.
 */
export const installLabGame = (
  presetId: number,
  finished: boolean,
  day: () => { store: NativeFactStore } = frontierDay,
): NativeFactStore => {
  const store = installFixtureGame(day);
  const registry = store.require("GameRegistry", { game_id: 1 });
  store.applyFacts([
    {
      model: "GameRegistry",
      key: "0x3",
      value: { ...registry, preset_id: presetId, ...(finished ? { end_at: "300" } : {}) },
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
    ...preset.buildings.map(({ category, rule }) => ({
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
