import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => vi.stubGlobal("fetch", () => new Promise<Response>(() => {})));
const breakdown = (points: number) => ({
  exploration: { count: 36, points: points - 280 },
  openRelicChest: { count: 3, points: 30 },
  hyperStructureBanditsDefeat: { count: 1, points: 100 },
  otherStructureBanditsDefeat: { count: 2, points: 40 },
  hyperstructureShare: { count: 1, points: 110 },
});
// A finished Blitz as Herald's points board answers it: the reader third of three (a test may set another board).
const THIRD_OF_THREE = [
  { address: "0xa1", rank: 1, totalPoints: 412, activityBreakdown: breakdown(412) },
  { address: "0xa2", rank: 2, totalPoints: 382, activityBreakdown: breakdown(382) },
  { address: "0xb7", rank: 3, totalPoints: 352, activityBreakdown: breakdown(352) },
];
const board = vi.hoisted(() => ({ entries: null as unknown[] | null, everyone: [] as unknown[] }));
vi.mock("../herald", () => ({
  useLeaderboard: () => ({
    isError: false,
    isPending: false,
    data: { mode: "points", game_id: "7", entries: board.entries ?? THIRD_OF_THREE },
  }),
  useRealmsPlayer: () => ({ data: "0xb7" }),
  useDirectory: () => ({ data: { games: [] } }),
  // The player's own history holds nothing; every player's recent history holds what a test sets.
  useRecentResults: (...read: [limit: number, player?: string | null]) => ({
    data: { games: (read[1] ?? null) === null ? board.everyone : [] },
  }),
}));
vi.mock("@/hooks/context/identity-session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/context/identity-session")>()),
  useIdentitySession: () => ({ status: "signed-out", session: null }),
}));
vi.mock("@/ui/design-system/kit/player-name", () => ({
  PlayerName: ({ account }: { account: string }) => <span>{account}</span>,
}));

import { getPlayerDisplayName } from "@/services/identity/player-profiles";

import { setViewportWidth } from "../frame/test-viewport";
import { gameTitle } from "./history-row";
import { ResultsPage } from "./results-page";

let unmount: (() => Promise<void>) | null = null;
afterEach(async () => {
  await unmount?.();
  unmount = null;
});

/** Where a press led, once it left the Results. */
const Where = () => {
  const { pathname, search } = useLocation();
  return <output data-where>{`${pathname}${search}`}</output>;
};

const open = async (width: number) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  setViewportWidth(width);
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/results/0x52-7"]}>
          <Routes>
            <Route path="/results/:id" element={<ResultsPage />} />
            <Route path="*" element={<Where />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  unmount = () => act(async () => root.unmount());
  return container;
};

it.each([390, 1440])(
  "leads a Blitz result with the player's place and points at %i px, its buttons the page's own",
  async (width) => {
    const page = await open(width);
    const body = page.querySelector('[data-band="body"]')!;
    // The first panel in the body is the outcome: the player's place of the field and their points.
    const outcome = body.querySelector(".app-panel")!;
    expect(outcome.textContent).toContain("3rd of 3");
    expect(outcome.textContent).toContain("352 points");
    // Continue (the gold, with no chest to open), the end map and Share are the page's own.
    const buttons = [...page.querySelectorAll("button")].map((button) => [button.textContent, button.dataset.kind]);
    expect(buttons).toEqual([
      ["Share", "quiet"],
      ["See the end map", "secondary"],
      ["Continue", "primary"],
    ]);
  },
);

it("names the player's portrait by the one name rule, never by their address", async () => {
  const page = await open(1440);
  const portrait = page.querySelector<HTMLElement>(".app-portrait")!;
  // Identity never answers here: the rule says the name is on its way, never the address or the stand-in.
  expect(portrait.title).toBe(getPlayerDisplayName("0xb7"));
  expect(portrait.title).toBe("…");
  expect(portrait.title).not.toContain("0x");
});

it("opens the finished game's end map, watched, from See the end map", async () => {
  const page = await open(1440);
  const endMap = [...page.querySelectorAll("button")].find((button) => button.textContent === "See the end map")!;
  await act(async () => endMap.click());
  expect(page.querySelector("[data-where]")?.textContent).toBe("/g/0x52/7?spectate=true");
});

it("says how the player's points were made, a row per kind with its count and points, none counted twice", async () => {
  const page = await open(1440);
  const panels = [...page.querySelectorAll(".app-panel")];
  const points = panels.find((panel) => panel.querySelector("h2")?.textContent === "Your points")!;
  expect([...points.querySelectorAll(".app-row")].map((row) => row.textContent)).toEqual([
    "Tiles explored× 3672 points",
    "Crates opened× 330 points",
    "Rifts and camps× 240 points",
    "Hyperstructures taken× 1100 points",
    "Hyperstructures held110 points",
  ]);
});

/** Share, pressed: what it handed the device, and the page after (qa-app-1 P2-1: one Results story). */
const pressShare = async (device: { share?: (data: ShareData) => Promise<void>; clipboard?: Clipboard }) => {
  const restore = Object.entries(device).map(([key, value]) => {
    const own = Object.getOwnPropertyDescriptor(navigator, key);
    Object.defineProperty(navigator, key, { configurable: true, value });
    return () => (own ? Object.defineProperty(navigator, key, own) : delete (navigator as never)[key]);
  });
  try {
    const page = await open(1440);
    const share = [...page.querySelectorAll("button")].find((button) => button.textContent === "Share")!;
    await act(async () => share.click());
    await act(async () => {});
    return page;
  } finally {
    restore.forEach((undo) => undo());
  }
};

it("shares the result the page tells, its line and its address, and opens no other account of the game", async () => {
  const share = vi.fn(async () => {});
  const page = await pressShare({ share });
  expect(share).toHaveBeenCalledWith({
    title: "Results",
    text: "Results · 3rd of 3 · 352 points",
    url: `${window.location.origin}/results/0x52-7`,
  });
  // No walkthrough of its own over the page: the old "Game In Review" told another story.
  expect(document.body.textContent).not.toMatch(/game in review/i);
  expect(page.querySelector('[role="dialog"]')).toBeNull();
});

it("copies the same line and address where the device has no share sheet, and says so", async () => {
  const writeText = vi.fn(async () => {});
  const page = await pressShare({ share: undefined, clipboard: { writeText } as unknown as Clipboard });
  expect(writeText).toHaveBeenCalledWith(`Results · 3rd of 3 · 352 points ${window.location.origin}/results/0x52-7`);
  expect([...page.querySelectorAll("button")].map((button) => button.textContent)).toContain("Link copied");
});

it("says the player scored no points, rather than an empty panel, in a game tied on none (qa-app-1 P3-11)", async () => {
  const nothing = {
    exploration: { count: 0, points: 0 },
    openRelicChest: { count: 0, points: 0 },
    hyperStructureBanditsDefeat: { count: 0, points: 0 },
    otherStructureBanditsDefeat: { count: 0, points: 0 },
    hyperstructureShare: { count: 0, points: 0 },
  };
  board.entries = [
    { address: "0xa1", rank: 1, totalPoints: 0, activityBreakdown: nothing },
    { address: "0xb7", rank: 1, totalPoints: 0, activityBreakdown: nothing },
  ];
  try {
    const page = await open(1440);
    const panels = [...page.querySelectorAll(".app-panel")];
    const points = panels.find((panel) => panel.querySelector("h2")?.textContent === "Your points")!;
    expect(points.textContent).toBe("Your pointsNo points scored.");
    expect(panels[0].textContent).toContain("1st of 2");
  } finally {
    board.entries = null;
  }
});

describe("Results read by a player who had no seat in the game (qa-app-2 P3-13)", () => {
  const outsiders = () => {
    board.entries = [
      { address: "0xa1", rank: 1, totalPoints: 310, activityBreakdown: breakdown(310) },
      { address: "0xa2", rank: 2, totalPoints: 10, activityBreakdown: breakdown(290) },
    ];
  };
  afterEach(() => {
    board.entries = null;
    board.everyone = [];
  });

  it("names the game from every player's recent history, and says the reader had no seat, never '—'", async () => {
    outsiders();
    const game = {
      chainId: "0x52",
      game_id: 7,
      name: "blitz-7",
      mode: "blitz",
      status: "Ended",
      clock: { start_settling_at: 0, start_main_at: 100, end_at: 1_790_000_000, end_grace_seconds: 0 },
    };
    board.everyone = [game];
    const page = await open(1440);
    const outcome = page.querySelector('[data-band="body"] .app-panel')!;
    expect(outcome.textContent).toContain(gameTitle(game as never));
    expect(outcome.textContent).toContain("You had no seat in this game.");
    expect(outcome.textContent).not.toContain("—");
  });

  it("names a game no list holds by its number", async () => {
    outsiders();
    const page = await open(390);
    const outcome = page.querySelector('[data-band="body"] .app-panel')!;
    expect(outcome.textContent).toBe("Blitz · game 7You had no seat in this game.");
  });
});
