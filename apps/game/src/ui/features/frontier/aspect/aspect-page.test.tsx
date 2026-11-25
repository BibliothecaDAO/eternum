import { describe, expect, it } from "vitest";
import { expiredRaceScenario, raceScenario } from "@/lab/game/race-scenario";
import { rowsOf, wire } from "@/lab/game/lab-chain";
import { NativeFactStore, raceFinishHeight, readRaceBoard } from "@bibliothecadao/eternum/game-client";
import { configManager, getStructureName } from "@bibliothecadao/eternum";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";
import { raceStageOf } from "@/shell/season";
import { seasonBoard } from "./aspect-page";

function fixture(finished = false) {
  const scenario = raceScenario(finished);
  const { store, player, startsAt } = scenario;
  store.setSnapshot({ gameId: 1, actor: player, timestamp: startsAt, complete: true });
  configManager.setActiveGame(1);
  return { ...scenario, read: () => readRaceBoard(store, 1, 7n) };
}

const precision = BigInt(RESOURCE_PRECISION);

describe("the race board from native facts", () => {
  it("ranks all Aspects and preserves raw weighted Glory", () => {
    const { read, store } = fixture();
    const board = read().known!.race!;
    expect(board.standings.map(({ aspect, rank, height, stage }) => ({ aspect, rank, height, stage }))).toEqual([
      { aspect: 2, rank: 1, height: 6400, stage: 4 },
      { aspect: 1, rank: 2, height: 5200, stage: 3 },
      { aspect: 3, rank: 3, height: 2800, stage: 2 },
      { aspect: 4, rank: 4, height: 900, stage: 1 },
    ]);
    const finishHeight = raceFinishHeight(board.rules.stage_height);
    for (const row of board.standings) {
      expect(raceStageOf(row.height, finishHeight)).toBe(row.stage);
    }
    expect(
      board.own!.members.map(({ home, glory, contribution, mine }) => ({
        home,
        glory,
        contribution,
        mine,
      })),
    ).toEqual([
      { home: 9n, glory: 3750n * precision, contribution: 3900n * precision, mine: false },
      { home: 7n, glory: 1250n * precision, contribution: 1300n * precision, mine: true },
    ]);
    const home = store.require("Structure", { game_id: 1, entity_id: 7 });
    const named = (entity: bigint) => {
      const realm = entity === 14n ? undefined : store.get("Structure", { game_id: 1, entity_id: entity });
      return realm ? { owner: `0x${realm.owner.toString(16)}`, realm_id: Number(realm.metadata.realm_id) } : null;
    };
    const page = seasonBoard(board, home, (realm) => getStructureName(realm, store).name, true, named);
    expect(page.race.map((row) => [row.aspectId, row.own, row.pool])).toEqual([
      [2, false, 64_000],
      [1, true, 52_000],
      [3, false, 28_000],
      [4, false, 9_000],
    ]);
    expect(page.players).toBe(7);
    expect(
      page.rosters.map(({ aspect, roster }) => [aspect, roster.members.map(({ entity_id }) => entity_id)]),
    ).toEqual([
      [1, ["9", "7"]],
      [2, ["11", "12"]],
      [3, ["13"]],
      [4, ["15"]],
    ]);
    expect(page.own).toMatchObject({ aspect: 1, member: { rank: 2, entity_id: "7", glory: String(1250n * precision) }, place: 4, aspectPlace: 2 });
    expect(page.standing).toMatchObject({
      aspectId: 1,
      aspectRank: 2,
      glory: 1250,
      gloryRank: 4,
      shares: true,
      pool: 52_000,
      share: 13_000,
      stage: 3,
      altar: { charge: 300, threshold: 1500 },
    });
    expect(page.standing?.triumphs).toEqual([
      { stage: 1, day: 2 },
      { stage: 2, day: 2 },
      { stage: 3, day: null },
      { stage: 4, day: null },
    ]);
  });

  it("recovers the exact board and each Aspect's height after a complete snapshot reload", () => {
    const { store, read, startsAt, player } = fixture();
    const restored = new NativeFactStore();
    restored.applyFacts(rowsOf(store).map((fact) => ({ ...fact, value: wire(fact.value) })));
    restored.setSnapshot({ gameId: 1, actor: player, timestamp: startsAt, complete: true });
    expect(readRaceBoard(restored, 1, 7n)).toEqual(read());
  });

  it("reads the winner and both dates after early finish", () => {
    const { read, store } = fixture(true);
    const board = read().known!.race!;
    const game = store.require("GameRegistry", { game_id: 1 });
    expect(board.result).toEqual({
      game_id: 1,
      winner: 2,
      ended_at: game.end_at,
      scheduled_end_at: game.scheduled_end_at,
    });
    expect(game.end_at).toBeLessThan(game.scheduled_end_at);
    expect(seasonBoard(board, null, () => "Realm", false, () => null).result?.winner).toBe("Luminary");
  });

  it("accepts a known zero receipt, keeps incomplete snapshots unknown, and needs no member realm in the client scope", () => {
    const { store, read, player, startsAt } = fixture();
    store.applyFacts([
      { model: "RaceMember", key: store.wireKeyOf("RaceMember", { game_id: 1, entity_id: 7 })!, value: null },
    ]);
    expect(read().known!.race!.own!.members.find((member) => member.home === 7n)?.glory).toBe(0n);
    store.setSnapshot({ gameId: 1, actor: player, timestamp: startsAt, complete: false });
    expect(read().unknown).toBe("INCOMPLETE_SNAPSHOT: RaceRules");
    store.setSnapshot({ gameId: 1, actor: player, timestamp: startsAt, complete: true });
    store.applyFacts([
      { model: "Structure", key: store.wireKeyOf("Structure", { game_id: 1, entity_id: 9 })!, value: null },
    ]);
    expect(read().known!.race!.own!.members.map(({ home }) => home)).toEqual([9n, 7n]);
  });
});

it("reads an expired race from its final snapshot without inventing a finisher", () => {
  const scenario = expiredRaceScenario();
  scenario.store.setSnapshot({ gameId: 1, actor: scenario.player, timestamp: scenario.startsAt, complete: true });
  const reading = readRaceBoard(scenario.store, 1, 7n);
  const board = reading.known!.race!;
  expect(board.result?.winner).toBeNull();
  expect(board.result?.ended_at).toBe(board.result?.scheduled_end_at);
  expect(board.standings.map((row) => row.height)).toEqual([6400, 5200, 2800, 900]);
  expect(seasonBoard(board, null, () => "Realm", false, () => null).result).toEqual({ winner: null });
});
