// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { dayOf } from "@bibliothecadao/eternum";
import { shortString } from "starknet";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
const facts = vi.hoisted(() => ({
  held: true,
  campaign: undefined as { campaign_id: bigint; tier: number } | undefined,
  claimedDay: -1n,
  now: 360,
  balance: 0 as number | undefined,
  read: vi.fn(),
}));
vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({
    setup: {
      store: {
        get: (model: string, key: { day?: bigint }) => {
          facts.read(model, key);
          return model === "LaborRules"
            ? { amount: 1000n, golden_essence: 1000n }
            : model === "CampaignHome"
              ? facts.campaign
              : model === "SettledRealm"
                ? facts.held
                  ? { home: 412n }
                  : undefined
                : key.day === facts.claimedDay
                  ? { amount: 1000n }
                  : undefined;
        },
      },
    },
  }),
}));
vi.mock("@/hooks/helpers/use-native-facts", () => ({ useNativeRevision: () => 0 }));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useNowSeconds: () => facts.now }));
vi.mock("@/runtime/world/store", () => ({ requireActiveGame: () => ({ chainId: "0x52", gameId: 3 }) }));
vi.mock("../realm-stores", () => ({ useRealmStores: () => ({ labor: { amount: facts.balance, limit: 18000 } }) }));
import { FrontierRealms } from "./frontier-realms";
import { useRealmLabor } from "./use-realm-labor";
const home = { game_id: 3, entity_id: 412n, owner: 0xaccn, metadata: { realm_id: 711 } } as NativeRows["Structure"];
const rules = { seed: 711n, dayUnitSeconds: 4800, startMainAt: 360, spacing: 50 };
const Sheet = () => <FrontierRealms labor={useRealmLabor(rules, home)} onRealm={() => {}} onClose={() => {}} />;
afterEach(() => {
  facts.held = true;
  facts.campaign = undefined;
  facts.claimedDay = -1n;
  facts.balance = 0;
  facts.now = 360;
  facts.read.mockClear();
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
    facts.claimedDay = 0n;
    await show();
    expect(host.textContent).toContain("Claimed today");
    const firstDay = dayOf(rules, facts.now)!;
    facts.now = firstDay.end - 1;
    await show();
    expect(host.textContent).toContain("Claimed today");
    facts.now = firstDay.end;
    await show();
    expect(host.textContent).not.toContain("Claimed today");
    expect(host.textContent).toContain("Claim 1,000 Labor");
    expect(facts.read).toHaveBeenLastCalledWith("LaborGrant", { game_id: 3, home: 412n, day: 1n });
    await act(async () =>
      [...host.querySelectorAll("button")].find((b) => b.textContent === "Claim 1,000 Labor")!.click(),
    );
    expect(requests).toEqual([
      { gameId: 3, home: "412" },
      { gameId: 3, home: "412" },
    ]);
    facts.held = false;
    await show();
    expect(host.textContent).toContain("No daily Labor claim");
    expect(host.querySelector("input")).toBeNull();
    expect([...host.querySelectorAll("button")].some((button) => button.textContent?.startsWith("Claim "))).toBe(false);
  } finally {
    await act(async () => root.unmount());
  }
});

const DEVCON_ID = BigInt(shortString.encodeShortString("devcon-2026"));
it("gives a campaign home its daily claim, with a golden ticket's Essence, and wears the campaign's mark", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const requests: unknown[] = [];
  vi.stubGlobal("fetch", async (_url: unknown, init: RequestInit) => {
    requests.push(JSON.parse(String(init.body)));
    return Response.json({ grant: { amount: "1000000000000" } });
  });
  const host = document.createElement("div");
  const root = createRoot(host);
  const show = () => act(async () => root.render(<Sheet />));
  const buttons = () => [...host.querySelectorAll("button")].map((button) => button.textContent);
  try {
    facts.held = false;
    facts.campaign = { campaign_id: DEVCON_ID, tier: 2 };
    await show();
    expect(host.textContent).toContain("Golden Devcon");
    expect(host.textContent).toContain("1,000 Labor per game day");
    expect(host.textContent).toContain("1,000 Essence per game day");
    expect(buttons()).toContain("Claim 1,000 Labor · 1,000 Essence");
    await act(async () =>
      [...host.querySelectorAll("button")].find((b) => b.textContent?.startsWith("Claim"))!.click(),
    );
    expect(requests).toEqual([{ gameId: 3, home: "412" }]);

    facts.campaign = { campaign_id: DEVCON_ID, tier: 1 };
    await show();
    expect(host.textContent).toContain("Devcon");
    expect(host.textContent).not.toMatch(/Golden|Essence/);
    expect(buttons()).toContain("Claim 1,000 Labor");
  } finally {
    await act(async () => root.unmount());
  }
});
