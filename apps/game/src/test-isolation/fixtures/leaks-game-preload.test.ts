import { describe, it } from "vitest";

import { GAME_ENTRY_PREFETCH_MILESTONE, markGameEntryMilestone } from "../../ui/layouts/game-entry-timeline";

describe.runIf(process.env.ETERNUM_FILE_BOUNDARY === "1")("a file that triggers real game-entry preload", () => {
  it("leaves the game-entry prefetch mark behind", () => {
    markGameEntryMilestone(GAME_ENTRY_PREFETCH_MILESTONE);
  });
});
