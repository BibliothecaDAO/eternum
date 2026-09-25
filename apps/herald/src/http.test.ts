import { describe, expect, it, vi } from "vitest";

import { buildNativeDirectory, buildNativeLeaderboard } from "./native/read-models";
import { createHeraldRequestHandler } from "./http";
import { shardManifest } from "./native/fixtures";
import type { GameSnapshot, ReplayMetrics } from "./types";

const metrics: ReplayMetrics = {
  decoded_events: 10,
  event_messages: 1,
  pages: 1,
  retained_rows: 2,
  store_events: 9,
};

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
    directoryRevision: () => 0,
    modelRows: (model) => {
      if (model === "GameRegistry") {
        return [
          {
            key: "0x2",
            value: {
              game_id: "0x7",
              name: "0x74657374",
              preset_id: "0x2",
              settled: false,
              ready: true,
              dev_mode_on: false,
              start_settling_at: "0x1",
              start_main_at: "0x2",
              end_at: "0x3",
              end_grace_seconds: "0x4",
            },
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
              epoch_seconds: 0,
              victory_points_grant_config: { hyp_points_per_second: "1" },
            },
          },
        ];
      if (model === "SettlementRules")
        return [{ key: "0x7", value: { game_id: "7", registration_limit: "96", registration_start: "1" } }];
      return [];
    },
    snapshot: () => snapshot,
  },
  metrics,
  history: {
    queryStoryCursor: async () => ({
      chain: "madara",
      world_address: "0x123",
      complete_through_block: 12,
      next_cursor: { block: 12, transaction: 2147483647, event: 2147483647 },
      items: [],
    }),
    activity: () => new Map(),
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
    transactionCount: async (gameId) => ({ count: 9, game_id: gameId }),
  },
  undecodableEventCount: () => 2,
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

  it("serves paginated history and per-game transaction tallies", async () => {
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

    await expect((await handler(new Request("http://herald/games/7/transactions/count"))).json()).resolves.toEqual({
      count: 9,
      game_id: "7",
    });
  });

  it("rejects unknown models and routes", async () => {
    const unknownModel = await handler(new Request("http://herald/games/7/snapshot?models=Missing"));
    expect(unknownModel.status).toBe(400);
    await expect(unknownModel.json()).resolves.toEqual({ error: "Unknown snapshot models: Missing" });

    expect((await handler(new Request("http://herald/other/games/7/snapshot"))).status).toBe(404);
  });
});

it("serves the prepared leaderboard aggregate without paging history", async () => {
  const response = await handler(new Request("http://herald/games/7/leaderboard"));
  expect(response.status).toBe(200);
  expect(response.headers.get("access-control-allow-origin")).toBe("*");
  expect(await response.json()).toEqual({ game_id: "7", entries: [] });
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
    metrics,
    fold: { ...httpState.fold, modelRows: () => [], snapshot: () => snapshot },
    undecodableEventCount: () => 0,
    history: {
      queryStoryCursor: async () => ({
        chain: "madara",
        world_address: "0x123",
        complete_through_block: 12,
        next_cursor: { block: 12, transaction: 2147483647, event: 2147483647 },
        items: [],
      }),
      queryEvents,
      activity: () => new Map(),
      reviewSnapshot: async () => snapshot,
      transactionCount: async () => ({ game_id: "7", count: 0 }),
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

it("keeps an incomplete roster in registration beyond its scheduled end", async () => {
  const handler = createHeraldRequestHandler({
    ...httpState,
    fold: {
      ...httpState.fold,
      modelRows: (model) =>
        httpState.fold
          .modelRows(model)
          .map((row) => (model === "GameRegistry" ? { ...row, value: { ...row.value, ready: false } } : row)),
    },
  });
  const response = await handler(new Request("http://herald/games"));
  expect(response.status).toBe(200);
  expect((await response.json()).games[0]).toMatchObject({ ready: false, status: "Registration" });
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
    readModels: { directory: build, leaderboard: buildNativeLeaderboard },
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
  const build = vi.fn(buildNativeLeaderboard);
  const handler = createHeraldRequestHandler({
    ...httpState,
    confirmedBlock: () => block,
    readModels: { directory: buildNativeDirectory, leaderboard: build },
    fold: {
      ...httpState.fold,
      modelRows: (model) =>
        httpState.fold.modelRows(model).flatMap((row) => [row, { ...row, value: { ...row.value, game_id: "8" } }]),
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
      expect(build).toHaveBeenCalledTimes((head + 1) * 2);
      for (const cache of responseCaches) expect(cache.size).toBe(2);
    }
    expect(responseCaches.size).toBe(1);
  } finally {
    clearing.mockRestore();
  }
});
