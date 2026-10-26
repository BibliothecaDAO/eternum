// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import type { ExpeditionRules } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
const facts = vi.hoisted(() => ({ held: true, claimed: false, balance: 0 as number | undefined }));
vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({
    setup: {
      store: {
        get: (model: string) =>
          model === "LaborRules"
            ? { amount: 1000n }
            : model === "SettledRealm"
              ? facts.held
                ? { home: 412n }
                : undefined
              : facts.claimed
                ? { amount: 1000n }
                : undefined,
      },
    },
  }),
}));
vi.mock("@/hooks/helpers/use-native-facts", () => ({ useNativeRevision: () => 0 }));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useNowSeconds: () => 20_000 * 86400 + 3600 }));
vi.mock("@/runtime/world/store", () => ({ requireActiveGame: () => ({ chainId: "0x52", gameId: 3 }) }));
vi.mock("../realm-stores", () => ({ useRealmStores: () => ({ labor: { amount: facts.balance, limit: 18000 } }) }));
import { FrontierRealms } from "./frontier-realms";
import { useRealmLabor } from "./use-realm-labor";
const home = { game_id: 3, entity_id: 412n, owner: 0xaccn, metadata: { realm_id: 711 } } as NativeRows["Structure"];
const Sheet = () => (
  <FrontierRealms labor={useRealmLabor({} as ExpeditionRules, home)} onRealm={() => {}} onClose={() => {}} />
);
afterEach(() => {
  facts.held = true;
  facts.claimed = false;
  facts.balance = 0;
  vi.unstubAllGlobals();
});
it("claims its settled home once and takes the result from the next native facts", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const requests: unknown[] = [];
  vi.stubGlobal("fetch", async (_url: unknown, init: RequestInit) => {
    requests.push(JSON.parse(String(init.body)));
    return Response.json({ grant: { amount: "1000000000000" } });
  });
  const host = document.createElement("div");
  const root = createRoot(host);
  const show = () => act(async () => root.render(<Sheet />));
  try {
    facts.balance = undefined;
    await show();
    expect(host.textContent).toBe("");
    facts.balance = 0;
    await show();
    const claim = [...host.querySelectorAll("button")].find((button) => button.textContent === "Claim 1,000 Labor")!;
    await act(async () => claim.click());
    expect(requests).toEqual([{ gameId: 3, home: "412" }]);
    expect(host.textContent).not.toContain("Claimed today");
    facts.claimed = true;
    await show();
    expect(host.textContent).toContain("Claimed today");
    facts.claimed = false;
    facts.held = false;
    await show();
    expect(host.textContent).toContain("no daily Labor claim");
    expect(host.querySelector("input")).toBeNull();
    expect([...host.querySelectorAll("button")].some((button) => button.textContent?.startsWith("Claim "))).toBe(false);
  } finally {
    await act(async () => root.unmount());
  }
});
