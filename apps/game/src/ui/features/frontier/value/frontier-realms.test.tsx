import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/runtime/world/store", () => ({ requireActiveGame: () => ({ chainId: "0x52", gameId: 3 }) }));

import { FrontierRealms } from "./frontier-realms";
import { planRealmLabor } from "./realm-labor";

const HOME = { entity_id: 412 } as unknown as NativeRows["Structure"];
const realm = (realmId: number, claimedToday: boolean) => ({
  realmId,
  name: `Realm ${realmId}`,
  order: 1,
  claimedToday,
});

afterEach(() => vi.unstubAllGlobals());

it("claims every ready Realm in one request, leaving out the ones that gave their labor today", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const fetch = vi.fn<(input: string | URL, init?: RequestInit) => Promise<Response>>(async () => Response.json({}));
  vi.stubGlobal("fetch", fetch);
  const labor = {
    wallet: "0x4a1",
    plan: planRealmLabor({
      realms: [realm(1_088, true), realm(212, false), realm(3_301, false)],
      perRealm: 1_000,
      cap: 5,
      labor: { held: 0, limit: 18_000 },
    }),
    perRealm: 1_000,
    cap: 5,
    held: 0,
    secondsLeft: 3_600,
  };
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter>
        <FrontierRealms realm={HOME} labor={labor} onRealm={() => undefined} onClose={() => undefined} />
      </MemoryRouter>,
    ),
  );
  try {
    const claimAll = [...document.body.querySelectorAll("button")].find((each) => each.textContent === "Claim all")!;
    await act(async () => claimAll.click());
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(
      JSON.parse(String(fetch.mock.calls[0][1]?.body)).realms.map((each: { realmId: number }) => each.realmId),
    ).toEqual([212, 3_301]);
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
