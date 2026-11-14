import { describe, expect, it } from "vitest";
import preset from "../../../../../contracts/l3/world-native/tests/fixtures/current-presets/conformance.json";
import { NativeFactStore } from "../native-fact-store";
import { readDailyQuest } from "./quests";

function fixture() {
  const store = new NativeFactStore();
  store.applyFacts([
    { model: "SliceRules", key: "1", value: { ...preset.rules, game_id: 1, day_unit_seconds: 100 } },
    {
      model: "GameRegistry",
      key: "1",
      value: {
        game_id: 1,
        preset_id: 7,
        name: "1",
        start_settling_at: 1,
        start_main_at: 100,
        end_at: 10_000,
        settled: false,
        ready: true,
        dev_mode_on: false,
        end_grace_seconds: 0,
        seed: 5,
      },
    },
    {
      model: "SettlementRules",
      key: "1",
      value: {
        game_id: 1,
        registration_start: 1,
        registration_limit: 2,
        spacing: 10,
        mode: "Single",
      },
    },
    {
      model: "QuestRules",
      key: "1",
      value: {
        game_id: 1,
        base_counts: [1, 1, 1, 1, 1, 2, 15],
        labor: 1000,
        essence: 1500,
        bonus_percent: 150,
      },
    },
    {
      model: "Structure",
      key: "1:7",
      value: {
        game_id: 1,
        entity_id: 7,
        owner: "0x111",
        resources_packed: 0,
        base: {
          category: 1,
          level: 0,
          created_at: 100,
          troop_max_guard_count: 0,
          troop_max_explorer_count: 0,
          starting_troops_granted: false,
        },
        metadata: { realm_id: 1, village_realm: 0, mine_kind: 0, deepest_depth: 0, has_wonder: false, order: 0 },
      },
    },
  ]);
  store.setSnapshot({ gameId: 1, complete: true, actor: "0x111", timestamp: 100 });
  const read = () => readDailyQuest(store, 1, 7, 100);
  const progress = (amount: number, level: number) =>
    store.applyFacts([
      {
        model: "QuestProgress",
        key: "1:7:0",
        value: { game_id: 1, home: 7, day: 0, progress: amount, completed_level: level },
      },
    ]);
  return { store, read, progress };
}

describe("daily quest facts", () => {
  it("reads the calendar's quest, scoped zero, exact target and free-home reward", () => {
    const { store, read } = fixture();
    expect(read()).toMatchObject({
      day: 0,
      name: "Cartographers",
      reading: {
        known: {
          target: 15n,
          progress: 0n,
          completed: false,
          claimed: false,
          reward: { labor: 1000n, essence: 1500n },
        },
      },
    });
    expect([...store.rows("QuestProgress")]).toEqual([]);
  });

  it("keeps the level recorded at completion after the Realm upgrades, then reads the collection receipt", () => {
    const { store, read, progress } = fixture();
    progress(15, 1);
    const home = store.require("Structure", { game_id: 1, entity_id: 7 });
    store.applyFacts([{ model: "Structure", key: "1:7", value: { ...home, base: { ...home.base, level: 3 } } }]);
    expect(read()?.reading.known).toEqual({
      target: 15n,
      progress: 15n,
      completed: true,
      claimed: false,
      reward: { labor: 1000n, essence: 1500n },
    });
    store.applyFacts([
      {
        model: "LaborGrant",
        key: "1:7:0",
        value: {
          game_id: 1,
          home: 7,
          day: 0,
          account: "0x111",
          amount: 1_000_000_000_000,
          essence: 1_500_000_000_000,
        },
      },
    ]);
    expect(read()?.reading.known?.claimed).toBe(true);
  });

  it.each(["held", "campaign"])("applies only the labor bonus to a %s home at the completed level", (source) => {
    const { store, read, progress } = fixture();
    progress(30, 2);
    store.applyFacts([
      source === "held"
        ? { model: "SettledRealm", key: "1:123", value: { game_id: 1, realm_id: 123, home: 7 } }
        : { model: "CampaignHome", key: "1:7", value: { game_id: 1, home: 7, campaign_id: 9, tier: 1 } },
    ]);
    expect(read()?.reading.known).toMatchObject({ target: 30n, reward: { labor: 3000n, essence: 3000n } });
  });

  it("does not infer a missing receipt or bonus from an incomplete snapshot", () => {
    const { store, read, progress } = fixture();
    progress(15, 1);
    store.setSnapshot({ gameId: 1, complete: false, actor: "0x111", timestamp: 100 });
    expect(read()?.reading.unknown).toContain("INCOMPLETE_SNAPSHOT: LaborGrant");
    store.applyFacts([
      {
        model: "LaborGrant",
        key: "1:7:0",
        value: {
          game_id: 1,
          home: 7,
          day: 0,
          account: "0x111",
          amount: 1,
          essence: 1,
        },
      },
    ]);
    expect(read()?.reading.unknown).toContain("INCOMPLETE_SNAPSHOT: CampaignHome");
  });

  it("does not synthesize progress outside the actor's expedition", () => {
    const { store, read } = fixture();
    store.setSnapshot({ gameId: 1, complete: true, actor: "0x222", timestamp: 100 });
    expect(read()?.reading.unknown).toContain("OUTSIDE_SNAPSHOT_SCOPE: QuestProgress");
  });

  it("has no quest before the season, after it, or for a preset without quest rules", () => {
    const { store } = fixture();
    expect(readDailyQuest(store, 1, 7, 99)).toBeUndefined();
    expect(readDailyQuest(store, 1, 7, 10_000)).toBeUndefined();
    store.applyFacts([{ model: "QuestRules", key: "1", value: null }]);
    expect(readDailyQuest(store, 1, 7, 100)).toBeUndefined();
  });
});
