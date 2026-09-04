import { describe, expect, it } from "vitest";

import { createWorldmapChunkRecoveryProgress } from "./worldmap-chunk-recovery-progress";

describe("worldmap chunk recovery progress", () => {
  it("does not reschedule an identical failed phase until chunk work makes progress", () => {
    const progress = createWorldmapChunkRecoveryProgress();

    expect(progress.claimRecovery("0,0|chunk_presentation_timeout|asset_prewarm")).toBe(true);
    expect(progress.claimRecovery("0,0|chunk_presentation_timeout|asset_prewarm")).toBe(false);

    progress.markProgress();

    expect(progress.claimRecovery("0,0|chunk_presentation_timeout|asset_prewarm")).toBe(true);
  });

  it("allows a different failed phase to recover independently", () => {
    const progress = createWorldmapChunkRecoveryProgress();

    expect(progress.claimRecovery("0,0|chunk_presentation_timeout|asset_prewarm")).toBe(true);
    expect(progress.claimRecovery("0,0|critical_manager_failure|army")).toBe(true);
  });
});
