import { afterEach, describe, expect, mock, test } from "bun:test";
import { shortString } from "starknet";
import { findGameRegistryById, findGameRegistryByName } from "../registrar/game-registry";

const originalFetch = globalThis.fetch;

function respondWithRows(rows: Record<string, unknown>[]) {
  globalThis.fetch = mock(async (_input: string | URL | Request) => Response.json(rows)) as unknown as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.TORII_URL;
});

describe("appchain GameRegistry queries", () => {
  test("finds a game by its numeric id", async () => {
    process.env.TORII_URL = "https://torii.example";
    respondWithRows([{ game_id: "0x7", name: shortString.encodeShortString("alpha") }]);

    const row = await findGameRegistryById(7);

    expect(row?.gameId).toBe(7);
  });

  test("queries the encoded felt name for idempotent create checks", async () => {
    process.env.TORII_URL = "https://torii.example";
    const fetchMock = mock(async (_input: string | URL | Request) =>
      Response.json([{ game_id: 7, name: shortString.encodeShortString("alpha") }]),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const row = await findGameRegistryByName("alpha");

    expect(row?.gameId).toBe(7);
    expect(decodeURIComponent(String(fetchMock.mock.calls[0]?.[0]))).toContain(
      `WHERE name = "${shortString.encodeShortString("alpha")}" LIMIT 1`,
    );
  });
});
