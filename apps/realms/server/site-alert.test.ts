import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { dayOf } from "@bibliothecadao/eternum/expeditions";
import { learnResearch } from "@bibliothecadao/eternum/realm-research";
import { RESOURCE_PRECISION, StructureType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";

import preset from "../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";
import explorerFixture from "../../../contracts/l3/world-native/schema/fixtures/row-set.json";
import { nativeResearchConstants as research } from "../../../contracts/l3/world-native/schema/client.gen";
import { siteChances, siteWatchesOf } from "./site-alert";

/**
 * One player's view of a Season 1 game, as the notifier reads it from Herald: their realm (Harmony, Spire lore) and its
 * army on the surface, and the Deep's Foundation held by a Chaos home's guard draining 200 troops a ten-second tick.
 */
const GAME_ID = 1;
const PLAYER = "0x4b1d";
const RIVAL = "0x7e1";
const HOME = 5;
const RIVAL_HOME = 6;
const ARMY = 7;
const GUARD = 8;
const FOUNDATION = 100;
const HARMONY = 2;
const CHAOS = 3;
const TICK_SECONDS = 10;
const DAY_UNIT_SECONDS = 14_400;
/** Seed 1's first day lasts three units (12 hours) from the season's start. */
const SEASON_START = 1_000_000;
const DAY_END = SEASON_START + 3 * DAY_UNIT_SECONDS;
/** An hour into day 0, on a tick boundary. */
const NOW = SEASON_START + 3_600;

const troops = (count: number) => `0x${(BigInt(count) * BigInt(RESOURCE_PRECISION)).toString(16)}`;

interface Scene {
  /** The second the player's read is taken; the guard's troops were last settled then. */
  now?: number;
  army?: number;
  armyInTheDeep?: boolean;
  guard?: number;
  guardAspect?: number;
  spireLore?: boolean;
}

const sceneStore = ({
  now = NOW,
  army = 1_500,
  armyInTheDeep = false,
  guard = 2_000,
  guardAspect = CHAOS,
  spireLore = true,
}: Scene = {}) => {
  const store = new NativeFactStore();
  const row = (model: string, key: number | string, value: Record<string, unknown>) => ({
    model,
    key: typeof key === "number" ? `0x${key.toString(16)}` : key,
    value: { game_id: GAME_ID, ...value },
  });
  const realm = (home: number, owner: string) =>
    row("Structure", home, {
      entity_id: home,
      owner,
      base: {
        category: StructureType.Realm,
        level: 0,
        created_at: SEASON_START,
        troop_max_guard_count: 1,
        troop_max_explorer_count: 1,
        starting_troops_granted: true,
      },
      metadata: { realm_id: home, village_realm: 0, has_wonder: false, order: 0, mine_kind: 0, deepest_depth: 0 },
      resources_packed: 0n,
    });
  const explorer = (id: number, home: number, count: number) =>
    row("ExplorerTroops", id, {
      ...explorerFixture.expected.value,
      explorer_id: id,
      owner: home,
      troops: { ...explorerFixture.expected.value.troops, count: troops(count) },
    });
  store.applyFacts([
    row("SliceRules", 0x1, {
      ...preset.rules,
      tick_config: { ...preset.rules.tick_config, armies_tick_in_seconds: TICK_SECONDS },
      day_unit_seconds: DAY_UNIT_SECONDS,
    }),
    row("SettlementRules", 0x2, { registration_start: 0, registration_limit: 0, mode: "Single", spacing: 1_024 }),
    row("GameRegistry", 0x3, {
      name: "0x1",
      preset_id: 7,
      settled: false,
      ready: true,
      dev_mode_on: false,
      start_settling_at: SEASON_START,
      start_main_at: SEASON_START,
      end_at: SEASON_START + 50 * 86_400,
      end_grace_seconds: 0,
      seed: "0x1",
    }),
    row("DeepRules", 0x4, {
      foundation: { alt: false, x: 25, y: 35 },
      quarry: { alt: false, x: 12, y: 20 },
      altar: { alt: false, x: 38, y: 20 },
      beast_count: troops(10_000),
      loss_per_tick: troops(200),
      quarry_per_tick: 500,
      altar_per_tick: 5,
      altar_threshold: 1_500,
    }),
    realm(HOME, PLAYER),
    realm(RIVAL_HOME, RIVAL),
    row("RealmKnowledge", 0x10, {
      structure_id: HOME,
      learned: spireLore ? learnResearch(0n, research.ROW_DEPTH, 0) : 0n,
    }),
    row("HomeAspect", 0x11, { home: HOME, aspect: HARMONY }),
    row("HomeAspect", 0x12, { home: RIVAL_HOME, aspect: guardAspect }),
    explorer(ARMY, HOME, army),
    row("ArmyDay", 0x13, { explorer_id: ARMY, day: 0 }),
    ...(armyInTheDeep ? [row("DeepArmy", 0x14, { explorer_id: ARMY, last_tick: now / TICK_SECONDS })] : []),
    explorer(GUARD, RIVAL_HOME, guard),
    row("ArmyDay", 0x15, { explorer_id: GUARD, day: 0 }),
    row("DeepArmy", 0x16, { explorer_id: GUARD, last_tick: now / TICK_SECONDS }),
    row("DeepSite", FOUNDATION, { entity_id: FOUNDATION, kind: 0, day: 0 }),
    row("DeepGuard", 0x17, { explorer_id: GUARD, site_id: FOUNDATION, slot: 0 }),
  ] as never);
  store.setSnapshot({ gameId: GAME_ID, actor: PLAYER, complete: true, timestamp: now });
  return store;
};

const chancesAt = (scene: Scene, now = NOW) => siteChances(sceneStore({ ...scene, now }), GAME_ID, PLAYER, now * 1000);

describe("a player's chances at the Deep's sites", () => {
  it("knows the fixture's day", () => {
    const calendar = {
      seed: 1n,
      startMainAt: SEASON_START,
      endAt: SEASON_START + 50 * 86_400,
      dayUnitSeconds: DAY_UNIT_SECONDS,
    };
    expect(dayOf(calendar, NOW)).toEqual({ index: 0, start: SEASON_START, end: DAY_END });
  });

  it("finds the tick when another Aspect's guard drains to where the largest army is 150% of it", () => {
    // 2,000 troops lose 200 a tick: five ticks on, 1,000 is two thirds of the army's 1,500.
    expect(chancesAt({})).toEqual([
      {
        siteId: FOUNDATION,
        name: "Foundation",
        day: 0,
        takeableAt: (NOW + 5 * TICK_SECONDS) * 1000,
        guard: 1_000,
        army: 1_500,
        dayEndsAt: DAY_END * 1000,
      },
    ]);
  });

  it("says now when the guard is already within reach", () => {
    expect(chancesAt({ guard: 1_000 })[0]).toMatchObject({ takeableAt: NOW * 1000, guard: 1_000 });
  });

  it("has no time today when the day ends before the guard drains enough", () => {
    expect(chancesAt({}, DAY_END - 3 * TICK_SECONDS)[0]).toMatchObject({ takeableAt: null });
  });

  it("watches nothing at the player's own Aspect's site, without Spire lore, or without an army outside the Deep", () => {
    expect(chancesAt({ guardAspect: HARMONY })).toEqual([]);
    expect(chancesAt({ spireLore: false })).toEqual([]);
    expect(chancesAt({ armyInTheDeep: true })).toEqual([]);
  });

  it("makes a watch only for a site within reach today and not yet told", () => {
    const watcher = { gameId: GAME_ID, actor: PLAYER, owner: "owner" };
    const chances = chancesAt({});
    expect(siteWatchesOf(watcher, chances, () => false)).toEqual([
      { ...watcher, siteId: FOUNDATION, day: 0, wakeAt: (NOW + 5 * TICK_SECONDS) * 1000, attempts: 0 },
    ]);
    expect(siteWatchesOf(watcher, chances, () => true)).toEqual([]);
    expect(siteWatchesOf(watcher, chancesAt({}, DAY_END - 3 * TICK_SECONDS), () => false)).toEqual([]);
  });
});
