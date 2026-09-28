import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";

vi.mock("./blitz-slot", () => ({
  BLITZ_SEATS: 12,
  registrationFor: () => undefined,
  seatsFilling: () => 0,
  usePlaytestSlots: () => ({ data: { slots: [] }, isSuccess: true }),
  useJoinSlot: () => ({ register: {} }),
}));
vi.mock("./herald", () => ({
  useLeaderboard: () => ({ data: undefined }),
  useRealmsPlayer: () => ({ data: null }),
}));

import type { DirectoryGame } from "./herald";
import { BlitzLobbyCard, EternumCard, FrontierCard } from "./mode-cards";
import { RealmCard } from "./realm-card";

const game = (mode: DirectoryGame["mode"]) =>
  ({
    chainId: "0x1",
    game_id: 1,
    name: "Unavailable match",
    mode,
    status: "Live",
    ready: true,
    error: "unavailable",
    clock: { start_main_at: 0, end_at: 100 },
    player_count: 1,
    roster_count: 12,
    player_state: { registered: true, roster_member: true, structures: [{ category: 1, realm_id: 3098, level: 1 }] },
  }) as DirectoryGame;

it.each(["frontier", "blitz", "eternum", "realm"])(
  "keeps an unavailable %s visible without an entry action",
  async (mode) => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    const root = createRoot(container);
    const match = game(mode === "blitz" ? "blitz" : mode === "eternum" ? "eternum" : "frontier");
    const card = (match: DirectoryGame) => {
      switch (mode) {
        case "frontier":
          return <FrontierCard season={match} />;
        case "blitz":
          return <BlitzLobbyCard games={[match]} now={1} />;
        case "eternum":
          return <EternumCard games={[match]} now={1} />;
        default:
          return <RealmCard season={match} />;
      }
    };
    await act(async () => root.render(<MemoryRouter>{card(match)}</MemoryRouter>));
    try {
      expect(container.querySelector("article")).not.toBeNull();
      expect(container.textContent).toContain("Unavailable");
      expect(container.querySelector("a,button")).toBeNull();
      await act(async () => root.render(<MemoryRouter>{card({ ...match, error: undefined })}</MemoryRouter>));
      expect(container.textContent).not.toContain("Unavailable");
      expect(container.querySelector("a")?.textContent).toBe(mode === "realm" ? "Resume" : "Enter");
    } finally {
      await act(async () => root.unmount());
    }
  },
);
