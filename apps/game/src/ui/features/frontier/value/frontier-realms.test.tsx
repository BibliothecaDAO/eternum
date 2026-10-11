import { type ExpeditionRules } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

/**
 * The game's facts: the account claimed labor yesterday with three Realms, none of them today. The relay finds one of
 * them, 4512, no longer in the linked wallet.
 */
const GRANTS = [1_088, 4_512, 6_077].map((realm_id) => ({ realm_id, day: 19_999n, account: "0xacc" }));
const session = vi.hoisted(() => ({ wallet: "0x4a1" }));
vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({
    setup: { store: { rows: () => GRANTS, get: () => ({ amount: 1_000n, account_daily_limit: 5 }) } },
  }),
}));
vi.mock("@/hooks/context/identity-session", () => ({
  useIdentitySession: () => ({ session: { user: { id: "u", address: session.wallet } } }),
}));
vi.mock("@/hooks/helpers/use-native-facts", () => ({ useNativeRevision: () => 0 }));
// Day 20,000 of the labor calendar, an hour in.
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useNowSeconds: () => 20_000 * 86_400 + 3_600 }));
vi.mock("@/runtime/world/store", () => ({ requireActiveGame: () => ({ chainId: "0x52", gameId: 3 }) }));
vi.mock("../realm-stores", () => ({ useRealmStores: () => ({ labor: { amount: 0, limit: 18_000 } }) }));
vi.mock("@bibliothecadao/eternum", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@bibliothecadao/eternum")>()),
  configManager: { getActiveGameId: () => 3 },
  getCanonicalRealmMetadata: async (realmId: number) => ({ name: `Realm ${realmId}`, order: 1 }),
}));

import { FrontierRealms } from "./frontier-realms";
import { useRealmLabor } from "./use-realm-labor";

const HOME = { entity_id: 412, owner: "0xacc" } as unknown as NativeRows["Structure"];
const Sheet = () => (
  <FrontierRealms
    labor={useRealmLabor({} as ExpeditionRules, HOME)}
    onRealm={() => undefined}
    onClose={() => undefined}
  />
);

/** Each claim the sheet sent, by the Realms it named. */
const claims: number[][] = [];
let unmount: (() => Promise<void>) | null = null;
afterEach(async () => {
  await unmount?.();
  claims.length = 0;
  session.wallet = "0x4a1";
  vi.unstubAllGlobals();
});

const openSheet = async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("fetch", async (_input: string | URL, init?: RequestInit) => {
    const asked = (JSON.parse(String(init?.body)).realms as { realmId: number }[]).map((each) => each.realmId);
    claims.push(asked);
    const held = asked.filter((realmId) => realmId !== 4_512);
    return Response.json(
      {
        day: 20_000,
        grants: held.map((realmId) => ({ realmId: String(realmId) })),
        refused: asked.filter((realmId) => realmId === 4_512).map((realmId) => ({ realmId: String(realmId) })),
      },
      { status: held.length ? 200 : 409 },
    );
  });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const show = () =>
    act(async () =>
      root.render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <MemoryRouter>
            <Sheet />
          </MemoryRouter>
        </QueryClientProvider>,
      ),
    );
  await show();
  // The Realms' names answer in their own turn.
  for (let turn = 0; turn < 5; turn++) await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  unmount = async () => {
    await act(async () => root.unmount());
    container.remove();
  };
  const press = async (word: string) => {
    const button = [...document.body.querySelectorAll("button")].find((each) => each.textContent === word)!;
    await act(async () => button.click());
    for (let turn = 0; turn < 3; turn++) await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  };
  const row = (realmId: number) =>
    [...document.body.querySelectorAll(".frontier-card")].find((card) => card.textContent?.includes(`Realm ${realmId}`))
      ?.textContent ?? "";
  return { press, row, show };
};

it("claims every ready Realm in one request", async () => {
  const sheet = await openSheet();
  await sheet.press("Claim all");
  expect(claims).toEqual([[1_088, 4_512, 6_077]]);
});

it("marks a Realm the relay refused as not in the wallet, and leaves it out of the next claim", async () => {
  const sheet = await openSheet();
  expect(sheet.row(4_512)).not.toContain("Not in this wallet");
  await sheet.press("Claim all");
  // The two Realms still held were granted in that one request; the third is named, and marked.
  expect(sheet.row(4_512)).toContain("Not in this wallet");
  expect(sheet.row(1_088)).not.toContain("Not in this wallet");

  // The game's grant facts have not arrived yet, so the held Realms are still ready: claiming again names them alone.
  await sheet.press("Claim all");
  expect(claims).toEqual([
    [1_088, 4_512, 6_077],
    [1_088, 6_077],
  ]);
});

it("forgets the mark when another wallet is linked: the Realm may be in that one", async () => {
  const sheet = await openSheet();
  await sheet.press("Claim all");
  expect(sheet.row(4_512)).toContain("Not in this wallet");
  session.wallet = "0xb0b";
  await sheet.show();
  expect(sheet.row(4_512)).not.toContain("Not in this wallet");
});
