import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { GameRef } from "@bibliothecadao/eternum/shard";
import type { DirectoryGame } from "../herald";

const DIRECTORY_DOWN = { data: undefined, isError: true, isPending: false, error: new Error("502"), refetch: vi.fn() };
const BOARD_WAITING = { data: undefined, isError: false, isPending: true };
const NO_HISTORY = { data: [], isError: false, isPending: false };
const shards = vi.hoisted(() => ({
  open: vi.fn(async () => {
    throw new Error("unexpected shard read");
  }),
}));
vi.mock("@/runtime/world/shards", () => ({ requireOpenShard: shards.open }));
const reads = vi.hoisted(() => ({
  directory: {} as unknown,
  board: {} as unknown,
  settled: {} as unknown,
  boards: {} as Record<number, unknown>,
  player: null as string | null,
  useRealBoard: false,
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
    if (url.pathname.includes("/aspects/")) {
      if (roster.fail) return Promise.resolve(new Response("down", { status: 503 }));
      return Promise.resolve(Response.json(rosterAnswer(url)));
    }
    const accounts = url.searchParams.get("accounts")?.split(",") ?? [];
    if (!accounts.some((account) => names[account])) return new Promise<Response>(() => {});
    return Promise.resolve(
      Response.json({ profiles: Object.fromEntries(accounts.map((account) => [account, { name: names[account] }])) }),
    );
  }),
);

const roster = vi.hoisted(() => ({
  asked: [] as string[],
  fail: false,
  byAspect: {} as Record<
    number,
    { total: number; members: { rank: number; owner: string; realm: number; glory: number }[] }
  >,
}));
const rosterAnswer = (url: URL) => {
  roster.asked.push(`${url.pathname}${url.search}`);
  const aspect = Number(url.pathname.match(/\/aspects\/(\d+)\/members/)?.[1] ?? 1);
  const member = (rank: number, owner: string, realm: number, glory: number) => ({
    rank,
    entity_id: String(realm + 1000),
    realm_id: realm,
    owner,
    glory: String(BigInt(glory) * 1_000_000_000n),
  });
  const custom = roster.byAspect[aspect];
  const entries = custom?.members ?? [
    { rank: 1, owner: "0x4c21", realm: 7, glory: 120 },
    { rank: 2, owner: "0x510f", realm: 1, glory: 40 },
  ];
  return {
    game_id: "1",
    aspect,
    total: custom?.total ?? 12,
    offset: 0,
    limit: 10,
    members: entries.map(({ rank, owner, realm, glory }) => member(rank, owner, realm, glory)),
  };
};

// Each shard game's board is the test's; an archived season's is the real read, from its file and never a shard.
vi.mock("../herald", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../herald")>();
  const { archivedSeason } = await import("./archive/archive");
  return {
    ...actual,
    useDirectory: () => reads.directory,
    useLeaderboard: (game: GameRef | DirectoryGame | null) => {
      const ref = game === null ? null : "game_id" in game ? actual.gameRefOf(game) : game;
      const archived = ref !== null && archivedSeason(ref) !== undefined;
      const real = actual.useLeaderboard(reads.useRealBoard || archived ? game : null);
      if (reads.useRealBoard || archived) return real;
      if (ref === null) return { data: undefined, isError: false, isPending: false };
      return reads.boards[ref.gameId] ?? reads.board;
    },
    useSettledGames: () => reads.settled,
    useRealmsPlayer: () => ({ data: reads.player }),
  };
});
afterEach(() => {
  reads.directory = DIRECTORY_DOWN;
  reads.board = BOARD_WAITING;
  reads.settled = NO_HISTORY;
  reads.boards = {};
  reads.player = null;
  reads.useRealBoard = false;
  roster.asked = [];
  roster.fail = false;
  roster.byAspect = {};
  shards.open.mockClear();
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
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={["/season"]}>
          <Routes>
            <Route path="/season" element={<SeasonPage />} />
            <Route path="/results/:id" element={<Opened />} />
            <Route path="/p/:address" element={<Opened />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  return { container, unmount: () => act(async () => root.unmount()) };
};

it("says Season did not answer in the glossary's words, with Try again", async () => {
  const { container, unmount } = await mount(390);
  try {
    const body = container.querySelector('[data-band="body"]')!;
    expect(body.textContent).toContain("Season did not answer.");
    expect(body.textContent).not.toContain("502");
  } finally {
    await unmount();
  }
});

/** Frontier's live season 1, on its 4th day, with no realm on its board. */
const FRONTIER_END = Math.floor(Date.now() / 1000) + 30 * 86_400;
const FRONTIER = {
  chainId: "0x52",
  game_id: 1,
  name: "frontier-1",
  mode: "frontier",
  status: "Live",
  clock_scale: 1,
  season_number: 1,
  day_index: 3,
  day_ends_at: Math.floor(Date.now() / 1000) + 3600,
  clock: { start_settling_at: 0, start_main_at: 1, scheduled_end_at: FRONTIER_END, end_at: FRONTIER_END },
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
    expect(frontier.textContent).toContain("No realm yet. Create one from Play.");
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

it.each([
  [390, "12"],
  [1440, "10"],
])(
  "at %i px stands every one of 87 realms on Frontier's board, in a scroll %s rows tall, the player's own lit in its place",
  async (width, rowsTall) => {
    reads.directory = { data: { games: [FRONTIER] }, isError: false, isPending: false };
    const field = Array.from({ length: 87 }, (_, index) =>
      entry(`0x${(0xa00 + index).toString(16)}`, index + 1, 90 - index),
    );
    reads.board = { data: { mode: "frontier", entries: field, prize: null }, isError: false, isPending: false };
    reads.player = field[59]!.address;
    const { container, unmount } = await mount(width);
    try {
      const scroll = container.querySelector<HTMLElement>('[data-age="frontier"] .app-board-scroll')!;
      expect(scroll.style.getPropertyValue("--app-board-rows")).toBe(rowsTall);
      const rows = [...scroll.querySelectorAll(".app-board__item")];
      expect(rows.map((row) => row.querySelector(".app-rank")?.textContent)).toEqual(
        field.map(({ rank }) => String(rank)),
      );
      // The one row the stylesheet holds at the foot while its place is below: the player's, in its place.
      expect(rows.flatMap((row, index) => (row.hasAttribute("data-own") ? [index + 1] : []))).toEqual([60]);
    } finally {
      await unmount();
    }
  },
);

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
  name: `frontier-${game_id}`,
  season_number,
  status,
  day_index: null,
  day_ends_at: null,
  clock: { start_settling_at: 0, start_main_at: end_at - 10 * 86_400, scheduled_end_at: end_at, end_at },
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

it.each([390, 1440])(
  "with nothing listed or settled, shows prod's archived Playtest as it ended, from its file, at %ipx",
  async (width) => {
    reads.directory = { data: { games: [] }, isError: false, isPending: false };
    const { container, unmount } = await mount(width);
    try {
      const frontier = frontierPanel(container);
      expect(frontier.querySelector(".app-panel__cue")?.textContent).toBe("Playtest · Ended 31 Oct");
      expect(container.textContent).not.toMatch(/Season \d/);
      expect(frontier.textContent).not.toContain("No season running");
      // Prod's final board: Volcanic 166, djizus 136, Canzi 114, then the rest, all 45 realms.
      const counts = siteCounts(frontier);
      expect(counts.slice(0, 4)).toEqual([
        "166 sites cleared",
        "136 sites cleared",
        "114 sites cleared",
        "59 sites cleared",
      ]);
      expect(counts).toHaveLength(45);
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
      scheduled_end_at: ENDED_AT + 37 * 86_400,
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
    expect(await pastRow(fixed(0, []))).toEqual(["Season 2", "Ended 20 Nov", undefined, undefined]);
  },
);

it("lists the top of the player's Aspect outside the game, by Glory, from Herald's roster, with the player's own row lit", async () => {
  const { canonicalRealm } = await import("@bibliothecadao/eternum");
  const { catalogOrder } = await import("@bibliothecadao/types");
  const aspect = catalogOrder(canonicalRealm(1).order).aspect;
  shards.open.mockImplementation(async () => ({ url: "http://herald.test", chainId: "0x52" }) as never);
  roster.asked = [];
  reads.directory = {
    data: {
      games: [
        {
          ...FRONTIER,
          aspect_members: { 1: 12, 2: 0, 3: 0, 4: 0 },
          aspect_race: { finish_height: 7_500, season_days: 30, heights: { 1: 100, 2: 0, 3: 0, 4: 0 } },
          player_state: {
            structures: [
              { entity_id: 1001, category: 1, level: 1, realm_id: 1, coord_x: 0, coord_y: 0, resources_packed: "0" },
            ],
          },
        },
      ],
    },
    isError: false,
    isPending: false,
  };
  const { container, unmount } = await mount(1440);
  try {
    await vi.waitFor(() =>
      expect(container.querySelector("[data-aspect-roster]")?.textContent).toContain(
        "Your Aspect's top players · 12 members",
      ),
    );
    expect(roster.asked).toEqual([`/games/1/aspects/${aspect}/members?offset=0&limit=10`]);
    const section = container.querySelector("[data-aspect-roster]")!;
    await vi.waitFor(() => expect(section.textContent).toContain("Volcanic"));
    const items = [...section.querySelectorAll("li.app-board__item")];
    expect(items.map((item) => item.hasAttribute("data-own"))).toEqual([false, true]);
    expect(items[0]!.textContent).toContain("Volcanic");
    expect(items[0]!.textContent).toContain("120");
    expect(items[1]!.textContent).toContain("40");
  } finally {
    shards.open.mockImplementation(async () => {
      throw new Error("unexpected shard read");
    });
    await unmount();
  }
});

it("renders Season 1 Aspect race from directory without calling the Season 0 leaderboard", async () => {
  reads.directory = {
    data: {
      games: [
        {
          ...FRONTIER,
          player_count: 142,
          aspect_members: { 1: 40, 2: 38, 3: 34, 4: 30 },
          aspect_race: {
            finish_height: 7_500,
            season_days: 30,
            heights: { 1: 6_400, 2: 4_100, 3: 0, 4: 0 },
          },
        },
      ],
    },
    isError: false,
    isPending: false,
  };
  reads.useRealBoard = true;
  const { container, unmount } = await mount(1440);
  try {
    expect(shards.open).not.toHaveBeenCalled();
    expect(container.querySelector("[data-season-race]")).not.toBeNull();
    expect(container.textContent).not.toContain("Season did not answer.");
    expect(container.querySelectorAll(".hyper-tile")).toHaveLength(4);
    expect(container.querySelector('[data-aspect-id="1"] .hyper-tile__count')?.textContent).toBe("6,400");
    expect(container.textContent).toContain("Day 4 of 30");
    expect(container.textContent).toContain("Clear Mist · 1,500 height");
    expect(container.textContent).not.toContain("LORDS per height point");
    expect(container.textContent).not.toContain("LORDS");
  } finally {
    await unmount();
  }
});

it.each([
  [390, true],
  [1440, true],
  [390, false],
  [1440, false],
])(
  "shows any clicked Aspect tab's member Glory roster at %ipx (signedIn=%s) and opens /p/<owner> on click",
  async (width, signedIn) => {
    shards.open.mockImplementation(async () => ({ url: "http://herald.test", chainId: "0x52" }) as never);
    roster.byAspect = {
      2: {
        total: 18,
        members: [
          { rank: 1, owner: "0x6481", realm: 21, glory: 340 },
          { rank: 2, owner: "0x4c21", realm: 22, glory: 190 },
        ],
      },
    };
    reads.directory = {
      data: {
        games: [
          {
            ...FRONTIER,
            aspect_members: { 1: 12, 2: 18, 3: 5, 4: 0 },
            aspect_race: { finish_height: 7_500, season_days: 30, heights: { 1: 100, 2: 200, 3: 50, 4: 0 } },
            player_state: signedIn
              ? {
                  structures: [
                    {
                      entity_id: 1001,
                      category: 1,
                      level: 1,
                      realm_id: 1,
                      coord_x: 0,
                      coord_y: 0,
                      resources_packed: "0",
                    },
                  ],
                }
              : null,
          },
        ],
      },
      isError: false,
      isPending: false,
    };
    const { container, unmount } = await mount(width);
    try {
      const luminaryTab = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
        (tab) => tab.textContent === "Luminary",
      )!;
      await act(async () => luminaryTab.click());
      await vi.waitFor(() =>
        expect(container.querySelector('[data-aspect-roster="2"]')?.textContent).toContain("Canzi"),
      );
      expect(roster.asked).toContain("/games/1/aspects/2/members?offset=0&limit=10");
      const section = container.querySelector('[data-aspect-roster="2"]')!;
      expect(section.textContent).toContain("Luminary's top players · 18 members");
      expect(section.textContent).toContain("340");
      expect(section.textContent).toContain("Volcanic");
      expect(section.textContent).toContain("190");
      const firstRow = section.querySelector<HTMLButtonElement>("button.app-board__row")!;
      await act(async () => firstRow.click());
      expect(container.querySelector("[data-opened]")?.textContent).toBe("/p/0x6481");
    } finally {
      shards.open.mockImplementation(async () => {
        throw new Error("unexpected shard read");
      });
      await unmount();
    }
  },
);

it("renders the player's own Aspect roster once when their own Aspect tab is selected and shows an honest empty line for an empty Aspect", async () => {
  const { canonicalRealm } = await import("@bibliothecadao/eternum");
  const { aspectName, catalogOrder } = await import("@bibliothecadao/types");
  const ownAspect = catalogOrder(canonicalRealm(1).order).aspect!;
  shards.open.mockImplementation(async () => ({ url: "http://herald.test", chainId: "0x52" }) as never);
  roster.byAspect = { 4: { total: 0, members: [] } };
  reads.directory = {
    data: {
      games: [
        {
          ...FRONTIER,
          aspect_members: { 1: 12, 2: 8, 3: 5, 4: 0 },
          aspect_race: { finish_height: 7_500, season_days: 30, heights: { 1: 100, 2: 80, 3: 50, 4: 0 } },
          player_state: {
            structures: [
              { entity_id: 1001, category: 1, level: 1, realm_id: 1, coord_x: 0, coord_y: 0, resources_packed: "0" },
            ],
          },
        },
      ],
    },
    isError: false,
    isPending: false,
  };
  const { container, unmount } = await mount(1440);
  try {
    await vi.waitFor(() => expect(container.querySelectorAll("[data-aspect-roster]")).toHaveLength(1));
    const ownTab = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
      (tab) => tab.textContent === aspectName(ownAspect),
    )!;
    await act(async () => ownTab.click());
    await vi.waitFor(() => {
      const rosters = container.querySelectorAll("[data-aspect-roster]");
      expect(rosters).toHaveLength(1);
      expect(rosters[0]?.textContent).toContain("Your Aspect's top players · 12 members");
    });
    const insightTab = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
      (tab) => tab.textContent === "Insight",
    )!;
    await act(async () => insightTab.click());
    await vi.waitFor(() =>
      expect(container.querySelector('[data-aspect-roster="4"]')?.textContent).toContain("No realms in Insight yet."),
    );
  } finally {
    shards.open.mockImplementation(async () => {
      throw new Error("unexpected shard read");
    });
    await unmount();
  }
});

it("shows ServiceFailure with Try again in Your standing when Herald's roster read fails, and recovers on retry", async () => {
  shards.open.mockImplementation(async () => ({ url: "http://herald.test", chainId: "0x52" }) as never);
  roster.fail = true;
  reads.directory = {
    data: {
      games: [
        {
          ...FRONTIER,
          aspect_members: { 1: 12, 2: 0, 3: 0, 4: 0 },
          aspect_race: { finish_height: 7_500, season_days: 30, heights: { 1: 100, 2: 0, 3: 0, 4: 0 } },
          player_state: {
            structures: [
              { entity_id: 1001, category: 1, level: 1, realm_id: 1, coord_x: 0, coord_y: 0, resources_packed: "0" },
            ],
          },
        },
      ],
    },
    isError: false,
    isPending: false,
  };
  const { container, unmount } = await mount(1440);
  try {
    const section = () => container.querySelector("[data-aspect-roster]")!;
    await vi.waitFor(() => expect(section().textContent).toContain("Season did not answer."));
    const retry = [...section().querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent === "Try again",
    )!;
    expect(retry).toBeDefined();
    roster.fail = false;
    await act(async () => retry.click());
    await vi.waitFor(() => expect(section().textContent).toContain("Your Aspect's top players · 12 members"));
  } finally {
    shards.open.mockImplementation(async () => {
      throw new Error("unexpected shard read");
    });
    await unmount();
  }
});
