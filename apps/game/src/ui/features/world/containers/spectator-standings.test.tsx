import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

// A finished free Blitz watched by one of its two players: both on 0 points, joint first (qa-app-1 P3-11).
vi.mock("@/shell/herald", () => ({ useRealmsPlayer: () => ({ data: "0x5a11" }) }));
vi.mock("@/ui/features/social/player/use-in-game-leaderboard", () => ({
  useInGameLeaderboard: () => ({
    standingsByAddress: new Map([
      ["0xc1", { rank: 1, points: 0 }],
      ["0x5a11", { rank: 1, points: 0 }],
    ]),
  }),
}));
// The other player's realm is the structure selected on the map.
vi.mock("@/hooks/use-fact-view", () => ({
  useFactView: () => [{ entity_id: 9n, owner: 0xc1n, base: { category: 1 } }],
}));
vi.mock("@/hooks/use-player-profile", () => ({ usePlayers: () => [{ address: 0xc1n, name: "clientlane" }] }));
vi.mock("@/hooks/context/game-context", () => ({ useGame: () => ({ setup: { store: {} } }) }));
vi.mock("@/hooks/helpers/use-navigate", () => ({ useNavigateToMapView: () => () => {} }));
vi.mock("./top-header/game-clock", () => ({ useGameFinished: () => true }));

import { useUIStore } from "@/hooks/store/use-ui-store";
import { configManager } from "@bibliothecadao/eternum";

import { SpectatorStandingsBody } from "./spectator-standings";

it("names the watching player's own row You, whoever shares their rank and whatever is selected", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
  useUIStore.setState({ structureEntityId: 9 });
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => root.render(<SpectatorStandingsBody />));
  try {
    const rows = [...container.querySelectorAll<HTMLButtonElement>("button.ui-table-row")];
    const read = rows.map((row) => [row.getAttribute("aria-label"), row.getAttribute("aria-current")]);
    expect(read).toContainEqual(["You: 0 points", null]);
    // The light is the selection's: the selected realm's owner.
    expect(read).toContainEqual(["clientlane: 0 points", "true"]);
  } finally {
    await act(async () => root.unmount());
  }
});
