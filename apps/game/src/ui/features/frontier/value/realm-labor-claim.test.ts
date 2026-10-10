import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/runtime/world/store", () => ({ requireActiveGame: () => ({ chainId: "0x52", gameId: 3 }) }));

import type { NativeRows } from "@bibliothecadao/eternum/game-client";

import { claimRealmLabor } from "./use-realm-labor";

afterEach(() => vi.unstubAllGlobals());

const HOME = { entity_id: 412 } as unknown as NativeRows["Structure"];

it("asks the relay to grant one held Realm's labor to the player's realm in this game, on this shard", async () => {
  const fetch = vi.fn<(input: string | URL, init?: RequestInit) => Promise<Response>>(async () => Response.json({}));
  vi.stubGlobal("fetch", fetch);
  await claimRealmLabor(1_337, HOME);
  const [url, init] = fetch.mock.calls[0];
  expect(String(url)).toBe("/api/value/labor?chainId=0x52");
  expect(init?.method).toBe("POST");
  expect(init?.credentials).toBe("include");
  // The relay takes a Realm and nothing else: the account and the wallet are its own to read.
  expect(JSON.parse(String(init?.body))).toEqual({ realm: { gameId: 3, realmId: 1_337, home: "412" } });
});

it("says a refused grant", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ error: "labor_grant_refused" }, { status: 409 })),
  );
  await expect(claimRealmLabor(1_337, HOME)).rejects.toThrow("Labor answered 409");
});
