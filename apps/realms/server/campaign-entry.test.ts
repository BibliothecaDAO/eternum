import type { HeraldGameDirectoryEntry } from "@bibliothecadao/eternum/game-sync";
import { expect, it } from "vitest";
import { isCampaignGame } from "./campaign-entry";

it("counts no Season 1 game as a campaign game, open or running", () => {
  for (const status of ["Registration", "Live"] as const) {
    const game = { game_id: 1, name: "season-1", mode: "frontier", status } as HeraldGameDirectoryEntry;
    expect(isCampaignGame(game)).toBe(false);
  }
});
