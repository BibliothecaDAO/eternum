import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { afterEach, expect, it, vi } from "vitest";

import type { PlaytestSlot } from "../blitz-slot";
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
  history: null as unknown as Read<{ games: DirectoryGame[]; next: null; failures: { url: string }[] }>,
}));

vi.mock("@/hooks/context/identity-session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/context/identity-session")>()),
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
}));
vi.mock("../blitz/entry", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../blitz/entry")>()),
  useRefundSlots: () => new Map(),
  useSlotRegistered: () => 12,
}));

import { PlayPage } from "./play-page";

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
    player_state: { registered: false, settled: false, roster_wallet: null, structures: [] },
    ...over,
  }) as DirectoryGame;
const ownSeason = game({
  player_state: { registered: true, settled: true, roster_wallet: null, structures: [REALM] },
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
  player_state: { registered: true, settled: false, roster_wallet: "0x4a1", structures: [] },
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
