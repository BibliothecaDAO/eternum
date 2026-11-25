// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { canonicalRealm, getBlockTimestamp } from "@bibliothecadao/eternum";
import { IdentityRequestError } from "@realms-world/identity";
import { aspectName, orders, ordersOfAspect, type AspectId } from "@bibliothecadao/types";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";

const settlement = vi.hoisted(() => ({
  settled: false,
  aspects: false,
  heldRealmId: null as number | null,
  hasSource: false,
  taken: [] as number[],
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
      quest_bonus_percent: 50,
      aspect_members: settlement.aspects ? { 1: 0, 2: 0, 3: 0, 4: 0 } : null,
      player_state: { structures: [{ entity_id: 7, category: 1, realm_id: 3098, level: 2 }] },
      clock: {
        start_settling_at: now - 60,
        start_main_at: now - 60,
        scheduled_end_at: now + 3_600,
        end_at: now + 3_600,
      },
    };
    return { data: entry, error: null };
  },
}));
vi.mock("@/runtime/world/herald-pre-session-reader", () => ({
  fetchSettlementSnapshot: async () => ({
    heldRealmId: settlement.heldRealmId,
    hasHomeSource: settlement.hasSource,
    takenRealmIds: settlement.taken,
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
vi.mock("@/shell/value/lords-balance-pill", () => ({ LordsBalancePill: () => null }));
vi.mock("./selected-world-entity-wait", () => ({
  isSelectedWorldEntityWaitAborted: () => false,
  waitForSelectedWorldEntityState: async (input: { read: () => Promise<unknown> }) => input.read(),
}));
import { useAccountStore } from "@/hooks/store/use-account-store";
import { identityClient, useIdentitySessionStore } from "@/hooks/context/identity-session";
import { setViewportWidth } from "@/shell/frame/test-viewport";
import { GameEntryModal } from "./game-entry-modal";
import type { Session } from "@realms-world/identity";
import {
  ASPECT_STEP_WORDS,
  COUNTDOWN_WORDS,
  DOORWAY_WORDS,
  HELD_REALMS_UNREADABLE,
  HOME_STEP_WORDS,
  REALM_SIDE_WORDS,
} from "../../design-system/kit/words";

/** A signed-in Realms account whose linked wallet is `address` (null: none linked). */
const signedIn = (realmsId: string, address: string | null): Session => ({
  session: { id: `session-${realmsId}`, expiresAt: "2099-01-01T00:00:00Z", userId: realmsId },
  user: { id: realmsId, realmsId, address, name: realmsId, email: `${realmsId}@test` },
});

const ASPECT_INVITE_UNREAD = ASPECT_STEP_WORDS.inviteUnread;
const keptOrder = { order: null as number | null };
beforeEach(() => {
  vi.spyOn(identityClient, "getOrderIntent").mockImplementation(async () => ({ order: keptOrder.order, members: {} }));
  vi.spyOn(identityClient, "joinedShare").mockResolvedValue(null);
  vi.spyOn(identityClient, "readDefaultWallet").mockResolvedValue(null);
  vi.spyOn(identityClient, "getSealCode").mockResolvedValue({ held: false });
});

afterEach(() => {
  keptOrder.order = null;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  settlement.settled = false;
  settlement.aspects = false;
  settlement.heldRealmId = null;
  settlement.hasSource = false;
  settlement.taken = [];
  settlement.calls = [];
  settlement.order = [];
  useAccountStore.setState({ account: null });
  useIdentitySessionStore.setState({ status: "anonymous", session: null, settled: false });
});

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
  /**
   * Clicks a control once a player could: on screen and enabled. A disabled button ignores the click, and the step
   * turns Create your realm on a render after it names the home, so a click on the first sign would do nothing.
   */
  const click = async (find: () => HTMLButtonElement | null | undefined) => {
    const control = await vi.waitFor(() => {
      const found = find();
      expect(found?.disabled).toBe(false);
      return found!;
    });
    await act(async () => control.click());
  };
  const pick = async (label: string) =>
    click(() => host.querySelector<HTMLButtonElement>(`.home-picker__choice[aria-label="${label}"]`));
  const press = async (text: string) =>
    click(() => [...host.querySelectorAll("button")].find((button) => button.textContent === text));
  const close = async () => {
    await act(async () => root.unmount());
    query.clear();
  };
  const found = () =>
    [...host.querySelectorAll("button")].find((button) => button.textContent === COUNTDOWN_WORDS.create)!;
  /** The tiles wearing the chosen mark (its check), by name. */
  const checked = () =>
    [...host.querySelectorAll(".home-picker__choice")]
      .filter((choice) => choice.querySelector(".home-picker__check"))
      .map((choice) => choice.getAttribute("aria-label"));
  /** The holdings asked again, as a later read of the step does (a refetch, a remount). */
  const askHoldingsAgain = async () => act(async () => query.invalidateQueries({ queryKey: ["held-realms"] }));
  return { host, featured, strip, checked, pick, press, found, askHoldingsAgain, close };
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
/** The relay answers held Realms from `holdings`, and records every home source registered. */
const relay = (holdings: () => Response) => {
  const registered: unknown[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    if (url === HELD_REALMS) return holdings();
    settlement.order.push("register");
    registered.push(JSON.parse(String(init.body)));
    settlement.hasSource = true;
    return Response.json({});
  });
  return registered;
};
const signIn = (address: string | null) => {
  useAccountStore.setState({ account: { address: "0x123" } as never });
  useIdentitySessionStore.setState({ status: "signed-in", session: signedIn("0x2", address) });
};

it("starts a holder on their first Realm, wonders first, and founds with it", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  setViewportWidth(1440);
  signIn("0x456");
  const registered = relay(() => held(3, 538));
  const entry = await openEntry();
  try {
    await vi.waitFor(() => expect(entry.featured()).toBe(name(538)));
    expect(entry.strip()).toEqual([`${realmChoice(538)} *`, realmChoice(3)]);
    expect(entry.host.textContent).toContain("The Glowing Geyser");
    expect(entry.host.textContent).toContain(HOME_STEP_WORDS.questBonus(50, 10));
    expect(entry.host.querySelector('input[aria-label="Realm number"]')).toBeNull();
    await entry.press(COUNTDOWN_WORDS.create);
    await vi.waitFor(() => expect(settlement.settled).toBe(true));
    expect(registered).toEqual([{ gameId: 8, realmId: 538 }]);
  } finally {
    await entry.close();
  }
});

it("lets a refused Realm claimant found with another Realm", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  setViewportWidth(1440);
  signIn("0x456");
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
    await vi.waitFor(() => expect(entry.strip()).toHaveLength(2));
    await entry.pick(realmChoice(711));
    await entry.press(COUNTDOWN_WORDS.create);
    await vi.waitFor(() => expect(entry.host.textContent).toContain("This source cannot be attached to your home."));
    expect(settlement.calls).toEqual([]);
    await entry.pick(realmChoice(712));
    await entry.press(COUNTDOWN_WORDS.create);
    await vi.waitFor(() => expect(settlement.settled).toBe(true));
    expect(sent).toEqual([711, 712]);
  } finally {
    await entry.close();
  }
});

it("shows each account its own Realms in the same tab, and lets a pick of another wallet go to the new first Realm", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  setViewportWidth(1440);
  signIn("0x456");
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
    await entry.press(COUNTDOWN_WORDS.create);
    await vi.waitFor(() => expect(settlement.settled).toBe(true));
    expect(registered).toEqual([{ gameId: 8, realmId: 12 }]);
  } finally {
    await entry.close();
  }
});

it.each([
  { holds: "no linked wallet", wallet: null },
  { holds: "a wallet holding no Realm", wallet: "0x456" },
])("creates the realm of an account holding $holds without asking: nothing to choose", async ({ wallet }) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  signIn(wallet);
  const asked: string[] = [];
  const registered: unknown[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    asked.push(url);
    if (url === HELD_REALMS) return held();
    settlement.order.push("register");
    registered.push(JSON.parse(String(init.body)));
    settlement.hasSource = true;
    return Response.json({});
  });
  const entry = await openEntry();
  try {
    await vi.waitFor(() => expect(settlement.order).toEqual(["register", "settle"]));
    expect(registered).toEqual([{ gameId: 8 }]);
    expect(asked.includes(HELD_REALMS)).toBe(wallet !== null);
    // No picker and no press: the step never asked.
    expect(entry.featured()).toBeNull();
    expect(entry.host.textContent).not.toContain(COUNTDOWN_WORDS.create);
  } finally {
    await entry.close();
  }
});

it("asks with the failure said when a realm created without asking is refused, and tries no more by itself", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  signIn(null);
  let tries = 0;
  vi.stubGlobal("fetch", async () => {
    tries += 1;
    return Response.json({ error: "realm_registration_refused" }, { status: 409 });
  });
  const entry = await openEntry();
  try {
    await vi.waitFor(() => expect(entry.featured()).toBe("A free home"));
    expect(entry.host.textContent).toContain("This source cannot be attached to your home.");
    expect(entry.found().disabled).toBe(false);
    expect(tries).toBe(1);
    expect(settlement.calls).toEqual([]);
  } finally {
    await entry.close();
  }
});

it.each([{ width: 1440 }, { width: 390 }])(
  "founds nothing while the Realms cannot be read, then founds the Realm once Try again answers ($width px)",
  async ({ width }) => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    setViewportWidth(width);
    signIn("0x456");
    let up = false;
    const registered = relay(() =>
      up ? held(711) : Response.json({ error: "realm_holdings_unavailable" }, { status: 503 }),
    );
    const entry = await openEntry();
    try {
      const notice = HELD_REALMS_UNREADABLE;
      await vi.waitFor(() => expect(entry.host.textContent).toContain(notice));
      // No home is offered around the failed read: neither a free home nor a lesser default, and nothing founds.
      expect(entry.featured()).toBeNull();
      expect(entry.found().disabled).toBe(true);
      expect(entry.host.querySelector('input[aria-label="Realm number"]')).toBeNull();
      await act(async () => entry.found().click());
      expect([registered, settlement.calls]).toEqual([[], []]);
      up = true;
      await entry.press("Try again");
      await vi.waitFor(() => expect(entry.featured()).toBe(name(711)));
      expect(entry.host.textContent).not.toContain(notice);
      await entry.press(COUNTDOWN_WORDS.create);
      await vi.waitFor(() => expect(settlement.settled).toBe(true));
      expect(registered).toEqual([{ gameId: 8, realmId: 711 }]);
    } finally {
      await entry.close();
    }
  },
);

it("waits to found until it knows what the account holds, so a holder never founds a free home by a quick press", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  signIn("0x456");
  let answer: (response: Response) => void = () => undefined;
  const registered = relay(() => new Promise<Response>((resolve) => (answer = resolve)) as never);
  const entry = await openEntry();
  try {
    await vi.waitFor(() => expect(entry.host.querySelector(".home-picker__waiting")).not.toBeNull());
    // The step says what it waits for; Found is faint, not busy.
    expect(entry.host.querySelector('.home-picker__waiting [role="status"]')?.textContent).toBe(
      HOME_STEP_WORDS.loading,
    );
    expect(entry.found().disabled).toBe(true);
    expect(entry.found().getAttribute("aria-busy")).toBeNull();
    await act(async () => answer(held(711)));
    await vi.waitFor(() => expect(entry.featured()).toBe(name(711)));
    expect(entry.found().disabled).toBe(false);
    await entry.press(COUNTDOWN_WORDS.create);
    await vi.waitFor(() => expect(settlement.settled).toBe(true));
    expect(registered).toEqual([{ gameId: 8, realmId: 711 }]);
  } finally {
    await entry.close();
  }
});

it("spins while the realm is founded and says so, at full strength, until the founding answers", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  signIn("0x456");
  // The relay holds its answer to the home's registration, the founding's first leg, with the step still on screen.
  const registered: unknown[] = [];
  let answer: () => void = () => undefined;
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    if (url === HELD_REALMS) return held(711);
    registered.push(JSON.parse(String(init.body)));
    settlement.hasSource = true;
    await new Promise<void>((resolve) => (answer = resolve));
    return Response.json({});
  });
  const entry = await openEntry();
  try {
    await vi.waitFor(() => expect(entry.featured()).toBe(name(711)));
    await entry.press(COUNTDOWN_WORDS.create);
    const founding = await vi.waitFor(() => {
      const button = [...entry.host.querySelectorAll("button")].find(
        (candidate) => candidate.textContent === HOME_STEP_WORDS.founding,
      );
      expect(button?.getAttribute("aria-busy")).toBe("true");
      return button!;
    });
    expect(founding.querySelector(".ui-spinner")).not.toBeNull();
    await vi.waitFor(() => expect(registered).toEqual([{ gameId: 8, realmId: 711 }]));
    await act(async () => answer());
    await vi.waitFor(() => expect(settlement.settled).toBe(true));
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
    const many = [...Array.from({ length: 60 }, (_, index) => index + 1), 538];
    const registered = relay(() => held(...many));
    const entry = await openEntry();
    try {
      await vi.waitFor(() => expect(entry.featured()).toBe(name(538)));
      expect(entry.strip()).toHaveLength(strip);
      // A Wonder's tile wears the chosen mark too.
      expect(entry.checked()).toEqual([realmChoice(538)]);
      await entry.press(`All ${many.length}`);
      const grid = () => [...entry.host.querySelectorAll(".home-picker__grid .home-picker__choice")];
      expect(grid()).toHaveLength(many.length);
      expect(grid()[0]!.getAttribute("aria-label")).toBe(realmChoice(538));
      // Only the chosen home's map loads at once; every card's waits until it nears the screen.
      expect(
        [...entry.host.querySelectorAll(".home-picker__grid .home-art__map")].every(
          (map) => map.getAttribute("loading") === "lazy",
        ),
      ).toBe(true);
      expect(entry.host.querySelector(".home-picker__featured .home-art__map")?.getAttribute("loading")).toBe("eager");
      const search = entry.host.querySelector<HTMLInputElement>(".home-picker__search input")!;
      const type = async (text: string) =>
        act(async () => {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(search, text);
          search.dispatchEvent(new Event("input", { bubbles: true }));
        });
      await type("zzzz");
      expect(entry.host.textContent).toContain(HOME_STEP_WORDS.noMatch);
      await type("42");
      expect(grid().map((choice) => choice.getAttribute("aria-label"))).toEqual([realmChoice(42)]);
      await type(name(17).slice(0, 5));
      expect(grid().map((choice) => choice.getAttribute("aria-label"))).toContain(realmChoice(17));
      await entry.pick(realmChoice(17));
      expect(entry.featured()).toBe(name(17));
      expect(grid()).toHaveLength(0);
      await entry.press(COUNTDOWN_WORDS.create);
      await vi.waitFor(() => expect(settlement.settled).toBe(true));
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
  const registered = relay(() => held(3));
  const entry = await openEntry();
  try {
    await vi.waitFor(() => expect(entry.featured()).toBe(name(711)));
    expect(entry.host.textContent).toContain(HOME_STEP_WORDS.registered);
    expect(entry.strip()).toEqual([]);
    await act(async () => useIdentitySessionStore.setState({ session: signedIn("0x2", null) }));
    await entry.askHoldingsAgain();
    expect(entry.featured()).toBe(name(711));
    await entry.press(COUNTDOWN_WORDS.create);
    await vi.waitFor(() => expect(settlement.settled).toBe(true));
    expect(registered).toEqual([]);
    expect(settlement.order).toEqual(["settle"]);
  } finally {
    await entry.close();
  }
});

it("a founded home holding a Realm attaches it only on Add this quest bonus", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  settlement.settled = true;
  signIn("0x456");
  const registered = relay(() => held(711));
  const entry = await openEntry();
  try {
    await vi.waitFor(() => expect(entry.featured()).toBe(name(711)));
    expect(registered).toEqual([]);
    await entry.press(HOME_STEP_WORDS.attach);
    await vi.waitFor(() => expect(registered).toEqual([{ gameId: 8, realmId: 711 }]));
    expect(settlement.calls).toEqual([]);
  } finally {
    await entry.close();
  }
});

it("a founded home chooses one of two Realms, leaves the other free, and shows used Realms as taken", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  settlement.settled = true;
  settlement.taken = [713];
  signIn("0x456");
  const registered = relay(() => held(711, 712, 713));
  const entry = await openEntry();
  try {
    await vi.waitFor(() => expect(entry.host.textContent).toContain("Taken"));
    const taken = [...entry.host.querySelectorAll("button")].find(
      (button) => button.getAttribute("aria-label") === realmChoice(713),
    );
    expect(taken?.disabled).toBe(true);
    expect(taken?.textContent).toContain("Taken");
    expect(registered).toEqual([]);
    await entry.pick(realmChoice(712));
    await entry.press(HOME_STEP_WORDS.attach);
    await vi.waitFor(() => expect(registered).toEqual([{ gameId: 8, realmId: 712 }]));
    expect(settlement.calls).toEqual([]);
  } finally {
    await entry.close();
  }
});

it("offers only Continue for a founded home whose held Realm is already taken", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  settlement.settled = true;
  settlement.taken = [711];
  signIn("0x456");
  const registered = relay(() => held(711));
  const entry = await openEntry();
  try {
    await vi.waitFor(() => expect(entry.host.textContent).toContain("Taken"));
    expect(
      [...entry.host.querySelectorAll("button")].find((button) => button.textContent === HOME_STEP_WORDS.attach)
        ?.disabled,
    ).toBe(true);
    await entry.press(HOME_STEP_WORDS.keepFree);
    await vi.waitFor(() => expect(entry.host.textContent).not.toContain(HOME_STEP_WORDS.attachTitle));
    expect(registered).toEqual([]);
    expect(settlement.calls).toEqual([]);
  } finally {
    await entry.close();
  }
});

describe("a founded Season 1 home attaching a held Realm (only one of its own Aspect)", () => {
  /** The fixture home's Realm, 3098, and the first Realms whose Order is, or is not, in its Aspect. */
  const aspectOf = (realmId: number) =>
    orders.find(({ orderId }) => orderId === canonicalRealm(realmId)!.order)!.aspect;
  const realmIds = Array.from({ length: 8_000 }, (_, index) => index + 1).filter((id) => id !== 3098);
  const sameAspect = realmIds.find((id) => aspectOf(id) === aspectOf(3098))!;
  const otherAspect = realmIds.find((id) => aspectOf(id) !== aspectOf(3098))!;
  const foundedSeasonOneHome = () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    settlement.aspects = true;
    settlement.settled = true;
    signIn("0x456");
  };

  it("offers no Realm of another Aspect, sends no source, and goes on to the map", async () => {
    foundedSeasonOneHome();
    const registered = relay(() => held(otherAspect));
    const entry = await openEntry();
    try {
      await vi.waitFor(() => expect(entry.host.textContent).toContain(DOORWAY_WORDS.map));
      expect(entry.host.textContent).not.toContain(HOME_STEP_WORDS.attachTitle);
      expect(entry.host.textContent).not.toContain(name(otherAspect));
      expect(registered).toEqual([]);
      expect(settlement.calls).toEqual([]);
    } finally {
      await entry.close();
    }
  });

  it("offers only the Realm of its own Aspect and attaches it", async () => {
    foundedSeasonOneHome();
    const registered = relay(() => held(otherAspect, sameAspect));
    const entry = await openEntry();
    try {
      await vi.waitFor(() => expect(entry.featured()).toBe(name(sameAspect)));
      expect(entry.host.textContent).not.toContain(name(otherAspect));
      await entry.press(HOME_STEP_WORDS.attach);
      await vi.waitFor(() => expect(registered).toEqual([{ gameId: 8, realmId: sameAspect }]));
      expect(settlement.calls).toEqual([]);
    } finally {
      await entry.close();
    }
  });
});

it("resumes a home with an existing source without offering or submitting another source", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  settlement.settled = true;
  settlement.hasSource = true;
  signIn("0x456");
  const registered = relay(() => held(711));
  const entry = await openEntry();
  try {
    // The entry goes straight on to the map, never stopping on the source step.
    await vi.waitFor(() => expect(entry.host.textContent).toContain(DOORWAY_WORDS.map));
    expect(entry.host.textContent).not.toContain(HOME_STEP_WORDS.attachTitle);
    expect(registered).toEqual([]);
    expect(settlement.calls).toEqual([]);
  } finally {
    await entry.close();
  }
});

describe("a friend's Aspect invite at a Season 1 home's founding", () => {
  const invite = (game: { chainId: string; gameId: number }, kind: "aspect" | "frontier-day" = "aspect") => ({
    kind,
    chainId: game.chainId,
    gameId: game.gameId,
    moment: 2,
    name: "Linden",
  });
  const seasonOneHome = (joined: ReturnType<typeof invite> | null) => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    settlement.aspects = true;
    signIn(null);
    relay(() => held());
    return vi.spyOn(identityClient, "joinedShare").mockResolvedValue(joined);
  };
  const cards = (host: HTMLElement) =>
    [...host.querySelectorAll<HTMLButtonElement>(".app-aspect-card")].map((card) => ({
      label: card.getAttribute("aria-label"),
      invite: card.querySelector("[data-aspect-invited]")?.textContent ?? null,
    }));
  /** Taps an Aspect's card once a player could: drawn and open. */
  const join = async (host: HTMLElement, aspect: string) => {
    const open = (selector: string) =>
      vi.waitFor(() => {
        const found = host.querySelector<HTMLButtonElement>(selector);
        expect(found?.disabled).toBe(false);
        return found!;
      });
    const card = await open(`.app-aspect-card[aria-label="Join ${aspect}"]`);
    await act(async () => card.click());
    const order = await open(".aspect-picker__order");
    await act(async () => order.click());
  };
  const firstOrderOf = (aspect: AspectId) => expect.objectContaining({ order: ordersOfAspect(aspect)[0]!.orderId });
  const plainOrder = [
    { label: "Join Prowess", invite: null },
    { label: "Join Luminary", invite: null },
    { label: "Join Havoc", invite: null },
    { label: "Join Insight", invite: null },
  ];

  it("offers the invited Aspect first, naming its sender, and founds into the Aspect tapped", async () => {
    const joined = seasonOneHome(invite(GAME));
    const entry = await openEntry();
    try {
      await vi.waitFor(() =>
        expect(cards(entry.host)).toEqual([
          { label: "Join Luminary", invite: "Invited" },
          { label: "Join Prowess", invite: null },
          { label: "Join Havoc", invite: null },
          { label: "Join Insight", invite: null },
        ]),
      );
      expect(entry.host.querySelector(".aspect-picker__invited")?.textContent).toBe(
        ASPECT_STEP_WORDS.invitedTo("Linden", "Luminary"),
      );
      await join(entry.host, "Luminary");
      await vi.waitFor(() => expect(settlement.calls).toEqual([firstOrderOf(2)]));
      expect(joined).toHaveBeenCalledTimes(1);
    } finally {
      await entry.close();
    }
  });

  it("founds a home whose Order was kept before the season in that Order's Aspect, whatever a friend invited it to", async () => {
    seasonOneHome(invite(GAME));
    keptOrder.order = 13;
    const entry = await openEntry();
    try {
      await vi.waitFor(() => expect(entry.host.querySelectorAll(".aspect-picker__order")).toHaveLength(4));
      expect(entry.host.textContent).toContain(ASPECT_STEP_WORDS.keptAspect("Prowess"));
      expect(cards(entry.host)).toEqual(plainOrder);
      expect(
        [...entry.host.querySelectorAll<HTMLButtonElement>(".app-aspect-card")].every((card) => card.disabled),
      ).toBe(true);
      const titans = await vi.waitFor(() => {
        const found = entry.host.querySelector<HTMLButtonElement>('.aspect-picker__order[data-order="13"]');
        expect(found?.disabled).toBe(false);
        return found!;
      });
      await act(async () => titans.click());
      await vi.waitFor(() => expect(settlement.calls).toEqual([expect.objectContaining({ order: 13 })]));
    } finally {
      await entry.close();
    }
  });

  it("holds every card shut while the Order kept before the season cannot be read, and opens them once it answers", async () => {
    seasonOneHome(invite(GAME));
    const read = vi
      .spyOn(identityClient, "getOrderIntent")
      .mockRejectedValueOnce(new IdentityRequestError(503, "order_intent_unavailable"));
    const entry = await openEntry();
    try {
      await vi.waitFor(() => expect(entry.host.textContent).toContain(ASPECT_STEP_WORDS.keptUnread));
      const shut = () =>
        [...entry.host.querySelectorAll<HTMLButtonElement>(".app-aspect-card")].map((card) => card.disabled);
      expect(shut()).toEqual([true, true, true, true]);
      read.mockResolvedValue({ order: null, members: {} });
      await entry.press("Try again");
      await vi.waitFor(() => expect(shut()).toEqual([false, false, false, false]));
    } finally {
      await entry.close();
    }
  });

  describe("a held Realm of another Aspect", () => {
    const realmHolder = (joined: ReturnType<typeof invite> | null) => {
      (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
      settlement.aspects = true;
      signIn("0x456");
      vi.spyOn(identityClient, "joinedShare").mockResolvedValue(joined);
      return relay(() => held(538));
    };
    const warning = (host: HTMLElement) => host.querySelector("[data-realm-side-warning]");

    it("warns once that a friend plays another Aspect, and founds with the Realm on Play my Realm", async () => {
      const registered = realmHolder(invite(GAME));
      const entry = await openEntry();
      try {
        await vi.waitFor(() => expect(warning(entry.host)).not.toBeNull());
        expect(warning(entry.host)?.querySelector("h2")?.textContent).toBe(
          REALM_SIDE_WORDS.invited("Linden", "Luminary", "Havoc"),
        );
        expect(warning(entry.host)?.textContent).toContain(name(538));
        expect(warning(entry.host)?.textContent).toContain(
          `${REALM_SIDE_WORDS.keeps} ${REALM_SIDE_WORDS.apart("Linden")}`,
        );
        expect(warning(entry.host)?.textContent).toContain(REALM_SIDE_WORDS.loses);
        await entry.press(REALM_SIDE_WORDS.playRealm);
        expect(warning(entry.host)).toBeNull();
        await entry.press(COUNTDOWN_WORDS.create);
        await vi.waitFor(() => expect(settlement.settled).toBe(true));
        expect(registered).toEqual([{ gameId: 8, realmId: 538 }]);
        expect(settlement.calls).toEqual([expect.objectContaining({ order: undefined })]);
      } finally {
        await entry.close();
      }
    });

    it("founds a free home in the Order kept before the season on Join for free, with no Realm sent", async () => {
      keptOrder.order = 13;
      const registered = realmHolder(null);
      const entry = await openEntry();
      try {
        await vi.waitFor(() => expect(warning(entry.host)).not.toBeNull());
        expect(warning(entry.host)?.querySelector("h2")?.textContent).toBe(REALM_SIDE_WORDS.kept("Prowess", "Havoc"));
        await entry.press(REALM_SIDE_WORDS.joinFree("Prowess"));
        expect(warning(entry.host)).toBeNull();
        expect(entry.host.querySelector(".home-picker__featured")).toBeNull();
        const titans = await vi.waitFor(() => {
          const found = entry.host.querySelector<HTMLButtonElement>('.aspect-picker__order[data-order="13"]');
          expect(found?.disabled).toBe(false);
          return found!;
        });
        await act(async () => titans.click());
        await vi.waitFor(() => expect(settlement.calls).toEqual([expect.objectContaining({ order: 13 })]));
        expect(registered).toEqual([{ gameId: 8 }]);
      } finally {
        await entry.close();
      }
    });

    it("keeps Create your realm off while the Order kept before the season cannot be read, so the warning is never skipped", async () => {
      const read = vi
        .spyOn(identityClient, "getOrderIntent")
        .mockRejectedValueOnce(new IdentityRequestError(503, "order_intent_unavailable"));
      realmHolder(null);
      const entry = await openEntry();
      try {
        await vi.waitFor(() => expect(entry.featured()).toBe(name(538)));
        await vi.waitFor(() => expect(entry.host.textContent).toContain(ASPECT_STEP_WORDS.keptUnread));
        expect(entry.found().disabled).toBe(true);
        read.mockResolvedValue({ order: 13, members: {} });
        await entry.press("Try again");
        await vi.waitFor(() => expect(warning(entry.host)).not.toBeNull());
        expect(settlement.calls).toEqual([]);
      } finally {
        await entry.close();
      }
    });

    it("keeps Create your realm off while a friend's invite cannot be read, and warns once it answers", async () => {
      realmHolder(null);
      const joined = vi
        .spyOn(identityClient, "joinedShare")
        .mockRejectedValueOnce(new Error("unavailable"))
        .mockRejectedValueOnce(new Error("unavailable"));
      const entry = await openEntry();
      try {
        await vi.waitFor(() => expect(entry.featured()).toBe(name(538)));
        await vi.waitFor(() => expect(entry.host.textContent).toContain(ASPECT_INVITE_UNREAD), { timeout: 4_000 });
        expect(entry.found().disabled).toBe(true);
        joined.mockResolvedValue(invite(GAME));
        await entry.press("Try again");
        await vi.waitFor(() => expect(warning(entry.host)).not.toBeNull());
        expect(settlement.calls).toEqual([]);
      } finally {
        await entry.close();
      }
    });

    it("asks nothing of a Realm in the invited Aspect", async () => {
      realmHolder({ ...invite(GAME), moment: 3 });
      const entry = await openEntry();
      try {
        await vi.waitFor(() => expect(entry.featured()).toBe(name(538)));
        expect(warning(entry.host)).toBeNull();
      } finally {
        await entry.close();
      }
    });

    it("explains the quest bonus, hides redundant Aspect cards and PlaysAs, and lets a holder play free without a Realm", async () => {
      const registered = realmHolder(null);
      const entry = await openEntry();
      try {
        await vi.waitFor(() => expect(entry.featured()).toBe(name(538)));
        expect(entry.host.textContent).toContain(HOME_STEP_WORDS.questBonus(50));
        expect(entry.host.textContent).not.toContain("Your Realm holds the quest bonus");
        expect(entry.host.textContent).not.toContain("You play as");
        expect(entry.host.querySelectorAll(".app-aspect-card")).toHaveLength(0);
        expect(entry.host.textContent).not.toContain("Play free (without a Realm)");
        expect(entry.host.querySelector('[data-entry-mode-switch] [role="tablist"]')?.textContent).toBe(
          `${HOME_STEP_WORDS.myRealmTab(1)}${HOME_STEP_WORDS.playFreeTab}`,
        );

        await entry.press(HOME_STEP_WORDS.playFreeTab);
        await vi.waitFor(() => expect(entry.host.querySelectorAll(".app-aspect-card")).toHaveLength(4));
        expect(entry.host.querySelector(".home-picker__featured")).toBeNull();
        expect(entry.host.textContent).toContain("No +50% daily quest labor bonus unless you get an Ancient Seal.");
        expect(entry.host.textContent).not.toContain("Use one of my Realms instead");

        await entry.press(HOME_STEP_WORDS.myRealmTab(1));
        await vi.waitFor(() => expect(entry.featured()).toBe(name(538)));
        expect(entry.host.querySelectorAll(".app-aspect-card")).toHaveLength(0);

        await entry.press(HOME_STEP_WORDS.playFreeTab);
        await join(entry.host, "Luminary");
        await vi.waitFor(() => expect(settlement.calls).toEqual([firstOrderOf(2)]));
        expect(registered).toEqual([{ gameId: 8 }]);
      } finally {
        await entry.close();
      }
    });

    it("disables the Realm / Play Free switch while settlement is in progress", async () => {
      (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
      settlement.aspects = true;
      signIn("0x456");
      vi.spyOn(identityClient, "joinedShare").mockResolvedValue(null);
      let finishRegister: () => void = () => undefined;
      vi.stubGlobal("fetch", async (url: string) => {
        if (url === HELD_REALMS) return held(538);
        settlement.hasSource = true;
        await new Promise<void>((resolve) => (finishRegister = resolve));
        return Response.json({});
      });
      const entry = await openEntry();
      try {
        await vi.waitFor(() => expect(entry.featured()).toBe(name(538)));
        await entry.press(COUNTDOWN_WORDS.create);
        await vi.waitFor(() => {
          const tabs = [...entry.host.querySelectorAll<HTMLButtonElement>('[data-entry-mode-switch] [role="tab"]')];
          expect(tabs.map((tab) => tab.disabled)).toEqual([true, true]);
        });
        await act(async () => finishRegister());
        await vi.waitFor(() => expect(settlement.settled).toBe(true));
      } finally {
        await entry.close();
      }
    });
  });

  it("leaves every other Aspect open to an invited player", async () => {
    seasonOneHome(invite(GAME));
    const entry = await openEntry();
    try {
      await vi.waitFor(() => expect(cards(entry.host)[0]?.invite).toBe("Invited"));
      await join(entry.host, "Insight");
      await vi.waitFor(() => expect(settlement.calls).toEqual([firstOrderOf(4)]));
    } finally {
      await entry.close();
    }
  });

  it("keeps every card shut until the account's invite is read, even when the home is settled first", async () => {
    const joined = seasonOneHome(null);
    let answer!: (link: ReturnType<typeof invite>) => void;
    joined.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const entry = await openEntry();
    try {
      // The home step is done and the cards are drawn, but the invite is on its way: none can found yet.
      await vi.waitFor(() => expect(cards(entry.host)).toHaveLength(4));
      await new Promise((later) => setTimeout(later, 300));
      const shut = [...entry.host.querySelectorAll<HTMLButtonElement>(".app-aspect-card")].map((card) => card.disabled);
      expect(shut).toEqual([true, true, true, true]);
      expect(settlement.calls).toEqual([]);
      await act(async () => answer(invite(GAME)));
      await vi.waitFor(() => expect(cards(entry.host)[0]).toEqual({ label: "Join Luminary", invite: "Invited" }));
      await join(entry.host, "Luminary");
      await vi.waitFor(() => expect(settlement.calls).toEqual([firstOrderOf(2)]));
    } finally {
      await entry.close();
    }
  });

  it("says when the invite could not be read, leaves the Aspects open, and offers it again on a retry", async () => {
    const joined = seasonOneHome(null);
    joined.mockRejectedValueOnce(new Error("unavailable")).mockRejectedValueOnce(new Error("unavailable"));
    joined.mockResolvedValue(invite(GAME));
    const entry = await openEntry();
    try {
      // The read is tried once more after a second before it is called unreadable.
      await vi.waitFor(() => expect(entry.host.textContent).toContain("Could not load your friend's invite"), {
        timeout: 4_000,
      });
      expect(cards(entry.host)).toEqual(plainOrder);
      await act(async () =>
        [...entry.host.querySelectorAll("button")].find((button) => button.textContent === "Try again")!.click(),
      );
      await vi.waitFor(() => expect(cards(entry.host)[0]).toEqual({ label: "Join Luminary", invite: "Invited" }));
    } finally {
      await entry.close();
    }
  });

  it("drops the offer when another account signs in on the same app", async () => {
    const joined = seasonOneHome(invite(GAME));
    joined.mockResolvedValueOnce(invite(GAME)).mockResolvedValueOnce(null);
    const entry = await openEntry();
    try {
      await vi.waitFor(() => expect(cards(entry.host)[0]?.invite).toBe("Invited"));
      await act(async () => useIdentitySessionStore.setState({ status: "signed-in", session: signedIn("0x3", null) }));
      await vi.waitFor(() => expect(cards(entry.host)).toEqual(plainOrder));
      expect(joined).toHaveBeenCalledTimes(2);
    } finally {
      await entry.close();
    }
  });

  it.each([
    ["an invite to another game", invite({ chainId: GAME.chainId, gameId: GAME.gameId + 1 })],
    ["an invite on another chain", invite({ chainId: "0x534e5f5345504f4c4941", gameId: GAME.gameId })],
    ["a link of another kind", invite(GAME, "frontier-day")],
    ["no link at all", null],
  ])("keeps the plain order for %s, and founds into the Aspect tapped", async (_case, joined) => {
    seasonOneHome(joined);
    const entry = await openEntry();
    try {
      await vi.waitFor(() => expect(cards(entry.host)).toEqual(plainOrder));
      expect(entry.host.querySelector(".aspect-picker__invited")).toBeNull();
      await join(entry.host, "Havoc");
      await vi.waitFor(() => expect(settlement.calls).toEqual([firstOrderOf(3)]));
    } finally {
      await entry.close();
    }
  });
});

it("filters a multi-Realm vault by Aspect on desktop and founds with the chosen Realm", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  setViewportWidth(1440);
  signIn("0x456");
  const vault = [418, 902, 1241, 2814, 3105, 4490, 5012];
  const registered = relay(() => held(...vault));
  const entry = await openEntry();
  try {
    await vi.waitFor(() => expect(entry.strip()).toHaveLength(vault.length));
    const targetAspect = orders.find(({ orderId }) => orderId === canonicalRealm(902)!.order)!.aspect!;
    const matching = vault.filter(
      (id) => orders.find(({ orderId }) => orderId === canonicalRealm(id)!.order)!.aspect === targetAspect,
    );
    const filterButton = [...entry.host.querySelectorAll<HTMLButtonElement>(".home-picker__filter")].find((button) =>
      button.textContent?.includes(aspectName(targetAspect)),
    )!;
    await act(async () => filterButton.click());
    expect(entry.strip()).toHaveLength(matching.length);
    await entry.pick(realmChoice(902));
    expect(entry.featured()).toBe(name(902));
    await entry.press(COUNTDOWN_WORDS.create);
    await vi.waitFor(() => expect(settlement.settled).toBe(true));
    expect(registered).toEqual([{ gameId: 8, realmId: 902 }]);
  } finally {
    await entry.close();
  }
});
