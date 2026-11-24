// @vitest-environment jsdom
import { SeasonOver } from "@/shell/season-tab/season-over";
import { mapRouteHex } from "@/play/navigation/play-route";
import { LAYER_VIEW_REQUEST_EVENT, type LayerViewRequest } from "@/three/scenes/worldmap-layer-request";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { useWorldAppearanceStore } from "@/hooks/store/use-world-appearance-store";
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
vi.mock("@/hooks/context/identity-session", async (original) => ({
  ...(await original<typeof import("@/hooks/context/identity-session")>()),
  useIdentitySession: () => ({
    status: "signed-in",
    session: { user: { id: "u1", realmsId: "", name: "uxplay", email: "uxplay@example.com", address: "0x7" } },
  }),
}));
vi.mock("@/shell/sign-in/connect", () => ({ useRequestSignIn: () => vi.fn() }));
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
  RealtimeChatOnline: () => null,
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

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // These tests play the whole HUD; the opening interface has its own tests.
  useWorldAppearanceStore.setState({ showEverything: true });
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
  await new Promise((settled) => setTimeout(settled, 20));
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
    expect(chatReading()).toEqual({ connected: true, unread: "" });
    expect(host.querySelector('[aria-label="Unread chat messages: 3"][data-dot]')).not.toBeNull();

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
  const panel = () => host.querySelector("[data-realm-slot]");
  const open = (name: string) => Boolean(panel()?.querySelector(`section[aria-label="${name}"]`));
  const place = (name: string) =>
    host.querySelector<HTMLButtonElement>(`nav[aria-label="Places"] button[aria-label="${name}"]`)!;
  const press = (name: string) => act(async () => place(name).click());
  try {
    expect(panel()!.childElementCount).toBe(0);
    expect(place("Feed").getAttribute("aria-selected")).toBe("false");
    await press("Feed");
    expect([open("Feed"), place("Feed").getAttribute("aria-selected")]).toEqual([true, "true"]);
    await press("Season");
    expect([
      open("Feed"),
      open("Season"),
      host.querySelector("[data-wide-page]") === null,
      place("Feed").getAttribute("aria-selected"),
    ]).toEqual([false, true, true, "false"]);
    await press("Season");
    expect(panel()!.childElementCount).toBe(0);
    await act(async () =>
      shownStore.applyFacts([{ model: "RaceRules", key: "0xa500", value: wireFact(raceRules()) }] as never),
    );
    await press("Season");
    expect(host.querySelector('[data-wide-page] section[aria-label="Aspect Race"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="Armies"]')).toBeNull();
    await press("Season");
    expect(panel()!.childElementCount).toBe(0);
    expect(host.querySelector("[data-wide-page]")).toBeNull();
    await press("Feed");
    await press("Feed");
    expect(open("Feed")).toBe(false);
    await press("Feed");
    await act(async () => panel()!.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click());
    expect(panel()!.childElementCount).toBe(0);
    await press("Feed");
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
    expect(host.querySelector('[data-wide-page] section[aria-label="Research"]')).not.toBeNull();
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
  const rail = () => host.querySelector("[data-frontier-rail]")!;
  try {
    await act(async () => toast.error("Not enough stamina"));
    const feed = host.querySelector<HTMLButtonElement>('nav[aria-label="Places"] button[aria-label="Feed"]')!;
    await act(async () => feed.click());
    expect(host.querySelector('[data-realm-slot] section[aria-label="Feed"]')).not.toBeNull();
    expect(rail().querySelector('[aria-label="Notices"]')?.textContent).toContain("Not enough stamina");
    // The Season stands in the rail's panel, the feed steps aside; the notice stays.
    const season = host.querySelector<HTMLButtonElement>('nav[aria-label="Places"] button[aria-label="Season"]')!;
    await act(async () => season.click());
    expect(host.querySelector('[data-realm-slot] section[aria-label="Season"]')).not.toBeNull();
    expect(rail().querySelector('[aria-label="Notices"]')?.textContent).toContain("Not enough stamina");
    await act(async () =>
      shownStore.applyFacts([{ model: "RaceRules", key: "0xa500", value: wireFact(raceRules()) }] as never),
    );
    expect(host.querySelector('[data-wide-page] section[aria-label="Aspect Race"]')).not.toBeNull();
    expect(rail().querySelector('[aria-label="Notices"]')?.textContent).toContain("Not enough stamina");
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

it.each([390, 1440])(
  "opens Today from the day control at %i px, docking only on desktop and leaving the map uncovered",
  async (width) => {
    viewport.set(width);
    await renderHud();
    const day = host.querySelector<HTMLButtonElement>('button[aria-label="Today"]');
    expect(day).not.toBeNull();
    await act(async () => day!.click());
    const sheet = host.querySelector<HTMLElement>('section[aria-label="Today"]');
    expect(sheet).not.toBeNull();
    expect(sheet!.hasAttribute("data-docked")).toBe(width >= 1024);
    expect(sheet!.closest("[data-rail-panel]") !== null).toBe(width >= 1024);
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
  const control = host.querySelector('[aria-label^="Wheat "]')?.closest("button");
  expect(control).toBeTruthy();
  expect(host.querySelector('section[aria-label="Wheat"]')).toBeNull();
  await act(async () => control!.click());
  expect(host.querySelector('section[aria-label="Wheat"]')).not.toBeNull();
  expect(host.querySelector('section[aria-label="Production"]')).toBeNull();
  await act(async () => control!.click());
  expect(host.querySelector('section[aria-label="Wheat"]')).toBeNull();
});

it("gives a phone one inline five-place switch with no duplicate bottom switch, keeps Realm idle unobstructed, and puts a page away", async () => {
  viewport.set(390);
  const route = window.location.pathname + window.location.search;
  window.history.replaceState(null, "", "/g/0x1ab9/1/map?col=1&row=1");
  try {
    await renderHud();
    expect([...host.querySelectorAll('[aria-label="Map view"] [role="tab"]')].map((tab) => tab.textContent)).toEqual([
      "Realm",
      "Surface",
      "Veil",
      "Hollow",
      "Deep",
    ]);
    expect(host.querySelector('nav[aria-label="Places"] [data-switch]')).toBeNull();
    const placeTab = (word: string) =>
      host.querySelector<HTMLButtonElement>(`[aria-label="Map view"] [role="tab"][aria-label="${word}"]`)!;
    expect(placeTab("Realm")).not.toBeNull();
    await act(async () => placeTab("Realm").click());
    expect(window.location.pathname).toMatch(/\/hex$/);
    expect(host.querySelector('section[aria-label="Realm"]')).toBeNull();
    expect(placeTab("Realm").getAttribute("aria-selected")).toBe("true");
    const realmChip = host.querySelector<HTMLButtonElement>(".frontier-phone-realm-chip")!;
    await act(async () => realmChip.click());
    expect(host.querySelector('section[aria-label="Realm"]')).not.toBeNull();
    await act(async () => placeTab("Surface").click());
    expect(window.location.pathname).toMatch(/\/map$/);
    expect(host.querySelector('section[aria-label="Realm"]')).toBeNull();
    await fromMenu("Feed");
    expect(surfaceNamed("Feed")).not.toBeNull();
    await act(async () => placeTab("Realm").click());
    expect(window.location.pathname).toMatch(/\/hex$/);
    expect(surfaceNamed("Feed")).toBeNull();
  } finally {
    window.history.replaceState(null, "", route);
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
  [...surfaceNamed("Menu")!.querySelectorAll<HTMLElement>(".menu-place-tile, .ui-row")].find(
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
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(page()).toBeNull();
    await pressPlace("Menu");
    await pressPlace("Menu");
    expect(page()).toBeNull();
  } finally {
    window.history.replaceState(null, "", route);
  }
});

it.each([
  ["Today", "Today"],
  ["Season", "Season"],
  ["Settings", "Settings"],
])(
  "opens %s from a phone's Menu whichever part of its row is tapped: its icon, its words or its chevron",
  async (row, opens) => {
    viewport.set(390);
    const route = window.location.pathname + window.location.search;
    window.history.replaceState(null, "", "/g/0x1ab9/1/map?col=1&row=1");
    try {
      await renderHud();
      const parts = {
        icon: (row: HTMLElement) => row.querySelector("[data-icon]")!,
        words: (row: HTMLElement) => row.querySelector(".ui-row__title")!,
        chevron: (row: HTMLElement) => [...row.querySelectorAll("[data-icon]")].at(-1)!,
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
      expect(opened).toEqual({ icon: true, words: true, chevron: true });
    } finally {
      window.history.replaceState(null, "", route);
    }
  },
);

const fromMenu = async (word: string) => {
  await pressPlace("Menu");
  await act(async () => menuRow(word).click());
};

const PHONE_SURFACES = {
  research: { label: "Research", open: () => fromMenu("Research") },
  feed: { label: "Feed", open: () => fromMenu("Feed") },
  chat: { label: "Chat", open: () => fromMenu("Chat") },
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
    const realmChip = () => host.querySelector<HTMLButtonElement>(".frontier-phone-realm-chip")!;
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
const historySettles = () => act(async () => new Promise((settled) => setTimeout(settled, 50)));
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
it("leaves one back to the page before the game once the Menu's Season is opened and closed", async () => {
  await enterFromAnotherPage();
  await fromMenu("Season");
  expect([surfaceNamed("Season") !== null, surfaceNamed("Menu")]).toEqual([true, null]);
  await closeFrame("Season");
  await historySettles();
  await systemBack();
  expect(window.location.pathname).toBe("/before-the-game");
});

it("closes the Menu's Season with the system back, and the next back leaves the game", async () => {
  await enterFromAnotherPage();
  await fromMenu("Season");
  await historySettles();
  await systemBack();
  expect([surfaceNamed("Season"), surfaceNamed("Menu")]).toEqual([null, null]);
  expect(window.location.pathname).toBe("/g/0x1ab9/1/map");
  await systemBack();
  expect(window.location.pathname).toBe("/before-the-game");
});

it("keeps one entry while Menu swaps pages, and one back closes the last", async () => {
  await enterFromAnotherPage();
  for (const place of ["Feed", "Chat", "Research"]) await fromMenu(place);
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
    await fromMenu("Season");
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
  expect(host.querySelector('[aria-label="Day clock"]')?.textContent).toContain("Day 10");
  await advance(approved.oldEnd);
  expect(host.querySelector('[aria-label="Day clock"]')?.textContent).toContain("Day 11");
  expect(host.textContent).not.toContain("Game finished");
  await boot(approved.oldEnd);
  expect(host.querySelector('[aria-label="Day clock"]')?.textContent).toContain("Day 11");
  expect(host.textContent).not.toContain("Game finished");
  expect(configManager.getSeasonConfig().endAt).toBe(approved.end);
  await boot(approved.end - 1);
  expect(host.querySelector('[aria-label="Day clock"]')?.textContent).toContain("Day 15");
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
    const chip = host.querySelector(".frontier-realm-chip")?.textContent ?? "";
    const panel = host.querySelector('section[aria-label="Realm"]')!;
    expect(names.visited).not.toBe(names.own);
    expect(chip).toContain(names.visited);
    expect(chip).not.toContain(names.own);
    expect(panel.querySelector(".realm-tiles")).toBeNull();
    expect(panel.querySelector("[data-realm-castle]")).not.toBeNull();
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

it("keeps Chat reachable from the desktop top bar while visiting another realm", async () => {
  viewport.set(1440);
  try {
    await renderVisit();
    const chat = host.querySelector<HTMLButtonElement>('nav[aria-label="Places"] button[aria-label="Chat"]');
    expect(chat).not.toBeNull();
    expect(host.querySelector('nav[aria-label="Places"] button[aria-label="Research"]')).toBeNull();
    await act(async () => chat!.click());
    expect(chatOpen()).toBe(true);
  } finally {
    visiting.visit = null;
  }
});

it("orders the desktop cornice places as Research, Season, Feed, Chat without Relics and returns to Realm on top-left crest press", async () => {
  viewport.set(1440);
  const route = window.location.pathname + window.location.search;
  window.history.replaceState(null, "", "/g/0x1ab9/1/map?col=1&row=1");
  try {
    await renderHud();
    const labels = [...host.querySelectorAll('nav[aria-label="Places"] button')].map((button) =>
      button.getAttribute("aria-label"),
    );
    expect(labels).toEqual(["Research", "Season", "Feed", "Chat"]);
    expect(host.querySelector('button[aria-label="Relics"]')).toBeNull();
    const placeTabs = [...host.querySelectorAll('[aria-label="Map view"] [role="tab"]')].map((tab) => [
      tab.getAttribute("aria-label"),
      tab.textContent,
    ]);
    expect(placeTabs).toEqual([
      ["Realm", "Realm"],
      ["Surface", "Surface"],
      ["Veil", "Veil"],
      ["Hollow", "Hollow"],
      ["Deep", "Deep"],
    ]);
    const chip = host.querySelector<HTMLButtonElement>(".frontier-realm-chip")!;
    expect(chip.querySelector('img[src*="portraits"]')).toBeNull();
    await act(async () => chip.click());
    expect(window.location.pathname).toMatch(/\/hex$/);
  } finally {
    window.history.replaceState(null, "", route);
  }
});

it.each([1440, 390])("opens Shop from the %i px top bar Fragments socket once Fragments are held", async (width) => {
  viewport.set(width);
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
    [...host.querySelectorAll<HTMLButtonElement>('section[aria-label="Aspect Race"] button')].find((button) =>
      button.textContent?.includes("Go to Deep"),
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
    expect(host.querySelector('section[aria-label="Aspect Race"]')).not.toBeNull();
    expect(goToDeep()).toBeUndefined();
  } finally {
    setBlockTimestampSource(null);
    window.removeEventListener(LAYER_VIEW_REQUEST_EVENT, onRequest);
    window.history.replaceState(null, "", route);
    window.dispatchEvent(new Event("urlChanged"));
  }
});
