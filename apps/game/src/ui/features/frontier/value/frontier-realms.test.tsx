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
  /** The season ends long after day 1, so a next day follows. */
  seasonEnd: 1_000_000n,
}));
/** This device and the account's level, as Settings would read them; signed out (owner null) asks nothing. */
const alerts = vi.hoisted(() => ({
  owner: null as string | null,
  device: "off" as "on" | "off" | "install" | "blocked",
  level: "off" as "off" | "important" | "all",
  toggle: vi.fn(async () => {}),
  save: vi.fn(async () => {}),
  install: vi.fn(async () => {}),
}));
vi.mock("@/hooks/context/identity-session", () => ({
  useIdentitySession: () => ({ session: null }),
  notificationOwnerOf: () => alerts.owner,
}));
vi.mock("@/hooks/use-notification-preferences", () => ({
  useNotificationPreferences: () => ({
    status: "ready",
    saved: { level: alerts.level, revision: 1, owner: alerts.owner },
    save: alerts.save,
  }),
}));
vi.mock("@/shell/profile/this-device", () => ({
  useThisDevice: () => ({ state: alerts.device, toggle: alerts.toggle, failed: false }),
}));
vi.mock("@/pwa/install-state", () => ({ useInstall: () => ({ installed: false, install: alerts.install }) }));
vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({
    setup: {
      store: {
        get: (model: string, key: { day?: bigint }) => {
          facts.read(model, key);
          return model === "GameRegistry"
            ? { end_at: facts.seasonEnd }
            : model === "LaborRules"
              ? { amount: 1000n, campaign_essence: 1000n, golden_amount: 2000n, golden_essence: 2000n }
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
import { snapshotClientActionLatency } from "@/observability/client-action-latency";
import { FrontierRealms } from "./frontier-realms";
import { useRealmLabor } from "./use-realm-labor";
const home = { game_id: 3, entity_id: 412n, owner: 0xaccn, metadata: { realm_id: 711 } } as NativeRows["Structure"];
const rules = { seed: 711n, dayUnitSeconds: 7200, startMainAt: 360, spacing: 50 };
const Sheet = () => <FrontierRealms labor={useRealmLabor(rules, home)} onRealm={() => {}} onClose={() => {}} />;
afterEach(() => {
  facts.held = true;
  facts.campaign = undefined;
  facts.claimedDay = -1n;
  facts.balance = 0;
  facts.now = 360;
  facts.read.mockClear();
  facts.seasonEnd = 1_000_000n;
  alerts.owner = null;
  alerts.device = "off";
  alerts.level = "off";
  alerts.toggle.mockClear();
  alerts.save.mockClear();
  alerts.install.mockClear();
  vi.unstubAllGlobals();
});
it("claims its settled home once and takes the result from the next native facts", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const requests: unknown[] = [];
  vi.stubGlobal("fetch", async (_url: unknown, init: RequestInit) => {
    requests.push(JSON.parse(String(init.body)));
    return Response.json({ grant: { amount: "1000000000000", transactionHash: "0xabc" } });
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
    expect(snapshotClientActionLatency().at(-1)).toMatchObject({
      transactionHash: "0xabc",
      send: { stages: [{ stage: "command" }, { stage: "included", detail: "relay" }] },
    });
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
    expect(facts.read).toHaveBeenCalledWith("LaborGrant", { game_id: 3, home: 412n, day: 1n });
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
it("shows each campaign tier's daily Labor and Essence and wears its campaign mark", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const requests: unknown[] = [];
  vi.stubGlobal("fetch", async (_url: unknown, init: RequestInit) => {
    requests.push(JSON.parse(String(init.body)));
    return Response.json({ grant: { amount: "1000000000000", transactionHash: "0xabc" } });
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
    expect(host.querySelector('img[src$="/devcon-golden-realm.webp"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="Labor per game day +2K"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="Essence per game day +2K"]')).not.toBeNull();
    expect(buttons()).toContain("Claim 2,000 Labor · 2,000 Essence");
    await act(async () =>
      [...host.querySelectorAll("button")].find((b) => b.textContent?.startsWith("Claim"))!.click(),
    );
    expect(requests).toEqual([{ gameId: 3, home: "412" }]);
    expect(snapshotClientActionLatency().at(-1)).toMatchObject({
      transactionHash: "0xabc",
      send: { stages: [{ stage: "command" }, { stage: "included", detail: "relay" }] },
    });

    facts.campaign = { campaign_id: DEVCON_ID, tier: 1 };
    await show();
    expect(host.textContent).toContain("Devcon");
    expect(host.querySelector('img[src$="/devcon-realm.webp"]')).not.toBeNull();
    expect(host.textContent).not.toMatch(/Golden/);
    expect(host.querySelector('[aria-label="Labor per game day +1K"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="Essence per game day +1K"]')).not.toBeNull();
    expect(buttons()).toContain("Claim 1,000 Labor · 1,000 Essence");
  } finally {
    await act(async () => root.unmount());
  }
});

it("lets both campaign tiers claim their Essence at full Labor storage", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const requests: unknown[] = [];
  vi.stubGlobal("fetch", async (_url: unknown, init: RequestInit) => {
    requests.push(JSON.parse(String(init.body)));
    return Response.json({ grant: { amount: "0", essence: "1000000000000", transactionHash: "0xabc" } });
  });
  const host = document.createElement("div");
  const root = createRoot(host);
  const show = () => act(async () => root.render(<Sheet />));
  const buttons = () => [...host.querySelectorAll("button")].map((button) => button.textContent);
  try {
    facts.held = false;
    facts.balance = 18000;
    facts.campaign = { campaign_id: DEVCON_ID, tier: 2 };
    await show();
    expect(host.textContent).toContain("0 of 2,000 fit · remainder lost");
    expect(buttons()).toEqual(expect.arrayContaining(["Claim 2,000 Essence", "Realm"]));
    await act(async () =>
      [...host.querySelectorAll("button")].find((b) => b.textContent === "Claim 2,000 Essence")!.click(),
    );
    expect(requests).toEqual([{ gameId: 3, home: "412" }]);
    expect(snapshotClientActionLatency().at(-1)).toMatchObject({
      transactionHash: "0xabc",
      send: { stages: [{ stage: "command" }, { stage: "included", detail: "relay" }] },
    });
    // The receipt arrives in the native facts: today is claimed.
    facts.claimedDay = 0n;
    await show();
    expect(host.textContent).toContain("Claimed today");
    expect(buttons().some((label) => label?.startsWith("Claim"))).toBe(false);

    facts.claimedDay = -1n;
    facts.campaign = { campaign_id: DEVCON_ID, tier: 1 };
    await show();
    expect(host.textContent).toContain("0 of 1,000 fit · remainder lost");
    expect(buttons()).toContain("Claim 1,000 Essence");
    await act(async () =>
      [...host.querySelectorAll("button")].find((b) => b.textContent === "Claim 1,000 Essence")!.click(),
    );
    expect(requests).toEqual([
      { gameId: 3, home: "412" },
      { gameId: 3, home: "412" },
    ]);
    expect(buttons()).toContain("Realm");
  } finally {
    await act(async () => root.unmount());
  }
});

it("once claimed, asks for a push when the next day opens, and one tap turns this device and the account's level on", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  const root = createRoot(host);
  const show = () => act(async () => root.render(<Sheet />));
  const button = (word: string) => [...host.querySelectorAll("button")].find((each) => each.textContent === word);
  try {
    alerts.owner = "0xowner";
    facts.claimedDay = 0n;
    await show();
    await act(async () => button("Remind me when Day 2 opens")!.click());
    expect(alerts.toggle).toHaveBeenCalledTimes(1);
    expect(alerts.save).toHaveBeenCalledWith("important");

    // On already, at All: nothing to ask. On, but the account's level Off: one tap lifts the level only.
    alerts.device = "on";
    alerts.level = "all";
    await show();
    expect(button("Remind me when Day 2 opens")).toBeUndefined();
    alerts.level = "off";
    await show();
    await act(async () => button("Remind me when Day 2 opens")!.click());
    expect(alerts.toggle).toHaveBeenCalledTimes(1);
    expect(alerts.save).toHaveBeenCalledTimes(2);

    // An iPhone's browser installs first; a device that blocks alerts is not asked.
    alerts.device = "install";
    await show();
    await act(async () => button("Add to Home Screen for reminders")!.click());
    expect(alerts.install).toHaveBeenCalledTimes(1);
    alerts.device = "blocked";
    await show();
    expect(button("Remind me when Day 2 opens")).toBeUndefined();

    // The season's last day has no next day to remind of.
    alerts.device = "off";
    facts.seasonEnd = BigInt(dayOf(rules, facts.now)!.end);
    await show();
    expect(host.textContent).toContain("Claimed today");
    expect(button("Remind me when Day 2 opens")).toBeUndefined();
  } finally {
    act(() => root.unmount());
  }
});
