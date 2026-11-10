import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { notifyManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { dayBounds } from "../hud/day-clock";
import { RECORDED_DAY } from "../rollover/recorded-day-history";

/**
 * Today's page of an earlier day, for a player who missed that day's end (owner, 10 Nov 2026: "I didnt get the recap
 * when I opened the page so no share your day"): prod's Frontier game 1 as its Herald held it on day 3, its leading
 * player's day 2 being 35 reveals and 5 sites cleared.
 */
const herald = vi.hoisted(() => ({
  history: [] as Array<{ block_number: number; transaction_index: number; event_index: number; value: object }>,
}));
/** The account signed in on this device; null for a spectator. */
const viewer = vi.hoisted(() => ({ address: null as string | null }));
/** Identity's shared links: the player's link for a day, and the record of its post. */
const shares = vi.hoisted(() => ({
  createShare: vi.fn(async () => "DAY2LINK"),
  sharePosted: vi.fn(async () => {}),
  shareTally: vi.fn(async () => ({ links: 1, posted: 0, visits: 0, joined: 0, activated: 0 })),
  uploadShareCard: vi.fn(async () => {}),
}));

vi.mock("@/utils/card-image", async (original) => ({
  ...(await original<typeof import("@/utils/card-image")>()),
  cardJpeg: vi.fn(async () => new Blob(["card"], { type: "image/jpeg" })),
}));
vi.mock("@/hooks/context/identity-session", () => ({
  useIdentitySession: () => ({ session: { user: { realmsId: "0xa11ce" } } }),
  notificationOwnerOf: () => null,
  identityClient: shares,
}));
vi.mock("@/hooks/use-player-profile", () => ({
  usePlayerNames: () => ({ text: () => "", reading: () => ({ state: "waiting", text: "…" }) }),
  usePlayerProfile: () => ({ name: null, portrait: null }),
  usePlayerDisplayName: () => "Ashwalker",
  usePlayerName: () => ({ state: "named", text: "Ashwalker", claimed: true }),
}));
vi.mock("@/runtime/world", () => ({ getActiveGame: () => ({ chainId: "0x1" }) }));
vi.mock("@/runtime/world/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/runtime/world/store")>()),
  getActiveGame: () => ({ chainId: "0x1", gameId: 1 }),
}));
vi.mock("@/hooks/store/use-account-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/store/use-account-store")>()),
  useAccountStore: (select: (state: unknown) => unknown) =>
    select({ account: viewer.address ? { address: viewer.address } : null }),
}));
// Opened on day 3, after the player played on in it.
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useNowSeconds: () => RECORDED_DAY.openedAt }));
vi.mock("@/hooks/context/game-context", async () => {
  const { NativeFactStore } = await import("@bibliothecadao/eternum/game-client");
  const store = new NativeFactStore();
  return { useGame: () => ({ setup: { store } }) };
});
vi.mock("../hud/dock-armies", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../hud/dock-armies")>()),
  useDockArmies: () => [],
}));
vi.mock("@bibliothecadao/eternum", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@bibliothecadao/eternum")>()),
  // Each story's own line is not what these tests read.
  buildStoryEventPresentation: () => ({ title: "A story" }),
  configManager: { getActiveGameId: () => 1 },
  getStructureName: () => ({ name: "Temtinos", originalName: "Temtinos" }),
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

const { FrontierToday } = await import("./frontier-today");

const RULES = RECORDED_DAY.calendar as never;
/** The player's realm, as Today is handed it. */
const REALM = { entity_id: 7, owner: BigInt(RECORDED_DAY.player), metadata: { order: 5 } } as never;
const SHARE = "Share your day";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  notifyManager.setNotifyFunction((notify) => act(notify));
  herald.history = RECORDED_DAY.history;
  viewer.address = RECORDED_DAY.player;
  for (const call of Object.values(shares)) call.mockClear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  notifyManager.setNotifyFunction((notify) => notify());
});

const buttons = (within: ParentNode = host) => [...within.querySelectorAll<HTMLButtonElement>("button")];
const totalsShown = () => [...host.querySelectorAll("[data-total]")].map((cell) => cell.textContent);

/** Opens Today on day 3 and waits for the player's history to answer. */
const openToday = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <FrontierToday rules={RULES} realm={REALM} onClose={() => undefined} />
      </QueryClientProvider>,
    ),
  );
  for (let tick = 0; tick < 50 && totalsShown()[0]?.startsWith("—"); tick += 1)
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
};

/** Steps Today back to `day` with its stepper, as the player does. */
const stepBackTo = async (day: number) => {
  for (let shown = 3; shown > day; shown -= 1)
    await act(async () => host.querySelector<HTMLButtonElement>(`button[aria-label="Day ${shown - 1}"]`)!.click());
};

it("shares a day the player played from Today's page of it, as the day-done card does: its card, its post and its link", async () => {
  await openToday();
  // Today is still being played: nothing to share yet.
  expect(buttons().some((button) => button.textContent === SHARE)).toBe(false);

  await stepBackTo(2);
  expect(totalsShown()).toEqual(["35Reveals", "5Sites cleared", "0Chests", "+7.2KEssence", "+524Labor", "+0LORDS"]);
  await act(async () =>
    buttons()
      .find((button) => button.textContent === SHARE)!
      .click(),
  );
  const sheet = document.body.querySelector("section[aria-label='Share your day']")!;
  expect(sheet.querySelector(".day-share__frame .day-card__day")?.textContent).toBe("Day 2");
  expect(shares.createShare).toHaveBeenCalledWith({ kind: "frontier-day", chainId: "0x1", gameId: 1, moment: 2 });

  await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
  const open = vi.spyOn(window, "open").mockImplementation(() => null);
  await act(async () =>
    buttons(sheet)
      .find((button) => button.textContent?.endsWith("Post on X"))!
      .click(),
  );
  const intent = new URL(String(open.mock.calls[0]![0]));
  expect(intent.searchParams.get("url")).toBe(`${window.location.origin}/s/DAY2LINK?via=x`);
  expect(intent.searchParams.get("text")).toBe("Frontier · Day 2 · #1\n🧭 35 · 🚩 5 · 🎁 0\n🐺🐺🛡️🌀🛡️🌀🐺");
  open.mockRestore();

  // Closing the sheet leaves Today on day 2.
  await act(async () =>
    buttons(sheet)
      .find((button) => button.getAttribute("aria-label") === "Close")!
      .click(),
  );
  expect(document.body.querySelector("section[aria-label='Share your day']")).toBeNull();
  expect(host.textContent).toContain("Day 2 of");
});

it("offers no Share on an earlier day the player did not play", async () => {
  // The player's history with nothing of theirs on day 1: no story from before day 2 began.
  const day2 = dayBounds(RECORDED_DAY.calendar, RECORDED_DAY.openedAt, 2)!;
  herald.history = RECORDED_DAY.history.filter(({ value }) => {
    const { timestamp } = value as { timestamp?: string };
    return timestamp !== undefined && Number(BigInt(timestamp)) >= day2.start;
  });
  await openToday();
  await stepBackTo(1);
  expect(host.textContent).toContain("Day 1 of");
  expect(totalsShown()).toEqual(["0Reveals", "0Sites cleared", "0Chests", "+0Essence", "+0Labor", "+0LORDS"]);
  expect(buttons().some((button) => button.textContent === SHARE)).toBe(false);
});

it("offers a spectator no Share on the watched player's day", async () => {
  viewer.address = null;
  await openToday();
  await stepBackTo(2);
  expect(totalsShown()[0]).toBe("35Reveals");
  expect(buttons().some((button) => button.textContent === SHARE)).toBe(false);
});
