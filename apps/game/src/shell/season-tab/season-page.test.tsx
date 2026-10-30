import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

const DIRECTORY_DOWN = { data: undefined, isError: true, isPending: false, error: new Error("502"), refetch: vi.fn() };
const BOARD_WAITING = { data: undefined, isError: false, isPending: true };
const reads = vi.hoisted(() => ({ directory: {} as unknown, board: {} as unknown }));

// Blitz's board has its own test; this page test reads Frontier's board and the switch.
vi.mock("./blitz-board", () => ({ BlitzBoard: () => <p>Blitz board</p> }));
vi.mock("../herald", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../herald")>()),
  useDirectory: () => reads.directory,
  useLeaderboard: () => reads.board,
  useRealmsPlayer: () => ({ data: null }),
}));
afterEach(() => {
  reads.directory = DIRECTORY_DOWN;
  reads.board = BOARD_WAITING;
});
reads.directory = DIRECTORY_DOWN;
reads.board = BOARD_WAITING;
vi.spyOn(console, "error").mockImplementation(() => undefined);

import { setViewportWidth } from "../frame/test-viewport";
import { SeasonPage } from "./season-page";

const mount = async (width: number) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  setViewportWidth(width);
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter>
        <SeasonPage />
      </MemoryRouter>,
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
      prize: { pool: "300", top_n: 3, count: null },
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
    // A phone's board reads as a desktop's: each row one line, its figures in columns.
    expect([...container.querySelectorAll("button.app-row")].every((row) => row.hasAttribute("data-line"))).toBe(true);
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
