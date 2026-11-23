import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { aspects, ordersOfAspect } from "@bibliothecadao/types";

import release from "../../../../../contracts/l3/world-native/schema/release-definition.json";

import type { SeasonCalendar } from "../season-calendar";
import type { DirectoryGame } from "../herald";
import type { SealCodeRefusal } from "@realms-world/identity";

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
  calendar: {
    data: { phases: [] },
    isSuccess: true,
    isError: false,
    error: null,
    refetch: () => {},
  } as Read<SeasonCalendar>,
  history: null as unknown as Read<{ games: DirectoryGame[]; next: null; failures: { url: string }[] }>,
  intent: { order: null, members: {} } as { order: number | null; members: Record<number, number> },
  chosen: [] as number[],
  sealHeld: false,
  redeemed: [] as string[],
  shared: [] as unknown[],
  joined: null as unknown,
}));

vi.mock("@/hooks/context/identity-session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/context/identity-session")>()),
  identityClient: {
    getOrderIntent: async () => reads.intent,
    joinedShare: async () => reads.joined,
    chooseOrder: async (order: number) => {
      reads.chosen.push(order);
      const nextMembers = { ...reads.intent.members };
      if (reads.intent.order !== null) {
        const previous = (nextMembers[reads.intent.order] ?? 1) - 1;
        if (previous <= 0) delete nextMembers[reads.intent.order];
        else nextMembers[reads.intent.order] = previous;
      }
      nextMembers[order] = (nextMembers[order] ?? 0) + 1;
      reads.intent = { order, members: nextMembers };
      return reads.intent;
    },
    createInvite: async () => {
      const { orders } = await import("@bibliothecadao/types");
      const aspect = orders.find(({ orderId }) => orderId === reads.intent.order)?.aspect ?? null;
      if (aspect === null) {
        const { IdentityRequestError } = await import("@realms-world/identity");
        throw new IdentityRequestError(409, "no_aspect");
      }
      reads.shared.push(aspect);
      return { code: "MRGHT234", aspect, chainId: null, gameId: null };
    },
    getSealCode: async () => ({ held: reads.sealHeld }),
    redeemSealCode: async (code: string) => {
      const { IdentityRequestError } = await import("@realms-world/identity");
      reads.redeemed.push(code);
      if (code.trim().toUpperCase() !== "SEAL2345")
        throw new IdentityRequestError(410, "code_unavailable" satisfies SealCodeRefusal);
      reads.sealHeld = true;
      return { held: true };
    },
  },
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
vi.mock("../season-calendar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../season-calendar")>()),
  useSeasonCalendar: () => reads.calendar,
}));
const gameEntryPreload = vi.hoisted(() => ({ primeGameEntry: vi.fn() }));
vi.mock("@/game-entry-preload", () => ({ primeGameEntry: gameEntryPreload.primeGameEntry }));

import { identityClient } from "@/hooks/context/identity-session";

import { PlayPage } from "./play-page";

import { useConnectStore } from "../sign-in/connect";

const HOUR = 3_600;
const DAY = 24 * HOUR;

const REALM = { entity_id: 1, category: 1, realm_id: 3098, level: 1, coord_x: 0, coord_y: 0, resources_packed: "0" };
const game = (over: Partial<DirectoryGame>): DirectoryGame =>
  ({
    chainId: "0xa",
    game_id: 1,
    name: "frontier-1",
    mode: "frontier",
    status: "Live",
    clock_scale: 1,
    expedition: null,
    clock: {
      start_settling_at: 0,
      start_main_at: 100,
      scheduled_end_at: 4_000_000_000,
      end_at: 4_000_000_000,
    },
    player_count: 10,
    player_state: {
      registered: false,
      settled: false,
      held_realm_id: null,
      has_home_source: false,
      taken_realm_ids: [],
      structures: [],
    },
    ...over,
  }) as DirectoryGame;
const ownSeason = game({
  player_state: {
    registered: true,
    settled: true,
    held_realm_id: null,
    has_home_source: false,
    taken_realm_ids: [],
    structures: [REALM],
  },
} as Partial<DirectoryGame>);

let cleanup: (() => Promise<void>) | null = null;
afterEach(async () => {
  vi.useRealTimers();
  await cleanup?.();
  cleanup = null;
  reads.signedIn = true;
  reads.calendar = answered({ phases: [] });
  reads.intent = { order: null, members: {} };
  reads.chosen = [];
  reads.sealHeld = false;
  reads.redeemed = [];
  reads.shared = [];
  reads.joined = null;
  gameEntryPreload.primeGameEntry.mockClear();
  useConnectStore.setState({ request: null });
});

const mount = async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const render = () =>
    act(async () =>
      root.render(
        <QueryClientProvider client={queries}>
          <MemoryRouter initialEntries={["/"]}>
            <Routes>
              <Route path="/" element={<PlayPage />} />
              <Route path="/results/:id" element={<p data-opened-results>opened</p>} />
              <Route path="/g/:chain/:id" element={<p data-entered-game>entered</p>} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      ),
    );
  await render();
  cleanup = async () => {
    await act(async () => root.unmount());
    container.remove();
  };
  return { render, text: () => container.textContent ?? "", container };
};

const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

const press = (container: HTMLElement, word: string) =>
  act(async () =>
    [...container.querySelectorAll("button")].find((button) => button.textContent?.includes(word))!.click(),
  );

it("keeps the games that answered usable while the player's results fail, in full or in part", async () => {
  reads.directory = answered({ games: [ownSeason] });
  reads.history = failed();
  const page = await mount();
  expect(page.text()).toContain("Enter Realm");
  expect(page.text()).toContain("Results did not answer.");

  reads.history = answered({ games: [], next: null, failures: [{ url: "https://shard" }] });
  await page.render();
  expect(page.text()).toContain("Enter Realm");
  expect(page.text()).toContain("Results did not answer.");
});

it.each([
  [1, "1 player"],
  [14, "14 players"],
])("counts a season's %i players in the right number on its card (qa-app-2 P3-12)", async (count, says) => {
  reads.directory = answered({ games: [game({ player_count: count })] });
  reads.history = answered({ games: [], next: null, failures: [] });
  const page = await mount();
  const chips = [...page.container.querySelectorAll(".app-chip")].map((chip) => chip.textContent);
  expect(chips).toContain(says);
  expect(page.text()).not.toMatch(/\b1 [Pp]layers\b/);
});

it("renders hex-tile stone foundation artwork at 0 height, stage progression as height rises, today's quest, and never shows Blitz", async () => {
  reads.directory = answered({ games: [ownSeason] });
  reads.history = answered({ games: [], next: null, failures: [] });
  const noRace = await mount();
  expect(noRace.container.querySelectorAll(".hyper-art__svg")).toHaveLength(0);
  expect(noRace.container.querySelector('section[aria-label="Blitz"]')).toBeNull();
  expect(noRace.text()).not.toContain("No Blitz scheduled");
  await cleanup?.();

  reads.directory = answered({
    games: [
      game({
        ...ownSeason,
        aspect_race: { finish_height: 10_000, season_days: 50, heights: { 1: 0, 2: 0, 3: 0, 4: 0 } },
      }),
    ],
  });
  const zero = await mount();
  expect(zero.container.querySelectorAll(".hyper-art__svg")).toHaveLength(4);
  await cleanup?.();

  reads.directory = answered({
    games: [
      game({
        ...ownSeason,
        day_index: 11,
        day_ends_at: Math.floor(Date.now() / 1000) + 3_600,
        aspect_race: { finish_height: 10_000, season_days: 50, heights: { 1: 7_500, 2: 2_500, 3: 0, 4: 0 } },
        player_state: {
          ...ownSeason.player_state!,
          today_quest: { quest_id: 2, progress: 0, target: 1, labor: 1_500 },
        },
      }),
    ],
  });
  const known = await mount();
  const stages = [...known.container.querySelectorAll("[data-aspect-id] .hyper-art")].map((node) =>
    node.getAttribute("data-stage"),
  );
  expect(stages).toEqual(["3", "1", "0", "0"]);
  expect(known.container.querySelector('[data-aspect-id="1"] .hyper-tile__count')?.textContent).toBe("7,500");
  expect(known.container.querySelector("[data-play-today]")?.textContent).toContain(
    "Clear rifts · 0 of 1 · +1,500 Labor",
  );
  expect(known.container.querySelector("[data-play-invite]")).not.toBeNull();
  expect(known.container.querySelectorAll('[role="timer"]')).toHaveLength(1);
  expect(known.text()).not.toContain("Tomorrow lasts");
});

it("renders rehearsal games as compact secondary cards under InviteCard with speed badge and secondary Join/Resume actions", async () => {
  const rehearsal = game({
    game_id: 4,
    name: "Season 1 Rehearsal",
    clock_scale: 4,
    day_index: 2,
    day_ends_at: Math.floor(Date.now() / 1000) + 3_600,
    player_count: 18,
  });
  reads.directory = answered({ games: [ownSeason, rehearsal] });
  reads.history = answered({ games: [], next: null, failures: [] });
  const joinable = await mount();
  const sidePanels = [...joinable.container.querySelectorAll(".play-side > *")];
  expect(sidePanels.at(-1)?.querySelector("[data-play-rehearsal]")).not.toBeNull();
  const card = joinable.container.querySelector('[data-play-item="0xa:4"]')!.closest(".app-panel")!;
  expect(card.textContent).toContain("Season 1 Rehearsal");
  expect(card.textContent).toContain("4× Rehearsal");
  expect(card.textContent).toContain("Day 3 · 18 players");
  const joinBtn = card.querySelector<HTMLButtonElement>("button")!;
  expect(joinBtn.textContent).toBe("Join rehearsal");
  expect(joinBtn.dataset.kind).toBe("secondary");
  expect(card.querySelector('button[data-kind="primary"]')).toBeNull();
  await cleanup?.();

  const mineRehearsal = game({
    ...rehearsal,
    player_state: ownSeason.player_state,
  });
  reads.directory = answered({ games: [ownSeason, mineRehearsal] });
  const resumable = await mount();
  const mineCard = resumable.container.querySelector('[data-play-item="0xa:4"]')!.closest(".app-panel")!;
  expect(mineCard.textContent).toContain("Day 3 · 18 players");
  const resumeBtn = mineCard.querySelector<HTMLButtonElement>("button")!;
  expect(resumeBtn.textContent).toBe("Resume");
  expect(resumeBtn.dataset.kind).toBe("secondary");
  await cleanup?.();

  reads.signedIn = false;
  reads.directory = answered({ games: [ownSeason, rehearsal] });
  const signedOut = await mount();
  const signedOutBtn = signedOut.container
    .querySelector('[data-play-item="0xa:4"]')!
    .querySelector<HTMLButtonElement>("button")!;
  expect(signedOutBtn.textContent).toBe("Join rehearsal");
  await act(async () => signedOutBtn.click());
  expect(gameEntryPreload.primeGameEntry).toHaveBeenCalledTimes(1);
  expect(useConnectStore.getState().request?.next).toBe("/g/0xa/4");
});

it("shows unseen ended Frontier season results beside a live Frontier lead", async () => {
  const ended = game({
    ...ownSeason,
    game_id: 2,
    season_number: 1,
    status: "Ended",
    clock: {
      start_settling_at: 0,
      start_main_at: 100,
      scheduled_end_at: 1_700_000_000,
      end_at: 1_700_000_000,
    },
  });
  reads.directory = answered({ games: [ownSeason, ended] });
  reads.history = answered({ games: [], next: null, failures: [] });
  const page = await mount();
  const resultRow = page.container.querySelector('[data-play-item="0xa:2"]');
  expect(resultRow).not.toBeNull();
  const button = resultRow?.querySelector<HTMLButtonElement>('button[data-play-verb="results"]');
  expect(button?.textContent).toBe("Results");
  await act(async () => button!.click());
  expect(page.container.querySelector("[data-opened-results]")).not.toBeNull();
});

it.each(["Registration", "Live"] as const)("offers no entry for a retired Eternum game in %s", async (status) => {
  const retired = game({
    game_id: 9,
    mode: "eternum",
    status,
    player_state: { ...ownSeason.player_state, registered: true },
  } as Partial<DirectoryGame>);
  reads.directory = answered({ games: [ownSeason, retired] });
  reads.history = answered({ games: [], next: null, failures: [] });
  const page = await mount();
  expect(page.container.querySelector('[data-play-item="0xa:9"]')).toBeNull();
  expect(page.container.querySelector('section[aria-label="Eternum"]')).toBeNull();
  expect(page.container.querySelector('[data-play-verb="resume"]')?.textContent).toBe("Enter Realm");
});

it("names Frontier by its lockup and omits Blitz", async () => {
  const lockups = (page: { container: HTMLElement }) =>
    [...page.container.querySelectorAll<HTMLImageElement>("[data-age] h2 img, [data-age] h3 img")].map(
      (img) => `${img.closest("[data-age]")!.getAttribute("data-age")} ${img.alt} ${img.getAttribute("src")}`,
    );
  reads.directory = answered({ games: [ownSeason] });
  reads.history = answered({ games: [], next: null, failures: [] });
  const season = await mount();
  expect(lockups(season)).toEqual(["frontier Frontier /images/logos/frontier-lockup.webp"]);
});

it("says the season calendar did not answer when it fails", async () => {
  reads.directory = answered({ games: [ownSeason] });
  reads.history = answered({ games: [], next: null, failures: [] });
  reads.calendar = failed();
  const page = await mount();
  expect(page.text()).toContain("Season did not answer.");
});

describe("the season's countdown, while its first day is ahead and Play has no game to lead with", () => {
  const now = Math.floor(Date.now() / 1000);
  const startsAt = now + 14 * DAY + 3 * HOUR + 20 * 60 + 9;
  const seasonOne = (from: number): SeasonCalendar => ({
    phases: [
      {
        phase: "frontier",
        startsAt: new Date(from * 1000).toISOString(),
        endsAt: new Date((from + 50 * DAY) * 1000).toISOString(),
      },
    ],
  });
  const liveTestnet = (mine = false) =>
    game({
      game_id: 4,
      name: "Final Testnet",
      clock_scale: 4,
      player_count: 18,
      ...(mine ? { player_state: ownSeason.player_state } : {}),
    });
  const quietPlay = () => {
    reads.history = answered({ games: [], next: null, failures: [] });
  };
  const clockUnits = (container: HTMLElement) =>
    ["days", "hours", "minutes", "seconds"].map(
      (unit) => container.querySelector(`[data-countdown-unit="${unit}"] .countdown-clock__value`)?.textContent,
    );

  it("ticks the live countdown every second with role=timer and aria-label", async () => {
    vi.useFakeTimers();
    const baseMs = Date.UTC(2026, 10, 23, 12, 0, 0);
    vi.setSystemTime(baseMs);
    const fixedNow = Math.floor(baseMs / 1000);
    const fixedStartsAt = fixedNow + 8 * DAY + 14 * HOUR + 5 * 60 + 9;
    reads.signedIn = false;
    reads.directory = answered({ games: [] });
    reads.calendar = answered(seasonOne(fixedStartsAt));
    quietPlay();
    const page = await mount();
    const timer = page.container.querySelector('[role="timer"]')!;
    expect(timer.getAttribute("aria-label")).toBe("Starts in 8d 15h");
    expect(clockUnits(page.container)).toEqual(["08", "14", "05", "09"]);

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(clockUnits(page.container)).toEqual(["08", "14", "05", "08"]);

    await act(async () => {
      vi.advanceTimersByTime(9000);
    });
    expect(clockUnits(page.container)).toEqual(["08", "14", "04", "59"]);
  });

  it("shows a signed-out visitor the UTC date, live countdown, Create your Realm when no testnet is live, and optional 4 Aspects", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 10, 23, 12, 0, 0));
    const fixedStartsAt = Date.UTC(2026, 11, 2, 12, 0, 0) / 1000;
    reads.signedIn = false;
    reads.directory = answered({ games: [] });
    reads.calendar = answered(seasonOne(fixedStartsAt));
    quietPlay();
    const page = await mount();
    const countdown = page.container.querySelector("[data-season-countdown]")!;
    expect(countdown.textContent).toContain("Opens 2 December, 12:00 UTC");
    expect(countdown.querySelectorAll('[role="timer"]')).toHaveLength(1);
    expect(countdown.textContent).toContain(
      `4 Aspects, ${Number(release.definition.economy.race.Some.season_days)} days, one hyperstructure to build.`,
    );
    expect([...countdown.querySelectorAll("[data-aspect]")].map((node) => node.getAttribute("data-aspect"))).toEqual(
      aspects.map(({ name }) => name),
    );
    expect(countdown.querySelector("[data-preseason-testnet]")).toBeNull();
    expect(countdown.textContent).toContain("Free to play");
    expect(countdown.textContent).toContain("+100 Fragments per friend · +1,000 bonus at 10");
    expect(countdown.querySelectorAll('button[data-kind="primary"]')).toHaveLength(1);

    await act(async () => countdown.querySelector<HTMLButtonElement>('[data-aspect="Luminary"]')!.click());
    expect(useConnectStore.getState().request).toEqual({ next: null });

    useConnectStore.setState({ request: null });
    await press(page.container, "Create your Realm");
    expect(useConnectStore.getState().request).toEqual({ next: null });
  });

  it("shows Final Testnet live as the single gold CTA for signed-out visitors when a rehearsal is live", async () => {
    reads.signedIn = false;
    reads.directory = answered({ games: [liveTestnet(false)] });
    reads.calendar = answered(seasonOne(startsAt));
    quietPlay();
    const page = await mount();
    const countdown = page.container.querySelector("[data-season-countdown]")!;
    expect(countdown.textContent).toContain("Final Testnet live");
    expect(countdown.textContent).toContain(
      "Final Testnet is live. Learn the game before Season 1 opens and get a head start.",
    );
    expect(countdown.textContent).toContain("Free to play");
    expect(countdown.textContent).not.toContain("Create your Realm");
    const primaries = countdown.querySelectorAll('button[data-kind="primary"]');
    expect(primaries).toHaveLength(1);
    expect(primaries[0]?.textContent).toBe("Play Final Testnet");

    await press(page.container, "Play Final Testnet");
    expect(useConnectStore.getState().request).toEqual({ next: "/g/0xa/4" });
  });

  it("reads rehearsal name and non-live status from the game row and keeps additional rehearsals reachable", async () => {
    const registrationRehearsal = game({
      game_id: 5,
      name: "Autumn Rehearsal",
      status: "Registration",
      clock_scale: 4,
      clock: {
        start_settling_at: 0,
        start_main_at: now + 2 * HOUR,
        scheduled_end_at: 4_000_000_000,
        end_at: 4_000_000_000,
      },
    });
    reads.signedIn = false;
    reads.directory = answered({ games: [registrationRehearsal] });
    reads.calendar = answered(seasonOne(startsAt));
    quietPlay();
    const pending = await mount();
    expect(pending.text()).not.toContain("Final Testnet");
    expect(pending.text()).not.toContain("live");
    expect(pending.text()).toContain("Autumn Rehearsal opens soon.");
    expect(pending.container.querySelector('button[data-kind="primary"]')?.textContent).toBe("Play Autumn Rehearsal");
    await cleanup?.();

    reads.directory = answered({ games: [liveTestnet(false), registrationRehearsal] });
    const both = await mount();
    expect(both.container.querySelector('button[data-kind="primary"]')?.textContent).toBe("Play Final Testnet");
    expect(both.container.querySelector('[data-play-item="0xa:5"]')).not.toBeNull();
    expect(both.container.querySelectorAll('button[data-kind="primary"]')).toHaveLength(1);
  });

  it("lands a signed-in player with no Aspect directly on the countdown with Play or Resume Final Testnet and optional Aspect selection", async () => {
    reads.directory = answered({ games: [liveTestnet(false)] });
    reads.calendar = answered(seasonOne(startsAt));
    const [giants, skill] = ordersOfAspect(1);
    reads.intent = { order: null, members: { [giants!.orderId]: 30, [skill!.orderId]: 9 } };
    quietPlay();
    const page = await mount();
    await settle();

    const countdown = page.container.querySelector("[data-season-countdown]")!;
    expect(countdown.querySelectorAll('[role="timer"]')).toHaveLength(1);
    expect(countdown.querySelector('button[data-kind="primary"]')?.textContent).toBe("Play Final Testnet");
    expect(countdown.querySelectorAll('button[data-kind="primary"]')).toHaveLength(1);
    expect(countdown.textContent).toContain(
      "Optional — choose your Season 1 Aspect now or later. You can change it any time until Season 1 opens.",
    );
    expect(countdown.textContent).toContain(
      "Pick an Aspect above to unlock your Season 1 invite link — friends start in your Aspect when Season 1 opens.",
    );
    expect(countdown.querySelector('[data-aspect="Prowess"]')?.textContent).toContain("39");
    expect(countdown.querySelector("[data-aspect-shared]")?.textContent).toBe(
      "The Aspect's 100,000 LORDS are shared by Glory: your share follows your Glory, not an equal split. The first to finish adds 100,000 more.",
    );

    await press(page.container, "Play Final Testnet");
    expect(page.container.querySelector("[data-entered-game]")).not.toBeNull();
    await cleanup?.();

    reads.directory = answered({ games: [liveTestnet(true)] });
    const resumable = await mount();
    await settle();
    expect(resumable.container.querySelector('button[data-kind="primary"]')?.textContent).toBe("Resume Final Testnet");
  });

  it("lets a signed-in player pick an Aspect and Order, then switch to another Aspect and Order while updating the inline invite link", async () => {
    reads.directory = answered({ games: [liveTestnet(false)] });
    reads.calendar = answered(seasonOne(startsAt));
    const [giants] = ordersOfAspect(1);
    const [perfection] = ordersOfAspect(2);
    reads.intent = { order: giants!.orderId, members: { [giants!.orderId]: 30 } };
    quietPlay();
    const written: string[] = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (text: string) => void written.push(text) },
    });
    const page = await mount();
    await settle();
    await settle();

    const prowessCard = page.container.querySelector<HTMLButtonElement>('[data-aspect="Prowess"]')!;
    expect(prowessCard.getAttribute("aria-pressed")).toBe("true");
    expect(prowessCard.querySelector("[data-aspect-joined]")?.textContent).toBe("Joined");
    expect(prowessCard.querySelector("[data-chosen-order]")?.textContent).toContain(giants!.fullOrderName);
    expect(reads.shared).toEqual([1]);
    expect(page.container.querySelector("[data-season-invite]")?.textContent).toContain(
      "Copy your Prowess link. A friend who opens it starts in Prowess.",
    );
    await press(page.container, "Copy invite link");
    await settle();
    expect(written).toEqual([`${window.location.origin}/s/MRGHT234?via=system`]);
    expect(page.text()).toContain("Link copied");

    await act(async () => page.container.querySelector<HTMLButtonElement>('[data-aspect="Luminary"]')!.click());
    expect([...document.body.querySelectorAll("[data-order]")].map((row) => row.getAttribute("data-order"))).toEqual(
      ordersOfAspect(2).map(({ fullOrderName }) => fullOrderName),
    );
    await act(async () =>
      document.body.querySelector<HTMLButtonElement>(`[data-order="${perfection!.fullOrderName}"]`)!.click(),
    );
    await press(document.body, `Play as ${perfection!.orderName}`);
    await settle();
    await settle();

    expect(reads.chosen).toEqual([perfection!.orderId]);
    expect(page.container.querySelector('[data-aspect="Prowess"]')?.getAttribute("aria-pressed")).toBe("false");
    const luminaryCard = page.container.querySelector('[data-aspect="Luminary"]')!;
    expect(luminaryCard.getAttribute("aria-pressed")).toBe("true");
    expect(luminaryCard.querySelector("[data-aspect-joined]")?.textContent).toBe("Joined");
    expect(luminaryCard.querySelector("[data-chosen-order]")?.textContent).toContain(perfection!.fullOrderName);
    expect(reads.shared).toEqual([1, 2]);
    expect(page.container.querySelector("[data-season-invite]")?.textContent).toContain(
      "Copy your Luminary link. A friend who opens it starts in Luminary.",
    );
    expect(page.text()).not.toContain("Link copied");
  });

  it("puts the Aspect a friend invited the account to first with who invited it; a game invite is ignored", async () => {
    reads.directory = answered({ games: [] });
    reads.calendar = answered(seasonOne(startsAt));
    reads.joined = { kind: "aspect", chainId: null, gameId: null, moment: 3, name: "Dana" };
    quietPlay();
    const page = await mount();
    await settle();
    const cards = [...page.container.querySelectorAll("[data-aspect]")];
    expect(cards.map((card) => card.getAttribute("data-aspect"))).toEqual(["Havoc", "Prowess", "Luminary", "Insight"]);
    expect(page.container.querySelectorAll("[data-aspect-invited]")).toHaveLength(1);
    expect(cards[0]!.querySelector("[data-aspect-invited]")?.textContent).toBe("Dana invited you");

    await cleanup?.();
    reads.joined = { kind: "aspect", chainId: "0xa", gameId: 1, moment: 3, name: "Dana" };
    const again = await mount();
    await settle();
    expect(
      [...again.container.querySelectorAll("[data-aspect]")].map((card) => card.getAttribute("data-aspect")),
    ).toEqual(aspects.map(({ name }) => name));
    expect(again.container.querySelector("[data-aspect-invited]")).toBeNull();
  });

  it("renders SealCodeCard as a compact secondary disclosure with a secondary submit button and holds a valid code", async () => {
    reads.directory = answered({ games: [liveTestnet(false)] });
    reads.calendar = answered(seasonOne(startsAt));
    reads.intent = { order: ordersOfAspect(1)[0]!.orderId, members: {} };
    quietPlay();
    const page = await mount();
    await settle();
    await settle();

    const card = () => page.container.querySelector("[data-seal-code]")!;
    expect(card().getAttribute("data-seal-code")).toBe("open");
    expect(card().textContent).toContain("Have an Ancient Seal code?");
    expect(card().querySelector("input")).toBeNull();

    await act(async () => card().querySelector<HTMLButtonElement>(".seal-disclosure__toggle")!.click());
    expect(card().querySelector("input")).not.toBeNull();
    const submitBtn = card().querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(submitBtn.dataset.kind).toBe("secondary");
    expect(page.container.querySelectorAll('button[data-kind="primary"]')).toHaveLength(1);

    const type = (text: string) =>
      act(() => {
        const input = card().querySelector("input")!;
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, text);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    await type("TAKEN234");
    await act(async () => submitBtn.click());
    await settle();
    expect(card().querySelector(".app-field__line")?.textContent).toBe(
      "That code is taken, expired or not one of ours.",
    );
    await type("seal2345");
    expect(card().querySelector(".app-field__line")).toBeNull();
    await act(async () => submitBtn.click());
    await settle();
    expect(reads.redeemed).toEqual(["TAKEN234", "seal2345"]);
    expect(card().getAttribute("data-seal-code")).toBe("held");
    expect(card().textContent).toContain("Your Ancient Seal is held");
    expect(card().querySelector("input")).toBeNull();
  });

  it("says a choice that was not kept did not go through, and keeps it on Try again", async () => {
    reads.directory = answered({ games: [] });
    reads.calendar = answered(seasonOne(startsAt));
    quietPlay();
    const keep = identityClient.chooseOrder;
    identityClient.chooseOrder = vi.fn(async () => {
      throw new Error("503");
    });
    try {
      const page = await mount();
      await settle();
      const [giants] = ordersOfAspect(1);
      await act(async () => page.container.querySelector<HTMLButtonElement>('[data-aspect="Prowess"]')!.click());
      await act(async () =>
        document.body.querySelector<HTMLButtonElement>(`[data-order="${giants!.fullOrderName}"]`)!.click(),
      );
      await press(document.body, `Play as ${giants!.orderName}`);
      await settle();
      expect(document.body.textContent).toContain("Season did not answer.");
      expect(
        [...document.body.querySelectorAll("button")].filter((each) => each.textContent === "Try again"),
      ).toHaveLength(1);

      identityClient.chooseOrder = keep;
      await press(document.body, "Try again");
      await settle();
      expect(reads.chosen).toEqual([giants!.orderId]);
      expect(page.container.querySelector('[data-aspect="Prowess"]')?.getAttribute("aria-pressed")).toBe("true");
    } finally {
      identityClient.chooseOrder = keep;
    }
  });

  it("refetches the kept Order when chooseOrder returns 409 aspect_chosen after Season 1 starts", async () => {
    reads.directory = answered({ games: [] });
    reads.calendar = answered(seasonOne(startsAt));
    quietPlay();
    const titans = ordersOfAspect(1).at(-1)!;
    const keep = identityClient.chooseOrder;
    identityClient.chooseOrder = vi.fn(async () => {
      reads.intent = { order: titans.orderId, members: { [titans.orderId]: 1 } };
      const { IdentityRequestError } = await import("@realms-world/identity");
      throw new IdentityRequestError(409, "aspect_chosen");
    });
    try {
      const page = await mount();
      await settle();
      const [perfection] = ordersOfAspect(2);
      await act(async () => page.container.querySelector<HTMLButtonElement>('[data-aspect="Luminary"]')!.click());
      await act(async () =>
        document.body.querySelector<HTMLButtonElement>(`[data-order="${perfection!.fullOrderName}"]`)!.click(),
      );
      await press(document.body, `Play as ${perfection!.orderName}`);
      await settle();
      await settle();
      expect(page.container.querySelector('[data-aspect="Prowess"]')?.getAttribute("aria-pressed")).toBe("true");
      expect(page.container.querySelector('[data-aspect="Prowess"] [data-chosen-order]')?.textContent).toContain(
        titans.fullOrderName,
      );
    } finally {
      identityClient.chooseOrder = keep;
    }
  });

  it("keeps the countdown and rehearsal CTA usable when orderIntent fails without showing fabricated member counts", async () => {
    reads.directory = answered({ games: [liveTestnet(false)] });
    reads.calendar = answered(seasonOne(startsAt));
    quietPlay();
    const keep = identityClient.getOrderIntent;
    identityClient.getOrderIntent = vi.fn(async () => {
      throw new Error("503");
    });
    try {
      const page = await mount();
      await settle();
      await settle();
      expect(page.container.querySelectorAll('[role="timer"]')).toHaveLength(1);
      expect(page.container.querySelector('button[data-kind="primary"]')?.textContent).toBe("Play Final Testnet");
      expect(page.container.querySelectorAll("[data-aspect]")).toHaveLength(0);
      expect(page.text()).toContain("Season did not answer.");
    } finally {
      identityClient.getOrderIntent = keep;
    }
  });

  it("keeps Play while a read has not answered", async () => {
    reads.directory = answered({ games: [] });
    reads.calendar = answered(seasonOne(startsAt));
    reads.history = failed();
    const page = await mount();
    expect(page.container.querySelector("[data-season-countdown]")).toBeNull();
    expect(page.text()).toContain("Try again");
  });

  it("gives Play back once a game leads it, or once the first day has come", async () => {
    reads.signedIn = false;
    reads.directory = answered({ games: [ownSeason] });
    reads.calendar = answered(seasonOne(startsAt));
    quietPlay();
    const page = await mount();
    expect(page.container.querySelector("[data-season-countdown]")).toBeNull();

    reads.directory = answered({ games: [] });
    reads.calendar = answered(seasonOne(now - 60));
    await page.render();
    expect(page.container.querySelector("[data-season-countdown]")).toBeNull();
    expect(page.text()).toContain("No season");
  });
});
