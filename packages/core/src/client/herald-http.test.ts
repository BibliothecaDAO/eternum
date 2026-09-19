// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import type { WorldDeployment } from "./world-directory";
import {
  fetchHeraldGameHistory,
  fetchHeraldGameDirectory,
  fetchHeraldGameSnapshot,
  snapshotModelRows,
} from "./herald-http";

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

it("requests battle-only history from Herald rather than a mixed story page", async () => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockResolvedValue(new Response(JSON.stringify({ items: [] })));
  await fetchHeraldGameHistory(world, 28, { model: "StoryEvent", story: "BattleStory", limit: 350 });
  const url = new URL(String(mockFetch.mock.calls[0][0]));
  expect(url.pathname).toBe("/herald/madara/games/28/history");
  expect(Object.fromEntries(url.searchParams)).toEqual({ model: "StoryEvent", story: "BattleStory", limit: "350" });
});

it("shares a directory stream, notifies each consumer, and closes after the last unsubscribe", async () => {
  const sources: { url: string; onmessage: (() => void) | null; close: ReturnType<typeof vi.fn> }[] = [];
  class Source {
    onmessage = null;
    close = vi.fn();
    constructor(public url: string) {
      sources.push(this);
    }
  }
  vi.stubGlobal("EventSource", Source);
  const { subscribeHeraldDirectory } = await import("./herald-http");
  const deployment = { id: "test", chain: "madara", heraldBaseUrl: "https://herald.test/prefix" } as Parameters<
    typeof subscribeHeraldDirectory
  >[0];
  const first = vi.fn();
  const second = vi.fn();
  const stopFirst = subscribeHeraldDirectory(deployment, first);
  const stopSecond = subscribeHeraldDirectory(deployment, second);
  expect(sources).toHaveLength(1);
  expect(sources[0].url).toBe("https://herald.test/prefix/madara/games/updates");
  sources[0].onmessage!();
  expect(first).toHaveBeenCalledOnce();
  expect(second).toHaveBeenCalledOnce();
  stopFirst();
  sources[0].onmessage!();
  expect(first).toHaveBeenCalledOnce();
  expect(second).toHaveBeenCalledTimes(2);
  expect(sources[0].close).not.toHaveBeenCalled();
  stopSecond();
  expect(sources[0].close).toHaveBeenCalledOnce();
  vi.unstubAllGlobals();
});
