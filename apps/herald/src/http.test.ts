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
  decodedModelCount: 39,
  fold: { snapshot: () => snapshot },
  metrics,
});

describe("herald HTTP", () => {
  it("serves health and model-filtered game snapshots", async () => {
    const health = await handler(new Request("http://herald/health")).json();
    expect(health).toMatchObject({ confirmed_block: 12, decoded_models: 39, service: "herald", success: true });

    const response = handler(new Request("http://herald/madara/games/7/snapshot?models=Structure"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ game_id: "7", models: [{ model: "Structure", rows: [] }] });
  });

  it("rejects unknown models and routes", async () => {
    const unknownModel = handler(new Request("http://herald/madara/games/7/snapshot?models=Missing"));
    expect(unknownModel.status).toBe(400);
    await expect(unknownModel.json()).resolves.toEqual({ error: "Unknown snapshot models: Missing" });

    expect(handler(new Request("http://herald/other/games/7/snapshot")).status).toBe(404);
  });
});
