import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { notifyManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { RESTING, useDayEndStore } from "@/hooks/store/use-day-end-store";

import { RECORDED_DAY } from "./recorded-day-history";

/** Herald's history, answered as prod's answers it: a player's read keeps the events naming them, newest first. */
const herald = vi.hoisted(() => ({
  history: [] as Array<{ block_number: number; transaction_index: number; event_index: number; value: object }>,
}));

vi.mock("@/hooks/context/game-context", () => ({ useGame: () => ({ setup: { store: {} } }) }));
vi.mock("@/hooks/use-player-profile", () => ({
  usePlayerNames: () => ({ text: () => "", reading: () => ({ state: "waiting", text: "…" }) }),
}));
vi.mock("@/runtime/world", () => ({ getActiveGame: () => ({ chainId: "0x1" }) }));
vi.mock("@/hooks/store/use-account-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/store/use-account-store")>()),
  useAccountStore: (select: (state: unknown) => unknown) => select({ account: { address: RECORDED_DAY.player } }),
}));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({
  useNowSeconds: () => RECORDED_DAY.openedAt,
  useCurrentDefaultTick: () => 0,
}));
vi.mock("@/hooks/helpers/use-native-facts", () => ({ useNativeRevision: () => 0 }));
// The armies are not what this card is about: none ended with the day.
vi.mock("../frontier-home", () => ({ endedHomeArmies: () => [], homecomingAtNextDeploy: () => null }));
vi.mock("@bibliothecadao/eternum", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@bibliothecadao/eternum")>()),
  buildStoryEventPresentation: () => ({}),
  configManager: { getActiveGameId: () => 1 },
}));
vi.mock("@bibliothecadao/eternum/game-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@bibliothecadao/eternum/game-client")>()),
  requireShard: () => ({ url: "https://herald.realms.party", chainId: "0x1", worldAddress: "0xabc" }),
  fetchHeraldGameHistory: async (_shard: unknown, _game: number, read: { limit: number; owner?: string }) => {
    const named = read.owner && BigInt(read.owner).toString(16);
    const items = herald.history.filter((event) => !named || JSON.stringify(event.value).includes(named));
    return { items: items.slice(0, read.limit), complete_through_block: 166_316, limit: read.limit, offset: 0 };
  },
  // Prod's closing ranks: the player led both days.
  fetchHeraldDayRanks: async () => ({ entries: [{ rank: 1, address: RECORDED_DAY.player }] }),
}));

const { DayDone } = await import("./day-done");

const RULES = { ...RECORDED_DAY.calendar, spacing: 100 };
const SUMMARY = "section[aria-label='Day 2 done']";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  notifyManager.setNotifyFunction((notify) => act(notify));
  window.localStorage.clear();
  useDayEndStore.setState(RESTING);
  herald.history = RECORDED_DAY.history;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useDayEndStore.setState(RESTING);
  notifyManager.setNotifyFunction((notify) => notify());
});

/** Opens the game as the player did on prod, day 2 ended overnight, and reads the summary's totals. */
const openTheGame = async () => {
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <DayDone rules={RULES} realm={{} as never} visiting={false} />
      </QueryClientProvider>,
    ),
  );
  // History answers, then the summary opens over the new day.
  for (let tick = 0; tick < 50 && !host.querySelector(SUMMARY); tick += 1)
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
  const card = host.querySelector(SUMMARY);
  return card && [...card.querySelectorAll("[data-total]")].map((cell) => cell.textContent);
};

it("sums the player's own day 2 as prod's history holds it, not the tail of the game's newest stories", async () => {
  const cells = await openTheGame();
  expect(host.textContent).toContain("Realm kept · Day 3 is open");
  expect(host.textContent).toContain("11h 20m");
  expect(host.textContent).toContain("Tomorrow lasts8h");
  expect(cells).toEqual(["35Reveals", "5Sites cleared", "0Chests", "+7,246Essence", "+524Labor", "+0LORDS"]);
  expect(host.textContent).toContain("#1 → #1");
});

it("shows a dash for each total when the player's history no longer reaches back to the day's start", async () => {
  // Five hundred later stories of the player's own push day 2 out of the one page Herald gives.
  const later = Array.from({ length: 500 }, (_, index) => ({
    block_number: 170_000 + index,
    transaction_index: 0,
    event_index: 0,
    model: "StoryEvent",
    transaction_hash: `0x${(index + 1).toString(16)}`,
    value: {
      owner: RECORDED_DAY.player,
      entity_id: "0x0",
      tx_hash: `0x${(index + 1).toString(16)}`,
      timestamp: `0x${(RECORDED_DAY.openedAt - 60).toString(16)}`,
      story: { TroopsTransferred: { amount: "0x1", source: { Explorer: "0x1" }, target: { Explorer: "0x2" } } },
    },
  }));
  herald.history = [...later, ...RECORDED_DAY.history];
  expect(await openTheGame()).toEqual(["—Reveals", "—Sites cleared", "—Chests", "—Essence", "—Labor", "—LORDS"]);
});
