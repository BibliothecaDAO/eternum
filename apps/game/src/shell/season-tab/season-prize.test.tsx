import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Call } from "starknet";
import { afterEach, expect, it, vi } from "vitest";

const signed = vi.hoisted(() => ({ calls: [] as Call[][], owners: [] as string[] }));
vi.mock("@/ui/modules/identity/wallet-actions", () => ({
  WalletSign: ({ owner, calls, onLanded }: { owner: string; calls: Call[]; onLanded: () => void }) => (
    <button
      type="button"
      onClick={() => {
        signed.calls.push(calls);
        signed.owners.push(owner);
        onLanded();
      }}
    >
      Sign
    </button>
  ),
}));
// The ledger's views by entrypoint; with none given the ledger answers nothing, so a refetch never reaches a network.
const ledger = vi.hoisted(() => ({
  views: null as Record<string, (calldata: string[]) => string[]> | null,
  asked: [] as string[],
}));
vi.mock("@/runtime/l2-rpc", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/runtime/l2-rpc")>()),
  L2_LEDGER: "0x1ed9e7",
  l2Provider: () => ({
    callContract: async ({ entrypoint, calldata }: { entrypoint: string; calldata: string[] }) => {
      if (!ledger.views) return new Promise<string[]>(() => {});
      ledger.asked.push(entrypoint);
      return ledger.views[entrypoint](calldata);
    },
  }),
}));
const listed = vi.hoisted(() => ({ directory: [] as object[], history: [] as object[] }));
vi.mock("../herald", () => ({
  useRealmsPlayer: () => ({ data: "0x7e" }),
  useDirectory: () => ({ data: { games: listed.directory } }),
  usePlayerHistory: () => ({ data: listed.history }),
}));

import { type SeasonPrize, seasonPrizeKey } from "./blitz-season";
import { SeasonPrizePanel } from "./season-prize";

const WEI = 10n ** 18n;
const NOW = Math.floor(Date.now() / 1000);
const unmounts: (() => Promise<void>)[] = [];

/** A Blitz game filled from slot `slotId`, the player seated with `wallet` on its roster. */
const blitz = (gameId: number, start: number, slotId = gameId, wallet = "0x4a1") => ({
  chainId: "0x52",
  game_id: gameId,
  mode: "blitz",
  clock: { start_main_at: start },
  slotId,
  player_state: { registered: true, settled: true, roster_wallet: wallet, structures: [] },
});

const mount = async (seed?: (client: QueryClient) => void) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  seed?.(client);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <SeasonPrizePanel />
      </QueryClientProvider>,
    ),
  );
  unmounts.push(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  return container;
};

/** The season of the player's game 7, seeded as read: the panel's states without a ledger. */
const mountPrize = (prize: SeasonPrize) => {
  listed.directory = [];
  listed.history = [blitz(7, 1)];
  return mount((client) =>
    client.setQueryData(seasonPrizeKey([{ slot: { shard: "0x52", slotId: 7 }, wallet: "0x4a1" }]), prize),
  );
};

const prize = (season: Partial<SeasonPrize["season"]>, rest: Partial<SeasonPrize> = {}): SeasonPrize => ({
  ledger: "0x1ed9e7",
  seasonId: 3,
  season: {
    participants: 25,
    winners: 3,
    posted: false,
    challenged: false,
    reviewUntil: 0,
    presetId: 4,
    start: NOW - 3600,
    end: NOW + 3600,
    pool: 7_000n * WEI,
    ...season,
  },
  curve: { paidFractionBps: 1000, decayBps: 5000 },
  wallet: "0x4a1",
  share: null,
  position: null,
  claimed: false,
  ...rest,
});

afterEach(async () => {
  for (const unmount of unmounts.splice(0)) await unmount();
  signed.calls = [];
  signed.owners = [];
  ledger.views = null;
  ledger.asked = [];
});

it("shows the pool and what the paid places would take if the season ended now", async () => {
  const panel = await mountPrize(prize({}));
  expect(panel.textContent).toContain("7,000");
  expect(panel.textContent).toContain("3 places paid");
  expect(panel.textContent).toContain("4,000");
  expect(panel.textContent).toContain("1,000");
});

it("waits out the review hour, then claims a winner's share from the wallet that paid", async () => {
  const posted = { posted: true, end: NOW - 7200 };
  expect(
    (await mountPrize(prize({ ...posted, reviewUntil: NOW + 1800 }, { share: 4_000n * WEI, position: 0 }))).textContent,
  ).toContain("Claims open in");
  const claim = await mountPrize(prize({ ...posted, reviewUntil: NOW - 60 }, { share: 4_000n * WEI, position: 0 }));
  await act(async () =>
    [...claim.querySelectorAll("button")].find((button) => button.textContent === "Claim")!.click(),
  );
  await act(async () => [...claim.querySelectorAll("button")].find((button) => button.textContent === "Sign")!.click());
  expect(signed.calls).toEqual([[{ contractAddress: "0x1ed9e7", entrypoint: "claim_season", calldata: ["3", "0"] }]]);
  expect(signed.owners).toEqual(["0x4a1"]);
  expect(
    (await mountPrize(prize({ ...posted, challenged: true }, { share: 4_000n * WEI, position: 0 }))).textContent,
  ).toContain("being checked");
  expect((await mountPrize(prize({ ...posted, reviewUntil: NOW - 60 }))).textContent).toContain(
    "Outside the paid places",
  );
});

it("shows the newest season with a share still to claim, signed by the seat's wallet, else the newest one played", async () => {
  const W1 = "0xa11";
  // Season 3: game 5 from slot 5, the player seated with W1, over and posted with W1 on the list. Season 4: the
  // player has already played game 8 in it, and game 9 is listed.
  const seasons: Record<string, { end: number; posted: boolean }> = {
    "3": { end: NOW - 7200, posted: true },
    "4": { end: NOW + 30 * 86400, posted: false },
  };
  ledger.views = {
    // Slot: season_id, exists, preset, close, end, pool (2), registered_count, cancelled
    get_slot: ([, slotId]) => [slotId === "5" ? "3" : "4", "1", "4", "0", "0", "0", "0", "2", "0"],
    // chest reserve (2), participants, top count, posted, challenged, review until, started, paid (2), exists, preset,
    // start, end, pool (2)
    get_season: ([id]) => [
      ...["0", "0", "25", "3", seasons[id].posted ? "1" : "0", "0", String(NOW - 60), "0", "0", "0", "1", "4", "0"],
      ...[String(seasons[id].end), String(7_000n * WEI), "0"],
    ],
    get_preset: () => ["0", "0", "0", "0", "1000", "5000", ...Array.from({ length: 14 }, () => "0")],
    get_season_winner: ([, index]) => (index === "1" ? [W1, String(2_000n * WEI), "0"] : ["0xb0b", "1", "0"]),
    season_claimed: () => ["0"],
    balance_of: () => [String(WEI), "0"],
  };
  listed.directory = [blitz(9, NOW + 3600)];
  listed.history = [blitz(8, NOW - 3600, 8, "0xb22"), blitz(5, NOW - 86400, 5, W1)];
  const panel = await mount();
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  // Season 3, its share still to claim, over the newer season 4 the player has also played: one season, no list.
  expect(panel.querySelectorAll("section")).toHaveLength(1);
  expect(panel.textContent).toContain("2,000");
  await act(async () =>
    [...panel.querySelectorAll("button")].find((button) => button.textContent === "Claim")!.click(),
  );
  await act(async () => [...panel.querySelectorAll("button")].find((button) => button.textContent === "Sign")!.click());
  expect(signed.owners).toEqual([W1]);
  // The claim names W1's place on the posted list (second), which the ledger checks.
  expect(signed.calls).toEqual([[{ contractAddress: "0x1ed9e7", entrypoint: "claim_season", calldata: ["3", "1"] }]]);
});

it("shows the newest season played once every share is claimed", async () => {
  ledger.views = {
    get_slot: ([, slotId]) => [slotId === "5" ? "3" : "4", "1", "4", "0", "0", "0", "0", "2", "0"],
    get_season: ([id]) => [
      ...["0", "0", "25", "3", id === "3" ? "1" : "0", "0", String(NOW - 60), "0", "0", "0", "1", "4", "0"],
      ...[String(id === "3" ? NOW - 7200 : NOW + 30 * 86400), String((id === "3" ? 7_000n : 9_000n) * WEI), "0"],
    ],
    get_preset: () => ["0", "0", "0", "0", "1000", "5000", ...Array.from({ length: 14 }, () => "0")],
    get_season_winner: () => ["0xa11", String(2_000n * WEI), "0"],
    season_claimed: () => ["1"],
  };
  listed.history = [blitz(8, NOW - 3600, 8, "0xb22"), blitz(5, NOW - 86400, 5, "0xa11")];
  const panel = await mount();
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  // Season 4's running pool, not season 3's claimed share.
  expect(panel.textContent).toContain("9,000");
  expect(panel.textContent).not.toContain("Claim");
});

/** Seasons 3 (over, posted, W1 second on its list) and 4 (running), as the ledger answers them. */
const twoSeasons = (over: Record<string, (calldata: string[]) => string[]> = {}) => ({
  get_slot: ([, slotId]: string[]) => [slotId === "5" ? "3" : "4", "1", "4", "0", "0", "0", "0", "2", "0"],
  get_season: ([id]: string[]) => [
    ...["0", "0", "25", "3", id === "3" ? "1" : "0", "0", String(NOW - 60), "0", "0", "0", "1", "4", "0"],
    ...[String(id === "3" ? NOW - 7200 : NOW + 30 * 86400), String((id === "3" ? 7_000n : 9_000n) * WEI), "0"],
  ],
  get_preset: () => ["0", "0", "0", "0", "1000", "5000", ...Array.from({ length: 14 }, () => "0")],
  get_season_winner: ([, index]: string[]) =>
    index === "1" ? ["0xa11", String(2_000n * WEI), "0"] : ["0xb0b", "1", "0"],
  season_claimed: () => ["0"],
  is_paused: () => ["0"],
  ...over,
});

const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
const buttons = (panel: HTMLElement) => [...panel.querySelectorAll("button")].map((button) => button.textContent);

it("shows the prize of the games it can read when one game's slot cannot be read", async () => {
  ledger.views = twoSeasons({
    get_slot: ([, slotId]) => {
      if (slotId === "8") throw new Error("invalid_ledger_slot");
      return ["3", "1", "4", "0", "0", "0", "0", "2", "0"];
    },
  });
  listed.history = [blitz(8, NOW - 3600, 8, "0xb22"), blitz(5, NOW - 86400, 5, "0xa11")];
  const panel = await mount();
  await settle();
  // Game 8's slot is unreadable; season 3's share, found through game 5, is still shown with its Claim.
  expect(panel.textContent).toContain("2,000");
  expect(buttons(panel)).toContain("Claim");
});

it("offers no Claim while the ledger's payouts are paused, and says they are", async () => {
  ledger.views = twoSeasons({ is_paused: () => ["1"] });
  listed.history = [blitz(5, NOW - 86400, 5, "0xa11")];
  const panel = await mount();
  await settle();
  await settle();
  expect(panel.textContent).toContain("2,000");
  expect(panel.textContent).toContain("Payouts are paused.");
  expect(buttons(panel)).not.toContain("Claim");
});

it("walks a posted list once: reading the prize again asks for no winner a second time", async () => {
  ledger.views = twoSeasons();
  // A wallet outside season 3's three paid places: the whole list is walked to learn it.
  listed.history = [blitz(5, NOW - 86400, 5, "0xc0ffee")];
  let client: QueryClient | undefined;
  const panel = await mount((created) => {
    client = created;
  });
  await settle();
  expect(panel.textContent).toContain("Outside the paid places");
  const winnersAsked = () => ledger.asked.filter((entrypoint) => entrypoint === "get_season_winner").length;
  expect(winnersAsked()).toBe(3);
  await act(async () => client!.refetchQueries({ queryKey: ["ledger", "season"], exact: false }));
  await settle();
  expect(winnersAsked()).toBe(3);
  // The slot's season is asked once too.
  expect(ledger.asked.filter((entrypoint) => entrypoint === "get_slot").length).toBe(1);
});
