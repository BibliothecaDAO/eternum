import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("./herald", () => ({
  useLeaderboard: () => ({ data: undefined }),
  useRealmsPlayer: () => ({ data: null }),
}));

import { dayOf } from "@bibliothecadao/eternum";
import type { DirectoryGame } from "./herald";
import { RealmCard } from "./realm-card";

const UNIT = 900;
const START = 1_790_410_020;

const season = (level: number) =>
  ({
    chainId: "0xa",
    game_id: 1,
    mode: "frontier",
    status: "Live",
    clock: { start_settling_at: START, start_main_at: START, end_at: START + 21 * 20 * UNIT, end_grace_seconds: 0 },
    expedition: { day_unit_seconds: UNIT, seed: "7" },
    player_state: {
      registered: true,
      settled: true,
      roster_member: false,
      structures: [{ entity_id: 1, category: 1, realm_id: 3098, level, coord_x: 0, coord_y: 0, resources_packed: "0" }],
    },
  }) as unknown as DirectoryGame;

afterEach(() => vi.useRealTimers());

it("draws the realm's castle at its tier, and the expedition day's dial from the season's clock", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const calendar = { seed: 7n, startMainAt: START, dayUnitSeconds: UNIT };
  let day = dayOf(calendar, START)!;
  while (day.index < 7) day = dayOf(calendar, day.end)!;
  vi.useFakeTimers({ now: (day.start + 600) * 1000, toFake: ["Date"] });
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter>
        <RealmCard season={season(2)} />
      </MemoryRouter>,
    ),
  );
  try {
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/images/realm-card/kingdom.webp");
    expect(container.querySelector("[role='timer']")?.textContent).toBe("D8");
  } finally {
    await act(async () => root.unmount());
  }
});
