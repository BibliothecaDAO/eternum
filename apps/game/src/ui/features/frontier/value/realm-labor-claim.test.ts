import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/runtime/world/store", () => ({ requireActiveGame: () => ({ chainId: "0x52", gameId: 3 }) }));

import type { NativeRows } from "@bibliothecadao/eternum/game-client";

import { claimRealmLabor } from "./use-realm-labor";

afterEach(() => vi.unstubAllGlobals());

const HOME = { entity_id: 412 } as unknown as NativeRows["Structure"];

it("asks the relay, in one request, to grant every named Realm's labor to the player's realm in this game", async () => {
  const fetch = vi.fn<(input: string | URL, init?: RequestInit) => Promise<Response>>(async () =>
    Response.json({ day: 20_000, grants: [{ realmId: "1337" }, { realmId: "5990" }], refused: [{ realmId: "212" }] }),
  );
  vi.stubGlobal("fetch", fetch);
  // The relay grants the Realms the wallet still holds and names the one it does not.
  expect(await claimRealmLabor([1_337, 212, 5_990], HOME)).toEqual({ granted: [1_337, 5_990], refused: [212] });
  expect(fetch).toHaveBeenCalledTimes(1);
  const [url, init] = fetch.mock.calls[0];
  expect(String(url)).toBe("/api/value/labor?chainId=0x52");
  expect(init?.method).toBe("POST");
  expect(init?.credentials).toBe("include");
  // The relay takes the Realms and nothing else: the account and the wallet are its own to read.
  expect(JSON.parse(String(init?.body))).toEqual({
    realms: [
      { gameId: 3, realmId: 1_337, home: "412" },
      { gameId: 3, realmId: 212, home: "412" },
      { gameId: 3, realmId: 5_990, home: "412" },
    ],
  });
});

it("reads the refused Realms when the wallet holds none of them, though the relay refuses the whole request", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json(
        {
          day: 20_000,
          grants: [],
          refused: [{ realmId: "1337", reason: "realm_not_owned" }],
          error: "realm_not_owned",
        },
        { status: 409 },
      ),
    ),
  );
  expect(await claimRealmLabor([1_337], HOME)).toEqual({ granted: [], refused: [1_337] });
});

it("says a failure that judged no Realm: one is never called sold because the relay could not answer", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ error: "labor_grant_refused" }, { status: 409 })),
  );
  await expect(claimRealmLabor([1_337], HOME)).rejects.toThrow("Labor answered 409");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("bad gateway", { status: 502 })),
  );
  await expect(claimRealmLabor([1_337], HOME)).rejects.toThrow("Labor answered 502");
});
