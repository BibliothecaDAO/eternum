import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

const player = vi.hoisted(() => ({ current: "0xb7" as string | null }));
const prize = vi.hoisted(() => ({
  current: null as {
    pool: string;
    top_n: number;
    count: number | null;
    awards: { rank: number; address: string; lords: string }[];
  } | null,
}));
const entry = (address: string, rank: number) => ({
  address,
  rank,
  order: 1,
  sites_cleared: { total: 40 - rank, camps: 10, rifts: 10, ruins: 10, beasts: 10 - rank },
  chests_earned: 3,
  rewards: { lords: "0", essence: "0", labor: "0" },
  deepest_depth: 1,
});
const directory = vi.hoisted(() => ({ games: [] as unknown[] }));
vi.mock("../herald", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../herald")>()),
  useLeaderboard: () => ({
    isError: false,
    isPending: false,
    data: { mode: "frontier", entries: [entry("0xa1", 1), entry("0xb7", 2)], prize: prize.current },
  }),
  useRealmsPlayer: () => ({ data: player.current }),
  useDirectory: () => ({ data: { games: directory.games }, isPending: false }),
  useRecentResults: () => ({ data: { games: [] }, isPending: false }),
  useSettledGames: () => ({ data: [], isPending: false }),
}));
// Signed out, without asking a session service: these tests read where Results leads.
vi.mock("@/hooks/context/identity-session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/context/identity-session")>()),
  useIdentitySession: () => ({ status: "signed-out", session: null }),
}));
// Identity answers for the players the recap names; nothing else on the page answers.
vi.stubGlobal("fetch", (input: string | URL | Request) =>
  new URL(input instanceof Request ? input.url : String(input), "http://localhost").pathname.endsWith("/api/profiles")
    ? Promise.resolve(Response.json({ profiles: {} }))
    : new Promise<Response>(() => {}),
);
vi.mock("@/ui/design-system/kit/player-name", () => ({
  PlayerName: ({ account }: { account: string }) => <span>{account}</span>,
}));

import { openedFrom } from "../frame/opened-from";
import { entryHref } from "../game-links";
import { ResultsPage } from "./results-page";

let unmount: (() => Promise<void>) | null = null;
afterEach(async () => {
  await unmount?.();
  player.current = "0xb7";
  prize.current = null;
  directory.games = [];
});

const Where = () => {
  const { pathname, search } = useLocation();
  return <output data-where>{pathname + search}</output>;
};

/** A list opens Results with where its Back leads; Play and a match's end open it bare. */
const FROM_LIST = { pathname: "/results/0x52-3", state: openedFrom({ pathname: "/p/0xa1", search: "" }) };

const open = async (entry: string | typeof FROM_LIST = FROM_LIST) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="/results/:id" element={<ResultsPage />} />
            <Route path="*" element={null} />
          </Routes>
          <Where />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  // Let identity's names land.
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  unmount = () => act(async () => root.unmount());
  const button = (word: string) =>
    [...container.querySelectorAll("button")].find((each) => each.textContent?.includes(word));
  return { container, button };
};

it("keeps the player's own ended season in reach: its results lead back into it, where its LORDS can be withdrawn", async () => {
  const { container, button } = await open();
  expect(container.querySelector('[data-icon="reward-chest"]')?.getAttribute("src")).toBe(
    "/images/blitz-chests/band-4-sealed.webp",
  );
  expect(container.querySelector('[data-icon="chest"]')).toBeNull();
  await act(async () => button("Withdraw")!.click());
  expect(container.querySelector("[data-where]")!.textContent).toBe(entryHref({ chainId: "0x52", game_id: 3 }, "play"));
});

it("offers no way in to a reader who held no realm in that season", async () => {
  player.current = "0xc0ffee";
  const { button } = await open();
  expect(button("Season")).toBeDefined();
  expect(button("Withdraw")).toBeUndefined();
});

it("has no Back: opened from a list, no Continue either; opened from Play, Continue, Post on X leading for a player with a card", async () => {
  const fromList = await open();
  expect(fromList.container.querySelector('[data-role="back"]')).toBeNull();
  expect(fromList.button("Continue")).toBeUndefined();
  await unmount?.();

  const fromPlay = await open("/results/0x52-3");
  expect(fromPlay.container.querySelector('[data-role="back"]')).toBeNull();
  expect([fromPlay.button("Continue")!.dataset.kind, fromPlay.button("Post on X")!.dataset.kind]).toEqual([
    "secondary",
    "primary",
  ]);
  await unmount?.();

  // A reader with no realm that season has no card to share: Continue is the gold step.
  player.current = "0xc0ffee";
  const reader = await open("/results/0x52-3");
  expect([reader.button("Continue")!.dataset.kind, reader.button("Post on X")]).toEqual(["primary", undefined]);
});

it("names a finished season's winners by the ledger's receipts, split over the places fixed, one still being awarded", async () => {
  // Two winners fixed, the ledger splitting 300 LORDS 2/3 and 1/3. First place went to 0xb7, though today's board
  // ranks 0xa1 first; second is fixed but not yet paid, so no receipt names it.
  prize.current = { pool: "300", top_n: 3, count: 2, awards: [{ rank: 1, address: "0xb7", lords: "200" }] };
  const { container } = await open();
  // Each place, its holder or why no one holds it yet, the holder's sites and the place's LORDS.
  expect(
    [...container.querySelectorAll('[data-card="podium"] li')].map((place) =>
      [...place.querySelectorAll("b, .season-card__holder, .season-card__count")].map((cell) => cell.textContent),
    ),
  ).toEqual([
    ["1", "0xb7", "38", "200"],
    ["2", "Pending", "100"],
  ]);
});

it("shows no podium for a season that ended with no prize pool, never one still to be published", async () => {
  const { container } = await open();
  expect(container.textContent).not.toContain("Pool not published");
  // The board's first realms, with no LORDS beside them.
  expect(
    [...container.querySelectorAll('[data-card="podium"] li')].map((place) =>
      [...place.querySelectorAll("b, .season-card__holder, .season-card__count")].map((cell) => cell.textContent),
    ),
  ).toEqual([
    ["1", "0xa1", "39"],
    ["2", "0xb7", "38"],
  ]);
});

it("offers Withdraw on an ended Aspect season when the player holds a realm there, and omits it otherwise", async () => {
  const aspectSeason = {
    chainId: "0x52",
    game_id: 3,
    name: "frontier-1",
    mode: "frontier",
    status: "Ended",
    clock_scale: 1,
    season_number: 1,
    clock: { start_settling_at: 0, start_main_at: 0, scheduled_end_at: 100, end_at: 100 },
    player_count: 100,
    aspect_members: { 1: 25, 2: 25, 3: 25, 4: 25 },
    aspect_race: {
      finish_height: 10_000,
      season_days: 50,
      heights: { 1: 10_000, 2: 5_000, 3: 2_000, 4: 1_000 },
    },
    player_state: {
      registered: true,
      settled: true,
      held_realm_id: null,
      has_home_source: false,
      taken_realm_ids: [],
      structures: [
        { entity_id: 1, category: 1, level: 1, realm_id: 3098, coord_x: null, coord_y: null, resources_packed: "0" },
      ],
    },
  };
  directory.games = [aspectSeason];
  const withRealm = await open();
  await act(async () => withRealm.button("Withdraw")!.click());
  expect(withRealm.container.querySelector("[data-where]")!.textContent).toBe(
    entryHref({ chainId: "0x52", game_id: 3 }, "play"),
  );
  await unmount?.();

  directory.games = [{ ...aspectSeason, player_state: null }];
  const withoutRealm = await open();
  expect(withoutRealm.button("Withdraw")).toBeUndefined();
});
