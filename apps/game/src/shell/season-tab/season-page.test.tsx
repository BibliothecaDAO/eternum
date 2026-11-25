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
      "0x45d6bd2bb5415e3fca5edd5dc00035510d165af218a92ed4cc44e58126d48d7": "Kestrel",
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
import { mergeAspectRosters } from "./aspect-roster";
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
    expect(body.textContent).toContain("Season unavailable.");
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
    expect(frontier.textContent).toContain("No Realm yet. Create one on Play.");
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
const SEASON_ZERO_RESULTS = "/results/0x50524f44554354494f4e5f31386534326539316432343133646337-1";
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
  "with nothing listed or settled, shows prod's archived Season 0 as it ended, from its saved board, and the Playtest under Past seasons, at %ipx",
  async (width) => {
    const { default: seasonZero } =
      await import("../../../../../packages/core/src/sync/season-archives/season-zero.json");
    reads.directory = { data: { games: [] }, isError: false, isPending: false };
    const { container, unmount } = await mount(width);
    try {
      const frontier = frontierPanel(container);
      expect(frontier.querySelector(".app-panel__cue")?.textContent).toBe("Season 0 · Ended 6 Nov");
      expect(frontier.textContent).not.toContain("No season running");
      const counts = siteCounts(frontier);
      expect(counts.slice(0, 4)).toEqual([
        "331 sites cleared",
        "318 sites cleared",
        "313 sites cleared",
        "312 sites cleared",
      ]);
      expect(counts.slice(0, 4)).toEqual(
        seasonZero.leaderboard.entries.slice(0, 4).map(({ sites_cleared }) => `${sites_cleared.total} sites cleared`),
      );
      expect(counts).toHaveLength(seasonZero.leaderboard.entries.length);
      expect(container.querySelector('[aria-label="Season prizes"]')).not.toBeNull();
      expect(pastRows(container)).toEqual([["Playtest", "Ended 31 Oct", "#1", "Volcanic"]]);
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
    expect(pastRows(container)).toEqual([
      ["Season 0", "Ended 6 Nov", "#1", "Kestrel"],
      ["Playtest", "Ended 31 Oct", "#1", "Volcanic"],
    ]);
    await act(async () => (pastPanel(container)!.querySelector("button.app-row") as HTMLButtonElement).click());
    expect(container.querySelector("[data-opened]")?.textContent).toBe(SEASON_ZERO_RESULTS);
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
      ["Season 0", "Ended 6 Nov", "#1", "Kestrel"],
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
    expect(frontier.querySelector(".app-panel__cue")?.textContent).toBe("Season 0 · Ended 6 Nov");
    expect(frontier.querySelector("button.app-board__row .app-board__figure")?.textContent).toBe("331 sites cleared");
    expect(frontier.textContent).not.toContain("No Realm yet");
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

it("merges Aspect rosters into one global Glory leaderboard sorted by compareAspectMembers and capped at top 10", () => {
  const member = (rank: number, entityId: string, realmId: number, owner: string, glory: number) => ({
    rank,
    entity_id: entityId,
    realm_id: realmId,
    owner,
    glory: String(BigInt(glory) * 1_000_000_000n),
  });
  const aspectOneMembers = Array.from({ length: 6 }, (_, index) =>
    member(index + 1, String(10 + index), index + 1, "0x4c21", 250 - index * 20),
  );
  const aspectTwoMembers = [
    member(1, "1003", 11, "0x6481", 400),
    member(2, "9", 12, "0x510f", 250),
    ...Array.from({ length: 5 }, (_, index) =>
      member(index + 3, String(200 + index), 13 + index, "0x510f", 200 - index * 20),
    ),
  ];
  const merged = mergeAspectRosters([
    {
      aspect: 1 as const,
      roster: { game_id: "1", aspect: 1, total: 10, offset: 0, limit: 10, members: aspectOneMembers },
    },
    {
      aspect: 2 as const,
      roster: { game_id: "1", aspect: 2, total: 8, offset: 0, limit: 10, members: aspectTwoMembers },
    },
  ]);
  expect(merged.total).toBe(18);
  expect(merged.rows).toHaveLength(10);
  expect(merged.rows.slice(0, 4).map((row) => [row.rank, row.aspect, row.member.entity_id, row.member.glory])).toEqual([
    [1, 2, "1003", "400000000000"],
    [2, 2, "9", "250000000000"],
    [3, 1, "10", "250000000000"],
    [4, 1, "11", "230000000000"],
  ]);
});

it("combines all four Aspect rosters into the default Global Glory leaderboard with own realm highlighted and Stage Triumph rules shown", async () => {
  const { canonicalRealm } = await import("@bibliothecadao/eternum");
  const { aspectName, catalogOrder } = await import("@bibliothecadao/types");
  const ownRealm = canonicalRealm(1);
  const ownAspect = catalogOrder(ownRealm.order).aspect!;
  shards.open.mockImplementation(async () => ({ url: "http://herald.test", chainId: "0x52" }) as never);
  const otherAspects = ([1, 2, 3, 4] as const).filter((id) => id !== ownAspect);
  roster.byAspect = {
    [ownAspect]: {
      total: 12,
      members: [
        { rank: 1, owner: "0x510f", realm: 1, glory: 320 },
        { rank: 2, owner: "0x4c21", realm: 7, glory: 260 },
      ],
    },
    [otherAspects[0]!]: { total: 18, members: [{ rank: 1, owner: "0x6481", realm: 21, glory: 410 }] },
    [otherAspects[1]!]: { total: 5, members: [] },
    [otherAspects[2]!]: { total: 0, members: [] },
  };
  reads.directory = {
    data: {
      games: [
        {
          ...FRONTIER,
          player_count: 142,
          aspect_members: { 1: 12, 2: 18, 3: 5, 4: 0 },
          aspect_race: {
            finish_height: 7_500,
            season_days: 30,
            heights: { 1: 6_400, 2: 4_100, 3: 100, 4: 0 },
            triumph_percents: { 1: 150, 2: 200, 3: 50, 4: 200 },
          },
          player_state: {
            structures: [
              {
                entity_id: 1001,
                category: 1,
                level: 1,
                realm_id: 1,
                coord_x: 0,
                coord_y: 0,
                resources_packed: "0",
                aspect: null,
                has_wonder: false,
              },
            ],
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
    expect(container.querySelector("[data-season-race]")).not.toBeNull();
    expect(container.querySelectorAll(".hyper-tile")).toHaveLength(4);
    expect(container.querySelector('[data-aspect-id="1"] .hyper-tile__count')?.textContent).toBe("6,400");
    expect(container.querySelector("[data-aspect-summary]")).toBeNull();
    expect(container.textContent).toContain("Day 4 of 30");
    expect(container.textContent).not.toContain("LORDS");
    expect(container.querySelector(".season-triumphs__grid")).toBeNull();
    const triumphTracks = [...container.querySelectorAll(".hyper-tile [data-stage-triumphs]")];
    expect(triumphTracks).toHaveLength(4);
    expect(triumphTracks.map((track) => track.querySelectorAll(".hyper-tile__marker[data-reached]").length)).toEqual([
      4, 2, 0, 0,
    ]);
    const triumphs = triumphTracks[0]!;
    expect(triumphs.textContent).toContain("Clear Mist");
    expect(triumphs.textContent).toContain("1,500 height");
    expect(triumphs.textContent).toContain("Site discovery odds are 150% of normal");
    expect(triumphs.textContent).toContain("Second Wind");
    expect(triumphs.textContent).toContain("Pale Moon");
    expect(triumphs.textContent).toContain("Spoils");
    await vi.waitFor(() => expect(container.querySelector("[data-global-roster]")?.textContent).toContain("Canzi"));
    expect(container.querySelector("[data-global-roster]")?.textContent).toContain("Top players · 35 members");
    expect(roster.asked.filter((path) => path.includes("/leaderboard"))).toEqual([]);
    expect(roster.asked).toEqual(
      expect.arrayContaining([
        "/games/1/aspects/1/members?offset=0&limit=10",
        "/games/1/aspects/2/members?offset=0&limit=10",
        "/games/1/aspects/3/members?offset=0&limit=10",
        "/games/1/aspects/4/members?offset=0&limit=10",
      ]),
    );
    const board = container.querySelector("[data-global-roster]")!;
    await vi.waitFor(() => expect(board.textContent).toContain("Volcanic"));
    const items = [...board.querySelectorAll("li.app-board__item")];
    expect(items).toHaveLength(3);
    expect(board.querySelectorAll(".season-board__realm")).toHaveLength(0);
    expect(items.map((item) => item.hasAttribute("data-own"))).toEqual([false, true, false]);
    expect(items[0]!.textContent).toContain("Canzi");
    expect(items[0]!.textContent).toContain("410");
    expect(items[1]!.textContent).toContain("You");
    expect(items[1]!.textContent).toContain(catalogOrder(ownRealm.order).orderName);
    expect(items[1]!.textContent).toContain("320");
    expect(items[2]!.textContent).toContain("Volcanic");
    expect(items[2]!.textContent).toContain("260");
    const ownTab = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
      (tab) => tab.textContent === aspectName(ownAspect),
    )!;
    await act(async () => ownTab.click());
    await vi.waitFor(() =>
      expect(container.querySelector(`[data-aspect-roster="${ownAspect}"]`)?.textContent).toContain(
        "Your Aspect's top players · 12 members",
      ),
    );
  } finally {
    shards.open.mockImplementation(async () => {
      throw new Error("unexpected shard read");
    });
    await unmount();
  }
});

it.each([1440, 390])(
  "renders Season 1 procedural race stage and 4 Aspect stat cards from directory without calling the Season 0 leaderboard at %ipx",
  async (width) => {
    shards.open.mockImplementation(async () => ({ url: "http://herald.test", chainId: "0x52" }) as never);
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
              triumph_percents: { 1: 150, 2: 200, 3: 50, 4: 200 },
            },
          },
        ],
      },
      isError: false,
      isPending: false,
    };
    reads.useRealBoard = true;
    const { container, unmount } = await mount(width);
    try {
      expect(roster.asked.filter((path) => path.includes("/leaderboard"))).toEqual([]);
      expect(container.querySelector("[data-season-race]")).not.toBeNull();
      expect(container.querySelectorAll("[data-race-stage]")).toHaveLength(1);
      expect(container.querySelector("[data-race-stage]")?.getAttribute("data-race-surface")).toBe("shell");
      expect(container.querySelectorAll(".hyper-art__svg")).toHaveLength(0);
      expect(container.textContent).not.toContain("Season unavailable.");
      const cards = [...container.querySelectorAll(".hyper-tile")];
      expect(cards).toHaveLength(4);
      expect(cards.map((card) => card.querySelector(".hyper-tile__count")?.textContent)).toEqual([
        "6,400",
        "4,100",
        "0",
        "0",
      ]);
      expect(cards.map((card) => card.querySelector(".hyper-tile__goal")?.textContent)).toEqual([
        "of 7,500",
        "of 7,500",
        "of 7,500",
        "of 7,500",
      ]);
      expect(cards.map((card) => card.querySelectorAll(".hyper-tile__pip[data-filled]").length)).toEqual([4, 2, 0, 0]);
      expect(cards.map((card) => card.querySelector(".hyper-tile__members")?.textContent)).toEqual([
        "40",
        "38",
        "34",
        "30",
      ]);
      expect(container.textContent).toContain("Day 4 of 30");
      expect(container.textContent).toContain("Clear Mist");
      expect(container.textContent).toContain("1,500 height");
      expect(container.textContent).not.toContain("LORDS per height point");
      expect(container.textContent).not.toContain("LORDS");
    } finally {
      shards.open.mockImplementation(async () => {
        throw new Error("unexpected shard read");
      });
      await unmount();
    }
  },
);
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
      1: { total: 12, members: [{ rank: 1, owner: "0x4c21", realm: 7, glory: 120 }] },
      2: {
        total: 18,
        members: [
          { rank: 1, owner: "0x6481", realm: 21, glory: 340 },
          { rank: 2, owner: "0x4c21", realm: 22, glory: 190 },
        ],
      },
      3: { total: 5, members: [] },
      4: { total: 0, members: [] },
    };
    reads.directory = {
      data: {
        games: [
          {
            ...FRONTIER,
            aspect_members: { 1: 12, 2: 18, 3: 5, 4: 0 },
            aspect_race: {
              finish_height: 7_500,
              season_days: 30,
              heights: { 1: 100, 2: 200, 3: 50, 4: 0 },
              triumph_percents: { 1: 150, 2: 200, 3: 50, 4: 200 },
            },
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
                      aspect: null,
                      has_wonder: false,
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

it("shows honest empty lines for empty global and Aspect boards", async () => {
  const { canonicalRealm } = await import("@bibliothecadao/eternum");
  const { aspectName, catalogOrder } = await import("@bibliothecadao/types");
  const ownAspect = catalogOrder(canonicalRealm(1).order).aspect!;
  shards.open.mockImplementation(async () => ({ url: "http://herald.test", chainId: "0x52" }) as never);
  roster.byAspect = {
    1: { total: 0, members: [] },
    2: { total: 0, members: [] },
    3: { total: 0, members: [] },
    4: { total: 0, members: [] },
  };
  reads.directory = {
    data: {
      games: [
        {
          ...FRONTIER,
          aspect_members: { 1: 12, 2: 8, 3: 5, 4: 0 },
          aspect_race: {
            finish_height: 7_500,
            season_days: 30,
            heights: { 1: 100, 2: 80, 3: 50, 4: 0 },
            triumph_percents: { 1: 150, 2: 200, 3: 50, 4: 200 },
          },
          player_state: {
            structures: [
              {
                entity_id: 1001,
                category: 1,
                level: 1,
                realm_id: 1,
                coord_x: 0,
                coord_y: 0,
                resources_packed: "0",
                aspect: null,
                has_wonder: false,
              },
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
      expect(container.querySelector("[data-global-roster]")?.textContent).toContain(
        "No Realm yet. Create one on Play.",
      ),
    );
    const ownTab = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
      (tab) => tab.textContent === aspectName(ownAspect),
    )!;
    await act(async () => ownTab.click());
    await vi.waitFor(() =>
      expect(container.querySelector(`[data-aspect-roster="${ownAspect}"]`)?.textContent).toContain(
        `No Realms in ${aspectName(ownAspect)} yet.`,
      ),
    );
    const insightTab = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
      (tab) => tab.textContent === "Insight",
    )!;
    await act(async () => insightTab.click());
    await vi.waitFor(() =>
      expect(container.querySelector('[data-aspect-roster="4"]')?.textContent).toContain("No Realms in Insight yet."),
    );
  } finally {
    shards.open.mockImplementation(async () => {
      throw new Error("unexpected shard read");
    });
    await unmount();
  }
});

it("shows ServiceFailure with Try again on the Global Glory leaderboard when Herald's roster read fails, and recovers on retry", async () => {
  shards.open.mockImplementation(async () => ({ url: "http://herald.test", chainId: "0x52" }) as never);
  roster.fail = true;
  reads.directory = {
    data: {
      games: [
        {
          ...FRONTIER,
          aspect_members: { 1: 12, 2: 0, 3: 0, 4: 0 },
          aspect_race: {
            finish_height: 7_500,
            season_days: 30,
            heights: { 1: 100, 2: 0, 3: 0, 4: 0 },
            triumph_percents: { 1: 150, 2: 200, 3: 50, 4: 200 },
          },
          player_state: {
            structures: [
              {
                entity_id: 1001,
                category: 1,
                level: 1,
                realm_id: 1,
                coord_x: 0,
                coord_y: 0,
                resources_packed: "0",
                aspect: null,
                has_wonder: false,
              },
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
    const section = () => container.querySelector("[data-global-roster]")!;
    await vi.waitFor(() => expect(section().textContent).toContain("Season unavailable."));
    const retry = [...section().querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent === "Try again",
    )!;
    expect(retry).toBeDefined();
    roster.fail = false;
    await act(async () => retry.click());
    await vi.waitFor(() => expect(section().textContent).toContain("Volcanic"));
  } finally {
    shards.open.mockImplementation(async () => {
      throw new Error("unexpected shard read");
    });
    await unmount();
  }
});
