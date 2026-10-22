// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

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
vi.mock("@/ui/features/social", async () => ({
  ...(await import("@/ui/features/social/realtime-chat/hooks/use-realtime-chat")),
  RealtimeChatShell: () => <input aria-label="Message" />,
}));

const { readExpeditionRules } = await import("@bibliothecadao/eternum");
const { useRealtimeChatStore } = await import("@/ui/features/social/realtime-chat/model/store");
const { LabGame } = await import("@/ui/features/debug/kit-lab/lab-game");
const { FrontierHud } = await import("./frontier-hud");

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

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ blocked: [] }), { status: 200 })),
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
            {(store) => <FrontierHud rules={readExpeditionRules(store, 1)!} />}
          </LabGame>
        </QueryClientProvider>
      </MemoryRouter>,
    ),
  );

const LABOR_RULES = {
  model: "LaborRules",
  key: "0x1ab",
  value: { game_id: 1, amount: "1000", account_daily_limit: 5 },
};

it("opens Realms from a desktop realm panel whose Realms have no labor waiting, so a new player can add one", async () => {
  viewport.set(1440);
  await renderHud();
  const realms = [...host.querySelectorAll("button")].find((button) => button.getAttribute("aria-label") === "Realms");
  expect(realms).toBeDefined();
  await act(async () => realms!.click());
  expect(host.querySelector('form[aria-label="Add a Realm"]')).not.toBeNull();
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

it("gives a phone the Events' Log on its place bar as a page under the map, with the desktop Events' filter", async () => {
  viewport.set(390);
  await renderHud();
  const log = () =>
    [...host.querySelectorAll<HTMLButtonElement>('nav[aria-label="Places"] button')].find((button) =>
      button.textContent?.endsWith("Log"),
    );
  const page = () => document.querySelector('[data-page] section[aria-label="Log"]');
  expect(log()).toBeDefined();
  expect(page()).toBeNull();
  await act(async () => log()!.click());
  expect(page()).not.toBeNull();
  expect([...page()!.querySelectorAll("button")].map((button) => button.textContent)).toEqual(
    expect.arrayContaining(["Important", "Mine", "All"]),
  );
  expect(log()!.getAttribute("aria-current")).toBe("page");
  // Owner, 22 October 2026 (mobile direction A): the page stands on the place bar and leaves the map above it; the
  // place bar's Log takes it away again.
  expect(document.querySelector('[aria-label="Event log"]')).toBeNull();
  await act(async () => log()!.click());
  expect(page()).toBeNull();
  expect(log()!.getAttribute("aria-current")).toBeNull();
});

it("keeps a refused order in sight on a desktop, over the feed and over a panel the rail holds", async () => {
  const { toast } = await import("@/ui/features/event-feed/notify");
  const { useEventFeedStore } = await import("@/ui/features/event-feed/event-feed-store");
  viewport.set(1920);
  await renderHud();
  const rail = () => host.querySelector("[data-frontier-rail]")!;
  try {
    await act(async () => toast.error("Not enough stamina"));
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

it("draws every realm on the Season board with its rank and reach, from Herald's entry, though no realm is streamed", async () => {
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
  });
  const board = { game_id: "1", mode: "frontier", entries: [entry(1, 3, 3), entry(2, 1, 2), entry(3, 0, 0)] };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL) =>
      String(url).includes("/leaderboard")
        ? new Response(JSON.stringify(board), { status: 200 })
        : new Response(JSON.stringify({ blocked: [] }), { status: 200 }),
    ),
  );
  viewport.set(1920);
  await renderHud();
  const season = host.querySelector<HTMLButtonElement>('nav[aria-label="Places"] button[aria-label="Season"]')!;
  await act(async () => season.click());
  await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));
  const badges = [...host.querySelectorAll('section[aria-label="Season"] [role="img"]')]
    .map((badge) => badge.getAttribute("aria-label"))
    .filter((label) => /Settlement|City|Kingdom|Empire/.test(label ?? ""));
  expect(badges).toEqual(["Empire · Ethereal III", "City · Ethereal II", "Settlement"]);
});

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
