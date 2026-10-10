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
const ledger = vi.hoisted(() => ({ views: null as Record<string, (calldata: string[]) => string[]> | null }));
vi.mock("@/runtime/l2-rpc", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/runtime/l2-rpc")>()),
  L2_LEDGER: "0x1ed9e7",
  l2Provider: () => ({
    callContract: ({ entrypoint, calldata }: { entrypoint: string; calldata: string[] }) =>
      ledger.views ? Promise.resolve(ledger.views[entrypoint](calldata)) : new Promise(() => {}),
  }),
}));
const listed = vi.hoisted(() => ({ directory: [] as object[], history: [] as object[] }));
vi.mock("../herald", () => ({
  useRealmsPlayer: () => ({ data: "0x7e" }),
  useDirectory: () => ({ data: { games: listed.directory } }),
  useRecentResults: () => ({ data: { games: listed.history } }),
}));

import { type SeasonPrize, seasonPrizeKey } from "./blitz-season";
import { SeasonPrizePanel } from "./season-prize";

const WEI = 10n ** 18n;
const NOW = Math.floor(Date.now() / 1000);
const LEDGER = { address: "0x1ed9e7", chainId: "0x534e5f4d41494e", shard: "0x52" };
const unmounts: (() => Promise<void>)[] = [];

const blitz = (gameId: number, start: number) => ({
  chainId: "0x52",
  game_id: gameId,
  mode: "blitz",
  clock: { start_main_at: start },
  entry: { kind: "paid", ledger: { ...LEDGER, gameId } },
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
  return mount((client) => client.setQueryData(seasonPrizeKey({ ...LEDGER, gameId: 7 }, "0x7e"), prize));
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
  claimed: false,
  ...rest,
});

afterEach(async () => {
  for (const unmount of unmounts.splice(0)) await unmount();
  signed.calls = [];
  signed.owners = [];
  ledger.views = null;
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
    (await mountPrize(prize({ ...posted, reviewUntil: NOW + 1800 }, { share: 4_000n * WEI }))).textContent,
  ).toContain("Claims open in");
  const claim = await mountPrize(prize({ ...posted, reviewUntil: NOW - 60 }, { share: 4_000n * WEI }));
  await act(async () =>
    [...claim.querySelectorAll("button")].find((button) => button.textContent === "Claim")!.click(),
  );
  await act(async () => [...claim.querySelectorAll("button")].find((button) => button.textContent === "Sign")!.click());
  expect(signed.calls).toEqual([[{ contractAddress: "0x1ed9e7", entrypoint: "claim_season", calldata: ["3"] }]]);
  expect(signed.owners).toEqual(["0x4a1"]);
  expect((await mountPrize(prize({ ...posted, challenged: true }, { share: 4_000n * WEI }))).textContent).toContain(
    "being checked",
  );
  expect((await mountPrize(prize({ ...posted, reviewUntil: NOW - 60 }))).textContent).toContain(
    "Outside the paid places",
  );
});

it("keeps a won season's claim when the next season's first game is listed, signed by the wallet that paid", async () => {
  const W1 = "0xa11";
  // Season 3: game 5, paid by W1, over and posted with W1 on the list. Season 4: game 9, just created.
  const seasons: Record<string, { end: number; posted: boolean }> = {
    "3": { end: NOW - 7200, posted: true },
    "4": { end: NOW + 30 * 86400, posted: false },
  };
  ledger.views = {
    // season_id, exists, preset, start, end, pool (2), commitment, registered_count, cancelled, finalized, limit
    get_game: ([, gameId]) => [gameId === "5" ? "3" : "4", "1", "4", "0", "0", "0", "0", "0", "2", "0", "0", "24"],
    get_registered_player: ([, , index]) => (index === "0" ? ["0xb0b", "0x07"] : [W1, "0x7e"]),
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
  listed.history = [blitz(5, NOW - 86400)];
  const panel = await mount();
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  // The player's own season 3, its share still to claim; the next season's game listed in the directory changes nothing.
  expect(panel.querySelectorAll("section")).toHaveLength(1);
  expect(panel.textContent).toContain("2,000");
  await act(async () =>
    [...panel.querySelectorAll("button")].find((button) => button.textContent === "Claim")!.click(),
  );
  await act(async () => [...panel.querySelectorAll("button")].find((button) => button.textContent === "Sign")!.click());
  expect(signed.owners).toEqual([W1]);
  expect(signed.calls).toEqual([[{ contractAddress: "0x1ed9e7", entrypoint: "claim_season", calldata: ["3"] }]]);
});
