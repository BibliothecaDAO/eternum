import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const game = vi.hoisted(() => ({
  races: false,
  fetchRanks: vi.fn(async (_shard: unknown, _game: number, day: number) => ({
    entries: [{ address: "0x1", structure_id: "7", rank: day === 3 ? 2 : 5 }],
  })),
}));
vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({
    setup: {
      store: {
        get: (model: string) => (model === "RaceRules" && game.races ? { game_id: 1 } : undefined),
        absenceKnown: () => ({ known: {} }),
      },
    },
  }),
}));
vi.mock("@/hooks/helpers/use-native-facts", () => ({ useNativeRevision: () => 0 }));
vi.mock("@/hooks/store/use-account-store", () => ({
  useAccountStore: (select: (state: { account: { address: string } }) => unknown) =>
    select({ account: { address: "0x1" } }),
}));
vi.mock("@/runtime/world", () => ({ getActiveGame: () => ({ chainId: "0x1" }) }));
vi.mock("@/services/leaderboard/landing-leaderboard-service", () => ({
  normalizeLeaderboardAddress: (a: string) => a,
}));
vi.mock("@bibliothecadao/eternum", () => ({ configManager: { getActiveGameId: () => 1 } }));
vi.mock("@bibliothecadao/eternum/game-client", () => ({
  fetchHeraldDayRanks: game.fetchRanks,
  requireShard: () => ({ url: "https://herald.test" }),
}));

import { useClosingRankChange } from "./day-ranks";

let host: HTMLDivElement;
let root: Root;
let seen: unknown;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  root = createRoot(host);
  game.fetchRanks.mockClear();
});
afterEach(() => act(() => root.unmount()));

const Reader = ({ day }: { day: number }) => {
  seen = useClosingRankChange(day);
  return null;
};
const read = async () => {
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <Reader day={4} />
      </QueryClientProvider>,
    ),
  );
  for (let turn = 0; turn < 5; turn++) await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
};

it("asks Herald for no rank in a game that races Aspects, and tells no change", async () => {
  game.races = true;
  await read();
  expect(game.fetchRanks).not.toHaveBeenCalled();
  expect(seen).toBeNull();
});

it("tells a legacy game's exact change from the closing ranks of the two days", async () => {
  game.races = false;
  await read();
  expect(game.fetchRanks.mock.calls.map((call) => call[2]).toSorted()).toEqual([2, 3]);
  expect(seen).toEqual({ from: 5, to: 2 });
});
