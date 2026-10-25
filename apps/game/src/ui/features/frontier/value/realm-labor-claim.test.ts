import { afterEach, expect, it, vi } from "vitest";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
vi.mock("@/runtime/world/store", () => ({ requireActiveGame: () => ({ chainId: "0x52", gameId: 3 }) }));
import { claimRealmLabor } from "./use-realm-labor";
afterEach(() => vi.unstubAllGlobals());
const HOME = { game_id: 3, entity_id: 412n } as NativeRows["Structure"];
it("asks for the settled home's daily labor without an NFT inventory, account or clock", async () => {
  const fetch = vi.fn(async () => Response.json({ day: 20000, grant: { amount: "1000" } }));
  vi.stubGlobal("fetch", fetch);
  await claimRealmLabor(HOME);
  expect(fetch).toHaveBeenCalledExactlyOnceWith(
    "/api/value/labor?chainId=0x52",
    expect.objectContaining({
      method: "POST",
      credentials: "include",
      body: JSON.stringify({ gameId: 3, home: "412" }),
    }),
  );
});
it.each([409, 502])("reports a refused or unavailable claim (%s)", async (status) => {
  vi.stubGlobal("fetch", async () => new Response("refused", { status }));
  await expect(claimRealmLabor(HOME)).rejects.toThrow("The labor could not be claimed.");
});
