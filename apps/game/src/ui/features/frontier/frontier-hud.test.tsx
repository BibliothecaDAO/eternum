// @vitest-environment jsdom
import { SeasonOver } from "@/shell/season-tab/season-over";
import { mapRouteHex } from "@/play/navigation/play-route";
import { LAYER_VIEW_REQUEST_EVENT, type LayerViewRequest } from "@/three/scenes/worldmap-layer-request";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { loadOpening, skipTutorial } from "./opening/opening-store";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { deepViewFor, type GameClientSetup, type NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { sellingFragments } from "./value/fragments-fixture";
import type { HudSurface } from "./hud/frontier-nav";

// The real Frontier HUD on the lab's game. Only the network, the identity and the chat pane's own drawing stand in: the
// HUD, its hooks and the stores are the real ones.
const wire = vi.hoisted(() => ({ made: 0, close: vi.fn() }));
vi.mock("@bibliothecadao/types", async (original) => ({
  ...(await original<typeof import("@bibliothecadao/types")>()),
  RealtimeClient: class {
    constructor() {
      wire.made += 1;
    }
    close = wire.close;
    setSeenRoom = vi.fn();
  },
}));
const identity = vi.hoisted(() => ({ status: "signed-in" as "signed-in" | "signed-out" }));
const signIn = vi.hoisted(() => ({ request: (() => {}) as () => void }));
vi.mock("@/hooks/context/identity-session", async (original) => ({
  ...(await original<typeof import("@/hooks/context/identity-session")>()),
  useIdentitySession: () => ({
    status: identity.status,
    session: { user: { id: "u1", realmsId: "", name: "uxplay", email: "uxplay@example.com", address: "0x7" } },
  }),
}));
vi.mock("@/shell/sign-in/connect", () => ({ useRequestSignIn: () => () => signIn.request() }));
// The realm the player visits, as the season board's Visit starts it; none until a test visits.
const visiting = vi.hoisted(() => ({ visit: null as { player: string; structureId: number; opensOn: null } | null }));
vi.mock("@/sync/active-game-client", async (original) => ({
  ...(await original<typeof import("@/sync/active-game-client")>()),
  useRealmVisit: () => visiting.visit,
}));
vi.mock("@/ui/features/social", async () => ({
  ...(await import("@/ui/features/social/realtime-chat/hooks/use-realtime-chat")),
  RealtimeChatShell: () => <input aria-label="Message" />,
  RealtimeChatTabs: () => <div role="tablist" aria-label="Chat rooms" />,
  RealtimeChatBody: () => <input aria-label="Message" />,
  GameChatMap: ({ children }: { children: ReactNode }) => children,
}));

const { configManager, getStructureName, Position, readExpeditionRules, setBlockTimestampSource } =
  await import("@bibliothecadao/eternum");
const { GameProvider } = await import("@/hooks/context/game-context");
const { useAccountStore } = await import("@/hooks/store/use-account-store");
const { wire: wireFact } = await import("@/lab/game/lab-chain");
const { raceRules, raceScenario } = await import("@/lab/game/race-scenario");
const { useRealtimeChatStore } = await import("@/ui/features/social/realtime-chat/model/store");
const { LabGame } = await import("@/ui/features/debug/kit-lab/lab-game");
const { useUIStore } = await import("@/hooks/store/use-ui-store");
const { overrideSpectateIntent } = await import("@/utils/spectator-session");
const { FrontierAspectPage } = await import("./aspect/aspect-page");
const { ASPECT_PAGE_WORDS, SEASON_BOARD_WORDS } = await import("@/ui/design-system/kit/words");
const { setActiveGame } = await import("@/runtime/world");
const SEASON_PAGE = `section[aria-label="${SEASON_BOARD_WORDS.title}"]`;
const { FrontierHud } = await import("./frontier-hud");
const { BuildingType, BUILDINGS_CENTER } = await import("@bibliothecadao/types");
const { buildingName } = await import("./build/building-names");

/** The frame's width, as the layout reads it: a desktop from 1024 px, told to the layout when it changes. */
const viewport = (() => {
  let width = 1440;
  const listeners = new Set<() => void>();
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return Number(/min-width:\s*(\d+)px/.exec(query)?.[1] ?? Infinity) <= width;
    },
    media: query,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
    addListener: (listener: () => void) => listeners.add(listener),
    removeListener: (listener: () => void) => listeners.delete(listener),
  }));
  return {
    set: (next: number) => {
      width = next;
      listeners.forEach((listener) => listener());
    },
  };
})();

let host: HTMLDivElement;
let root: Root;
let shownStore: NativeFactStore;

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // These tests play the whole HUD; the opening interface has its own tests.
  await loadOpening(null);
  await skipTutorial();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ blocked: [], version: 0 }), { status: 200 })),
  );
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  act(() => root.unmount());
  host.remove();
  // A frame closed steps back off its history entry a moment later: that step lands here, not in the next test's route.
  await historySettles();
});

/** What the page shows of chat: whether the client is connected, and the unread count where the layout shows it. */
const chatReading = () => ({
  connected: useRealtimeChatStore.getState().client !== null,
  unread:
    host.querySelector('[aria-label^="Unread chat messages"]')?.textContent ??
    [...host.querySelectorAll('nav[aria-label="Places"] button')]
      .find((button) => button.textContent?.includes("Chat"))
      ?.textContent?.replace("Chat", "") ??
    null,
});

/** The real Frontier HUD over the lab's game, which shard rules the realm's labor. */
const renderHud = () =>
  act(async () =>
    root.render(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient()}>
          <LabGame mode="frontier" facts={(store) => sellingFragments(store)}>
            {(store) => {
              shownStore = store;
              return <FrontierHud seasonOver={SeasonOver} rules={readExpeditionRules(store, 1)!} />;
            }}
          </LabGame>
        </QueryClientProvider>
      </MemoryRouter>,
    ),
  );

it("keeps one chat connection and its unread count from desktop to phone and back, through the Frontier HUD", async () => {
  viewport.set(1440);
  const route = window.location.pathname + window.location.search;
  window.history.replaceState(null, "", "/g/0x1ab9/1/map?col=1&row=1");
  wire.made = 0;
  wire.close.mockClear();
  try {
    await renderHud();
    await act(async () => useRealtimeChatStore.setState({ unreadWorldTotal: 3 }));
    expect(chatReading()).toEqual({ connected: true, unread: "3" });

    await act(async () => viewport.set(390));
    expect(chatReading()).toEqual({ connected: true, unread: "3" });
    expect(
      host.querySelector('nav[aria-label="Places"] button[aria-label="Chat"] .frontier-tab__badge')?.textContent,
    ).toBe("3");

    await act(async () => viewport.set(1440));
    expect(chatReading()).toEqual({ connected: true, unread: "3" });
    expect(wire.made).toBe(1);
    expect(wire.close).not.toHaveBeenCalled();
  } finally {
    window.history.replaceState(null, "", route);
  }
});

it("gives a phone the Feed from Menu, the desktop's own Feed as a page under the map, which its × closes", async () => {
  viewport.set(390);
  const route = window.location.pathname + window.location.search;
  window.history.replaceState(null, "", "/g/0x1ab9/1/map?col=1&row=1");
  try {
    await renderHud();
    const page = () => document.querySelector('[data-page] section[aria-label="Feed"]');
    expect(page()).toBeNull();
    await fromMenu("Feed");
    expect(page()).not.toBeNull();
    const lenses = [...page()!.querySelectorAll('[aria-label="Show"] button')];
    expect(lenses.map((button) => [button.textContent, button.getAttribute("aria-pressed")])).toEqual([
      ["All", "true"],
      ["Important", "false"],
      ["Mine", "false"],
    ]);
    await act(async () => page()!.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click());
    expect(page()).toBeNull();
  } finally {
    window.history.replaceState(null, "", route);
  }
});

it("treats the desktop's Feed as any other panel: closed at start, opened from its place, replaced and closed as the others", async () => {
  // Owner, 30 October 2026: "the feed is opened by default … whereas it should be replaced by season, it works like that
  // for season and research already", "no special rules for feed please".
  viewport.set(1920);
  const route = window.location.pathname + window.location.search;
  const { selectedBuildingHex } = useUIStore.getState();
  await renderHud();
  const panel = () => host.querySelector("[data-right-page]");
  const rail = () => host.querySelector("[data-frontier-rail]")!;
  const leftColumn = () => host.querySelector('aside[aria-label="Realm"]')!;
  const open = (name: string) => Boolean(panel()?.querySelector(`section[aria-label="${name}"]`));
  const place = (name: string) =>
    host.querySelector<HTMLButtonElement>(`nav[aria-label="Places"] button[aria-label="${name}"]`)!;
  const press = (name: string) => act(async () => place(name).click());
  try {
    expect(panel()).toBeNull();
    expect(place("Feed").getAttribute("aria-selected")).toBe("false");
    await press("Feed");
    expect([
      open("Feed"),
      rail().contains(panel()),
      leftColumn().contains(panel()),
      leftColumn().querySelector('[aria-label="Armies"]') !== null,
      place("Feed").getAttribute("aria-selected"),
    ]).toEqual([true, true, false, true, "true"]);
    await press("Season");
    expect([
      open("Feed"),
      open("Season"),
      host.querySelector("[data-wide-page]") === null,
      place("Feed").getAttribute("aria-selected"),
    ]).toEqual([false, true, true, "false"]);
    await press("Season");
    expect(panel()).toBeNull();
    await act(async () =>
      shownStore.applyFacts([{ model: "RaceRules", key: "0xa500", value: wireFact(raceRules()) }] as never),
    );
    await press("Season");
    expect(host.querySelector(`[data-frontier-rail][data-wide="true"] [data-wide-page] ${SEASON_PAGE}`)).not.toBeNull();
    expect(leftColumn().querySelector('[aria-label="Armies"]')).not.toBeNull();
    await press("Season");
    expect(panel()).toBeNull();
    expect(host.querySelector("[data-wide-page]")).toBeNull();
    await press("Feed");
    await press("Feed");
    expect(open("Feed")).toBe(false);
    await press("Feed");
    await act(async () => panel()!.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click());
    expect(panel()).toBeNull();
    await press("Feed");
    await historySettles();
    window.history.replaceState(null, "", "/g/0x1ab9/1/hex?col=1&row=1");
    await act(async () =>
      useUIStore.setState({
        selectedBuildingHex: { structureId: 7, innerCol: BUILDINGS_CENTER[0] + 1, innerRow: BUILDINGS_CENTER[1] },
      }),
    );
    expect([
      open("Feed"),
      host.querySelector('[data-rail-panel] section[aria-label="Build"]') !== null,
      host.querySelector('section[aria-label="Realm"]') !== null,
      place("Feed").getAttribute("aria-selected"),
    ]).toEqual([false, true, true, "false"]);
    await press("Research");
    expect(
      host.querySelector('[data-frontier-rail][data-wide="true"] [data-wide-page] section[aria-label="Research"]'),
    ).not.toBeNull();
    await press("Research");
    expect(host.querySelector("[data-wide-page]")).toBeNull();
  } finally {
    window.history.replaceState(null, "", route);
    await act(async () => useUIStore.setState({ selectedBuildingHex }));
  }
});

it("keeps a refused order in sight on a desktop, over the feed and over a panel the rail holds", async () => {
  const { toast } = await import("@/ui/features/event-feed/notify");
  const { useEventFeedStore } = await import("@/ui/features/event-feed/event-feed-store");
  viewport.set(1920);
  await renderHud();
  const notices = () => host.querySelector('[aria-label="Notices"]');
  try {
    await act(async () => toast.error("Not enough stamina"));
    expect(notices()?.closest("[data-frontier-rail]")).toBeNull();
    const feed = host.querySelector<HTMLButtonElement>('nav[aria-label="Places"] button[aria-label="Feed"]')!;
    await act(async () => feed.click());
    expect(host.querySelector('[data-frontier-rail] [data-right-page] section[aria-label="Feed"]')).not.toBeNull();
    expect(notices()?.textContent).toContain("Not enough stamina");
    const season = host.querySelector<HTMLButtonElement>('nav[aria-label="Places"] button[aria-label="Season"]')!;
    await act(async () => season.click());
    expect(host.querySelector('[data-frontier-rail] [data-right-page] section[aria-label="Season"]')).not.toBeNull();
    expect(notices()?.textContent).toContain("Not enough stamina");
    await act(async () =>
      shownStore.applyFacts([{ model: "RaceRules", key: "0xa500", value: wireFact(raceRules()) }] as never),
    );
    expect(host.querySelector(`[data-frontier-rail] [data-wide-page] ${SEASON_PAGE}`)).not.toBeNull();
    expect(notices()?.textContent).toContain("Not enough stamina");
  } finally {
    useEventFeedStore.getState().dismiss();
  }
});

it("draws Season ranks and depths outside streamed scope", async () => {
  const entry = (rank: number, level: number, depth: number) => ({
    has_wonder: rank === 4,
    address: `0x${(0xa00 + rank).toString(16)}`,
    structure_id: String(900 + rank),
    rank,
    sites_cleared: { total: 10 - rank, camps: 0, rifts: 0, ruins: 0, beasts: 0 },
    chests_earned: 0,
    rewards: { lords: "0", essence: "0", labor: "0" },
    deepest_depth: depth,
    level,
    order: rank,
  });
  const board = {
    game_id: "1",
    mode: "frontier",
    entries: [entry(1, 3, 3), entry(2, 1, 2), entry(3, 0, 0), entry(4, 2, 1)],
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL) =>
      String(url).includes("/leaderboard")
        ? new Response(JSON.stringify(board), { status: 200 })
        : new Response(JSON.stringify({ blocked: [], version: 0 }), { status: 200 }),
    ),
  );
  viewport.set(1920);
  await renderHud();
  for (const entry of board.entries)
    expect(shownStore.get("Structure", { game_id: 1, entity_id: BigInt(entry.structure_id) })).toBeUndefined();
  const season = host.querySelector<HTMLButtonElement>('nav[aria-label="Places"] button[aria-label="Season"]')!;
  await act(async () => season.click());
  await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));
  const badges = [...host.querySelectorAll('section[aria-label="Season"] [role="img"]')]
    .map((badge) => badge.getAttribute("aria-label"))
    .filter((label) => /Settlement|City|Kingdom|Empire/.test(label ?? ""));
  expect(badges).toEqual(["Empire · Deep", "City · Hollow", "Settlement", "Wonder · Kingdom · Veil"]);
  const paintings = [...host.querySelectorAll('section[aria-label="Season"] [role="img"]')]
    .filter((badge) => /Settlement|City|Kingdom|Empire/.test(badge.getAttribute("aria-label") ?? ""))
    .map((badge) => badge.querySelector("img")?.getAttribute("src")?.split("/").pop());
  expect(paintings).toEqual(["realm-3.webp", "realm-1.webp", "realm-0.webp", "wonder-realm-2.webp"]);
});

/**
 * The real HUD with Herald's Frontier board answering `prize`, its Season opened and, on a phone, its folded prizes
 * opened as a player presses them; returns the podium's tiles and words.
 */
const openSeasonWith = async (prize: unknown) => {
  const entry = (address: string, rank: number, sites: number) => ({
    address,
    structure_id: String(900 + rank),
    rank,
    sites_cleared: { total: sites, camps: sites, rifts: 0, ruins: 0, beasts: 0 },
    chests_earned: 0,
    rewards: { lords: "0", essence: "0", labor: "0" },
    deepest_depth: 1,
    level: 1,
    order: rank,
  });
  const board = { game_id: "1", mode: "frontier", entries: [entry("0xa01", 1, 9), entry("0xa02", 2, 0)], prize };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL) =>
      String(url).includes("/leaderboard")
        ? new Response(JSON.stringify(board), { status: 200 })
        : new Response(JSON.stringify({ blocked: [], version: 0 }), { status: 200 }),
    ),
  );
  await renderHud();
  const places = [...host.querySelectorAll<HTMLButtonElement>('nav[aria-label="Places"] button')];
  const seasonButton = places.find((button) => button.getAttribute("aria-label") === "Season");
  if (seasonButton) await act(async () => seasonButton.click());
  else {
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Menu"]')!.click());
    const row = [...document.querySelectorAll<HTMLButtonElement>('section[aria-label="Menu"] button')].find((button) =>
      button.textContent?.startsWith("Season"),
    )!;
    await act(async () => row.click());
  }
  await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));
  const folded = document.querySelector<HTMLButtonElement>(
    'section[aria-label="Season"] button[aria-label="Season prizes"]',
  );
  if (folded) await act(async () => folded.click());
  const podium = document.querySelector('section[aria-label="Season"] ol[aria-label="Season prizes"]');
  return {
    tiles: [...(podium?.querySelectorAll("li[data-place]") ?? [])].map((tile) => tile.textContent),
    words: podium?.textContent ?? null,
  };
};

it.each([390, 1440])(
  "says the season's prize pool is not published yet at %i px, from Herald's board",
  async (width) => {
    viewport.set(width);
    const { tiles, words } = await openSeasonWith(null);
    expect(tiles).toEqual(["2—", "1—", "3—"]);
    expect(words).toContain("Pool not published yet");
  },
);

it.each([390, 1440])(
  "names the season's fixed winners by their receipts at %i px, a place still being awarded",
  async (width) => {
    viewport.set(width);
    // Two places fixed; first paid to 0xa02, who cleared no site and ranks second today, second not yet paid.
    const { tiles } = await openSeasonWith({
      pool: "300",
      top_n: 3,
      count: 2,
      awards: [{ rank: 1, address: "0xa02", lords: "200" }],
    });
    expect(tiles).toHaveLength(2);
    expect(tiles[0]).toBe("2100Pending");
    expect(tiles[1]).toMatch(/^1200/);
    expect(tiles[1]).not.toContain("Open");
  },
);

const okIn = (root: ParentNode) =>
  [...root.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "OK") ?? null;

it.each([390, 1440])(
  "opens Today from the day control at %i px, under the day pill on a desktop or under the phone's bar, the map uncovered",
  async (width) => {
    viewport.set(width);
    await renderHud();
    const day = host.querySelector<HTMLButtonElement>('button[aria-label="Today"]');
    expect(day).not.toBeNull();
    await act(async () => day!.click());
    const sheet = host.querySelector<HTMLElement>('section[aria-label="Today"]');
    expect(sheet).not.toBeNull();
    expect(sheet!.closest(".frontier-day-wrap") !== null).toBe(width >= 1024);
    expect(sheet!.closest(".frontier-phone-today") !== null).toBe(width < 1024);
    expect(host.querySelector('section[aria-label="Realm"]') !== null).toBe(width >= 1024);
    expect(host.querySelector('nav[aria-label="Places"]')).not.toBeNull();
    expect(host.querySelector(".ui-sheet__backdrop")).toBeNull();
    await act(async () => sheet!.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click());
    expect(host.querySelector('section[aria-label="Today"]')).toBeNull();
  },
);

it.each([390, 1440])("opens and closes the Wheat store from its control at %i px", async (width) => {
  viewport.set(width);
  await renderHud();
  if (width < 1024)
    await act(async () => host.querySelector<HTMLButtonElement>(".frontier-bar button.frontier-stock-chips")!.click());
  const scope = width < 1024 ? host.querySelector(".frontier-realm-card")! : host;
  const control = scope.querySelector('[aria-label^="Wheat "]')?.closest("button");
  expect(control).toBeTruthy();
  expect(host.querySelector('section[aria-label="Wheat"]')).toBeNull();
  await act(async () => control!.click());
  expect(host.querySelector('section[aria-label="Wheat"]')).not.toBeNull();
  expect(host.querySelector('section[aria-label="Production"]')).toBeNull();
  await act(async () => control!.click());
  expect(host.querySelector('section[aria-label="Wheat"]')).toBeNull();
});

it("gives a phone Realm beside one layer menu under its pill, whose presses switch the scene and put a page away", async () => {
  viewport.set(390);
  const route = window.location.pathname + window.location.search;
  window.history.replaceState(null, "", "/g/0x1ab9/1/map?col=1&row=1");
  try {
    await renderHud();
    const pill = () => host.querySelector<HTMLButtonElement>("[data-place-pill]")!;
    const placeTab = async (word: string) => {
      if (pill().getAttribute("aria-expanded") === "false") await act(async () => pill().click());
      return document.querySelector<HTMLButtonElement>(
        `[data-surface-deep-switch] [role="tab"][aria-label="${word}"]`,
      )!;
    };
    const placeShown = () => host.querySelector<HTMLElement>("[data-place-switch]")!.dataset.place;
    const realmButton = () => host.querySelector<HTMLButtonElement>('[data-place-switch] button[aria-label="Realm"]')!;
    expect(placeShown()).toBe("Surface");
    expect(document.querySelector("[data-surface-deep-switch]")).toBeNull();
    await act(async () => pill().click());
    expect(
      [...document.querySelectorAll('[data-surface-deep-switch] [role="tab"]')].map((tab) =>
        tab.getAttribute("aria-label"),
      ),
    ).toEqual(["Surface", "Veil", "Hollow", "Deep"]);
    await act(async () => realmButton().click());
    expect(window.location.pathname).toMatch(/\/hex$/);
    expect(document.querySelector("[data-surface-deep-switch]")).toBeNull();
    expect(placeShown()).toBe("Realm");
    expect(host.querySelector('section[aria-label="Realm"]')).toBeNull();
    await act(async () => host.querySelector<HTMLButtonElement>(".frontier-bar button.frontier-stock-chips")!.click());
    expect(host.querySelector('section[aria-label="Realm"]')).not.toBeNull();
    const surface = await placeTab("Surface");
    await act(async () => surface.click());
    expect(window.location.pathname).toMatch(/\/map$/);
    expect(host.querySelector('section[aria-label="Realm"]')).toBeNull();
    await fromMenu("Feed");
    expect(surfaceNamed("Feed")).not.toBeNull();
    await act(async () => realmButton().click());
    expect(window.location.pathname).toMatch(/\/hex$/);
    expect(surfaceNamed("Feed")).toBeNull();
  } finally {
    window.history.replaceState(null, "", route);
  }
});

it("lays a phone's places on its tab bar with no tab for the scene, the place switch alone changing it", async () => {
  viewport.set(390);
  const route = window.location.pathname + window.location.search;
  window.history.replaceState(null, "", "/g/0x1ab9/1/map?col=1&row=1");
  try {
    await renderHud();
    const tabs = () =>
      [...host.querySelectorAll<HTMLButtonElement>('nav[aria-label="Places"] button')].map((button) => [
        button.getAttribute("aria-label"),
        button.getAttribute("aria-current"),
      ]);
    expect(tabs()).toEqual([
      ["Research", null],
      ["Season", null],
      ["Chat", null],
      ["Menu", null],
    ]);
    await pressPlace("Research");
    expect(surfaceNamed("Research")).not.toBeNull();
    expect(tabs()[0]).toEqual(["Research", "page"]);
    await pressPlace("Research");
    expect(surfaceNamed("Research")).toBeNull();
    await fromMenu("Today");
    expect(tabs()[3]).toEqual(["Menu", "page"]);
  } finally {
    window.history.replaceState(null, "", route);
  }
});

it("closes a popover first and the page under it next, one Escape each", async () => {
  viewport.set(390);
  const route = window.location.pathname + window.location.search;
  window.history.replaceState(null, "", "/g/0x1ab9/1/map?col=1&row=1");
  try {
    await renderHud();
    const popovers = () => document.querySelectorAll("[data-hud-popover]").length;
    await pressPlace("Season");
    expect(surfaceNamed("Season")).not.toBeNull();
    await act(async () => host.querySelector<HTMLButtonElement>("[data-place-pill]")!.click());
    expect([popovers(), surfaceNamed("Season") !== null]).toEqual([1, true]);
    const layer = document.querySelector<HTMLElement>("[data-hud-popover]")!;
    await act(async () => layer.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect([popovers(), surfaceNamed("Season") !== null]).toEqual([0, true]);
    await act(async () => document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(surfaceNamed("Season")).toBeNull();
  } finally {
    window.history.replaceState(null, "", route);
  }
});

it("closes the open popover when the player goes from the map to the Realm", async () => {
  viewport.set(1440);
  const route = window.location.pathname + window.location.search;
  window.history.replaceState(null, "", "/g/0x1ab9/1/map?col=1&row=1");
  try {
    await renderHud();
    const popovers = () => document.querySelectorAll("[data-hud-popover]").length;
    await act(async () => host.querySelector<HTMLButtonElement>("[data-place-pill]")!.click());
    expect(popovers()).toBe(1);
    await act(async () => {
      window.history.replaceState(null, "", "/g/0x1ab9/1/hex?col=1&row=1");
      window.dispatchEvent(new Event("urlChanged"));
    });
    expect(popovers()).toBe(0);
  } finally {
    window.history.replaceState(null, "", route);
    window.dispatchEvent(new Event("urlChanged"));
  }
});

const pressPlace = (word: string) =>
  act(async () =>
    [...host.querySelectorAll<HTMLButtonElement>('nav[aria-label="Places"] button')]
      .find((button) => button.getAttribute("aria-label") === word || button.textContent?.endsWith(word))!
      .click(),
  );
const surfaceNamed = (label: string) => document.querySelector<HTMLElement>(`section[aria-label="${label}"]`);
const menuRow = (word: string) =>
  [...surfaceNamed("Menu")!.querySelectorAll<HTMLElement>(".menu-tile")].find(
    (row) => row.getAttribute("aria-label") === word || row.textContent?.startsWith(word),
  )!;

it("opens a phone's Menu as a page in the one frame, which its ×, Escape and Menu close", async () => {
  viewport.set(390);
  const route = window.location.pathname + window.location.search;
  window.history.replaceState(null, "", "/g/0x1ab9/1/map?col=1&row=1");
  try {
    await renderHud();
    const page = () => document.querySelector('[data-page] section[data-kit-frame][aria-label="Menu"]');
    await pressPlace("Menu");
    expect(page()).not.toBeNull();
    expect(document.querySelector(".ui-sheet")).toBeNull();
    await act(async () => page()!.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click());
    expect(page()).toBeNull();
    await pressPlace("Menu");
    await act(async () => document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(page()).toBeNull();
    await pressPlace("Menu");
    await pressPlace("Menu");
    expect(page()).toBeNull();
  } finally {
    window.history.replaceState(null, "", route);
  }
});

it.each([
  ["Feed", "Feed"],
  ["Today", "Today"],
  ["Settings", "Settings"],
])(
  "opens %s from a phone's Menu whichever part of its tile is tapped: its painting or its word",
  async (row, opens) => {
    viewport.set(390);
    const route = window.location.pathname + window.location.search;
    window.history.replaceState(null, "", "/g/0x1ab9/1/map?col=1&row=1");
    try {
      await renderHud();
      const parts = {
        icon: (tile: HTMLElement) => tile.querySelector("[data-icon]")!,
        words: (tile: HTMLElement) => tile.querySelector(".menu-tile__label")!,
      };
      const opened: Record<string, boolean> = {};
      for (const [part, of] of Object.entries(parts)) {
        if (!surfaceNamed("Menu")) await pressPlace("Menu");
        const target = of(menuRow(row));
        await act(async () => target.dispatchEvent(new MouseEvent("click", { bubbles: true })));
        opened[part] = surfaceNamed(opens) !== null && surfaceNamed("Menu") === null;
        await act(async () =>
          surfaceNamed(opens)?.querySelector<HTMLButtonElement>('button[aria-label="Close"]')?.click(),
        );
      }
      expect(opened).toEqual({ icon: true, words: true });
    } finally {
      window.history.replaceState(null, "", route);
    }
  },
);

const fromMenu = async (word: string) => {
  await pressPlace("Menu");
  await act(async () => menuRow(word).click());
};

it("lays a phone's Settings on one page, with what is rarely touched one press away under More", async () => {
  viewport.set(390);
  const route = window.location.pathname + window.location.search;
  window.history.replaceState(null, "", "/g/0x1ab9/1/map?col=1&row=1");
  try {
    await renderHud();
    await fromMenu("Settings");
    const settings = () => surfaceNamed("Settings")!;
    const words = (selector: string) => [...settings().querySelectorAll(selector)].map((part) => part.textContent);
    const press = (word: string) =>
      act(async () =>
        [...settings().querySelectorAll<HTMLButtonElement>("button")]
          .find((button) => button.textContent === word)!
          .click(),
      );
    expect(words(".ui-settings__volume-name")).toEqual(["Master", "Music", "Effects"]);
    expect(words(".ui-settings__choices .ui-setting__name")).toEqual(["Quality"]);
    expect(words(".ui-settings > .ui-setting .ui-setting__name").slice(0, 3)).toEqual([
      "Mute",
      "Shadows",
      "Reduced motion",
    ]);
    expect(words("button")).not.toContain("Leave game");
    await press("More");
    expect(words("section > h2")).toContain("Notifications");
    expect(words("button")).toContain("Leave game");
    expect(words("button")).not.toContain("More");
  } finally {
    window.history.replaceState(null, "", route);
  }
});

const PHONE_SURFACES = {
  research: { label: "Research", open: () => pressPlace("Research") },
  feed: { label: "Feed", open: () => fromMenu("Feed") },
  chat: { label: "Chat", open: () => pressPlace("Chat") },
  menu: { label: "Menu", open: () => pressPlace("Menu") },
  today: { label: "Today", open: () => fromMenu("Today") },
  season: { label: "Season", open: () => pressPlace("Season") },
  settings: { label: "Settings", open: () => fromMenu("Settings") },
  shop: { label: "Shop", open: () => fromMenu("Shop") },
} satisfies Record<
  Exclude<HudSurface, "army" | "army-lost" | "realm">,
  { label: string; open: () => Promise<unknown> }
>;

it.each(Object.entries(PHONE_SURFACES))("stands a phone's %s in the kit's one frame", async (_, { label, open }) => {
  viewport.set(390);
  const route = window.location.pathname + window.location.search;
  window.history.replaceState(null, "", "/g/0x1ab9/1/map?col=1&row=1");
  try {
    await renderHud();
    await open();
    const surface = surfaceNamed(label);
    expect(surface?.hasAttribute("data-kit-frame")).toBe(true);
    expect(surface!.parentElement!.closest(".ui-panel")).toBeNull();
    const outermost = [...document.querySelectorAll("[data-page] .ui-panel")].filter(
      (panel) => !panel.parentElement!.closest(".ui-panel"),
    );
    expect(outermost.every((panel) => panel.hasAttribute("data-kit-frame"))).toBe(true);
    await act(async () => surface!.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click());
    expect(surfaceNamed(label)).toBeNull();
  } finally {
    window.history.replaceState(null, "", route);
  }
});

it("routes the phone Realm panel through the one-panel state so it replaces Today and closes cleanly", async () => {
  viewport.set(390);
  const route = window.location.pathname + window.location.search;
  window.history.replaceState(null, "", "/g/0x1ab9/1/map?col=1&row=1");
  try {
    await renderHud();
    const realmChip = () => host.querySelector<HTMLButtonElement>(".frontier-bar button.frontier-stock-chips")!;
    expect(realmChip().getAttribute("aria-expanded")).toBe("false");
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Today"]')!.click());
    expect(surfaceNamed("Today")).not.toBeNull();
    await act(async () => realmChip().click());
    expect(surfaceNamed("Today")).toBeNull();
    expect(surfaceNamed("Realm")).not.toBeNull();
    expect(realmChip().getAttribute("aria-expanded")).toBe("true");
    await act(async () =>
      surfaceNamed("Realm")!.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click(),
    );
    expect(surfaceNamed("Realm")).toBeNull();
    expect(realmChip().getAttribute("aria-expanded")).toBe("false");
  } finally {
    window.history.replaceState(null, "", route);
  }
});

/** History moves a moment after it is asked to: a closed frame's step back, or the system back, lands by then. */
const historySettles = async () => {
  await act(async () => new Promise((settled) => setTimeout(settled)));
  await act(async () => vi.waitFor(() => expect(stepsBackInFlight, backTraces.join("\n=====\n")).toBe(0)));
};
let stepsBackInFlight = 0;
const browserBack = window.history.back.bind(window.history);
const backTraces: string[] = [];
window.history.back = () => {
  backTraces.push(`${expect.getState().currentTestName} ${window.location.pathname} ${new Error().stack}`);
  stepsBackInFlight += 1;
  browserBack();
};
window.addEventListener("popstate", () => {
  stepsBackInFlight = Math.max(0, stepsBackInFlight - 1);
});
/** The system back, as a phone's back gesture sends it. */
const systemBack = async () => {
  window.history.back();
  await historySettles();
};
/** A phone's HUD in a game reached from another page, so a back that leaves the game lands there. */
const enterFromAnotherPage = async () => {
  viewport.set(390);
  window.history.replaceState({}, "", "/before-the-game");
  window.history.pushState({}, "", "/g/0x1ab9/1/map?col=1&row=1");
  await renderHud();
};
/** The open frame named `label`'s ×, pressed. */
const closeFrame = (label: string) =>
  act(async () => surfaceNamed(label)!.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click());

// Review, 30 October 2026: every page now keeps a history entry, so a page that replaces another in one press (Menu's
// Season) must take over its entry, or the next back lands on an entry no surface owns and does nothing.
it("leaves one back to the page before the game once the Menu's Today is opened and closed", async () => {
  await enterFromAnotherPage();
  await fromMenu("Today");
  expect([surfaceNamed("Today") !== null, surfaceNamed("Menu")]).toEqual([true, null]);
  await closeFrame("Today");
  await historySettles();
  await systemBack();
  expect(window.location.pathname).toBe("/before-the-game");
});

it("closes the Menu's Today with the system back, and the next back leaves the game", async () => {
  await enterFromAnotherPage();
  await fromMenu("Today");
  await historySettles();
  await systemBack();
  expect([surfaceNamed("Today"), surfaceNamed("Menu")]).toEqual([null, null]);
  expect(window.location.pathname).toBe("/g/0x1ab9/1/map");
  await systemBack();
  expect(window.location.pathname).toBe("/before-the-game");
});

it("keeps one entry while the places swap pages, and one back closes the last", async () => {
  await enterFromAnotherPage();
  await fromMenu("Feed");
  for (const place of ["Chat", "Research"]) await pressPlace(place);
  await pressPlace("Menu");
  await historySettles();
  expect(surfaceNamed("Menu")).not.toBeNull();
  await systemBack();
  expect(["Feed", "Chat", "Research", "Menu"].map(surfaceNamed)).toEqual([null, null, null, null]);
  expect(window.location.pathname).toBe("/g/0x1ab9/1/map");
  await systemBack();
  expect(window.location.pathname).toBe("/before-the-game");
});

it("leaves no entry behind however often pages open and close", async () => {
  await enterFromAnotherPage();
  for (let round = 0; round < 3; round++) {
    await pressPlace("Menu");
    await pressPlace("Menu");
    await fromMenu("Today");
    await closeFrame("Today");
    await pressPlace("Season");
    await fromMenu("Feed");
    await closeFrame("Feed");
    await historySettles();
  }
  await systemBack();
  expect(window.location.pathname).toBe("/before-the-game");
});

it("keeps the extended season live past its old end and reloads its final day from fresh facts", async () => {
  const { useChainTimeStore } = await import("@/hooks/store/use-chain-time-store");
  const { useBlockTimestampStore } = await import("@/hooks/store/use-block-timestamp-store");
  const { configManager, setBlockTimestampSource } = await import("@bibliothecadao/eternum");
  // Every read answers empty, the season's end included: its board (entries), and its directory and history (games).
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ blocked: [], entries: [], games: [] })),
  );
  const approved = {
    start: 1792575960,
    oldEnd: 1793151960,
    end: 1793439960,
    seed: "0x5b0a63f717733291c17fc3ecf7ead6e4bd6ae7157150430908152aad0d4ef09",
    dayUnit: 14400,
  };
  let currentTime = approved.start;
  const advance = async (now: number) =>
    act(async () => {
      currentTime = now;
      useChainTimeStore.getState().anchor({ timestamp: now * 1000 });
      useBlockTimestampStore.getState().tick();
    });
  const boot = async (now: number) => {
    await act(async () => root.render(null));
    await act(async () =>
      root.render(
        <MemoryRouter>
          <QueryClientProvider client={new QueryClient()}>
            <LabGame
              mode="frontier"
              facts={(store) => {
                useChainTimeStore.getState().anchor({ timestamp: now * 1000 });
                currentTime = now;
                setBlockTimestampSource(() => currentTime);
                useBlockTimestampStore.setState({ currentBlockTimestamp: now });
                return [
                  {
                    model: "GameRegistry",
                    key: "0x3",
                    value: {
                      ...store.require("GameRegistry", { game_id: 1 }),
                      start_main_at: String(approved.start),
                      start_settling_at: String(approved.start),
                      scheduled_end_at: String(approved.end),
                      end_at: String(approved.end),
                      seed: approved.seed,
                      settled: false,
                    },
                  },
                  {
                    model: "SliceRules",
                    key: "0x100",
                    value: {
                      ...store.require("SliceRules", { game_id: 1 }),
                      day_unit_seconds: approved.dayUnit,
                    },
                  },
                ];
              }}
            >
              {(store) => <FrontierHud seasonOver={SeasonOver} rules={readExpeditionRules(store, 1)!} />}
            </LabGame>
          </QueryClientProvider>
        </MemoryRouter>,
      ),
    );
  };
  viewport.set(1440);
  await boot(approved.oldEnd - 1);
  expect(host.querySelector('[role="timer"]')?.getAttribute("aria-label")).toContain("Day 10");
  await advance(approved.oldEnd);
  expect(host.querySelector('[role="timer"]')?.getAttribute("aria-label")).toContain("Day 11");
  expect(host.textContent).not.toContain("Game finished");
  await boot(approved.oldEnd);
  expect(host.querySelector('[role="timer"]')?.getAttribute("aria-label")).toContain("Day 11");
  expect(host.textContent).not.toContain("Game finished");
  expect(configManager.getSeasonConfig().endAt).toBe(approved.end);
  await boot(approved.end - 1);
  expect(host.querySelector('[role="timer"]')?.getAttribute("aria-label")).toContain("Day 15");
  expect(host.textContent).not.toContain("Game finished");
  await advance(approved.end);
  expect(host.textContent).toContain("Game finished");
  await boot(approved.end);
  expect(host.textContent).toContain("Game finished");
  expect(host.querySelector('button[aria-label="Today"]')).toBeNull();
});

it("tells a spectator on a phone that they are spectating, where a player's purse stands, as the desktop's top bar does", async () => {
  viewport.set(390);
  const route = window.location.pathname + window.location.search;
  window.history.replaceState(null, "", "/g/0x1ab9/1/map?col=1&row=1");
  try {
    await renderHud();
    const spectatingChip = () =>
      [...host.querySelectorAll("button")].find((button) => button.textContent === "Spectating") ?? null;
    expect(spectatingChip()).toBeNull();

    overrideSpectateIntent(true);
    await act(async () => useUIStore.setState({ isSpectating: true }));
    expect(spectatingChip()).not.toBeNull();
  } finally {
    overrideSpectateIntent(false);
    await act(async () => useUIStore.setState({ isSpectating: false }));
    window.history.replaceState(null, "", route);
  }
});

/** The lab's realm 7's neighbour, realm 8 of player 0x222, its own Realm so its name tells it from the player's. */
const neighbour = (store: Parameters<NonNullable<Parameters<typeof LabGame>[0]["facts"]>>[0]) => {
  const own = store.require("Structure", { game_id: 1, entity_id: 7 });
  return { ...own, entity_id: 8n, owner: 0x222n, metadata: { ...own.metadata, realm_id: own.metadata.realm_id + 1 } };
};
const wireRow = (row: unknown) =>
  JSON.parse(JSON.stringify(row, (_, field) => (typeof field === "bigint" ? String(field) : field)));

/**
 * The real Frontier HUD on a visit to realm 8, as the season board's Visit starts it, with `facts` on top of the
 * neighbour's realm; returns the two realms' names.
 */
const renderVisit = async (facts: unknown[] = []) => {
  let names = { own: "", visited: "" };
  visiting.visit = { player: "0x222", structureId: 8, opensOn: null };
  await act(async () =>
    root.render(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient()}>
          <LabGame
            mode="frontier"
            facts={(store) => {
              const visited = neighbour(store);
              names = {
                own: getStructureName(store.require("Structure", { game_id: 1, entity_id: 7 }), store).name,
                visited: getStructureName(visited, store).name,
              };
              return [
                { model: "Structure", key: "0x1ad0", value: wireRow(visited) },
                {
                  model: "RealmKnowledge",
                  key: "0x1ad4",
                  value: wireRow({ game_id: 1, structure_id: 8, learned: "0" }),
                },
                ...facts,
              ] as never;
            }}
          >
            {(store) => <FrontierHud seasonOver={SeasonOver} rules={readExpeditionRules(store, 1)!} />}
          </LabGame>
        </QueryClientProvider>
      </MemoryRouter>,
    ),
  );
  return names;
};

// Owner, 28 October 2026, visiting another realm: "the selected panel doesnt match the actual building". The board
// shows the visited realm, so the realm panel does too, never the player's own.
it("shows the visited realm on the desktop top bar without duplicating the player's own identity", async () => {
  viewport.set(1440);
  try {
    const names = await renderVisit();
    const card = host.querySelector('section[aria-label="Realm"]')!;
    expect(names.visited).not.toBe(names.own);
    expect(card.querySelector(".frontier-realm-card__name")?.textContent).toBe(names.visited);
    expect(host.textContent).not.toContain(names.own);
    expect(card.querySelector('[aria-label="Stores"]')).not.toBeNull();
    expect(card.querySelector("[data-realm-castle]")).toBeNull();
  } finally {
    visiting.visit = null;
  }
});

/** A building on a realm's plot, as Herald streams it. */
const standing = (key: string, realmId: number, category: number) => ({
  model: "Building",
  key,
  value: {
    game_id: 1,
    structure_id: String(realmId),
    inner_col: 11,
    inner_row: 10,
    category,
    paused: false,
    labor_paid: "0",
  },
});

/**
 * On a visit to realm 8, whose plot (11, 10) holds a Barracks where the player's holds a Supply yard, the plot `at` of
 * the board tapped: the card it opens, by its title, and its controls.
 */
const tapOnVisit = async (width: number, at: { innerCol: number; innerRow: number }) => {
  viewport.set(width);
  const { isSpectating, structureEntityId, selectedBuildingHex } = useUIStore.getState();
  const route = window.location.pathname + window.location.search;
  window.history.replaceState(null, "", "/g/0x1ab9/1/hex?col=1&row=1");
  try {
    await renderVisit([
      standing("0x1ae0", 7, BuildingType.SupplyYard),
      standing("0x1ae1", 8, BuildingType.ResourceKnightT1),
    ]);
    await act(async () =>
      useUIStore.setState({ isSpectating: true, structureEntityId: 8, selectedBuildingHex: { structureId: 8, ...at } }),
    );
    const card = host.querySelector("[data-kit-sheet]");
    return {
      title: card?.getAttribute("aria-label"),
      controls: [...(card?.querySelectorAll("button") ?? [])].map(
        (each) => each.getAttribute("aria-label") ?? each.textContent,
      ),
    };
  } finally {
    visiting.visit = null;
    window.history.replaceState(null, "", route);
    await act(async () => useUIStore.setState({ isSpectating, structureEntityId, selectedBuildingHex }));
  }
};

// The building the board draws and its hover names, read as it stands: the Barracks, never the player's Supply yard on
// the same plot, with nothing to order (owner, 28 October 2026: "the selected panel doesnt match the actual building").
it.each([
  ["desktop", 1440],
  ["phone", 390],
])("opens the visited realm's building on a %s's tap, read as it stands, never the player's own", async (_, width) => {
  expect(buildingName(BuildingType.ResourceKnightT1)).not.toBe(buildingName(BuildingType.SupplyYard));
  expect(await tapOnVisit(width, { innerCol: 11, innerRow: 10 })).toEqual({
    title: buildingName(BuildingType.ResourceKnightT1),
    controls: ["Close"],
  });
});

it.each([
  ["desktop", 1440],
  ["phone", 390],
])("opens the visited realm's castle on a %s's tap with no Upgrade and no research", async (_, width) => {
  const { title, controls } = await tapOnVisit(width, { innerCol: 10, innerRow: 10 });
  expect(title).toBe("Castle");
  expect(controls).toEqual(["Close"]);
});

/** The service worker's word to this window when a chat alert is pressed: what to open. */
const pressAlert = (kind: "mention" | "direct-message", target: string, tag: string) =>
  act(async () =>
    (navigator as unknown as { serviceWorker: EventTarget }).serviceWorker.dispatchEvent(
      new MessageEvent("message", { data: { type: "chat-alert-pressed", kind, target, tag } }),
    ),
  );
const chatOpen = () => host.querySelector('input[aria-label="Message"]') !== null;

it("opens chat on Global over the game when a mention's alert is pressed, the game left as it was, desktop and phone", async () => {
  Object.defineProperty(navigator, "serviceWorker", { value: new EventTarget(), configurable: true });
  const route = window.location.pathname + window.location.search;
  window.history.replaceState(null, "", "/g/0x1ab9/1/map?col=1&row=1");
  try {
    for (const width of [1440, 390]) {
      viewport.set(width);
      await renderHud();
      await act(async () => useRealtimeChatStore.getState().actions.showMessages());
      expect(chatOpen()).toBe(false);
      const places = host.querySelector('nav[aria-label="Places"]') !== null;
      await pressAlert("mention", "/chat", "mention:global");
      expect(chatOpen()).toBe(true);
      expect(useRealtimeChatStore.getState().view).toEqual({ kind: "room", zoneId: "world:global" });
      expect(host.querySelector('nav[aria-label="Places"]') !== null).toBe(places);
      act(() => root.unmount());
      root = createRoot(host);
    }
  } finally {
    window.history.replaceState(null, "", route);
    Reflect.deleteProperty(navigator, "serviceWorker");
  }
});

it("keeps chat shut for a signed-out player on a desktop: Enter opens nothing and the strip asks to sign in", async () => {
  identity.status = "signed-out";
  const requested = vi.fn();
  signIn.request = requested;
  viewport.set(1440);
  try {
    await renderHud();
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" })));
    expect([chatOpen(), host.querySelector("[data-chat-pane]")]).toEqual([false, null]);
    await act(async () =>
      host.querySelector<HTMLButtonElement>('.frontier-chat-dock button[aria-label="Chat strip"]')!.click(),
    );
    expect(requested).toHaveBeenCalledOnce();
    expect(host.querySelector("[data-chat-pane]")).toBeNull();
  } finally {
    identity.status = "signed-in";
    signIn.request = () => {};
  }
});

it("lights a plot on the player's own board for its first build, the Barracks, and none on a realm they visit", async () => {
  await renderHud();
  const own = useUIStore.getState().firstBuild;
  try {
    await renderVisit();
    expect(useUIStore.getState().firstBuild).toBeNull();
  } finally {
    visiting.visit = null;
  }
  await renderHud();
  expect(useUIStore.getState().firstBuild).toBe(own);
  expect(own).toBe(BuildingType.ResourceKnightT1);
});

it.each([1440, 390])("keeps the armies dock visible in both map and Realm views at %i px", async (width) => {
  viewport.set(width);
  const route = window.location.pathname + window.location.search;
  window.history.replaceState(null, "", "/g/0x1ab9/1/map?col=1&row=1");
  try {
    await renderHud();
    expect(host.querySelector('[aria-label="Armies"]')).not.toBeNull();
    if (width >= 1024) {
      expect(host.querySelector('aside[aria-label="Realm"] [aria-label="Armies"]')).not.toBeNull();
    }
    await act(async () => {
      window.history.replaceState(null, "", "/g/0x1ab9/1/hex?col=1&row=1");
      window.dispatchEvent(new Event("urlChanged"));
    });
    expect(host.querySelector('[aria-label="Armies"]')).not.toBeNull();
    if (width >= 1024) {
      expect(host.querySelector('aside[aria-label="Realm"] [aria-label="Armies"]')).not.toBeNull();
    }
  } finally {
    window.history.replaceState(null, "", route);
  }
});

it("keeps Chat reachable from its strip at the bottom right while visiting another realm", async () => {
  viewport.set(1440);
  try {
    await renderVisit();
    const chat = host.querySelector<HTMLButtonElement>('.frontier-chat-dock button[aria-label="Chat strip"]');
    expect(chat).not.toBeNull();
    expect(host.querySelector('nav[aria-label="Places"] button[aria-label="Research"]')).toBeNull();
    await act(async () => chat!.click());
    expect(chatOpen()).toBe(true);
  } finally {
    visiting.visit = null;
  }
});

it("orders the desktop places as Research, Feed, Season, Settings, sets Realm beside the four layers' menu, and returns to Realm on the crest", async () => {
  viewport.set(1440);
  const route = window.location.pathname + window.location.search;
  window.history.replaceState(null, "", "/g/0x1ab9/1/map?col=1&row=1");
  try {
    await renderHud();
    const labels = [...host.querySelectorAll('nav[aria-label="Places"] button')].map((button) =>
      button.getAttribute("aria-label"),
    );
    expect(labels).toEqual(["Research", "Feed", "Season", "Settings"]);
    expect(host.querySelector('button[aria-label="Relics"]')).toBeNull();
    await act(async () => host.querySelector<HTMLButtonElement>("[data-place-pill]")!.click());
    const placeTabs = [...document.querySelectorAll('[aria-label="Map view"] :is([role="tab"], [aria-pressed])')].map(
      (tab) => tab.getAttribute("aria-label"),
    );
    expect(placeTabs).toEqual(["Realm", "Surface", "Veil", "Hollow", "Deep"]);
    await act(async () => host.querySelector<HTMLButtonElement>("[data-place-pill]")!.click());
    const crest = host.querySelector<HTMLButtonElement>(".frontier-realm-card__identity")!;
    expect(crest.querySelector('img[src*="portraits"]')).toBeNull();
    await act(async () => crest.click());
    expect(window.location.pathname).toMatch(/\/hex$/);
  } finally {
    window.history.replaceState(null, "", route);
  }
});

it("opens nothing in the desktop rail as the player enters the Realm: Build waits for a plot pressed", async () => {
  viewport.set(1440);
  const route = window.location.pathname + window.location.search;
  window.history.replaceState(null, "", "/g/0x1ab9/1/map?col=1&row=1");
  const buildSheet = () => document.querySelector('[data-rail-panel] [data-kit-sheet][aria-label="Build"]');
  try {
    await renderHud();
    expect(buildSheet()).toBeNull();
    await act(async () => host.querySelector<HTMLButtonElement>(".frontier-realm-card__identity")!.click());
    expect(window.location.pathname).toMatch(/\/hex$/);
    expect(buildSheet()).toBeNull();
    expect(useUIStore.getState().selectedBuildingHex).toBeNull();
  } finally {
    act(() => useUIStore.getState().setSelectedBuildingHex(null));
    window.history.replaceState(null, "", route);
  }
});

it("opens Shop from the 1440 px top bar Fragments socket once Fragments are held", async () => {
  viewport.set(1440);
  const route = window.location.pathname + window.location.search;
  window.history.replaceState(null, "", "/g/0x1ab9/1/map?col=1&row=1");
  try {
    await renderHud();
    const owner = shownStore.require("Structure", { game_id: 1, entity_id: 7 }).owner;
    await act(async () =>
      shownStore.applyFacts([
        {
          model: "Fragments",
          key: "0xf99",
          value: { game_id: 1, account: String(owner), balance: "250" },
        },
      ] as never),
    );
    const fragmentsButton = host.querySelector<HTMLButtonElement>('button[aria-label="Fragments 250"]');
    expect(fragmentsButton).not.toBeNull();
    await act(async () => fragmentsButton!.click());
    expect(document.querySelector('[aria-label="Shop"]')).not.toBeNull();
  } finally {
    window.history.replaceState(null, "", route);
  }
});

it("moves to the World map at the Deep hex when Go to Deep is pressed from the Realm view, dives on the map, and hides Go to Deep once the season ends", async () => {
  const route = window.location.pathname + window.location.search;
  const requested: LayerViewRequest[] = [];
  const onRequest = (event: Event) => requested.push((event as CustomEvent<LayerViewRequest>).detail);
  window.addEventListener(LAYER_VIEW_REQUEST_EVENT, onRequest);
  const drawRace = async (finished: boolean, onClose: () => void) => {
    const scenario = raceScenario(finished);
    scenario.store.setSnapshot({ gameId: 1, actor: scenario.player, timestamp: scenario.startsAt, complete: true });
    configManager.setActiveGame(1);
    setActiveGame({ chainId: "SHARD", gameId: 1, name: "SHARD" });
    configManager.setStore(scenario.store);
    setBlockTimestampSource(() => scenario.startsAt);
    useAccountStore.setState({ account: { address: scenario.player } as never });
    await act(async () =>
      root.render(
        <QueryClientProvider client={new QueryClient()}>
          <GameProvider
            value={{ store: scenario.store } as unknown as GameClientSetup}
            account={{ address: scenario.player } as never}
          >
            <FrontierAspectPage onClose={onClose} />
          </GameProvider>
        </QueryClientProvider>,
      ),
    );
    return scenario;
  };
  const goToDeep = () =>
    [...host.querySelectorAll<HTMLButtonElement>(`${SEASON_PAGE} button`)].find((button) =>
      button.textContent?.includes(ASPECT_PAGE_WORDS.goToDeep),
    );
  try {
    window.history.replaceState(null, "", "/g/0x1ab9/1/hex?col=1&row=1");
    window.dispatchEvent(new Event("urlChanged"));
    const onClose = vi.fn();
    const active = await drawRace(false, onClose);
    const spacing = active.store.require("SettlementRules", { game_id: 1 }).spacing;
    const deepTarget = deepViewFor(active.store, 1, 7n, spacing);
    const expectedHex = mapRouteHex(Position.fromContract({ x: deepTarget.col, y: deepTarget.row }));

    await act(async () => goToDeep()!.click());
    expect(window.location.pathname).toBe("/g/0x1ab9/1/map");
    expect(window.location.search).toBe(`?col=${expectedHex.col}&row=${expectedHex.row}`);
    expect(requested).toEqual([]);
    expect(onClose).toHaveBeenCalledTimes(1);

    await act(async () => goToDeep()!.click());
    expect(requested).toEqual([deepTarget]);
    expect(onClose).toHaveBeenCalledTimes(2);

    await drawRace(true, onClose);
    expect(host.querySelector("[data-season-board]")).not.toBeNull();
    expect(goToDeep()).toBeUndefined();
  } finally {
    setBlockTimestampSource(null);
    window.removeEventListener(LAYER_VIEW_REQUEST_EVENT, onRequest);
    window.history.replaceState(null, "", route);
    window.dispatchEvent(new Event("urlChanged"));
  }
});

it.each([
  ["desktop", 1440],
  ["phone", 390],
] as const)(
  "keeps the active tutorial visible on %s (%i px) across view switches and army selection, confirms completion, and persists across reload",
  async (layout, width) => {
    const { useBlockTimestampStore } = await import("@/hooks/store/use-block-timestamp-store");
    const { OPENING_WORDS } = await import("@/ui/design-system/kit/words");
    const { clearConfirmedTutorial, useOpeningStore } = await import("./opening/opening-store");
    const { entityHomeNamespace, expeditionRealmSite, setBuildingCount } = await import("@bibliothecadao/eternum");
    const { nativeResearchConstants } = await import("@bibliothecadao/eternum/game-client");
    const { ResourcesIds, TileOccupier, RESOURCE_PRECISION } = await import("@bibliothecadao/types");
    const { default: rowFixture } =
      await import("../../../../../../contracts/l3/world-native/schema/fixtures/row-set.json");
    const [packed1, packed2, packed3] = setBuildingCount(BuildingType.ResourceKnightT1, [0n, 0n, 0n], 1);
    const previousTicks = {
      currentBlockTimestamp: useBlockTimestampStore.getState().currentBlockTimestamp,
      currentDefaultTick: useBlockTimestampStore.getState().currentDefaultTick,
      currentArmiesTick: useBlockTimestampStore.getState().currentArmiesTick,
    };
    useBlockTimestampStore.setState({ currentBlockTimestamp: 350, currentDefaultTick: 350, currentArmiesTick: 350 });

    const route = window.location.pathname + window.location.search;
    viewport.set(width);
    localStorage.clear();
    useOpeningStore.setState({
      owner: null,
      loaded: false,
      status: "signed-out",
      reached: new Set(),
      seen: new Set(),
      unsent: { reached: new Set(), seen: new Set() },
      showing: null,
      confirmed: null,
      onDevice: false,
    });

    let siteHex = { col: 2, row: 2 };
    const mountTutorialHud = async (explored = false) => {
      await act(async () => root.render(null));
      await act(async () =>
        root.render(
          <MemoryRouter>
            <QueryClientProvider client={new QueryClient()}>
              <LabGame
                mode="frontier"
                facts={(store) => {
                  const baseRules = readExpeditionRules(store, 1)!;
                  const longRules = { ...baseRules, dayUnitSeconds: 3_600, endAt: 200_000, scheduledEndAt: 200_000 };
                  siteHex = expeditionRealmSite(longRules, entityHomeNamespace(7n), 350)!;
                  const facts: unknown[] = [
                    ...sellingFragments(store),
                    {
                      model: "GameRegistry",
                      key: "0x3",
                      value: wireRow({
                        ...store.require("GameRegistry", { game_id: 1 }),
                        end_at: "200000",
                        scheduled_end_at: "200000",
                      }),
                    },
                    {
                      model: "SliceRules",
                      key: "0x100",
                      value: wireRow({
                        ...store.require("SliceRules", { game_id: 1 }),
                        day_unit_seconds: 3_600,
                      }),
                    },
                    { model: "HomeAspect", key: "0x8a01", value: { game_id: 1, home: "7", aspect: 1 } },
                    standing("0x8a02", 7, BuildingType.ResourceKnightT1),
                    {
                      model: "StructureBuildings",
                      key: "0xb7",
                      value: {
                        game_id: 1,
                        entity_id: "7",
                        packed_counts_1: String(packed1),
                        packed_counts_2: String(packed2),
                        packed_counts_3: String(packed3),
                        population: { current: 2, max: 6 },
                      },
                    },
                    {
                      model: "ResourceProduction",
                      key: "0x8a0a",
                      value: {
                        game_id: 1,
                        entity_id: 7,
                        resource_type: ResourcesIds.Knight,
                        building_count: 1,
                        production_rate: String(RESOURCE_PRECISION),
                        output_amount_left: "0",
                        last_settled_at: 350,
                        remainder: 0,
                      },
                    },
                    {
                      model: "TileOpt",
                      key: "0x8a04",
                      value: { game_id: 1, alt: false, col: siteHex.col, row: siteHex.row, data: "0" },
                    },
                    {
                      model: "ExplorerTroops",
                      key: "0x8a05",
                      value: {
                        game_id: 1,
                        explorer_id: 70,
                        owner: 7,
                        troops: {
                          ...rowFixture.expected.value.troops,
                          count: String(100n * BigInt(RESOURCE_PRECISION)),
                          stamina: { Inline: { amount: "100", settled_at: "360", remainder: 0 } },
                        },
                      },
                    },
                    { model: "ArmyDay", key: "0x8a06", value: { game_id: 1, explorer_id: 70, day: 0 } },
                    {
                      model: "ArmyProgress",
                      key: "0x8a09",
                      value: {
                        game_id: 1,
                        explorer_id: 70,
                        logistics: 0,
                        oath_slots: nativeResearchConstants.OATH_SLOTS_BASE,
                        oaths: 0,
                        oath_pick: 0,
                      },
                    },
                    {
                      model: "TileOccupancy",
                      key: "0x8a07",
                      value: {
                        game_id: 1,
                        alt: false,
                        col: siteHex.col + 1,
                        row: siteHex.row,
                        entity_id: 70,
                        category: TileOccupier.ExplorerKnightT1,
                        is_structure: false,
                      },
                    },
                  ];
                  if (explored) {
                    facts.push({
                      model: "TileOpt",
                      key: "0x8a08",
                      value: { game_id: 1, alt: false, col: siteHex.col + 2, row: siteHex.row, data: "0" },
                    });
                  }
                  return facts;
                }}
              >
                {(store) => {
                  shownStore = store;
                  return <FrontierHud seasonOver={SeasonOver} rules={readExpeditionRules(store, 1)!} />;
                }}
              </LabGame>
            </QueryClientProvider>
          </MemoryRouter>,
        ),
      );
      await act(async () => new Promise((settled) => setTimeout(settled, 20)));
    };

    try {
      window.history.replaceState(null, "", "/g/0x1ab9/1/hex?col=2&row=2");
      await mountTutorialHud(false);

      expect(useOpeningStore.getState().showing).toBe("explore");
      const initialDock = host.querySelector<HTMLElement>(
        '[data-tutorial-dock="explore"][data-tutorial-status="showing"]',
      );
      expect(initialDock).not.toBeNull();
      expect(initialDock?.dataset.tutorialLayout).toBe(layout);
      expect(initialDock?.dataset.tutorialForm).toBe("card");
      expect(initialDock?.querySelector(".emissary-dock__action")?.textContent).toContain(
        OPENING_WORDS.actions.explore,
      );

      await act(async () => {
        window.history.replaceState(null, "", "/g/0x1ab9/1/map?col=2&row=2");
        window.dispatchEvent(new Event("urlChanged"));
      });
      expect(useOpeningStore.getState().showing).toBe("explore");
      expect(host.querySelector('[data-tutorial-dock="explore"][data-tutorial-status="showing"]')).not.toBeNull();

      const armyButton = host.querySelector<HTMLButtonElement>('[aria-label="Armies"] button');
      expect(armyButton).not.toBeNull();
      await act(async () => armyButton!.click());
      if (layout === "desktop") {
        expect(host.querySelector('[data-rail-panel] section[aria-label="100 Knights"]')).not.toBeNull();
      }
      expect(useOpeningStore.getState().showing).toBe("explore");
      expect(host.querySelector('[data-tutorial-dock="explore"][data-tutorial-status="showing"]')).not.toBeNull();

      await act(async () =>
        shownStore.applyFacts([
          {
            model: "TileOpt",
            key: "0x8a08",
            value: { game_id: 1, alt: false, col: siteHex.col + 2, row: siteHex.row, data: "0" },
          },
        ] as never),
      );
      await act(async () => new Promise((settled) => setTimeout(settled, 20)));

      const confirmed = host.querySelector<HTMLElement>(
        '[data-tutorial-dock="explore"][data-tutorial-status="completed"]',
      );
      expect(confirmed).not.toBeNull();
      expect(confirmed?.textContent).toContain(OPENING_WORDS.completed.explore.title);

      const closeConfirmed = okIn(confirmed!);
      if (layout === "desktop") {
        expect(closeConfirmed).not.toBeNull();
        await act(async () => closeConfirmed!.click());
      } else {
        expect(closeConfirmed).toBeNull();
        await act(async () => clearConfirmedTutorial());
      }
      const raceNext = host.querySelector<HTMLElement>(
        '[data-tutorial-dock="aspects"][data-tutorial-status="showing"]',
      );
      expect(raceNext?.textContent).toContain(OPENING_WORDS.titles.aspects());
      await act(async () => okIn(raceNext!)!.click());
      expect(host.querySelector("[data-tutorial-dock]")).toBeNull();

      await act(async () => {
        window.history.replaceState(null, "", "/g/0x1ab9/1/hex?col=2&row=2");
        window.dispatchEvent(new Event("urlChanged"));
      });
      expect(host.querySelector("[data-tutorial-dock]")).toBeNull();

      useOpeningStore.setState({
        owner: null,
        loaded: false,
        status: "signed-out",
        reached: new Set(),
        seen: new Set(),
        unsent: { reached: new Set(), seen: new Set() },
        showing: null,
        confirmed: null,
        onDevice: false,
      });
      await mountTutorialHud(false);
      expect(host.querySelector("[data-tutorial-dock]")).toBeNull();
    } finally {
      useBlockTimestampStore.setState(previousTicks);
      localStorage.clear();
      window.history.replaceState(null, "", route);
      window.dispatchEvent(new Event("urlChanged"));
    }
  },
);

it("shows the day-end tutorial once in the last hour with own Aspect and reads non-zero Barracks output on a fresh realm", async () => {
  const { formatRate } = await import("@bibliothecadao/types");
  const { useBlockTimestampStore } = await import("@/hooks/store/use-block-timestamp-store");
  const { OPENING_WORDS } = await import("@/ui/design-system/kit/words");
  const { buildingOutput } = await import("@/ui/shared/lib/building-output");
  const { clearConfirmedTutorial, useOpeningStore } = await import("./opening/opening-store");
  const previousTicks = {
    currentBlockTimestamp: useBlockTimestampStore.getState().currentBlockTimestamp,
    currentDefaultTick: useBlockTimestampStore.getState().currentDefaultTick,
    currentArmiesTick: useBlockTimestampStore.getState().currentArmiesTick,
  };
  useBlockTimestampStore.setState({ currentBlockTimestamp: 350, currentDefaultTick: 350, currentArmiesTick: 350 });

  const route = window.location.pathname + window.location.search;
  viewport.set(390);
  localStorage.clear();
  const resetMemory = () =>
    useOpeningStore.setState({
      owner: null,
      loaded: false,
      status: "signed-out",
      reached: new Set(),
      seen: new Set(),
      unsent: { reached: new Set(), seen: new Set() },
      showing: null,
      confirmed: null,
      onDevice: false,
    });

  let shownStore: NativeFactStore | null = null;
  const mountWithDayUnit = async (dayUnitSeconds: number) => {
    await act(async () => root.render(null));
    await act(async () =>
      root.render(
        <MemoryRouter>
          <QueryClientProvider client={new QueryClient()}>
            <LabGame
              mode="frontier"
              facts={(store) => [
                {
                  model: "GameRegistry",
                  key: "0x3",
                  value: wireRow({
                    ...store.require("GameRegistry", { game_id: 1 }),
                    end_at: "200000",
                    scheduled_end_at: "200000",
                  }),
                },
                {
                  model: "SliceRules",
                  key: "0x100",
                  value: wireRow({
                    ...store.require("SliceRules", { game_id: 1 }),
                    day_unit_seconds: dayUnitSeconds,
                  }),
                },
                { model: "HomeAspect", key: "0x8a01", value: { game_id: 1, home: "7", aspect: 1 } },
              ]}
            >
              {(store) => {
                shownStore = store;
                return <FrontierHud seasonOver={SeasonOver} rules={readExpeditionRules(store, 1)!} />;
              }}
            </LabGame>
          </QueryClientProvider>
        </MemoryRouter>,
      ),
    );
    await act(async () => new Promise((settled) => setTimeout(settled, 20)));
  };

  try {
    window.history.replaceState(null, "", "/g/0x1ab9/1/hex?col=2&row=2");
    resetMemory();
    await mountWithDayUnit(3_600);
    const barracksDock = host.querySelector<HTMLElement>('[data-tutorial-dock="barracks"]');
    expect(barracksDock).not.toBeNull();
    const expectedRate = formatRate(
      buildingOutput(
        shownStore!,
        shownStore!.require("Structure", { game_id: 1, entity_id: 7 }),
        BuildingType.ResourceKnightT1,
        0,
      ).total,
    );
    expect(expectedRate).not.toBe("0/min");
    expect(barracksDock?.textContent).toContain(`${expectedRate} Knights`);

    resetMemory();
    localStorage.clear();
    await act(async () => {
      const { seeLine } = await import("./opening/opening-store");
      await seeLine("barracks");
      await seeLine("deploy");
      await seeLine("explore");
    });
    await mountWithDayUnit(100);
    const dayEndDock = host.querySelector<HTMLElement>(
      '[data-tutorial-dock="day-end"][data-tutorial-status="showing"]',
    );
    expect(dayEndDock).not.toBeNull();
    expect(dayEndDock?.dataset.tutorialAspect).toBe("1");
    const { OPENING_RULES } = await import("./opening/opening-fixtures");
    expect(dayEndDock?.textContent).toContain(
      OPENING_WORDS.titles["day-end"]({ ...OPENING_RULES, dayLeftSeconds: 60 }),
    );
    expect(dayEndDock?.dataset.tutorialForm).toBe("card");
    expect(dayEndDock?.textContent).toContain(OPENING_WORDS.lines["day-end"]());

    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Today"]')!.click());
    await act(async () => new Promise((settled) => setTimeout(settled, 20)));
    expect(useOpeningStore.getState().confirmed).toBe("day-end");
    await act(async () =>
      document.querySelector<HTMLButtonElement>('section[aria-label="Today"] button[aria-label="Close"]')!.click(),
    );
    const dayEndConfirmed = host.querySelector<HTMLElement>(
      '[data-tutorial-dock="day-end"][data-tutorial-status="completed"]',
    );
    expect(dayEndConfirmed).not.toBeNull();
    expect(dayEndConfirmed!.querySelector('button[aria-label="Close"]')).toBeNull();
    await act(async () => clearConfirmedTutorial());
    expect(host.querySelector('[data-tutorial-dock="day-end"]')).toBeNull();

    resetMemory();
    await mountWithDayUnit(100);
    expect(host.querySelector('[data-tutorial-dock="day-end"]')).toBeNull();
  } finally {
    useBlockTimestampStore.setState(previousTicks);
    localStorage.clear();
    window.history.replaceState(null, "", route);
    window.dispatchEvent(new Event("urlChanged"));
  }
});

it.each([1920, 390])(
  "opens the real Deep race scenario on the Deep lesson at %d px with Research still waiting on Essence, tells each line once, and stays clear after reload",
  async (width) => {
    const { useBlockTimestampStore } = await import("@/hooks/store/use-block-timestamp-store");
    const { useOpeningStore } = await import("./opening/opening-store");
    const previousTicks = {
      currentBlockTimestamp: useBlockTimestampStore.getState().currentBlockTimestamp,
      currentDefaultTick: useBlockTimestampStore.getState().currentDefaultTick,
      currentArmiesTick: useBlockTimestampStore.getState().currentArmiesTick,
    };
    const route = window.location.pathname + window.location.search;
    viewport.set(width);
    localStorage.clear();
    const resetMemory = () =>
      useOpeningStore.setState({
        owner: null,
        loaded: false,
        status: "signed-out",
        reached: new Set(),
        seen: new Set(),
        unsent: { reached: new Set(), seen: new Set() },
        showing: null,
        confirmed: null,
        onDevice: false,
      });

    const mountRace = async () => {
      const scenario = raceScenario(false);
      scenario.store.setSnapshot({ gameId: 1, actor: scenario.player, timestamp: scenario.startsAt, complete: true });
      configManager.setActiveGame(1);
      configManager.setStore(scenario.store);
      setBlockTimestampSource(() => scenario.startsAt);
      useBlockTimestampStore.setState({
        currentBlockTimestamp: scenario.startsAt,
        currentDefaultTick: scenario.startsAt,
        currentArmiesTick: scenario.startsAt,
      });
      useAccountStore.setState({ account: { address: scenario.player } as never });
      await act(async () => root.render(null));
      await act(async () =>
        root.render(
          <MemoryRouter>
            <QueryClientProvider client={new QueryClient()}>
              <GameProvider
                value={{ store: scenario.store } as unknown as GameClientSetup}
                account={{ address: scenario.player } as never}
              >
                <FrontierHud seasonOver={SeasonOver} rules={readExpeditionRules(scenario.store, 1)!} />
              </GameProvider>
            </QueryClientProvider>
          </MemoryRouter>,
        ),
      );
      await act(async () => new Promise((settled) => setTimeout(settled, 20)));
    };

    try {
      window.history.replaceState(null, "", "/g/0x1ab9/1/map?col=50&row=350");
      window.dispatchEvent(new Event("urlChanged"));
      resetMemory();
      await mountRace();

      const deepDock = host.querySelector<HTMLElement>('[data-tutorial-dock="deep"][data-tutorial-status="showing"]');
      expect(deepDock).not.toBeNull();
      expect(deepDock?.textContent).toContain("Hold sites to earn");
      const places = [...(host.querySelector('nav[aria-label="Places"]')?.querySelectorAll("button") ?? [])].map(
        (node) => node.getAttribute("aria-label") ?? node.textContent ?? "",
      );
      expect(places).toContain("Season");
      expect(places).not.toContain("Research");

      const told: string[] = [];
      for (let attempt = 0; attempt < 16; attempt += 1) {
        const dock = host.querySelector<HTMLElement>("[data-tutorial-dock]");
        if (!dock) break;
        told.push(dock.dataset.tutorialDock ?? "");
        await act(async () => okIn(dock)!.click());
        await act(async () => new Promise((settled) => setTimeout(settled, 20)));
      }
      expect(told[0]).toBe("deep");
      expect(told.length).toBeGreaterThanOrEqual(2);
      expect(new Set(told).size).toBe(told.length);

      resetMemory();
      await mountRace();
      expect(host.querySelector("[data-tutorial-dock]")).toBeNull();
    } finally {
      useBlockTimestampStore.setState(previousTicks);
      localStorage.clear();
      window.history.replaceState(null, "", route);
      window.dispatchEvent(new Event("urlChanged"));
    }
  },
);
