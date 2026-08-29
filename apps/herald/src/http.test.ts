import { describe, expect, it } from "vitest";

import { createHeraldRequestHandler } from "./http";
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
    { model: "WorldConfig", rows: [{ key: "0x1", value: { game_id: "0x7" } }] },
    { model: "Structure", rows: [] },
  ],
};

const handler = createHeraldRequestHandler({
  chain: "madara",
  confirmedBlock: () => 12,
  decodedModelCount: 50,
  fold: {
    modelRows: (model) => {
      if (model === "GameRegistry") {
        return [
          {
            key: "0x2",
            value: {
              game_id: "0x7",
              name: "0x74657374",
              preset_id: "0x1",
              status: "Created",
              dev_mode_on: false,
              start_settling_at: "0x1",
              start_main_at: "0x2",
              end_at: "0x3",
              end_grace_seconds: "0x4",
              registration_grace_seconds: "0x5",
            },
          },
        ];
      }
      if (model === "ChainConfig") {
        return [
          {
            key: "0x3",
            value: {
              entry_token_address: "0x0",
              fee_token: "0x123",
              mmr_config: { enabled: false },
            },
          },
        ];
      }
      return [];
    },
    snapshot: () => snapshot,
  },
  metrics,
  history: {
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
});

describe("herald HTTP", () => {
  it("serves health and model-filtered game snapshots", async () => {
    const health = await (await handler(new Request("http://herald/health"))).json();
    expect(health).toMatchObject({
      confirmed_block: 12,
      decoded_models: 50,
      service: "herald",
      success: true,
      undecodable_events: 2,
    });

    const response = await handler(new Request("http://herald/madara/games/7/snapshot?models=Structure"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ game_id: "7", models: [{ model: "Structure", rows: [] }] });

    const directoryResponse = await handler(new Request("http://herald/madara/games"));
    expect(directoryResponse.headers.get("access-control-allow-origin")).toBe("*");
    await expect(directoryResponse.json()).resolves.toMatchObject({
      chain: "madara",
      games: [{ game_id: 7, name: "test", status: "Created" }],
    });

    expect((await handler(new Request("http://herald/madara/games", { method: "OPTIONS" }))).status).toBe(204);
    expect((await handler(new Request("http://herald/madara/games?player=not-an-address"))).status).toBe(400);
  });

  it("serves paginated history and per-game transaction tallies", async () => {
    const history = await (
      await handler(new Request("http://herald/madara/games/7/history?model=StoryEvent&limit=25&offset=5"))
    ).json();
    expect(history).toMatchObject({
      complete_through_block: 12,
      items: [{ game_id: "7", model: "StoryEvent", transaction_hash: "0xabc" }],
      limit: 25,
      offset: 5,
      total: 1,
    });

    await expect(
      (await handler(new Request("http://herald/madara/games/7/transactions/count"))).json(),
    ).resolves.toEqual({ count: 9, game_id: "7" });
  });

  it("rejects unknown models and routes", async () => {
    const unknownModel = await handler(new Request("http://herald/madara/games/7/snapshot?models=Missing"));
    expect(unknownModel.status).toBe(400);
    await expect(unknownModel.json()).resolves.toEqual({ error: "Unknown snapshot models: Missing" });

    expect((await handler(new Request("http://herald/other/games/7/snapshot"))).status).toBe(404);
  });
});
