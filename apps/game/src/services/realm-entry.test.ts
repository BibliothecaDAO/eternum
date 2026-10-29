import { afterEach, expect, it, vi } from "vitest";

import { readHeldRealms } from "./realm-entry";

afterEach(() => vi.unstubAllGlobals());

/** The relay's held-Realms answer, as the relay of that generation sends it. */
const relayAnswers = (body: unknown) => vi.stubGlobal("fetch", async () => Response.json(body));

it("reads each held Realm with its map from a relay that sends them, as today's relay does", async () => {
  relayAnswers({
    realms: [3, 251],
    held: [
      { realmId: 3, map: "https://index.test/3.svg" },
      { realmId: 251, map: null },
    ],
  });
  expect(await readHeldRealms()).toEqual([
    { realmId: 3, map: "https://index.test/3.svg" },
    { realmId: 251, map: null },
  ]);
});

it("reads a relay from before the maps (numbers only) as Realms without a map, so a client deployed first still works", async () => {
  relayAnswers({ realms: [3, 251] });
  expect(await readHeldRealms()).toEqual([
    { realmId: 3, map: null },
    { realmId: 251, map: null },
  ]);
});

it("asks again rather than reading an unavailable answer as no Realm", async () => {
  vi.stubGlobal("fetch", async () => Response.json({ error: "realm_holdings_unavailable" }, { status: 503 }));
  await expect(readHeldRealms()).rejects.toThrow("held_realms_unavailable");
});
