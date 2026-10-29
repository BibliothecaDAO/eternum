// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

import { canonicalRealm, getBlockTimestamp, homeDailyClaim } from "@bibliothecadao/eternum";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { IdentityRequestError } from "@realms-world/identity";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";

const settlement = vi.hoisted(() => ({
  settled: false,
  /** The game's preset: Frontier's (5), or the Devcon season's (6), whose homes a Devcon ticket founds. */
  presetId: 5,
  heldRealmId: null as number | null,
  calls: [] as unknown[],
  order: [] as string[],
}));

const GAME = { chainId: "0x5245414c4d53", gameId: 8 };
const HELD_REALMS = "/api/value/held-realms";

vi.mock("@/hooks/context/identity-session", async (original) => {
  const identity = await original<typeof import("@/hooks/context/identity-session")>();
  return { ...identity, useIdentitySession: () => identity.useIdentitySessionStore() };
});
vi.mock("@/hooks/use-game-entry", () => ({
  useGameEntry: () => {
    const now = Math.floor(Date.now() / 1000);
    const entry = {
      game_id: GAME.gameId,
      name: "frontier-staging",
      mode: "frontier",
      dev_mode_on: false,
      preset_id: settlement.presetId,
      player_state: { structures: [{ entity_id: 7, category: 1, realm_id: 3098, level: 2 }] },
      clock: { start_settling_at: now - 60, start_main_at: now - 60, end_at: now + 3_600 },
    };
    return { data: entry, error: null };
  },
}));
vi.mock("@/runtime/world/herald-pre-session-reader", () => ({
  fetchSettlementSnapshot: async () => ({
    heldRealmId: settlement.heldRealmId,
    hasSettlementRecord: settlement.settled,
    hasSettledStructure: settlement.settled,
    settledCount: settlement.settled ? 1 : 0,
  }),
}));

vi.mock("@/services/settlement", () => ({
  submitSettlement: async (_context: unknown, submit: (client: unknown) => Promise<unknown>) => {
    const result = await submit({
      setup: {
        systemCalls: {
          settle_season: async (props: unknown) => {
            settlement.order.push("settle");
            settlement.calls.push(props);
            settlement.settled = true;
            return { transaction_hash: "0xabc" };
          },
        },
      },
    });
    return result;
  },
}));
vi.mock("./selected-world-entity-wait", () => ({
  isSelectedWorldEntityWaitAborted: () => false,
  waitForSelectedWorldEntityState: async (input: { read: () => Promise<unknown> }) => input.read(),
}));
import { useAccountStore } from "@/hooks/store/use-account-store";
import { identityClient, useIdentitySessionStore } from "@/hooks/context/identity-session";
import { campaignHomeFacts } from "@/lab/game/campaign-scenario";
import { setViewportWidth } from "@/shell/frame/test-viewport";
import { GameEntryModal } from "./game-entry-modal";
import type { Session } from "@realms-world/identity";

/** A signed-in Realms account whose linked wallet is `address` (null: none linked). */
const signedIn = (realmsId: string, address: string | null): Session => ({
  session: { id: `session-${realmsId}`, expiresAt: "2099-01-01T00:00:00Z", userId: realmsId },
  user: { id: realmsId, realmsId, address, name: realmsId, email: `${realmsId}@test` },
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  settlement.settled = false;
  settlement.presetId = 5;
  settlement.heldRealmId = null;
  settlement.calls = [];
  settlement.order = [];
  useAccountStore.setState({ account: null });
  useIdentitySessionStore.setState({ status: "loading", session: null });
});

/** The account holds no campaign ticket: identity answers a ticket read with no code so. */
const noTicket = () =>
  vi
    .spyOn(identityClient, "redeemCampaignTicket")
    .mockRejectedValue(new IdentityRequestError(400, "invalid_redemption"));

/** The entry modal on its game, with Settings beside it for the wallet link's detour. */
const openEntry = async () => {
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <QueryClientProvider client={query}>
        <MemoryRouter initialEntries={["/play/frontier"]}>
          <Routes>
            <Route path="/profile/settings" element={<p>Settings page</p>} />
            <Route path="*" element={<GameEntryModal isOpen game={GAME} />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  /** The home the step stands on: the large card's name. */
  const featured = () => host.querySelector(".home-picker__featured h3")?.textContent ?? null;
  /** The strip's choices by name, the picked one marked with a star. */
  const strip = () =>
    [...host.querySelectorAll(".home-picker__strip .home-picker__choice")].map(
      (choice) => `${choice.getAttribute("aria-label")}${choice.getAttribute("aria-pressed") === "true" ? " *" : ""}`,
    );
  const pick = async (label: string) =>
    act(async () => host.querySelector<HTMLButtonElement>(`.home-picker__choice[aria-label="${label}"]`)!.click());
  const press = async (text: string) =>
    act(async () => [...host.querySelectorAll("button")].find((button) => button.textContent === text)!.click());
  const close = async () => {
    await act(async () => root.unmount());
    query.clear();
  };
  const found = () => [...host.querySelectorAll("button")].find((button) => button.textContent === "Found your realm")!;
  /** The holdings asked again, as a later read of the step does (a refetch, a remount). */
  const askHoldingsAgain = async () => act(async () => query.invalidateQueries({ queryKey: ["held-realms"] }));
  return { host, featured, strip, pick, press, found, askHoldingsAgain, close };
};

it("renders spectator entry before any head without reading the chain clock", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  useChainTimeStore.setState({
    lastHeartbeat: null,
    executionFloorMs: null,
    anchorTimestampMs: null,
    anchorPerfMs: null,
    nowMs: null,
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const container = document.createElement("div");
  const root = createRoot(container);

  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <GameEntryModal isOpen game={GAME} isSpectateMode />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  try {
    expect(container.querySelector("[aria-label='Entering the game']")).not.toBeNull();
    expect(useChainTimeStore.getState().nowMs).toBeNull();
    expect(() => getBlockTimestamp()).toThrow("Chain time is not known yet");
  } finally {
    await act(async () => root.unmount());
  }
});

/** Held Realms as the relay answers them: their numbers, and each one with the index's map of it. */
const held = (...realmIds: number[]) =>
  Response.json({
    realms: realmIds,
    held: realmIds.map((realmId) => ({ realmId, map: `https://index.test/maps/${realmId}.svg` })),
  });
/** A held Realm's choice as the step names it: its number and its name. */
const realmChoice = (realmId: number) => `${realmId} · ${canonicalRealm(realmId)!.name}`;
const name = (realmId: number) => canonicalRealm(realmId)!.name;
/** A golden Devcon ticket, in a game of the Devcon season (preset 6), the only one whose homes a Devcon ticket founds. */
const golden = () => {
  settlement.presetId = 6;
  return vi
    .spyOn(identityClient, "redeemCampaignTicket")
    .mockResolvedValue({ campaign: "devcon-2026", tier: "golden" });
};
/** The relay answers held Realms from `holdings`, and records every home source registered. */
const relay = (holdings: () => Response) => {
  const registered: unknown[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    if (url === HELD_REALMS) return holdings();
    settlement.order.push("register");
    registered.push(JSON.parse(String(init.body)));
    return Response.json({});
  });
  return registered;
};
const signIn = (address: string | null) => {
  useAccountStore.setState({ account: { address: "0x123" } as never });
  useIdentitySessionStore.setState({ status: "signed-in", session: signedIn("0x2", address) });
};

it("starts a holder with no ticket on their first Realm, wonders first, and founds with it", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  setViewportWidth(1440);
  signIn("0x456");
  noTicket();
  const registered = relay(() => held(3, 538));
  const entry = await openEntry();
  try {
    await vi.waitFor(() => expect(entry.featured()).toBe(name(538)));
    expect(entry.strip()).toEqual([`${realmChoice(538)} *`, realmChoice(3)]);
    expect(entry.host.textContent).toContain("The Glowing Geyser");
    expect(entry.host.querySelector('input[aria-label="Realm number"]')).toBeNull();
    await entry.press("Found your realm");
    expect(registered).toEqual([{ gameId: 8, realmId: 538 }]);
    expect(settlement.settled).toBe(true);
  } finally {
    await entry.close();
  }
});

it.each(["the ticket", "a Realm"])(
  "starts an account holding a ticket and Realms on its ticket, shows both, and founds with %s",
  async (chosen) => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    setViewportWidth(1440);
    signIn("0x456");
    golden();
    const registered = relay(() => held(711));
    const entry = await openEntry();
    try {
      await vi.waitFor(() => expect(entry.featured()).toBe("Golden Devcon ticket"));
      expect(entry.strip()).toEqual(["Golden Devcon ticket *", realmChoice(711)]);
      if (chosen === "a Realm") await entry.pick(realmChoice(711));
      expect(entry.featured()).toBe(chosen === "a Realm" ? name(711) : "Golden Devcon ticket");
      await entry.press("Found your realm");
      expect(registered).toEqual([chosen === "a Realm" ? { gameId: 8, realmId: 711 } : { gameId: 8 }]);
    } finally {
      await entry.close();
    }
  },
);

it.each(["the ticket", "712"])("lets a refused Realm claimant found with another choice (%s)", async (alternative) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  setViewportWidth(1440);
  signIn("0x456");
  golden();
  const sent: unknown[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    if (url === HELD_REALMS) return held(711, 712);
    const { realmId } = JSON.parse(String(init.body));
    sent.push(realmId);
    return realmId === 711
      ? Response.json({ error: "realm_registration_refused" }, { status: 409 })
      : Response.json({ realmId });
  });
  const entry = await openEntry();
  try {
    await vi.waitFor(() => expect(entry.featured()).toBe("Golden Devcon ticket"));
    await entry.pick(realmChoice(711));
    await entry.press("Found your realm");
    expect(settlement.calls).toEqual([]);
    expect(entry.host.textContent).toContain("This Realm cannot be your home in this game. Choose another home.");
    await entry.pick(alternative === "712" ? realmChoice(712) : "Golden Devcon ticket");
    await entry.press("Found your realm");
    expect(sent).toEqual(alternative === "712" ? [711, 712] : [711, undefined]);
    expect(settlement.settled).toBe(true);
  } finally {
    await entry.close();
  }
});

it("shows each account its own Realms in the same tab, and lets a pick of another wallet go to the new first Realm", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  setViewportWidth(1440);
  signIn("0x456");
  noTicket();
  /** The relay answers for whichever account the session cookie names, by its linked wallet. */
  const holdings: Record<string, number[]> = { "0x456": [711, 712], "0x789": [934], "0xabc": [12] };
  const asked: string[] = [];
  const registered = relay(() => {
    const wallet = useIdentitySessionStore.getState().session!.user.address!;
    asked.push(wallet);
    return held(...holdings[wallet]!);
  });
  const entry = await openEntry();
  try {
    await vi.waitFor(() => expect(entry.strip()).toHaveLength(2));
    await entry.pick(realmChoice(712));
    expect(entry.featured()).toBe(name(712));
    await act(async () => useIdentitySessionStore.setState({ session: signedIn("0x3", "0x789") }));
    await vi.waitFor(() => expect(entry.featured()).toBe(name(934)));
    await act(async () => useIdentitySessionStore.setState({ session: signedIn("0x3", "0xabc") }));
    await vi.waitFor(() => expect(entry.featured()).toBe(name(12)));
    expect(asked).toEqual(["0x456", "0x789", "0xabc"]);
    await entry.press("Found your realm");
    expect(registered).toEqual([{ gameId: 8, realmId: 12 }]);
  } finally {
    await entry.close();
  }
});

it.each([
  { holds: "no wallet and no ticket", wallet: null, ticket: false, link: true },
  { holds: "a wallet holding no Realm", wallet: "0x456", ticket: false, link: false },
])("offers $holds the free home, and founds it", async ({ wallet, link }) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  signIn(wallet);
  noTicket();
  const asked: string[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    asked.push(url);
    if (url === HELD_REALMS) return held();
    settlement.order.push("register");
    return Response.json(JSON.parse(String(init.body)));
  });
  const entry = await openEntry();
  try {
    await vi.waitFor(() => expect(entry.featured()).toBe("A free home"));
    expect(entry.host.textContent).toContain("No daily Labor. Hold a Realm or a Devcon ticket to found with it.");
    expect(entry.host.querySelector('input[aria-label="Realm number"]')).toBeNull();
    expect(asked.includes(HELD_REALMS)).toBe(wallet !== null);
    expect(entry.host.textContent?.includes("Link the wallet that holds your Realms")).toBe(link);
    if (link) {
      await entry.press("Link the wallet that holds your Realms");
      expect(entry.host.textContent).toContain("Settings page");
    } else {
      await entry.press("Found your realm");
      expect(settlement.order).toEqual(["register", "settle"]);
    }
  } finally {
    await entry.close();
  }
});

it("shows a ticket holder with no linked wallet their ticket, and the way to the wallet that holds their Realms", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  signIn(null);
  golden();
  relay(() => held());
  const entry = await openEntry();
  try {
    await vi.waitFor(() => expect(entry.featured()).toBe("Golden Devcon ticket"));
    expect(entry.strip()).toEqual([]);
    expect(entry.host.textContent).toContain("Link the wallet that holds your Realms");
  } finally {
    await entry.close();
  }
});

it.each([
  { failed: "the Realms", width: 1440 },
  { failed: "the Realms", width: 390 },
  { failed: "the ticket", width: 1440 },
  { failed: "the ticket", width: 390 },
])(
  "founds nothing while $failed cannot be read, then founds the right default once Try again answers ($width px)",
  async ({ failed, width }) => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    setViewportWidth(width);
    signIn("0x456");
    let up = false;
    if (failed === "the ticket") {
      settlement.presetId = 6;
      vi.spyOn(identityClient, "redeemCampaignTicket").mockImplementation(async () => {
        if (!up) throw new IdentityRequestError(503, "campaigns_unavailable");
        return { campaign: "devcon-2026", tier: "golden" };
      });
    } else noTicket();
    const registered = relay(() =>
      failed === "the Realms" && !up
        ? Response.json({ error: "realm_holdings_unavailable" }, { status: 503 })
        : held(711),
    );
    const entry = await openEntry();
    try {
      const notice =
        failed === "the Realms" ? "Your Realms cannot be read right now" : "Your ticket cannot be read right now";
      await vi.waitFor(() => expect(entry.host.textContent).toContain(notice));
      // No home is offered around the failed read: neither a free home nor a lesser default, and nothing founds.
      expect(entry.featured()).toBeNull();
      expect(entry.found().disabled).toBe(true);
      expect(entry.host.querySelector('input[aria-label="Realm number"]')).toBeNull();
      await act(async () => entry.found().click());
      expect([registered, settlement.calls]).toEqual([[], []]);
      up = true;
      await entry.press("Try again");
      const home = failed === "the Realms" ? name(711) : "Golden Devcon ticket";
      await vi.waitFor(() => expect(entry.featured()).toBe(home));
      expect(entry.host.textContent).not.toContain(notice);
      await entry.press("Found your realm");
      expect(registered).toEqual([failed === "the Realms" ? { gameId: 8, realmId: 711 } : { gameId: 8 }]);
      expect(settlement.settled).toBe(true);
    } finally {
      await entry.close();
    }
  },
);

it("waits on an unreadable ticket: says so, founds nothing, and offers the ticket once Try again answers", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  settlement.presetId = 6;
  setViewportWidth(1440);
  signIn("0x456");
  vi.spyOn(identityClient, "redeemCampaignTicket")
    .mockRejectedValueOnce(new IdentityRequestError(503, "campaigns_unavailable"))
    .mockResolvedValue({ campaign: "devcon-2026", tier: "golden" });
  const registered = relay(() => held(711));
  const entry = await openEntry();
  try {
    await vi.waitFor(() => expect(entry.host.textContent).toContain("Your ticket cannot be read right now"));
    expect(entry.featured()).toBeNull();
    expect(entry.found().disabled).toBe(true);
    await entry.press("Try again");
    await vi.waitFor(() => expect(entry.featured()).toBe("Golden Devcon ticket"));
    expect(entry.strip()).toEqual(["Golden Devcon ticket *", realmChoice(711)]);
    await entry.press("Found your realm");
    expect(registered).toEqual([{ gameId: 8 }]);
  } finally {
    await entry.close();
  }
});

it("waits to found until it knows what the account holds, so a holder never founds a free home by a quick press", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  signIn("0x456");
  noTicket();
  let answer: (response: Response) => void = () => undefined;
  const registered = relay(() => new Promise<Response>((resolve) => (answer = resolve)) as never);
  const entry = await openEntry();
  try {
    await vi.waitFor(() => expect(entry.host.querySelector(".home-picker__waiting")).not.toBeNull());
    expect(entry.found().disabled).toBe(true);
    await act(async () => answer(held(711)));
    await vi.waitFor(() => expect(entry.featured()).toBe(name(711)));
    expect(entry.found().disabled).toBe(false);
    await entry.press("Found your realm");
    expect(registered).toEqual([{ gameId: 8, realmId: 711 }]);
  } finally {
    await entry.close();
  }
});

it.each([
  { width: 1440, strip: 3 },
  { width: 390, strip: 2 },
])(
  "serves a holder of 61 Realms at $width px: a strip of $strip, then All with search and lazy maps",
  async ({ width, strip }) => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    setViewportWidth(width);
    signIn("0x456");
    noTicket();
    const many = [...Array.from({ length: 60 }, (_, index) => index + 1), 538];
    const registered = relay(() => held(...many));
    const entry = await openEntry();
    try {
      await vi.waitFor(() => expect(entry.featured()).toBe(name(538)));
      expect(entry.strip()).toHaveLength(strip);
      await entry.press(`All ${many.length}`);
      const grid = () => [...entry.host.querySelectorAll(".home-picker__grid .home-picker__choice")];
      expect(grid()).toHaveLength(many.length);
      expect(grid()[0]!.getAttribute("aria-label")).toBe(realmChoice(538));
      // Only the chosen home's map loads at once; every card's waits until it nears the screen.
      expect(
        [...entry.host.querySelectorAll(".home-picker__grid .home-picker__map")].every(
          (map) => map.getAttribute("loading") === "lazy",
        ),
      ).toBe(true);
      expect(entry.host.querySelector(".home-picker__featured .home-picker__map")?.getAttribute("loading")).toBe(
        "eager",
      );
      const search = entry.host.querySelector<HTMLInputElement>(".home-picker__search input")!;
      const type = async (text: string) =>
        act(async () => {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(search, text);
          search.dispatchEvent(new Event("input", { bubbles: true }));
        });
      await type("zzzz");
      expect(entry.host.textContent).toContain("No Realm matches");
      await type("42");
      expect(grid().map((choice) => choice.getAttribute("aria-label"))).toEqual([realmChoice(42)]);
      await type(name(17).slice(0, 5));
      expect(grid().map((choice) => choice.getAttribute("aria-label"))).toContain(realmChoice(17));
      await entry.pick(realmChoice(17));
      expect(entry.featured()).toBe(name(17));
      expect(grid()).toHaveLength(0);
      await entry.press("Found your realm");
      expect(registered).toEqual([{ gameId: 8, realmId: 17 }]);
    } finally {
      await entry.close();
    }
  },
);

it("keeps the Realm already registered for this game, shown alone and locked, whatever the holdings then say", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  settlement.heldRealmId = 711;
  signIn("0x456");
  golden();
  const registered = relay(() => held(3));
  const entry = await openEntry();
  try {
    await vi.waitFor(() => expect(entry.featured()).toBe(name(711)));
    expect(entry.host.textContent).toContain("Registered for this game");
    expect(entry.strip()).toEqual([]);
    await act(async () => useIdentitySessionStore.setState({ session: signedIn("0x2", null) }));
    await entry.askHoldingsAgain();
    expect(entry.featured()).toBe(name(711));
    await entry.press("Found your realm");
    expect(registered).toEqual([]);
    expect(settlement.order).toEqual(["settle"]);
  } finally {
    await entry.close();
  }
});

/** A Devcon season's LaborRules row, as the contract holds it in a founded game. */
const devconRules = campaignHomeFacts("regular")[0]!;

it.each([
  { home: "a regular Devcon ticket's", ticket: "regular" as const, pick: null, founded: campaignHomeFacts("regular") },
  { home: "a golden Devcon ticket's", ticket: "golden" as const, pick: null, founded: campaignHomeFacts("golden") },
  {
    home: "a held Realm's, picked over a ticket",
    ticket: "regular" as const,
    pick: 711,
    founded: [devconRules, { model: "SettledRealm", key: "0x1b32", value: { game_id: 1, realm_id: 711, home: 7 } }],
  },
])("says what $home home claims each day, as the founded home then claims it", async ({ ticket, pick, founded }) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  settlement.presetId = 6;
  setViewportWidth(1440);
  signIn("0x456");
  vi.spyOn(identityClient, "redeemCampaignTicket").mockResolvedValue({ campaign: "devcon-2026", tier: ticket });
  relay(() => held(711));

  // The home as the contract founds it from that source, read by the Realm sheet and the Day open push alike.
  const store = new NativeFactStore();
  store.applyFacts(founded as never);
  const claim = homeDailyClaim(store, { gameId: 1, entityId: 7, realmId: 711 })!;
  const lines = [
    `${claim.labor.toLocaleString("en-US")} Labor each day`,
    ...(claim.essence ? [`${claim.essence.toLocaleString("en-US")} Essence each day`] : []),
  ];

  const entry = await openEntry();
  try {
    await vi.waitFor(() => expect(entry.strip()).toHaveLength(2));
    if (pick) await entry.pick(realmChoice(pick));
    const claimed = [...entry.host.querySelectorAll(".home-picker__claim li")].map((line) => line.textContent);
    expect(claimed).toEqual(lines);
  } finally {
    await entry.close();
  }
});
