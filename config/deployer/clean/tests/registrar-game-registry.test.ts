import { afterEach, describe, expect, mock, test } from "bun:test";
import { shortString } from "starknet";
import { findGameRegistryById, findGameRegistryByName } from "../registrar/game-registry";

const originalFetch = globalThis.fetch;

function respondWithRows(rows: Record<string, unknown>[]) {
  globalThis.fetch = mock(async () => Response.json(rows)) as typeof fetch;
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

  test("decodes felt names for idempotent create checks", async () => {
    process.env.TORII_URL = "https://torii.example";
    respondWithRows([
      { game_id: 6, name: shortString.encodeShortString("other") },
      { game_id: 7, name: shortString.encodeShortString("alpha") },
    ]);

    const row = await findGameRegistryByName("alpha");

    expect(row?.gameId).toBe(7);
  });
});
