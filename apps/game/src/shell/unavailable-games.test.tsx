import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";

vi.mock("./herald", () => ({
  useLeaderboard: () => ({ data: undefined }),
  useRealmsPlayer: () => ({ data: null }),
}));

import type { DirectoryGame } from "./herald";
import type { PlayItem } from "./play/play-board";
import { LeadCard } from "./play/play-item";

const season = {
  chainId: "0x1",
  game_id: 1,
  name: "Unavailable season",
  mode: "frontier",
  status: "Live",
  error: "unavailable",
  expedition: null,
  clock: { start_main_at: 0, end_at: 100 },
  player_count: 1,
  roster_count: 0,
  player_state: { registered: true, roster_wallet: null, structures: [{ category: 1, realm_id: 3098, level: 1 }] },
} as unknown as DirectoryGame;

const lead = (verb: "play" | "resume") => (game: DirectoryGame) => {
  const item: PlayItem = {
    key: "0x1:1",
    mode: "frontier",
    when: "now",
    verb,
    mine: verb === "resume",
    source: "game",
    game,
  };
  return <LeadCard item={item} now={1} signedIn />;
};

it.each([
  ["Play", lead("play")],
  ["Resume", lead("resume")],
] as const)("keeps an unreadable season's %s card, naming the failure in place of its verb", async (verb, card) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => root.render(<MemoryRouter>{card(season)}</MemoryRouter>));
  try {
    expect(container.textContent).toContain("Games did not answer.");
    expect(container.querySelector("button")).toBeNull();
    await act(async () => root.render(<MemoryRouter>{card({ ...season, error: undefined })}</MemoryRouter>));
    expect(container.textContent).not.toContain("did not answer");
    expect(container.querySelector("button")?.textContent).toBe(verb);
  } finally {
    await act(async () => root.unmount());
  }
});
