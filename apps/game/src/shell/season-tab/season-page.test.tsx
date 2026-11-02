import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { GameRef } from "@bibliothecadao/eternum/shard";

const DIRECTORY_DOWN = { data: undefined, isError: true, isPending: false, error: new Error("502"), refetch: vi.fn() };
const BOARD_WAITING = { data: undefined, isError: false, isPending: true };
const NO_HISTORY = { data: [], isError: false, isPending: false };
const reads = vi.hoisted(() => ({
  directory: {} as unknown,
  board: {} as unknown,
  settled: {} as unknown,
  boards: {} as Record<number, unknown>,
}));
// Identity names the past seasons' players; any other ask stays unanswered, its name waiting.
vi.hoisted(() =>
  vi.stubGlobal("fetch", (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : String(input), "http://localhost");
    const names: Record<string, string> = {
      "0x4c21": "Volcanic",
      "0x510f": "djizus",
      "0x6481": "Canzi",
      // Prod's archived Playtest: its first place.
      "0x4c21ba6f5c8e24182ee0eefd56de97ade5f7570041dd0ec7d7d8ece2195cc4": "Volcanic",
    };
    const accounts = url.searchParams.get("accounts")?.split(",") ?? [];
    if (!accounts.some((account) => names[account])) return new Promise<Response>(() => {});
    return Promise.resolve(
      Response.json({ profiles: Object.fromEntries(accounts.map((account) => [account, { name: names[account] }])) }),
    );
  }),
);

// Blitz's board has its own test; this page test reads Frontier's board and the switch.
vi.mock("./blitz-board", () => ({ BlitzBoard: () => <p>Blitz board</p> }));
// Each shard game's board is the test's; an archived season's is the real read, from its file and never a shard.
vi.mock("../herald", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../herald")>();
  const { archivedSeason } = await import("./archive/archive");
  return {
    ...actual,
    useDirectory: () => reads.directory,
    useLeaderboard: (game: GameRef | null) => {
      const archived = game !== null && archivedSeason(game) !== undefined;
      const read = actual.useLeaderboard(archived ? game : null);
      return archived ? read : ((game && reads.boards[game.gameId]) ?? reads.board);
    },
    useSettledGames: () => reads.settled,
    useRealmsPlayer: () => ({ data: null }),
  };
});
afterEach(() => {
  reads.directory = DIRECTORY_DOWN;
  reads.board = BOARD_WAITING;
  reads.settled = NO_HISTORY;
  reads.boards = {};
});
reads.directory = DIRECTORY_DOWN;
reads.board = BOARD_WAITING;
reads.settled = NO_HISTORY;
vi.spyOn(console, "error").mockImplementation(() => undefined);

import { setViewportWidth } from "../frame/test-viewport";
import { SeasonPage } from "./season-page";

/** Where a row led: the Results address it opened. */
const Opened = () => <p data-opened>{useLocation().pathname}</p>;

const mount = async (width: number) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  setViewportWidth(width);
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/season"]}>
          <Routes>
            <Route path="/season" element={<SeasonPage />} />
            <Route path="/results/:id" element={<Opened />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  return { container, unmount: () => act(async () => root.unmount()) };
};

it("says Season did not answer in the glossary's words, with Try again, and the switch still works", async () => {
  const { container, unmount } = await mount(390);
  try {
    const body = container.querySelector('[data-band="body"]')!;
    expect(body.textContent).toContain("Season did not answer.");
    expect(body.textContent).not.toContain("502");
    const blitz = [...body.querySelectorAll('[role="tab"]')].find((tab) => tab.textContent === "Blitz")!;
    await act(async () => (blitz as HTMLButtonElement).click());
    expect(blitz.getAttribute("aria-selected")).toBe("true");
    expect(body.textContent).toContain("Blitz board");
    expect(body.textContent).not.toContain("Season did not answer.");
  } finally {
    await unmount();
  }
});

/** Frontier's live season 1, on its 4th day, with no realm on its board. */
const FRONTIER = {
  chainId: "0x52",
  game_id: 1,
  mode: "frontier",
  status: "Live",
  season_number: 1,
  day_index: 3,
  day_ends_at: Math.floor(Date.now() / 1000) + 3600,
  clock: { start_settling_at: 0, start_main_at: 1, end_at: Math.floor(Date.now() / 1000) + 30 * 86_400 },
};

it("titles the page Season and names Frontier's own season on its board; an empty board says how to get on it", async () => {
  reads.directory = { data: { games: [FRONTIER] }, isError: false, isPending: false };
  reads.board = { data: { mode: "frontier", entries: [] }, isError: false, isPending: false };
  const { container, unmount } = await mount(1440);
  try {
    expect(container.querySelector("h1")?.textContent).toBe("Season");
    const frontier = [...container.querySelectorAll(".app-panel")].find(
      (panel) => panel.querySelector("h2")?.textContent === "Frontier",
    )!;
    expect(frontier.querySelector(".app-panel__cue")?.textContent).toBe("Season 1 · Day 4");
    expect(frontier.textContent).toContain("No realm yet. Found one from Play.");
    expect([...frontier.querySelectorAll("button")].map((button) => button.textContent)).toEqual(["Play"]);
  } finally {
    await unmount();
  }
});

const entry = (address: string, rank: number, sites: number) => ({
  address,
  rank,
  order: 1,
  structure_id: String(rank),
  campaign: null,
  sites_cleared: { total: sites, camps: sites, rifts: 0, ruins: 0, beasts: 0 },
  chests_earned: 0,
  rewards: { lords: "0", essence: "0", labor: "0" },
  deepest_depth: 0,
  level: 0,
});
/** The podium's tiles as drawn, second, first and third: each one's place, LORDS and who holds it. */
const tiles = (container: HTMLElement) =>
  [...container.querySelectorAll('[aria-label="Season prizes"] li[data-place]')].map((tile) => [
    tile.getAttribute("data-place"),
    tile.textContent,
  ]);

it("shows the season's three prizes over Frontier's board, each place's holder, and Open where no one who cleared a site holds it", async () => {
  reads.directory = { data: { games: [FRONTIER] }, isError: false, isPending: false };
  // 300 LORDS among the top 3; only two players have cleared a site.
  reads.board = {
    data: {
      mode: "frontier",
      entries: [entry("0xa1", 1, 5), entry("0xb2", 2, 2), entry("0xc3", 3, 0)],
      prize: { pool: "300", top_n: 3, count: null, awards: [] },
    },
    isError: false,
    isPending: false,
  };
  const { container, unmount } = await mount(390);
  try {
    expect(tiles(container).map(([place, text]) => [place, text?.replace(/0x[0-9a-f]+$|[^0-9#]+$/, "")])).toEqual([
      ["2", "2100"],
      ["1", "1150"],
      ["3", "350"],
    ]);
    expect(tiles(container)[2]![1]).toMatch(/Open$/);
    expect(tiles(container)[0]![1]).not.toMatch(/Open$/);
    // A phone's board is the desktop's: one board, each row its rank, name, sites and LORDS.
    const boardRows = [...container.querySelectorAll('[data-age="frontier"] .app-board button.app-board__row')];
    expect(boardRows).toHaveLength(3);
    expect(boardRows.map((row) => row.querySelectorAll(".app-board__figure").length)).toEqual([2, 2, 2]);
  } finally {
    await unmount();
  }
});

it("says no prize is published yet, its medals standing with no amount", async () => {
  reads.directory = { data: { games: [FRONTIER] }, isError: false, isPending: false };
  reads.board = {
    data: { mode: "frontier", entries: [entry("0xa1", 1, 5)], prize: null },
    isError: false,
    isPending: false,
  };
  const { container, unmount } = await mount(1440);
  try {
    expect(tiles(container)).toEqual([
      ["2", "2—"],
      ["1", "1—"],
      ["3", "3—"],
    ]);
    expect(container.querySelector('[aria-label="Season prizes"]')!.textContent).toContain("Pool not published yet");
  } finally {
    await unmount();
  }
});

const ENDED_AT = Date.UTC(2026, 9, 31, 9, 46) / 1000;
/** Prod's Playtest, archived: its game on prod's old chain. */
const PLAYTEST_RESULTS = "/results/0x50524f44554354494f4e5f31386530376435323330633539393933-1";
/** A Frontier season that has ended: the directory lists it until it settles, the history after. */
const ended = (game_id: number, season_number: number, end_at: number, status = "Settled") => ({
  ...FRONTIER,
  game_id,
  season_number,
  status,
  day_index: null,
  day_ends_at: null,
  clock: { start_settling_at: 0, start_main_at: end_at - 10 * 86_400, end_at },
});
/** Season 2, ended on 20 November; its board ranks Volcanic, djizus and Canzi, with no prize pool. */
const seasonTwo = (status = "Settled") => ended(2, 2, ENDED_AT + 20 * 86_400, status);
const SEASON_TWO_BOARD = {
  data: {
    mode: "frontier",
    entries: [entry("0x4c21", 1, 90), entry("0x510f", 2, 60), entry("0x6481", 3, 30)],
    prize: null,
  },
  isError: false,
  isPending: false,
};
const frontierPanel = (container: HTMLElement) =>
  [...container.querySelectorAll(".app-panel")].find((panel) => panel.querySelector("h2")?.textContent === "Frontier")!;
const pastPanel = (container: HTMLElement) =>
  [...container.querySelectorAll(".app-panel")].find(
    (panel) => panel.querySelector("h2")?.textContent === "Past seasons",
  );
const pastRows = (container: HTMLElement) =>
  [...(pastPanel(container)?.querySelectorAll("button.app-row") ?? [])].map((row) => [
    row.querySelector(".app-row__title")?.textContent,
    row.querySelector(".app-row__detail")?.textContent,
    row.querySelector(".app-row__trail [data-medal]")?.getAttribute("aria-label"),
    row.querySelector(".app-row__trail")?.textContent?.replace(/^\d/, ""),
  ]);
const siteCounts = (panel: Element) =>
  [...panel.querySelectorAll("button.app-board__row")].map(
    (row) => row.querySelector(".app-board__figure")?.textContent,
  );

it.each([
  [390, 12],
  [1440, 10],
])(
  "with nothing listed or settled, shows prod's archived Playtest as it ended, from its file, at %ipx",
  async (width, shown) => {
    reads.directory = { data: { games: [] }, isError: false, isPending: false };
    const { container, unmount } = await mount(width);
    try {
      const frontier = frontierPanel(container);
      expect(frontier.querySelector(".app-panel__cue")?.textContent).toBe("Playtest · Ended 31 Oct");
      expect(container.textContent).not.toMatch(/Season \d/);
      expect(frontier.textContent).not.toContain("No season running");
      // Prod's final board: Volcanic 166, djizus 136, Canzi 114, then the rest to the layout's count.
      const counts = siteCounts(frontier);
      expect(counts.slice(0, 4)).toEqual([
        "166 sites cleared",
        "136 sites cleared",
        "114 sites cleared",
        "59 sites cleared",
      ]);
      expect(counts).toHaveLength(shown);
      // The Playtest had no prize pool: no podium saying one is still to come.
      expect(container.querySelector('[aria-label="Season prizes"]')).toBeNull();
      // The season shown is not listed again as past.
      expect(pastPanel(container)).toBeUndefined();
    } finally {
      await unmount();
    }
  },
);

it("with no season live, shows the last to end, and Past seasons lists the Playtest with its winner, opening its Results", async () => {
  reads.directory = { data: { games: [] }, isError: false, isPending: false };
  reads.settled = { data: [seasonTwo()], isError: false, isPending: false };
  reads.boards = { 2: SEASON_TWO_BOARD };
  const { container, unmount } = await mount(1440);
  try {
    expect(frontierPanel(container).querySelector(".app-panel__cue")?.textContent).toBe("Season 2 · Ended 20 Nov");
    expect(siteCounts(frontierPanel(container))).toEqual(["90 sites cleared", "60 sites cleared", "30 sites cleared"]);
    expect(pastRows(container)).toEqual([["Playtest", "Ended 31 Oct", "#1", "Volcanic"]]);
    await act(async () => (pastPanel(container)!.querySelector("button.app-row") as HTMLButtonElement).click());
    expect(container.querySelector("[data-opened]")?.textContent).toBe(PLAYTEST_RESULTS);
  } finally {
    await unmount();
  }
});

it("with a season live, lists the ended ones under Past seasons, last to end first, each with its winner, and a row opens its Results", async () => {
  // Season 2 ended and is not settled yet: the directory still lists it, and the history already has it.
  reads.directory = {
    data: { games: [{ ...FRONTIER, game_id: 3, season_number: 3 }, seasonTwo("Ended")] },
    isError: false,
    isPending: false,
  };
  reads.settled = { data: [seasonTwo()], isError: false, isPending: false };
  reads.board = { data: { mode: "frontier", entries: [], prize: null }, isError: false, isPending: false };
  reads.boards = {
    2: { data: { mode: "frontier", entries: [entry("0x510f", 1, 90)], prize: null }, isError: false, isPending: false },
  };
  const { container, unmount } = await mount(1440);
  try {
    expect(frontierPanel(container).querySelector(".app-panel__cue")?.textContent).toBe("Season 3 · Day 4");
    expect(pastRows(container)).toEqual([
      ["Season 2", "Ended 20 Nov", "#1", "djizus"],
      ["Playtest", "Ended 31 Oct", "#1", "Volcanic"],
    ]);
    const seasonOne = pastPanel(container)!.querySelectorAll("button.app-row")[0] as HTMLButtonElement;
    await act(async () => seasonOne.click());
    expect(container.querySelector("[data-opened]")?.textContent).toBe("/results/0x52-2");
  } finally {
    await unmount();
  }
});

it.each([390, 1440])("keeps the last season's final board while the next is only announced, at %ipx", async (width) => {
  // Season 2 is created for a start next week; nothing runs, and only the archived season has ended.
  const announced = {
    ...FRONTIER,
    game_id: 2,
    season_number: 2,
    status: "Registration",
    day_index: null,
    day_ends_at: null,
    clock: {
      start_settling_at: ENDED_AT + 7 * 86_400,
      start_main_at: ENDED_AT + 7 * 86_400,
      end_at: ENDED_AT + 37 * 86_400,
    },
  };
  reads.directory = { data: { games: [announced] }, isError: false, isPending: false };
  reads.boards = { 2: { data: { mode: "frontier", entries: [], prize: null }, isError: false, isPending: false } };
  const { container, unmount } = await mount(width);
  try {
    const frontier = frontierPanel(container);
    expect(frontier.querySelector(".app-panel__cue")?.textContent).toBe("Playtest · Ended 31 Oct");
    expect(frontier.querySelector("button.app-board__row .app-board__figure")?.textContent).toBe("166 sites cleared");
    expect(frontier.textContent).not.toContain("No realm yet");
  } finally {
    await unmount();
  }
});

it.each([390, 1440])(
  "names a past season's winner only by the ledger's receipt once winners are fixed: Pending until it lands, at %ipx",
  async (width) => {
    reads.directory = {
      data: { games: [{ ...FRONTIER, game_id: 3, season_number: 3 }] },
      isError: false,
      isPending: false,
    };
    reads.settled = { data: [seasonTwo()], isError: false, isPending: false };
    reads.board = { data: { mode: "frontier", entries: [], prize: null }, isError: false, isPending: false };
    const fixed = (count: number, awards: { rank: number; address: string; lords: string }[]) => ({
      ...SEASON_TWO_BOARD,
      data: { ...SEASON_TWO_BOARD.data, prize: { pool: "300", top_n: 3, count, awards } },
    });
    const pastRow = async (board: unknown) => {
      reads.boards = { 2: board };
      const { container, unmount } = await mount(width);
      if (width === 390) {
        const tab = [...container.querySelectorAll('[role="tab"]')].find((each) => each.textContent === "Frontier");
        expect(tab?.getAttribute("aria-selected")).toBe("true");
      }
      const row = pastRows(container)[0];
      await unmount();
      return row;
    };
    // Three winners fixed, none paid yet: the board ranks Volcanic first, but the ledger has not said who won.
    expect(await pastRow(fixed(3, []))).toEqual(["Season 2", "Ended 20 Nov", "#1", "Pending"]);
    // First place's receipt names djizus, whom the board ranks second.
    expect(await pastRow(fixed(3, [{ rank: 1, address: "0x510f", lords: "150" }]))).toEqual([
      "Season 2",
      "Ended 20 Nov",
      "#1",
      "djizus",
    ]);
    // The ledger fixed no winner: no one is named.
    expect(await pastRow(fixed(0, []))).toEqual(["Season 2", "Ended 20 Nov", undefined, undefined]);
  },
);
