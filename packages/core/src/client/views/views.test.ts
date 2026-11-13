import { baneRateReader } from "../../utils/world-banes";
import { nativeBaneConstants as bane } from "../../../../../contracts/l3/world-native/schema/client.gen";
import { ContractAddress, dailyQuests, getNeighborHexes, StructureType } from "@bibliothecadao/types";
import { hash } from "starknet";
import { afterEach, describe, expect, it } from "vitest";
import { ClientConfigManager, createGameViews, dailyQuest, dayOf, readQuestWeek, type GameViews } from "../../index";
import { setBlockTimestampSource } from "../../utils/timestamp";
import { NativeFactStore } from "../native-fact-store";
import type { GameClient } from "../game-client";
import explorerFixture from "../../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
import preset from "../../../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";

const GAME_ID = 28;
const PLAYER = ContractAddress(0xabc);
const RIVAL = ContractAddress(0xdef);

describe("game views", () => {
  afterEach(() => setBlockTimestampSource(null));

  it("reads the day's quest, completion and collection only from native facts", () => {
    const { store, views } = createHarness();
    expect(views.dailyQuest(12, 100)).toBeUndefined();
    seedQuestGame(store);
    expect(views.dailyQuest(12, 99)).toBeUndefined();
    expect(views.dailyQuest(12, 100)).toMatchObject({
      id: 6,
      day: 0,
      reading: { known: { target: 15n, progress: 0n, completed: false, claimed: false } },
    });
    store.applyFacts([questProgress(15n, 1)]);
    expect(reading(views)).toMatchObject({ target: 15n, progress: 15n, completed: true, claimed: false });
    store.applyFacts([laborGrant()]);
    expect(reading(views)?.claimed).toBe(true);
  });

  it("keeps the reading unknown while the snapshot loads: no zero progress, no missing receipt, no missing bonus", () => {
    const { store, views } = createHarness();
    seedQuestGame(store, { complete: false });
    expect(views.dailyQuest(12, 100)?.reading.unknown).toBe("INCOMPLETE_SNAPSHOT: QuestProgress");
    // The finished progress arrives first: its receipt is not known yet, so nothing may offer collection.
    store.applyFacts([questProgress(15n, 1)]);
    expect(views.dailyQuest(12, 100)?.reading.unknown).toBe("INCOMPLETE_SNAPSHOT: LaborGrant");
    // The receipt arrives: whether the home has the labor bonus is not known yet, so no reward is shown.
    store.applyFacts([laborGrant()]);
    expect(views.dailyQuest(12, 100)?.reading.unknown).toBe("INCOMPLETE_SNAPSHOT: CampaignHome");
    // A campaign home's row settles the bonus at once.
    store.applyFacts([
      { model: "CampaignHome", key: "0x205", value: { game_id: GAME_ID, home: 12n, campaign_id: 1, tier: 1 } },
    ]);
    expect(reading(views)).toMatchObject({ claimed: true, reward: { labor: 1500n, essence: 1500n } });
  });

  it("knows a free home has no bonus only once the snapshot is complete", () => {
    const { store, views } = createHarness();
    seedQuestGame(store, { complete: false });
    store.applyFacts([questProgress(15n, 1), laborGrant()]);
    expect(views.dailyQuest(12, 100)?.reading.unknown).toBe("INCOMPLETE_SNAPSHOT: CampaignHome");
    completeSnapshot(store);
    expect(reading(views)).toMatchObject({ claimed: true, reward: { labor: 1000n, essence: 1500n } });
  });

  it("pays the quest as the contract does: doubled at each level, the labor at 150% for a held Realm's home", () => {
    const { store, views } = createHarness();
    seedQuestGame(store);
    // A free Settlement: 1,000 labor and 1,500 Essence.
    expect(reading(views)?.reward).toEqual({ labor: 1000n, essence: 1500n });
    // Finished as a Kingdom (level 3): ×4 both.
    store.applyFacts([questProgress(45n, 3)]);
    expect(reading(views)?.reward).toEqual({ labor: 4000n, essence: 6000n });
    // The home of a held Realm: 150% of the labor, the Essence unchanged.
    store.applyFacts([{ model: "SettledRealm", key: "0x204", value: { game_id: GAME_ID, realm_id: 77, home: 12n } }]);
    expect(reading(views)?.reward).toEqual({ labor: 6000n, essence: 6000n });
  });

  it("deals the week's seven quests in the bag's order, each past day collected, done or missed as its rows say", () => {
    const { store } = createHarness();
    seedQuestGame(store);
    const day3 = startOfDay(3);
    completeSnapshot(store, day3);
    // Day 0 collected, day 1 done but not collected, day 2 missed.
    store.applyFacts([
      questProgress(15n, 1),
      laborGrant(),
      {
        model: "QuestProgress",
        key: "0x212",
        value: { game_id: GAME_ID, home: 12, day: 1, progress: 2n, completed_level: 1 },
      },
    ]);
    const week = readQuestWeek(store, GAME_ID, 12, day3)!;
    expect(week.today).toBe(3);
    // The season runs far past this week: all seven of its days.
    expect(week.days.map(({ day, id }) => ({ day, id }))).toEqual(
      Array.from({ length: 7 }, (_, day) => ({ day, id: dailyQuest(5n, day) })),
    );
    expect(
      week.days
        .slice(0, 3)
        .map(({ reading }) => reading.known && { completed: reading.known.completed, claimed: reading.known.claimed }),
    ).toEqual([
      { completed: true, claimed: true },
      { completed: true, claimed: false },
      { completed: false, claimed: false },
    ]);
  });

  it("stops the week at the season's last day", () => {
    const { store } = createHarness();
    seedQuestGame(store);
    // The season ends where day 5 (zero-based) would begin: its last day is day 4.
    const registry = store.require("GameRegistry", { game_id: GAME_ID });
    store.applyFacts([{ model: "GameRegistry", key: "0x102", value: { ...registry, end_at: String(startOfDay(5)) } }]);
    completeSnapshot(store, startOfDay(3));
    expect(readQuestWeek(store, GAME_ID, 12, startOfDay(3))!.days.map(({ day }) => day)).toEqual([0, 1, 2, 3, 4]);
  });

  it("keeps the bane quest after early victory and reads the second claim separately", () => {
    const { store, views } = createHarness();
    seedFrontierRules(store, { startMainAt: 100, spacing: 10, seed: "14" });
    seedStructure(store, { entityId: 12, owner: PLAYER, category: StructureType.Realm, x: 1, y: 1 });
    store.setSnapshot({ gameId: GAME_ID, complete: true, actor: PLAYER.toString(), timestamp: 14500 });
    store.applyFacts([
      {
        model: "QuestRules",
        key: "0x201",
        value: {
          game_id: GAME_ID,
          base_counts: dailyQuests.map(({ baseCount }) => baseCount),
          labor: 1000n,
          essence: 1500n,
          bonus_percent: 150,
        },
      },
      {
        model: "BaneRules",
        key: "0x202",
        value: {
          game_id: GAME_ID,
          chance_step: 20,
          quorum_percent: 25,
          beast_percent: 150,
          stamina_percent: 50,
          production_percent: 50,
          quest_counts: [3, 6, 9, 12, 20, 40, 60, 80, 2500, 6000, 10000, 15000],
        },
      },
      { model: "HomeAspect", key: "0x203", value: { game_id: GAME_ID, home: 12, aspect: 1 } },
      { model: "AspectActivity", key: "0x204", value: { game_id: GAME_ID, aspect: 1, day: 0, active: 5 } },
    ]);
    const intervals = baneRateReader(store, GAME_ID, 12, bane.MIST_TIDE)!;
    expect(intervals(14490, 14510)).toEqual([{ start: 14500, end: 14510, percent: 50 }]);
    expect(views.dailyQuest(12, 14500)).toMatchObject({
      id: 8,
      target: 20n,
      bane: { required: 2, completed: 0, won: false },
      bonusClaimed: false,
    });
    store.applyFacts([
      {
        model: "BaneProgress",
        key: "0x205",
        value: { game_id: GAME_ID, aspect: 1, day: 1, completed: 2, ended_at: 15000 },
      },
      {
        model: "QuestProgress",
        key: "0x206",
        value: { game_id: GAME_ID, home: 12, day: 1, progress: 20, completed_level: 1 },
      },
      {
        model: "BaneGrant",
        key: "0x207",
        value: { game_id: GAME_ID, home: 12, day: 1, account: PLAYER, amount: 1000, essence: 1500 },
      },
    ]);
    expect(intervals(14490, 15010)).toEqual([{ start: 14500, end: 15000, percent: 50 }]);
    expect(views.dailyQuest(12, 15001)).toMatchObject({
      id: 8,
      completed: true,
      bane: { won: true, endedAt: 15000 },
      bonusClaimed: true,
    });
    store.applyFacts([{ model: "FirstTeamBane", key: "0x208", value: { game_id: GAME_ID, day: 1 } }]);
    expect(views.dailyQuest(12, 15001)?.id).toBe(8);
  });

  it("lists a player's structures by category then entity id, seen as theirs", () => {
    const { store, views } = createHarness();
    seedStructure(store, { entityId: 30, owner: PLAYER, category: StructureType.Hyperstructure, x: 5, y: 5 });
    seedStructure(store, { entityId: 20, owner: PLAYER, category: StructureType.Realm, x: 3, y: 3 });
    seedStructure(store, { entityId: 7, owner: RIVAL, category: StructureType.Realm, x: 2, y: 2 });
    seedStructure(store, { entityId: 12, owner: PLAYER, category: StructureType.Realm, x: 1, y: 1 });

    const structures = views.structures(PLAYER);

    expect(structures.map((structure) => structure.entityId)).toEqual([12, 20, 30]);
    expect(structures.every((structure) => structure.isMine)).toBe(true);
    expect(views.structures(RIVAL).map(({ entityId, isMine }) => ({ entityId, isMine }))).toEqual([
      { entityId: 7, isMine: false },
    ]);
    expect(views.allRealms().map((realm) => realm.entity_id)).toEqual([20n, 7n, 12n]);
    expect(views.hyperstructureIds(PLAYER)).toEqual([30]);
  });

  it("lists a Frontier realm founded before the season's first day once that day gives it a site", () => {
    const { store, views } = createHarness();
    seedFrontierRules(store, { startMainAt: 100, spacing: 10 });
    seedStructure(store, { entityId: 12, owner: PLAYER, category: StructureType.Realm, x: 1, y: 1 });

    setBlockTimestampSource(() => 99);
    expect(views.structures(PLAYER)).toEqual([]);
    expect(views.realms(PLAYER)).toEqual([]);

    setBlockTimestampSource(() => 100);
    // Realm 12's region is the twelfth of the first day's row, ten tiles wide: its centre is (115, 5).
    const site = { x: 115, y: 5, alt: false };
    expect(views.structures(PLAYER).map(({ entityId, position }) => ({ entityId, position }))).toEqual([
      { entityId: 12, position: site },
    ]);
    expect(views.realms(PLAYER).map(({ entityId, position }) => ({ entityId, position }))).toEqual([
      { entityId: 12, position: site },
    ]);
  });

  it("reads a structure's explorers with stamina, home, and ownership relative to the viewer", () => {
    const { store, views } = createHarness();
    seedStructure(store, { entityId: 12, owner: PLAYER, category: StructureType.Realm, x: 10, y: 10 });
    const homeHex = getNeighborHexes(10, 10)[0];
    seedExplorer(store, { explorerId: 101, owner: 12, x: homeHex.col, y: homeHex.row, stamina: 40n });
    seedExplorer(store, { explorerId: 102, owner: 12, x: 50, y: 50, stamina: 5n });
    seedExplorer(store, { explorerId: 103, owner: 99, x: 60, y: 60, stamina: 0n });
    expect(() => views.explorers(99)).toThrow("not synchronized");
    seedStructure(store, { entityId: 99, owner: RIVAL, category: StructureType.Realm, x: 59, y: 60 });

    const explorers = views.explorers(12);

    expect(explorers.map(({ entityId, stamina, isHome, isMine }) => ({ entityId, stamina, isHome, isMine }))).toEqual([
      { entityId: 101, stamina: 40n, isHome: true, isMine: true },
      { entityId: 102, stamina: 5n, isHome: false, isMine: true },
    ]);
    expect(createGameViews(fakeClient(store), RIVAL, () => null).explorers(12)[0]?.isMine).toBe(false);
    expect(views.explorers(99).map((explorer) => explorer.entityId)).toEqual([103]);
    expect(views.explorers(1)).toEqual([]);
  });

  it("hands out a resource manager bound to the entity's native weight row in the active game", () => {
    const { store, views } = createHarness();
    store.applyFacts([
      { model: "ResourceWeight", key: "0xc", value: { game_id: GAME_ID, entity_id: 12, weight: 0n, capacity: 1000n } },
    ]);

    expect(views.resources(12).hasResources()).toBe(true);
    expect(views.resources(13).hasResources()).toBe(false);
  });
});

const createHarness = (): { store: NativeFactStore; views: GameViews } => {
  ClientConfigManager.instance().setActiveGame(GAME_ID, 1);
  const store = new NativeFactStore();
  return { store, views: createGameViews(fakeClient(store), PLAYER, () => null) };
};

const fakeClient = (store: NativeFactStore): GameClient => ({ gameId: GAME_ID, setup: { store } }) as GameClient;

const seedStructure = (
  store: NativeFactStore,
  input: { entityId: number; owner: ContractAddress; category: StructureType; x: number; y: number },
) =>
  store.applyFacts([
    {
      model: "TileOccupancy",
      key: hash.computePoseidonHashOnElements([GAME_ID, 0, input.x, input.y]),
      value: {
        game_id: GAME_ID,
        alt: false,
        col: input.x,
        row: input.y,
        entity_id: input.entityId,
        category: input.category,
        is_structure: true,
      },
    },
    {
      model: "Structure",
      key: `0x${input.entityId.toString(16)}`,
      value: {
        game_id: GAME_ID,
        entity_id: input.entityId,
        owner: input.owner,
        base: {
          category: input.category,
          level: 0,
          created_at: 1,
          troop_max_guard_count: 1,
          troop_max_explorer_count: 1,
          starting_troops_granted: false,
        },
        metadata: {
          realm_id: 1,
          village_realm: 0,
          has_wonder: false,
          order: 0,
          mine_kind: 0,
          deepest_depth: 0,
        },
        resources_packed: 0n,
      },
    },
  ]);

/** A Frontier game's rules: hour-long day units from `startMainAt`, regions `spacing` tiles wide. */
const seedFrontierRules = (store: NativeFactStore, input: { startMainAt: number; spacing: number; seed?: string }) =>
  store.applyFacts([
    { model: "SliceRules", key: "0x100", value: { ...preset.rules, game_id: GAME_ID, day_unit_seconds: 3600 } },
    {
      model: "SettlementRules",
      key: "0x101",
      value: { game_id: GAME_ID, registration_start: 1, registration_limit: 2, spacing: input.spacing, mode: "Single" },
    },
    {
      model: "GameRegistry",
      key: "0x102",
      value: {
        game_id: GAME_ID,
        preset_id: 3,
        name: "1",
        start_settling_at: "1",
        start_main_at: String(input.startMainAt),
        end_at: "1000000",
        settled: false,
        ready: true,
        dev_mode_on: false,
        end_grace_seconds: 0,
        seed: input.seed ?? "1",
      },
    },
  ] as never);

const seedExplorer = (
  store: NativeFactStore,
  input: { explorerId: number; owner: number; x: number; y: number; stamina: bigint },
) =>
  store.applyFacts([
    {
      model: "TileOccupancy",
      key: hash.computePoseidonHashOnElements([GAME_ID, 0, input.x, input.y]),
      value: {
        game_id: GAME_ID,
        alt: false,
        col: input.x,
        row: input.y,
        entity_id: input.explorerId,
        category: 15,
        is_structure: false,
      },
    },
    {
      model: "ExplorerTroops",
      key: `0x${input.explorerId.toString(16)}`,
      value: {
        ...explorerFixture.expected.key,
        ...explorerFixture.expected.value,
        game_id: GAME_ID,
        explorer_id: input.explorerId,
        owner: input.owner,
        troops: {
          ...explorerFixture.expected.value.troops,
          count: 100n,
          stamina: { Inline: { amount: input.stamina, settled_at: 1, remainder: 0 } },
        },
      },
    },
  ]);

/** Season 1's quest rules over a Frontier game on day 0, the player's Realm 12, and the player's snapshot. */
const seedQuestGame = (store: NativeFactStore, snapshot: { complete: boolean } = { complete: true }) => {
  seedFrontierRules(store, { startMainAt: 100, spacing: 10, seed: "5" });
  seedStructure(store, { entityId: 12, owner: PLAYER, category: StructureType.Realm, x: 1, y: 1 });
  store.applyFacts([
    {
      model: "QuestRules",
      key: "0x201",
      value: {
        game_id: GAME_ID,
        base_counts: dailyQuests.map(({ baseCount }) => baseCount),
        labor: 1000n,
        essence: 1500n,
        bonus_percent: 150,
      },
    },
  ]);
  if (snapshot.complete) completeSnapshot(store);
  else store.setSnapshot({ gameId: GAME_ID, complete: false, actor: PLAYER.toString(), timestamp: 100 });
};
const completeSnapshot = (store: NativeFactStore, timestamp = 100) =>
  store.setSnapshot({ gameId: GAME_ID, complete: true, actor: PLAYER.toString(), timestamp });
/** The first second of a season day (zero-based) on the quest game's calendar: seed 5, from 100, hour-long units. */
const startOfDay = (index: number): number => {
  const calendar = { seed: 5n, startMainAt: 100, endAt: 1_000_000, dayUnitSeconds: 3600 };
  let at = 100;
  while (dayOf(calendar, at)!.index < index) at = dayOf(calendar, at)!.end;
  return at;
};
const questProgress = (progress: bigint, completedLevel: number) => ({
  model: "QuestProgress",
  key: "0x202",
  value: { game_id: GAME_ID, home: 12, day: 0, progress, completed_level: completedLevel },
});
const laborGrant = () => ({
  model: "LaborGrant",
  key: "0x203",
  value: { game_id: GAME_ID, home: 12, day: 0, account: PLAYER, amount: 1000n, essence: 1500n },
});
const reading = (views: GameViews) => views.dailyQuest(12, 100)?.reading.known;
