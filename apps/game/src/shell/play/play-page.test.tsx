import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { formatClockTime } from "@bibliothecadao/types";

import type { NextBlitzGame, PlaytestSlot } from "../blitz-slot";
import type { DirectoryGame } from "../herald";

/** A query as the page reads it: answered with `data`, failed, or still on its way. */
type Read<T> = { data: T | undefined; isSuccess: boolean; isError: boolean; error: unknown; refetch: () => void };
const answered = <T,>(data: T): Read<T> => ({ data, isSuccess: true, isError: false, error: null, refetch: vi.fn() });
const failed = <T,>(): Read<T> => ({
  data: undefined,
  isSuccess: false,
  isError: true,
  error: new Error("503"),
  refetch: vi.fn(),
});

const reads = vi.hoisted(() => ({
  signedIn: true,
  directory: null as unknown as Read<{ games: DirectoryGame[] }>,
  slots: null as unknown as Read<{ slots: PlaytestSlot[] }>,
  // The season calendar's next Blitz game: none left in the season unless a case names one.
  nextBlitz: {
    data: null,
    isSuccess: true,
    isError: false,
    error: null,
    refetch: () => {},
  } as Read<NextBlitzGame | null>,
  history: null as unknown as Read<{ games: DirectoryGame[]; next: null; failures: { url: string }[] }>,
  // The signed-in account's build orders, as its identity service answers them: none saved unless a case says.
  buildOrders: { orders: [], active: null } as unknown,
}));

vi.mock("@/hooks/context/identity-session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/context/identity-session")>()),
  identityClient: { getBuildOrders: async () => ({ owner: "0x7", revision: 1, book: reads.buildOrders }) },
  useIdentitySession: () =>
    reads.signedIn
      ? { status: "signed-in", session: { user: { id: "u", realmsId: "0x7" } } }
      : { status: "signed-out", session: null },
}));
vi.mock("../herald", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../herald")>()),
  useDirectory: () => reads.directory,
  useRealmsPlayer: () => ({ ...answered(null), data: "0x4a1" }),
  useRecentResults: () => reads.history,
  useLeaderboard: () => ({ data: undefined }),
}));
vi.mock("../blitz-slot", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../blitz-slot")>()),
  usePlaytestSlots: () => reads.slots,
  useNextBlitz: () => reads.nextBlitz,
}));
vi.mock("../blitz/entry", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../blitz/entry")>()),
  useRefundSlots: () => new Map(),
  useSlotRegistered: () => 12,
}));

import { PlayPage } from "./play-page";

import { useBuildOrderStore } from "@/hooks/use-build-orders";

const REALM = { category: 1, realm_id: 3098, level: 1 };
const game = (over: Partial<DirectoryGame>): DirectoryGame =>
  ({
    chainId: "0xa",
    game_id: 1,
    name: "frontier-1",
    mode: "frontier",
    status: "Live",
    ready: true,
    expedition: null,
    clock: { start_settling_at: 0, start_main_at: 100, end_at: 4_000_000_000, end_grace_seconds: 0 },
    player_count: 10,
    roster_count: 0,
    player_state: { registered: false, settled: false, roster_wallet: null, held_realm_id: null, structures: [] },
    ...over,
  }) as DirectoryGame;
const ownSeason = game({
  player_state: { registered: true, settled: true, roster_wallet: null, held_realm_id: null, structures: [REALM] },
} as Partial<DirectoryGame>);
const slot: PlaytestSlot = {
  slotId: 3,
  chainId: "0xa",
  name: "blitz-1",
  closesAt: new Date(4_000_000_000 * 1000).toISOString(),
  frozenAt: null,
  closed: false,
};
/** A seat on a Blitz roster whose game is still being prepared (not ready), and the same game once it opens. */
const preparing = game({
  game_id: 8,
  mode: "blitz",
  status: "Registration",
  ready: false,
  clock: { start_settling_at: 0, start_main_at: 4_000_000_000, end_at: 4_000_100_000, end_grace_seconds: 0 },
  roster_count: 24,
  player_count: 18,
  player_state: { registered: true, settled: false, roster_wallet: "0x4a1", held_realm_id: null, structures: [] },
} as Partial<DirectoryGame>);

let where = "";
const Where = () => {
  const location = useLocation();
  useEffect(() => {
    where = location.pathname;
  }, [location]);
  return null;
};

let cleanup: (() => Promise<void>) | null = null;
afterEach(async () => {
  await cleanup?.();
  cleanup = null;
  reads.signedIn = true;
  reads.nextBlitz = answered(null);
  reads.buildOrders = { orders: [], active: null };
  useBuildOrderStore.setState({ owner: null, status: "signed-out", book: null, revision: 0, notice: null });
});

const mount = async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const render = () =>
    act(async () =>
      root.render(
        <MemoryRouter initialEntries={["/"]}>
          <Where />
          <Routes>
            <Route path="/" element={<PlayPage />} />
            <Route path="/blitz/build-orders" element={<p>build orders</p>} />
            <Route path="/blitz/:id" element={<p>lobby</p>} />
          </Routes>
        </MemoryRouter>,
      ),
    );
  await render();
  cleanup = async () => {
    await act(async () => root.unmount());
    container.remove();
  };
  return { render, text: () => container.textContent ?? "", container };
};

const press = (container: HTMLElement, word: string) =>
  act(async () =>
    [...container.querySelectorAll("button")].find((button) => button.textContent?.includes(word))!.click(),
  );

it("says Blitz did not answer, with Try again, instead of 'nothing running' when the slots fail; and recovers", async () => {
  reads.directory = answered({ games: [] });
  reads.slots = failed();
  reads.history = answered({ games: [], next: null, failures: [] });
  const page = await mount();
  expect(page.text()).toContain("Blitz did not answer.");
  expect(page.text()).not.toContain("No season running");
  await press(page.container, "Try again");
  expect(reads.slots.refetch).toHaveBeenCalled();

  reads.slots = answered({ slots: [slot] });
  await page.render();
  expect(page.text()).not.toContain("did not answer");
  expect(page.text()).toContain("Join");
});

it("keeps the games that answered usable while the player's results fail, in full or in part", async () => {
  reads.directory = answered({ games: [ownSeason] });
  reads.slots = answered({ slots: [] });
  reads.history = failed();
  const page = await mount();
  expect(page.text()).toContain("Resume");
  expect(page.text()).toContain("Results did not answer.");

  reads.history = answered({ games: [], next: null, failures: [{ url: "https://shard" }] });
  await page.render();
  expect(page.text()).toContain("Resume");
  expect(page.text()).toContain("Results did not answer.");
});

it("opens a seated game still being prepared on its lobby from Play, and offers Enter once it opens", async () => {
  reads.directory = answered({ games: [preparing] });
  reads.slots = answered({ slots: [] });
  reads.history = answered({ games: [], next: null, failures: [] });
  const page = await mount();
  expect(page.text()).not.toContain("Enter");
  await press(page.container, "Lobby");
  expect(where).toBe("/blitz/game-0xa-8");

  reads.directory = answered({ games: [{ ...preparing, status: "Live", ready: true } as DirectoryGame] });
  const ready = await mount();
  expect(ready.text()).toContain("Enter");
  expect(ready.text()).not.toContain("Lobby");
});

it.each([
  [1, "1 player"],
  [14, "14 players"],
])("counts a season's %i players in the right number on its card (qa-app-2 P3-12)", async (count, says) => {
  reads.directory = answered({ games: [game({ player_count: count })] });
  reads.slots = answered({ slots: [] });
  reads.history = answered({ games: [], next: null, failures: [] });
  const page = await mount();
  const chips = [...page.container.querySelectorAll(".app-chip")].map((chip) => chip.textContent);
  expect(chips).toContain(says);
  expect(page.text()).not.toMatch(/\b1 [Pp]layers\b/);
});

it("keeps Blitz on Play once an ended Blitz's results were seen, saying none is scheduled (live-qa-night-1 P3-12)", async () => {
  const ended = game({ game_id: 2, mode: "blitz", status: "Ended", name: "test-qa-fresh-1" } as Partial<DirectoryGame>);
  reads.directory = answered({ games: [ownSeason] });
  reads.slots = answered({ slots: [] });
  reads.history = answered({ games: [ended], next: null, failures: [] });
  const page = await mount();
  const blitz = () => page.container.querySelector('section[aria-label="Blitz"]')?.textContent ?? null;
  // Its results not yet opened: they stand in Blitz's column.
  expect(blitz()).toContain("Results");
  expect(blitz()).not.toContain("No Blitz scheduled");

  localStorage.setItem("realms.seen-results", JSON.stringify(["0xa:2"]));
  await page.render();
  expect(blitz()).toBe("No Blitz scheduled this season.Build ordersThe game's order");
  expect(page.text()).toContain("Resume");

  // A slot the operator opens takes the line's place; a slot outage is said as the outage, never as "none".
  reads.slots = answered({ slots: [slot] });
  await page.render();
  expect(blitz()).toContain("Join");
  expect(blitz()).not.toContain("No Blitz scheduled");
  reads.slots = failed();
  await page.render();
  expect(page.text()).toContain("Blitz did not answer.");
  expect(page.text()).not.toContain("No Blitz scheduled");
});

it("keeps the way to the build orders when the player's ended Blitz leads Play", async () => {
  const ended = game({ game_id: 2, mode: "blitz", status: "Ended", name: "test-qa-fresh-1" } as Partial<DirectoryGame>);
  reads.directory = answered({ games: [] });
  reads.slots = answered({ slots: [] });
  reads.history = answered({ games: [ended], next: null, failures: [] });
  const page = await mount();
  const blitz = () => page.container.querySelector('section[aria-label="Blitz"]')?.textContent ?? null;
  // Its results lead; Blitz's column under it holds only the way to the build orders.
  expect(page.text()).toContain("Results");
  expect(blitz()).toBe("Build ordersThe game's order");
});

it("names each game by its age's lockup, and a Blitz lead by Blitz's with its start", async () => {
  const lockups = (page: { container: HTMLElement }) =>
    [...page.container.querySelectorAll<HTMLImageElement>("[data-age] h2 img, [data-age] h3 img")].map(
      (img) => `${img.closest("[data-age]")!.getAttribute("data-age")} ${img.alt} ${img.getAttribute("src")}`,
    );
  reads.directory = answered({ games: [ownSeason] });
  reads.slots = answered({ slots: [] });
  reads.history = answered({ games: [], next: null, failures: [] });
  const season = await mount();
  expect(lockups(season)).toEqual([
    "frontier Frontier /images/logos/frontier-lockup.webp",
    "blitz Blitz /images/logos/blitz-lockup.webp",
  ]);
  await cleanup?.();

  reads.directory = answered({ games: [] });
  reads.slots = answered({ slots: [slot] });
  const blitzLead = await mount();
  const lead = blitzLead.container.querySelector('[data-size="lead"] h3')!;
  expect(lead.querySelector("img")?.getAttribute("src")).toBe("/images/logos/blitz-lockup.webp");
  expect(`${lead.querySelector("img")?.alt} ${lead.textContent}`).toMatch(/^Blitz \d\d:\d\d$/);
});

it("says nothing of Blitz being unscheduled when a Blitz is the lead", async () => {
  reads.directory = answered({ games: [] });
  reads.slots = answered({ slots: [slot] });
  reads.history = answered({ games: [], next: null, failures: [] });
  const page = await mount();
  expect(page.text()).toContain("Join");
  expect(page.text()).not.toContain("No Blitz scheduled");
});

it("shows the calendar's next Blitz, its start and when its entry opens, until the game is published", async () => {
  const now = Math.floor(Date.now() / 1000);
  // The owner's 10:08: the 12:00 game, whose entry opens at 10:25, 17 minutes away.
  const next: NextBlitzGame = {
    name: "blitz-next",
    startsAt: new Date((now + 112 * 60) * 1000).toISOString(),
    closesAt: new Date((now + 107 * 60) * 1000).toISOString(),
    opensAt: new Date((now + 17 * 60) * 1000).toISOString(),
  };
  reads.directory = answered({ games: [ownSeason] });
  reads.slots = answered({ slots: [] });
  reads.history = answered({ games: [], next: null, failures: [] });
  reads.nextBlitz = answered(next);
  const page = await mount();
  const blitz = () => page.container.querySelector('section[aria-label="Blitz"]')?.textContent ?? null;
  const at = (iso: string) => formatClockTime(Date.parse(iso) / 1000);
  const orders = "Build ordersThe game's order";
  expect(blitz()).toBe(
    `Next ranked BlitzStarts ${at(next.startsAt)} · Entry opens ${at(next.opensAt)} · in 17m${orders}`,
  );

  // Its entry due: the schedule's next tick opens it.
  reads.nextBlitz = answered({ ...next, opensAt: new Date((now - 1) * 1000).toISOString() });
  await page.render();
  expect(blitz()).toBe(`Next ranked BlitzStarts ${at(next.startsAt)} · Entry opens in a moment${orders}`);

  // Published: the game stands as today, and the calendar's line goes.
  reads.slots = answered({ slots: [slot] });
  await page.render();
  expect(blitz()).toContain("Join");
  expect(blitz()).not.toContain("Next ranked Blitz");
});

it("says the season calendar did not answer, never 'No Blitz', when it fails", async () => {
  reads.directory = answered({ games: [ownSeason] });
  reads.slots = answered({ slots: [] });
  reads.history = answered({ games: [], next: null, failures: [] });
  reads.nextBlitz = failed();
  const page = await mount();
  expect(page.text()).toContain("Season did not answer.");
  expect(page.text()).not.toContain("No Blitz scheduled");
  expect(page.container.querySelector('section[aria-label="Blitz"]')).toBeNull();
});

it("ends Blitz's column on the way to the player's build orders, naming the order their games follow", async () => {
  reads.directory = answered({ games: [ownSeason] });
  reads.slots = answered({ slots: [slot] });
  reads.history = answered({ games: [], next: null, failures: [] });
  reads.buildOrders = {
    orders: [{ id: "o1", order: { name: "Coal rush", steps: [{ rank: "Settlement", goal: "farm", count: 2 }] } }],
    active: "o1",
  };
  const page = await mount();
  const rows = [...page.container.querySelectorAll('section[aria-label="Blitz"] .app-row')];
  expect(rows.at(-1)?.textContent).toBe("Build ordersCoal rush");
  await act(async () => (rows.at(-1) as HTMLButtonElement).click());
  expect(page.text()).toBe("build orders");
});
