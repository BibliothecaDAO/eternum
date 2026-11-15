import { DAYS_PER_BAG, seasonSeconds } from "@bibliothecadao/eternum";
import { deepCenter, nativeRuleConstants, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { aspects, RESOURCE_PRECISION, StructureType, TileOccupier } from "@bibliothecadao/types";
import { deepScenario } from "./deep-scenario";
import { wire, type LabScenario } from "./lab-chain";
import type { GameSyncFact } from "@bibliothecadao/eternum/game-sync";

/** Confirmed race facts on the shared Deep; the production Season surface reads the same snapshot after reconnect. */
export function raceScenario(finished = false): LabScenario {
  const scenario = deepScenario();
  const { store, startsAt } = scenario;
  const game = store.require("GameRegistry", { game_id: 1 });
  const homes = [...store.inGame("HomeAspect", 1)].filter((row) => row.aspect === 1);
  const firstHome = store.require("Structure", { game_id: 1, entity_id: homes[0]!.home });
  const center = deepCenter(store.require("SettlementRules", { game_id: 1 }).spacing);
  const half = nativeRuleConstants.DEEP_MAP_SIZE / 2;
  const rules = raceRules();
  const points = [rules.first, rules.second, rules.third, rules.fourth];
  const heights = [5200, finished ? 10_000 : 6400, 2800, 900];
  const facts: GameSyncFact[] = [
    { model: "RaceRules", key: "0xa500", value: wire(rules) },
    {
      model: "AspectMembers",
      key: store.wireKeyOf("AspectMembers", { game_id: 1, aspect: 1 }) ?? "0xa501",
      value: { game_id: 1, aspect: 1, members: homes.length },
    },
    // A daily quest on the day banner, which carries the Aspect's bane bar.
    {
      model: "QuestRules",
      key: "0xa505",
      value: { game_id: 1, base_counts: [1, 1, 1, 1, 1, 2, 15], labor: 1000, essence: 1500, bonus_percent: 150 },
    },
    { model: "AltarBar", key: "0xa502", value: { game_id: 1, aspect: 1, charge: 300 } },
    { model: "TriumphDay", key: "0xa503", value: { game_id: 1, aspect: 1, stage: 1, day: 1 } },
    { model: "TriumphDay", key: "0xa504", value: { game_id: 1, aspect: 1, stage: 2, day: 1 } },
  ];
  aspects.forEach((aspect, index) => {
    const entity_id = BigInt(900 + aspect.id);
    const position = points[index]!;
    facts.push(
      {
        model: "AspectHyperstructure",
        key: `0xa51${aspect.id}`,
        value: wire({ game_id: 1, aspect: aspect.id, entity_id, height: heights[index]! }),
      },
      {
        model: "Structure",
        key: `0xa52${aspect.id}`,
        value: wire({
          ...firstHome,
          entity_id,
          owner: 0n,
          resources_packed: 0n,
          base: { ...firstHome.base, category: StructureType.Hyperstructure, level: 0, troop_max_guard_count: 0 },
          metadata: { ...firstHome.metadata, realm_id: 0, order: 0, has_wonder: false },
        }),
      },
      {
        model: "TileOccupancy",
        key: `0xa53${aspect.id}`,
        value: wire({
          game_id: 1,
          entity_id,
          alt: false,
          col: center.col + position.x - half,
          row: center.row + position.y - half,
          category: TileOccupier.Hyperstructure,
          is_structure: true,
        }),
      },
    );
  });
  homes.forEach((home, index) =>
    facts.push({
      model: "RaceMember",
      key: `0xa54${index}`,
      value: wire({
        game_id: 1,
        entity_id: home.home,
        glory: BigInt(index === 0 ? 1250 : 3750) * BigInt(RESOURCE_PRECISION),
        contribution: BigInt(index === 0 ? 1300 : 3900) * BigInt(RESOURCE_PRECISION),
      }),
    }),
  );
  let now = startsAt;
  if (finished) {
    const tick = store.require("SliceRules", { game_id: 1 }).tick_config.armies_tick_in_seconds;
    const ended_at = (BigInt(startsAt) / tick + 1n) * tick;
    now = Number(ended_at) + 1;
    facts.push(
      {
        model: "GameRegistry",
        key: store.wireKeyOf("GameRegistry", { game_id: 1 })!,
        value: wire({ ...game, end_at: ended_at }),
      },
      {
        model: "RaceResult",
        key: "0xa550",
        value: wire({ game_id: 1, winner: 2, ended_at, scheduled_end_at: game.scheduled_end_at }),
      },
    );
  }
  store.applyFacts(facts);
  return {
    ...scenario,
    startsAt: now,
    opensOn: { col: center.col + rules.first.x - half, row: center.row + rules.first.y - half },
    scoped: true,
  };
}

export function raceRules(): NativeRows["RaceRules"] {
  return {
    game_id: 1,
    season_days: 50n,
    glory_per_tick: 5n,
    height_per_tick: 5,
    stage_height: 2000,
    clear_mist_percent: 200,
    second_wind_percent: 200,
    pale_moon_percent: 50,
    spoils_percent: 200,
    first: { alt: false, x: 5, y: 5 },
    second: { alt: false, x: 45, y: 5 },
    third: { alt: false, x: 5, y: 45 },
    fourth: { alt: false, x: 45, y: 45 },
  };
}

/** The fiftieth day ends with all four monuments unfinished; the recorded result has no winner. */
export function expiredRaceScenario(): LabScenario {
  const scenario = raceScenario();
  const { store } = scenario;
  const game = store.require("GameRegistry", { game_id: 1 });
  const rules = store.require("RaceRules", { game_id: 1 });
  const unit = store.require("SliceRules", { game_id: 1 }).day_unit_seconds;
  const end = game.start_main_at + BigInt(seasonSeconds(Number(rules.season_days) / DAYS_PER_BAG, unit));
  store.applyFacts([
    {
      model: "GameRegistry",
      key: store.wireKeyOf("GameRegistry", { game_id: 1 })!,
      value: wire({ ...game, scheduled_end_at: end, end_at: end, settled: true }),
    },
    {
      model: "RaceResult",
      key: "0xa550",
      value: wire({ game_id: 1, winner: null, ended_at: end, scheduled_end_at: end }),
    },
  ] as never);
  return { ...scenario, startsAt: Number(end) + 1 };
}
