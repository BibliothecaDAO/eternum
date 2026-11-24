import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readNodeHealth } from "./node-health";
import { describe, expect, it, vi } from "vitest";

import { buildNativeDirectory } from "./native/read-models";
import { createHeraldRequestHandler } from "./http";
import { HERALD_PUBLIC_GET_ROUTES, matchHeraldGetRoute } from "./http-routes";
import { shardManifest } from "./native/fixtures";
import { gameRegistryRow } from "../../../packages/core/src/test-support/game-registry";
import type { GameSnapshot } from "./types";

const snapshot: GameSnapshot = {
  confirmed_block: 12,
  game_id: "7",
  models: [
    { model: "SliceRules", rows: [{ key: "0x1", value: { game_id: "0x7" } }] },
    { model: "Structure", rows: [] },
  ],
};

const httpState: Parameters<typeof createHeraldRequestHandler>[0] = {
  chain: "madara",
  manifest: shardManifest,
  schemas: {},
  worldAddress: "0x123",
  confirmedBlock: () => 12,
  chainTimestamp: () => 100,
  decodedModelCount: 50,
  fold: {
    structurePosition: () => undefined,
    expeditionSite: (game, entity) =>
      game === "7" && entity === "4242"
        ? { game_id: "0x7", entity_id: "0x1092", category: "0x9", row: "0x32" }
        : undefined,
    directoryRevision: () => 0,
    modelRows: (model) => {
      if (model === "GameRegistry") {
        return [
          {
            key: "0x2",
            value: gameRegistryRow({
              game_id: 7,
              name: "0x74657374",
              start_settling_at: "0x1",
              start_main_at: "0x2",
              scheduled_end_at: "0x3",
              end_at: "0x3",
            }),
          },
        ];
      }
      if (model === "SliceRules")
        return [
          {
            key: "0x7",
            value: {
              game_id: "7",
              mode_rules: 0,
              day_unit_seconds: 0,
            },
          },
        ];
      if (model === "SettlementRules")
        return [{ key: "0x7", value: { game_id: "7", registration_limit: "96", registration_start: "1" } }];
      return [];
    },
    snapshot: () => snapshot,
  },
  history: {
    frontierDayRanks: async () => null,
    frontierHistory: async () => [],
    queryStoryCursor: async () => ({
      chain: "madara",
      world_address: "0x123",
      complete_through_block: 12,
      next_cursor: { block: 12, transaction: 2147483647, event: 2147483647 },
      items: [],
    }),
    queryEvents: async (query) => ({
      complete_through_block: 12,
      items: [
        {
          block_number: 11,
          event_index: 2,
          game_id: query.gameId,
          model: query.model ?? "StoryEvent",
          transaction_hash: "0xabc",
          transaction_index: 1,
          value: { game_id: "0x7", story: "RealmCreatedStory" },
        },
      ],
      limit: query.limit,
      offset: query.offset,
      total: 1,
    }),
    reviewSnapshot: async () => snapshot,
    gameTransactions: async () => ({ total: 0, days: [] }),
  },
  undecodableEventCount: () => 2,
  nodeHealth: () => null,
};
const handler = createHeraldRequestHandler(httpState);

describe("herald HTTP", () => {
  it("serves the published schema and names unavailable decoder identities", async () => {
    const schema = { identity: "schema-7", version: 2 };
    const schemas = createHeraldRequestHandler({ ...httpState, schemas: { "schema-7": schema } });
    await expect((await schemas(new Request("http://herald/schemas/schema-7"))).json()).resolves.toEqual(schema);
    for (const identity of ["unpublished", "__proto__"]) {
      const response = await schemas(new Request(`http://herald/schemas/${identity}`));
      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: "UNKNOWN_RELEASE_SCHEMA" });
    }
  });

  it("serves health and model-filtered game snapshots", async () => {
    const health = await (await handler(new Request("http://herald/health"))).json();
    expect(health).toMatchObject({
      confirmed_block: 12,
      decoded_models: 50,
      service: "herald",
      success: true,
      undecodable_events: 2,
    });
    // Startup replay counts belong to the herald_ready log line; health reports only live facts.
    expect(health).not.toHaveProperty("metrics");
    expect(health.node).toBeNull();
    // A sample file holding something other than a sample is no sample: /health still answers, with node null.
    const directory = mkdtempSync(join(tmpdir(), "node-health-"));
    try {
      writeFileSync(join(directory, "node-health.json"), "null");
      const unreadable = createHeraldRequestHandler({
        ...httpState,
        nodeHealth: () => readNodeHealth(join(directory, "node-health.json")),
      });
      const answer = await unreadable(new Request("http://herald/health"));
      expect(answer.status).toBe(200);
      await expect(answer.json()).resolves.toMatchObject({ success: true, confirmed_block: 12, node: null });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
    const sampled = { sampled_at: 1_800_000_000, memory_bytes: 1_900_000_000, host_memory_bytes: 96_000_000_000 };
    const withNode = createHeraldRequestHandler({ ...httpState, nodeHealth: () => sampled });
    await expect((await withNode(new Request("http://herald/health"))).json()).resolves.toMatchObject({
      node: sampled,
      success: true,
    });

    const response = await handler(new Request("http://herald/games/7/snapshot?models=Structure"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ game_id: "7", models: [{ model: "Structure", rows: [] }] });

    const directoryResponse = await handler(new Request("http://herald/games"));
    expect(directoryResponse.headers.get("access-control-allow-origin")).toBe("*");
    await expect(directoryResponse.json()).resolves.toMatchObject({
      chain: "madara",
      games: [{ game_id: 7, name: "test", status: "Ended" }],
    });

    expect((await handler(new Request("http://herald/games", { method: "OPTIONS" }))).status).toBe(204);
    expect((await handler(new Request("http://herald/games?player=not-an-address"))).status).toBe(400);
  });

  it("serves paginated history", async () => {
    const history = await (
      await handler(new Request("http://herald/games/7/history?model=StoryEvent&limit=25&offset=5"))
    ).json();
    expect(history).toMatchObject({
      complete_through_block: 12,
      items: [{ game_id: "7", model: "StoryEvent", transaction_hash: "0xabc" }],
      limit: 25,
      offset: 5,
      total: 1,
    });
  });

  it("serves a site's row by its entity, and none for an entity that is no site", async () => {
    const site = await handler(new Request("http://herald/games/7/sites/4242"));
    expect(site.status).toBe(200);
    await expect(site.json()).resolves.toEqual({ game_id: "0x7", entity_id: "0x1092", category: "0x9", row: "0x32" });
    const none = await handler(new Request("http://herald/games/7/sites/7"));
    expect(none.status).toBe(404);
    await expect(none.json()).resolves.toEqual({ error: "unknown_site" });
  });

  it("rejects unknown models and routes", async () => {
    const unknownModel = await handler(new Request("http://herald/games/7/snapshot?models=Missing"));
    expect(unknownModel.status).toBe(400);
    await expect(unknownModel.json()).resolves.toEqual({ error: "Unknown snapshot models: Missing" });

    expect((await handler(new Request("http://herald/other/games/7/snapshot"))).status).toBe(404);
  });
});

it("answers no site ranking for a Season 1 game, whose race is between Aspects", async () => {
  const season = createHeraldRequestHandler({
    ...httpState,
    fold: {
      ...httpState.fold,
      modelRows: (model: string) => (model === "RaceRules" ? [{ key: "7", value: { game_id: "7" } }] : []),
    },
  });
  const response = await season(new Request("http://herald/games/7/leaderboard"));
  expect([response.status, await response.json()]).toEqual([404, { error: "season_one_ranks_aspects" }]);
  const other = await handler(new Request("http://herald/games/7/leaderboard"));
  expect([other.status, await other.json()]).toEqual([503, { error: "Game 7 has no Frontier leaderboard" }]);
});

describe("an Aspect's members in a Season 1 game, ranked by Glory", () => {
  const glory = (whole: number) => String(BigInt(whole) * 1_000_000_000n);
  let head = 12;
  let rows: Record<string, { key: string; value: Record<string, unknown> }[]> = {};
  const seasonRows = () => ({
    RaceRules: [{ key: "7", value: { game_id: "7" } }],
    HomeAspect: [
      { key: "a", value: { game_id: "7", home: "11", aspect: 1 } },
      { key: "b", value: { game_id: "7", home: "12", aspect: 1 } },
      { key: "c", value: { game_id: "7", home: "13", aspect: 1 } },
      { key: "d", value: { game_id: "7", home: "14", aspect: 2 } },
      { key: "e", value: { game_id: "8", home: "15", aspect: 1 } },
    ],
    Structure: [11, 12, 13, 14, 15].map((home) => ({
      key: String(home),
      value: {
        game_id: home === 15 ? "8" : "7",
        entity_id: String(home),
        owner: `0x${home}0`,
        metadata: { realm_id: home + 100 },
      },
    })),
    RaceMember: [
      { key: "11", value: { game_id: "7", entity_id: "11", glory: glory(40), contribution: "0" } },
      { key: "12", value: { game_id: "7", entity_id: "12", glory: glory(120), contribution: "0" } },
      { key: "14", value: { game_id: "7", entity_id: "14", glory: glory(500), contribution: "0" } },
      { key: "15", value: { game_id: "8", entity_id: "15", glory: glory(900), contribution: "0" } },
    ],
  });
  const roster = createHeraldRequestHandler({
    ...httpState,
    confirmedBlock: () => head,
    fold: { ...httpState.fold, modelRows: (model: string) => rows[model] ?? [] },
  });
  const read = async (path: string) => {
    const response = await roster(new Request(`http://herald${path}`));
    return [response.status, await response.json(), response.headers.get("X-Confirmed-Block")] as const;
  };

  it("lists each member of the Aspect in that game once, by Glory then home, with its realm and owner, a page at a time", async () => {
    rows = seasonRows();
    const member = (rank: number, home: number, whole: number) => ({
      rank,
      entity_id: String(home),
      realm_id: home + 100,
      owner: `0x${home}0`,
      glory: glory(whole),
    });
    expect(await read("/games/7/aspects/1/members")).toEqual([
      200,
      {
        game_id: "7",
        aspect: 1,
        total: 3,
        offset: 0,
        limit: 50,
        members: [member(1, 12, 120), member(2, 11, 40), member(3, 13, 0)],
      },
      "12",
    ]);
    expect(await read("/games/7/aspects/1/members?limit=1&offset=1")).toEqual([
      200,
      { game_id: "7", aspect: 1, total: 3, offset: 1, limit: 1, members: [member(2, 11, 40)] },
      "12",
    ]);
    expect((await read("/games/7/aspects/1/members?offset=3"))[1]).toMatchObject({ total: 3, members: [] });
    expect((await read("/games/7/aspects/2/members"))[1]).toMatchObject({ total: 1, members: [member(1, 14, 500)] });
    expect((await read("/games/7/aspects/3/members"))[1]).toMatchObject({ total: 0, members: [] });
  });

  it("refuses a page over 100 members, an empty or malformed page, an Aspect outside the catalog, and a game with no Aspect race", async () => {
    rows = seasonRows();
    for (const query of ["limit=101", "limit=0", "offset=-1", "limit=two"])
      expect((await read(`/games/7/aspects/1/members?${query}`)).slice(0, 2)).toEqual([
        400,
        { error: "invalid_roster_page" },
      ]);
    expect((await read("/games/7/aspects/9/members")).slice(0, 2)).toEqual([400, { error: "unknown_aspect" }]);
    expect((await read("/games/7/aspects/1/members?limit=100"))[0]).toBe(200);
    rows = { ...seasonRows(), RaceRules: [] };
    head += 1;
    expect((await read("/games/7/aspects/1/members")).slice(0, 2)).toEqual([404, { error: "no_aspect_race" }]);
  });

  it("ranks once per confirmed head, and anew at the next one", async () => {
    rows = seasonRows();
    head = 20;
    expect((await read("/games/7/aspects/1/members"))[1]).toMatchObject({
      members: [{ entity_id: "12" }, { entity_id: "11" }, { entity_id: "13" }],
    });
    rows.RaceMember = [{ key: "13", value: { game_id: "7", entity_id: "13", glory: glory(999), contribution: "0" } }];
    expect((await read("/games/7/aspects/1/members"))[1]).toMatchObject({
      members: [{ entity_id: "12" }, { entity_id: "11" }, { entity_id: "13" }],
    });
    head = 21;
    const [, next, block] = await read("/games/7/aspects/1/members");
    expect(block).toBe("21");
    expect(next).toMatchObject({
      members: [
        { entity_id: "13", glory: glory(999) },
        { entity_id: "11", glory: "0" },
        { entity_id: "12", glory: "0" },
      ],
    });
  });
});

it("passes a battle-only history filter to the store before pagination", async () => {
  const queryEvents = vi.fn(async () => ({ items: [], total: 0, limit: 350, offset: 0, complete_through_block: 12 }));
  const battleHandler = createHeraldRequestHandler({
    chain: "madara",
    manifest: shardManifest,
    schemas: {},
    worldAddress: "0x123",
    confirmedBlock: () => 12,
    chainTimestamp: () => 100,
    decodedModelCount: 0,
    fold: { ...httpState.fold, modelRows: () => [], snapshot: () => snapshot },
    undecodableEventCount: () => 0,
    nodeHealth: () => null,
    history: {
      frontierDayRanks: async () => null,
      frontierHistory: async () => [],
      queryStoryCursor: async () => ({
        chain: "madara",
        world_address: "0x123",
        complete_through_block: 12,
        next_cursor: { block: 12, transaction: 2147483647, event: 2147483647 },
        items: [],
      }),
      queryEvents,
      reviewSnapshot: async () => snapshot,
      gameTransactions: async () => ({ total: 0, days: [] }),
    },
  });
  const response = await battleHandler(
    new Request("http://herald/games/7/history?model=StoryEvent&story=BattleStory&limit=350"),
  );
  expect(response.status).toBe(200);
  expect(queryEvents).toHaveBeenCalledWith(
    expect.objectContaining({ gameId: "7", model: "StoryEvent", story: "BattleStory", limit: 350, offset: 0 }),
  );
});

it("passes every requested owner to the store, so one read serves an Aspect's fights", async () => {
  const queryEvents = vi.fn(async () => ({ items: [], total: 0, limit: 100, offset: 0, complete_through_block: 12 }));
  const handler = createHeraldRequestHandler({
    ...httpState,
    history: { ...httpState.history!, queryEvents },
  });
  const response = await handler(new Request("http://herald/games/7/history?model=BattleEvent&owner=0x1&owner=0x2"));
  expect(response.status).toBe(200);
  expect(queryEvents).toHaveBeenCalledWith(expect.objectContaining({ model: "BattleEvent", owner: ["0x1", "0x2"] }));
});

it("serves the bounded story cursor only when history decoding is healthy", async () => {
  const healthy = createHeraldRequestHandler({ ...httpState, undecodableEventCount: () => 0 });
  const endpoint = "http://herald/history/story-events";
  expect((await healthy(new Request(endpoint))).status).toBe(200);
  expect((await healthy(new Request(endpoint + "?limit=0"))).status).toBe(400);
  expect((await healthy(new Request(endpoint + "?after=bad"))).status).toBe(400);
  expect((await handler(new Request(endpoint))).status).toBe(503);
});

it("streams directory invalidations atomically and reconnects from the current snapshot", async () => {
  let block = 12;
  let revision = 0;
  const listeners = new Set<(models: ReadonlySet<string>) => void>();
  const handler = createHeraldRequestHandler({
    ...httpState,
    confirmedBlock: () => block,
    fold: { ...httpState.fold, directoryRevision: () => revision },
    subscribeConfirmedChanges: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  });
  const response = await handler(new Request("http://herald/games/updates"));
  expect(response.headers.get("content-type")).toBe("text/event-stream");
  const reader = response.body!.getReader();
  const decode = (data: Uint8Array | undefined) => new TextDecoder().decode(data);
  expect(decode((await reader.read()).value)).toBe("data: changed\n\n");
  block++;
  for (const listener of listeners) listener(new Set(["ExplorerTroops"]));
  block++;
  revision++;
  for (const listener of listeners) listener(new Set(["Structure", "GameRegistry"]));
  expect(decode((await reader.read()).value)).toBe("data: changed\n\n");
  await reader.cancel();
  expect(listeners.size).toBe(0);
  const reconnected = await handler(new Request("http://herald/games/updates"));
  const resumed = reconnected.body!.getReader();
  expect(decode((await resumed.read()).value)).toBe("data: changed\n\n");
  await resumed.cancel();
  expect(listeners.size).toBe(0);
});

it("derives directory phases from advancing chain time with no registry write", async () => {
  let timestamp = 1;
  const handler = createHeraldRequestHandler({
    ...httpState,
    confirmedBlock: () => timestamp,
    chainTimestamp: () => timestamp,
  });
  const status = async () => {
    const response = await handler(new Request("http://herald/games"));
    expect(response.status).toBe(200);
    return (await response.json()).games[0].status;
  };
  expect(await status()).toBe("Registration");
  timestamp = 2;
  expect(await status()).toBe("Live");
  timestamp = 3;
  expect(await status()).toBe("Ended");
});

it("caches directory responses and shared row reads within one confirmed block", async () => {
  let block = 12;
  const modelRows = vi.fn(httpState.fold.modelRows);
  const handler = createHeraldRequestHandler({
    ...httpState,
    confirmedBlock: () => block,
    fold: { ...httpState.fold, modelRows },
  });
  const read = (player = "") => handler(new Request(`http://herald/games${player ? `?player=${player}` : ""}`));
  expect((await read()).status).toBe(200);
  const calls = modelRows.mock.calls.length;
  expect((await read()).status).toBe(200);
  expect((await read("0x111")).status).toBe(200);
  expect(modelRows).toHaveBeenCalledTimes(calls);
  block++;
  expect((await read()).status).toBe(200);
  expect(modelRows).toHaveBeenCalledTimes(calls * 2);
});

it("builds one public directory per head and never caches responses by requested address", async () => {
  let block = 12;
  const build = vi.fn(buildNativeDirectory);
  const handler = createHeraldRequestHandler({
    ...httpState,
    confirmedBlock: () => block,
    readModels: { directory: build },
    fold: {
      ...httpState.fold,
      modelRows: (model) =>
        model === "PlayerEntry"
          ? [{ key: "1", value: { game_id: "7", player: "1" } }]
          : httpState.fold.modelRows(model),
    },
  });
  const storedResponses: unknown[] = [];
  const set = Map.prototype.set;
  const storing = vi.spyOn(Map.prototype, "set").mockImplementation(function (this: Map<unknown, unknown>, key, value) {
    if (value && typeof value === "object" && "confirmed_block" in value && "games" in value)
      storedResponses.push(value);
    return set.call(this, key, value);
  });
  try {
    for (let head = 0; head < 3; head++, block++) {
      for (let player = 1; player <= 100; player++) {
        const response = await handler(new Request(`http://herald/games?player=${player}`));
        const body = await response.json();
        expect(body.confirmed_block).toBe(block);
        expect(body.games[0].player_state.registered).toBe(player === 1);
      }
      expect(build).toHaveBeenCalledTimes(head + 1);
      const publicResponse = await handler(new Request("http://herald/games"));
      expect((await publicResponse.json()).games[0].player_state).toBeNull();
    }
    expect(storedResponses).toEqual([]);
    expect(build.mock.calls.every(([input]) => input.playerAddress === undefined)).toBe(true);
  } finally {
    storing.mockRestore();
  }
});

it("caches each leaderboard once per confirmed head and drops all previous-head results", async () => {
  let block = 12;
  const frontierHistory = vi.fn(async () => []);
  const frontierRows = (model: string) =>
    model === "SliceRules"
      ? [{ key: "7", value: { game_id: "7", day_unit_seconds: 14400 } }]
      : httpState.fold.modelRows(model);
  const handler = createHeraldRequestHandler({
    ...httpState,
    undecodableEventCount: () => 0,
    confirmedBlock: () => block,
    history: { ...httpState.history!, frontierHistory },
    fold: {
      ...httpState.fold,
      modelRows: (model) =>
        frontierRows(model).flatMap((row) => [row, { ...row, value: { ...row.value, game_id: "8" } }]),
    },
  });
  const responseCaches = new Set<Map<unknown, unknown>>();
  const clear = Map.prototype.clear;
  const clearing = vi.spyOn(Map.prototype, "clear").mockImplementation(function (this: Map<unknown, unknown>) {
    const first = this.values().next().value;
    if (first && typeof first === "object" && "game_id" in first && "entries" in first) responseCaches.add(this);
    clear.call(this);
  });
  try {
    for (let head = 0; head < 5; head++, block++) {
      for (const game of ["7", "007", "8", "7", "8"]) {
        const response = await handler(new Request(`http://herald/games/${game}/leaderboard`));
        expect(response.status).toBe(200);
        expect((await response.json()).game_id).toBe(BigInt(game).toString());
      }
      expect(frontierHistory).toHaveBeenCalledTimes((head + 1) * 2);
      for (const cache of responseCaches) expect(cache.size).toBe(2);
    }
    expect(responseCaches.size).toBe(1);
  } finally {
    clearing.mockRestore();
  }
});

it("serves Frontier history at one confirmed head, caches successes only and keeps captured realm facts", async () => {
  let head = 12;
  let depth = 1;
  let release!: (value: Awaited<ReturnType<NonNullable<typeof httpState.history>["frontierHistory"]>>) => void;
  const frontierHistory = vi.fn(
    () =>
      new Promise<Awaited<ReturnType<NonNullable<typeof httpState.history>["frontierHistory"]>>>((resolve) => {
        release = resolve;
      }),
  );
  const modelRows = (model: string) => {
    if (model === "SliceRules") return [{ key: "7", value: { game_id: "7", day_unit_seconds: 14400 } }];
    if (model === "Structure")
      return [
        {
          key: "1",
          value: {
            game_id: "7",
            entity_id: "1",
            owner: "10",
            base: { category: 1, level: 2 },
            metadata: { has_wonder: false, deepest_depth: depth, order: 5 },
          },
        },
      ];
    return httpState.fold.modelRows(model);
  };
  const read = createHeraldRequestHandler({
    ...httpState,
    confirmedBlock: () => head,
    fold: { ...httpState.fold, modelRows },
    history: { ...httpState.history!, frontierHistory },
    undecodableEventCount: () => 0,
    nodeHealth: () => null,
  });
  const url = "http://herald/games/7/leaderboard";
  const pending = read(new Request(url));
  await vi.waitFor(() => expect(frontierHistory).toHaveBeenCalledWith("7", 12));
  depth = 2;
  head = 13;
  release([]);
  const completed = await pending;
  expect(completed.headers.get("X-Confirmed-Block")).toBe("12");
  expect(await completed.json()).toMatchObject({
    mode: "frontier",
    entries: [{ deepest_depth: 1, level: 2 }],
  });
  const next = read(new Request(url));
  await vi.waitFor(() => expect(frontierHistory).toHaveBeenCalledWith("7", 13));
  release([]);
  expect(await (await next).json()).toMatchObject({
    mode: "frontier",
    entries: [{ deepest_depth: 2 }],
  });
  await read(new Request(url));
  expect(frontierHistory).toHaveBeenCalledTimes(2);
  head = 14;
  frontierHistory.mockRejectedValueOnce(new Error("Frontier history is incomplete"));
  expect((await read(new Request(url))).status).toBe(503);
  frontierHistory.mockResolvedValueOnce([]);
  expect((await read(new Request(url))).status).toBe(200);
  expect(frontierHistory).toHaveBeenCalledTimes(4);
});

it("serves a listed game's stats for an hour: its players and realms as the directory counts them, and its transactions", async () => {
  const realm = (entity: number, owner: string) => ({
    key: `0x${entity}`,
    value: { game_id: "7", entity_id: entity, owner, base: { category: 1, level: 1 }, metadata: {} },
  });
  const gameTransactions = vi
    .fn()
    .mockRejectedValueOnce(new Error("pool closed"))
    .mockResolvedValue({ total: 3, days: [{ day: "2026-11-24", transactions: 3 }] });
  const read = createHeraldRequestHandler({
    ...httpState,
    fold: {
      ...httpState.fold,
      modelRows: (model) =>
        model === "Structure" ? [realm(1, "0xa"), realm(2, "0xb"), realm(3, "0xa")] : httpState.fold.modelRows(model),
    },
    history: { ...httpState.history!, gameTransactions },
  });
  const stats = () => read(new Request("http://herald/games/7/stats"));
  expect((await stats()).status).toBe(503);
  const response = await stats();
  expect(response.headers.get("cache-control")).toBe("public, max-age=3600");
  expect(response.headers.get("access-control-allow-origin")).toBe("*");
  expect(await response.json()).toEqual({
    game_id: "7",
    players: 2,
    realms: 3,
    transactions: { total: 3, days: [{ day: "2026-11-24", transactions: 3 }] },
  });
  await stats();
  expect(gameTransactions).toHaveBeenCalledTimes(2);
  expect(gameTransactions).toHaveBeenCalledWith("7");
  const unlisted = await read(new Request("http://herald/games/8/stats"));
  expect([unlisted.status, await unlisted.json()]).toEqual([404, { error: "unknown_game" }]);
});

it("serves immutable per-day ranks, with explicit unavailable and unclosed responses", async () => {
  const ranks = {
    game_id: "1",
    day_index: 0,
    ends_at: 1800010000,
    confirmed_block: 11,
    entries: [{ address: "0x1", structure_id: "7", rank: 1 }],
  };
  const frontierDayRanks = vi.fn().mockResolvedValue(ranks);
  const handler = createHeraldRequestHandler({
    ...httpState,
    undecodableEventCount: () => 0,
    nodeHealth: () => null,
    history: { ...httpState.history!, frontierDayRanks },
  });
  const request = (day: string) => handler(new Request(`http://localhost/games/1/days/${day}/ranks`));
  expect(await (await request("0")).json()).toEqual(ranks);
  expect(frontierDayRanks).toHaveBeenCalledWith("1", 0, 12);
  frontierDayRanks.mockResolvedValueOnce(null);
  expect((await request("1")).status).toBe(404);
  frontierDayRanks.mockRejectedValueOnce(new Error("history unavailable"));
  expect((await request("0")).status).toBe(503);
  expect((await request("9007199254740992")).status).toBe(400);
});

it("hidden check games never enter the directory clock or require public directory rules", async () => {
  const handle = createHeraldRequestHandler({
    ...httpState,
    fold: {
      ...httpState.fold,
      modelRows: (model) =>
        model === "GameRegistry"
          ? [{ key: "8", value: { game_id: "8", name: "0x" + Buffer.from("check-frontier-abc").toString("hex") } }]
          : [],
    },
  });
  const response = await handle(new Request("http://herald/games"));
  expect(response.status).toBe(200);
  expect((await response.json()).games).toEqual([]);
});

it("lets browsers read request timings only on a dev chain", async () => {
  const chainNamed = (name: string) => `0x${Buffer.from(name, "ascii").toString("hex")}`;
  for (const [chain, allowed] of [
    ["DEV_18de3131a6e90bc7", "*"],
    ["PRODUCTION_18de3131a6e90bc7", null],
    ["PROD_DEV_1", null],
  ] as const) {
    const served = createHeraldRequestHandler({
      ...httpState,
      manifest: { ...shardManifest, chainId: chainNamed(chain) },
    });
    for (const request of [
      new Request("http://herald/manifest"),
      new Request("http://herald/games"),
      new Request("http://herald/games", { method: "OPTIONS" }),
      new Request("http://herald/other"),
    ]) {
      const response = await served(request);
      expect([chain, request.url, response.headers.get("timing-allow-origin")]).toEqual([chain, request.url, allowed]);
    }
  }
});

it("dispatches every GET route through http-routes.ts with no inline pathname branches", () => {
  const source = readFileSync(new URL("./http.ts", import.meta.url), "utf8");
  expect(source).not.toMatch(/url\.pathname\s*===/);
  expect(source).not.toMatch(/url\.pathname\.startsWith\(/);
  for (const matcher of HERALD_PUBLIC_GET_ROUTES) {
    const sample =
      typeof matcher === "string"
        ? matcher
        : matcher.source
            .replace(/^\^|\$$/g, "")
            .replaceAll("\\/", "/")
            .replaceAll("([0-9]+)", "1");
    expect(matchHeraldGetRoute(sample)).not.toBeNull();
  }
});
