// @vitest-environment jsdom
import approvedExtension from "../../../../../../config/source/frontier/extension.json";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { shortString } from "starknet";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";

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
  GameChatMap: ({ children }: { children: ReactNode }) => children,
}));

const { getStructureName, readExpeditionRules } = await import("@bibliothecadao/eternum");
const { useRealtimeChatStore } = await import("@/ui/features/social/realtime-chat/model/store");
const { LabGame } = await import("@/ui/features/debug/kit-lab/lab-game");
const { useUIStore } = await import("@/hooks/store/use-ui-store");
const { overrideSpectateIntent } = await import("@/utils/spectator-session");
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
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ blocked: [], version: 0 }), { status: 200 })),
  );
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
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
          <LabGame preset={5} facts={() => [LABOR_RULES]}>
            {(store) => {
              shownStore = store;
              return <FrontierHud rules={readExpeditionRules(store, 1)!} />;
            }}
          </LabGame>
        </QueryClientProvider>
      </MemoryRouter>,
    ),
  );

const LABOR_RULES = {
  model: "LaborRules",
  key: "0x1ab",
  value: { game_id: 1, amount: "1000", campaign_essence: "0", golden_amount: "1000", golden_essence: "0" },
};

it("opens Realm Labor from the desktop panel and explains why a free home has no claim", async () => {
  viewport.set(1440);
  await renderHud();
  const realms = [...host.querySelectorAll("button")].find(
    (button) => button.getAttribute("aria-label") === "Realm Labor",
  );
  expect(realms).toBeDefined();
  await act(async () => realms!.click());
  expect(host.textContent).toContain("No daily Labor claim");
});

it("keeps one chat connection and its unread count from desktop to phone and back, through the Frontier HUD", async () => {
  viewport.set(1440);
  wire.made = 0;
  wire.close.mockClear();
  await renderHud();
  await act(async () => useRealtimeChatStore.setState({ unreadWorldTotal: 3 }));
  expect(chatReading()).toEqual({ connected: true, unread: "3" });

  await act(async () => viewport.set(390));
  expect(chatReading()).toEqual({ connected: true, unread: "3" });

  await act(async () => viewport.set(1440));
  expect(chatReading()).toEqual({ connected: true, unread: "3" });
  // One connection for the game: the layout changes swap the views that read it, never the connection.
  expect(wire.made).toBe(1);
  expect(wire.close).not.toHaveBeenCalled();
});

it("gives a phone the Feed on its place bar, the desktop's own Feed as a page under the map, which its × closes", async () => {
  viewport.set(390);
  await renderHud();
  const feed = () =>
    [...host.querySelectorAll<HTMLButtonElement>('nav[aria-label="Places"] button')].find((button) =>
      button.textContent?.endsWith("Feed"),
    );
  const page = () => document.querySelector('[data-page] section[aria-label="Feed"]');
  // Owner, 26 October 2026: "Rename mobile log to feed as well btw it should be the same".
  expect(
    [...host.querySelectorAll('nav[aria-label="Places"] button')].some((button) => button.textContent?.endsWith("Log")),
  ).toBe(false);
  expect(page()).toBeNull();
  await act(async () => feed()!.click());
  expect(page()).not.toBeNull();
  // Owner, 27 October 2026: "All / Important (battles but not just mine), then mine": All first and lit, then
  // Important, then Mine.
  const lenses = [...page()!.querySelectorAll('[aria-label="Show"] button')];
  expect(lenses.map((button) => [button.textContent, button.getAttribute("aria-pressed")])).toEqual([
    ["All", "true"],
    ["Important", "false"],
    ["Mine", "false"],
  ]);
  expect(feed()!.getAttribute("aria-current")).toBe("page");
  // Owner, 22 October 2026 (mobile direction A): the page stands on the place bar and leaves the map above it; its ×
  // or the place bar's Feed takes it away again.
  await act(async () => page()!.querySelector<HTMLButtonElement>('button[aria-label="Close the feed"]')!.click());
  expect(page()).toBeNull();
  expect(feed()!.getAttribute("aria-current")).toBeNull();
  await act(async () => feed()!.click());
  await act(async () => feed()!.click());
  expect(page()).toBeNull();
});

it("treats the desktop's Feed as any other panel: closed at start, opened from its place, replaced and closed as the others", async () => {
  // Owner, 30 October 2026: "the feed is opened by default … whereas it should be replaced by season, it works like that
  // for season and research already", "no special rules for feed please".
  viewport.set(1920);
  const route = window.location.pathname + window.location.search;
  const { selectedBuildingHex } = useUIStore.getState();
  await renderHud();
  const panel = () => host.querySelector("[data-frontier-rail] [data-rail-panel]")!;
  const open = (name: string) => panel().querySelector(`section[aria-label="${name}"]`) !== null;
  const place = (name: string) =>
    host.querySelector<HTMLButtonElement>(`nav[aria-label="Places"] button[aria-label="${name}"]`)!;
  const press = (name: string) => act(async () => place(name).click());
  try {
    // Nothing stands in the rail until the player opens it.
    expect(panel().childElementCount).toBe(0);
    expect(place("Feed").getAttribute("aria-pressed")).toBe("false");
    await press("Feed");
    expect([open("Feed"), place("Feed").getAttribute("aria-pressed")]).toEqual([true, "true"]);
    // The Season replaces it, and closing the Season leaves nothing: the Feed does not come back.
    await press("Season");
    expect([open("Feed"), open("Season"), place("Feed").getAttribute("aria-pressed")]).toEqual([false, true, "false"]);
    await press("Season");
    expect(panel().childElementCount).toBe(0);
    // Its place closes it, as Research's and the Season's close theirs; so does its ×.
    await press("Feed");
    await press("Feed");
    expect(open("Feed")).toBe(false);
    await press("Feed");
    await act(async () => panel().querySelector<HTMLButtonElement>('button[aria-label="Close the feed"]')!.click());
    expect(panel().childElementCount).toBe(0);
    // A card the map opens replaces it: an open plot tapped on the realm's board, its Build sheet.
    await press("Feed");
    window.history.replaceState(null, "", "/g/0x1ab9/1/hex?col=1&row=1");
    await act(async () =>
      useUIStore.setState({
        selectedBuildingHex: { structureId: 7, innerCol: BUILDINGS_CENTER[0] + 1, innerRow: BUILDINGS_CENTER[1] },
      }),
    );
    expect([open("Feed"), open("Build"), place("Feed").getAttribute("aria-pressed")]).toEqual([false, true, "false"]);
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
    expect(rail().querySelector('section[aria-label="Feed"]')).not.toBeNull();
    expect(rail().querySelector('[aria-label="Notices"]')?.textContent).toContain("Not enough stamina");
    // The Season stands in the rail's panel, the feed steps aside; the notice stays.
    const season = host.querySelector<HTMLButtonElement>('nav[aria-label="Places"] button[aria-label="Season"]')!;
    await act(async () => season.click());
    expect(rail().querySelector('[data-rail-panel] section[aria-label="Season"]')).not.toBeNull();
    expect(rail().querySelector('[aria-label="Notices"]')?.textContent).toContain("Not enough stamina");
  } finally {
    useEventFeedStore.getState().dismiss();
  }
});

it.each([false, true])(
  "draws Season ranks, depths and campaign icons outside streamed scope (campaigns: %s)",
  async (campaigns) => {
    // Three realms the lab's game streams none of: their Structure rows are absent from the store.
    const entry = (rank: number, level: number, depth: number) => ({
      address: `0x${(0xa00 + rank).toString(16)}`,
      structure_id: String(900 + rank),
      rank,
      sites_cleared: { total: 10 - rank, camps: 0, rifts: 0, ruins: 0, beasts: 0 },
      chests_earned: 0,
      rewards: { lords: "0", essence: "0", labor: "0" },
      deepest_depth: depth,
      level,
      order: rank,
      campaign:
        campaigns && rank < 3 ? { campaign_id: shortString.encodeShortString("devcon-2026"), tier: rank } : null,
    });
    const board = { game_id: "1", mode: "frontier", entries: [entry(1, 3, 3), entry(2, 1, 2), entry(3, 0, 0)] };
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
    expect([...shownStore.rows("CampaignHome")]).toEqual([]);
    for (const entry of board.entries)
      expect(shownStore.get("Structure", { game_id: 1, entity_id: BigInt(entry.structure_id) })).toBeUndefined();
    const season = host.querySelector<HTMLButtonElement>('nav[aria-label="Places"] button[aria-label="Season"]')!;
    await act(async () => season.click());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));
    const badges = [...host.querySelectorAll('section[aria-label="Season"] [role="img"]')]
      .map((badge) => badge.getAttribute("aria-label"))
      .filter((label) => /Settlement|City|Kingdom|Empire/.test(label ?? ""));
    expect(badges).toEqual(["Empire · Ethereal III", "City · Ethereal II", "Settlement"]);
    const paintings = [...host.querySelectorAll('section[aria-label="Season"] [role="img"]')]
      .filter((badge) => /Settlement|City|Kingdom|Empire/.test(badge.getAttribute("aria-label") ?? ""))
      .map((badge) => badge.querySelector("img")?.getAttribute("src")?.split("/").pop());
    expect(paintings).toEqual(
      campaigns
        ? ["devcon-realm.webp", "devcon-golden-realm.webp", "realm-0.webp"]
        : ["realm-3.webp", "realm-1.webp", "realm-0.webp"],
    );
  },
);

/** The real HUD with Herald's Frontier board answering `prize`, its Season opened; returns the podium's tiles and words. */
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
    campaign: null,
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
  // A desktop's place bar opens the Season; a phone's opens it from the Menu.
  const places = [...host.querySelectorAll<HTMLButtonElement>('nav[aria-label="Places"] button')];
  const desktopSeason = places.find((button) => button.getAttribute("aria-label") === "Season");
  if (desktopSeason) await act(async () => desktopSeason.click());
  else {
    await act(async () => places.find((button) => button.textContent === "Menu")!.click());
    const row = [...document.querySelectorAll<HTMLButtonElement>('section[aria-label="Menu"] button')].find((button) =>
      button.textContent?.startsWith("Season"),
    )!;
    await act(async () => row.click());
  }
  await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));
  const podium = document.querySelector('section[aria-label="Season"] [aria-label="Season prizes"]');
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

it("gives a phone a Realm / World switch: it names where it goes, the board then the map, and puts a page away", async () => {
  viewport.set(390);
  window.history.replaceState(null, "", "/g/0x1ab9/1/map?col=1&row=1");
  await renderHud();
  const slots = () => [...host.querySelectorAll<HTMLButtonElement>('nav[aria-label="Places"] button')];
  const toggle = () => slots()[0]!;
  expect(slots().map((button) => button.textContent)).not.toContain("Map");
  expect(toggle().textContent).toBe("Realm");
  await act(async () => toggle().click());
  expect(window.location.pathname).toMatch(/\/hex$/);
  expect(toggle().textContent).toBe("World");
  expect(toggle().getAttribute("aria-current")).toBeNull();
  // A page open over the board: World still goes to the map, and the page goes with it.
  const feed = () => slots().find((button) => button.textContent?.endsWith("Feed"))!;
  await act(async () => feed().click());
  expect(feed().getAttribute("aria-current")).toBe("page");
  await act(async () => toggle().click());
  expect(window.location.pathname).toMatch(/\/map$/);
  expect(toggle().textContent).toBe("Realm");
  expect(feed().getAttribute("aria-current")).toBeNull();
});

it("opens a phone's Menu as a page on the place bar, its title with no close of its own, and closes it with Menu", async () => {
  viewport.set(390);
  await renderHud();
  const menu = () =>
    [...host.querySelectorAll<HTMLButtonElement>('nav[aria-label="Places"] button')].find(
      (button) => button.textContent === "Menu",
    )!;
  const page = () => document.querySelector('[data-page] section[aria-label="Menu"]');
  await act(async () => menu().click());
  expect(page()).not.toBeNull();
  expect(page()!.querySelector('[aria-label="Close"]')).toBeNull();
  expect(document.querySelector(".ui-sheet")).toBeNull();
  await act(async () => menu().click());
  expect(page()).toBeNull();
});

it("keeps the extended season live past its old end and reloads its final day from fresh facts", async () => {
  const { useChainTimeStore } = await import("@/hooks/store/use-chain-time-store");
  const { useBlockTimestampStore } = await import("@/hooks/store/use-block-timestamp-store");
  const { configManager, setBlockTimestampSource } = await import("@bibliothecadao/eternum");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ blocked: [], entries: [] })),
  );
  const approved = approvedExtension;
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
              preset={5}
              facts={(store) => {
                useChainTimeStore.getState().anchor({ timestamp: now * 1000 });
                currentTime = now;
                setBlockTimestampSource(() => currentTime);
                useBlockTimestampStore.setState({ currentBlockTimestamp: now });
                return [
                  LABOR_RULES,
                  {
                    model: "GameRegistry",
                    key: "0x3",
                    value: {
                      ...store.require("GameRegistry", { game_id: 1 }),
                      start_main_at: String(approved.start),
                      start_settling_at: String(approved.start),
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
              {(store) => <FrontierHud rules={readExpeditionRules(store, 1)!} />}
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
  window.history.replaceState(null, "", "/g/0x1ab9/1/map?col=1&row=1");
  await renderHud();
  const spectatingChip = () =>
    [...host.querySelectorAll("button")].find((button) => button.textContent === "Spectating") ?? null;
  expect(spectatingChip()).toBeNull();

  // The signed-in owner entered the game to spectate it (`?spectate=true`), as spectator-session latches it.
  overrideSpectateIntent(true);
  try {
    await act(async () => useUIStore.setState({ isSpectating: true }));
    expect(spectatingChip()).not.toBeNull();
  } finally {
    overrideSpectateIntent(false);
    await act(async () => useUIStore.setState({ isSpectating: false }));
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
            preset={5}
            facts={(store) => {
              const visited = neighbour(store);
              names = {
                own: getStructureName(store.require("Structure", { game_id: 1, entity_id: 7 }), store).name,
                visited: getStructureName(visited, store).name,
              };
              return [
                LABOR_RULES,
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
            {(store) => <FrontierHud rules={readExpeditionRules(store, 1)!} />}
          </LabGame>
        </QueryClientProvider>
      </MemoryRouter>,
    ),
  );
  return names;
};

// Owner, 28 October 2026, visiting another realm: "the selected panel doesnt match the actual building". The board
// shows the visited realm, so the realm panel does too, never the player's own.
it("shows the visited realm on a desktop's realm panel, not the player's own", async () => {
  viewport.set(1440);
  try {
    const names = await renderVisit();
    const panel = host.querySelector('section[aria-label="Realm"]')?.textContent ?? "";
    expect(names.visited).not.toBe(names.own);
    expect(panel).toContain(names.visited);
    expect(panel).not.toContain(names.own);
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
  for (const width of [1440, 390]) {
    viewport.set(width);
    await renderHud();
    // Chat closed, Messages the last view: the press opens it on Global.
    await act(async () => useRealtimeChatStore.getState().actions.showMessages());
    expect(chatOpen()).toBe(false);
    const labor = host.querySelector('[aria-label="Realm Labor"]') !== null;
    await pressAlert("mention", "/chat", "mention:global");
    expect(chatOpen()).toBe(true);
    expect(useRealtimeChatStore.getState().view).toEqual({ kind: "room", zoneId: "world:global" });
    // The game stays where it was: its HUD, not another page.
    expect(host.querySelector('[aria-label="Realm Labor"]') !== null).toBe(labor);
    act(() => root.unmount());
    root = createRoot(host);
  }
  Reflect.deleteProperty(navigator, "serviceWorker");
});
