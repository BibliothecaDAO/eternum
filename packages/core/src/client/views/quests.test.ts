import { readBaneDay, readBaneEffects } from "./banes";
import { describe, expect, it } from "vitest";
import preset from "../../../../../contracts/l3/world-native/tests/fixtures/current-presets/conformance.json";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";
import { nativeBaneConstants, nativeQuestConstants } from "../../../../../contracts/l3/world-native/schema/client.gen";
import { dayOf } from "../../utils/days";
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
        scheduled_end_at: 10_000,
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
      reading: {
        known: {
          target: 15n,
          progress: 0n,
          quest: { name: "Cartographers" },
          bane: null,
          state: "running",
          receipts: { ordinary: undefined, bonus: undefined },
          reward: { labor: 1000n * BigInt(RESOURCE_PRECISION), essence: 1500n * BigInt(RESOURCE_PRECISION) },
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
    expect(read()?.reading.known).toMatchObject({
      target: 15n,
      progress: 15n,
      state: "done",
      quest: { name: "Cartographers" },
      bane: null,
      receipts: { ordinary: undefined, bonus: undefined },
      reward: { labor: 1000n * BigInt(RESOURCE_PRECISION), essence: 1500n * BigInt(RESOURCE_PRECISION) },
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
    expect(read()?.reading.known).toMatchObject({
      state: "collected",
      reward: { labor: 1000n * BigInt(RESOURCE_PRECISION), essence: 1500n * BigInt(RESOURCE_PRECISION) },
      receipts: { ordinary: { amount: 1_000_000_000_000n, essence: 1_500_000_000_000n } },
    });
  });

  it.each(["held", "campaign"])("applies only the labor bonus to a %s home at the completed level", (source) => {
    const { store, read, progress } = fixture();
    progress(30, 2);
    store.applyFacts([
      source === "held"
        ? { model: "SettledRealm", key: "1:123", value: { game_id: 1, realm_id: 123, home: 7 } }
        : { model: "CampaignHome", key: "1:7", value: { game_id: 1, home: 7, campaign_id: 9, tier: 1 } },
    ]);
    expect(read()?.reading.known).toMatchObject({
      target: 30n,
      reward: { labor: 3000n * BigInt(RESOURCE_PRECISION), essence: 3000n * BigInt(RESOURCE_PRECISION) },
    });
  });

  it("does not infer a missing receipt or bonus from an incomplete snapshot", () => {
    const { store, read, progress } = fixture();
    progress(15, 1);
    store.setSnapshot({ gameId: 1, complete: false, actor: "0x111", timestamp: 100 });
    expect(read()?.reading.unknown).toBe("INCOMPLETE_SNAPSHOT: BaneRules");
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
    expect(read()?.reading.unknown).toBe("INCOMPLETE_SNAPSHOT: BaneRules");
    store.setSnapshot({ gameId: 1, complete: true, actor: "0x111", timestamp: 100 });
    expect(read()?.reading.known).toMatchObject({ state: "collected", reward: { labor: 1n, essence: 1n } });
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

function worldQuestFixture() {
  const { store } = fixture();
  const calendar = { seed: 5n, startMainAt: 100, scheduledEndAt: 10_000,
endAt: 10_000, dayUnitSeconds: 100 };
  const startsAt = dayOf(calendar, 100)!.end;
  store.applyFacts([
    { model: "HomeAspect", key: "0xd000", value: { game_id: 1, home: 7, aspect: 1 } },
    { model: "AspectActivity", key: "0xd001", value: { game_id: 1, aspect: 1, day: 0, active: 5 } },
    {
      model: "BaneRules",
      key: "0xd002",
      value: {
        game_id: 1,
        chance_step: 20,
        quorum_percent: 40,
        beast_percent: 150,
        stamina_percent: 50,
        production_percent: 50,
        quest_counts: [3, 6, 9, 12, 20, 40, 60, 80, 2500, 6000, 10_000, 15_000],
      },
    },
    { model: "WorldBane", key: "0xd003", value: { game_id: 1, day: 1, kind: nativeBaneConstants.ASH_FALL } },
  ]);
  store.setSnapshot({ gameId: 1, complete: true, actor: "0x111", timestamp: startsAt + 10 });
  const read = () => readDailyQuest(store, 1, 7, startsAt + 10);
  const finish = (level = 1, amount = [2500, 6000, 10_000, 15_000][level - 1]) =>
    store.applyFacts([
      {
        model: "QuestProgress",
        key: "0xd004",
        value: {
          game_id: 1,
          home: 7,
          day: 1,
          progress: amount,
          completed_level: level,
        },
      },
    ]);
  const win = () =>
    store.applyFacts([
      {
        model: "BaneProgress",
        key: "0xd005",
        value: {
          game_id: 1,
          aspect: 1,
          day: 1,
          completed: 2,
          ended_at: startsAt + 5,
        },
      },
    ]);
  const receipt = (model: "LaborGrant" | "BaneGrant", labor = 1000, essence = 1500) =>
    store.applyFacts([
      {
        model,
        key: "0xff10",
        value: {
          game_id: 1,
          home: 7,
          day: 1,
          account: "0x111",
          amount: BigInt(labor) * BigInt(RESOURCE_PRECISION),
          essence: BigInt(essence) * BigInt(RESOURCE_PRECISION),
        },
      },
    ]);
  return { store, read, finish, win, receipt, startsAt };
}

describe("recorded bane quest rewards", () => {
  it("keeps the world quest after quorum and advertises both grants for a late first collection", () => {
    const { read, finish, win } = worldQuestFixture();
    expect(read()?.reading.known).toMatchObject({
      quest: { id: nativeQuestConstants.CULL },
      target: 2500n,
      state: "running",
      bane: { type: "world", required: 2, completed: 0 },
      reward: { labor: 1000n * BigInt(RESOURCE_PRECISION), essence: 1500n * BigInt(RESOURCE_PRECISION) },
    });
    finish();
    win();
    expect(read()?.reading.known).toMatchObject({
      quest: { id: nativeQuestConstants.CULL },
      target: 2500n,
      state: "done",
      bane: { type: "world", required: 2, completed: 2 },
      reward: { labor: 2000n * BigInt(RESOURCE_PRECISION), essence: 3000n * BigInt(RESOURCE_PRECISION) },
    });
  });

  it("offers Collect again only after own completion and quorum, then retains both exact receipts", () => {
    const { read, finish, win, receipt } = worldQuestFixture();
    finish();
    receipt("LaborGrant");
    expect(read()?.reading.known?.state).toBe("collected");
    win();
    expect(read()?.reading.known).toMatchObject({
      state: "again",
      reward: { labor: 1000n * BigInt(RESOURCE_PRECISION), essence: 1500n * BigInt(RESOURCE_PRECISION) },
    });
    receipt("BaneGrant", 250, 500);
    expect(read()?.reading.known).toMatchObject({
      state: "collected",
      reward: { labor: 1250n * BigInt(RESOURCE_PRECISION), essence: 2000n * BigInt(RESOURCE_PRECISION) },
      receipts: { bonus: { amount: 250n * BigInt(RESOURCE_PRECISION), essence: 500n * BigInt(RESOURCE_PRECISION) } },
    });
  });

  it("uses the bane's level table and freezes the completion level when the home upgrades", () => {
    const { store, read, finish, win } = worldQuestFixture();
    finish(2);
    const realm = store.require("Structure", { game_id: 1, entity_id: 7 });
    store.applyFacts([
      { model: "Structure", key: "1:7", value: { ...realm, base: { ...realm.base, level: 3 } } },
      { model: "CampaignHome", key: "0xd006", value: { game_id: 1, home: 7, campaign_id: 9, tier: 1 } },
    ]);
    win();
    expect(read()?.reading.known).toMatchObject({
      target: 6000n,
      reward: { labor: 6000n * BigInt(RESOURCE_PRECISION), essence: 6000n * BigInt(RESOURCE_PRECISION) },
    });
  });

  it("leaves the whole quest unknown when its recorded roll or second receipt is not known", () => {
    const { store, read, finish, win, receipt } = worldQuestFixture();
    store.applyFacts([{ model: "WorldBane", key: "0xd003", value: null }]);
    expect(read()?.reading).toEqual({ unknown: "MISSING_WORLD_BANE_DAY" });
    store.applyFacts([
      { model: "WorldBane", key: "0xd003", value: { game_id: 1, day: 1, kind: nativeBaneConstants.ASH_FALL } },
    ]);
    finish();
    win();
    receipt("LaborGrant");
    store.setSnapshot({ gameId: 1, complete: true, actor: "0x222", timestamp: 100 });
    expect(read()?.reading.unknown).toContain("OUTSIDE_SNAPSHOT_SCOPE: BaneGrant");
  });

  it("uses a rival's quest and never adds a world reward to a completed team bane", () => {
    const { store, read, finish, win, receipt } = worldQuestFixture();
    store.applyFacts([
      { model: "FirstTeamBane", key: "0xd007", value: { game_id: 1, issued_day: 0 } },
      {
        model: "TeamBane",
        key: "0xd008",
        value: { game_id: 1, aspect: 1, day: 1, source: 2, issued_day: 0, quest: nativeQuestConstants.STAND },
      },
    ]);
    finish(1, 3);
    win();
    expect(read()?.reading.known).toMatchObject({
      quest: { id: nativeQuestConstants.STAND },
      bane: { type: "team", source: 2 },
      target: 3n,
      state: "done",
      reward: { labor: 1000n * BigInt(RESOURCE_PRECISION), essence: 1500n * BigInt(RESOURCE_PRECISION) },
    });
    receipt("LaborGrant");
    expect(read()?.reading.known?.state).toBe("collected");
  });
  it("keeps a cap-clipped receipt below one whole unit exact", () => {
    const { store, read, finish, win, receipt } = worldQuestFixture();
    finish();
    win();
    receipt("LaborGrant", 0, 0);
    store.applyFacts([
      {
        model: "BaneGrant",
        key: "0xff10",
        value: {
          game_id: 1,
          home: 7,
          day: 1,
          account: "0x111",
          amount: 500_000_000n,
          essence: 250_000_000n,
        },
      },
    ]);
    expect(read()?.reading.known).toMatchObject({
      state: "collected",
      reward: { labor: 500_000_000n, essence: 250_000_000n },
    });
  });
});

const calendar = { seed: 5n, startMainAt: 100, scheduledEndAt: 10_000,
endAt: 10_000, dayUnitSeconds: 100 };
const firstDay = dayOf(calendar, 100)!;
const secondDay = dayOf(calendar, firstDay.end)!;
const thirdDay = dayOf(calendar, secondDay.end)!;

function baneFixture() {
  const { store } = fixture();
  store.applyFacts([
    {
      model: "BaneRules",
      key: "1",
      value: {
        game_id: 1,
        chance_step: 20,
        quorum_percent: 25,
        beast_percent: 150,
        stamina_percent: 50,
        production_percent: 50,
        quest_counts: [3, 6, 9, 12, 20, 40, 60, 80, 2500, 6000, 10000, 15000],
      },
    },
    { model: "HomeAspect", key: "1:7", value: { game_id: 1, home: 7, aspect: 1 } },
    { model: "AspectActivity", key: "1:1:0", value: { game_id: 1, aspect: 1, day: 0, active: 5 } },
    { model: "WorldBane", key: "1:0", value: { game_id: 1, day: 0, kind: 0 } },
    { model: "WorldBane", key: "1:1", value: { game_id: 1, day: 1, kind: nativeBaneConstants.ASH_FALL } },
  ]);
  return store;
}

it("reads the recorded bane and ceiling quorum, keeping its quest after the effect ends", () => {
  const store = baneFixture();
  expect(readBaneDay(store, 1, 7, secondDay)).toEqual({
    known: {
      bane: {
        type: "world",
        kind: nativeBaneConstants.ASH_FALL,
        quest: nativeQuestConstants.CULL,
        aspect: 1,
        required: 2,
        completed: 0,
        endedAt: 0,
      },
    },
  });
  store.applyFacts([
    {
      model: "BaneProgress",
      key: "1:1:1",
      value: {
        game_id: 1,
        aspect: 1,
        day: 1,
        completed: 2,
        ended_at: secondDay.start + 60,
      },
    },
  ]);
  expect(readBaneDay(store, 1, 7, secondDay).known?.bane).toMatchObject({
    quest: nativeQuestConstants.CULL,
    required: 2,
    completed: 2,
    endedAt: secondDay.start + 60,
  });
  expect(readBaneEffects(store, 1, 7, secondDay.start - 10, secondDay.start + 120)).toEqual({
    known: {
      productionPercent: 50,
      windows: [{ kind: nativeBaneConstants.ASH_FALL, start: secondDay.start, end: secondDay.start + 60 }],
    },
  });
});

it("never turns an unknown roll or missing scope evidence into an ordinary day", () => {
  const store = baneFixture();
  store.applyFacts([{ model: "WorldBane", key: "1:1", value: null }]);
  expect(readBaneDay(store, 1, 7, secondDay)).toEqual({ unknown: "MISSING_WORLD_BANE_DAY" });
  expect(readBaneEffects(store, 1, 7, secondDay.start, secondDay.start + 1)).toEqual({
    unknown: "MISSING_WORLD_BANE_DAY",
  });
  store.setSnapshot({ gameId: 1, actor: "0x111", complete: false, timestamp: secondDay.start });
  expect(readBaneDay(store, 1, 7, secondDay).unknown).toContain("INCOMPLETE_SNAPSHOT: FirstTeamBane");
});

it("ends a zero-quorum effect at day start while retaining the bane quest", () => {
  const store = baneFixture();
  store.applyFacts([{ model: "AspectActivity", key: "1:1:0", value: null }]);
  expect(readBaneDay(store, 1, 7, secondDay).known?.bane).toMatchObject({
    quest: nativeQuestConstants.CULL,
    required: 0,
    endedAt: secondDay.start,
  });
  expect(readBaneEffects(store, 1, 7, secondDay.start, secondDay.end)).toEqual({
    known: {
      productionPercent: 50,
      windows: [],
    },
  });
});

it("keeps today's world bane when the first team bane is issued, then reads tomorrow's team quest", () => {
  const store = baneFixture();
  store.applyFacts([
    { model: "FirstTeamBane", key: "1", value: { game_id: 1, issued_day: 1 } },
    {
      model: "TeamBane",
      key: "1:1:2",
      value: {
        game_id: 1,
        aspect: 1,
        day: 2,
        source: 2,
        issued_day: 1,
        quest: nativeQuestConstants.STAND,
      },
    },
    { model: "AspectActivity", key: "1:1:1", value: { game_id: 1, aspect: 1, day: 1, active: 5 } },
  ]);
  expect(readBaneDay(store, 1, 7, secondDay).known?.bane).toMatchObject({
    type: "world",
    quest: nativeQuestConstants.CULL,
  });
  expect(readBaneDay(store, 1, 7, thirdDay).known?.bane).toEqual({
    type: "team",
    source: 2,
    quest: nativeQuestConstants.STAND,
    aspect: 1,
    required: 2,
    completed: 0,
    endedAt: 0,
  });
  expect(readBaneEffects(store, 1, 7, thirdDay.start, thirdDay.end)).toEqual({
    known: { productionPercent: 50, windows: [] },
  });
});

it("waits for optional-rule absence before showing ordinary quests or production", () => {
  const { store, read } = fixture();
  store.setSnapshot({ gameId: 1, actor: "0x111", complete: false, timestamp: 100 });
  expect(readBaneDay(store, 1, 7, firstDay)).toEqual({ unknown: "INCOMPLETE_SNAPSHOT: BaneRules" });
  expect(readBaneEffects(store, 1, 7, 100, 101)).toEqual({ unknown: "INCOMPLETE_SNAPSHOT: BaneRules" });
  expect(read()?.reading).toEqual({ unknown: "INCOMPLETE_SNAPSHOT: BaneRules" });
  store.setSnapshot({ gameId: 1, actor: "0x111", complete: true, timestamp: 100 });
  expect(readBaneDay(store, 1, 7, firstDay)).toEqual({ known: { bane: null } });
  expect(readBaneEffects(store, 1, 7, 100, 101)).toEqual({ known: { windows: [], productionPercent: 100 } });
  expect(read()?.reading.known?.quest.id).toBe(nativeQuestConstants.REVEALS);
});
