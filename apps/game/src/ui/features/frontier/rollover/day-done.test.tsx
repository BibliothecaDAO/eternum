import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { notifyManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DAY_END_TIMING, RESTING, useDayEndStore } from "@/hooks/store/use-day-end-store";
import { Position } from "@bibliothecadao/eternum";

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
vi.mock("@bibliothecadao/eternum", async (importOriginal) => {
  const { RECORDED_DAY: recorded } = await import("./recorded-day-history");
  return {
    ...(await importOriginal<typeof import("@bibliothecadao/eternum")>()),
    buildStoryEventPresentation: () => ({}),
    configManager: { getActiveGameId: () => 1 },
    // The day's turn reads the game's calendar and the realm's site from the facts: realm 7's day-3 site.
    readExpeditionRules: () => ({ ...recorded.calendar, spacing: 100 }),
    isExpeditionRealm: () => true,
    expeditionRealmSite: () => ({ col: 650, row: 850 }),
  };
});
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
const { watchDayTurn } = await import("@/ui/features/world/components/expeditions/expedition-rollover");

const RULES = { ...RECORDED_DAY.calendar, spacing: 100 };
const SUMMARY = "section[aria-label='Day 2 done']";

let host: HTMLDivElement;
let root: Root;

/** Day 2's summary is the player's until they play on in day 3: the game as it stood a minute before they did. */
const BEFORE_PLAYING_ON = {
  now: RECORDED_DAY.playedOn.at - 60,
  history: RECORDED_DAY.history.filter((event) => event.block_number < RECORDED_DAY.playedOn.block),
};

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  notifyManager.setNotifyFunction((notify) => act(notify));
  window.localStorage.clear();
  useDayEndStore.setState(RESTING);
  herald.history = BEFORE_PLAYING_ON.history;
  herald.withheld = null;
  herald.now = BEFORE_PLAYING_ON.now;
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

/** Opens the game with day 2 ended overnight, before the player played on, and reads the summary's totals. */
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
  const { end } = endedDay(RULES, BEFORE_PLAYING_ON.now)!;
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
  expect(host.textContent).toContain("11h 51m");
  expect(host.textContent).toContain("Tomorrow lasts8h");
  expect(cells).toEqual(PROD_DAY_2);
  expect(host.textContent).toContain("#1 → #1");
});

it("shows a dash for each total, and says why, when the player's history no longer reaches the day's start", async () => {
  // Five hundred later stories of the player's own, late in day 2, push its start out of the one page Herald gives.
  const { end } = endedDay(RULES, BEFORE_PLAYING_ON.now)!;
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
      timestamp: `0x${(end - 60).toString(16)}`,
      story: { TroopsTransferred: { amount: "0x1", source: { Explorer: "0x1" }, target: { Explorer: "0x2" } } },
    },
  }));
  herald.history = [...later, ...BEFORE_PLAYING_ON.history];
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
    await seconds(DAY_END_TIMING.nightfall);
    expect(phase()).toBe("black");
    expect(window.localStorage.getItem(`frontier.day-done.1.${RECORDED_DAY.player}`)).toBe("1");
    act(() => useDayEndStore.getState().markLandReady());
    expect(window.localStorage.getItem(`frontier.day-done.1.${RECORDED_DAY.player}`)).toBe("2");
  });
});

describe("a device arriving in a new day", () => {
  const MARK = `frontier.day-done.1.${RECORDED_DAY.player}`;
  /** Realm 7's day-3 site, where the camera must end up. */
  const NEW_SITE = Position.fromContract({ x: 650, y: 850 });
  const navigate = vi.fn();
  let stopRollover = () => {};

  /** Opens the game: the HUD's day end and the day's turn, on the game's clocks, with the camera's moves recorded. */
  const openTheGameHere = async ({ visiting = false } = {}) => {
    stopRollover = watchDayTurn({
      store: { structuresOwnedBy: () => [{ entity_id: 7 }] } as never,
      gameId: 1,
      player: RECORDED_DAY.player,
      chainNow: () => herald.now,
      blockNow: () => herald.now,
      reproject: () => {},
      navigate,
    });
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
  /** The page boots again (a lost GPU): the route and the browser's storage stay, the HUD and the turn start over. */
  const bootThePageAgain = async () => {
    act(() => root.unmount());
    stopRollover();
    client.clear();
    useDayEndStore.setState(RESTING);
    root = createRoot(host);
    await openTheGameHere();
  };
  /** Through the black and the dawn, onto the new day. */
  const throughTheBlack = async () => {
    await seconds(DAY_END_TIMING.nightfall);
    await seconds(DAY_END_TIMING.black);
    await seconds(DAY_END_TIMING.dawn);
  };

  beforeEach(() => {
    vi.useFakeTimers();
    navigate.mockClear();
  });

  afterEach(() => {
    stopRollover();
    vi.useRealTimers();
    client.clear();
  });

  it("goes through the end of a day it opened after with no summary to read, so the camera comes onto the realm", async () => {
    // Day 2 not played: nothing in the player's history, no army ended with it.
    herald.history = [];
    await openTheGameHere();
    expect(host.querySelector(SUMMARY)).toBeNull();
    expect(useDayEndStore.getState()).toMatchObject({ phase: "nightfall", arrival: "later", summary: "none" });
    await throughTheBlack();
    expect(phase()).toBe("day");
    expect(navigate.mock.calls).toEqual([[NEW_SITE]]);
    expect(window.localStorage.getItem(MARK)).toBe("2");
  });

  it("moves the camera onto the realm when the page boots again in the fall to black, before it moved", async () => {
    herald.history = [];
    await openTheGameHere();
    expect(phase()).toBe("nightfall");
    expect(window.localStorage.getItem(MARK)).toBeNull();
    await bootThePageAgain();
    await throughTheBlack();
    expect(phase()).toBe("day");
    expect(navigate.mock.calls).toEqual([[NEW_SITE]]);
    expect(window.localStorage.getItem(MARK)).toBe("2");
  });

  it("shows the summary on a device opened before the player played on in the new day", async () => {
    await openTheGameHere();
    expect(useDayEndStore.getState()).toMatchObject({ phase: "summary", arrival: "later", summary: "shown" });
    expect(totalsShown()).toEqual(PROD_DAY_2);
  });

  it("skips the summary once the player played on in the new day on another device, and still brings the camera onto the realm", async () => {
    // Prod: the player placed a building in day 3 at 05:56Z, then opened the game here at 06:26Z.
    herald.history = RECORDED_DAY.history;
    herald.now = RECORDED_DAY.openedAt;
    await openTheGameHere();
    expect(host.querySelector(SUMMARY)).toBeNull();
    expect(useDayEndStore.getState()).toMatchObject({ phase: "nightfall", arrival: "later", summary: "none" });
    await throughTheBlack();
    expect(phase()).toBe("day");
    expect(navigate.mock.calls).toEqual([[NEW_SITE]]);
    expect(window.localStorage.getItem(MARK)).toBe("2");
  });

  it("does not play a day's end again on a device that went through it, summary or none", async () => {
    window.localStorage.setItem(MARK, "2");
    await openTheGameHere();
    expect(host.querySelector(SUMMARY)).toBeNull();
    expect(phase()).toBe("day");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("plays and marks nothing while visiting another realm", async () => {
    await openTheGameHere({ visiting: true });
    expect(host.querySelector(SUMMARY)).toBeNull();
    expect(phase()).toBe("day");
    expect(window.localStorage.getItem(MARK)).toBeNull();
  });

  it("marks the day gone through only once Continue's black has the camera on the realm's new site", async () => {
    await openTheGameHere();
    expect(totalsShown()).toEqual(PROD_DAY_2);
    act(() => host.querySelector<HTMLButtonElement>(`${SUMMARY} button`)!.click());
    expect(phase()).toBe("nightfall");
    expect(window.localStorage.getItem(MARK)).toBeNull();
    await throughTheBlack();
    expect(navigate.mock.calls).toEqual([[NEW_SITE]]);
    expect(window.localStorage.getItem(MARK)).toBe("2");
  });
});
