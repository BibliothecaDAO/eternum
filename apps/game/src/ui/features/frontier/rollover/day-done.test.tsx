import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { notifyManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DAY_END_TIMING, RESTING, useDayEndStore } from "@/hooks/store/use-day-end-store";
import { useAskMemory } from "@/shell/profile/alerts-ask";
import { dayOf, Position } from "@bibliothecadao/eternum";

import { endedDay } from "../hud/day-clock";

import { RECORDED_DAY } from "./recorded-day-history";

/** Herald's history, answered as prod's answers it: a player's read keeps the events naming them, newest first. */
const herald = vi.hoisted(() => ({
  history: [] as Array<{ block_number: number; transaction_index: number; event_index: number; value: object }>,
  /** History answers once this settles; none: at once. */
  withheld: null as Promise<void> | null,
  /** The chain clock the HUD reads. */
  now: 0,
  /** The game's registry: prod's Playtest ended on 31 Oct 09:46Z, long after day 2. */
  game: { end_at: "1793439960" },
}));
/** The game's facts as the HUD and the day's turn read them: its registry, and realm 7 owned by the player. */
const facts = vi.hoisted(() => ({
  get: (model: string) => (model === "GameRegistry" ? herald.game : undefined),
  structuresOwnedBy: () => [{ entity_id: 7 }],
}));

/** The alerts ask's reading of this device: no owner (no ask) unless a test signs one in. */
const alerts = vi.hoisted(() => ({ owner: null as string | null }));
/** Identity's shared links: the player's link for a day, and the record of its post. */
const shares = vi.hoisted(() => ({
  createShare: vi.fn(async () => "DAY2LINK"),
  sharePosted: vi.fn(async () => {}),
  shareTally: vi.fn(async () => ({ links: 4, posted: 3, visits: 12, joined: 3, activated: 1 })),
  uploadShareCard: vi.fn(async () => {}),
}));
/** The card's JPEG, as the browser makes it from the drawn card (a canvas jsdom has none of). */
const CARD_JPEG = vi.hoisted(() => new Blob(["card"], { type: "image/jpeg" }));
vi.mock("@/utils/card-image", async (original) => ({
  ...(await original<typeof import("@/utils/card-image")>()),
  cardJpeg: vi.fn(async () => CARD_JPEG),
  cardFile: vi.fn(async () => CARD_FILE),
}));
/** The card's PNG as a phone's share sheet takes it. */
const CARD_FILE = vi.hoisted(() => new File(["card"], "frontier-day-2.png", { type: "image/png" }));
/** The signed-in Realms account whose links the share sheet makes. */
const SIGNED_IN = vi.hoisted(() => ({ session: { user: { realmsId: "0xa11ce" } } }));
vi.mock("@/hooks/context/identity-session", () => ({
  useIdentitySession: () => SIGNED_IN,
  notificationOwnerOf: () => alerts.owner,
  identityClient: shares,
}));
vi.mock("@/hooks/use-notification-preferences", () => ({
  useNotificationPreferences: () => ({ status: "ready", saved: { level: "off", revision: 1 }, save: vi.fn() }),
}));
vi.mock("@/shell/profile/this-device", () => ({ useThisDevice: () => ({ state: "off", toggle: vi.fn() }) }));
vi.mock("@/pwa/install-state", () => ({ useInstall: () => ({ install: vi.fn() }) }));
vi.mock("@/runtime/world/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/runtime/world/store")>()),
  getActiveGame: () => ({ chainId: "0x1", gameId: 1 }),
}));

/** Realm 7 as the HUD hands it to the day's end: its game and entity (a free home: the game has no Labor rules). */
/** Realm 7, founded as the season opened. */
const REALM_7 = { game_id: 1, entity_id: 7n, base: { created_at: 0 } } as never;

vi.mock("@/hooks/context/game-context", () => ({ useGame: () => ({ setup: { store: facts } }) }));
vi.mock("@/hooks/use-player-profile", () => ({
  usePlayerNames: () => ({ text: () => "", reading: () => ({ state: "waiting", text: "…" }) }),
  usePlayerProfile: () => ({ name: null, portrait: null }),
  usePlayerDisplayName: () => "Ashwalker",
  usePlayerName: () => ({ state: "named", text: "Ashwalker", claimed: true }),
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
    readExpeditionRules: () => ({ ...recorded.calendar, endAt: Number(herald.game.end_at), spacing: 100 }),
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
const { cardJpeg } = await import("@/utils/card-image");
const { setViewportWidth } = await import("@/shell/frame/test-viewport");
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
  herald.game = { end_at: "1793439960" };
  alerts.owner = null;
  for (const call of Object.values(shares)) call.mockClear();
  useAskMemory.setState({ notNows: 0, shownAt: null });
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

const PROD_DAY_2 = ["35Reveals", "5Sites cleared", "0Chests", "+7.2KEssence", "+524Labor", "+0LORDS"];
/** Prod's day 1 for the same player, as their own history holds it. */
const PROD_DAY_1 = ["37Reveals", "6Sites cleared", "0Chests", "+6KEssence", "+2.7KLabor", "+0LORDS"];
/** Any day's summary. */
const SUMMARY_SHOWN = "section[aria-label$=' done']";

let client: QueryClient;
/** Draws the HUD's day end at the clock as it stands. */
const draw = () =>
  root.render(
    <QueryClientProvider client={client}>
      <DayDone rules={{ ...RULES, endAt: Number(herald.game.end_at) }} realm={REALM_7} visiting={false} />
    </QueryClientProvider>,
  );
const totalsShown = () =>
  [...(host.querySelector(SUMMARY)?.querySelectorAll("[data-total]") ?? [])].map((cell) => cell.textContent);
const phase = () => useDayEndStore.getState().phase;
/** The summary's way into the new day, under Share your day. */
const continueButton = () =>
  [...(host.querySelector(SUMMARY)?.querySelectorAll("button") ?? [])].find(
    (button) => button.textContent === "Continue",
  )!;

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

it("shares day 2 as its card and a post: its trail, its totals and rank, and the player's own link for the day", async () => {
  await openTheGame();
  const share = [...host.querySelectorAll("button")].find((button) => button.textContent === "Share your day");
  await act(async () => share!.click());
  const sheet = document.body.querySelector("section[aria-label='Share your day']")!;
  // A phone draws the tall cut.
  const shown = sheet.querySelector<HTMLElement>(".day-share__frame .day-card")!;
  expect(shown.dataset.cut).toBe("tall");
  expect(shown.querySelector(".day-card__day")?.textContent).toBe("Day 2");
  const marks = [...shown.querySelectorAll<HTMLElement>(".day-card__mark")].map((mark) => mark.dataset.mark);
  // Prod's day 2: five clears, two of the rifts after a fight their guard held.
  expect(marks).toEqual(["Beasts", "Beasts", "guard-holds", "Rift", "guard-holds", "Rift", "Beasts"]);
  expect(shares.createShare).toHaveBeenCalledWith({ kind: "frontier-day", chainId: "0x1", gameId: 1, moment: 2 });

  // The link is made as the sheet opens; the post waits for nothing.
  await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
  expect(sheet.textContent).toContain("Your days brought 12 visits · 3 new players");
  // The link unfurls as the wide cut, which a phone's sheet draws out of sight and makes into its image at once, on the
  // device: nothing is published before a way to post is pressed.
  const wide = sheet.querySelector<HTMLElement>(".day-share__out-of-sight .day-card")!;
  expect(wide.dataset.cut).toBe("wide");
  expect(cardJpeg).toHaveBeenCalledWith(wide, { width: 1200, height: 675 });
  expect(shares.uploadShareCard).not.toHaveBeenCalled();
  const open = vi.spyOn(window, "open").mockImplementation(() => null);
  const post = [...sheet.querySelectorAll("button")].find((button) => button.textContent?.endsWith("Post on X"));
  await act(async () => post!.click());
  const intent = new URL(String(open.mock.calls[0]![0]));
  expect(intent.searchParams.get("url")).toBe(`${window.location.origin}/s/DAY2LINK?via=x`);
  expect(intent.searchParams.get("text")).toBe("Frontier · Day 2 · #1\n🧭 35 · 🚩 5 · 🎁 0\n🐺🐺🛡️🌀🛡️🌀🐺");
  expect(shares.sharePosted).toHaveBeenCalledWith("DAY2LINK");
  // The press publishes the card the link unfurls as.
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
  expect(shares.uploadShareCard).toHaveBeenCalledWith("DAY2LINK", CARD_JPEG);
  open.mockRestore();
});

it("shares a phone's day through its own share sheet: the card, the post's line and the link it was posted from", async () => {
  const share = vi.fn(async (_data: ShareData) => {});
  vi.stubGlobal("navigator", Object.assign(Object.create(navigator), { canShare: () => true, share }));
  try {
    await openTheGame();
    const open = [...host.querySelectorAll("button")].find((button) => button.textContent === "Share your day");
    await act(async () => open!.click());
    const sheet = document.body.querySelector("section[aria-label='Share your day']")!;
    const buttons = () => [...sheet.querySelectorAll<HTMLButtonElement>("button")];
    // The image is made before the press, while the button says so.
    for (let tick = 0; tick < 50 && !buttons().some((button) => button.textContent === "Share"); tick += 1)
      await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
    const system = buttons().find((button) => button.textContent === "Share")!;
    // Share is the sheet's one verb; Post on X stands under it.
    expect(system.dataset.kind).toBe("primary");
    expect(buttons().find((button) => button.textContent?.endsWith("Post on X"))?.dataset.kind).toBe("secondary");

    // The press publishes the card; closing the phone's sheet then records no post.
    expect(shares.uploadShareCard).not.toHaveBeenCalled();
    share.mockRejectedValueOnce(Object.assign(new Error("closed"), { name: "AbortError" }));
    await act(async () => system.click());
    expect(shares.uploadShareCard).toHaveBeenCalledWith("DAY2LINK", CARD_JPEG);
    expect(shares.sharePosted).not.toHaveBeenCalled();
    expect(sheet.querySelector("[role='alert']")).toBeNull();

    await act(async () => system.click());
    expect(share).toHaveBeenLastCalledWith({
      files: [CARD_FILE],
      text: "Frontier · Day 2 · #1\n🧭 35 · 🚩 5 · 🎁 0\n🐺🐺🛡️🌀🛡️🌀🐺",
      url: `${window.location.origin}/s/DAY2LINK?via=system`,
    });
    expect(shares.sharePosted).toHaveBeenCalledWith("DAY2LINK");
  } finally {
    vi.unstubAllGlobals();
  }
});

it("draws a desktop's day card in the wide cut, the one its link unfurls as, and no second copy", async () => {
  setViewportWidth(1440);
  try {
    await openTheGame();
    const share = [...host.querySelectorAll("button")].find((button) => button.textContent === "Share your day");
    await act(async () => share!.click());
    const sheet = document.body.querySelector("section[aria-label='Share your day']")!;
    const cards = [...sheet.querySelectorAll<HTMLElement>(".day-card")];
    expect(cards.map((card) => card.dataset.cut)).toEqual(["wide"]);
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
    expect(cardJpeg).toHaveBeenLastCalledWith(cards[0], { width: 1200, height: 675 });
    expect(shares.uploadShareCard).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
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
  expect(host.querySelector(`${SUMMARY} [role="status"]`)?.textContent).toBe("This day's totals are unknown");
});

it("shows a dash for each total, and says history did not answer, with Try again, when the read fails", async () => {
  herald.withheld = Promise.reject(new Error("Herald is down"));
  herald.withheld.catch(() => undefined);
  expect(await openTheGame()).toEqual(["—Reveals", "—Sites cleared", "—Chests", "—Essence", "—Labor", "—LORDS"]);
  expect(host.querySelector(`${SUMMARY} [role="alert"]`)?.textContent).toBe("This day's totals are unknownTry again");
});

describe("the alerts popup, which waits for the day's end", () => {
  /** Day 3, today: the summary of day 2 opens over it. */
  const today = () => dayOf({ ...RULES, endAt: Number(herald.game.end_at) }, BEFORE_PLAYING_ON.now)!;
  const popup = () => document.body.querySelector("[role='dialog'][aria-label='Know when to come back']");
  /** Day 2's end already gone through on this device: the map opens clear. */
  const day2Seen = () => window.localStorage.setItem(`frontier.day-done.1.${RECORDED_DAY.player}`, "2");
  const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 50)));

  it("opens nothing while the day's summary is up, and spends nothing", async () => {
    alerts.owner = "0x7";
    await openTheGame();
    expect(host.querySelector(SUMMARY)).not.toBeNull();
    expect(popup()).toBeNull();
    expect(useAskMemory.getState().shownAt).toBeNull();
  });

  it("opens over the player's own map once the day's end is gone through", async () => {
    alerts.owner = "0x7";
    day2Seen();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => draw());
    await settle();
    expect(host.querySelector(SUMMARY)).toBeNull();
    expect(popup()?.textContent).toContain(
      "A push for each day's opening, rested armies, fights, results and messages.",
    );
    expect(useAskMemory.getState().shownAt).not.toBeNull();
  });

  it("gives the screen to a day's end that begins while it stands unanswered, counting no Not now", async () => {
    alerts.owner = "0x7";
    day2Seen();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => draw());
    await settle();
    expect(popup()).not.toBeNull();
    // The next day's turn: the rollover begins the moment over the map.
    await act(async () => useDayEndStore.getState().begin("live"));
    expect(phase()).toBe("veil");
    expect(popup()).toBeNull();
    expect(useAskMemory.getState()).toMatchObject({ notNows: 0, shownAt: expect.any(Number) });
  });

  it("opens nothing on another player's realm", async () => {
    alerts.owner = "0x7";
    day2Seen();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <DayDone rules={{ ...RULES, endAt: Number(herald.game.end_at) }} realm={REALM_7} visiting />
        </QueryClientProvider>,
      ),
    );
    await settle();
    expect(popup()).toBeNull();
  });

  it("opens nothing on the season's last day: no day follows for its push", async () => {
    alerts.owner = "0x7";
    day2Seen();
    herald.game = { end_at: String(today().end) };
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => draw());
    await settle();
    expect(popup()).toBeNull();
  });
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
    act(() => continueButton().click());
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
    act(() => continueButton().click());
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
  /** The last block's time while the block clock lags the chain's; null: it keeps up. */
  let lateBlockAt: number | null = null;

  /** Opens the game: the HUD's day end and the day's turn, on the game's clocks, with the camera's moves recorded. */
  const openTheGameHere = async ({ visiting = false, realm = REALM_7 } = {}) => {
    stopRollover = watchDayTurn({
      store: facts as never,
      gameId: 1,
      player: RECORDED_DAY.player,
      chainNow: () => herald.now,
      blockNow: () => lateBlockAt ?? herald.now,
      reproject: () => {},
      navigate,
    });
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <DayDone rules={{ ...RULES, endAt: Number(herald.game.end_at) }} realm={realm} visiting={visiting} />
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
    lateBlockAt = null;
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

  it("leaves the player on the map past the black's longest hold while the block lags, then moves the camera once", async () => {
    herald.history = [];
    // The last block is still day 2's: the realm's day-3 site is not on the map yet.
    lateBlockAt = endedDay(RULES, BEFORE_PLAYING_ON.now)!.end - 1;
    await openTheGameHere();
    expect(phase()).toBe("nightfall");
    await seconds(DAY_END_TIMING.nightfall + DAY_END_TIMING.blackHold + DAY_END_TIMING.dawn);
    expect(phase()).toBe("day");
    await seconds(5);
    expect(phase()).toBe("day");
    expect(navigate).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(MARK)).toBeNull();
    lateBlockAt = null;
    await seconds(1);
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

  describe('a player back after a day they skipped (owner, 10 Nov 2026: "I played day 1 but not day 2, its day 3 now")', () => {
    const DAY_1 = "section[aria-label='Day 1 done']";
    /** The player's history without their own day-2 stories: they played day 1 and skipped day 2. */
    const skippingDay2 = (history: typeof herald.history) => {
      const day2 = endedDay(RULES, BEFORE_PLAYING_ON.now)!;
      const player = BigInt(RECORDED_DAY.player).toString(16);
      return history.filter(({ value }) => {
        const at = Number(BigInt((value as { timestamp?: string }).timestamp ?? 0));
        return !(JSON.stringify(value).includes(player) && at >= day2.start && at < day2.end);
      });
    };

    it("offers the day they played, its totals and its share, then goes on into day 3 with the camera on the realm", async () => {
      herald.history = skippingDay2(BEFORE_PLAYING_ON.history);
      await openTheGameHere();
      const card = host.querySelector(DAY_1)!;
      expect(card.textContent).toContain("Realm kept · Day 3 is open");
      expect([...card.querySelectorAll("[data-total]")].map((cell) => cell.textContent)).toEqual(PROD_DAY_1);
      // Its armies ended with day 1, not with the day that just ended: the card says nothing of them.
      expect(card.querySelector("[aria-label='Troops']")).toBeNull();

      const share = [...card.querySelectorAll("button")].find((button) => button.textContent === "Share your day")!;
      await act(async () => share.click());
      const sheet = document.body.querySelector("section[aria-label='Share your day']")!;
      expect(sheet.querySelector(".day-share__frame .day-card__day")?.textContent).toBe("Day 1");
      expect(shares.createShare).toHaveBeenCalledWith({ kind: "frontier-day", chainId: "0x1", gameId: 1, moment: 1 });
      act(() => sheet.querySelector<HTMLButtonElement>("button[aria-label='Close']")!.click());

      act(() =>
        [...card.querySelectorAll<HTMLButtonElement>("button")]
          .find((button) => button.textContent === "Continue")!
          .click(),
      );
      await throughTheBlack();
      expect(phase()).toBe("day");
      expect(navigate.mock.calls).toEqual([[NEW_SITE]]);
      expect(window.localStorage.getItem(MARK)).toBe("2");
    });

    it("offers it no more once this device went through a day's end after it", async () => {
      herald.history = skippingDay2(BEFORE_PLAYING_ON.history);
      window.localStorage.setItem(MARK, "1");
      await openTheGameHere();
      expect(host.querySelector(SUMMARY_SHOWN)).toBeNull();
      expect(useDayEndStore.getState()).toMatchObject({ phase: "nightfall", arrival: "later", summary: "none" });
      await throughTheBlack();
      expect(navigate.mock.calls).toEqual([[NEW_SITE]]);
    });

    it("offers it no more once they played on in day 3", async () => {
      herald.history = skippingDay2(RECORDED_DAY.history);
      herald.now = RECORDED_DAY.openedAt;
      await openTheGameHere();
      expect(host.querySelector(SUMMARY_SHOWN)).toBeNull();
      expect(useDayEndStore.getState()).toMatchObject({ summary: "none" });
    });
  });

  it("does not play a day's end again on a device that went through it, summary or none", async () => {
    window.localStorage.setItem(MARK, "2");
    await openTheGameHere();
    expect(host.querySelector(SUMMARY)).toBeNull();
    expect(phase()).toBe("day");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("plays no end of a day that closed before the realm was founded: a new player stays where they arrived", async () => {
    herald.history = [];
    // Founded a minute into day 3, after day 2 had ended.
    const founded = endedDay(RULES, herald.now)!.end + 60;
    await openTheGameHere({ realm: { game_id: 1, entity_id: 7n, base: { created_at: founded } } as never });
    await seconds(DAY_END_TIMING.nightfall + DAY_END_TIMING.black + DAY_END_TIMING.dawn);
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
    act(() => continueButton().click());
    expect(phase()).toBe("nightfall");
    expect(window.localStorage.getItem(MARK)).toBeNull();
    await throughTheBlack();
    expect(navigate.mock.calls).toEqual([[NEW_SITE]]);
    expect(window.localStorage.getItem(MARK)).toBe("2");
  });

  it("plays no day's end and shows no summary when the day that ended was the season's last", async () => {
    // The season ended with day 2: the season-over card tells that end.
    herald.game = { end_at: String(endedDay(RULES, BEFORE_PLAYING_ON.now)!.end) };
    await openTheGameHere();
    await seconds(DAY_END_TIMING.summaryWait);
    expect(host.querySelector(SUMMARY)).toBeNull();
    expect(phase()).toBe("day");
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe("the chain clock turning in the game", () => {
  afterEach(() => {
    vi.useRealTimers();
    client.clear();
  });

  it.each([
    ["a day's end", "1793439960", "veil"],
    ["the season's end", null, "day"],
  ])("at %s, the rollover rolls the mist only for a day's", async (_turn, endAt, after) => {
    vi.useFakeTimers();
    const { end } = endedDay(RULES, BEFORE_PLAYING_ON.now)!;
    herald.game = { end_at: endAt ?? String(end) };
    // The player went through day 1's end the day before.
    window.localStorage.setItem(`frontier.day-done.1.${RECORDED_DAY.player}`, "1");
    herald.now = end - 1;
    const stop = watchDayTurn({
      store: facts as never,
      gameId: 1,
      player: RECORDED_DAY.player,
      chainNow: () => herald.now,
      blockNow: () => herald.now,
      reproject: () => {},
      navigate: () => {},
    });
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => draw());
    herald.now = end + 1;
    await act(async () => draw());
    await seconds(1);
    expect(phase()).toBe(after);
    expect(host.querySelector(SUMMARY)).toBeNull();
    stop();
  });
});
