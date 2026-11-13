import { describe, expect, it } from "vitest";
import { RESOURCE_PRECISION, StructureType } from "@bibliothecadao/types";
import { NativeFactStore } from "../native-fact-store";
import { dayOf, readExpeditionRules } from "../../utils/expeditions";
import { readHomeGlory, readTodaysTriumph } from "./race";
import preset from "../../../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";

const GAME_ID = 1;
const HOME = 7;
const PLAYER = "0x123";
const HARMONY = 2;

/** A race game on hour-long day units from 3,600, with the player's home 7 in Harmony. */
const raceGame = () => {
  const store = new NativeFactStore();
  store.applyFacts([
    { model: "SliceRules", key: "0x100", value: { ...preset.rules, game_id: GAME_ID, day_unit_seconds: 3600 } },
    {
      model: "SettlementRules",
      key: "0x101",
      value: { game_id: GAME_ID, registration_start: 1, registration_limit: 2, spacing: 100, mode: "Single" },
    },
    {
      model: "GameRegistry",
      key: "0x102",
      value: {
        game_id: GAME_ID,
        name: 1,
        preset_id: 7,
        settled: false,
        ready: true,
        dev_mode_on: false,
        start_settling_at: 0,
        start_main_at: 3600,
        end_at: 3600 + 50 * 86_400,
        end_grace_seconds: 0,
        seed: 42,
      },
    },
    {
      model: "RaceRules",
      key: "0x103",
      value: {
        game_id: GAME_ID,
        season_days: 50n,
        glory_per_tick: 5n * BigInt(RESOURCE_PRECISION),
        height_per_tick: 5,
        stage_height: 2000,
        clear_mist_percent: 200,
        second_wind_percent: 200,
        pale_moon_percent: 50,
        spoils_percent: 200,
        first: { alt: false, x: 1, y: 1 },
        second: { alt: false, x: 2, y: 2 },
        third: { alt: false, x: 3, y: 3 },
        fourth: { alt: false, x: 4, y: 4 },
      },
    },
    {
      model: "Structure",
      key: `0x${HOME.toString(16)}`,
      value: {
        game_id: GAME_ID,
        entity_id: HOME,
        owner: BigInt(PLAYER),
        base: {
          category: StructureType.Realm,
          level: 0,
          created_at: 1,
          troop_max_guard_count: 1,
          troop_max_explorer_count: 1,
          starting_troops_granted: false,
        },
        metadata: { realm_id: 1, village_realm: 0, has_wonder: false, order: 0, mine_kind: 0, deepest_depth: 0 },
        resources_packed: 0n,
      },
    },
    { model: "HomeAspect", key: "0x104", value: { game_id: GAME_ID, home: HOME, aspect: HARMONY } },
  ]);
  return store;
};

const settled = (store: NativeFactStore, timestamp: number) =>
  store.setSnapshot({ gameId: GAME_ID, complete: true, actor: PLAYER, timestamp });

/** A second inside the season's day `index`. */
const during = (store: NativeFactStore, index: number) => {
  const rules = readExpeditionRules(store, GAME_ID)!;
  let at = rules.startMainAt;
  while (dayOf(rules, at)!.index < index) at = dayOf(rules, at)!.end;
  return at + 1;
};

const triumphDay = (stage: number, day: number) => ({
  model: "TriumphDay",
  key: `0x11${stage}`,
  value: { game_id: GAME_ID, aspect: HARMONY, stage, day: BigInt(day) },
});

describe("readHomeGlory", () => {
  it("reads the home's Glory in points from its race row", () => {
    const store = raceGame();
    settled(store, 4000);
    store.applyFacts([
      {
        model: "RaceMember",
        key: "0x105",
        value: {
          game_id: GAME_ID,
          entity_id: HOME,
          glory: (125n * BigInt(RESOURCE_PRECISION)) / 10n,
          contribution: 0n,
        },
      },
    ]);
    expect(readHomeGlory(store, GAME_ID, HOME)).toEqual({ known: 12.5 });
  });

  it("knows a home that never held a site has no Glory, once the snapshot says its row is absent", () => {
    const store = raceGame();
    expect(readHomeGlory(store, GAME_ID, HOME)?.unknown).toBe("INCOMPLETE_SNAPSHOT: RaceMember");
    settled(store, 4000);
    expect(readHomeGlory(store, GAME_ID, HOME)).toEqual({ known: 0 });
  });

  it("reads nothing in a game without the race", () => {
    const store = new NativeFactStore();
    expect(readHomeGlory(store, GAME_ID, HOME)).toBeUndefined();
  });
});

describe("readTodaysTriumph", () => {
  it("names the Triumph whose day is today, with RaceRules' percentage", () => {
    const store = raceGame();
    settled(store, 4000);
    store.applyFacts([triumphDay(1, 2), triumphDay(2, 4)]);
    expect(readTodaysTriumph(store, GAME_ID, HOME, during(store, 4))).toEqual({ known: { stage: 2, percent: 200 } });
    expect(readTodaysTriumph(store, GAME_ID, HOME, during(store, 2))).toEqual({ known: { stage: 1, percent: 200 } });
  });

  it("knows there is none on a day no earned stage names, once the stages it lacks are known absent", () => {
    const store = raceGame();
    store.applyFacts([triumphDay(3, 4)]);
    expect(readTodaysTriumph(store, GAME_ID, HOME, during(store, 5))?.unknown).toBe("INCOMPLETE_SNAPSHOT: TriumphDay");
    settled(store, 4000);
    expect(readTodaysTriumph(store, GAME_ID, HOME, during(store, 5))).toEqual({ known: null });
    expect(readTodaysTriumph(store, GAME_ID, HOME, during(store, 4))).toEqual({ known: { stage: 3, percent: 50 } });
  });

  it("does not guess while the home's Aspect is not known", () => {
    const store = raceGame();
    store.applyFacts([{ model: "HomeAspect", key: "0x104", value: null }]);
    settled(store, 4000);
    expect(readTodaysTriumph(store, GAME_ID, HOME, during(store, 1))?.unknown).toBe("HomeAspect 7 is not known");
  });

  it("reads nothing before the season's first day or in a game without the race", () => {
    const store = raceGame();
    expect(readTodaysTriumph(store, GAME_ID, HOME, 100)).toBeUndefined();
    expect(readTodaysTriumph(new NativeFactStore(), GAME_ID, HOME, 4000)).toBeUndefined();
  });
});
