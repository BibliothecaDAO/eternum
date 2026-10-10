import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

const player = vi.hoisted(() => ({ current: "0xb7" as string | null }));
const entry = (address: string, rank: number) => ({
  address,
  rank,
  order: 1,
  sites_cleared: { total: 40 - rank },
  chests_earned: 3,
  rewards: { lords: "0" },
  deepest_depth: 1,
});
vi.mock("../herald", () => ({
  useLeaderboard: () => ({
    isError: false,
    isPending: false,
    data: { mode: "frontier", entries: [entry("0xa1", 1), entry("0xb7", 2)] },
  }),
  useRealmsPlayer: () => ({ data: player.current }),
  useDirectory: () => ({ data: { games: [] } }),
  useRecentResults: () => ({ data: { games: [] } }),
}));
vi.mock("@/ui/design-system/kit/player-name", () => ({
  PlayerName: ({ account }: { account: string }) => <span>{account}</span>,
}));

import { entryHref } from "../game-links";
import { ResultsPage } from "./results-page";

let unmount: (() => Promise<void>) | null = null;
afterEach(async () => {
  await unmount?.();
  player.current = "0xb7";
});

const Where = () => {
  const { pathname, search } = useLocation();
  return <output data-where>{pathname + search}</output>;
};

const open = async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/results/0x52-3?from=list"]}>
        <Routes>
          <Route path="/results/:id" element={<ResultsPage />} />
          <Route path="*" element={null} />
        </Routes>
        <Where />
      </MemoryRouter>,
    ),
  );
  unmount = () => act(async () => root.unmount());
  const button = (word: string) =>
    [...container.querySelectorAll("button")].find((each) => each.textContent?.includes(word));
  return { container, button };
};

it("keeps the player's own ended season in reach: its results lead back into it, where its LORDS can be withdrawn", async () => {
  const { container, button } = await open();
  await act(async () => button("Withdraw")!.click());
  expect(container.querySelector("[data-where]")!.textContent).toBe(entryHref({ chainId: "0x52", game_id: 3 }, "play"));
});

it("offers no way in to a reader who held no realm in that season", async () => {
  player.current = "0xc0ffee";
  const { button } = await open();
  expect(button("Season")).toBeDefined();
  expect(button("Withdraw")).toBeUndefined();
});
