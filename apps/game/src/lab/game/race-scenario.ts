import { DAYS_PER_BAG, seasonSeconds } from "@bibliothecadao/eternum";
import { deepCenter, nativeRuleConstants, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { aspects, RESOURCE_PRECISION } from "@bibliothecadao/types";
import { deepScenario } from "./deep-scenario";
import { LAB_LINKED_WALLET, wire, type LabScenario } from "./lab-chain";
import { labQuestRulesFact } from "./quest-scenario";
import type { GameSyncFact } from "@bibliothecadao/eternum/game-sync";

/** Confirmed race facts on the shared Deep; the production Season surface reads the same snapshot after reconnect. */
export function raceScenario(finished = false): LabScenario {
  const scenario = deepScenario();
  const { store, startsAt } = scenario;
  const game = store.require("GameRegistry", { game_id: 1 });
  const homes = [...store.inGame("HomeAspect", 1)].filter((row) => row.aspect === 1);
  const center = deepCenter(store.require("SettlementRules", { game_id: 1 }).spacing);
  const half = nativeRuleConstants.DEEP_MAP_SIZE / 2;
  const rules = raceRules();
  const heights = [5200, finished ? 10_000 : 6400, 2800, 900];
  const facts: GameSyncFact[] = [
    { model: "RaceRules", key: "0xa500", value: wire(rules) },
    {
      model: "AspectMembers",
      key: store.wireKeyOf("AspectMembers", { game_id: 1, aspect: 1 }) ?? "0xa501",
      value: { game_id: 1, aspect: 1, members: homes.length },
    },
    // A daily quest on the day banner, which carries the Aspect's bane bar.
    labQuestRulesFact("0xa505"),
    { model: "AltarBar", key: "0xa502", value: { game_id: 1, aspect: 1, charge: 300 } },
    { model: "TriumphDay", key: "0xa503", value: { game_id: 1, aspect: 1, stage: 1, day: 1 } },
    { model: "TriumphDay", key: "0xa504", value: { game_id: 1, aspect: 1, stage: 2, day: 1 } },
  ];
  aspects.forEach((aspect, index) => {
    facts.push({
      model: "AspectHyperstructure",
      key: `0xa51${aspect.id}`,
      value: wire({ game_id: 1, aspect: aspect.id, height: heights[index]! }),
    });
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
  // A rival Aspect's home, which the Aspect's fights name.
  facts.push({ model: "HomeAspect", key: "0xa560", value: { game_id: 1, home: String(RIVAL_HOME), aspect: 2 } });
  store.applyFacts(facts);
  return {
    ...scenario,
    startsAt: now,
    opensOn: { col: center.col, row: center.row },
    scoped: true,
    wallet: LAB_LINKED_WALLET,
    history: battleHistory(now, center, half),
  };
}

export function raceRules(): NativeRows["RaceRules"] {
  return {
    game_id: 1,
    season_days: 50n,
    stage_height: 2000,
    clear_mist_percent: 200,
    second_wind_percent: 200,
    pale_moon_percent: 50,
    spoils_percent: 200,
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

const RIVAL_HOME = 11n;
const SITE = 800n;

/**
 * The Aspect's fights as Herald holds them, in the shapes the contract emits (BattleEvent): owners are homes, a site's
 * beast is owner 0, and winner_id is what each emitter writes (the winning home, or the site on a lost guard attack).
 * Newest first: 120 fights on the surface, then the Deep's: a win that wipes its rival, a lost guard attack, a standoff,
 * a mutual wipe-out, and an attack on the day's beast.
 */
function battleHistory(now: number, center: { col: number; row: number }, half: number) {
  const players: Record<string, string> = { "7": "0x111", "9": "0x222", "11": "0x333", "0": "0x0" };
  const deep = { x: center.col - half + 40, y: center.row - half + 25, alt: false };
  const surface = { x: 12, y: 12, alt: false };
  const side = (home: string, before: number, after: number) => ({
    player: players[home],
    category: "Knight",
    tier: "T1",
    before: `0x${(BigInt(before) * BigInt(RESOURCE_PRECISION)).toString(16)}`,
    after: `0x${(BigInt(after) * BigInt(RESOURCE_PRECISION)).toString(16)}`,
    roll: 0,
  });
  let at = now;
  const fight = (
    coord: typeof deep,
    attacker: [string, number, number],
    defender: [string, number, number],
    winner: bigint,
  ) => ({
    block_number: 1_000 + (now - at),
    transaction_index: 0,
    event_index: 0,
    game_id: "1",
    model: "BattleEvent",
    transaction_hash: `0x${(0xb00 + (now - (at -= 1))).toString(16)}`,
    value: {
      version: 2,
      game_id: "0x1",
      attacker_id: "0xa",
      defender_id: "0xb",
      attacker_owner: attacker[0],
      defender_owner: defender[0],
      winner_id: `0x${winner.toString(16)}`,
      coord,
      attacker: side(...attacker),
      defender: side(...defender),
      timestamp: `0x${at.toString(16)}`,
    },
  });
  return [
    ...Array.from({ length: 120 }, () => fight(surface, ["7", 100, 90], ["0", 300, 250], 7n)),
    fight(deep, ["7", 100, 80], ["11", 60, 0], 7n),
    fight(deep, ["9", 100, 0], ["11", 60, 20], SITE),
    fight(deep, ["7", 100, 70], ["11", 60, 30], 0n),
    fight(deep, ["9", 50, 0], ["11", 50, 0], 0n),
    fight(deep, ["7", 100, 90], ["0", 10_000, 9_000], 7n),
  ];
}
