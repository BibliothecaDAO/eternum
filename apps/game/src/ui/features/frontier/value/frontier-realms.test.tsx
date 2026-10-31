// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { canonicalRealm, dayOf } from "@bibliothecadao/eternum";
import { shortString } from "starknet";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
const facts = vi.hoisted(() => ({
  held: true,
  campaign: undefined as { campaign_id: bigint; tier: number } | undefined,
  claimedDay: -1n,
  /** Past days claimed, by index, for the strip. */
  claimedDays: [] as bigint[],
  now: 360,
  balance: 0 as number | undefined,
  /** A golden home's daily Essence, the preset's; another value shows amounts that differ from its Labor. */
  goldenEssence: 2000n,
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
              ? { amount: 1000n, campaign_essence: 1000n, golden_amount: 2000n, golden_essence: facts.goldenEssence }
              : model === "CampaignHome"
                ? facts.campaign
                : model === "SettledRealm"
                  ? facts.held
                    ? { home: 412n }
                    : undefined
                  : key.day === facts.claimedDay || (key.day !== undefined && facts.claimedDays.includes(key.day))
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
/** The account's held-Realms answer: Realm 711 with its map from the Realm index. */
vi.mock("@/hooks/use-holdings", () => ({
  useHeldRealms: () => ({ held: { data: [{ realmId: 711, map: "https://index.test/711.svg" }] } }),
}));
import { snapshotClientActionLatency } from "@/observability/client-action-latency";
import { FrontierRealms } from "./frontier-realms";
import { RealmsChip } from "./lords-purse";
import { dailyClaimWaiting } from "./realm-labor";
import { useRealmLabor } from "./use-realm-labor";
const home = {
  game_id: 3,
  entity_id: 412n,
  owner: 0xaccn,
  base: { created_at: 360 },
  metadata: { realm_id: 711 },
} as unknown as NativeRows["Structure"];
const rules = { seed: 711n, dayUnitSeconds: 7200, startMainAt: 360, spacing: 50 };
const Sheet = () => <FrontierRealms labor={useRealmLabor(rules, home)} onClose={() => {}} />;
/** What a player reads on the sheet's strip: each day's number, today starred, and its state. */
const strip = (host: HTMLElement) =>
  [...host.querySelectorAll(".realm-labor__days li")].map(
    (day) =>
      `${day.textContent}${day.getAttribute("aria-current") === "date" ? "*" : ""}:${day.getAttribute("data-state")}`,
  );
const todayState = (host: HTMLElement) => host.querySelector('[aria-current="date"]')?.getAttribute("data-state");
/** The banner's daily amounts, each with its icon. */
const amounts = (host: HTMLElement) =>
  [...host.querySelectorAll(".realm-labor__amount")].map(
    (amount) => `${amount.querySelector("[data-icon]")?.getAttribute("data-icon")} ${amount.textContent}`,
  );
/** The day a timestamp falls in, from its index: its first second. */
const startOfDay = (index: number) => {
  let at = rules.startMainAt;
  while (dayOf(rules, at)!.index < index) at = dayOf(rules, at)!.end;
  return at;
};
afterEach(() => {
  facts.held = true;
  facts.campaign = undefined;
  facts.claimedDay = -1n;
  facts.claimedDays = [];
  facts.balance = 0;
  facts.goldenEssence = 2000n;
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
    expect(todayState(host)).toBe("open");
    // A held Realm's home: its name and number from the Realm index's canon, its map from the held-Realms answer.
    expect(host.querySelector(".realm-labor__name")?.textContent).toBe(`${canonicalRealm(711).name}Realm 711`);
    expect(host.querySelector(".home-art__map")?.getAttribute("src")).toBe("https://index.test/711.svg");
    expect(amounts(host)).toEqual(["labor 1,000"]);
    facts.claimedDay = 0n;
    await show();
    expect(todayState(host)).toBe("claimed");
    expect(host.textContent).toContain("Day 2 opens in");
    const firstDay = dayOf(rules, facts.now)!;
    facts.now = firstDay.end - 1;
    await show();
    expect(todayState(host)).toBe("claimed");
    facts.now = firstDay.end;
    await show();
    expect(strip(host).slice(0, 2)).toEqual(["1:claimed", "2*:open"]);
    expect(host.textContent).not.toContain("opens in");
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
    expect(host.querySelector(".realm-labor__days")).toBeNull();
    expect([...host.querySelectorAll("button")].some((button) => button.textContent?.startsWith("Claim "))).toBe(false);
  } finally {
    await act(async () => root.unmount());
  }
});

const DEVCON_ID = BigInt(shortString.encodeShortString("devcon-2026"));
it("shows each campaign tier's pavilion, its daily Labor and Essence, and claims them in one press", async () => {
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
    expect(host.querySelector(".realm-labor__name")?.textContent).toBe("Golden Devcon");
    expect(host.querySelector('.home-art[data-tier="golden"] img[src$="/devcon-golden-realm.webp"]')).not.toBeNull();
    expect(amounts(host)).toEqual(["labor 2,000", "essence 2,000"]);
    expect(host.querySelector(".realm-labor__amounts")?.textContent).toContain("each day");
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
    expect(host.querySelector(".realm-labor__name")?.textContent).toBe("Devcon");
    expect(host.querySelector('.home-art[data-tier="regular"] img[src$="/devcon-realm.webp"]')).not.toBeNull();
    expect(amounts(host)).toEqual(["labor 1,000", "essence 1,000"]);
    expect(buttons()).toContain("Claim 1,000 Labor · 1,000 Essence");
  } finally {
    await act(async () => root.unmount());
  }
});

it("at full Labor storage, says what fits and lets both campaign tiers claim their Essence: the one button", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const requests: unknown[] = [];
  vi.stubGlobal("fetch", async (_url: unknown, init: RequestInit) => {
    requests.push(JSON.parse(String(init.body)));
    return Response.json({ grant: { amount: "0", essence: "1000000000000", transactionHash: "0xabc" } });
  });
  const host = document.createElement("div");
  const root = createRoot(host);
  const show = () => act(async () => root.render(<Sheet />));
  // The sheet's own buttons: its close aside.
  const sheetButtons = () =>
    [...host.querySelectorAll("button")].map((button) => button.textContent).filter((label) => label !== "");
  try {
    facts.balance = 1400 + 15_000;
    facts.held = true;
    await show();
    // Room for the whole claim: nothing to say. Room for part of it: what fits, plainly, and the claim of that.
    expect(host.textContent).not.toContain("storage full");
    facts.balance = 17_400;
    await show();
    expect(host.textContent).toContain("600 of 1,000 Labor fit · storage full");
    expect(sheetButtons()).toEqual(["Claim 600 Labor"]);
    facts.held = false;
    facts.balance = 18000;
    facts.campaign = { campaign_id: DEVCON_ID, tier: 2 };
    await show();
    expect(host.textContent).toContain("0 of 2,000 Labor fit · storage full");
    expect(sheetButtons()).toEqual(["Claim 2,000 Essence"]);
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
    expect(todayState(host)).toBe("claimed");
    expect(host.textContent).not.toContain("storage full");
    expect(sheetButtons()).toEqual([]);

    facts.claimedDay = -1n;
    facts.campaign = { campaign_id: DEVCON_ID, tier: 1 };
    await show();
    expect(host.textContent).toContain("0 of 1,000 Labor fit · storage full");
    expect(sheetButtons()).toEqual(["Claim 1,000 Essence"]);
    await act(async () =>
      [...host.querySelectorAll("button")].find((b) => b.textContent === "Claim 1,000 Essence")!.click(),
    );
    expect(requests).toEqual([
      { gameId: 3, home: "412" },
      { gameId: 3, home: "412" },
    ]);
  } finally {
    await act(async () => root.unmount());
  }
});

/** The Realms chip as the HUD wires it: the home's plan, its one reading of what waits, the chip. */
const Chip = ({ narrow }: { narrow?: boolean }) => (
  <RealmsChip waiting={dailyClaimWaiting(useRealmLabor(rules, home)?.plan)} narrow={narrow} onOpen={() => {}} />
);

it.each([
  {
    home: "a golden Devcon home",
    campaign: { campaign_id: DEVCON_ID, tier: 2 },
    balance: 0,
    name: "Realm Labor +2,000 Labor +2,000 Essence",
    shows: "+2K",
    icons: ["labor", "essence"],
  },
  {
    home: "a golden home whose Essence differs from its Labor",
    campaign: { campaign_id: DEVCON_ID, tier: 2 },
    balance: 0,
    goldenEssence: 3000n,
    name: "Realm Labor +2,000 Labor +3,000 Essence",
    shows: "+2K+3K",
    icons: ["labor", "essence"],
  },
  {
    home: "a regular Devcon home",
    campaign: { campaign_id: DEVCON_ID, tier: 1 },
    balance: 0,
    name: "Realm Labor +1,000 Labor +1,000 Essence",
    shows: "+1K",
    icons: ["labor", "essence"],
  },
  {
    home: "a golden Devcon home whose Labor store is full",
    campaign: { campaign_id: DEVCON_ID, tier: 2 },
    balance: 18000,
    name: "Realm Labor +2,000 Labor +2,000 Essence",
    shows: "+2K",
    icons: ["labor", "essence"],
  },
  {
    home: "a home founded with a held Realm",
    campaign: undefined,
    balance: 0,
    name: "Realm Labor +1,000 Labor",
    shows: "+1K",
    icons: ["labor"],
  },
])("shows on the desktop's Realms chip what $home claims today", async (row) => {
  const { campaign, balance, goldenEssence = 2000n, name, shows, icons } = row;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  facts.held = campaign === undefined;
  facts.campaign = campaign;
  facts.balance = balance;
  facts.goldenEssence = goldenEssence;
  const host = document.createElement("div");
  const root = createRoot(host);
  try {
    await act(async () => root.render(<Chip />));
    const chip = host.querySelector("button")!;
    expect(chip.getAttribute("aria-label")).toBe(name);
    expect(chip.textContent).toBe(shows);
    expect([...chip.querySelectorAll("[data-icon]")].map((icon) => icon.getAttribute("data-icon"))).toEqual(icons);
  } finally {
    await act(async () => root.unmount());
  }
});

it("on a phone's purse row, keeps each amount with its own icon", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  facts.held = false;
  facts.campaign = { campaign_id: DEVCON_ID, tier: 2 };
  const host = document.createElement("div");
  const root = createRoot(host);
  try {
    await act(async () => root.render(<Chip narrow />));
    const chip = host.querySelector("button")!;
    expect(chip.getAttribute("aria-label")).toBe("Realm Labor +2,000 Labor +2,000 Essence");
    // Each amount keeps its own icon there: +2K Labor, +2K Essence.
    expect(chip.textContent).toBe("+2K+2K");
    expect([...chip.querySelectorAll("[data-icon]")].map((icon) => icon.getAttribute("data-icon"))).toEqual([
      "labor",
      "essence",
    ]);
  } finally {
    await act(async () => root.unmount());
  }
});

it("has nothing waiting once today is claimed: the chip names Realm Labor alone", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  facts.held = false;
  facts.campaign = { campaign_id: DEVCON_ID, tier: 2 };
  facts.claimedDay = 0n;
  const host = document.createElement("div");
  const root = createRoot(host);
  try {
    await act(async () => root.render(<Chip />));
    const chip = host.querySelector("button")!;
    expect(chip.getAttribute("aria-label")).toBe("Realm Labor");
    expect(chip.textContent).toBe("");
    // Nothing waits: the realm's icon alone says what the chip opens.
    expect([...chip.querySelectorAll("[data-icon]")].map((icon) => icon.getAttribute("data-icon"))).toEqual(["realm"]);
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
    expect(host.querySelector('[role="timer"]')?.textContent).toMatch(/^Day 2 opens in \d/);
    await act(async () => button("Remind me")!.click());
    expect(alerts.toggle).toHaveBeenCalledTimes(1);
    expect(alerts.save).toHaveBeenCalledWith("important");

    // On already, at All: nothing to ask, the reminder on. On, but the account's level Off: one tap lifts the level only.
    alerts.device = "on";
    alerts.level = "all";
    await show();
    expect(button("Remind me")).toBeUndefined();
    expect(host.querySelector('[role="timer"]')?.textContent).toContain("Reminder on");
    alerts.level = "off";
    await show();
    await act(async () => button("Remind me")!.click());
    expect(alerts.toggle).toHaveBeenCalledTimes(1);
    expect(alerts.save).toHaveBeenCalledTimes(2);

    // An iPhone's browser installs first; a device that blocks alerts is not asked.
    alerts.device = "install";
    await show();
    await act(async () => button("Add to Home Screen")!.click());
    expect(alerts.install).toHaveBeenCalledTimes(1);
    alerts.device = "blocked";
    await show();
    expect(button("Remind me")).toBeUndefined();
    expect(host.textContent).not.toContain("Reminder on");

    // The season's last day has no next day to remind of.
    alerts.device = "off";
    facts.seasonEnd = BigInt(dayOf(rules, facts.now)!.end);
    await show();
    expect(host.querySelector('[role="timer"]')?.textContent).toMatch(/^Season ends in \d/);
    expect(button("Remind me")).toBeUndefined();
  } finally {
    act(() => root.unmount());
  }
});

it("shows the days around today: each claimed ticked, a missed one struck, none missed before the home was founded", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  const root = createRoot(host);
  const show = () => act(async () => root.render(<Sheet />));
  try {
    facts.now = startOfDay(11);
    facts.claimedDays = [6n, 7n, 9n];
    await show();
    expect(strip(host)).toEqual([
      "7:claimed",
      "8:claimed",
      "9:missed",
      "10:claimed",
      "11:missed",
      "12*:open",
      "13:ahead",
    ]);
    expect(host.querySelectorAll('.realm-labor__days [data-icon="check"]')).toHaveLength(3);
    expect(host.querySelector('[aria-current="date"]')?.getAttribute("aria-label")).toBe("Day 12 to claim");

    // A home founded on day 10: the days before it were never its to claim.
    (home.base as { created_at: number }).created_at = startOfDay(9);
    await show();
    expect(strip(host)).toEqual([
      "7:before",
      "8:before",
      "9:before",
      "10:claimed",
      "11:missed",
      "12*:open",
      "13:ahead",
    ]);
  } finally {
    (home.base as { created_at: number }).created_at = 360;
    await act(async () => root.unmount());
  }
});
