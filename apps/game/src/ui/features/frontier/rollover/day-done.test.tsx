import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { notifyManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DAY_END_TIMING, RESTING, useDayEndStore } from "@/hooks/store/use-day-end-store";

import { endedDay } from "../hud/day-clock";

import { RECORDED_DAY } from "./recorded-day-history";

/** Herald's history, answered as prod's answers it: a player's read keeps the events naming them, newest first. */
const herald = vi.hoisted(() => ({
  history: [] as Array<{ block_number: number; transaction_index: number; event_index: number; value: object }>,
  /** History answers once this settles; none: at once. */
  withheld: null as Promise<void> | null,
  /** The chain clock the HUD reads. */
  now: 0,
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
  useNowSeconds: () => herald.now,
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
    await herald.withheld;
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
  herald.withheld = null;
  herald.now = RECORDED_DAY.openedAt;
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

const PROD_DAY_2 = ["35Reveals", "5Sites cleared", "0Chests", "+7,246Essence", "+524Labor", "+0LORDS"];

let client: QueryClient;
/** Draws the HUD's day end at the clock as it stands. */
const draw = () =>
  root.render(
    <QueryClientProvider client={client}>
      <DayDone rules={RULES} realm={{} as never} visiting={false} />
    </QueryClientProvider>,
  );
const totalsShown = () =>
  [...(host.querySelector(SUMMARY)?.querySelectorAll("[data-total]") ?? [])].map((cell) => cell.textContent);
const phase = () => useDayEndStore.getState().phase;

/** Opens the game as the player did on prod, day 2 ended overnight, and reads the summary's totals. */
const openTheGame = async () => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => draw());
  // History answers, then the summary opens over the new day.
  for (let tick = 0; tick < 50 && !host.querySelector(SUMMARY); tick += 1)
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
  return host.querySelector(SUMMARY) && totalsShown();
};

/**
 * In the game as day 2 ends, the player having read day 1's summary the day before: the HUD opens a second before the
 * end with history's first answer withheld, then the chain clock turns and the rollover begins the moment.
 */
const endDay2WithHistoryWithheld = async () => {
  vi.useFakeTimers();
  let answer!: () => void;
  herald.withheld = new Promise<void>((resolve) => (answer = resolve));
  window.localStorage.setItem(`frontier.day-done.1.${RECORDED_DAY.player}`, "1");
  const { end } = endedDay(RULES, RECORDED_DAY.openedAt)!;
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  herald.now = end - 1;
  await act(async () => draw());
  herald.now = end + 1;
  await act(async () => {
    draw();
    useDayEndStore.getState().begin("live");
  });
  await act(() => vi.advanceTimersByTimeAsync(DAY_END_TIMING.veil * 1_000));
  return async () => {
    await act(async () => answer());
    await act(() => vi.advanceTimersByTimeAsync(100));
  };
};
const seconds = (count: number) => act(() => vi.advanceTimersByTimeAsync(count * 1_000));

it("sums the player's own day 2 as prod's history holds it, not the tail of the game's newest stories", async () => {
  const cells = await openTheGame();
  expect(host.textContent).toContain("Realm kept · Day 3 is open");
  expect(host.textContent).toContain("11h 20m");
  expect(host.textContent).toContain("Tomorrow lasts8h");
  expect(cells).toEqual(PROD_DAY_2);
  expect(host.textContent).toContain("#1 → #1");
});

it("shows a dash for each total, and says why, when the player's history no longer reaches the day's start", async () => {
  // Five hundred later stories of the player's own push day 2 out of the one page Herald gives.
  const later = Array.from({ length: 500 }, (_, index) => ({
    block_number: 170_000 + index,
    transaction_index: 0,
    event_index: 0,
    model: "StoryEvent",
    transaction_hash: `0x${(index + 1).toString(16)}`,
    value: {
      game_id: "0x1",
      owner: RECORDED_DAY.player,
      entity_id: "0x0",
      tx_hash: `0x${(index + 1).toString(16)}`,
      timestamp: `0x${(RECORDED_DAY.openedAt - 60).toString(16)}`,
      story: { TroopsTransferred: { amount: "0x1", source: { Explorer: "0x1" }, target: { Explorer: "0x2" } } },
    },
  }));
  herald.history = [...later, ...RECORDED_DAY.history];
  expect(await openTheGame()).toEqual(["—Reveals", "—Sites cleared", "—Chests", "—Essence", "—Labor", "—LORDS"]);
  expect(host.querySelector(`${SUMMARY} [role="status"]`)?.textContent).toBe(
    "Your history no longer reaches back to this day's start, so its totals are unknown.",
  );
});

it("shows a dash for each total, and says history did not answer, with Try again, when the read fails", async () => {
  herald.withheld = Promise.reject(new Error("Herald is down"));
  herald.withheld.catch(() => undefined);
  expect(await openTheGame()).toEqual(["—Reveals", "—Sites cleared", "—Chests", "—Essence", "—Labor", "—LORDS"]);
  expect(host.querySelector(`${SUMMARY} [role="alert"]`)?.textContent).toBe(
    "Your history did not answer, so this day's totals are unknown.Try again",
  );
});

describe("history answering late as the day ends in the game", () => {
  afterEach(() => {
    vi.useRealTimers();
    client.clear();
  });

  it("waits in the summary for an answer that comes within its time, then shows the day", async () => {
    const answer = await endDay2WithHistoryWithheld();
    expect(phase()).toBe("summary");
    expect(host.querySelector(SUMMARY)).toBeNull();
    await seconds(DAY_END_TIMING.summaryWait / 2);
    expect(phase()).toBe("summary");
    await answer();
    expect(totalsShown()).toEqual(PROD_DAY_2);
    act(() => host.querySelector<HTMLButtonElement>(`${SUMMARY} button`)!.click());
    expect(phase()).toBe("nightfall");
  });

  it("goes on into the new day when the answer is late, then opens the summary once it comes", async () => {
    const answer = await endDay2WithHistoryWithheld();
    await seconds(DAY_END_TIMING.summaryWait + DAY_END_TIMING.nightfall);
    expect(phase()).toBe("black");
    act(() => useDayEndStore.getState().markLandReady());
    await seconds(DAY_END_TIMING.black);
    await seconds(DAY_END_TIMING.dawn);
    expect(phase()).toBe("day");
    expect(host.querySelector(SUMMARY)).toBeNull();
    await answer();
    expect(useDayEndStore.getState()).toMatchObject({ phase: "summary", arrival: "later" });
    expect(totalsShown()).toEqual(PROD_DAY_2);
    act(() => host.querySelector<HTMLButtonElement>(`${SUMMARY} button`)!.click());
    expect(phase()).toBe("nightfall");
    expect(window.localStorage.getItem(`frontier.day-done.1.${RECORDED_DAY.player}`)).toBe("2");
  });
});

describe("a device arriving in a new day", () => {
  const MARK = `frontier.day-done.1.${RECORDED_DAY.player}`;
  const arrive = async ({ visiting = false } = {}) => {
    vi.useFakeTimers();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <DayDone rules={RULES} realm={{} as never} visiting={visiting} />
        </QueryClientProvider>,
      ),
    );
    await act(() => vi.advanceTimersByTimeAsync(100));
  };

  afterEach(() => {
    vi.useRealTimers();
    client.clear();
  });

  it("goes through the end of a day it opened after with no summary to read, so the camera comes onto the realm", async () => {
    // Day 2 not played: nothing in the player's history, no army ended with it.
    herald.history = [];
    await arrive();
    expect(host.querySelector(SUMMARY)).toBeNull();
    expect(useDayEndStore.getState()).toMatchObject({ phase: "nightfall", arrival: "later", summary: "none" });
    expect(window.localStorage.getItem(MARK)).toBe("2");
    await seconds(DAY_END_TIMING.nightfall);
    // The black: the rollover brings the camera onto the realm's new site behind it.
    expect(phase()).toBe("black");
    act(() => useDayEndStore.getState().markLandReady());
    await seconds(DAY_END_TIMING.black);
    await seconds(DAY_END_TIMING.dawn);
    expect(phase()).toBe("day");
  });

  it("does not play a day's end again on a device that went through it, summary or none", async () => {
    window.localStorage.setItem(MARK, "2");
    await arrive();
    expect(host.querySelector(SUMMARY)).toBeNull();
    expect(phase()).toBe("day");
  });

  it("plays and marks nothing while visiting another realm", async () => {
    await arrive({ visiting: true });
    expect(host.querySelector(SUMMARY)).toBeNull();
    expect(phase()).toBe("day");
    expect(window.localStorage.getItem(MARK)).toBeNull();
  });

  it("marks the day gone through only once Continue drops the screen to black", async () => {
    await arrive();
    expect(totalsShown()).toEqual(PROD_DAY_2);
    expect(window.localStorage.getItem(MARK)).toBeNull();
    act(() => host.querySelector<HTMLButtonElement>(`${SUMMARY} button`)!.click());
    expect(phase()).toBe("nightfall");
    expect(window.localStorage.getItem(MARK)).toBe("2");
  });
});
