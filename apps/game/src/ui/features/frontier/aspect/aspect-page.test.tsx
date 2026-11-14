import { describe, expect, it } from "vitest";
import { raceScenario } from "@/lab/game/race-scenario";
import { rowsOf, wire } from "@/lab/game/lab-chain";
import { NativeFactStore, readRaceBoard, readRaceMonument } from "@bibliothecadao/eternum/game-client";
import { configManager, getHyperstructureProgress, getStructureName } from "@bibliothecadao/eternum";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";
import { aspectPage } from "./aspect-page";

function fixture(finished = false) {
  const scenario = raceScenario(finished);
  const { store, player, startsAt } = scenario;
  store.setSnapshot({ gameId: 1, actor: player, timestamp: startsAt, complete: true });
  configManager.setActiveGame(1, 7);
  return { ...scenario, read: () => readRaceBoard(store, 1, 7n, startsAt) };
}

const precision = BigInt(RESOURCE_PRECISION);

describe("the race board from native facts", () => {
  it("ranks all Aspects, preserves raw weighted Glory and shows the current guard sites", () => {
    const { read, store } = fixture();
    const board = read().known!.race!;
    expect(board.standings.map(({ aspect, rank, height, stage }) => ({ aspect, rank, height, stage }))).toEqual([
      { aspect: 2, rank: 1, height: 6400, stage: 4 },
      { aspect: 1, rank: 2, height: 5200, stage: 3 },
      { aspect: 3, rank: 3, height: 2800, stage: 2 },
      { aspect: 4, rank: 4, height: 900, stage: 1 },
    ]);
    expect(board.own!.members.map(({ home, glory, contribution, mine, guards }) => ({ home: home.entity_id, glory, contribution, mine, guards }))).toEqual([
      { home: 9n, glory: 3750n * precision, contribution: 3900n * precision, mine: false, guards: ["Quarry"] },
      { home: 7n, glory: 1250n * precision, contribution: 1300n * precision, mine: true, guards: [] },
    ]);
    const page = aspectPage(board, (home) => getStructureName(home, store).name);
    expect(page.race?.standings.map((row) => [row.aspect, row.own])).toEqual([["Harmony", false], ["Might", true], ["Chaos", false], ["Guile", false]]);
    expect(page.own?.triumphs).toEqual([{ stage: 1, day: 2 }, { stage: 2, day: 2 }, { stage: 3, day: null }, { stage: 4, day: null }]);
    expect(page.own?.members.map(({ glory }) => glory)).toEqual([3750, 1250]);
    expect(page.own?.bar).toEqual({ charge: 300, threshold: 1500 });
  });

  it("recovers the exact board and the monument's height after a complete snapshot reload", () => {
    const { store, read, startsAt, player } = fixture();
    const restored = new NativeFactStore();
    restored.applyFacts(rowsOf(store).map((fact) => ({ ...fact, value: wire(fact.value) })));
    restored.setSnapshot({ gameId: 1, actor: player, timestamp: startsAt, complete: true });
    expect(readRaceBoard(restored, 1, 7n, startsAt)).toEqual(read());
    expect(readRaceMonument(restored, 1, 901)?.aspect).toBe(1);
    expect(getHyperstructureProgress(901, restored)).toEqual({ percentage: 52, initialized: true, completed: false });
    expect(getStructureName(restored.require("Structure", { game_id: 1, entity_id: 901 }), restored).name).toBe("Might Hyperstructure");
  });

  it("reads the winner and both dates after early finish without future guard projections", () => {
    const { read, store } = fixture(true);
    const board = read().known!.race!;
    const game = store.require("GameRegistry", { game_id: 1 });
    expect(board.result).toEqual({ game_id: 1, winner: 2, ended_at: game.end_at, scheduled_end_at: game.scheduled_end_at });
    expect(game.end_at).toBeLessThan(game.scheduled_end_at);
    expect(board.own!.members.every((member) => member.guards.length === 0)).toBe(true);
    expect(aspectPage(board, () => "Realm").race?.winner).toBe("Harmony");
    expect(getHyperstructureProgress(902, store)).toEqual({ percentage: 100, initialized: true, completed: true });
  });

  it("accepts a known zero receipt only for an existing member and keeps incomplete snapshots unknown", () => {
    const { store, read, player, startsAt } = fixture();
    store.applyFacts([{ model: "RaceMember", key: store.wireKeyOf("RaceMember", { game_id: 1, entity_id: 7 })!, value: null }]);
    expect(read().known!.race!.own!.members.find((member) => member.home.entity_id === 7n)?.glory).toBe(0n);
    store.setSnapshot({ gameId: 1, actor: player, timestamp: startsAt, complete: false });
    expect(read().unknown).toBe("INCOMPLETE_SNAPSHOT: RaceRules");
    store.setSnapshot({ gameId: 1, actor: player, timestamp: startsAt, complete: true });
    store.applyFacts([{ model: "Structure", key: store.wireKeyOf("Structure", { game_id: 1, entity_id: 9 })!, value: null }]);
    expect(read().unknown).toBe("MISSING_ASPECT_MEMBER_HOME");
  });
});
