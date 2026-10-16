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
// Signed out, without asking a session service: these tests read where Results leads.
vi.mock("@/hooks/context/identity-session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/context/identity-session")>()),
  useIdentitySession: () => ({ status: "signed-out", session: null }),
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

/** A list opens Results with where its Back leads; Play and a match's end open it bare. */
const FROM_LIST = { pathname: "/results/0x52-3", state: { back: "/p/0xa1" } };

const open = async (entry: string | typeof FROM_LIST = FROM_LIST) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[entry]}>
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

it("leads Back to the list that opened it, with no Continue; opened from Play, Continue is the gold step and no Back", async () => {
  const fromList = await open();
  expect(fromList.container.querySelector('[data-role="back"]')!.getAttribute("href")).toBe("/p/0xa1");
  expect(fromList.button("Continue")).toBeUndefined();
  await unmount?.();

  const fromPlay = await open("/results/0x52-3");
  expect(fromPlay.container.querySelector('[data-role="back"]')).toBeNull();
  expect(fromPlay.button("Continue")!.className).toContain("primary");
});
