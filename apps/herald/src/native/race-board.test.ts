import { RESOURCE_PRECISION } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import { createHeraldRequestHandler } from "../http";
import type { FoldRow } from "../types";
import { manifest, shardManifest } from "./fixtures";
import { buildRaceBoard } from "./race-board";

// The race's rows as the race lane publishes them (feat/s1-race 1401b8d3cd4: RaceRules, RaceMember, AspectHyperstructure,
// TriumphDay, RaceResult) beside the day lane's HomeAspect and the Structures that own the homes.
const GAME = 9;
const glory = (whole: number) => BigInt(Math.round(whole * RESOURCE_PRECISION));
let rowCount = 0;
const row = (value: Record<string, unknown>): FoldRow => ({
  key: `0x${(++rowCount).toString(16)}`,
  value: { game_id: GAME, ...value },
});

function raceRows(extra: Record<string, FoldRow[]> = {}): (model: string) => FoldRow[] {
  const rows: Record<string, FoldRow[]> = {
    RaceRules: [row({ season_days: 50n, glory_per_tick: glory(5), height_per_tick: 5, stage_height: 2000 })],
    AspectHyperstructure: [
      row({ aspect: 1, entity_id: 901n, height: 4_200 }),
      row({ aspect: 2, entity_id: 902n, height: 6_100 }),
      row({ aspect: 3, entity_id: 903n, height: 4_200 }),
      row({ aspect: 4, entity_id: 904n, height: 0 }),
    ],
    TriumphDay: [
      row({ aspect: 2, stage: 1, day: 4n }),
      row({ aspect: 2, stage: 2, day: 9n }),
      row({ aspect: 2, stage: 3, day: 15n }),
      row({ aspect: 1, stage: 1, day: 6n }),
      row({ aspect: 1, stage: 2, day: 13n }),
    ],
    HomeAspect: [row({ home: 11n, aspect: 2 }), row({ home: 12n, aspect: 2 }), row({ home: 13n, aspect: 1 })],
    RaceMember: [
      row({ entity_id: 11n, glory: glory(120.5), contribution: 0n }),
      row({ entity_id: 12n, glory: glory(310), contribution: 0n }),
    ],
    Structure: [
      row({ entity_id: 11n, owner: "0xa" }),
      row({ entity_id: 12n, owner: "0xb" }),
      row({ entity_id: 13n, owner: "0xc" }),
    ],
    ...extra,
  };
  return (model) => rows[model] ?? [];
}

describe("the race board (H2)", () => {
  it("ranks the four hyperstructures by height, ties by Aspect, with each stage, Triumph day and member's Glory", () => {
    const board = buildRaceBoard(raceRows(), String(GAME));
    expect(board).toEqual({
      game_id: "9",
      mode: "race",
      stage_height: 2000,
      winner: null,
      aspects: [
        {
          aspect: 2,
          rank: 1,
          height: 6_100,
          stage: 3,
          triumph_days: [4, 9, 15, null],
          members: [
            { address: "0xb", structure_id: "12", glory: 310 },
            { address: "0xa", structure_id: "11", glory: 120.5 },
          ],
        },
        // Might and Chaos stand level at 4,200: the lower Aspect first, as the contract's Altar targeting orders them.
        {
          aspect: 1,
          rank: 2,
          height: 4_200,
          stage: 2,
          triumph_days: [6, 13, null, null],
          // A member who has held no site has no RaceMember row: no Glory yet.
          members: [{ address: "0xc", structure_id: "13", glory: 0 }],
        },
        { aspect: 3, rank: 3, height: 4_200, stage: 2, triumph_days: [null, null, null, null], members: [] },
        { aspect: 4, rank: 4, height: 0, stage: 0, triumph_days: [null, null, null, null], members: [] },
      ],
      sites: [],
    });
  });

  it("names each Deep site's holder and its guards by slot, troops as last settled with the tick they were settled at", () => {
    const board = buildRaceBoard(
      raceRows({
        DeepSite: [
          row({ entity_id: 3002n, kind: 2, day: 4n }),
          row({ entity_id: 3000n, kind: 0, day: 4n }),
          row({ entity_id: 3001n, kind: 1, day: 4n }),
        ],
        // Harmony's two homes guard the Foundation, slot 2 before slot 0 in the store's order; the Quarry's beast holds.
        DeepGuard: [
          row({ explorer_id: 52n, site_id: 3000n, slot: 2 }),
          row({ explorer_id: 51n, site_id: 3000n, slot: 0 }),
          row({ explorer_id: 53n, site_id: 3002n, slot: 0 }),
        ],
        ExplorerTroops: [
          row({ explorer_id: 51n, owner: 11n, troops: { count: BigInt(8_000 * RESOURCE_PRECISION) } }),
          row({ explorer_id: 52n, owner: 12n, troops: { count: BigInt(5_500 * RESOURCE_PRECISION) } }),
          row({ explorer_id: 53n, owner: 13n, troops: { count: BigInt(15_000 * RESOURCE_PRECISION) } }),
        ],
        DeepArmy: [
          row({ explorer_id: 51n, last_tick: 900n }),
          row({ explorer_id: 52n, last_tick: 905n }),
          row({ explorer_id: 53n, last_tick: 901n }),
        ],
      }),
      String(GAME),
    );
    expect(board.sites).toEqual([
      {
        site_id: "3000",
        kind: 0,
        holder: 2,
        guards: [
          { slot: 0, explorer_id: "51", structure_id: "11", address: "0xa", troops: 8_000, last_tick: 900 },
          { slot: 2, explorer_id: "52", structure_id: "12", address: "0xb", troops: 5_500, last_tick: 905 },
        ],
      },
      { site_id: "3001", kind: 1, holder: null, guards: [] },
      {
        site_id: "3002",
        kind: 2,
        holder: 1,
        guards: [{ slot: 0, explorer_id: "53", structure_id: "13", address: "0xc", troops: 15_000, last_tick: 901 }],
      },
    ]);
  });

  it("refuses a guard it cannot name rather than showing a site without it", () => {
    expect(() =>
      buildRaceBoard(
        raceRows({
          DeepSite: [row({ entity_id: 3000n, kind: 0, day: 4n })],
          DeepGuard: [row({ explorer_id: 51n, site_id: 3000n, slot: 0 })],
        }),
        String(GAME),
      ),
    ).toThrow("Deep guard 51 has no army or tick");
  });

  it("puts the finished hyperstructure first, its fifth stage built", () => {
    const board = buildRaceBoard(
      raceRows({
        AspectHyperstructure: [
          row({ aspect: 1, entity_id: 901n, height: 10_000 }),
          row({ aspect: 2, entity_id: 902n, height: 9_990 }),
          row({ aspect: 3, entity_id: 903n, height: 10 }),
          row({ aspect: 4, entity_id: 904n, height: 0 }),
        ],
        RaceResult: [row({ winner: 1, ended_at: 4_000n, scheduled_end_at: 9_000n })],
      }),
      String(GAME),
    );
    expect(board.winner).toBe(1);
    expect(board.aspects.map(({ aspect, rank, stage }) => ({ aspect, rank, stage }))).toEqual([
      { aspect: 1, rank: 1, stage: 5 },
      { aspect: 2, rank: 2, stage: 4 },
      { aspect: 3, rank: 3, stage: 0 },
      { aspect: 4, rank: 4, stage: 0 },
    ]);
  });

  it("names no winner when the mist won", () => {
    const board = buildRaceBoard(
      raceRows({ RaceResult: [row({ winner: null, ended_at: 9_000n, scheduled_end_at: 9_000n })] }),
      String(GAME),
    );
    expect(board.winner).toBeNull();
    expect(board.aspects[0]!.aspect).toBe(2);
  });

  it("refuses a race missing an Aspect's hyperstructure rather than ranking it at zero", () => {
    expect(() =>
      buildRaceBoard(
        raceRows({ AspectHyperstructure: [row({ aspect: 1, entity_id: 901n, height: 1 })] }),
        String(GAME),
      ),
    ).toThrow("Race has no hyperstructure for Aspect 2");
  });
});

describe("GET /games/:id/race", () => {
  const handler = (modelRows: (model: string) => FoldRow[]) =>
    createHeraldRequestHandler({
      chain: "madara",
      manifest: shardManifest,
      schemas: {},
      worldAddress: manifest.world.address,
      confirmedBlock: () => 13,
      chainTimestamp: () => 30,
      decodedModelCount: 50,
      fold: {
        modelRows,
        structurePosition: () => undefined,
        expeditionSite: () => undefined,
        directoryRevision: () => 0,
        snapshot: () => {
          throw new Error("the race board reads no snapshot");
        },
      },
      undecodableEventCount: () => 0,
      nodeHealth: () => null,
    });

  it("answers a race game's board at the confirmed head, and 404 for a game that does not race", async () => {
    const response = await handler(raceRows())(new Request(`http://herald/games/${GAME}/race`));
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Confirmed-Block")).toBe("13");
    expect(((await response.json()) as { aspects: { aspect: number }[] }).aspects.map(({ aspect }) => aspect)).toEqual([
      2, 1, 3, 4,
    ]);

    const other = await handler(raceRows())(new Request("http://herald/games/8/race"));
    expect(other.status).toBe(404);
    expect(await other.json()).toEqual({ error: "not_a_race" });
  });
});
