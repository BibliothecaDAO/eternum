import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

vi.hoisted(() => vi.stubGlobal("fetch", () => new Promise<Response>(() => {})));
const breakdown = (points: number) => ({
  exploration: { count: 36, points: points - 280 },
  openRelicChest: { count: 3, points: 30 },
  hyperStructureBanditsDefeat: { count: 1, points: 100 },
  otherStructureBanditsDefeat: { count: 2, points: 40 },
  hyperstructureShare: { count: 1, points: 110 },
});
// A finished Blitz as Herald's points board answers it: the reader third of three.
vi.mock("../herald", () => ({
  useLeaderboard: () => ({
    isError: false,
    isPending: false,
    data: {
      mode: "points",
      game_id: "7",
      entries: [
        { address: "0xa1", rank: 1, totalPoints: 412, activityBreakdown: breakdown(412) },
        { address: "0xa2", rank: 2, totalPoints: 382, activityBreakdown: breakdown(382) },
        { address: "0xb7", rank: 3, totalPoints: 352, activityBreakdown: breakdown(352) },
      ],
    },
  }),
  useRealmsPlayer: () => ({ data: "0xb7" }),
  useDirectory: () => ({ data: { games: [] } }),
  useRecentResults: () => ({ data: { games: [] } }),
}));
vi.mock("@/hooks/context/identity-session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/context/identity-session")>()),
  useIdentitySession: () => ({ status: "signed-out", session: null }),
}));
vi.mock("@/ui/design-system/kit/player-name", () => ({
  PlayerName: ({ account }: { account: string }) => <span>{account}</span>,
}));

import { setViewportWidth } from "../frame/test-viewport";
import { ResultsPage } from "./results-page";

let unmount: (() => Promise<void>) | null = null;
afterEach(async () => {
  await unmount?.();
  unmount = null;
});

const open = async (width: number) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  setViewportWidth(width);
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/results/0x52-7"]}>
          <Routes>
            <Route path="/results/:id" element={<ResultsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  unmount = () => act(async () => root.unmount());
  return container;
};

it.each([390, 1440])(
  "leads a Blitz result with the player's place and points at %i px, its buttons the page's own",
  async (width) => {
    const page = await open(width);
    const body = page.querySelector('[data-band="body"]')!;
    // The first panel in the body is the outcome: the player's place of the field and their points.
    const outcome = body.querySelector(".app-panel")!;
    expect(outcome.textContent).toContain("3rd of 3");
    expect(outcome.textContent).toContain("352 points");
    // Continue (the gold, with no chest to open) and Share are the page's own.
    const buttons = [...page.querySelectorAll("button")].map((button) => [button.textContent, button.dataset.kind]);
    expect(buttons).toEqual([
      ["Share", "quiet"],
      ["Continue", "primary"],
    ]);
  },
);

it("says how the player's points were made, a row per kind with its count and points, none counted twice", async () => {
  const page = await open(1440);
  const panels = [...page.querySelectorAll(".app-panel")];
  const points = panels.find((panel) => panel.querySelector("h2")?.textContent === "Your points")!;
  expect([...points.querySelectorAll(".app-row")].map((row) => row.textContent)).toEqual([
    "Tiles explored× 3672 points",
    "Crates opened× 330 points",
    "Rifts and camps× 240 points",
    "Hyperstructures taken× 1100 points",
    "Hyperstructures held110 points",
  ]);
});
