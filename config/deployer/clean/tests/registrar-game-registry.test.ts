import { afterEach, describe, expect, mock, test } from "bun:test";
import { findGameRegistryById, findGameRegistryByName } from "../registrar/game-registry";

const originalFetch = globalThis.fetch;

function respondWithGames(games: Record<string, unknown>[]) {
  globalThis.fetch = mock(async (_input: string | URL | Request) =>
    Response.json({ games }),
  ) as unknown as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.HERALD_URL;
});

describe("Herald GameRegistry directory", () => {
  test("finds a game by its numeric id", async () => {
    process.env.HERALD_URL = "https://herald.example/base";
    respondWithGames([{ game_id: "0x7", name: "alpha" }]);

    const row = await findGameRegistryById(7, { chain: "madara" });

    expect(row?.gameId).toBe(7);
  });

  test("finds a decoded game name and preserves the configured Herald path prefix", async () => {
    process.env.HERALD_URL = "https://herald.example/base/";
    const fetchMock = mock(async (_input: string | URL | Request) =>
      Response.json({ games: [{ game_id: 7, name: "alpha" }] }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const row = await findGameRegistryByName("alpha", { chain: "madara" });

    expect(row?.gameId).toBe(7);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://herald.example/base/madara/games");
  });
});
