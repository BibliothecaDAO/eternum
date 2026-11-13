import { describe, expect, it } from "vitest";
import { NativeFactStore } from "../client/native-fact-store";
import { readAspectRace } from "./aspect-race";
import preset from "../../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";

const raceRules = {
  model: "RaceRules",
  key: "0x1",
  value: {
    game_id: 1,
    season_days: 50n,
    glory_per_tick: 5n,
    height_per_tick: 5,
    stage_height: 2_000,
    clear_mist_percent: 200,
    second_wind_percent: 200,
    pale_moon_percent: 50,
    spoils_percent: 200,
    first: { alt: false, x: 10, y: 10 },
    second: { alt: false, x: 40, y: 10 },
    third: { alt: false, x: 10, y: 40 },
    fourth: { alt: false, x: 40, y: 40 },
  },
};
const height = (aspect: number, value: number) => ({
  model: "AspectHyperstructure",
  key: `0x1${aspect}`,
  value: { game_id: 1, aspect, entity_id: BigInt(900 + aspect), height: value },
});
/** The game's rules, calendar and spacing, which the snapshot's scope is read from in a day game. */
const calendar = [
  { model: "SliceRules", key: "0x2", value: { ...preset.rules, game_id: 1, day_unit_seconds: 3600 } },
  {
    model: "GameRegistry",
    key: "0x3",
    value: {
      game_id: 1,
      name: 0n,
      preset_id: 7,
      settled: false,
      ready: true,
      dev_mode_on: false,
      start_settling_at: 0n,
      start_main_at: 100n,
      end_at: 1_000_000n,
      end_grace_seconds: 0,
      seed: 1n,
    },
  },
  {
    model: "SettlementRules",
    key: "0x4",
    value: { game_id: 1, spacing: 10, registration_start: 0, registration_limit: 0, mode: "Single" },
  },
];

const storeWith = (facts: readonly object[], complete = true) => {
  const store = new NativeFactStore();
  store.setSnapshot({ gameId: 1, complete, actor: "0x111", timestamp: 350 });
  store.applyFacts([...calendar, ...facts] as never);
  return store;
};

describe("the race of the four hyperstructures", () => {
  it("ranks them by height, a tie to the lower Aspect, with each one's stage of five", () => {
    const race = readAspectRace(
      storeWith([raceRules, height(1, 4_100), height(2, 6_000), height(3, 4_100), height(4, 0)]),
      1,
    );
    expect(race).toEqual({
      stageHeight: 2_000,
      finishHeight: 10_000,
      winner: null,
      standings: [
        { aspect: 2, rank: 1, height: 6_000, stage: 3, finished: false },
        { aspect: 1, rank: 2, height: 4_100, stage: 2, finished: false },
        { aspect: 3, rank: 3, height: 4_100, stage: 2, finished: false },
        { aspect: 4, rank: 4, height: 0, stage: 0, finished: false },
      ],
    });
  });

  it("puts the finished hyperstructure first and names its Aspect the winner", () => {
    const result = {
      model: "RaceResult",
      key: "0x5",
      value: { game_id: 1, winner: 3, ended_at: 900n, scheduled_end_at: 999n },
    };
    const race = readAspectRace(
      storeWith([raceRules, height(1, 9_995), height(2, 6_000), height(3, 10_000), height(4, 0), result]),
      1,
    );
    expect(race?.winner).toBe(3);
    expect(race?.standings.map(({ aspect, stage, finished }) => ({ aspect, stage, finished }))).toEqual([
      { aspect: 3, stage: 5, finished: true },
      { aspect: 1, stage: 4, finished: false },
      { aspect: 2, stage: 3, finished: false },
      { aspect: 4, stage: 0, finished: false },
    ]);
  });

  it("is no race in a game without RaceRules, and unknown while the snapshot or a hyperstructure is on its way", () => {
    expect(readAspectRace(storeWith([]), 1)).toBeNull();
    expect(readAspectRace(storeWith([], false), 1)).toBeUndefined();
    expect(readAspectRace(storeWith([raceRules, height(1, 0)], false), 1)).toBeUndefined();
    expect(() => readAspectRace(storeWith([raceRules, height(1, 0)]), 1)).toThrow("every Aspect's hyperstructure");
  });
});
