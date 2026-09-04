// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import type { WorldDeployment } from "./world-directory";
import { fetchHeraldGameDirectory, fetchHeraldGameSnapshot, snapshotModelRows } from "./herald-http";

const world = {
  id: "blitz",
  chain: "madara",
  heraldBaseUrl: "https://gateway.example/herald/",
} as WorldDeployment;

const mockFetch = vi.fn<typeof globalThis.fetch>();

afterEach(() => {
  vi.unstubAllGlobals();
  mockFetch.mockReset();
});

describe("Herald HTTP client", () => {
  it("preserves a configured path prefix for directory and selective snapshot requests", async () => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({ chain: "madara", games: [] }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            confirmed_block: 12,
            game_id: "7",
            models: [
              { model: "Structure", rows: [] },
              { model: "BlitzSettlement", rows: [] },
            ],
          }),
          { status: 200 },
        ),
      );

    await fetchHeraldGameDirectory(world, "0x123");
    await fetchHeraldGameSnapshot(world, 7, ["Structure", "Structure", "BlitzSettlement"]);

    expect(mockFetch.mock.calls.map(([url]) => String(url))).toEqual([
      "https://gateway.example/herald/madara/games?player=0x123",
      "https://gateway.example/herald/madara/games/7/snapshot?models=Structure%2CBlitzSettlement",
    ]);
  });

  it("fails loudly when a requested model is absent", () => {
    expect(() => snapshotModelRows({ confirmed_block: 12, game_id: "7", models: [] }, "Structure")).toThrow(
      "Herald snapshot omitted requested model Structure",
    );
  });
});
